/**
 * Hero Banners Controller (Firestore-backed)
 * Zero dependency on MongoDB. Full Super Admin CRUD + Active Banners public API.
 */

const {
  getActiveBanners: fetchActiveBanners,
  getAllBanners: fetchAllBanners,
  getBannerById,
  createBanner: createBannerFirestore,
  updateBanner: updateBannerFirestore,
  deleteBanner: deleteBannerFirestore,
} = require('../services/firestore/banner.firestore.service');

/**
 * Public: Get all active banners for website & customer app
 */
const getActiveBanners = async (req, res, next) => {
  try {
    const banners = await fetchActiveBanners();
    res.status(200).json({
      success: true,
      count: banners.length,
      banners,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Get all banners (active + inactive)
 */
const getAllBanners = async (req, res, next) => {
  try {
    const banners = await fetchAllBanners();
    res.status(200).json({
      success: true,
      count: banners.length,
      banners,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Create a new hero banner
 */
const createBanner = async (req, res, next) => {
  try {
    const { title, image, link, order, isActive } = req.body;

    if (!image || typeof image !== 'string' || image.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Banner image URL is required',
      });
    }

    const banner = await createBannerFirestore({
      title: title || '',
      image: image.trim(),
      link: link || '',
      order: typeof order === 'number' ? order : 0,
      isActive: typeof isActive === 'boolean' ? isActive : true,
    });

    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      banner,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Update banner
 */
const updateBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, image, link, order, isActive } = req.body;

    const existing = await getBannerById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    const updates = {};
    if (typeof title !== 'undefined') updates.title = title;
    if (typeof image !== 'undefined') updates.image = image.trim();
    if (typeof link !== 'undefined') updates.link = link;
    if (typeof order !== 'undefined') updates.order = typeof order === 'number' ? order : Number(order) || 0;
    if (typeof isActive !== 'undefined') updates.isActive = isActive;

    const banner = await updateBannerFirestore(id, updates);

    res.status(200).json({
      success: true,
      message: 'Banner updated successfully',
      banner,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Delete banner
 */
const deleteBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await getBannerById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    await deleteBannerFirestore(id);
    res.status(200).json({
      success: true,
      message: 'Banner deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActiveBanners,
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
};
