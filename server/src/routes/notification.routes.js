const { Router } = require('express');
const { optionalProtect } = require('../middlewares/auth');
const {
  registerToken,
  unregisterToken,
  sendTestNotification,
} = require('../controllers/notification.controller');

const router = Router();

// Register device FCM token (authenticated or guest)
router.post('/register-token', optionalProtect, registerToken);

// Unregister device FCM token on logout
router.post('/unregister-token', unregisterToken);

// Send test push notification
router.post('/test', optionalProtect, sendTestNotification);

module.exports = router;
