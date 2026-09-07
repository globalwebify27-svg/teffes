"use client";

import React from "react";

export default function AnnouncementBar() {
  return (
    <div className="w-full bg-primary text-on-primary py-2.5 px-gutter-desktop border-b border-primary-container/40">
      <div className="w-full max-w-container-max mx-auto flex items-center justify-between font-label-md text-label-md">
        <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
          <span className="material-symbols-outlined text-[17px] text-tertiary-fixed flex-shrink-0">
            bolt
          </span>
          <span className="font-bold truncate text-[13px] flex items-center gap-1.5">
            <span>₹499+ Chicken/Meat Order = 300g Premium Basmati Rice FREE!</span>
            <span className="material-symbols-outlined text-[15px] text-amber-300">rice_bowl</span>
          </span>
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
