/**
 * Promotional Pop-ups & Announcements Controller
 * Cloud Firestore only.
 */

const {
  getAllPopups: fetchAllPopups,
  getActivePopups: fetchActivePopups,
  getPopupById: fetchPopupById,
  createPopup: createPopupFirestore,
  updatePopup: updatePopupFirestore,
  deletePopup: deletePopupFirestore,
} = require('../services/firestore/popup.firestore.service');

/**
 * Public: Get active promotional popups for visitors & customers
 */
const getActivePopups = async (req, res, next) => {
  try {
    const userTier = req.query.tier || (req.user ? req.user.tier : 'BRONZE');
    const isLoggedIn = Boolean(req.user || req.query.isLoggedIn === 'true');

    const popups = await fetchActivePopups({ userTier, isLoggedIn });

    res.status(200).json({
      success: true,
      count: popups.length,
      popups,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Get all popups (active, inactive, scheduled)
 */
const getAllPopups = async (req, res, next) => {
  try {
    const popups = await fetchAllPopups();
    res.status(200).json({
      success: true,
      count: popups.length,
      popups,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Get single popup by ID
 */
const getPopupById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const popup = await fetchPopupById(id);
    if (!popup) {
      return res.status(404).json({
        success: false,
        message: 'Promotional pop-up not found',
      });
    }

    res.status(200).json({
      success: true,
      popup,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Create a new promotional pop-up
 */
const createPopup = async (req, res, next) => {
  try {
    const { title, subtitle, message, imageUrl, ctaText, ctaLink, couponCode, targetAudience, startDate, endDate, frequency, priority, isActive } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Pop-up title is required',
      });
    }

    const popup = await createPopupFirestore({
      title,
      subtitle,
      message,
      imageUrl,
      ctaText,
      ctaLink,
      couponCode,
      targetAudience,
      startDate,
      endDate,
      frequency,
      priority,
      isActive,
    });

    res.status(201).json({
      success: true,
      message: 'Promotional pop-up created successfully',
      popup,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Update an existing promotional pop-up
 */
const updatePopup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const popup = await updatePopupFirestore(id, req.body);

    res.status(200).json({
      success: true,
      message: 'Promotional pop-up updated successfully',
      popup,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Delete a promotional pop-up
 */
const deletePopup = async (req, res, next) => {
  try {
    const { id } = req.params;
    await deletePopupFirestore(id);

    res.status(200).json({
      success: true,
      message: 'Promotional pop-up deleted successfully',
      id,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActivePopups,
  getAllPopups,
  getPopupById,
  createPopup,
  updatePopup,
  deletePopup,
};
