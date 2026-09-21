"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Product } from "@/lib/products";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { isAuthenticated } from "@/lib/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart as faHeartSolid } from "@fortawesome/free-solid-svg-icons";
import { faHeart as faHeartRegular } from "@fortawesome/free-regular-svg-icons";

export default function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const { addToCart, updateQuantity, getItemQuantity } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const isLiked = isInWishlist(product.id);
  const quantity = getItemQuantity(product.id);

  const origPrice = product.originalPrice || product.price || 0;
  const discount = origPrice > product.price
    ? Math.round(((origPrice - product.price) / origPrice) * 100)
    : 0;

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Auth check commented for UI demo preview
    // if (!isAuthenticated()) {
    //   router.push("/login");
    //   return;
    // }

    toggleWishlist(product.id);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Auth check commented for UI demo preview
    // if (!isAuthenticated()) {
    //   router.push("/login");
    //   return;
    // }

    addToCart(product);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Avoid triggering card navigation when clicking interactive buttons
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest(".qty-control")) {
      return;
    }
    router.push(`/product/${product.id}`);
  };

  return (
    <div
      className="product-card"
      onClick={handleCardClick}
      style={{
        background: "#ffffff",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--gray-200)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "all var(--transition-base)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        position: "relative",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 12px 24px -6px rgba(0,0,0,0.1)";
        e.currentTarget.style.borderColor = "var(--brand-primary-border)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
        e.currentTarget.style.borderColor = "var(--gray-200)";
      }}
    >
      {/* Product Image & Badges */}
      <div
        style={{
          position: "relative",
          width: "100%",
          paddingTop: "68%",
          overflow: "hidden",
          background: "var(--gray-100)",
        }}
      >
        <img
          src={product.image}
          alt={product.name}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transition: "transform 400ms ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1.0)")}
        />

        {/* Top Left Badges */}
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            zIndex: 2,
          }}
        >
        </div>

        {/* Top Right Like / Heart Icon */}
        <button
          type="button"
          onClick={handleWishlistClick}
          id={`wishlist-btn-${product.id}`}
          aria-label={isLiked ? "Remove from loved items" : "Add to loved items"}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            zIndex: 3,
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "#ffffff",
            border: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: isLiked ? "#dc2d1b" : "var(--gray-400)",
            fontSize: "1.1rem",
            transition: "all 150ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.15)";
            if (!isLiked) e.currentTarget.style.color = "#dc2d1b";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1.0)";
            if (!isLiked) e.currentTarget.style.color = "var(--gray-400)";
          }}
        >
          <FontAwesomeIcon icon={isLiked ? faHeartSolid : faHeartRegular} />
        </button>


        {/* Discount Tag */}
        {discount > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: "8px",
              right: "10px",
              background: "var(--brand-primary)",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: "0.72rem",
              padding: "2px 8px",
              borderRadius: "4px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            }}
          >
            {discount}% OFF
          </div>
        )}
      </div>

      {/* Product Content */}
      <div
        style={{
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "space-between",
        }}
      >
        <div>
          {/* Title & Hindi Translation */}
          <h3
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "var(--gray-900)",
              marginBottom: "3px",
              lineHeight: 1.35,
            }}
          >
            {product.name}
          </h3>

          {product.hindiName && (
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--brand-primary)",
                fontWeight: 600,
                marginBottom: "8px",
              }}
            >
              {product.hindiName}
            </div>
          )}

          {/* Description */}
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--gray-500)",
              lineHeight: 1.45,
              marginBottom: "12px",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {product.description}
          </p>

          {/* Weight & Cuts Meta */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
              fontSize: "0.75rem",
              color: "var(--gray-600)",
              marginBottom: "16px",
              padding: "6px 10px",
              background: "var(--gray-50)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <span>⚖️ <strong>Net: {product.netWeight}</strong></span>
            {product.pieces && <span>• {product.pieces}</span>}
            {product.serves && <span>• {product.serves}</span>}
          </div>
        </div>

        {/* Pricing & Add to Cart */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "10px",
            borderTop: "1px solid var(--gray-100)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
              <span
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 800,
                  fontFamily: "var(--font-display)",
                  color: "var(--gray-950)",
                }}
              >
                ₹{product.price}
              </span>
              <span
                style={{
                  fontSize: "0.825rem",
                  color: "var(--gray-400)",
                  textDecoration: "line-through",
                  textDecorationColor: "var(--brand-primary)",
                }}
              >
                ₹{product.originalPrice}
              </span>
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--gray-400)" }}>Inclusive of all taxes</span>
          </div>

          {/* Add to Cart / Quantity Controller */}
          {quantity > 0 ? (
            <div className="qty-control">
              <button
                type="button"
                className="qty-btn"
                onClick={() => updateQuantity(product.id, quantity - 1)}
                aria-label={`Decrease ${product.name}`}
              >
                −
              </button>
              <span className="qty-val">{quantity}</span>
              <button
                type="button"
                className="qty-btn"
                onClick={() => updateQuantity(product.id, quantity + 1)}
                aria-label={`Increase ${product.name}`}
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-outline-red btn-sm btn-hover-fill"
              onClick={handleAddToCart}
              id={`add-btn-${product.id}`}
              style={{ fontWeight: 700 }}
            >
              + ADD
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
