import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserShield,
  faDatabase,
  faLock,
  faLocationDot,
  faShieldHalved,
  faPhone,
  faEnvelope,
  faCheckCircle,
  faCookieBite,
  faUserCheck,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";

export const metadata: Metadata = {
  title: "Privacy & Data Protection | TeFFe's Ranchi",
  description:
    "Teffes Farm and Foods LLP Privacy and Information Governance Charter. Address telemetry, payment gateway security, and zero-monetization pledge.",
};

export default function PrivacyPolicyPage() {
  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", padding: "40px 0 80px" }}>
      <div className="container" style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 16px" }}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "var(--gray-500)", marginBottom: "20px" }}>
          <Link href="/" style={{ color: "var(--brand-primary)", fontWeight: 600 }}>Home</Link>
          <span>/</span>
          <span style={{ color: "var(--gray-500)" }}>Legal &amp; Policies</span>
          <span>/</span>
          <span style={{ fontWeight: 600, color: "var(--gray-800)" }}>Privacy Policy</span>
        </nav>

        {/* Hero Header Card */}
        <div
          style={{
            background: "linear-gradient(135deg, #91000a 0%, #6e0e0e 100%)",
            color: "#ffffff",
            borderRadius: "16px",
            padding: "36px 32px",
            marginBottom: "28px",
            boxShadow: "0 10px 30px rgba(145, 0, 10, 0.2)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", marginBottom: "16px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(255, 255, 255, 0.18)",
                padding: "4px 14px",
                borderRadius: "9999px",
                fontSize: "0.78rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <FontAwesomeIcon icon={faUserShield} /> DPDP Act &amp; IT Act Ready
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(255, 255, 255, 0.18)",
                padding: "4px 14px",
                borderRadius: "9999px",
                fontSize: "0.78rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <FontAwesomeIcon icon={faLock} /> 256-Bit SSL Encryption
            </span>
          </div>

          <h1
            style={{
              fontSize: "clamp(1.8rem, 3.5vw, 2.4rem)",
              fontWeight: 800,
              color: "#ffffff",
              marginBottom: "12px",
              letterSpacing: "-0.02em",
            }}
          >
            Privacy, OTP Security &amp; Data Charter
          </h1>

          <p style={{ fontSize: "1rem", lineHeight: 1.7, color: "rgba(255, 255, 255, 0.95)", maxWidth: "800px", margin: 0 }}>
            How <strong>TeFFe&apos;s</strong> (Teffes Farm and Foods LLP) protects your personal information, address telemetry, and payment security. We hold a strict zero-monetization policy and never sell your dietary preferences or contact information.
          </p>
        </div>

        {/* Content Clauses */}
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          
          {/* Clause 1: Data Collection & Address Telemetry */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              padding: "28px",
              border: "1px solid var(--gray-200)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "#fee2e2",
                  color: "#91000a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                <FontAwesomeIcon icon={faDatabase} />
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                1. Personal Telemetry &amp; Geo-Coordinates Collected
              </h2>
            </div>
            <p style={{ color: "var(--gray-700)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "14px" }}>
              To ensure our delivery fleet navigates Ranchi’s municipal topography rapidly without compromising temperature custody, we collect:
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
              <div style={{ padding: "16px", borderRadius: "10px", border: "1px solid var(--gray-200)", background: "#f8fafc" }}>
                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--gray-900)", display: "block", marginBottom: "6px" }}>
                  Mobile Number &amp; OTP Access
                </span>
                <span style={{ fontSize: "0.85rem", color: "var(--gray-600)", lineHeight: 1.6, display: "block" }}>
                  Used solely for secure passwordless login, order dispatch notifications, and rider delivery coordination.
                </span>
              </div>

              <div style={{ padding: "16px", borderRadius: "10px", border: "1px solid var(--gray-200)", background: "#f8fafc" }}>
                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--gray-900)", display: "block", marginBottom: "6px" }}>
                  Precise Delivery Coordinates
                </span>
                <span style={{ fontSize: "0.85rem", color: "var(--gray-600)", lineHeight: 1.6, display: "block" }}>
                  Used solely to auto-assign the closest Ranchi butchery hub (Kishore Ganj, Doranda, or Harmu) and map transit routes.
                </span>
              </div>
            </div>
          </div>

          {/* Clause 2: Payment Gateway Security */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              padding: "28px",
              border: "1px solid var(--gray-200)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "#e0f2fe",
                  color: "#0369a1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                <FontAwesomeIcon icon={faLock} />
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                2. Payment Gateway Security &amp; Cardless Transactions
              </h2>
            </div>
            <p style={{ color: "var(--gray-700)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "12px" }}>
              TeFFe&apos;s does <strong>not store, view, or cache credit/debit card numbers, CVVs, or UPI PINs</strong> on its servers:
            </p>
            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "10px", color: "var(--gray-700)", fontSize: "0.95rem" }}>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faCheckCircle} style={{ color: "#166534", marginTop: "4px" }} />
                <span>All transactions flow directly through RBI-regulated payment gateways complying with PCI-DSS Level 1 standards.</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faCheckCircle} style={{ color: "#166534", marginTop: "4px" }} />
                <span>Data transmission is secured with end-to-end 256-bit SSL/TLS 1.3 cryptographic protocols.</span>
              </li>
            </ul>
          </div>

          {/* Clause 3: Strict Anti-Monetization Pledge */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              padding: "28px",
              border: "1px solid var(--gray-200)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "#dcfce7",
                  color: "#166534",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                <FontAwesomeIcon icon={faShieldHalved} />
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                3. Strict Anti-Monetization &amp; No-Spam Pledge
              </h2>
            </div>
            <p style={{ color: "var(--gray-700)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "12px" }}>
              We hold a fundamental respect for your household&apos;s privacy and dietary selections. TeFFe&apos;s will <strong>never sell, rent, or barter</strong> your contact details, buying habits, or cut preferences to third-party ad brokers or marketing syndicates.
            </p>
            <p style={{ color: "var(--gray-700)", fontSize: "0.95rem", lineHeight: 1.7, margin: 0 }}>
              Transactional notifications (bill receipts, rider dispatch status) are sent strictly via SMS and WhatsApp. You may opt out of recipe recommendations at any time.
            </p>
          </div>

          {/* Clause 4: User Rights & Data Deletion */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              padding: "28px",
              border: "1px solid var(--gray-200)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "#f1f5f9",
                  color: "#475569",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                <FontAwesomeIcon icon={faUserCheck} />
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                4. Your Rights under Indian DPDP Act
              </h2>
            </div>
            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "10px", color: "var(--gray-700)", fontSize: "0.95rem" }}>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ color: "#91000a", fontWeight: 700 }}>•</span>
                <span><strong>Right to Correction:</strong> You can edit your addresses and contact profile directly from your account settings.</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ color: "#91000a", fontWeight: 700 }}>•</span>
                <span><strong>Right to Erasure:</strong> You may request the permanent deletion of your profile by emailing our data protection desk, subject to statutory GST transaction record preservation requirements.</span>
              </li>
            </ul>
          </div>

          {/* Helpdesk & Data Officer Contact Card */}
          <div
            style={{
              background: "linear-gradient(135deg, #111c36 0%, #1a2542 100%)",
              color: "#ffffff",
              borderRadius: "14px",
              padding: "30px",
              boxShadow: "0 4px 18px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff", marginBottom: "8px" }}>
              Data Protection &amp; Privacy Officer
            </h3>
            <p style={{ color: "var(--gray-300)", fontSize: "0.9rem", marginBottom: "18px" }}>
              Have questions regarding data telemetry or personal information security?
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faEnvelope} style={{ color: "#ff8477", marginTop: "3px", fontSize: "1rem" }} />
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", textTransform: "uppercase", fontWeight: 700 }}>Privacy Email</div>
                  <a href="mailto:support@teffes.com" style={{ color: "#ffffff", fontWeight: 700, fontSize: "0.95rem", textDecoration: "none" }}>support@teffes.com</a>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faPhone} style={{ color: "#4ade80", marginTop: "3px", fontSize: "1rem" }} />
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", textTransform: "uppercase", fontWeight: 700 }}>Support Line</div>
                  <a href="tel:9779687955" style={{ color: "#ffffff", fontWeight: 700, fontSize: "0.95rem", textDecoration: "none" }}>+91 9779687955</a>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faLocationDot} style={{ color: "#ff8477", marginTop: "3px", fontSize: "1rem" }} />
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", textTransform: "uppercase", fontWeight: 700 }}>Office</div>
                  <div style={{ color: "var(--gray-200)", fontSize: "0.85rem" }}>Teffes Farm and Foods LLP, Kishore Ganj, Ranchi 834001</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
              <a
                href="https://wa.me/919779687955?text=Hello%20Teffes%2C%20I%20have%20an%20inquiry%20regarding%20Privacy%20Policy."
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#25D366",
                  color: "#ffffff",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  textDecoration: "none",
                }}
              >
                <FontAwesomeIcon icon={faWhatsapp} style={{ fontSize: "1.1rem" }} /> Contact Privacy Desk
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
