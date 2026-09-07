"use client";

import React, { useState, useEffect } from "react";
import { useCart } from "@/lib/cart";
import { isAuthenticated, getStoredUser } from "@/lib/auth";
import api from "@/lib/api";
import { useLocation } from "@/context/LocationContext";

interface Address {
  _id: string;
  tag: string;
  line1: string;
  line2?: string;
  city: string;
  pincode: string;
  isDefault?: boolean;
}

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

interface StoreOption {
  _id?: string;
  storeId: string;
  name: string;
  city?: string;
  address: string;
  phone?: string;
  timings?: string;
  distance?: string;
  status?: string;
  pickupEnabled?: boolean;
}

const DEFAULT_STORES: StoreOption[] = [
  {
    storeId: "S001",
    name: "TeFFe's — Kishore Ganj",
    city: "Ranchi",
    address: "Plot 42, Main Road, Kishore Ganj, Ranchi 834001",
    phone: "+91 9779687955",
    timings: "08:00 AM - 08:00 PM",
    distance: "0.8 km away",
    status: "Active",
    pickupEnabled: true,
  },
  {
    storeId: "S002",
    name: "TeFFe's — Doranda Hub",
    city: "Ranchi",
    address: "Doranda Bazar, Near High Court, Ranchi 834002",
    phone: "+91 9279682955",
    timings: "08:00 AM - 08:00 PM",
    distance: "2.4 km away",
    status: "Active",
    pickupEnabled: true,
  },
  {
    storeId: "S003",
    name: "TeFFe's — Harmu Road",
    city: "Ranchi",
    address: "Harmu Housing Colony, Ranchi 834002",
    phone: "+91 9876543210",
    timings: "08:00 AM - 08:00 PM",
    distance: "1.6 km away",
    status: "Active",
    pickupEnabled: true,
  },
  {
    storeId: "S004",
    name: "Teffes - Doranda store",
    city: "Ranchi",
    address: "North office pada doranda, Ranchi 834002",
    phone: "+91 1234567891",
    timings: "08:00 AM - 08:00 PM",
    distance: "3.1 km away",
    status: "Active",
    pickupEnabled: true,
  },
];

