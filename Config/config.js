/**
 * Application configuration settings
 * Contains environment-specific settings for various components
 */

// Use environment variables with fallbacks for local development
const config = {
    // Server configuration
    server: {
      port: process.env.PORT || 3000,
      environment: process.env.NODE_ENV || 'development',
    },
    
    // Database configuration
    database: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/wells-fargo',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    },
    
    // JWT configuration for authentication
    jwt: {
      secret: process.env.JWT_SECRET || 'your-dev-secret-key',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    },
    
    // Email service configuration
    email: {
      service: process.env.EMAIL_SERVICE || 'gmail',
      user: process.env.EMAIL_USER || 'your-email@gmail.com',
      password: process.env.EMAIL_PASSWORD || 'your-app-password',
      from: process.env.EMAIL_FROM || '"Wells Fargo" <noreply@wellsfargo.com>'
    },
    
    // API rate limiting
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    }
  };
  
  module.exports = config;