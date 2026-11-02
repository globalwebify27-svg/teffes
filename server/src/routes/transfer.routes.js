const { Router } = require('express');
const {
  requestTransfer,
  getStoreTransfers,
  dispatchTransfer,
  receiveTransfer,
  rejectTransfer,
  cancelTransfer,
  updateTransferStatus,
} = require('../controllers/transferController');
const { protect, restrictTo } = require('../middlewares/auth');

const router = Router();

router.use(protect, restrictTo('storeadmin', 'superadmin', 'admin'));

router.post('/request', requestTransfer);
router.get('/', getStoreTransfers);
router.post('/:id/dispatch', dispatchTransfer);
router.post('/:id/receive', receiveTransfer);
router.post('/:id/reject', rejectTransfer);
router.post('/:id/cancel', cancelTransfer);
router.put('/:id/status', updateTransferStatus);

module.exports = router;
