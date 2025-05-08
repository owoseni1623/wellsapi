const User = require('../Model/UserModel');
const { hashPassword, comparePassword } = require('../Utils/passwordUtils');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Calculate tax based on deposit amount (following simplified US tax rules)
const calculateTax = (depositAmount) => {
  // For this implementation, using a simplified tax rate of 15%
  // In a real application, you would implement more complex tax calculations
  // based on actual tax brackets, state taxes, etc.
  const taxRate = 0.15;
  const taxAmount = depositAmount * taxRate;
  return parseFloat(taxAmount.toFixed(2)); // Round to 2 decimal places
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    console.log('Registration request received:', req.body);
    console.log('Raw request body:', JSON.stringify(req.body, null, 2));
    
    // Ensure the name field is explicitly set
    if (!req.body.name && req.body.firstName && req.body.lastName) {
      req.body.name = `${req.body.firstName} ${req.body.lastName}`;
    }
    
    // Check if name is set
    if (!req.body.name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required but was not provided'
      });
    }
    
    // Check for missing required fields
    const requiredFields = ['username', 'email', 'password', 'firstName', 'lastName', 
                           'phoneNumber', 'addressLine1', 'city', 'state', 'zipCode', 
                           'ssn', 'dateOfBirth', 'securityQuestion', 'securityAnswer'];
    
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          success: false,
          error: `${field} is required`
        });
      }
    }
    
    const {
      name,  // Include name in destructuring
      username,
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      ssn,
      dateOfBirth,
      securityQuestion,
      securityAnswer
    } = req.body;

    // Check if user already exists
    try {
      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
      if (existingUser) {
        if (existingUser.username === username) {
          return res.status(400).json({
            success: false,
            error: 'Username already exists. Please choose a different username.'
          });
        } else {
          return res.status(400).json({
            success: false,
            error: 'Email already exists. Please use a different email address.'
          });
        }
      }
    } catch (error) {
      console.error('Error checking existing user:', error);
      return res.status(500).json({
        success: false,
        error: 'Database error occurred while checking existing user'
      });
    }

    // Format phone number - strip non-digit characters
    const formattedPhone = phoneNumber ? phoneNumber.replace(/\D/g, '') : '';
    
    // Validate phone number format
    if (!formattedPhone || formattedPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid 10-digit phone number'
      });
    }

    // Generate account number safely
    let accountNumber;
    try {
      accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    } catch (error) {
      console.error('Error generating account number:', error);
      accountNumber = Date.now().toString();
    }

    // Fixed routing number
    const routingNumber = '121000248';

    // Initial deposit amount
    const initialDepositAmount = 1600000.00;
    
    // Calculate tax on initial deposit
    const taxAmount = calculateTax(initialDepositAmount);
    
    // Calculate net amount after tax
    const netAmountAfterTax = initialDepositAmount - taxAmount;

    // Create transactions for initial deposit and tax
    const initialDepositTransaction = {
      date: new Date(),
      description: 'Initial deposit',
      amount: initialDepositAmount,
      type: 'credit',
      category: 'Deposit',
      balance: initialDepositAmount,
      permanent: true // Flag to ensure this doesn't get cleared
    };
    
    const taxTransaction = {
      date: new Date(),
      description: 'Federal tax withholding (8.08%)',
      amount: taxAmount,
      type: 'debit',
      category: 'Tax',
      balance: netAmountAfterTax,
      permanent: true // Flag to ensure this doesn't get cleared
    };

    // Create initial account with both transactions
    const initialAccount = {
      accountNumber: accountNumber,
      routingNumber: routingNumber,
      accountType: 'Checking',
      accountName: 'Everyday Checking',
      balance: netAmountAfterTax, // Balance after tax deduction
      transactions: [initialDepositTransaction, taxTransaction]
    };

    // Process date of birth
    let parsedDateOfBirth;
    try {
      parsedDateOfBirth = new Date(dateOfBirth);
      if (isNaN(parsedDateOfBirth.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format for date of birth'
        });
      }
    } catch (error) {
      console.error('Error parsing date of birth:', error);
      return res.status(400).json({
        success: false,
        error: 'Invalid date format for date of birth'
      });
    }

    // Process SSN - ensure we only store last 4 digits
    const ssnLastFour = ssn.length > 4 ? ssn.slice(-4) : ssn;
    
    // Prepare user object
    const userObj = {
      name: name || `${firstName} ${lastName}`,  // Ensure name is set
      username,
      email,
      password,
      firstName,
      lastName,
      phoneNumber: formattedPhone,
      address: {
        line1: addressLine1,
        line2: addressLine2 || '',
        city,
        state,
        zipCode
      },
      ssn: ssnLastFour,
      dateOfBirth: parsedDateOfBirth,
      securityQuestion,
      securityAnswer,
      lastLogin: Date.now(),
      accounts: [initialAccount]
    };

    // Log the user object before creation to confirm name is set
    console.log('Attempting to create user with data:', {
      ...userObj,
      name: userObj.name, // Log the name explicitly
      password: '[REDACTED]',
      ssn: '[REDACTED]',
      securityAnswer: '[REDACTED]'
    });

    // Create new user
    let user;
    try {
      // Double-check name is present
      if (!userObj.name) {
        return res.status(400).json({
          success: false,
          error: 'Name field is required but was not provided'
        });
      }
      
      console.log('Final user object before creation:', {
        ...userObj,
        name: userObj.name, // Log the name explicitly
        password: '[REDACTED]',
        ssn: '[REDACTED]',
        securityAnswer: '[REDACTED]'
      });
      
      user = await User.create(userObj);
      console.log('User created successfully:', user._id);
      
      // Generate JWT token
      const token = user.getSignedJwtToken();
      
      // Send response
      return res.status(201).json({
        success: true,
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          username: user.username,
          accounts: user.accounts
        }
      });
      
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({
        success: false,
        error: `Database error: ${error.message}`
      });
    }
  } catch (error) {
    console.error('Unexpected error in registration process:', error);
    return res.status(500).json({
      success: false,
      error: `Registration failed: ${error.message}`
    });
  }
};

