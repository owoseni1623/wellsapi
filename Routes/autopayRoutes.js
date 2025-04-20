const express = require('express');
const router = express.Router();
const autopayController = require('../Controller/autopayController');
const { protect } = require('../Middleware/authMiddleware');

router.get('/test', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Test endpoint works'
    });
  });

// Apply auth middleware to all routes
router.use(protect);

// Get all autopay settings for the authenticated user
router.get('/', autopayController.getAllAutopays);

// Get payees for autopay setup (bills and accounts)
router.get('/payees', autopayController.getPayees);

// Get a specific autopay by ID
router.get('/:id', autopayController.getAutopayById);

// Create a new autopay
router.post('/', autopayController.createAutopay);

// Update an autopay
router.put('/:id', autopayController.updateAutopay);

// Delete an autopay
router.delete('/:id', autopayController.deleteAutopay);

// Process scheduled payments - typically called by a scheduler, not directly
// Consider removing this endpoint or adding admin-only middleware in production
router.post('/process-scheduled', autopayController.processScheduledPayments);

module.exports = router;