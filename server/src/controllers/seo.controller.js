const SiteSettings = require('../models/SiteSettings');

/**
 * GET /api/settings/seo (or /api/seo)
 * Public endpoint to fetch website SEO and structured data settings
 */
const getPublicSeoSettings = async (req, res, next) => {
  try {
    const settings = await SiteSettings.getAuthoritativeSettings();

    // Cache publicly with short revalidation to avoid hammering DB while keeping edits fresh
    res.set('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300');

    res.status(200).json({
      success: true,
      settings: {
        metaTitle: settings.metaTitle,
        metaDescription: settings.metaDescription,
        metaKeywords: settings.metaKeywords || [],
        websiteName: settings.websiteName,
        canonicalUrl: settings.canonicalUrl,
        businessDescription: settings.businessDescription,
        logoUrl: settings.logoUrl,
        socialLinks: settings.socialLinks || {},
        contactDetails: settings.contactDetails || {},
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/super-admin/seo
 * Super Admin endpoint to get authoritative settings for editing
 */
const getSuperAdminSeoSettings = async (req, res, next) => {
  try {
    const settings = await SiteSettings.getAuthoritativeSettings();
    res.status(200).json({
      success: true,
      settings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/super-admin/seo
 * Super Admin endpoint to update homepage SEO and business info
 */
const updateSuperAdminSeoSettings = async (req, res, next) => {
  try {
    const {
      metaTitle,
      metaDescription,
      metaKeywords,
      websiteName,
      canonicalUrl,
      businessDescription,
      logoUrl,
      socialLinks,
      contactDetails,
    } = req.body;

    // Validate required fields
    if (!metaTitle || typeof metaTitle !== 'string' || !metaTitle.trim()) {
      return res.status(400).json({ success: false, message: 'Meta Title is required.' });
    }
    if (!metaDescription || typeof metaDescription !== 'string' || !metaDescription.trim()) {
      return res.status(400).json({ success: false, message: 'Meta Description is required.' });
    }
    if (!websiteName || typeof websiteName !== 'string' || !websiteName.trim()) {
      return res.status(400).json({ success: false, message: 'Website Name is required.' });
    }

    // Sanitize Keywords
    let cleanedKeywords = [];
    if (typeof metaKeywords === 'string') {
      cleanedKeywords = metaKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
    } else if (Array.isArray(metaKeywords)) {
      cleanedKeywords = metaKeywords.map((k) => String(k).trim()).filter(Boolean);
    }

    // Sanitize Canonical URL
    let cleanCanonical = canonicalUrl && typeof canonicalUrl === 'string' ? canonicalUrl.trim() : 'https://teffes.com';
    if (cleanCanonical.endsWith('/')) {
      cleanCanonical = cleanCanonical.slice(0, -1);
    }

    // Sanitize Social Links
    const cleanSocial = {
      facebook: socialLinks?.facebook ? String(socialLinks.facebook).trim() : '',
      instagram: socialLinks?.instagram ? String(socialLinks.instagram).trim() : '',
      youtube: socialLinks?.youtube ? String(socialLinks.youtube).trim() : '',
      twitter: socialLinks?.twitter ? String(socialLinks.twitter).trim() : '',
      linkedin: socialLinks?.linkedin ? String(socialLinks.linkedin).trim() : '',
    };

    // Sanitize Contact Details
    const cleanContact = {
      phone: contactDetails?.phone ? String(contactDetails.phone).trim() : '',
      email: contactDetails?.email ? String(contactDetails.email).trim() : '',
      address: {
        street: contactDetails?.address?.street ? String(contactDetails.address.street).trim() : '',
        city: contactDetails?.address?.city ? String(contactDetails.address.city).trim() : 'Ranchi',
        state: contactDetails?.address?.state ? String(contactDetails.address.state).trim() : 'Jharkhand',
        postalCode: contactDetails?.address?.postalCode ? String(contactDetails.address.postalCode).trim() : '834001',
        country: contactDetails?.address?.country ? String(contactDetails.address.country).trim() : 'India',
      },
    };

    const updatePayload = {
      metaTitle: metaTitle.trim(),
      metaDescription: metaDescription.trim(),
      metaKeywords: cleanedKeywords,
      websiteName: websiteName.trim(),
      canonicalUrl: cleanCanonical,
      businessDescription: businessDescription ? String(businessDescription).trim() : '',
      logoUrl: logoUrl ? String(logoUrl).trim() : '/teffes-logo-white.png',
      socialLinks: cleanSocial,
      contactDetails: cleanContact,
    };

    // Single authoritative document update
    const updated = await SiteSettings.findOneAndUpdate({}, updatePayload, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: 'Homepage SEO settings saved successfully.',
      settings: updated,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicSeoSettings,
  getSuperAdminSeoSettings,
  updateSuperAdminSeoSettings,
};
