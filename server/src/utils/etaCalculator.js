/**
 * etaCalculator.js
 * Production-grade dynamic delivery ETA calculation engine for TeFFe's.
 * Computes road distance, transit duration, operational prep target, and multi-phase ETA stage.
 */

// Default store hub coordinates (Kishore Ganj Hub, Ranchi)
const DEFAULT_HUB_COORDS = { lat: 23.3441, lng: 85.3096 };

// City delivery speed: 22 km/h average for motorcycle in Ranchi traffic
const AVG_CITY_SPEED_KMH = 22;

// Road tortuosity factor (roads are ~1.3x straight-line distance)
const ROAD_TORTUOSITY_FACTOR = 1.3;

/**
 * Calculates road distance in kilometers using the Haversine formula with road winding factor.
 */
function calculateRoadDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 3.5; // default fallback 3.5 km
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLine = R * c;
  return Number((straightLine * ROAD_TORTUOSITY_FACTOR).toFixed(2));
}

/**
 * Calculates transit time in minutes from distance in km.
 */
function calculateTransitMinutes(distanceKm) {
  const travelHours = distanceKm / AVG_CITY_SPEED_KMH;
  const minutes = Math.round(travelHours * 60);
  return Math.max(2, minutes);
}

/**
 * Helper to get IST date components (UTC + 5:30) independently of host server timezone
 */
function getISTDateComponents(date = new Date()) {
  const d = new Date(date);
  const istMs = d.getTime() + (5.5 * 60 * 60 * 1000);
  const ist = new Date(istMs);
  return {
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth(),
    date: ist.getUTCDate(),
    hours: ist.getUTCHours(),
    minutes: ist.getUTCMinutes(),
  };
}

/**
 * Helper to check if current time in IST is after 7:59 PM (20:00 to 07:59)
 */
function isAfter8PM(date = new Date()) {
  const comp = getISTDateComponents(date);
  return comp.hours >= 20 || (comp.hours === 19 && comp.minutes >= 59) || comp.hours < 8;
}

/**
 * Calculates next-day (or next available morning) 9:00 AM IST delivery time.
 * Pure UTC: 9:00 AM IST is 03:30 AM UTC.
 */
function calculateNextDay9AM(date = new Date(), forceNextDay = false) {
  const comp = getISTDateComponents(date);
  let targetYear = comp.year;
  let targetMonth = comp.month;
  let targetDate = comp.date;

  // After 8:00 AM IST or when forceNextDay is true, 9:00 AM is tomorrow morning
  if (forceNextDay || comp.hours >= 8 || (comp.hours === 7 && comp.minutes >= 59)) {
    targetDate += 1;
  }

  // 9:00:00 AM IST is 03:30:00 UTC
  const utcTargetMs = Date.UTC(targetYear, targetMonth, targetDate, 3, 30, 0, 0);
  return new Date(utcTargetMs);
}

/**
 * Helper to get today's date string in IST (YYYY-MM-DD)
 */
function getTodayISTDateString(date = new Date()) {
  const comp = getISTDateComponents(date);
  const m = String(comp.month + 1).padStart(2, '0');
  const d = String(comp.date).padStart(2, '0');
  return `${comp.year}-${m}-${d}`;
}

/**
 * Checks if a given time is at or past a cutoff time in IST (e.g. '13:00')
 */
function isPastSpecialCloseTime(closeTimeStr, date = new Date()) {
  if (!closeTimeStr || typeof closeTimeStr !== 'string') return false;
  const [cH, cM] = closeTimeStr.split(':').map(Number);
  if (isNaN(cH)) return false;
  const comp = getISTDateComponents(date);
  const closeMinutes = cH * 60 + (isNaN(cM) ? 0 : cM);
  const currentMinutes = comp.hours * 60 + comp.minutes;
  return currentMinutes >= closeMinutes;
}

/**
 * Checks if a given time is before an opening time in IST (e.g. '12:00')
 */
