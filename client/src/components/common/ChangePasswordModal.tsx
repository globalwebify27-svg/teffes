"use client";

import React, { useState } from "react";
import api from "@/lib/api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLock,
  faEye,
  faEyeSlash,
  faCheckCircle,
  faTimes,
  faExclamationCircle,
} from "@fortawesome/free-solid-svg-icons";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
}

export default function ChangePasswordModal({
  isOpen,
  onClose,
  userEmail,
  userName,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (loading) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!currentPassword.trim()) {
      setError("Please enter your current password");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError("New password must be at least 6 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from current password");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/change-password", {
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      });

      if (res.data?.success) {
        setSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 1600);
      } else {
        setError(res.data?.message || "Failed to change password");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Failed to update password. Please verify your current password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "18px",
          width: "100%",
          maxWidth: "440px",
          boxShadow: "0 20px 45px rgba(0,0,0,0.2)",
          border: "1px solid #ede8e0",
          overflow: "hidden",
          position: "relative",
          animation: "scaleIn 0.2s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #f1ece4",
            background: "#faf8f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "rgba(148, 23, 23, 0.1)",
                color: "#941717",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.1rem",
              }}
            >
              <FontAwesomeIcon icon={faLock} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: "#171410",
                }}
              >
                Change Password
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.78rem",
                  color: "#73695b",
                  marginTop: "2px",
                }}
              >
                {userEmail || userName || "Update your account security"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            style={{
              background: "transparent",
              border: "none",
              color: "#998f82",
              cursor: "pointer",
              fontSize: "1.1rem",
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px" }}>
          {success ? (
            <div
              style={{
                textAlign: "center",
                padding: "24px 0",
              }}
            >
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "#dcfce7",
                  color: "#15803d",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2rem",
                  margin: "0 auto 16px auto",
                }}
              >
                <FontAwesomeIcon icon={faCheckCircle} />
              </div>
              <h4
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "1.15rem",
                  fontWeight: 800,
                  color: "#14532d",
                }}
              >
                Password Updated!
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.85rem",
                  color: "#15803d",
                }}
              >
                Your account password has been changed successfully.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    color: "#991b1b",
                    fontSize: "0.82rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "16px",
                  }}
                >
                  <FontAwesomeIcon icon={faExclamationCircle} />
                  <span>{error}</span>
                </div>
              )}

              {/* Current Password */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "#423b32",
                    marginBottom: "6px",
                  }}
                >
                  Current Password *
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter existing password"
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: "11px 40px 11px 14px",
                      borderRadius: "10px",
                      border: "1px solid #d1cbbf",
                      fontSize: "0.875rem",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#8c8275",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <FontAwesomeIcon icon={showCurrent ? faEyeSlash : faEye} />
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "#423b32",
                    marginBottom: "6px",
                  }}
                >
                  New Password *
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: "11px 40px 11px 14px",
                      borderRadius: "10px",
                      border: "1px solid #d1cbbf",
                      fontSize: "0.875rem",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#8c8275",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <FontAwesomeIcon icon={showNew ? faEyeSlash : faEye} />
                  </button>
                </div>
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "#8c8275",
                    marginTop: "4px",
                    display: "block",
                  }}
                >
                  Minimum 6 characters with a combination of letters &amp; numbers recommended.
                </span>
              </div>

              {/* Confirm New Password */}
              <div style={{ marginBottom: "22px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "#423b32",
                    marginBottom: "6px",
                  }}
                >
                  Confirm New Password *
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: "11px 40px 11px 14px",
                      borderRadius: "10px",
                      border: "1px solid #d1cbbf",
                      fontSize: "0.875rem",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#8c8275",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <FontAwesomeIcon icon={showConfirm ? faEyeSlash : faEye} />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "10px",
                    background: "#f3f0ea",
                    color: "#423b32",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: "10px 22px",
                    borderRadius: "10px",
                    background: loading ? "#7f1d1d" : "#941717",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 800,
                    fontSize: "0.85rem",
                    cursor: loading ? "wait" : "pointer",
                    boxShadow: "0 2px 8px rgba(148, 23, 23, 0.25)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
