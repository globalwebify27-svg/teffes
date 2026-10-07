"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWishlist } from "@/lib/wishlist";
import { isAuthenticated } from "@/lib/auth";
import ProductCard from "@/components/products/ProductCard";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart } from "@fortawesome/free-solid-svg-icons";

export default function WishlistPage() {
  const router = useRouter();
  const { wishlistItems, wishlistCount } = useWishlist();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Auth check commented for UI demo preview
    // if (!isAuthenticated()) {
    //   router.push("/login");
    // } else {
    setIsCheckingAuth(false);
    // }
  }, [router]);

  if (isCheckingAuth) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div className="spinner spinner-dark" style={{ width: "36px", height: "36px", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--gray-500)", fontSize: "0.9rem" }}>Loading your loved items…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#f8fafc", minHeight: "calc(100vh - 120px)", padding: "40px 0 80px" }}>
      <div className="container">
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "32px",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--brand-primary-soft)",
                  color: "var(--brand-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                <FontAwesomeIcon icon={faHeart} />
              </div>
              <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>
                Loved Items ({wishlistCount})
              </h1>
            </div>
            <p style={{ color: "var(--gray-500)", fontSize: "0.9rem" }}>
              Your saved cuts and favorite fresh meats for quick reordering
            </p>
          </div>

          <Link href="/" className="btn btn-outline-red btn-sm">
            ← Continue Shopping
          </Link>
        </div>

        {/* Items Grid or Empty State */}
        {wishlistItems.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              borderRadius: "var(--radius-xl)",
              border: "1px solid var(--gray-200)",
              padding: "60px 24px",
              textAlign: "center",
              maxWidth: "540px",
              margin: "0 auto",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "var(--brand-primary-soft)",
                color: "var(--brand-primary)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2rem",
                marginBottom: "20px",
              }}
            >
              <FontAwesomeIcon icon={faHeart} />
            </div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--gray-900)", marginBottom: "8px" }}>
              No Loved Items Yet
            </h2>
            <p style={{ color: "var(--gray-500)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "24px" }}>
              Click the heart icon on any fresh chicken, mutton, or fish to save it here for later.
            </p>
            <Link href="/" className="btn btn-primary btn-lg">
              Explore Fresh Cuts
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "24px",
            }}
          >
            {wishlistItems.map((product) => (
              <ProductCard key={`wishlist-${product.id}`} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
