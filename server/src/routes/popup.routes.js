const { Router } = require('express');
const { getActivePopups } = require('../controllers/popup.controller');

const router = Router();

// Public: Get all active promotional popups for customers
router.get('/active', getActivePopups);

module.exports = router;
