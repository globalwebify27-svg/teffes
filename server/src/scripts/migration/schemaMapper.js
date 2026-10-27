/**
 * Schema Mapper for MongoDB to Firestore Migration
 * Provides deterministic transformations, foreign key preservation, and date normalization.
 */

const { getSlotDocId } = require('../../services/firestore/deliverySlot.firestore.service');
const { getReviewDocId } = require('../../services/firestore/review.firestore.service');
const { getInventoryDocId } = require('../../services/firestore/inventory.firestore.service');

/**
 * Normalizes ObjectId or string to plain string.
 */
const toStringId = (val) => {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (val.toString) return val.toString().trim();
  return String(val).trim();
};

/**
 * Normalizes Date or timestamp to ISO string.
 */
const toIsoDate = (val, fallback = new Date().toISOString()) => {
  if (!val) return fallback;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? fallback : d.toISOString();
  } catch {
    return fallback;
  }
};

/**
 * Recursively sanitize ObjectIds in arrays/objects into plain strings.
 */
const cleanObjectIds = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(cleanObjectIds);

  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '__v') continue; // strip Mongoose version key
    if (v && typeof v === 'object' && v.constructor && v.constructor.name === 'ObjectId') {
      out[k] = v.toString();
    } else if (v && typeof v === 'object' && v._bsontype === 'ObjectID') {
      out[k] = v.toString();
    } else if (v && typeof v === 'object') {
      out[k] = cleanObjectIds(v);
    } else {
      out[k] = v;
    }
  }
  return out;
};

