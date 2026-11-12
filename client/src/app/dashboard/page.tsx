"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getStoredUser, clearAuth, User, updateUserInStorage } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { getProductById } from "@/lib/products";
import api from "@/lib/api";
import GoogleLiveMap from "@/components/tracking/GoogleLiveMap";
import { getSocket } from "@/lib/socket";
import { toast } from "@/lib/toast";

type TabKey = "orders" | "support" | "addresses" | "profile" | "policy";

// PayU: Submit a hidden form to PayU payment gateway
const submitPayUForm = (payuParams: Record<string, string>, payuUrl: string) => {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = payuUrl;
  form.style.display = 'none';
  Object.entries(payuParams).forEach(([key, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = String(value);
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
};

export default function DashboardPage() {
  const router = useRouter();
  const { addToCart, openCart } = useCart();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("orders");
  const [liveOrders, setLiveOrders] = useState<any[]>([]);

  // Profile Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Address State
  interface DashboardAddress {
    id: string;
    label: string;
    address: string;
    isDefault?: boolean;
    line1?: string;
    line2?: string;
    city?: string;
    pincode?: string;
    landmark?: string;
  }

  const [addresses, setAddresses] = useState<DashboardAddress[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressActionLoading, setAddressActionLoading] = useState(false);
  const [addressFeedback, setAddressFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState({
    tag: "Home",
    line1: "",
    line2: "",
    city: "Ranchi",
    pincode: "",
  });

  // Teffes Cash Balance
  const [teffesCash, setTeffesCash] = useState(0);

  // Loyalty Tier & Spent
  const [loyaltyTier, setLoyaltyTier] = useState("Bronze");
  const [totalSpent, setTotalSpent] = useState(0);

  // Live Track Rider Modal state
  const [trackingOrder, setTrackingOrder] = useState<any | null>(null);
  const [liveRiderCoords, setLiveRiderCoords] = useState<{ lat: number; lng: number; eta?: string } | null>(null);

  // New modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  const [isAddBalanceModalOpen, setIsAddBalanceModalOpen] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");
  const [isRecharging, setIsRecharging] = useState(false);
  const [rechargeFeedback, setRechargeFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<{ onlineEnabled: boolean; payuConfigured: boolean }>({ onlineEnabled: true, payuConfigured: true });

  // Return request modal states
  const [returnModalOrderId, setReturnModalOrderId] = useState<string | null>(null);
  const [returnReasonInput, setReturnReasonInput] = useState("Quality / Freshness concern");
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnFeedback, setReturnFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Rider Rating Modal states
  const [ratingModalOrder, setRatingModalOrder] = useState<any | null>(null);
  const [riderRatingValue, setRiderRatingValue] = useState<number>(5);
  const [riderRatingFeedback, setRiderRatingFeedback] = useState<string>("");
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);

  // Cancel Order Modal states
  const [cancelModalOrderId, setCancelModalOrderId] = useState<string | null>(null);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Edit address state
  const [editingAddress, setEditingAddress] = useState<DashboardAddress | null>(null);

  const formatAddressString = (a: any): string => {
    if (!a) return "";
    if (typeof a === "string") return a;
    const parts: string[] = [];
    if (a.line1) parts.push(a.line1);
    if (a.line2) parts.push(a.line2);
    if (a.landmark) parts.push(`(${a.landmark})`);
    if (a.city) parts.push(a.city);
    if (a.pincode) parts.push(a.pincode);
    return parts.length > 0 ? parts.join(", ") : (a.address || "Ranchi");
  };

  const fetchAddresses = async () => {
    setAddressLoading(true);
    try {
      const res = await api.get<{ success: boolean; addresses: any[] }>("/user/addresses");
      if (res.data.success && Array.isArray(res.data.addresses)) {
        updateUserInStorage({ addresses: res.data.addresses });
        setAddresses(
          res.data.addresses.map((a: any) => ({
            id: a._id || a.id,
            label: a.tag || "Home",
            address: formatAddressString(a),
            isDefault: !!a.isDefault,
            line1: a.line1 || "",
            line2: a.line2 || "",
            city: a.city || "Ranchi",
            pincode: a.pincode || "834001",
            landmark: a.landmark || "",
          }))
        );
      }
    } catch (err) {
      console.warn("Could not fetch user addresses:", err);
    } finally {
      setAddressLoading(false);
    }
  };

  const closeAddBalanceModal = () => {
    setIsAddBalanceModalOpen(false);
    setBalanceInput("");
    setRechargeFeedback(null);
    setIsRecharging(false);
  };

  // Real-time Socket.IO tracking for active order
  useEffect(() => {
    if (!trackingOrder) return;
    const socket = getSocket();
    const publicOrderId = trackingOrder.orderId;
    const docOrderId = trackingOrder.id || trackingOrder._id;

    if (publicOrderId) {
      socket.emit("join:order", publicOrderId);
      socket.emit("join", `order:${publicOrderId}`);
    }
    if (docOrderId && docOrderId !== publicOrderId) {
      socket.emit("join:order", docOrderId);
      socket.emit("join", `order:${docOrderId}`);
    }

    const handleStatusChanged = (data: any) => {
      const eventOrderId = data.orderId || data.id || data.order?.orderId || data.order?.id;
      const isTargetMatch =
        (publicOrderId && eventOrderId === publicOrderId) ||
        (docOrderId && eventOrderId === docOrderId);

      if (isTargetMatch) {
        const newStatus = data.status || data.order?.status;
        const rawRider = data.rider !== undefined ? data.rider : (data.order?.rider !== undefined ? data.order.rider : undefined);
        const newDeliveryOtp = data.deliveryOtp || data.order?.deliveryOtp;
        if (rawRider === null) {
          setLiveRiderCoords(null);
        }
        const formattedRider = rawRider ? {
          isAssigned: true,
          name: rawRider.name || "",
          phone: rawRider.phone || "",
          vehicle: rawRider.vehicle || rawRider.vehicleNumber || "Insulated Cold Box (Fleet)",
          lat: Number(rawRider.lat) || 23.3441,
          lng: Number(rawRider.lng) || 85.3096,
          rating: (rawRider.rating || rawRider.riderRating || "4.9").toString(),
          deliveriesCount: rawRider.deliveriesCount || "Fleet Partner",
          bagTemp: rawRider.bagTemp || "Fresh-Lock Insulated Box",
        } : null;

        if (newStatus === "Delivered") {
          setTrackingOrder(null);
          // Refetch orders so the delivered order moves to completed history
          api.get<{ success: boolean; orders: any[] }>("/orders/my-orders")
            .then((res) => {
              if (res.data?.success && res.data?.orders) {
                setLiveOrders(res.data.orders);
              }
            })
            .catch(() => {});
        } else {
          setTrackingOrder((prev: any) => {
            if (!prev) return null;
            const updated = { ...prev };
            if (newStatus) updated.status = newStatus;
            if (rawRider !== undefined) updated.rider = formattedRider;
            if (newDeliveryOtp) updated.deliveryOtp = newDeliveryOtp;
            return updated;
          });
        }
        setLiveOrders((prev: any[]) =>
          prev.map((o) => {
            if (
              (publicOrderId && (o.orderId === publicOrderId || o.id === publicOrderId)) ||
              (docOrderId && (o.orderId === docOrderId || o.id === docOrderId))
            ) {
              const updated = { ...o };
              if (newStatus) updated.status = newStatus;
              if (rawRider !== undefined) updated.rider = rawRider;
              if (newDeliveryOtp) updated.deliveryOtp = newDeliveryOtp;
              return updated;
            }
            return o;
          })
        );
      }
    };

    const handleLocationChanged = (data: any) => {
      if (
        (publicOrderId && data.orderId === publicOrderId) ||
        (docOrderId && data.orderId === docOrderId)
      ) {
        setLiveRiderCoords({
          lat: Number(data.lat),
          lng: Number(data.lng),
          eta: data.eta || "12 mins",
        });
      }
    };

    socket.on("order:status_changed", handleStatusChanged);
    socket.on("order:status_updated", handleStatusChanged);
    socket.on("rider:location_changed", handleLocationChanged);

    return () => {
      if (publicOrderId) {
        socket.emit("leave:order", publicOrderId);
        socket.emit("leave", `order:${publicOrderId}`);
      }
      if (docOrderId && docOrderId !== publicOrderId) {
        socket.emit("leave:order", docOrderId);
        socket.emit("leave", `order:${docOrderId}`);
      }
      socket.off("order:status_changed", handleStatusChanged);
      socket.off("order:status_updated", handleStatusChanged);
      socket.off("rider:location_changed", handleLocationChanged);
    };
  }, [trackingOrder?.orderId, trackingOrder?.id, trackingOrder?._id]);

  // Safety net adaptive polling: Only runs every 12s while live tracking modal is open and active
  useEffect(() => {
    if (!trackingOrder) return;
    const currentStatus = trackingOrder.status || trackingOrder.rawOrder?.status;
    if (currentStatus === "Delivered" || currentStatus === "Cancelled") return;

    const targetId = trackingOrder.orderId || trackingOrder.id;
    if (!targetId) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get<{ success: boolean; order: any }>(`/orders/${targetId}`);
        if (res.data?.success && res.data?.order) {
          const fresh = res.data.order;
          if (fresh.status === "Delivered") {
            setTrackingOrder(null);
            clearInterval(interval);
            const ordersRes = await api.get<{ success: boolean; orders: any[] }>("/orders/my-orders");
            if (ordersRes.data?.success && ordersRes.data?.orders) {
              setLiveOrders(ordersRes.data.orders);
            }
            return;
          }
          setTrackingOrder((prev: any) => (prev ? { ...prev, ...fresh } : fresh));
          if (["Delivered", "Cancelled"].includes(fresh.status)) {
            clearInterval(interval);
          }
        }
      } catch (_) {}
    }, 12000);

    return () => clearInterval(interval);
  }, [trackingOrder?.orderId, trackingOrder?.id, trackingOrder?.status]);

  // Real-time Socket.IO sync for Wallet balance
  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) return;
    const socket = getSocket();
    const userId = (storedUser as any).id || (storedUser as any)._id;

    if (userId) {
      socket.emit("join:user", userId);
    }

    const handleWalletUpdated = (data: any) => {
      if (!data) return;
      const targetId = data.userId ? data.userId.toString() : null;
      const currentId = userId ? userId.toString() : null;
      const uId = user ? ((user as any).id || (user as any)._id)?.toString() : null;

      if (!targetId || targetId === currentId || targetId === uId) {
        if (typeof data.balance === "number") {
          setTeffesCash(data.balance);
        }
      }
    };

    socket.on("wallet:updated", handleWalletUpdated);
    socket.on("wallet:balance_changed", handleWalletUpdated);

    return () => {
      if (userId) {
        socket.emit("leave:user", userId);
      }
      socket.off("wallet:updated", handleWalletUpdated);
      socket.off("wallet:balance_changed", handleWalletUpdated);
    };
  }, [user]);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push("/login");
      return;
    }
    setUser(storedUser);
    if (storedUser.name) setName(storedUser.name);
    if (storedUser.phone) setPhone(storedUser.phone);
    if (storedUser.email) setEmail(storedUser.email);

    // Fetch full user details for tier and spent
    api.get<{ success: boolean; user: any }>("/auth/me")
      .then((res) => {
        if (res.data.success && res.data.user) {
          setUser(res.data.user);
          if (res.data.user.loyaltyTier) setLoyaltyTier(res.data.user.loyaltyTier);
          if (res.data.user.totalSpent) setTotalSpent(res.data.user.totalSpent);
        }
      })
      .catch((err) => console.warn("Failed to fetch /auth/me:", err))
      .finally(() => setLoading(false));

    // Fetch user's orders from backend
    api.get<{ success: boolean; orders: any[] }>("/orders/my-orders")
      .then((res) => {
        if (res.data.success && res.data.orders) {
          setLiveOrders(res.data.orders);
        }
      })
      .catch((err) => console.warn("Failed to fetch my orders:", err));

    // Fetch wallet balance
    api.get<{ success: boolean; balance: number }>("/wallet/details")
      .then((res) => {
        if (res.data.success) {
          setTeffesCash(res.data.balance || 0);
        }
      })
      .catch((err) => console.warn("Failed to fetch wallet details:", err));

    // Fetch payment settings to verify online/recharge gateway status
    api.get<{ success: boolean; settings: { onlineEnabled: boolean; payuConfigured: boolean } }>("/payment/settings")
      .then((res) => {
        if (res.data?.success && res.data.settings) {
          setPaymentSettings({
            onlineEnabled: !!res.data.settings.onlineEnabled,
            payuConfigured: !!res.data.settings.payuConfigured,
          });
        }
      })
      .catch((err) => console.warn("Failed to fetch payment settings:", err));

    // Fetch user's saved addresses
    fetchAddresses();
  }, [router]);

  // Real-time socket sync for active customer orders
  useEffect(() => {
    const socket = getSocket();
    const handleOrderSync = (data?: any) => {
      const storedUser = getStoredUser();
      const currentUserId = storedUser?.id || (storedUser as any)?._id;
      if (data?.order?.customer?.userId && currentUserId && String(data.order.customer.userId) !== String(currentUserId)) {
        return; // Strict customer isolation: ignore other customers' orders
      }
      api.get<{ success: boolean; orders: any[] }>("/orders/my-orders")
        .then((res) => {
          if (res.data.success && res.data.orders) {
            setLiveOrders(res.data.orders);
            setTrackingOrder((currentTracking: any) => {
              if (!currentTracking) return null;
              const matching = res.data.orders.find((o) =>
                (currentTracking.orderId && (o.orderId === currentTracking.orderId || o.id === currentTracking.orderId)) ||
                (currentTracking.id && (o.id === currentTracking.id || o.orderId === currentTracking.id))
              );
              if (matching) {
                if (matching.status === "Delivered") {
                  return null;
                }
                return {
                  ...currentTracking,
                  status: matching.status,
                  rawOrder: matching,
                  deliveryOtp: matching.deliveryOtp || currentTracking.deliveryOtp,
                  rider: matching.rider ? {
                    isAssigned: true,
                    name: matching.rider.name || "",
                    phone: matching.rider.phone || "",
                    vehicle: matching.rider.vehicle || matching.rider.vehicleNumber || "Insulated Cold Box (Fleet)",
                    lat: Number(matching.rider.lat) || 23.3441,
                    lng: Number(matching.rider.lng) || 85.3096,
                    rating: (matching.rider.rating || matching.rider.riderRating || "4.9").toString(),
                    deliveriesCount: matching.rider.deliveriesCount || "Fleet Partner",
                    bagTemp: matching.rider.bagTemp || "Fresh-Lock Insulated Box",
                  } : currentTracking.rider,
                };
              }
              return currentTracking;
            });
          }
        })
        .catch(() => { });
    };

    socket.on("orders:refreshed", handleOrderSync);
    socket.on("order:status_changed", handleOrderSync);
    socket.on("order:status_updated", handleOrderSync);

    return () => {
      socket.off("orders:refreshed", handleOrderSync);
      socket.off("order:status_changed", handleOrderSync);
      socket.off("order:status_updated", handleOrderSync);
    };
  }, []);

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setDeleteAccountError(null);
    try {
      const res = await api.delete("/auth/me");
      if (res.data.success) {
        setIsDeleteModalOpen(false);
        handleLogout();
      }
    } catch (err: any) {
      setDeleteAccountError(err.response?.data?.message || "Failed to delete account");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleAddBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(balanceInput);
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      setRechargeFeedback({ type: "error", message: "Please enter a valid amount (e.g. ₹500)" });
      return;
    }

    setIsRecharging(true);
    setRechargeFeedback(null);

    try {
      const payuRes = await api.post<{ success: boolean; payuParams: any; payuUrl: string }>("/wallet/create-order", {
        amount: amountNum,
        firstname: user?.name || name || 'Customer',
        email: user?.email || email || 'customer@teffes.com',
        phone: (user?.phone || phone || '9999999999').replace(/\D/g, '').slice(-10),
      });

      if (!payuRes.data.success || !payuRes.data.payuParams) {
        setRechargeFeedback({ type: "error", message: "Failed to initiate PayU payment" });
        setIsRecharging(false);
        return;
      }

      // Store recharge amount & txnid for the wallet-success callback page
      sessionStorage.setItem('pendingWalletRecharge', JSON.stringify({
        amount: amountNum,
        txnid: payuRes.data.payuParams.txnid,
      }));

      // Redirect to PayU via hidden form POST
      submitPayUForm(payuRes.data.payuParams, payuRes.data.payuUrl);
    } catch (err: any) {
      setRechargeFeedback({ type: "error", message: err.response?.data?.message || "Failed to initiate PayU recharge." });
      setIsRecharging(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    try {
      const res = await api.put<{ success: boolean; message: string; user: any }>("/auth/me", {
        name,
        email,
        phone,
      });
      if (res.data.success && res.data.user) {
        setUser(res.data.user);
        if (res.data.user.name) setName(res.data.user.name);
        if (res.data.user.email) setEmail(res.data.user.email);
        if (res.data.user.phone) setPhone(res.data.user.phone);

        // Update stored user in localStorage & notify Header in real-time
        updateUserInStorage(res.data.user);

        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err: any) {
      setProfileError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const line1 = newAddressForm.line1.trim();
    const line2 = newAddressForm.line2.trim();
    const city = newAddressForm.city.trim() || "Ranchi";
    const pincode = newAddressForm.pincode.trim();

    if (!line1) {
      setAddressFeedback({ type: "error", message: "Flat / House No. is required" });
      return;
    }
    if (!line2) {
      setAddressFeedback({ type: "error", message: "Area, Landmark, Street is required" });
      return;
    }
    if (!city) {
      setAddressFeedback({ type: "error", message: "City is required" });
      return;
    }
    if (!pincode || pincode.length !== 6) {
      setAddressFeedback({ type: "error", message: "Please enter a valid 6-digit Pincode" });
      return;
    }

    setAddressActionLoading(true);
    setAddressFeedback(null);
    try {
      const res = await api.post<{ success: boolean; addresses: any[] }>("/user/addresses", {
        tag: newAddressForm.tag,
        line1,
        line2,
        landmark: line2,
        city,
        pincode,
        isDefault: addresses.length === 0,
      });
      if (res.data.success && Array.isArray(res.data.addresses)) {
        updateUserInStorage({ addresses: res.data.addresses });
        setAddresses(
          res.data.addresses.map((a: any) => ({
            id: a._id || a.id,
            label: a.tag || "Home",
            address: formatAddressString(a),
            isDefault: !!a.isDefault,
            line1: a.line1 || "",
            line2: a.line2 || a.landmark || "",
            city: a.city || "Ranchi",
            pincode: a.pincode || "834001",
            landmark: a.landmark || "",
          }))
        );
        setAddressFeedback({ type: "success", message: "Address saved successfully!" });
        setNewAddressForm({ tag: "Home", line1: "", line2: "", city: "Ranchi", pincode: "" });
        setShowAddAddressModal(false);
        setTimeout(() => setAddressFeedback(null), 3500);
      }
    } catch (err: any) {
      setAddressFeedback({ type: "error", message: err.response?.data?.message || "Failed to save address" });
    } finally {
      setAddressActionLoading(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    toast.confirm({
      title: "Delete Address?",
      message: "Are you sure you want to delete this delivery address? This action cannot be undone.",
      confirmText: "Delete",
      type: "danger",
      onConfirm: async () => {
        setAddressActionLoading(true);
        setAddressFeedback(null);
        try {
          const res = await api.delete<{ success: boolean; addresses: any[] }>(`/user/addresses/${id}`);
          if (res.data.success && Array.isArray(res.data.addresses)) {
            updateUserInStorage({ addresses: res.data.addresses });
            setAddresses(
              res.data.addresses.map((a: any) => ({
                id: a._id || a.id,
                label: a.tag || "Home",
                address: formatAddressString(a),
                isDefault: !!a.isDefault,
                line1: a.line1 || "",
                line2: a.line2 || "",
                city: a.city || "Ranchi",
                pincode: a.pincode || "834001",
                landmark: a.landmark || "",
              }))
            );
            toast.success("Address deleted successfully", "Address Removed");
          }
        } catch (err: any) {
          toast.error(err.response?.data?.message || "Failed to delete address", "Delete Failed");
        } finally {
          setAddressActionLoading(false);
        }
      },
    });
  };

  const handleSetDefaultAddress = async (id: string) => {
    setAddressActionLoading(true);
    setAddressFeedback(null);
    try {
      const res = await api.put<{ success: boolean; addresses: any[] }>(`/user/addresses/${id}`, {
        isDefault: true,
      });
      if (res.data.success && Array.isArray(res.data.addresses)) {
        updateUserInStorage({ addresses: res.data.addresses });
        setAddresses(
          res.data.addresses.map((a: any) => ({
            id: a._id || a.id,
            label: a.tag || "Home",
            address: formatAddressString(a),
            isDefault: !!a.isDefault,
            line1: a.line1 || "",
            line2: a.line2 || "",
            city: a.city || "Ranchi",
            pincode: a.pincode || "834001",
            landmark: a.landmark || "",
          }))
        );
        setAddressFeedback({ type: "success", message: "Default address updated!" });
        setTimeout(() => setAddressFeedback(null), 3500);
      }
    } catch (err: any) {
      setAddressFeedback({ type: "error", message: err.response?.data?.message || "Failed to set default address" });
    } finally {
      setAddressActionLoading(false);
    }
  };

  // Reorder demonstration
  const handleOrderAgain = (itemNames?: string[]) => {
    const prod = getProductById("chicken-curry-cut-1kg");
    if (prod) {
      addToCart(prod);
    }
    openCart();
  };

  const handleOpenReturnModal = (orderId: string) => {
    setReturnModalOrderId(orderId);
    setReturnReasonInput("Quality / Freshness concern");
    setReturnFeedback(null);
  };

  const handleCloseReturnModal = () => {
    setReturnModalOrderId(null);
    setReturnReasonInput("");
    setReturnFeedback(null);
    setIsSubmittingReturn(false);
  };

  const handleSubmitReturnRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModalOrderId) return;
    if (!returnReasonInput.trim()) {
      setReturnFeedback({ type: "error", message: "Please provide a reason for return/exchange" });
      return;
    }

    setIsSubmittingReturn(true);
    setReturnFeedback(null);

    try {
      const res = await api.post(`/orders/${returnModalOrderId}/return`, { reason: returnReasonInput.trim() });
      if (res.data.success) {
        setReturnFeedback({ type: "success", message: "Return/exchange request submitted! Store team will contact you." });
        const ordersRes = await api.get<{ success: boolean; orders: any[] }>("/orders/my-orders");
        if (ordersRes.data.success && ordersRes.data.orders) {
          setLiveOrders(ordersRes.data.orders);
        }
        setTimeout(() => {
          handleCloseReturnModal();
        }, 1400);
      }
    } catch (err: any) {
      setReturnFeedback({ type: "error", message: err.response?.data?.message || "Failed to request return" });
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const handleOpenRatingModal = (order: any) => {
    setRatingModalOrder(order);
    setRiderRatingValue(5);
    setRiderRatingFeedback("");
  };

  const handleCloseRatingModal = () => {
    setRatingModalOrder(null);
    setRiderRatingValue(5);
    setRiderRatingFeedback("");
    setIsSubmittingRating(false);
  };

  const handleSubmitRiderRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingModalOrder) return;
    setIsSubmittingRating(true);
    try {
      const orderId = ratingModalOrder.id || ratingModalOrder.orderId;
      const res = await api.post(`/orders/${orderId}/rate-rider`, {
        rating: riderRatingValue,
        feedback: riderRatingFeedback.trim(),
      });
      if (res.data.success) {
        toast.success(res.data.message || "Thank you for rating your delivery partner!");
        setLiveOrders((prev) =>
          prev.map((o) => {
            const currentId = o.orderId || o.id;
            if (currentId === orderId) {
              return {
                ...o,
                riderRating: riderRatingValue,
                riderRatingFeedback: riderRatingFeedback.trim(),
                riderRatedAt: new Date().toISOString(),
              };
            }
            return o;
          })
        );
        handleCloseRatingModal();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to submit rating. Please try again.");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleConfirmCancelOrder = async () => {
    if (!cancelModalOrderId) return;
    setIsSubmittingCancel(true);
    setCancelFeedback(null);
    try {
      const res = await api.put(`/orders/${cancelModalOrderId}/cancel`, {
        reason: "Cancelled by customer from website dashboard",
      });
      if (res.data?.success) {
        setCancelFeedback({
          type: "success",
          message: "Order cancelled successfully! Items restocked and funds refunded to your wallet.",
        });
        const ordersRes = await api.get<{ success: boolean; orders: any[] }>("/orders/my-orders");
        if (ordersRes.data?.success && ordersRes.data.orders) {
          setLiveOrders(ordersRes.data.orders);
        }
        api.get<{ success: boolean; balance: number }>("/wallet/details")
          .then((w) => {
            if (w.data?.success) setTeffesCash(w.data.balance || 0);
          })
          .catch(() => { });
        if (trackingOrder && (trackingOrder.id === cancelModalOrderId || trackingOrder.orderId === cancelModalOrderId)) {
          setTrackingOrder((prev: any) => prev ? { ...prev, status: "Cancelled" } : null);
        }
        setTimeout(() => {
          setCancelModalOrderId(null);
          setCancelFeedback(null);
        }, 1500);
      }
    } catch (err: any) {
      setCancelFeedback({
        type: "error",
        message: err.response?.data?.message || "Failed to cancel order",
      });
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const handleSaveEditedAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAddress) return;
    const line1 = (editingAddress.line1 || "").trim();
    const line2 = (editingAddress.line2 || "").trim();
    const city = (editingAddress.city || "Ranchi").trim();
    const pincode = (editingAddress.pincode || "").trim();

    if (!line1) {
      setAddressFeedback({ type: "error", message: "Flat / House No. is required" });
      return;
    }
    if (!line2) {
      setAddressFeedback({ type: "error", message: "Area, Landmark, Street is required" });
      return;
    }
    if (!city) {
      setAddressFeedback({ type: "error", message: "City is required" });
      return;
    }
    if (!pincode || pincode.length !== 6) {
      setAddressFeedback({ type: "error", message: "Please enter a valid 6-digit Pincode" });
      return;
    }

    setAddressActionLoading(true);
    setAddressFeedback(null);
    try {
      const res = await api.put<{ success: boolean; addresses: any[] }>(`/user/addresses/${editingAddress.id}`, {
        tag: editingAddress.label,
        line1,
        line2,
        landmark: line2,
        city,
        pincode,
      });
      if (res.data.success && Array.isArray(res.data.addresses)) {
        updateUserInStorage({ addresses: res.data.addresses });
        setAddresses(
          res.data.addresses.map((a: any) => ({
            id: a._id || a.id,
            label: a.tag || "Home",
            address: formatAddressString(a),
            isDefault: !!a.isDefault,
            line1: a.line1 || "",
            line2: a.line2 || a.landmark || "",
            city: a.city || "Ranchi",
            pincode: a.pincode || "834001",
            landmark: a.landmark || "",
          }))
        );
        setAddressFeedback({ type: "success", message: "Address updated successfully!" });
        setEditingAddress(null);
        setTimeout(() => setAddressFeedback(null), 3500);
      }
    } catch (err: any) {
      setAddressFeedback({ type: "error", message: err.response?.data?.message || "Failed to update address" });
    } finally {
      setAddressActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">Loading your account…</p>
        </div>
      </div>
    );
  }



  const mappedLiveOrders = liveOrders.map((o) => {
    const isOutForDelivery = o.status === "Out for Delivery";
    const isDelivered = o.status === "Delivered";
    const isCancelled = o.status === "Cancelled";
    const isInProgress = !isDelivered && !isCancelled;

    const transitMins = o.remainingTransitMinutes != null ? o.remainingTransitMinutes : 14;
    const isNearDoorstep = isOutForDelivery && (transitMins <= 5 || o.etaStage === "NEAR_DOORSTEP");

    let etaText = "";
    if (isDelivered || isCancelled) {
      etaText = "";
    } else if (isNearDoorstep) {
      etaText = "Arriving in ~5 min";
    } else if (isOutForDelivery) {
      etaText = `Arriving in ${transitMins} min`;
    } else if (o.targetDeliveryTime) {
      try {
        const dt = new Date(o.targetDeliveryTime);
        const timeStr = dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        etaText = `Arriving by ${timeStr}`;
      } catch {
        etaText = "Preparing your cuts";
      }
    } else {
      etaText = "Preparing your cuts";
    }

    const dateStr = o.createdAt
      ? new Date(o.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
      : "Just now";

    return {
      id: o.orderId || o.id || `TEF-${o._id?.slice(-6)}`,
      orderId: o.orderId || o.id,
      status: o.status,
      statusText: o.status === "Pending"
        ? (o.isNextDayOrder || (o.deliverySlot && (o.deliverySlot.toLowerCase().includes('tomorrow') || o.deliverySlot.toLowerCase().includes('next-day') || o.deliverySlot.toLowerCase().includes('09:00 am'))))
          ? "Scheduled • Tomorrow by 9:00 AM"
          : "Order Placed at Teffes"
        : o.status === "Cutting"
          ? "Order Confirmed • Prepping Fresh Cuts"
          : o.status,
      statusColor: isDelivered ? "text-emerald-700" : isCancelled ? "text-slate-500" : "text-amber-700",
      badgeBg: isDelivered ? "bg-emerald-50" : isCancelled ? "bg-slate-100" : "bg-amber-50",
      icon: isDelivered ? "check_circle" : isCancelled ? "cancel" : isOutForDelivery ? "two_wheeler" : "schedule",
      placedAt: etaText ? `${dateStr} • ${etaText}` : dateStr,
      amount: o.amount,
      paymentMethod: o.paymentMethod || o.rawOrder?.paymentMethod || "Cash On Delivery",
      remainingTransitMinutes: o.remainingTransitMinutes,
      targetDeliveryTime: o.targetDeliveryTime,
      etaStage: o.etaStage,
      deliveryOtp: o.deliveryOtp || o.rawOrder?.deliveryOtp || null,
      storeName: o.storeName || "TeFFe's — Doranda Hub",
      storeLat: o.storeLat || 23.3441,
      storeLng: o.storeLng || 85.3096,
      customer: o.customer || o.rawOrder?.customer || null,
      customerLat: o.customer?.lat || o.rawOrder?.customer?.lat || 23.3512,
      customerLng: o.customer?.lng || o.rawOrder?.customer?.lng || 85.3154,
      customerAddress: o.customer?.address || o.rawOrder?.customer?.address || "Your Kitchen",
      rider: {
        isAssigned: !!(o.rider?.name || o.rider?.riderId),
        name: o.rider?.name || (o.deliverySlot === "Store Pickup" ? "Store Pickup Counter" : ""),
        phone: o.rider?.phone || "",
        vehicle: o.rider?.vehicleNumber || o.rider?.vehicle || (o.deliverySlot === "Store Pickup" ? "Self Pickup" : "Insulated Cold Box (Fleet)"),
        lat: Number(o.rider?.lat) || 23.3441,
        lng: Number(o.rider?.lng) || 85.3096,
        rating: o.rider?.rating || "4.9",
        deliveriesCount: o.rider?.deliveriesCount || "Fleet Partner",
        bagTemp: o.rider?.bagTemp || "Fresh-Lock Insulated Box",
        eta: etaText,
      },
      items: (o.items || []).map((it: any) => ({
        name: `${it.name}${it.netWeight ? ` (${it.netWeight})` : ""}`,
        img: it.image || "https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=200&q=80",
        price: it.price || 0,
        quantity: it.quantity || 1,
        netWeight: it.netWeight || it.weight || "1 unit",
      })),
      rawOrder: o,
    };
  });

  const ordersList: any[] = mappedLiveOrders;

  const faqItems = [
    { title: "General Inquiry", desc: "Know about Teffe's shop timings, Ranchi delivery zones, and customer care." },
    { title: "Payment Related", desc: "Refunds, UPI payments, Cash on Delivery, and invoice queries." },
    { title: "Feedback & Suggestions", desc: "Help us serve you better with your cut preferences and packing feedback." },
    { title: "Order / Products Related", desc: "Cut styles, custom meat portions, gross vs net weight assurance." },
    { title: "Gift Card & Teffes Cash", desc: "Redeeming wallet credits and promotional cashback." },
    { title: "Freshness & 90-Min Guarantee", desc: "Our 100% fresh shop cuts and fast delivery dispatch straight to your door." },
    { title: "Wallet Related", desc: "Instant refunds credited directly to Teffes Cash wallet." },
    { title: "Teffes shop Club", desc: "Exclusive monthly subscription with free express deliveries." },
    { title: "Referral Program", desc: "Invite Ranchi friends and get ₹100 off on your next fresh meat order." },
  ];

  return (
    <div className="w-full min-h-screen bg-[#f4f6f8] py-4 sm:py-6 lg:py-8 font-body-md text-on-surface">
      <div className="w-full max-w-container-max mx-auto px-gutter-desktop">
        {/* Main Account Card (Zepto Style - Responsive full-width utilization) */}
        <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[700px] w-full">

          {/* ─── LEFT SIDEBAR ────────────────────────────────────────────── */}
          <aside className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-gray-200/80 p-5 sm:p-6 lg:p-7 flex flex-col justify-between shrink-0 bg-white" style={{ maxHeight: '75vh' }}>
            <div className="space-y-6">
              {/* User Info Block with Nearby Logout Option */}
              <div className="flex items-center justify-between gap-2.5 pb-1">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-13 h-13 rounded-full bg-[#7c3aed]/15 border-2 border-[#7c3aed]/30 flex items-center justify-center text-[#6d28d9] shrink-0 font-extrabold text-xl shadow-xs">
                    {(name || phone || "C").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-headline-sm font-extrabold text-gray-900 text-base leading-tight truncate">
                      {name || phone || "Customer"}
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5 truncate">
                      {phone || email || "Active Member"}
                    </p>
                  </div>
                </div>

                {/* Log Out option on top nearby user's name and number */}
                {/* <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign Out"
                  className="px-3 py-1.5 rounded-xl text-primary hover:bg-crimson-soft/80 border border-primary/20 hover:border-primary/40 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0 bg-white shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  <span>Logout</span>
                </button> */}
              </div>

              {/* Teffes Cash & Gift Card Box */}
              <div className="bg-slate-50/90 rounded-2xl border border-gray-200/80 p-4 shadow-2xs">
                <div className="flex items-center justify-between cursor-pointer pb-2.5 border-b border-gray-200/60">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#7c3aed] text-[20px]">
                      account_balance_wallet
                    </span>
                    <span className="font-label-md font-bold text-gray-800 text-[13px]">
                      Teffes Cash &amp; Gift Card
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 text-[18px]">
                    chevron_right
                  </span>
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block">Available Balance:</span>
                    <span className="font-headline-sm font-extrabold text-gray-900 text-base">₹{teffesCash}</span>
                  </div>
                  {(!paymentSettings.onlineEnabled || !paymentSettings.payuConfigured) ? (
                    <div className="flex flex-col items-end gap-1">
                      <button
                        type="button"
                        disabled
                        title={!paymentSettings.onlineEnabled ? "Online recharge is temporarily paused by store" : "PayU is not configured by admin"}
                        className="py-1.5 px-3.5 rounded-full bg-gray-200 text-gray-400 font-label-badge font-bold text-xs shadow-none cursor-not-allowed border-none"
                      >
                        Add Balance
                      </button>
                      <span className="text-[10px] text-amber-700 font-semibold">
                        {!paymentSettings.onlineEnabled ? "Recharge Paused" : "Gateway Unconfigured"}
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setBalanceInput("");
                        setRechargeFeedback(null);
                        setIsAddBalanceModalOpen(true);
                      }}
                      className="py-1.5 px-3.5 rounded-full bg-black hover:bg-gray-800 text-white font-label-badge font-bold text-xs shadow-xs cursor-pointer border-none transition-all"
                    >
                      Add Balance
                    </button>
                  )}
                </div>
              </div>

              {/* Tab Navigation Menu */}
              <nav className="space-y-1.5 pt-1">
                {[
                  { key: "orders", label: "Orders", icon: "shopping_bag" },
                  { key: "support", label: "Customer Support", icon: "support_agent" },
                  { key: "addresses", label: "Saved Addresses", icon: "location_on" },
                  { key: "profile", label: "Profile", icon: "person" },
                  { key: "policy", label: "Return & Exchange Policy", icon: "published_with_changes" },
                ].map((item) => {
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveTab(item.key as TabKey)}
                      className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-left transition-all border-none cursor-pointer text-[13.5px] ${isActive
                        ? "bg-slate-100/90 text-gray-900 font-extrabold shadow-2xs"
                        : "bg-transparent text-slate-600 hover:bg-slate-50 hover:text-gray-900 font-medium"
                        }`}
                    >
                      <span className={`material-symbols-outlined text-[20px] ${isActive ? "text-primary" : "text-slate-400"}`}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Bottom: Logout & Brand Logo */}
            <div className="pt-8 border-t border-gray-100 flex flex-col items-center space-y-4">
              {/* <button
                type="button"
                onClick={handleLogout}
                className="w-full max-w-[200px] py-2 px-6 rounded-xl border border-primary text-primary hover:bg-primary hover:text-white font-headline-sm font-bold text-xs transition-all cursor-pointer bg-white"
              >
                Log Out
              </button> */}
              <button
                type="button"
                onClick={handleLogout}
                title="Sign Out"
                className="w-full max-w-[200px] py-2 px-6 rounded-xl border border-primary text-primary hover:bg-primary hover:text-white font-headline-sm font-bold text-xs transition-all cursor-pointer bg-white"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                <span>Logout</span>
              </button>

              <div className="opacity-90 hover:opacity-100 transition-opacity">
                <img
                  src="/teffes-logo-maroon.png"
                  alt="Teffes"
                  className="h-8 w-auto object-contain"
                />
              </div>
            </div>
          </aside>

          {/* ─── RIGHT CONTENT AREA ───────────────────────────────────────── */}
          <main className="flex-1 p-5 sm:p-8 lg:p-10 overflow-y-auto bg-white min-w-0 w-full">
            {/* 1. ORDERS TAB (Image 1 Style) */}
            {activeTab === "orders" && (
              <div className="space-y-4 w-full">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-gray-700 text-[20px]">
                    chevron_left
                  </span>
                  <h1 className="font-headline-sm font-extrabold text-gray-900 text-lg">
                    Orders
                  </h1>
                </div>

                {ordersList.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-200/90 p-10 text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-3 text-amber-700">
                      <span className="material-symbols-outlined text-[32px]">shopping_bag</span>
                    </div>
                    <h3 className="font-headline-sm font-bold text-gray-900 text-base">No orders yet</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      You haven&apos;t placed any orders yet. Fresh chicken, mutton, and fish are ready for 90-minute delivery in Ranchi!
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push("/")}
                      className="mt-4 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-xs shadow-md border-none cursor-pointer transition-all"
                    >
                      Browse Storefront
                    </button>
                  </div>
                ) : (
                  ordersList.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden shadow-2xs hover:border-gray-300 transition-all"
                    >
                      {/* Order Header */}
                      <div className="p-4 sm:p-5 flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`font-headline-sm font-bold text-[14px] flex items-center gap-1 ${order.statusColor}`}>
                              <span>{order.statusText}</span>
                              <span className="material-symbols-outlined text-[16px]">
                                {order.icon}
                              </span>
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {(() => {
                              if (order.orderCategory === "in-progress" || !["Delivered", "Cancelled"].includes(order.status)) {
                                const raw = order.rawOrder || order;
                                const isOut = order.statusText === "Out for Delivery" || raw.status === "Out for Delivery";
                                const transitMins = raw.remainingTransitMinutes ?? order.remainingTransitMinutes ?? 14;
                                const isNear = isOut && (transitMins <= 5 || raw.etaStage === "NEAR_DOORSTEP" || order.etaStage === "NEAR_DOORSTEP");

                                let dynamicEta = "";
                                if (isNear) {
                                  dynamicEta = "Arriving in ~5 min";
                                } else if (isOut) {
                                  dynamicEta = `Arriving in ${transitMins} min`;
                                } else if (raw.targetDeliveryTime || order.targetDeliveryTime) {
                                  try {
                                    const dt = new Date(raw.targetDeliveryTime || order.targetDeliveryTime);
                                    dynamicEta = `Arriving by ${dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
                                  } catch {
                                    dynamicEta = "Preparing your cuts";
                                  }
                                } else {
                                  dynamicEta = "Preparing your cuts";
                                }

                                const rawDate = (order.placedAt || "Recently").split(" • ")[0];
                                return `${rawDate} • ${dynamicEta}`;
                              }
                              return order.placedAt;
                            })()}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-headline-sm font-black text-gray-900 text-sm">
                            ₹{order.amount}
                          </span>
                          <span className="material-symbols-outlined text-gray-400 text-[18px]">
                            chevron_right
                          </span>
                        </div>
                      </div>

                      {/* Order Thumbnails Strip */}
                      <div className="px-4 sm:px-5 pb-4 flex items-center gap-2.5 overflow-x-auto">
                        {order.items.map((item: any, idx: number) => (
                          <div
                            key={idx}
                            className="w-14 h-14 rounded-xl border border-gray-200/80 overflow-hidden bg-gray-50 shrink-0"
                            title={item.name}
                          >
                            <img
                              src={item.img}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Action CTA: Cancelled vs In-Progress vs Completed */}
                      {order.status === "Cancelled" || order.rawOrder?.status === "Cancelled" ? (
                        <div className="p-3.5 bg-rose-50/90 border-t border-rose-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-rose-600 text-[18px]">cancel</span>
                            <div className="text-xs">
                              <span className="font-extrabold text-rose-900 block">Order Cancelled</span>
                              <span className="text-rose-700 font-medium">
                                {order.cancellationReason || order.rawOrder?.cancellationReason
                                  ? `Reason: ${order.cancellationReason || order.rawOrder?.cancellationReason}`
                                  : "This order was cancelled."}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOrderAgain(order.items.map((i: any) => i.name))}
                            className="w-full sm:w-auto py-2 px-4 rounded-xl bg-primary hover:bg-primary-dark text-white font-headline-sm font-bold text-xs shadow-xs transition-all border-none cursor-pointer"
                          >
                            Order Again
                          </button>
                        </div>
                      ) : (order.orderCategory === "in-progress" || !["Delivered", "Cancelled"].includes(order.status)) ? (
                        <div className="p-3.5 bg-amber-50/80 border-t border-amber-200/70 flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                              <span className="text-xs font-bold text-amber-950">
                                {(order.status === "Cutting" || order.rawOrder?.status === "Cutting")
                                  ? "Teffes Store Preparing Meat"
                                  : order.rider?.name && ["Ready", "Out for Delivery", "Delivered"].includes(order.status || order.rawOrder?.status)
                                    ? `Rider Dispatched • ${order.rider.name}`
                                    : (order.status === "Pending" || order.rawOrder?.status === "Pending")
                                      ? "Order Placed at Teffes Store"
                                      : "Order Confirmed • Prepping Fresh Cuts"}
                              </span>
                            </div>
                            {order.deliveryOtp && (
                              <div className="flex items-center gap-1.5 bg-white border border-amber-300 px-2.5 py-0.5 rounded-lg text-xs shadow-2xs">
                                <span className="text-[10.5px] font-bold text-amber-800 uppercase tracking-wide">OTP:</span>
                                <span className="font-mono font-black text-primary text-sm tracking-wider">{order.deliveryOtp}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => setTrackingOrder(order)}
                              className="flex-1 sm:flex-none py-2 px-4 rounded-xl bg-primary hover:bg-primary-dark text-white font-headline-sm font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 border-none cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[17px]">
                                {order.rider?.name && ["Ready", "Out for Delivery"].includes(order.status || order.rawOrder?.status) ? "two_wheeler" : "schedule"}
                              </span>
                              <span>Track Order</span>
                            </button>

                            {["Placed", "Pending", "Confirmed", "Cutting"].includes(order.status || order.rawOrder?.status || "Pending") && (
                              <button
                                type="button"
                                onClick={() => { setCancelModalOrderId(order.id || order.rawOrder?._id || order.orderId); setCancelFeedback(null); }}
                                className="py-2 px-3 rounded-xl bg-white border border-red-200 text-red-700 hover:bg-red-50 font-headline-sm font-bold text-xs transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <span className="material-symbols-outlined text-red-600 text-[16px]">cancel</span>
                                <span>Cancel Order</span>
                              </button>
                            )}

                            {order.rider?.phone && ["Ready", "Out for Delivery"].includes(order.status || order.rawOrder?.status) && (
                              <a
                                href={`tel:${order.rider?.phone}`}
                                className="py-2 px-3 rounded-xl bg-white border border-gray-200 text-gray-800 font-headline-sm font-bold text-xs hover:bg-gray-50 transition-all flex items-center gap-1 text-decoration-none shadow-2xs"
                              >
                                <span className="material-symbols-outlined text-emerald-600 text-[17px]">call</span>
                                <span>Call</span>
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap w-full border-t border-gray-100 divide-x divide-gray-100">
                          {(order.status === "Delivered" || order.orderCategory === "delivered") && order.rawOrder?.returnStatus === "Not Requested" && (
                            <button
                              type="button"
                              onClick={() => handleOpenReturnModal(order.id)}
                              className="flex-1 min-w-[100px] py-3 text-center font-headline-sm font-bold text-gray-700 hover:bg-gray-50 text-[13px] cursor-pointer bg-white transition-colors border-none"
                            >
                              Return/Exchange
                            </button>
                          )}
                          {order.rawOrder?.returnStatus && order.rawOrder?.returnStatus !== "Not Requested" && (
                            <div className="flex-1 min-w-[100px] py-3 text-center font-headline-sm font-bold text-amber-600 text-[13px] bg-amber-50/30">
                              Return {order.rawOrder?.returnStatus}
                            </div>
                          )}
                          {(order.status === "Delivered" || order.orderCategory === "delivered") && (
                            order.rawOrder?.riderRating ? (
                              <div className="flex-1 min-w-[100px] py-3 text-center font-headline-sm font-bold text-amber-700 text-[12.5px] bg-amber-50/40 flex items-center justify-center gap-1">
                                <span className="material-symbols-outlined text-amber-500 text-[15px]">star</span>
                                <span>Rated {order.rawOrder.riderRating}★</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenRatingModal(order)}
                                className="flex-1 min-w-[100px] py-3 text-center font-headline-sm font-bold text-amber-700 hover:bg-amber-50 text-[13px] cursor-pointer bg-white transition-colors border-none flex items-center justify-center gap-1"
                              >
                                <span className="material-symbols-outlined text-amber-500 text-[15px]">star</span>
                                <span>Rate Rider</span>
                              </button>
                            )
                          )}
                          {(order.status === "Delivered" || order.orderCategory === "delivered") && (
                            <button
                              type="button"
                              onClick={() => {
                                const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                                if (isMobile) {
                                  window.open("https://play.google.com/store/apps/details?id=com.teffes.app", "_blank");
                                } else {
                                  window.open("https://www.google.com/search?q=Teffe%27s+Meat+Store+Ranchi+reviews", "_blank");
                                }
                              }}
                              className="flex-1 min-w-[100px] py-3 text-center font-headline-sm font-bold text-emerald-700 hover:bg-emerald-50 text-[13px] cursor-pointer bg-white transition-colors border-none flex items-center justify-center gap-1"
                            >
                              <span className="material-symbols-outlined text-emerald-600 text-[15px]">thumb_up</span>
                              <span>Rate Us</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOrderAgain(order.items.map((i: any) => i.name))}
                            className="flex-1 min-w-[100px] py-3 text-center font-headline-sm font-bold text-primary hover:bg-crimson-soft text-[13px] cursor-pointer bg-white transition-colors border-none"
                          >
                            Order Again
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 2. CUSTOMER SUPPORT TAB (Image 2 Style) */}
            {activeTab === "support" && (
              <div className="w-full space-y-4">
                <h1 className="font-headline-sm font-extrabold text-gray-900 text-lg mb-2">
                  FAQs
                </h1>

                <div className="bg-white rounded-2xl border border-gray-200/80 divide-y divide-gray-100 shadow-2xs overflow-hidden">
                  {faqItems.map((faq, idx) => (
                    <details
                      key={idx}
                      className="group p-4 cursor-pointer hover:bg-gray-50/70 transition-colors"
                    >
                      <summary className="flex items-center justify-between font-label-md font-bold text-gray-800 text-[13.5px] list-none">
                        <span>{faq.title}</span>
                        <span className="material-symbols-outlined text-primary text-[18px] group-open:rotate-90 transition-transform">
                          chevron_right
                        </span>
                      </summary>
                      <p className="mt-2 text-xs text-slate-500 leading-relaxed pl-1">
                        {faq.desc}
                      </p>
                    </details>
                  ))}
                </div>

                {/* Direct Butchery Support Card */}
                <div className="mt-6 p-4 rounded-2xl bg-crimson-soft border border-primary/20 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined text-[22px]">phone_in_talk</span>
                  </div>
                  <div>
                    <h4 className="font-headline-sm font-bold text-on-surface text-sm">
                      Need Immediate Help with Your Order?
                    </h4>
                    <p className="text-xs text-slate-body mt-0.5">
                      Call our Ranchi store directly at <strong>+91 94311 00000</strong> (7 AM – 9 PM).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 3. SAVED ADDRESSES TAB (Image 3 Style) */}
            {activeTab === "addresses" && (
              <div className="w-full space-y-5">
                {/* Feedback Alert */}
                {addressFeedback && (
                  <div
                    className={`p-3.5 rounded-2xl text-xs font-bold border flex items-center gap-2.5 shadow-2xs ${addressFeedback.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-red-50 text-red-700 border-red-200"
                      }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {addressFeedback.type === "success" ? "check_circle" : "error"}
                    </span>
                    <span>{addressFeedback.message}</span>
                  </div>
                )}

                {/* Add New Address Action Pill */}
                <button
                  type="button"
                  onClick={() => setShowAddAddressModal(true)}
                  className="w-full p-4 rounded-2xl border border-gray-200/90 bg-white hover:bg-gray-50 flex items-center justify-between text-primary font-headline-sm font-bold text-[14px] cursor-pointer shadow-2xs transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-primary">+</span>
                    <span>Add New Address</span>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 text-[18px]">
                    chevron_right
                  </span>
                </button>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-label-md font-bold text-gray-800 text-[13px]">
                      Saved Addresses
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">
                      {addresses.length} {addresses.length === 1 ? "address" : "addresses"} saved
                    </span>
                  </div>

                  {addressLoading ? (
                    <div className="p-8 text-center bg-white rounded-2xl border border-gray-200/90 shadow-2xs">
                      <div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-xs text-slate-500 font-medium">Loading saved addresses…</p>
                    </div>
                  ) : addresses.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-gray-300 shadow-2xs">
                      <span className="material-symbols-outlined text-[36px] text-gray-300 mb-2">location_off</span>
                      <h4 className="text-sm font-bold text-gray-800">No saved addresses yet</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Add your home or office address in Ranchi for fast, 10-minute delivery.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {addresses.map((addr) => (
                        <div
                          key={addr.id}
                          className={`bg-white rounded-2xl border p-4 shadow-2xs flex items-start justify-between gap-4 transition-all ${addr.isDefault ? "border-primary/40 ring-1 ring-primary/20" : "border-gray-200/90"
                            }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-gray-700 text-[20px] mt-0.5">
                              {addr.label.toLowerCase() === "home"
                                ? "home"
                                : addr.label.toLowerCase() === "office"
                                  ? "business"
                                  : "location_on"}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-headline-sm font-extrabold text-gray-900 text-sm">
                                  {addr.label}
                                </h4>
                                {addr.isDefault ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                                    Default
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={addressActionLoading}
                                    onClick={() => handleSetDefaultAddress(addr.id)}
                                    className="text-[10.5px] text-slate-400 hover:text-primary underline cursor-pointer bg-transparent border-none p-0"
                                    title="Make this your default delivery address"
                                  >
                                    Set Default
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-slate-body leading-relaxed mt-1 max-w-md">
                                {addr.address}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 text-gray-400">
                            <button
                              type="button"
                              disabled={addressActionLoading}
                              onClick={() => {
                                setEditingAddress({
                                  id: addr.id,
                                  label: addr.label,
                                  address: addr.address,
                                  isDefault: addr.isDefault,
                                  line1: addr.line1 || addr.address,
                                  line2: addr.line2 || addr.landmark || "",
                                  city: addr.city || "Ranchi",
                                  pincode: addr.pincode || "834001",
                                  landmark: addr.landmark || "",
                                });
                              }}
                              className="hover:text-gray-700 border-none bg-transparent cursor-pointer p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                              title="Edit Address"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={addressActionLoading}
                              onClick={() => handleDeleteAddress(addr.id)}
                              className="hover:text-error border-none bg-transparent cursor-pointer p-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                              title="Delete Address"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Edit Address Inline Form */}
                {editingAddress && (
                  <form
                    onSubmit={handleSaveEditedAddress}
                    className="p-4 sm:p-5 bg-amber-50/60 border border-amber-200/90 rounded-2xl space-y-3.5 animate-fade-in shadow-2xs"
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-amber-700 text-[18px]">edit</span>
                        <span>Edit Delivery Address</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setEditingAddress(null)}
                        className="text-xs text-slate-500 hover:text-gray-800 border-none bg-transparent cursor-pointer font-bold"
                      >
                        Cancel
                      </button>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-1.5">Address Type</label>
                      <div className="flex gap-2">
                        {["Home", "Office", "Other"].map((lbl) => (
                          <button
                            key={lbl}
                            type="button"
                            onClick={() => setEditingAddress({ ...editingAddress, label: lbl })}
                            className={`px-3 py-1 rounded-full text-xs font-bold border cursor-pointer transition-colors ${editingAddress.label === lbl
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                              }`}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-700 block mb-1">
                        Flat / House No., Apartment, Building *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Flat 402, Shivalik Heights, Harmu Road"
                        value={editingAddress.line1 || ""}
                        onChange={(e) => setEditingAddress({ ...editingAddress, line1: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-medium focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-700 block mb-1">
                        Area, Landmark, Street *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Near Kishore Ganj Chowk"
                        value={editingAddress.line2 || ""}
                        onChange={(e) => setEditingAddress({ ...editingAddress, line2: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-medium focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-gray-700 block mb-1">City *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Ranchi"
                          value={editingAddress.city || "Ranchi"}
                          onChange={(e) => setEditingAddress({ ...editingAddress, city: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-medium focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-gray-700 block mb-1">Pincode * (6 digits)</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 834001"
                          maxLength={6}
                          value={editingAddress.pincode || ""}
                          onChange={(e) => setEditingAddress({ ...editingAddress, pincode: e.target.value.replace(/\D/g, "") })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-medium focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={addressActionLoading || !editingAddress.line1?.trim() || !editingAddress.line2?.trim() || !editingAddress.city?.trim() || (editingAddress.pincode || "").length !== 6}
                        className="px-4 py-2 bg-primary hover:bg-[#91000a] text-white rounded-xl text-xs font-bold border-none cursor-pointer disabled:opacity-60 transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        {addressActionLoading && (
                          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        )}
                        <span>{addressActionLoading ? "Updating…" : "Update Address"}</span>
                      </button>
                      <button
                        type="button"
                        disabled={addressActionLoading}
                        onClick={() => setEditingAddress(null)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-xs font-bold border-none cursor-pointer hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* Add Address Modal Inline */}
                {showAddAddressModal && (
                  <form
                    onSubmit={handleAddAddress}
                    className="p-4 sm:p-5 bg-slate-50 border border-gray-200 rounded-2xl space-y-3.5 animate-fade-in shadow-2xs"
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-sm text-gray-900">Add New Ranchi Delivery Address</h4>
                      <button
                        type="button"
                        onClick={() => setShowAddAddressModal(false)}
                        className="text-xs text-slate-500 hover:text-gray-800 border-none bg-transparent cursor-pointer font-bold"
                      >
                        Cancel
                      </button>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-1.5">Address Type</label>
                      <div className="flex gap-2">
                        {["Home", "Office", "Other"].map((lbl) => (
                          <button
                            key={lbl}
                            type="button"
                            onClick={() => setNewAddressForm({ ...newAddressForm, tag: lbl })}
                            className={`px-3 py-1 rounded-full text-xs font-bold border cursor-pointer transition-colors ${newAddressForm.tag === lbl
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                              }`}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-700 block mb-1">
                        Flat / House No., Apartment, Building *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Flat 402, Shivalik Heights, Harmu Road"
                        value={newAddressForm.line1}
                        onChange={(e) => setNewAddressForm({ ...newAddressForm, line1: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-medium focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-700 block mb-1">
                        Area, Landmark, Street *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Near Kishore Ganj Chowk"
                        value={newAddressForm.line2}
                        onChange={(e) => setNewAddressForm({ ...newAddressForm, line2: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-medium focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-gray-700 block mb-1">City *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Ranchi"
                          value={newAddressForm.city}
                          onChange={(e) => setNewAddressForm({ ...newAddressForm, city: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-medium focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-gray-700 block mb-1">Pincode * (6 digits)</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 834001"
                          maxLength={6}
                          value={newAddressForm.pincode}
                          onChange={(e) => setNewAddressForm({ ...newAddressForm, pincode: e.target.value.replace(/\D/g, "") })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-medium focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={addressActionLoading || !newAddressForm.line1.trim() || !newAddressForm.line2.trim() || !newAddressForm.city.trim() || newAddressForm.pincode.length !== 6}
                        className="px-4 py-2 bg-primary hover:bg-[#91000a] text-white rounded-xl text-xs font-bold border-none cursor-pointer disabled:opacity-60 transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        {addressActionLoading && (
                          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        )}
                        <span>{addressActionLoading ? "Saving…" : "Save Address"}</span>
                      </button>
                      <button
                        type="button"
                        disabled={addressActionLoading}
                        onClick={() => setShowAddAddressModal(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-xs font-bold border-none cursor-pointer hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* 4. PROFILE TAB (Image 4 Style) */}
            {activeTab === "profile" && (
              <div className="w-full max-w-2xl space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-gray-700 text-[20px]">
                    chevron_left
                  </span>
                  <h1 className="font-headline-sm font-extrabold text-gray-900 text-lg">
                    Profile
                  </h1>
                </div>

                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  {/* Name Input */}
                  <div className="form-group mb-4">
                    <label className="form-label text-xs text-slate-500 font-bold uppercase">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="form-input"
                      placeholder="Your full name"
                    />
                  </div>

                  {/* Email Input */}
                  <div className="form-group mb-1">
                    <label className="form-label text-xs text-slate-500 font-bold uppercase">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="form-input"
                      placeholder="your.email@example.com"
                    />
                    <span className="text-[11.5px] text-slate-400 mt-1 block">
                      We promise not to spam you
                    </span>
                  </div>

                  {/* Mobile Number (Read-only) */}
                  <div className="form-group mb-4">
                    <label className="form-label text-xs text-slate-500 font-bold uppercase">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      readOnly
                      value={phone}
                      className="form-input bg-gray-50 cursor-not-allowed text-slate-600"
                    />
                  </div>

                  {/* Loyalty & Tier (Read-only) */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="form-group">
                      <label className="form-label text-xs text-slate-500 font-bold uppercase">
                        Teffe's Loyalty Tier
                      </label>
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50">
                        <span className={`material-symbols-outlined text-[20px] ${loyaltyTier === "Platinum" ? "text-purple-500" :
                          loyaltyTier === "Gold" ? "text-yellow-500" :
                            loyaltyTier === "Silver" ? "text-gray-400" :
                              "text-amber-700"
                          }`}>
                          workspace_premium
                        </span>
                        <span className="text-sm font-bold text-gray-900">{loyaltyTier}</span>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label text-xs text-slate-500 font-bold uppercase">
                        Total Spent
                      </label>
                      <div className="px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 flex items-center">
                        <span className="text-sm font-extrabold text-gray-900">₹{totalSpent}</span>
                      </div>
                    </div>
                  </div>

                  {savedSuccess && (
                    <div className="alert alert-success">
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      <span>Profile updated successfully!</span>
                    </div>
                  )}

                  {profileError && (
                    <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-bold border border-red-200 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">error</span>
                      <span>{profileError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="w-full border-black py-3.5 rounded-xl bg-gray-100 hover:bg-[#91000a] disabled:opacity-60 text-gray-800 hover:text-white font-headline-sm font-bold text-sm border hover:border-[#91000a] shadow-2xs hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>{profileSaving ? "Saving..." : "Submit"}</span>
                    {!profileSaving && <span className="material-symbols-outlined text-[18px]">check</span>}
                  </button>
                </form>

                {/* Delete Account Danger Zone */}
                <div className="pt-6 border-t border-gray-100">
                  <h4 className="font-headline-sm font-bold text-crimson-bright text-sm mb-1">
                    Delete Account
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">
                    Deleting your account will remove all your orders, wallet amount, and any active referral credits.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="text-xs font-bold text-error hover:underline bg-transparent border-none p-0 cursor-pointer"
                  >
                    Request Account Deletion →
                  </button>
                </div>
              </div>
            )}

            {/* 5. RETURN & EXCHANGE POLICY TAB (Rendered in right content area) */}
            {activeTab === "policy" && (
              <div className="w-full space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-gray-700 text-[20px]">
                    chevron_left
                  </span>
                  <h1 className="font-headline-sm font-extrabold text-gray-900 text-lg">
                    Return &amp; Exchange Policy
                  </h1>
                </div>

                {/* Banner Card */}
                <div
                  className="text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, #91000a 0%, #b71c1c 60%, #6e0e0e 100%)",
                  }}
                >
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white font-label-badge text-[11px] font-bold uppercase tracking-wider mb-2 backdrop-blur-xs">
                    <span className="material-symbols-outlined text-[15px]">verified</span>
                    <span>Teffes Customer Guarantee</span>
                  </div>
                  <h2 className="font-headline-md font-extrabold text-xl sm:text-2xl text-white">
                    Fresh Meat Exchange Within 60 Mins
                  </h2>
                  <p className="text-xs sm:text-sm text-white/90 mt-1 max-w-2xl leading-relaxed">
                    At Teffes Farm and Foods LLP, we are committed to delivering healthy, fresh, and cleanly cut meat. Due to perishable food safety standards, we do not offer refunds, but provide a 100% free exchange facility under eligible conditions.
                  </p>
                </div>

                {/* Policy Pillars Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Pillar 1 */}
                  <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-2xs">
                    <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center mb-3">
                      <span className="material-symbols-outlined text-[22px]">block</span>
                    </div>
                    <h3 className="font-headline-sm font-bold text-gray-900 text-base mb-1.5">
                      1. No Refund Policy
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      All sales are final once delivered due to the perishable nature of fresh meat cuts. We do not provide cash or card refunds after delivery.
                    </p>
                  </div>

                  {/* Pillar 2 */}
                  <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-2xs">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center mb-3">
                      <span className="material-symbols-outlined text-[22px]">timer</span>
                    </div>
                    <h3 className="font-headline-sm font-bold text-gray-900 text-base mb-1.5">
                      2. 60-Minute Exchange Window
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Exchange requests must be raised within <strong>60 minutes of delivery</strong>. Due to temperature sensitivity, requests after 60 minutes cannot be honored.
                    </p>
                  </div>

                  {/* Pillar 3 */}
                  <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-2xs">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center mb-3">
                      <span className="material-symbols-outlined text-[22px]">check_circle</span>
                    </div>
                    <h3 className="font-headline-sm font-bold text-gray-900 text-base mb-1.5">
                      3. Eligible Conditions for Exchange
                    </h3>
                    <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4 leading-relaxed">
                      <li>Incorrect cut or wrong item delivered</li>
                      <li>Quality defect, odor, or damaged packaging</li>
                      <li>Weight mismatch beyond cutting tolerance</li>
                    </ul>
                  </div>

                  {/* Pillar 4 */}
                  <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-2xs">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center mb-3">
                      <span className="material-symbols-outlined text-[22px]">cancel</span>
                    </div>
                    <h3 className="font-headline-sm font-bold text-gray-900 text-base mb-1.5">
                      4. Order Cancellation
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Orders can be cancelled before cutting begins. Once our team starts custom preparation or dispatch, cancellations cannot be processed.
                    </p>
                  </div>
                </div>

                {/* How to Request Section */}
                <div className="bg-slate-50 rounded-2xl border border-gray-200/80 p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-headline-sm font-bold text-gray-900 text-base">
                      How to Request an Exchange in Ranchi
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Contact support within 60 mins with your Order ID and photo of the cut.
                    </p>
                    <div className="mt-2 text-xs text-slate-700 space-y-1">
                      <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[15px] text-slate-500">call</span> Hotline: <strong>+91 92796 82955</strong></div>
                      <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[15px] text-slate-500">chat</span> WhatsApp: <strong>+91 92796 82955</strong></div>
                      <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[15px] text-slate-500">mail</span> Email: <strong>rakeshroshanteffes@gmail.com</strong></div>
                    </div>
                  </div>

                  <a
                    href="https://wa.me/919279682955?text=Hello%20Teffes%2C%20I%20want%20to%20request%20an%20exchange%20for%20my%20order."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-headline-sm font-bold text-xs flex items-center gap-2 shadow-xs text-decoration-none whitespace-nowrap shrink-0"
                  >
                    <span>Request on WhatsApp</span>
                  </a>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ─── LIVE TRACK RIDER MODAL ────────────────────────────────────── */}
      {trackingOrder && (trackingOrder.status || trackingOrder.rawOrder?.status) !== "Delivered" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div
              className="p-4 sm:p-5 text-white flex items-center justify-between"
              style={{
                background: "linear-gradient(135deg, #91000a 0%, #b71c1c 100%)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">two_wheeler</span>
                </div>
                <div>
                  <h3 className="font-headline-sm font-extrabold text-base text-white leading-tight">
                    Live Rider Tracking
                  </h3>
                  <span className="text-[11px] text-white/85 font-mono">
                    Order ID: {trackingOrder.id}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTrackingOrder(null)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center border-none cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Dynamic Multi-Phase ETA Banner */}
              {(() => {
                const status = trackingOrder.status || trackingOrder.rawOrder?.status || "Placed";
                const isDelivered = status === "Delivered";
                const isOutForDelivery = status === "Out for Delivery";
                const transitMins = trackingOrder.remainingTransitMinutes != null ? trackingOrder.remainingTransitMinutes : 15;
                const isNearDoorstep = isOutForDelivery && (transitMins <= 5 || trackingOrder.etaStage === "NEAR_DOORSTEP");

                const isNextDayOrder = Boolean(
                  (trackingOrder.deliverySlot && (trackingOrder.deliverySlot.toLowerCase().includes("tomorrow") || trackingOrder.deliverySlot.toLowerCase().includes("next-day") || trackingOrder.deliverySlot.toLowerCase().includes("9:00 am"))) ||
                  (trackingOrder.targetDeliveryTime && new Date(trackingOrder.targetDeliveryTime).getDate() !== new Date(trackingOrder.createdAt || Date.now()).getDate())
                );

                const formattedTargetTime = isNextDayOrder
                  ? "Tomorrow by 09:00 AM"
                  : trackingOrder.targetDeliveryTime
                    ? new Date(trackingOrder.targetDeliveryTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                    : "90 mins";

                let badgeText = "Order in Preparation";
                let mainHeading = isNextDayOrder ? "Scheduled Delivery" : "Preparing your cuts";
                let subHeading = isNextDayOrder
                  ? "Scheduled: Tomorrow by 09:00 AM"
                  : `Arriving by ${formattedTargetTime}`;
                let iconName = "skillet";
                let bannerColor = "bg-amber-50 border-amber-200/80 text-amber-950";
                let iconColor = "bg-amber-500/20 text-amber-800";

                if (isDelivered) {
                  badgeText = "Order Completed";
                  mainHeading = "Delivered Fresh";
                  subHeading = "Delivered directly to your kitchen";
                  iconName = "check_circle";
                  bannerColor = "bg-emerald-50 border-emerald-200 text-emerald-950";
                  iconColor = "bg-emerald-500/20 text-emerald-800";
                } else if (isNearDoorstep) {
                  badgeText = "Rider in Neighborhood";
                  mainHeading = "Arriving in ~5 min";
                  subHeading = "Keep your 4-digit doorstep delivery code ready";
                  iconName = "near_me";
                  bannerColor = "bg-orange-50 border-orange-300 text-orange-950";
                  iconColor = "bg-orange-500 text-white animate-bounce";
                } else if (isOutForDelivery) {
                  badgeText = "Rider on the Road";
                  mainHeading = `Arriving in ${transitMins} min`;
                  subHeading = `Dispatched fresh from ${trackingOrder.storeName || "TeFFe's — Doranda Hub"}`;
                  iconName = "two_wheeler";
                  bannerColor = "bg-sky-50 border-sky-200 text-sky-950";
                  iconColor = "bg-sky-500/20 text-sky-800";
                } else if (status === "Cutting") {
                  badgeText = "Live Cutting Station";
                  mainHeading = isNextDayOrder ? "Scheduled for Tomorrow" : `Arriving by ${formattedTargetTime}`;
                  subHeading = isNextDayOrder ? "Order confirmed • Fresh cuts prepared tomorrow morning" : "Store team slicing & packing your fresh cuts";
                  iconName = "content_cut";
                } else if (status === "Ready") {
                  badgeText = "Packed & Ready";
                  mainHeading = isNextDayOrder ? "Scheduled for Tomorrow" : `Arriving by ${formattedTargetTime}`;
                  subHeading = isNextDayOrder ? "Scheduled: Tomorrow by 09:00 AM" : "Insulated fresh pack assigned to delivery rider";
                  iconName = "inventory_2";
                }

                return (
                  <div className={`rounded-2xl p-4 border flex items-center justify-between shadow-2xs ${bannerColor}`}>
                    <div>
                      <span className="text-[11px] font-extrabold uppercase tracking-wider block opacity-80">
                        {badgeText}
                      </span>
                      <span className="font-headline-md font-black text-2xl tracking-tight block mt-0.5">
                        {mainHeading}
                      </span>
                      <span className="text-xs opacity-90 block mt-1 font-medium">
                        {subHeading}
                      </span>
                      {(trackingOrder.createdByType === "self_store_admin" || trackingOrder.orderSource === "store_direct") && (
                        <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-black/10 text-[10.5px] font-bold">
                          <span className="material-symbols-outlined text-[13px]">storefront</span>
                          Direct Store Order • Placed via Store
                        </span>
                      )}
                    </div>

                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${iconColor}`}>
                      <span className="material-symbols-outlined text-[28px]">
                        {iconName}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* 4-Digit Doorstep Delivery OTP Banner */}
              {trackingOrder.deliveryOtp && !["Delivered", "Cancelled"].includes(trackingOrder.status || trackingOrder.rawOrder?.status) && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border-2 border-dashed border-amber-300 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[22px]">pin</span>
                    </div>
                    <div>
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900 block">
                        Doorstep Delivery Code
                      </span>
                      <span className="text-[11.5px] text-amber-800 font-medium">
                        Share this 4-digit OTP with your rider upon arrival
                      </span>
                    </div>
                  </div>
                  <div className="bg-white px-3.5 py-1.5 rounded-xl border border-amber-300 shadow-xs font-mono font-black text-xl tracking-widest text-primary">
                    {trackingOrder.deliveryOtp}
                  </div>
                </div>
              )}

              {/* Google Live Map vs Dark Store Preparation Card */}
              {(trackingOrder.status === "Cancelled" || trackingOrder.rawOrder?.status === "Cancelled") ? (
                <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center">
                  <span className="material-symbols-outlined text-red-600 text-[36px] mb-2">cancel</span>
                  <h4 className="font-headline-sm font-black text-gray-900 text-base">Order Cancelled</h4>
                  <p className="text-xs text-slate-600 mt-1">This order was cancelled and inventory has been restocked.</p>
                </div>
              ) : trackingOrder.rider?.name && ["Ready", "Out for Delivery"].includes(trackingOrder.status || trackingOrder.rawOrder?.status) ? (
                <GoogleLiveMap
                  riderLat={liveRiderCoords?.lat || trackingOrder.rider?.lat || 23.3512}
                  riderLng={liveRiderCoords?.lng || trackingOrder.rider?.lng || 85.3154}
                  riderName={trackingOrder.rider?.name || "Delivery Partner"}
                  storeName={trackingOrder.storeName || "TeFFe's — Doranda Hub"}
                  storeLat={trackingOrder.storeLat || 23.3441}
                  storeLng={trackingOrder.storeLng || 85.3096}
                  customerLat={trackingOrder.customerLat || trackingOrder.customer?.lat || 23.3512}
                  customerLng={trackingOrder.customerLng || trackingOrder.customer?.lng || 85.3154}
                  customerAddress={trackingOrder.customerAddress || trackingOrder.customer?.address || "Your Kitchen"}
                  orderStatus={trackingOrder.status || trackingOrder.rawOrder?.status || "Out for Delivery"}
                  className="h-52 w-full rounded-2xl overflow-hidden shadow-inner"
                />
              ) : (
                <div className="p-5 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-900 shrink-0">
                      <span className="material-symbols-outlined text-[22px]">
                        {(trackingOrder.status === "Cutting" || trackingOrder.rawOrder?.status === "Cutting") ? "content_cut" : "storefront"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-headline-sm font-extrabold text-gray-900 text-sm">
                          {(trackingOrder.status === "Cutting" || trackingOrder.rawOrder?.status === "Cutting") ? "Fresh Meat Cutting in Progress" : "Order Verified at Teffe's Store"}
                        </h4>

                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {trackingOrder.storeName || "TeFFe's — Doranda Hub"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-white/80 rounded-xl border border-amber-100 text-[11.5px] text-slate-600 flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-[16px] shrink-0 mt-0.5">info</span>
                    <span>
                      {(trackingOrder.status === "Cutting" || trackingOrder.rawOrder?.status === "Cutting")
                        ? "Fresh cuts are being prepared on a sanitized cutting block. Live tracking will activate once meat is packed and dispatched to your delivery partner."
                        : "Your order is confirmed at the store. Cutting and packing will begin shortly, followed by delivery partner assignment."}
                    </span>
                  </div>
                </div>
              )}

              {/* Ordered Items Summary */}
              {trackingOrder.items && trackingOrder.items.length > 0 && (
                <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-800">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-primary">shopping_basket</span>
                      <span>Ordered Meat Items ({trackingOrder.items.length})</span>
                    </span>
                    <span className="text-primary font-black">₹{trackingOrder.amount}</span>
                  </div>
                  <div className="divide-y divide-gray-200/60 max-h-32 overflow-y-auto">
                    {trackingOrder.items.map((it: any, idx: number) => (
                      <div key={idx} className="py-1.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-gray-900 block">{it.name}</span>
                          <span className="text-[10.5px] text-slate-500">
                            {it.netWeight || "500g"} • Qty: {it.quantity || 1}
                          </span>
                        </div>
                        <span className="font-extrabold text-gray-900">₹{(it.price || 0) * (it.quantity || 1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rider Details Card */}
              {trackingOrder.rider?.name && ["Ready", "Out for Delivery", "Delivered"].includes(trackingOrder.status || trackingOrder.rawOrder?.status) ? (
                <div className="bg-white rounded-2xl border border-gray-200/90 p-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                        <span className="material-symbols-outlined text-[26px]">two_wheeler</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-headline-sm font-extrabold text-gray-900 text-sm">
                            {trackingOrder.rider.name}
                          </h4>
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-flex items-center gap-0.5">
                            <span>{(trackingOrder.rider?.rating || "4.9").toString().replace("★", "").trim()}</span>
                            <span className="material-symbols-outlined text-[12px] fill-current text-amber-500">star</span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          {trackingOrder.rider?.vehicle || "Insulated Cold Box (Fleet)"}
                        </p>
                      </div>
                    </div>

                    {trackingOrder.rider?.phone && (
                      <a
                        href={`tel:${trackingOrder.rider.phone}`}
                        className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-sm text-decoration-none shrink-0"
                        title="Call Rider"
                      >
                        <span className="material-symbols-outlined text-[20px]">call</span>
                      </a>
                    )}
                  </div>

                  {/* Fresh-Lock Hygiene Guarantee */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-[16px]">local_shipping</span>
                      <span>Packaging: <strong>{trackingOrder.rider?.bagTemp || "Fresh-Lock Insulated"}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                      <span>100% Chilled Dispatch</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200/90 p-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-lg shrink-0">
                        <span className="material-symbols-outlined text-[26px]">two_wheeler</span>
                      </div>
                      <div>
                        <h4 className="font-headline-sm font-extrabold text-gray-900 text-sm">
                          Delivery Fleet Partner
                        </h4>
                        <p className="text-xs text-amber-800 font-medium mt-0.5">
                          Will be assigned after cutting and packing is completed
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                      Awaiting Dispatch
                    </span>
                  </div>
                </div>
              )}

              {/* Dynamic Real-Time Order Milestones Timeline */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-headline-sm font-bold text-xs uppercase tracking-wider text-gray-700">
                    Order Milestones
                  </h5>
                  <span className="text-[10.5px] font-bold text-emerald-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Sync
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Step 1: Order Placed vs Confirmed */}
                  {(() => {
                    const st = trackingOrder.status || trackingOrder.rawOrder?.status || "Placed";
                    const isConfirmed = ["Cutting", "Ready", "Out for Delivery", "Delivered"].includes(st);
                    return (
                      <div className="flex items-start gap-2.5">
                        <span className={`material-symbols-outlined text-[18px] shrink-0 ${isConfirmed ? "text-emerald-600" : "text-amber-600"}`}>
                          {isConfirmed ? "check_circle" : "radio_button_checked"}
                        </span>
                        <div>
                          <span className="font-bold text-gray-900 block">
                            {isConfirmed ? "Order Confirmed" : "Order Placed at Teffes"}
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            {isConfirmed ? "Verified by Teffes store manager" : "Sent to Teffes store team"}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Step 2: Fresh Meat Cut & Packed */}
                  {(() => {
                    const st = trackingOrder.status || trackingOrder.rawOrder?.status || "Placed";
                    const isCutting = st === "Cutting";
                    const isDone = ["Ready", "Out for Delivery", "Delivered"].includes(st);
                    return (
                      <div className={`flex items-start gap-2.5 ${!isCutting && !isDone ? "opacity-50" : ""}`}>
                        <span
                          className={`material-symbols-outlined text-[18px] shrink-0 ${isDone ? "text-emerald-600" : isCutting ? "text-amber-600 animate-spin" : "text-slate-400"
                            }`}
                        >
                          {isDone ? "check_circle" : isCutting ? "sync" : "radio_button_unchecked"}
                        </span>
                        <div>
                          <span className={`font-bold block ${isCutting ? "text-amber-900" : "text-gray-900"}`}>
                            {isCutting ? "Fresh Meat Cutting in Progress" : "Fresh Meat Cut & Packed"}
                          </span>
                          <span className={`text-[11px] ${isCutting ? "text-amber-800" : "text-slate-500"}`}>
                            {isCutting
                              ? "Clean cutting on sanitized cutting block in progress"
                              : isDone
                                ? "Cleanly cut upon order & sealed fresh"
                                : "Next up: Order preparation"}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Step 3: Out for Express Delivery */}
                  {(() => {
                    const st = trackingOrder.status || trackingOrder.rawOrder?.status || "Placed";
                    const isDelivering = st === "Out for Delivery";
                    const isDone = st === "Delivered";
                    return (
                      <div className={`flex items-start gap-2.5 ${!isDelivering && !isDone ? "opacity-50" : ""}`}>
                        <span
                          className={`material-symbols-outlined text-[18px] shrink-0 ${isDone ? "text-emerald-600" : isDelivering ? "text-amber-600 animate-spin" : "text-slate-400"
                            }`}
                        >
                          {isDone ? "check_circle" : isDelivering ? "sync" : "radio_button_unchecked"}
                        </span>
                        <div>
                          <span className={`font-bold block ${isDelivering ? "text-amber-900" : "text-gray-900"}`}>
                            Out for Express Delivery
                          </span>
                          <span className={`text-[11px] ${isDelivering ? "text-amber-800" : "text-slate-500"}`}>
                            {isDelivering
                              ? (trackingOrder.remainingTransitMinutes != null && trackingOrder.remainingTransitMinutes <= 5
                                ? "Rider in neighborhood with insulated box"
                                : `Rider is on the way (arriving in ${trackingOrder.remainingTransitMinutes ?? 10} min)`)
                              : isDone
                                ? "Dispatched & safely reached your address"
                                : `Assigned to delivery fleet from ${trackingOrder.storeName || "TeFFe's — Doranda Hub"}`}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Step 4: Delivered to Doorstep */}
                  {(() => {
                    const isDelivered = (trackingOrder.status === "Delivered" || trackingOrder.rawOrder?.status === "Delivered");
                    const isNextDayOrder = Boolean(
                      (trackingOrder.deliverySlot && (trackingOrder.deliverySlot.toLowerCase().includes("tomorrow") || trackingOrder.deliverySlot.toLowerCase().includes("next-day") || trackingOrder.deliverySlot.toLowerCase().includes("9:00 am"))) ||
                      (trackingOrder.targetDeliveryTime && new Date(trackingOrder.targetDeliveryTime).getDate() !== new Date(trackingOrder.createdAt || Date.now()).getDate())
                    );
                    return (
                      <div className={`flex items-start gap-2.5 ${!isDelivered ? "opacity-50" : ""}`}>
                        <span
                          className={`material-symbols-outlined text-[18px] shrink-0 ${isDelivered ? "text-emerald-600" : "text-slate-400"
                            }`}
                        >
                          {isDelivered ? "check_circle" : "radio_button_unchecked"}
                        </span>
                        <div>
                          <span className={`font-bold block ${isDelivered ? "text-emerald-700" : "text-gray-900"}`}>Delivered to Doorstep</span>
                          <span className={`text-[11px] ${isDelivered ? "text-emerald-600 font-medium" : "text-slate-500"}`}>
                            {isDelivered
                              ? "Handed over fresh & verified"
                              : isNextDayOrder
                                ? "Scheduled: Tomorrow by 09:00 AM"
                                : trackingOrder.targetDeliveryTime
                                  ? `Arriving by ${new Date(trackingOrder.targetDeliveryTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`
                                  : "Temperature-controlled doorstep delivery"}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Payable: <strong>₹{trackingOrder.amount}</strong> ({trackingOrder.paymentMethod || "Cash On Delivery"})
              </span>
              <div className="flex items-center gap-2">
                {["Placed", "Pending", "Confirmed", "Cutting"].includes(trackingOrder.status || trackingOrder.rawOrder?.status) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCancelModalOrderId(trackingOrder.id || trackingOrder.orderId);
                      setCancelFeedback(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-white border border-red-200 hover:bg-red-50 text-red-700 font-headline-sm font-bold text-xs cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px] text-red-600">cancel</span>
                    <span>Cancel Order</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setTrackingOrder(null)}
                  className="px-5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-headline-sm font-bold text-xs border-none cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ─── ADD BALANCE MODAL ───────────────────────────────────────── */}
      {isAddBalanceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAddBalanceModal();
          }}
        >
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in-up border border-gray-100">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">account_balance_wallet</span>
                </div>
                <div>
                  <h3 className="font-headline-sm font-extrabold text-gray-900 text-sm sm:text-base leading-tight">
                    Add Teffe's Cash
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Current Balance: <strong className="text-gray-900">₹{teffesCash}</strong>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAddBalanceModal}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200/80 hover:bg-gray-300 text-gray-700 transition-colors border-none cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6">
              {/* Inline Feedback Banner */}
              {rechargeFeedback && (
                <div
                  className={`p-3 rounded-2xl mb-4 flex items-center gap-2.5 text-xs font-bold animate-fade-in ${rechargeFeedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                    }`}
                >
                  <span className="material-symbols-outlined text-[18px] shrink-0">
                    {rechargeFeedback.type === "success" ? "check_circle" : "error"}
                  </span>
                  <span>{rechargeFeedback.message}</span>
                </div>
              )}

              <form onSubmit={handleAddBalanceSubmit} className="space-y-4">
                {/* Amount Input */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Amount to Add (₹)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 font-black text-gray-500 text-base">₹</span>
                    <input
                      type="number"
                      value={balanceInput}
                      onChange={(e) => {
                        setBalanceInput(e.target.value);
                        if (rechargeFeedback) setRechargeFeedback(null);
                      }}
                      placeholder="e.g. 500"
                      min="1"
                      className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-base font-extrabold text-gray-900 transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Quick Amount Chips */}
                <div>
                  <span className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                    Quick Amounts
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[100, 200, 500, 1000, 2000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setBalanceInput(amt.toString());
                          if (rechargeFeedback) setRechargeFeedback(null);
                        }}
                        className={`flex-1 min-w-[65px] py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${balanceInput === amt.toString()
                          ? "bg-primary text-white border-primary shadow-xs"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:border-primary hover:text-primary"
                          }`}
                      >
                        +₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Option */}
                <div>
                  <span className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                    Payment Gateway
                  </span>
                  {(!paymentSettings.onlineEnabled || !paymentSettings.payuConfigured) && (
                    <div className="p-3 mb-2 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-800 font-semibold">
                      <span className="material-symbols-outlined text-[18px] shrink-0">warning</span>
                      <span>
                        {!paymentSettings.onlineEnabled
                          ? "Online payment is currently paused by store admin."
                          : "PayU is not configured by admin."}
                      </span>
                    </div>
                  )}
                  <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                    (!paymentSettings.onlineEnabled || !paymentSettings.payuConfigured)
                      ? "border-gray-200 bg-gray-50 opacity-60"
                      : "border-primary/30 bg-primary/5"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        (!paymentSettings.onlineEnabled || !paymentSettings.payuConfigured) ? "bg-gray-300 text-gray-500" : "bg-primary text-white"
                      }`}>
                        <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 text-xs sm:text-sm block">
                          UPI, Cards &amp; NetBanking (PayU)
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          {(!paymentSettings.onlineEnabled || !paymentSettings.payuConfigured)
                            ? "Gateway currently unavailable"
                            : "Instant bank verification & 256-bit encrypted checkout"}
                        </span>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      (!paymentSettings.onlineEnabled || !paymentSettings.payuConfigured) ? "border-gray-300" : "border-primary"
                    }`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        (!paymentSettings.onlineEnabled || !paymentSettings.payuConfigured) ? "bg-gray-300" : "bg-primary"
                      }`} />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={closeAddBalanceModal}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm rounded-xl transition-colors cursor-pointer border-none whitespace-nowrap"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRecharging || !paymentSettings.onlineEnabled || !paymentSettings.payuConfigured || !balanceInput || isNaN(Number(balanceInput)) || Number(balanceInput) <= 0}
                    className="flex-1 py-3 px-4 bg-[#91000a] hover:bg-[#7a0008] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none text-white font-medium text-sm rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    {isRecharging ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Connecting to PayU...</span>
                      </>
                    ) : (!balanceInput || isNaN(Number(balanceInput)) || Number(balanceInput) <= 0) ? (
                      <span>Enter Amount</span>
                    ) : (
                      <>
                        <span>Proceed to Pay</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── RETURN / EXCHANGE REQUEST MODAL ─────────────────────────── */}
      {returnModalOrderId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseReturnModal();
          }}
        >
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in-up border border-gray-100">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">published_with_changes</span>
                </div>
                <div>
                  <h3 className="font-headline-sm font-extrabold text-gray-900 text-sm sm:text-base leading-tight">
                    Request Return / Exchange
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Order ID: {returnModalOrderId}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseReturnModal}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200/80 hover:bg-gray-300 text-gray-700 transition-colors border-none cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-5 sm:p-6">
              {returnFeedback && (
                <div
                  className={`p-3 rounded-2xl mb-4 flex items-center gap-2.5 text-xs font-bold animate-fade-in ${returnFeedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                    }`}
                >
                  <span className="material-symbols-outlined text-[18px] shrink-0">
                    {returnFeedback.type === "success" ? "check_circle" : "error"}
                  </span>
                  <span>{returnFeedback.message}</span>
                </div>
              )}

              <form onSubmit={handleSubmitReturnRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Reason for Exchange / Return *
                  </label>
                  <div className="space-y-2 mb-3">
                    {[
                      "Quality / Freshness concern",
                      "Incorrect cut / portion received",
                      "Packaging damaged / broken seal",
                      "Weight discrepancy",
                    ].map((reason) => (
                      <div
                        key={reason}
                        onClick={() => setReturnReasonInput(reason)}
                        className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all flex items-center justify-between ${returnReasonInput === reason
                          ? "bg-primary/5 border-primary text-primary"
                          : "bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300"
                          }`}
                      >
                        <span>{reason}</span>
                        {returnReasonInput === reason && (
                          <span className="material-symbols-outlined text-[16px]">check</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Additional Comments
                  </label>
                  <textarea
                    rows={3}
                    value={returnReasonInput}
                    onChange={(e) => setReturnReasonInput(e.target.value)}
                    placeholder="Provide any additional details for our store team..."
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-xs text-gray-900 resize-none font-medium"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={handleCloseReturnModal}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-headline-sm font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer border-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReturn}
                    className="flex-1 py-3 bg-[#91000a] hover:bg-[#7a0008] disabled:opacity-60 text-white font-headline-sm font-bold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer border-none flex items-center justify-center gap-2"
                  >
                    {isSubmittingReturn ? "Submitting..." : "Submit Exchange Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE ACCOUNT MODAL ────────────────────────────────────── */}
      {isDeleteModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDeleteModalOpen(false);
          }}
        >
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in-up border border-gray-100">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-red-600 text-3xl">warning</span>
              </div>
              <h3 className="font-headline-sm font-extrabold text-gray-900 mb-2">Delete Account?</h3>
              <p className="text-sm text-gray-500 mb-5">
                Are you sure you want to delete your Teffe's account? This action cannot be undone and you will lose all your wallet balance and order history.
              </p>

              {deleteAccountError && (
                <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-bold mb-4 border border-red-200">
                  {deleteAccountError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition-colors cursor-pointer border-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingAccount}
                  onClick={handleDeleteAccount}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold rounded-xl transition-colors cursor-pointer border-none"
                >
                  {isDeletingAccount ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── RIDER RATING MODAL ─────────────────────────────────────── */}
      {ratingModalOrder && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingRating) handleCloseRatingModal();
          }}
        >
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in-up border border-gray-100">
            <div className="p-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <span className="material-symbols-outlined text-[24px]">two_wheeler</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm font-extrabold text-gray-900 text-base">
                      Rate Delivery Partner
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Order #{ratingModalOrder.id || ratingModalOrder.orderId}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseRatingModal}
                  disabled={isSubmittingRating}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 border-none cursor-pointer bg-transparent transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <form onSubmit={handleSubmitRiderRating} className="mt-5 space-y-4">
                {/* Rider Info Card */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {(ratingModalOrder.rider?.name || "Rider").charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">
                        {ratingModalOrder.rider?.name || "Delivery Partner"}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {ratingModalOrder.rider?.vehicle || "Ranchi Fleet Partner"}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Delivered
                  </span>
                </div>

                {/* Interactive Star Rating */}
                <div className="text-center py-2">
                  <p className="text-xs font-semibold text-slate-600 mb-2">How was your delivery experience?</p>
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRiderRatingValue(star)}
                        className="p-1 hover:scale-125 transition-all bg-transparent border-none cursor-pointer"
                        title={`${star} Star`}
                      >
                        <span
                          className={`material-symbols-outlined text-[34px] ${star <= riderRatingValue ? "text-amber-400 fill-amber-400" : "text-gray-200"
                            }`}
                          style={{
                            fontVariationSettings: star <= riderRatingValue ? "'FILL' 1" : "'FILL' 0",
                          }}
                        >
                          star
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs font-bold text-amber-700 mt-1">
                    {riderRatingValue === 5 && "Excellent (5 Stars)"}
                    {riderRatingValue === 4 && "Very Good (4 Stars)"}
                    {riderRatingValue === 3 && "Average (3 Stars)"}
                    {riderRatingValue === 2 && "Poor (2 Stars)"}
                    {riderRatingValue === 1 && "Very Poor (1 Star)"}
                  </p>
                </div>

                {/* Quick Feedback Tags */}
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">Quick Highlights (Optional)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["On Time Delivery", "Polite & Professional", "Handled Meat Fresh", "Followed Directions", "Mask & Hygiene Valid"].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          if (riderRatingFeedback.includes(tag)) {
                            setRiderRatingFeedback((prev) => prev.replace(tag, "").replace(/,\s*,/, ",").trim());
                          } else {
                            setRiderRatingFeedback((prev) => (prev ? `${prev}, ${tag}` : tag));
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${riderRatingFeedback.includes(tag)
                          ? "bg-amber-100 text-amber-900 border-amber-300 font-bold"
                          : "bg-white text-slate-600 border-gray-200 hover:border-gray-300"
                          }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feedback Comment Box */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Write a note for the rider (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={riderRatingFeedback}
                    onChange={(e) => setRiderRatingFeedback(e.target.value)}
                    placeholder="Tell us what you liked or how we can improve..."
                    className="w-full p-2.5 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  />
                </div>

                {/* Modal Buttons */}
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={handleCloseRatingModal}
                    disabled={isSubmittingRating}
                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition-colors cursor-pointer border-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRating}
                    className="flex-1 py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer border-none flex items-center justify-center gap-1.5"
                  >
                    {isSubmittingRating ? "Submitting..." : "Submit Rating"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Confirmation Modal */}
      {cancelModalOrderId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <span className="material-symbols-outlined text-[28px]">cancel</span>
              </div>
              <div>
                <h3 className="font-headline-sm font-black text-gray-900 text-lg">
                  Cancel Order #{cancelModalOrderId}?
                </h3>
                <p className="text-xs text-slate-500">
                  Pre-dispatch cancellation
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to cancel this order? Any items will be restocked and prepaid amounts will be credited back immediately to your Teffes Cash wallet.
            </p>

            {cancelFeedback && (
              <div className={`p-3 rounded-xl text-xs font-bold ${cancelFeedback.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {cancelFeedback.message}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmittingCancel}
                onClick={() => { setCancelModalOrderId(null); setCancelFeedback(null); }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-headline-sm font-bold text-xs hover:bg-gray-50 transition-all cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={isSubmittingCancel}
                onClick={handleConfirmCancelOrder}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-headline-sm font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingCancel ? "Cancelling..." : "Yes, Cancel Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
