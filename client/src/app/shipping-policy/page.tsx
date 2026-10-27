import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTruckFast,
  faClock,
  faTemperatureLow,
  faBoxOpen,
  faShieldHalved,
  faLocationDot,
  faCheckCircle,
  faPhone,
  faEnvelope,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";

export const metadata: Metadata = {
  title: "Cold-Chain Shipping Policy | TeFFe's Ranchi",
  description:
    "Teffes Farm and Foods LLP Cold-Chain Shipping & Delivery Policy. 60-min express rush, 90-min fresh cut delivery, and 0°C-4°C packaging across Ranchi.",
};

export default function ShippingPolicyPage() {
  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", padding: "40px 0 80px" }}>
      <div className="container" style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 16px" }}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "var(--gray-500)", marginBottom: "20px" }}>
          <Link href="/" style={{ color: "var(--brand-primary)", fontWeight: 600 }}>Home</Link>
          <span>/</span>
          <span style={{ color: "var(--gray-500)" }}>Legal &amp; Policies</span>
          <span>/</span>
          <span style={{ fontWeight: 600, color: "var(--gray-800)" }}>Shipping Policy</span>
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
              <FontAwesomeIcon icon={faTruckFast} /> Hyperlocal Express Logistics
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
              <FontAwesomeIcon icon={faTemperatureLow} /> 0°C to 4°C Temperature Custody
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
            Shipping &amp; Cold-Chain Transit Protocol
          </h1>

          <p style={{ fontSize: "1rem", lineHeight: 1.7, color: "rgba(255, 255, 255, 0.95)", maxWidth: "800px", margin: 0 }}>
            Because fresh meat and pristine seafood are perishable bio-proteins, <strong>TeFFe&apos;s</strong> does not use conventional generic couriers. We dispatch directly from our registered Ranchi butcher hubs in specialized insulated chill packs maintaining strict food hygiene.
          </p>
        </div>

        {/* Content Clauses */}
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          
          {/* Clause 1: Delivery Speeds */}
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
                <FontAwesomeIcon icon={faClock} />
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                1. Delivery Speeds &amp; Options at Checkout
              </h2>
            </div>
            <p style={{ color: "var(--gray-700)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "16px" }}>
              Patrons across Ranchi can choose from three optimized fulfillment options during checkout:
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
              <div style={{ padding: "16px", borderRadius: "10px", border: "1.5px solid #fed7d7", background: "#fff5f5" }}>
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "#91000a", marginBottom: "6px" }}>
                  60-Minute Express Rush (+₹50)
                </div>
                <p style={{ fontSize: "0.85rem", color: "#4a5568", margin: 0, lineHeight: 1.6 }}>
                  Direct priority queueing on the butcher table and immediate point-to-point dispatch for urgent meal requirements.
                </p>
              </div>

              <div style={{ padding: "16px", borderRadius: "10px", border: "1.5px solid #bbf7d0", background: "#f0fdf4" }}>
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "#166534", marginBottom: "6px" }}>
                  90-Minute Fresh Cut Standard
                </div>
                <p style={{ fontSize: "0.85rem", color: "#4a5568", margin: 0, lineHeight: 1.6 }}>
                  Standard doorstep turnaround. Live bird inspection, precision butchering, sanitized RO wash, and standard dispatch.
                </p>
              </div>

              <div style={{ padding: "16px", borderRadius: "10px", border: "1.5px solid #bae6fd", background: "#f0f9ff" }}>
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "#0369a1", marginBottom: "6px" }}>
                  Custom 1-Hour Slots
                </div>
                <p style={{ fontSize: "0.85rem", color: "#4a5568", margin: 0, lineHeight: 1.6 }}>
                  Schedule any convenient 1-hour delivery slot between 08:00 AM and 08:00 PM. Cuts are prepared right before the window.
                </p>
              </div>
            </div>
          </div>

          {/* Clause 2: Cold-Chain Thermodynamics (0°C to 4°C) */}
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
                <FontAwesomeIcon icon={faTemperatureLow} />
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                2. Cold-Chain Thermodynamics &amp; Packaging
              </h2>
            </div>
            <p style={{ color: "var(--gray-700)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "12px" }}>
              Standard generic thin polythene bags are strictly banned across TeFFe&apos;s fulfillment centers. We package every order with medical-grade food preservation:
            </p>
            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "10px", color: "var(--gray-700)", fontSize: "0.95rem" }}>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faCheckCircle} style={{ color: "#166534", marginTop: "4px" }} />
                <span><strong>Food-Grade PP Trays:</strong> Fresh cuts are placed inside sanitized polypropylene trays sealed hermetically to lock in natural moisture.</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faCheckCircle} style={{ color: "#166534", marginTop: "4px" }} />
                <span><strong>Non-Toxic Food-Grade Gel Chill Packs:</strong> Insulated thermal pouches surround the meat with frozen gel polymers maintaining 0°C to 4°C throughout transit.</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faCheckCircle} style={{ color: "#166534", marginTop: "4px" }} />
                <span><strong>Tamper-Proof Security Seals:</strong> If the security tape on the outer bag is broken or punctured upon arrival, do not accept the package.</span>
              </li>
            </ul>

            {/* Zero-Thaw Doorstep Verification Callout */}
            <div
              style={{
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                borderRadius: "10px",
                padding: "16px",
                marginTop: "16px",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#065f46", marginBottom: "4px" }}>
                Zero-Thaw Doorstep Verification Guarantee
              </div>
              <p style={{ fontSize: "0.88rem", color: "#047857", margin: 0, lineHeight: 1.6 }}>
                Every patron is entitled and encouraged to feel the cold pack before releasing the OTP to our delivery agent. If the gel packs are completely warm or liquefied, you have the right to request an immediate 60-minute doorstep replacement under our exchange terms.
              </p>
            </div>
          </div>

          {/* Clause 3: Ranchi Delivery Zones */}
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
                  background: "#fef3c7",
                  color: "#b45309",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                <FontAwesomeIcon icon={faLocationDot} />
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                3. Serviceable Neighborhoods in Ranchi
              </h2>
            </div>
            <p style={{ color: "var(--gray-700)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "14px" }}>
              Orders are auto-assigned to the nearest active registered TeFFe&apos;s butchery hub (such as Kishore Ganj, Doranda, or Harmu) based on customer GPS:
            </p>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", textAlign: "left", fontSize: "0.88rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #e2e8f0" }}>
                    <th style={{ padding: "10px 14px", fontWeight: 700, color: "var(--gray-700)" }}>Zone / Neighborhood</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, color: "var(--gray-700)" }}>Promised SLA</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, color: "var(--gray-700)" }}>Packaging Tier</th>
                  </tr>
                </thead>
                <tbody style={{ color: "var(--gray-700)" }}>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>Kishore Ganj, Harmu, Kadru, Argora</td>
                    <td style={{ padding: "10px 14px", color: "#166534", fontWeight: 700 }}>45 – 60 Mins</td>
                    <td style={{ padding: "10px 14px" }}>Active Thermal Pouch + Gel Pack</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>Doranda, Hinoo, Birsa Chowk, Ashok Nagar</td>
                    <td style={{ padding: "10px 14px", color: "#166534", fontWeight: 700 }}>60 – 90 Mins</td>
                    <td style={{ padding: "10px 14px" }}>Insulated Carrier + Dual Ice Pack</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>Lalpur, Morabadi, Kanke Road, Bariatu</td>
                    <td style={{ padding: "10px 14px", color: "#166534", fontWeight: 700 }}>60 – 90 Mins</td>
                    <td style={{ padding: "10px 14px" }}>Double Gel Pouch + Temp Seal</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>Dhurwa (Sector 1-4), Namkum, Kokar</td>
                    <td style={{ padding: "10px 14px", color: "var(--gray-600)", fontWeight: 600 }}>Scheduled Slots</td>
                    <td style={{ padding: "10px 14px" }}>Deep-Chill Seal Pack</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Clause 4: Handover & Bad Weather */}
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
                <FontAwesomeIcon icon={faTriangleExclamation} />
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                4. Recipient Availability &amp; Bad Weather Conditions
              </h2>
            </div>
            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "10px", color: "var(--gray-700)", fontSize: "0.95rem" }}>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ color: "#91000a", fontWeight: 700 }}>•</span>
                <span><strong>Recipient Availability:</strong> Because cuts spoil rapidly at ambient room temperature, please ensure someone is available at the provided address to receive the delivery promptly.</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ color: "#91000a", fontWeight: 700 }}>•</span>
                <span><strong>Unreachable Contact:</strong> Riders will call your registered phone number up to 3 times over 15 minutes. Uncollected orders will return to the hub to protect hygiene.</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ color: "#91000a", fontWeight: 700 }}>•</span>
                <span><strong>Monsoon Delays:</strong> In cases of torrential rains or civic blockages in Ranchi, minor transit delays (20–30 mins) will be communicated via phone or WhatsApp.</span>
              </li>
            </ul>
          </div>

          {/* Helpdesk & Live Dispatch Support Card */}
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
              Live Dispatch &amp; Rider Control Desk
            </h3>
            <p style={{ color: "var(--gray-300)", fontSize: "0.9rem", marginBottom: "18px" }}>
              Need real-time rider tracking or want to update delivery instructions?
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faPhone} style={{ color: "#4ade80", marginTop: "3px", fontSize: "1rem" }} />
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", textTransform: "uppercase", fontWeight: 700 }}>Dispatch Line</div>
                  <a href="tel:9279682955" style={{ color: "#ffffff", fontWeight: 700, fontSize: "0.95rem", textDecoration: "none" }}>+91 92796 82955</a>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faEnvelope} style={{ color: "#ff8477", marginTop: "3px", fontSize: "1rem" }} />
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", textTransform: "uppercase", fontWeight: 700 }}>Support Email</div>
                  <a href="mailto:rakeshroshanteffes@gmail.com" style={{ color: "#ffffff", fontWeight: 700, fontSize: "0.95rem", textDecoration: "none" }}>rakeshroshanteffes@gmail.com</a>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faLocationDot} style={{ color: "#ff8477", marginTop: "3px", fontSize: "1rem" }} />
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", textTransform: "uppercase", fontWeight: 700 }}>Main Dispatch Hub</div>
                  <div style={{ color: "var(--gray-200)", fontSize: "0.85rem" }}>Harmu Road, Kishore Ganj, Ranchi 834001</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
              <a
                href="https://wa.me/919279682955?text=Hello%20Teffes%2C%20I%20need%20assistance%20with%20my%20delivery%20dispatch."
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
                <FontAwesomeIcon icon={faWhatsapp} style={{ fontSize: "1.1rem" }} /> Track Order on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
