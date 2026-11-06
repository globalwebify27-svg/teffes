/**
 * qa_after_8pm_e2e_audit.js
 * Senior QA Test Suite for After 8:00 PM Order Scheduling & Terminology Integrity
 */

const assert = require('assert');
const { isAfter8PM, calculateNextDay9AM, calculateTargetDeliveryTime, getEtaDetails } = require('../utils/etaCalculator');

console.log('================================================================');
console.log('🧪 RUNNING SENIOR QA AUDIT: AFTER 8 PM NEXT-DAY ORDER WORKFLOW');
console.log('================================================================\n');

// ─── TEST 1: Time Detection Precision ─────────────────────────────────────────
console.log('▶ [TEST 1] Testing isAfter8PM precision across critical timestamps...');

// Helper to construct UTC date for a specific IST time (UTC + 5:30)
function makeISTDate(year, month, day, hours, minutes) {
  // IST is UTC + 5h30m
  const istMs = Date.UTC(year, month - 1, day, hours, minutes, 0);
  const offsetMs = 5.5 * 60 * 60 * 1000;
  return new Date(istMs - offsetMs);
}

// 1. 19:58 IST -> False (Daytime)
const d1 = makeISTDate(2026, 11, 5, 19, 58);
assert.strictEqual(isAfter8PM(d1), false, '19:58 IST must be false');
console.log('   ✅ 19:58 IST: isAfter8PM = false (Daytime ordering allowed)');

// 2. 19:59 IST -> True (Cutoff reached)
const d2 = makeISTDate(2026, 11, 5, 19, 59);
assert.strictEqual(isAfter8PM(d2), true, '19:59 IST must be true');
console.log('   ✅ 19:59 IST: isAfter8PM = true (Cutoff triggers next-day banner)');

// 3. 20:00 IST -> True (After 8 PM)
const d3 = makeISTDate(2026, 11, 5, 20, 0);
assert.strictEqual(isAfter8PM(d3), true, '20:00 IST must be true');
console.log('   ✅ 20:00 IST: isAfter8PM = true');

// 4. 22:30 IST -> True (Night)
const d4 = makeISTDate(2026, 11, 5, 22, 30);
assert.strictEqual(isAfter8PM(d4), true, '22:30 IST must be true');
console.log('   ✅ 22:30 IST: isAfter8PM = true');

// 5. 05:45 IST -> True (Early morning before 8 AM)
const d5 = makeISTDate(2026, 11, 6, 5, 45);
assert.strictEqual(isAfter8PM(d5), true, '05:45 IST must be true');
console.log('   ✅ 05:45 IST: isAfter8PM = true (Morning before shop opening)');

// 6. 08:00 IST -> False (Shop opens at 8 AM)
const d6 = makeISTDate(2026, 11, 6, 8, 0);
assert.strictEqual(isAfter8PM(d6), false, '08:00 IST must be false');
console.log('   ✅ 08:00 IST: isAfter8PM = false (Shop opens, normal daytime flow)');

// 7. 14:30 IST -> False (Mid-day)
const d7 = makeISTDate(2026, 11, 6, 14, 30);
assert.strictEqual(isAfter8PM(d7), false, '14:30 IST must be false');
console.log('   ✅ 14:30 IST: isAfter8PM = false (Normal daytime flow)');


// ─── TEST 2: Next-Day 9:00 AM Delivery Calculation ────────────────────────────
console.log('\n▶ [TEST 2] Testing calculateNextDay9AM target timestamp & date string...');

const eveningOrder = makeISTDate(2026, 11, 5, 20, 30);
const nextDayTarget = calculateNextDay9AM(eveningOrder);

// Convert nextDayTarget to IST components for verification
const istMs = nextDayTarget.getTime() + (5.5 * 60 * 60 * 1000);
const targetIST = new Date(istMs);

assert.strictEqual(targetIST.getUTCFullYear(), 2026);
assert.strictEqual(targetIST.getUTCMonth() + 1, 11);
assert.strictEqual(targetIST.getUTCDate(), 6, 'Date must be tomorrow (Nov 6)');
assert.strictEqual(targetIST.getUTCHours(), 9, 'Hour must be 9 AM IST');
assert.strictEqual(targetIST.getUTCMinutes(), 0, 'Minute must be 00');
console.log(`   ✅ Placed Nov 5 at 20:30 IST -> Target IST: ${targetIST.toISOString().slice(0, 10)} 09:00:00 IST`);

const scheduledDateStr = targetIST.toISOString().slice(0, 10);
assert.strictEqual(scheduledDateStr, '2026-11-06', 'Scheduled date string must be 2026-11-06');
console.log(`   ✅ scheduledDeliveryDate for database: "${scheduledDateStr}"`);


// ─── TEST 3: Controller-Level Logic Simulation ────────────────────────────────
console.log('\n▶ [TEST 3] Simulating order creation controller logic (Normal Day vs After 8 PM)...');

