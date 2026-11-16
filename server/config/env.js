import dotenv from 'dotenv';
dotenv.config();

// ───────────────────────────────────────────────────────────────
// Required var check - non-fatal on purpose.
// Render needs an open port within its scan window; if we
// process.exit(1) here before app.listen, the deploy fails with
// "No open ports detected" and the real error is hidden.
// Instead: log clearly, and let server.js decide what to do.
// ───────────────────────────────────────────────────────────────
const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter((k) => !process.env[k]);

console.log('🔧 Env check:', {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '(unset, default 3000)',
  hasMongoUri: !!process.env.MONGO_URI,
  hasJwtSecret: !!process.env.JWT_SECRET,
  hasClientUrl: !!process.env.CLIENT_URL,
  hasAdminEmail: !!process.env.ADMIN_EMAIL,
  hasAdminPassword: !!process.env.ADMIN_PASSWORD,
  hasSmtpUser: !!process.env.SMTP_USER,
  hasSmtpPass: !!process.env.SMTP_PASS,
});

if (missing.length) {
  console.error(`❌ Missing required env var(s): ${missing.join(', ')}`);
  console.error('   The server will still start so Render can detect the port,');
  console.error('   but DB-backed routes will fail until these are set.');
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Render assigns PORT dynamically (usually 10000). Always prefer
  // the platform value over any default.
  PORT: parseInt(process.env.PORT || '3000', 10),

  MONGO_URI: process.env.MONGO_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',

  ADMIN_NAME: process.env.ADMIN_NAME || 'Admin',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || '',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',

  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'Cynert Optical <no-reply@cynert.com>',
  ORDER_RECIPIENT_EMAIL: process.env.ORDER_RECIPIENT_EMAIL || '',

  DIRECTOR_EMAIL: process.env.DIRECTOR_EMAIL || '',
  OPTICIAN_EMAIL: process.env.OPTICIAN_EMAIL || '',

  // Convenience flag used by server.js
  hasMissingRequired: missing.length > 0,
};