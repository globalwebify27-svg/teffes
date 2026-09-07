"use client";

import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full bg-surface-container-low mt-space-3xl border-t border-gray-200/80">
      {/* 3 Proof Points Strip */}
      <div className="w-full bg-surface-container py-space-lg border-b border-gray-200/60">
        <div className="w-full max-w-container-max mx-auto px-gutter-desktop grid grid-cols-1 md:grid-cols-3 gap-space-lg">
          <div className="flex items-center gap-space-md">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-[28px]">timer</span>
            </div>
            <div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">90 Mins Express Cut</h4>
              <p className="font-body-sm text-body-sm text-slate-body mt-0.5">
                Butchered fresh after your order confirmation, never stored frozen.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-space-md">
            <div className="w-12 h-12 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary shrink-0">
              <span className="material-symbols-outlined text-[28px]">verified_user</span>
            </div>
            <div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">60 Mins Exchange Guarantee</h4>
              <p className="font-body-sm text-body-sm text-slate-body mt-0.5">
                No questions asked doorstep refund or fresh replacement promise.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-space-md">
            <div className="w-12 h-12 rounded-full bg-tag-amber-bg flex items-center justify-center text-tag-amber shrink-0">
              <span className="material-symbols-outlined text-[28px]">ac_unit</span>
            </div>
            <div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">Never Frozen Protocol</h4>
              <p className="font-body-sm text-body-sm text-slate-body mt-0.5">
                Chilled between 0-4°C from farm butchery straight to your kitchen.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links & Info */}
      <div className="w-full max-w-container-max mx-auto px-gutter-desktop py-space-2xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-space-xl">
        {/* Brand Col with Original Logo */}
        <div className="lg:col-span-2 space-y-space-md">
          <Link href="/" className="inline-block">
            <img
              src="/teffes-logo-maroon.png"
              alt="TeFFe's — Where health matters most"
              className="h-12 w-auto object-contain"
            />
          </Link>

          <p className="font-body-md text-body-md text-slate-body max-w-sm leading-relaxed">
            Ranchi&apos;s premier artisanal butcher and hygienic meats storefront. Bringing antibiotic-free farm poultry,
            pasture-raised mutton, and pristine fresh catches with precision portioning right to your doorstep.
          </p>

          <div className="flex items-center gap-space-xs pt-1">
            <span className="inline-flex items-center font-label-badge text-label-badge uppercase text-tertiary bg-tertiary-fixed-dim/20 px-3 py-1 rounded-full font-bold border border-tertiary/20 whitespace-nowrap text-[11px]">
              FSSAI Central Reg: 21123004000192
            </span>
          </div>
        </div>

        {/* Fresh Shelves */}
        <div className="space-y-space-sm">
          <h5 className="font-headline-sm text-headline-sm text-on-surface font-bold">Fresh Shelves</h5>
          <ul className="space-y-space-xs font-body-sm text-body-sm text-slate-body list-none p-0 m-0">
            <li>
              <a href="#chicken-section" className="hover:text-primary transition-colors text-inherit">
                Farm Fresh Chicken
              </a>
            </li>
            <li>
              <a href="#mutton-section" className="hover:text-primary transition-colors text-inherit">
                Country Goat &amp; Mutton
              </a>
            </li>
            <li>
              <a href="#fish-section" className="hover:text-primary transition-colors text-inherit">
                Freshwater Fish &amp; Prawns
              </a>
            </li>
            <li>
              <a href="#eggs-section" className="hover:text-primary transition-colors text-inherit font-semibold text-primary">
                Farm &amp; Desi Eggs
              </a>
            </li>
            <li>
              <a href="#chicken-section" className="hover:text-primary transition-colors text-inherit">
                Boneless Breast &amp; Cubes
              </a>
            </li>
          </ul>
        </div>

        {/* Customer Care */}
        <div className="space-y-space-sm">
          <h5 className="font-headline-sm text-headline-sm text-on-surface font-bold">Customer Care</h5>
          <ul className="space-y-space-xs font-body-sm text-body-sm text-slate-body list-none p-0 m-0">
            <li>
              <a href="#special-offer-ribbon" className="hover:text-primary transition-colors text-inherit">
                Deals &amp; Value Packs
              </a>
            </li>
            <li>
              <a href="#about-us" className="hover:text-primary transition-colors text-inherit">
                Our Freshness Philosophy
              </a>
            </li>
            <li>
              <Link href="/return-and-exchange-policy" className="hover:text-primary transition-colors text-inherit">
                Delivery &amp; Dispatch Policy
              </Link>
            </li>
            <li>
              <Link href="/return-and-exchange-policy" className="hover:text-primary transition-colors text-inherit">
                60-Min Exchange Terms
              </Link>
            </li>
            <li>
              <a
                href="https://wa.me/919779687955?text=Hello%20Teffes%2C%20I%20need%20help."
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors text-inherit font-semibold text-tertiary"
              >
                Help &amp; Order Support (WhatsApp)
              </a>
            </li>
          </ul>
        </div>

        {/* Ranchi Hubs & Payment */}
        <div className="space-y-space-sm">
          <h5 className="font-headline-sm text-headline-sm text-on-surface font-bold">Ranchi Hubs</h5>
          <p className="font-body-sm text-body-sm text-slate-body leading-snug">
            Main Dispatch Hub: Kacheri Chowk, Kishore Ganj Chowk, Harmu Road, Ranchi 834001
          </p>
          <p className="font-label-badge text-label-badge text-tertiary uppercase font-bold text-[10.5px]">
            90-Min Zones: Lalpur, Morabadi, Kishore Ganj, Doranda &amp; Harmu
          </p>

          <div className="pt-space-xs">
            <span className="font-label-md text-label-md text-on-surface font-bold block mb-1.5">
              Secure Payments Accepted
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-label-badge text-label-badge bg-surface-card px-2.5 py-1 rounded-md text-on-surface font-semibold shadow-xs border border-gray-200/60 text-[11px]">
                UPI / GPay
              </span>
              <span className="font-label-badge text-label-badge bg-surface-card px-2.5 py-1 rounded-md text-on-surface font-semibold shadow-xs border border-gray-200/60 text-[11px]">
                Cards
              </span>
              <span className="font-label-badge text-label-badge bg-surface-card px-2.5 py-1 rounded-md text-on-surface font-semibold shadow-xs border border-gray-200/60 text-[11px]">
                NetBanking
              </span>
              <span className="font-label-badge text-label-badge bg-surface-card px-2.5 py-1 rounded-md text-on-surface font-semibold shadow-xs border border-gray-200/60 text-[11px]">
                Cash on Delivery
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Copyright Bar */}
      <div className="w-full bg-surface-container py-space-md border-t border-gray-200/60">
        <div className="w-full max-w-container-max mx-auto px-gutter-desktop flex flex-col md:flex-row items-center justify-between gap-space-sm font-body-sm text-body-sm text-slate-subtle text-center md:text-left">
          <p>© 2025 Teffe&apos;s Fresh Meats &amp; Poultry. Hand-cut with pride in Ranchi. All rights reserved.</p>
          <div className="flex items-center gap-space-md font-label-md text-label-md">
            <Link href="/return-and-exchange-policy" className="hover:text-on-surface transition-colors text-inherit">
              Privacy Policy
            </Link>
            <Link href="/return-and-exchange-policy" className="hover:text-on-surface transition-colors text-inherit">
              Terms of Service
            </Link>
            <span className="text-tertiary font-bold">FSSAI Certified</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
