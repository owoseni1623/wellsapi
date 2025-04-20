const Profile = require('../Model/ProfileModel');
const User = require('../Model/UserModel');
const { validationResult } = require('express-validator');

// Get current user's profile
exports.getProfile = async (req, res) => {
    try {
      console.log('getProfile called for user ID:', req.user.id);
      
      // Find profile by user id
      const profile = await Profile.findOne({ user: req.user.id });
      console.log('Profile found:', profile);
  
      // If no profile exists, create an initial profile
      if (!profile) {
        console.log('No profile found, creating initial profile');
        // Get user info to create initial profile
        const user = await User.findById(req.user.id).select('-password -securityAnswer');
        
        if (!user) {
          return res.status(404).json({ 
            success: false, 
            error: 'User not found' 
          });
        }
  
        // Create basic profile with required fields
        const initialProfile = new Profile({
          user: req.user.id,
          firstName: user.firstName || 'New',
          lastName: user.lastName || 'User',
          email: user.email || 'user@example.com',
          phoneNumber: '0000000000', // Default placeholder phone number
          address: {
            line1: '',
            line2: '',
            city: '',
            state: '',
            zipCode: ''
          },
          verificationStatus: {
            emailVerified: false,
            phoneVerified: false,
            twoFactorEnabled: false
          },
          preferences: {
            language: 'en',
            defaultAccount: '',
            statementDelivery: 'electronic'
          },
          notificationSettings: {
            balanceAlerts: true,
            transactionAlerts: true,
            securityAlerts: true,
            channels: {
              email: true,
              sms: false,
              push: false
            }
          },
          securitySettings: {
            lastPasswordChange: new Date()
          }
        });
        
        await initialProfile.save();
        
        // Return the newly created profile
        const completeProfile = {
          ...initialProfile.toObject(),
          username: user.username,
        };
        
        return res.json({
          success: true,
          data: completeProfile,
          message: 'Initial profile created'
        });
      }
  
      // Get user info to combine with profile
      const user = await User.findById(req.user.id).select('-password -securityAnswer');
      
      // Combine profile and user data for a complete response
      const completeProfile = {
        ...profile.toObject(),
        username: user.username,
        // Add any other user fields you want to include
      };
  
      res.json({ 
        success: true, 
        data: completeProfile 
      });
    } catch (err) {
      console.error('Error in getProfile:', err.message);
      res.status(500).json({ 
        success: false, 
        error: 'Server error while retrieving profile' 
      });
    }
  };

// Create or update user profile
exports.updateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      error: errors.array()[0].msg 
    });
  }

  const {
    firstName,
    lastName,
    email,
    phoneNumber,
    address,
    dateOfBirth,
    profilePicture
  } = req.body;

  try {
    // Format phone number to ensure consistent storage
    const formattedPhone = phoneNumber ? phoneNumber.replace(/\D/g, '') : '';
    
    // Validate phone number format
    if (formattedPhone && formattedPhone.length !== 10) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number must be 10 digits' 
      });
    }

    // Build profile object
    const profileFields = {
      user: req.user.id,
      updated: Date.now()
    };
    
    if (firstName) profileFields.firstName = firstName;
    if (lastName) profileFields.lastName = lastName;
    if (email) profileFields.email = email;
    if (formattedPhone) profileFields.phoneNumber = formattedPhone;
    if (dateOfBirth) profileFields.dateOfBirth = dateOfBirth;
    if (profilePicture) profileFields.profilePicture = profilePicture;
    
    // Handle address based on its format
    if (address) {
      if (typeof address === 'string') {
        // If address is a string, try to parse it into components
        const addressParts = address.split(',').map(part => part.trim());
        
        profileFields.address = {
          line1: addressParts[0] || '',
          line2: '',
          city: addressParts[1] || '',
          state: addressParts[2] || '',
          zipCode: addressParts[3] || ''
        };
      } else if (typeof address === 'object') {
        // If address is already an object, use it directly
        profileFields.address = address;
      }
    }

    // Update user email in User model as well if changed
    if (email) {
      await User.findByIdAndUpdate(req.user.id, { email });
    }

    // Find profile by user id
    let profile = await Profile.findOne({ user: req.user.id });

    if (profile) {
      // Update existing profile
      profile = await Profile.findOneAndUpdate(
        { user: req.user.id },
        { $set: profileFields },
        { new: true }
      );
    } else {
      // Create new profile if it doesn't exist
      profile = new Profile(profileFields);
      await profile.save();
    }

    // Get user info to combine with updated profile
    const user = await User.findById(req.user.id).select('-password -securityAnswer');
    
    // Combine profile and user data for a complete response
    const completeProfile = {
      ...profile.toObject(),
      username: user.username,
      // Add any other user fields you want to include
    };

    res.json({ 
      success: true, 
      data: completeProfile,
      message: 'Profile updated successfully' 
    });
  } catch (err) {
    console.error('Error in updateProfile:', err.message);
    
    // Handle duplicate email error specially
    if (err.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email already in use by another account' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Server error while updating profile' 
    });
  }
};

