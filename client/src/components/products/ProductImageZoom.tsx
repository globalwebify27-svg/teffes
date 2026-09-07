"use client";

import React, { useState, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart as faHeartSolid, faShareNodes, faMagnifyingGlassPlus, faCheck } from "@fortawesome/free-solid-svg-icons";
import { faHeart as faHeartRegular } from "@fortawesome/free-regular-svg-icons";
import { useWishlist } from "@/lib/wishlist";
import { isAuthenticated } from "@/lib/auth";
import { useRouter } from "next/navigation";

interface ProductImageZoomProps {
  productId: string;
  productName: string;
  images: string[];
  badge?: string;
}

export default function ProductImageZoom({
  productId,
  productName,
  images,
  badge,
}: ProductImageZoomProps) {
  const router = useRouter();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const isLiked = isInWishlist(productId);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });
  const [zoomStyle, setZoomStyle] = useState({ backgroundPosition: "0% 0%", backgroundSize: "250%" });
  const [copiedShare, setCopiedShare] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const currentImage = images[selectedImageIndex] || images[0] || "";

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const width = rect.width;
    const height = rect.height;

    // Lens dimensions
    const lensW = width * 0.38;
    const lensH = height * 0.38;

    // Constrain lens inside boundaries
    let x = mouseX - lensW / 2;
    let y = mouseY - lensH / 2;

    x = Math.max(0, Math.min(x, width - lensW));
    y = Math.max(0, Math.min(y, height - lensH));

    setLensPos({ x, y });

    // Calculate background zoom percentage
    const xPercent = (x / (width - lensW)) * 100;
    const yPercent = (y / (height - lensH)) * 100;

    setZoomStyle({
      backgroundPosition: `${xPercent}% ${yPercent}%`,
      backgroundSize: "280%",
    });
  }, []);

  const handleMouseEnter = () => {
    // Only enable hover zoom on non-touch desktop screens
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setIsHovering(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Auth check commented for UI demo preview
    // if (!isAuthenticated()) {
    //   router.push("/login");
    //   return;
    // }
    toggleWishlist(productId);
  };

  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2500);
      }
    } catch {
      // Fallback
    }
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "18px",
        position: "relative",
        flexDirection: "row",
      }}
      className="product-gallery-container"
    >
      {/* ─── Left Thumbnails Strip ────────────────────────────────────────── */}
      {images.length > 1 && (
        <div
          className="product-thumbnails-list"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            flexShrink: 0,
          }}
        >
          {images.map((imgUrl, idx) => {
            const isSelected = idx === selectedImageIndex;
            return (
              <button
                key={`thumb-${idx}`}
                type="button"
                onClick={() => setSelectedImageIndex(idx)}
                onMouseEnter={() => setSelectedImageIndex(idx)}
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "var(--radius-md)",
                  border: isSelected ? "2.5px solid var(--brand-primary)" : "1.5px solid var(--gray-200)",
                  padding: "2px",
                  background: "#ffffff",
                  cursor: "pointer",
                  overflow: "hidden",
                  transition: "all 150ms ease",
                  boxShadow: isSelected ? "0 4px 12px rgba(220, 45, 27, 0.25)" : "none",
                  transform: isSelected ? "scale(1.04)" : "scale(1)",
                }}
                aria-label={`Select product image ${idx + 1}`}
              >
                <img
                  src={imgUrl}
                  alt={`${productName} thumbnail ${idx + 1}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: "calc(var(--radius-md) - 3px)",
                  }}
                />
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Main Image Viewer with Interactive Lens ────────────────────────── */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          position: "relative",
          flex: 1,
          width: "100%",
          aspectRatio: "1 / 1",
          maxHeight: "540px",
          background: "var(--gray-50)",
          borderRadius: "var(--radius-xl)",
          overflow: "hidden",
          border: "1px solid var(--gray-200)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          cursor: "crosshair",
        }}
      >
        <img
          src={currentImage}
          alt={productName}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            userSelect: "none",
          }}
        />

        {/* Top Badges */}
        <div
          style={{
            position: "absolute",
            top: "14px",
            left: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            zIndex: 3,
            pointerEvents: "none",
          }}
        >
          {badge && (
            <span
              className={`badge ${
                badge === "Bestseller" || badge === "Special Cut" ? "badge-red" : "badge-green"
              }`}
              style={{ fontSize: "0.8rem", padding: "4px 12px", boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}
            >
              ★ {badge}
            </span>
          )}
          <span
            style={{
              background: "rgba(17, 28, 54, 0.85)",
              backdropFilter: "blur(4px)",
              color: "#ffffff",
              fontSize: "0.725rem",
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: "var(--radius-full)",
            }}
          >
            🔪 Cut On Order
          </span>
        </div>

        {/* Top Right Actions: Wishlist Heart & Share */}
        <div
          style={{
            position: "absolute",
            top: "14px",
            right: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            zIndex: 10,
          }}
        >
          {/* Wishlist Toggle Button */}
          <button
            type="button"
            onClick={handleWishlistClick}
            aria-label={isLiked ? "Remove from loved items" : "Add to loved items"}
            title="Add to Loved Items"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "#ffffff",
              border: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: isLiked ? "#dc2d1b" : "var(--gray-500)",
              fontSize: "1.2rem",
              transition: "transform 150ms ease, color 150ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1.0)")}
          >
            <FontAwesomeIcon icon={isLiked ? faHeartSolid : faHeartRegular} />
          </button>

          {/* Share Button */}
          <button
            type="button"
            onClick={handleShareClick}
            aria-label="Share product"
            title={copiedShare ? "Link copied!" : "Share product link"}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: copiedShare ? "#16a34a" : "#ffffff",
              border: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: copiedShare ? "#ffffff" : "var(--gray-600)",
              fontSize: "1.05rem",
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1.0)")}
          >
            <FontAwesomeIcon icon={copiedShare ? faCheck : faShareNodes} />
          </button>
        </div>

        {/* Interactive Hover Zoom Lens Mesh Rectangle (As in Reference Image 2) */}
        {isHovering && (
          <div
            style={{
              position: "absolute",
              top: `${lensPos.y}px`,
              left: `${lensPos.x}px`,
              width: "38%",
              height: "38%",
              border: "2px solid rgba(37, 99, 235, 0.7)",
              backgroundColor: "rgba(59, 130, 246, 0.22)",
              backgroundImage:
                "radial-gradient(rgba(37, 99, 235, 0.5) 1px, transparent 1px)",
              backgroundSize: "8px 8px",
              pointerEvents: "none",
              boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.5) inset",
              borderRadius: "var(--radius-sm)",
              zIndex: 4,
            }}
          />
        )}

        {/* Hover Zoom Hint Badge on bottom */}
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            right: "12px",
            background: "rgba(0, 0, 0, 0.65)",
            color: "#ffffff",
            fontSize: "0.72rem",
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: "var(--radius-full)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            pointerEvents: "none",
            zIndex: 3,
          }}
        >
          <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
          <span>Hover to Zoom</span>
        </div>
      </div>

      {/* ─── High-Definition Magnified Zoom Preview Window (Right Side Overlay) ── */}
      {isHovering && (
        <div
          className="zoom-preview-window"
          style={{
            position: "absolute",
            left: "calc(100% + 20px)",
            top: 0,
            width: "520px",
            height: "520px",
            zIndex: 100,
            borderRadius: "var(--radius-xl)",
            boxShadow: "0 25px 60px rgba(0, 0, 0, 0.28)",
            border: "2px solid var(--gray-200)",
            background: `#ffffff url(${currentImage}) no-repeat`,
            backgroundPosition: zoomStyle.backgroundPosition,
            backgroundSize: zoomStyle.backgroundSize,
            pointerEvents: "none",
            animation: "zoomFadeIn 150ms ease",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: "12px",
              right: "12px",
              background: "rgba(17, 28, 54, 0.85)",
              color: "#ffffff",
              fontSize: "0.7rem",
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: "var(--radius-full)",
              letterSpacing: "0.04em",
            }}
          >
            🔍 High-Res Butchery Zoom (2.8x)
          </div>
        </div>
      )}
    </div>
  );
}
