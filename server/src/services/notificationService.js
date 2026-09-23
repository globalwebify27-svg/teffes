const { getMessagingInstance, isFirebaseReady } = require('../config/firebase');
const NotificationToken = require('../models/NotificationToken');

/**
 * Clean up invalid or expired tokens returned by Firebase
 */
const handleInvalidTokens = async (tokens, responses) => {
  const invalidTokens = [];

  responses.forEach((resp, idx) => {
    if (!resp.success && resp.error) {
      const code = resp.error.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/invalid-argument'
      ) {
        invalidTokens.push(tokens[idx]);
      }
    }
  });

  if (invalidTokens.length > 0) {
    try {
      await NotificationToken.updateMany(
        { fcmToken: { $in: invalidTokens } },
        { $set: { isActive: false, lastSeenAt: new Date() } }
      );
      console.log(`[FCM] Deactivated ${invalidTokens.length} expired/unregistered FCM token(s).`);
    } catch (err) {
      console.warn('[FCM] Error deactivating stale tokens:', err.message);
    }
  }
};

/**
 * Format string-only data dictionary required by FCM data payloads
 */
const formatDataPayload = (data = {}) => {
  const formatted = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      formatted[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
  }
  return formatted;
};

/**
 * Core dispatch method using Firebase Admin sendEachForMulticast
 */
const sendToTokens = async (tokens, { title, body, data = {}, channelId = 'teffes_customer_channel' }) => {
  if (!tokens || tokens.length === 0) return { success: true, count: 0 };

  // Check if Firebase is initialized
  if (!isFirebaseReady()) {
    console.log(`[FCM Mock Log] Push notification to ${tokens.length} token(s): "${title}" - "${body}"`);
    return { success: false, reason: 'Firebase not initialized' };
  }

  const messaging = getMessagingInstance();
  const stringData = formatDataPayload(data);

  const message = {
    tokens,
    notification: {
      title,
      body,
    },
    data: stringData,
    android: {
      priority: 'high',
      notification: {
        channelId,
        sound: 'default',
        priority: 'high',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
    webpush: {
      notification: {
        title,
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
      },
      fcmOptions: {
        link: data.clickAction || data.url || '/',
      },
    },
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    console.log(`[FCM] Dispatched to ${tokens.length} tokens. Success: ${response.successCount}, Fail: ${response.failureCount}`);

    if (response.failureCount > 0) {
      await handleInvalidTokens(tokens, response.responses);
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error('[FCM] Error sending multicast message:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification to all active devices of a user
 */
const sendToUser = async (userId, { title, body, data = {} }, appType = null) => {
  try {
    if (!userId) return;

    const query = { userId, isActive: true };
    if (appType) query.appType = appType;

    const records = await NotificationToken.find(query).select('fcmToken').lean();
    if (!records || records.length === 0) {
      console.log(`[FCM] No active FCM tokens found for user ${userId}`);
      return;
    }

    const tokens = records.map((r) => r.fcmToken);
    return await sendToTokens(tokens, {
      title,
      body,
      data,
      channelId: appType === 'rider' ? 'teffes_rider_alerts' : 'teffes_customer_channel',
    });
  } catch (err) {
    console.error(`[FCM] Error in sendToUser (${userId}):`, err.message);
  }
};

/**
 * Send high-priority alert to a delivery rider
 */
const sendToRider = async (riderId, { title, body, data = {} }) => {
  return await sendToUser(riderId, { title, body, data }, 'rider');
};

/**
 * Send push notification to a single specific token
 */
const sendToToken = async (fcmToken, { title, body, data = {}, channelId }) => {
  return await sendToTokens([fcmToken], { title, body, data, channelId });
};

/**
 * Send notification to a Firebase topic (e.g. 'all_customers', 'all_riders', 'offers')
 */
const sendToTopic = async (topic, { title, body, data = {} }) => {
  if (!isFirebaseReady()) return;

  const messaging = getMessagingInstance();
  const stringData = formatDataPayload(data);

  try {
    const response = await messaging.send({
      topic,
      notification: { title, body },
      data: stringData,
      android: {
        priority: 'high',
        notification: {
          channelId: 'teffes_customer_channel',
          sound: 'default',
        },
      },
    });
    console.log(`[FCM] Topic "${topic}" message sent successfully: ${response}`);
    return { success: true, messageId: response };
  } catch (error) {
    console.error(`[FCM] Error sending topic message to "${topic}":`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendToTokens,
  sendToUser,
  sendToRider,
  sendToToken,
  sendToTopic,
};
