/**
 * Validates that all required environment variables are set.
 * Call this once at server startup before anything else.
 */
const REQUIRED_ENV = [
  'MONGO_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

const validateEnv = () => {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`\n❌ Missing required environment variables:\n  ${missing.join('\n  ')}`);
    console.error('\nCopy .env.example → server/.env and fill in the values.\n');
    process.exit(1);
  }
};

module.exports = { validateEnv };
