/**
 * Apply Verified Production Site Settings to Cloud Firestore
 * Document Path: site_settings/authoritative
 */

const { updateSettings, getAuthoritativeSettings } = require('../../services/firestore/siteSettings.firestore.service');

const APPROVED_PAYLOAD = {
  websiteName: 'TeFFe',
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
  canonicalUrl: 'https://teffes.com',
  businessDescription:
    "Teffes is Ranchi's trusted fresh meat delivery platform offering farm-fresh chicken, tender goat mutton, fresh river fish, and ready-to-cook marinated items cut fresh after ordering.",
  logoUrl: '/teffes-logo-white.png',
  socialLinks: {
    facebook: 'https://facebook.com/teffes.official',
    instagram: 'https://instagram.com/teffes.official',
    youtube: 'https://youtube.com/@teffes',
    twitter: '',
    linkedin: '',
  },
  contactDetails: {
    phone: '+91 92796 82955',
    email: 'rakeshroshanteffes@gmail.com',
    address: {
      street: 'Harmu Housing Colony, Kishore Ganj',
      city: 'Ranchi',
      state: 'Jharkhand',
      postalCode: '834002',
      country: 'India',
    },
  },
};

const main = async () => {
  console.log('Writing approved settings payload to site_settings/authoritative...');
  await updateSettings(APPROVED_PAYLOAD);
  const updated = await getAuthoritativeSettings();
  console.log('Successfully written and verified site_settings/authoritative:');
  console.log(JSON.stringify(updated, null, 2));
  process.exit(0);
};

main().catch((err) => {
  console.error('Failed to apply site settings:', err);
  process.exit(1);
});
