const { Router } = require('express');
const { getActiveBanners } = require('../controllers/banner.controller');

const router = Router();

// Public: Get all active banners
router.get('/', getActiveBanners);

module.exports = router;
