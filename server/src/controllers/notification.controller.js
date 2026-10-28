/**
 * Notification Controller (Pure Cloud Firestore Backend)
 * 100% Zero MongoDB dependency - Fully migrated to Google Cloud Firestore
 */

const crypto = require('crypto');
const { getDoc, createDoc, updateDoc } = require('../lib/firestore');
const notificationService = require('../services/notificationService');

const NOTIFICATION_TOKENS_COLLECTION = 'notification_tokens';

const getTokenDocId = (fcmToken) => {
  return crypto.createHash('sha256').update(fcmToken.trim()).digest('hex').slice(0, 32);
};

/**
 * POST /api/notifications/register-token
 * Register or update an FCM device token in Firestore
 */
const registerToken = async (req, res, next) => {
  try {
    const { fcmToken, deviceType = 'android', appType = 'customer', deviceInfo = {} } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'fcmToken is required' });
    }

    const userId = req.user ? String(req.user._id || req.user.id) : null;
    const docId = getTokenDocId(fcmToken);
    const now = new Date().toISOString();

    const tokenData = {
      id: docId,
      fcmToken: fcmToken.trim(),
      userId,
      deviceType: ['android', 'ios', 'web'].includes(deviceType) ? deviceType : 'android',
      appType: ['customer', 'rider', 'website'].includes(appType) ? appType : 'customer',
      deviceInfo,
      isActive: true,
      lastSeenAt: now,
      updatedAt: now,
    };

    const existing = await getDoc(NOTIFICATION_TOKENS_COLLECTION, docId);
    if (existing) {
      await updateDoc(NOTIFICATION_TOKENS_COLLECTION, docId, tokenData);
    } else {
      tokenData.createdAt = now;
      await createDoc(NOTIFICATION_TOKENS_COLLECTION, docId, tokenData);
    }

    res.status(200).json({
      success: true,
      message: 'FCM token registered successfully in Firestore',
      tokenId: docId,
      appType: tokenData.appType,
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

    const docId = getTokenDocId(fcmToken);
    await updateDoc(NOTIFICATION_TOKENS_COLLECTION, docId, {
      isActive: false,
      lastSeenAt: new Date().toISOString(),
    }).catch(() => {});

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
      result = await notificationService.sendToUser(req.user._id || req.user.id, {
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
