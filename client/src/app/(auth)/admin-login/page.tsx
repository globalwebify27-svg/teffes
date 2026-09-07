import type { Metadata } from "next";
import Link from "next/link";
import AdminLoginForm from "@/components/auth/AdminLoginForm";

export const metadata: Metadata = {
  title: "Teffes Admin Portal",
  description: "Internal store management portal for Teffes Ranchi.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLoginPage() {
  return (
    <div
      style={{
        minHeight: "calc(100vh - 120px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        background: "linear-gradient(135deg, #111c36 0%, #1a2542 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "var(--radius-xl)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
          padding: "40px 32px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              background: "#111c36",
              borderRadius: "var(--radius-md)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
              color: "#ffffff",
              marginBottom: "16px",
            }}
          >
            🛡️
          </div>
          <h1
            style={{
              fontSize: "1.4rem",
              fontWeight: 800,
              color: "var(--gray-900)",
              marginBottom: "6px",
            }}
          >
            Teffes Admin Portal
          </h1>
          <p style={{ color: "var(--gray-500)", fontSize: "0.85rem" }}>
            Secure sign in for store operations &amp; inventory management
          </p>
        </div>

        <AdminLoginForm />

        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <Link
            href="/"
            style={{
              fontSize: "0.8rem",
              color: "var(--gray-500)",
              textDecoration: "none",
            }}
          >
            ← Back to Teffes Store
          </Link>
        </div>
      </div>
    </div>
  );
}
