const { Router } = require('express');
const {
  getWalletDetails,
  addMoney,
  addMoneyToUser,
  createWalletTopupOrder,
  verifyWalletTopup,
} = require('../controllers/walletController');
const { protect, restrictTo } = require('../middlewares/auth');

const router = Router();

router.use(protect);

router.get('/details', getWalletDetails);
router.post('/add', addMoney);
router.post('/create-order', createWalletTopupOrder);
router.post('/verify-topup', verifyWalletTopup);
router.post('/admin/add-money', restrictTo('superadmin'), addMoneyToUser);

module.exports = router;
