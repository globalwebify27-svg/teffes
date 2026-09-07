const { Router } = require('express');
const { getWalletDetails, addMoney, addMoneyToUser } = require('../controllers/walletController');
const { protect, restrictTo } = require('../middlewares/auth');

const router = Router();

router.use(protect);

router.get('/details', getWalletDetails);
router.post('/add', addMoney);
router.post('/admin/add-money', restrictTo('superadmin'), addMoneyToUser);

module.exports = router;
