import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import imageUploadRoute from './routes/imageUploadRoute.js';
import profileSettingsRoute from './routes/profileSettingsRoute.js';
import AddressRoute from './routes/AddressRoute.js';
import OrdersRoute from './routes/OrdersRoute.js';
import productRoute from './routes/productRoute.js';
import VendorRoute from './routes/VendorRoute.js';
// import messageRoute from './routes/messageRoute.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== RATE LIMITING CONFIGURATION ====================

// General rate limiter for all API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // REMOVE the custom keyGenerator - the library handles this automatically
});

// Stricter rate limiter for authentication routes (login, signup, etc.)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // Limit each IP to 20 requests per windowMs
  message: {
    error: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for sensitive operations (store creation, product publishing)
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 30, // Limit each IP to 30 requests per hour
  message: {
    error: 'Too many sensitive operations from this IP, please try again after 1 hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Media upload limiter (for image uploads)
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 50, // Limit each IP to 50 uploads per hour
  message: {
    error: 'Too many upload requests from this IP, please try again after 1 hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==================== MIDDLEWARE ====================

// CORS middleware
app.use(cors());

// JSON parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to all routes (except health check)
app.use('/api', (req, res, next) => {
  // Skip rate limiting for health check endpoints
  if (req.path === '/health' || req.path === '/') {
    return next();
  }
  return apiLimiter(req, res, next);
});

// ==================== ROUTES ====================

// Apply specific rate limiters to different route groups

// Authentication routes - stricter limits
app.use('/api/users/auth', authLimiter);
app.use('/api/users/login', authLimiter);
app.use('/api/users/signup', authLimiter);
app.use('/api/users/register', authLimiter);

// Upload routes - specific limiter
app.use('/api/users/upload', uploadLimiter);

// Sensitive operations - store creation, product publishing
app.use('/api/users/add-vendor-profile', sensitiveLimiter);
app.use('/api/users/add-vendor-product', sensitiveLimiter);

// General routes with API limiter
app.use('/api/users', apiLimiter);

// ==================== ROUTE REGISTRATION ====================

// Register routes
app.use('/api/users', imageUploadRoute);
app.use('/api/users', profileSettingsRoute);
app.use('/api/users', AddressRoute);
app.use('/api/users', OrdersRoute);
app.use('/api/users', productRoute);
app.use('/api/users', VendorRoute);
// app.use('/api/users', messageRoute);

// ==================== HEALTH CHECK ====================

// Health check endpoint (no rate limiting)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Sample route
app.get('/', (req, res) => {
  res.send('Hello from the backend server!');
});

// ==================== ERROR HANDLING ====================

// Global error handler for rate limiting
app.use((err, req, res, next) => {
  if (err.code === 'ERR_RATE_LIMIT' || err.statusCode === 429) {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Please slow down and try again later.',
      retryAfter: err.retryAfter || 60
    });
  }
  next(err);
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('Rate limiting is active:');
  console.log('  - API routes: 100 requests per 15 minutes');
  console.log('  - Auth routes: 20 requests per 15 minutes');
  console.log('  - Sensitive operations: 30 requests per hour');
  console.log('  - Upload routes: 50 requests per hour');
});