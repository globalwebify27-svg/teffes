"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getStoredUser, clearAuth, isAuthenticated, saveAuth } from "@/lib/auth";
import type { User } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import NavbarSearch from "./NavbarSearch";
import { useLocation } from "@/context/LocationContext";
import LocationModal from "./LocationModal";
import api from "@/lib/api";
import { toast } from "@/lib/toast";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDrumstickBite,
  faUtensils,
  faFishFins,
  faEgg,
  faLayerGroup,
  faStore,
} from "@fortawesome/free-solid-svg-icons";

function getCategoryFontAwesomeIcon(key: string) {
  const k = (key || "").toLowerCase();
  if (k.includes("chicken")) return faDrumstickBite;
  if (k.includes("mutton")) return faUtensils;
  if (k.includes("fish") || k.includes("seafood")) return faFishFins;
  if (k.includes("egg")) return faEgg;
  if (k.includes("all")) return faLayerGroup;
  return faStore;
}

interface HeaderProps {
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export default function Header({ searchQuery = "", onSearchChange }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [navCategories, setNavCategories] = useState<any[]>([
    { key: "chicken", label: "Fresh Chicken", href: "/category?type=chicken" },
    { key: "mutton", label: "Rich Mutton", href: "/category?type=mutton" },
    { key: "fish", label: "Fish & Seafood", href: "/category?type=fish" },
    { key: "eggs", label: "Farm Eggs", href: "/category?type=eggs" },
  ]);
  const { openCart, totalItemsCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { currentLocation, openLocationModal } = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);

  // Detect scroll to stick navbar and switch to maroon theme
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 35);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Login Modal State for Unauthenticated User Click on Home
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [modalPhone, setModalPhone] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  useEffect(() => {
    setUser(getStoredUser());
    setMobileMenuOpen(false);
    setActiveCategory("all");

    // Dynamic Categories from Backend API
    api.get<{ success: boolean; categories: any[] }>("/categories")
      .then((res) => {
        if (res.data?.success && res.data.categories?.length > 0) {
          const mapped = res.data.categories
            .filter((c: any) => c.slug !== "all" && c.isActive !== false)
            .map((c: any) => {
              return {
                key: c.slug,
                label: c.name,
                href: `/category?type=${c.slug}`,
              };
            });
          if (mapped.length > 0) {
            setNavCategories(mapped);
          }
        }
      })
      .catch((err) => console.warn("Failed to load header categories:", err));

    // Global listener to open login modal from anywhere
    const handleOpenLogin = () => setShowLoginModal(true);
    window.addEventListener("open-login", handleOpenLogin);
    return () => window.removeEventListener("open-login", handleOpenLogin);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        setMobileSearchOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setMobileSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = async () => {
    const currentUser = getStoredUser() || user;
    const wasAdmin = currentUser?.role === "admin";
    try {
      const { logout } = await import("@/lib/auth");
      await logout();
    } finally {
      clearAuth();
      setUser(null);
      setMobileMenuOpen(false);
      if (wasAdmin) {
        router.push("/admin-login");
      } else {
        router.push("/");
      }
    }
  };

  const scrollToSection = (id: string, categoryKey: string, e: React.MouseEvent) => {
    setActiveCategory(categoryKey);
    setMobileMenuOpen(false);
    if (pathname === "/") {
      e.preventDefault();
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const handleUserClick = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setMobileMenuOpen(false);
    if (!isAuthenticated()) {
      setShowLoginModal(true);
    } else {
      router.push("/dashboard");
    }
  };

  const handleModalLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = modalPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setModalError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setModalError("");
    setModalLoading(true);

    // Generate random OTP alert as requested
    const randomOtp = Math.floor(100000 + Math.random() * 900000);
    toast.info(`Your Teffe's Login OTP is: ${randomOtp}`, "Verification OTP", 10000);

    const newUser: User = {
      id: "cust-" + cleanPhone,
      phone: `+91 ${cleanPhone}`,
      name: "Valued Customer",
      role: "customer",
      isVerified: true,
    };

    saveAuth("teffes-jwt-token-" + Date.now(), newUser);
    setUser(newUser);
    setModalLoading(false);
    setShowLoginModal(false);
    setModalPhone("");
  };

  return (
    <>
      <header
        className={`sticky top-0 inset-x-0 z-50 transition-colors duration-300 w-full ${
          isScrolled
            ? "bg-[#91000a] text-white shadow-lg border-b border-[#730008]"
            : "bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100"
        }`}
      >
        {/* Main Nav Bar */}
        <div className="h-20 w-full max-w-container-max mx-auto px-gutter-desktop flex items-center justify-between gap-space-md sm:gap-space-lg">
          {/* Left Section: Mobile Hamburger + Brand Logo + Deliver To Badge */}
          <div className="flex items-center gap-space-sm sm:gap-space-md lg:gap-space-lg shrink-0">
            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              className={`lg:hidden p-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center border-none bg-transparent ${
                isScrolled
                  ? "text-white hover:bg-white/15"
                  : "text-on-surface hover:text-primary hover:bg-surface-container-low"
              }`}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Navigation Menu"
            >
              <span className="material-symbols-outlined text-[26px]">menu</span>
            </button>

            {/* Teffe's Logo (Switches to White on Maroon Header when Scrolled) */}
            <Link href="/" className="flex items-center group text-decoration-none">
              <img
                src={isScrolled ? "/teffes-logo-white.png" : "/teffes-logo-maroon.png"}
                alt="TeFFe's — Where health matters most"
                className="h-10 sm:h-12 w-auto object-contain transition-all group-hover:scale-105 duration-200"
              />
            </Link>

            {/* Deliver To Location (Desktop) */}
            <button
              type="button"
              onClick={openLocationModal}
              suppressHydrationWarning
              className={`hidden xl:flex items-center gap-2 px-3.5 py-2 rounded-xl cursor-pointer transition-colors border text-left ${
                isScrolled
                  ? "bg-white/15 hover:bg-white/25 border-white/25 text-white"
                  : "bg-surface-container-low hover:bg-surface-container border-gray-200/40 text-on-surface"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[22px] ${
                  isScrolled ? "text-amber-300" : "text-primary"
                }`}
              >
                location_on
              </span>
              <span className="flex flex-col text-left">
                <span
                  className={`font-label-badge text-label-badge uppercase font-bold tracking-wider text-[10.5px] ${
                    isScrolled ? "text-amber-200" : "text-tertiary"
                  }`}
                >
                  {currentLocation.label || "Deliver to (90 Mins)"}
                </span>
                <span
                  className={`font-label-md text-label-md font-semibold max-w-[170px] truncate text-[13px] ${
                    isScrolled ? "text-white" : "text-on-surface"
                  }`}
                >
                  {currentLocation.shortAddress || "Select Location"}
                </span>
              </span>
              <span
                className={`material-symbols-outlined text-[18px] ${
                  isScrolled ? "text-white/80" : "text-on-surface-variant"
                }`}
              >
                expand_more
              </span>
            </button>
          </div>

          {/* Center Search Input (Desktop & Tablet) */}
          <div className="hidden md:flex flex-1 max-w-xl mx-space-md">
            <NavbarSearch isScrolled={isScrolled} />
          </div>

          {/* Right Section: Nav Links + Wishlist + Cart + Profile */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Mobile Search Toggle Icon */}
            <button
              type="button"
              className={`md:hidden p-2 rounded-full transition-colors border-none bg-transparent ${
                isScrolled
                  ? "text-white hover:bg-white/15"
                  : "text-on-surface hover:text-primary hover:bg-surface-container-low"
              }`}
              onClick={() => setMobileSearchOpen((prev) => !prev)}
              aria-label="Search items"
            >
              <span className="material-symbols-outlined text-[24px]">search</span>
            </button>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1 xl:gap-2 shrink-0 font-label-lg text-label-lg font-bold">
              <Link
                href="/"
                className={`transition-colors px-3 py-1 rounded-lg cursor-pointer text-decoration-none ${
                  isScrolled
                    ? "text-white/90 hover:text-white hover:bg-white/10"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                Home
              </Link>
              <Link
                href="/category"
                className={`transition-colors px-3 py-1 rounded-lg cursor-pointer text-decoration-none ${
                  isScrolled
                    ? "text-white/90 hover:text-white hover:bg-white/10"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                Categories
              </Link>
              <Link
                href="/offers"
                className={`transition-colors px-3 py-1 rounded-lg cursor-pointer text-decoration-none ${
                  isScrolled
                    ? "text-white/90 hover:text-white hover:bg-white/10"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                Offers
              </Link>
              <Link
                href="/about"
                className={`transition-colors px-3 py-1 rounded-lg cursor-pointer text-decoration-none ${
                  isScrolled
                    ? "text-white/90 hover:text-white hover:bg-white/10"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                About Us
              </Link>
            </nav>

            {/* Wishlist Icon Button with Notification Badge */}
            <Link
              href="/wishlist"
              className={`relative p-2.5 rounded-full transition-colors flex items-center justify-center cursor-pointer text-decoration-none ${
                isScrolled
                  ? "text-white hover:bg-white/15"
                  : "text-on-surface hover:text-primary hover:bg-surface-container-low"
              }`}
              aria-label={`Loved Cuts (${wishlistCount})`}
              title="View Wishlist"
            >
              <span className="material-symbols-outlined text-[26px]">favorite</span>
              {wishlistCount > 0 && (
                <span
                  className={`absolute top-1 right-1 min-w-[18px] h-[18px] font-label-badge text-label-badge rounded-full flex items-center justify-center font-black text-[10px] px-1 shadow-sm ${
                    isScrolled
                      ? "bg-white text-[#91000a] border border-[#91000a]/20"
                      : "bg-primary text-on-primary border border-white"
                  }`}
                >
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart Icon Button with Notification Badge */}
            <button
              type="button"
              onClick={() => openCart()}
              className={`relative p-2.5 rounded-full transition-colors flex items-center justify-center cursor-pointer border-none bg-transparent ${
                isScrolled
                  ? "text-white hover:bg-white/15"
                  : "text-on-surface hover:text-primary hover:bg-surface-container-low"
              }`}
              aria-label={`Shopping Cart (${totalItemsCount} items)`}
              title="View Shopping Cart"
            >
              <span className="material-symbols-outlined text-[27px]">shopping_bag</span>
              {totalItemsCount > 0 && (
                <span
                  className={`absolute top-1 right-1 min-w-[18px] h-[18px] font-label-badge text-label-badge rounded-full flex items-center justify-center font-black text-[10px] px-1 shadow-md ${
                    isScrolled
                      ? "bg-white text-[#91000a] border border-white"
                      : "bg-primary text-on-primary border-2 border-white"
                  }`}
                >
                  {totalItemsCount}
                </span>
              )}
            </button>

            {/* User Profile Avatar */}
            <div className="flex items-center pl-1">
              <button
                type="button"
                onClick={handleUserClick}
                className={`w-9 h-9 rounded-full flex items-center justify-center overflow-hidden transition-all cursor-pointer p-0 shadow-sm ${
                  isScrolled
                    ? "bg-white border-2 border-white hover:scale-105"
                    : "bg-surface-container-high border-2 border-primary/20 hover:border-primary"
                }`}
                title={user ? "My Account" : "Sign In"}
              >
                {user ? (
                  <span
                    className={`font-extrabold text-xs ${
                      isScrolled ? "text-[#91000a]" : "text-primary"
                    }`}
                  >
                    {(user.name || user.phone || "U").slice(0, 2).toUpperCase()}
                  </span>
                ) : (
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      isScrolled ? "text-[#91000a]" : "text-on-surface-variant"
                    }`}
                  >
                    person
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Search Dropdown */}
        {mobileSearchOpen && (
          <div
            className={`md:hidden px-gutter-desktop pb-3 pt-1 transition-colors ${
              isScrolled
                ? "bg-[#7d0008] border-t border-white/15"
                : "border-t border-gray-100 bg-surface-card"
            }`}
          >
            <NavbarSearch
              isMobile
              isScrolled={isScrolled}
              onCloseMobile={() => setMobileSearchOpen(false)}
            />
          </div>
        )}

        {/* Subnav Category Pills Strip with Responsive Background (Home Page Only) */}
        {pathname === "/" && (
          <div
            className={`w-full transition-colors duration-300 ${
              isScrolled
                ? "bg-[#7d0008] border-t border-white/15 shadow-inner"
                : "bg-surface-card shadow-[0_1px_4px_rgba(0,0,0,0.03)] border-t border-gray-100"
            }`}
          >
            <div className="w-full max-w-container-max mx-auto px-gutter-desktop flex items-center justify-between gap-space-md overflow-x-auto py-2.5">
              <nav className="flex items-center gap-2 font-label-md text-label-md whitespace-nowrap">
                {navCategories.map((cat) => {
                  return (
                    <Link
                      key={cat.key}
                      href={cat.href}
                      className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-2 text-decoration-none cursor-pointer text-[13px] font-semibold group ${
                        isScrolled
                          ? "bg-white/15 text-white hover:bg-white hover:text-[#91000a] hover:shadow-xs"
                          : "text-on-surface-variant bg-surface-container-low hover:bg-primary hover:text-white hover:shadow-xs"
                      }`}
                    >
                      <FontAwesomeIcon
                        icon={getCategoryFontAwesomeIcon(cat.key)}
                        className={`text-[13px] transition-colors ${
                          isScrolled
                            ? "text-amber-300 group-hover:text-[#91000a]"
                            : "text-primary group-hover:text-white"
                        }`}
                      />
                      <span>{cat.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div
                className={`ml-auto hidden xl:flex items-center gap-1.5 font-label-badge text-label-badge uppercase px-4 py-1.5 rounded-full shrink-0 font-bold text-[11px] whitespace-nowrap shadow-xs transition-colors ${
                  isScrolled
                    ? "text-amber-200 bg-white/15 border border-white/25"
                    : "text-tag-amber bg-tag-amber-bg border border-tag-amber/25"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">verified</span>
                Express 90 Min Guarantee
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Mobile Navigation Slide-out Drawer */}
      {mobileMenuOpen && (
        <>
          <div
            className="mobile-nav-backdrop"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          <div className="mobile-nav-drawer" role="dialog" aria-label="Mobile Navigation Menu">
            {/* Drawer Header with Original Logo */}
            <div className="p-4 bg-primary text-on-primary flex items-center justify-between border-b border-primary-container">
              <img
                src="/teffes-logo-white.png"
                alt="TeFFe's — Where health matters most"
                className="h-8 w-auto object-contain"
              />

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center cursor-pointer border-none"
                aria-label="Close menu"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Drawer Links */}
            <div className="p-3 flex flex-col gap-1 flex-1">
              <Link
                href="/"
                className={`mobile-nav-link ${pathname === "/" ? "active" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="material-symbols-outlined text-primary text-[20px]">home</span>
                <span>Home</span>
              </Link>

              <Link
                href="/category?type=chicken"
                className="mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                <FontAwesomeIcon icon={faDrumstickBite} className="text-primary text-[16px] w-5" />
                <span>Chicken Cuts</span>
              </Link>

              <Link
                href="/category?type=mutton"
                className="mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                <FontAwesomeIcon icon={faUtensils} className="text-primary text-[16px] w-5" />
                <span>Country Mutton</span>
              </Link>

              <Link
                href="/category?type=fish"
                className="mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                <FontAwesomeIcon icon={faFishFins} className="text-primary text-[16px] w-5" />
                <span>Freshwater Fish</span>
              </Link>

              <Link
                href="/category?type=eggs"
                className="mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                <FontAwesomeIcon icon={faEgg} className="text-tag-amber text-[16px] w-5" />
                <span>Farm &amp; Desi Eggs</span>
              </Link>

              <Link
                href="/offers"
                className="mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="material-symbols-outlined text-tag-amber text-[20px]">local_offer</span>
                <span>Special Offers &amp; Deals</span>
              </Link>

              <Link
                href="/about"
                className="mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="material-symbols-outlined text-primary text-[20px]">info</span>
                <span>About Us</span>
              </Link>

              <Link
                href="/return-and-exchange-policy"
                className="mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="material-symbols-outlined text-primary text-[20px]">published_with_changes</span>
                <span>Return &amp; Exchange Policy</span>
              </Link>

              <div className="my-2 border-t border-gray-200" />

              {/* Shopping Bag / Cart inside Mobile Menu */}
              <button
                type="button"
                className="mobile-nav-link w-full text-left bg-transparent border-none cursor-pointer"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openCart();
                }}
              >
                <span className="material-symbols-outlined text-primary text-[20px]">shopping_bag</span>
                <span className="flex-1">Cart</span>
                {totalItemsCount > 0 && (
                  <span className="bg-primary text-on-primary text-xs font-bold px-2 py-0.5 rounded-full">
                    {totalItemsCount}
                  </span>
                )}
              </button>

              {/* Loved Items */}
              <Link
                href="/wishlist"
                className="mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="material-symbols-outlined text-crimson-bright text-[20px]">favorite</span>
                <span className="flex-1">Loved Items</span>
                {wishlistCount > 0 && (
                  <span className="bg-primary text-on-primary text-xs font-bold px-2 py-0.5 rounded-full">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              {/* Account */}
              <button
                type="button"
                className="mobile-nav-link w-full text-left bg-transparent border-none cursor-pointer"
                onClick={handleUserClick}
              >
                <span className="material-symbols-outlined text-primary text-[20px]">person</span>
                <span>{user ? `Account (${user.name || user.phone})` : "Sign In with OTP"}</span>
              </button>

              {user && (
                <button
                  type="button"
                  className="mobile-nav-link w-full text-left bg-transparent border-none cursor-pointer text-error"
                  onClick={handleLogout}
                >
                  <span className="material-symbols-outlined text-error text-[20px]">logout</span>
                  <span>Sign Out</span>
                </button>
              )}

              {/* Deliver To Location (Mobile) */}
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => {
                  setMobileMenuOpen(false);
                  openLocationModal();
                }}
                className="w-full p-3 rounded-2xl bg-surface-container-low border border-gray-200 flex items-center justify-between text-left cursor-pointer mb-3"
              >
                <span className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[22px]">location_on</span>
                  <span className="flex flex-col text-left">
                    <span className="text-[10.5px] font-bold uppercase text-tertiary tracking-wider block">
                      Deliver to (90 Mins)
                    </span>
                    <span className="text-xs font-bold text-gray-900 truncate block max-w-[200px]">
                      {currentLocation.shortAddress || "Select Location"}
                    </span>
                  </span>
                </span>
                <span className="material-symbols-outlined text-gray-500 text-[18px]">expand_more</span>
              </button>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-surface-container-low border-t border-gray-200">
              <div className="text-xs text-slate-body mb-3 leading-relaxed">
                📍 <strong>Teffes Butchery Ranchi</strong>
                <br />
                Near Kishore Ganj Chowk, Harmu Road
                <br />
                ⚡ <span className="text-tertiary font-bold">90-Min Fresh Delivery</span>
              </div>

              <a
                href="https://wa.me/919779687955?text=Hello%20Teffes%2C%20I%20want%20to%20order%20fresh%20meat."
                target="_blank"
                rel="noopener noreferrer"
                className="btn w-full bg-[#25D366] text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm text-sm border-none cursor-pointer"
              >
                <span>Chat on WhatsApp</span>
              </a>
            </div>
          </div>
        </>
      )}

      {/* ─── CUSTOMER LOGIN POPUP MODAL ──────────────────────────────── */}
      {showLoginModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLoginModal(false);
              setModalError("");
            }
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative">
            {/* Close / Cut Modal Button */}
            <button
              type="button"
              onClick={() => {
                setShowLoginModal(false);
                setModalError("");
              }}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center border-none cursor-pointer transition-colors"
              aria-label="Close login modal"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            {/* Brand Logo & Heading */}
            <div className="text-center mb-6">
              <img
                src="/teffes-logo-maroon.png"
                alt="Teffe's — Where health matters most"
                className="h-10 w-auto object-contain mx-auto mb-3"
              />
              <h2 className="font-headline-md font-extrabold text-gray-900 text-xl tracking-tight">
                Sign in to Teffe&apos;s
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Where health matters most. Access orders, wallet credits, and faster checkout.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleModalLogin} noValidate>
              <div className="mb-4">
                <label htmlFor="modal-phone-input" className="form-label text-xs font-bold text-gray-700 block mb-1.5">
                  Mobile Number
                </label>
                <div className="relative flex items-center">
                  <input
                    id="modal-phone-input"
                    type="tel"
                    className="form-input w-full rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-900 focus:border-primary focus:outline-none"
                    style={{ paddingLeft: "68px" }}
                    placeholder="98765 43210"
                    value={modalPhone}
                    onChange={(e) => {
                      setModalError("");
                      setModalPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                    }}
                    required
                    autoFocus
                    autoComplete="tel"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Enter any 10-digit mobile number to sign in
                </span>
              </div>

              {modalError && (
                <div className="alert alert-error mb-4 text-xs p-2.5 rounded-xl flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{modalError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={modalLoading || modalPhone.length < 10}
                className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-headline-sm font-extrabold text-sm shadow-md transition-all cursor-pointer border-none flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {modalLoading ? (
                  <span>Signing in…</span>
                ) : (
                  <>
                    <span>Login with OTP</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>

              <p className="mt-4 text-center text-[11px] text-slate-400 leading-relaxed">
                By continuing, you agree to Teffe&apos;s Terms of Service &amp; Privacy Policy.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* ─── LOCATION SELECTOR MODAL ─────────────────────────────────── */}
      <LocationModal />
    </>
  );
}
