const nodemailer = require('nodemailer');

/**
 * Creates and returns a Nodemailer transporter configured with environment credentials.
 */
const getTransporter = () => {
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  const host = process.env.SMTP_HOST;
  if (host) {
    return nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: Number(process.env.SMTP_PORT) === 465 || true,
      auth: { user, pass },
    });
  }

  // Default to standard Gmail service
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
};

/**
 * Sends a password reset OTP email to the Super Admin.
 *
 * @param {string} toEmail - Recipient email address
 * @param {string} otpCode - 6-digit numeric OTP code
 * @param {string} [recipientName='Super Admin'] - Name of recipient
 * @returns {Promise<{ success: boolean, simulated?: boolean, error?: string }>}
 */
const sendPasswordResetEmail = async (toEmail, otpCode, recipientName = 'Super Admin') => {
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const transporter = getTransporter();

  if (!transporter) {
    console.warn(`\n======================================================`);
    console.warn(`[EMAIL SERVICE] Simulation Mode (SMTP credentials not yet configured)`);
    console.warn(`Recipient: ${toEmail}`);
    console.warn(`Reset OTP Code: ${otpCode}`);
    console.warn(`Valid for: 15 minutes`);
    console.warn(`Tip: To send real emails, set EMAIL_USER and EMAIL_PASS in server/.env`);
    console.warn(`======================================================\n`);
    return { success: true, simulated: true, otp: otpCode };
  }

  const mailOptions = {
    from: `"TeFFe's Admin Security" <${user}>`,
    to: toEmail,
    subject: `TeFFe's Super Admin Password Reset Code: ${otpCode}`,
    text: `Hello ${recipientName},\n\nYou requested a password reset for your TeFFe's Super Admin account.\n\nYour 6-digit verification code is: ${otpCode}\n\nThis code will expire in 15 minutes. If you did not make this request, please ignore this email or contact security immediately.\n\nBest regards,\nTeFFe's Security Team`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background: #800020; padding: 28px 24px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px; }
          .content { padding: 32px 28px; }
          .otp-box { background: #fff1f2; border: 2px dashed #fda4af; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
          .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #9f1239; margin: 0; }
          .expiry { font-size: 12px; color: #64748b; margin-top: 8px; }
          .footer { padding: 20px 28px; background: #f1f5f9; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>TeFFe's Fresh</h1>
          </div>
          <div class="content">
            <h2 style="margin-top: 0; font-size: 18px; color: #0f172a;">Super Admin Password Reset</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #334155;">Hello <strong>${recipientName}</strong>,</p>
            <p style="font-size: 14px; line-height: 1.6; color: #334155;">
              A request was made to reset the password for your TeFFe's Super Admin account (<code>${toEmail}</code>). Use the verification code below to proceed:
            </p>
            <div class="otp-box">
              <div class="otp-code">${otpCode}</div>
              <div class="expiry">Valid for 15 minutes only</div>
            </div>
            <p style="font-size: 13px; line-height: 1.5; color: #64748b;">
              If you did not request this password reset, please disregard this email or verify your account security.
            </p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} TeFFe's. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SERVICE] Password reset email sent successfully to ${toEmail}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EMAIL SERVICE ERROR] Failed to send email to ${toEmail}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPasswordResetEmail,
};
