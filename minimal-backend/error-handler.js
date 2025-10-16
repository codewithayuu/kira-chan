// Unified Error Handling System
// Provides consistent error handling across all modules

class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 1000;
  }

  // Create different types of errors
  static createValidationError(message) {
    return new AppError(message, 400);
  }

  static createNotFoundError(message = 'Resource not found') {
    return new AppError(message, 404);
  }

  static createUnauthorizedError(message = 'Unauthorized') {
    return new AppError(message, 401);
  }

  static createForbiddenError(message = 'Forbidden') {
    return new AppError(message, 403);
  }

  static createConflictError(message = 'Conflict') {
    return new AppError(message, 409);
  }

  static createRateLimitError(message = 'Rate limit exceeded') {
    return new AppError(message, 429);
  }

  static createServiceError(message = 'Service unavailable') {
    return new AppError(message, 503);
  }

  // Safe file operations
  static async safeFileRead(filePath, defaultValue = null) {
    try {
      if (!require('fs').existsSync(filePath)) {
        return defaultValue;
      }
      const data = require('fs').readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn(`⚠️ Failed to read file ${filePath}:`, error.message);
      return defaultValue;
    }
  }

  static async safeFileWrite(filePath, data) {
    try {
      const jsonData = JSON.stringify(data, null, 2);
      require('fs').writeFileSync(filePath, jsonData);
      return true;
    } catch (error) {
      console.error(`❌ Failed to write file ${filePath}:`, error.message);
      return false;
    }
  }

  // Safe API calls
  static async safeApiCall(apiCall, fallback = null, context = '') {
    try {
      return await apiCall();
    } catch (error) {
      console.error(`❌ API call failed${context ? ` (${context})` : ''}:`, error.message);
      return fallback;
    }
  }

  // Safe JSON parsing
  static safeJsonParse(jsonString, defaultValue = null) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn('⚠️ Failed to parse JSON:', error.message);
      return defaultValue;
    }
  }

  // Safe async operations
  static async safeAsync(operation, fallback = null, context = '') {
    try {
      return await operation();
    } catch (error) {
      console.error(`❌ Async operation failed${context ? ` (${context})` : ''}:`, error.message);
      return fallback;
    }
  }

  // Log errors
  logError(error, context = '') {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      context,
      statusCode: error.statusCode || 500,
      isOperational: error.isOperational || false
    };

    this.errorLog.push(errorEntry);
    
    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Log to console with appropriate level
    if (error.statusCode >= 500) {
      console.error('🚨 Server Error:', errorEntry);
    } else if (error.statusCode >= 400) {
      console.warn('⚠️ Client Error:', errorEntry);
    } else {
      console.log('ℹ️ Info:', errorEntry);
    }
  }

  // Express error handler middleware
  handleExpressError() {
    return (error, req, res, next) => {
      this.logError(error, `${req.method} ${req.path}`);

      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      const errorResponse = {
        error: {
          message: error.message,
          statusCode: error.statusCode || 500,
          timestamp: error.timestamp || new Date().toISOString()
        }
      };

      if (isDevelopment) {
        errorResponse.error.stack = error.stack;
        errorResponse.error.context = {
          url: req.url,
          method: req.method,
          body: req.body,
          query: req.query
        };
      }

      res.status(error.statusCode || 500).json(errorResponse);
    };
  }

  // Handle uncaught exceptions
  handleUncaughtException() {
    process.on('uncaughtException', (error) => {
      this.logError(error, 'uncaughtException');
      console.error('💥 Uncaught Exception! Shutting down...');
      process.exit(1);
    });
  }

  // Handle unhandled promise rejections
  handleUnhandledRejection() {
    process.on('unhandledRejection', (reason, promise) => {
      this.logError(new Error(`Unhandled Rejection: ${reason}`), 'unhandledRejection');
      console.error('💥 Unhandled Rejection! Shutting down...');
      process.exit(1);
    });
  }

  // Get error statistics
  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      byStatusCode: {},
      byContext: {},
      recent: this.errorLog.slice(-10)
    };

    this.errorLog.forEach(error => {
      // Count by status code
      const statusCode = error.statusCode || 500;
      stats.byStatusCode[statusCode] = (stats.byStatusCode[statusCode] || 0) + 1;
      
      // Count by context
      const context = error.context || 'unknown';
      stats.byContext[context] = (stats.byContext[context] || 0) + 1;
    });

    return stats;
  }

  // Initialize error handling
  initialize() {
    this.handleUncaughtException();
    this.handleUnhandledRejection();
    console.log('✅ Error handling initialized');
  }
}

// Singleton instance
const errorHandler = new ErrorHandler();

module.exports = { 
  AppError, 
  ErrorHandler, 
  errorHandler,
  // Convenience functions
  safeFileRead: ErrorHandler.safeFileRead,
  safeFileWrite: ErrorHandler.safeFileWrite,
  safeApiCall: ErrorHandler.safeApiCall,
  safeJsonParse: ErrorHandler.safeJsonParse,
  safeAsync: ErrorHandler.safeAsync
};
