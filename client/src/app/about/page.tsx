import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us - Teffes Ranchi Butcher Shop",
  description: "Learn about Teffes, Ranchi's trusted butchery for over a decade. Fresh, hygienic chicken, mutton, fish, and eggs delivered in 90 minutes.",
};

export default function AboutPage() {
  return (
    <div className="w-full min-h-screen bg-[#f8fafc] py-8 sm:py-12 font-body-md text-on-surface">
      <div className="w-full max-w-container-max mx-auto px-gutter-desktop">
        {/* ─── Breadcrumb ───────────────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-body mb-6">
          <Link href="/" className="hover:text-primary transition-colors text-inherit">
            Home
          </Link>
          <span>/</span>
          <span className="font-bold text-gray-900">About Us</span>
        </nav>

        {/* ─── Hero Section: Where Health Matters Most ───────────────────────── */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 md:p-12 border border-gray-200/80 shadow-xs mb-8">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            <div className="w-full lg:w-1/2 space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-crimson-soft text-primary font-label-badge text-label-badge uppercase font-bold tracking-wider border border-primary/20 text-[11px] whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                <span>Decade of Culinary Trust in Ranchi</span>
              </div>

              <h1 className="font-headline-xl text-3xl sm:text-4xl md:text-5xl text-on-surface font-black tracking-tight leading-tight">
                Where Health Matters Most
              </h1>

              <p className="font-body-lg text-body-lg text-slate-body leading-relaxed">
                With thousands of satisfied customers and over a decade of trust, Teffes is now online to provide healthy, hygienic, and fresh chicken, fish, and mutton, with the sole purpose of giving consumers the option to choose fresh and clean meat.
              </p>

              <p className="font-body-md text-primary font-bold text-base">
                Fresh. Clean. Trusted — that&apos;s the Teffes promise.
              </p>

              {/* Trust Metric Tiles */}
              <div className="grid grid-cols-3 gap-3 pt-3">
                <div className="p-3.5 rounded-2xl bg-surface-container-low text-center border border-gray-200/60 shadow-2xs">
                  <span className="font-headline-lg text-primary font-black block text-2xl">10+</span>
                  <span className="font-body-sm text-slate-body uppercase font-bold text-[10px]">
                    Years in Ranchi
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-surface-container-low text-center border border-gray-200/60 shadow-2xs">
                  <span className="font-headline-lg text-tertiary font-black block text-2xl">50k+</span>
                  <span className="font-body-sm text-slate-body uppercase font-bold text-[10px]">
                    Orders Delivered
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-surface-container-low text-center border border-gray-200/60 shadow-2xs">
                  <span className="font-headline-lg text-secondary font-black block text-2xl">100%</span>
                  <span className="font-body-sm text-slate-body uppercase font-bold text-[10px]">
                    Fresh
                  </span>
                </div>
              </div>
            </div>

            {/* Graphic */}
            <div className="w-full lg:w-1/2 flex justify-center">
              <div className="relative w-full max-w-md aspect-4/3 rounded-3xl overflow-hidden shadow-md border border-gray-200">
                <img
                  src="https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80"
                  alt="Teffes Master Butchery"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-6">
                  <div className="text-white">
                    <span className="font-bold text-sm block">Kishore Ganj Chowk, Harmu Road</span>
                    <span className="text-xs text-white/80">Ranchi, Jharkhand 834001</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 4 Pillars of Freshness ───────────────────────────────────────── */}
        <div className="mb-12">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="font-label-badge text-primary uppercase font-bold tracking-wider text-xs">
              The Teffes Standard
            </span>
            <h2 className="font-headline-lg text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">
              4 Pillars of Meat Freshness
            </h2>
            <p className="text-xs sm:text-sm text-slate-body mt-1">
              Why thousands of Ranchi families trust Teffes for their daily culinary needs.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                icon: "content_cut",
                title: "Cut After Order",
                desc: "Never pre-sliced or stored in deep freezers. Every bird or meat cut is prepared freshly by master butchers once you click order.",
              },
              {
                icon: "water_drop",
                title: "RO Water Washed",
                desc: "Thoroughly washed with purified RO water and sealed in hygienic, temperature-controlled insulated packaging.",
              },
              {
                icon: "shield",
                title: "100% Chemical Free",
                desc: "Zero formalin, zero artificial growth hormones, and zero artificial preservatives. 100% natural farm poultry & goat.",
              },
              {
                icon: "bolt",
                title: "90-Min Delivery",
                desc: "Speedy delivery from Kishore Ganj Chowk across Ranchi city straight to your kitchen doorstep.",
              },
            ].map((pillar) => (
              <div
                key={pillar.title}
                className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200/80 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                    <span className="material-symbols-outlined text-[24px]">{pillar.icon}</span>
                  </div>
                  <h3 className="font-headline-sm font-bold text-gray-900 text-base mb-2">
                    {pillar.title}
                  </h3>
                  <p className="text-xs text-slate-body leading-relaxed">
                    {pillar.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Store Location & Visiting Counter ─────────────────────────────── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs mb-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <span className="font-label-badge text-tertiary uppercase font-bold text-xs tracking-wider">
                Visit Our Physical Butchery Hub
              </span>
              <h2 className="font-headline-md font-extrabold text-gray-900 text-xl sm:text-2xl mt-1">
                Kishore Ganj Chowk, Ranchi
              </h2>
              <p className="text-xs sm:text-sm text-slate-body mt-1 max-w-lg leading-relaxed">
                Experience our open-counter butcher shop where you can select live poultry, custom cuts, and freshwater catches in person.
              </p>
              <div className="mt-3 text-xs text-slate-600 font-medium space-y-1">
                <div>📍 Harmu Road, Near Kishore Ganj Chowk, Ranchi 834001</div>
                <div>⏰ Counter Open Daily: 7:00 AM – 9:00 PM</div>
                <div>📞 Customer Hotline: +91 94311 00000</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                href="/category"
                className="px-6 py-3 rounded-full bg-primary hover:bg-primary-dark text-white font-headline-sm font-bold text-sm shadow-md transition-all text-center text-decoration-none"
              >
                Browse Fresh Cuts
              </Link>
              <Link
                href="/"
                className="px-6 py-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-headline-sm font-bold text-sm transition-all text-center text-decoration-none"
              >
                Back to Storefront
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
