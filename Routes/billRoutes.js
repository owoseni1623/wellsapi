const express = require('express');
const {
  getBills,
  getUpcomingBills,
  getBill,
  createBill,
  updateBill,
  deleteBill,
  toggleAutopay,
  toggleReminder
} = require('../Controller/billController');

const router = express.Router();

// Protect middleware would go here
const { protect } = require('../Middleware/authMiddleware');

// Apply protection to all routes
router.use(protect);

// Bill routes
router.route('/')
  .get(getBills)
  .post(createBill);

router.route('/upcoming')
  .get(getUpcomingBills);

router.route('/:id')
  .get(getBill)
  .put(updateBill)
  .delete(deleteBill);

router.route('/:id/autopay')
  .put(toggleAutopay);

router.route('/:id/reminder')
  .put(toggleReminder);

module.exports = router;