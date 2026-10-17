"use client";

import React from "react";

interface ProductQuantityStepperProps {
  quantity: number;
  onAdd: (e: React.MouseEvent) => void;
  onIncrease: (e: React.MouseEvent) => void;
  onDecrease: (e: React.MouseEvent) => void;
  className?: string;
  roundedClass?: string;
  addLabel?: string;
  showInCartLabel?: boolean;
  size?: "sm" | "md" | "lg";
  compact?: boolean;
  isJustAdded?: boolean;
}

export default function ProductQuantityStepper({
  quantity,
  onAdd,
  onIncrease,
  onDecrease,
  className = "",
  roundedClass = "rounded-full",
  addLabel = "+ ADD",
  showInCartLabel = true,
  size = "md",
  compact = false,
  isJustAdded = false,
}: ProductQuantityStepperProps) {
  // ─── Compact Mode (Used on Product Cards alongside Price) ───────────────────
  if (compact) {
    if (quantity > 0) {
      return (
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={`shrink-0 inline-flex items-center bg-primary text-white rounded-full px-1 py-0.5 shadow-2xs select-none transition-all touch-manipulation h-[32px] sm:h-[34px] ${className}`}
        >
          {/* Minus Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDecrease(e);
            }}
            className="w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-full bg-white/20 hover:bg-white/35 active:scale-90 text-white flex items-center justify-center font-bold border-none cursor-pointer transition-all shrink-0"
            aria-label="Decrease quantity"
            title="Decrease quantity"
          >
            <span className="leading-none select-none text-sm sm:text-base font-bold">−</span>
          </button>

          {/* Quantity Number */}
          <span className="px-2 font-black text-xs sm:text-sm text-white min-w-[20px] text-center leading-none">
            {quantity}
          </span>

          {/* Plus Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onIncrease(e);
            }}
            className="w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-full bg-white/20 hover:bg-white/35 active:scale-90 text-white flex items-center justify-center font-bold border-none cursor-pointer transition-all shrink-0"
            aria-label="Increase quantity"
            title="Increase quantity"
          >
            <span className="leading-none select-none text-sm sm:text-base font-bold">+</span>
          </button>
        </div>
      );
    }

    // Compact + ADD Button
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onAdd(e);
        }}
        className={`shrink-0 inline-flex items-center justify-center gap-1 h-[32px] sm:h-[34px] px-3 sm:px-3.5 rounded-full border border-primary/30 text-primary bg-white hover:bg-primary hover:text-white font-bold text-xs sm:text-[13px] shadow-2xs cursor-pointer transition-all active:scale-95 select-none touch-manipulation ${
          isJustAdded ? "bg-primary text-white border-primary shadow-xs" : ""
        } ${className}`}
      >
        <span className="material-symbols-outlined text-[15px] sm:text-[16px]">
          {isJustAdded ? "done" : "add_shopping_cart"}
        </span>
        <span className="tracking-wide whitespace-nowrap">{isJustAdded ? "ADDED" : addLabel}</span>
      </button>
    );
  }

  // ─── Standard / Full Width Mode ─────────────────────────────────────────────
  const sizeStyles = {
    sm: {
      container: "h-[34px] sm:h-[36px] px-1 text-xs",
      btn: "w-6 h-6 sm:w-7 sm:h-7 text-sm sm:text-base",
      qtyText: "text-xs sm:text-[13px] font-black",
      label: "text-[9px]",
      addBtn: "h-[34px] sm:h-[36px] px-3 text-xs sm:text-[13px]",
      iconSize: "text-[16px]",
    },
    md: {
      container: "h-[40px] sm:h-[42px] px-1.5 sm:px-2 text-xs sm:text-sm",
      btn: "w-7 h-7 sm:w-8 sm:h-8 text-base sm:text-lg",
      qtyText: "text-[13px] sm:text-[14px] font-black",
      label: "text-[9px] sm:text-[10px]",
      addBtn: "h-[40px] sm:h-[42px] px-3 sm:px-4 text-xs sm:text-sm",
      iconSize: "text-[18px]",
    },
    lg: {
      container: "h-[50px] sm:h-[52px] px-3 sm:px-4 text-sm sm:text-base",
      btn: "w-9 h-9 sm:w-10 sm:h-10 text-lg sm:text-xl",
      qtyText: "text-[16px] sm:text-[18px] font-black",
      label: "text-[10px] sm:text-[11px]",
      addBtn: "h-[50px] sm:h-[52px] px-6 text-[15px]",
      iconSize: "text-[20px]",
    },
  }[size];

  if (quantity > 0) {
    return (
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className={`w-full ${roundedClass} bg-primary text-white flex items-center justify-between shadow-sm select-none transition-all touch-manipulation ${sizeStyles.container} ${className}`}
      >
        {/* Decrement Button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDecrease(e);
          }}
          className={`shrink-0 rounded-full bg-white/20 hover:bg-white/35 active:scale-90 text-white flex items-center justify-center font-bold border-none cursor-pointer transition-all duration-150 touch-manipulation ${sizeStyles.btn}`}
          aria-label="Decrease quantity"
          title="Decrease quantity"
        >
          <span className="leading-none select-none">−</span>
        </button>

        {/* Quantity Display */}
        <div className="flex items-center justify-center gap-1 font-bold text-white px-1 leading-none select-none overflow-hidden">
          <span className={`min-w-[16px] text-center ${sizeStyles.qtyText}`}>{quantity}</span>
          {showInCartLabel && (
            <span
              className={`uppercase tracking-wider font-semibold opacity-90 hidden min-[360px]:inline whitespace-nowrap ${sizeStyles.label}`}
            >
              in cart
            </span>
          )}
        </div>

        {/* Increment Button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onIncrease(e);
          }}
          className={`shrink-0 rounded-full bg-white/20 hover:bg-white/35 active:scale-90 text-white flex items-center justify-center font-bold border-none cursor-pointer transition-all duration-150 touch-manipulation ${sizeStyles.btn}`}
          aria-label="Increase quantity"
          title="Increase quantity"
        >
          <span className="leading-none select-none">+</span>
        </button>
      </div>
    );
  }

  // Not in cart: Display "+ ADD" / "+ ADD TO CART" button
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onAdd(e);
      }}
      className={`w-full ${roundedClass} transition-all font-bold cursor-pointer shadow-xs flex items-center justify-center gap-1.5 active:scale-[0.98] select-none touch-manipulation ${
        isJustAdded
          ? "bg-primary text-white shadow-sm"
          : size === "lg"
          ? "bg-white hover:bg-crimson-soft border-2 border-primary text-primary"
          : "btn-hover-fill"
      } ${sizeStyles.addBtn} ${className}`}
    >
      <span className={`material-symbols-outlined ${sizeStyles.iconSize}`}>
        {isJustAdded ? "done" : "add_shopping_cart"}
      </span>
      <span className="tracking-wide whitespace-nowrap">{isJustAdded ? "ADDED" : addLabel}</span>
    </button>
  );
}
