import React from "react";
import Link from "next/link";

export const metadata = {
  title: "404 - Page Not Found | TeFFe's Ranchi",
  description: "The page you are looking for does not exist. Browse our fresh butchery cuts with 90-minute express delivery across Ranchi.",
};

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-surface-container-low/40">
      <div className="max-w-lg w-full bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-gray-100 text-center flex flex-col items-center">
        {/* Graphic Icon */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#91000a]/10 text-[#91000a] flex items-center justify-center mb-6 shadow-inner">
          <span className="material-symbols-outlined text-[40px] sm:text-[48px] select-none">
            production_quantity_limits
          </span>
        </div>

        {/* 404 Status Pill */}
        <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-[#91000a] mb-3">
          Error 404 • Page Not Found
        </span>

        {/* Main Heading */}
        <h1 className="font-headline-lg font-extrabold text-gray-900 text-2xl sm:text-3xl tracking-tight mb-2">
          We Couldn&apos;t Find That Page
        </h1>

        {/* Subtitle */}
        <p className="font-body-sm text-slate-600 text-sm sm:text-base max-w-sm mb-8 leading-relaxed">
          The link you followed may be broken, or the page may have been moved. Don&apos;t worry, our fresh daily cuts are right here!
        </p>

        {/* Action Buttons (Stacked on mobile <390px, side-by-side on larger screens) */}
        <div className="flex flex-col sm:flex-row gap-3 w-full mb-8">
          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#91000a] text-white font-bold text-sm hover:bg-[#750910] transition-colors shadow-md text-decoration-none cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">home</span>
            Back to Home
          </Link>
          <Link
            href="/category?type=chicken"
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-sm transition-colors text-decoration-none cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">restaurant</span>
            Explore Cuts
          </Link>
        </div>

        {/* Popular Categories Quick Bar */}
        <div className="w-full pt-6 border-t border-gray-100">
          <p className="text-xs uppercase font-bold text-gray-400 tracking-wider mb-3">
            Popular Counters
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { label: "Fresh Chicken", href: "/category?type=chicken" },
              { label: "Rich Mutton", href: "/category?type=mutton" },
              { label: "Fish & Seafood", href: "/category?type=fish" },
              { label: "Farm Eggs", href: "/category?type=eggs" },
            ].map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-decoration-none transition-colors"
              >
                {cat.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