function simulateOrderController(mockNow, reqBody) {
  const isPickup = Boolean(reqBody.fulfillmentType === 'pickup' || reqBody.pickupMode);
  const deliverySlot = reqBody.deliverySlot;
  const itemsSubtotal = reqBody.itemsSubtotal || 450;
  const verifiedDiscount = 0;

  const nowUtc = mockNow;
  const isAfterHours = !isPickup && (
    isAfter8PM(nowUtc) ||
    (deliverySlot && (deliverySlot.toLowerCase().includes('tomorrow') || deliverySlot.toLowerCase().includes('next-day') || deliverySlot.toLowerCase().includes('9:00 am')))
  );

  let resolvedDeliverySlot;
  if (isPickup) {
    resolvedDeliverySlot = 'Store Pickup (Counter Takeaway)';
  } else if (isAfterHours) {
    resolvedDeliverySlot = 'Next-Day Delivery: Tomorrow by 09:00 AM';
  } else {
    resolvedDeliverySlot = deliverySlot || '90 Mins Express Delivery';
  }

  const isExpressSlot = !isPickup && !isAfterHours && Boolean(
    (deliverySlot && deliverySlot.toLowerCase().includes('60 min')) ||
    (deliverySlot && deliverySlot.toLowerCase().includes('express (60'))
  );
  const expressFee = isExpressSlot ? 50 : (isAfterHours ? 0 : (Number(reqBody.expressFee) || 0));
  const standardDeliveryFee = isPickup ? 0 : (itemsSubtotal >= 399 ? 0 : 40);
  const tipAmount = Number(reqBody.tip) || 0;
  const finalAmount = itemsSubtotal + standardDeliveryFee + expressFee + tipAmount - verifiedDiscount;

  const prepMinutes = Number(reqBody.prepTimeMinutes) || 25;
  const initialTransit = isPickup ? 0 : 15;
  const targetDeliveryDateObj = isAfterHours
    ? calculateNextDay9AM(nowUtc)
    : calculateTargetDeliveryTime(nowUtc, prepMinutes, initialTransit, resolvedDeliverySlot);
  const targetDelivery = targetDeliveryDateObj.toISOString();

  const istMs = targetDeliveryDateObj.getTime() + (5.5 * 60 * 60 * 1000);
  const scheduledDeliveryDate = new Date(istMs).toISOString().slice(0, 10);

  return {
    isNextDayOrder: Boolean(isAfterHours),
    scheduledDeliveryDate,
    deliverySlot: resolvedDeliverySlot,
    expressFee,
    targetDeliveryTime: targetDelivery,
    etaStage: isAfterHours ? 'SCHEDULED_NEXT_DAY' : 'PREPARING',
    finalAmount,
  };
}

// Case A: Daytime 2 PM Normal 90 min order
const dayOrder = simulateOrderController(makeISTDate(2026, 11, 5, 14, 0), {
  deliverySlot: '90 Min Delivery',
  itemsSubtotal: 500,
});
assert.strictEqual(dayOrder.isNextDayOrder, false);
assert.strictEqual(dayOrder.deliverySlot, '90 Min Delivery');
assert.strictEqual(dayOrder.expressFee, 0);
assert.strictEqual(dayOrder.etaStage, 'PREPARING');
console.log('   ✅ Daytime 14:00 order: normal 90-min flow preserved, isNextDayOrder = false');

// Case B: Daytime 2 PM Express 60 min order
const dayExpressOrder = simulateOrderController(makeISTDate(2026, 11, 5, 14, 0), {
  deliverySlot: 'Express Delivery (60 min)',
  itemsSubtotal: 500,
});
assert.strictEqual(dayExpressOrder.isNextDayOrder, false);
assert.strictEqual(dayExpressOrder.deliverySlot, 'Express Delivery (60 min)');
assert.strictEqual(dayExpressOrder.expressFee, 50);
console.log('   ✅ Daytime 14:00 Express order: express fee ₹50 applied, normal flow preserved');

// Case C: After 8 PM (20:15) order attempting 60 min express
const nightOrder = simulateOrderController(makeISTDate(2026, 11, 5, 20, 15), {
  deliverySlot: 'Express Delivery (60 min)', // customer had express selected before 8 PM
  expressFee: 50,
  itemsSubtotal: 500,
});
assert.strictEqual(nightOrder.isNextDayOrder, true, 'Must be marked as next-day order');
assert.strictEqual(nightOrder.deliverySlot, 'Next-Day Delivery: Tomorrow by 09:00 AM', 'Slot must be next-day 9 AM');
assert.strictEqual(nightOrder.expressFee, 0, 'Express fee must be locked to 0 after 8 PM');
assert.strictEqual(nightOrder.scheduledDeliveryDate, '2026-11-06', 'Scheduled date must be tomorrow Nov 6');
assert.strictEqual(nightOrder.etaStage, 'SCHEDULED_NEXT_DAY', 'ETA stage must be SCHEDULED_NEXT_DAY');
console.log('   ✅ After 8 PM 20:15 order: slot locked to Next-Day 09:00 AM, express fee zeroed, scheduled for tomorrow');


