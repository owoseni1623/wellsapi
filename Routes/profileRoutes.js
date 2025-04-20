// routes/profileRoutes.js
const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { protect } = require('../Middleware/authMiddleware'); // Import the protect function
const profileController = require('../Controller/profileController');

/**
 * @route   GET /api/profile
 * @desc    Get current user's profile
 * @access  Private
 */
router.get('/', protect, profileController.getProfile);

/**
 * @route   PUT /api/profile
 * @desc    Create or update user profile
 * @access  Private
 */
router.put('/', [
  protect,
  [
    check('firstName', 'First name is required').not().isEmpty(),
    check('lastName', 'Last name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('phoneNumber', 'Phone number is required').not().isEmpty()
  ]
], profileController.updateProfile);

/**
 * @route   PUT /api/profile/security
 * @desc    Update security settings
 * @access  Private
 */
router.put('/security', protect, profileController.updateSecuritySettings);

/**
 * @route   PUT /api/profile/preferences
 * @desc    Update preferences
 * @access  Private
 */
router.put('/preferences', protect, profileController.updatePreferences);

/**
 * @route   PUT /api/profile/notifications
 * @desc    Update notification settings
 * @access  Private
 */
router.put('/notifications', protect, profileController.updateNotifications);

/**
 * @route   DELETE /api/profile
 * @desc    Delete profile
 * @access  Private
 */
router.delete('/', protect, profileController.deleteProfile);

module.exports = router;