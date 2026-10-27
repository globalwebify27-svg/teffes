"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { firebaseLogin } from "@/lib/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { toast } from "@/lib/toast";

export interface OTPFormProps {
  onSuccess?: (user: any) => void;
  redirectOnSuccess?: boolean;
  containerId?: string;
}

export default function OTPForm({
  onSuccess,
  redirectOnSuccess = true,
  containerId = "recaptcha-container",
}: OTPFormProps = {}) {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Countdown timer for resending OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "otp" && resendTimer > 0) {
      timer = setTimeout(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (step === "otp" && resendTimer === 0) {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [step, resendTimer]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      resetRecaptcha();
    };
  }, []);

  /**
   * Safely resets reCAPTCHA instance and wipes DOM child nodes
   * to prevent "reCAPTCHA has already been rendered in this element".
   */
  const resetRecaptcha = () => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // ignore cleanup errors
      }
      recaptchaVerifierRef.current = null;
    }
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = "";
    }
  };

  /**
   * Returns an active RecaptchaVerifier or safely initializes a fresh one.
   */
  const getOrCreateRecaptchaVerifier = (): RecaptchaVerifier => {
    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }

    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = "";
    }

    const auth = getFirebaseAuth();
    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
      callback: () => {
        // reCAPTCHA solved callback
      },
      "expired-callback": () => {
        setError("reCAPTCHA expired. Please click Send again.");
        setLoading(false);
        resetRecaptcha();
      },
    });

    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "");

    if (cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const auth = getFirebaseAuth();
      const formattedPhone = `+91${cleanPhone.slice(-10)}`;

      if (process.env.NODE_ENV !== "production") {
        console.log(`[Firebase Phone Auth] Initiating OTP send for: ${formattedPhone.slice(0, 6)}****`);
      }

      const verifier = getOrCreateRecaptchaVerifier();
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      confirmationResultRef.current = confirmation;

      setStep("otp");
      setResendTimer(30);
      setCanResend(false);
      toast.success("Verification code sent via SMS", "OTP Sent");
    } catch (err: any) {
      console.error("[Firebase Web Phone Auth] Error sending OTP:", err?.code || err?.message || err);
      // Cleanly reset verifier on failure so the next attempt starts fresh without DOM collisions
      resetRecaptcha();

      let msg = "Failed to send verification SMS. Please try again.";
      if (err.code === "auth/invalid-phone-number") {
        msg = "Invalid phone number format. Please enter a valid 10-digit mobile number.";
      } else if (err.code === "auth/too-many-requests") {
        msg = "Too many attempts on this number. Google has temporarily throttled it. Please wait 15 minutes or use a registered test number.";
      } else if (err.code === "auth/quota-exceeded") {
        msg = "Daily SMS quota exceeded for testing. Use a registered Firebase test number.";
      } else if (err.code === "auth/billing-not-enabled") {
        msg = "SMS billing is not enabled on this Firebase project. Please ensure Blaze plan is active.";
      } else if (err.code === "auth/invalid-app-credential") {
        msg = "reCAPTCHA verification failed (auth/invalid-app-credential). On localhost, add 127.0.0.1 to Authorized Domains or use a configured test phone number.";
      } else if (err.code === "auth/operation-not-allowed") {
        msg = "Phone sign-in is not enabled in Firebase Console. Please enable Phone provider under Authentication > Sign-in method.";
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.replace(/\D/g, "");

    if (cleanOtp.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    if (!confirmationResultRef.current) {
      setError("Session expired. Please request a new verification code.");
      setStep("phone");
      return;
    }

    setError("");
    setLoading(true);

    let idToken = "";
    try {
      // 1. Verify OTP with Firebase
      const userCredential = await confirmationResultRef.current.confirm(cleanOtp);
      const user = userCredential.user;
      idToken = await user.getIdToken();
    } catch (firebaseErr: any) {
      console.error("[Firebase OTP Confirm Error]:", firebaseErr?.code || firebaseErr?.message || firebaseErr);
      let msg = "Invalid verification code. Please check and try again.";
      if (firebaseErr.code === "auth/invalid-verification-code") {
        msg = "Incorrect 6-digit verification code. Please enter the code configured in Firebase Console.";
      } else if (firebaseErr.code === "auth/code-expired") {
        msg = "Verification code has expired. Please click Resend OTP.";
      } else if (firebaseErr.message) {
        msg = firebaseErr.message;
      }
      setError(msg);
      setLoading(false);
      return;
    }

    try {
      // 2. Send ID token to TeFFe backend to create/login customer and issue TeFFe JWT
      const authRes = await firebaseLogin(idToken);

      if (authRes.success) {
        toast.success("Welcome to TeFFe! You are signed in.", "Login Successful");
        if (onSuccess) {
          onSuccess(authRes.user);
        } else if (redirectOnSuccess) {
          router.push("/");
        }
      } else {
        setError("Failed to create customer session. Please try again.");
      }
    } catch (backendErr: any) {
      console.error("[Backend Login Error]:", backendErr);
      const backendMsg =
        backendErr?.response?.data?.message ||
        backendErr?.message ||
        "Failed to establish customer session with server.";
      setError(`Login server error: ${backendMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || loading) return;
    setOtp("");
    setError("");
    resetRecaptcha();
    await handleSendOTP({ preventDefault: () => {} } as any);
  };

  return (
    <div className="w-full">
      {/*
        Invisible reCAPTCHA container:
        Must be present in the active DOM without display: none.
        Google reCAPTCHA with size: 'invisible' is automatically invisible.
      */}
      <div id={containerId} className="flex justify-center my-1"></div>

      {step === "phone" ? (
        <form onSubmit={handleSendOTP} noValidate id="otp-phone-form">
          <div className="form-group mb-5">
            <label htmlFor="phone-input" className="form-label block text-sm font-bold text-slate-700 mb-1.5">
              Mobile Number
            </label>

            {/* Styled Phone Number Input Box with +91 Country Badge */}
            <div className="relative flex items-center">
              <div className="absolute left-3 flex items-center gap-1.5 pointer-events-none text-slate-700 font-bold text-sm border-r border-slate-200 pr-2.5 z-10 select-none">
                <span>🇮🇳</span>
                <span>+91</span>
              </div>
              <input
                id="phone-input"
                type="tel"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 text-slate-900 font-medium outline-none transition-all"
                style={{ paddingLeft: "82px" }}
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => {
                  setError("");
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                }}
                required
                autoFocus
                autoComplete="tel"
              />
            </div>
            <span className="text-[11.5px] text-slate-400 mt-1.5 block">
              We&apos;ll send a 6-digit verification code via SMS
            </span>
          </div>

          {error && (
            <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          <button
            id="send-otp-btn"
            type="submit"
            className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-[15px] shadow-md transition-all cursor-pointer border-none flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || phone.length < 10}
          >
            {loading ? (
              <span>Sending code…</span>
            ) : (
              <>
                <span>Send Verification Code</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOTP} noValidate id="otp-verify-form">
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="otp-input" className="text-sm font-bold text-slate-700">
                Enter 6-digit Code
              </label>
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setOtp("");
                  setError("");
                }}
                className="text-xs text-primary hover:underline font-bold bg-transparent border-none p-0 cursor-pointer"
              >
                Change number
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              Sent to <span className="font-bold text-slate-800">+91 {phone}</span>
            </p>

            <input
              id="otp-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              className="w-full tracking-[0.5em] text-center text-2xl font-bold py-3 px-4 rounded-xl border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 text-slate-900 outline-none transition-all"
              placeholder="••••••"
              value={otp}
              onChange={(e) => {
                setError("");
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
              }}
              required
              autoFocus
            />

            <div className="flex items-center justify-between mt-3 text-xs">
              <span className="text-slate-400">Didn&apos;t receive code?</span>
              {canResend ? (
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-primary font-bold hover:underline bg-transparent border-none p-0 cursor-pointer disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? "Resending…" : "Resend OTP"}
                </button>
              ) : (
                <span className="text-slate-400 font-medium">Resend in {resendTimer}s</span>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          <button
            id="verify-otp-btn"
            type="submit"
            className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-[15px] shadow-md transition-all cursor-pointer border-none flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || otp.length !== 6}
          >
            {loading ? (
              <span>Verifying &amp; Signing in…</span>
            ) : (
              <>
                <span>Verify &amp; Continue</span>
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
              </>
            )}
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-xs text-slate-400 leading-relaxed">
        By continuing, you agree to Teffe&apos;s Terms of Service &amp; Privacy Policy.
      </p>
    </div>
  );
}
