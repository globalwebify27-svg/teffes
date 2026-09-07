"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Category, CATEGORIES } from "@/lib/products";

// Real Teffes banner images — same CDN used by teffes.com
const HERO_SLIDES = [
  {
    src: "https://cdn.dotpe.in/longtail/themes/7524323/v1PJYUqN.webp",
    alt: "Teffes — Fresh Meat Delivered in Ranchi",
  },
  {
    // Use a local fallback with a food-quality dark overlay for second slide
    src: "/hero-banner-1.webp",
    alt: "Teffes — 100% Fresh, Cut After Your Order",
  },
  {
    src: "https://cdn.dotpe.in/longtail/themes/8073865/qwaU7Aui.webp",
    alt: "Teffes — No Cold Storage, Pure Freshness",
  },
];

interface HeroBannerProps {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
}

export default function HeroBanner({ selectedCategory, onSelectCategory }: HeroBannerProps) {
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goTo = useCallback((idx: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrent(idx);
      setIsTransitioning(false);
    }, 300);
  }, [isTransitioning]);

  const next = useCallback(() => {
    goTo((current + 1) % HERO_SLIDES.length);
  }, [current, goTo]);

  const prev = useCallback(() => {
    goTo((current - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  }, [current, goTo]);

  // Auto-advance every 4.5 seconds
  useEffect(() => {
    const timer = setInterval(next, 4500);
    return () => clearInterval(timer);
  }, [next]);

  const [activeCoupons, setActiveCoupons] = useState<any[]>([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/coupons/active")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.coupons) {
          setActiveCoupons(data.coupons);
        }
      })
      .catch((err) => console.error("Error fetching coupons:", err));
  }, []);

  return (
    <section style={{ position: "relative", overflow: "hidden" }}>
      {/* ─── Image Slider ──────────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1366 / 420",
          maxHeight: "480px",
          overflow: "hidden",
          background: "#0f172a",
        }}
      >
        {HERO_SLIDES.map((slide, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              opacity: i === current ? (isTransitioning ? 0 : 1) : 0,
              transition: "opacity 0.5s ease-in-out",
              zIndex: i === current ? 1 : 0,
            }}
          >
            <img
              src={slide.src}
              alt={slide.alt}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
              onError={(e) => {
                // Fallback to the downloaded local banner if CDN fails
                (e.target as HTMLImageElement).src = "/hero-banner-1.webp";
              }}
            />
            {/* Subtle dark overlay at bottom for the text section */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.22) 100%)",
              }}
            />
          </div>
        ))}

        {/* ── Navigation Arrows ── */}
        <button
          onClick={prev}
          aria-label="Previous slide"
          style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 10,
            background: "rgba(255,255,255,0.25)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(255,255,255,0.4)",
            color: "#fff",
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            cursor: "pointer",
            fontSize: "1.1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 150ms ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.45)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
        >
          ‹
        </button>
        <button
          onClick={next}
          aria-label="Next slide"
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 10,
            background: "rgba(255,255,255,0.25)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(255,255,255,0.4)",
            color: "#fff",
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            cursor: "pointer",
            fontSize: "1.1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 150ms ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.45)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
        >
          ›
        </button>

        {/* ── Dot Indicators ── */}
        <div
          style={{
            position: "absolute",
            bottom: "14px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            display: "flex",
            gap: "8px",
          }}
        >
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              style={{
                width: i === current ? "24px" : "8px",
                height: "8px",
                borderRadius: "99px",
                border: "none",
                background: i === current ? "#ffffff" : "rgba(255,255,255,0.5)",
                cursor: "pointer",
                padding: 0,
                transition: "all 300ms ease",
              }}
            />
          ))}
        </div>
      </div>

      {/* ─── Dynamic Coupons Banner ────────────────────────────────────────── */}
      {activeCoupons.length > 0 && (
        <div style={{ background: "#fef3c7", padding: "10px 0", borderBottom: "1px solid #fde68a" }}>
          <div className="container" style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "4px" }}>
            {activeCoupons.map((coupon) => (
              <div 
                key={coupon.id} 
                style={{
                  background: "#fff",
                  border: "1px dashed #f59e0b",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  minWidth: "max-content",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                }}
              >
                <div style={{ background: "#f59e0b", color: "#fff", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold", fontSize: "0.85rem" }}>
                  {coupon.code}
                </div>
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#92400e" }}>
                    {coupon.discount}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#b45309" }}>
                    Min order ₹{coupon.minOrder}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Category Selector Below Slider ───────────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1a1210 100%)",
          padding: "24px 0 28px",
        }}
      >
        <div className="container">
          <div style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.5)", marginBottom: "14px" }}>
            Explore Fresh Categories
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "10px",
            }}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.slug;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelectCategory(cat.slug)}
                  style={{
                    background: isSelected ? "var(--brand-primary)" : "rgba(255, 255, 255, 0.07)",
                    border: isSelected ? "1.5px solid rgba(255,255,255,0.3)" : "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "var(--radius-md)",
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    cursor: "pointer",
                    transition: "all var(--transition-fast)",
                    color: "#ffffff",
                    textAlign: "left",
                    transform: isSelected ? "translateY(-1px)" : "none",
                    boxShadow: isSelected ? "0 4px 16px rgba(148,23,23,0.4)" : "none",
                  }}
                >
                  <span style={{ fontSize: "1.4rem" }}>{cat.icon}</span>
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{cat.name}</div>
                    <div style={{ fontSize: "0.68rem", color: isSelected ? "#fee2e2" : "rgba(255,255,255,0.45)" }}>
                      {cat.slug === "all" ? "12+ Items" : "Fresh Cuts"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
