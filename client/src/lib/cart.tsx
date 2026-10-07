"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Product } from "./products";
import { isAuthenticated } from "./auth";
import { useRouter } from "next/navigation";

export interface CartItem {
  product: Product;
  quantity: number;
  selectedWeight: string;
}

export interface AppliedCouponInfo {
  code: string;
  discountType: string;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number;
  discountAmount: number;
  description?: string;
}

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => boolean;
  closeCart: () => void;
  addToCart: (product: Product, selectedWeight?: string) => boolean;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  getItemQuantity: (productId: string) => number;
  clearCart: () => void;
  subtotal: number;
  deliveryFee: number;
  total: number;
  freeRiceThreshold: number;
  freeDeliveryThreshold: number;
  totalItemsCount: number;
  // Coupon state
  appliedCoupon: AppliedCouponInfo | null;
  couponDiscount: number;
  couponCode: string;
  couponError: string;
  isApplyingCoupon: boolean;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string; discount?: number }>;
  removeCoupon: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

import api from "./api";

const FREE_RICE_THRESHOLD = 499;
const FREE_DELIVERY_THRESHOLD = 399;
const STANDARD_DELIVERY_FEE = 40;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();

  // Coupon state
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCouponInfo | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [couponError, setCouponError] = useState<string>("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState<boolean>(false);

  // Load from localStorage & MongoDB Atlas if logged in
  useEffect(() => {
    let localItems: CartItem[] = [];
    try {
      const saved = localStorage.getItem("teffes_cart");
      if (saved) {
        localItems = JSON.parse(saved);
        setItems(localItems);
      }
    } catch {
      // ignore
    }

    // If user is authenticated, fetch persistent cart from MongoDB Atlas
    if (isAuthenticated()) {
      api.get<{ success: boolean; cart: CartItem[] }>("/user/cart")
        .then((res) => {
          if (res.data.success && Array.isArray(res.data.cart)) {
            const dbCart = res.data.cart;
            // Merge local and db cart items
            if (dbCart.length > 0) {
              const mergedMap = new Map<string, CartItem>();
              // Add db cart items first
              dbCart.forEach((item) => mergedMap.set(item.product.id, item));
              // Merge local items
              localItems.forEach((item) => {
                if (mergedMap.has(item.product.id)) {
                  const existing = mergedMap.get(item.product.id)!;
                  existing.quantity = Math.max(existing.quantity, item.quantity);
                } else {
                  mergedMap.set(item.product.id, item);
                }
              });
              const merged = Array.from(mergedMap.values());
              setItems(merged);
              localStorage.setItem("teffes_cart", JSON.stringify(merged));
              // Sync back merged cart
              api.put("/user/cart", { items: merged }).catch(() => {});
            } else if (localItems.length > 0) {
              // Upload local cart to Atlas
              api.put("/user/cart", { items: localItems }).catch(() => {});
            }
          }
        })
        .catch((err) => console.warn("Failed to fetch cloud cart:", err))
        .finally(() => setIsInitialized(true));
    } else {
      setIsInitialized(true);
    }
  }, []);

  // Save to localStorage & MongoDB Atlas
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem("teffes_cart", JSON.stringify(items));
      } catch {
        // ignore
      }

      // Sync to Atlas if authenticated
      if (isAuthenticated()) {
        const timer = setTimeout(() => {
          api.put("/user/cart", { items }).catch((err) =>
            console.warn("Failed to sync cart to server:", err)
          );
        }, 400);
        return () => clearTimeout(timer);
      }
    }
  }, [items, isInitialized]);

  const openCart = (): boolean => {
    // Auth check commented for UI demo preview
    // if (!isAuthenticated()) {
    //   router.push("/login");
    //   return false;
    // }
    setIsOpen(true);
    return true;
  };

  const closeCart = () => setIsOpen(false);

  const addToCart = (product: Product, selectedWeight?: string): boolean => {
    // Auth check commented for UI demo preview
    // if (!isAuthenticated()) {
    //   router.push("/login");
    //   return false;
    // }

    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          selectedWeight: selectedWeight || product.netWeight,
        },
      ];
    });
    setIsOpen(true);
    return true;
  };

  const removeFromCart = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    // Auth check commented for UI demo preview
    // if (!isAuthenticated()) {
    //   router.push("/login");
    //   return;
    // }

    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const getItemQuantity = (productId: string) => {
    const item = items.find((i) => i.product.id === productId);
    return item ? item.quantity : 0;
  };

  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem("teffes_cart");
    } catch {
      // ignore
    }
    if (isAuthenticated()) {
      api.delete("/user/cart").catch(() => {});
    }
    removeCoupon();
  };

  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const deliveryFee = subtotal === 0 || subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE;
  const total = Math.max(0, subtotal + deliveryFee - couponDiscount);
  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Apply Coupon method
  const applyCoupon = async (code: string): Promise<{ success: boolean; message: string; discount?: number }> => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      const msg = "Please enter a coupon code.";
      setCouponError(msg);
      return { success: false, message: msg };
    }

    // Business rule: Only one coupon can be applied per order.
    if (appliedCoupon && appliedCoupon.code !== cleanCode) {
      const msg = "Only one coupon can be applied per order. Please remove the existing coupon first.";
      setCouponError(msg);
      return { success: false, message: msg };
    }

    if (subtotal <= 0) {
      const msg = "Your cart is empty. Please add items to apply a coupon.";
      setCouponError(msg);
      return { success: false, message: msg };
    }

    setIsApplyingCoupon(true);
    setCouponError("");

    try {
      const res = await api.post("/coupons/apply", {
        code: cleanCode,
        cartTotal: subtotal,
      });

      if (res.data.success) {
        const c = res.data.coupon || {};
        const discountVal = Number(res.data.discount) || 0;
        const couponInfo: AppliedCouponInfo = {
          code: c.code || cleanCode,
          discountType: c.discountType || res.data.discountType || "percentage",
          discountValue: c.discountValue !== undefined ? c.discountValue : res.data.discountValue || 0,
          maxDiscountAmount: c.maxDiscountAmount !== undefined ? c.maxDiscountAmount : res.data.maxDiscountAmount,
          minOrderAmount: c.minOrderAmount !== undefined ? c.minOrderAmount : res.data.minOrderAmount || 0,
          discountAmount: discountVal,
          description: c.description || res.data.message || "",
        };

        setAppliedCoupon(couponInfo);
        setCouponDiscount(discountVal);
        setCouponError("");
        return { success: true, message: res.data.message || "Coupon applied successfully!", discount: discountVal };
      } else {
        const msg = res.data.message || "Failed to apply coupon.";
        setCouponError(msg);
        return { success: false, message: msg };
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to apply coupon.";
      setCouponError(msg);
      return { success: false, message: msg };
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponError("");
  };

  // Revalidate coupon when subtotal changes
  useEffect(() => {
    if (!appliedCoupon) return;

    if (subtotal === 0) {
      removeCoupon();
      return;
    }

    const minRequired = appliedCoupon.minOrderAmount || 0;
    if (subtotal < minRequired) {
      const msg = `Coupon "${appliedCoupon.code}" removed: Minimum order amount of ₹${minRequired} not met.`;
      removeCoupon();
      setCouponError(msg);
      return;
    }

    // Re-verify and recalculate authoritative discount on backend
    api.post("/coupons/apply", { code: appliedCoupon.code, cartTotal: subtotal })
      .then((res) => {
        if (res.data.success) {
          setCouponDiscount(res.data.discount || 0);
          setAppliedCoupon((prev) => prev ? { ...prev, discountAmount: res.data.discount || 0 } : null);
        } else {
          removeCoupon();
          setCouponError(res.data.message || "Coupon is no longer valid.");
        }
      })
      .catch((err) => {
        const errorMsg = err.response?.data?.message || "Coupon is no longer valid for this cart.";
        removeCoupon();
        setCouponError(errorMsg);
      });
  }, [subtotal]);

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        openCart,
        closeCart,
        addToCart,
        removeFromCart,
        updateQuantity,
        getItemQuantity,
        clearCart,
        subtotal,
        deliveryFee,
        total,
        freeRiceThreshold: FREE_RICE_THRESHOLD,
        freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
        totalItemsCount,
        appliedCoupon,
        couponDiscount,
        couponCode: appliedCoupon ? appliedCoupon.code : "",
        couponError,
        isApplyingCoupon,
        applyCoupon,
        removeCoupon,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
