const nodemailer = require('nodemailer');
const config = require('../Config/config');

/**
 * Email service utility for sending emails
 * Used by various application components to send notifications and receipts
 */

// Create a transporter with your email service configuration
const transporter = nodemailer.createTransport({
  service: config.email.service || 'gmail',
  auth: {
    user: config.email.user,
    pass: config.email.password
  }
});

/**
 * Send an email using the configured transporter
 * @param {Object} options - Email sending options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text email body (optional if html is provided)
 * @param {string} options.html - HTML email body (optional if text is provided)
 * @param {string} options.from - Sender email address (optional, defaults to config)
 * @param {Array} options.attachments - Array of attachment objects (optional)
 * @returns {Promise} - Resolves with info about the sent message
 */
exports.sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: options.from || config.email.from || '"Wells Fargo Banking" <noreply@wellsfargo.com>',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send a template-based email
 * @param {string} templateName - Name of the email template
 * @param {Object} data - Data to populate the template with
 * @param {Object} options - Email sending options (to, subject, etc.)
 * @returns {Promise} - Resolves with info about the sent message
 */
exports.sendTemplateEmail = async (templateName, data, options) => {
  try {
    // In a real implementation, this would load and render a template
    // For simplicity, we're just handling a few predefined templates
    let html;

    switch (templateName) {
      case 'withdrawalReceipt':
        html = `
          <h1>Wells Fargo Withdrawal Receipt</h1>
          <p>Transaction ID: ${data.transactionId}</p>
          <p>Amount: $${data.amount.toFixed(2)}</p>
          <p>Type: ${data.withdrawalType}</p>
          <p>Date: ${new Date(data.date).toLocaleString()}</p>
          ${data.atmCode ? `<p>ATM Code: ${data.atmCode} (valid for 30 minutes)</p>` : ''}
          ${data.fee > 0 ? `<p>Fee: $${data.fee.toFixed(2)}</p>` : ''}
          <p>Thank you for banking with Wells Fargo!</p>
        `;
        break;
      
      case 'accountAlert':
        html = `
          <h1>Wells Fargo Account Alert</h1>
          <p>Dear Customer,</p>
          <p>${data.message}</p>
          <p>Account: ${data.accountNumber.replace(/(\d{4})$/, '****$1')}</p>
          <p>Date: ${new Date().toLocaleString()}</p>
          <p>If you did not initiate this action, please contact customer service immediately.</p>
        `;
        break;
      
      default:
        throw new Error(`Unknown email template: ${templateName}`);
    }

    // Send the email with the rendered template
    return await exports.sendEmail({
      ...options,
      html
    });
  } catch (error) {
    console.error(`Failed to send template email (${templateName}):`, error);
    throw error;
  }
};