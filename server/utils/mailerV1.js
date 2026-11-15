import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!env.SMTP_HOST || !env.SMTP_USER) {
    console.warn('⚠️  SMTP not configured. Emails will not be delivered.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    requireTLS: env.SMTP_PORT === 587,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  transporter.verify((err) => {
    if (err) {
      console.error('❌ SMTP verification failed:', err.message);
      if (err.message.includes('535')) {
        console.error('   → 535 = wrong password OR SMTP_FROM email ≠ SMTP_USER email.');
      }
    } else {
      console.log('✅ SMTP ready');
    }
  });

  return transporter;
};

const formatMoney = (n) =>
  `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

const formatDate = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const buildDiagnosesText = (diagnoses) => {
  if (!diagnoses?.length) return '-';
  return diagnoses
    .map((d, i) => {
      const code = d.code ? `<strong>${d.code}</strong>` : '';
      const desc = d.description || '';
      return `${i + 1}. ${[code, desc].filter(Boolean).join(' - ')}`;
    })
    .join('<br/>');
};

// ─── Shared template (dark navy footer, identical for both modes) ───
// opts.showTotal (default true) controls the "Total (Frame + Lens)" row.
// Full keeps it; Mini opts out because its rows no longer carry amounts.
const renderEmail = (patient, rows, opts = {}) => {
  const { showTotal = true } = opts;
  const total = (patient.lensAmount || 0) + (patient.frameAmount || 0);

  const rowsHtml = rows
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:12px 18px;border-bottom:1px solid #eef2f7;color:#64748b;font-size:13px;width:42%;vertical-align:top;">${k}</td>
        <td style="padding:12px 18px;border-bottom:1px solid #eef2f7;color:#0f172a;font-size:14px;font-weight:600;">${v}</td>
      </tr>`
    )
    .join('');

  const totalRowHtml = showTotal
    ? `
                  <tr>
                    <td style="padding:16px 18px;background:#f8fafc;color:#0f172a;font-size:14px;font-weight:700;">Total (Frame + Lens)</td>
                    <td style="padding:16px 18px;background:#f8fafc;color:#0ea5e9;font-size:16px;font-weight:800;text-align:right;">${formatMoney(total)}</td>
                  </tr>`
    : '';

  const html = `
  <!DOCTYPE html>
  <html>
    <head><meta charset="UTF-8" /><title>Order Confirmation</title></head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
        <tr><td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%);padding:32px 28px;text-align:center;">
                <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">CYNERT OPTICAL</div>
                <div style="font-size:12px;color:#e0f2fe;margin-top:6px;letter-spacing:2px;text-transform:uppercase;">Records Management System</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 8px;">
                <h2 style="margin:0 0 6px;font-size:18px;color:#0f172a;">Order Confirmation</h2>
                <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
                  A new optical order has been submitted. Please find the details below.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef2f7;border-radius:12px;overflow:hidden;">
                  ${rowsHtml}
                  ${totalRowHtml}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 28px;">
                <div style="background:#eff6ff;border-left:4px solid #0ea5e9;padding:12px 16px;border-radius:8px;color:#1e3a8a;font-size:12px;line-height:1.6;">
                  Cynert Optical RMS - For Better Optical Care.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#0f172a;text-align:center;color:#94a3b8;font-size:11px;">
                © ${new Date().getFullYear()} Cynert Optical. All rights reserved.
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;

  return { html, subject: `Order Confirmation - ${patient.name}` };
};

// ─── Full - everything ───
export const buildOrderEmail = (patient) => {
  const rows = [
    ['Patient Name', patient.name],
    ['System Number', patient.systemNumber],
    ['Scheme', patient.scheme || '-'],
    ...(patient.scheme === 'Insurance' && patient.insurance
      ? [['Insurance', patient.insurance]]
      : []),
    ['Lens Type', patient.lensType],
    ['RX BE', patient.rxBe || '-'],
    ['ADD', patient.rxAdd || '-'],
    ['PD', patient.rxPd || '-'],
    ['Lens Amount', formatMoney(patient.lensAmount)],
    ['Frame Code', patient.frameCode || '-'],
    ['Frame Amount', formatMoney(patient.frameAmount)],
    ['Pre-Auth Date', formatDate(patient.preAuthDate)],
    ['Diagnosis', buildDiagnosesText(patient.diagnoses)],
    ['Complaint', patient.complaint || '-'],
  ];
  // Full keeps the Total (Frame + Lens) footer row.
  return renderEmail(patient, rows, { showTotal: true });
};

// ─── Mini - essentials only, identical layout/footer ───
// No Lens Amount, no Frame Amount, no Total row.
export const buildMiniOrderEmail = (patient) => {
  const rows = [
    ['Patient Name', patient.name],
    ['Lens Type', patient.lensType],
    ['RX BE', patient.rxBe || '-'],
    ['ADD', patient.rxAdd || '-'],
    ['PD', patient.rxPd || '-'],
    ['Frame Code', patient.frameCode || '-'],
    ['Diagnosis', buildDiagnosesText(patient.diagnoses)],
  ];
  return renderEmail(patient, rows, { showTotal: false });
};

// ─── Send - mode defaults to 'full' ───
export const sendOrderEmail = async ({ to, patient, mode = 'full' }) => {
  const t = getTransporter();
  const builder = mode === 'mini' ? buildMiniOrderEmail : buildOrderEmail;
  const { html, subject } = builder(patient);
  if (!t) {
    console.log(`📧 [DEV] Email (${mode}) to`, to);
    console.log(subject);
    return { simulated: true };
  }
  return t.sendMail({ from: env.SMTP_FROM, to, subject, html });
};