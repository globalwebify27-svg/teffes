"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveAuth } from "@/lib/auth";

export default function OTPForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOTP = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "");

    if (cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setError("");
    setLoading(true);

    // Generate random OTP
    const randomOtp = Math.floor(100000 + Math.random() * 900000);

    // Show random OTP in alert as requested
    alert(`Your Teffe's Login OTP is: ${randomOtp}`);

    // Set demo authenticated customer session
    saveAuth("teffes-jwt-token-" + Date.now(), {
      id: "cust-" + cleanPhone,
      phone: `+91 ${cleanPhone}`,
      name: "Valued Customer",
      role: "customer",
      isVerified: true,
    });

    // Redirect to home page immediately
    router.push("/");
  };

  return (
    <form onSubmit={handleSendOTP} noValidate id="otp-phone-form">
      <div className="form-group mb-5">
        <label htmlFor="phone-input" className="form-label">
          Mobile Number
        </label>

        {/* Styled Phone Number Input Box with +91 Country Badge */}
        <div className="relative flex items-center">
          <div className="absolute left-3 flex items-center gap-1.5 pointer-events-none text-slate-700 font-bold text-sm border-r border-slate-200 pr-2.5 z-10 select-none">

          </div>
          <input
            id="phone-input"
            type="tel"
            className="form-input"
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
          Enter any 10-digit mobile number to sign in
        </span>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      <button
        id="send-otp-btn"
        type="submit"
        className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-headline-sm font-extrabold text-[15px] shadow-md transition-all cursor-pointer border-none flex items-center justify-center gap-2"
        disabled={loading || phone.length < 10}
      >
        {loading ? (
          <span>Signing in…</span>
        ) : (
          <>
            <span>Login with OTP</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </>
        )}
      </button>

      <p className="mt-4 text-center text-xs text-slate-400 leading-relaxed">
        By continuing, you agree to Teffe&apos;s Terms of Service &amp; Privacy Policy.
      </p>
    </form>
  );
}
