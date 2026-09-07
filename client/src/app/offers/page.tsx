"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function OffersPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2500);
    }
  };

  const offers = [
    {
      id: "offer-1",
      badge: "Exclusive Gift",
      title: "FREE 300g Premium Basmati Rice",
      desc: "Get a complimentary pack of fragrant Aged Basmati Rice with every fresh Chicken, Mutton, or Fish order worth ₹499 or more.",
      code: "AUTORICE",
      isAuto: true,
      tag: "Auto-applied in cart",
      color: "border-amber-400 bg-amber-50/50",
      icon: "rice_bowl",
      iconBg: "bg-amber-100 text-amber-800",
    },
    {
      id: "offer-2",
      badge: "New Customer Special",
      title: "15% OFF on Your First Fresh Meat Order",
      desc: "Enjoy 15% instant discount on your initial fresh butcher cut purchase. Valid on Chicken, Mutton & Fish cuts above ₹249.",
      code: "TEFFES15",
      isAuto: false,
      tag: "Valid on first 3 orders",
      color: "border-primary/30 bg-crimson-soft/50",
      icon: "celebration",
      iconBg: "bg-primary/10 text-primary",
    },
    {
      id: "offer-3",
      badge: "Express Shipping",
      title: "100% Free Express 90-Min Delivery",
      desc: "Free speedy doorstep delivery across Ranchi on all orders totaling ₹199 and above. Dispatched in insulated packs.",
      code: "FREESHIP",
      isAuto: true,
      tag: "Auto-applied on ₹199+",
      color: "border-emerald-300 bg-emerald-50/50",
      icon: "bolt",
      iconBg: "bg-emerald-100 text-emerald-800",
    },
    {
      id: "offer-4",
      badge: "Weekend Feast",
      title: "Flat ₹50 Cashback on Mutton & Fish Combos",
      desc: "Order any fresh Mutton cut alongside fresh Rohu fish totaling ₹799+ and receive ₹50 cashback directly to your Teffes Cash wallet.",
      code: "SUNDAYFEAST",
      isAuto: false,
      tag: "Valid Wednesday & Sunday",
      color: "border-purple-300 bg-purple-50/40",
      icon: "savings",
      iconBg: "bg-purple-100 text-purple-800",
    },
  ];

  return (
    <div className="w-full min-h-screen bg-[#f8fafc] py-8 sm:py-12 font-body-md text-on-surface">
      <div className="w-full max-w-container-max mx-auto px-gutter-desktop">
        {/* ─── Breadcrumb ───────────────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-body mb-6">
          <Link href="/" className="hover:text-primary transition-colors text-inherit">
            Home
          </Link>
          <span>/</span>
          <span className="font-bold text-gray-900">Special Offers &amp; Deals</span>
        </nav>

        {/* ─── Page Title Banner ────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-10 border border-gray-200/80 shadow-xs mb-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-label-badge text-label-badge uppercase font-bold text-[11px] mb-2">
              <span className="material-symbols-outlined text-[16px]">local_fire_department</span>
              <span>Ranchi City Best Value</span>
            </div>
            <h1 className="font-headline-xl text-3xl sm:text-4xl font-black text-on-surface tracking-tight">
              Teffe&apos;s Special Offers &amp; Deals
            </h1>
            <p className="text-xs sm:text-sm text-slate-body mt-1 leading-relaxed">
              Explore authentic butcher shop promotions, free gift milestones, and discount coupons for healthy, hygienic meat delivered straight to your home.
            </p>
          </div>
        </div>

        {/* ─── Offers Grid ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 mb-12">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className={`rounded-3xl p-6 border ${offer.color} shadow-2xs hover:shadow-md transition-all flex flex-col justify-between bg-white`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${offer.iconBg} shrink-0`}>
                      <span className="material-symbols-outlined text-[22px]">{offer.icon}</span>
                    </div>
                    <div>
                      <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 block">
                        {offer.badge}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {offer.tag}
                      </span>
                    </div>
                  </div>
                </div>

                <h3 className="font-headline-sm font-extrabold text-gray-900 text-lg sm:text-xl leading-snug mb-2">
                  {offer.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                  {offer.desc}
                </p>
              </div>

              {/* Coupon Bar & Action Button */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 bg-slate-100/90 py-1.5 px-3 rounded-xl border border-dashed border-gray-300">
                  <span className="font-mono font-bold text-xs text-gray-800 tracking-wider">
                    {offer.code}
                  </span>
                  {!offer.isAuto && (
                    <button
                      type="button"
                      onClick={() => handleCopy(offer.code)}
                      className="text-xs font-bold text-primary hover:underline border-none bg-transparent cursor-pointer p-0"
                    >
                      {copiedCode === offer.code ? "Copied!" : "Copy"}
                    </button>
                  )}
                </div>

                <Link
                  href="/category"
                  className="px-4 py-2 rounded-full bg-primary hover:bg-primary-dark text-white font-label-md font-bold text-xs shadow-xs transition-all text-decoration-none whitespace-nowrap"
                >
                  Shop Cuts →
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* ─── Free Rice Milestone Reminder Banner ──────────────────────────── */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 rounded-3xl p-6 sm:p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-md mb-12">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-[32px]">rice_bowl</span>
            </div>
            <div>
              <span className="bg-white/25 text-white font-label-badge text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full inline-block mb-1">
                Celebration Milestone
              </span>
              <h3 className="font-headline-md font-extrabold text-xl sm:text-2xl">
                Automatic Free Basmati Rice on Orders ₹499+
              </h3>
              <p className="text-xs text-white/90 mt-0.5 max-w-lg leading-relaxed">
                Add any fresh chicken, mutton, or fish cuts to your cart. Once your subtotal reaches ₹499, the 300g Basmati Rice gift is automatically added to your delivery box for free!
              </p>
            </div>
          </div>

          <Link
            href="/category?type=chicken"
            className="px-6 py-3 rounded-full bg-white text-amber-900 font-headline-sm font-extrabold text-xs sm:text-sm hover:bg-gray-100 shadow-sm transition-all whitespace-nowrap text-decoration-none shrink-0"
          >
            Start Your Order
          </Link>
        </div>
      </div>
    </div>
  );
}