// Create initial profile when user registers
exports.createInitialProfile = async (userId, userData) => {
  try {
    // Check if profile already exists
    const existingProfile = await Profile.findOne({ user: userId });
    if (existingProfile) {
      return { success: true, data: existingProfile };
    }
    
    // Extract profile fields from user data
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      dateOfBirth
    } = userData;
    
    // Format phone number
    const formattedPhone = phoneNumber ? phoneNumber.replace(/\D/g, '') : '';
    
    // Create profile fields object
    const profileFields = {
      user: userId,
      firstName: firstName || 'New',
      lastName: lastName || 'User',
      email: email || 'user@example.com',
      phoneNumber: formattedPhone || '0000000000',
      dateOfBirth: dateOfBirth || null,
      address: {
        line1: addressLine1 || '',
        line2: addressLine2 || '',
        city: city || '',
        state: state || '',
        zipCode: zipCode || ''
      }
    };
    
    // Create new profile
    const newProfile = new Profile(profileFields);
    await newProfile.save();
    
    return { success: true, data: newProfile };
  } catch (err) {
    console.error('Error creating initial profile:', err);
    return { success: false, error: err.message };
  }
};

// Update security settings
exports.updateSecuritySettings = async (req, res) => {
  try {
    const { twoFactorEnabled } = req.body;
    
    const profile = await Profile.findOne({ user: req.user.id });
    
    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        error: 'Profile not found' 
      });
    }
    
    // Update specific security settings
    profile.verificationStatus.twoFactorEnabled = twoFactorEnabled ?? profile.verificationStatus.twoFactorEnabled;
    profile.securitySettings.lastPasswordChange = new Date();
    profile.updated = Date.now();
    
    await profile.save();
    
    res.json({ 
      success: true, 
      data: profile,
      message: 'Security settings updated successfully' 
    });
  } catch (err) {
    console.error('Error updating security settings:', err.message);
    res.status(500).json({ 
      success: false, 
      error: 'Server error while updating security settings' 
    });
  }
};

// Update preferences
exports.updatePreferences = async (req, res) => {
  try {
    const { language, defaultAccount, statementDelivery } = req.body;
    
    const profile = await Profile.findOne({ user: req.user.id });
    
    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        error: 'Profile not found' 
      });
    }
    
    // Update preferences
    if (language) profile.preferences.language = language;
    if (defaultAccount) profile.preferences.defaultAccount = defaultAccount;
    if (statementDelivery) profile.preferences.statementDelivery = statementDelivery;
    profile.updated = Date.now();
    
    await profile.save();
    
    res.json({ 
      success: true, 
      data: profile,
      message: 'Preferences updated successfully' 
    });
  } catch (err) {
    console.error('Error updating preferences:', err.message);
    res.status(500).json({ 
      success: false, 
      error: 'Server error while updating preferences' 
    });
  }
};

// Update notification settings
exports.updateNotifications = async (req, res) => {
  try {
    const { 
      balanceAlerts, 
      transactionAlerts, 
      securityAlerts,
      emailNotifications,
      smsNotifications,
      pushNotifications
    } = req.body;
    
    const profile = await Profile.findOne({ user: req.user.id });
    
    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        error: 'Profile not found' 
      });
    }
    
    // Update notification settings
    if (balanceAlerts !== undefined) profile.notificationSettings.balanceAlerts = balanceAlerts;
    if (transactionAlerts !== undefined) profile.notificationSettings.transactionAlerts = transactionAlerts;
    if (securityAlerts !== undefined) profile.notificationSettings.securityAlerts = securityAlerts;
    
    // Update notification channels
    if (emailNotifications !== undefined) profile.notificationSettings.channels.email = emailNotifications;
    if (smsNotifications !== undefined) profile.notificationSettings.channels.sms = smsNotifications;
    if (pushNotifications !== undefined) profile.notificationSettings.channels.push = pushNotifications;
    
    profile.updated = Date.now();
    
    await profile.save();
    
    res.json({ 
      success: true, 
      data: profile,
      message: 'Notification settings updated successfully' 
    });
  } catch (err) {
    console.error('Error updating notification settings:', err.message);
    res.status(500).json({ 
      success: false, 
      error: 'Server error while updating notification settings' 
    });
  }
};

// Delete profile
exports.deleteProfile = async (req, res) => {
  try {
    // Remove profile
    await Profile.findOneAndRemove({ user: req.user.id });
    
    res.json({ 
      success: true, 
      message: 'Profile deleted successfully' 
    });
  } catch (err) {
    console.error('Error deleting profile:', err.message);
    res.status(500).json({ 
      success: false, 
      error: 'Server error while deleting profile' 
    });
  }
};