function isBeforeSpecialOpenTime(openTimeStr, date = new Date()) {
  if (!openTimeStr || typeof openTimeStr !== 'string') return false;
  const [oH, oM] = openTimeStr.split(':').map(Number);
  if (isNaN(oH)) return false;
  const comp = getISTDateComponents(date);
  const openMinutes = oH * 60 + (isNaN(oM) ? 0 : oM);
  const currentMinutes = comp.hours * 60 + comp.minutes;
  return currentMinutes < openMinutes;
}

/**
 * Calculates delivery time for orders placed before a late opening time.
 * Delivery = today's open time + 90 minutes.
 */
function calculateSpecialOpenDeliveryTime(openTimeStr, date = new Date()) {
  const comp = getISTDateComponents(date);
  const [oH, oM] = (openTimeStr || '08:00').split(':').map(Number);
  const safeOH = isNaN(oH) ? 8 : oH;
  const safeOM = isNaN(oM) ? 0 : oM;

  // Store opening time + 90 minutes (standard delivery buffer before rider allotment)
  const totalOpenMinutesIST = safeOH * 60 + safeOM + 90;
  const openDateIST = new Date(Date.UTC(comp.year, comp.month, comp.date, 0, totalOpenMinutesIST, 0, 0));
  // Subtract 5:30 to get UTC
  return new Date(openDateIST.getTime() - (5.5 * 60 * 60 * 1000));
}

/**
 * Calculates the initial target delivery timestamp when order is placed.
 * If after 7:59 PM or if deliverySlot is for next day or after special cutoff, sets to tomorrow 9:00 AM.
 * If placed before late opening, schedules at store opening time + 90 min.
 * Otherwise targetDeliveryTime = Placed Time + 90 min (standard, never less than 90 min before rider allotment).
 * If express 60-min slot is selected, targetDeliveryTime = Placed Time + 60 min.
 */
function calculateTargetDeliveryTime(placedAt = new Date(), prepTimeMinutes = 25, transitMinutes = 15, deliverySlot = '', specialSchedule = null) {
  const slotStr = String(deliverySlot || '').toLowerCase();
  const isGenericNextDay = isAfter8PM(placedAt) || slotStr.includes('tomorrow') || slotStr.includes('next-day') || slotStr.includes('9:00 am');

  // Check special schedule rules if active for today
  if (specialSchedule) {
    if (specialSchedule.mode === 'closed') {
      return calculateNextDay9AM(placedAt);
    }
    if ((specialSchedule.mode === 'half_day' || specialSchedule.mode === 'custom_hours') && specialSchedule.closeTime) {
      if (isPastSpecialCloseTime(specialSchedule.closeTime, placedAt)) {
        return calculateNextDay9AM(placedAt);
      }
    }
    if ((specialSchedule.mode === 'late_opening' || specialSchedule.mode === 'custom_hours') && specialSchedule.openTime) {
      if (isBeforeSpecialOpenTime(specialSchedule.openTime, placedAt)) {
        return calculateSpecialOpenDeliveryTime(specialSchedule.openTime, placedAt);
      }
    }
  }

  if (isGenericNextDay) {
    return calculateNextDay9AM(placedAt);
  }
  const baseTime = new Date(placedAt).getTime();
  const isExpress = slotStr.includes('60 min') || slotStr.includes('express');
  const durationMinutes = isExpress ? 60 : 90; // Never less than 90 mins for standard delivery
  const totalDurationMs = durationMinutes * 60 * 1000;
  return new Date(baseTime + totalDurationMs);
}

/**
 * Determines the multi-phase ETA stage and customer-facing display text.
 */
