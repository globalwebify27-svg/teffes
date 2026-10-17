import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTriangleExclamation,
  faShieldHalved,
  faTemperatureLow,
  faWeightHanging,
  faUtensils,
  faScaleBalanced,
  faPhone,
  faEnvelope,
  faLocationDot,
  faCheckCircle,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";

export const metadata: Metadata = {
  title: "Disclaimer & Food Safety Standards | TeFFe's Ranchi",
  description:
    "Teffes Farm and Foods LLP FSSAI statutory disclosures, microbiological controls, domestic cooking temperatures, and biological variance disclaimer for Ranchi.",
};

export default function DisclaimerPage() {
  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", padding: "40px 0 80px" }}>
      <div className="container" style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 16px" }}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "var(--gray-500)", marginBottom: "20px" }}>
          <Link href="/" style={{ color: "var(--brand-primary)", fontWeight: 600 }}>Home</Link>
          <span>/</span>
          <span style={{ color: "var(--gray-500)" }}>Legal &amp; Policies</span>
          <span>/</span>
          <span style={{ fontWeight: 600, color: "var(--gray-800)" }}>Disclaimer</span>
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
              <FontAwesomeIcon icon={faShieldHalved} /> FSSAI Central Reg. 21123004000192
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
              <FontAwesomeIcon icon={faTriangleExclamation} /> Food Safety Compliance
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
            Disclaimer &amp; FSSAI Health Standards
          </h1>

          <p style={{ fontSize: "1rem", lineHeight: 1.7, color: "rgba(255, 255, 255, 0.95)", maxWidth: "800px", margin: 0 }}>
            Mandatory sanitary and consumer disclosures under the Food Safety and Standards Act (FSSAI), microbiological protocols, biological variances, and domestic culinary guidelines for <strong>TeFFe&apos;s</strong> patrons in Ranchi.
          </p>
        </div>

        {/* Content Clauses */}
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          
          {/* Clause 1: FSSAI Lab Standards & Pathogen Surveillance */}
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
                1. Statutory FSSAI Testing &amp; Veterinary Surveillance
              </h2>
            </div>
            <p style={{ color: "var(--gray-700)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "14px" }}>
              Teffes Farm and Foods LLP operates with active commercial authorization under <strong>FSSAI Central Registration No. 21123004000192</strong>. Processing hubs across Ranchi conform to certified food safety procedures, ensuring that poultry and red meats are tested for common foodborne pathogens:
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", textAlign: "center" }}>
              <div style={{ padding: "12px", borderRadius: "8px", background: "#f8fafc", border: "1px solid var(--gray-200)" }}>
                <span style={{ fontWeight: 700, color: "#166534", fontSize: "0.88rem", display: "block" }}>Salmonella spp.</span>
                <span style={{ fontSize: "0.78rem", color: "var(--gray-500)" }}>Absent in 25g</span>
              </div>
              <div style={{ padding: "12px", borderRadius: "8px", background: "#f8fafc", border: "1px solid var(--gray-200)" }}>
                <span style={{ fontWeight: 700, color: "#166534", fontSize: "0.88rem", display: "block" }}>Listeria monocytogenes</span>
                <span style={{ fontSize: "0.78rem", color: "var(--gray-500)" }}>Absent in 25g</span>
              </div>
              <div style={{ padding: "12px", borderRadius: "8px", background: "#f8fafc", border: "1px solid var(--gray-200)" }}>
                <span style={{ fontWeight: 700, color: "#166534", fontSize: "0.88rem", display: "block" }}>E. coli O157</span>
                <span style={{ fontSize: "0.78rem", color: "var(--gray-500)" }}>Below Threshold (&lt;10 CFU/g)</span>
              </div>
              <div style={{ padding: "12px", borderRadius: "8px", background: "#f8fafc", border: "1px solid var(--gray-200)" }}>
                <span style={{ fontWeight: 700, color: "#166534", fontSize: "0.88rem", display: "block" }}>Antibiotic Residues</span>
                <span style={{ fontSize: "0.78rem", color: "var(--gray-500)" }}>Zero Residual Allowance</span>
              </div>
            </div>
          </div>

          {/* Clause 2: Domestic Safe Cooking & Temperature Storage */}
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
                <FontAwesomeIcon icon={faTemperatureLow} />
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                2. Recommended Domestic Cooking &amp; Storage Temperatures
              </h2>
            </div>
            <p style={{ color: "var(--gray-700)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "14px" }}>
              Consuming raw or undercooked meats presents natural food safety concerns. Customers must refrigerate cuts below 4°C immediately upon delivery, and adhere to recommended internal cooking thermal minimums:
            </p>

            <div style={{ background: "#f8fafc", border: "1px solid var(--gray-200)", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px", fontSize: "0.88rem" }}>
                <span style={{ fontWeight: 600, color: "var(--gray-800)" }}>Whole Poultry, Wings &amp; Chicken Curries</span>
                <span style={{ fontWeight: 700, color: "#91000a" }}>Minimum 74°C (165°F) Core Temp</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px", fontSize: "0.88rem" }}>
                <span style={{ fontWeight: 600, color: "var(--gray-800)" }}>Country Goat &amp; Mutton Portions</span>
                <span style={{ fontWeight: 700, color: "#91000a" }}>Minimum 63°C (145°F) + 3 Min Rest</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.88rem" }}>
                <span style={{ fontWeight: 600, color: "var(--gray-800)" }}>Freshwater Fish &amp; Prawns</span>
                <span style={{ fontWeight: 700, color: "#91000a" }}>Cook until flesh is firm and opaque (63°C)</span>
              </div>
            </div>
          </div>

          {/* Clause 3: Biological Seasonality & Natural Variances */}
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
                <FontAwesomeIcon icon={faWeightHanging} />
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                3. Seafood Seasonality &amp; Biological Variances
              </h2>
            </div>
            <p style={{ color: "var(--gray-700)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "10px" }}>
              Fresh proteins are organic, agricultural products:
            </p>
            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "10px", color: "var(--gray-700)", fontSize: "0.95rem" }}>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faCheckCircle} style={{ color: "#91000a", marginTop: "4px" }} />
                <span>Color, fat marbling, bone thickness, and skin texture naturally vary across farm batches and seasons.</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faCheckCircle} style={{ color: "#91000a", marginTop: "4px" }} />
                <span>Sweet-water fish catches (Rohu, Katla, Prawns) vary in roe presence and fat-belly proportions depending on regional monsoon breeding cycles.</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faCheckCircle} style={{ color: "#91000a", marginTop: "4px" }} />
                <span>TeFFe&apos;s never injects saline solutions, water fillers, or chemical tenderizers to artificially increase delivered grammage.</span>
              </li>
            </ul>
          </div>

          {/* Clause 4: Allergen Advisory Notice */}
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
                <FontAwesomeIcon icon={faUtensils} />
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                4. Allergen Advisory Notice
              </h2>
            </div>
            <p style={{ color: "var(--gray-700)", fontSize: "0.95rem", lineHeight: 1.7, margin: 0 }}>
              While poultry, mutton, and freshwater seafood are processed on dedicated stainless steel stations, our Ranchi dispatch hubs handle freshwater fish, prawns, and farm eggs within the overall facility. Customers with acute seafood or crustacean allergies should exercise due caution.
            </p>
          </div>

          {/* Clause 5: Limitation of Liability */}
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
                5. Limitation of Liability &amp; Legal Jurisdiction
              </h2>
            </div>
            <p style={{ color: "var(--gray-700)", fontSize: "0.95rem", lineHeight: 1.7, margin: 0 }}>
              In no circumstance shall Teffes Farm and Foods LLP or its butchers be liable for consequential damages exceeding the direct order invoice value paid by the customer. All legal disputes and arbitrations are subject strictly to the <strong>exclusive jurisdiction of the Courts of Ranchi, Jharkhand</strong>.
            </p>
          </div>

          {/* Helpdesk & Safety Desk Contact Card */}
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
              Food Safety &amp; Quality Audit Desk
            </h3>
            <p style={{ color: "var(--gray-300)", fontSize: "0.9rem", marginBottom: "18px" }}>
              Have questions regarding FSSAI compliance or fresh butchery standards?
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faEnvelope} style={{ color: "#ff8477", marginTop: "3px", fontSize: "1rem" }} />
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", textTransform: "uppercase", fontWeight: 700 }}>Quality Email</div>
                  <a href="mailto:support@teffes.com" style={{ color: "#ffffff", fontWeight: 700, fontSize: "0.95rem", textDecoration: "none" }}>support@teffes.com</a>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faPhone} style={{ color: "#4ade80", marginTop: "3px", fontSize: "1rem" }} />
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", textTransform: "uppercase", fontWeight: 700 }}>Helpline</div>
                  <a href="tel:9779687955" style={{ color: "#ffffff", fontWeight: 700, fontSize: "0.95rem", textDecoration: "none" }}>+91 9779687955</a>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FontAwesomeIcon icon={faLocationDot} style={{ color: "#ff8477", marginTop: "3px", fontSize: "1rem" }} />
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--gray-400)", textTransform: "uppercase", fontWeight: 700 }}>Central Hub</div>
                  <div style={{ color: "var(--gray-200)", fontSize: "0.85rem" }}>Plot 42, Main Road, Kishore Ganj, Ranchi 834001</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
              <a
                href="https://wa.me/919779687955?text=Hello%20Teffes%2C%20I%20have%20an%20inquiry%20regarding%20Food%20Safety."
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
                <FontAwesomeIcon icon={faWhatsapp} style={{ fontSize: "1.1rem" }} /> WhatsApp Food Safety Desk
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