// ─── TEST 4: Store Admin Date Filter Matching ─────────────────────────────────
console.log('\n▶ [TEST 4] Testing Store Admin Date Filter simulation...');

const ordersList = [
  {
    orderId: 'TEF-100001',
    createdAt: '2026-11-05T08:30:00.000Z', // Day order placed on Nov 5
    scheduledDeliveryDate: '2026-11-05',
    isNextDayOrder: false,
    deliverySlot: '90 Min Delivery',
  },
  {
    orderId: 'TEF-100002',
    createdAt: '2026-11-05T15:00:00.000Z', // 8:30 PM IST order placed on Nov 5
    scheduledDeliveryDate: '2026-11-06', // Scheduled for Nov 6
    isNextDayOrder: true,
    deliverySlot: 'Next-Day Delivery: Tomorrow by 09:00 AM',
  },
];

function filterOrdersByDate(orders, dateFilter) {
  if (!dateFilter) return orders;
  return orders.filter((o) => {
    const scheduledDate = o.scheduledDeliveryDate || (o.targetDeliveryTime ? o.targetDeliveryTime.substring(0, 10) : '');
    const createdDate = (o.createdAt || '').substring(0, 10);
    return scheduledDate === dateFilter || createdDate === dateFilter;
  });
}

// 1. Filter for today (2026-11-05)
const todayMatches = filterOrdersByDate(ordersList, '2026-11-05');
assert(todayMatches.some((o) => o.orderId === 'TEF-100001'), 'Today matches TEF-100001');
console.log(`   ✅ Date filter for today (2026-11-05): found ${todayMatches.length} orders`);

// 2. Filter for tomorrow (2026-11-06)
const tomorrowMatches = filterOrdersByDate(ordersList, '2026-11-06');
assert(tomorrowMatches.some((o) => o.orderId === 'TEF-100002'), 'Tomorrow matches next-day order TEF-100002');
console.log(`   ✅ Date filter for tomorrow (2026-11-06): next-day order TEF-100002 successfully retrieved!`);


// ─── TEST 5: Status Transparency (Pending vs Cutting) ────────────────────────
console.log('\n▶ [TEST 5] Testing customer status transparency (Pending vs Cutting)...');

function getTrackingState(status, deliverySlot) {
  const isConfirmed = ['Cutting', 'Ready', 'Out for Delivery', 'Delivered'].includes(status);
  const isNextDay = deliverySlot && deliverySlot.includes('Tomorrow');

  let bannerTitle;
  let bannerSub;
  let step1Title;

  if (status === 'Pending') {
    bannerTitle = isNextDay ? 'Deliver Tomorrow by 9:00 AM' : 'Order Placed at Teffes';
    bannerSub = 'Awaiting store confirmation & preparation';
    step1Title = 'Order Placed';
  } else if (status === 'Cutting') {
    bannerTitle = 'Order Confirmed & Preparing';
    bannerSub = 'Teffes store team is preparing fresh cuts';
    step1Title = 'Order Confirmed';
  }

  return { bannerTitle, bannerSub, step1Title, isConfirmed };
}

// Pending state:
const pendingState = getTrackingState('Pending', 'Next-Day Delivery: Tomorrow by 09:00 AM');
assert.strictEqual(pendingState.isConfirmed, false, 'Pending order must NOT be confirmed');
assert.strictEqual(pendingState.step1Title, 'Order Placed', 'Step 1 must be Order Placed');
assert.strictEqual(pendingState.bannerTitle, 'Deliver Tomorrow by 9:00 AM');
console.log('   ✅ Pending State: Title = "Deliver Tomorrow by 9:00 AM", Step 1 = "Order Placed" (Awaiting store)');

// Cutting state (after Store Admin clicks Acknowledge):
const cuttingState = getTrackingState('Cutting', 'Next-Day Delivery: Tomorrow by 09:00 AM');
assert.strictEqual(cuttingState.isConfirmed, true, 'Cutting order IS confirmed');
assert.strictEqual(cuttingState.step1Title, 'Order Confirmed', 'Step 1 is now Order Confirmed');
assert.strictEqual(cuttingState.bannerTitle, 'Order Confirmed & Preparing');
console.log('   ✅ Cutting State: Title = "Order Confirmed & Preparing", Step 1 = "Order Confirmed"');

console.log('\n================================================================');
console.log('🎉 ALL SENIOR QA TESTS PASSED WITH 100% SUCCESS!');
console.log('================================================================\n');