const mappers = {
  Banner: (doc) => {
    const docId = toStringId(doc._id);
    return {
      collection: 'banners',
      docId,
      data: {
        _id: docId,
        id: docId,
        title: doc.title || '',
        image: doc.image || '',
        link: doc.link || '',
        order: Number(doc.order) || 0,
        isActive: doc.isActive !== false,
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },

  Category: (doc) => {
    const slug = (doc.slug || '').trim().toLowerCase();
    const docId = slug;
    return {
      collection: 'categories',
      docId,
      data: {
        _id: toStringId(doc._id),
        id: docId,
        slug,
        name: doc.name || '',
        tagline: doc.tagline || '',
        icon: doc.icon || '',
        image: doc.image || '',
        order: Number(doc.order) || 0,
        isActive: doc.isActive !== false,
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },

  Coupon: (doc) => {
    const code = (doc.code || '').trim().toUpperCase();
    const docId = code;
    return {
      collection: 'coupons',
      docId,
      data: {
        _id: toStringId(doc._id),
        id: docId,
        code,
        description: doc.description || '',
        discount: Number(doc.discount) || 0,
        discountType: doc.discountType || 'percentage',
        discountValue: Number(doc.discountValue) || Number(doc.discount) || 0,
        minOrderAmount: Number(doc.minOrderAmount) || Number(doc.minOrder) || 0,
        minOrder: Number(doc.minOrder) || Number(doc.minOrderAmount) || 0,
        maxDiscountAmount: doc.maxDiscountAmount ? Number(doc.maxDiscountAmount) : null,
        validFrom: doc.validFrom ? toIsoDate(doc.validFrom) : null,
        validTill: doc.validTill ? toIsoDate(doc.validTill) : null,
        firstOrderOnly: Boolean(doc.firstOrderOnly),
        usageLimit: doc.usageLimit ? Number(doc.usageLimit) : null,
        usageCount: Number(doc.usageCount) || Number(doc.used) || 0,
        used: Number(doc.used) || Number(doc.usageCount) || 0,
        isActive: doc.isActive !== false && doc.status !== 'Inactive',
        status: doc.status || (doc.isActive === false ? 'Inactive' : 'Active'),
        isSuperOffer: Boolean(doc.isSuperOffer),
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },

  CrossSellItem: (doc) => {
    const docId = (doc.id || toStringId(doc._id)).trim().toLowerCase();
    return {
      collection: 'cross_sell_items',
      docId,
      data: {
        _id: toStringId(doc._id),
        id: docId,
        name: doc.name || '',
        price: Number(doc.price) || 0,
        originalPrice: Number(doc.originalPrice) || Number(doc.price) || 0,
        image: doc.image || '',
        weight: doc.weight || '',
        category: doc.category || '',
        inStock: doc.inStock !== false,
        isActive: doc.isActive !== false,
        displayOrder: Number(doc.displayOrder) || 0,
        storeId: doc.storeId ? doc.storeId.trim().toUpperCase() : 'ALL',
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },

  DeliverySlot: (doc) => {
    const storeId = (doc.storeId || 'S001').trim().toUpperCase();
    const slot = (doc.slot || '').trim();
    const docId = getSlotDocId(storeId, slot);
    return {
      collection: 'delivery_slots',
      docId,
      data: {
        _id: toStringId(doc._id),
        id: docId,
        slot,
        storeId,
        capacity: Number(doc.capacity) || 30,
        booked: Number(doc.booked) || 0,
        riders: Array.isArray(doc.riders) ? doc.riders.map(r => cleanObjectIds(r)) : [],
        status: doc.status || 'Open',
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },

  Inventory: (doc) => {
    const storeId = (doc.storeId || 'S001').trim().toUpperCase();
    const itemId = (doc.itemId || toStringId(doc._id)).trim().toUpperCase();
    const docId = getInventoryDocId(storeId, itemId);
    return {
      collection: 'inventory',
      docId,
      data: {
        _id: toStringId(doc._id),
        id: docId,
        itemId,
        item: doc.item || '',
        category: doc.category || '',
        stock: Number(doc.stock) || 0,
        defreezeStock: Number(doc.defreezeStock) || 0,
        wasteStock: Number(doc.wasteStock) || 0,
        min: Number(doc.min) || 5,
        unit: doc.unit || 'Kg',
        status: doc.status || (Number(doc.stock) <= Number(doc.min) ? 'Low Stock' : 'In Stock'),
        lastRestocked: doc.lastRestocked ? toIsoDate(doc.lastRestocked) : null,
        storeId,
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },

  InventoryHistory: (doc) => {
    const docId = toStringId(doc._id);
    return {
      collection: 'inventory_history',
      docId,
      data: {
        _id: docId,
        id: docId,
        storeId: (doc.storeId || '').trim().toUpperCase(),
        itemId: (doc.itemId || '').trim().toUpperCase(),
        productName: doc.productName || '',
        category: doc.category || '',
        classification: doc.classification || 'stock',
        actionType: doc.actionType || 'adjustment',
        quantity: Number(doc.quantity) || 0,
        unit: doc.unit || 'Kg',
        previousQuantity: Number(doc.previousQuantity) || 0,
        resultingQuantity: Number(doc.resultingQuantity) || 0,
        sourceClassification: doc.sourceClassification || null,
        destinationClassification: doc.destinationClassification || null,
        reason: doc.reason || '',
        notes: doc.notes || '',
        orderId: doc.orderId ? toStringId(doc.orderId) : null,
        actor: {
          userId: toStringId(doc.actor?.userId),
          name: doc.actor?.name || 'System',
          role: doc.actor?.role || 'system',
          email: doc.actor?.email || '',
        },
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },

  NotificationToken: (doc) => {
    const docId = toStringId(doc._id);
    return {
      collection: 'notification_tokens',
      docId,
      data: {
        _id: docId,
        id: docId,
        userId: toStringId(doc.userId),
        fcmToken: doc.fcmToken || '',
        deviceType: doc.deviceType || 'android',
        appType: doc.appType || 'customer',
        deviceInfo: doc.deviceInfo ? cleanObjectIds(doc.deviceInfo) : {},
        isActive: doc.isActive !== false,
        lastSeenAt: toIsoDate(doc.lastSeenAt),
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },

  Order: (doc) => {
    const orderId = (doc.orderId || toStringId(doc._id)).trim();
    const docId = orderId;
    return {
      collection: 'orders',
      docId,
      data: {
        _id: toStringId(doc._id),
        id: docId,
        orderId,
        customer: {
          name: doc.customer?.name || 'Customer',
          phone: doc.customer?.phone || '',
          email: doc.customer?.email || '',
          userId: toStringId(doc.customer?.userId),
          address: doc.customer?.address || '',
          lat: Number(doc.customer?.lat) || null,
          lng: Number(doc.customer?.lng) || null,
        },
        items: Array.isArray(doc.items)
          ? doc.items.map((it) => ({
              ...cleanObjectIds(it),
              productId: toStringId(it.productId || it.id),
              quantity: Number(it.quantity) || 1,
              price: Number(it.price) || 0,
            }))
          : [],
        itemSummary: doc.itemSummary || '',
        amount: Number(doc.amount) || 0,
        status: doc.status || 'Pending',
        storeId: (doc.storeId || 'S001').trim().toUpperCase(),
        storeName: doc.storeName || '',
        rider: doc.rider
          ? {
              riderId: toStringId(doc.rider.riderId),
              name: doc.rider.name || '',
              phone: doc.rider.phone || '',
              vehicleNumber: doc.rider.vehicleNumber || '',
              lat: Number(doc.rider.lat) || null,
              lng: Number(doc.rider.lng) || null,
            }
          : null,
        deliveryOtp: doc.deliveryOtp || null,
        riderEarning: Number(doc.riderEarning) || 0,
        tipAmount: Number(doc.tipAmount) || 0,
        cashCollected: Boolean(doc.cashCollected),
        pickedUpAt: doc.pickedUpAt ? toIsoDate(doc.pickedUpAt) : null,
        deliveredAt: doc.deliveredAt ? toIsoDate(doc.deliveredAt) : null,
        riderRating: doc.riderRating ? Number(doc.riderRating) : null,
        riderRatingFeedback: doc.riderRatingFeedback || null,
        riderRatedAt: doc.riderRatedAt ? toIsoDate(doc.riderRatedAt) : null,
        deliverySlot: doc.deliverySlot || '',
        expressFee: Number(doc.expressFee) || 0,
        fulfillmentType: doc.fulfillmentType || 'delivery',
        pickupMode: Boolean(doc.pickupMode),
        prepTimeMinutes: Number(doc.prepTimeMinutes) || 15,
        targetDeliveryTime: doc.targetDeliveryTime ? toIsoDate(doc.targetDeliveryTime) : null,
        remainingTransitMinutes: Number(doc.remainingTransitMinutes) || null,
        etaStage: doc.etaStage || null,
        paymentMethod: doc.paymentMethod || 'Cash on Delivery',
        paymentStatus: doc.paymentStatus || 'Pending',
        couponCode: doc.couponCode || null,
        discountAmount: Number(doc.discountAmount) || 0,
        coupon: doc.coupon ? cleanObjectIds(doc.coupon) : null,
        returnStatus: doc.returnStatus || null,
        returnReason: doc.returnReason || null,
        razorpayOrderId: doc.razorpayOrderId || null,
        razorpayPaymentId: doc.razorpayPaymentId || null,
        isInventoryDeducted: Boolean(doc.isInventoryDeducted),
        isInventoryRestocked: Boolean(doc.isInventoryRestocked),
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },

  Product: (doc) => {
    const docId = (doc.id || toStringId(doc._id)).trim().toLowerCase();
    return {
      collection: 'products',
      docId,
      data: {
        _id: toStringId(doc._id),
        id: docId,
        name: doc.name || '',
        hindiName: doc.hindiName || '',
        category: (doc.category || '').trim().toLowerCase(),
        categoryLabel: doc.categoryLabel || '',
        description: doc.description || '',
        pieces: doc.pieces || '',
        serves: doc.serves || '',
        badge: doc.badge || '',
        isBestseller: Boolean(doc.isBestseller),
        isRecommended: Boolean(doc.isRecommended),
        image: doc.image || '',
        images: Array.isArray(doc.images) ? doc.images : [],
        videoURLs: Array.isArray(doc.videoURLs) ? doc.videoURLs : [],
        netWeight: doc.netWeight || '',
        grossWeight: doc.grossWeight || '',
        price: Number(doc.price) || 0,
        originalPrice: Number(doc.originalPrice) || Number(doc.price) || 0,
        rating: Number(doc.rating) || 4.8,
        ratingCount: Number(doc.ratingCount) || 100,
        baseRating: Number(doc.baseRating) || Number(doc.rating) || 4.8,
        baseRatingCount: Number(doc.baseRatingCount) || Number(doc.ratingCount) || 100,
        inStock: doc.inStock !== false,
        cutType: doc.cutType || '',
        cookingTime: doc.cookingTime || '',
        benefits: Array.isArray(doc.benefits) ? doc.benefits : [],
        seoTitle: doc.seoTitle || '',
        seoDescription: doc.seoDescription || '',
        seoKeywords: Array.isArray(doc.seoKeywords) ? doc.seoKeywords : [],
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },

  Remittance: (doc) => {
    const remittanceId = (doc.remittanceId || toStringId(doc._id)).trim();
    const docId = remittanceId;
    return {
      collection: 'remittances',
      docId,
      data: {
        _id: toStringId(doc._id),
        id: docId,
        remittanceId,
        riderId: toStringId(doc.riderId),
        riderName: doc.riderName || '',
        riderPhone: doc.riderPhone || '',
        storeId: (doc.storeId || 'S001').trim().toUpperCase(),
        storeName: doc.storeName || '',
        amount: Number(doc.amount) || 0,
        status: doc.status || 'Pending',
        notes: doc.notes || '',
        confirmedBy: doc.confirmedBy ? toStringId(doc.confirmedBy) : null,
        confirmedByName: doc.confirmedByName || null,
        confirmedAt: doc.confirmedAt ? toIsoDate(doc.confirmedAt) : null,
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },

  ReturnRequest: (doc) => {
    const requestId = (doc.requestId || toStringId(doc._id)).trim();
    const docId = requestId;
    return {
      collection: 'return_requests',
      docId,
      data: {
        _id: toStringId(doc._id),
        id: docId,
        requestId,
        orderId: (doc.orderId || '').trim(),
        customer: doc.customer || '',
        phone: doc.phone || '',
        items: doc.items || '',
        reason: doc.reason || '',
        condition: doc.condition || '',
        status: doc.status || 'Reported',
        storeId: (doc.storeId || 'S001').trim().toUpperCase(),
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },

  Review: (doc) => {
    const prodId = toStringId(doc.productId);
    const uId = toStringId(doc.userId);
    const docId = prodId && uId ? getReviewDocId(prodId, uId) : toStringId(doc._id);
    return {
      collection: 'reviews',
      docId,
      data: {
        _id: toStringId(doc._id),
        id: docId,
        productId: prodId,
        userId: uId,
        rating: Number(doc.rating) || 5,
        title: doc.title || '',
        comment: doc.comment || '',
        isVerifiedPurchase: Boolean(doc.isVerifiedPurchase),
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },

  SiteSettings: (doc) => {
    const docId = 'authoritative';
    return {
      collection: 'site_settings',
      docId,
      data: {
        _id: toStringId(doc._id),
        id: docId,
        metaTitle: doc.metaTitle || '',
        metaDescription: doc.metaDescription || '',
        metaKeywords: Array.isArray(doc.metaKeywords) ? doc.metaKeywords : [],
        websiteName: doc.websiteName || 'TeFFe',
        canonicalUrl: doc.canonicalUrl || 'https://teffes.com',
        businessDescription: doc.businessDescription || '',
        logoUrl: doc.logoUrl || '/teffes-logo-white.png',
        socialLinks: cleanObjectIds(doc.socialLinks) || {},
        contactDetails: cleanObjectIds(doc.contactDetails) || {},
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },

  SosAlert: (doc) => {
    const alertId = toStringId(doc._id);
    return {
      collection: 'sos_alerts',
      docId: alertId,
      data: {
        _id: alertId,
        id: alertId,
        alertId,
        riderId: toStringId(doc.riderId),
        riderName: doc.riderName || '',
        riderPhone: doc.riderPhone || '',
        storeId: (doc.storeId || 'S001').trim().toUpperCase(),
        lat: Number(doc.lat) || 0,
        lng: Number(doc.lng) || 0,
        activeOrderId: doc.activeOrderId ? toStringId(doc.activeOrderId) : null,
        reason: doc.reason || 'SOS Triggered',
        status: doc.status || 'Active',
        acknowledgedBy: doc.acknowledgedBy ? toStringId(doc.acknowledgedBy) : null,
        resolvedAt: doc.resolvedAt ? toIsoDate(doc.resolvedAt) : null,
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },

  Store: (doc) => {
    const storeId = (doc.storeId || toStringId(doc._id)).trim().toUpperCase();
    const docId = storeId;
    return {
      collection: 'stores',
      docId,
      data: {
        _id: toStringId(doc._id),
        id: docId,
        storeId,
        name: doc.name || '',
        city: doc.city || 'Ranchi',
        address: doc.address || '',
        image: doc.image || '',
        admin: doc.admin || '',
        adminEmail: doc.adminEmail || '',
        phone: doc.phone || '',
        status: doc.status || 'Active',
        orders: Number(doc.orders) || 0,
        pickupEnabled: doc.pickupEnabled !== false,
        deliveryEnabled: doc.deliveryEnabled !== false,
        timings: doc.timings || '08:00 AM - 08:00 PM',
        isOpen: doc.isOpen !== false,
        emergencyNotice: doc.emergencyNotice || '',
        riderPayoutSettings: cleanObjectIds(doc.riderPayoutSettings) || {},
        freeDeliveryThreshold: Number(doc.freeDeliveryThreshold) || 299,
        standardDeliveryFee: Number(doc.standardDeliveryFee) || 30,
        expressDeliveryFee: Number(doc.expressDeliveryFee) || 49,
        expressDeliveryEnabled: Boolean(doc.expressDeliveryEnabled),
        rainSurgeEnabled: Boolean(doc.rainSurgeEnabled),
        rainSurgeFee: Number(doc.rainSurgeFee) || 0,
        freeGiftThreshold: Number(doc.freeGiftThreshold) || 499,
        freeGiftName: doc.freeGiftName || '',
        deliveryRadiusKm: Number(doc.deliveryRadiusKm) || 10,
        defaultRiderDailyTarget: Number(doc.defaultRiderDailyTarget) || 20,
        location: cleanObjectIds(doc.location) || { type: 'Point', coordinates: [85.3096, 23.3441] },
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },

  StoreTransfer: (doc) => {
    const docId = toStringId(doc._id);
    return {
      collection: 'store_transfers',
      docId,
      data: {
        _id: docId,
        id: docId,
        transferId: docId,
        fromStoreId: (doc.fromStoreId || '').trim().toUpperCase(),
        toStoreId: (doc.toStoreId || '').trim().toUpperCase(),
        items: Array.isArray(doc.items)
          ? doc.items.map((it) => ({
              ...cleanObjectIds(it),
              itemId: toStringId(it.itemId),
              quantity: Number(it.quantity) || 0,
            }))
          : [],
        status: doc.status || 'Pending',
        requestedBy: toStringId(doc.requestedBy),
        approvedBy: doc.approvedBy ? toStringId(doc.approvedBy) : null,
        notes: doc.notes || '',
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },

  User: (doc) => {
    const docId = toStringId(doc._id);
    return {
      collection: 'users',
      docId,
      data: {
        _id: docId,
        id: docId,
        name: doc.name || 'Valued Customer',
        email: doc.email || '',
        phone: doc.phone ? doc.phone.replace(/\D/g, '').slice(-10) : '',
        firebaseUid: doc.firebaseUid || null,
        password: doc.password || null, // bcrypt hash preserved for admin authentication
        role: doc.role || 'customer',
        isActive: doc.isActive !== false,
        isVerified: Boolean(doc.isVerified),
        storeId: doc.storeId ? doc.storeId.trim().toUpperCase() : null,
        storeName: doc.storeName || null,
        vehicleNumber: doc.vehicleNumber || null,
        vehicleType: doc.vehicleType || null,
        riderRating: Number(doc.riderRating) || 5.0,
        riderRatingCount: Number(doc.riderRatingCount) || 0,
        foodSafetyCertified: Boolean(doc.foodSafetyCertified),
        fssaiCertNumber: doc.fssaiCertNumber || null,
        dailyTarget: Number(doc.dailyTarget) || 20,
        cashInHand: Number(doc.cashInHand) || 0,
        riderStatus: doc.riderStatus || 'Available',
        addresses: Array.isArray(doc.addresses) ? doc.addresses.map(cleanObjectIds) : [],
        cart: Array.isArray(doc.cart) ? doc.cart.map(cleanObjectIds) : [],
        wishlist: Array.isArray(doc.wishlist) ? doc.wishlist.map(toStringId) : [],
        avatar: doc.avatar || null,
        walletBalance: Number(doc.walletBalance) || 0,
        totalSpent: Number(doc.totalSpent) || 0,
        loyaltyTier: doc.loyaltyTier || 'Bronze',
        lastLoginAt: doc.lastLoginAt ? toIsoDate(doc.lastLoginAt) : null,
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },

  WalletTransaction: (doc) => {
    const docId = toStringId(doc._id);
    return {
      collection: 'wallet_transactions',
      docId,
      data: {
        _id: docId,
        id: docId,
        userId: toStringId(doc.userId),
        type: doc.type || 'Credit',
        amount: Number(doc.amount) || 0,
        description: doc.description || '',
        orderId: doc.orderId ? toStringId(doc.orderId) : null,
        status: doc.status || 'Success',
        createdAt: toIsoDate(doc.createdAt),
        updatedAt: toIsoDate(doc.updatedAt),
      },
    };
  },
};

module.exports = {
  mappers,
  toStringId,
  toIsoDate,
  cleanObjectIds,
};
