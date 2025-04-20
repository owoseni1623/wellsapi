const AccountAlert = require('../Model/AccountAlertModel');
const User = require('../Model/UserModel');
const { sendEmail, sendSMS } = require('../Utils/notifications');

// Get all alerts for a user
exports.getUserAlerts = async (req, res) => {
  try {
    const userAlerts = await AccountAlert.findOne({ userId: req.user.id });
    
    if (!userAlerts) {
      // Create default alerts if none exist
      const user = await User.findById(req.user.id);
      
      // Set default phone number if it's empty
      const phoneNumber = user.phone || '0000000000'; // Provide a default value
      
      const newAlerts = await AccountAlert.createDefaultForUser(
        req.user.id, 
        user.email, 
        phoneNumber
      );
      return res.status(200).json(newAlerts);
    }
    
    res.status(200).json(userAlerts);
  } catch (error) {
    console.error('Error fetching user alerts:', error);
    res.status(500).json({ message: 'Server error while fetching alerts' });
  }
};

// Update balance alerts
exports.updateBalanceAlerts = async (req, res) => {
  try {
    const { enabled, threshold, notificationMethod } = req.body;
    
    const userAlerts = await AccountAlert.findOne({ userId: req.user.id });
    if (!userAlerts) {
      return res.status(404).json({ message: 'Alert settings not found' });
    }
    
    userAlerts.balanceAlerts = {
      enabled,
      threshold,
      notificationMethod
    };
    
    await userAlerts.save();
    res.status(200).json({ message: 'Balance alerts updated successfully', data: userAlerts.balanceAlerts });
  } catch (error) {
    console.error('Error updating balance alerts:', error);
    res.status(500).json({ message: 'Server error while updating balance alerts' });
  }
};

// Update transaction alerts
exports.updateTransactionAlerts = async (req, res) => {
  try {
    const { category, settings } = req.body;
    
    const userAlerts = await AccountAlert.findOne({ userId: req.user.id });
    if (!userAlerts) {
      return res.status(404).json({ message: 'Alert settings not found' });
    }
    
    if (!userAlerts.transactionAlerts[category]) {
      return res.status(400).json({ message: 'Invalid transaction alert category' });
    }
    
    userAlerts.transactionAlerts[category] = settings;
    
    await userAlerts.save();
    res.status(200).json({ 
      message: `${category} alerts updated successfully`, 
      data: userAlerts.transactionAlerts[category] 
    });
  } catch (error) {
    console.error('Error updating transaction alerts:', error);
    res.status(500).json({ message: 'Server error while updating transaction alerts' });
  }
};

// Update security alerts
exports.updateSecurityAlerts = async (req, res) => {
  try {
    const { category, settings } = req.body;
    
    const userAlerts = await AccountAlert.findOne({ userId: req.user.id });
    if (!userAlerts) {
      return res.status(404).json({ message: 'Alert settings not found' });
    }
    
    if (!userAlerts.securityAlerts[category]) {
      return res.status(400).json({ message: 'Invalid security alert category' });
    }
    
    userAlerts.securityAlerts[category] = settings;
    
    await userAlerts.save();
    res.status(200).json({ 
      message: `${category} alerts updated successfully`, 
      data: userAlerts.securityAlerts[category] 
    });
  } catch (error) {
    console.error('Error updating security alerts:', error);
    res.status(500).json({ message: 'Server error while updating security alerts' });
  }
};

// Update statement alerts
exports.updateStatementAlerts = async (req, res) => {
  try {
    const { category, settings } = req.body;
    
    const userAlerts = await AccountAlert.findOne({ userId: req.user.id });
    if (!userAlerts) {
      return res.status(404).json({ message: 'Alert settings not found' });
    }
    
    if (!userAlerts.statementAlerts[category]) {
      return res.status(400).json({ message: 'Invalid statement alert category' });
    }
    
    userAlerts.statementAlerts[category] = settings;
    
    await userAlerts.save();
    res.status(200).json({ 
      message: `${category} alerts updated successfully`, 
      data: userAlerts.statementAlerts[category] 
    });
  } catch (error) {
    console.error('Error updating statement alerts:', error);
    res.status(500).json({ message: 'Server error while updating statement alerts' });
  }
};

// Update contact information
exports.updateContactInfo = async (req, res) => {
  try {
    const { email, phone, pushEnabled } = req.body;
    
    const userAlerts = await AccountAlert.findOne({ userId: req.user.id });
    if (!userAlerts) {
      return res.status(404).json({ message: 'Alert settings not found' });
    }
    
    userAlerts.contactInfo = {
      email: email || userAlerts.contactInfo.email,
      phone: phone || userAlerts.contactInfo.phone,
      pushEnabled: pushEnabled !== undefined ? pushEnabled : userAlerts.contactInfo.pushEnabled
    };
    
    await userAlerts.save();
    
    // Update user's email/phone in User model if needed
    if (email || phone) {
      const user = await User.findById(req.user.id);
      if (email) user.email = email;
      if (phone) user.phone = phone;
      await user.save();
    }
    
    res.status(200).json({ 
      message: 'Contact information updated successfully', 
      data: userAlerts.contactInfo 
    });
  } catch (error) {
    console.error('Error updating contact information:', error);
    res.status(500).json({ message: 'Server error while updating contact information' });
  }
};

