/**
 * Customer Loyalty Tier Calculator based on Current Calendar Month Spend.
 *
 * Tier Spend Thresholds (Resets on the 1st of every calendar month):
 * - Bronze:   ₹0 - ₹800 monthly spend
 * - Silver:   ₹800 - ₹2,000 monthly spend
 * - Gold:     ₹2,000 - ₹4,000 monthly spend
 * - Platinum: Above ₹4,000 monthly spend
 */

const { getUserOrders } = require('../services/firestore/order.firestore.service');
const { queryDocs } = require('../lib/firestore');

const TIER_THRESHOLDS = {
  BRONZE: { name: 'Bronze', minSpend: 0, maxSpend: 800 },
  SILVER: { name: 'Silver', minSpend: 800, maxSpend: 2000 },
  GOLD: { name: 'Gold', minSpend: 2000, maxSpend: 4000 },
  PLATINUM: { name: 'Platinum', minSpend: 4000, maxSpend: Infinity },
};

/**
 * Returns the start date of the current calendar month in ISO string format (e.g. 2026-10-01T00:00:00.000Z)
 */
const getCurrentMonthStart = (referenceDate = new Date()) => {
  const d = new Date(referenceDate);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString();
};

/**
 * Determines loyalty tier from monthly spend amount
 */
const determineTierFromSpend = (monthlySpend = 0) => {
  const amount = Number(monthlySpend) || 0;
  if (amount >= 4000) return 'Platinum';
  if (amount >= 2000) return 'Gold';
  if (amount >= 800) return 'Silver';
  return 'Bronze';
};

/**
 * Calculate customer monthly spend and tier
 */
const calculateCustomerMonthlyTier = async (user) => {
  if (!user) {
    return {
      monthlySpend: 0,
      tier: 'Bronze',
      nextTier: 'Silver',
      spendNeededForNextTier: 800,
      monthStart: getCurrentMonthStart(),
    };
  }

  const userId = String(user.id || user._id || user.firebaseUid || '').trim();
  const rawPhone = String(user.phone || '').replace(/\D/g, '').slice(-10);

  // Fetch customer orders
  let orders = [];
  if (userId) {
    orders = await getUserOrders(userId);
  }

  // Also query by phone if customer phone exists to capture all guest or cross-session orders
  if (rawPhone) {
    const [phoneOrdersWithCode, phoneOrdersPlain] = await Promise.all([
      queryDocs('orders', (ref) => ref.where('customer.phone', '==', `+91${rawPhone}`)).catch(() => []),
      queryDocs('orders', (ref) => ref.where('customer.phone', '==', rawPhone)).catch(() => []),
    ]);

    const combined = [...orders, ...phoneOrdersWithCode, ...phoneOrdersPlain];
    const seen = new Set();
    orders = combined.filter((o) => {
      const id = o.orderId || o.id || o._id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  const monthStart = getCurrentMonthStart();

  // Filter valid completed/delivered orders within current calendar month
  const monthlyOrders = orders.filter((o) => {
    if (o.isTest) return false;
    if (o.status === 'Cancelled' || o.paymentStatus === 'Failed') return false;
    const orderDate = o.createdAt || '';
    return orderDate >= monthStart;
  });

  const monthlySpend = monthlyOrders.reduce((sum, o) => {
    const amt = Number(o.amount != null ? o.amount : o.totalAmount) || 0;
    return sum + amt;
  }, 0);

  const roundedMonthlySpend = Math.round(monthlySpend * 100) / 100;
  const tier = determineTierFromSpend(roundedMonthlySpend);

  let nextTier = null;
  let spendNeededForNextTier = 0;

  if (tier === 'Bronze') {
    nextTier = 'Silver';
    spendNeededForNextTier = Math.max(0, 800 - roundedMonthlySpend);
  } else if (tier === 'Silver') {
    nextTier = 'Gold';
    spendNeededForNextTier = Math.max(0, 2000 - roundedMonthlySpend);
  } else if (tier === 'Gold') {
    nextTier = 'Platinum';
    spendNeededForNextTier = Math.max(0, 4000 - roundedMonthlySpend);
  }

  return {
    monthlySpend: roundedMonthlySpend,
    tier,
    nextTier,
    spendNeededForNextTier: Math.round(spendNeededForNextTier * 100) / 100,
    monthStart,
  };
};

module.exports = {
  TIER_THRESHOLDS,
  getCurrentMonthStart,
  determineTierFromSpend,
  calculateCustomerMonthlyTier,
};
