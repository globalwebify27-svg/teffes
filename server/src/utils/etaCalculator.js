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
function calculateNextDay9AM(date = new Date()) {
  const comp = getISTDateComponents(date);
  let targetYear = comp.year;
  let targetMonth = comp.month;
  let targetDate = comp.date;

  if (comp.hours >= 20 || (comp.hours === 19 && comp.minutes >= 59)) {
    targetDate += 1;
  }

  // 9:00:00 AM IST is 03:30:00 UTC
  const utcTargetMs = Date.UTC(targetYear, targetMonth, targetDate, 3, 30, 0, 0);
  return new Date(utcTargetMs);
}

/**
 * Calculates the initial target delivery timestamp when order is placed.
 * If after 7:59 PM or if deliverySlot is for next day, sets to tomorrow 9:00 AM.
 * Otherwise targetDeliveryTime = Placed Time + Prep Time (default 25m) + Est. Travel (15m).
 */
function calculateTargetDeliveryTime(placedAt = new Date(), prepTimeMinutes = 25, transitMinutes = 15, deliverySlot = '') {
  const slotStr = String(deliverySlot || '').toLowerCase();
  const isNextDay = isAfter8PM(placedAt) || slotStr.includes('tomorrow') || slotStr.includes('next-day') || slotStr.includes('9:00 am');
  if (isNextDay) {
    return calculateNextDay9AM(placedAt);
  }
  const baseTime = new Date(placedAt).getTime();
  const totalDurationMs = (prepTimeMinutes + transitMinutes) * 60 * 1000;
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
  const isNextDay = order.isNextDayOrder === true ||
    isAfter8PM(order.createdAt) ||
    slotStr.includes('tomorrow') ||
    slotStr.includes('next-day') ||
    slotStr.includes('9:00 am');

  if (isNextDay && (status === 'Pending' || status === 'Cutting')) {
    const nextDaySub = status === 'Cutting'
      ? 'Teffes store team is preparing fresh cuts'
      : 'Teffes store opens at 8:00 AM • Order will be prepared & delivered by 9:00 AM';

    return {
      stage: 'SCHEDULED_NEXT_DAY',
      isNextDay: true,
      displayText: 'Tomorrow by 9:00 AM',
      subText: nextDaySub,
      targetClockTime: 'Tomorrow 09:00 AM',
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
  getEtaDetails,
};
