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
              <span className="material-symbols-outlined text-[28px]">verified</span>
            </div>
            <div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">Never Frozen Promise</h4>
              <p className="font-body-sm text-body-sm text-slate-body mt-0.5">
                100% Fresh butchery cuts straight from the block to your kitchen.
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
              <Link href="/offers" className="hover:text-primary transition-colors text-inherit">
                Deals &amp; Value Packs
              </Link>
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
            <span className="font-label-md text-label-md text-on-surface font-bold block mb-2">
              Payment Options
            </span>
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 w-full">
              {/* PhonePe */}
              <div className="h-6.5 w-8.5 bg-white rounded-md border border-gray-200/90 shadow-2xs flex items-center justify-center shrink-0" title="PhonePe">
                <svg viewBox="0 0 32 32" className="h-4 w-4">
                  <circle cx="16" cy="16" r="16" fill="#5f259f" />
                  <text x="16" y="21.5" textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="bold" fontFamily="sans-serif">पे</text>
                </svg>
              </div>

              {/* Paytm */}
              <div className="h-6.5 w-8.5 bg-white rounded-md border border-gray-200/90 shadow-2xs flex items-center justify-center shrink-0" title="Paytm">
                <span className="font-black text-[10px] tracking-tight leading-none" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  <span style={{ color: '#002970' }}>pay</span>
                  <span style={{ color: '#00b9f5' }}>tm</span>
                </span>
              </div>

              {/* Google Pay (G Pay) */}
              <div className="h-6.5 w-8.5 bg-white rounded-md border border-gray-200/90 shadow-2xs flex items-center justify-center gap-0.5 shrink-0" title="Google Pay">
                <svg viewBox="0 0 24 24" className="w-3 h-3">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span className="text-[9.5px] font-semibold text-gray-700 tracking-tight">Pay</span>
              </div>

              {/* Cash on Delivery (COD) */}
              <div className="h-6.5 w-8.5 bg-white rounded-md border border-gray-200/90 shadow-2xs flex items-center justify-center shrink-0" title="Cash on Delivery">
                <svg viewBox="0 0 36 20" className="h-3.5 w-6" fill="none">
                  <rect x="1" y="1" width="34" height="18" rx="2" stroke="#16a34a" strokeWidth="1.5" fill="#f0fdf4"/>
                  <circle cx="18" cy="10" r="5" stroke="#16a34a" strokeWidth="1" fill="#dcfce7"/>
                  <text x="18" y="12.5" textAnchor="middle" fill="#16a34a" fontSize="6.5" fontWeight="900" fontFamily="sans-serif">COD</text>
                </svg>
              </div>

              {/* Mastercard */}
              <div className="h-6.5 w-8.5 bg-white rounded-md border border-gray-200/90 shadow-2xs flex items-center justify-center shrink-0" title="Mastercard">
                <svg viewBox="0 0 32 20" className="h-3 w-5">
                  <circle cx="11" cy="10" r="8" fill="#EB001B"/>
                  <circle cx="21" cy="10" r="8" fill="#F79E1B" fillOpacity="0.92"/>
                </svg>
              </div>

              {/* Visa */}
              <div className="h-6.5 w-8.5 bg-white rounded-md border border-gray-200/90 shadow-2xs flex items-center justify-center shrink-0" title="Visa">
                <span className="font-black italic text-[10px] tracking-wider leading-none" style={{ color: '#1A1F71', fontFamily: 'sans-serif' }}>
                  VISA
                </span>
              </div>

              {/* American Express (Amex) */}
              <div className="h-6.5 w-8.5 bg-white rounded-md border border-gray-200/90 shadow-2xs flex items-center justify-center shrink-0" title="American Express">
                <div className="w-4.5 h-3.5 bg-[#006FCF] rounded-xs flex flex-col items-center justify-center">
                  <span className="text-white text-[4.5px] font-black tracking-tighter leading-none text-center">
                    AMEX
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Copyright Bar */}
      <div className="w-full bg-surface-container py-space-md border-t border-gray-200/60">
        <div className="w-full max-w-container-max mx-auto px-gutter-desktop flex flex-col md:flex-row items-center justify-between gap-space-sm font-body-sm text-body-sm text-slate-subtle text-center md:text-left">
          <p>
            © 2026 TeFFe&apos;s. All Rights Reserved. | Designed &amp; Developed by{" "}
            <a
              href="https://indiwebsolution.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-semibold"
            >
              Indiweb Solution
            </a>
          </p>
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
