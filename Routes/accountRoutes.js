const express = require('express');
const {
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount
} = require('../Controller/accountController');

const router = express.Router();

// Protect middleware
const { protect } = require('../Middleware/authMiddleware');

// Apply protection to all routes
router.use(protect);

// Account routes
router.route('/')
  .get(getAccounts)
  .post(createAccount);

router.route('/:id')
  .get(getAccount)
  .put(updateAccount)
  .delete(deleteAccount);

module.exports = router;