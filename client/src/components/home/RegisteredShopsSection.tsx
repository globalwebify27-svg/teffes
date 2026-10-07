"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";

export interface StoreHub {
  id?: string;
  storeId: string;
  name: string;
  city: string;
  address: string;
  phone?: string;
  status?: string;
  pickupEnabled?: boolean;
  deliveryEnabled?: boolean;
  timings?: string;
  isOpen?: boolean;
  location?: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
  image?: string;
}

// Universal dummy storefront placeholder image for shops without an uploaded photo
const FALLBACK_STORE_IMAGE = "/store-placeholder.svg";


interface RegisteredShopsSectionProps {
  title?: string;
  subtitle?: string;
  badgeText?: string;
  className?: string;
  id?: string;
}

export default function RegisteredShopsSection({
  title = "Visit Our Registered Butcher Shops",
  subtitle = "Experience our open-counter butcheries across Ranchi where you can select live poultry, inspect custom cuts, and collect freshwater catches in person.",
  badgeText = "Verified Physical Hubs & Butchery Outlets",
  className = "",
  id = "registered-shops",
}: RegisteredShopsSectionProps) {
  const [stores, setStores] = useState<StoreHub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch registered stores dynamically from MongoDB via /api/stores
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    api
      .get("/stores")
      .then((res) => {
        if (
          isMounted &&
          res.data?.success &&
          Array.isArray(res.data?.stores)
        ) {
          // Filter out inactive stores
          const activeOnly = res.data.stores.filter(
            (s: StoreHub) => s.status !== "Inactive"
          );
          setStores(activeOnly);
        } else if (isMounted) {
          setStores([]);
        }
      })
      .catch((err) => {
        console.warn("[RegisteredShops] Error fetching stores:", err?.message || err);
        if (isMounted) setStores([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Check scroll position to toggle navigation buttons
  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [stores]);

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = Math.max(340, scrollRef.current.clientWidth * 0.75);
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const getDirectionsUrl = (store: StoreHub) => {
    // Search Google Maps using the exact physical address present in the database
    const addressToSearch = store.address && store.address.trim() !== ""
      ? store.address.toLowerCase().includes("ranchi")
        ? store.address.trim()
        : `${store.address.trim()}, ${store.city || "Ranchi"}`
      : `${store.name}, ${store.city || "Ranchi"}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressToSearch)}`;
  };

  const isSingleShop = stores.length === 1;

  return (
    <section id={id} className={`w-full max-w-container-max mx-auto px-gutter-desktop my-space-2xl ${className}`}>
      {/* ─── Header & Controls ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-crimson-soft text-primary font-label-badge text-label-badge uppercase font-bold tracking-wider border border-primary/20 text-[11px] mb-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>{badgeText}</span>
          </div>
          <h2 className="font-headline-xl text-headline-lg sm:text-headline-xl text-on-surface font-extrabold tracking-tight">
            {title}
          </h2>
          <p className="font-body-md text-body-md text-slate-body max-w-2xl mt-1 leading-relaxed text-sm sm:text-base">
            {subtitle}
          </p>
        </div>

        {/* Carousel Prev/Next Buttons (shown when 2+ shops exist) */}
        {!isLoading && stores.length > 1 && (
          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <button
              type="button"
              onClick={() => handleScroll("left")}
              disabled={!canScrollLeft}
              aria-label="Scroll left"
              className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
                canScrollLeft
                  ? "bg-white text-on-surface border-gray-300 hover:bg-gray-50 hover:border-primary shadow-xs"
                  : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={() => handleScroll("right")}
              disabled={!canScrollRight}
              aria-label="Scroll right"
              className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
                canScrollRight
                  ? "bg-white text-on-surface border-gray-300 hover:bg-gray-50 hover:border-primary shadow-xs"
                  : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── 1. Loading Skeleton State ─── */}
      {isLoading ? (
        <div className="w-full bg-surface-card rounded-3xl border border-gray-200/80 shadow-xs p-6 sm:p-8 md:p-10 animate-pulse">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="w-full lg:w-1/2 aspect-video sm:aspect-[16/10] bg-gray-200/80 rounded-2xl" />
            <div className="w-full lg:w-1/2 space-y-4">
              <div className="h-5 bg-gray-200 rounded w-1/4" />
              <div className="h-8 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="h-16 bg-gray-200 rounded-xl" />
                <div className="h-16 bg-gray-200 rounded-xl" />
              </div>
              <div className="h-12 bg-gray-200 rounded-xl w-full" />
            </div>
          </div>
        </div>
      ) : stores.length === 0 ? (
        /* ─── 2. Industry-Standard Empty State ─── */
        <div className="w-full bg-surface-card rounded-3xl border border-dashed border-gray-300 p-8 sm:p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-gray-400">
            <span className="material-symbols-outlined text-3xl">storefront</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-on-surface mb-2">
            No Stores Currently Available
          </h3>
          <p className="text-slate-body text-sm max-w-md mx-auto mb-6 leading-relaxed">
            There are currently no physical store locations registered or open. You can still order online for fast home delivery across Ranchi!
          </p>
          <Link
            href="/category?type=chicken"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">shopping_bag</span>
            <span>Explore Online Products</span>
          </Link>
        </div>
      ) : isSingleShop ? (
        <div className="w-full bg-surface-card rounded-3xl border border-gray-200/80 shadow-md p-6 sm:p-8 md:p-10 flex flex-col lg:flex-row items-center gap-8 overflow-hidden relative group">
          {/* Left/Top Image Showcase */}
          <div className="w-full lg:w-1/2 aspect-video sm:aspect-[16/10] rounded-2xl overflow-hidden relative shadow-inner bg-neutral-900 shrink-0">
            <img
              src={stores[0].image && stores[0].image.trim() !== "" ? stores[0].image : FALLBACK_STORE_IMAGE}
              alt={stores[0].name}
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src !== FALLBACK_STORE_IMAGE) {
                  target.src = FALLBACK_STORE_IMAGE;
                }
              }}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            
            {/* Top Status Badge */}
            <div className="absolute top-4 left-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/90 text-white font-bold text-[11px] backdrop-blur-xs shadow-sm">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                {stores[0].isOpen !== false ? "Open Now" : "Opens Tomorrow"}
              </span>
            </div>

            {/* Bottom Overlay Info */}
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 mb-0.5">
                <span className="material-symbols-outlined text-[16px]">store</span>
                <span>Flagship Live Butchery Hub</span>
              </div>
              <h3 className="font-headline-md text-lg sm:text-xl font-bold leading-snug">
                {stores[0].name}
              </h3>
            </div>
          </div>

          {/* Right/Bottom Content Details */}
          <div className="w-full lg:w-1/2 flex flex-col justify-between space-y-4">
            <div>
              <div className="inline-block px-2.5 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-2">
                Hub ID: {stores[0].storeId} · {stores[0].city}
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-on-surface">
                {stores[0].name}
              </h3>
              <p className="text-slate-body text-xs sm:text-sm mt-1 leading-relaxed">
                Step inside our physical store for live cut selection, sanitary temperature-controlled packaging, and direct counter pickup.
              </p>
            </div>

            {/* Hub Specifications Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/70">
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <span className="material-symbols-outlined text-[18px]">location_on</span>
                  <span>Physical Address</span>
                </div>
                <p className="text-xs text-on-surface font-medium mt-1 leading-snug">
                  {stores[0].address || "Kishore Ganj Chowk, Harmu Road, Ranchi 834001"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/70">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                  <span className="material-symbols-outlined text-[18px]">schedule</span>
                  <span>Counter Timings</span>
                </div>
                <p className="text-xs text-on-surface font-medium mt-1 leading-snug">
                  {stores[0].timings || "Open Daily: 07:00 AM – 09:00 PM"}
                </p>
              </div>
            </div>

            {/* Hotline & Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <a
                href={getDirectionsUrl(stores[0])}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-dark transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">directions</span>
                <span>Get Directions (Google Maps)</span>
              </a>

              {stores[0].phone && stores[0].phone !== "—" && (
                <a
                  href={`tel:${stores[0].phone.replace(/[^0-9+]/g, "")}`}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-on-surface font-bold text-sm transition-colors border border-gray-200"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">call</span>
                  <span>{stores[0].phone}</span>
                </a>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ─── Case B: Multiple Shops (Smooth Sliding Scroll Window) ─────────────────── */
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex items-stretch gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 pt-1 -mx-gutter-desktop px-gutter-desktop no-scrollbar"
        >
          {stores.map((store, index) => {
            const storeImg = store.image && store.image.trim() !== "" ? store.image : FALLBACK_STORE_IMAGE;
            const isPlanned = store.status === "Planned";
            const isOpen = store.isOpen !== false && !isPlanned;

            return (
              <div
                key={store.storeId || index}
                className="w-[85vw] sm:w-[380px] md:w-[420px] shrink-0 snap-start bg-surface-card rounded-2xl border border-gray-200/85 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Store Visual Header */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-900">
                  <img
                    src={storeImg}
                    alt={store.name}
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src !== FALLBACK_STORE_IMAGE) {
                        target.src = FALLBACK_STORE_IMAGE;
                      }
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

                  {/* Top Status Tags */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10.5px] backdrop-blur-xs text-white shadow-xs ${
                        isOpen
                          ? "bg-emerald-600/90"
                          : isPlanned
                          ? "bg-amber-600/90"
                          : "bg-gray-700/90"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      {isOpen ? "Open Now" : isPlanned ? "Planned Opening Soon" : "Closed Today"}
                    </span>
                  </div>

                  {/* Bottom Store Title */}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block mb-0.5">
                      Outlet #{store.storeId} · {store.city}
                    </span>
                    <h3 className="font-bold text-base sm:text-lg leading-snug line-clamp-1 drop-shadow-xs">
                      {store.name}
                    </h3>
                  </div>
                </div>

                {/* Store Information Details */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    {/* Location Row */}
                    <div className="flex items-start gap-2 text-xs text-slate-700">
                      <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">
                        location_on
                      </span>
                      <span className="line-clamp-2 leading-relaxed font-medium">
                        {store.address || `${store.name}, ${store.city}`}
                      </span>
                    </div>

                    {/* Timings Row */}
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0">
                        schedule
                      </span>
                      <span className="font-medium">
                        {store.timings || "08:00 AM – 08:00 PM"}
                      </span>
                    </div>

                    {/* Phone Row */}
                    {store.phone && store.phone !== "—" && (
                      <div className="flex items-center gap-2 text-xs text-slate-700">
                        <span className="material-symbols-outlined text-[18px] text-blue-600 shrink-0">
                          call
                        </span>
                        <a
                          href={`tel:${store.phone.replace(/[^0-9+]/g, "")}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          {store.phone}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
                    <a
                      href={getDirectionsUrl(store)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary-dark transition-colors shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">directions</span>
                      <span>Directions</span>
                    </a>
                    <Link
                      href="/category?type=all"
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-on-surface font-bold text-xs transition-colors border border-gray-200"
                    >
                      <span>Browse Cuts</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
