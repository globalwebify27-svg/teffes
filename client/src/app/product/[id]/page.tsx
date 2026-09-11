"use client";

import React, { use, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getProductById, getRelatedProducts, fetchProductById, Product } from "@/lib/products";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default function ProductDetailPage({ params }: ProductPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const productId = resolvedParams.id;

  const [product, setProduct] = useState<Product | undefined>(undefined);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchProductById(productId).then((res) => {
      if (isMounted && res) {
        setProduct(res.product);
        setRelatedProducts(res.related);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [productId]);

  const { addToCart, getItemQuantity, openCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [copiedShare, setCopiedShare] = useState(false);
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });

  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewStats, setReviewStats] = useState({ totalRatings: 0, averageRating: "0" });
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: "", comment: "" });
  
  useEffect(() => {
    import("@/lib/api").then(({ default: api }) => {
      api.get(`/reviews/${productId}`).then((res) => {
        if (res.data.success) {
          setReviews(res.data.reviews || []);
          if (res.data.stats) setReviewStats(res.data.stats);
        }
      }).catch(err => console.warn("Failed to fetch reviews:", err));
    });
  }, [productId]);

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const api = (await import("@/lib/api")).default;
      const res = await api.post("/reviews", { ...reviewForm, productId });
      if (res.data.success) {
        alert("Review added successfully!");
        setReviews([res.data.review, ...reviews]);
        setIsReviewModalOpen(false);
        setReviewForm({ rating: 5, title: "", comment: "" });
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to add review. Please login and ensure you have purchased this item.");
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomOrigin({ x, y });
  };

  // If product not found
  if (!product) {
    return (
      <div className="min-h-[70vh] bg-surface-container-low flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
            <span className="material-symbols-outlined text-[32px]">restaurant</span>
          </div>
          <h1 className="font-headline-lg font-bold text-on-surface mb-2">Fresh Cut Not Found</h1>
          <p className="font-body-sm text-slate-body mb-6">
            The cut you are looking for might have been updated or renamed.
          </p>
          <Link href="/" className="btn btn-primary w-full rounded-full text-white font-bold">
            ← Browse All Fresh Cuts
          </Link>
        </div>
      </div>
    );
  }

  const quantity = getItemQuantity(product.id);
  const isWishlisted = isInWishlist(product.id);

  const discount = product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  // Build high quality multi-image list for the gallery
  const allImages = useMemo(() => {
    if (product.images && product.images.length > 1) {
      return product.images;
    }
    // If only 1 image, supply aesthetic culinary alternate angles
    const baseImg = product.image;
    if (product.category === "chicken") {
      return [
        baseImg,
        "https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=1200&q=80",
      ];
    } else if (product.category === "mutton") {
      return [
        baseImg,
        "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=1200&q=80",
      ];
    } else if (product.category === "fish") {
      return [
        baseImg,
        "https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1200&q=80",
      ];
    } else if (product.category === "eggs") {
      return [
        baseImg,
        "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=1200&q=80",
      ];
    }
    return [baseImg];
  }, [product]);

  const activeImage = allImages[selectedImageIndex] || allImages[0] || product.image;

  const handleAddToCart = () => {
    addToCart(product);
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1500);
  };

  const handleBuyNow = () => {
    if (quantity === 0) {
      addToCart(product);
    }
    openCart();
  };

  const handleShare = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2200);
      }
    } catch {
      // ignore
    }
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
          <Link href="/#chicken-section" className="hover:text-primary transition-colors text-inherit capitalize">
            {product.categoryLabel}
          </Link>
          <span>/</span>
          <span className="font-bold text-gray-900">{product.name}</span>
        </nav>

        {/* ─── Back to Storefront Link ───────────────────────────────────── */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline mb-6 text-decoration-none"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to All Cuts</span>
        </Link>

        {/* ─── Main Product Card: Side-By-Side (Matches Image Exactly) ────── */}
        <div className="bg-white rounded-3xl p-5 sm:p-8 md:p-10 border border-gray-200/80 shadow-sm mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 lg:gap-12 items-start">
            {/* ─── Left Column (Gallery: Vertical Thumbnails + Main Image) ─── */}
            <div className="lg:col-span-6 xl:col-span-7 flex flex-col-reverse sm:flex-row gap-4 items-start">
              {/* Vertical Thumbnails (Desktop & Tablet) */}
              {allImages.length > 1 && (
                <div className="flex sm:flex-col gap-2.5 overflow-x-auto sm:overflow-visible shrink-0 w-full sm:w-auto py-1 sm:py-0">
                  {allImages.map((imgUrl, idx) => {
                    const isSelected = idx === selectedImageIndex;
                    return (
                      <button
                        key={`thumb-${idx}`}
                        type="button"
                        onClick={() => setSelectedImageIndex(idx)}
                        onMouseEnter={() => setSelectedImageIndex(idx)}
                        className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden border-2 cursor-pointer transition-all p-0.5 bg-white shrink-0 ${
                          isSelected
                            ? "border-primary shadow-sm ring-2 ring-primary/20 scale-105"
                            : "border-gray-200 hover:border-gray-300 opacity-80 hover:opacity-100"
                        }`}
                        aria-label={`Select photo ${idx + 1}`}
                      >
                        <img
                          src={imgUrl}
                          alt={`${product.name} thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Main Image Frame with Interactive Cursor-Tracking Zoom */}
              <div
                className="relative flex-1 w-full aspect-square max-h-[540px] rounded-3xl overflow-hidden bg-gray-100 border border-gray-200/80 shadow-xs cursor-crosshair group select-none"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onMouseMove={handleMouseMove}
              >
                <img
                  src={activeImage}
                  alt={product.name}
                  className="w-full h-full object-cover select-none transition-transform duration-150 ease-out"
                  style={{
                    transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                    transform: isHovered ? "scale(2.2)" : "scale(1)",
                  }}
                />

                {/* Hover to Zoom Hint Pill */}
                <div
                  className={`absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs text-white text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-opacity duration-200 pointer-events-none ${
                    isHovered ? "opacity-0" : "opacity-90"
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">zoom_in</span>
                  <span>Hover to zoom</span>
                </div>

                {/* Top Left Badge */}
                {product.badge && (
                  <span className="absolute top-3.5 left-3.5 bg-white/95 backdrop-blur-xs text-tertiary font-label-badge text-label-badge px-3 py-1 rounded-full font-bold shadow-xs text-[11px] whitespace-nowrap pointer-events-none">
                    {product.badge}
                  </span>
                )}

                {/* Top Right Floating Action Icons (Wishlist & Share as shown in Image) */}
                <div className="absolute top-3.5 right-3.5 flex flex-col gap-2 z-10">
                  {/* Wishlist Button */}
                  <button
                    type="button"
                    onClick={() => toggleWishlist(product.id)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md cursor-pointer transition-all border border-gray-100 hover:scale-110 active:scale-95 ${
                      isWishlisted ? "bg-white text-crimson-bright" : "bg-white/95 text-slate-body hover:text-primary"
                    }`}
                    aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                    title={isWishlisted ? "In Wishlist" : "Add to Wishlist"}
                  >
                    <span
                      className={`material-symbols-outlined text-[22px] ${isWishlisted ? "filled text-crimson-bright" : ""}`}
                    >
                      favorite
                    </span>
                  </button>

                  {/* Share Button */}
                  <button
                    type="button"
                    onClick={handleShare}
                    className="w-10 h-10 rounded-full bg-white/95 hover:bg-white text-slate-body hover:text-primary flex items-center justify-center shadow-md cursor-pointer transition-all border border-gray-100 hover:scale-110 active:scale-95"
                    aria-label="Share product"
                    title={copiedShare ? "Link Copied!" : "Share Product"}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {copiedShare ? "done" : "share"}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* ─── Right Column (Product Information Side by Side) ─────────── */}
            <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-start">
              {/* Product Title */}
              <h1 className="font-headline-lg font-extrabold text-on-surface text-2xl sm:text-3xl leading-tight">
                {product.name}
              </h1>

              {/* Brand Tagline */}
              <div className="text-sm font-semibold text-slate-body mt-1">
                Teffes
              </div>

              {/* Price & Discount Row */}
              <div className="flex items-baseline gap-3 mt-3">
                <span className="font-headline-lg font-black text-primary text-2xl sm:text-3xl">
                  ₹{product.price}
                </span>
                {product.originalPrice > product.price && (
                  <span className="font-body-md text-slate-subtle line-through text-base sm:text-lg">
                    ₹{product.originalPrice}
                  </span>
                )}
                {discount > 0 && (
                  <span className="bg-emerald-600 text-white font-label-badge font-black text-xs px-2.5 py-0.5 rounded-md shadow-xs">
                    {discount}% OFF
                  </span>
                )}
              </div>

              {/* Inline Action Links (Add to Wishlist & Share - matches Image) */}
              <div className="flex items-center gap-6 mt-4 pb-4 border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => toggleWishlist(product.id)}
                  className="flex items-center gap-1.5 font-label-md font-bold text-gray-700 hover:text-primary transition-colors cursor-pointer border-none bg-transparent p-0 text-sm"
                >
                  <span className={`material-symbols-outlined text-[20px] ${isWishlisted ? "filled text-crimson-bright" : ""}`}>
                    favorite
                  </span>
                  <span>{isWishlisted ? "Wishlisted" : "Add to Wishlist"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center gap-1.5 font-label-md font-bold text-gray-700 hover:text-primary transition-colors cursor-pointer border-none bg-transparent p-0 text-sm"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {copiedShare ? "done" : "share"}
                  </span>
                  <span>{copiedShare ? "Link Copied!" : "Share"}</span>
                </button>
              </div>

              {/* ─── Action Buttons: Buy Now + Add to Cart ────────────────────── */}
              <div className="flex flex-col sm:flex-row gap-3.5 my-6">
                {/* Buy Now (Primary Solid Crimson/Red) */}
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="flex-1 py-3.5 px-6 rounded-xl bg-primary hover:bg-primary-dark text-white font-headline-sm font-extrabold text-[15px] shadow-md transition-all cursor-pointer border-none text-center"
                >
                  Buy Now
                </button>

                {/* Add to Cart (White with Red Border/Text) */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="flex-1 py-3.5 px-6 rounded-xl bg-white hover:bg-crimson-soft border-2 border-primary text-primary font-headline-sm font-extrabold text-[15px] shadow-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {quantity > 0 || addedAnimation ? "done" : "add_shopping_cart"}
                  </span>
                  <span>{quantity > 0 ? `In Cart (${quantity})` : "Add to Cart"}</span>
                </button>
              </div>

              {/* ─── Product Description Section ───────────────────────────── */}
              <div className="mb-5">
                <h3 className="font-headline-sm font-bold text-on-surface text-[15px] mb-1.5">
                  Product Description
                </h3>
                <p className="font-body-sm text-slate-body leading-relaxed text-[13.5px]">
                  {product.description}
                </p>
              </div>

              {/* ─── More Info / Specification Grid ─────────────────────────── */}
              <div className="pt-3 border-t border-gray-100">
                <h3 className="font-headline-sm font-bold text-on-surface text-[14px] mb-2.5">
                  More info
                </h3>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-body">
                  <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="block text-[11px] text-gray-400 font-semibold uppercase">Net Weight</span>
                    <span className="font-bold text-gray-900 text-[13px]">{product.netWeight}</span>
                  </div>

                  {product.pieces && (
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="block text-[11px] text-gray-400 font-semibold uppercase">Pieces</span>
                      <span className="font-bold text-gray-900 text-[13px]">{product.pieces}</span>
                    </div>
                  )}

                  {product.serves && (
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="block text-[11px] text-gray-400 font-semibold uppercase">Serves</span>
                      <span className="font-bold text-gray-900 text-[13px]">{product.serves}</span>
                    </div>
                  )}

                  {product.cutType && (
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="block text-[11px] text-gray-400 font-semibold uppercase">Cut Style</span>
                      <span className="font-bold text-gray-900 text-[13px]">{product.cutType}</span>
                    </div>
                  )}
                </div>

                {/* Benefits / Hygiene Points */}
                {product.benefits && product.benefits.length > 0 && (
                  <div className="mt-3.5 space-y-1.5">
                    {product.benefits.map((b, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-body">
                        <span className="material-symbols-outlined text-tertiary text-[16px]">check_circle</span>
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Reviews & Ratings ─────────────────────────────────────────── */}
        <section className="mb-12 bg-white rounded-3xl p-6 md:p-10 border border-gray-200/80 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h2 className="font-headline-md font-extrabold text-on-surface text-xl mb-1">
                Customer Reviews
              </h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center text-amber-400">
                  <span className="material-symbols-outlined text-[20px] filled">star</span>
                  <span className="font-bold text-gray-900 ml-1">{reviewStats.averageRating}</span>
                </div>
                <span className="text-xs text-slate-500">
                  Based on {reviewStats.totalRatings} reviews
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsReviewModalOpen(true)}
              className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-sm hover:bg-primary-dark transition-colors cursor-pointer border-none"
            >
              Write a Review
            </button>
          </div>

          {reviews.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
              <span className="material-symbols-outlined text-gray-400 text-4xl mb-2">rate_review</span>
              <h3 className="font-bold text-gray-900 mb-1">No reviews yet</h3>
              <p className="text-xs text-gray-500">Be the first to review this cut!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {reviews.map((rev) => (
                <div key={rev._id} className="pb-6 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                        {rev.userId?.name || "Customer"}
                        {rev.isVerifiedPurchase && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase font-bold flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[12px]">verified</span> Verified
                          </span>
                        )}
                      </h4>
                      <div className="flex text-amber-400 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={`material-symbols-outlined text-[14px] ${i < rev.rating ? "filled" : ""}`}>
                            star
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {rev.title && <h5 className="font-bold text-gray-800 text-sm mb-1">{rev.title}</h5>}
                  {rev.comment && <p className="text-sm text-slate-600 leading-relaxed">{rev.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Review Modal ──────────────────────────────────────────────── */}
        {isReviewModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in-up">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-headline-sm font-extrabold text-gray-900">Write a Review</h3>
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors border-none cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <div className="p-6">
                <form onSubmit={submitReview} className="space-y-4">
                  <div className="flex justify-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                        className="bg-transparent border-none p-0 cursor-pointer text-amber-400 transition-transform hover:scale-110"
                      >
                        <span className={`material-symbols-outlined text-3xl ${reviewForm.rating >= star ? "filled" : ""}`}>
                          star
                        </span>
                      </button>
                    ))}
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label text-xs font-bold text-gray-600 mb-1 block">Title (Optional)</label>
                    <input
                      type="text"
                      value={reviewForm.title}
                      onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                      placeholder="Summarize your experience"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label text-xs font-bold text-gray-600 mb-1 block">Review (Optional)</label>
                    <textarea
                      value={reviewForm.comment}
                      onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                      placeholder="What did you like or dislike?"
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm resize-none"
                    />
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-md hover:bg-primary-dark transition-all cursor-pointer border-none mt-2"
                  >
                    Submit Review
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ─── Related Products ("You May Also Like") ──────────────────────── */}
        {relatedProducts.length > 0 && (
          <section className="mt-8 mb-16">
            <h2 className="font-headline-md font-extrabold text-on-surface text-xl mb-4">
              You May Also Like
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {relatedProducts.map((item) => (
                <div
                  key={item.id}
                  onClick={() => router.push(`/product/${item.id}`)}
                  className="bg-white rounded-2xl overflow-hidden border border-gray-200/70 p-3 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 mb-2.5">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-2 left-2 bg-white/90 text-tertiary text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Fresh
                      </span>
                    </div>
                    <h4 className="font-headline-sm font-bold text-sm text-gray-900 line-clamp-1 group-hover:text-primary transition-colors">
                      {item.name}
                    </h4>
                    <span className="text-xs text-slate-body">{item.netWeight}</span>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                    <span className="font-bold text-primary text-base">₹{item.price}</span>
                    <span className="text-xs font-bold text-primary hover:underline">View Cut →</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
