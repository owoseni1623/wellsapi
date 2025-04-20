const OrderCheck = require('../Model/OrderCheckModel');
const User = require('../Model/UserModel');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');

// Price configuration - should ideally be in a separate configuration file
const PRICES = {
  checkStyles: {
    standard: 20.00,
    premium: 25.00,
    scenic: 28.00,
    custom: 35.00
  },
  quantities: {
    '1': 20.00,
    '2': 36.00,
    '4': 65.00
  },
  deliveryMethods: {
    standard: 0.00,
    expedited: 8.95,
    overnight: 15.95
  },
  taxRate: 0.0825 // 8.25%
};

// Helper function to calculate prices
const calculatePrices = (checkStyle, quantity, deliveryMethod) => {
  const subtotal = PRICES.checkStyles[checkStyle] + PRICES.quantities[quantity];
  const tax = subtotal * PRICES.taxRate;
  const shippingCost = PRICES.deliveryMethods[deliveryMethod];
  const total = subtotal + tax + shippingCost;
  
  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    shippingCost: parseFloat(shippingCost.toFixed(2)),
    total: parseFloat(total.toFixed(2))
  };
};

// Helper function to calculate estimated delivery date
const calculateEstimatedDeliveryDate = (deliveryMethod) => {
  const today = new Date();
  let deliveryDate = new Date();
  
  switch (deliveryMethod) {
    case 'overnight':
      // Next business day
      deliveryDate.setDate(today.getDate() + 1);
      break;
    case 'expedited':
      // 3-5 business days
      deliveryDate.setDate(today.getDate() + 5);
      break;
    default:
      // 7-10 business days
      deliveryDate.setDate(today.getDate() + 10);
      break;
  }
  
  return deliveryDate;
};

// Create a new check order
exports.createOrder = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const {
      accountId,
      accountName,
      accountNumber,
      checkStyle,
      quantity,
      deliveryMethod,
      shippingAddress,
      customization,
      specialInstructions,
      customPhoto
    } = req.body;
    
    // Calculate pricing
    const { subtotal, tax, shippingCost, total } = calculatePrices(
      checkStyle, 
      quantity, 
      deliveryMethod
    );
    
    // Calculate estimated delivery date
    const estimatedDeliveryDate = calculateEstimatedDeliveryDate(deliveryMethod);
    
    // Create the new order
    const newOrder = new OrderCheck({
      user: req.user.id, // Assuming user ID is available from auth middleware
      accountId,
      accountName,
      accountNumber,
      checkStyle,
      quantity,
      deliveryMethod,
      shippingAddress,
      customization: customization || {},
      specialInstructions: specialInstructions || '',
      subtotal,
      tax,
      shippingCost,
      total,
      estimatedDeliveryDate,
      customPhoto: customPhoto || null
    });
    
    // Save the order
    await newOrder.save();
    
    res.status(201).json({
      success: true,
      order: {
        id: newOrder._id,
        orderNumber: newOrder.orderNumber,
        orderDate: newOrder.orderDate,
        total: newOrder.total,
        status: newOrder.status,
        estimatedDeliveryDate: newOrder.estimatedDeliveryDate
      }
    });
  } catch (error) {
    console.error('Error creating check order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create check order',
      error: error.message
    });
  }
};

// Get all orders for the logged-in user
exports.getUserOrders = async (req, res) => {
  try {
    const orders = await OrderCheck.find({ user: req.user.id })
      .sort({ orderDate: -1 }); // Sort by order date (newest first)
    
    res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user orders',
      error: error.message
    });
  }
};

// Get a single order by ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await OrderCheck.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check if the order belongs to the logged-in user
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this order'
      });
    }
    
    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: error.message
    });
  }
};

// Get order by order number
exports.getOrderByNumber = async (req, res) => {
  try {
    const order = await OrderCheck.findOne({ orderNumber: req.params.orderNumber });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check if the order belongs to the logged-in user
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this order'
      });
    }
    
    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Error fetching order by number:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: error.message
    });
  }
};

// Update order status (admin only)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, trackingNumber } = req.body;
    
    // Validate status
    const validStatuses = ['processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status'
      });
    }
    
    const order = await OrderCheck.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Update order status
    order.status = status;
    
    // If tracking number is provided, update it
    if (trackingNumber) {
      order.trackingNumber = trackingNumber;
    }
    
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        trackingNumber: order.trackingNumber
      }
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  }
};

// Cancel an order
exports.cancelOrder = async (req, res) => {
  try {
    const order = await OrderCheck.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check if the order belongs to the logged-in user
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order'
      });
    }
    
    // Check if order is already cancelled or shipped
    if (order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Order is already cancelled'
      });
    }
    
    if (['shipped', 'delivered'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel order that is already shipped or delivered'
      });
    }
    
    // Update order status to cancelled
    order.status = 'cancelled';
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status
      }
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message
    });
  }
};

// Upload custom photo for checks
exports.uploadCustomPhoto = async (req, res) => {
  try {
    // This would be handled with a file upload middleware like multer
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    // Return the file path or URL
    res.status(200).json({
      success: true,
      photoUrl: req.file.path // Or however you generate the file URL
    });
  } catch (error) {
    console.error('Error uploading custom photo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload custom photo',
      error: error.message
    });
  }
};

// Get check style options
exports.getCheckStyleOptions = async (req, res) => {
  try {
    const checkStyles = [
      { id: 'standard', name: 'Standard Blue', price: 20.00, image: '/Images/check-standard.jpg', description: 'Classic blue design with security features' },
      { id: 'premium', name: 'Premium Gray', price: 25.00, image: '/Images/check-premium.jpg', description: 'Elegant gray design with enhanced security' },
      { id: 'scenic', name: 'Scenic Nature', price: 28.00, image: '/Images/check-scenic.jpg', description: 'Beautiful landscape imagery on each check' },
      { id: 'custom', name: 'Custom Photo', price: 35.00, image: '/Images/check-custom.jpg', description: 'Upload your personal photo for a customized look' }
    ];
    
    res.status(200).json({
      success: true,
      checkStyles
    });
  } catch (error) {
    console.error('Error fetching check styles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch check styles',
      error: error.message
    });
  }
};

// Get pricing information
exports.getPricingInfo = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      pricing: {
        checkStyles: PRICES.checkStyles,
        quantities: PRICES.quantities,
        deliveryMethods: PRICES.deliveryMethods,
        taxRate: PRICES.taxRate
      }
    });
  } catch (error) {
    console.error('Error fetching pricing information:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pricing information',
      error: error.message
    });
  }
};

// Save user preferences
exports.saveUserPreferences = async (req, res) => {
  try {
    const { checkStyle, deliveryMethod, customization } = req.body;
    
    // Update the user's preferences
    await User.findByIdAndUpdate(req.user.id, {
      'checkOrderPreferences.checkStyle': checkStyle,
      'checkOrderPreferences.deliveryMethod': deliveryMethod,
      'checkOrderPreferences.customization': customization
    });
    
    res.status(200).json({
      success: true,
      message: 'User preferences saved successfully'
    });
  } catch (error) {
    console.error('Error saving user preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save user preferences',
      error: error.message
    });
  }
};

// Get user preferences
exports.getUserPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('checkOrderPreferences');
    
    res.status(200).json({
      success: true,
      preferences: user.checkOrderPreferences || {}
    });
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user preferences',
      error: error.message
    });
  }
};