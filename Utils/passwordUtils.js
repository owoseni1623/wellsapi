const bcrypt = require('bcryptjs');

/**
 * Hash a password
 * @param {string} password - The password to hash
 * @returns {Promise<string>} - Hashed password
 */
exports.hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

/**
 * Compare password with stored hash
 * @param {string} enteredPassword - Password attempt
 * @param {string} storedHash - Stored hashed password
 * @returns {Promise<boolean>} - True if password matches
 */
exports.comparePassword = async (enteredPassword, storedHash) => {
  return await bcrypt.compare(enteredPassword, storedHash);
};

/**
 * Generate a secure random password
 * @param {number} length - Length of password to generate (default 12)
 * @returns {string} - Generated password
 */
exports.generatePassword = (length = 12) => {
  const upperChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowerChars = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const specialChars = '!@#$%^&*()_+';
  
  const allChars = upperChars + lowerChars + numbers + specialChars;
  
  // Ensure we have at least one of each type
  let password = '';
  password += upperChars.charAt(Math.floor(Math.random() * upperChars.length));
  password += lowerChars.charAt(Math.floor(Math.random() * lowerChars.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
};

/**
 * Check password strength
 * @param {string} password - Password to check
 * @returns {string} - 'weak', 'medium', or 'strong'
 */
exports.checkPasswordStrength = (password) => {
  if (!password) return '';
  
  // Check for at least 8 characters
  const isLongEnough = password.length >= 8;
  
  // Check for uppercase, lowercase, numbers, and special characters
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  const strengthScore = [isLongEnough, hasUppercase, hasLowercase, hasNumbers, hasSpecial]
    .filter(Boolean).length;
  
  if (strengthScore <= 2) return 'weak';
  if (strengthScore <= 4) return 'medium';
  return 'strong';
};