// In AuthController.js, in the login function
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Validate inputs
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide username and password'
      });
    }

    // Check for user
    const user = await User.findOne({ username }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Username not found. Please register for an account.'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please try again.'
      });
    }

    // Update last login time - THIS IS WHERE THE FIX IS NEEDED
    // Use findByIdAndUpdate instead of modifying the document and saving it
    await User.findByIdAndUpdate(user._id, { lastLogin: Date.now() });

    // Generate token
    const token = generateToken(user._id);

    // Fetch fresh user data after update
    const updatedUser = await User.findById(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phone: updatedUser.phoneNumber,
        address: updatedUser.address,
        ssn: updatedUser.ssn,
        dateOfBirth: updatedUser.dateOfBirth,
        securityQuestion: updatedUser.securityQuestion,
        createdAt: updatedUser.createdAt,
        lastLogin: updatedUser.lastLogin,
        preferences: updatedUser.preferences,
        accounts: updatedUser.accounts
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { username } = req.body;

    // Find user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If this username matches our records, password reset instructions will be sent to your email.'
      });
    }

    // Get reset token and save
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // Create reset URL (to be used in email)
    const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/resetpassword/${resetToken}`;

    // In a real app, you'd send an email here with the reset link
    // For this implementation, we'll just return the token

    res.status(200).json({
      success: true,
      message: 'Password reset instructions have been sent to your email.',
      resetUrl, // Remove this in production - just for testing
      resetToken // Remove this in production - just for testing
    });
  } catch (error) {
    console.error('Password reset error:', error);
    
    // If there's an error, clean the reset fields in the database
    if (req.body.username) {
      const user = await User.findOne({ username: req.body.username });
      if (user) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save({ validateBeforeSave: false });
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request. Please try again.'
    });
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    // Find user by token and check if token is expired
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Verify security answer if provided
    if (req.body.securityAnswer) {
      if (user.securityAnswer !== req.body.securityAnswer) {
        return res.status(400).json({
          success: false,
          error: 'Incorrect security answer'
        });
      }
    }

    // Set new password (will be encrypted by pre-save hook)
    user.password = req.body.password;
    
    // Clear reset fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    await user.save();

    // Send token for auto-login after password reset
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully.',
      token
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password. Please try again.'
    });
  }
};

exports.recoverUsername = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });

    // Always return a generic success message for security
    // In a real app, you'd send an email with the username
    res.status(200).json({
      success: true,
      message: 'If this email address matches our records, we will send your username to it.'
    });
  } catch (error) {
    console.error('Username recovery error:', error);
    res.status(500).json({
      success: false,
      error: 'Username recovery failed. Please try again.'
    });
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    // Fields to update
    const fieldsToUpdate = {};
    
    // Extract name, email, phone updates
    if (req.body.firstName) fieldsToUpdate.firstName = req.body.firstName;
    if (req.body.lastName) fieldsToUpdate.lastName = req.body.lastName;
    if (req.body.email) fieldsToUpdate.email = req.body.email;
    if (req.body.phoneNumber) fieldsToUpdate.phoneNumber = req.body.phoneNumber;
    
    // Extract address updates
    if (req.body.addressLine1 || req.body.city || req.body.state || req.body.zipCode || req.body.addressLine2 !== undefined) {
      fieldsToUpdate.address = {};
      
      if (req.body.addressLine1) fieldsToUpdate.address.line1 = req.body.addressLine1;
      if (req.body.addressLine2 !== undefined) fieldsToUpdate.address.line2 = req.body.addressLine2;
      if (req.body.city) fieldsToUpdate.address.city = req.body.city;
      if (req.body.state) fieldsToUpdate.address.state = req.body.state;
      if (req.body.zipCode) fieldsToUpdate.address.zipCode = req.body.zipCode;
    }
    
    // Extract preferences updates
    if (req.body.preferences) {
      fieldsToUpdate.preferences = {};
      
      if (req.body.preferences.notifications !== undefined) {
        fieldsToUpdate.preferences.notifications = req.body.preferences.notifications;
      }
      if (req.body.preferences.twoFactorAuth !== undefined) {
        fieldsToUpdate.preferences.twoFactorAuth = req.body.preferences.twoFactorAuth;
      }
      if (req.body.preferences.paperlessBilling !== undefined) {
        fieldsToUpdate.preferences.paperlessBilling = req.body.preferences.paperlessBilling;
      }
    }
    
    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile. Please try again.'
    });
  }
};

exports.verifyIdentity = async (req, res, next) => {
  try {
    const { verificationMethod, verificationData } = req.body;
    
    // In a real app, you'd implement actual verification logic here
    // For this implementation, we'll just check if verification data is provided
    
    if (!verificationData || verificationData.length <= 3) {
      return res.status(400).json({
        success: false,
        error: 'Identity verification failed'
      });
    }
    
    // Mark user as verified
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        securityVerified: true,
        lastVerification: Date.now()
      },
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      verified: true,
      user: {
        securityVerified: user.securityVerified,
        lastVerification: user.lastVerification
      }
    });
  } catch (error) {
    console.error('Identity verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Identity verification failed. Please try again.'
    });
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user data. Please try again.'
    });
  }
};