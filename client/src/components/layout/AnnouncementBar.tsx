"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";

interface OfferItem {
  id?: string;
  code: string;
  discount: string;
  minOrder?: number;
  validTill?: string;
  isSuperOffer?: boolean;
}

// Initial fallback with all 3 coupons in database so they are instantly available without waiting for network
const DEFAULT_OFFERS: OfferItem[] = [
  {
    code: "FIRST50",
    discount: "₹50 flat off on first order above ₹299",
    minOrder: 299,
    isSuperOffer: true,
  },
  {
    code: "FRESH10",
    discount: "10% instant discount on orders above ₹499",
    minOrder: 499,
    isSuperOffer: false,
  },
  {
    code: "TEFFESFREE",
    discount: "100% Free express delivery on orders above ₹399",
    minOrder: 399,
    isSuperOffer: false,
  },
];

export default function AnnouncementBar() {
  const [offers, setOffers] = useState<OfferItem[]>(DEFAULT_OFFERS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Fetch all active coupons from backend without filtering out any super offer
    api.get<{ success: boolean; count?: number; coupons: any[] }>("/coupons/active")
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.coupons) && res.data.coupons.length > 0) {
          // Include EVERY coupon from data, sorting super offer first for prominent display
          const allCoupons = [...res.data.coupons].sort((a, b) => {
            if (a.isSuperOffer && !b.isSuperOffer) return -1;
            if (!a.isSuperOffer && b.isSuperOffer) return 1;
            return 0;
          });
          setOffers(allCoupons);
        }
      })
      .catch((err) => {
        console.warn("AnnouncementBar active coupons fetch error:", err);
      });
  }, []);

  // Timer to rotate all offers one by one every 3 seconds
  useEffect(() => {
    if (offers.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % offers.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [offers.length, isPaused]);

  const currentOffer = offers.length > 0 ? offers[currentIndex % offers.length] : null;

  return (
    <div className="w-full bg-primary text-on-primary py-2 px-gutter-desktop border-b border-primary-container/40 select-none">
      <div className="w-full max-w-container-max mx-auto flex items-center justify-between font-label-md text-label-md">
        {/* Left Section: All offers sliding left-to-right one by one before the separator line */}
        <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1 sm:flex-initial">
          <span className="material-symbols-outlined text-[17px] text-amber-300 flex-shrink-0 animate-pulse">
            local_offer
          </span>

          {/* Animated Offer Container with all coupons cycling one by one */}
          <div
            className="relative overflow-hidden min-w-0 max-w-[320px] sm:max-w-[460px] md:max-w-[560px] h-6 flex items-center"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {currentOffer ? (
              <Link
                key={currentOffer.code + "-" + currentIndex}
                href="/offers"
                className="font-bold truncate text-[13px] flex items-center gap-2 text-white hover:underline text-decoration-none animate-offer-slide"
                title={`${currentOffer.code}: ${currentOffer.discount} - Click to see all ${offers.length} offers`}
              >
                {/* Coupon Code Pill */}
                <span className="bg-white/20 text-white font-mono px-2 py-0.5 rounded text-[11px] uppercase tracking-wider font-extrabold shrink-0 border border-white/25 shadow-xs flex items-center gap-1">
                  {currentOffer.isSuperOffer && (
                    <span className="text-amber-300 text-[10px]">★</span>
                  )}
                  <span>{currentOffer.code}</span>
                </span>

                {/* Discount Description */}
                <span className="truncate">{currentOffer.discount}</span>

                {/* Minimum Order Qualifier */}
                {currentOffer.minOrder !== undefined && currentOffer.minOrder > 0 && (
                  <span className="hidden sm:inline text-white/80 text-[11.5px] font-normal shrink-0">
                    (Min Order ₹{currentOffer.minOrder})
                  </span>
                )}
              </Link>
            ) : (
              <span className="font-bold truncate text-[13px] text-white">
                Fresh Hand-Cut Meats &amp; Farm Fresh Poultry in Ranchi
              </span>
            )}
          </div>

          {/* Divider Line & 90-Min delivery guarantee */}
          <span className="hidden md:inline text-on-primary-container px-1 flex-shrink-0">|</span>
          <span className="hidden md:inline font-medium text-white/90 text-[13px] flex-shrink-0">
            90-Min Delivery within 5Km of Kacheri Chowk
          </span>
        </div>

        {/* Right Section: Trust badges */}
        <div className="hidden lg:flex items-center gap-4 font-label-badge text-label-badge uppercase tracking-wider flex-shrink-0">
          <span className="bg-tertiary text-on-tertiary px-3 py-1 rounded-full flex items-center gap-1.5 font-bold shadow-xs border border-tertiary-fixed/30 text-[11px] whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-tertiary-fixed inline-block animate-pulse"></span>
            FSSAI Certified Fresh
          </span>
          <span className="text-on-primary-container font-medium text-[12px] whitespace-nowrap">
            Never Frozen Butcher Standard
          </span>
        </div>
      </div>
    </div>
  );
}
