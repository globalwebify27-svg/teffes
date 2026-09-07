import React from "react";

export default function AboutSection() {
  return (
    <section
      id="about-us"
      style={{
        padding: "70px 0",
        background: "#ffffff",
        borderTop: "1px solid var(--gray-100)",
        borderBottom: "1px solid var(--gray-100)",
      }}
    >
      <div className="container" style={{ maxWidth: "1000px", textAlign: "center" }}>
        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "var(--brand-primary-soft)",
            border: "1px solid var(--brand-primary-border)",
            color: "var(--brand-primary-dark)",
            padding: "4px 14px",
            borderRadius: "var(--radius-full)",
            fontSize: "0.8rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "16px",
          }}
        >
          <span>🏆 A Decade of Trust in Ranchi</span>
        </div>

        <h2
          style={{
            fontSize: "clamp(2rem, 3.5vw, 2.75rem)",
            fontWeight: 800,
            color: "var(--gray-900)",
            marginBottom: "20px",
            letterSpacing: "-0.02em",
          }}
        >
          About Us
        </h2>

        {/* Text from the user's uploaded reference image */}
        <p
          style={{
            fontSize: "1.15rem",
            lineHeight: 1.8,
            color: "var(--gray-700)",
            maxWidth: "860px",
            margin: "0 auto 40px",
            fontWeight: 400,
          }}
        >
          With thousands of satisfied customers and Decade of trust, Teffes is now coming online to provide healthy hygienic and fresh chicken, Fish and mutton, With sole purpose of giving options to consumers to chose fresh and clean chicken.
        </p>

        {/* 4 Pillars of Freshness */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "20px",
            textAlign: "left",
          }}
        >
          {[
            {
              icon: "🔪",
              title: "Cut After Order",
              desc: "Never pre-sliced or stored in deep freezers. Every bird or meat cut is prepared freshly once you click order.",
            },
            {
              icon: "💧",
              title: "RO Water Washed",
              desc: "Thoroughly washed with purified water and hygienic temperature-controlled packing.",
            },
            {
              icon: "🛡️",
              title: "100% Chemical Free",
              desc: "Zero formalin, zero artificial growth hormones, and zero chemical preservatives.",
            },
            {
              icon: "⚡",
              title: "90-Min Delivery",
              desc: "Speedy delivery from Kishore Ganj Chowk across Ranchi city straight to your kitchen.",
            },
          ].map((pillar) => (
            <div
              key={pillar.title}
              style={{
                background: "var(--gray-50)",
                border: "1px solid var(--gray-200)",
                borderRadius: "var(--radius-lg)",
                padding: "24px 20px",
                transition: "all var(--transition-base)",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "12px" }}>{pillar.icon}</div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--gray-900)", marginBottom: "6px" }}>
                {pillar.title}
              </h3>
              <p style={{ fontSize: "0.825rem", color: "var(--gray-600)", lineHeight: 1.55 }}>
                {pillar.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
