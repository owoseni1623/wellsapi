const express = require('express');
const router = express.Router();
const { protect } = require('../Middleware/authMiddleware');
const {
  createDispute,
  getDisputes,
  getDispute,
  getDisputeByNumber,
  updateDispute,
  cancelDispute,
  downloadAttachment
} = require('../Controller/disputeTransactionController');

// All dispute routes require authentication
router.use(protect);

// Main routes
router.route('/')
  .post(createDispute)
  .get(getDisputes);

router.route('/:id')
  .get(getDispute)
  .put(updateDispute);

// Special routes
router.get('/number/:disputeNumber', getDisputeByNumber);
router.put('/:id/cancel', cancelDispute);
router.get('/:id/attachments/:attachmentId', downloadAttachment);

module.exports = router;