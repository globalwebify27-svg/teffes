import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faShieldHalved,
  faBan,
  faArrowRotateLeft,
  faClockRotateLeft,
  faPhone,
  faEnvelope,
  faLocationDot,
  faCheckCircle,
  faHeadset,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";

export const metadata: Metadata = {
  title: "Return and Exchange Policy",
  description: "Teffes Farm and Foods LLP Return and Exchange Policy. Exchange available within 60 mins of delivery in Ranchi.",
};

export default function ReturnAndExchangePolicyPage() {
  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", padding: "40px 0 80px" }}>
      <div className="container" style={{ maxWidth: "900px" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "var(--gray-500)", marginBottom: "20px" }}>
          <Link href="/" style={{ color: "var(--brand-primary)", fontWeight: 600 }}>Home</Link>
          <span>/</span>
          <span>Return and Exchange Policy</span>
        </div>

        {/* Hero Header Card */}
        <div
          style={{
            background: "linear-gradient(135deg, #dc2d1b 0%, #b81f0f 100%)",
            color: "#ffffff",
            borderRadius: "var(--radius-xl)",
            padding: "40px 32px",
            marginBottom: "32px",
            boxShadow: "0 10px 30px rgba(220, 45, 27, 0.2)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(255, 255, 255, 0.2)",
              padding: "4px 14px",
              borderRadius: "var(--radius-full)",
              fontSize: "0.8rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "16px",
            }}
          >
            <FontAwesomeIcon icon={faShieldHalved} /> Teffes Customer Guarantee
          </div>

          <h1
            style={{
              fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)",
              fontWeight: 800,
              color: "#ffffff",
              marginBottom: "16px",
              letterSpacing: "-0.02em",
            }}
          >
            Return and Exchange Policy
          </h1>

          <p style={{ fontSize: "1.05rem", lineHeight: 1.7, color: "rgba(255, 255, 255, 0.95)", maxWidth: "760px" }}>
            At <strong>Teffes Farm and Foods LLP</strong>, we are committed to delivering fresh and high-quality products. Due to the perishable nature of our products, we do not offer refunds. However, we provide an exchange facility under specific conditions.
          </p>
          <p style={{ fontSize: "0.95rem", color: "rgba(255, 255, 255, 0.85)", marginTop: "8px" }}>
            This policy explains our exchange and order cancellation terms.
          </p>
        </div>

        {/* Policy Content Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Section 1: No Refund Policy */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "var(--radius-lg)",
              padding: "32px",
              border: "1px solid var(--gray-200)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--error-bg)",
                  color: "var(--error)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.2rem",
                }}
              >
                <FontAwesomeIcon icon={faBan} />
              </div>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                1. No Refund Policy
              </h2>
            </div>

            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "10px", color: "var(--gray-700)", fontSize: "0.95rem" }}>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ color: "var(--brand-primary)", fontWeight: 700 }}>•</span>
                <span>We do <strong>not provide refunds</strong> on any orders once delivered.</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ color: "var(--brand-primary)", fontWeight: 700 }}>•</span>
                <span>All sales are final due to the perishable nature of fresh food products.</span>
              </li>
            </ul>
          </div>

          {/* Section 2: Exchange Policy */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "var(--radius-lg)",
              padding: "32px",
              border: "1px solid var(--gray-200)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--brand-primary-soft)",
                  color: "var(--brand-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.2rem",
                }}
              >
                <FontAwesomeIcon icon={faArrowRotateLeft} />
              </div>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                2. Exchange Policy
              </h2>
            </div>

            <p style={{ color: "var(--gray-700)", fontSize: "0.95rem", marginBottom: "14px" }}>
              We offer exchange only under the following conditions:
            </p>

            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "10px", color: "var(--gray-700)", fontSize: "0.95rem", marginBottom: "20px" }}>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faCheckCircle} style={{ color: "var(--brand-primary)", marginTop: "4px" }} />
                <span>The product received is damaged, defective, or incorrect.</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faCheckCircle} style={{ color: "var(--brand-primary)", marginTop: "4px" }} />
                <span>The issue must be reported within <strong>60 minutes of delivery</strong>.</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faCheckCircle} style={{ color: "var(--brand-primary)", marginTop: "4px" }} />
                <span>Proof of issue (photo/video) may be required.</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faCheckCircle} style={{ color: "var(--brand-primary)", marginTop: "4px" }} />
                <span>Products must remain unused and in original packaging.</span>
              </li>
            </ul>

            <div
              style={{
                background: "var(--gray-50)",
                border: "1px solid var(--gray-200)",
                borderRadius: "var(--radius-md)",
                padding: "16px",
                marginTop: "16px",
              }}
            >
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--gray-900)", marginBottom: "6px" }}>
                Exchange Shipping Charges:
              </h3>
              <p style={{ fontSize: "0.9rem", color: "var(--gray-600)", margin: 0 }}>
                • <strong>No exchange shipping charges</strong> will be applied on eligible exchanges. After verification, we will arrange a replacement promptly.
              </p>
            </div>
          </div>

          {/* Section 3: Order Cancellation Policy */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "var(--radius-lg)",
              padding: "32px",
              border: "1px solid var(--gray-200)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--radius-md)",
                  background: "#fffbeb",
                  color: "#d97706",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.2rem",
                }}
              >
                <FontAwesomeIcon icon={faClockRotateLeft} />
              </div>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                3. Order Cancellation Policy
              </h2>
            </div>

            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "10px", color: "var(--gray-700)", fontSize: "0.95rem" }}>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ color: "var(--brand-primary)", fontWeight: 700 }}>•</span>
                <span>Orders can be cancelled within <strong>30 minutes</strong> of placing the order.</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ color: "var(--brand-primary)", fontWeight: 700 }}>•</span>
                <span>Cancellation requests made after 30 minutes may not be accepted once order processing begins.</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ color: "var(--brand-primary)", fontWeight: 700 }}>•</span>
                <span>To cancel an order, contact our support team immediately using the contact details below.</span>
              </li>
            </ul>
          </div>

          {/* Section 4: How to Request Exchange or Cancellation */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "var(--radius-lg)",
              padding: "32px",
              border: "1px solid var(--gray-200)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--brand-primary-soft)",
                  color: "var(--brand-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.2rem",
                }}
              >
                <FontAwesomeIcon icon={faHeadset} />
              </div>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                4. How to Request Exchange or Cancellation
              </h2>
            </div>

            <p style={{ color: "var(--gray-700)", fontSize: "0.95rem", marginBottom: "14px" }}>
              To request an exchange or cancel an order:
            </p>

            <ol style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "10px", color: "var(--gray-700)", fontSize: "0.95rem" }}>
              <li>Contact our support team within the allowed time.</li>
              <li>Provide your order number and issue details.</li>
              <li>Share photos/videos if requested.</li>
              <li>Our team will review and guide the next steps.</li>
            </ol>
          </div>

          {/* Section 5: Contact Information */}
          <div
            style={{
              background: "linear-gradient(135deg, #111c36 0%, #1a2542 100%)",
              color: "#ffffff",
              borderRadius: "var(--radius-lg)",
              padding: "32px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            }}
          >
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#ffffff", marginBottom: "8px" }}>
              5. Contact Information
            </h2>
            <p style={{ color: "var(--gray-300)", fontSize: "0.9rem", marginBottom: "20px" }}>
              For exchange or cancellation requests:
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <FontAwesomeIcon icon={faEnvelope} style={{ color: "#ff4d3b", marginTop: "4px", fontSize: "1.1rem" }} />
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--gray-400)", textTransform: "uppercase", fontWeight: 700 }}>
                    Company &amp; Email
                  </div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>Teffes Farm and Foods LLP</div>
                  <a href="mailto:support@teffes.com" style={{ color: "#ff8477", fontSize: "0.85rem" }}>
                    support@teffes.com / rakeshroshanteffes@gmail.com
                  </a>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <FontAwesomeIcon icon={faPhone} style={{ color: "#4ade80", marginTop: "4px", fontSize: "1.1rem" }} />
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--gray-400)", textTransform: "uppercase", fontWeight: 700 }}>
                    Phone / Helpline
                  </div>
                  <a href="tel:9779687955" style={{ fontSize: "1.1rem", fontWeight: 800, color: "#ffffff" }}>
                    9779687955
                  </a>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", gridColumn: "1 / -1" }}>
                <FontAwesomeIcon icon={faLocationDot} style={{ color: "#ff4d3b", marginTop: "4px", fontSize: "1.1rem" }} />
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--gray-400)", textTransform: "uppercase", fontWeight: 700 }}>
                    Store Address
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "var(--gray-200)" }}>
                    Kishoregunj, Harmu bypass, Ranchi, Jharkhand 834001
                  </div>
                </div>
              </div>
            </div>

            {/* Quick WhatsApp Support Button */}
            <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.15)" }}>
              <a
                href="https://wa.me/919779687955?text=Hello%20Teffes%2C%20I%20have%20an%20inquiry%20regarding%20my%20meat%20order."
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-lg"
                style={{ background: "#25D366", color: "#ffffff", boxShadow: "0 4px 14px rgba(37, 211, 102, 0.3)" }}
              >
                <FontAwesomeIcon icon={faWhatsapp} style={{ fontSize: "1.2rem" }} /> Chat with Teffes on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
