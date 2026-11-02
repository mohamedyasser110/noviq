/* ============================================================
   NOVIQ MAILER — optional SMTP notifications
   ------------------------------------------------------------
   Sends an email to NOTIFY_EMAIL when a new lead arrives.
   Disabled unless SMTP_HOST is configured (safe no-op default).
   Uses nodemailer if installed; never crashes the request.
   ============================================================ */

const config = require('./config');

let transporter = null;
let initialized = false;

function getTransporter() {
  if (initialized) return transporter;
  initialized = true;

  if (!process.env.SMTP_HOST) return null;
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    console.warn('[Mailer] SMTP_HOST set but nodemailer is not installed. Run: npm install nodemailer');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
  });
  console.log('[Mailer] SMTP notifications enabled →', process.env.NOTIFY_EMAIL || process.env.SMTP_USER);
  return transporter;
}

/* Fire-and-forget: notify admin about a new lead. Never throws. */
function notifyNewLead(kind, details) {
  const t = getTransporter();
  if (!t) return;
  const to = process.env.NOTIFY_EMAIL || process.env.SMTP_USER;
  if (!to) return;

  const lines = Object.entries(details || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `[Noviq] New ${kind}`,
    text: `You have a new ${kind}:\n\n${lines}\n\n— Noviq backend`,
  }).catch(err => console.warn('[Mailer] Send failed:', err.message));
}

/* Direct mail to a specific recipient. Resolves false when SMTP is not configured. */
async function sendMail(to, subject, text) {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text });
    return true;
  } catch (err) {
    console.warn('[Mailer] Send failed:', err.message);
    return false;
  }
}

module.exports = { notifyNewLead, sendMail };
