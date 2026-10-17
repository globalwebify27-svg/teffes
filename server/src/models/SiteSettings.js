const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema(
  {
    metaTitle: {
      type: String,
      trim: true,
      default: 'Teffes — Fresh Meat, Chicken, Fish & Mutton in Ranchi',
    },
    metaDescription: {
      type: String,
      trim: true,
      default:
        'Order 100% fresh, hygienic, antibiotic-free Chicken, Tender Mutton, River Fish & Marinated Cuts in Ranchi. Cut fresh after your order with 0% cold storage. Delivered in 90 mins.',
    },
    metaKeywords: {
      type: [String],
      default: [
        'fresh meat in Ranchi',
        'fresh chicken delivery Ranchi',
        'fresh fish Ranchi',
        'mutton delivery Ranchi',
        'teffes',
        'Kishore Ganj meat shop',
      ],
    },
    websiteName: {
      type: String,
      trim: true,
      default: 'TeFFe',
    },
    canonicalUrl: {
      type: String,
      trim: true,
      default: 'https://teffes.com',
    },
    businessDescription: {
      type: String,
      trim: true,
      default:
        "Teffes is Ranchi's trusted fresh meat delivery platform offering farm-fresh chicken, tender goat mutton, fresh river fish, and ready-to-cook marinated items cut fresh after ordering.",
    },
    logoUrl: {
      type: String,
      trim: true,
      default: '/teffes-logo-white.png',
    },
    socialLinks: {
      facebook: { type: String, trim: true, default: '' },
      instagram: { type: String, trim: true, default: '' },
      youtube: { type: String, trim: true, default: '' },
      twitter: { type: String, trim: true, default: '' },
      linkedin: { type: String, trim: true, default: '' },
    },
    contactDetails: {
      phone: { type: String, trim: true, default: '+91 91539 85949' },
      email: { type: String, trim: true, default: 'care@teffes.com' },
      address: {
        street: { type: String, trim: true, default: 'Harmu Road, Kishore Ganj' },
        city: { type: String, trim: true, default: 'Ranchi' },
        state: { type: String, trim: true, default: 'Jharkhand' },
        postalCode: { type: String, trim: true, default: '834001' },
        country: { type: String, trim: true, default: 'India' },
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Ensure single authoritative document helper
siteSettingsSchema.statics.getAuthoritativeSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema);
module.exports = SiteSettings;
