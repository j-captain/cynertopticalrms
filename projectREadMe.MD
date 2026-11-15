# Cynert Optical Records Management System

A modern, secure MERN-stack application for managing optical patient records,
lens/frame orders, automated order-email delivery, and comprehensive admin
operations (user management, settings, order control, audit logging, reporting).

---

## ✨ Features

### Patient Records
- Full CRUD for patient records
- Fields: patient name, system number, lens type, lens amount, frame code,
  frame amount, pre-auth date, computed total (frame + lens)
- Live search by name / system number / frame code
- Status tracking: **Ordered → Delivered → Handed to Client**
- Server-side validation & NoSQL-injection sanitization

### Order Workflow
- Per-record "Submit Order" button → confirmation modal
- Two delivery modes:
  1. **Configured Mail** - sends to the admin-configured default recipient
  2. **Custom Mail** - sends to any user-supplied recipient
- Beautiful, responsive HTML email template (gradient header, clean tables)
- Every order dispatch is logged to `OrderLog` (with success/failure)
- **Resend** failed or repeat orders from the Orders page
- **Cancel** placed orders (admin-only)

### Comprehensive Admin Panel
- **Dashboard** - KPIs, 7-day email activity chart, delivery success split,
  revenue metrics
- **Users** - create staff/admin users, change roles, reset passwords, delete
  (admin-only section)
- **Orders** - filterable log of every email dispatched with date range,
  status, stats, CSV export, resend, cancel
- **Reports** - date-range filtered order report with lens-vs-frame value
  split and CSV export
- **Settings** - configure the default order recipient email, from-name,
  from-email, clinic name, currency, and custom-recipient toggle
- **Audit Log** - immutable, searchable history of every meaningful action
  (who, what, when, IP, user agent, success/failure)
- **Profile** - update own name/email and change password

### Security
- `helmet` HTTP security headers
- `cors` with strict origin (client URL only)
- `express-rate-limit` (global + stricter on login)
- `hpp` HTTP Parameter Pollution protection
- `express-mongo-sanitize` (Express 4.19+ safe wrapper) for NoSQL injection
- `bcrypt` (12 rounds) password hashing
- JWT in httpOnly cookie + Bearer fallback
- Input validation via `express-validator`
- Role-based authorization (`admin` vs `staff`)
- Duplicate-key, CastError, JWT-error normalization
- Automatic admin bootstrap on first server start

---

## 🧱 Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion, Recharts, Lucide icons, react-hot-toast, axios, react-router-dom |
| Backend | Node.js (ESM), Express 4, MongoDB + Mongoose 8, JWT, bcryptjs, Nodemailer, express-validator |
| Security | helmet, cors, express-rate-limit, hpp, express-mongo-sanitize |
| Email | Nodemailer over SMTP (Gmail, Resend, SES, Mailgun, etc.) |

**Ports:** Client → `5173` · Server → `3000`

---