function getEtaDetails(order) {
  if (!order) {
    return {
      stage: 'PREPARING',
      displayText: 'Preparing your order',
      subText: 'Arriving soon',
      minutesRemaining: 30,
    };
  }

  const status = order.status;

  if (status === 'Delivered') {
    return {
      stage: 'DELIVERED',
      displayText: 'Delivered',
      subText: 'Delivered fresh to your kitchen',
      minutesRemaining: 0,
    };
  }

  // Phase 2 & 3: Out for Delivery
  if (status === 'Out for Delivery') {
    const transitMins = order.remainingTransitMinutes != null ? order.remainingTransitMinutes : 15;

    // Near doorstep (< 1 km or <= 5 mins)
    if (transitMins <= 5 || order.etaStage === 'NEAR_DOORSTEP') {
      return {
        stage: 'NEAR_DOORSTEP',
        displayText: 'Arriving in ~5 min',
        subText: 'Rider in neighborhood • Keep 4-digit OTP ready',
        minutesRemaining: Math.min(5, transitMins),
      };
    }

    return {
      stage: 'IN_TRANSIT',
      displayText: `Arriving in ${transitMins} min`,
      subText: 'Rider is on the way with your insulated box',
      minutesRemaining: transitMins,
    };
  }

  // Phase 1: In-Store Prep (Pending, Cutting, Ready)
  const slotStr = String(order.deliverySlot || '').toLowerCase();
  const isMorningSlot = order.isNextDayOrder === true ||
    isAfter8PM(order.createdAt) ||
    slotStr.includes('tomorrow') ||
    slotStr.includes('next-day') ||
    slotStr.includes('9:00 am');

  if (isMorningSlot && (status === 'Pending' || status === 'Cutting')) {
    // Dynamically calculate whether the scheduled delivery is TODAY or TOMORROW
    const todayIST = getTodayISTDateString(new Date());
    let targetDateIST = order.scheduledDeliveryDate || '';
    if (!targetDateIST && order.targetDeliveryTime) {
      targetDateIST = getTodayISTDateString(order.targetDeliveryTime);
    }
    if (!targetDateIST && order.createdAt) {
      const placedComp = getISTDateComponents(order.createdAt);
      if (placedComp.hours >= 20 || (placedComp.hours === 19 && placedComp.minutes >= 59)) {
        // Placed at night -> delivery tomorrow
        const placedDate = new Date(order.createdAt);
        const nextDay = new Date(placedDate.getTime() + 24 * 60 * 60 * 1000);
        targetDateIST = getTodayISTDateString(nextDay);
      } else {
        // Placed early morning or during day -> delivery today
        targetDateIST = getTodayISTDateString(order.createdAt);
      }
    }

    const isToday = !targetDateIST || targetDateIST <= todayIST;
    const dayLabel = isToday ? 'Today' : 'Tomorrow';

    const nextDaySub = status === 'Cutting'
      ? 'Teffes store team is preparing fresh cuts'
      : `Teffes store opens at 8:00 AM • Order will be prepared & delivered ${isToday ? 'today' : 'tomorrow'} by 9:00 AM`;

    return {
      stage: isToday ? 'SCHEDULED_SAME_DAY' : 'SCHEDULED_NEXT_DAY',
      isNextDay: !isToday,
      displayText: `${dayLabel} by 9:00 AM`,
      subText: nextDaySub,
      targetClockTime: `${dayLabel} 09:00 AM`,
      minutesRemaining: 60,
    };
  }

  let targetTimeStr = '';
  if (order.targetDeliveryTime) {
    const dt = new Date(order.targetDeliveryTime);
    targetTimeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } else {
    const fallbackDt = new Date(new Date(order.createdAt || Date.now()).getTime() + 40 * 60 * 1000);
    targetTimeStr = fallbackDt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  const prepSubText = status === 'Cutting'
    ? 'Teffes store team is preparing fresh cuts'
    : status === 'Ready'
    ? 'Packed fresh & waiting for rider'
    : 'Order placed at Teffes • Awaiting store confirmation';

  return {
    stage: 'PREPARING',
    displayText: `Arriving by ${targetTimeStr}`,
    subText: prepSubText,
    targetClockTime: targetTimeStr,
    minutesRemaining: order.prepTimeMinutes || 25,
  };
}

module.exports = {
  DEFAULT_HUB_COORDS,
  calculateRoadDistanceKm,
  calculateTransitMinutes,
  calculateTargetDeliveryTime,
  calculateNextDay9AM,
  isAfter8PM,
  getISTDateComponents,
  getEtaDetails,
  getTodayISTDateString,
  isPastSpecialCloseTime,
  isBeforeSpecialOpenTime,
  calculateSpecialOpenDeliveryTime,
};
