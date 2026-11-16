import { Resend } from 'resend';
import dns from 'node:dns/promises';
import { env } from '../config/env.js';

/* ────────────────────────────────────────────────────────────────── */
/* Resend client - lazy-loaded                                        */
/* ────────────────────────────────────────────────────────────────── */
let resend = null;

const getResend = () => {
  if (resend) return resend;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  RESEND_API_KEY not configured. Emails will not be delivered.');
    return null;
  }

  resend = new Resend(apiKey);
  console.log('✅ Resend client ready');
  return resend;
};

/* Default sender. MUST be changed to your verified domain for production
 * (resend.dev only allows sending to your own account email). */
const getFromAddress = () =>
  process.env.RESEND_FROM || 'Cynert Optical <onboarding@resend.dev>';

/* ────────────────────────────────────────────────────────────────── */
/* Security helpers                                                   */
/* ────────────────────────────────────────────────────────────────── */
const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());
const hasHeaderInjection = (s) => /[\r\n]/.test(String(s || ''));

const sanitizeRecipient = (to) => {
  const list = Array.isArray(to) ? to : String(to || '').split(',');
  const clean = list
    .map((s) => String(s).trim())
    .filter((s) => s && isValidEmail(s) && !hasHeaderInjection(s));
  return [...new Set(clean)];
};

const sanitizeSubject = (s) =>
  hasHeaderInjection(s) ? String(s).replace(/[\r\n]+/g, ' ') : String(s || '');

/* ────────────────────────────────────────────────────────────────── */
/* Send wrapper - one place for all Resend calls                      */
/* ────────────────────────────────────────────────────────────────── */
const safeSend = async ({ to, subject, html }) => {
  const client = getResend();
  const recipients = sanitizeRecipient(to);
  if (recipients.length === 0) {
    console.warn('📧 Skipping mail - no valid recipient:', to);
    return { simulated: false, skipped: true };
  }
  if (!client) {
    console.log(`📧 [DEV] To: ${recipients.join(', ')} | Subject: ${subject}`);
    return { simulated: true };
  }

  const { data, error } = await client.emails.send({
    from: getFromAddress(),
    to: recipients.join(', '),
    subject: sanitizeSubject(subject),
    html,
  });
  if (error) {
    console.error('❌ Resend error:', error);
    throw new Error(error.message);
  }
  return data;
};

/* ────────────────────────────────────────────────────────────────── */
/* Money / date / diagnoses                                           */
/* ────────────────────────────────────────────────────────────────── */
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
      const code = d.code ? `<strong>${esc(d.code)}</strong>` : '';
      const desc = d.description ? esc(d.description) : '';
      return `${i + 1}. ${[code, desc].filter(Boolean).join(' - ')}`;
    })
    .join('<br/>');
};

/* ────────────────────────────────────────────────────────────────── */
/* Order email                                                        */
/* ────────────────────────────────────────────────────────────────── */
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
              <td style="padding:24px 28px 52px;">
                <div style="background:#eff6ff;border-left:4px solid #0ea5e9;padding:12px 16px;border-radius:8px;color:#1e3a8a;font-size:12px;line-height:1.6;">
                  Cynert Optical RMS - For Better Optical Care.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background:#0f172a;text-align:center;color:#94a3b8;font-size:11px;">
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

export const buildOrderEmail = (patient) => {
  const rows = [
    ['Patient Name', esc(patient.name)],
    ['System Number', esc(patient.systemNumber)],
    ['Scheme', esc(patient.scheme || '-')],
    ...(patient.scheme === 'Insurance' && patient.insurance
      ? [['Insurance', esc(patient.insurance)]]
      : []),
    ['Lens Type', esc(patient.lensType)],
    ['RX BE', esc(patient.rxBe || '-')],
    ['ADD', esc(patient.rxAdd || '-')],
    ['PD', esc(patient.rxPd || '-')],
    ['Lens Amount', formatMoney(patient.lensAmount)],
    ['Frame Code', esc(patient.frameCode || '-')],
    ['Frame Amount', formatMoney(patient.frameAmount)],
    ['Pre-Auth Date', formatDate(patient.preAuthDate)],
    ['Diagnosis', buildDiagnosesText(patient.diagnoses)],
    ['Complaint', esc(patient.complaint || '-')],
  ];
  return renderEmail(patient, rows, { showTotal: true });
};

