"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";

interface SuperOffer {
  code: string;
  discount: string;
  minOrder: number;
  validTill: string;
}

export default function AnnouncementBar() {
  const [superOffer, setSuperOffer] = useState<SuperOffer | null>(null);

  useEffect(() => {
    api.get<{ success: boolean; superOffer: SuperOffer | null }>("/coupons/super-offer")
      .then((res) => {
        if (res.data?.success && res.data.superOffer) {
          setSuperOffer(res.data.superOffer);
        }
      })
      .catch((err) => {
        console.warn("AnnouncementBar super-offer fetch error:", err);
      });
  }, []);

  return (
    <div className="w-full bg-primary text-on-primary py-2.5 px-gutter-desktop border-b border-primary-container/40">
      <div className="w-full max-w-container-max mx-auto flex items-center justify-between font-label-md text-label-md">
        <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
          <span className="material-symbols-outlined text-[17px] text-amber-300 flex-shrink-0">
            local_offer
          </span>
          {superOffer ? (
            <Link
              href="/offers"
              className="font-bold truncate text-[13px] flex items-center gap-2 text-white hover:underline text-decoration-none"
            >
              <span className="bg-white/20 text-white font-mono px-2 py-0.5 rounded text-[11px] uppercase tracking-wider font-extrabold">
                {superOffer.code}
              </span>
              <span className="truncate">{superOffer.discount}</span>
              {superOffer.minOrder > 0 && (
                <span className="hidden sm:inline text-white/80 text-[11.5px] font-normal">
                  (Min Order ₹{superOffer.minOrder})
                </span>
              )}
            </Link>
          ) : (
            <span className="font-bold truncate text-[13px]">
              Fresh Hand-Cut Meats &amp; Farm Fresh Poultry in Ranchi
            </span>
          )}

          <span className="hidden md:inline text-on-primary-container px-1">|</span>
          <span className="hidden md:inline font-medium text-white/90 text-[13px]">
            90-Min Delivery within 5Km of Kacheri Chowk
          </span>
        </div>

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
