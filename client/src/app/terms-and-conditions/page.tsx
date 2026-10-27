import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faScaleBalanced,
  faFileContract,
  faUserCheck,
  faWeightHanging,
  faCreditCard,
  faClockRotateLeft,
  faShieldHalved,
  faPhone,
  faEnvelope,
  faLocationDot,
  faCheckCircle,
  faTruckFast,
  faRotateLeft,
  faTriangleExclamation,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";

export const metadata: Metadata = {
  title: "Terms & Conditions | TeFFe's Ranchi",
  description:
    "Official Terms and Conditions for Teffes Farm and Foods LLP. Artisanal cut-to-order protocols, dressing loss standards, and sales conditions in Ranchi.",
};

export default function TermsAndConditionsPage() {
  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", padding: "40px 0 80px" }}>
      <div className="container" style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 16px" }}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "var(--gray-500)", marginBottom: "20px" }}>
          <Link href="/" style={{ color: "var(--brand-primary)", fontWeight: 600 }}>Home</Link>
          <span>/</span>
          <span style={{ color: "var(--gray-500)" }}>Legal &amp; Policies</span>
          <span>/</span>
          <span style={{ fontWeight: 600, color: "var(--gray-800)" }}>Terms and Conditions</span>
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
              <FontAwesomeIcon icon={faShieldHalved} /> FSSAI Reg. 21123004000192
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
              <FontAwesomeIcon icon={faLocationDot} /> Ranchi Hubs Network
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
            Terms &amp; Conditions of Sale
          </h1>

          <p style={{ fontSize: "1rem", lineHeight: 1.7, color: "rgba(255, 255, 255, 0.95)", maxWidth: "800px", margin: 0 }}>
            Governing rules and operational conditions for purchases made on <strong>TeFFe&apos;s</strong> (operated by <strong>Teffes Farm and Foods LLP</strong>). We guarantee artisanal cut-to-order preparation, certified cold-chain preservation, and clear customer rights across Ranchi.
          </p>
        </div>

        {/* Content Clauses */}
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          
          {/* Clause 1: Artisanal Cut-to-Order Protocol */}
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
                <FontAwesomeIcon icon={faFileContract} />
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                1. Artisanal Cut-to-Order Protocol &amp; Customization
              </h2>
            </div>
            <p style={{ color: "var(--gray-700)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "14px" }}>
              Unlike industrial frozen food suppliers, <strong>TeFFe&apos;s operates exclusively on an on-demand butchery model</strong>. No poultry, goat carcass, or fresh fish is portioned prior to your order confirmation. When you select specific styles (Curry Cut, Biryani Cut, Boneless Fillet, or Bengali Fish Steaks), skilled butchers portion fresh cuts on sanitized stainless steel tables with RO-purified water wash.
            </p>

            {/* Gross vs Net Info Callout */}
            <div
              style={{
                background: "#fef3c7",
                borderLeft: "4px solid #b45309",
                borderRadius: "0 8px 8px 0",
                padding: "16px",
                marginTop: "12px",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#92400e", marginBottom: "4px" }}>
                Gross Weight vs. Net Yield (Dressing Loss)
              </div>
              <p style={{ fontSize: "0.88rem", color: "#78350f", margin: 0, lineHeight: 1.6 }}>
                For whole dressed poultry and live catches (such as Rohu or Katla), viscera removal, descaling, skinning, and portioning incur a natural dressing loss of 15% to 25%. TeFFe&apos;s product listings clearly specify both gross catch weight and net delivered portion yield.
              </p>
            </div>
          </div>

          {/* Clause 2: Freshness SLA & Sourcing Standards */}
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
                2. Freshness SLA &amp; Farm Sourcing Integrity
              </h2>
            </div>
            <p style={{ color: "var(--gray-700)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "14px" }}>
              All poultry and mutton sourced by TeFFe&apos;s originate from biosecure partner farms in Jharkhand and are audited for antibiotic residue-free standards. Every cut is maintained strictly at <strong>0°C to 4°C</strong> throughout butchering and transit.
            </p>

            {/* 3 Metric Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginTop: "12px" }}>
              <div style={{ padding: "16px", borderRadius: "10px", border: "1px solid var(--gray-200)", background: "#f8fafc" }}>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--gray-500)" }}>Catch to Doorstep</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#91000a", margin: "4px 0" }}>&lt; 14 Hours</div>
                <div style={{ fontSize: "0.82rem", color: "var(--gray-600)" }}>Freshwater harvest brought straight to our local Ranchi cutting slabs.</div>
              </div>

              <div style={{ padding: "16px", borderRadius: "10px", border: "1px solid var(--gray-200)", background: "#f8fafc" }}>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--gray-500)" }}>Mutton Standard</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#91000a", margin: "4px 0" }}>8 – 11 kg</div>
                <div style={{ fontSize: "0.82rem", color: "var(--gray-600)" }}>Pasture-raised young goat for delicate texture and tender meat fibers.</div>
              </div>

              <div style={{ padding: "16px", borderRadius: "10px", border: "1px solid var(--gray-200)", background: "#f8fafc" }}>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--gray-500)" }}>Transit Core Temp</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#166534", margin: "4px 0" }}>0°C to 4°C</div>
                <div style={{ fontSize: "0.82rem", color: "var(--gray-600)" }}>Continuous insulated gel pack chill logging until doorstep handover.</div>
              </div>
            </div>
          </div>

          {/* Clause 3: Pricing, Surcharges & Payment */}
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
                <FontAwesomeIcon icon={faCreditCard} />
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                3. Pricing, Taxes &amp; Payment Settlement
              </h2>
            </div>
            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "10px", color: "var(--gray-700)", fontSize: "0.95rem" }}>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faCheckCircle} style={{ color: "#91000a", marginTop: "4px" }} />
                <span>All prices are indicated in Indian Rupees (INR) and are inclusive of GST where applicable.</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faCheckCircle} style={{ color: "#91000a", marginTop: "4px" }} />
                <span>Accepted payment modes include UPI (Google Pay, PhonePe, Paytm, BHIM), Debit &amp; Credit Cards, Net Banking, and Cash on Delivery (COD) for eligible pin codes in Ranchi.</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faCheckCircle} style={{ color: "#91000a", marginTop: "4px" }} />
                <span>Delivery fees and priority rush options (e.g., 60-Minute Express at ₹50) are displayed transparently in your cart summary prior to checkout.</span>
              </li>
            </ul>
          </div>

          {/* Clause 4: Cancellation & 60-Minute Exchange */}
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
                <FontAwesomeIcon icon={faRotateLeft} />
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                4. Order Cancellation &amp; Doorstep Exchange
              </h2>
            </div>
            <p style={{ color: "var(--gray-700)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "12px" }}>
              Due to the perishable, customized nature of fresh meat:
            </p>
            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "10px", color: "var(--gray-700)", fontSize: "0.95rem" }}>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ color: "#91000a", fontWeight: 700 }}>•</span>
                <span><strong>Cancellation Window:</strong> Orders can be canceled within 30 minutes of placement. Once an order is moved to &quot;On Cutting Table&quot; or &quot;Out for Delivery&quot;, cancellation is not possible.</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ color: "#91000a", fontWeight: 700 }}>•</span>
                <span><strong>60-Minute Exchange Guarantee:</strong> If the delivered cuts do not match your order or temperature has been compromised, notify us on WhatsApp (+91 92796 82955) within 60 minutes of delivery for an instant replacement.</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ color: "#91000a", fontWeight: 700 }}>•</span>
                <span>For full details, please refer to our comprehensive <strong>Return and Exchange Policy</strong> in the footer links below.</span>
              </li>
            </ul>
          </div>

          {/* Clause 5: Governing Law & Jurisdiction */}
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
                <FontAwesomeIcon icon={faScaleBalanced} />
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                5. Intellectual Property &amp; Legal Jurisdiction
              </h2>
            </div>
            <p style={{ color: "var(--gray-700)", fontSize: "0.95rem", lineHeight: 1.7, margin: 0 }}>
              All trademarks, product cut photography, and proprietary algorithms on this website are the intellectual property of <strong>Teffes Farm and Foods LLP</strong>. All legal matters and transactions are governed under Indian legislation, subject to the exclusive jurisdiction of the competent courts of <strong>Ranchi, Jharkhand</strong>.
            </p>
          </div>

          {/* Helpdesk & Contact Card */}
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
              Teffe&apos;s Customer &amp; Grievance Desk
            </h3>
            <p style={{ color: "var(--gray-300)", fontSize: "0.9rem", marginBottom: "18px" }}>
              Need assistance with an order or legal compliance inquiry?
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faPhone} style={{ color: "#4ade80", marginTop: "3px", fontSize: "1rem" }} />
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", textTransform: "uppercase", fontWeight: 700 }}>Helpline</div>
                  <a href="tel:9279682955" style={{ color: "#ffffff", fontWeight: 700, fontSize: "0.95rem", textDecoration: "none" }}>+91 92796 82955</a>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faEnvelope} style={{ color: "#ff8477", marginTop: "3px", fontSize: "1rem" }} />
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", textTransform: "uppercase", fontWeight: 700 }}>Email</div>
                  <a href="mailto:rakeshroshanteffes@gmail.com" style={{ color: "#ffffff", fontWeight: 700, fontSize: "0.95rem", textDecoration: "none" }}>rakeshroshanteffes@gmail.com</a>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faLocationDot} style={{ color: "#ff8477", marginTop: "3px", fontSize: "1rem" }} />
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", textTransform: "uppercase", fontWeight: 700 }}>Principal Store</div>
                  <div style={{ color: "var(--gray-200)", fontSize: "0.85rem" }}>Plot 42, Main Road, Kishore Ganj, Ranchi 834001</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
              <a
                href="https://wa.me/919279682955?text=Hello%20Teffes%2C%20I%20have%20an%20inquiry%20regarding%20Terms%20and%20Conditions."
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
                <FontAwesomeIcon icon={faWhatsapp} style={{ fontSize: "1.1rem" }} /> WhatsApp Support
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
