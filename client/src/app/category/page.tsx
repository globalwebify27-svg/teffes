"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PRODUCTS, Product, fetchProducts } from "@/lib/products";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";

type CategoryType = "chicken" | "mutton" | "fish" | "eggs";
type SortOption = "featured" | "price-asc" | "price-desc" | "name-asc" | "name-desc";

function CategoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read initial category from query param if available, default to "chicken"
  const typeParam = searchParams.get("type") as CategoryType | null;
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>(
    typeParam && ["chicken", "mutton", "fish", "eggs"].includes(typeParam)
      ? typeParam
      : "chicken"
  );
  const [sortBy, setSortBy] = useState<SortOption>("featured");

  // Sync state if URL query param changes
  useEffect(() => {
    const currentType = searchParams.get("type") as CategoryType | null;
    if (currentType && ["chicken", "mutton", "fish", "eggs"].includes(currentType)) {
      setSelectedCategory(currentType);
    }
  }, [searchParams]);

  const { addToCart, updateQuantity, getItemQuantity } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  // 4 Category Tabs
  const tabs = [
    { key: "chicken" as CategoryType, label: "Chicken", icon: "restaurant", desc: "Curry cuts, lollipops, boneless & wings" },
    { key: "mutton" as CategoryType, label: "Mutton", icon: "kebab_dining", desc: "Tender goat cuts, curry pieces & ribs" },
    { key: "fish" as CategoryType, label: "Fish & Seafood", icon: "set_meal", desc: "Freshwater Rohu, Catla & steaks" },
    { key: "eggs" as CategoryType, label: "Fresh Eggs", icon: "egg", desc: "Farm fresh, organic desi & brown eggs" },
  ];

  const [productsList, setProductsList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch products dynamically from backend API
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchProducts({ category: selectedCategory, sort: sortBy })
      .then((data) => {
        if (isMounted) {
          setProductsList(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error fetching category products:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCategory, sortBy]);

  const sortedProducts = productsList;

  const activeTabMeta = tabs.find((t) => t.key === selectedCategory) || tabs[0];

  const handleTabChange = (key: CategoryType) => {
    setSelectedCategory(key);
    router.push(`/category?type=${key}`);
  };

  return (
    <div className="w-full min-h-screen bg-[#f8fafc] py-6 sm:py-8 font-body-md text-on-surface">
      <div className="w-full max-w-container-max mx-auto px-gutter-desktop">
        {/* ─── Top Breadcrumbs ────────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-body mb-4 flex-wrap">
          <Link href="/" className="hover:text-primary transition-colors text-inherit">
            Home
          </Link>
          <span>/</span>
          <span className="text-slate-400">Categories</span>
          <span>/</span>
          <span className="font-bold text-gray-900">{activeTabMeta.label}</span>
        </nav>

        {/* ─── Hero Title & 4 Category Tabs ─────────────────────────────────── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs mb-6 sm:mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-crimson-soft text-primary font-label-badge text-label-badge uppercase font-bold text-[11px] mb-2">
                <span className="material-symbols-outlined text-[15px]">verified</span>
                <span>Ranchi Fresh Butchery Counter</span>
              </div>
              <h1 className="font-headline-xl text-2xl sm:text-3xl md:text-4xl font-black text-on-surface tracking-tight">
                Fresh {activeTabMeta.label} Cuts
              </h1>
              <p className="text-xs sm:text-sm text-slate-body mt-1 max-w-xl leading-relaxed">
                {activeTabMeta.desc}. Cut fresh upon order with 90-min delivery across Ranchi.
              </p>
            </div>

            {/* Guarantee Badge */}
            <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-2xl border border-gray-200/60 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-tertiary/15 flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[24px]">bolt</span>
              </div>
              <div className="text-left">
                <span className="font-headline-sm font-extrabold text-gray-900 text-xs block">
                  90-Min Express Delivery
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Dispatched from Kishore Ganj Hub
                </span>
              </div>
            </div>
          </div>

          {/* ─── 4 CATEGORY TABS (Chicken auto-selected by default) ─────────── */}
          <div className="mt-6 pt-5 border-t border-gray-100 flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {tabs.map((tab) => {
              const isSelected = selectedCategory === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={`px-5 py-2.5 rounded-full flex items-center gap-2 font-headline-sm font-bold text-xs sm:text-sm cursor-pointer transition-all border-none whitespace-nowrap ${
                    isSelected
                      ? "bg-primary text-white shadow-sm ring-2 ring-primary/20 scale-105"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  }`}
                >
                  <span className={`material-symbols-outlined text-[18px] ${isSelected ? "text-white" : "text-slate-500"}`}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Filter & Sorting Controls ────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200/70 shadow-2xs">
          <div className="text-xs sm:text-sm text-slate-body font-medium">
            Showing <strong className="text-gray-900 font-bold">{sortedProducts.length}</strong> cuts in{" "}
            <strong className="text-primary font-bold">{activeTabMeta.label}</strong>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <label htmlFor="sort-select" className="text-xs font-bold text-gray-500 whitespace-nowrap flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">swap_vert</span>
              <span>Sort By:</span>
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-1.5 bg-surface-container-low border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-primary cursor-pointer"
            >
              <option value="featured">Featured / Recommended</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name-asc">Alphabetical: A to Z</option>
              <option value="name-desc">Alphabetical: Z to A</option>
            </select>
          </div>
        </div>

        {/* ─── Product Grid ─────────────────────────────────────────────────── */}
        {sortedProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 shadow-xs my-8">
            <span className="material-symbols-outlined text-[48px] text-slate-300 mb-2">restaurant</span>
            <h3 className="font-headline-sm font-bold text-gray-900 text-lg">No fresh cuts found</h3>
            <p className="text-xs text-slate-500 mt-1">Please select another category above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 mb-16">
            {sortedProducts.map((item: Product) => {
              const qty = getItemQuantity(item.id);
              const isLiked = isInWishlist(item.id);
              const discount = item.originalPrice > item.price
                ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
                : 0;

              return (
                <div
                  key={item.id}
                  onClick={() => router.push(`/product/${item.id}`)}
                  className="bg-white rounded-2xl overflow-hidden border border-gray-200/80 p-3.5 shadow-2xs hover:shadow-md hover:border-gray-300 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    {/* Image Box */}
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 mb-3 border border-gray-100">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Freshness Badge */}
                      <span className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-xs text-tertiary font-label-badge text-[10.5px] px-2.5 py-0.5 rounded-full font-bold shadow-xs">
                        {item.badge || "Fresh Batch"}
                      </span>

                      {/* Wishlist Heart */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWishlist(item.id);
                        }}
                        className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center shadow-sm cursor-pointer transition-all border border-gray-100 hover:scale-110 active:scale-95 ${
                          isLiked ? "bg-white text-crimson-bright" : "bg-white/90 text-slate-body hover:text-primary"
                        }`}
                        aria-label="Toggle Wishlist"
                      >
                        <span className={`material-symbols-outlined text-[18px] ${isLiked ? "filled text-crimson-bright" : ""}`}>
                          favorite
                        </span>
                      </button>
                    </div>

                    {/* Meta */}
                    <h3 className="font-headline-sm font-bold text-[14px] text-gray-900 group-hover:text-primary transition-colors line-clamp-1 leading-snug">
                      {item.name}
                    </h3>
                    <div className="font-body-sm text-slate-body text-[11.5px] mt-0.5 flex items-center gap-1.5">
                      <span>{item.netWeight}</span>
                      {item.cutType && (
                        <>
                          <span>•</span>
                          <span className="truncate">{item.cutType}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Pricing & Add to Cart */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-headline-sm font-extrabold text-primary text-[15px]">
                          ₹{item.price}
                        </span>
                        {item.originalPrice > item.price && (
                          <span className="font-body-sm text-slate-subtle line-through text-[11px]">
                            ₹{item.originalPrice}
                          </span>
                        )}
                      </div>
                      {discount > 0 && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                          {discount}% OFF
                        </span>
                      )}
                    </div>

                    {/* Quantity Stepper or + ADD Button */}
                    <div onClick={(e) => e.stopPropagation()}>
                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          className="px-4 py-1.5 rounded-full bg-primary hover:bg-primary-dark text-white font-label-badge font-bold text-xs shadow-xs transition-all cursor-pointer border-none flex items-center gap-1"
                        >
                          <span>+</span>
                          <span>ADD</span>
                        </button>
                      ) : (
                        <div className="flex items-center bg-gray-100/90 rounded-full px-1 py-0.5 border border-gray-200">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, qty - 1)}
                            className="w-6 h-6 rounded-full bg-white text-gray-800 hover:bg-primary hover:text-white flex items-center justify-center font-bold text-xs border-none cursor-pointer shadow-2xs"
                          >
                            −
                          </button>
                          <span className="px-2 font-extrabold text-xs text-gray-900 min-w-[18px] text-center">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, qty + 1)}
                            className="w-6 h-6 rounded-full bg-white text-gray-800 hover:bg-primary hover:text-white flex items-center justify-center font-bold text-xs border-none cursor-pointer shadow-2xs"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CategoryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center bg-[#f8fafc]">
          <div className="text-center">
            <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-500">Loading fresh meat cuts…</p>
          </div>
        </div>
      }
    >
      <CategoryContent />
    </Suspense>
  );
}
