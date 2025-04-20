const express = require('express');
const router = express.Router();
const {
  register,
  login,
  forgotPassword,
  resetPassword,
  recoverUsername,
  updateProfile,
  verifyIdentity,
  getMe
} = require('../Controller/AuthController');
const { validateUserRegistration } = require('../Middleware/validators');
const { protect } = require('../Middleware/authMiddleware');

// Public routes
router.post('/register', validateUserRegistration, register);
router.post('/login', login);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);
router.post('/recoverusername', recoverUsername);

// Protected routes (requires authentication)
router.get('/me', protect, getMe);
router.put('/updateprofile', protect, updateProfile);
router.post('/verifyidentity', protect, verifyIdentity);

module.exports = router;