const NotificationToken = require('../models/NotificationToken');
const notificationService = require('../services/notificationService');

/**
 * POST /api/notifications/register-token
 * Register or update an FCM device token
 */
const registerToken = async (req, res, next) => {
  try {
    const { fcmToken, deviceType = 'android', appType = 'customer', deviceInfo = {} } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'fcmToken is required' });
    }

    const userId = req.user ? req.user._id : null;

    // Upsert token in database
    const tokenDoc = await NotificationToken.findOneAndUpdate(
      { fcmToken },
      {
        $set: {
          userId,
          deviceType: ['android', 'ios', 'web'].includes(deviceType) ? deviceType : 'android',
          appType: ['customer', 'rider', 'website'].includes(appType) ? appType : 'customer',
          deviceInfo,
          isActive: true,
          lastSeenAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'FCM token registered successfully',
      tokenId: tokenDoc._id,
      appType: tokenDoc.appType,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/notifications/unregister-token
 * Deactivate a single device token on logout
 */
const unregisterToken = async (req, res, next) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'fcmToken is required' });
    }

    await NotificationToken.findOneAndUpdate(
      { fcmToken },
      { $set: { isActive: false, lastSeenAt: new Date() } }
    );

    res.status(200).json({
      success: true,
      message: 'FCM token unregistered successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/notifications/test
 * Send a test push notification to a device token or current user
 */
const sendTestNotification = async (req, res, next) => {
  try {
    const { fcmToken, title = "Teffe's Test Push", body = 'This is a test notification from Teffe server', data = {} } = req.body;

    let result;
    if (fcmToken) {
      result = await notificationService.sendToToken(fcmToken, {
        title,
        body,
        data: {
          notificationType: 'TEST_ALERT',
          ...data,
        },
      });
    } else if (req.user) {
      result = await notificationService.sendToUser(req.user._id, {
        title,
        body,
        data: {
          notificationType: 'TEST_ALERT',
          ...data,
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either fcmToken or an authenticated user session is required to test.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Test notification dispatched',
      result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerToken,
  unregisterToken,
  sendTestNotification,
};
