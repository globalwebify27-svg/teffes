"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { PRODUCTS, Product, fetchProducts, fetchCategories, Category } from "@/lib/products";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar } from "@fortawesome/free-solid-svg-icons";
import api from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const { addToCart, totalItemsCount, subtotal, openCart, getItemQuantity } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [addedItem, setAddedItem] = useState<string | null>(null);
  const [liveProducts, setLiveProducts] = useState<Product[]>([]);
  const [liveCategories, setLiveCategories] = useState<Category[]>([]);
  const [superOffer, setSuperOffer] = useState<any>(null);

  const trendingProducts = useMemo(() => {
    const list = liveProducts.filter((p) => p.isBestseller || p.badge?.toLowerCase().includes("bestseller") || p.badge?.toLowerCase().includes("trending"));
    return (list.length >= 5 ? list : liveProducts).slice(0, 5);
  }, [liveProducts]);

  const chickenProducts = useMemo(() => {
    return liveProducts.filter((p) => p.category === "chicken").slice(0, 7);
  }, [liveProducts]);

  const muttonProducts = useMemo(() => {
    return liveProducts.filter((p) => p.category === "mutton").slice(0, 3);
  }, [liveProducts]);

  const fishProducts = useMemo(() => {
    return liveProducts.filter((p) => p.category === "fish").slice(0, 3);
  }, [liveProducts]);

  const eggProducts = useMemo(() => {
    return liveProducts.filter((p) => p.category === "eggs");
  }, [liveProducts]);

  const displayCategories = useMemo(() => {
    return liveCategories.filter((c) => c.slug !== "all" && (c as any).isActive !== false);
  }, [liveCategories]);

  const [heroBanners, setHeroBanners] = useState<any[]>([]);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [isBannerHovered, setIsBannerHovered] = useState(false);

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
    api.get<{ success: boolean; superOffer: any }>("/coupons/super-offer")
      .then((res) => {
        if (res.data?.success && res.data.superOffer) {
          setSuperOffer(res.data.superOffer);
        }
      })
      .catch((err) => console.warn("Failed to load super-offer:", err));

    api.get<{ success: boolean; banners: any[] }>("/banners")
      .then((res) => {
        if (res.data?.success && res.data.banners?.length > 0) {
          setHeroBanners(res.data.banners);
        }
      })
      .catch((err) => console.warn("Failed to load hero banners:", err));
  }, []);

  // Auto-slide hero window every 4.5 seconds
  useEffect(() => {
    if (heroBanners.length <= 1 || isBannerHovered) return;
    const timer = setInterval(() => {
      setActiveBannerIndex((prev) => (prev + 1) % heroBanners.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [heroBanners.length, isBannerHovered]);

  // Live product finder
  const findProduct = (id: string, fallback: Partial<Product>): Product => {
    const found = liveProducts.find((p) => p.id === id);
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

  const nextBanner = () => {
    setActiveBannerIndex((prev) => (prev + 1) % heroBanners.length);
  };

  const prevBanner = () => {
    setActiveBannerIndex((prev) => (prev - 1 + heroBanners.length) % heroBanners.length);
  };

  return (
    <div className="w-full bg-surface text-on-surface font-body-md pb-20">
      {/* ─── 1. Top Sliding Hero Window ────────────────────────────── */}
      <section className="w-full max-w-container-max mx-auto px-gutter-desktop pt-4 sm:pt-6">
        <div
          className="relative overflow-hidden rounded-3xl bg-neutral-900 shadow-md border border-gray-100 w-full group"
          onMouseEnter={() => setIsBannerHovered(true)}
          onMouseLeave={() => setIsBannerHovered(false)}
        >
          {/* Sliding Window Container */}
          <div className="relative w-full aspect-[2.4/1] sm:aspect-[3.1/1] md:aspect-[3.4/1] min-h-[220px] max-h-[460px] overflow-hidden">
            <div
              className="flex w-full h-full transition-transform duration-500 ease-out"
              style={{
                transform: `translateX(-${activeBannerIndex * 100}%)`,
              }}
            >
              {heroBanners.map((banner, index) => {
                const handleClick = () => {
                  if (banner.link) {
                    if (banner.link.startsWith("http")) {
                      window.open(banner.link, "_blank");
                    } else if (banner.link.includes("chicken")) {
                      router.push("/category?type=chicken");
                    } else if (banner.link.includes("mutton")) {
                      router.push("/category?type=mutton");
                    } else if (banner.link.includes("fish")) {
                      router.push("/category?type=fish");
                    } else if (banner.link.includes("eggs")) {
                      router.push("/category?type=eggs");
                    } else if (banner.link.startsWith("#")) {
                      router.push("/category?type=all");
                    } else {
                      router.push(banner.link);
                    }
                  } else {
                    router.push("/category?type=all");
                  }
                };

                return (
                  <div
                    key={banner.id || banner._id || index}
                    className="w-full h-full shrink-0 relative overflow-hidden flex items-center justify-center bg-neutral-950"
                    style={{ cursor: banner.link ? "pointer" : "default" }}
                    onClick={handleClick}
                  >
                    <img
                      src={banner.image}
                      alt={banner.title || "Teffes Fresh Meat Hero"}
                      className="w-full h-full object-cover object-center select-none"
                      draggable={false}
                    />
                  </div>
                );
              })}
            </div>

            {/* Left & Right Chevron Arrows */}
            {heroBanners.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous Banner"
                  onClick={(e) => {
                    e.stopPropagation();
                    prevBanner();
                  }}
                  className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/45 hover:bg-black/75 text-white backdrop-blur-md flex items-center justify-center transition-all duration-200 shadow-md opacity-80 hover:opacity-100 hover:scale-105 z-10 border border-white/20"
                >
                  <span className="material-symbols-outlined text-[20px] sm:text-[24px]">chevron_left</span>
                </button>
                <button
                  type="button"
                  aria-label="Next Banner"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextBanner();
                  }}
                  className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/45 hover:bg-black/75 text-white backdrop-blur-md flex items-center justify-center transition-all duration-200 shadow-md opacity-80 hover:opacity-100 hover:scale-105 z-10 border border-white/20"
                >
                  <span className="material-symbols-outlined text-[20px] sm:text-[24px]">chevron_right</span>
                </button>
              </>
            )}

            {/* Indicator Dots */}
            {heroBanners.length > 1 && (
              <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 bg-black/35 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/15">
                {heroBanners.map((_, dotIdx) => (
                  <button
                    key={dotIdx}
                    type="button"
                    aria-label={`Slide ${dotIdx + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveBannerIndex(dotIdx);
                    }}
                    className={`transition-all duration-300 rounded-full ${activeBannerIndex === dotIdx
                      ? "w-6 h-2 bg-crimson-bright shadow-xs"
                      : "w-2 h-2 bg-white/60 hover:bg-white"
                      }`}
                  />
                ))}
              </div>
            )}
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
                <span className="material-symbols-outlined text-[20px]">verified</span>
              </div>
              <div>
                <span className="block font-headline-sm text-[13.5px] sm:text-[15px] text-on-surface leading-tight font-bold">
                  Never Frozen
                </span>
                <span className="block font-body-sm text-slate-body text-[11px] sm:text-[12px]">
                  100% Fresh Daily Cuts
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

      {/* ─── 2. Super Offer Promo Ribbon ─────────────────────────────────────── */}
      {superOffer && (
        <section className="w-full max-w-container-max mx-auto px-gutter-desktop mt-4 sm:mt-6" id="special-offer-ribbon">
          <div className="bg-gradient-to-r from-tag-amber-bg via-surface-card to-tag-amber-bg rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm border border-tag-amber/30 w-full">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-tag-amber/15 flex items-center justify-center text-tag-amber shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[32px]">local_offer</span>
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tag-amber text-white font-label-badge text-label-badge uppercase tracking-wider font-bold text-[10.5px] whitespace-nowrap mb-1">
                  <FontAwesomeIcon icon={faStar} className="text-white text-[11px]" />
                  <span>Super Featured Offer</span>
                </div>
                <h2 className="font-headline-md text-headline-md text-on-surface font-extrabold text-[1.15rem] sm:text-[1.3rem]">
                  {superOffer.discount}
                </h2>
                <p className="font-body-sm text-body-sm text-slate-body mt-0.5">
                  Apply code <strong className="font-mono font-bold text-gray-900 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-200">{superOffer.code}</strong> at checkout. {superOffer.minOrder > 0 ? `Valid on orders above ₹${superOffer.minOrder}.` : ""} Valid till {superOffer.validTill}.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/offers"
                className="px-6 py-2.5 rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-md transition-all font-bold cursor-pointer text-decoration-none whitespace-nowrap"
              >
                Claim Offer →
              </Link>
            </div>
          </div>
        </section>
      )}

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
          {displayCategories.map((cat) => {
            return (
              <Link
                key={cat.id || cat.slug}
                className="group relative rounded-2xl overflow-hidden bg-surface-card shadow-sm hover:shadow-md transition-all flex flex-col border border-gray-100 text-decoration-none cursor-pointer"
                href={`/category?type=${cat.slug}`}
              >
                <div className="relative w-full aspect-[4/3] max-h-56 overflow-hidden bg-surface-container">
                  <img
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    src={cat.image || "/teffes-logo-maroon.png"}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent"></div>
                  <div className="absolute bottom-3 left-4 text-white pr-2">
                    <span className="font-headline-md text-headline-md block leading-tight font-bold text-white text-[1.15rem]">
                      {cat.name}
                    </span>
                    <span className="font-body-sm text-body-sm text-white/90 text-[12px] line-clamp-1">
                      {cat.tagline || "Fresh Daily Cuts"}
                    </span>
                  </div>
                </div>
                <div className="p-3.5 flex items-center justify-between bg-surface-card">
                  <span className="font-label-md text-label-md text-primary font-bold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                    Shop {cat.name} <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </span>
                  <span className="font-label-badge text-label-badge text-tertiary bg-tertiary-fixed-dim/20 px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap">
                    Fresh Stock
                  </span>
                </div>
              </Link>
            );
          })}
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
          {trendingProducts.map((item) => {
            const qty = getItemQuantity(item.id);
            const isJustAdded = addedItem === item.id;
            const wishlisted = isInWishlist(item.id);
            const origPrice = item.originalPrice || item.price || 0;
            const discount = origPrice > item.price ? `${Math.round(((origPrice - item.price) / origPrice) * 100)}% OFF` : null;

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
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/teffes-logo-maroon.png";
                      }}
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
                    {discount && (
                      <span className="absolute bottom-2.5 left-2.5 bg-tertiary-fixed text-on-tertiary-fixed-variant font-label-badge text-label-badge px-2.5 py-0.5 rounded-full font-black shadow-xs whitespace-nowrap text-[10.5px]">
                        {discount}
                      </span>
                    )}
                  </div>

                  <div className="p-3.5 sm:p-4">
                    <div className="flex items-center justify-between text-slate-body font-body-sm text-body-sm mb-1">
                      <span>Net: {item.netWeight}</span>
                      <span className="text-tertiary font-label-badge font-bold uppercase">{item.badge || "Fresh"}</span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold line-clamp-1 group-hover:text-primary transition-colors text-[14.5px]">
                      {item.name}
                    </h3>
                    <p className="font-body-sm text-body-sm text-slate-body mt-0.5 line-clamp-1 text-[12px]">{item.description}</p>
                  </div>
                </div>

                <div className="p-3.5 sm:p-4 pt-0">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="font-headline-md text-headline-md text-on-surface font-extrabold text-[1.2rem]">
                      ₹{item.price}
                    </span>
                    {origPrice > item.price && (
                      <span className="font-body-sm text-body-sm text-slate-subtle line-through text-[12px]">
                        ₹{origPrice}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAdd(item);
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
                Cut strictly fresh on order and delivered in insulated fresh-boxes to preserve tender muscle fibres.
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
          {chickenProducts.map((item) => {
            const qty = getItemQuantity(item.id);
            const isJustAdded = addedItem === item.id;
            const wishlisted = isInWishlist(item.id);
            const origPrice = item.originalPrice || item.price || 0;
            const discount = origPrice > item.price ? `${Math.round(((origPrice - item.price) / origPrice) * 100)}% OFF` : null;

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
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/teffes-logo-maroon.png";
                      }}
                    />

                    {/* Top Left: Tag */}
                    <span className="absolute top-2.5 left-2.5 bg-surface-card/95 text-tertiary font-label-badge text-label-badge px-2.5 py-1 rounded-full flex items-center gap-1 font-bold shadow-xs whitespace-nowrap text-[10.5px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span> {item.badge || "Fresh Cut"}
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
                    {discount && (
                      <span className="absolute bottom-2.5 left-2.5 bg-tertiary-fixed text-on-tertiary-fixed-variant font-label-badge text-label-badge px-2.5 py-0.5 rounded-full font-black shadow-xs whitespace-nowrap text-[10.5px]">
                        {discount}
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between text-slate-body font-body-sm text-body-sm mb-1">
                      <span>Net: {item.netWeight}</span>
                      <span className="text-tertiary font-label-badge font-bold">{item.pieces || item.serves || "Standard Cut"}</span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold group-hover:text-primary transition-colors text-[14.5px]">
                      {item.name}
                    </h3>
                    <p className="font-body-sm text-body-sm text-slate-body mt-1 leading-snug text-[12px] line-clamp-2">{item.description}</p>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="font-headline-md text-headline-md text-on-surface font-extrabold text-[1.2rem]">
                      ₹{item.price}
                    </span>
                    {origPrice > item.price && (
                      <span className="font-body-sm text-body-sm text-slate-subtle line-through text-[12px]">
                        ₹{origPrice}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAdd(item);
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
              <Link
                className="w-full py-2.5 rounded-full bg-primary text-on-primary font-label-md text-label-md text-center block hover:bg-primary-container transition-colors shadow-sm font-bold text-decoration-none cursor-pointer whitespace-nowrap"
                href="/category?type=chicken"
              >
                View All Chicken Cuts ({liveProducts.filter(p => p.category === 'chicken').length})
              </Link>
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
            {muttonProducts.map((product) => {
              const qty = getItemQuantity(product.id);
              const isJustAdded = addedItem === product.id;
              const wishlisted = isInWishlist(product.id);
              const discountText = product.originalPrice && product.originalPrice > product.price
                ? `${Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF`
                : ((product as any).discount || "");

              return (
                <article
                  key={product.id}
                  onClick={() => router.push(`/product/${product.id}`)}
                  className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group border border-gray-100 relative cursor-pointer"
                >
                  <div>
                    <div className="relative w-full aspect-[16/10] overflow-hidden bg-surface-container">
                      <img
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        src={product.image || (product.images && product.images[0]) || "/images/mutton.png"}
                        onError={(e) => {
                          e.currentTarget.src = "https://cdn.dotpe.in/longtail/store-items/7524323/p3pU05nL.webp";
                        }}
                      />

                      {/* Top Left: Tag */}
                      <span className="absolute top-2.5 left-2.5 bg-surface-card/95 text-tertiary font-label-badge text-label-badge px-2.5 py-1 rounded-full flex items-center gap-1 font-bold shadow-xs whitespace-nowrap text-[10.5px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span> {product.badge || "Prime Cut"}
                      </span>

                      {/* Top Right: Wishlist Heart */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleWishlist(product.id);
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
                      {discountText && (
                        <span className="absolute bottom-2.5 left-2.5 bg-tertiary-fixed text-on-tertiary-fixed-variant font-label-badge text-label-badge px-2.5 py-0.5 rounded-full font-black shadow-xs whitespace-nowrap text-[10.5px]">
                          {discountText}
                        </span>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex items-center justify-between text-slate-body font-body-sm text-body-sm mb-1">
                        <span>{product.netWeight || "Net Wt: Fresh Cut"}</span>
                        <span className="text-tertiary font-label-badge font-bold">{product.serves || "Serves 3-4"}</span>
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold group-hover:text-primary transition-colors text-[15px]">
                        {product.name}
                      </h3>
                      <p className="font-body-sm text-body-sm text-slate-body mt-1 leading-snug text-[12px] line-clamp-2">
                        {product.description || "Fresh country mutton cut fresh after your order."}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 pt-0">
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="font-headline-md text-headline-md font-extrabold text-on-surface text-[18px]">
                        ₹{product.price}
                      </span>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="font-body-sm text-body-sm text-slate-subtle line-through text-[13px]">
                          ₹{product.originalPrice}
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
          {fishProducts.map((product) => {
            const qty = getItemQuantity(product.id);
            const isJustAdded = addedItem === product.id;
            const wishlisted = isInWishlist(product.id);
            const discountText = product.originalPrice && product.originalPrice > product.price
              ? `${Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF`
              : ((product as any).discount || "");

            return (
              <article
                key={product.id}
                onClick={() => router.push(`/product/${product.id}`)}
                className="bg-surface-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group border border-gray-100 relative cursor-pointer"
              >
                <div>
                  <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface-container">
                    <img
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      src={product.image || (product.images && product.images[0]) || "/images/fish.png"}
                      onError={(e) => {
                        e.currentTarget.src = "https://cdn.dotpe.in/longtail/store-items/7524323/4e3AEjkv.webp";
                      }}
                    />

                    {/* Top Left: Tag */}
                    <span className="absolute top-2.5 left-2.5 bg-surface-card/95 text-tertiary font-label-badge text-label-badge px-2.5 py-1 rounded-full flex items-center gap-1 font-bold shadow-xs whitespace-nowrap text-[10.5px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span> {product.badge || "Fresh Catch"}
                    </span>

                    {/* Top Right: Wishlist Heart */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleWishlist(product.id);
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
                    {discountText && (
                      <span className="absolute bottom-2.5 left-2.5 bg-tertiary-fixed text-on-tertiary-fixed-variant font-label-badge text-label-badge px-2.5 py-0.5 rounded-full font-black shadow-xs whitespace-nowrap text-[10.5px]">
                        {discountText}
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between text-slate-body font-body-sm text-body-sm mb-1">
                      <span>{product.netWeight || "Net Wt: 1000g"}</span>
                      <span className="text-tertiary font-label-badge font-bold">{product.pieces || product.serves || "Bengali Cut"}</span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold group-hover:text-primary transition-colors text-[14.5px]">
                      {product.name}
                    </h3>
                    <p className="font-body-sm text-body-sm text-slate-body mt-1 leading-snug text-[12px] line-clamp-2">
                      {product.description || "Fresh water fish locally sourced and procured."}
                    </p>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="font-headline-md text-headline-md font-extrabold text-on-surface text-[18px]">
                      ₹{product.price}
                    </span>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <span className="font-body-sm text-body-sm text-slate-subtle line-through text-[13px]">
                        ₹{product.originalPrice}
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
                  <span>Packed in food-grade fresh-seal trays</span>
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

        {eggProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {eggProducts.map((product) => {
              const qty = getItemQuantity(product.id);
              const isJustAdded = addedItem === product.id;
              const wishlisted = isInWishlist(product.id);
              const discountText = product.originalPrice && product.originalPrice > product.price
                ? `${Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF`
                : ((product as any).discount || "");

              return (
                <article
                  key={product.id}
                  onClick={() => router.push(`/product/${product.id}`)}
                  className="bg-surface-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group border border-gray-100 relative cursor-pointer"
                >
                  <div>
                    <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface-container">
                      <img
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        src={product.image || (product.images && product.images[0]) || "/images/eggs.png"}
                        onError={(e) => {
                          e.currentTarget.src = "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=800&q=80";
                        }}
                      />

                      {/* Top Left: Tag */}
                      <span className="absolute top-2.5 left-2.5 bg-surface-card/95 text-tag-amber font-label-badge text-label-badge px-2.5 py-1 rounded-full flex items-center gap-1 font-bold shadow-xs whitespace-nowrap text-[10.5px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-tag-amber"></span> {product.badge || "Farm Fresh"}
                      </span>

                      {/* Top Right: Wishlist Heart */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleWishlist(product.id);
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
                      {discountText && (
                        <span className="absolute bottom-2.5 left-2.5 bg-tag-amber-bg text-tag-amber font-label-badge text-label-badge px-2.5 py-0.5 rounded-full font-black shadow-xs whitespace-nowrap text-[10.5px]">
                          {discountText}
                        </span>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex items-center justify-between text-slate-body font-body-sm text-body-sm mb-1">
                        <span>{product.netWeight || "Daily Harvest"}</span>
                        <span className="text-tag-amber font-label-badge font-bold">{product.pieces || "Antibiotic-free"}</span>
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold group-hover:text-primary transition-colors text-[14.5px]">
                        {product.name}
                      </h3>
                      <p className="font-body-sm text-body-sm text-slate-body mt-1 leading-snug text-[12px] line-clamp-2">
                        {product.description || "Farm fresh eggs safely packaged."}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 pt-0">
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="font-headline-md text-headline-md font-extrabold text-on-surface text-[18px]">
                        ₹{product.price}
                      </span>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="font-body-sm text-body-sm text-slate-subtle line-through text-[12px]">
                          ₹{product.originalPrice}
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
                <Link
                  className="w-full py-2.5 rounded-full bg-tag-amber text-white font-label-md text-label-md text-center block hover:opacity-90 transition-opacity shadow-sm font-bold text-decoration-none cursor-pointer whitespace-nowrap"
                  href="/category?type=eggs"
                >
                  Explore Egg Packs
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-surface-card rounded-3xl p-6 sm:p-8 border border-amber-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[36px]">egg</span>
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 font-label-badge font-bold text-[11px] mb-2 border border-amber-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  Coming Soon to Teffe&apos;s
                </div>
                <h3 className="font-headline-md font-bold text-gray-900 text-[18px] sm:text-[20px]">
                  Farm Fresh &amp; Desi Eggs Sourcing in Progress
                </h3>
                <p className="font-body-sm text-slate-body text-[13px] mt-1 max-w-xl leading-relaxed">
                  We are partnering with certified local biosecure farms to bring you 100% antibiotic-free classic and desi eggs with rich yellow yolks. New batches will be live soon!
                </p>
              </div>
            </div>
            <Link
              href="/category?type=chicken"
              className="px-5 py-2.5 rounded-full bg-primary hover:bg-primary-dark text-white font-label-md text-xs font-bold transition-all shadow-sm whitespace-nowrap shrink-0"
            >
              Browse Fresh Chicken ({chickenProducts.length}) →
            </Link>
          </div>
        )}
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
