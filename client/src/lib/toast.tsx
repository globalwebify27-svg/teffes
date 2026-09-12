"use client";

import React, { useState, useEffect } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "primary" | "warning";
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

type ToastListener = (toasts: ToastItem[]) => void;
type ConfirmListener = (options: ConfirmDialogOptions | null) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private toastListeners: Set<ToastListener> = new Set();
  private confirmListener: ConfirmListener | null = null;

  subscribeToasts(listener: ToastListener) {
    this.toastListeners.add(listener);
    listener(this.toasts);
    return () => {
      this.toastListeners.delete(listener);
    };
  }

  subscribeConfirm(listener: ConfirmListener) {
    this.confirmListener = listener;
    return () => {
      if (this.confirmListener === listener) {
        this.confirmListener = null;
      }
    };
  }

  private notify() {
    this.toastListeners.forEach((l) => l([...this.toasts]));
  }

  show(message: string, type: ToastType = "info", title?: string, duration: number = 4000) {
    const id = Math.random().toString(36).substring(2, 9);
    const item: ToastItem = { id, type, title, message, duration };
    this.toasts = [...this.toasts, item];
    this.notify();

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }
    return id;
  }

  success(message: string, title?: string, duration?: number) {
    return this.show(message, "success", title || "Success", duration);
  }

  error(message: string, title?: string, duration?: number) {
    return this.show(message, "error", title || "Error", duration || 5000);
  }

  warning(message: string, title?: string, duration?: number) {
    return this.show(message, "warning", title || "Attention", duration);
  }

  info(message: string, title?: string, duration?: number) {
    return this.show(message, "info", title || "Notice", duration);
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  confirm(options: ConfirmDialogOptions) {
    if (this.confirmListener) {
      this.confirmListener(options);
    } else {
      if (typeof window !== "undefined") {
        if (window.confirm(options.message)) {
          options.onConfirm();
        } else if (options.onCancel) {
          options.onCancel();
        }
      }
    }
  }

  closeConfirm() {
    if (this.confirmListener) {
      this.confirmListener(null);
    }
  }
}

export const toast = new ToastManager();

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);

  useEffect(() => {
    const unsubToasts = toast.subscribeToasts(setToasts);
    const unsubConfirm = toast.subscribeConfirm(setConfirmDialog);

    // Override native browser alert to prevent raw browser alerts
    const originalAlert = window.alert;
    window.alert = (message?: any) => {
      const str = String(message || "");
      if (str.toLowerCase().includes("fail") || str.toLowerCase().includes("error")) {
        toast.error(str);
      } else if (str.toLowerCase().includes("success") || str.toLowerCase().includes("added")) {
        toast.success(str);
      } else if (str.toLowerCase().includes("please") || str.toLowerCase().includes("enter") || str.toLowerCase().includes("valid")) {
        toast.warning(str);
      } else {
        toast.info(str);
      }
    };

    return () => {
      unsubToasts();
      unsubConfirm();
      window.alert = originalAlert;
    };
  }, []);

  return (
    <>
      {/* Toast Notification Stack */}
      <div
        aria-live="polite"
        className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => {
          const isSuccess = t.type === "success";
          const isError = t.type === "error";
          const isWarning = t.type === "warning";
          const isInfo = t.type === "info";

          const borderCol = isSuccess
            ? "border-emerald-500/30"
            : isError
            ? "border-crimson-bright/30"
            : isWarning
            ? "border-amber-500/30"
            : "border-primary/30";

          const iconBg = isSuccess
            ? "bg-emerald-50 text-emerald-600"
            : isError
            ? "bg-rose-50 text-crimson-bright"
            : isWarning
            ? "bg-amber-50 text-amber-600"
            : "bg-primary/10 text-primary";

          const iconName = isSuccess
            ? "check_circle"
            : isError
            ? "error"
            : isWarning
            ? "warning"
            : "notifications";

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3.5 p-4 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border ${borderCol} transition-all duration-300 animate-in slide-in-from-top-4 fade-in`}
              style={{
                boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.12), 0 4px 10px -2px rgba(0, 0, 0, 0.05)",
              }}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                <span className="material-symbols-outlined text-[20px] filled">{iconName}</span>
              </div>
              <div className="flex-1 pt-0.5 min-w-0">
                {t.title && (
                  <h4 className="font-bold text-[13.5px] text-gray-900 leading-tight mb-0.5">
                    {t.title}
                  </h4>
                )}
                <p className="text-[12.5px] text-gray-600 leading-relaxed break-words">
                  {t.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="text-gray-400 hover:text-gray-700 rounded-lg p-1 transition-colors shrink-0 -mr-1 -mt-1 cursor-pointer bg-transparent border-none"
                aria-label="Close notification"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3.5 mb-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                  confirmDialog.type === "danger"
                    ? "bg-rose-50 text-crimson-bright"
                    : "bg-primary/10 text-primary"
                }`}
              >
                <span className="material-symbols-outlined text-[24px]">
                  {confirmDialog.type === "danger" ? "delete_forever" : "help"}
                </span>
              </div>
              <h3 className="font-headline-sm font-extrabold text-gray-900 text-lg">
                {confirmDialog.title || "Confirm Action"}
              </h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-6 pl-0.5 whitespace-pre-line">
              {confirmDialog.message}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (confirmDialog.onCancel) confirmDialog.onCancel();
                  setConfirmDialog(null);
                }}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors cursor-pointer"
              >
                {confirmDialog.cancelText || "Cancel"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const onConfirm = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await onConfirm();
                }}
                className={`px-5 py-2.5 rounded-xl text-white font-bold text-sm transition-all shadow-md cursor-pointer border-none ${
                  confirmDialog.type === "danger"
                    ? "bg-crimson-bright hover:bg-red-700 shadow-crimson-soft"
                    : "bg-primary hover:bg-primary-dark shadow-primary/20"
                }`}
              >
                {confirmDialog.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