export const buildMiniOrderEmail = (patient) => {
  const rows = [
    ['Patient Name', esc(patient.name)],
    ['Lens Type', esc(patient.lensType)],
    ['RX BE', esc(patient.rxBe || '-')],
    ['ADD', esc(patient.rxAdd || '-')],
    ['PD', esc(patient.rxPd || '-')],
    ['Frame Code', esc(patient.frameCode || '-')],
    ['Diagnosis', buildDiagnosesText(patient.diagnoses)],
  ];
  return renderEmail(patient, rows, { showTotal: false });
};

export const sendOrderEmail = async ({ to, patient, mode = 'full' }) => {
  const builder = mode === 'mini' ? buildMiniOrderEmail : buildOrderEmail;
  const { html, subject } = builder(patient);
  return safeSend({ to, subject, html });
};

/* ────────────────────────────────────────────────────────────────── */
/* Activation email                                                   */
/* ────────────────────────────────────────────────────────────────── */
const renderActivationEmail = ({ name, code, ttlMinutes = 5, isNewAccount = true }) => {
  const heading = isNewAccount
    ? `Account successfully created: <strong>${esc(name || 'there')}</strong>`
    : 'Your Activation Code';

  const headingWeight = isNewAccount ? 400 : 700;
  const codeChars = String(code || '').split('').slice(0, 8);

  const codeCellsHtml = codeChars
    .map(
      (ch) => `
        <td align="center" valign="middle"
            style="font-family:'Courier New',monospace;font-size:26px;font-weight:800;color:#0f172a;padding:0;width:12.5%;line-height:1;">
          ${esc(ch)}
        </td>`
    )
    .join('');

  const html = `
  <!DOCTYPE html>
  <html>
    <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${isNewAccount ? 'Welcome to Cynert Optical' : 'Your Cynert Optical activation code'}</title></head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:48px 16px;">
        <tr><td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#f97316 0%,#ea580c 100%);padding:36px 24px;text-align:center;">
                <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">CYNERT OPTICAL</div>
                <div style="font-size:11px;color:#ffedd5;margin-top:8px;letter-spacing:2px;text-transform:uppercase;">Records Management System</div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 0;text-align:center;">
                <h2 style="margin:0;font-size:18px;font-weight:${headingWeight};color:#0f172a;line-height:1.4;">${heading}</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:2px solid #fed7aa;border-radius:16px;overflow:hidden;">
                  <tr>
                    <td style="padding:24px 16px 16px;">
                      <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#9a3412;font-weight:700;text-align:center;margin-bottom:14px;">Your Activation Code</div>
                      <table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;">
                        <tr>${codeCellsHtml}</tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="border-top:1px dashed #fed7aa;padding:12px 16px;background:#ffedd5;text-align:center;">
                      <span style="font-size:12px;color:#9a3412;line-height:1.5;">Expires in <strong>${ttlMinutes} minutes</strong></span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 60px;">
                <div style="background:#fff7ed;border-left:4px solid #f97316;padding:14px 18px;border-radius:8px;color:#7c2d12;font-size:12px;line-height:1.6;">
                  Cynert Optical RMS - For Better Optical Care.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background:#0f172a;text-align:center;color:#94a3b8;font-size:11px;">
                © ${new Date().getFullYear()} Cynert Optical. All rights reserved.
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;

  return {
    html,
    subject: isNewAccount ? 'Welcome to Cynert Optical' : 'Your Cynert Optical activation code',
  };
};

export const buildActivationEmail = ({ name, code, ttlMinutes, isNewAccount }) =>
  renderActivationEmail({ name, code, ttlMinutes, isNewAccount });

export const sendActivationEmail = async ({ to, name, code, ttlMinutes, isNewAccount }) => {
  const { html, subject } = renderActivationEmail({ name, code, ttlMinutes, isNewAccount });
  return safeSend({ to, subject, html });
};

/* ────────────────────────────────────────────────────────────────── */
/* Password reset email                                               */
/* ────────────────────────────────────────────────────────────────── */
const renderPasswordResetEmail = ({ name, code, ttlMinutes = 5 }) => {
  const heading = 'Reset Your Password';
  const codeChars = String(code || '').split('').slice(0, 8);

  const codeCellsHtml = codeChars
    .map(
      (ch) => `
        <td align="center" valign="middle"
            style="font-family:'Courier New',monospace;font-size:26px;font-weight:800;color:#0f172a;padding:0;width:12.5%;line-height:1;">
          ${esc(ch)}
        </td>`
    )
    .join('');

  const html = `
  <!DOCTYPE html>
  <html>
    <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${heading}</title></head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:48px 16px;">
        <tr><td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%);padding:36px 24px;text-align:center;">
                <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">CYNERT OPTICAL</div>
                <div style="font-size:11px;color:#e0f2fe;margin-top:8px;letter-spacing:2px;text-transform:uppercase;">Records Management System</div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 0;text-align:center;">
                <h2 style="margin:0;font-size:18px;font-weight:700;color:#0f172a;line-height:1.4;">${heading}</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:16px;overflow:hidden;">
                  <tr>
                    <td style="padding:24px 16px 16px;">
                      <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#1e40af;font-weight:700;text-align:center;margin-bottom:14px;">Your Password Reset Code</div>
                      <table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;">
                        <tr>${codeCellsHtml}</tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="border-top:1px dashed #bfdbfe;padding:12px 16px;background:#dbeafe;text-align:center;">
                      <span style="font-size:12px;color:#1e3a8a;line-height:1.5;">Expires in <strong>${ttlMinutes} minutes</strong></span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 60px;">
                <div style="background:#eff6ff;border-left:4px solid #0ea5e9;padding:14px 18px;border-radius:8px;color:#1e3a8a;font-size:12px;line-height:1.6;">
                  Cynert Optical RMS - For Better Optical Care.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background:#0f172a;text-align:center;color:#94a3b8;font-size:11px;">
                © ${new Date().getFullYear()} Cynert Optical. All rights reserved.
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;

  return { html, subject: 'Reset your Cynert Optical password' };
};

