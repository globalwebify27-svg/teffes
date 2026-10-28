/**
 * SEO & Site Settings Controller (Firestore-backed)
 * Zero dependency on MongoDB. Public SEO metadata + Super Admin Settings CRUD.
 */

const {
  getAuthoritativeSettings,
  updateSettings: updateFirestoreSettings,
} = require('../services/firestore/siteSettings.firestore.service');

/**
 * GET /api/settings/seo (or /api/seo)
 * Public endpoint to fetch website SEO and structured data settings
 */
const getPublicSeoSettings = async (req, res, next) => {
  try {
    const settings = await getAuthoritativeSettings();

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
    const settings = await getAuthoritativeSettings();
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

    const updates = {};
    if (typeof metaTitle !== 'undefined') updates.metaTitle = metaTitle.trim();
    if (typeof metaDescription !== 'undefined') updates.metaDescription = metaDescription.trim();
    if (Array.isArray(metaKeywords)) updates.metaKeywords = metaKeywords;
    if (typeof websiteName !== 'undefined') updates.websiteName = websiteName.trim();
    if (typeof canonicalUrl !== 'undefined') updates.canonicalUrl = canonicalUrl.trim();
    if (typeof businessDescription !== 'undefined') updates.businessDescription = businessDescription.trim();
    if (typeof logoUrl !== 'undefined') updates.logoUrl = logoUrl.trim();
    if (socialLinks && typeof socialLinks === 'object') updates.socialLinks = socialLinks;
    if (contactDetails && typeof contactDetails === 'object') updates.contactDetails = contactDetails;

    const settings = await updateFirestoreSettings(updates);

    res.status(200).json({
      success: true,
      message: 'SEO and business settings updated successfully',
      settings,
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
