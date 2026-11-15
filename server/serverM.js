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

const app = express();
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// Safe NoSQL sanitize (Express 4.19+ compatible)
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});

app.use(hpp());
app.use(compression());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));
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

app.use(notFound);
app.use(errorHandler);

const start = async () => {
  await connectDB();
  await bootstrapAdmin();
  app.listen(env.PORT, () =>
    console.log(`🚀 Server running on http://localhost:${env.PORT}`)
  );
};

start();