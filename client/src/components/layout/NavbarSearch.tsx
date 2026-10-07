"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Product } from "@/lib/products";
import api from "@/lib/api";

interface NavbarSearchProps {
  placeholder?: string;
  isMobile?: boolean;
  isScrolled?: boolean;
  onCloseMobile?: () => void;
}

export default function NavbarSearch({
  placeholder = "Search for fresh Chicken, Mutton, Fish, Cuts, Eggs...",
  isMobile = false,
  isScrolled = false,
  onCloseMobile,
}: NavbarSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search effect (300ms delay)
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get<{ success: boolean; products: Product[] }>(
          `/products?search=${encodeURIComponent(trimmed)}&limit=7`
        );
        if (data.success && Array.isArray(data.products)) {
          setResults(data.products);
          setIsOpen(true);
        }
      } catch (err) {
        console.warn("Search fetch failed:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectProduct = (productId: string) => {
    setIsOpen(false);
    setQuery("");
    if (onCloseMobile) onCloseMobile();
    router.push(`/product/${productId}`);
  };

  const handleViewAllResults = () => {
    setIsOpen(false);
    if (onCloseMobile) onCloseMobile();
    router.push(`/category?search=${encodeURIComponent(query.trim())}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim()) {
      handleViewAllResults();
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Helper to highlight matching text in title like Zepto
  const highlightMatch = (text: string, search: string) => {
    if (!search.trim()) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${search})`, "gi"));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === search.toLowerCase() ? (
            <strong key={i} className="font-extrabold text-black tracking-tight">
              {part}
            </strong>
          ) : (
            <span key={i} className="font-normal text-slate-700">
              {part}
            </span>
          )
        )}
      </span>
    );
  };

  // Check if query matches category for category banner card
  const matchedCategory = (() => {
    const q = query.toLowerCase();
    if (q.includes("chic") || q.includes("murg")) {
      return {
        title: "Fresh Chicken Counter",
        sub: "Antibiotic-free, freshly prepped cuts",
        link: "/category?type=chicken",
        badge: "Explore Chicken",
        img: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=100&q=80",
      };
    }
    if (q.includes("mut") || q.includes("bakr") || q.includes("goat")) {
      return {
        title: "Rich Pasture Mutton",
        sub: "Young Khasi goat curry & shoulder cuts",
        link: "/category?type=mutton",
        badge: "Explore Mutton",
        img: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=100&q=80",
      };
    }
    if (q.includes("fish") || q.includes("mach") || q.includes("rohu") || q.includes("prawn")) {
      return {
        title: "Freshwater & Sea Catch",
        sub: "River Rohu, Catla & deveined prawns",
        link: "/category?type=fish",
        badge: "Explore Fish",
        img: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=100&q=80",
      };
    }
    if (q.includes("egg") || q.includes("anda")) {
      return {
        title: "Farm & Desi Brown Eggs",
        sub: "Antibiotic-free daily harvest",
        link: "/category?type=eggs",
        badge: "Explore Eggs",
        img: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=100&q=80",
      };
    }
    return null;
  })();

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input Box */}
      <div className="relative w-full flex items-center">
        <span
          className={`material-symbols-outlined absolute left-3.5 text-[20px] pointer-events-none ${
            isScrolled && !isMobile ? "text-slate-500" : "text-slate-400"
          }`}
        >
          search
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim() && results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full pl-10 pr-10 py-2.5 font-body-sm text-body-sm placeholder:text-slate-400 focus:outline-none transition-all ${
            isMobile
              ? "rounded-full bg-white shadow-xs text-on-surface border border-gray-200 focus:ring-2 focus:ring-primary/20"
              : isScrolled
              ? "rounded-full bg-white text-gray-900 border border-white shadow-sm focus:ring-2 focus:ring-amber-300 focus:shadow-md"
              : "rounded-full bg-surface-container-low text-on-surface border border-gray-200/70 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:shadow-md"
          }`}
          autoComplete="off"
        />

        {/* Clear Button or Spinner */}
        <div className="absolute right-3 flex items-center">
          {loading ? (
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          ) : query.trim() ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setIsOpen(false);
              }}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer flex items-center justify-center"
              aria-label="Clear search"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Floating Zepto-Style Dropdown Autocomplete */}
      {isOpen && query.trim().length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100/90 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150"
          style={{
            boxShadow: "0 20px 45px -10px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)",
          }}
        >
          {results.length === 0 && !loading ? (
            <div className="py-8 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-3">
                <span className="material-symbols-outlined text-[24px]">search_off</span>
              </div>
              <p className="font-headline-sm font-bold text-slate-800 text-[15px]">
                No cuts found for &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Try searching for Chicken, Mutton, Fish, Lollipops, Eggs, or Biryani cuts.
              </p>
            </div>
          ) : (
            <div className="py-1.5 divide-y divide-gray-100">
              {/* Category highlight card (Inspired by Zepto's "Meat Market" suggestion card) */}
              {matchedCategory && (
                <div
                  onClick={() => {
                    setIsOpen(false);
                    if (onCloseMobile) onCloseMobile();
                    router.push(matchedCategory.link);
                  }}
                  className="px-4 py-3 bg-gradient-to-r from-rose-50/70 via-orange-50/50 to-white hover:bg-rose-100/60 transition-colors flex items-center justify-between gap-3 cursor-pointer border-b border-rose-100/60"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={matchedCategory.img}
                      alt={matchedCategory.title}
                      className="w-10 h-10 rounded-xl object-cover border border-rose-200/60 shrink-0 shadow-xs"
                    />
                    <div>
                      <div className="font-headline-sm font-extrabold text-[14px] text-slate-900 leading-tight">
                        {matchedCategory.title}
                      </div>
                      <div className="text-[11.5px] text-slate-500 mt-0.5">
                        {matchedCategory.sub}
                      </div>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-primary text-white font-bold text-[11px] uppercase tracking-wider shrink-0 hover:bg-primary-dark transition-colors shadow-xs">
                    Shop Now
                  </span>
                </div>
              )}

              {/* Product Results List */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-50">
                {results.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => handleSelectProduct(product.id)}
                    className="px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
                  >
                    {/* Left side: Thumbnail + Name */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-xl bg-slate-100 border border-gray-200/70 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                        <img
                          src={product.image || "/teffes-logo-maroon.png"}
                          alt={product.name}
                          className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] text-slate-900 leading-snug truncate">
                          {highlightMatch(product.name, query.trim())}
                        </div>
                        <div className="text-[11px] text-slate-500 capitalize mt-0.5">
                          {product.categoryLabel || product.category} · {product.netWeight}
                        </div>
                      </div>
                    </div>

                    {/* Right side: Rate & Stock */}
                    <div className="text-right shrink-0 pl-2">
                      <div className="font-headline-sm font-extrabold text-primary text-[14px]">
                        ₹{product.price}
                      </div>
                      {product.originalPrice > product.price && (
                        <div className="text-[10.5px] text-slate-400 line-through">
                          ₹{product.originalPrice}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Row: "Show all results for {query}" */}
              <div
                onClick={handleViewAllResults}
                className="px-4 py-3 bg-slate-50 hover:bg-slate-100/90 transition-colors flex items-center justify-between gap-2 cursor-pointer text-slate-700"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[16px]">search</span>
                  </div>
                  <span className="text-[13px] font-medium">
                    Show all results for{" "}
                    <strong className="font-extrabold text-primary">&ldquo;{query}&rdquo;</strong>
                  </span>
                </div>
                <span className="material-symbols-outlined text-[18px] text-slate-400">
                  chevron_right
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
