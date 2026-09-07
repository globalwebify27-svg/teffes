"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { PRODUCTS, Product, fetchProducts, fetchCategories, Category } from "@/lib/products";

export default function HomePage() {
  const router = useRouter();
  const { addToCart, totalItemsCount, subtotal, openCart, getItemQuantity } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [addedItem, setAddedItem] = useState<string | null>(null);
  const [liveProducts, setLiveProducts] = useState<Product[]>(PRODUCTS);
  const [liveCategories, setLiveCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchProducts().then((prods) => {
      if (prods && prods.length > 0) {
        setLiveProducts(prods);
      }
    });
    fetchCategories().then((cats) => {
      if (cats && cats.length > 0) {
        setLiveCategories(cats);
      }
    });
  }, []);

  // Live product finder
  const findProduct = (id: string, fallback: Partial<Product>): Product => {
    const found = liveProducts.find((p) => p.id === id) || PRODUCTS.find((p) => p.id === id);
    if (found) return found;
    return {
      id,
      name: fallback.name || "Teffes Fresh Cut",
      category: "chicken",
      categoryLabel: "Fresh Meat",
      description: fallback.description || "Hygienic fresh meat cut after order.",
      image: fallback.image || "/teffes-logo-maroon.png",
      netWeight: fallback.netWeight || "1000g",
      price: fallback.price || 280,
      originalPrice: fallback.originalPrice || 300,
      rating: 4.9,
      ratingCount: 150,
      inStock: true,
      ...fallback,
    } as Product;
  };

  const handleAdd = (product: Product, weight?: string) => {
    addToCart(product, weight || product.netWeight);
    setAddedItem(product.id);
    setTimeout(() => setAddedItem(null), 1800);
  };

  return (
    <div className="w-full bg-surface text-on-surface font-body-md pb-20">
      {/* ─── 1. Top Highlight Banner / Hero Section ────────────────────────────── */}
      <section className="w-full max-w-container-max mx-auto px-gutter-desktop pt-4 sm:pt-6">
        <div className="relative overflow-hidden rounded-3xl bg-surface-card shadow-sm border border-gray-100 w-full">
          <div className="relative w-full aspect-[2.6/1] sm:aspect-[2.9/1] min-h-[300px] md:min-h-[380px] max-h-[500px] overflow-hidden">
            <img
              alt="Teffes Fresh Chicken Banner"
              className="w-full h-full object-cover object-center"
              src="https://static.wixstatic.com/media/0655aa_0a9d6dc1f75e4274a933c1ee6095c384~mv2.webp/v1/fill/w_980,h_490,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/Untitled_design_16_1024x1024.webp"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent flex flex-col justify-center px-6 sm:px-12 md:px-16 lg:px-20 text-white">
              <span className="inline-flex items-center gap-1.5 w-max px-3.5 py-1 rounded-full bg-crimson-bright text-white font-label-badge text-label-badge uppercase tracking-wider mb-space-xs font-bold shadow-xs whitespace-nowrap text-[11px]">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span> Daily Fresh Butchery
              </span>

              <h1 className="font-headline-xl text-white font-extrabold max-w-2xl leading-tight text-balance">
                Fresh • Hygienic • Farm-Raised Cuts
              </h1>

              <p className="font-body-md text-white/90 max-w-xl mt-2 hidden sm:block text-balance leading-relaxed">
                100% RO-water cleaned, antibiotic residue-free poultry, tender pasture goat, freshwater fish &amp; farm eggs prepped strictly post-order.
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-5 sm:mt-7">
                <a
                  className="px-6 py-2.5 rounded-full bg-primary text-on-primary font-label-lg text-label-lg hover:bg-primary-container shadow-md transition-all flex items-center gap-2 font-bold cursor-pointer text-decoration-none whitespace-nowrap"
                  href="#chicken-section"
                >
                  <span>Shop Fresh Cuts</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </a>
                <a
                  className="px-6 py-2.5 rounded-full bg-white/95 text-on-surface font-label-lg text-label-lg hover:bg-white shadow-sm backdrop-blur-sm transition-all font-bold cursor-pointer text-decoration-none whitespace-nowrap"
                  href="#special-offer-ribbon"
                >
                  View Offers
                </a>
              </div>
            </div>
          </div>

          {/* Key Service Proof Points Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 bg-surface-container-low p-3 sm:p-4 text-on-surface border-t border-gray-200/50">
            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-surface-card shadow-xs border border-gray-100">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[20px]">bolt</span>
              </div>
              <div>
                <span className="block font-headline-sm text-[13.5px] sm:text-[15px] text-on-surface leading-tight font-bold">
                  90 Mins Delivery
                </span>
                <span className="block font-body-sm text-slate-body text-[11px] sm:text-[12px]">
                  Within 5km Kacheri Chowk
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-surface-card shadow-xs border border-gray-100">
              <div className="w-9 h-9 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary shrink-0">
                <span className="material-symbols-outlined text-[20px]">ac_unit</span>
              </div>
              <div>
                <span className="block font-headline-sm text-[13.5px] sm:text-[15px] text-on-surface leading-tight font-bold">
                  Never Frozen
                </span>
                <span className="block font-body-sm text-slate-body text-[11px] sm:text-[12px]">
                  Chilled at pristine 0°–4°C
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-surface-card shadow-xs border border-gray-100">
              <div className="w-9 h-9 rounded-full bg-crimson-soft flex items-center justify-center text-crimson-bright shrink-0">
                <span className="material-symbols-outlined text-[20px]">content_cut</span>
              </div>
              <div>
                <span className="block font-headline-sm text-[13.5px] sm:text-[15px] text-on-surface leading-tight font-bold">
                  Cut After Order
                </span>
                <span className="block font-body-sm text-slate-body text-[11px] sm:text-[12px]">
                  Handled by master butchers
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-surface-card shadow-xs border border-gray-100">
              <div className="w-9 h-9 rounded-full bg-tag-amber-bg flex items-center justify-center text-tag-amber shrink-0">
                <span className="material-symbols-outlined text-[20px]">verified_user</span>
              </div>
              <div>
                <span className="block font-headline-sm text-[13.5px] sm:text-[15px] text-on-surface leading-tight font-bold">
                  60-Min Exchange
                </span>
                <span className="block font-body-sm text-slate-body text-[11px] sm:text-[12px]">
                  No-fuss replacement policy
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. Rice Promo Ribbon ─────────────────────────────────────────────── */}
      <section className="w-full max-w-container-max mx-auto px-gutter-desktop mt-4 sm:mt-6" id="special-offer-ribbon">
        <div className="bg-gradient-to-r from-tag-amber-bg via-surface-card to-tag-amber-bg rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm border border-tag-amber/30 w-full">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-tag-amber/15 flex items-center justify-center text-tag-amber shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[32px]">rice_bowl</span>
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tag-amber text-white font-label-badge text-label-badge uppercase tracking-wider font-bold text-[10.5px] whitespace-nowrap mb-1">
                Limited Celebration Offer
              </div>
              <h2 className="font-headline-md text-headline-md text-on-surface font-extrabold text-[1.15rem] sm:text-[1.3rem]">
                Order ₹499+ of Chicken or Meat &amp; Get 300g Premium Basmati Rice Free!
              </h2>
              <p className="font-body-sm text-body-sm text-slate-body mt-0.5">
                Auto-applied at checkout for all verified deliveries within Ranchi core zones.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <a
              className="px-6 py-2.5 rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-md transition-all font-bold cursor-pointer text-decoration-none whitespace-nowrap"
              href="#chicken-section"
            >
              Claim With Order
            </a>
          </div>
        </div>
      </section>

      {/* ─── 3. Category Exploration Rail (4 Categories: Chicken, Mutton, Fish, Eggs) ─ */}
      <section className="w-full max-w-container-max mx-auto px-gutter-desktop mt-space-2xl" id="categories">
        <div className="flex items-end justify-between mb-4">
          <div>
            <span className="font-label-badge text-label-badge uppercase tracking-wider text-primary font-bold">
              Butchery Counters
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
              Explore by Category
            </h2>
          </div>
          <span className="font-body-sm text-body-sm text-slate-body hidden sm:inline font-medium">
            Fresh daily stocks sourced this morning
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Chicken Category Card */}
          <a
            className="group relative rounded-2xl overflow-hidden bg-surface-card shadow-sm hover:shadow-md transition-all flex flex-col border border-gray-100 text-decoration-none"
            href="#chicken-section"
          >
            <div className="relative w-full aspect-[4/3] max-h-56 overflow-hidden bg-surface-container">
              <img
                alt="Farm Fresh Chicken"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                src="https://lh3.googleusercontent.com/aida/AEtjO1X2x7S4X3RVOuaQp-M739tR8AMhxqVDuwvLymnWWNXYRHsLYmAceoWr5Yo69MMbOf83sdy3iFg9dLFKdWOYGQzrmGvOAki-4qx9ObpzDxBf9JMXXvVdpDz_RTcJt-MiWzeAdPP_NtDgvcPN_kqT_ee8yzV-FDKwxN6Vp7f0gmpiSAukXyVlnw3inqBufr9Um92InX6WIf0UkSnm43lB2nnFguAMSw-98kPWfQQY4tk40g4zxH3AS1xO2g"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent"></div>
              <span className="absolute top-3 left-3 bg-surface-card/95 text-on-surface text-label-badge font-label-badge px-3 py-1 rounded-full uppercase tracking-wider font-bold shadow-xs whitespace-nowrap text-[10.5px] flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-primary">restaurant</span> 10+ Daily Cuts
              </span>
              <div className="absolute bottom-3 left-4 text-white">
                <span className="font-headline-md text-headline-md block leading-tight font-bold text-white text-[1.15rem]">
                  Farm Fresh Chicken
                </span>
                <span className="font-body-sm text-body-sm text-white/90 text-[12px]">
                  Tender, juicy curry &amp; boneless cuts
                </span>
              </div>
            </div>
            <div className="p-3.5 flex items-center justify-between bg-surface-card">
              <span className="font-label-md text-label-md text-primary font-bold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                Shop Chicken <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </span>
              <span className="font-label-badge text-label-badge text-tertiary bg-tertiary-fixed-dim/20 px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap">
                Starts ₹200
              </span>
            </div>
          </a>

          {/* 2. Mutton Category Card */}
          <a
            className="group relative rounded-2xl overflow-hidden bg-surface-card shadow-sm hover:shadow-md transition-all flex flex-col border border-gray-100 text-decoration-none"
            href="#mutton-section"
          >
            <div className="relative w-full aspect-[4/3] max-h-56 overflow-hidden bg-surface-container">
              <img
                alt="Pasture Raised Mutton"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                src="https://lh3.googleusercontent.com/aida/AEtjO1W7yo26fyVvyTRVk0rinfTgPIaNT54WxnsZFeScD-PV1mMjYpyCKfFnW0u51rC9wOssRPUxh2HN0nHpMLvHKTMPSIQ6aSyQyIHg-rYsK5jB5wDF2UfWAYW7waSZ6GwemLuqJPwvBYlojZwsBvSqloAI6iOAiNZBZAzHXgGuZTmmM_u3Tn073zJ9bQUIH_a9u1k6KoTbKikdE-re_jPikE-J7qfO2DZqqw5on8JCSWnrAAyUnR081fo0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent"></div>
              <span className="absolute top-3 left-3 bg-surface-card/95 text-on-surface text-label-badge font-label-badge px-3 py-1 rounded-full uppercase tracking-wider font-bold shadow-xs whitespace-nowrap text-[10.5px] flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-primary">kebab_dining</span> Pasture Raised
              </span>
              <div className="absolute bottom-3 left-4 text-white">
                <span className="font-headline-md text-headline-md block leading-tight font-bold text-white text-[1.15rem]">
                  Country Goat Mutton
                </span>
                <span className="font-body-sm text-body-sm text-white/90 text-[12px]">
                  Rich, slow-cook tender chops
                </span>
              </div>
            </div>
            <div className="p-3.5 flex items-center justify-between bg-surface-card">
              <span className="font-label-md text-label-md text-primary font-bold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                Shop Mutton <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </span>
              <span className="font-label-badge text-label-badge text-tertiary bg-tertiary-fixed-dim/20 px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap">
                Jharkhand Goat
              </span>
            </div>
          </a>

          {/* 3. Fish & Seafood Category Card */}
          <a
            className="group relative rounded-2xl overflow-hidden bg-surface-card shadow-sm hover:shadow-md transition-all flex flex-col border border-gray-100 text-decoration-none"
            href="#fish-section"
          >
            <div className="relative w-full aspect-[4/3] max-h-56 overflow-hidden bg-surface-container">
              <img
                alt="Freshwater Fish and Seafood"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                src="https://lh3.googleusercontent.com/aida/AEtjO1WCh8DGxL6zlOLLU3E6xWHaQtyHtDhTelW2OumYow--ttadMg_wRKxaMHCrm8yEtybvz_BWGFQuUZvoCB6rg7zU3PrdJft9H10Mc22VcG35ow83Nwkk5uJap7QM8GWXvVgxIKopOKAfoDjs-gYTYV6-Qdzx17hbT6HnEq0MCEQebegIfWKbC3xhOfk6c8Jv2EgbAaIm7uxhHz6Tm3f7h5QTWFsOzE2QnlrEec8kBSCGAsAGzHF7gAfF-g"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent"></div>
              <span className="absolute top-3 left-3 bg-surface-card/95 text-on-surface text-label-badge font-label-badge px-3 py-1 rounded-full uppercase tracking-wider font-bold shadow-xs whitespace-nowrap text-[10.5px] flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-primary">set_meal</span> Clean Steaks
              </span>
              <div className="absolute bottom-3 left-4 text-white">
                <span className="font-headline-md text-headline-md block leading-tight font-bold text-white text-[1.15rem]">
                  Fresh Catch Rohu
                </span>
                <span className="font-body-sm text-body-sm text-white/90 text-[12px]">
                  Descaled, cleaned &amp; sliced
                </span>
              </div>
            </div>
            <div className="p-3.5 flex items-center justify-between bg-surface-card">
              <span className="font-label-md text-label-md text-primary font-bold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                Shop Fish <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </span>
              <span className="font-label-badge text-label-badge text-tag-amber bg-tag-amber-bg px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap">
                Daily Catch
              </span>
            </div>
          </a>

          {/* 4. Eggs Category Card */}
          <a
            className="group relative rounded-2xl overflow-hidden bg-surface-card shadow-sm hover:shadow-md transition-all flex flex-col border border-gray-100 text-decoration-none"
            href="#eggs-section"
          >
            <div className="relative w-full aspect-[4/3] max-h-56 overflow-hidden bg-surface-container">
              <img
                alt="Farm Fresh & Desi Eggs"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                src="https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=800&q=80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent"></div>
              <span className="absolute top-3 left-3 bg-surface-card/95 text-on-surface text-label-badge font-label-badge px-3 py-1 rounded-full uppercase tracking-wider font-bold shadow-xs whitespace-nowrap text-[10.5px] flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-tag-amber">egg</span> Daily Harvest
              </span>
              <div className="absolute bottom-3 left-4 text-white">
                <span className="font-headline-md text-headline-md block leading-tight font-bold text-white text-[1.15rem]">
                  Farm &amp; Desi Eggs
                </span>
                <span className="font-body-sm text-body-sm text-white/90 text-[12px]">
                  Antibiotic-free, rich yellow yolk
                </span>
              </div>
            </div>
            <div className="p-3.5 flex items-center justify-between bg-surface-card">
              <span className="font-label-md text-label-md text-primary font-bold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                Shop Eggs <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </span>
              <span className="font-label-badge text-label-badge text-tertiary bg-tertiary-fixed-dim/20 px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap">
                Starts ₹85
              </span>
            </div>
          </a>
        </div>
      </section>

      {/* ─── 4. Trending & Best Sellers Section ─────────────────────────────────── */}
      <section className="w-full max-w-container-max mx-auto px-gutter-desktop mt-space-3xl">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-space-lg">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">local_fire_department</span>
              <span className="font-label-badge text-label-badge uppercase tracking-wider text-primary font-bold">
                Ranchi Favourites
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
              Trending &amp; Best Sellers
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 font-label-badge text-label-badge bg-crimson-soft text-primary px-3.5 py-1.5 rounded-full font-bold self-start sm:self-auto border border-primary/20 whitespace-nowrap text-[11px]">
            <span className="material-symbols-outlined text-[16px] text-primary">local_fire_department</span>
            <span>Rapid Selling Out Today</span>
          </span>
        </div>

        {/* 5 Best Seller Items */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            {
              id: "chicken-liver-1kg",
              name: "Chicken Liver 1 Kg",
              price: 265,
              originalPrice: 300,
              discount: "12% OFF",
              netWeight: "1000g",
              tag: "In Stock",
              sub: "Rich in iron, cleaned & portioned",
              image:
                "https://lh3.googleusercontent.com/aida/AEtjO1XzvcaeOH9nTHzVUinepJYQIwnsfZZOepX1jRYAfuyvIpLGu93x2ZmCQo52becW2q34ANvzhDL6MFn7LWBzwK5DaMliTgdZb9Vp6VR1Fk2EXPAqVHKR48ZeUQzLTa7zWKQyhVjJj__YDHLxIWgkKbogvTIvg4U5ngY4eXisUnsP9adJsKKfp2c0g2ckloVEf6VjmpOEaEdwvj6aNgdxHpsB7cty010vHxjQoDXXbZjcLi3DEbKIw962pA",
            },
            {
              id: "chicken-whole-1kg",
              name: "Chicken Whole 1kg",
              price: 280,
              originalPrice: 300,
              discount: "7% OFF",
              netWeight: "1000g",
              tag: "Roast & Curry",
              sub: "Dressed, gutted, pristine whole bird",
              image:
                "https://lh3.googleusercontent.com/aida/AEtjO1XAFxevdds-xTIROk3LyLMXddl5eWBMyQGY0HcStRmGal_wzkkG14iM-jeWRAVQhBvdW3v0y15C2iVCMyQbNwENbDtwCXyTaoSEwprZIMCKCKlxNByrrhlvJEItq6xOvaLXZcEM7eNSBSOjOUlgVv0wwfc6PqAFeX2xFAbIO0bvjl1Uj_UDmVd4AN5Bg7ECMkckAJsAbWC8G8jApqI_InXFHz_8MtjDKtaDtYMCgC5b8PDJDH1KElSpHw",
            },
            {
              id: "chicken-boneless-strips-1kg",
              name: "Chicken Boneless Strips 1kg",
              price: 370,
              originalPrice: 420,
              discount: "12% OFF",
              netWeight: "1000g",
              tag: "Gym & Diet",
              sub: "Tender tenderloin & breast strips",
              image:
                "https://lh3.googleusercontent.com/aida/AEtjO1U9gWcuOnnFzi-kuWO6LV6udpXTPTtM5NUGobT9ckutlUjs8jGUzsC2gl13ZV2Db3W6tAiIOH7_4kw0_wQW2CU_rmRaVkHs80wgupRc5wOXINypj_9ZJZdtLsXXSR9Z2ljmEa8njlkuIUwKcAohsAzeIHu7Ok0o49ox1j1oVF-pUfUgIpOcaXDfbw8IocV-Yto2hUP2knBOgjjP71n7SkzV01QFOVXsoYkuhIhdTq7rGEdEpJPFXmpR",
            },
            {
              id: "chicken-boneless-strips-500g",
              name: "Boneless Strips 500gm",
              price: 200,
              originalPrice: 225,
              discount: "11% OFF",
              netWeight: "500g",
              tag: "Portion Pack",
              sub: "Crispy fry & stir-fry ready cuts",
              image:
                "https://lh3.googleusercontent.com/aida/AEtjO1WKENZxOoZOp7uzm1aUWbLU2CZ2RFpxuUvjgVLhiLy27qgPZFiXEKNj1nDI2TuqcILqR_EQxvdDIBeiWkQLnHxczUUQm74xr_hD9kHm9pZWPgd7EXDhzYhqBZSoqKne8QSkNAutN2oZ1FZ72f_KXwUY3ek7Vs6Z2SaK_YY40sRtBVwXzuztKEFT_nkehiuKOXxOJ7bXoJEr6Aq96fIslt4Ep-zRyvmBOHijtATE-bPngd4J_TLJaZvhMw",
            },
            {
              id: "leg-boneless-1kg",
              name: "Leg Boneless 1kg",
              price: 370,
              originalPrice: 400,
              discount: "8% OFF",
              netWeight: "1000g",
              tag: "Tikka & Kabab",
              sub: "Succulent thigh boneless meat",
              image:
                "https://lh3.googleusercontent.com/aida/AEtjO1VMrDA-7mgMHM47GjuN6HPLWNvUrvz3JMJr8LnRAR9O-KI8pwRQ6dzzoeLVvDcc_Y0hyDAjSrLSa29KrBBK0Th4eoQayWlThUOLK-ychjspZ7IbaoxkuIEthOeRUXWONgd9nPZJy4_EBNX8_KyRGM7iRELCB9zY5xxr4itXHDRMHJLLU9nmMfDrSLi7JdcLHlzXzWw2fLVtHRGxhZVI4aINcX9ULM98uallUdE-HoLjtyVmk1XLzWYqTA",
            },
          ].map((item) => {
            const product = findProduct(item.id, item);
            const qty = getItemQuantity(item.id);
            const isJustAdded = addedItem === item.id;
            const wishlisted = isInWishlist(item.id);

            return (
              <article
                key={item.id}
                onClick={() => router.push(`/product/${item.id}`)}
                className="bg-surface-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group border border-gray-100 relative cursor-pointer"
              >
                <div>
                  <div className="relative w-full aspect-square overflow-hidden bg-surface-container">
                    <img
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      src={item.image}
                    />

                    {/* Top Left: Fresh Tag */}
                    <span className="absolute top-2.5 left-2.5 bg-surface-card/95 text-tertiary font-label-badge text-label-badge px-2.5 py-1 rounded-full flex items-center gap-1 font-bold shadow-xs whitespace-nowrap text-[10.5px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span> Never Frozen
                    </span>

                    {/* Top Right: Wishlist Heart Icon Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleWishlist(item.id);
                      }}
                      className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center shadow-xs cursor-pointer transition-all z-10 border border-gray-100 hover:scale-110 active:scale-95 ${wishlisted ? "bg-white text-crimson-bright shadow-sm" : "bg-white/90 text-slate-subtle hover:text-primary"
                        }`}
                      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                      title={wishlisted ? "Loved" : "Add to wishlist"}
                    >
                      <span
                        className={`material-symbols-outlined text-[19px] ${wishlisted ? "filled text-crimson-bright" : ""}`}
                      >
                        favorite
                      </span>
                    </button>

                    {/* Bottom Left: Discount Badge */}
                    {item.discount && (
                      <span className="absolute bottom-2.5 left-2.5 bg-tertiary-fixed text-on-tertiary-fixed-variant font-label-badge text-label-badge px-2.5 py-0.5 rounded-full font-black shadow-xs whitespace-nowrap text-[10.5px]">
                        {item.discount}
                      </span>
                    )}
                  </div>

                  <div className="p-3.5 sm:p-4">
                    <div className="flex items-center justify-between text-slate-body font-body-sm text-body-sm mb-1">
                      <span>Net: {item.netWeight}</span>
                      <span className="text-tertiary font-label-badge font-bold uppercase">{item.tag}</span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold line-clamp-1 group-hover:text-primary transition-colors text-[14.5px]">
                      {item.name}
                    </h3>
                    <p className="font-body-sm text-body-sm text-slate-body mt-0.5 line-clamp-1 text-[12px]">{item.sub}</p>
                  </div>
                </div>

                <div className="p-3.5 sm:p-4 pt-0">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="font-headline-md text-headline-md text-on-surface font-extrabold text-[1.2rem]">
                      ₹{item.price}
                    </span>
                    {item.originalPrice > item.price && (
                      <span className="font-body-sm text-body-sm text-slate-subtle line-through text-[12px]">
                        ₹{item.originalPrice}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAdd(product);
                    }}
                    className={`w-full py-2.5 px-space-sm rounded-full transition-all font-label-md text-label-md flex items-center justify-center gap-1.5 font-bold cursor-pointer border border-transparent shadow-xs ${qty > 0 || isJustAdded
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-surface-container-low text-primary hover:bg-primary hover:text-on-primary"
                      }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {qty > 0 || isJustAdded ? "done" : "add_shopping_cart"}
                    </span>
                    <span>{qty > 0 ? `ADDED (${qty})` : "+ ADD"}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ─── 5. Section Divider / Fresh Meat Mid Banner ────────────────────────── */}
      <section className="w-full max-w-container-max mx-auto px-gutter-desktop mt-space-2xl">
        <div className="relative rounded-3xl overflow-hidden shadow-sm border border-gray-100 w-full">
          <img
            alt="Teffe Fresh Poultry Banner"
            className="w-full h-44 md:h-52 object-cover object-center"
            src="https://hfoods.com.sg/wp-content/uploads/2024/07/Lamb.jpg"
          />
          <div className="absolute inset-0 bg-black/50 flex items-center justify-between px-6 sm:px-12 md:px-16 text-white">
            <div>
              <span className="font-label-badge text-label-badge uppercase tracking-widest text-primary-fixed font-bold text-[11px] whitespace-nowrap">
                Butchered Hygienically
              </span>
              <h3 className="font-headline-lg text-white font-extrabold mt-0.5 text-[1.4rem] sm:text-[1.8rem]">
                Pure Protein. Zero Preservatives.
              </h3>
              <p className="font-body-sm text-body-sm text-white/90 mt-1 hidden sm:block max-w-lg">
                Chilled between 0°C to 4°C right until your doorstep to preserve tender muscle fibres.
              </p>
            </div>
            <a
              className="px-5 py-2.5 bg-surface-card text-primary rounded-full font-label-md text-label-md hover:bg-white transition-colors shadow-md shrink-0 font-bold text-decoration-none cursor-pointer whitespace-nowrap"
              href="#chicken-section"
            >
              View All Cuts
            </a>
          </div>
        </div>
      </section>

      {/* ─── 6. Farm Fresh Chicken Cuts Grid ────────────────────────────────────────── */}
      <section className="w-full max-w-container-max mx-auto px-gutter-desktop mt-space-3xl" id="chicken-section">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-space-lg">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">restaurant</span>
              <span className="font-label-badge text-label-badge uppercase tracking-wider text-primary font-bold">
                Hand Cut Precision
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
              Farm Fresh Chicken Cuts
            </h2>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md font-semibold">
            <span className="bg-surface-card px-3.5 py-1.5 rounded-full shadow-xs text-on-surface border border-gray-200">
              Curry Cuts
            </span>
            <span className="bg-surface-container-low px-3.5 py-1.5 rounded-full text-slate-body">Boneless</span>
            <span className="bg-surface-container-low px-3.5 py-1.5 rounded-full text-slate-body">Speciality</span>
          </div>
        </div>

        {/* 7 Chicken Items + 1 Custom Cuts Showcase */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              id: "chicken-curry-cut-1kg",
              name: "Curry Cut 1 Kg",
              price: 280,
              originalPrice: 300,
              discount: "7% OFF",
              net: "Net: 1000g | Gross: 1050g",
              pcs: "14-16 Pcs",
              badge: "Best Seller",
              desc: "Mix of bone-in & boneless prime pieces ideal for slow Sunday gravies.",
              image:
                "https://lh3.googleusercontent.com/aida/AEtjO1U14IRgfExyqM7RqzBVytYg4RKCip9oYuxZcI-LzlWKFL9AuxhdIvNT7i5pB2BWmYvPKPLXmiX14Acg637SmRFdcAqvmAmZ0AiFrF9rFqGEnX4veNvb9Ui1HrUDGcCZIoI2HITYg22oRubCfHHLTmmv3uowZ8wXkb-zXIcTIA8JInpgLLGx87YIE_YJ7fobrDjw1sXGJV_nM2q-GYdLKj1jgEC54kSi-_suQxMZrUWcARlYbxyUSbSW8A",
            },
            {
              id: "chicken-lollipop-1kg",
              name: "Chicken Lollipop 1kg",
              price: 285,
              originalPrice: 300,
              discount: "5% OFF",
              net: "Net: 1000g",
              pcs: "18-20 Pcs",
              badge: "Snack Special",
              desc: "Clean frenched wingettes and drumettes sculpted for crispy frying.",
              image:
                "https://lh3.googleusercontent.com/aida/AEtjO1UNRNgmV2ikFoRKYpfYTm9xvRRnEhapfsFVLdQpMS-47HWqnVxP_kRPZlPw3PPgVr98slASBEc8zqu_22HbXOPYKMnmgqNcXSP77KPRXX5Pw87wiY_D5JCvgIsdANRI7f7o9XrVvfwEAiL93bx1ofDsG8vixmmQsXQ8t7NZ3AVX1eaWvAk5FT8r0orT-GsbHD5iIcRu7ibbPCfCxr6fYbdui8tkYvfAJX4dg8Ed-ZITWZYjXfeZKFtNbA",
            },
            {
              id: "chicken-drumstick-1kg",
              name: "Chicken Drumsticks 1 Kg",
              price: 350,
              originalPrice: 370,
              discount: "5% OFF",
              net: "Net: 1000g",
              pcs: "8-10 Legs",
              badge: "Biryani Essential",
              desc: "Plump lower leg cuts, skinless and perfectly trimmed for juicy grilling.",
              image:
                "https://lh3.googleusercontent.com/aida/AEtjO1XEXYsorgCDQfJeF5rjP0qJL7pIgbOW5IT5JI8Da98U-AUlkyNhvKUm9VItAhsMOm--rHS2OUkkCSTj5ceAlZF409KUkUMZIhB0Mo4OnpYJ4ZGRx2Sm5TYVZ8bKdQ6g9ByjaIjE9Nmx3IL3WfH-96LZk9CnmOm0N9pRW5PUmB3aPuPMfyEMGvdq9WJd24NLFG5GhZKm1d9cK-l_6VjW9pxi_wR0URHcXhrILvt7HRIUr38HsZvxKWxjQQ",
            },
            {
              id: "chicken-wings-1kg",
              name: "Chicken Wings 1kg",
              price: 245,
              originalPrice: 265,
              discount: "8% OFF",
              net: "Net: 1000g",
              pcs: "12-14 Wings",
              badge: "Barbecue Cut",
              desc: "Skin-on wings with unmatched richness and flavor when baked or tossed.",
              image:
                "https://lh3.googleusercontent.com/aida/AEtjO1VTFHCuK-cFltmasMDFqLaqzzp8aau4eW-CQ3E1pwV5pyu4HFPAlx-FzqMPQga4Y1jrJ9ZMVHqquoxDjhvtY8AeloOqNVnycThWV4uL_Y9f9CpaJ2THNQOd8ce1f_uVaWDRkfaIvlQeX_ngrlwIVMH1SHVQFuHNuVxzW72ULVWUeu-MMW16ZvGzRm3yhaVJ1pAm_PLCWqZipulbYKSHiGlNfuCIUQUPWDEzNIHbRRFF5_Mor1PlB2gnSw",
            },
            {
              id: "chicken-ran-1kg",
              name: "Chicken Ran (Full Leg) 1kg",
              price: 290,
              originalPrice: 310,
              discount: "6% OFF",
              net: "Net: 1000g",
              pcs: "4 Full Legs",
              badge: "Whole Leg",
              desc: "Combined thigh and drumstick with skin off for deep tandoori roast.",
              image:
                "https://lh3.googleusercontent.com/aida/AEtjO1Uu1e3KgA9dUDsxfEpkpMzOM---tbHiu8Dhsm1Xe5FOm0Qhm-h8vrDCUbAYA8FlmS6BTLnp_g3qUFD2mY1lIeLzXktzih8hyMDLIqgWS6_yZeOY_u9_5sApLqlVC0La2JzJG4y-PqnGiXQkBNpp3ATxm9SFnf98KxNZkBUTp7u1yr2mxutai2Y5SwJAyPmGjRlIoHGA4ySsBiMRrUE6WGK-9QUJwitn5OWQpR0LHlHscKhMNYj8o3hr",
            },
            {
              id: "chicken-keema-1kg",
              name: "Chicken Keema 1kg",
              price: 370,
              originalPrice: 395,
              discount: "6% OFF",
              net: "Net: 1000g",
              pcs: "100% Meat",
              badge: "Double Ground",
              desc: "Finely minced breast & thigh meat. Perfectly seasoned for parathas & koftas.",
              image:
                "https://lh3.googleusercontent.com/aida/AEtjO1W2TxnZd-j5N3uAWjH4mAamsuvHSfd033KiN1ZoiYINftrPAYCNqIsnh0JA0LuOImdSgY5Ojswk_2EdN4C-8Sp9XmnBRRMEbC7UIOG9gem2xcb-kuy8ZrDzpV-k78-4Bs3WnNi3rwjPhZ2tOniXZ1EQ7yALbz5Txl3RkBLaJPQI715YOOb4ZOShLUs4HTB90nd5o1Ut--fmP6-RCCCYGxd1_7QEiPfbToL93q_XHS1lniwTgGaUVYOvaQ",
            },
            {
              id: "chicken-with-skin-whole-1kg",
              name: "Chicken With Skin Whole 1kg",
              price: 280,
              originalPrice: 280,
              discount: null,
              net: "Net: 1000g",
              pcs: "Whole Dressed",
              badge: "Crispy Skin",
              desc: "Retains natural skin fats for maximum moisture in oven roasting or grill.",
              image:
                "https://lh3.googleusercontent.com/aida/AEtjO1V-89ZaQuCvaTiSu7alVkUqFPb6_9nLy5WZ5Tqyc17o0MWSCvVrGa3vcymUzwPXXVrneSWrDWjTKjXQStBVzFGsgP493leBXmStPHFCJEZhu_pRLvseo5ePa01kic2C8BF8KTEH-OUX62_cWeW-aj6ksFlBH_2FjDiUkX4Fsk3YiAM-JHxwqgGGde9RDsUnY-TltA9011CuROGiWQQX0Ki82SLlb9aUiINpchSZ_z6m2h41wfV9GzUL",
            },
          ].map((item) => {
            const product = findProduct(item.id, item);
            const qty = getItemQuantity(item.id);
            const isJustAdded = addedItem === item.id;
            const wishlisted = isInWishlist(item.id);

            return (
              <article
                key={item.id}
                onClick={() => router.push(`/product/${item.id}`)}
                className="bg-surface-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group border border-gray-100 relative cursor-pointer"
              >
                <div>
                  <div className="relative w-full aspect-square overflow-hidden bg-surface-container">
                    <img
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      src={item.image}
                    />

                    {/* Top Left: Tag */}
                    <span className="absolute top-2.5 left-2.5 bg-surface-card/95 text-tertiary font-label-badge text-label-badge px-2.5 py-1 rounded-full flex items-center gap-1 font-bold shadow-xs whitespace-nowrap text-[10.5px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span> {item.badge}
                    </span>

                    {/* Top Right: Wishlist Heart */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleWishlist(item.id);
                      }}
                      className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center shadow-xs cursor-pointer transition-all z-10 border border-gray-100 hover:scale-110 active:scale-95 ${wishlisted ? "bg-white text-crimson-bright shadow-sm" : "bg-white/90 text-slate-subtle hover:text-primary"
                        }`}
                      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                      title={wishlisted ? "Loved" : "Add to wishlist"}
                    >
                      <span
                        className={`material-symbols-outlined text-[19px] ${wishlisted ? "filled text-crimson-bright" : ""}`}
                      >
                        favorite
                      </span>
                    </button>

                    {/* Bottom Left: Discount Badge */}
                    {item.discount && (
                      <span className="absolute bottom-2.5 left-2.5 bg-tertiary-fixed text-on-tertiary-fixed-variant font-label-badge text-label-badge px-2.5 py-0.5 rounded-full font-black shadow-xs whitespace-nowrap text-[10.5px]">
                        {item.discount}
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between text-slate-body font-body-sm text-body-sm mb-1">
                      <span>{item.net}</span>
                      <span className="text-tertiary font-label-badge font-bold">{item.pcs}</span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold group-hover:text-primary transition-colors text-[14.5px]">
                      {item.name}
                    </h3>
                    <p className="font-body-sm text-body-sm text-slate-body mt-1 leading-snug text-[12px]">{item.desc}</p>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="font-headline-md text-headline-md text-on-surface font-extrabold text-[1.2rem]">
                      ₹{item.price}
                    </span>
                    {item.originalPrice > item.price && (
                      <span className="font-body-sm text-body-sm text-slate-subtle line-through text-[12px]">
                        ₹{item.originalPrice}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAdd(product);
                    }}
                    className={`w-full py-2.5 px-space-sm rounded-full transition-all font-label-md text-label-md flex items-center justify-center gap-1.5 font-bold cursor-pointer border border-transparent shadow-xs ${qty > 0 || isJustAdded
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-surface-container-low text-primary hover:bg-primary hover:text-on-primary"
                      }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {qty > 0 || isJustAdded ? "done" : "add_shopping_cart"}
                    </span>
                    <span>{qty > 0 ? `IN CART (${qty})` : "+ ADD TO CART"}</span>
                  </button>
                </div>
              </article>
            );
          })}

          {/* Chicken Category Showcase Card */}
          <div className="bg-surface-container-low rounded-2xl p-5 flex flex-col justify-between border border-gray-200/50">
            <div>
              <span className="material-symbols-outlined text-primary text-[36px]">inventory_2</span>
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold mt-2 text-[1.2rem]">
                Custom Cuts Available
              </h3>
              <p className="font-body-sm text-body-sm text-slate-body mt-2 leading-relaxed text-[12.5px]">
                Need special thin slices, kathi roll juliennes, or biryani 4-piece cuts? Add instructions on checkout
                and our master butchers will hand-cut to your exact spec.
              </p>
            </div>

            <div className="pt-4">
              <div className="p-3 bg-surface-card rounded-xl text-on-surface mb-3 text-label-badge font-label-badge uppercase tracking-wider flex items-center gap-2 border border-gray-100 font-bold shadow-xs text-[10.5px]">
                <span className="w-2 h-2 rounded-full bg-tertiary"></span> RO-Water Washed Before Packing
              </div>
              <a
                className="w-full py-2.5 rounded-full bg-primary text-on-primary font-label-md text-label-md text-center block hover:bg-primary-container transition-colors shadow-sm font-bold text-decoration-none cursor-pointer whitespace-nowrap"
                href="#chicken-section"
              >
                View All Chicken Cuts (12)
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 7. Premium Country Mutton Section ─────────────────────────────────── */}
      <section className="w-full max-w-container-max mx-auto px-gutter-desktop mt-space-3xl" id="mutton-section">
        <div className="bg-surface-card rounded-3xl p-5 sm:p-7 md:p-8 shadow-sm border border-gray-100 w-full">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-space-lg">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">workspace_premium</span>
                <span className="font-label-badge text-label-badge uppercase tracking-wider text-primary font-bold">
                  Artisanal Goat
                </span>
              </div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
                Premium Country Mutton
              </h2>
            </div>
            <span className="inline-flex items-center font-label-badge text-label-badge bg-tag-amber-bg text-tag-amber px-3.5 py-1.5 rounded-full font-bold border border-tag-amber/20 self-start sm:self-auto whitespace-nowrap text-[11px]">
              Grass-Fed • Naturally Raised in Jharkhand
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                id: "mutton-curry-cut-1kg",
                name: "Mutton 1Kg (Curry Cut)",
                price: 900,
                originalPrice: 1000,
                discount: "10% OFF",
                net: "Net Wt: 1000g",
                serves: "Serves 4-6",
                desc: "Balanced mix of bone-in shank, shoulder, and ribs from young country goat.",
                image:
                  "https://lh3.googleusercontent.com/aida/AEtjO1V-XpmCoX5V0ku0QhROALLZlcULVA9vr8G1k2fa8EW68uv-gavSPVsEPypHbhiZC-ddjgMlOi9Fz5g3qmVu5dRRwIknVc7PXcGHahULjyuFPCCi7WxfPjaVzjiU6eu32azkVyNQlaAgocRPMLJOUS1aILr8jA34EpLcZ8DYTyxcvcAGm0hFid9qKInhMY5iNMDN76WQIjTMWbEbvYtzKkgBWHN_2qfWCzUfkD4TAVnKR5UZZ1M73FkPig",
              },
              {
                id: "mutton-curry-cut-500g",
                name: "Mutton 500gm (Curry Cut)",
                price: 500,
                originalPrice: 550,
                discount: "9% OFF",
                net: "Net Wt: 500g",
                serves: "Serves 2-3",
                desc: "Hand-chopped into bite-size pieces. Ideal for rich Rogan Josh or stew.",
                image:
                  "https://lh3.googleusercontent.com/aida/AEtjO1WpEtu-3k6GTNT_z8ePCWuVlJbQQtgzfbHBeFIPPpCGD134MLEowkQeotQeTT29Eml-5oCj-F0EfFu-pCyh3C6hWuw7GeyPbwY_wH5a9Pirk-O6zt_QYPz87ajm62wEHK7pVVtBHC3EvOfVjZZJjSl9wAZ7MJuHbVAHatzNch9UGf6Jjrk_7PZWWiSW8u9LepfjTcmDZmtWcSa1WABtGmRYQV7nyxo0N2daD1kTINisEiWW12mp29gBBQ",
              },
              {
                id: "mutton-curry-cut-750g",
                name: "Mutton 750gm (Family Pack)",
                price: 750,
                originalPrice: 800,
                discount: "6% OFF",
                net: "Net Wt: 750g",
                serves: "Serves 3-4",
                desc: "Finely portioned with rib chops and marrow pieces for rich flavour profile.",
                image:
                  "https://lh3.googleusercontent.com/aida/AEtjO1V-XpmCoX5V0ku0QhROALLZlcULVA9vr8G1k2fa8EW68uv-gavSPVsEPypHbhiZC-ddjgMlOi9Fz5g3qmVu5dRRwIknVc7PXcGHahULjyuFPCCi7WxfPjaVzjiU6eu32azkVyNQlaAgocRPMLJOUS1aILr8jA34EpLcZ8DYTyxcvcAGm0hFid9qKInhMY5iNMDN76WQIjTMWbEbvYtzKkgBWHN_2qfWCzUfkD4TAVnKR5UZZ1M73FkPig",
              },
            ].map((item) => {
              const product = findProduct(item.id, item);
              const qty = getItemQuantity(item.id);
              const isJustAdded = addedItem === item.id;
              const wishlisted = isInWishlist(item.id);

              return (
                <article
                  key={item.id}
                  onClick={() => router.push(`/product/${item.id}`)}
                  className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group border border-gray-100 relative cursor-pointer"
                >
                  <div>
                    <div className="relative w-full aspect-[16/10] overflow-hidden bg-surface-container">
                      <img
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        src={item.image}
                      />

                      {/* Top Left: Tag */}
                      <span className="absolute top-2.5 left-2.5 bg-surface-card/95 text-tertiary font-label-badge text-label-badge px-2.5 py-1 rounded-full flex items-center gap-1 font-bold shadow-xs whitespace-nowrap text-[10.5px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span> Prime Cut
                      </span>

                      {/* Top Right: Wishlist Heart */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleWishlist(item.id);
                        }}
                        className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center shadow-xs cursor-pointer transition-all z-10 border border-gray-100 hover:scale-110 active:scale-95 ${wishlisted ? "bg-white text-crimson-bright shadow-sm" : "bg-white/90 text-slate-subtle hover:text-primary"
                          }`}
                        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                        title={wishlisted ? "Loved" : "Add to wishlist"}
                      >
                        <span
                          className={`material-symbols-outlined text-[19px] ${wishlisted ? "filled text-crimson-bright" : ""}`}
                        >
                          favorite
                        </span>
                      </button>

                      {/* Bottom Left: Discount Badge */}
                      <span className="absolute bottom-2.5 left-2.5 bg-tertiary-fixed text-on-tertiary-fixed-variant font-label-badge text-label-badge px-2.5 py-0.5 rounded-full font-black shadow-xs whitespace-nowrap text-[10.5px]">
                        {item.discount}
                      </span>
                    </div>

                    <div className="p-4">
                      <div className="flex items-center justify-between text-slate-body font-body-sm text-body-sm mb-1">
                        <span>{item.net}</span>
                        <span className="text-tertiary font-label-badge font-bold">{item.serves}</span>
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold group-hover:text-primary transition-colors text-[15px]">
                        {item.name}
                      </h3>
                      <p className="font-body-sm text-body-sm text-slate-body mt-1 leading-snug text-[12px]">{item.desc}</p>
                    </div>
                  </div>

                  <div className="p-4 pt-0">
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="font-headline-md text-headline-md text-on-surface font-extrabold text-[1.2rem]">
                        ₹{item.price}
                      </span>
                      <span className="font-body-sm text-body-sm text-slate-subtle line-through text-[12px]">
                        ₹{item.originalPrice}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAdd(product);
                      }}
                      className={`w-full py-2.5 px-space-sm rounded-full transition-all font-label-md text-label-md flex items-center justify-center gap-1.5 font-bold cursor-pointer border border-transparent shadow-xs ${qty > 0 || isJustAdded
                        ? "bg-primary text-on-primary shadow-sm"
                        : "bg-surface-container-low text-primary hover:bg-primary hover:text-on-primary"
                        }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {qty > 0 || isJustAdded ? "done" : "add_shopping_cart"}
                      </span>
                      <span>{qty > 0 ? `IN CART (${qty})` : "+ ADD TO CART"}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── 8. Fresh Catch & River Fish Section ───────────────────────────────── */}
      <section className="w-full max-w-container-max mx-auto px-gutter-desktop mt-space-3xl" id="fish-section">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-space-lg">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">water</span>
              <span className="font-label-badge text-label-badge uppercase tracking-wider text-primary font-bold">
                Daily Freshwater Catch
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
              Fresh Catch &amp; River Fish
            </h2>
          </div>
          <div className="flex items-center gap-2 text-slate-body font-body-sm text-body-sm">
            <span className="material-symbols-outlined text-tertiary text-[18px]">check_circle</span>
            <span>Descaled &amp; gutted with clean potable water</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              id: "rohu-fish-1kg",
              name: "Local Rohu Fish 1 Kg",
              price: 280,
              originalPrice: 350,
              discount: "20% OFF",
              net: "Net Wt: 1000g (Approx)",
              spec: "Bengali Cut",
              desc: "Whole cleaned Rohu cut into uniform round steaks and head pieces.",
              image:
                "https://lh3.googleusercontent.com/aida/AEtjO1VfFFoFe5gIVjAuAwoM0pUShBeiwZTgnmSjowL9yOjVP0LnK0yXZAY8O1U78Prxarny6htWvDGuULPb49rt2FyrsEkh6OtOJeR3pGIvikgQeEIWIo5k6sEE8IPVjcU-JRtropCjAveFMOmH6lfFIx7hiTgyQXRW0b0qgYC0NP0caxooqfQX1eN8NgYtEzgATics8qTPpTYe6GYbXQ3tlPcm4c-oDw9OfhsWdltmHa38gu6PQ6doutFz",
            },
            {
              id: "rohu-fish-500g",
              name: "Local Rohu Fish 500gm",
              price: 145,
              originalPrice: 200,
              discount: "28% OFF",
              net: "Net Wt: 500g",
              spec: "5-6 Rings",
              desc: "Tender freshwater Rohu fish center slices. Cleaned with RO water.",
              image:
                "https://lh3.googleusercontent.com/aida/AEtjO1VfFFoFe5gIVjAuAwoM0pUShBeiwZTgnmSjowL9yOjVP0LnK0yXZAY8O1U78Prxarny6htWvDGuULPb49rt2FyrsEkh6OtOJeR3pGIvikgQeEIWIo5k6sEE8IPVjcU-JRtropCjAveFMOmH6lfFIx7hiTgyQXRW0b0qgYC0NP0caxooqfQX1eN8NgYtEzgATics8qTPpTYe6GYbXQ3tlPcm4c-oDw9OfhsWdltmHa38gu6PQ6doutFz",
            },
          ].map((item) => {
            const product = findProduct(item.id, item);
            const qty = getItemQuantity(item.id);
            const isJustAdded = addedItem === item.id;
            const wishlisted = isInWishlist(item.id);

            return (
              <article
                key={item.id}
                onClick={() => router.push(`/product/${item.id}`)}
                className="bg-surface-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group border border-gray-100 relative cursor-pointer"
              >
                <div>
                  <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface-container">
                    <img
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      src={item.image}
                    />

                    {/* Top Left: Tag */}
                    <span className="absolute top-2.5 left-2.5 bg-surface-card/95 text-tertiary font-label-badge text-label-badge px-2.5 py-1 rounded-full flex items-center gap-1 font-bold shadow-xs whitespace-nowrap text-[10.5px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span> Fresh Water Cut
                    </span>

                    {/* Top Right: Wishlist Heart */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleWishlist(item.id);
                      }}
                      className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center shadow-xs cursor-pointer transition-all z-10 border border-gray-100 hover:scale-110 active:scale-95 ${wishlisted ? "bg-white text-crimson-bright shadow-sm" : "bg-white/90 text-slate-subtle hover:text-primary"
                        }`}
                      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                      title={wishlisted ? "Loved" : "Add to wishlist"}
                    >
                      <span
                        className={`material-symbols-outlined text-[19px] ${wishlisted ? "filled text-crimson-bright" : ""}`}
                      >
                        favorite
                      </span>
                    </button>

                    {/* Bottom Left: Discount Badge */}
                    <span className="absolute bottom-2.5 left-2.5 bg-tertiary-fixed text-on-tertiary-fixed-variant font-label-badge text-label-badge px-2.5 py-0.5 rounded-full font-black shadow-xs whitespace-nowrap text-[10.5px]">
                      {item.discount}
                    </span>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between text-slate-body font-body-sm text-body-sm mb-1">
                      <span>{item.net}</span>
                      <span className="text-tertiary font-label-badge font-bold">{item.spec}</span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold group-hover:text-primary transition-colors text-[15px]">
                      {item.name}
                    </h3>
                    <p className="font-body-sm text-body-sm text-slate-body mt-1 leading-snug text-[12px]">{item.desc}</p>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="font-headline-md text-headline-md text-on-surface font-extrabold text-[1.2rem]">
                      ₹{item.price}
                    </span>
                    <span className="font-body-sm text-body-sm text-slate-subtle line-through text-[12px]">
                      ₹{item.originalPrice}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAdd(product);
                    }}
                    className={`w-full py-2.5 px-space-sm rounded-full transition-all font-label-md text-label-md flex items-center justify-center gap-1.5 font-bold cursor-pointer border border-transparent shadow-xs ${qty > 0 || isJustAdded
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-surface-container-low text-primary hover:bg-primary hover:text-on-primary"
                      }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {qty > 0 || isJustAdded ? "done" : "add_shopping_cart"}
                    </span>
                    <span>{qty > 0 ? `IN CART (${qty})` : "+ ADD TO CART"}</span>
                  </button>
                </div>
              </article>
            );
          })}

          {/* Fish Hygiene & Delivery Card */}
          <div className="bg-surface-card rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-sm border border-gray-100">
            <div>
              <div className="w-12 h-12 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary mb-space-md">
                <span className="material-symbols-outlined text-[28px]">set_meal</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold text-[1.25rem]">
                Pristine Catch Guarantee
              </h3>
              <p className="font-body-sm text-body-sm text-slate-body mt-2 leading-relaxed text-[13px]">
                All fish is procured fresh each sunrise from sweet-water sources. Knife masters descale, clean
                cavities, and rinse with pure filtered water so your kitchen remains odor-free.
              </p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 font-body-sm text-body-sm text-slate-body text-[12.5px]">
                  <span className="material-symbols-outlined text-tertiary text-[18px]">verified</span>
                  <span>Zero formalin, zero artificial colorants</span>
                </div>
                <div className="flex items-center gap-2 font-body-sm text-body-sm text-slate-body text-[12.5px]">
                  <span className="material-symbols-outlined text-tertiary text-[18px]">verified</span>
                  <span>Packed in chilled food-grade thermo-seal trays</span>
                </div>
              </div>
            </div>
            <div className="pt-5">
              <a
                className="inline-flex items-center gap-1.5 text-primary font-label-md text-label-md hover:underline font-bold text-decoration-none cursor-pointer"
                href="#about-us"
              >
                Learn About Our Daily Catch Source <span className="material-symbols-outlined text-[16px]">east</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 9. Farm Fresh & Desi Eggs Section ─────────────────────────────────── */}
      <section className="w-full max-w-container-max mx-auto px-gutter-desktop mt-space-3xl" id="eggs-section">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-space-lg">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-tag-amber text-[22px]">egg</span>
              <span className="font-label-badge text-label-badge uppercase tracking-wider text-tag-amber font-bold">
                Farm Harvest Daily
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
              Farm Fresh &amp; Desi Eggs
            </h2>
          </div>
          <div className="flex items-center gap-2 text-slate-body font-body-sm text-body-sm">
            <span className="material-symbols-outlined text-tertiary text-[18px]">verified</span>
            <span>Antibiotic-free, deep yellow yolks</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              id: "prod-egg-1",
              name: "Farm Fresh Classic White Eggs (Pack of 12)",
              price: 99,
              originalPrice: 120,
              discount: "18% OFF",
              net: "12 Eggs",
              spec: "Daily Harvest",
              badge: "Farm Classic",
              desc: "Freshly harvested antibiotic-free table eggs with vibrant yellow yolk. Cleaned and safely packed.",
              image: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=800&q=80",
            },
            {
              id: "prod-egg-2",
              name: "Nutritious Desi Brown Eggs (Pack of 6)",
              price: 85,
              originalPrice: 105,
              discount: "19% OFF",
              net: "6 Eggs",
              spec: "Desi Organic",
              badge: "High Nutrition",
              desc: "Rich in omega-3 and proteins from naturally forage-fed hens. Deep orange yolk and thicker shells.",
              image: "https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?auto=format&fit=crop&w=800&q=80",
            },
            {
              id: "prod-egg-3",
              name: "Family Saver Fresh White Eggs (Crate of 30)",
              price: 230,
              originalPrice: 270,
              discount: "15% OFF",
              net: "30 Eggs",
              spec: "Value Crate",
              badge: "Family Saver",
              desc: "Economy wholesale family pack of 30 farm-fresh table eggs. Clean, intact, and safe crate packaging.",
              image: "https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=800&q=80",
            },
          ].map((item) => {
            const product = findProduct(item.id, item);
            const qty = getItemQuantity(item.id);
            const isJustAdded = addedItem === item.id;
            const wishlisted = isInWishlist(item.id);

            return (
              <article
                key={item.id}
                onClick={() => router.push(`/product/${item.id}`)}
                className="bg-surface-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group border border-gray-100 relative cursor-pointer"
              >
                <div>
                  <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface-container">
                    <img
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      src={item.image}
                    />

                    {/* Top Left: Tag */}
                    <span className="absolute top-2.5 left-2.5 bg-surface-card/95 text-tag-amber font-label-badge text-label-badge px-2.5 py-1 rounded-full flex items-center gap-1 font-bold shadow-xs whitespace-nowrap text-[10.5px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-tag-amber"></span> {item.badge}
                    </span>

                    {/* Top Right: Wishlist Heart */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleWishlist(item.id);
                      }}
                      className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center shadow-xs cursor-pointer transition-all z-10 border border-gray-100 hover:scale-110 active:scale-95 ${wishlisted ? "bg-white text-crimson-bright shadow-sm" : "bg-white/90 text-slate-subtle hover:text-primary"
                        }`}
                      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                      title={wishlisted ? "Loved" : "Add to wishlist"}
                    >
                      <span
                        className={`material-symbols-outlined text-[19px] ${wishlisted ? "filled text-crimson-bright" : ""}`}
                      >
                        favorite
                      </span>
                    </button>

                    {/* Bottom Left: Discount */}
                    <span className="absolute bottom-2.5 left-2.5 bg-tag-amber-bg text-tag-amber font-label-badge text-label-badge px-2.5 py-0.5 rounded-full font-black shadow-xs whitespace-nowrap text-[10.5px]">
                      {item.discount}
                    </span>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between text-slate-body font-body-sm text-body-sm mb-1">
                      <span>{item.net}</span>
                      <span className="text-tag-amber font-label-badge font-bold">{item.spec}</span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold group-hover:text-primary transition-colors text-[14.5px]">
                      {item.name}
                    </h3>
                    <p className="font-body-sm text-body-sm text-slate-body mt-1 leading-snug text-[12px]">{item.desc}</p>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="font-headline-md text-headline-md text-on-surface font-extrabold text-[1.2rem]">
                      ₹{item.price}
                    </span>
                    <span className="font-body-sm text-body-sm text-slate-subtle line-through text-[12px]">
                      ₹{item.originalPrice}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAdd(product);
                    }}
                    className={`w-full py-2.5 px-space-sm rounded-full transition-all font-label-md text-label-md flex items-center justify-center gap-1.5 font-bold cursor-pointer border border-transparent shadow-xs ${qty > 0 || isJustAdded
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-surface-container-low text-primary hover:bg-primary hover:text-on-primary"
                      }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {qty > 0 || isJustAdded ? "done" : "add_shopping_cart"}
                    </span>
                    <span>{qty > 0 ? `IN CART (${qty})` : "+ ADD TO CART"}</span>
                  </button>
                </div>
              </article>
            );
          })}

          {/* Egg Harvest Promise Showcase */}
          <div className="bg-surface-container-low rounded-2xl p-5 flex flex-col justify-between border border-gray-200/50">
            <div>
              <span className="material-symbols-outlined text-tag-amber text-[36px]">nest_multi_room</span>
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold mt-2 text-[1.2rem]">
                Pure Farm Harvest
              </h3>
              <p className="font-body-sm text-body-sm text-slate-body mt-2 leading-relaxed text-[12.5px]">
                Carefully collected each dawn from biosecure poultry sheds. Shockproof cartons prevent cracking in
                transit, ensuring every egg reaches you in pristine condition.
              </p>
            </div>

            <div className="pt-4">
              <div className="p-3 bg-surface-card rounded-xl text-on-surface mb-3 text-label-badge font-label-badge uppercase tracking-wider flex items-center gap-2 border border-gray-100 font-bold shadow-xs text-[10.5px]">
                <span className="w-2 h-2 rounded-full bg-tag-amber"></span> 100% Hormone &amp; Antibiotic Free
              </div>
              <a
                className="w-full py-2.5 rounded-full bg-tag-amber text-white font-label-md text-label-md text-center block hover:opacity-90 transition-opacity shadow-sm font-bold text-decoration-none cursor-pointer whitespace-nowrap"
                href="#eggs-section"
              >
                Explore Egg Packs
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 10. Why Choose Teffe's Trust & Hygiene Banner ─────────────────────── */}
      <section className="w-full max-w-container-max mx-auto px-gutter-desktop mt-space-3xl">
        <div className="bg-surface-card rounded-3xl p-6 sm:p-8 md:p-10 shadow-sm border border-gray-100 w-full">
          <div className="text-center max-w-2xl mx-auto mb-space-2xl">
            <span className="font-label-badge text-label-badge uppercase tracking-wider text-primary font-bold">
              Hygienic Precision
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold mt-1">
              Why Ranchi Trusts Teffe&apos;s
            </h2>
            <p className="font-body-md text-body-md text-slate-body mt-2">
              We combine the authentic craftsmanship of traditional butchery with certified food-safety protocols.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* 1. 100% Hygienic Processing */}
            <div className="p-5 rounded-2xl bg-surface-container-low flex flex-col border border-gray-200/50">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                <span className="material-symbols-outlined text-[26px]">sanitizer</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold text-[15px]">100% Hygienic Processing</h3>
              <p className="font-body-sm text-body-sm text-slate-body mt-2 flex-1 leading-relaxed text-[13px]">
                Thoroughly washed with RO-purified water. Processed on stainless steel knife tables with zero chemical bleaching.
              </p>
              <span className="font-label-badge text-label-badge text-tertiary font-bold uppercase mt-4 text-[10.5px]">
                FSSAI Certified Hub
              </span>
            </div>

            {/* 2. Cut Fresh Post Order */}
            <div className="p-5 rounded-2xl bg-surface-container-low flex flex-col border border-gray-200/50">
              <div className="w-12 h-12 rounded-2xl bg-tertiary/10 flex items-center justify-center text-tertiary mb-4">
                <span className="material-symbols-outlined text-[26px]">skateboarding</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold text-[15px]">Cut Fresh Post Order</h3>
              <p className="font-body-sm text-body-sm text-slate-body mt-2 flex-1 leading-relaxed text-[13px]">
                Unlike supermarkets that store pre-cut meat for weeks in deep-freeze boxes, your bird is prepared strictly upon cart confirmation.
              </p>
              <span className="font-label-badge text-label-badge text-tertiary font-bold uppercase mt-4 text-[10.5px]">
                Zero Stale Storage
              </span>
            </div>

            {/* 3. 90-Min Delivery Promise */}
            <div className="p-5 rounded-2xl bg-surface-container-low flex flex-col border border-gray-200/50">
              <div className="w-12 h-12 rounded-2xl bg-tag-amber-bg flex items-center justify-center text-tag-amber mb-4">
                <span className="material-symbols-outlined text-[26px]">speed</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold text-[15px]">90-Min Delivery Promise</h3>
              <p className="font-body-sm text-body-sm text-slate-body mt-2 flex-1 leading-relaxed text-[13px]">
                Strategically dispatched within 5km radius of our Kacheri Chowk central fulfillment facility via thermal insulated bags.
              </p>
              <span className="font-label-badge text-label-badge text-tag-amber font-bold uppercase mt-4 text-[10.5px]">
                Express Courier Fleet
              </span>
            </div>

            {/* 4. Easy 60-Minute Exchange */}
            <div className="p-5 rounded-2xl bg-surface-container-low flex flex-col border border-gray-200/50">
              <div className="w-12 h-12 rounded-2xl bg-secondary-container flex items-center justify-center text-secondary mb-4">
                <span className="material-symbols-outlined text-[26px]">published_with_changes</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold text-[15px]">60-Min Doorstep Exchange</h3>
              <p className="font-body-sm text-body-sm text-slate-body mt-2 flex-1 leading-relaxed text-[13px]">
                If the cut doesn&apos;t meet your standard, request an exchange within 60 minutes of delivery. Instant replacement dispatched.
              </p>
              <span className="font-label-badge text-label-badge text-secondary font-bold uppercase mt-4 text-[10.5px]">
                100% Quality Assurance
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 11. About Teffe's Story Block ────────────────────────────────────── */}
      <section className="w-full max-w-container-max mx-auto px-gutter-desktop mt-space-3xl mb-space-xl" id="about-us">
        <div className="relative overflow-hidden rounded-3xl bg-surface-card p-6 sm:p-8 md:p-12 shadow-sm flex flex-col lg:flex-row items-center gap-8 lg:gap-12 border border-gray-100 w-full">
          <div className="w-full lg:w-1/2 space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-crimson-soft text-primary font-label-badge text-label-badge uppercase font-bold tracking-wider border border-primary/20 text-[11px] whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-primary"></span> Decade of Culinary Trust
            </div>
            <h2 className="font-headline-xl text-headline-lg md:text-headline-xl text-on-surface font-extrabold tracking-tight">
              Where Health Matters Most
            </h2>
            <p className="font-body-lg text-body-lg text-slate-body leading-relaxed">
              Teffes brings you fresh, hygienic, and high-quality chicken, fish, mutton, and farm-harvested eggs — now available online.
              With thousands of satisfied customers and over a decade of trust across Ranchi, we&apos;re committed to
              delivering clean, healthy meat right to your doorstep.
            </p>
            <p className="font-body-md text-body-md text-primary font-bold">
              Fresh. Clean. Trusted — that&apos;s the Teffes promise.
            </p>

            <div className="grid grid-cols-3 gap-3 pt-2 text-on-surface">
              <div className="p-3 rounded-xl bg-surface-container-low text-center border border-gray-200/50">
                <span className="font-headline-lg text-headline-lg text-primary font-black block text-[1.4rem]">10+</span>
                <span className="font-body-sm text-label-badge text-slate-body uppercase font-semibold text-[10px]">
                  Years in Ranchi
                </span>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low text-center border border-gray-200/50">
                <span className="font-headline-lg text-headline-lg text-tertiary font-black block text-[1.4rem]">50k+</span>
                <span className="font-body-sm text-label-badge text-slate-body uppercase font-semibold text-[10px]">
                  Orders Delivered
                </span>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low text-center border border-gray-200/50">
                <div className="flex items-center justify-center gap-0.5">
                  <span className="font-headline-lg text-headline-lg text-tag-amber font-black text-[1.4rem]">4.9</span>
                  <span className="material-symbols-outlined text-[18px] text-tag-amber">star</span>
                </div>
                <span className="font-body-sm text-label-badge text-slate-body uppercase font-semibold text-[10px]">
                  Hygiene Rating
                </span>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-1/2 relative">
            <div className="relative aspect-video sm:aspect-[4/3] rounded-2xl overflow-hidden shadow-md bg-surface-container">
              <img
                alt="Teffe Fresh Meat Butchery Standards"
                className="w-full h-full object-cover"
                src="https://healthycrater.com/wp-content/uploads/2024/07/chicken-vs-mutton-nutritional-values-600x338.jpg"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
              <div className="absolute bottom-4 left-4 right-4 bg-surface-card/95 backdrop-blur-md p-4 rounded-xl text-on-surface shadow-md border border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-white text-[22px]">location_on</span>
                  <span className="font-headline-sm text-label-md font-bold text-[13.5px] text-white">
                    Kacheri Chowk Central Dispatch Hub
                  </span>
                </div>
                <p className="font-body-sm text-body-sm mt-0.5 text-[12px] text-white">
                  Near Kishore Ganj &amp; Harmu Road, Ranchi, Jharkhand 834001
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 12. Sticky Bottom Quick Cart Bar ──────────────────────────────────── */}
      {totalItemsCount > 0 && (
        <aside
          aria-label="Quick Checkout Bar"
          className="fixed bottom-5 inset-x-4 md:inset-x-auto md:right-8 md:w-[380px] z-40 animate-fade-in"
        >
          <div className="bg-primary text-on-primary rounded-2xl p-4 shadow-2xl flex items-center justify-between border border-primary-container">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
              </div>
              <div>
                <span className="font-headline-sm text-headline-sm font-bold block leading-none text-white text-[14.5px]">
                  {totalItemsCount} {totalItemsCount === 1 ? "Item" : "Items"} in Cart
                </span>
                <span className="font-body-sm text-body-sm text-on-primary-container leading-tight mt-1 block text-[12.5px]">
                  Subtotal: ₹{subtotal}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={openCart}
              className="px-5 py-2.5 bg-white text-primary rounded-full font-label-md text-label-md font-bold hover:bg-surface-container transition-all flex items-center gap-1.5 shadow-sm cursor-pointer border-none text-[13px] whitespace-nowrap"
            >
              <span>Checkout</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