export const buildPasswordResetEmail = ({ name, code, ttlMinutes }) =>
  renderPasswordResetEmail({ name, code, ttlMinutes });

export const sendPasswordResetEmail = async ({ to, name, code, ttlMinutes }) => {
  const { html, subject } = renderPasswordResetEmail({ name, code, ttlMinutes });
  return safeSend({ to, subject, html });
};

/* ────────────────────────────────────────────────────────────────── */
/* Account activated email                                            */
/* ────────────────────────────────────────────────────────────────── */
const renderAccountActivatedEmail = ({ name, email }) => {
  const html = `
  <!DOCTYPE html>
  <html>
    <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Account Activated</title></head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:48px 16px;">
        <tr><td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:36px 24px;text-align:center;">
                <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">CYNERT OPTICAL</div>
                <div style="font-size:11px;color:#d1fae5;margin-top:8px;letter-spacing:2px;text-transform:uppercase;">Records Management System</div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 0;text-align:center;">
                <h2 style="margin:0;font-size:18px;font-weight:400;color:#0f172a;line-height:1.4;">
                  Account activated successfully: <strong>${esc(name || 'there')}</strong>
                </h2>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border:2px solid #a7f3d0;border-radius:16px;overflow:hidden;">
                  <tr>
                    <td style="padding:24px 22px;text-align:center;">
                      <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#047857;font-weight:700;margin-bottom:14px;">Sign in to your account</div>
                      <div style="font-size:15px;color:#0f172a;line-height:1.7;">
                        Use your username and password on the Cynert Optical login page.
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="border-top:1px dashed #a7f3d0;padding:12px 16px;background:#d1fae5;text-align:center;">
                      <span style="font-size:12px;color:#065f46;line-height:1.5;">You can now sign in with your registered email address.</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 60px;">
                <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:14px 18px;border-radius:8px;color:#065f46;font-size:12px;line-height:1.6;">
                  Cynert Optical RMS - For Better Optical Care.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background:#0f172a;text-align:center;color:#94a3b8;font-size:11px;">
                © ${new Date().getFullYear()} Cynert Optical. All rights reserved.
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;

  return { html, subject: 'Your Cynert Optical account is now active' };
};

export const buildAccountActivatedEmail = ({ name, email }) =>
  renderAccountActivatedEmail({ name, email });

export const sendAccountActivatedEmail = async ({ to, name, email }) => {
  const { html, subject } = renderAccountActivatedEmail({ name, email });
  return safeSend({ to, subject, html });
};

/* ────────────────────────────────────────────────────────────────── */
/* New order → optician                                               */
/* ────────────────────────────────────────────────────────────────── */
const renderNewOrderForOptician = ({ patient, staffName }) => {
  const html = `
  <!DOCTYPE html>
  <html>
    <head><meta charset="UTF-8" /><title>New Order - Billing Required</title></head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:48px 16px;">
        <tr><td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#f97316 0%,#ea580c 100%);padding:36px 24px;text-align:center;">
                <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">CYNERT OPTICAL</div>
                <div style="font-size:11px;color:#ffedd5;margin-top:8px;letter-spacing:2px;text-transform:uppercase;">Records Management System</div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 0;text-align:center;">
                <h2 style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">New Order - Billing Required</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0;text-align:center;">
                <p style="margin:0;color:#64748b;font-size:14px;line-height:1.7;">
                  A new order from <strong>${esc(staffName || 'staff')}</strong> is waiting for billing on the optician dashboard.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:2px solid #fed7aa;border-radius:16px;overflow:hidden;">
                  <tr>
                    <td style="padding:20px 18px;">
                      <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#9a3412;font-weight:700;margin-bottom:10px;">Patient</div>
                      <div style="font-size:16px;color:#0f172a;font-weight:700;">${esc(patient.name)}</div>
                      <div style="font-size:13px;color:#64748b;margin-top:4px;">System No: ${esc(patient.systemNumber)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="border-top:1px dashed #fed7aa;padding:12px 16px;background:#ffedd5;text-align:center;">
                      <span style="font-size:12px;color:#9a3412;">Open the dashboard to enter the bill.</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 60px;">
                <div style="background:#fff7ed;border-left:4px solid #f97316;padding:14px 18px;border-radius:8px;color:#7c2d12;font-size:12px;line-height:1.6;">
                  Cynert Optical RMS - For Better Optical Care.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background:#0f172a;text-align:center;color:#94a3b8;font-size:11px;">
                © ${new Date().getFullYear()} Cynert Optical. All rights reserved.
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;
  return { html, subject: `New order awaiting billing - ${patient.name}` };
};

export const sendNewOrderToOptician = async ({ to, patient, staffName }) => {
  const { html, subject } = renderNewOrderForOptician({ patient, staffName });
  return safeSend({ to, subject, html });
};

/* ────────────────────────────────────────────────────────────────── */
/* New bill → director                                                */
/* ────────────────────────────────────────────────────────────────── */
const renderBillForDirector = ({ patient, opticianName }) => {
  const b = patient.billing || {};
  const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
  const rows = [
    ['Lenses', money(b.lenses)],
    ['Frame', money(b.frame)],
    ['Fitting', money(b.fitting)],
    ['Case', money(b.caseAmount)],
    ['Fargo', money(b.fargo)],
    ['Total', money(b.total)],
  ];
  const rowsHtml = rows.map(([k, v], i) => `
    <tr>
      <td style="padding:10px 18px;${i === rows.length - 1 ? 'border-top:1px solid #eef2f7;font-weight:700;' : ''}color:#64748b;font-size:13px;">${k}</td>
      <td style="padding:10px 18px;${i === rows.length - 1 ? 'border-top:1px solid #eef2f7;font-weight:800;color:#0f172a;' : 'color:#0f172a;font-weight:600;'}font-size:13px;text-align:right;">${v}</td>
    </tr>`).join('');

  const html = `
  <!DOCTYPE html>
  <html>
    <head><meta charset="UTF-8" /><title>New Bill Submitted</title></head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:48px 16px;">
        <tr><td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%);padding:36px 24px;text-align:center;">
                <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">CYNERT OPTICAL</div>
                <div style="font-size:11px;color:#e0f2fe;margin-top:8px;letter-spacing:2px;text-transform:uppercase;">Records Management System</div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 0;text-align:center;">
                <h2 style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">New Bill Submitted</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0;text-align:center;">
                <p style="margin:0;color:#64748b;font-size:14px;line-height:1.7;">
                  <strong>${esc(opticianName || 'Optician')}</strong> submitted a bill for <strong>${esc(patient.name)}</strong> (${esc(patient.systemNumber)}).
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:16px;overflow:hidden;">
                  ${rowsHtml}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 60px;">
                <div style="background:#eff6ff;border-left:4px solid #0ea5e9;padding:14px 18px;border-radius:8px;color:#1e3a8a;font-size:12px;line-height:1.6;">
                  Cynert Optical RMS - For Better Optical Care.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background:#0f172a;text-align:center;color:#94a3b8;font-size:11px;">
                © ${new Date().getFullYear()} Cynert Optical. All rights reserved.
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;
  return { html, subject: `New bill - ${patient.name}` };
};

export const sendBillToDirector = async ({ to, patient, opticianName }) => {
  const { html, subject } = renderBillForDirector({ patient, opticianName });
  return safeSend({ to, subject, html });
};

/* ────────────────────────────────────────────────────────────────── */
/* Fargo batch email (legacy - kept for backward compatibility)       */
/* ────────────────────────────────────────────────────────────────── */
const renderFargoBatchEmail = ({ batchNumber, opticianName, orders, fargoAmount }) => {
  const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

  const rows = orders.map((p, i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eef2f7;font-size:12px;color:#64748b;">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eef2f7;font-size:12px;color:#0f172a;font-weight:600;">${esc(p.name)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eef2f7;font-size:12px;color:#475569;font-family:monospace;">${esc(p.systemNumber)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eef2f7;font-size:12px;color:#475569;">${esc(p.lensType || '-')}</td>
    </tr>
  `).join('');

  const html = `
  <!DOCTYPE html>
  <html>
    <head><meta charset="UTF-8" /><title>New Optical Bill</title></head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 12px;">
        <tr><td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%);padding:36px 24px;text-align:center;">
                <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">CYNERT OPTICAL</div>
                <div style="font-size:11px;color:#e0f2fe;margin-top:8px;letter-spacing:2px;text-transform:uppercase;">Records Management System</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 0;text-align:center;">
                <h2 style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">New Optical Bill Submitted</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 0;text-align:center;">
                <p style="margin:0;color:#64748b;font-size:14px;line-height:1.7;">
                  <strong>${esc(opticianName || 'Optician')}</strong> submitted a fargo batch <strong>${esc(batchNumber)}</strong> covering <strong>${orders.length}</strong> order(s). Login to see and pay.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 24px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:16px;overflow:hidden;">
                  <tr>
                    <th style="padding:10px 12px;text-align:left;font-size:10px;color:#1e40af;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #dbeafe;">#</th>
                    <th style="padding:10px 12px;text-align:left;font-size:10px;color:#1e40af;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #dbeafe;">Patient</th>
                    <th style="padding:10px 12px;text-align:left;font-size:10px;color:#1e40af;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #dbeafe;">System No.</th>
                    <th style="padding:10px 12px;text-align:left;font-size:10px;color:#1e40af;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #dbeafe;">Lens</th>
                  </tr>
                  ${rows}
                  <tr>
                    <td colspan="3" style="padding:14px 16px;background:#dbeafe;color:#1e3a8a;font-size:13px;font-weight:700;">Fargo Total</td>
                    <td style="padding:14px 16px;background:#dbeafe;color:#1e40af;font-size:15px;font-weight:800;text-align:right;">${money(fargoAmount)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 0;text-align:center;">
                <a href="${env.CLIENT_URL}/director/unpaid"
                   style="display:inline-block;background:linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%);color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:13px;font-weight:700;">
                  Login to Review &amp; Pay
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 52px;">
                <div style="background:#eff6ff;border-left:4px solid #0ea5e9;padding:14px 18px;border-radius:8px;color:#1e3a8a;font-size:12px;line-height:1.6;">
                  Cynert Optical RMS - For Better Optical Care.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background:#0f172a;text-align:center;color:#94a3b8;font-size:11px;">
                © ${new Date().getFullYear()} Cynert Optical. All rights reserved.
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;
  return { html, subject: `New optical bill from ${opticianName || 'optician'} - ${batchNumber}` };
};

export const sendFargoBatchEmail = async ({ to, batchNumber, opticianName, orders, fargoAmount }) => {
  const { html, subject } = renderFargoBatchEmail({ batchNumber, opticianName, orders, fargoAmount });
  return safeSend({ to, subject, html });
};

/* ────────────────────────────────────────────────────────────────── */
/* Billing batch email - role-aware (director vs admin)               */
/* ────────────────────────────────────────────────────────────────── */
const renderBillingBatchEmail = ({
  batchNumber,
  opticianName,
  orders,
  fargoAmount,
  ordersTotal,
  grandTotal,
  recipientRole = 'director',
}) => {
  const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
  const isAdmin = recipientRole === 'admin';

  const introLine = isAdmin
    ? `<strong>${esc(opticianName || 'Optician')}</strong> submitted batch <strong>${esc(batchNumber)}</strong> covering <strong>${orders.length}</strong> order(s). Login to review and pay.`
    : `Hello Dr. E.Njoka, <strong>${esc(opticianName || 'Optician')}</strong> has submitted batch <strong>${esc(batchNumber)}</strong> covering <strong>${orders.length}</strong> order(s). Login to review and pay.`;

  const buttonLabel = isAdmin ? 'Login to Review' : 'Login to Review &amp; Pay';

  const rows = orders.map((p, i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eef2f7;font-size:12px;color:#64748b;">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eef2f7;font-size:12px;color:#0f172a;font-weight:600;">${esc(p.name)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eef2f7;font-size:12px;color:#475569;font-family:monospace;">${esc(p.systemNumber)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eef2f7;font-size:12px;color:#475569;">${esc(p.lensType || '-')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eef2f7;font-size:12px;color:#0f172a;font-weight:600;text-align:right;">${money(p.billing?.total)}</td>
    </tr>
  `).join('');

  const html = `
  <!DOCTYPE html>
  <html>
    <head><meta charset="UTF-8" /><title>New Optical Bill</title></head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 12px;">
        <tr><td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%);padding:36px 24px;text-align:center;">
                <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">CYNERT OPTICAL</div>
                <div style="font-size:11px;color:#e0f2fe;margin-top:8px;letter-spacing:2px;text-transform:uppercase;">Records Management System</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 0;text-align:center;">
                <h2 style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">New Optical Bill Submitted</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 0;text-align:center;">
                <p style="margin:0;color:#64748b;font-size:14px;line-height:1.7;">
                  ${introLine}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 24px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:16px;overflow:hidden;">
                  <tr>
                    <th style="padding:10px 12px;text-align:left;font-size:10px;color:#1e40af;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #dbeafe;">#</th>
                    <th style="padding:10px 12px;text-align:left;font-size:10px;color:#1e40af;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #dbeafe;">Patient</th>
                    <th style="padding:10px 12px;text-align:left;font-size:10px;color:#1e40af;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #dbeafe;">Sys No.</th>
                    <th style="padding:10px 12px;text-align:left;font-size:10px;color:#1e40af;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #dbeafe;">Lens</th>
                    <th style="padding:10px 12px;text-align:right;font-size:10px;color:#1e40af;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #dbeafe;">Amount</th>
                  </tr>
                  ${rows}
                  <tr>
                    <td colspan="4" style="padding:10px 12px;background:#dbeafe;color:#1e3a8a;font-size:12px;font-weight:600;">Orders Subtotal</td>
                    <td style="padding:10px 12px;background:#dbeafe;color:#1e3a8a;font-size:13px;font-weight:700;text-align:right;">${money(ordersTotal)}</td>
                  </tr>
                  <tr>
                    <td colspan="4" style="padding:10px 12px;background:#dbeafe;color:#1e3a8a;font-size:12px;font-weight:600;">Fargo Fee</td>
                    <td style="padding:10px 12px;background:#dbeafe;color:#1e3a8a;font-size:13px;font-weight:700;text-align:right;">${money(fargoAmount)}</td>
                  </tr>
                  <tr>
                    <td colspan="4" style="padding:14px 16px;background:#bfdbfe;color:#1e3a8a;font-size:13px;font-weight:700;">Grand Total</td>
                    <td style="padding:14px 16px;background:#bfdbfe;color:#1e40af;font-size:15px;font-weight:800;text-align:right;">${money(grandTotal)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 0;text-align:center;">
                <a href="${env.CLIENT_URL}/director/unpaid"
                   style="display:inline-block;background:linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%);color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:12px;font-size:13px;font-weight:700;">
                  ${buttonLabel}
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 52px;">
                <div style="background:#eff6ff;border-left:4px solid #0ea5e9;padding:14px 18px;border-radius:8px;color:#1e3a8a;font-size:12px;line-height:1.6;">
                  Cynert Optical RMS - For Better Optical Care.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background:#0f172a;text-align:center;color:#94a3b8;font-size:11px;">
                © ${new Date().getFullYear()} Cynert Optical. All rights reserved.
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;
  return { html, subject: `New optical bill from ${opticianName || 'optician'} - ${batchNumber}` };
};

export const sendBillingBatchEmail = async ({
  to,
  batchNumber,
  opticianName,
  orders,
  fargoAmount,
  ordersTotal,
  grandTotal,
  recipientRole = 'director',
}) => {
  const { html, subject } = renderBillingBatchEmail({
    batchNumber,
    opticianName,
    orders,
    fargoAmount,
    ordersTotal,
    grandTotal,
    recipientRole,
  });
  return safeSend({ to, subject, html });
};

/* ────────────────────────────────────────────────────────────────── */
/* Domain MX validator - call at boot to catch typo'd env emails     */
/* ────────────────────────────────────────────────────────────────── */
export const validateEmailDomain = async (email) => {
  const domain = String(email || '').split('@')[1];
  if (!domain) return { ok: false, reason: 'no domain' };
  try {
    const mx = await dns.resolveMx(domain);
    if (!mx || mx.length === 0) return { ok: false, reason: 'no MX records' };
    return { ok: true, mx };
  } catch (e) {
    return { ok: false, reason: e.code || e.message };
  }
};