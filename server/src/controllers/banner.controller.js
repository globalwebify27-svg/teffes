const Banner = require('../models/Banner');

const DEFAULT_BANNERS = [
  {
    title: 'Fresh • Hygienic • Farm-Raised Chicken',
    image: 'https://cdn.dotpe.in/longtail/themes/7524323/pLA8ptbh.webp',
    link: '/#chicken-section',
    order: 1,
    isActive: true,
  },
  {
    title: "TeFFe's Farm Quality Meat • 90 Min Delivery",
    image: 'https://cdn.dotpe.in/longtail/themes/7524323/VRLhTQ4p.webp',
    link: '/#all-products',
    order: 2,
    isActive: true,
  },
];

/**
 * Public: Get all active banners for website & customer app
 * Auto-seeds the two initial banners if no banners exist in database
 */
const getActiveBanners = async (req, res, next) => {
  try {
    let banners = await Banner.find({ isActive: true }).sort({ order: 1, createdAt: -1 });

    if (!banners || banners.length === 0) {
      const totalCount = await Banner.countDocuments();
      if (totalCount === 0) {
        banners = await Banner.insertMany(DEFAULT_BANNERS);
      }
    }

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
    let banners = await Banner.find().sort({ order: 1, createdAt: -1 });

    if (!banners || banners.length === 0) {
      banners = await Banner.insertMany(DEFAULT_BANNERS);
    }

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

    const banner = await Banner.create({
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
    const banner = await Banner.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found',
      });
    }

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
    const banner = await Banner.findByIdAndDelete(id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Banner removed successfully',
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
