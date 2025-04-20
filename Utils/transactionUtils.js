// utils/transactionUtils.js

/**
 * Generates a unique transaction reference number
 * Format: WF-YYYYMMDD-XXXXXX where X is a random alphanumeric character
 * @returns {string} Transaction reference number
 */
exports.generateTransactionReference = () => {
    const date = new Date();
    const datePart = date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    
    for (let i = 0; i < 6; i++) {
      randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return `WF-${datePart}-${randomPart}`;
  };
  
  /**
   * Formats a transaction amount based on type (credit/debit)
   * @param {number} amount The transaction amount
   * @param {string} type The transaction type ('credit' or 'debit')
   * @returns {string} Formatted amount with +/- sign
   */
  exports.formatTransactionAmount = (amount, type) => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    });
    
    if (type === 'credit') {
      return `+${formatter.format(amount)}`;
    } else {
      return `-${formatter.format(amount)}`;
    }
  };
  
  /**
   * Calculates account balance after a transaction
   * @param {number} currentBalance The current balance before transaction
   * @param {number} amount The transaction amount
   * @param {string} type The transaction type ('credit' or 'debit')
   * @returns {number} The new balance after the transaction
   */
  exports.calculateNewBalance = (currentBalance, amount, type) => {
    if (type === 'credit') {
      return currentBalance + amount;
    } else {
      return currentBalance - amount;
    }
  };