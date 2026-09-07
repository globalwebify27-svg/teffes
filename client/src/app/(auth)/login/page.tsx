import type { Metadata } from "next";
import Link from "next/link";
import OTPForm from "@/components/auth/OTPForm";

export const metadata: Metadata = {
  title: "Customer Sign In - Teffes Ranchi",
  description: "Sign in to Teffes with your mobile number to order fresh meat in Ranchi.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="w-full max-w-md bg-white rounded-3xl border border-gray-200/80 shadow-lg p-6 sm:p-10">
        {/* Brand Header with Original Logo */}
        <div className="text-center mb-7">
          <Link href="/" className="inline-block mb-4">
            <img
              src="/teffes-logo-maroon.png"
              alt="TeFFe's — Where health matters most"
              className="h-12 w-auto mx-auto object-contain"
            />
          </Link>

          <h1 className="font-headline-sm font-extrabold text-gray-900 text-xl mb-1.5">
            Customer Login / Sign Up
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm">
            Enter your mobile number to get an instant OTP for fresh delivery in Ranchi
          </p>
        </div>

        {/* OTP Auth Form */}
        <OTPForm />

        {/* Ranchi Delivery Guarantee Note */}
        <div className="mt-6 p-3.5 bg-slate-50 rounded-2xl border border-gray-200/60 text-center text-xs text-slate-600 leading-relaxed">
          <div className="flex items-center justify-center gap-1.5 text-tertiary font-bold mb-1">
            <span className="material-symbols-outlined text-[17px]">bolt</span>
            <span>90-Min Fresh Delivery in Ranchi</span>
          </div>
          No password needed — 100% secure OTP verification.
        </div>

        <div className="text-center mt-5">
          <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-primary transition-colors">
            ← Back to Storefront
          </Link>
        </div>
      </div>
    </div>
  );
}
