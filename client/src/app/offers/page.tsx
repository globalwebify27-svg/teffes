"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar } from "@fortawesome/free-solid-svg-icons";
import api from "@/lib/api";

interface Coupon {
  _id?: string;
  id?: string;
  code: string;
  discount: string;
  discountType?: "percentage" | "fixed" | "free_delivery";
  discountValue?: number;
  minOrder: number;
  used?: number;
  status: string;
  validTill: string;
  isSuperOffer?: boolean;
}

export default function OffersPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveCoupons();
  }, []);

  const fetchActiveCoupons = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ success: boolean; coupons: Coupon[] }>("/coupons/active");
      if (res.data.success) {
        setCoupons(res.data.coupons || []);
      }
    } catch (err: any) {
      console.error("Failed to load active coupons:", err);
      setError("Unable to load latest promotional offers at this moment.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2500);
    }
  };

  // Helper for styling card according to coupon discount type
  const getStyleForType = (type?: string) => {
    switch (type) {
      case "percentage":
        return {
          color: "border-primary/25 bg-red-50/20",
          badge: "Instant Percentage Off",
          icon: "percent",
          iconBg: "bg-primary/10 text-primary",
        };
      case "free_delivery":
        return {
          color: "border-emerald-300/80 bg-emerald-50/20",
          badge: "Free Express Shipping",
          icon: "bolt",
          iconBg: "bg-emerald-100 text-emerald-800",
        };
      default:
        return {
          color: "border-amber-300/80 bg-amber-50/20",
          badge: "Flat Cash Discount",
          icon: "redeem",
          iconBg: "bg-amber-100 text-amber-800",
        };
    }
  };

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
              Explore authentic butcher shop promotions, instant discount codes, and special coupon milestones for healthy, hygienic meat delivered fresh in Ranchi.
            </p>
          </div>
        </div>

        {/* ─── Offers Content ─────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 mb-12">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="rounded-3xl p-6 border border-gray-200 bg-white animate-pulse flex flex-col justify-between h-48"
              >
                <div>
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
                <div className="h-8 bg-gray-100 rounded-xl w-1/2 mt-4"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl p-10 border border-gray-200 text-center mb-12">
            <span className="material-symbols-outlined text-4xl text-amber-500 mb-2">info</span>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Notice</h3>
            <p className="text-sm text-slate-600 mb-4">{error}</p>
            <button
              onClick={fetchActiveCoupons}
              className="px-5 py-2 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary-dark transition-all"
            >
              Retry
            </button>
          </div>
        ) : coupons.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 border border-gray-200/80 text-center mb-12 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px]">local_offer</span>
            </div>
            <h2 className="font-headline-sm text-xl font-bold text-gray-900 mb-2">
              No Active Coupons Right Now
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
              We update our special promotional discounts regularly. Browse our fresh poultry, mutton, and seafood selection or check back soon!
            </p>
            <Link
              href="/category"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary hover:bg-primary-dark text-white font-bold text-xs shadow-xs transition-all text-decoration-none"
            >
              <span>Explore Fresh Cuts</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        ) : (
          (() => {
            // Find designated Super Offer (or fallback to first coupon)
            const superOffer = coupons.find((c) => c.isSuperOffer) || (coupons.length > 0 ? coupons[0] : null);
            // Strictly filter out the super offer so it is NEVER listed twice on the page
            const regularCoupons = superOffer
              ? coupons.filter((c) => c.code !== superOffer.code)
              : coupons;

            const isSuperCopied = superOffer ? copiedCode === superOffer.code : false;

            return (
              <>
                {/* ─── 1. Featured Super Offer Spotlight ─── */}
                {superOffer && (
                  <div className="bg-gradient-to-r from-[#941717] via-[#a81b1b] to-[#7f1313] rounded-3xl p-6 sm:p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-md mb-10 border border-red-800">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
                        <span className="material-symbols-outlined text-[32px]">stars</span>
                      </div>
                      <div>
                        <span className="bg-amber-400 text-slate-950 font-label-badge text-[10.5px] uppercase font-black px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 mb-1">
                          <FontAwesomeIcon icon={faStar} className="text-slate-950 text-[10px]" />
                          <span>Featured Super Offer</span>
                        </span>
                        <h3 className="font-headline-md font-extrabold text-xl sm:text-2xl">
                          {superOffer.discount}
                        </h3>
                        <p className="text-xs text-white/90 mt-1 max-w-xl leading-relaxed">
                          Use promo code <strong className="font-mono bg-white/20 px-2 py-0.5 rounded text-amber-200 font-bold">{superOffer.code}</strong> at checkout. {superOffer.minOrder > 0 ? `Requires a minimum cart value of ₹${superOffer.minOrder}.` : "Valid on all orders."} Offer valid till {superOffer.validTill}.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(superOffer.code)}
                        className="px-5 py-2.5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300 transition-all cursor-pointer border-none shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {isSuperCopied ? "check" : "content_copy"}
                        </span>
                        <span>{isSuperCopied ? "Copied!" : `Copy ${superOffer.code}`}</span>
                      </button>

                      <Link
                        href="/category"
                        className="px-6 py-2.5 rounded-full bg-white text-primary font-headline-sm font-extrabold text-xs hover:bg-gray-100 shadow-sm transition-all whitespace-nowrap text-decoration-none"
                      >
                        Shop Fresh Cuts
                      </Link>
                    </div>
                  </div>
                )}

                {/* ─── 2. Other Active Coupons Grid (Filtered: Excludes Super Offer) ─── */}
                {regularCoupons.length > 0 && (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="font-headline-sm font-extrabold text-lg sm:text-xl text-gray-900">
                        More Promotional Codes &amp; Deals
                      </h2>
                      <span className="text-xs font-semibold text-slate-500">
                        {regularCoupons.length} offer{regularCoupons.length > 1 ? "s" : ""} available
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 mb-12">
                      {regularCoupons.map((coupon) => {
                        const meta = getStyleForType(coupon.discountType);
                        const isCopied = copiedCode === coupon.code;

                        return (
                          <div
                            key={coupon._id || coupon.id || coupon.code}
                            className={`rounded-3xl p-6 border ${meta.color} shadow-2xs hover:shadow-md transition-all flex flex-col justify-between bg-white`}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta.iconBg} shrink-0`}>
                                    <span className="material-symbols-outlined text-[22px]">{meta.icon}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 block">
                                      {meta.badge}
                                    </span>
                                    <span className="text-xs font-bold text-slate-700">
                                      {coupon.minOrder > 0 ? `Min. Order ₹${coupon.minOrder}` : "No minimum order"}
                                    </span>
                                  </div>
                                </div>

                                {coupon.validTill && (
                                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                                    Till {coupon.validTill}
                                  </span>
                                )}
                              </div>

                              <h3 className="font-headline-sm font-extrabold text-gray-900 text-lg sm:text-xl leading-snug mb-2">
                                {coupon.discount}
                              </h3>
                              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                                Apply promo code <strong className="text-gray-900 font-mono font-bold">{coupon.code}</strong> at checkout to redeem this offer.
                              </p>
                            </div>

                            {/* Coupon Bar & Action Button */}
                            <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 bg-slate-100/90 py-1.5 px-3 rounded-xl border border-dashed border-gray-300">
                                <span className="font-mono font-black text-sm text-gray-900 tracking-wider">
                                  {coupon.code}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(coupon.code)}
                                  className={`text-xs font-bold transition-colors border-none bg-transparent cursor-pointer p-0 flex items-center gap-1 ${
                                    isCopied ? "text-emerald-600" : "text-primary hover:underline"
                                  }`}
                                  title="Copy coupon code"
                                >
                                  {isCopied ? (
                                    <>
                                      <span className="material-symbols-outlined text-[14px]">check</span>
                                      <span>Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <Link
                                href="/category"
                                className="px-4 py-2 rounded-full bg-primary hover:bg-primary-dark text-white font-label-md font-bold text-xs shadow-xs transition-all text-decoration-none whitespace-nowrap"
                              >
                                Shop Cuts →
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            );
          })()
        )}
      </div>
    </div>
  );
}
