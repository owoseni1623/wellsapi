const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { validateUserRegistration } = require('../Middleware/validators');
const orderCheckController = require('../Controller/orderCheckController');
const { protect } = require('../Middleware/authMiddleware');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/check-photos/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.user.id + '-' + uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Apply authentication middleware to all routes
router.use(protect);

// Route to create a new check order
router.post(
  '/',
  [
    check('accountId', 'Account ID is required').not().isEmpty(),
    check('accountName', 'Account name is required').not().isEmpty(),
    check('accountNumber', 'Account number is required').not().isEmpty(),
    check('checkStyle', 'Check style is required').isIn(['standard', 'premium', 'scenic', 'custom']),
    check('quantity', 'Quantity is required').isIn(['1', '2', '4']),
    check('deliveryMethod', 'Delivery method is required').isIn(['standard', 'expedited', 'overnight']),
    check('shippingAddress', 'Shipping address is required').not().isEmpty(),
    check('shippingAddress.name', 'Address name is required').not().isEmpty(),
    check('shippingAddress.street', 'Street address is required').not().isEmpty(),
    check('shippingAddress.city', 'City is required').not().isEmpty(),
    check('shippingAddress.state', 'State is required').not().isEmpty(),
    check('shippingAddress.zip', 'ZIP code is required').not().isEmpty()
  ],
  orderCheckController.createOrder
);

// Route to get all orders for the logged-in user
router.get('/', orderCheckController.getUserOrders);

// Route to get a single order by ID
router.get('/id/:id', orderCheckController.getOrderById);

// Route to get order by order number
router.get('/number/:orderNumber', orderCheckController.getOrderByNumber);

// Route to update order status (admin only)
router.put(
  '/status/:id',
  [
    check('status', 'Status is required').isIn(['processing', 'shipped', 'delivered', 'cancelled'])
  ],
  // Add admin middleware here
  orderCheckController.updateOrderStatus
);

// Route to cancel an order
router.put('/cancel/:id', orderCheckController.cancelOrder);

// Route to upload custom photo for checks
router.post(
  '/upload-photo',
  upload.single('photo'),
  orderCheckController.uploadCustomPhoto
);

// Route to get check style options
router.get('/check-styles', orderCheckController.getCheckStyleOptions);

// Route to get pricing information
router.get('/pricing', orderCheckController.getPricingInfo);

// Route to save user preferences
router.post(
  '/preferences',
  orderCheckController.saveUserPreferences
);

// Route to get user preferences
router.get('/preferences', orderCheckController.getUserPreferences);

module.exports = router;