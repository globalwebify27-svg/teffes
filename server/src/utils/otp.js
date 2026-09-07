/**
 * OTP Generator & Sender
 *
 * ─── How it works ────────────────────────────────────────────────────────────
 *  Development (OTP_USE_SMS=false):
 *    OTP is printed to the server console — no SMS is sent.
 *    The OTP is also returned in the API response body for easy testing.
 *
 *  Production (OTP_USE_SMS=true):
 *    OTP is sent via Twilio SMS.
 *    Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in .env
 *
 * ─── Setting up Twilio (free) ────────────────────────────────────────────────
 *  1. Sign up at https://www.twilio.com/try-twilio  (no credit card needed)
 *  2. Go to Console → copy Account SID + Auth Token
 *  3. Go to Phone Numbers → Get a free trial number
 *  4. Add those 3 values to server/.env
 *  5. Set OTP_USE_SMS=true in server/.env
 *
 *  Note: Twilio trial accounts can only send SMS to verified numbers.
 *  To verify a number: Console → Phone Numbers → Verified Caller IDs → Add New
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Generate a cryptographically random 6-digit OTP.
 */
const generateOTP = () => {
  // Use crypto for better randomness than Math.random()
  const { randomInt } = require('crypto');
  return randomInt(100000, 999999).toString();
};

/**
 * Send OTP to a phone number.
 *
 * @param {string} phone - E.164 format, e.g. "+919876543210"
 * @param {string} otp   - 6-digit OTP string
 */
const sendOTP = async (phone, otp) => {
  const useSMS = process.env.OTP_USE_SMS === 'true';
  const expiresMin = process.env.OTP_EXPIRES_MINUTES || '10';

  if (useSMS) {
    // ─── Production: Twilio SMS ─────────────────────────────────────────────
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error(
        'Twilio is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, ' +
        'and TWILIO_PHONE_NUMBER to server/.env'
      );
    }

    const twilio = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    await twilio.messages.create({
      body: `Your Teffes OTP is: ${otp}\nValid for ${expiresMin} minutes. Do not share this code with anyone.`,
      from: TWILIO_PHONE_NUMBER,
      to: phone,
    });

    console.log(`📱 SMS sent to ${phone}`);

  } else {
    // ─── Development: Console log ───────────────────────────────────────────
    const line = '─'.repeat(43);
    console.log(`\n┌${line}┐`);
    console.log(`│  📱 OTP for ${phone.padEnd(28)}│`);
    console.log(`│  🔑 Code    : ${otp}                         │`);
    console.log(`│  ⏱️  Expires : ${expiresMin} minutes                   │`);
    console.log(`└${line}┘\n`);
  }
};

/**
 * Get OTP expiry Date object.
 */
const getOTPExpiry = () => {
  const minutes = parseInt(process.env.OTP_EXPIRES_MINUTES || '10', 10);
  return new Date(Date.now() + minutes * 60 * 1000);
};

module.exports = { generateOTP, sendOTP, getOTPExpiry };
