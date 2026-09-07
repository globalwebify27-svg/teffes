const { Router } = require('express');
const { requestTransfer, getStoreTransfers, updateTransferStatus } = require('../controllers/transferController');
const { protect, restrictTo } = require('../middlewares/auth');

const router = Router();

router.use(protect, restrictTo('storeadmin', 'superadmin'));

router.post('/request', requestTransfer);
router.get('/', getStoreTransfers);
router.put('/:id/status', updateTransferStatus);

module.exports = router;
