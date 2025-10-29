const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for room creation endpoint
 * Limits: 10 room creations per 15 minutes per IP
 */
const createRoomLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 room creations per 15 minutes per IP
  message: { error: 'Too many rooms created. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for photo upload endpoint
 * Limits: 10 uploads per minute per IP
 */
const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 uploads per minute
  message: { error: 'Too many uploads. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for guess submission endpoint
 * Limits: 100 guesses per minute per IP (generous for active games)
 */
const guessLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 guesses per minute (generous for active games)
  message: { error: 'Too many guess attempts. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General rate limiter for other endpoints
 * Limits: 50 requests per minute per IP
 */
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // 50 requests per minute
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  createRoomLimiter,
  uploadLimiter,
  guessLimiter,
  generalLimiter
};
