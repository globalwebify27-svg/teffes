"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/products";
import { isAuthenticated, getStoredUser } from "@/lib/auth";
import api from "@/lib/api";
import { useLocation } from "@/context/LocationContext";
import { toast } from "@/lib/toast";

interface CrossSellItemData {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  weight: string;
  category?: string;
  inStock?: boolean;
}



interface Address {
  _id: string;
  tag: string;
  line1: string;
  line2?: string;
  city: string;
  pincode: string;
  isDefault?: boolean;
  lat?: number;
  lng?: number;
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
  distanceKm?: number;
  status?: string;
  pickupEnabled?: boolean;
  deliveryEnabled?: boolean;
  isOpen?: boolean;
  isAvailable?: boolean;
  stockStatus?: string;
  outOfStockItems?: string[];
  freeDeliveryThreshold?: number;
  standardDeliveryFee?: number;
  expressDeliveryFee?: number;
  expressDeliveryEnabled?: boolean;
  rainSurgeEnabled?: boolean;
  rainSurgeFee?: number;
  freeGiftThreshold?: number;
  freeGiftName?: string;
  deliveryRadiusKm?: number;
}

export default function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    addToCart,
    getItemQuantity,
    updateQuantity,
    removeFromCart,
    clearCart,
    subtotal,
    deliveryFee,
    total,
    freeRiceThreshold,
    freeDeliveryThreshold,
    totalItemsCount,
    appliedCoupon,
    couponDiscount,
    couponError,
    isApplyingCoupon,
    applyCoupon,
    removeCoupon,
  } = useCart();

  const {
    currentLocation,
    selectSavedAddress,
    refreshSavedAddresses,
    isLocationSet,
    openLocationModal,
  } = useLocation();

  // Top fulfillment mode: "delivery" (auto-selected by default) or "pickup"
  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");

  // Stores for fulfillment (both Delivery and Pickup)
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [pickupNote, setPickupNote] = useState<string>("");

  // Navigation views: "cart" -> "payment" -> "success" | "address"
  const [view, setView] = useState<"cart" | "payment" | "success" | "address">("cart");
  // 3 Delivery Slot options: Express 60-min (+₹50), 90 Min Standard, Custom Delivery (8 AM - 8 PM hourly)
  const [slot, setSlot] = useState<"express60" | "standard90" | "custom">("standard90");
  const [customSlotTime, setCustomSlotTime] = useState<string>("");
  const [crossSellItems, setCrossSellItems] = useState<CrossSellItemData[]>([]);
  const [isLoadingCrossSell, setIsLoadingCrossSell] = useState<boolean>(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Hourly slots from 8 AM to 8 PM with past hours disabled
  const hourlySlots = useMemo(() => {
    const currentHour = new Date().getHours();
    const allSlots = [
      { start: 8, label: "08:00 AM - 09:00 AM" },
      { start: 9, label: "09:00 AM - 10:00 AM" },
      { start: 10, label: "10:00 AM - 11:00 AM" },
      { start: 11, label: "11:00 AM - 12:00 PM" },
      { start: 12, label: "12:00 PM - 01:00 PM" },
      { start: 13, label: "01:00 PM - 02:00 PM" },
      { start: 14, label: "02:00 PM - 03:00 PM" },
      { start: 15, label: "03:00 PM - 04:00 PM" },
      { start: 16, label: "04:00 PM - 05:00 PM" },
      { start: 17, label: "05:00 PM - 06:00 PM" },
      { start: 18, label: "06:00 PM - 07:00 PM" },
      { start: 19, label: "07:00 PM - 08:00 PM" },
    ];

    return allSlots.map((s) => ({
      ...s,
      isPassed: s.start <= currentHour,
    }));
  }, []);

  // Ensure an available custom slot is pre-selected
  useEffect(() => {
    if (!customSlotTime) {
      const firstAvailable = hourlySlots.find((s) => !s.isPassed);
      if (firstAvailable) {
        setCustomSlotTime(firstAvailable.label);
      } else {
        setCustomSlotTime("Tomorrow: 08:00 AM - 09:00 AM");
      }
    }
  }, [hourlySlots, customSlotTime]);

  // Fetch cross-sell items from database on cart open
  useEffect(() => {
    if (isOpen) {
      setIsLoadingCrossSell(true);
      api.get<{ success: boolean; data: CrossSellItemData[] }>("/cross-sell")
        .then((res) => {
          if (res.data?.success && Array.isArray(res.data.data)) {
            setCrossSellItems(res.data.data);
          } else {
            setCrossSellItems([]);
          }
        })
        .catch(() => {
          setCrossSellItems([]);
        })
        .finally(() => {
          setIsLoadingCrossSell(false);
        });
    }
  }, [isOpen]);

  // Handler for cross-selling product addition
  const handleAddCrossSell = (cs: CrossSellItemData) => {
    const product: Product = {
      id: cs.id,
      name: cs.name,
      category: cs.category || "Essentials",
      categoryLabel: cs.category || "Essentials",
      price: cs.price,
      originalPrice: cs.originalPrice || cs.price,
      image: cs.image,
      netWeight: cs.weight || "1 unit",
      inStock: cs.inStock !== false,
      badge: "Add-on",
      description: "Recipe essential add-on",
      rating: 4.9,
      ratingCount: 120,
      images: [cs.image],
    };
    addToCart(product, cs.weight);
    toast.success(`Added ${cs.name} to cart!`);
  };

  // Addresses state
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");

  // Fetch available stores verifying active status, delivery/pickup flag, and cart items inventory
  const fetchAvailableStores = async (addrs?: Address[], selectedAddrId?: string) => {
    try {
      const addrList = addrs || addresses;
      const addrId = selectedAddrId || selectedAddressId;
      const activeAddr = addrList.find((a) => a._id === addrId) || addrList[0];
      const payload = {
        type: fulfillmentType,
        items: items.map((i) => ({
          id: i.product.id,
          name: i.product.name,
          quantity: i.quantity,
        })),
        customerLat: activeAddr?.lat || 23.3512,
        customerLng: activeAddr?.lng || 85.3154,
      };

      const res = await api.post<{
        success: boolean;
        stores: StoreOption[];
        eligibleStores: StoreOption[];
        suggestedStore: StoreOption;
      }>("/stores/available", payload);

      if (res.data.success && Array.isArray(res.data.stores)) {
        setStores(res.data.stores);

        // Auto-select nearest shop among filtered shop list (eligible stores are sorted by distance)
        const bestStore = res.data.suggestedStore || res.data.eligibleStores?.[0] || res.data.stores[0];
        if (bestStore) {
          if (fulfillmentType === "delivery") {
            // For delivery: strictly auto-select nearest shop based on customer's address; user cannot change it
            setSelectedStoreId(bestStore.storeId);
          } else {
            setSelectedStoreId((prev) => {
              const isPrevStillEligible = res.data.eligibleStores?.some((s) => s.storeId === prev);
              if (!prev || !isPrevStillEligible) {
                return bestStore.storeId;
              }
              return prev;
            });
          }
        }
      }
    } catch (err) {
      console.warn("Failed to fetch available stores for fulfillment:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsLoggedIn(isAuthenticated());
      fetchAddresses();
      fetchAvailableStores();
    } else {
      setView("cart");
      setShowAddAddressForm(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableStores();
    }
  }, [fulfillmentType, items, selectedAddressId]);

  // Tip Delivery Partner state (Zepto style)
  const [selectedTip, setSelectedTip] = useState<number>(0);
  const [customTipInput, setCustomTipInput] = useState<string>("");
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
  const [tipTab, setTipTab] = useState<"tip" | "instructions">("tip");
  const [deliveryNote, setDeliveryNote] = useState<string>("");

  // Payment method state ("cod" | "razorpay" | "wallet")
  const [selectedPayment, setSelectedPayment] = useState<string>("cod");
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [showAddAddressForm, setShowAddAddressForm] = useState<boolean>(false);
  const [isSavingAddress, setIsSavingAddress] = useState<boolean>(false);
  const [newAddress, setNewAddress] = useState({ tag: "Home", line1: "", line2: "", city: "", pincode: "" });
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const [showSimulatedPaymentModal, setShowSimulatedPaymentModal] = useState<boolean>(false);
  const [simulatedOrderData, setSimulatedOrderData] = useState<any>(null);

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

  const [inputCouponCode, setInputCouponCode] = useState<string>("");
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [isCouponsExpanded, setIsCouponsExpanded] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setLoadingCoupons(true);
      api.get<{ success: boolean; coupons: any[] }>("/coupons/active")
        .then((res) => {
          if (res.data?.success && Array.isArray(res.data.coupons)) {
            setAvailableCoupons(res.data.coupons);
          }
        })
        .catch(() => { })
        .finally(() => setLoadingCoupons(false));
    }
  }, [isOpen]);

  const handleApplyCoupon = async (codeToApply?: string) => {
    const targetCode = (codeToApply || inputCouponCode).trim().toUpperCase();
    if (!targetCode) return;
    const res = await applyCoupon(targetCode);
    if (res.success) {
      setInputCouponCode("");
    }
  };

  if (!isOpen) return null;

  const isPickup = fulfillmentType === "pickup";
  const selectedStore =
    stores.find((s) => s.storeId === selectedStoreId) || stores[0] || null;

  // Dynamic store-configurable delivery fees, thresholds, express fee, and rain surge
  const storeFreeDeliveryThreshold = selectedStore?.freeDeliveryThreshold ?? freeDeliveryThreshold;
  const storeStandardDeliveryFee = selectedStore?.standardDeliveryFee ?? 40;
  const storeExpressDeliveryFee = selectedStore?.expressDeliveryFee ?? 50;
  const storeExpressEnabled = selectedStore?.expressDeliveryEnabled !== false;
  const storeRainSurgeEnabled = selectedStore?.rainSurgeEnabled === true;
  const storeRainSurgeFee = storeRainSurgeEnabled ? (selectedStore?.rainSurgeFee ?? 15) : 0;
  const storeFreeGiftThreshold = selectedStore?.freeGiftThreshold ?? freeRiceThreshold;
  const storeFreeGiftName = selectedStore?.freeGiftName || "Free Biryani Rice (500g)";
  const storeDeliveryRadiusKm = selectedStore?.deliveryRadiusKm ?? 5;

  const isFreeDelivery = subtotal >= storeFreeDeliveryThreshold;
  const effectiveDeliveryFee = isPickup ? 0 : (isFreeDelivery ? 0 : storeStandardDeliveryFee);
  const expressFee = (!isPickup && slot === "express60" && storeExpressEnabled) ? storeExpressDeliveryFee : 0;
  const rainSurgeFee = (!isPickup && storeRainSurgeEnabled) ? storeRainSurgeFee : 0;
  const effectiveTip = isPickup ? 0 : selectedTip;
  const discountAmount = couponDiscount;
  const finalPayable = Math.max(0, subtotal + effectiveDeliveryFee + expressFee + rainSurgeFee + effectiveTip - discountAmount);
  const resolvedDeliverySlot = isPickup
    ? "Store Pickup"
    : slot === "express60"
      ? "Express Delivery (60 min)"
      : slot === "custom"
        ? `Custom Delivery: ${customSlotTime}`
        : "90 Min Delivery";

  const amountForFreeDelivery = Math.max(0, storeFreeDeliveryThreshold - subtotal);
  const amountForFreeGift = Math.max(0, storeFreeGiftThreshold - subtotal);

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

  // Fetch user addresses from backend
  const fetchAddresses = async () => {
    try {
      const res = await api.get<{ success: boolean; addresses: Address[] }>("/user/addresses");
      if (res.data.success && Array.isArray(res.data.addresses)) {
        setAddresses(res.data.addresses);
        const match = res.data.addresses.find((a) => a._id === currentLocation.addressId);
        const def = match || res.data.addresses.find((a) => a.isDefault) || res.data.addresses[0];
        if (def && !selectedAddressId) setSelectedAddressId(def._id);
        fetchAvailableStores(res.data.addresses, def?._id);
      }
    } catch (err) {
      console.warn("Could not fetch addresses:", err);
    }
  };

  const handleAddNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddress.line1.trim()) {
      toast.warning("Please enter your house/street address.", "Missing Address");
      return;
    }
    if (!newAddress.city.trim()) {
      toast.warning("Please enter your city.", "Missing City");
      return;
    }
    if (!newAddress.pincode.trim() || newAddress.pincode.length < 6) {
      toast.warning("Please enter a valid 6-digit pincode.", "Invalid Pincode");
      return;
    }

    setIsSavingAddress(true);
    try {
      if (!isAuthenticated()) {
        closeCart();
        window.dispatchEvent(new CustomEvent("open-login"));
        setIsSavingAddress(false);
        return;
      }

      const res = await api.post<{ success: boolean; addresses: Address[] }>("/user/addresses", {
        ...newAddress,
        isDefault: true,
      });

      if (res.data.success && Array.isArray(res.data.addresses)) {
        setAddresses(res.data.addresses);
        const newest = res.data.addresses[res.data.addresses.length - 1];
        if (newest) {
          setSelectedAddressId(newest._id);
          selectSavedAddress({
            _id: newest._id,
            tag: newest.tag,
            line1: newest.line1,
            line2: newest.line2,
            city: newest.city,
            pincode: newest.pincode,
            isDefault: newest.isDefault,
          });
        }
        await refreshSavedAddresses();
        setShowAddAddressForm(false);
        setView("cart");
        setNewAddress({ tag: "Home", line1: "", line2: "", city: "", pincode: "" });
        toast.success("Delivery address saved and selected!", "Address Saved");
      }
    } catch (err: any) {
      console.error("Failed to add address:", err);
      toast.error(err.response?.data?.message || "Failed to save address. Please try again.", "Address Error");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const activeAddress =
    addresses.find((a) => a._id === selectedAddressId) ||
    addresses.find((a) => a._id === currentLocation?.addressId) ||
    addresses.find((a) => a.isDefault) ||
    addresses[0] ||
    (currentLocation?.isSet && currentLocation?.fullAddress
      ? {
        _id: currentLocation.addressId || "loc-selected",
        tag: currentLocation.label || "Delivery Address",
        line1: currentLocation.fullAddress,
        city: "Ranchi",
        pincode: "",
      }
      : null);

  // Proceed from cart to payment view inside drawer
  const handleProceedToPayment = async () => {
    if (!isLoggedIn) {
      closeCart();
      window.dispatchEvent(new CustomEvent("open-login"));
      return;
    }

    if (fulfillmentType === "delivery") {
      await fetchAddresses();

      // Enforce location selection: cannot proceed if no location or address has been chosen
      if (!isLocationSet && !selectedAddressId && addresses.length === 0) {
        toast.warning("Please select or detect your delivery location before proceeding to checkout.", "Location Required");
        openLocationModal();
        return;
      }

      if (addresses.length === 0 && !selectedAddressId) {
        toast.warning("Please add a delivery address to proceed.", "Address Required");
        setShowAddAddressForm(true);
        setView("address");
        return;
      }
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
    if (fulfillmentType === "delivery" && !selectedAddressId && (!activeAddress || !activeAddress._id)) {
      toast.warning("Please select a delivery address to proceed.", "Address Required");
      openLocationModal();
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
        addressId: fulfillmentType === "delivery" ? (selectedAddressId || activeAddress?._id) : undefined,
        pickupMode: fulfillmentType === "pickup",
        storeId: selectedStore?.storeId || "S001",
        deliverySlot: resolvedDeliverySlot,
        expressFee: expressFee,
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
      toast.error(err.response?.data?.message || "Failed to place order. Please try again.", "Order Failed");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Razorpay Online Payment
  const handleRazorpayPayment = async () => {
    if (isPlacingOrder) return;
    if (fulfillmentType === "delivery" && !selectedAddressId && (!activeAddress || !activeAddress._id)) {
      toast.warning("Please select a delivery address to proceed.", "Address Required");
      openLocationModal();
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
        addressId: fulfillmentType === "delivery" ? (selectedAddressId || activeAddress?._id) : undefined,
        pickupMode: fulfillmentType === "pickup",
        storeId: selectedStore?.storeId || "S001",
        storeName: selectedStore?.name || "Central Store",
        deliverySlot: resolvedDeliverySlot,
        expressFee: expressFee,
        couponCode: appliedCoupon?.code,
        discountAmount: appliedCoupon?.discountValue || 0,
      };

      // Create Razorpay order on backend
      const rzpRes = await api.post<{ success: boolean; order: any; keyId: string; isSimulation?: boolean }>("/payment/create-order", {
        amount: finalPayable,
      });

      // If backend reports simulation mode, or if keyId is absent or order ID is dev simulated:
      if (rzpRes.data.isSimulation || !rzpRes.data.keyId || rzpRes.data.order?.id?.startsWith("order_dev_")) {
        setSimulatedOrderData({
          orderPayload,
          rzpOrder: rzpRes.data.order,
        });
        setShowSimulatedPaymentModal(true);
        setIsPlacingOrder(false);
        return;
      }

      const loaded = await loadRazorpayScript();
      const storedUser = getStoredUser();

      if (loaded && (window as any).Razorpay && rzpRes.data.keyId) {
        let isDismissed = false;
        const options = {
          key: rzpRes.data.keyId,
          amount: rzpRes.data.order.amount,
          currency: "INR",
          name: "TeFFe's",
          description: `Order of ${totalItemsCount} item(s)`,
          order_id: rzpRes.data.order.id,
          handler: async function (response: any) {
            isDismissed = true;
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
            } finally {
              setIsPlacingOrder(false);
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
              isDismissed = true;
              setIsPlacingOrder(false);
            },
          },
        };

        try {
          const rzp = new (window as any).Razorpay(options);
          rzp.on("payment.failed", function (resp: any) {
            isDismissed = true;
            toast.error("Payment failed: " + (resp.error?.description || "Transaction declined"), "Payment Error");
            setIsPlacingOrder(false);
          });
          rzp.open();
          // Watchdog: If modal fails to launch within 6 seconds, reset isPlacingOrder so button is never stuck
          setTimeout(() => {
            if (!isDismissed) {
              setIsPlacingOrder(false);
            }
          }, 6000);
        } catch (openErr) {
          console.error("Razorpay instance launch error:", openErr);
          setIsPlacingOrder(false);
          setSimulatedOrderData({
            orderPayload,
            rzpOrder: rzpRes.data.order,
          });
          setShowSimulatedPaymentModal(true);
        }
      } else {
        // Fallback to simulated payment modal
        setSimulatedOrderData({
          orderPayload,
          rzpOrder: rzpRes.data.order,
        });
        setShowSimulatedPaymentModal(true);
        setIsPlacingOrder(false);
      }
    } catch (err: any) {
      console.error("Razorpay error:", err);
      toast.error(
        err.response?.data?.message || "Payment initiation failed. Please try again or choose Cash on Delivery.",
        "Payment Failed"
      );
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

  const handleCloseCart = () => {
    setView("cart");
    setShowAddAddressForm(false);
    closeCart();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="drawer-backdrop" onClick={handleCloseCart} />

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
                    {totalItemsCount} {totalItemsCount === 1 ? "item" : "items"} from TeFFe&apos;s
                  </span>
                </div>
              </div>
              <button
                onClick={handleCloseCart}
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
                  className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 font-bold text-[13px] transition-all border-none cursor-pointer ${fulfillmentType === "delivery"
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
                  className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 font-bold text-[13px] transition-all border-none cursor-pointer ${fulfillmentType === "pickup"
                    ? "bg-white text-primary shadow-xs ring-1 ring-black/5"
                    : "bg-transparent text-slate-body hover:text-on-surface"
                    }`}
                >
                  <span className="material-symbols-outlined text-[18px]">storefront</span>
                  <span>Store Pickup</span>
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
                <button onClick={handleCloseCart} className="btn btn-primary px-6 py-2.5 rounded-full text-white font-bold">
                  Browse Fresh Cuts
                </button>
              </div>
            ) : (
              <>
                {/* ─── FULFILLMENT BANNER ─── */}
                {fulfillmentType === "delivery" ? (
                  activeAddress ? (
                    /* Delivery Address Block (with CHANGE button and active customer address) */
                    <div className="bg-surface-container-low px-5 py-3 border-b border-gray-200/80 flex items-start gap-3 shrink-0">
                      <span className="material-symbols-outlined text-primary text-[22px] mt-0.5 shrink-0">location_on</span>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-label-badge uppercase text-tertiary font-bold tracking-wider text-[10px]">
                            Deliver to {activeAddress.tag} (90 Mins)
                          </span>
                          <button
                            type="button"
                            onClick={() => openLocationModal()}
                            className="text-primary font-black text-[11.5px] uppercase tracking-wider hover:underline bg-transparent border-none cursor-pointer py-0.5 px-2 rounded-md hover:bg-primary/10 transition-colors"
                          >
                            CHANGE
                          </button>
                        </div>
                        <p className="font-label-md text-on-surface font-semibold text-[13px] leading-tight mt-0.5 truncate">
                          {activeAddress.line1}{activeAddress.line2 ? `, ${activeAddress.line2}` : ""}, {activeAddress.city}
                        </p>
                        <p className="font-body-sm text-slate-body text-[11px] leading-tight mt-0.5 truncate">
                          {activeAddress.pincode ? `Pincode: ${activeAddress.pincode} • ${storeDeliveryRadiusKm}km Delivery Radius` : `${storeDeliveryRadiusKm}km Delivery Radius`}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* No Saved Address Banner */
                    <div className="bg-primary/5 px-5 py-3 border-b border-primary/20 flex items-center justify-between gap-3 shrink-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <span className="material-symbols-outlined text-[20px]">add_location_alt</span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-label-badge uppercase text-primary font-bold tracking-wider text-[10px] block">
                            Delivery Address Needed
                          </span>
                          <p className="font-label-md text-on-surface font-semibold text-[12px] leading-tight mt-0.5 truncate">
                            Please add a delivery address to order
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openLocationModal()}
                        className="bg-primary hover:bg-primary-dark text-white font-bold text-[11px] uppercase tracking-wider py-1.5 px-3 rounded-lg border-none cursor-pointer shadow-xs transition-colors shrink-0"
                      >
                        + ADD
                      </button>
                    </div>
                  )
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


                {/* Scrollable Body: Stores List OR Delivery Speed + Items + Instructions */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {/* ─── TAB 2 CONTENT: STORE SELECTION LIST (PICKUP) ─── */}
                  {fulfillmentType === "pickup" && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="font-headline-sm font-extrabold text-on-surface text-[13.5px] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-primary text-[18px]">location_searching</span>
                          <span>Select Pickup Store nearby you</span>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                          {stores.filter((s) => s.isAvailable !== false).length} Available
                        </span>
                      </div>

                      <div className="space-y-2">
                        {stores.map((store, idx) => {
                          const isSelected = store.storeId === selectedStoreId;
                          const isNearest = idx === 0;
                          const isOutOfStock = store.isAvailable === false;

                          return (
                            <div
                              key={store.storeId}
                              onClick={() => {
                                if (!isOutOfStock) {
                                  setSelectedStoreId(store.storeId);
                                }
                              }}
                              className={`p-3 rounded-2xl border transition-all text-left ${isOutOfStock
                                ? "border-gray-200 bg-gray-50/80 opacity-60 cursor-not-allowed"
                                : isSelected
                                  ? "border-primary bg-crimson-soft shadow-xs ring-1 ring-primary/20 cursor-pointer"
                                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60 cursor-pointer"
                                }`}
                            >
                              <div className="flex items-start gap-2.5">
                                {/* Radio Indicator */}
                                <div
                                  className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 transition-colors ${isSelected ? "border-primary bg-primary" : "border-gray-300 bg-white"
                                    }`}
                                >
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-headline-sm font-extrabold text-on-surface text-[13.5px]">
                                        {store.name}
                                      </span>
                                      {isNearest && (
                                        <span className="text-[9.5px] uppercase font-black px-1.5 py-0.2 bg-emerald-700 text-white rounded-full">
                                          Nearest
                                        </span>
                                      )}
                                    </div>
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
                                    <span
                                      className={`flex items-center gap-1 font-bold ${isOutOfStock ? "text-red-700" : "text-emerald-700"
                                        }`}
                                    >
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${isOutOfStock ? "bg-red-600" : "bg-emerald-600 animate-pulse"
                                          }`}
                                      ></span>
                                      <span>{isOutOfStock ? "Out of Stock" : "In Stock • Open"}</span>
                                    </span>
                                    <span>•</span>
                                    <span>{store.timings || "08:00 AM - 08:30 PM"}</span>
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
                          <strong>Quick Pickup:</strong> Order will be freshly carved and packaged within <strong>15 minutes</strong>. Collect anytime before 8:30 PM today!
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── TAB 1 CONTENT: DELIVERY SPEED SLOTS & FULFILLING STORE HUB ─── */}
                  {fulfillmentType === "delivery" && (
                    <div className="space-y-3">
                      {/* Fulfilling Store Hub Card (Nearest Auto-Selected; User cannot change it) */}
                      <div className="p-3 bg-white rounded-2xl border border-gray-200 shadow-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-label-badge uppercase font-bold text-slate-body text-[10.5px] flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-primary text-[16px]">store</span>
                            <span>Fulfilling Hub</span>
                          </div>
                        </div>

                        {/* Selected Store Summary */}
                        {selectedStore && (
                          <div className="flex items-start gap-2.5 p-2.5 bg-slate-50/90 rounded-xl border border-gray-200/80">
                            <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">location_on</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-headline-sm font-extrabold text-on-surface text-[13px] truncate">
                                  {selectedStore.name}
                                </span>
                                <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full shrink-0">
                                  Nearest • In Stock
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-body truncate mt-0.5">{selectedStore.address}</p>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-body">
                                <span className="font-bold text-primary">{selectedStore.distance || "0.7 km away"}</span>
                                <span>•</span>
                                <span>Dispatching to your address</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Delivery Speed Slots: 3 Options (Express 60 min, 90 min, Custom) */}
                      <div className="p-3 bg-slate-50 rounded-2xl border border-gray-200">
                        {/* Live Bad Weather / Rain Surge Alert if enabled by Store Admin */}
                        {storeRainSurgeEnabled && (
                          <div className="mb-2 px-2.5 py-1.5 bg-amber-50 border border-amber-200/90 rounded-xl flex items-center justify-between text-[11px] text-amber-950 font-semibold shadow-xs">
                            <span className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px] text-amber-600">rainy</span>
                              <span>Bad Weather / Rain Surge Active in your area</span>
                            </span>
                            <span className="font-extrabold text-amber-900">+₹{storeRainSurgeFee}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between mb-2">
                          <div className="font-label-badge uppercase font-bold text-slate-body text-[10.5px]">
                            Select Delivery Speed (Ranchi Only)
                          </div>
                        </div>

                        {/* 3 Slot Buttons Grid */}
                        <div className="grid grid-cols-3 gap-2">
                          {/* 1. Express Delivery (60 min) */}
                          <button
                            type="button"
                            disabled={!storeExpressEnabled}
                            onClick={() => storeExpressEnabled && setSlot("express60")}
                            style={slot === "express60" && storeExpressEnabled ? { borderColor: "#91000a", borderWidth: "1.5px" } : undefined}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${!storeExpressEnabled
                              ? "border-gray-200 bg-gray-100/70 opacity-60 cursor-not-allowed"
                              : slot === "express60"
                                ? "border-[#91000a] bg-red-50/60 shadow-xs ring-1 ring-[#91000a]/25"
                                : "border-gray-200 bg-white hover:border-gray-300"
                              }`}
                            title={!storeExpressEnabled ? "Express 60-min delivery temporarily paused by store hub (Kitchen Busy)" : undefined}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-[12px] text-gray-900 leading-tight">Express</span>
                              <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-md leading-none whitespace-nowrap ${storeExpressEnabled ? "bg-amber-100 text-amber-900" : "bg-gray-200 text-gray-600"}`}>
                                {storeExpressEnabled ? `+₹${storeExpressDeliveryFee}` : "Paused"}
                              </span>
                            </div>
                            <div className="mt-1.5">
                              <div className="text-[11px] font-bold text-[#91000a] leading-tight">60 Mins</div>
                              <div className="text-[9.5px] text-gray-500 font-medium leading-tight mt-0.5">
                                {storeExpressEnabled ? "Priority Rush" : "Kitchen Backlog"}
                              </div>
                            </div>
                          </button>

                          {/* 2. 90 Min Delivery */}
                          <button
                            type="button"
                            onClick={() => setSlot("standard90")}
                            style={slot === "standard90" ? { borderColor: "#91000a", borderWidth: "1.5px" } : undefined}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${slot === "standard90"
                              ? "border-[#91000a] bg-red-50/60 shadow-xs ring-1 ring-[#91000a]/25"
                              : "border-gray-200 bg-white hover:border-gray-300"
                              }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-[12px] text-gray-900 leading-tight">90 Min</span>
                              <span className="text-[9.5px] font-bold text-emerald-800 bg-emerald-100/70 px-1.5 py-0.5 rounded-md leading-none whitespace-nowrap">Free</span>
                            </div>
                            <div className="mt-1.5">
                              <div className="text-[11px] font-bold text-gray-900 leading-tight">Fresh Cut</div>
                              <div className="text-[9.5px] text-gray-500 font-medium leading-tight mt-0.5">Standard</div>
                            </div>
                          </button>

                          {/* 3. Custom Delivery */}
                          <button
                            type="button"
                            onClick={() => setSlot("custom")}
                            style={slot === "custom" ? { borderColor: "#91000a", borderWidth: "1.5px" } : undefined}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${slot === "custom"
                              ? "border-[#91000a] bg-red-50/60 shadow-xs ring-1 ring-[#91000a]/25"
                              : "border-gray-200 bg-white hover:border-gray-300"
                              }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-[12px] text-gray-900 leading-tight">Custom</span>
                              <span className="text-[9.5px] font-bold text-sky-800 bg-sky-100/70 px-1.5 py-0.5 rounded-md leading-none whitespace-nowrap">Free</span>
                            </div>
                            <div className="mt-1.5">
                              <div className="text-[11px] font-bold text-sky-900 leading-tight">Choose</div>
                              <div className="text-[9.5px] text-gray-500 font-medium leading-tight mt-0.5">8 AM - 8 PM</div>
                            </div>
                          </button>
                        </div>

                        {/* Custom Delivery Dropdown when Custom is selected */}
                        {slot === "custom" && (
                          <div className="mt-3 pt-2.5 border-t border-gray-200/80">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                              <span>Select 1-Hour Time Slot (8:00 AM – 8:00 PM):</span>
                              <span className="text-[10px] text-slate-400 font-normal">Past hours disabled</span>
                            </label>
                            <div className="relative">
                              <select
                                value={customSlotTime}
                                onChange={(e) => setCustomSlotTime(e.target.value)}
                                className="w-full py-2 pl-3 pr-8 text-[12px] font-semibold bg-white border border-gray-300 rounded-xl outline-none focus:border-primary text-gray-900 shadow-2xs cursor-pointer appearance-none"
                              >
                                {hourlySlots.map((s) => (
                                  <option
                                    key={s.label}
                                    value={s.label}
                                    disabled={s.isPassed}
                                    className={s.isPassed ? "text-gray-400 bg-gray-50" : "text-gray-900 font-medium"}
                                  >
                                    {s.label} {s.isPassed ? "— (Passed)" : "• Available"}
                                  </option>
                                ))}
                                {hourlySlots.every((s) => s.isPassed) && (
                                  <option value="Tomorrow: 08:00 AM - 09:00 AM" className="text-emerald-700 font-bold">
                                    Tomorrow: 08:00 AM - 09:00 AM
                                  </option>
                                )}
                              </select>
                              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-[18px]">
                                expand_more
                              </span>
                            </div>
                            {customSlotTime && (
                              <p className="text-[10.5px] text-sky-700 font-medium mt-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                <span>Order will be delivered during <strong>{customSlotTime}</strong></span>
                              </p>
                            )}
                          </div>
                        )}
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
                                <span className="font-body-sm text-slate-subtle line-through decoration-primary [text-decoration-color:#800020] decoration-[1.5px] text-[11px]">
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

                  {/* ─── CROSS-SELLING SECTION (Recipe Essentials & Add-ons) ─── */}
                  <div className="bg-gradient-to-r from-amber-50/70 via-orange-50/30 to-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-amber-700 text-[18px]">shopping_basket</span>
                        <span className="font-headline-sm font-extrabold text-on-surface text-[13px] tracking-tight">
                          Add Cooking Essentials
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-full">
                        Recipe Add-ons
                      </span>
                    </div>

                    {isLoadingCrossSell ? (
                      <div className="py-4 text-center text-xs text-slate-body flex items-center justify-center gap-2">
                        <span className="inline-block w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                        <span>Loading cooking essentials…</span>
                      </div>
                    ) : crossSellItems && crossSellItems.length > 0 ? (
                      /* Horizontal Compact Scroll Strip */
                      <div className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin scrollbar-thumb-gray-200">
                        {crossSellItems.map((cs) => {
                          const qty = getItemQuantity(cs.id);
                          return (
                            <div
                              key={cs.id}
                              className="w-[124px] shrink-0 bg-white rounded-xl border border-gray-200/80 p-2 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all"
                            >
                              <div className="relative w-full h-[72px] rounded-lg overflow-hidden bg-white mb-1.5 border border-gray-100 flex items-center justify-center p-1">
                                <img
                                  src={cs.image}
                                  alt={cs.name}
                                  className="w-full h-full object-contain"
                                  loading="lazy"
                                />
                              </div>

                              <div className="mb-2">
                                <h5 className="font-bold text-gray-900 text-[11.5px] leading-tight line-clamp-1" title={cs.name}>
                                  {cs.name}
                                </h5>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="font-extrabold text-primary text-[12px]">₹{cs.price}</span>
                                  {cs.originalPrice && cs.originalPrice > cs.price && (
                                    <span className="line-through text-gray-400 text-[10px]">₹{cs.originalPrice}</span>
                                  )}
                                </div>
                              </div>

                              {/* Action: + Add or Disabled Added Button */}
                              {qty > 0 ? (
                                <button
                                  type="button"
                                  disabled
                                  className="w-full py-1 px-2 rounded-lg font-bold text-[11.5px] cursor-not-allowed flex items-center justify-center gap-1 bg-gray-100 text-gray-500 border border-gray-200 select-none shadow-2xs opacity-90"
                                  title="Item already in cart. Manage quantity in the cart list above."
                                >
                                  <span className="material-symbols-outlined text-[13px] text-emerald-600 font-bold">check</span>
                                  <span className="tracking-wide text-gray-600">Added</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAddCrossSell(cs)}
                                  className="btn-hover-fill w-full py-1 px-2 rounded-lg font-bold text-[11.5px] cursor-pointer flex items-center justify-center gap-1 shadow-xs active:scale-[0.98] select-none touch-manipulation transition-all"
                                >
                                  <span className="material-symbols-outlined text-[13px]">add_shopping_cart</span>
                                  <span className="tracking-wide">+ ADD</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-3 px-3 text-center bg-white/70 rounded-xl border border-dashed border-amber-200/80">
                        <div className="flex items-center justify-center gap-1.5 text-amber-900/80 text-[12px] font-medium">
                          <span className="material-symbols-outlined text-[16px] text-amber-700">inventory_2</span>
                          <span>No add-on products available at the moment</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ─── TIP DELIVERY PARTNER (Only in Delivery Flow) ─── */}
                  {fulfillmentType === "delivery" ? (
                    <div className="bg-[#f0f9ff]/85 border border-[#bae6fd] rounded-2xl p-4 shadow-xs">
                      {/* Top Switcher Tabs */}
                      <div className="bg-[#e0f2fe]/70 p-1 rounded-xl flex items-center gap-1 mb-3.5">
                        <button
                          type="button"
                          onClick={() => setTipTab("tip")}
                          className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-all border-none cursor-pointer ${tipTab === "tip"
                            ? "bg-white text-on-surface shadow-xs"
                            : "bg-transparent text-slate-body hover:text-on-surface"
                            }`}
                        >
                          Give a Tip
                        </button>
                        <button
                          type="button"
                          onClick={() => setTipTab("instructions")}
                          className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-all border-none cursor-pointer ${tipTab === "instructions"
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
                              className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1 transition-all border cursor-pointer ${selectedTip === 10 && !showCustomInput
                                ? "bg-white border-primary shadow-sm ring-2 ring-primary/20 text-primary font-black"
                                : "bg-white border-gray-200/80 hover:border-gray-300 text-on-surface font-bold"
                                }`}
                            >

                              <span className="text-[13px]">₹10</span>
                            </button>

                            {/* Option 35: Snacks */}
                            <button
                              type="button"
                              onClick={() => handleSelectTip(35)}
                              className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1 transition-all border cursor-pointer ${selectedTip === 35 && !showCustomInput
                                ? "bg-white border-primary shadow-sm ring-2 ring-primary/20 text-primary font-black"
                                : "bg-white border-gray-200/80 hover:border-gray-300 text-on-surface font-bold"
                                }`}
                            >
                              <span className="text-[13px]">₹35</span>
                            </button>

                            {/* Option 50: Meal */}
                            <button
                              type="button"
                              onClick={() => handleSelectTip(50)}
                              className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1 transition-all border cursor-pointer ${selectedTip === 50 && !showCustomInput
                                ? "bg-white border-primary shadow-sm ring-2 ring-primary/20 text-primary font-black"
                                : "bg-white border-gray-200/80 hover:border-gray-300 text-on-surface font-bold"
                                }`}
                            >
                              <span className="text-[13px]">₹50</span>
                            </button>

                            {/* Option Custom */}
                            <button
                              type="button"
                              onClick={() => {
                                setShowCustomInput((prev) => !prev);
                              }}
                              className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1 transition-all border cursor-pointer ${showCustomInput || (selectedTip > 0 && selectedTip !== 10 && selectedTip !== 35 && selectedTip !== 50)
                                ? "bg-white border-primary shadow-sm ring-2 ring-primary/20 text-primary font-black"
                                : "bg-white border-gray-200/80 hover:border-gray-300 text-on-surface font-bold"
                                }`}
                            >
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

                  {/* ─── COLLAPSIBLE COUPON / PROMO SECTION (Below instructions, inside scrollable area) ─── */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden transition-all">
                    {/* Collapsible Header Button */}
                    <button
                      type="button"
                      onClick={() => setIsCouponsExpanded((prev) => !prev)}
                      className="w-full p-3.5 flex items-center justify-between gap-3 text-left bg-transparent border-none cursor-pointer hover:bg-gray-50/70 transition-colors"
                      aria-expanded={isCouponsExpanded}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${appliedCoupon
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-primary/10 text-primary"
                          }`}>
                          <span className="material-symbols-outlined text-[18px]">
                            {appliedCoupon ? "check_circle" : "sell"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          {appliedCoupon ? (
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-[12.5px] text-emerald-900 font-headline-sm">
                                  {appliedCoupon.code} Applied
                                </span>
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.2 rounded">
                                  SAVING ₹{appliedCoupon.discountAmount}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                                {appliedCoupon.description || "Coupon discount applied to order"}
                              </p>
                            </div>
                          ) : (
                            <div>
                              <span className="font-headline-sm font-extrabold text-on-surface text-[13px] block">
                                Apply Coupon / Promo Code
                              </span>
                              <p className="font-body-sm text-slate-body text-[11px] mt-0.5">
                                {availableCoupons.length > 0
                                  ? `${availableCoupons.length} offers available to save more`
                                  : "Tap to enter promo code"}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {appliedCoupon && !isCouponsExpanded && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCoupon();
                            }}
                            className="text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-md transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                        <span className={`material-symbols-outlined text-[20px] text-slate-400 transition-transform duration-200 ${isCouponsExpanded ? "rotate-90 text-primary" : ""
                          }`}>
                          chevron_right
                        </span>
                      </div>
                    </button>

                    {/* Collapsible Content Body */}
                    {isCouponsExpanded && (
                      <div className="px-3.5 pb-3.5 pt-1 border-t border-gray-100 space-y-3">
                        {appliedCoupon ? (
                          /* Full Applied Coupon Card inside expanded view */
                          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-emerald-900 text-[13px] tracking-wide font-headline-sm">
                                  {appliedCoupon.code}
                                </span>
                                <span className="text-[10px] bg-emerald-200 text-emerald-900 font-extrabold px-1.5 py-0.5 rounded">
                                  APPLIED
                                </span>
                              </div>
                              <div className="text-[11px] text-emerald-800 font-medium mt-0.5 truncate">
                                {appliedCoupon.description || `Discount: -₹${appliedCoupon.discountAmount}`}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-emerald-700 font-black text-[13px]">
                                -₹{appliedCoupon.discountAmount}
                              </span>
                              <button
                                type="button"
                                onClick={removeCoupon}
                                className="text-[11px] font-bold text-red-600 hover:text-red-700 bg-white hover:bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Coupon Input Field */
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Enter Promo Code (e.g. MEAT25)"
                                value={inputCouponCode}
                                onChange={(e) => setInputCouponCode(e.target.value.toUpperCase())}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleApplyCoupon();
                                  }
                                }}
                                className="flex-1 p-2.5 rounded-xl border border-gray-300 text-[12.5px] font-bold text-gray-800 uppercase focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                              />
                              <button
                                type="button"
                                onClick={() => handleApplyCoupon()}
                                disabled={!inputCouponCode.trim() || isApplyingCoupon}
                                className="bg-primary hover:bg-primary-dark text-white border border-primary rounded-xl px-4 py-2.5 font-bold text-[12.5px] transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {isApplyingCoupon ? "Checking…" : "Apply"}
                              </button>
                            </div>

                            {couponError && (
                              <div className="text-red-500 text-[11px] font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">error</span>
                                <span>{couponError}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Available Coupons list */}
                        {!appliedCoupon && availableCoupons.length > 0 && (
                          <div className="pt-2 border-t border-dashed border-gray-200">
                            <div className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
                              Available Offers
                            </div>
                            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                              {availableCoupons.map((c) => {
                                const isPercent = c.discountType === "percentage";
                                const desc = c.description || c.discount || `${c.discountValue}${isPercent ? "% OFF" : "₹ OFF"}`;
                                const minOrder = c.minOrderAmount !== undefined ? c.minOrderAmount : (c.minOrder || 0);

                                return (
                                  <div
                                    key={c.code || c.id}
                                    className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 gap-2 hover:bg-slate-100/60 transition-colors"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-extrabold text-[12px] text-gray-800 tracking-wide font-headline-sm">
                                          {c.code}
                                        </span>
                                        {c.isSuperOffer && (
                                          <span className="text-[9.5px] bg-amber-100 text-amber-900 font-black px-1.5 py-0.2 rounded">
                                            SUPER OFFER
                                          </span>
                                        )}
                                        {c.firstOrderOnly && (
                                          <span className="text-[9.5px] bg-indigo-100 text-indigo-900 font-black px-1.5 py-0.2 rounded">
                                            1ST ORDER
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                                        {desc} · Min order ₹{minOrder}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleApplyCoupon(c.code)}
                                      disabled={isApplyingCoupon}
                                      className="bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 border border-emerald-300 font-extrabold text-[11px] px-3 py-1.5 rounded-lg transition-colors shrink-0 cursor-pointer"
                                    >
                                      Claim
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ─── FREE GIFT REWARD TIER BANNER ─── */}
                <div className="px-5 pt-2 pb-0 shrink-0">
                  <div className="px-3.5 py-2 bg-gradient-to-r from-amber-50/90 via-orange-50/80 to-amber-50/90 border border-amber-200/80 rounded-xl flex items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0">featured_seasonal_and_gifts</span>
                      <div className="min-w-0">
                        <div className="text-[11.5px] font-extrabold text-amber-950 truncate">
                          {amountForFreeGift <= 0
                            ? `Unlocked: ${storeFreeGiftName}!`
                            : `Add ₹${amountForFreeGift} more for ${storeFreeGiftName}`}
                        </div>
                        <div className="text-[10px] text-amber-700 font-medium">
                          {amountForFreeGift <= 0 ? "Complimentary gift unlocked with your order" : `Free reward on carts ≥ ₹${storeFreeGiftThreshold}`}
                        </div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${amountForFreeGift <= 0 ? "bg-emerald-600 text-white" : "bg-amber-200/80 text-amber-900"}`}>
                      {amountForFreeGift <= 0 ? "FREE" : `₹${amountForFreeGift} to unlock`}
                    </span>
                  </div>
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
                            {effectiveDeliveryFee === 0 ? (
                              <strong className="text-tertiary">FREE</strong>
                            ) : (
                              `₹${effectiveDeliveryFee}`
                            )}
                          </span>
                        </div>
                        {effectiveDeliveryFee > 0 && (
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
                        {expressFee > 0 && (
                          <div className="flex justify-between text-slate-body">
                            <span>Express 60-Min Priority Delivery</span>
                            <span>+₹{expressFee}</span>
                          </div>
                        )}
                        {rainSurgeFee > 0 && (
                          <div className="flex justify-between items-center text-amber-900 bg-amber-50/80 px-2 py-1 rounded font-semibold text-xs border border-amber-200/60">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[15px] text-amber-700">rainy</span>
                              <span>Bad Weather / Rain Surge</span>
                            </span>
                            <span>+₹{rainSurgeFee}</span>
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
                          <span className="line-through decoration-primary [text-decoration-color:#800020] decoration-[1.5px] text-gray-400 text-xs font-normal">₹40</span>
                          <span className="text-emerald-800 font-black">FREE (₹0)</span>
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-slate-body">
                      <span>Hygienic Temperature-Controlled Packing</span>
                      <strong className="text-tertiary">FREE</strong>
                    </div>

                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-md">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px]">local_offer</span>
                          <span>Coupon Discount {appliedCoupon ? `(${appliedCoupon.code})` : ""}</span>
                        </span>
                        <span>-₹{discountAmount}</span>
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
                        className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${selectedAddressId === addr._id
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
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all bg-white shadow-2xs ${selectedPayment === "cod" ? "border-primary ring-1 ring-primary/20" : "border-gray-200 hover:border-gray-300"
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

                  {/* Method B: Razorpay Online Payment (Disabled per client instructions) */}
                  <div
                    onClick={() => toast.info("Online payment gateway is temporarily disabled. Please place your order via Cash on Delivery.")}
                    className="p-4 rounded-2xl border-2 border-gray-200 bg-gray-50/90 flex items-center justify-between cursor-not-allowed opacity-60 shadow-2xs transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center text-gray-500">
                        <span className="material-symbols-outlined text-[24px]">credit_card</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-600 text-sm">Pay Online (Razorpay)</span>
                          <span className="text-[9.5px] font-extrabold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded uppercase">Temporarily Disabled</span>
                        </div>
                        <span className="text-[11.5px] text-gray-400">
                          UPI, Cards & Netbanking temporarily paused by store
                        </span>
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center" />
                  </div>

                  {/* Method C: Teffes Cash / Wallet (Disabled per client instructions) */}
                  <div
                    onClick={() => toast.info("Wallet payment is temporarily disabled. Please place your order via Cash on Delivery.")}
                    className="p-4 rounded-2xl border-2 border-gray-200 bg-gray-50/90 flex items-center justify-between cursor-not-allowed opacity-60 shadow-2xs transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center text-gray-500">
                        <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-600 text-sm">Teffes Cash</span>
                          <span className="text-[9.5px] font-extrabold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded uppercase">Temporarily Disabled</span>
                        </div>
                        <span className="text-[11.5px] text-gray-400">
                          Balance: ₹{walletBalance} (Wallet payments temporarily paused)
                        </span>
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center" />
                  </div>
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
                <p className="text-center text-[11px] text-gray-400 mt-2 flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-gray-400">lock</span>
                  <span>100% Secure Transaction • Live Tracking on Dashboard</span>
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
                  Thank you! Our team at <strong>{orderSummary?.storeName || "TeFFe's"}</strong> is cutting and packing your order.
                </>
              ) : (
                <>
                  Thank you! Our store team is cutting your order fresh right now.
                </>
              )}
            </p>

            {/* Order Details Card */}
            <div className="bg-surface-container-low border border-gray-200/80 rounded-2xl p-4 w-full mb-6 text-left space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200/60">
                <span className="text-slate-body">Fulfillment Mode</span>
                <span className="font-bold text-gray-900 inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-primary">
                    {orderSummary?.fulfillmentType === "pickup" ? "storefront" : "delivery_dining"}
                  </span>
                  <span>{orderSummary?.fulfillmentType === "pickup" ? "Self Store Pickup" : "Express Home Delivery"}</span>
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
                  {orderSummary?.fulfillmentType === "pickup" ? "verified" : "timer"}
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

        {/* ─── VIEW 3: IN-DRAWER ADDRESS SELECTION & MANAGEMENT VIEW ─────────────── */}
        {view === "address" && (
          <div className="flex-1 flex flex-col bg-[#f8f9fa] overflow-hidden">
            {/* Address Header */}
            <div className="bg-white px-5 py-3.5 border-b border-gray-200 flex items-center justify-between shrink-0 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setView("cart");
                    setShowAddAddressForm(false);
                  }}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center cursor-pointer border-none bg-transparent text-gray-700 transition-colors shrink-0"
                  aria-label="Back to Cart"
                >
                  <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                </button>
                <div className="min-w-0">
                  <h2 className="font-headline-sm font-extrabold text-on-surface text-[15px] leading-tight">
                    Delivery Address
                  </h2>
                  <p className="font-body-sm text-slate-body text-[11px] truncate">
                    {addresses.length} saved {addresses.length === 1 ? "address" : "addresses"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseCart}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center border-none cursor-pointer transition-colors shrink-0"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Address Content List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {/* Add New Address Button / Inline Form */}
              {!showAddAddressForm ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated()) {
                      closeCart();
                      window.dispatchEvent(new CustomEvent("open-login"));
                      return;
                    }
                    setShowAddAddressForm(true);
                  }}
                  className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
                  <span>+ Add New Delivery Address</span>
                </button>
              ) : (
                <form
                  onSubmit={handleAddNewAddress}
                  className="bg-white p-4 rounded-2xl border border-primary/30 shadow-xs space-y-3 animate-fade-in"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                    <span className="font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-[18px]">add_location_alt</span>
                      Add New Address
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddAddressForm(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 bg-transparent border-none cursor-pointer font-semibold"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Address Tag Selector */}
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">Save Address As</label>
                    <div className="flex gap-2">
                      {["Home", "Work", "Other"].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setNewAddress({ ...newAddress, tag })}
                          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${newAddress.tag === tag
                            ? "bg-primary text-white border-primary shadow-xs"
                            : "bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300"
                            }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* House / Flat / Street */}
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">
                      House / Flat / Block / Street *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Flat 302, Shivalik Heights, Harmu Road"
                      value={newAddress.line1}
                      onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-medium focus:border-primary focus:outline-none"
                    />
                  </div>

                  {/* Area / Landmark */}
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">
                      Landmark / Area (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Near Kishore Ganj Chowk"
                      value={newAddress.line2}
                      onChange={(e) => setNewAddress({ ...newAddress, line2: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-medium focus:border-primary focus:outline-none"
                    />
                  </div>

                  {/* City & Pincode */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-1">City *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ranchi"
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-medium focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-1">Pincode *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 834001"
                        maxLength={6}
                        value={newAddress.pincode}
                        onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value.replace(/\D/g, "") })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-medium focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddAddressForm(false)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer border-none transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingAddress || !newAddress.line1.trim() || !newAddress.city.trim() || newAddress.pincode.length < 6}
                      className="px-4 py-2 bg-primary hover:bg-primary-dark text-white font-bold text-xs rounded-xl cursor-pointer border-none shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {isSavingAddress ? (
                        <span>Saving…</span>
                      ) : (
                        <>
                          <span>Save &amp; Select</span>
                          <span className="material-symbols-outlined text-[16px]">check</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Saved Addresses Cards */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-1">
                  Saved Addresses ({addresses.length})
                </div>

                {addresses.length === 0 ? (
                  <div className="text-center py-8 px-4 bg-white rounded-2xl border border-dashed border-gray-200">
                    <span className="material-symbols-outlined text-slate-300 text-[36px] mb-1">home_pin</span>
                    <p className="font-bold text-slate-700 text-xs">No saved addresses yet</p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-[220px] mx-auto">
                      Click &quot;+ Add New Delivery Address&quot; above to save your first address.
                    </p>
                  </div>
                ) : (
                  addresses.map((addr) => {
                    const isSelected = selectedAddressId === addr._id;
                    const tagLower = (addr.tag || "home").toLowerCase();
                    const icon =
                      tagLower.includes("work") || tagLower.includes("office")
                        ? "business"
                        : tagLower.includes("home")
                          ? "home"
                          : "location_on";

                    return (
                      <div
                        key={addr._id}
                        onClick={() => {
                          setSelectedAddressId(addr._id);
                          selectSavedAddress({
                            _id: addr._id,
                            tag: addr.tag,
                            line1: addr.line1,
                            line2: addr.line2,
                            city: addr.city,
                            pincode: addr.pincode,
                            isDefault: addr.isDefault,
                          });
                          setView("cart");
                          toast.success(`Delivering to ${addr.tag} (${addr.city})`, "Address Selected");
                        }}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-slate-50/60"
                          }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? "bg-primary text-white" : "bg-slate-100 text-slate-600"
                            }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">{icon}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-xs">{addr.tag}</span>
                            {addr.isDefault && (
                              <span className="text-[9.5px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold uppercase">
                                Default
                              </span>
                            )}
                            {isSelected && (
                              <span className="text-[9.5px] bg-primary/15 text-primary px-1.5 py-0.2 rounded font-extrabold uppercase ml-auto">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-700 font-medium mt-1 leading-snug">
                            {addr.line1}
                            {addr.line2 ? `, ${addr.line2}` : ""}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {addr.city} - {addr.pincode}
                          </p>
                        </div>

                        <div className="pt-1 shrink-0">
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isSelected
                              ? "border-primary bg-primary text-white"
                              : "border-gray-300 bg-white"
                              }`}
                          >
                            {isSelected && <span className="w-2 h-2 rounded-full bg-white"></span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── RAZORPAY SANDBOX TEST SIMULATOR MODAL ─── */}
        {showSimulatedPaymentModal && simulatedOrderData && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden">
              {/* Header */}
              <div className="bg-[#0c2340] text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-black text-lg text-emerald-400">
                    ₹
                  </div>
                  <div>
                    <h3 className="font-bold text-[15px] leading-tight">Razorpay Sandbox Gateway</h3>
                    <p className="text-white/60 text-xs">TeFFe&apos;s • Development Mode</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowSimulatedPaymentModal(false);
                    setIsPlacingOrder(false);
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer border-none"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Amount Bar */}
              <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800">Total Payable Amount:</span>
                <span className="text-lg font-black text-emerald-700">₹{simulatedOrderData.orderPayload.amount}</span>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
                  <strong>Sandbox Notice:</strong> Live Razorpay API keys are not yet configured in the environment. This interactive simulator lets you test the end-to-end payment confirmation, order dispatch, and store admin workflows seamlessly.
                </div>

                <div className="space-y-2 text-xs">
                  <div className="font-bold text-gray-700 mb-1">Available Payment Channels</div>
                  <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#0c2340]">qr_code_2</span>
                      <span className="font-medium text-gray-800">UPI / QR (Google Pay, PhonePe, Paytm)</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Test Ready</span>
                  </div>
                  <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#0c2340]">credit_card</span>
                      <span className="font-medium text-gray-800">Credit / Debit Cards (Visa, Mastercard, RuPay)</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Test Ready</span>
                  </div>
                  <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#0c2340]">account_balance</span>
                      <span className="font-medium text-gray-800">Net Banking (SBI, HDFC, ICICI, Axis)</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Test Ready</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    disabled={isPlacingOrder}
                    onClick={async () => {
                      setIsPlacingOrder(true);
                      try {
                        const randomSuffix = Math.floor(100000 + Math.random() * 900000);
                        await api.post("/orders", {
                          ...simulatedOrderData.orderPayload,
                          paymentMethod: "Online Payment (Razorpay)",
                          paymentStatus: "Paid",
                          razorpayOrderId: simulatedOrderData.rzpOrder?.id || `order_sim_${Date.now()}`,
                          razorpayPaymentId: `pay_sim_${randomSuffix}`,
                        });
                        toast.success("Payment verified! Order placed successfully.", "Order Confirmed");
                        setShowSimulatedPaymentModal(false);
                        clearCart();
                        closeCart();
                        window.location.href = "/dashboard";
                      } catch (err: any) {
                        toast.error(err.response?.data?.message || "Failed to confirm simulated order", "Order Error");
                      } finally {
                        setIsPlacingOrder(false);
                      }
                    }}
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer border-none flex items-center justify-center gap-2"
                  >
                    {isPlacingOrder ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">verified</span>
                        <span>Simulate Successful Payment (₹{simulatedOrderData.orderPayload.amount})</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      toast.info("Payment was cancelled by user.", "Cancelled");
                      setShowSimulatedPaymentModal(false);
                      setIsPlacingOrder(false);
                    }}
                    className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition-colors cursor-pointer border-none"
                  >
                    Cancel Transaction
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
