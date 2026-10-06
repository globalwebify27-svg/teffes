import React from "react";

/**
 * Hero Banner Skeleton
 * Replaces the black sliding container while hero banners are being fetched from the backend.
 */
export function BannerSkeleton() {
  return (
    <div className="relative w-full aspect-[2.4/1] sm:aspect-[3.1/1] md:aspect-[3.4/1] min-h-[220px] max-h-[460px] rounded-3xl overflow-hidden skeleton-shimmer-dark border border-neutral-800/80 shadow-md">
      {/* Decorative Shimmer Highlights */}
      <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-10 md:p-12 pointer-events-none">
        {/* Top Tag & Indicator Mock */}
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 sm:w-40 bg-white/10 rounded-full animate-pulse" />
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/5" />
            <div className="w-8 h-8 rounded-full bg-white/5" />
          </div>
        </div>

        {/* Center / Bottom Headline Placeholders */}
        <div className="space-y-3 max-w-lg">
          <div className="h-7 sm:h-9 md:h-11 w-3/4 bg-white/15 rounded-xl animate-pulse" />
          <div className="h-4 sm:h-5 w-1/2 bg-white/10 rounded-lg animate-pulse" />
          <div className="pt-2">
            <div className="h-9 sm:h-11 w-32 sm:w-36 bg-crimson-bright/30 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Bottom Slide Dots Mock */}
        <div className="flex items-center justify-center gap-2">
          <div className="w-6 h-2 rounded-full bg-crimson-bright/40" />
          <div className="w-2 h-2 rounded-full bg-white/20" />
          <div className="w-2 h-2 rounded-full bg-white/20" />
          <div className="w-2 h-2 rounded-full bg-white/20" />
        </div>
      </div>
    </div>
  );
}

/**
 * Product Card Skeleton
 * Accurately mirrors the dimensions, layout, and paddings of ProductCard.tsx
 */
export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col justify-between p-3.5 sm:p-4 relative">
      <div>
        {/* Image Box */}
        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden skeleton-shimmer mb-3.5 border border-gray-100">
          {/* Wishlist icon placeholder */}
          <div className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/80 shadow-xs" />
          {/* Discount tag placeholder */}
          <div className="absolute bottom-2 right-2.5 w-14 h-5 rounded bg-gray-200/90" />
        </div>

        {/* Title */}
        <div className="h-4 bg-gray-200 rounded-md skeleton-shimmer w-4/5 mb-2" />
        {/* Subtitle / Hindi Name */}
        <div className="h-3 bg-gray-100 rounded-md skeleton-shimmer w-2/5 mb-3" />
        {/* Description line */}
        <div className="h-3 bg-gray-100 rounded-md skeleton-shimmer w-full mb-1.5" />
        <div className="h-3 bg-gray-100 rounded-md skeleton-shimmer w-3/4 mb-3.5" />

        {/* Weight & Cuts Meta Pill */}
        <div className="h-6 bg-gray-100 rounded-md skeleton-shimmer w-32 mb-4" />
      </div>

      {/* Pricing & Add to Cart Action Row */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100/90 mt-2">
        <div>
          <div className="h-5 bg-gray-200 rounded-md skeleton-shimmer w-16 mb-1" />
          <div className="h-3 bg-gray-100 rounded-md skeleton-shimmer w-20" />
        </div>
        {/* Add button pill */}
        <div className="w-18 h-8 sm:w-20 sm:h-9 bg-gray-200 rounded-full skeleton-shimmer" />
      </div>
    </div>
  );
}

/**
 * Product Grid Skeleton
 * Renders multiple ProductCardSkeletons in a responsive grid.
 */
export function ProductGridSkeleton({
  count = 5,
  columns = "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
}: {
  count?: number;
  columns?: string;
}) {
  return (
    <div className={`grid ${columns} gap-4`}>
      {Array.from({ length: count }).map((_, idx) => (
        <ProductCardSkeleton key={idx} />
      ))}
    </div>
  );
}

/**
 * Category Bar Skeleton
 * Displayed while categories are being loaded on the home page.
 */
export function CategoryBarSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-white border border-gray-100 shadow-xs"
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl skeleton-shimmer mb-2.5" />
          <div className="h-3 w-16 bg-gray-200 rounded skeleton-shimmer mb-1" />
          <div className="h-2 w-10 bg-gray-100 rounded skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}

/**
 * Product Detail Page Skeleton
 * Full page placeholder for the product detail view.
 */
export function ProductDetailSkeleton() {
  return (
    <div className="w-full min-h-[70vh] bg-surface-container-low py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Left: Gallery Skeleton */}
        <div className="space-y-4">
          <div className="w-full aspect-[4/3] rounded-3xl skeleton-shimmer border border-gray-200 shadow-xs" />
          <div className="grid grid-cols-4 gap-3">
            <div className="aspect-square rounded-2xl skeleton-shimmer border border-gray-200" />
            <div className="aspect-square rounded-2xl skeleton-shimmer border border-gray-200" />
            <div className="aspect-square rounded-2xl skeleton-shimmer border border-gray-200" />
            <div className="aspect-square rounded-2xl skeleton-shimmer border border-gray-200" />
          </div>
        </div>

        {/* Right: Info Skeleton */}
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="h-5 w-24 rounded-full skeleton-shimmer" />
            <div className="h-9 w-3/4 rounded-xl skeleton-shimmer" />
            <div className="h-4 w-1/3 rounded-lg skeleton-shimmer" />
          </div>

          <div className="flex items-center gap-3">
            <div className="h-6 w-20 rounded-md skeleton-shimmer" />
            <div className="h-4 w-28 rounded-md skeleton-shimmer" />
          </div>

          {/* Price */}
          <div className="h-10 w-44 rounded-xl skeleton-shimmer" />

          {/* Description */}
          <div className="space-y-2">
            <div className="h-4 w-full rounded skeleton-shimmer" />
            <div className="h-4 w-5/6 rounded skeleton-shimmer" />
            <div className="h-4 w-2/3 rounded skeleton-shimmer" />
          </div>

          {/* Weight options */}
          <div className="space-y-2">
            <div className="h-4 w-28 rounded skeleton-shimmer" />
            <div className="flex gap-3">
              <div className="h-10 w-24 rounded-xl skeleton-shimmer" />
              <div className="h-10 w-24 rounded-xl skeleton-shimmer" />
              <div className="h-10 w-24 rounded-xl skeleton-shimmer" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <div className="h-12 flex-1 rounded-full skeleton-shimmer" />
            <div className="h-12 w-12 rounded-full skeleton-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}
