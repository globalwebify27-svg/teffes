"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

interface PopupData {
  id?: string;
  _id?: string;
  title: string;
  subtitle?: string;
  message?: string;
  imageUrl?: string;
  ctaText?: string;
  ctaLink?: string;
  couponCode?: string;
  targetAudience?: string;
  frequency?: "ONCE_PER_DAY" | "ONCE_PER_SESSION" | "ALWAYS";
  priority?: number;
}

export default function PromotionalPopupModal() {
  const router = useRouter();
  const [activePopup, setActivePopup] = useState<PopupData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    const fetchAndCheckPopup = async () => {
      try {
        const storedUser = getStoredUser();
        const userTier = storedUser?.tier || "BRONZE";
        const isLoggedIn = Boolean(storedUser);

        const res = await api.get<{ success: boolean; popups: PopupData[] }>(
          `/popups/active?tier=${encodeURIComponent(userTier)}&isLoggedIn=${isLoggedIn}`
        );

        if (!res.data?.success || !Array.isArray(res.data.popups) || res.data.popups.length === 0) {
          return;
        }

        const todayKey = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

        // Find the first eligible popup that hasn't been dismissed by frequency rule
        for (const popup of res.data.popups) {
          const popupId = popup._id || popup.id;
          if (!popupId) continue;

          if (popup.frequency === "ONCE_PER_DAY") {
            const dismissedDate = localStorage.getItem(`teffes_popup_dismissed_${popupId}`);
            if (dismissedDate === todayKey) {
              continue; // Skip, already seen today
            }
          } else if (popup.frequency === "ONCE_PER_SESSION") {
            const dismissedSession = sessionStorage.getItem(`teffes_popup_session_${popupId}`);
            if (dismissedSession) {
              continue; // Skip, already seen in this session
            }
          }

          // Found an eligible popup
          setActivePopup(popup);
          // Show with a small delay for smooth page entrance
          setTimeout(() => {
            setIsOpen(true);
          }, 800);
          break;
        }
      } catch (err) {
        // Silent catch: modal failure should never block page rendering
        console.debug("No active popup loaded:", err);
      }
    };

    fetchAndCheckPopup();
  }, []);

  const handleDismiss = () => {
    if (!activePopup) return;
    const popupId = activePopup._id || activePopup.id;

    if (popupId) {
      if (dontShowAgain || activePopup.frequency === "ONCE_PER_DAY") {
        const todayKey = new Date().toISOString().split("T")[0];
        localStorage.setItem(`teffes_popup_dismissed_${popupId}`, todayKey);
      }
      sessionStorage.setItem(`teffes_popup_session_${popupId}`, "dismissed");
    }

    setIsOpen(false);
  };

  const handleCtaClick = () => {
    if (!activePopup) return;
    handleDismiss();

    const targetUrl = activePopup.ctaLink || "/categories";
    if (targetUrl.startsWith("http")) {
      window.open(targetUrl, "_blank");
    } else {
      router.push(targetUrl);
    }
  };

  const handleCopyCoupon = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activePopup?.couponCode) return;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(activePopup.couponCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  if (!isOpen || !activePopup) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        animation: "fadeIn 200ms ease-out",
      }}
      onClick={handleDismiss}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "460px",
          background: "#ffffff",
          borderRadius: "22px",
          overflow: "hidden",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.15)",
          display: "flex",
          flexDirection: "column",
          transform: "translateY(0) scale(1)",
          transition: "all 250ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Close Button */}
        <button
          onClick={handleDismiss}
          aria-label="Close Announcement"
          style={{
            position: "absolute",
            top: "14px",
            right: "14px",
            zIndex: 10,
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            background: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(4px)",
            color: "#ffffff",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 150ms ease",
          }}
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        {/* Hero Image Section */}
        {activePopup.imageUrl && (
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "220px",
              background: "#181412",
              overflow: "hidden",
            }}
          >
            <img
              src={activePopup.imageUrl}
              alt={activePopup.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            {/* Subtle Gradient Shadow into text */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.4) 100%)",
                pointerEvents: "none",
              }}
            />
          </div>
        )}

        {/* Content Section */}
        <div style={{ padding: "24px 22px 20px 22px", textAlign: "center" }}>
          {/* Main Title */}
          <h2
            style={{
              margin: 0,
              fontSize: "1.25rem",
              fontWeight: 800,
              color: "#171410",
              fontFamily: "Outfit, sans-serif",
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
            }}
          >
            {activePopup.title}
          </h2>

          {/* Subtitle / Tagline */}
          {activePopup.subtitle && (
            <div
              style={{
                marginTop: "6px",
                fontSize: "0.875rem",
                fontWeight: 700,
                color: "#941717",
                lineHeight: 1.3,
              }}
            >
              {activePopup.subtitle}
            </div>
          )}

          {/* Body Message */}
          {activePopup.message && (
            <p
              style={{
                margin: "10px 0 0 0",
                fontSize: "0.825rem",
                color: "#574e43",
                lineHeight: 1.5,
              }}
            >
              {activePopup.message}
            </p>
          )}

          {/* Optional Coupon Code Voucher Card */}
          {activePopup.couponCode && (
            <div
              onClick={handleCopyCoupon}
              title="Click to copy coupon code"
              style={{
                marginTop: "16px",
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 18px",
                background: copiedCode ? "#ecfdf5" : "#fef3c7",
                border: `1.5px dashed ${copiedCode ? "#10b981" : "#d97706"}`,
                borderRadius: "10px",
                cursor: "pointer",
                transition: "all 150ms ease",
                userSelect: "none",
              }}
            >
              <span className="material-symbols-outlined text-[18px]" style={{ color: copiedCode ? "#059669" : "#d97706" }}>
                {copiedCode ? "check_circle" : "confirmation_number"}
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  color: copiedCode ? "#065f46" : "#92400e",
                  letterSpacing: "0.04em",
                }}
              >
                {activePopup.couponCode}
              </span>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: copiedCode ? "#059669" : "#b45309",
                  background: copiedCode ? "#d1fae5" : "#fde68a",
                  padding: "2px 6px",
                  borderRadius: "4px",
                }}
              >
                {copiedCode ? "COPIED" : "COPY"}
              </span>
            </div>
          )}

          {/* Primary CTA Button */}
          <div style={{ marginTop: "20px" }}>
            <button
              type="button"
              onClick={handleCtaClick}
              style={{
                width: "100%",
                padding: "13px 20px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #941717 0%, #7f1d1d 100%)",
                color: "#ffffff",
                fontSize: "0.95rem",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 8px 18px rgba(148, 23, 23, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "transform 150ms ease, box-shadow 150ms ease",
              }}
            >
              <span>{activePopup.ctaText || "Shop Now"}</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>

          {/* Don't show again today checkbox */}
          <div
            style={{
              marginTop: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              fontSize: "0.75rem",
              color: "#8c8275",
            }}
          >
            <input
              type="checkbox"
              id="dontShowAgainModal"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{ width: "14px", height: "14px", accentColor: "#941717", cursor: "pointer" }}
            />
            <label htmlFor="dontShowAgainModal" style={{ cursor: "pointer", userSelect: "none" }}>
              Don't show this announcement again today
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
