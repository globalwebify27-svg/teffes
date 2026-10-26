import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getMessaging, isSupported, Messaging } from "firebase/messaging";
import { getAuth, Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBBdxXGS7vOEYuvnXklCHTZgB7xwsrK46M",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "teffes-app.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "teffes-app",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "teffes-app.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "616507977462",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:616507977462:web:e426a3d2c54a9ec221c6d7",
};

// Initialize Firebase singleton
export const firebaseApp: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let messagingInstance: Messaging | null = null;

export const getMessagingInstance = async (): Promise<Messaging | null> => {
  if (typeof window === "undefined") return null;

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn("[FCM Web] Firebase Messaging is not supported in this browser.");
      return null;
    }

    if (!messagingInstance) {
      messagingInstance = getMessaging(firebaseApp);
    }
    return messagingInstance;
  } catch (error) {
    console.warn("[FCM Web] Failed to initialize Firebase Messaging:", error);
    return null;
  }
};

export const getFirebaseAuth = (): Auth => {
  return getAuth(firebaseApp);
};
