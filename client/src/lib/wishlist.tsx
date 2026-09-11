"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Product } from "./products";
import { isAuthenticated } from "./auth";

import api from "./api";

interface WishlistContextType {
  wishlistIds: string[];
  wishlistItems: Product[];
  toggleWishlist: (productId: string) => boolean;
  isInWishlist: (productId: string) => boolean;
  wishlistCount: number;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [liveProducts, setLiveProducts] = useState<Product[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch live products so dynamically updated products are recognized
  useEffect(() => {
    let isMounted = true;
    import("./products").then(({ fetchProducts }) => {
      fetchProducts()
        .then((prods) => {
          if (isMounted && prods && prods.length > 0) {
            setLiveProducts(prods);
          }
        })
        .catch(() => {});
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Load wishlist from localStorage & MongoDB Atlas
  useEffect(() => {
    let localIds: string[] = [];
    try {
      const saved = localStorage.getItem("teffes_wishlist");
      if (saved) {
        localIds = JSON.parse(saved);
        setWishlistIds(localIds);
      }
    } catch {
      // ignore
    }

    if (isAuthenticated()) {
      api.get<{ success: boolean; wishlist: string[] }>("/user/wishlist")
        .then((res) => {
          if (res.data.success && Array.isArray(res.data.wishlist)) {
            const dbWishlist = res.data.wishlist;
            const merged = Array.from(new Set([...dbWishlist, ...localIds]));
            setWishlistIds(merged);
            localStorage.setItem("teffes_wishlist", JSON.stringify(merged));
            if (merged.length !== dbWishlist.length) {
              api.put("/user/wishlist", { wishlistIds: merged }).catch(() => {});
            }
          }
        })
        .catch((err) => console.warn("Failed to fetch cloud wishlist:", err))
        .finally(() => setIsInitialized(true));
    } else {
      setIsInitialized(true);
    }
  }, []);

  // Resolved product pool from live database products
  const productPool = React.useMemo(() => {
    const map = new Map<string, Product>();
    liveProducts.forEach((p) => map.set(p.id, p));
    return map;
  }, [liveProducts]);

  // Resolve valid wishlist items
  const wishlistItems = React.useMemo(() => {
    return wishlistIds
      .map((id) => productPool.get(id))
      .filter((p): p is Product => Boolean(p));
  }, [wishlistIds, productPool]);

  // Wishlist count ALWAYS reflects valid items
  const wishlistCount = wishlistItems.length;

  // Auto-prune orphaned IDs (e.g., deleted products or replaced catalog IDs)
  useEffect(() => {
    if (isInitialized && productPool.size > 0 && wishlistIds.length > 0) {
      const validIds = wishlistIds.filter((id) => productPool.has(id));
      if (validIds.length !== wishlistIds.length) {
        setWishlistIds(validIds);
        try {
          localStorage.setItem("teffes_wishlist", JSON.stringify(validIds));
        } catch {
          // ignore
        }
        if (isAuthenticated()) {
          api.put("/user/wishlist", { wishlistIds: validIds }).catch(() => {});
        }
      }
    }
  }, [isInitialized, productPool, wishlistIds]);

  // Save wishlist to localStorage & Atlas
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem("teffes_wishlist", JSON.stringify(wishlistIds));
      } catch {
        // ignore
      }

      if (isAuthenticated()) {
        const timer = setTimeout(() => {
          api.put("/user/wishlist", { wishlistIds }).catch(() => {});
        }, 400);
        return () => clearTimeout(timer);
      }
    }
  }, [wishlistIds, isInitialized]);

  const toggleWishlist = (productId: string): boolean => {
    setWishlistIds((prev) => {
      const exists = prev.includes(productId);
      const next = exists ? prev.filter((id) => id !== productId) : [...prev, productId];
      return next;
    });

    if (isAuthenticated()) {
      api.post("/user/wishlist/toggle", { productId }).catch(() => {});
    }
    return true;
  };

  const isInWishlist = (productId: string): boolean => {
    return wishlistIds.includes(productId) && productPool.has(productId);
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlistIds,
        wishlistItems,
        toggleWishlist,
        isInWishlist,
        wishlistCount,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
