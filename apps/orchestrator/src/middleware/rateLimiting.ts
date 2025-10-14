import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// General rate limiting
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Chat-specific rate limiting
export const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 chat requests per minute
  message: {
    error: 'Too many chat requests, please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Voice-specific rate limiting
export const voiceLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 voice requests per minute
  message: {
    error: 'Too many voice requests, please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin rate limiting
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 admin requests per windowMs
  message: {
    error: 'Too many admin requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Slow down after multiple requests
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 5, // allow 5 requests per 15 minutes, then...
  delayMs: 500, // add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // max delay of 20 seconds
});

// WebSocket connection limiting
export const wsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 WebSocket connections per minute
  message: {
    error: 'Too many WebSocket connections, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
