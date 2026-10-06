"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin, forgotPassword, resetPassword } from "@/lib/auth";
import { AxiosError } from "axios";

export default function AdminLoginForm() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<"email" | "otp" | "success">("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotInfo, setForgotInfo] = useState("");
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await adminLogin(form.email, form.password);
      const role = result.user?.role;
      if (role === "superadmin" || role === "admin") {
        router.push("/super-admin");
      } else if (role === "storeadmin") {
        router.push("/store-admin");
      } else if (role === "rider") {
        setError("Rider accounts access deliveries via the Teffes Rider Mobile App.");
      } else {
        router.push("/dashboard");
      }
      return;
    } catch (err) {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.message || "Invalid email or password"
          : "Something went wrong. Please check your credentials and try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const openForgotModal = () => {
    setForgotEmail(form.email || "");
    setForgotOtp("");
    setForgotNewPassword("");
    setForgotConfirmPassword("");
    setForgotError("");
    setForgotInfo("");
    setForgotStep("email");
    setShowForgotModal(true);
  };

  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError("Please enter your Super Admin email address.");
      return;
    }
    setForgotError("");
    setForgotLoading(true);
    try {
      const res = await forgotPassword(forgotEmail.trim().toLowerCase());
      setForgotInfo(res.message);
      if (res.devOtp) {
        setForgotOtp(res.devOtp);
      }
      setForgotStep("otp");
    } catch (err) {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.message || "Failed to send verification code"
          : "Unable to reach server. Please check your connection.";
      setForgotError(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp.trim() || forgotOtp.trim().length !== 6) {
      setForgotError("Please enter the complete 6-digit verification code.");
      return;
    }
    if (forgotNewPassword.length < 8) {
      setForgotError("New password must be at least 8 characters long.");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError("Passwords do not match. Please verify both fields.");
      return;
    }
    setForgotError("");
    setForgotLoading(true);
    try {
      await resetPassword(forgotEmail.trim().toLowerCase(), forgotOtp.trim(), forgotNewPassword);
      setForgotStep("success");
    } catch (err) {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.message || "Failed to reset password"
          : "Unable to reset password. Please check your code.";
      setForgotError(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const canSubmit = form.email.trim() && form.password.length >= 6;

  return (
    <>
      <form onSubmit={handleSubmit} noValidate id="admin-login-form">
        {/* Email */}
        <div className="form-group mb-4">
          <label htmlFor="admin-email" className="form-label">
            Admin Email
          </label>
          <div className="relative flex items-center">
            <input
              id="admin-email"
              name="email"
              type="email"
              className="form-input"
              style={{ paddingLeft: "42px" }}
              placeholder="admin@teffes.com"
              value={form.email}
              onChange={handleChange}
              required
              autoFocus
              autoComplete="email"
              suppressHydrationWarning
            />
          </div>
        </div>

        {/* Password */}
        <div className="form-group mb-4">
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="admin-password" className="form-label mb-0">
              Password
            </label>
            <button
              type="button"
              id="forgot-password-trigger"
              onClick={openForgotModal}
              className="text-[12px] font-bold text-primary hover:underline bg-transparent border-none cursor-pointer p-0 transition-colors"
            >
              Forgot Password?
            </button>
          </div>
          <div className="relative flex items-center">
            <input
              id="admin-password"
              name="password"
              type={showPassword ? "text" : "password"}
              className="form-input"
              style={{ paddingLeft: "42px", paddingRight: "44px" }}
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
              suppressHydrationWarning
            />
            <button
              type="button"
              id="toggle-password"
              aria-label="Toggle password visibility"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-1 flex items-center"
            >
              <span className="material-symbols-outlined text-[20px]">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error mb-4">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Demo Credentials Info */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 mb-5 text-xs text-slate-600 space-y-1">
          <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
            <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Demo & Super Admin Credentials</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Super Admin:</span>
            <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-primary font-bold">
              pananrocks18@gmail.com
            </code>
          </div>
          <div className="flex justify-between items-center">
            <span>Store Admin:</span>
            <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-emerald-700 font-bold">
              storeadmin@teffes.com
            </code>
          </div>
        </div>

        <button
          id="admin-login-btn"
          type="submit"
          className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-headline-sm font-extrabold text-[15px] shadow-md transition-all cursor-pointer border-none flex items-center justify-center gap-2"
          disabled={loading || !canSubmit}
        >
          {loading ? (
            <span>Signing in…</span>
          ) : (
            <>
              <span>Access Admin Portal</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </>
          )}
        </button>
      </form>

      {/* ─── FORGOT PASSWORD MODAL ─── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">lock_reset</span>
                <h3 className="font-headline-sm font-extrabold text-on-surface text-[16px] m-0">
                  {forgotStep === "email" && "Reset Super Admin Password"}
                  {forgotStep === "otp" && "Enter Verification Code"}
                  {forgotStep === "success" && "Password Reset Complete"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* STEP 1: Enter Email */}
              {forgotStep === "email" && (
                <form onSubmit={handleSendResetCode} className="space-y-4">
                  <p className="text-[13px] text-slate-body leading-relaxed m-0">
                    Enter your registered <strong>Super Admin email address</strong>. We will send a secure 6-digit verification code to your inbox.
                  </p>

                  <div className="form-group">
                    <label className="form-label text-[12.5px]">Admin Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="e.g. pananrocks18@gmail.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  {forgotError && (
                    <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 text-slate-body font-bold text-[13px] hover:bg-slate-50 transition-colors bg-white cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading || !forgotEmail.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-[13px] shadow-sm transition-all border-none cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {forgotLoading ? (
                        <span>Sending Code…</span>
                      ) : (
                        <>
                          <span>Send Code</span>
                          <span className="material-symbols-outlined text-[16px]">send</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: Enter OTP & New Password */}
              {forgotStep === "otp" && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200/80 rounded-xl text-blue-800 text-[12px] flex items-start gap-2">
                    <span className="material-symbols-outlined text-[18px] text-blue-600 shrink-0 mt-0.5">mark_email_read</span>
                    <div>
                      A 6-digit verification code has been sent to <strong>{forgotEmail}</strong>. Please check your inbox.
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label text-[12.5px]">6-Digit Verification Code (OTP)</label>
                    <input
                      type="text"
                      maxLength={6}
                      className="form-input text-center text-[18px] tracking-[6px] font-mono font-bold"
                      placeholder="000000"
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label text-[12.5px]">New Password (min 8 chars)</label>
                    <div className="relative flex items-center">
                      <input
                        type={showForgotNewPassword ? "text" : "password"}
                        className="form-input"
                        placeholder="••••••••"
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotNewPassword((v) => !v)}
                        className="absolute right-3.5 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-1 flex items-center"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showForgotNewPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label text-[12.5px]">Confirm New Password</label>
                    <input
                      type={showForgotNewPassword ? "text" : "password"}
                      className="form-input"
                      placeholder="••••••••"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>

                  {forgotError && (
                    <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setForgotStep("email")}
                      className="text-[12px] font-bold text-slate-500 hover:text-slate-700 bg-transparent border-none cursor-pointer p-0"
                    >
                      Change Email
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(false)}
                        className="py-2.5 px-4 rounded-xl border border-gray-200 text-slate-body font-bold text-[13px] hover:bg-slate-50 bg-white cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={forgotLoading || forgotOtp.length !== 6 || forgotNewPassword.length < 8}
                        className="py-2.5 px-5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-[13px] shadow-sm transition-all border-none cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {forgotLoading ? "Updating…" : "Reset Password"}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* STEP 3: Success Screen */}
              {forgotStep === "success" && (
                <div className="text-center py-4 space-y-4">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-[32px]">check_circle</span>
                  </div>
                  <div>
                    <h4 className="font-headline-sm font-extrabold text-[17px] text-on-surface m-0">
                      Password Reset Successfully!
                    </h4>
                    <p className="text-[13px] text-slate-body mt-1.5 leading-relaxed">
                      Your Super Admin password has been updated. You can now log in with your new credentials.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, email: forgotEmail, password: "" }));
                      setShowForgotModal(false);
                    }}
                    className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-[14px] shadow-sm transition-all border-none cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Proceed to Sign In</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
