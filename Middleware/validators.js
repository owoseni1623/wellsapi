const { check } = require('express-validator');

// User validation rules
const validateUserRegistration = [
  check('name', 'Name is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  
  // Optional fields validation
  check('phoneNumber').optional().isMobilePhone('any', { strictMode: false }),
  check('address.zipCode').optional().matches(/^\d{5}(-\d{4})?$/),
  
  // Check order preferences validation
  check('checkOrderPreferences.checkStyle').optional()
    .isIn(['standard', 'premium', 'scenic', 'custom']),
  check('checkOrderPreferences.deliveryMethod').optional()
    .isIn(['standard', 'expedited', 'overnight']),
  check('checkOrderPreferences.customization.fontStyle').optional()
    .isIn(['standard', 'classic', 'script', 'modern']),
    
  // Boolean fields validation  
  check('checkOrderPreferences.customization.includeAddress').optional().isBoolean(),
  check('checkOrderPreferences.customization.includePhoneNumber').optional().isBoolean(),
  check('checkOrderPreferences.customization.includeDriversLicense').optional().isBoolean(),
  check('checkOrderPreferences.customization.duplicateChecks').optional().isBoolean(),
  check('checkOrderPreferences.customization.largePrint').optional().isBoolean(),
  
  // Shipping address validation if provided
  check('shippingAddresses.*.name').optional().not().isEmpty(),
  check('shippingAddresses.*.street').optional().not().isEmpty(),
  check('shippingAddresses.*.city').optional().not().isEmpty(),
  check('shippingAddresses.*.state').optional().not().isEmpty(),
  check('shippingAddresses.*.zip').optional().matches(/^\d{5}(-\d{4})?$/)
];

// User login validation
const validateUserLogin = [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists()
];

// Check order validation rules
const validateCheckOrder = [
  check('checkStyle', 'Check style is required').not().isEmpty()
    .isIn(['standard', 'premium', 'scenic', 'custom']),
  check('deliveryMethod', 'Delivery method is required').not().isEmpty()
    .isIn(['standard', 'expedited', 'overnight']),
  check('shippingAddressId', 'Shipping address ID is required').not().isEmpty(),
  check('quantity', 'Quantity must be a positive number').isInt({ min: 1 })
];

// Update user profile validation
const validateUpdateProfile = [
  check('name').optional().not().isEmpty(),
  check('email').optional().isEmail(),
  check('phoneNumber').optional().isMobilePhone('any', { strictMode: false }),
  check('address.line1').optional().not().isEmpty(),
  check('address.city').optional().not().isEmpty(),
  check('address.state').optional().not().isEmpty(),
  check('address.zipCode').optional().matches(/^\d{5}(-\d{4})?$/)
];

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateCheckOrder,
  validateUpdateProfile
};