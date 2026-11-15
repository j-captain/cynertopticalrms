import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { bootstrapAdmin } from './utils/bootstrapAdmin.js';

import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import reportRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';
import usersRoutes from './routes/users.js';
import ordersRoutes from './routes/orders.js';
import auditRoutes from './routes/audit.js';
import icd11Routes from './routes/icd11.js';
import insuranceRoutes from './routes/insurance.js';
import customRecipientsRoutes from './routes/customRecipients.js';
import dbRoutes from './routes/db.js';
import documentsRoutes from './routes/documents.js';
import lensTypesRoutes from './routes/lensTypes.js';
import LensType from './models/LensType.js';
import loginLogsRouter from './routes/loginLogs.js';
import billingRouter from './routes/billing.js';
import paymentChannelsRouter from './routes/paymentChannels.js';


const app = express();
app.set('trust proxy', 1);

// ───────────────────────────────────────────────────────────────
// 1. Disable Express ETag globally.
//    Authenticated API responses must NEVER be served as 304 -
//    the "no body on 304" behavior breaks any JSON client.
// ───────────────────────────────────────────────────────────────
app.set('etag', false);

// ───────────────────────────────────────────────────────────────
// 2. Security headers. Helmet is applied to ALL routes.
//    (No CSP changes - keep the defaults as-is.)
// ───────────────────────────────────────────────────────────────
app.use(helmet());

// ───────────────────────────────────────────────────────────────
// 3. CORS - only the known client, credentials allowed.
// ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  })
);

// ───────────────────────────────────────────────────────────────
// 4. Body parsers - small limits, JS/urlencoded only.
// ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// ───────────────────────────────────────────────────────────────
// 5. NoSQL-injection sanitize (Express 4.19+ compatible).
// ───────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});

app.use(hpp());
app.use(compression());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ───────────────────────────────────────────────────────────────
// 6. Never cache /api/* responses.
//    This is the security-critical line: no browser, no proxy,
//    no intermediary may store a response that may contain PII.
//    It ALSO eliminates 304 responses permanently.
// ───────────────────────────────────────────────────────────────
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  // Expose the auth token on responses for any future client that needs it
  res.setHeader('Vary', 'Origin, Authorization');
  next();
});

// ───────────────────────────────────────────────────────────────
// 7. Rate limits.
// ───────────────────────────────────────────────────────────────
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(
  '/api/auth/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20 })
);

// ───────────────────────────────────────────────────────────────
// 8. Health check (public).
// ───────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// ───────────────────────────────────────────────────────────────
// 9. Application routes.
// ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/icd11', icd11Routes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/custom-recipients', customRecipientsRoutes);
app.use('/api/db', dbRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/lens-types', lensTypesRoutes);
app.use('/api/login-logs', loginLogsRouter);
app.use('/api/billing', billingRouter);
app.use('/api/payment-channels', paymentChannelsRouter);

// ───────────────────────────────────────────────────────────────
// 10. 404 + error handlers.
// ───────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ───────────────────────────────────────────────────────────────
// 11. Boot.
// ───────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  await bootstrapAdmin();
  app.listen(env.PORT, () =>
    console.log(`🚀 Server running on http://localhost:${env.PORT}`)
  );
};

start();