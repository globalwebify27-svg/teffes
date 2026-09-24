const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');
const fs = require('fs');

let firebaseApp = null;
let messagingInstance = null;
let authInstance = null;

const initFirebase = () => {
  if (firebaseApp) return firebaseApp;

  try {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      firebaseApp = existingApps[0];
      messagingInstance = getMessaging(firebaseApp);
      authInstance = getAuth(firebaseApp);
      return firebaseApp;
    }

    // 1. Check for raw JSON string in environment variable (Render / Cloud deployment)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        firebaseApp = initializeApp({
          credential: cert(serviceAccount),
        });
        messagingInstance = getMessaging(firebaseApp);
        authInstance = getAuth(firebaseApp);
        console.log(`[Firebase Admin] Initialized from FIREBASE_SERVICE_ACCOUNT_JSON (Project: ${serviceAccount.project_id})`);
        return firebaseApp;
      } catch (parseErr) {
        console.error('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', parseErr.message);
      }
    }

    // 2. Check for explicit path in environment variable
    let serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (serviceAccountPath && !path.isAbsolute(serviceAccountPath)) {
      // Resolve relative to server root
      serviceAccountPath = path.resolve(__dirname, '../../', serviceAccountPath);
    }

    // 2. Fallback to scanning server/config directory if not specified or file not found
    if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
      const configDir = path.resolve(__dirname, '../../config');
      if (fs.existsSync(configDir)) {
        const files = fs.readdirSync(configDir);
        const credFile = files.find(
          (f) => f.includes('firebase-adminsdk') || f.includes('serviceAccount') || f.endsWith('.json')
        );
        if (credFile) {
          serviceAccountPath = path.join(configDir, credFile);
        }
      }
    }

    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      firebaseApp = initializeApp({
        credential: cert(serviceAccount),
      });
      messagingInstance = getMessaging(firebaseApp);
      authInstance = getAuth(firebaseApp);
      console.log(`[Firebase Admin] Initialized successfully using ${path.basename(serviceAccountPath)} (Project: ${serviceAccount.project_id})`);
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      // Direct env variables fallback for serverless/container deployments
      firebaseApp = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
      });
      messagingInstance = getMessaging(firebaseApp);
      authInstance = getAuth(firebaseApp);
      console.log(`[Firebase Admin] Initialized from environment variables (Project: ${process.env.FIREBASE_PROJECT_ID})`);
    } else {
      console.warn('[Firebase Admin] Warning: No service account key found. Push notifications and Auth verification will run in simulation mode.');
    }
  } catch (error) {
    console.error('[Firebase Admin] Initialization failed:', error.message);
  }

  return firebaseApp;
};

// Initialize on module load
initFirebase();

const getMessagingInstance = () => {
  if (!messagingInstance) {
    initFirebase();
  }
  return messagingInstance;
};

const getAuthInstance = () => {
  if (!authInstance) {
    initFirebase();
  }
  return authInstance;
};

const isFirebaseReady = () => {
  return !!firebaseApp;
};

module.exports = {
  initFirebase,
  getMessagingInstance,
  getAuthInstance,
  isFirebaseReady,
};
