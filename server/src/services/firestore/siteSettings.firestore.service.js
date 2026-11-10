const {
  getDoc,
  createDoc,
  updateDoc,
} = require('../../lib/firestore');

const COLLECTION = 'site_settings';
const DOCUMENT_ID = 'authoritative';

const DEFAULT_SETTINGS = {
  metaTitle: 'Teffes — Fresh Meat, Chicken, Fish & Mutton in Ranchi',
  metaDescription:
    'Order 100% fresh, hygienic, antibiotic-free Chicken, Tender Mutton, River Fish & Marinated Cuts in Ranchi. Cut fresh after your order with 0% cold storage. Delivered in 90 mins.',
  metaKeywords: [
    'fresh meat in Ranchi',
    'fresh chicken delivery Ranchi',
    'fresh fish Ranchi',
    'mutton delivery Ranchi',
    'teffes',
    'Kishore Ganj meat shop',
  ],
  websiteName: 'TeFFe',
  canonicalUrl: 'https://teffes.com',
  businessDescription:
    "Teffes is Ranchi's trusted fresh meat delivery platform offering farm-fresh chicken, tender goat mutton, fresh river fish, and ready-to-cook marinated items cut fresh after ordering.",
  logoUrl: '/teffes-logo-white.png',
  socialLinks: {
    facebook: '',
    instagram: '',
    youtube: '',
    twitter: '',
    linkedin: '',
  },
  contactDetails: {
    phone: '+91 92796 82955',
    email: 'rakeshroshanteffes@gmail.com',
    address: {
      street: 'Harmu Road, Kishore Ganj',
      city: 'Ranchi',
      state: 'Jharkhand',
      postalCode: '834001',
      country: 'India',
    },
  },
  paymentSettings: {
    codEnabled: true,
    onlineEnabled: true,
    walletEnabled: true,
    payuMerchantKey: '',
    payuMerchantSalt: '',
  },
};

/**
 * Get the authoritative site settings singleton.
 * Returns default values if the document does not yet exist in Firestore,
 * preserving visual and SEO defaults without forcing an immediate write.
 */
const getAuthoritativeSettings = async () => {
  const settings = await getDoc(COLLECTION, DOCUMENT_ID);
  if (!settings) {
    return {
      id: DOCUMENT_ID,
      _id: DOCUMENT_ID,
      ...DEFAULT_SETTINGS,
    };
  }
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    paymentSettings: {
      ...DEFAULT_SETTINGS.paymentSettings,
      ...(settings.paymentSettings || {}),
    },
  };
};

/**
 * Safely update the singleton settings document with deep merging.
 */
const updateSettings = async (updates = {}) => {
  const current = await getAuthoritativeSettings();

  const payload = {
    metaTitle: updates.metaTitle !== undefined ? String(updates.metaTitle).trim() : current.metaTitle,
    metaDescription: updates.metaDescription !== undefined ? String(updates.metaDescription).trim() : current.metaDescription,
    metaKeywords: Array.isArray(updates.metaKeywords) ? updates.metaKeywords : current.metaKeywords,
    websiteName: updates.websiteName !== undefined ? String(updates.websiteName).trim() : current.websiteName,
    canonicalUrl: updates.canonicalUrl !== undefined ? String(updates.canonicalUrl).trim() : current.canonicalUrl,
    businessDescription:
      updates.businessDescription !== undefined ? String(updates.businessDescription).trim() : current.businessDescription,
    logoUrl: updates.logoUrl !== undefined ? String(updates.logoUrl).trim() : current.logoUrl,
    socialLinks: {
      ...current.socialLinks,
      ...(updates.socialLinks || {}),
    },
    contactDetails: {
      ...current.contactDetails,
      ...(updates.contactDetails || {}),
      address: {
        ...(current.contactDetails ? current.contactDetails.address : {}),
        ...((updates.contactDetails && updates.contactDetails.address) || {}),
      },
    },
    paymentSettings: {
      codEnabled: updates.paymentSettings?.codEnabled !== undefined
        ? Boolean(updates.paymentSettings.codEnabled)
        : (current.paymentSettings?.codEnabled !== false),
      onlineEnabled: updates.paymentSettings?.onlineEnabled !== undefined
        ? Boolean(updates.paymentSettings.onlineEnabled)
        : (current.paymentSettings?.onlineEnabled !== false),
      walletEnabled: updates.paymentSettings?.walletEnabled !== undefined
        ? Boolean(updates.paymentSettings.walletEnabled)
        : (current.paymentSettings?.walletEnabled !== false),
      payuMerchantKey: updates.paymentSettings?.payuMerchantKey !== undefined
        ? String(updates.paymentSettings.payuMerchantKey).trim()
        : (current.paymentSettings?.payuMerchantKey || ''),
      payuMerchantSalt: updates.paymentSettings?.payuMerchantSalt !== undefined
        ? String(updates.paymentSettings.payuMerchantSalt).trim()
        : (current.paymentSettings?.payuMerchantSalt || ''),
    },
  };

  const existing = await getDoc(COLLECTION, DOCUMENT_ID);
  if (!existing) {
    return createDoc(COLLECTION, DOCUMENT_ID, payload, { overwrite: true });
  }

  return updateDoc(COLLECTION, DOCUMENT_ID, payload);
};

const getPaymentSettings = async () => {
  const settings = await getAuthoritativeSettings();
  const ps = settings.paymentSettings || {};
  return {
    codEnabled: ps.codEnabled !== false,
    onlineEnabled: ps.onlineEnabled !== false,
    walletEnabled: ps.walletEnabled !== false,
    payuMerchantKey: ps.payuMerchantKey || '',
    payuMerchantSalt: ps.payuMerchantSalt || '',
  };
};

module.exports = {
  COLLECTION,
  DOCUMENT_ID,
  DEFAULT_SETTINGS,
  getAuthoritativeSettings,
  updateSettings,
  getPaymentSettings,
};
