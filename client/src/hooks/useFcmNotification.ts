"use client";

import { useEffect, useState, useCallback } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { getMessagingInstance } from "@/lib/firebase";
import api from "@/lib/api";
import { toast } from "@/lib/toast";

export function useFcmNotification() {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);

  // Register token with TeFFe backend
  const sendTokenToBackend = useCallback(async (token: string) => {
    try {
      await api.post("/notifications/register-token", {
        fcmToken: token,
        deviceType: "web",
        appType: "website",
        deviceInfo: {
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "browser",
        },
      });
      console.log("[FCM Web] Token registered with TeFFe backend");
    } catch (err) {
      console.warn("[FCM Web] Failed to register token with backend:", err);
    }
  }, []);

  // Request browser permission and obtain FCM token
  const requestPermissionAndGetToken = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      console.warn("[FCM Web] Notifications are not supported in this browser.");
      return null;
    }

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        console.log("[FCM Web] Notification permission was denied or dismissed.");
        setLoading(false);
        return null;
      }

      // Register service worker if supported
      let registration: ServiceWorkerRegistration | undefined;
      if ("serviceWorker" in navigator) {
        registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        await navigator.serviceWorker.ready;
      }

      const messaging = await getMessagingInstance();
      if (!messaging) {
        setLoading(false);
        return null;
      }

      const vapidKey =
        process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
        "BDkxWHJSSn5QjQvexfW-oM5pat0w38zlXfM15p9Utae6helu1pzYkXkOLvzkFpUP4jrgOqmZ7xfdJRBc-O63-Pk";

      const currentToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (currentToken) {
        setFcmToken(currentToken);
        await sendTokenToBackend(currentToken);
        setLoading(false);
        return currentToken;
      } else {
        console.warn("[FCM Web] No registration token available.");
      }
    } catch (error) {
      console.error("[FCM Web] An error occurred while retrieving token:", error);
    }

    setLoading(false);
    return null;
  }, [sendTokenToBackend]);

  // Initial check & foreground message listener
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    setPermission(Notification.permission);

    // If permission was already granted previously, automatically refresh and sync token
    if (Notification.permission === "granted") {
      requestPermissionAndGetToken();
    }

    let unsubscribe: (() => void) | undefined;

    getMessagingInstance().then((messaging) => {
      if (messaging) {
        unsubscribe = onMessage(messaging, (payload) => {
          console.log("[FCM Web Foreground Message]", payload);
          const title = payload.notification?.title || "TeFFe's Fresh Alert";
          const body = payload.notification?.body || "";

          // Show in-app toast notification
          toast.info(body, title);
        });
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [requestPermissionAndGetToken]);

  return {
    fcmToken,
    permission,
    loading,
    requestPermissionAndGetToken,
  };
}
