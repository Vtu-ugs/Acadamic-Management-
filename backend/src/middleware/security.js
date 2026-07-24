const rateLimit = require('express-rate-limit');
const { config } = require('../config/env');

// Rate limiters are disabled under NODE_ENV=test so the integration suite can
// fire many requests without tripping a 429 (the login-limit test opts back in).
const skip = () => config.isTest;

// Global limiter for the whole API surface — a backstop against scraping/abuse.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,                 // per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'Too many requests, please try again later.' },
});

// Strict limiter for the login endpoint — brute-force protection.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Only failed logins count toward the limit, so a busy legitimate user isn't
  // locked out by their own successful sign-ins.
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please wait a few minutes and try again.' },
});

module.exports = { apiLimiter, loginLimiter };