// Update all alert settings at once
exports.updateAllAlertSettings = async (req, res) => {
  try {
    const { 
      balanceAlerts, 
      transactionAlerts, 
      securityAlerts, 
      statementAlerts,
      contactInfo 
    } = req.body;
    
    const userAlerts = await AccountAlert.findOne({ userId: req.user.id });
    if (!userAlerts) {
      return res.status(404).json({ message: 'Alert settings not found' });
    }
    
    // Update all sections that were included in the request
    if (balanceAlerts) userAlerts.balanceAlerts = balanceAlerts;
    if (transactionAlerts) userAlerts.transactionAlerts = transactionAlerts;
    if (securityAlerts) userAlerts.securityAlerts = securityAlerts;
    if (statementAlerts) userAlerts.statementAlerts = statementAlerts;
    
    if (contactInfo) {
      userAlerts.contactInfo = {
        email: contactInfo.email || userAlerts.contactInfo.email,
        phone: contactInfo.phone || userAlerts.contactInfo.phone,
        pushEnabled: contactInfo.pushEnabled !== undefined ? 
          contactInfo.pushEnabled : userAlerts.contactInfo.pushEnabled
      };
      
      // Update user's email/phone in User model if needed
      if (contactInfo.email || contactInfo.phone) {
        const user = await User.findById(req.user.id);
        if (contactInfo.email) user.email = contactInfo.email;
        if (contactInfo.phone) user.phone = contactInfo.phone;
        await user.save();
      }
    }
    
    await userAlerts.save();
    res.status(200).json({ 
      message: 'Alert settings updated successfully',
      data: userAlerts
    });
  } catch (error) {
    console.error('Error updating all alert settings:', error);
    res.status(500).json({ message: 'Server error while updating alert settings' });
  }
};

// Utility functions for processing different types of alerts - these would be called by other parts of your app
exports.processBalanceAlert = async (userId, balance) => {
  try {
    const userAlerts = await AccountAlert.findOne({ userId });
    if (!userAlerts || !userAlerts.balanceAlerts.enabled) return;
    
    if (balance < userAlerts.balanceAlerts.threshold) {
      await sendBalanceAlertNotifications(userAlerts, balance);
    }
  } catch (error) {
    console.error('Error processing balance alert:', error);
  }
};

exports.processTransactionAlert = async (userId, transaction) => {
  try {
    const userAlerts = await AccountAlert.findOne({ userId });
    if (!userAlerts) return;
    
    const { type, amount, isInternational, isATM } = transaction;
    
    // Check for large debits
    if (type === 'debit' && userAlerts.transactionAlerts.largeDebits.enabled) {
      if (amount >= userAlerts.transactionAlerts.largeDebits.threshold) {
        await sendTransactionAlertNotifications(
          userAlerts.contactInfo,
          userAlerts.transactionAlerts.largeDebits.notificationMethod,
          'Large Debit Alert',
          `A debit of $${amount} was made to your account.`
        );
      }
    }
    
    // Check for large credits
    if (type === 'credit' && userAlerts.transactionAlerts.largeCredits.enabled) {
      if (amount >= userAlerts.transactionAlerts.largeCredits.threshold) {
        await sendTransactionAlertNotifications(
          userAlerts.contactInfo,
          userAlerts.transactionAlerts.largeCredits.notificationMethod,
          'Large Credit Alert',
          `A credit of $${amount} was made to your account.`
        );
      }
    }
    
    // Check for ATM withdrawals
    if (isATM && userAlerts.transactionAlerts.atmWithdrawals.enabled) {
      await sendTransactionAlertNotifications(
        userAlerts.contactInfo,
        userAlerts.transactionAlerts.atmWithdrawals.notificationMethod,
        'ATM Withdrawal Alert',
        `An ATM withdrawal of $${amount} was made from your account.`
      );
    }
    
    // Check for international transactions
    if (isInternational && userAlerts.transactionAlerts.internationalTransactions.enabled) {
      await sendTransactionAlertNotifications(
        userAlerts.contactInfo,
        userAlerts.transactionAlerts.internationalTransactions.notificationMethod,
        'International Transaction Alert',
        `An international transaction of $${amount} was made on your account.`
      );
    }
  } catch (error) {
    console.error('Error processing transaction alert:', error);
  }
};

// Helper functions for sending notifications
async function sendBalanceAlertNotifications(userAlerts, balance) {
  const { contactInfo, balanceAlerts } = userAlerts;
  const message = `Your account balance is now $${balance}, which is below your alert threshold of $${balanceAlerts.threshold}.`;
  
  try {
    if (balanceAlerts.notificationMethod.includes('email')) {
      await sendEmail(contactInfo.email, 'Low Balance Alert', message);
    }
    
    if (balanceAlerts.notificationMethod.includes('text')) {
      await sendSMS(contactInfo.phone, message);
    }
    
    if (balanceAlerts.notificationMethod.includes('push') && contactInfo.pushEnabled) {
      // Send push notification - implementation would depend on your push notification service
      console.log(`Push notification would be sent to user ${userAlerts.userId}`);
    }
  } catch (error) {
    console.error('Error sending balance alert notifications:', error);
  }
}

async function sendTransactionAlertNotifications(contactInfo, methods, subject, message) {
  try {
    if (methods.includes('email')) {
      await sendEmail(contactInfo.email, subject, message);
    }
    
    if (methods.includes('text')) {
      await sendSMS(contactInfo.phone, message);
    }
    
    if (methods.includes('push') && contactInfo.pushEnabled) {
      // Send push notification - implementation would depend on your push notification service
      console.log(`Push notification would be sent: ${subject}`);
    }
  } catch (error) {
    console.error('Error sending transaction alert notifications:', error);
  }
}