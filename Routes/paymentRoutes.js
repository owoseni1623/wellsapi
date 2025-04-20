const express = require('express');
const {
  getPayments,
  getPayment,
  createPayment,
  updatePaymentStatus,
  getPaymentReceipt,
  updatePayment,
  deletePayment,
  getAutopayments,
  getPaymentStats,
  getRecurringPayments,
  getPaymentCalendar,
  scheduleRecurringPayment,
  updateRecurringPayment,
  cancelRecurringPayment,
  generatePaymentReport
} = require('../Controller/paymentController');

const router = express.Router();

// Protect middleware
const { protect } = require('../Middleware/authMiddleware');

// Apply protection to all routes
router.use(protect);

// Payment routes
router.route('/')
  .get(getPayments)
  .post(createPayment);

router.route('/autopay')
  .get(getAutopayments);

router.route('/stats')
  .get(getPaymentStats);

router.route('/recurring')
  .get(getRecurringPayments)
  .post(scheduleRecurringPayment);

router.route('/recurring/:id')
  .put(updateRecurringPayment)
  .delete(cancelRecurringPayment);

router.route('/calendar')
  .get(getPaymentCalendar);

router.route('/report')
  .get(generatePaymentReport);

router.route('/:id')
  .get(getPayment)
  .put(updatePayment)
  .delete(deletePayment);

router.route('/:id/status')
  .put(updatePaymentStatus);

router.route('/:id/receipt')
  .get(getPaymentReceipt);

module.exports = router;