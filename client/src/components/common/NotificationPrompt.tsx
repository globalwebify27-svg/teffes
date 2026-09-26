"use client";

import React, { useState, useEffect } from "react";
import { useFcmNotification } from "@/hooks/useFcmNotification";

export default function NotificationPrompt() {
  const { permission, loading, requestPermissionAndGetToken } = useFcmNotification();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Only show if browser supports notifications, user hasn't made a choice yet, and hasn't dismissed this session
    if (typeof window !== "undefined" && "Notification" in window) {
      const isDismissed = sessionStorage.getItem("teffes_fcm_prompt_dismissed");
      if (Notification.permission === "default" && !isDismissed) {
        const timer = setTimeout(() => setDismissed(false), 2500);
        return () => clearTimeout(timer);
      }
    }
  }, [permission]);

  if (dismissed || permission !== "default") return null;

  const handleEnable = async () => {
    await requestPermissionAndGetToken();
    setDismissed(true);
  };

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("teffes_fcm_prompt_dismissed", "true");
    }
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-5 left-5 z-50 max-w-sm bg-white border border-gray-200/90 rounded-2xl shadow-2xl p-4 transition-all duration-300 animate-slide-up flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-primary">
          <span className="material-symbols-outlined text-[22px]">notifications_active</span>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-gray-900 leading-tight">Enable Live Order Tracking</h4>
          <p className="text-xs text-gray-500 mt-1 leading-snug">
            Receive instant alerts when the butcher starts cutting and when your rider is approaching.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 text-sm leading-none p-1"
          title="Dismiss"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
        <button
          onClick={handleDismiss}
          className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Maybe Later
        </button>
        <button
          onClick={handleEnable}
          disabled={loading}
          className="px-4 py-1.5 text-xs font-bold text-white bg-primary hover:bg-primary-dark rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading ? "Enabling…" : "Enable Alerts"}
        </button>
      </div>
    </div>
  );
}
