"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin } from "@/lib/auth";
import { AxiosError } from "axios";

export default function AdminLoginForm() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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

  const canSubmit = form.email.trim() && form.password.length >= 6;

  return (
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
          />
        </div>
      </div>

      {/* Password */}
      <div className="form-group mb-5">
        <label htmlFor="admin-password" className="form-label">
          Password
        </label>
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
        <div className="font-bold text-slate-800 flex items-center gap-1 mb-1">
          <span className="material-symbols-outlined text-[16px] text-amber-600">key</span>
          <span>Demo Credentials</span>
        </div>
        <div className="flex justify-between">
          <span>Super Admin:</span>
          <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-primary font-bold">
            superadmin@teffes.com
          </code>
        </div>
        <div className="flex justify-between">
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
  );
}