export default function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    subtotal,
    deliveryFee,
    total,
    freeRiceThreshold,
    freeDeliveryThreshold,
    totalItemsCount,
  } = useCart();

  // Top fulfillment mode: "delivery" (auto-selected by default) or "pickup"
  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");

  // Stores for self-pickup
  const [stores, setStores] = useState<StoreOption[]>(DEFAULT_STORES);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("S001");
  const [pickupNote, setPickupNote] = useState<string>("");

  // Navigation views: "cart" -> "payment" -> "success"
  const [view, setView] = useState<"cart" | "payment" | "success">("cart");
  const [slot, setSlot] = useState<"express" | "evening">("express");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoggedIn(isAuthenticated());

      // Fetch live stores list from backend API
      api.get<{ success: boolean; stores: StoreOption[] }>("/stores")
        .then((res) => {
          if (res.data.success && Array.isArray(res.data.stores) && res.data.stores.length > 0) {
            const mapped = res.data.stores.map((s, idx) => ({
              ...s,
              distance: s.distance || (idx === 0 ? "0.8 km away" : idx === 1 ? "2.4 km away" : idx === 2 ? "1.6 km away" : "3.1 km away"),
            }));
            setStores(mapped);
          }
        })
        .catch((err) => console.warn("Failed to fetch stores for pickup:", err));
    }
  }, [isOpen]);

  // Tip Delivery Partner state (Zepto style)
  const [selectedTip, setSelectedTip] = useState<number>(0);
  const [customTipInput, setCustomTipInput] = useState<string>("");
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
  const [tipTab, setTipTab] = useState<"tip" | "instructions">("tip");
  const [deliveryNote, setDeliveryNote] = useState<string>("");

  // Payment method state ("cod" | "razorpay" | "wallet")
  const [selectedPayment, setSelectedPayment] = useState<string>("cod");
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [showAddAddressForm, setShowAddAddressForm] = useState<boolean>(false);
  const [newAddress, setNewAddress] = useState({ tag: "Home", line1: "", line2: "", city: "Ranchi", pincode: "" });
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);

  const [orderSummary, setOrderSummary] = useState<{
    id: string;
    totalAmount: number;
    tipAmount: number;
    itemsCount: number;
    paymentType: string;
    fulfillmentType: "delivery" | "pickup";
    storeName?: string;
    storeAddress?: string;
    storePhone?: string;
  } | null>(null);

  const [couponCode, setCouponCode] = useState<string>("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountValue: number } | null>(null);
  const [couponError, setCouponError] = useState<string>("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setCouponError("");
    setIsApplyingCoupon(true);
    try {
      const res = await api.post("/coupons/validate", { code: couponCode, cartTotal: subtotal });
      if (res.data.success) {
        setAppliedCoupon({
          code: res.data.coupon.code,
          discountValue: res.data.coupon.discountValue || 50,
        });
      } else {
        setCouponError(res.data.message || "Invalid coupon");
      }
    } catch (err: any) {
      setCouponError(err.response?.data?.message || "Failed to apply coupon");
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  if (!isOpen) return null;

  const isPickup = fulfillmentType === "pickup";
  const effectiveDeliveryFee = isPickup ? 0 : deliveryFee;
  const effectiveTip = isPickup ? 0 : selectedTip;
  const discountAmount = appliedCoupon ? appliedCoupon.discountValue : 0;
  const finalPayable = Math.max(0, subtotal + effectiveDeliveryFee + effectiveTip - discountAmount);

  const selectedStore =
    stores.find((s) => s.storeId === selectedStoreId) || stores[0] || DEFAULT_STORES[0];

  const riceProgress = Math.min(100, Math.round((subtotal / freeRiceThreshold) * 100));
  const amountForFreeRice = Math.max(0, freeRiceThreshold - subtotal);
  const amountForFreeDelivery = Math.max(0, freeDeliveryThreshold - subtotal);

  // Tip handler
  const handleSelectTip = (amount: number) => {
    setShowCustomInput(false);
    if (selectedTip === amount) {
      setSelectedTip(0);
    } else {
      setSelectedTip(amount);
    }
  };

  const handleCustomTipSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseInt(customTipInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setSelectedTip(parsed);
      setShowCustomInput(false);
    } else {
      setSelectedTip(0);
    }
  };

  const { currentLocation } = useLocation();

  // Fetch user addresses from backend
  const fetchAddresses = async () => {
    try {
      const res = await api.get<{ success: boolean; addresses: Address[] }>("/user/addresses");
      if (res.data.success && Array.isArray(res.data.addresses)) {
        setAddresses(res.data.addresses);
        const match = res.data.addresses.find((a) => a._id === currentLocation.addressId);
        const def = match || res.data.addresses.find((a) => a.isDefault) || res.data.addresses[0];
        if (def && !selectedAddressId) setSelectedAddressId(def._id);
      }
    } catch (err) {
      console.warn("Could not fetch addresses:", err);
    }
  };

  const handleAddNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post<{ success: boolean; addresses: Address[] }>("/user/addresses", newAddress);
      if (res.data.success && res.data.addresses) {
        setAddresses(res.data.addresses);
        const newest = res.data.addresses[res.data.addresses.length - 1];
        if (newest) setSelectedAddressId(newest._id);
        setShowAddAddressForm(false);
        setNewAddress({ tag: "Home", line1: "", line2: "", city: "Ranchi", pincode: "" });
      }
    } catch (err) {
      console.error("Failed to add address:", err);
      alert("Failed to save address");
    }
  };

  // Proceed from cart to payment view inside drawer
  const handleProceedToPayment = async () => {
    if (!isLoggedIn) {
      closeCart();
      window.dispatchEvent(new CustomEvent("open-login"));
      return;
    }

    if (fulfillmentType === "delivery") {
      await fetchAddresses();
    }
    
    try {
      const res = await api.get<{ success: boolean; balance: number }>("/wallet/details");
      if (res.data.success) {
        setWalletBalance(res.data.balance || 0);
      }
    } catch (err) {
      console.warn("Failed to fetch wallet balance:", err);
    }
    
    setView("payment");
  };

  // Final Order Confirmation (Cash on Delivery / Pay at Counter)
  const handleConfirmOrder = async () => {
    if (isPlacingOrder) return;
    if (fulfillmentType === "delivery" && !selectedAddressId && addresses.length > 0) {
      alert("Please select a delivery address.");
      return;
    }

    setIsPlacingOrder(true);
    try {
      const orderPayload = {
        items: items.map((i) => ({
          productId: i.product.id,
          name: i.product.name,
          price: i.product.price,
          quantity: i.quantity,
          netWeight: i.selectedWeight,
          image: i.product.image,
        })),
        amount: finalPayable,
        addressId: fulfillmentType === "delivery" ? selectedAddressId : undefined,
        pickupMode: fulfillmentType === "pickup",
        storeId: selectedStore?.storeId || "S001",
        storeName: selectedStore?.name || "Kishore Ganj",
        deliverySlot: fulfillmentType === "pickup" ? "Store Pickup" : slot === "express" ? "90 Mins Express Delivery" : "Evening Delivery (6-9 PM)",
        paymentMethod: selectedPayment === "wallet" ? "wallet" : fulfillmentType === "pickup" ? "Pay at Store Counter" : "Cash on Delivery",
        couponCode: appliedCoupon?.code,
        discountAmount: appliedCoupon?.discountValue || 0,
      };

      const res = await api.post<{ success: boolean; order: { orderId: string } }>("/orders", orderPayload);
      if (res.data.success) {
        clearCart();
        closeCart();
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      console.error("Failed to place order:", err);
      alert(err.response?.data?.message || "Failed to place order. Please try again.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Razorpay Online Payment
  const handleRazorpayPayment = async () => {
    if (isPlacingOrder) return;
    if (fulfillmentType === "delivery" && !selectedAddressId && addresses.length > 0) {
      alert("Please select a delivery address.");
      return;
    }

    setIsPlacingOrder(true);
    try {
      const loaded = await loadRazorpayScript();

      const orderPayload = {
        items: items.map((i) => ({
          productId: i.product.id,
          name: i.product.name,
          price: i.product.price,
          quantity: i.quantity,
          netWeight: i.selectedWeight,
          image: i.product.image,
        })),
        amount: finalPayable,
        addressId: fulfillmentType === "delivery" ? selectedAddressId : undefined,
        pickupMode: fulfillmentType === "pickup",
        storeId: selectedStore?.storeId || "S001",
        storeName: selectedStore?.name || "Kishore Ganj",
        deliverySlot: fulfillmentType === "pickup" ? "Store Pickup" : slot === "express" ? "90 Mins Express Delivery" : "Evening Delivery (6-9 PM)",
        couponCode: appliedCoupon?.code,
        discountAmount: appliedCoupon?.discountValue || 0,
      };

      // Create Razorpay order on backend
      const rzpRes = await api.post<{ success: boolean; order: any; keyId: string }>("/payment/create-order", {
        amount: finalPayable,
      });

      const storedUser = getStoredUser();

      if (loaded && (window as any).Razorpay) {
        const options = {
          key: rzpRes.data.keyId || "rzp_test_default",
          amount: rzpRes.data.order.amount,
          currency: "INR",
          name: "TeFFe's Butcher Shop",
          description: `Order of ${totalItemsCount} item(s)`,
          order_id: rzpRes.data.order.id.startsWith("order_dev_") ? undefined : rzpRes.data.order.id,
          handler: async function (response: any) {
            try {
              await api.post("/orders", {
                ...orderPayload,
                paymentMethod: "Online Payment (Razorpay)",
                paymentStatus: "Paid",
                razorpayOrderId: response.razorpay_order_id || rzpRes.data.order.id,
                razorpayPaymentId: response.razorpay_payment_id,
              });
              clearCart();
              closeCart();
              window.location.href = "/dashboard";
            } catch (createErr) {
              console.error("Order creation error after payment:", createErr);
              clearCart();
              closeCart();
              window.location.href = "/dashboard";
            }
          },
          prefill: {
            name: storedUser?.name || "Valued Customer",
            contact: storedUser?.phone || "+91 9999999999",
            email: storedUser?.email || "customer@teffes.com",
          },
          theme: {
            color: "#800020",
          },
          modal: {
            ondismiss: function () {
              setIsPlacingOrder(false);
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", function (resp: any) {
          alert("Payment failed: " + resp.error.description);
          setIsPlacingOrder(false);
        });
        rzp.open();
      } else {
        // Fallback for simulated test environment
        await api.post("/orders", {
          ...orderPayload,
          paymentMethod: "Online Payment (Razorpay)",
          paymentStatus: "Paid",
        });
        clearCart();
        closeCart();
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      console.error("Razorpay error:", err);
      alert(err.response?.data?.message || "Payment initiation failed. Please try again or choose Cash on Delivery.");
      setIsPlacingOrder(false);
    }
  };

  const handleResetAndClose = () => {
    setSelectedTip(0);
    setShowCustomInput(false);
    setView("cart");
    setOrderSummary(null);
    closeCart();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="drawer-backdrop" onClick={closeCart} />

      {/* Slide-over Drawer */}
      <div className="cart-drawer" role="dialog" aria-modal="true" aria-label="Shopping Cart">
        {/* ─── VIEW 1: CART / BASKET VIEW ────────────────────────────────────────── */}
        {view === "cart" && (
          <>
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
                </div>
                <div>
                  <h2 className="font-headline-sm text-on-surface font-extrabold m-0 text-[1.1rem]">My Basket</h2>
                  <span className="font-body-sm text-slate-body text-[12px] block">
                    {totalItemsCount} {totalItemsCount === 1 ? "item" : "items"} from TeFFe&apos;s Butcher Shop
                  </span>
                </div>
              </div>
              <button
                onClick={closeCart}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border-none transition-colors"
                aria-label="Close Cart"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* ─── TOP TABS: DELIVERY VS STORE PICKUP ──────────────────────────── */}
            <div className="bg-[#f8f6f2] px-5 py-2.5 border-b border-gray-200 shrink-0">
              <div className="bg-gray-200/80 p-1 rounded-xl flex items-center gap-1.5 shadow-2xs">
                {/* Tab 1: Normal Delivery Flow (Auto-selected by default) */}
                <button
                  type="button"
                  id="tab-delivery-flow"
                  onClick={() => setFulfillmentType("delivery")}
                  className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 font-bold text-[13px] transition-all border-none cursor-pointer ${
                    fulfillmentType === "delivery"
                      ? "bg-white text-primary shadow-xs ring-1 ring-black/5"
                      : "bg-transparent text-slate-body hover:text-on-surface"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">two_wheeler</span>
                  <span>Home Delivery</span>
                </button>

                {/* Tab 2: Store Pickup Flow */}
                <button
                  type="button"
                  id="tab-pickup-flow"
                  onClick={() => setFulfillmentType("pickup")}
                  className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 font-bold text-[13px] transition-all border-none cursor-pointer ${
                    fulfillmentType === "pickup"
                      ? "bg-white text-primary shadow-xs ring-1 ring-black/5"
                      : "bg-transparent text-slate-body hover:text-on-surface"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">storefront</span>
                  <span>Store Pickup</span>
                  <span className={`text-[10px] uppercase font-black px-1.5 py-0.5 rounded-full ${
                    fulfillmentType === "pickup" ? "bg-emerald-100 text-emerald-800" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    FREE
                  </span>
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              /* Empty Cart */
              <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center text-slate-subtle mb-4">
                  <span className="material-symbols-outlined text-[36px]">shopping_basket</span>
                </div>
                <h3 className="font-headline-sm text-on-surface font-extrabold mb-1">Your basket is empty</h3>
                <p className="font-body-sm text-slate-body max-w-[260px] mb-6 text-[13px]">
                  Explore our freshly cut chicken, tender mutton, freshwater fish, and farm eggs.
                </p>
                <button onClick={closeCart} className="btn btn-primary px-6 py-2.5 rounded-full text-white font-bold">
                  Browse Fresh Cuts
                </button>
              </div>
            ) : (
              <>
                {/* ─── FULFILLMENT BANNER ─── */}
                {fulfillmentType === "delivery" ? (
                  /* Delivery Address Block (matches navbar) */
                  <div className="bg-surface-container-low px-5 py-3 border-b border-gray-200/80 flex items-start gap-3 shrink-0">
                    <span className="material-symbols-outlined text-primary text-[22px] mt-0.5 shrink-0">location_on</span>
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <span className="font-label-badge uppercase text-tertiary font-bold tracking-wider text-[10px]">
                          Deliver to (90 Mins)
                        </span>
                        <span className="font-label-badge text-[11px] text-primary font-bold">
                          Ranchi Hub
                        </span>
                      </div>
                      <p className="font-label-md text-on-surface font-semibold text-[13px] leading-tight mt-0.5">
                        Kacheri Chowk, Ranchi
                      </p>
                      <p className="font-body-sm text-slate-body text-[11px] leading-tight mt-0.5">
                        Near Kishore Ganj Chowk, Harmu Road • 5km Delivery Radius
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Store Pickup Selected Banner */
                  <div className="bg-emerald-50/90 px-5 py-3 border-b border-emerald-200/70 flex items-start gap-3 shrink-0">
                    <span className="material-symbols-outlined text-emerald-700 text-[22px] mt-0.5 shrink-0">storefront</span>
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <span className="font-label-badge uppercase text-emerald-800 font-extrabold tracking-wider text-[10px]">
                          Pickup At Store (Zero Fee)
                        </span>
                        <span className="font-label-badge text-[11px] text-emerald-800 font-black bg-emerald-100 px-2 py-0.5 rounded-full">
                          Ready in 15 mins
                        </span>
                      </div>
                      <p className="font-label-md text-on-surface font-extrabold text-[13px] leading-tight mt-0.5">
                        {selectedStore?.name}
                      </p>
                      <p className="font-body-sm text-slate-body text-[11px] leading-tight mt-0.5">
                        {selectedStore?.address}
                      </p>
                    </div>
                  </div>
                )}

                {/* Free Gift / Delivery Milestone Progress Bar */}
                <div className="bg-amber-50/70 border-b border-amber-200/50 px-5 py-3 shrink-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-label-md font-bold text-amber-900 flex items-center gap-1.5 text-[12px]">
                      {riceProgress >= 100 ? (
                        <>
                          <span className="material-symbols-outlined text-amber-600 text-[18px]">celebration</span>
                          <span>300g Premium Basmati Rice unlocked for FREE!</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-amber-600 text-[18px]">rice_bowl</span>
                          <span>Add ₹{amountForFreeRice} more for FREE 300g Basmati Rice</span>
                        </>
                      )}
                    </span>
                    <span className="font-label-badge font-bold text-amber-800 text-[11px]">{riceProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-amber-200/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-300 rounded-full"
                      style={{ width: `${riceProgress}%` }}
                    />
                  </div>
                </div>

                {/* Scrollable Body: Stores List OR Delivery Speed + Items + Instructions */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {/* ─── TAB 2 CONTENT: STORE SELECTION LIST ─── */}
                  {fulfillmentType === "pickup" && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="font-headline-sm font-extrabold text-on-surface text-[13.5px] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-primary text-[18px]">location_searching</span>
                          <span>Select Pickup Store nearby you</span>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                          {stores.length} Available
                        </span>
                      </div>

                      <div className="space-y-2">
                        {stores.map((store) => {
                          const isSelected = store.storeId === selectedStoreId;
                          return (
                            <div
                              key={store.storeId}
                              onClick={() => setSelectedStoreId(store.storeId)}
                              className={`p-3 rounded-2xl border transition-all cursor-pointer text-left ${
                                isSelected
                                  ? "border-primary bg-crimson-soft shadow-xs ring-1 ring-primary/20"
                                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60"
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                {/* Radio Indicator */}
                                <div
                                  className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                                    isSelected ? "border-primary bg-primary" : "border-gray-300 bg-white"
                                  }`}
                                >
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-headline-sm font-extrabold text-on-surface text-[13.5px]">
                                      {store.name}
                                    </span>
                                    {isSelected && (
                                      <span className="text-[10px] uppercase font-black px-1.5 py-0.2 bg-primary text-white rounded-full shrink-0">
                                        Selected
                                      </span>
                                    )}
                                  </div>

                                  <p className="font-body-sm text-slate-body text-[11.5px] mt-0.5 leading-snug">
                                    {store.address}
                                  </p>

                                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-body flex-wrap">
                                    <span className="flex items-center gap-1 text-emerald-700 font-bold">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                      <span>Open for Pickup</span>
                                    </span>
                                    <span>•</span>
                                    <span>{store.timings || "08:00 AM - 08:00 PM"}</span>
                                    {store.distance && (
                                      <>
                                        <span>•</span>
                                        <span className="font-bold text-primary">{store.distance}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Pickup Info Alert */}
                      <div className="p-3 bg-amber-50/80 border border-amber-200/70 rounded-xl flex items-start gap-2.5 text-[11.5px] text-amber-900">
                        <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0 mt-0.2">schedule</span>
                        <div>
                          <strong>Quick Pickup:</strong> Order will be freshly carved and packaged within <strong>15 minutes</strong>. Collect anytime before 8:00 PM today!
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── TAB 1 CONTENT: DELIVERY SPEED SLOTS ─── */}
                  {fulfillmentType === "delivery" && (
                    <div className="p-3 bg-slate-50 rounded-2xl border border-gray-200">
                      <div className="font-label-badge uppercase font-bold text-slate-body text-[10.5px] mb-2">
                        Select Delivery Speed (Ranchi Only)
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSlot("express")}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                            slot === "express"
                              ? "border-primary bg-crimson-soft shadow-xs"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center gap-1 font-label-md font-bold text-on-surface text-[12.5px]">
                            <span className="material-symbols-outlined text-primary text-[16px]">bolt</span>
                            <span>90-Min Express</span>
                          </div>
                          <div className="font-body-sm text-slate-body text-[11px] mt-0.5">Cut &amp; delivered fresh</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSlot("evening")}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                            slot === "evening"
                              ? "border-primary bg-crimson-soft shadow-xs"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center gap-1 font-label-md font-bold text-on-surface text-[12.5px]">
                            <span className="material-symbols-outlined text-primary text-[16px]">schedule</span>
                            <span>Evening Slot</span>
                          </div>
                          <div className="font-body-sm text-slate-body text-[11px] mt-0.5">5:00 PM – 7:30 PM</div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ─── ITEMS LIST (Shared by both flows) ─── */}
                  <div className="space-y-3">
                    <div className="font-label-md font-bold text-on-surface text-[13px] flex items-center justify-between">
                      <span>Selected Items</span>
                      <span className="text-slate-body text-[12px] font-normal">{totalItemsCount} {totalItemsCount === 1 ? "item" : "items"}</span>
                    </div>
                    {items.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex gap-3 pb-3 border-b border-gray-100 items-start"
                      >
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-100 border border-gray-200/60">
                          <img
                            src={item.product.image}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-headline-sm text-on-surface font-bold text-[13.5px] leading-snug line-clamp-1">
                              {item.product.name}
                            </h4>
                            <button
                              onClick={() => removeFromCart(item.product.id)}
                              className="text-gray-400 hover:text-error bg-transparent border-none cursor-pointer p-0.5 flex items-center"
                              aria-label="Remove item"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>

                          <div className="font-body-sm text-slate-body text-[11.5px] mb-2 mt-0.5">
                            {item.selectedWeight} {item.product.cutType ? `• ${item.product.cutType}` : ""}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-headline-sm font-extrabold text-primary text-[14px]">
                                ₹{item.product.price * item.quantity}
                              </span>
                              {item.product.originalPrice > item.product.price && (
                                <span className="font-body-sm text-slate-subtle line-through text-[11px]">
                                  ₹{item.product.originalPrice * item.quantity}
                                </span>
                              )}
                            </div>

                            {/* Spaced Quantity Stepper */}
                            <div className="flex items-center bg-gray-100/90 rounded-full px-1 py-0.5 border border-gray-200">
                              <button
                                type="button"
                                className="w-7 h-7 rounded-full bg-white hover:bg-primary hover:text-white text-gray-700 flex items-center justify-center transition-all shadow-xs cursor-pointer border-none font-bold text-base"
                                onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                aria-label="Decrease quantity"
                              >
                                −
                              </button>
                              <span className="px-3 font-extrabold text-sm text-gray-900 min-w-[24px] text-center">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                className="w-7 h-7 rounded-full bg-white hover:bg-primary hover:text-white text-gray-700 flex items-center justify-center transition-all shadow-xs cursor-pointer border-none font-bold text-base"
                                onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                aria-label="Increase quantity"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Free Gift if qualified */}
                  {subtotal >= freeRiceThreshold && (
                    <div className="p-3 bg-tertiary/10 border border-tertiary/20 rounded-xl flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-tertiary/20 flex items-center justify-center text-tertiary shrink-0">
                        <span className="material-symbols-outlined text-[18px]">rice_bowl</span>
                      </div>
                      <div className="flex-1">
                        <div className="font-label-md font-bold text-tertiary text-[12.5px]">
                          FREE: Premium Basmati Rice (300g)
                        </div>
                        <div className="font-body-sm text-slate-body text-[11px]">Special order gift for orders ₹499+</div>
                      </div>
                      <span className="font-label-badge font-extrabold text-tertiary text-[11px]">FREE</span>
                    </div>
                  )}

                  {/* ─── TIP DELIVERY PARTNER (Only in Delivery Flow) ─── */}
                  {fulfillmentType === "delivery" ? (
                    <div className="bg-[#f0f9ff]/85 border border-[#bae6fd] rounded-2xl p-4 shadow-xs">
                      {/* Top Switcher Tabs */}
                      <div className="bg-[#e0f2fe]/70 p-1 rounded-xl flex items-center gap-1 mb-3.5">
                        <button
                          type="button"
                          onClick={() => setTipTab("tip")}
                          className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-all border-none cursor-pointer ${
                            tipTab === "tip"
                              ? "bg-white text-on-surface shadow-xs"
                              : "bg-transparent text-slate-body hover:text-on-surface"
                          }`}
                        >
                          Give a Tip
                        </button>
                        <button
                          type="button"
                          onClick={() => setTipTab("instructions")}
                          className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-all border-none cursor-pointer ${
                            tipTab === "instructions"
                              ? "bg-white text-on-surface shadow-xs"
                              : "bg-transparent text-slate-body hover:text-on-surface"
                          }`}
                        >
                          Delivery Instructions
                        </button>
                      </div>

                      {tipTab === "tip" ? (
                        <div>
                          {/* Title & Rider Visual */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <h4 className="font-headline-sm font-extrabold text-on-surface text-[14px] leading-tight">
                                Tip Delivery Partner
                              </h4>
                              <p className="font-body-sm text-slate-body text-[11.5px] leading-relaxed mt-0.5 max-w-[240px]">
                                Help them earn a little extra for their effort. 100% of this tip will go to them.
                              </p>
                              <span className="font-body-sm text-[11px] text-slate-body/80 underline decoration-dotted block mt-1 cursor-pointer">
                                Delivery Partner Safety
                              </span>
                            </div>

                            {/* Delivery Rider Graphic */}
                            <div className="w-14 h-14 rounded-2xl bg-[#0284c7]/10 flex items-center justify-center text-[#0284c7] shrink-0 shadow-xs">
                              <span className="material-symbols-outlined text-[32px]">two_wheeler</span>
                            </div>
                          </div>

                          {/* 4 Selectable Options (10, 35, 50, Custom) */}
                          <div className="grid grid-cols-4 gap-2 mt-3">
                            {/* Option 10: Chai */}
                            <button
                              type="button"
                              onClick={() => handleSelectTip(10)}
                              className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1 transition-all border cursor-pointer ${
                                selectedTip === 10 && !showCustomInput
                                  ? "bg-white border-primary shadow-sm ring-2 ring-primary/20 text-primary font-black"
                                  : "bg-white border-gray-200/80 hover:border-gray-300 text-on-surface font-bold"
                              }`}
                            >
                              <span className="text-[13px]">☕</span>
                              <span className="text-[13px]">₹10</span>
                            </button>

                            {/* Option 35: Snacks */}
                            <button
                              type="button"
                              onClick={() => handleSelectTip(35)}
                              className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1 transition-all border cursor-pointer ${
                                selectedTip === 35 && !showCustomInput
                                  ? "bg-white border-primary shadow-sm ring-2 ring-primary/20 text-primary font-black"
                                  : "bg-white border-gray-200/80 hover:border-gray-300 text-on-surface font-bold"
                              }`}
                            >
                              <span className="text-[13px]">🥟</span>
                              <span className="text-[13px]">₹35</span>
                            </button>

                            {/* Option 50: Meal */}
                            <button
                              type="button"
                              onClick={() => handleSelectTip(50)}
                              className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1 transition-all border cursor-pointer ${
                                selectedTip === 50 && !showCustomInput
                                  ? "bg-white border-primary shadow-sm ring-2 ring-primary/20 text-primary font-black"
                                  : "bg-white border-gray-200/80 hover:border-gray-300 text-on-surface font-bold"
                              }`}
                            >
                              <span className="text-[13px]">🍱</span>
                              <span className="text-[13px]">₹50</span>
                            </button>

                            {/* Option Custom */}
                            <button
                              type="button"
                              onClick={() => {
                                setShowCustomInput((prev) => !prev);
                              }}
                              className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1 transition-all border cursor-pointer ${
                                showCustomInput || (selectedTip > 0 && selectedTip !== 10 && selectedTip !== 35 && selectedTip !== 50)
                                  ? "bg-white border-primary shadow-sm ring-2 ring-primary/20 text-primary font-black"
                                  : "bg-white border-gray-200/80 hover:border-gray-300 text-on-surface font-bold"
                              }`}
                            >
                              <span className="text-[13px]">❤️</span>
                              <span className="text-[12px]">
                                {selectedTip > 0 && selectedTip !== 10 && selectedTip !== 35 && selectedTip !== 50
                                  ? `₹${selectedTip}`
                                  : "Custom"}
                              </span>
                            </button>
                          </div>

                          {/* Custom Input Field */}
                          {showCustomInput && (
                            <form
                              onSubmit={handleCustomTipSubmit}
                              className="mt-3 flex items-center gap-2 bg-white p-2 rounded-xl border border-primary/40 shadow-xs"
                            >
                              <span className="text-gray-500 font-bold text-sm pl-1">₹</span>
                              <input
                                type="number"
                                min="1"
                                max="1000"
                                autoFocus
                                placeholder="Enter amount (e.g. 25)"
                                value={customTipInput}
                                onChange={(e) => setCustomTipInput(e.target.value)}
                                className="flex-1 py-1 px-1 text-sm font-bold text-on-surface outline-none border-none bg-transparent"
                              />
                              <button
                                type="submit"
                                className="bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-lg border-none cursor-pointer hover:bg-primary-dark"
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowCustomInput(false);
                                  setSelectedTip(0);
                                }}
                                className="text-gray-400 hover:text-gray-600 border-none bg-transparent cursor-pointer text-xs"
                              >
                                Cancel
                              </button>
                            </form>
                          )}

                          {selectedTip > 0 && (
                            <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-[#0369a1] font-semibold">
                              <span>₹{selectedTip} added to delivery partner tip</span>
                              <button
                                type="button"
                                onClick={() => setSelectedTip(0)}
                                className="text-primary hover:underline border-none bg-transparent cursor-pointer font-bold"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Delivery Instructions Tab */
                        <div>
                          <h4 className="font-headline-sm font-extrabold text-on-surface text-[14px] mb-1">
                            Delivery Instructions
                          </h4>
                          <input
                            type="text"
                            value={deliveryNote}
                            onChange={(e) => setDeliveryNote(e.target.value)}
                            placeholder="e.g. Leave with security / Ring bell twice"
                            className="w-full p-2.5 bg-white rounded-xl border border-gray-200 text-xs text-on-surface outline-none focus:border-primary"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ─── STORE PICKUP NOTES BOX (Only in Store Pickup Flow) ─── */
                    <div className="bg-white rounded-2xl border border-gray-200 p-3.5 space-y-2 shadow-2xs">
                      <div className="flex items-center gap-1.5 font-label-md font-bold text-on-surface text-[12.5px]">
                        <span className="material-symbols-outlined text-primary text-[18px]">edit_note</span>
                        <span>Pickup Instructions / Notes (Optional)</span>
                      </div>
                      <input
                        type="text"
                        value={pickupNote}
                        onChange={(e) => setPickupNote(e.target.value)}
                        placeholder="e.g. Keep marinated separately / Pack in double bag"
                        className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs text-on-surface outline-none focus:border-primary focus:bg-white transition-all"
                      />
                      <div className="text-[11px] text-slate-body flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-emerald-600">verified</span>
                        <span>Your order will be packed and ready to collect at the counter!</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ─── COUPON CODE SECTION ────────────────────────────────────────── */}
                <div className="bg-white border-t border-gray-200 px-5 py-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Enter Coupon Code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      disabled={!!appliedCoupon}
                      className="flex-1 p-2.5 rounded-xl border border-gray-300 text-[13px] font-bold text-gray-800 uppercase focus:outline-none focus:border-primary disabled:bg-gray-100 disabled:text-gray-500"
                    />
                    {appliedCoupon ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedCoupon(null);
                          setCouponCode("");
                        }}
                        className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl px-4 py-2.5 font-bold text-[13px] transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={!couponCode || isApplyingCoupon}
                        className="bg-primary hover:bg-primary-dark text-white border border-primary rounded-xl px-4 py-2.5 font-bold text-[13px] transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isApplyingCoupon ? "..." : "Apply"}
                      </button>
                    )}
                  </div>
                  {couponError && <p className="text-red-500 text-[11px] mt-1.5 font-bold">{couponError}</p>}
                  {appliedCoupon && <p className="text-emerald-600 text-[11px] mt-1.5 font-bold">Coupon {appliedCoupon.code} applied! (-₹{appliedCoupon.discountValue})</p>}
                </div>

                {/* ─── BILL SUMMARY & CTA ────────────────────────────────────────── */}
                <div className="border-t border-gray-200 px-5 py-4 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.03)] shrink-0">
                  <div className="flex flex-col gap-1.5 mb-3 font-body-sm text-[13px]">
                    <div className="flex justify-between text-slate-body">
                      <span>Item Total</span>
                      <span>₹{subtotal}</span>
                    </div>

                    {/* Delivery Fee or Store Pickup Free indicator */}
                    {fulfillmentType === "delivery" ? (
                      <>
                        <div className="flex justify-between text-slate-body">
                          <span>Delivery Fee</span>
                          <span>
                            {deliveryFee === 0 ? (
                              <strong className="text-tertiary">FREE</strong>
                            ) : (
                              `₹${deliveryFee}`
                            )}
                          </span>
                        </div>
                        {deliveryFee > 0 && (
                          <div className="text-[11.5px] text-primary font-medium">
                            Add ₹{amountForFreeDelivery} more for FREE delivery
                          </div>
                        )}
                        {selectedTip > 0 && (
                          <div className="flex justify-between text-[#0284c7] font-semibold">
                            <span className="flex items-center gap-1">
                              <span>Delivery Partner Tip</span>
                              <span className="text-[11px] bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded">100% to partner</span>
                            </span>
                            <span>₹{selectedTip}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex justify-between items-center text-emerald-700 font-bold bg-emerald-50/70 px-2.5 py-1.5 rounded-lg border border-emerald-200/50">
                        <span className="flex items-center gap-1.5 text-[12.5px]">
                          <span className="material-symbols-outlined text-[16px]">storefront</span>
                          <span>Store Self-Pickup Fee</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="line-through text-gray-400 text-xs font-normal">₹40</span>
                          <span className="text-emerald-800 font-black">FREE (₹0)</span>
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-slate-body">
                      <span>Hygienic Temperature-Controlled Packing</span>
                      <strong className="text-tertiary">FREE</strong>
                    </div>

                    {appliedCoupon && (
                      <div className="flex justify-between text-emerald-600 font-bold">
                        <span>Coupon Discount ({appliedCoupon.code})</span>
                        <span>-₹{appliedCoupon.discountValue}</span>
                      </div>
                    )}

                    <div className="flex justify-between pt-2 border-t border-dashed border-gray-200 font-headline-sm font-extrabold text-on-surface text-[15px]">
                      <span>To Pay</span>
                      <span className="text-primary font-black text-[17px]">₹{finalPayable}</span>
                    </div>
                  </div>

                  {/* Checkout CTA Button */}
                  <button
                    id="cart-checkout-btn"
                    onClick={handleProceedToPayment}
                    className="w-full py-3 rounded-full bg-primary hover:bg-primary-dark text-white font-label-lg font-bold shadow-md transition-all cursor-pointer border-none flex items-center justify-center gap-2 text-[14px]"
                  >
                    <span>
                      {isLoggedIn
                        ? fulfillmentType === "pickup"
                          ? "Proceed to Store Pickup"
                          : "Proceed to Checkout"
                        : "Login to proceed"}
                    </span>
                    <span>•</span>
                    <span>₹{finalPayable}</span>
                  </button>

                  <div className="text-center font-body-sm text-slate-subtle mt-2 text-[11.5px] flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-slate-subtle">lock</span>
                    <span>
                      {fulfillmentType === "pickup"
                        ? `Pickup at ${selectedStore?.name} | Pay at Counter or Online`
                        : "100% Secure Checkout | Cash on Delivery / UPI"}
                    </span>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ─── VIEW 2: PAYMENT & CHECKOUT VIEW ──────────────────────────────────── */}
        {view === "payment" && (
          <div className="flex-1 flex flex-col bg-[#f4f6f8] overflow-y-auto">
            {/* Payment Header with Back Arrow & Subtext */}
            <div className="bg-white px-5 py-3.5 border-b border-gray-200 flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setView("cart")}
                className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center cursor-pointer border-none bg-transparent text-gray-700 transition-colors"
                aria-label="Back to Cart"
              >
                <span className="material-symbols-outlined text-[24px]">arrow_back</span>
              </button>
              <div className="flex-1 min-w-0 text-left">
                <h2 className="font-headline-sm font-extrabold text-on-surface text-[16px] leading-tight">
                  {isPickup ? "Confirm Store Pickup & Payment" : "Checkout & Payment"}
                </h2>
                <p className="font-body-sm text-slate-body text-[11.5px] truncate mt-0.5">
                  {isPickup
                    ? `Self Pickup: ${selectedStore?.name} — ${selectedStore?.address}`
                    : addresses.find((a) => a._id === selectedAddressId)
                    ? `${addresses.find((a) => a._id === selectedAddressId)?.line1}, ${addresses.find((a) => a._id === selectedAddressId)?.city}`
                    : "Select or add your delivery address below"}
                </p>
              </div>
            </div>

            {/* To Pay Summary Banner */}
            <div className="bg-white px-5 py-3 border-b border-gray-200 flex items-center justify-between shrink-0 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm font-bold text-gray-800 text-[15px]">To Pay:</span>
                {isPickup && (
                  <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    Store Pickup (₹0 Delivery)
                  </span>
                )}
              </div>
              <span className="font-headline-md font-black text-emerald-600 text-[18px]">
                ₹{finalPayable}
              </span>
            </div>

            {/* Payment Options Body */}
            <div className="flex-1 p-4 space-y-4">
              {/* 1. DELIVERY ADDRESS SELECTOR (Only in Delivery Flow) */}
              {!isPickup && (
                <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">location_on</span>
                      <h3 className="font-label-md font-bold text-gray-800 text-[14px]">Delivery Address</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddAddressForm(!showAddAddressForm)}
                      className="text-primary font-bold text-xs flex items-center gap-1 hover:underline bg-transparent border-none cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      {showAddAddressForm ? "Cancel" : "Add New"}
                    </button>
                  </div>

                  {/* Add New Address Form */}
                  {showAddAddressForm && (
                    <form onSubmit={handleAddNewAddress} className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-3 mb-3 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={newAddress.tag}
                          onChange={(e) => setNewAddress({ ...newAddress, tag: e.target.value })}
                          className="p-2 rounded-lg border border-gray-300 bg-white"
                        >
                          <option value="Home">Home</option>
                          <option value="Work">Work</option>
                          <option value="Other">Other</option>
                        </select>
                        <input
                          type="text"
                          required
                          placeholder="Pincode"
                          value={newAddress.pincode}
                          onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                          className="p-2 rounded-lg border border-gray-300 bg-white"
                        />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="House / Flat / Street"
                        value={newAddress.line1}
                        onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })}
                        className="w-full p-2 rounded-lg border border-gray-300 bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Landmark (Optional)"
                        value={newAddress.line2}
                        onChange={(e) => setNewAddress({ ...newAddress, line2: e.target.value })}
                        className="w-full p-2 rounded-lg border border-gray-300 bg-white"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddAddressForm(false)}
                          className="px-3 py-1.5 bg-gray-200 text-gray-700 font-bold rounded-lg cursor-pointer border-none"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-primary text-white font-bold rounded-lg cursor-pointer border-none"
                        >
                          Save Address
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Saved Addresses List */}
                  <div className="space-y-2">
                    {addresses.map((addr) => (
                      <label
                        key={addr._id}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                          selectedAddressId === addr._id
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="delivery-addr"
                          value={addr._id}
                          checked={selectedAddressId === addr._id}
                          onChange={() => setSelectedAddressId(addr._id)}
                          className="mt-0.5 text-primary focus:ring-primary"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900 text-xs">{addr.tag}</span>
                            {addr.isDefault && (
                              <span className="text-[9px] bg-gray-200 text-gray-700 px-1 py-0.2 rounded font-bold uppercase">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-[11.5px] text-slate-600 truncate mt-0.5">
                            {addr.line1}, {addr.line2 ? `${addr.line2}, ` : ""}{addr.city} - {addr.pincode}
                          </p>
                        </div>
                      </label>
                    ))}
                    {addresses.length === 0 && !showAddAddressForm && (
                      <div className="text-center py-4 text-xs text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        No addresses saved yet. Click &quot;Add New&quot; to add your delivery address.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 2. PICKUP STORE INFO (Only in Pickup Flow) */}
              {isPickup && (
                <div className="bg-emerald-50/70 rounded-2xl border border-emerald-200 p-4 shadow-2xs flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
                    <span className="material-symbols-outlined text-[22px]">storefront</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-emerald-950 text-sm">{selectedStore?.name}</h4>
                    <p className="text-xs text-emerald-800 mt-0.5">{selectedStore?.address}</p>
                    <p className="text-[11px] text-emerald-700 font-medium mt-1">Timings: {selectedStore?.timings || "08:00 AM - 08:00 PM"}</p>
                  </div>
                </div>
              )}

              {/* 3. PAYMENT METHOD SELECTION */}
              <div>
                <h3 className="font-label-md font-bold text-gray-700 text-[13px] mb-2 px-1">
                  Choose Payment Method
                </h3>

                <div className="space-y-3">
                  {/* Method A: Cash on Delivery / Pay at Counter */}
                  <label
                    onClick={() => setSelectedPayment("cod")}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all bg-white shadow-2xs ${
                      selectedPayment === "cod" ? "border-primary ring-1 ring-primary/20" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[24px]">
                          {isPickup ? "storefront" : "payments"}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 text-sm block">
                          {isPickup ? "Pay at Store Counter" : "Cash on Delivery (COD)"}
                        </span>
                        <span className="text-[11.5px] text-slate-500">
                          {isPickup ? "Pay cash, card or UPI when picking up" : "Pay cash or scan QR at doorstep via UPI"}
                        </span>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPayment === "cod" ? "border-primary" : "border-gray-300"}`}>
                      {selectedPayment === "cod" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </div>
                  </label>

                  {/* Method B: Razorpay Online Payment */}
                  <label
                    onClick={() => setSelectedPayment("razorpay")}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all bg-white shadow-2xs ${
                      selectedPayment === "razorpay" ? "border-primary ring-1 ring-primary/20" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <span className="material-symbols-outlined text-[24px]">credit_card</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm">Pay Online (Razorpay)</span>
                          <span className="text-[9.5px] font-extrabold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase">Instant</span>
                        </div>
                        <span className="text-[11.5px] text-slate-500">
                          UPI (GPay, PhonePe, Paytm), Cards, Netbanking
                        </span>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPayment === "razorpay" ? "border-primary" : "border-gray-300"}`}>
                      {selectedPayment === "razorpay" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </div>
                  </label>

                  {/* Method C: Teffes Cash / Wallet */}
                  <label
                    onClick={() => {
                      if (walletBalance >= finalPayable) {
                        setSelectedPayment("wallet");
                      }
                    }}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all bg-white shadow-2xs ${
                      walletBalance >= finalPayable
                        ? "cursor-pointer hover:border-gray-300"
                        : "opacity-50 cursor-not-allowed bg-gray-50 border-gray-100"
                    } ${
                      selectedPayment === "wallet" ? "border-primary ring-1 ring-primary/20" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#7c3aed]/10 flex items-center justify-center text-[#7c3aed]">
                        <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm">Teffes Cash</span>
                          <span className="text-[9.5px] font-extrabold bg-[#7c3aed]/10 text-[#6d28d9] px-1.5 py-0.5 rounded uppercase">Wallet</span>
                        </div>
                        <span className="text-[11.5px] text-slate-500">
                          Balance: <strong className="text-gray-800">₹{walletBalance}</strong>
                          {walletBalance < finalPayable && " (Insufficient)"}
                        </span>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPayment === "wallet" ? "border-primary" : "border-gray-300"}`}>
                      {selectedPayment === "wallet" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                {selectedPayment === "cod" ? (
                  <button
                    type="button"
                    disabled={isPlacingOrder || (!isPickup && !selectedAddressId && addresses.length > 0)}
                    onClick={handleConfirmOrder}
                    className="w-full py-4 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-[15px] shadow-md transition-all cursor-pointer border-none flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isPlacingOrder ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span>{isPickup ? `Confirm Store Pickup • Pay ₹${finalPayable}` : `Place Order • Pay ₹${finalPayable} on Delivery`}</span>
                    )}
                  </button>
                ) : selectedPayment === "wallet" ? (
                  <button
                    type="button"
                    disabled={isPlacingOrder || (!isPickup && !selectedAddressId && addresses.length > 0)}
                    onClick={async () => {
                      // Let's use the handleConfirmOrder but set the paymentMethod to Wallet on backend
                      await handleConfirmOrder();
                    }}
                    className="w-full py-4 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-[15px] shadow-md transition-all cursor-pointer border-none flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isPlacingOrder ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[19px]">account_balance_wallet</span>
                        <span>Pay via Teffes Cash • ₹{finalPayable}</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isPlacingOrder || (!isPickup && !selectedAddressId && addresses.length > 0)}
                    onClick={handleRazorpayPayment}
                    className="w-full py-4 rounded-xl bg-[#0c2340] hover:bg-[#08182b] text-white font-bold text-[15px] shadow-md transition-all cursor-pointer border-none flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isPlacingOrder ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[19px]">lock</span>
                        <span>Pay Online with Razorpay • ₹{finalPayable}</span>
                      </>
                    )}
                  </button>
                )}
                <p className="text-center text-[11px] text-gray-400 mt-2">
                  🔒 100% Secure Transaction • Live Tracking on Dashboard
                </p>
              </div>

            </div>
          </div>
        )}

        {/* ─── VIEW 3: ORDER RECEIVED SUCCESS VIEW ──────────────────────────────── */}
        {view === "success" && (
          <div className="flex-1 p-8 flex flex-col items-center justify-center text-center bg-white overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-tertiary/15 border-2 border-tertiary flex items-center justify-center text-tertiary mb-4 animate-scale-up">
              <span className="material-symbols-outlined text-[34px]">
                {orderSummary?.fulfillmentType === "pickup" ? "storefront" : "check"}
              </span>
            </div>

            <span className="font-label-badge text-tertiary bg-tertiary-fixed-dim/20 px-3 py-1 rounded-full font-bold uppercase text-[11px] mb-2">
              {orderSummary?.fulfillmentType === "pickup" ? "Store Pickup Confirmed" : "Delivery Confirmed"} • #{orderSummary?.id || "TEF-892144"}
            </span>

            <h3 className="font-headline-lg text-on-surface font-black mb-2 text-[1.45rem]">
              {orderSummary?.fulfillmentType === "pickup" ? "Pickup Order Placed!" : "Order Received!"}
            </h3>

            <p className="font-body-md text-slate-body max-w-xs leading-relaxed mb-6 text-[13.5px]">
              {orderSummary?.fulfillmentType === "pickup" ? (
                <>
                  Thank you! Our master butchers at <strong>{orderSummary?.storeName || "TeFFe's Butcher Shop"}</strong> are cutting and packing your order.
                </>
              ) : (
                <>
                  Thank you! Our master butchers at <strong>Kishore Ganj Chowk, Ranchi</strong> are cutting your order fresh right now.
                </>
              )}
            </p>

            {/* Order Details Card */}
            <div className="bg-surface-container-low border border-gray-200/80 rounded-2xl p-4 w-full mb-6 text-left space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200/60">
                <span className="text-slate-body">Fulfillment Mode</span>
                <span className="font-bold text-gray-900">
                  {orderSummary?.fulfillmentType === "pickup" ? "🏪 Self Store Pickup" : "🛵 Express Home Delivery"}
                </span>
              </div>

              {orderSummary?.fulfillmentType === "pickup" ? (
                <>
                  <div className="flex flex-col gap-0.5 pb-2 border-b border-gray-200/60">
                    <span className="text-slate-body">Pickup Store</span>
                    <span className="font-bold text-gray-900">{orderSummary?.storeName}</span>
                    <span className="text-[11px] text-slate-body">{orderSummary?.storeAddress}</span>
                    {orderSummary?.storePhone && (
                      <span className="text-[11px] text-primary font-medium">Phone: {orderSummary?.storePhone}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200/60">
                    <span className="text-slate-body">Estimated Readiness</span>
                    <span className="font-extrabold text-emerald-700">Ready in ~15-20 Mins</span>
                  </div>
                </>
              ) : null}

              <div className="flex items-center justify-between pb-2 border-b border-gray-200/60">
                <span className="text-slate-body">Payment Method</span>
                <span className="font-bold text-gray-900">{orderSummary?.paymentType}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-gray-200/60">
                <span className="text-slate-body">Amount to Pay</span>
                <span className="font-extrabold text-primary text-sm">₹{orderSummary?.totalAmount}</span>
              </div>

              {orderSummary?.tipAmount ? (
                <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 text-sky-700">
                  <span>Rider Tip Included</span>
                  <span className="font-bold">₹{orderSummary.tipAmount}</span>
                </div>
              ) : null}

              <div className="flex items-center gap-1.5 text-tertiary font-bold pt-1">
                <span className="material-symbols-outlined text-[18px]">
                  {orderSummary?.fulfillmentType === "pickup" ? "verified" : "bolt"}
                </span>
                <span>
                  {orderSummary?.fulfillmentType === "pickup"
                    ? "Collect directly at the store counter. No delivery fee!"
                    : "Express 90-Min Delivery dispatched from Kacheri Chowk"}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="w-full space-y-2">
              {orderSummary?.fulfillmentType === "pickup" && orderSummary?.storeAddress && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    orderSummary.storeAddress + " " + (orderSummary.storeName || "")
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-full border border-primary text-primary font-bold text-xs flex items-center justify-center gap-2 hover:bg-primary/5 transition-all text-decoration-none"
                >
                  <span className="material-symbols-outlined text-[16px]">directions</span>
                  <span>Get Directions to Store on Google Maps</span>
                </a>
              )}

              <button
                type="button"
                onClick={handleResetAndClose}
                className="btn btn-primary w-full py-3.5 rounded-full text-white font-bold text-sm shadow-md"
              >
                Order More Fresh Cuts
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
