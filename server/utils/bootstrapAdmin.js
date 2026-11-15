import User from '../models/User.js';
import { env } from '../config/env.js';

export const bootstrapAdmin = async () => {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return;
  const exists = await User.findOne({ email: env.ADMIN_EMAIL.toLowerCase() });
  if (exists) return;
  await User.create({
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
    role: 'admin',
  });
  console.log(`👤 Admin bootstrapped: ${env.ADMIN_EMAIL}`);
};