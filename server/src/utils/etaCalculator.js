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
 * Calculates the initial target delivery timestamp when order is placed.
 * targetDeliveryTime = Placed Time + Prep Time (default 25m) + Est. Travel (15m)
 */
function calculateTargetDeliveryTime(placedAt = new Date(), prepTimeMinutes = 25, transitMinutes = 15) {
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
      displayText: 'Delivered ✓',
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
  let targetTimeStr = '';
  if (order.targetDeliveryTime) {
    const dt = new Date(order.targetDeliveryTime);
    targetTimeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } else {
    // Fallback: 40 minutes from order creation
    const fallbackDt = new Date(new Date(order.createdAt || Date.now()).getTime() + 40 * 60 * 1000);
    targetTimeStr = fallbackDt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  const prepSubText = status === 'Cutting'
    ? 'Master butcher slicing fresh cuts'
    : status === 'Ready'
    ? 'Packed fresh & waiting for rider'
    : 'Order confirmed & sent to cutting station';

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
  getEtaDetails,
};
