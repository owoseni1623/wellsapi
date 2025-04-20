const express = require('express');
const {
  getPayees,
  getPayee,
  createPayee,
  updatePayee,
  deletePayee
} = require('../Controller/payeeController');

const router = express.Router();

// Protect middleware
const { protect } = require('../Middleware/authMiddleware');

// Apply protection to all routes
router.use(protect);

// Payee routes
router.route('/')
  .get(getPayees)
  .post(createPayee);

router.route('/:id')
  .get(getPayee)
  .put(updatePayee)
  .delete(deletePayee);

module.exports = router;