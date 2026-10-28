"use client";

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { getStoredUser, clearAuth } from "@/lib/auth";
import type { User } from "@/lib/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPowerOff,
  faRotate,
  faCheck,
  faXmark,
  faMotorcycle,
  faKey,
  faTrashCan,
  faTriangleExclamation,
  faClock,
  faBoxOpen,
} from "@fortawesome/free-solid-svg-icons";
import api from "@/lib/api";
import { toast } from "@/lib/toast";
import { getSocket } from "@/lib/socket";
import { orderAlarm } from "@/lib/orderAlarm";
import ThermalKOTModal from "@/components/store-admin/ThermalKOTModal";
import StoreStatusModal from "@/components/store-admin/StoreStatusModal";
import ChangePasswordModal from "@/components/common/ChangePasswordModal";

// ─── Sidebar tabs ─────────────────────────────────────────────────────────────
const TABS = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard", sub: "Live overview of today's orders, revenue, and inventory" },
  { key: "orders", label: "Live Orders", icon: "local_shipping", sub: "Manage today's orders from cutting to customer delivery" },
  { key: "products", label: "Products & Stock", icon: "restaurant", sub: "Toggle live availability of fresh cuts for your store" },
  { key: "cross_sell", label: "Cross-Selling", icon: "shopping_basket", sub: "Manage addon products shown to customers in cart" },
  { key: "inventory", label: "Inventory", icon: "inventory_2", sub: "Track fresh stock levels and morning fresh batches" },
  { key: "customers", label: "Customers", icon: "group", sub: "Directory of customers who ordered from your store" },
  { key: "riders", label: "Riders & Dispatch", icon: "two_wheeler", sub: "Assign ready orders to available delivery partners" },
  { key: "returns", label: "Returns & Exchange", icon: "swap_horiz", sub: "Process customer exchange requests under the 60-minute policy" },
];

// Helper to extract specific hour slot (e.g., '07:00 AM – 09:00 AM') while omitting generic on-demand labels
const getSpecificDeliverySlot = (slot?: string) => {
  if (!slot || typeof slot !== "string") return null;
  const s = slot.trim();
  const isGeneric = /^\s*(60\s*min|90\s*min|express|standard|home\s*delivery|store\s*pickup|pickup)\b/i.test(s) && !/(am|pm|\d{1,2}:\d{2})/i.test(s);
  if (isGeneric) return null;
  if (/(am|pm|\d{1,2}:\d{2}|\d{1,2}\s*(am|pm)?\s*[-–—to]\s*\d{1,2}\s*(am|pm))/i.test(s)) {
    return s;
  }
  return null;
};

// ─── Reusable UI pieces ────────────────────────────────────────────────────────
const KPICard = ({
  icon,
  label,
  value,
  sub,
  color = "#941717",
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  color?: string;
  onClick?: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);

  // Helper to extract clean trend (e.g., "↑ 18%")
  const trendMatch = sub.match(/^[↑↓]\s*[\d.]+%?/);
  const trend = trendMatch ? trendMatch[0] : null;
  const cleanSub = trend ? sub.replace(trend, "").trim() : sub;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setActive(false);
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        position: "relative",
        background: "linear-gradient(145deg, #ffffff 0%, #fcfaf7 100%)",
        borderRadius: "16px",
        padding: "14px 16px",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        outline: "none",
        transform: active
          ? "translateY(2px) scale(0.985)"
          : hovered
            ? "translateY(-4px) scale(1.015)"
            : "translateY(0) scale(1)",
        boxShadow: hovered
          ? `0 16px 28px -6px ${color}24, 0 8px 14px -4px rgba(0,0,0,0.05), inset 2px 2px 4px rgba(255,255,255,0.95), inset -2px -2px 6px rgba(0,0,0,0.03)`
          : `0 8px 18px -6px rgba(0,0,0,0.05), 0 3px 8px -2px rgba(0,0,0,0.03), inset 2px 2px 4px rgba(255,255,255,0.95), inset -2px -2px 6px rgba(0,0,0,0.03)`,
        border: `1.5px solid ${hovered ? color + "45" : "#ede8e0"}`,
        transition: "all 240ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "112px",
      }}
    >
      {/* Top decorative accent pill */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: `linear-gradient(90deg, ${color} 0%, ${color}60 100%)`,
          opacity: hovered ? 1 : 0.75,
          transition: "opacity 200ms ease",
        }}
      />

      {/* Decorative Faint Watermark Icon in background right corner */}
      <div
        style={{
          position: "absolute",
          right: "-6px",
          bottom: "-10px",
          color,
          opacity: hovered ? 0.08 : 0.035,
          pointerEvents: "none",
          userSelect: "none",
          transform: hovered ? "scale(1.1) rotate(-5deg)" : "scale(1) rotate(0deg)",
          transition: "all 300ms ease",
        }}
      >
        <span className="material-symbols-outlined text-[72px]">{icon}</span>
      </div>

      {/* Header Row: Left Icon Pod + Right Big Metric Value */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "10px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Left: Clay Icon Pod */}
        <div
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "11px",
            background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `inset 2px 2px 4px rgba(255,255,255,0.8), inset -2px -2px 4px ${color}20`,
            border: `1px solid ${color}30`,
            transform: hovered ? "scale(1.08) rotate(3deg)" : "scale(1) rotate(0deg)",
            transition: "transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ color, display: "block", lineHeight: 1 }}
          >
            {icon}
          </span>
        </div>

        {/* Right: Big Metric Value */}
        <div
          style={{
            textAlign: "right",
            fontSize: "1.45rem",
            fontWeight: 800,
            color,
            fontFamily: "Outfit, sans-serif",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          {value}
        </div>
      </div>

      {/* Bottom Content: Metric Label + Trend & Subtext */}
      <div style={{ position: "relative", zIndex: 1, marginTop: "auto" }}>
        <div
          style={{
            fontSize: "0.82rem",
            fontWeight: 700,
            color: "#2b251e",
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={label}
        >
          {label}
        </div>

        {/* Subtext info with optional trend chip */}
        <div
          style={{
            fontSize: "0.7rem",
            color: "#73695b",
            marginTop: "3px",
            fontWeight: 500,
            lineHeight: 1.3,
            display: "flex",
            alignItems: "center",
            flexWrap: "nowrap",
            gap: "4px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={sub}
        >
          {trend && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "1px 5px",
                borderRadius: "5px",
                fontSize: "0.66rem",
                fontWeight: 700,
                background: trend.startsWith("↑") ? "#ecfdf5" : "#fef2f2",
                color: trend.startsWith("↑") ? "#059669" : "#dc2626",
                border: `1px solid ${trend.startsWith("↑") ? "#a7f3d0" : "#fecaca"}`,
                flexShrink: 0,
              }}
            >
              {trend}
            </span>
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {cleanSub}
          </span>
        </div>
      </div>
    </div>
  );
};

const SectionTitle = ({ title, sub }: { title: string; sub?: string }) => (
  <div style={{ margin: "20px 0 12px 0" }}>
    <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#171410", margin: 0 }}>{title}</h2>
    {sub && <p style={{ color: "#73695b", fontSize: "0.78rem", marginTop: "2px" }}>{sub}</p>}
  </div>
);

const Badge = ({ label, color }: { label: string; color: string }) => (
  <span style={{
    background: color + "20",
    color,
    fontSize: "0.72rem",
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: "99px",
    border: `1px solid ${color}40`,
    whiteSpace: "nowrap",
  }}>{label}</span>
);

const OrderStatusPipeline = ({ status }: { status: string }) => {
  const stages = ["Pending", "Cutting", "Ready", "Out for Delivery", "Delivered"];
  const idx = stages.indexOf(status);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
      {stages.map((s, i) => (
        <React.Fragment key={s}>
          <div style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: "99px",
            background: i <= idx ? "#941717" : "#ede8e0",
            color: i <= idx ? "#fff" : "#73695b",
          }}>{s}</div>
          {i < stages.length - 1 && <span style={{ color: "#ede8e0", fontSize: "0.7rem" }}>→</span>}
        </React.Fragment>
      ))}
    </div>
  );
};

const FileUploadButton = ({
  onUploadSuccess,
  folder = "cross-sell",
  label = "Upload Image",
  accept = "image/*",
  style,
}: {
  onUploadSuccess: (url: string) => void;
  folder?: string;
  label?: string;
  accept?: string;
  style?: React.CSSProperties;
}) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    try {
      let finalUrl = "";

      // 1. Primary: Try standard API endpoint which stores to Firebase Storage via storageService
      try {
        const res = await api.post<{ success: boolean; url: string }>("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        if (res.data?.success && res.data.url) {
          finalUrl = res.data.url;
        }
      } catch (primaryErr: any) {
        // Fallback 1: Local backend fallback if remote is not reachable
        if (
          primaryErr.response?.status === 404 ||
          primaryErr.response?.data?.message?.includes("not found") ||
          primaryErr.code === "ERR_NETWORK"
        ) {
          try {
            const localRes = await axios.post<{ success: boolean; url: string }>("http://localhost:5000/api/upload", formData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
            if (localRes.data?.success && localRes.data.url) {
              finalUrl = localRes.data.url;
            }
          } catch (localErr: any) {
            console.warn("[Upload] Local backend fallback failed, attempting direct Firebase Storage...", localErr);
          }
        }

        // Fallback 2: Direct browser upload to Firebase Storage
        if (!finalUrl) {
          try {
            const { getStorage, ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
            const { firebaseApp } = await import("@/lib/firebase");
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
            const storageRef = ref(getStorage(firebaseApp), `${folder}/${Date.now()}-${safeName}`);
            const snapshot = await uploadBytes(storageRef, file);
            finalUrl = await getDownloadURL(snapshot.ref);
          } catch (fbErr: any) {
            console.warn("[Upload] Direct Firebase Storage upload failed:", fbErr);
          }
        }

        if (!finalUrl) {
          throw primaryErr;
        }
      }

      if (finalUrl) {
        onUploadSuccess(finalUrl);
        toast.success("Image uploaded to Firebase Storage successfully!", "Upload Complete");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Upload failed. Please try again.", "Upload Error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        style={{ display: "none" }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: "#941717",
          border: "none",
          borderRadius: "8px",
          padding: "7px 14px",
          fontSize: "0.8rem",
          fontWeight: 700,
          color: "#fff",
          cursor: uploading ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
          boxShadow: "0 2px 6px rgba(148, 23, 23, 0.2)",
          flexShrink: 0,
          ...style,
        }}
      >
        <span className="material-symbols-outlined text-[16px]">
          {uploading ? "sync" : "cloud_upload"}
        </span>
        <span>{uploading ? "Uploading to Firebase..." : label}</span>
      </button>
    </>
  );
};

// ─── Tab Panels ───────────────────────────────────────────────────────────────

let cachedStoreDashboardData: { kpis: any[]; latestOrders: any[] } | null = null;

function DashboardTab({ setActiveTab }: { setActiveTab: (t: string) => void }) {
  const [kpis, setKpis] = useState<any[]>(cachedStoreDashboardData?.kpis || []);
  const [latestOrders, setLatestOrders] = useState<any[]>(cachedStoreDashboardData?.latestOrders || []);
  const [loading, setLoading] = useState(!cachedStoreDashboardData);

  const loadData = () => {
    if (!cachedStoreDashboardData) {
      setLoading(true);
    }
    api.get<{ success: boolean; kpis: any[]; latestOrders: any[] }>("/store-admin/dashboard")
      .then(res => {
        if (res.data.success) {
          const freshKpis = res.data.kpis || [];
          const freshOrders = res.data.latestOrders || [];
          cachedStoreDashboardData = { kpis: freshKpis, latestOrders: freshOrders };
          setKpis(freshKpis);
          setLatestOrders(freshOrders);
        }
      })
      .catch(err => console.warn("Failed to load store-admin dashboard:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    const socket = getSocket();
    const handleUpdate = () => {
      loadData();
    };
    socket.on("orders:refreshed", handleUpdate);
    socket.on("order:created", handleUpdate);
    socket.on("inventory:updated", handleUpdate);
    return () => {
      socket.off("orders:refreshed", handleUpdate);
      socket.off("order:created", handleUpdate);
      socket.off("inventory:updated", handleUpdate);
    };
  }, []);

  const placeholderKpis = [
    { icon: "inventory_2", label: "Orders to Prepare", value: "—", sub: "Awaiting cutting or dispatch", color: "#941717", tab: "orders" },
    { icon: "check_circle", label: "Delivered Today", value: "—", sub: "Successfully completed", color: "#059669", tab: "orders" },
    { icon: "restaurant", label: "Chicken Stock", value: "—", sub: "Fresh stock available", color: "#7c3aed", tab: "inventory" },
    { icon: "kebab_dining", label: "Mutton Stock", value: "—", sub: "Young goat — fresh batch", color: "#d97706", tab: "inventory" },
    { icon: "two_wheeler", label: "Active Riders", value: "—", sub: "Available in Ranchi", color: "#0284c7", tab: "riders" },
  ];

  const displayKpis = kpis.length > 0 ? kpis : placeholderKpis;

  const labelToTab: Record<string, string> = {
    "Pending Orders": "orders",
    "Orders to Prepare": "orders",
    "Delivered Today": "orders",
    "Today's Revenue": "orders",
    "Chicken Stock": "inventory",
    "Mutton Stock": "inventory",
    "Active Riders": "riders",
  };

  return (
    <div>
      {/* Responsive Grid: 6 cards in 1 row on wide screens, 3-3 on laptops, 2-2-2 on tablets */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
        style={{
          gap: "14px",
          marginBottom: "32px",
        }}
      >
        {displayKpis.map(k => {
          // Explicitly map Active Riders to 'riders' tab even if remote backend sends 'slots'
          const targetTab = labelToTab[k.label] || (k.tab === "slots" ? "riders" : k.tab);
          return (
            <KPICard
              key={k.label}
              {...k}
              onClick={targetTab ? () => setActiveTab(targetTab) : undefined}
            />
          );
        })}
      </div>

      {/* Live order summary mini-list */}
      <SectionTitle title="Latest Incoming Orders" sub="Live queue from Cloud Firestore" />
      <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#73695b" }}>Loading live orders from server…</div>
        ) : latestOrders.length === 0 ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#73695b" }}>No active orders in queue</div>
        ) : (
          latestOrders.map((o, i, arr) => (
            <div key={o.orderId || o.id} style={{
              padding: "16px 20px",
              borderBottom: i < arr.length - 1 ? "1px solid #ede8e0" : "none",
              display: "flex",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
            }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <div style={{ fontWeight: 700, color: "#171410", fontSize: "0.9rem" }}>#{o.orderId || o.id} — {o.customer?.name}</div>
                <div style={{ color: "#73695b", fontSize: "0.8rem", marginTop: "2px" }}>
                  {o.itemSummary || o.items?.map((item: any) => `${item.name} ×${item.quantity}`).join(", ")}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, color: "#941717", fontSize: "1rem" }}>₹{o.amount}</div>
                <div style={{ color: "#73695b", fontSize: "0.75rem" }}>{o.deliverySlot}</div>
              </div>
              <Badge label={o.status} color={
                o.status === "Pending" ? "#941717" : o.status === "Cutting" ? "#d97706" : o.status === "Delivered" ? "#059669" : "#7c3aed"
              } />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LiveOrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [printModalOrder, setPrintModalOrder] = useState<any>(null);

  const fetchOrders = () => {
    setLoading(true);
    const q = filter === "All" ? "" : `?status=${filter}`;
    api.get<{ success: boolean; orders: any[] }>(`/store-admin/orders${q}`)
      .then(res => {
        if (res.data.success) {
          setOrders(res.data.orders || []);
        }
      })
      .catch(err => console.warn("Failed to fetch store orders:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  useEffect(() => {
    const socket = getSocket();
    const handleRefresh = () => {
      fetchOrders();
    };
    socket.on("orders:refreshed", handleRefresh);
    socket.on("order:created", handleRefresh);
    return () => {
      socket.off("orders:refreshed", handleRefresh);
      socket.off("order:created", handleRefresh);
    };
  }, [filter]);

  const advanceStatus = async (orderId: string, currentStatus: string, isPickup: boolean = false) => {
    let next = "";
    if (isPickup) {
      const pickupMap: Record<string, string> = {
        "Pending": "Cutting",
        "Cutting": "Ready",
        "Ready": "Delivered", // Customer collected order at store counter
      };
      next = pickupMap[currentStatus];
    } else {
      const nextMap: Record<string, string> = {
        "Pending": "Cutting",
        "Cutting": "Ready",
        "Ready": "Out for Delivery",
        "Out for Delivery": "Delivered",
      };
      next = nextMap[currentStatus];
    }
    if (!next) return;

    try {
      await api.patch(`/store-admin/orders/${orderId}/status`, { status: next });
      toast.success(`Order advanced to: ${next}`, "Order Updated");
      fetchOrders();
    } catch (err) {
      toast.error("Failed to advance order status", "Order Error");
    }
  };

  const getNextStatusLabel = (status: string, isPickup: boolean = false) => {
    if (isPickup) {
      const pickupLabels: Record<string, string> = {
        "Pending": "Mark Cutting",
        "Cutting": "Mark Ready for Pickup",
        "Ready": "Mark Customer Picked Up",
      };
      return pickupLabels[status];
    }
    const deliveryLabels: Record<string, string> = {
      "Pending": "Mark Cutting",
      "Cutting": "Mark Ready",
      "Ready": "Out for Delivery",
      "Out for Delivery": "Mark Delivered",
    };
    return deliveryLabels[status];
  };

  const handleDelayPrep = async (orderId: string) => {
    toast.confirm({
      title: "Add Rush Delay?",
      message: "Add +10 minutes rush preparation delay for this order?\n\nThe customer's arrival time will automatically be extended and updated in real-time.",
      confirmText: "Add +10 Mins",
      type: "warning",
      onConfirm: async () => {
        try {
          await api.post(`/store-admin/orders/${orderId}/delay-prep`, { extraMinutes: 10 });
          toast.success("Prep time extended by 10 minutes", "Delay Added");
          fetchOrders();
        } catch (err: any) {
          toast.error(err.response?.data?.message || "Failed to extend prep time", "Delay Error");
        }
      },
    });
  };

  return (
    <div>
      {/* Status filter pills */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {["All", "Pending", "Cutting", "Ready", "Out for Delivery", "Delivered"].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: "6px 14px", borderRadius: "99px", border: "1.5px solid #ede8e0",
              background: filter === s ? "#941717" : "#fff", color: filter === s ? "#fff" : "#423b32",
              fontSize: "0.8rem", fontWeight: 700, cursor: "pointer"
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#73695b" }}>Fetching live orders from database…</div>
      ) : orders.length === 0 ? (
        <div style={{ background: "#fff", padding: "40px", textAlign: "center", borderRadius: "14px", border: "1px solid #ede8e0" }}>
          No orders found for &ldquo;{filter}&rdquo; status.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {orders.map(o => {
            const isPickup =
              o.fulfillmentType === "pickup" ||
              o.pickupMode === true ||
              o.deliverySlot?.toLowerCase().includes("pickup") ||
              o.customer?.address?.toLowerCase().includes("pickup");
            const nextLabel = getNextStatusLabel(o.status, isPickup);

            return (
              <div
                key={o.orderId || o.id}
                style={{
                  background: "#fff",
                  border: isPickup ? "1.5px solid #f59e0b" : "1px solid #ede8e0",
                  borderRadius: "14px",
                  padding: "18px 20px",
                  boxShadow: isPickup ? "0 2px 10px rgba(245, 158, 11, 0.08)" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800, color: "#171410", fontSize: "0.95rem" }}>#{o.orderId || o.id}</div>
                      {isPickup ? (
                        <span style={{
                          background: "#fef3c7",
                          color: "#92400e",
                          border: "1px solid #fde68a",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          letterSpacing: "0.2px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}>
                          <span className="material-symbols-outlined text-[14px]">storefront</span>
                          STORE PICKUP (Customer Takeaway)
                        </span>
                      ) : (
                        <span style={{
                          background: "#e0f2fe",
                          color: "#0369a1",
                          border: "1px solid #bae6fd",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          letterSpacing: "0.2px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}>
                          <span className="material-symbols-outlined text-[14px]">delivery_dining</span>
                          HOME EXPRESS DELIVERY
                        </span>
                      )}
                    </div>
                    <div style={{ color: "#73695b", fontSize: "0.8rem", marginTop: "3px" }}>
                      {o.customer?.name} · {o.customer?.phone}
                    </div>
                    <div style={{
                      color: isPickup ? "#b45309" : "#73695b",
                      fontSize: "0.78rem",
                      fontWeight: isPickup ? 600 : 400,
                      marginTop: "2px",
                    }}>
                      {isPickup ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <span className="material-symbols-outlined text-[14px]">storefront</span>
                          Customer will collect at Store Counter
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <span className="material-symbols-outlined text-[14px]">location_on</span>
                          {o.customer?.address || "Ranchi"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900, color: "#941717", fontSize: "1.15rem", fontFamily: "Outfit, sans-serif" }}>₹{o.amount}</div>
                    <div style={{ color: "#73695b", fontSize: "0.75rem", fontWeight: 600 }}>{o.deliverySlot}</div>
                  </div>
                </div>

                <div style={{ color: "#423b32", fontSize: "0.875rem", fontWeight: 600, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="material-symbols-outlined text-[16px] text-gray-500">shopping_cart</span>
                  <span>{o.itemSummary || o.items?.map((item: any) => `${item.name} ×${item.quantity}`).join(", ")}</span>
                </div>

                {/* Dynamic Operational Prep & ETA Strip */}
                <div style={{
                  background: "#faf8f5",
                  border: "1px solid #f1ede6",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  marginBottom: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "8px",
                  fontSize: "0.78rem"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#574e42", flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <span className="material-symbols-outlined text-[14px]">timer</span>
                      Prep Time: <strong>{o.prepTimeMinutes || 25} mins</strong>
                    </span>
                    {(() => {
                      const specificSlot = getSpecificDeliverySlot(o.slot || o.timeSlot || o.scheduledSlot || o.deliverySlot);
                      if (!specificSlot) return null;
                      return (
                        <>
                          <span>•</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            Slot: <strong>{specificSlot}</strong>
                          </span>
                        </>
                      );
                    })()}
                    {o.status === "Out for Delivery" && (
                      <>
                        <span>•</span>
                        <span style={{ color: "#0369a1", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <span className="material-symbols-outlined text-[14px]">delivery_dining</span>
                          Rider in transit (~{o.remainingTransitMinutes != null ? o.remainingTransitMinutes : 15} mins away)
                        </span>
                      </>
                    )}
                  </div>

                  {(o.status === "Pending" || o.status === "Cutting") && (
                    <button
                      onClick={() => handleDelayPrep(o.orderId || o.id)}
                      title="Extend prep time by 10 mins during counter rush"
                      style={{
                        background: "#fffbeb",
                        border: "1px solid #fcd34d",
                        borderRadius: "6px",
                        padding: "4px 10px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "#b45309",
                        cursor: "pointer",
                      }}
                    >
                      +10m Rush Delay
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                  <OrderStatusPipeline status={o.status} />
                  <div style={{ display: "flex", gap: "8px" }}>
                    {nextLabel && (
                      <button
                        onClick={() => advanceStatus(o.orderId || o.id, o.status, isPickup)}
                        style={{
                          background: "rgba(148, 23, 23, 0.08)",
                          border: "1.5px solid rgba(148, 23, 23, 0.25)",
                          borderRadius: "8px",
                          padding: "7px 15px",
                          color: "#941717",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 150ms ease",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(148, 23, 23, 0.16)";
                          e.currentTarget.style.borderColor = "rgba(148, 23, 23, 0.4)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(148, 23, 23, 0.08)";
                          e.currentTarget.style.borderColor = "rgba(148, 23, 23, 0.25)";
                        }}
                      >
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        <span>{nextLabel}</span>
                      </button>
                    )}
                    <button
                      onClick={() => setPrintModalOrder(o)}
                      title="Print Thermal Kitchen Order Ticket (KOT)"
                      style={{
                        background: "#fff",
                        border: "1.5px solid #d1d5db",
                        borderRadius: "8px",
                        padding: "7px 12px",
                        color: "#374151",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px]">print</span>
                      <span>Print KOT</span>
                    </button>
                    <button style={{
                      background: "none",
                      border: "1px solid #ede8e0",
                      borderRadius: "8px",
                      padding: "7px 14px",
                      color: "#423b32",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}>
                      {o.paymentStatus} ({o.paymentMethod})
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {printModalOrder && (
        <ThermalKOTModal
          order={printModalOrder}
          onClose={() => setPrintModalOrder(null)}
        />
      )}
    </div>
  );
}

function ProductsStockTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = () => {
    setLoading(true);
    api.get<{ success: boolean; products: any[] }>("/products?limit=50&all=true")
      .then(res => {
        if (res.data.success) {
          setProducts(res.data.products || []);
        }
      })
      .catch(err => console.warn("Failed to fetch products:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const toggleStock = async (id: string, currentStock: boolean) => {
    try {
      await api.put(`/products/${id}`, { inStock: !currentStock });
      toast.success(!currentStock ? "Product marked in stock" : "Product marked out of stock", "Stock Updated");
      fetchProducts();
    } catch (err) {
      toast.error("Failed to toggle stock status", "Stock Error");
    }
  };

  return (
    <div>
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#73695b" }}>Loading products from Cloud Firestore…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {products.map(p => (
            <div key={p.id} style={{
              background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", padding: "16px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "#171410", marginBottom: "2px" }}>{p.name}</div>
                <div style={{ fontSize: "0.8rem", color: "#73695b" }}>{p.categoryLabel || p.category} · ₹{p.price} ({p.netWeight})</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <Badge label={p.inStock ? "In Stock" : "Out of Stock"} color={p.inStock ? "#059669" : "#d97706"} />
                <button
                  onClick={() => toggleStock(p.id, p.inStock)}
                  style={{
                    background: p.inStock ? "#fdf2f2" : "#ecfdf5",
                    border: `1px solid ${p.inStock ? "#fecaca" : "#a7f3d0"}`,
                    borderRadius: "8px",
                    padding: "7px 14px",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    color: p.inStock ? "#941717" : "#059669",
                  }}
                >
                  {p.inStock ? "Mark Unavailable" : "Mark Available"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CrossSellTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    originalPrice: "",
    image: "",
    inStock: true,
    isActive: true,
  });

  const fetchItems = () => {
    setLoading(true);
    api.get<{ success: boolean; data: any[] }>("/store-admin/cross-sell")
      .then((res) => {
        if (res.data.success) {
          setItems(res.data.data || []);
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch cross-sell items:", err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      price: "",
      originalPrice: "",
      image: "",
      inStock: true,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormData({
      name: item.name || "",
      price: item.price !== undefined ? String(item.price) : "",
      originalPrice: item.originalPrice !== undefined ? String(item.originalPrice) : "",
      image: item.image || "",
      inStock: item.inStock !== false,
      isActive: item.isActive !== false,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.warning("Please enter the item name.", "Validation Error");
      return;
    }
    if (!formData.price || isNaN(Number(formData.price)) || Number(formData.price) < 0) {
      toast.warning("Please enter a valid price.", "Validation Error");
      return;
    }
    if (!formData.image.trim()) {
      toast.warning("Please upload or provide a product image.", "Validation Error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        price: Number(formData.price),
        originalPrice: Number(formData.originalPrice) || 0,
        weight: "",
        image: formData.image.trim(),
        inStock: formData.inStock,
        isActive: formData.isActive,
      };

      if (editingItem) {
        await api.put(`/store-admin/cross-sell/${editingItem.id || editingItem._id}`, payload);
        toast.success("Cross-sell item updated successfully!", "Updated");
      } else {
        await api.post("/store-admin/cross-sell", payload);
        toast.success("New cross-sell item added successfully!", "Created");
      }
      setIsModalOpen(false);
      fetchItems();
    } catch (err: any) {
      console.error("Save cross-sell item error:", err);
      toast.error(err.response?.data?.message || "Failed to save item.", "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" from cart cross-selling?`)) return;
    try {
      await api.delete(`/store-admin/cross-sell/${id}`);
      toast.success(`"${name}" deleted successfully.`, "Deleted");
      fetchItems();
    } catch (err: any) {
      console.error("Delete cross-sell item error:", err);
      toast.error(err.response?.data?.message || "Failed to delete item.", "Error");
    }
  };

  const toggleStock = async (item: any) => {
    try {
      await api.put(`/store-admin/cross-sell/${item.id || item._id}`, {
        inStock: !item.inStock,
      });
      toast.success(item.inStock ? "Marked Out of Stock" : "Marked In Stock", "Stock Status");
      fetchItems();
    } catch (err) {
      toast.error("Failed to update stock status.", "Error");
    }
  };

  const toggleActive = async (item: any) => {
    try {
      await api.put(`/store-admin/cross-sell/${item.id || item._id}`, {
        isActive: !item.isActive,
      });
      toast.success(item.isActive ? "Hidden from cart" : "Visible in cart", "Cart Visibility");
      fetchItems();
    } catch (err) {
      toast.error("Failed to toggle visibility.", "Error");
    }
  };

  return (
    <div>
      {/* Header with stats and Add Button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#171410", margin: 0 }}>
            Cart Cross-Selling Products
          </h2>
          <p style={{ color: "#73695b", fontSize: "0.82rem", marginTop: "3px" }}>
            Manage recipe essentials and add-ons displayed directly above the tip and instruction box in customer carts.
          </p>
        </div>

        <button
          onClick={openAddModal}
          style={{
            background: "#941717",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            padding: "9px 18px",
            fontSize: "0.84rem",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "0 2px 8px rgba(148, 23, 23, 0.25)",
          }}
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Add Cross-Sell Item</span>
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#73695b" }}>Loading cross-selling items…</div>
      ) : items.length === 0 ? (
        <div style={{
          background: "#fff",
          border: "1px dashed #d6cec5",
          borderRadius: "16px",
          padding: "48px 24px",
          textAlign: "center",
        }}>
          <span className="material-symbols-outlined text-[48px] text-gray-300">shopping_basket</span>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#171410", marginTop: "12px" }}>No Cross-Selling Items Found</h3>
          <p style={{ fontSize: "0.82rem", color: "#73695b", maxWidth: "380px", margin: "6px auto 16px" }}>
            Add cooking essentials like Onions, Ginger Garlic Paste, or Chicken Masala to boost customer basket size.
          </p>
          <button
            onClick={openAddModal}
            style={{
              background: "#941717",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Add First Item
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "16px" }}>
          {items.map((item) => (
            <div
              key={item.id || item._id}
              style={{
                background: "#fff",
                border: "1px solid #ede8e0",
                borderRadius: "16px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                position: "relative",
              }}
            >
              <div>
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div style={{
                    width: "74px",
                    height: "74px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: "#ffffff",
                    border: "1px solid #e5ded4",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "4px",
                  }}>
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      onError={(e) => {
                        (e.target as any).src = "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400";
                      }}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <span style={{
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        padding: "2px 7px",
                        borderRadius: "99px",
                        background: item.inStock ? "#ecfdf5" : "#fef2f2",
                        color: item.inStock ? "#059669" : "#dc2626",
                        border: `1px solid ${item.inStock ? "#a7f3d0" : "#fecaca"}`,
                      }}>
                        {item.inStock ? "In Stock" : "Out of Stock"}
                      </span>
                      <span style={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: "99px",
                        background: item.isActive ? "#f0f9ff" : "#f3f4f6",
                        color: item.isActive ? "#0284c7" : "#6b7280",
                        border: `1px solid ${item.isActive ? "#bae6fd" : "#e5e7eb"}`,
                      }}>
                        {item.isActive ? "Active in Cart" : "Hidden"}
                      </span>
                    </div>

                    <h4 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#171410", margin: "0 0 3px 0", lineHeight: 1.3 }}>
                      {item.name}
                    </h4>
                    {item.weight ? (
                      <div style={{ fontSize: "0.78rem", color: "#73695b", fontWeight: 500 }}>
                        Unit / Weight: <strong style={{ color: "#2b251e" }}>{item.weight}</strong>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Price Display */}
                <div style={{
                  background: "#faf8f5",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "14px",
                }}>
                  <span style={{ fontSize: "0.78rem", color: "#73695b", fontWeight: 600 }}>Selling Price:</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                    <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#941717" }}>₹{item.price}</span>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <span style={{ fontSize: "0.78rem", color: "#9ca3af", textDecoration: "line-through" }}>
                        ₹{item.originalPrice}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", borderTop: "1px solid #f0ebe4", paddingTop: "12px" }}>
                <button
                  onClick={() => openEditModal(item)}
                  style={{
                    flex: 1,
                    background: "#f4f1ec",
                    color: "#2b251e",
                    border: "1px solid #e0d8ce",
                    borderRadius: "8px",
                    padding: "7px 10px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                  }}
                >
                  <span className="material-symbols-outlined text-[15px]">edit</span>
                  <span>Edit</span>
                </button>

                <button
                  onClick={() => toggleStock(item)}
                  style={{
                    background: item.inStock ? "#fff" : "#ecfdf5",
                    color: item.inStock ? "#73695b" : "#059669",
                    border: "1px solid #dcd5cb",
                    borderRadius: "8px",
                    padding: "7px 10px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  title="Toggle stock availability"
                >
                  {item.inStock ? "Disable" : "Enable"}
                </button>

                <button
                  onClick={() => toggleActive(item)}
                  style={{
                    background: item.isActive ? "#fff" : "#eff6ff",
                    color: item.isActive ? "#73695b" : "#0284c7",
                    border: "1px solid #dcd5cb",
                    borderRadius: "8px",
                    padding: "7px 10px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  title="Toggle visibility in customer cart"
                >
                  {item.isActive ? "Hide" : "Show"}
                </button>

                <button
                  onClick={() => handleDelete(item.id || item._id, item.name)}
                  style={{
                    background: "#fff",
                    color: "#dc2626",
                    border: "1px solid #fecaca",
                    borderRadius: "8px",
                    padding: "7px 9px",
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Delete cross-sell item"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(10, 22, 40, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "16px",
        }}>
          <div style={{
            background: "#fff",
            borderRadius: "18px",
            width: "100%",
            maxWidth: "480px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            overflow: "hidden",
            animation: "fadeIn 180ms ease-out",
          }}>
            <div style={{
              padding: "18px 20px",
              borderBottom: "1px solid #ede8e0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#faf8f5",
            }}>
              <div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#171410", margin: 0 }}>
                  {editingItem ? "Edit Cross-Sell Product" : "Add New Cross-Sell Product"}
                </h3>
                <p style={{ fontSize: "0.75rem", color: "#73695b", margin: "2px 0 0 0" }}>
                  Customers can quickly add this item above the tip box.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#73695b",
                  padding: "4px",
                  display: "flex",
                }}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSave} style={{ padding: "20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Item Name */}
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#2b251e", marginBottom: "4px" }}>
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1 kg Onion, Ginger Garlic Paste, Chicken Masala"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "10px",
                      border: "1px solid #d6cec5",
                      fontSize: "0.85rem",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Prices: Selling Price & MRP */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#2b251e", marginBottom: "4px" }}>
                      Selling Price (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1"
                      placeholder="e.g. 40"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "10px",
                        border: "1px solid #d6cec5",
                        fontSize: "0.85rem",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#2b251e", marginBottom: "4px" }}>
                      Original MRP (₹) (Optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g. 50"
                      value={formData.originalPrice}
                      onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "10px",
                        border: "1px solid #d6cec5",
                        fontSize: "0.85rem",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Product Image with Firebase Storage Upload */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#2b251e" }}>
                      Product Image *
                    </label>
                    <span style={{ fontSize: "0.72rem", color: "#8a8175" }}>Saves to Firebase Storage</span>
                  </div>

                  <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px", flexWrap: "wrap" }}>
                    <FileUploadButton
                      folder="cross-sell"
                      label="Upload Image (Firebase)"
                      onUploadSuccess={(url) => {
                        setFormData((prev) => ({ ...prev, image: url }));
                      }}
                    />
                    <span style={{ fontSize: "0.76rem", color: "#73695b" }}>or enter direct image URL below:</span>
                  </div>

                  <input
                    type="url"
                    required
                    placeholder="https://firebasestorage.googleapis.com/... or image link"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "10px",
                      border: "1px solid #d6cec5",
                      fontSize: "0.85rem",
                      outline: "none",
                    }}
                  />

                  {formData.image && (
                    <div style={{
                      marginTop: "10px",
                      padding: "8px 12px",
                      background: "#fbf9f6",
                      borderRadius: "10px",
                      border: "1px solid #ede8e0",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}>
                      <div style={{ width: "44px", height: "44px", borderRadius: "8px", overflow: "hidden", background: "#f0ece4", flexShrink: 0, border: "1px solid #e0d8ce" }}>
                        <img
                          src={formData.image}
                          alt="Preview"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => { (e.target as any).style.display = "none"; }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#171410" }}>Live Image Preview</div>
                        <div style={{ fontSize: "0.7rem", color: "#73695b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {formData.image}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, image: "" })}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#941717",
                          cursor: "pointer",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          padding: "4px 8px",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* Toggles */}
                <div style={{ display: "flex", gap: "20px", marginTop: "4px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", fontWeight: 600, color: "#2b251e", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={formData.inStock}
                      onChange={(e) => setFormData({ ...formData, inStock: e.target.checked })}
                      style={{ width: "16px", height: "16px", accentColor: "#941717" }}
                    />
                    <span>Available In Stock</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", fontWeight: 600, color: "#2b251e", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      style={{ width: "16px", height: "16px", accentColor: "#941717" }}
                    />
                    <span>Visible in Cart</span>
                  </label>
                </div>
              </div>

              {/* Modal footer */}
              <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: "#f4f1ec",
                    border: "1px solid #d6cec5",
                    color: "#73695b",
                    borderRadius: "9px",
                    padding: "9px 16px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: "#941717",
                    border: "none",
                    color: "#fff",
                    borderRadius: "9px",
                    padding: "9px 20px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {saving ? (
                    <span>Saving…</span>
                  ) : (
                    <span>{editingItem ? "Update Item" : "Create Item"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "fresh" | "defreeze" | "waste" | "history">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // History state
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyActionFilter, setHistoryActionFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState("");

  // Fetch Inventory List
  const fetchInventory = () => {
    setLoading(true);
    api.get<{ success: boolean; inventory: any[] }>("/store-admin/inventory")
      .then(res => {
        if (res.data.success) {
          setItems(res.data.inventory || []);
        }
      })
      .catch(err => console.warn("Failed to fetch inventory:", err))
      .finally(() => setLoading(false));
  };

  // Fetch Movement History
  const fetchHistory = () => {
    setHistoryLoading(true);
    const params = new URLSearchParams();
    if (historyActionFilter !== "all") params.append("actionType", historyActionFilter);
    if (historySearch.trim()) params.append("search", historySearch.trim());
    api.get<{ success: boolean; history: any[] }>(`/store-admin/inventory/history?${params.toString()}`)
      .then(res => {
        if (res.data.success) {
          setHistoryList(res.data.history || []);
        }
      })
      .catch(err => console.warn("Failed to fetch inventory history:", err))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    fetchInventory();
    const socket = getSocket();
    const handleInventoryUpdated = () => {
      fetchInventory();
      if (activeFilter === "history") fetchHistory();
    };
    socket.on("inventory:updated", handleInventoryUpdated);
    return () => {
      socket.off("inventory:updated", handleInventoryUpdated);
    };
  }, []);

  useEffect(() => {
    if (activeFilter === "history") {
      fetchHistory();
    }
  }, [activeFilter, historyActionFilter]);

  // ─── MODAL 1: MOVE DE-FREEZE TO FRESH ──────────────────────────────────────────
  const [moveModalItem, setMoveModalItem] = useState<any | null>(null);
  const [moveQty, setMoveQty] = useState("");
  const [moveNotes, setMoveNotes] = useState("");
  const [submittingMove, setSubmittingMove] = useState(false);

  const availableDefreeze = moveModalItem ? Number(moveModalItem.defreezeStock || 0) : 0;
  const currentFresh = moveModalItem ? Number(moveModalItem.stock || 0) : 0;
  const parsedMoveQty = parseFloat(moveQty) || 0;
  const isMoveValid = parsedMoveQty > 0 && parsedMoveQty <= availableDefreeze;

  const handleExecuteMove = async () => {
    if (!moveModalItem || !isMoveValid) return;
    setSubmittingMove(true);
    try {
      const res = await api.post("/store-admin/inventory/transfer", {
        itemId: moveModalItem.itemId || moveModalItem.id,
        quantity: parsedMoveQty,
        notes: moveNotes.trim(),
      });
      if (res.data?.success) {
        toast.success(res.data.message || `Moved ${parsedMoveQty} ${moveModalItem.unit} to Fresh Inventory`, "Stock Transferred");
        setMoveModalItem(null);
        setMoveQty("");
        setMoveNotes("");
        fetchInventory();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to transfer De-Freeze stock", "Transfer Failed");
    } finally {
      setSubmittingMove(false);
    }
  };

  // ─── MODAL 2: RECORD DAMAGE / WASTE ───────────────────────────────────────────
  const [wasteModalItem, setWasteModalItem] = useState<any | null>(null);
  const [wasteSource, setWasteSource] = useState<"fresh" | "defreeze">("fresh");
  const [wasteReason, setWasteReason] = useState("Damaged");
  const [wasteQty, setWasteQty] = useState("");
  const [wasteNotes, setWasteNotes] = useState("");
  const [submittingWaste, setSubmittingWaste] = useState(false);

  const availableForWaste = wasteModalItem
    ? (wasteSource === "fresh" ? Number(wasteModalItem.stock || 0) : Number(wasteModalItem.defreezeStock || 0))
    : 0;
  const parsedWasteQty = parseFloat(wasteQty) || 0;
  const isWasteValid = parsedWasteQty > 0 && parsedWasteQty <= availableForWaste;

  const handleExecuteWaste = async () => {
    if (!wasteModalItem || !isWasteValid) return;
    setSubmittingWaste(true);
    try {
      const res = await api.post("/store-admin/inventory/waste", {
        itemId: wasteModalItem.itemId || wasteModalItem.id,
        sourceClassification: wasteSource,
        quantity: parsedWasteQty,
        reason: wasteReason,
        notes: wasteNotes.trim(),
      });
      if (res.data?.success) {
        toast.success(res.data.message || `Recorded ${parsedWasteQty} ${wasteModalItem.unit} as waste`, "Waste Recorded");
        setWasteModalItem(null);
        setWasteQty("");
        setWasteNotes("");
        fetchInventory();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to record waste", "Waste Error");
    } finally {
      setSubmittingWaste(false);
    }
  };

  // ─── MODAL 3: ADJUST STOCK (ADD / REDUCE / SET) ──────────────────────────────
  const [adjustModalItem, setAdjustModalItem] = useState<any | null>(null);
  const [adjustClass, setAdjustClass] = useState<"fresh" | "defreeze">("fresh");
  const [adjustOp, setAdjustOp] = useState<"add" | "reduce" | "set">("add");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustMin, setAdjustMin] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  const currentAdjustBase = adjustModalItem
    ? (adjustClass === "fresh" ? Number(adjustModalItem.stock || 0) : Number(adjustModalItem.defreezeStock || 0))
    : 0;
  const parsedAdjustQty = parseFloat(adjustQty) || 0;

  let projectedAdjustResult = currentAdjustBase;
  if (adjustOp === "add") projectedAdjustResult = Math.round((currentAdjustBase + parsedAdjustQty) * 1000) / 1000;
  else if (adjustOp === "reduce") projectedAdjustResult = Math.max(0, Math.round((currentAdjustBase - parsedAdjustQty) * 1000) / 1000);
  else if (adjustOp === "set") projectedAdjustResult = Math.max(0, parsedAdjustQty);

  const handleExecuteAdjust = async () => {
    if (!adjustModalItem) return;
    if (adjustOp !== "set" && parsedAdjustQty <= 0) {
      toast.warning("Please enter a valid positive quantity", "Invalid Input");
      return;
    }
    setSubmittingAdjust(true);
    try {
      const id = adjustModalItem.itemId || adjustModalItem.id;
      const res = await api.patch(`/store-admin/inventory/${id}`, {
        classification: adjustClass,
        operation: adjustOp,
        quantity: parsedAdjustQty,
        min: adjustClass === "fresh" ? adjustMin : undefined,
        reason: adjustReason.trim(),
      });
      if (res.data?.success) {
        toast.success("Inventory stock adjusted successfully", "Stock Updated");
        setAdjustModalItem(null);
        setAdjustQty("");
        setAdjustReason("");
        fetchInventory();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to adjust stock", "Adjustment Error");
    } finally {
      setSubmittingAdjust(false);
    }
  };

  // ─── Filtered Items ───────────────────────────────────────────────────────────
  const filteredItems = items.filter(item => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = item.item?.toLowerCase().includes(q);
      const matchCat = item.category?.toLowerCase().includes(q);
      const matchId = (item.itemId || item.id)?.toLowerCase().includes(q);
      if (!matchName && !matchCat && !matchId) return false;
    }
    if (activeFilter === "fresh") return true;
    if (activeFilter === "defreeze") return (item.defreezeStock || 0) > 0;
    if (activeFilter === "waste") return (item.wasteStock || 0) > 0;
    return true;
  });

  // KPI aggregates
  const totalFreshStock = items.reduce((sum, i) => sum + (Number(i.stock) || 0), 0);
  const totalDefreezeStock = items.reduce((sum, i) => sum + (Number(i.defreezeStock) || 0), 0);
  const totalWasteStock = items.reduce((sum, i) => sum + (Number(i.wasteStock) || 0), 0);
  const lowStockCount = items.filter(i => {
    const min = Number(i.min) || 0;
    return min > 0 && Number(i.stock || 0) <= min && Number(i.stock || 0) > 0;
  }).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* ─── Top Metrics Bar ────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px" }}>
        <div style={{
          background: "#fff",
          borderRadius: "14px",
          padding: "14px 18px",
          border: "1.5px solid #ede8e0",
          boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Fresh Inventory (Saleable)
            </span>
            <span className="material-symbols-outlined text-[20px]" style={{ color: "#059669" }}>eco</span>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 900, color: "#171410", fontFamily: "Outfit, sans-serif" }}>
            {Math.round(totalFreshStock * 10) / 10} <span style={{ fontSize: "0.85rem", color: "#73695b", fontWeight: 600 }}>units/kg</span>
          </div>
          <div style={{ fontSize: "0.74rem", color: "#73695b", marginTop: "3px" }}>
            Available for customer orders
          </div>
        </div>

        <div style={{
          background: "#fff",
          borderRadius: "14px",
          padding: "14px 18px",
          border: "1.5px solid #ede8e0",
          boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              De-Freeze Pool (Cold Storage)
            </span>
            <span className="material-symbols-outlined text-[20px]" style={{ color: "#2563eb" }}>ac_unit</span>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 900, color: "#171410", fontFamily: "Outfit, sans-serif" }}>
            {Math.round(totalDefreezeStock * 10) / 10} <span style={{ fontSize: "0.85rem", color: "#73695b", fontWeight: 600 }}>units/kg</span>
          </div>
          <div style={{ fontSize: "0.74rem", color: "#73695b", marginTop: "3px" }}>
            Replenishment stock ready to move
          </div>
        </div>

        <div style={{
          background: "#fff",
          borderRadius: "14px",
          padding: "14px 18px",
          border: "1.5px solid #ede8e0",
          boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Damage &amp; Waste Logged
            </span>
            <span className="material-symbols-outlined text-[20px]" style={{ color: "#dc2626" }}>delete_sweep</span>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 900, color: "#171410", fontFamily: "Outfit, sans-serif" }}>
            {Math.round(totalWasteStock * 10) / 10} <span style={{ fontSize: "0.85rem", color: "#73695b", fontWeight: 600 }}>units/kg</span>
          </div>
          <div style={{ fontSize: "0.74rem", color: "#73695b", marginTop: "3px" }}>
            Non-saleable audit records
          </div>
        </div>

        <div style={{
          background: lowStockCount > 0 ? "#fef3c7" : "#fff",
          borderRadius: "14px",
          padding: "14px 18px",
          border: `1.5px solid ${lowStockCount > 0 ? "#fde68a" : "#ede8e0"}`,
          boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: lowStockCount > 0 ? "#b45309" : "#73695b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Low Stock Warnings
            </span>
            <span className="material-symbols-outlined text-[20px]" style={{ color: lowStockCount > 0 ? "#d97706" : "#73695b" }}>warning</span>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 900, color: lowStockCount > 0 ? "#b45309" : "#171410", fontFamily: "Outfit, sans-serif" }}>
            {lowStockCount} <span style={{ fontSize: "0.85rem", color: lowStockCount > 0 ? "#b45309" : "#73695b", fontWeight: 600 }}>products</span>
          </div>
          <div style={{ fontSize: "0.74rem", color: lowStockCount > 0 ? "#b45309" : "#73695b", marginTop: "3px" }}>
            {lowStockCount > 0 ? "Replenish from De-Freeze soon" : "All products healthy"}
          </div>
        </div>
      </div>

      {/* ─── Filter Tabs & Search Bar ────────────────────────────────────────────── */}
      <div style={{
        background: "#fff",
        borderRadius: "14px",
        padding: "14px 16px",
        border: "1px solid #ede8e0",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
      }}>
        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {[
            { key: "all", label: "All Items", icon: "inventory_2", count: items.length },
            { key: "fresh", label: "Fresh Stock", icon: "eco" },
            { key: "defreeze", label: "De-Freeze Pool", icon: "ac_unit" },
            { key: "waste", label: "Damage & Waste", icon: "delete_sweep" },
            { key: "history", label: "Movement History", icon: "history" },
          ].map(t => {
            const isActive = activeFilter === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveFilter(t.key as any)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: isActive ? "1.5px solid #941717" : "1px solid #ede8e0",
                  background: isActive ? "#941717" : "#faf8f5",
                  color: isActive ? "#fff" : "#423b32",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  transition: "all 180ms ease",
                }}
              >
                <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <span style={{
                    background: isActive ? "rgba(255,255,255,0.25)" : "#ede8e0",
                    color: isActive ? "#fff" : "#73695b",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    fontSize: "0.72rem",
                  }}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Field */}
        <div style={{ position: "relative", minWidth: "240px", flex: 1, maxWidth: "340px" }}>
          <span className="material-symbols-outlined" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#a89f91", fontSize: "18px" }}>
            search
          </span>
          <input
            type="text"
            placeholder={activeFilter === "history" ? "Search history, order #, reason…" : "Search product name or category…"}
            value={activeFilter === "history" ? historySearch : searchQuery}
            onChange={e => {
              if (activeFilter === "history") setHistorySearch(e.target.value);
              else setSearchQuery(e.target.value);
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && activeFilter === "history") fetchHistory();
            }}
            style={{
              padding: "8px 12px 8px 34px",
              borderRadius: "8px",
              border: "1px solid #d1cbbf",
              width: "100%",
              fontSize: "0.85rem",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* ─── BODY CONTENT: CARDS GRID OR HISTORY VIEW ────────────────────────────── */}
      {activeFilter === "history" ? (
        /* ─── AUDIT HISTORY VIEW ─── */
        <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", overflow: "hidden", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #ede8e0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#171410" }}>Inventory Audit &amp; Movement Ledger</h4>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "#73695b" }}>Append-only log of order deductions, transfers, waste, and stock updates</p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <select
                value={historyActionFilter}
                onChange={e => setHistoryActionFilter(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #d1cbbf", fontSize: "0.8rem", background: "#fff", fontWeight: 600 }}
              >
                <option value="all">All Action Types</option>
                <option value="transfer_defreeze_to_fresh">Transfers (De-Freeze → Fresh)</option>
                <option value="order_deduction">Customer Order Deductions</option>
                <option value="record_waste">Damage &amp; Waste Records</option>
                <option value="add_stock">Stock Received (Add)</option>
                <option value="reduce_stock">Stock Reduced</option>
                <option value="set_stock">Stock Set Exact</option>
                <option value="order_restock">Order Restocks (Cancellations)</option>
              </select>
              <button
                type="button"
                onClick={fetchHistory}
                disabled={historyLoading}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid #ede8e0",
                  background: "#faf8f5",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Refresh
              </button>
            </div>
          </div>

          {historyLoading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#73695b" }}>Loading audit history…</div>
          ) : historyList.length === 0 ? (
            <div style={{ padding: "50px", textAlign: "center", color: "#73695b" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "#a89f91", marginBottom: "8px" }}>history_toggle_off</span>
              <div style={{ fontWeight: 700, color: "#171410" }}>No stock movement records found</div>
              <div style={{ fontSize: "0.8rem", color: "#a89f91", marginTop: "4px" }}>
                Transfers, orders, adjustments, and waste records will appear here.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#faf8f5", borderBottom: "1px solid #ede8e0", color: "#423b32", fontWeight: 700 }}>
                    <th style={{ padding: "10px 14px" }}>Timestamp</th>
                    <th style={{ padding: "10px 14px" }}>Product &amp; Category</th>
                    <th style={{ padding: "10px 14px" }}>Action</th>
                    <th style={{ padding: "10px 14px" }}>Quantity</th>
                    <th style={{ padding: "10px 14px" }}>Stock Balance</th>
                    <th style={{ padding: "10px 14px" }}>Details / Reason</th>
                    <th style={{ padding: "10px 14px" }}>Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map(h => {
                    const actionBadge = (() => {
                      switch (h.actionType) {
                        case "transfer_defreeze_to_fresh":
                          return <Badge label="De-Freeze → Fresh" color="#2563eb" />;
                        case "order_deduction":
                          return <Badge label="Order Deduction" color="#d97706" />;
                        case "record_waste":
                          return <Badge label="Damage / Waste" color="#dc2626" />;
                        case "add_stock":
                          return <Badge label="Stock Added" color="#059669" />;
                        case "reduce_stock":
                          return <Badge label="Stock Reduced" color="#ea580c" />;
                        case "set_stock":
                          return <Badge label="Stock Reconciled" color="#7c3aed" />;
                        case "order_restock":
                          return <Badge label="Order Restocked" color="#059669" />;
                        default:
                          return <Badge label={h.actionType || "Updated"} color="#73695b" />;
                      }
                    })();

                    const isDeduction = h.actionType === "order_deduction" || h.actionType === "record_waste" || h.actionType === "reduce_stock";

                    return (
                      <tr key={h._id} style={{ borderBottom: "1px solid #ede8e0" }}>
                        <td style={{ padding: "10px 14px", color: "#73695b", whiteSpace: "nowrap" }}>
                          {new Date(h.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                          <span style={{ fontSize: "0.74rem", color: "#a89f91" }}>
                            {new Date(h.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ fontWeight: 700, color: "#171410" }}>{h.productName}</div>
                          <div style={{ fontSize: "0.72rem", color: "#73695b" }}>{h.category || h.itemId}</div>
                        </td>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{actionBadge}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 800, color: isDeduction ? "#dc2626" : "#059669", whiteSpace: "nowrap" }}>
                          {isDeduction ? `-${h.quantity}` : `+${h.quantity}`} {h.unit}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#73695b", whiteSpace: "nowrap" }}>
                          {h.previousQuantity !== null && h.resultingQuantity !== null ? (
                            <span>{h.previousQuantity} → <strong>{h.resultingQuantity}</strong> {h.unit}</span>
                          ) : "—"}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#423b32", maxWidth: "260px" }}>
                          <div>{h.reason || "—"}</div>
                          {h.orderId && (
                            <div style={{ fontSize: "0.72rem", color: "#941717", fontWeight: 700 }}>
                              Order #{h.orderId}
                            </div>
                          )}
                          {h.notes && (
                            <div style={{ fontSize: "0.72rem", color: "#73695b", fontStyle: "italic" }}>
                              {h.notes}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#73695b", whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 600, color: "#171410" }}>{h.actor?.name || "System"}</div>
                          <div style={{ fontSize: "0.7rem", color: "#a89f91", textTransform: "capitalize" }}>{h.actor?.role || "system"}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ─── CARDS GRID VIEW ─── */
        <div>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#73695b" }}>Loading live inventory…</div>
          ) : filteredItems.length === 0 ? (
            <div style={{ padding: "50px", textAlign: "center", background: "#fff", borderRadius: "14px", border: "1px solid #ede8e0" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "#a89f91", marginBottom: "8px" }}>search_off</span>
              <div style={{ fontWeight: 700, color: "#171410" }}>No inventory items found</div>
              <div style={{ fontSize: "0.8rem", color: "#a89f91", marginTop: "4px" }}>
                Try adjusting your search query or switching tabs.
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "16px" }}>
              {filteredItems.map(item => {
                const freshStock = Number(item.stock || 0);
                const defreezeStock = Number(item.defreezeStock || 0);
                const wasteStock = Number(item.wasteStock || 0);
                const minThreshold = Number(item.min) || 0;
                const isOutOfStock = freshStock <= 0;
                const isLow = minThreshold > 0 && freshStock <= minThreshold && freshStock > 0;
                const displayStatus = isOutOfStock ? "Out of Stock" : isLow ? "Low Stock" : "In Stock";

                return (
                  <div
                    key={item.itemId || item.id}
                    style={{
                      background: "#fff",
                      border: `1.5px solid ${isOutOfStock ? "#fecaca" : isLow ? "#fef3c7" : "#ede8e0"}`,
                      borderRadius: "14px",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      boxShadow: isLow ? "0 4px 12px rgba(217, 119, 6, 0.08)" : "0 2px 8px rgba(0,0,0,0.03)",
                      transition: "transform 180ms ease, box-shadow 180ms ease",
                    }}
                  >
                    {/* Card Header */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "12px" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            title={item.item}
                            style={{
                              fontWeight: 800,
                              color: "#171410",
                              fontSize: "1rem",
                              lineHeight: "1.3",
                              minHeight: "2.6em",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {item.item}
                          </div>
                          <div style={{ color: "#73695b", fontSize: "0.74rem", marginTop: "3px" }}>
                            Category: {item.category}
                          </div>
                        </div>
                        <Badge
                          label={displayStatus}
                          color={isOutOfStock ? "#dc2626" : isLow ? "#d97706" : "#059669"}
                        />
                      </div>

                      {/* 3-Way Classification Stock Dashboard */}
                      <div style={{
                        background: "#faf8f5",
                        border: "1px solid #ede8e0",
                        borderRadius: "10px",
                        padding: "10px 12px",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "6px",
                        textAlign: "center",
                      }}>
                        {/* Fresh */}
                        <div style={{ borderRight: "1px solid #ede8e0", paddingRight: "4px" }}>
                          <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#059669", textTransform: "uppercase" }}>Fresh</div>
                          <div style={{ fontSize: "1.25rem", fontWeight: 900, color: isLow ? "#d97706" : isOutOfStock ? "#dc2626" : "#059669", fontFamily: "Outfit, sans-serif" }}>
                            {freshStock}
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "#73695b" }}>{item.unit}</div>
                        </div>

                        {/* De-Freeze */}
                        <div style={{ borderRight: "1px solid #ede8e0", paddingRight: "4px" }}>
                          <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>De-Freeze</div>
                          <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#2563eb", fontFamily: "Outfit, sans-serif" }}>
                            {defreezeStock}
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "#73695b" }}>{item.unit}</div>
                        </div>

                        {/* Waste */}
                        <div>
                          <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#dc2626", textTransform: "uppercase" }}>Waste</div>
                          <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#dc2626", fontFamily: "Outfit, sans-serif" }}>
                            {wasteStock}
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "#73695b" }}>{item.unit}</div>
                        </div>
                      </div>

                      {/* Alert Info (Only shown if configured) */}
                      {minThreshold > 0 && (
                        <div style={{ fontSize: "0.72rem", color: isLow ? "#b45309" : "#73695b", marginTop: "8px", fontWeight: 600 }}>
                          Low Stock Alert: ≤ {minThreshold} {item.unit}
                        </div>
                      )}
                    </div>

                    {/* Card Actions Button Toolbar */}
                    <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {/* Primary Quick Action: Move De-Freeze to Fresh */}
                      <button
                        type="button"
                        disabled={defreezeStock <= 0}
                        onClick={() => {
                          if (defreezeStock <= 0) return;
                          setMoveModalItem(item);
                          setMoveQty("");
                          setMoveNotes("");
                        }}
                        style={{
                          background: defreezeStock > 0 ? "#941717" : "#f5f2eb",
                          color: defreezeStock > 0 ? "#fff" : "#a89f91",
                          border: defreezeStock > 0 ? "none" : "1px solid #ede8e0",
                          borderRadius: "8px",
                          padding: "8px 12px",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          cursor: defreezeStock > 0 ? "pointer" : "not-allowed",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          width: "100%",
                          boxShadow: defreezeStock > 0 ? "0 2px 6px rgba(148, 23, 23, 0.2)" : "none",
                          opacity: defreezeStock > 0 ? 1 : 0.65,
                        }}
                      >
                        <span className="material-symbols-outlined text-[16px]">sync_alt</span>
                        <span>{defreezeStock > 0 ? `Move De-Freeze to Fresh (${defreezeStock} ${item.unit})` : `De-Freeze Pool Empty (0 ${item.unit})`}</span>
                      </button>

                      {/* Secondary Actions Row: Record Waste & Adjust Stock */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setWasteModalItem(item);
                            setWasteSource(freshStock > 0 ? "fresh" : "defreeze");
                            setWasteQty("");
                            setWasteReason("Damaged");
                            setWasteNotes("");
                          }}
                          style={{
                            background: "#fff",
                            color: "#dc2626",
                            border: "1px solid #fca5a5",
                            borderRadius: "8px",
                            padding: "6px 8px",
                            fontSize: "0.76rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                          }}
                        >
                          <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
                          <span>Record Waste</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAdjustModalItem(item);
                            setAdjustClass("fresh");
                            setAdjustOp("add");
                            setAdjustQty("");
                            setAdjustMin(minThreshold > 0 ? String(minThreshold) : "");
                            setAdjustReason("");
                          }}
                          style={{
                            background: "#faf8f5",
                            color: "#423b32",
                            border: "1px solid #d1cbbf",
                            borderRadius: "8px",
                            padding: "6px 8px",
                            fontSize: "0.76rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                          }}
                        >
                          <span className="material-symbols-outlined text-[15px]">tune</span>
                          <span>Adjust Stock</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL 1: MOVE DE-FREEZE TO FRESH ────────────────────────────────────── */}
      {moveModalItem && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)",
          display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "460px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#171410" }}>Move De-Freeze to Fresh</h3>
                <div style={{ fontSize: "0.85rem", color: "#941717", fontWeight: 700, marginTop: "2px" }}>
                  {moveModalItem.item} ({moveModalItem.category})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMoveModalItem(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#73695b" }}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Current Balances Visual */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              gap: "8px",
              background: "#faf8f5",
              border: "1px solid #ede8e0",
              borderRadius: "12px",
              padding: "12px",
              marginBottom: "16px",
              textAlign: "center",
            }}>
              <div>
                <div style={{ fontSize: "0.72rem", color: "#2563eb", fontWeight: 700, textTransform: "uppercase" }}>De-Freeze Available</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#171410", fontFamily: "Outfit, sans-serif" }}>
                  {availableDefreeze} {moveModalItem.unit}
                </div>
              </div>
              <span className="material-symbols-outlined text-[20px]" style={{ color: "#941717" }}>arrow_forward</span>
              <div>
                <div style={{ fontSize: "0.72rem", color: "#059669", fontWeight: 700, textTransform: "uppercase" }}>Current Fresh</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#171410", fontFamily: "Outfit, sans-serif" }}>
                  {currentFresh} {moveModalItem.unit}
                </div>
              </div>
            </div>

            {/* Quick Chips */}
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#73695b", marginBottom: "6px" }}>
                Quick select transfer amount:
              </label>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {[5, 10, 20, 50].filter(val => val <= availableDefreeze).map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMoveQty(String(val))}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "16px",
                      border: "1px solid #d1cbbf",
                      background: moveQty === String(val) ? "#423b32" : "#fff",
                      color: moveQty === String(val) ? "#fff" : "#423b32",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    +{val} {moveModalItem.unit}
                  </button>
                ))}
                {availableDefreeze > 0 && (
                  <button
                    type="button"
                    onClick={() => setMoveQty(String(availableDefreeze))}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "16px",
                      border: "1px solid #2563eb",
                      background: moveQty === String(availableDefreeze) ? "#2563eb" : "#eff6ff",
                      color: moveQty === String(availableDefreeze) ? "#fff" : "#2563eb",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    All ({availableDefreeze} {moveModalItem.unit})
                  </button>
                )}
              </div>
            </div>

            {/* Quantity Input */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>
                Quantity to Move to Fresh ({moveModalItem.unit}) *
              </label>
              <input
                type="number"
                min="0.1"
                max={availableDefreeze}
                step="0.5"
                placeholder="e.g. 10"
                value={moveQty}
                onChange={e => setMoveQty(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: `1.5px solid ${parsedMoveQty > availableDefreeze ? "#dc2626" : "#d1cbbf"}`,
                  width: "100%",
                  fontSize: "1rem",
                  fontWeight: 700,
                  boxSizing: "border-box",
                }}
              />
              {parsedMoveQty > availableDefreeze && (
                <div style={{ color: "#dc2626", fontSize: "0.74rem", marginTop: "4px", fontWeight: 600 }}>
                  Cannot exceed available De-Freeze stock ({availableDefreeze} {moveModalItem.unit}).
                </div>
              )}
            </div>

            {/* Optional Notes */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>
                Reason / Batch Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Thawed for morning butchery counter rush"
                value={moveNotes}
                onChange={e => setMoveNotes(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d1cbbf",
                  width: "100%",
                  fontSize: "0.82rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Projected Summary Confirmation Preview */}
            <div style={{
              background: isMoveValid ? "#ecfdf5" : "#faf8f5",
              border: `1px solid ${isMoveValid ? "#a7f3d0" : "#ede8e0"}`,
              borderRadius: "10px",
              padding: "12px",
              marginBottom: "18px",
            }}>
              <div style={{ fontSize: "0.76rem", fontWeight: 700, color: isMoveValid ? "#065f46" : "#73695b", marginBottom: "4px" }}>
                Confirmation Summary:
              </div>
              <div style={{ fontSize: "0.82rem", color: "#171410", lineHeight: "1.4" }}>
                De-Freeze Stock: <strong>{availableDefreeze}</strong> → <strong>{Math.max(0, Math.round((availableDefreeze - parsedMoveQty) * 1000) / 1000)} {moveModalItem.unit}</strong><br />
                Fresh Stock (Saleable): <strong>{currentFresh}</strong> → <strong>{Math.round((currentFresh + parsedMoveQty) * 1000) / 1000} {moveModalItem.unit}</strong>
              </div>
              <div style={{ fontSize: "0.7rem", color: "#059669", marginTop: "4px", fontWeight: 600 }}>
                ✓ Total combined physical stock remains unchanged ({availableDefreeze + currentFresh} {moveModalItem.unit}).
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn"
                onClick={() => setMoveModalItem(null)}
                disabled={submittingMove}
                style={{ padding: "8px 16px", borderRadius: "8px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExecuteMove}
                disabled={submittingMove || !isMoveValid}
                style={{
                  padding: "8px 20px",
                  borderRadius: "8px",
                  background: isMoveValid ? "#941717" : "#a89f91",
                  borderColor: isMoveValid ? "#941717" : "#a89f91",
                  fontWeight: 700,
                }}
              >
                {submittingMove ? "Moving…" : `Confirm Move (${parsedMoveQty || 0} ${moveModalItem.unit})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: RECORD DAMAGE / WASTE ──────────────────────────────────────── */}
      {wasteModalItem && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)",
          display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "460px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#dc2626" }}>Record Damaged / Wasted Stock</h3>
                <div style={{ fontSize: "0.85rem", color: "#423b32", fontWeight: 700, marginTop: "2px" }}>
                  {wasteModalItem.item} ({wasteModalItem.category})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWasteModalItem(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#73695b" }}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Select Source Classification */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                Select Source Inventory:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setWasteSource("fresh")}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: wasteSource === "fresh" ? "2px solid #059669" : "1px solid #d1cbbf",
                    background: wasteSource === "fresh" ? "#ecfdf5" : "#fff",
                    color: wasteSource === "fresh" ? "#065f46" : "#423b32",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  <div>Fresh Inventory</div>
                  <div style={{ fontSize: "0.72rem", color: "#73695b", marginTop: "2px" }}>
                    Available: {wasteModalItem.stock || 0} {wasteModalItem.unit}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setWasteSource("defreeze")}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: wasteSource === "defreeze" ? "2px solid #2563eb" : "1px solid #d1cbbf",
                    background: wasteSource === "defreeze" ? "#eff6ff" : "#fff",
                    color: wasteSource === "defreeze" ? "#1e40af" : "#423b32",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  <div>De-Freeze Pool</div>
                  <div style={{ fontSize: "0.72rem", color: "#73695b", marginTop: "2px" }}>
                    Available: {wasteModalItem.defreezeStock || 0} {wasteModalItem.unit}
                  </div>
                </button>
              </div>
            </div>

            {/* Reason Dropdown */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>
                Reason for Waste *
              </label>
              <select
                value={wasteReason}
                onChange={e => setWasteReason(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d1cbbf",
                  width: "100%",
                  fontSize: "0.85rem",
                  background: "#fff",
                  boxSizing: "border-box",
                }}
              >
                <option value="Damaged">Damaged Cut</option>
                <option value="Spoiled">Spoiled / Discolored</option>
                <option value="Expired">Expired / Shelf Life Exceeded</option>
                <option value="Handling Loss">Handling / Trimming Loss</option>
                <option value="Other">Other Operational Loss</option>
              </select>
            </div>

            {/* Quantity Input */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>
                Wasted Quantity ({wasteModalItem.unit}) *
              </label>
              <input
                type="number"
                min="0.1"
                max={availableForWaste}
                step="0.5"
                placeholder="e.g. 2"
                value={wasteQty}
                onChange={e => setWasteQty(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: `1.5px solid ${parsedWasteQty > availableForWaste ? "#dc2626" : "#d1cbbf"}`,
                  width: "100%",
                  fontSize: "1rem",
                  fontWeight: 700,
                  boxSizing: "border-box",
                }}
              />
              {parsedWasteQty > availableForWaste && (
                <div style={{ color: "#dc2626", fontSize: "0.74rem", marginTop: "4px", fontWeight: 600 }}>
                  Quantity exceeds available {wasteSource === "fresh" ? "Fresh" : "De-Freeze"} stock ({availableForWaste} {wasteModalItem.unit}).
                </div>
              )}
            </div>

            {/* Optional Notes */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>
                Notes / Audit Explanation
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Broken bone in cutting process, discarded during morning inspection"
                value={wasteNotes}
                onChange={e => setWasteNotes(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d1cbbf",
                  width: "100%",
                  fontSize: "0.82rem",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
            </div>

            {/* Waste Warning Banner */}
            <div style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              padding: "10px 12px",
              marginBottom: "18px",
              fontSize: "0.75rem",
              color: "#991b1b",
              lineHeight: "1.4",
            }}>
              <strong>Warning:</strong> This will deduct {parsedWasteQty || 0} {wasteModalItem.unit} directly from saleable {wasteSource === "fresh" ? "Fresh" : "De-Freeze"} stock and permanently record it in the store waste audit ledger.
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn"
                onClick={() => setWasteModalItem(null)}
                disabled={submittingWaste}
                style={{ padding: "8px 16px", borderRadius: "8px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExecuteWaste}
                disabled={submittingWaste || !isWasteValid}
                style={{
                  padding: "8px 20px",
                  borderRadius: "8px",
                  background: isWasteValid ? "#dc2626" : "#a89f91",
                  borderColor: isWasteValid ? "#dc2626" : "#a89f91",
                  fontWeight: 700,
                }}
              >
                {submittingWaste ? "Saving…" : "Confirm Waste Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: ADJUST STOCK (ADD / REDUCE / SET) ────────────────────────── */}
      {adjustModalItem && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)",
          display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "480px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#171410" }}>Adjust Stock Level</h3>
                <div style={{ fontSize: "0.85rem", color: "#941717", fontWeight: 700, marginTop: "2px" }}>
                  {adjustModalItem.item} ({adjustModalItem.category})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdjustModalItem(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#73695b" }}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Target Classification Selector */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                Target Inventory:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setAdjustClass("fresh")}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: adjustClass === "fresh" ? "2px solid #059669" : "1px solid #d1cbbf",
                    background: adjustClass === "fresh" ? "#ecfdf5" : "#fff",
                    color: adjustClass === "fresh" ? "#065f46" : "#423b32",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  Fresh Stock (Saleable): {adjustModalItem.stock || 0} {adjustModalItem.unit}
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustClass("defreeze")}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: adjustClass === "defreeze" ? "2px solid #2563eb" : "1px solid #d1cbbf",
                    background: adjustClass === "defreeze" ? "#eff6ff" : "#fff",
                    color: adjustClass === "defreeze" ? "#1e40af" : "#423b32",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  De-Freeze Pool: {adjustModalItem.defreezeStock || 0} {adjustModalItem.unit}
                </button>
              </div>
            </div>

            {/* Action Operation Selector */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                Adjustment Action:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setAdjustOp("add")}
                  style={{
                    padding: "8px",
                    borderRadius: "8px",
                    border: adjustOp === "add" ? "2px solid #059669" : "1px solid #d1cbbf",
                    background: adjustOp === "add" ? "#ecfdf5" : "#fff",
                    color: adjustOp === "add" ? "#059669" : "#423b32",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                  }}
                >
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  Add Stock
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustOp("reduce")}
                  style={{
                    padding: "8px",
                    borderRadius: "8px",
                    border: adjustOp === "reduce" ? "2px solid #dc2626" : "1px solid #d1cbbf",
                    background: adjustOp === "reduce" ? "#fef2f2" : "#fff",
                    color: adjustOp === "reduce" ? "#dc2626" : "#423b32",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  Reduce Stock
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustOp("set")}
                  style={{
                    padding: "8px",
                    borderRadius: "8px",
                    border: adjustOp === "set" ? "2px solid #2563eb" : "1px solid #d1cbbf",
                    background: adjustOp === "set" ? "#eff6ff" : "#fff",
                    color: adjustOp === "set" ? "#2563eb" : "#423b32",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  Set Exact
                </button>
              </div>
            </div>

            {/* Quick Amount Chips */}
            {adjustOp !== "set" && (
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#73695b", marginBottom: "6px" }}>
                  Quick select amount ({adjustModalItem.unit}):
                </label>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {(adjustOp === "add" ? [5, 10, 25, 50] : [2, 5, 10, 20]).map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAdjustQty(String(val))}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "16px",
                        border: "1px solid #d1cbbf",
                        background: adjustQty === String(val) ? "#423b32" : "#fff",
                        color: adjustQty === String(val) ? "#fff" : "#423b32",
                        fontSize: "0.76rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {adjustOp === "add" ? `+${val}` : `-${val}`} {adjustModalItem.unit}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity Input */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>
                {adjustOp === "add" && `Quantity to Add (${adjustModalItem.unit}) *`}
                {adjustOp === "reduce" && `Quantity to Deduct (${adjustModalItem.unit}) *`}
                {adjustOp === "set" && `New Total Stock (${adjustModalItem.unit}) *`}
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder={adjustOp === "set" ? `e.g. ${currentAdjustBase}` : "Enter quantity (e.g. 10)"}
                value={adjustQty}
                onChange={e => setAdjustQty(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d1cbbf",
                  width: "100%",
                  fontSize: "1rem",
                  fontWeight: 700,
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Reason Field */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>
                Reason for Adjustment
              </label>
              <input
                type="text"
                placeholder="e.g. Morning vendor shipment received, Physical inventory audit"
                value={adjustReason}
                onChange={e => setAdjustReason(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d1cbbf",
                  width: "100%",
                  fontSize: "0.82rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Min Alert Threshold (Fresh Only) */}
            {adjustClass === "fresh" && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>
                  Min Stock Alert Threshold ({adjustModalItem.unit})
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 15 (leave empty or 0 to disable)"
                  value={adjustMin}
                  onChange={e => setAdjustMin(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d1cbbf",
                    width: "100%",
                    fontSize: "0.82rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            {/* Projected Result Box */}
            <div style={{
              background: "#faf8f5",
              border: "1px solid #ede8e0",
              borderRadius: "10px",
              padding: "12px",
              marginBottom: "18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div>
                <div style={{ fontSize: "0.74rem", color: "#73695b" }}>Current: {currentAdjustBase} {adjustModalItem.unit}</div>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#171410" }}>
                  {adjustOp === "add" && `+ ${parsedAdjustQty} ${adjustModalItem.unit}`}
                  {adjustOp === "reduce" && `- ${parsedAdjustQty} ${adjustModalItem.unit}`}
                  {adjustOp === "set" && `Reconciled`}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.74rem", color: "#73695b" }}>Projected Result:</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#059669", fontFamily: "Outfit, sans-serif" }}>
                  {projectedAdjustResult} {adjustModalItem.unit}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn"
                onClick={() => setAdjustModalItem(null)}
                disabled={submittingAdjust}
                style={{ padding: "8px 16px", borderRadius: "8px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExecuteAdjust}
                disabled={submittingAdjust}
                style={{
                  padding: "8px 20px",
                  borderRadius: "8px",
                  background: adjustOp === "reduce" ? "#dc2626" : adjustOp === "set" ? "#2563eb" : "#059669",
                  borderColor: adjustOp === "reduce" ? "#dc2626" : adjustOp === "set" ? "#2563eb" : "#059669",
                  fontWeight: 700,
                }}
              >
                {submittingAdjust ? "Saving…" : "Save Adjustment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomersTab() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ success: boolean; customers: any[] }>("/store-admin/customers")
      .then(res => {
        if (res.data.success) {
          setCustomers(res.data.customers || []);
        }
      })
      .catch(err => console.warn("Failed to fetch store customers:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#73695b" }}>Loading customers…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#faf8f5", borderBottom: "1px solid #ede8e0" }}>
                {["Name", "Phone", "Total Orders", "Total Spent", "Address", "Last Order"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "#423b32", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={c.phone || i} style={{ borderBottom: i < customers.length - 1 ? "1px solid #ede8e0" : "none" }}>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#171410" }}>{c.name}</td>
                  <td style={{ padding: "14px 16px", color: "#423b32" }}>{c.phone}</td>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#941717" }}>{c.orders}</td>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#059669" }}>₹{c.totalSpent}</td>
                  <td style={{ padding: "14px 16px", color: "#73695b", fontSize: "0.8rem" }}>{c.address}</td>
                  <td style={{ padding: "14px 16px", color: "#73695b", fontSize: "0.8rem" }}>{c.lastOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RidersTab() {
  const [riders, setRiders] = useState<any[]>([]);
  const [readyOrders, setReadyOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Dynamic Rider Compensation Rates & Daily Target
  const [baseDeliveryPay, setBaseDeliveryPay] = useState<number>(65);
  const [distanceIncentive, setDistanceIncentive] = useState<number>(15);
  const [peakHourSurge, setPeakHourSurge] = useState<number>(20);
  const [defaultRiderDailyTarget, setDefaultRiderDailyTarget] = useState<number>(16);
  const [savingPayout, setSavingPayout] = useState(false);
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [draftRates, setDraftRates] = useState({
    baseDeliveryPay: 65,
    distanceIncentive: 15,
    peakHourSurge: 20,
    defaultRiderDailyTarget: 16,
  });

  const isRatesDirty =
    draftRates.baseDeliveryPay !== baseDeliveryPay ||
    draftRates.distanceIncentive !== distanceIncentive ||
    draftRates.peakHourSurge !== peakHourSurge ||
    draftRates.defaultRiderDailyTarget !== defaultRiderDailyTarget;

  // Cash Remittances
  const [remittances, setRemittances] = useState<any[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ridersRes, ordersRes, storeRes, remittancesRes] = await Promise.all([
        api.get<{ success: boolean; riders: any[] }>("/store-admin/riders"),
        api.get<{ success: boolean; orders: any[] }>("/store-admin/orders?status=all"),
        api.get<{ success: boolean; store: any }>("/store-admin/store-status"),
        api.get<{ success: boolean; remittances: any[] }>("/store-admin/remittances").catch(() => ({ data: { success: false, remittances: [] } }))
      ]);
      let relevantOrders: any[] = [];
      if (ordersRes.data.success) {
        // Filter only Ready and Out for Delivery orders that require home delivery (exclude store takeaway)
        relevantOrders = (ordersRes.data.orders || []).filter((o: any) => {
          const isPickup =
            o.fulfillmentType === "pickup" ||
            o.pickupMode === true ||
            o.deliverySlot?.toLowerCase().includes("pickup") ||
            o.customer?.address?.toLowerCase().includes("pickup");
          return (o.status === "Ready" || o.status === "Out for Delivery") && !isPickup;
        });
        setReadyOrders(relevantOrders);
      }
      if (ridersRes.data.success) {
        const outForDeliveryRiderNames = new Set(
          relevantOrders
            .filter((o: any) => o.status === "Out for Delivery")
            .map((o: any) => o.rider?.name?.trim().toLowerCase())
            .filter(Boolean)
        );

        const syncedRiders = (ridersRes.data.riders || []).map((r: any) => {
          const isBusy = outForDeliveryRiderNames.has(r.name?.trim().toLowerCase());
          if (isBusy && r.riderStatus !== "On Delivery") {
            return { ...r, riderStatus: "On Delivery" };
          }
          return r;
        });
        setRiders(syncedRiders);
      }
      if (storeRes.data?.success && storeRes.data?.store) {
        const s = storeRes.data.store;
        if (s.riderPayoutSettings) {
          const ps = s.riderPayoutSettings;
          if (typeof ps.baseDeliveryPay === "number") setBaseDeliveryPay(ps.baseDeliveryPay);
          if (typeof ps.distanceIncentive === "number") setDistanceIncentive(ps.distanceIncentive);
          if (typeof ps.peakHourSurge === "number") setPeakHourSurge(ps.peakHourSurge);
        }
        if (typeof s.defaultRiderDailyTarget === "number") {
          setDefaultRiderDailyTarget(s.defaultRiderDailyTarget);
        }
      }
      if (remittancesRes.data?.success && Array.isArray(remittancesRes.data.remittances)) {
        setRemittances(remittancesRes.data.remittances);
      }
    } catch (err) {
      console.warn("Failed to fetch dispatch data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenRatesModal = () => {
    setDraftRates({
      baseDeliveryPay,
      distanceIncentive,
      peakHourSurge,
      defaultRiderDailyTarget,
    });
    setShowRatesModal(true);
  };

  const handleSavePayoutSettings = async () => {
    if (!isRatesDirty) return;
    setSavingPayout(true);
    try {
      const res = await api.patch<{ success: boolean; store: any }>("/store-admin/store-status", {
        defaultRiderDailyTarget: Number(draftRates.defaultRiderDailyTarget),
        riderPayoutSettings: {
          baseDeliveryPay: Number(draftRates.baseDeliveryPay),
          distanceIncentive: Number(draftRates.distanceIncentive),
          peakHourSurge: Number(draftRates.peakHourSurge),
        },
      });
      if (res.data.success) {
        setBaseDeliveryPay(draftRates.baseDeliveryPay);
        setDistanceIncentive(draftRates.distanceIncentive);
        setPeakHourSurge(draftRates.peakHourSurge);
        setDefaultRiderDailyTarget(draftRates.defaultRiderDailyTarget);
        setShowRatesModal(false);
        toast.success("Rider payout rates & daily target saved. Rider app calculations updated immediately.", "Payout Rates Updated");
      }
    } catch (err) {
      toast.error("Failed to update rider payout rates", "Save Error");
    } finally {
      setSavingPayout(false);
    }
  };

  const handleConfirmRemittance = async (remittanceId: string) => {
    setConfirmingId(remittanceId);
    try {
      const res = await api.patch<{ success: boolean; message: string }>(`/store-admin/remittances/${remittanceId}/confirm`);
      if (res.data.success) {
        toast.success(res.data.message || "Remittance cash confirmed successfully", "Deposit Confirmed");
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to confirm remittance", "Remittance Error");
    } finally {
      setConfirmingId(null);
    }
  };

  const handleAssignRider = async () => {
    if (!selectedOrder || !selectedRiderId) return;
    setSubmitting(true);
    try {
      await api.patch(`/store-admin/orders/${selectedOrder.orderId || selectedOrder.id}/assign-rider`, {
        riderId: selectedRiderId
      });
      toast.success("Rider assigned to order successfully", "Rider Assigned");
      fetchData();
      setShowAssignModal(false);
      setSelectedOrder(null);
      setSelectedRiderId("");
    } catch (err) {
      toast.error("Failed to assign rider to order", "Dispatch Error");
    } finally {
      setSubmitting(false);
    }
  };

  const availableRiders = riders.filter(r => r.riderStatus === "Available");

  return (
    <div>
      {/* ─── RIDER PAYOUT & SURGE INCENTIVE MANAGEMENT (DAILY CONFIGURABLE) ─── */}
      <div style={{
        background: "#fff",
        border: "1px solid #ede8e0",
        borderRadius: "16px",
        padding: "20px 24px",
        marginBottom: "24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined text-[22px]" style={{ color: "#941717" }}>payments</span>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#171410", margin: 0 }}>
                Rider Payout & Delivery Incentive Rates
              </h3>
              <span style={{ fontSize: "0.72rem", background: "#ecfdf5", color: "#059669", fontWeight: 800, padding: "2px 8px", borderRadius: "99px", border: "1px solid #a7f3d0" }}>
                Active & Live Configurable
              </span>
            </div>
            <p style={{ fontSize: "0.8rem", color: "#73695b", margin: "4px 0 0 0" }}>
              Store admin can increase or decrease these delivery compensations any day. Changes reflect live on rider dashboard & trip payouts.
            </p>
          </div>
          <button
            onClick={handleOpenRatesModal}
            style={{
              background: "#941717",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              padding: "9px 18px",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 6px rgba(148,23,23,0.25)",
              transition: "transform 0.15s ease, background 0.15s ease"
            }}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>Edit Rates</span>
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          {/* Card 1: Base Pay */}
          <div style={{ background: "#faf8f5", border: "1px solid #ede8e0", borderRadius: "12px", padding: "16px" }}>
            <span style={{ fontSize: "0.73rem", fontWeight: 800, color: "#73695b", textTransform: "uppercase", display: "block", letterSpacing: "0.5px" }}>
              Per Delivery Base Pay
            </span>
            <div style={{ fontSize: "1.85rem", fontWeight: 900, color: "#171410", marginTop: "4px", lineHeight: 1.1 }}>
              ₹{baseDeliveryPay}
            </div>
            <span style={{ fontSize: "0.73rem", color: "#8a7f72", marginTop: "8px", display: "block" }}>
              Paid to rider for every completed delivery trip
            </span>
          </div>

          {/* Card 2: Distance Incentive */}
          <div style={{ background: "#faf8f5", border: "1px solid #ede8e0", borderRadius: "12px", padding: "16px" }}>
            <span style={{ fontSize: "0.73rem", fontWeight: 800, color: "#73695b", textTransform: "uppercase", display: "block", letterSpacing: "0.5px" }}>
              Distance / Fuel Incentive
            </span>
            <div style={{ fontSize: "1.85rem", fontWeight: 900, color: "#171410", marginTop: "4px", lineHeight: 1.1 }}>
              ₹{distanceIncentive}
            </div>
            <span style={{ fontSize: "0.73rem", color: "#8a7f72", marginTop: "8px", display: "block" }}>
              Extra fuel/distance incentive added per completed delivery
            </span>
          </div>

          {/* Card 3: Peak Hour Surge */}
          <div style={{ background: "#faf8f5", border: "1px solid #ede8e0", borderRadius: "12px", padding: "16px" }}>
            <span style={{ fontSize: "0.73rem", fontWeight: 800, color: "#73695b", textTransform: "uppercase", display: "block", letterSpacing: "0.5px" }}>
              Peak Hour Surge Bonus
            </span>
            <div style={{ fontSize: "1.85rem", fontWeight: 900, color: "#171410", marginTop: "4px", lineHeight: 1.1 }}>
              ₹{peakHourSurge}
            </div>
            <span style={{ fontSize: "0.73rem", color: "#8a7f72", marginTop: "8px", display: "block" }}>
              Added for deliveries during rush hours (12 PM–2 PM & 7 PM–8 PM)
            </span>
          </div>

          {/* Card 4: Daily Target */}
          <div style={{ background: "#faf8f5", border: "1px solid #ede8e0", borderRadius: "12px", padding: "16px" }}>
            <span style={{ fontSize: "0.73rem", fontWeight: 800, color: "#73695b", textTransform: "uppercase", display: "block", letterSpacing: "0.5px" }}>
              Hub Rider Daily Target
            </span>
            <div style={{ fontSize: "1.85rem", fontWeight: 900, color: "#171410", marginTop: "4px", lineHeight: 1.1 }}>
              {defaultRiderDailyTarget} <span style={{ fontSize: "0.95rem", color: "#73695b", fontWeight: 700 }}>Trips</span>
            </div>
            <span style={{ fontSize: "0.73rem", color: "#8a7f72", marginTop: "8px", display: "block" }}>
              Default daily orders target set for active hub riders
            </span>
          </div>
        </div>
      </div>

      {/* ─── CASH REMITTANCE APPROVALS (HUB DEPOSIT) ─── */}
      {remittances.length > 0 && (
        <div style={{
          background: "#fff",
          border: "1px solid #ede8e0",
          borderRadius: "16px",
          padding: "20px 24px",
          marginBottom: "24px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#171410", margin: 0 }}>
                Cash Remittance Counter (COD Deposits)
              </h3>
              <p style={{ fontSize: "0.78rem", color: "#73695b", margin: "2px 0 0 0" }}>
                Physical cash deposits submitted by riders at the hub closing counter
              </p>
            </div>
            {remittances.filter(r => r.status === "Pending").length > 0 && (
              <span style={{ background: "#fef3c7", border: "1px solid #fde68a", color: "#b45309", fontSize: "0.75rem", fontWeight: 800, padding: "3px 10px", borderRadius: "99px" }}>
                {remittances.filter(r => r.status === "Pending").length} Awaiting Confirmation
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {remittances.slice(0, 10).map((rem) => (
              <div key={rem._id || rem.remittanceId} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                background: "#faf8f5",
                borderRadius: "10px",
                border: "1px solid #ede8e0",
                flexWrap: "wrap",
                gap: "8px"
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: 800, color: "#171410", fontSize: "0.95rem" }}>
                      {rem.riderName || "Rider Partner"} ({rem.riderPhone})
                    </span>
                    <Badge
                      label={rem.status}
                      color={rem.status === "Confirmed" ? "#059669" : "#d97706"}
                    />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#73695b", marginTop: "2px" }}>
                    Ref: #{rem.remittanceId} · {new Date(rem.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    {rem.confirmedByName && ` · Confirmed by ${rem.confirmedByName}`}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#059669" }}>
                    ₹{Number(rem.amount).toFixed(2)}
                  </span>
                  {rem.status === "Pending" && (
                    <button
                      onClick={() => handleConfirmRemittance(rem.remittanceId || rem._id)}
                      disabled={confirmingId === (rem.remittanceId || rem._id)}
                      style={{
                        background: "#059669",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "7px 14px",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      <span>{confirmingId === (rem.remittanceId || rem._id) ? "Confirming…" : "Accept Cash"}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── RIDERS POOL ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", marginTop: "12px" }}>
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#171410", margin: 0 }}>Active Rider Pool</h3>
          <p style={{ fontSize: "0.78rem", color: "#73695b", margin: "2px 0 0 0" }}>Delivery partners active in your hub delivery area</p>
        </div>
        {riders.length > 0 && (
          <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "99px", padding: "4px 12px", fontSize: "0.75rem", color: "#059669", fontWeight: 700 }}>
            {availableRiders.length} Available for Dispatch
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "12px", marginBottom: "32px" }}>
        {riders.length === 0 && !loading && (
          <div style={{ padding: "24px", background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", color: "#73695b", fontSize: "0.85rem", textAlign: "center", gridColumn: "1 / -1" }}>
            No riders registered or assigned to this store hub yet.
          </div>
        )}
        {riders.map(r => (
          <div key={r._id || r.id} style={{
            background: "#fff", border: "1px solid #ede8e0", borderRadius: "12px", padding: "16px",
            borderLeft: `4px solid ${r.riderStatus === "Available" ? "#059669" : r.riderStatus === "On Delivery" ? "#0284c7" : "#73695b"}`
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ fontWeight: 800, color: "#171410", fontSize: "1rem" }}>{r.name}</div>
              <Badge label={r.riderStatus || "Unknown"} color={r.riderStatus === "Available" ? "#059669" : r.riderStatus === "On Delivery" ? "#0284c7" : "#73695b"} />
            </div>
            <div style={{ fontSize: "0.8rem", color: "#423b32", marginBottom: "4px" }}>Phone: {r.phone}</div>
            <div style={{ fontSize: "0.75rem", color: "#73695b" }}>Vehicle: {r.vehicleNumber}</div>
          </div>
        ))}
      </div>

      {/* ─── ORDERS READY FOR DISPATCH ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#171410", margin: 0 }}>Orders Pending Dispatch (Home Delivery Only)</h3>
        <span style={{ fontSize: "0.78rem", color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", padding: "3px 10px", borderRadius: "99px", fontWeight: 700 }}>
          Store Pickup orders are excluded (handled at counter)
        </span>
      </div>
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#73695b" }}>Loading dispatch board…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {readyOrders.length === 0 && (
            <div style={{ padding: "24px", background: "#fff", border: "1px solid #ede8e0", borderRadius: "12px", color: "#73695b", textAlign: "center" }}>
              No orders are currently waiting for dispatch.
            </div>
          )}
          {readyOrders.map(o => (
            <div key={o.orderId || o.id} style={{
              background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", padding: "18px 20px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <div style={{ fontWeight: 800, color: "#171410", fontSize: "1rem" }}>#{o.orderId || o.id}</div>
                  <div style={{ fontSize: "0.85rem", color: "#423b32", marginTop: "2px", fontWeight: 600 }}>
                    {o.customer?.name} ({o.customer?.phone})
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#73695b", marginTop: "2px" }}>
                    {o.customer?.address}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ textAlign: "right", marginRight: "8px" }}>
                    <div style={{ fontSize: "1rem", fontWeight: 800, color: "#941717" }}>₹{o.amount}</div>
                    <div style={{ fontSize: "0.75rem", color: "#73695b" }}>{o.paymentMethod}</div>
                  </div>
                  {o.status === "Ready" ? (
                    <button
                      onClick={() => { setSelectedOrder(o); setShowAssignModal(true); }}
                      style={{ background: "#941717", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem" }}
                    >
                      Assign Rider
                    </button>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                      <Badge label="Out for Delivery" color="#0284c7" />
                      <span style={{ fontSize: "0.75rem", color: "#423b32", fontWeight: 600 }}>By: {o.rider?.name || "Unknown"}</span>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: "0.85rem", color: "#423b32", background: "#faf8f5", padding: "10px 12px", borderRadius: "8px" }}>
                <strong>Items:</strong> {o.itemSummary || o.items?.map((item: any) => `${item.name} ×${item.quantity}`).join(", ")}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── ASSIGN RIDER MODAL ─── */}
      {showAssignModal && selectedOrder && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "420px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "1.2rem", fontWeight: 800, color: "#171410" }}>Dispatch Order #{selectedOrder.orderId || selectedOrder.id}</h3>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#423b32", marginBottom: "8px" }}>Select an Available Rider:</label>
              <select
                value={selectedRiderId}
                onChange={e => setSelectedRiderId(e.target.value)}
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ccc", background: "#fff", fontSize: "0.95rem" }}
              >
                <option value="">-- Choose Rider --</option>
                {availableRiders.map(r => (
                  <option key={r._id || r.id} value={r._id || r.id}>{r.name} ({r.vehicleNumber})</option>
                ))}
              </select>
              {availableRiders.length === 0 && (
                <p style={{ color: "#dc2626", fontSize: "0.8rem", marginTop: "8px", fontWeight: 600 }}>
                  There are no available riders right now. Please wait until a rider completes their delivery or comes online.
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                className="btn"
                disabled={submitting}
                onClick={() => { setShowAssignModal(false); setSelectedOrder(null); setSelectedRiderId(""); }}
                style={{ padding: "9px 18px", borderRadius: "8px", background: "#f5f3ef", border: "1px solid #ede8e0", fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                disabled={submitting || !selectedRiderId}
                onClick={handleAssignRider}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  background: !selectedRiderId ? "#ccc" : "#941717",
                  color: "#fff",
                  border: "none",
                  fontWeight: 700,
                  cursor: !selectedRiderId ? "not-allowed" : "pointer",
                  fontSize: "0.875rem",
                }}
              >
                {submitting ? "Assigning…" : "Dispatch Order"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── EDIT RIDER PAYOUT & INCENTIVES MODAL ─── */}
      {showRatesModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
          display: "flex", justifyContent: "center", alignItems: "center",
          zIndex: 1000, padding: "16px"
        }}>
          <div style={{
            background: "#fff",
            borderRadius: "20px",
            width: "100%",
            maxWidth: "520px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            overflow: "hidden"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #ede8e0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#faf8f5"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: "#fdf2f2",
                  border: "1px solid #fecaca",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <span className="material-symbols-outlined text-[20px]" style={{ color: "#941717" }}>tune</span>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#171410" }}>
                    Configure Rider Payout & Incentives
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "0.75rem", color: "#73695b" }}>
                    Set daily rates for delivery trips, fuel incentive, peak surge & targets
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRatesModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#8a7f72",
                  padding: "6px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Field 1: Base Pay */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                  <span>Per Delivery Base Pay</span>
                  <span style={{ fontSize: "0.75rem", color: "#73695b", fontWeight: 600 }}>Current: ₹{baseDeliveryPay}</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
                  <span style={{ position: "absolute", left: "14px", fontWeight: 800, color: "#171410", fontSize: "1.1rem" }}>₹</span>
                  <input
                    type="number"
                    min={0}
                    value={draftRates.baseDeliveryPay}
                    onChange={(e) => setDraftRates({ ...draftRates, baseDeliveryPay: Math.max(0, Number(e.target.value)) })}
                    style={{
                      width: "100%",
                      padding: "10px 14px 10px 32px",
                      borderRadius: "10px",
                      border: "1.5px solid #d4cdc5",
                      fontWeight: 800,
                      fontSize: "1.05rem",
                      color: "#171410",
                      background: "#fff",
                      outline: "none"
                    }}
                  />
                </div>
                <span style={{ fontSize: "0.72rem", color: "#8a7f72", marginTop: "4px", display: "block" }}>
                  Fixed payout credited to rider for every completed delivery run
                </span>
              </div>

              {/* Field 2: Distance Incentive */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                  <span>Distance / Fuel Incentive</span>
                  <span style={{ fontSize: "0.75rem", color: "#73695b", fontWeight: 600 }}>Current: ₹{distanceIncentive}</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
                  <span style={{ position: "absolute", left: "14px", fontWeight: 800, color: "#171410", fontSize: "1.1rem" }}>₹</span>
                  <input
                    type="number"
                    min={0}
                    value={draftRates.distanceIncentive}
                    onChange={(e) => setDraftRates({ ...draftRates, distanceIncentive: Math.max(0, Number(e.target.value)) })}
                    style={{
                      width: "100%",
                      padding: "10px 14px 10px 32px",
                      borderRadius: "10px",
                      border: "1.5px solid #d4cdc5",
                      fontWeight: 800,
                      fontSize: "1.05rem",
                      color: "#171410",
                      background: "#fff",
                      outline: "none"
                    }}
                  />
                </div>
                <span style={{ fontSize: "0.72rem", color: "#8a7f72", marginTop: "4px", display: "block" }}>
                  Additional fuel allowance added per completed delivery
                </span>
              </div>

              {/* Field 3: Peak Hour Surge */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                  <span>Peak Hour Surge Bonus</span>
                  <span style={{ fontSize: "0.75rem", color: "#73695b", fontWeight: 600 }}>Current: ₹{peakHourSurge}</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
                  <span style={{ position: "absolute", left: "14px", fontWeight: 800, color: "#171410", fontSize: "1.1rem" }}>₹</span>
                  <input
                    type="number"
                    min={0}
                    value={draftRates.peakHourSurge}
                    onChange={(e) => setDraftRates({ ...draftRates, peakHourSurge: Math.max(0, Number(e.target.value)) })}
                    style={{
                      width: "100%",
                      padding: "10px 14px 10px 32px",
                      borderRadius: "10px",
                      border: "1.5px solid #d4cdc5",
                      fontWeight: 800,
                      fontSize: "1.05rem",
                      color: "#171410",
                      background: "#fff",
                      outline: "none"
                    }}
                  />
                </div>
                <span style={{ fontSize: "0.72rem", color: "#8a7f72", marginTop: "4px", display: "block" }}>
                  Added for rush hour deliveries (12 PM–2 PM & 7 PM–8 PM)
                </span>
              </div>

              {/* Field 4: Hub Daily Target */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                  <span>Hub Rider Daily Target</span>
                  <span style={{ fontSize: "0.75rem", color: "#73695b", fontWeight: 600 }}>Current: {defaultRiderDailyTarget} Trips</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="number"
                    min={1}
                    value={draftRates.defaultRiderDailyTarget}
                    onChange={(e) => setDraftRates({ ...draftRates, defaultRiderDailyTarget: Math.max(1, Number(e.target.value)) })}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1.5px solid #d4cdc5",
                      fontWeight: 800,
                      fontSize: "1.05rem",
                      color: "#171410",
                      background: "#fff",
                      outline: "none"
                    }}
                  />
                  <span style={{ fontWeight: 800, color: "#73695b", fontSize: "0.9rem", paddingRight: "4px" }}>Trips</span>
                </div>
                <span style={{ fontSize: "0.72rem", color: "#8a7f72", marginTop: "4px", display: "block" }}>
                  Default daily completed trips target shown in rider mobile app
                </span>
              </div>

              {/* Status pill: Dirty or unchanged */}
              <div style={{
                padding: "10px 14px",
                borderRadius: "10px",
                background: isRatesDirty ? "#ecfdf5" : "#faf8f5",
                border: isRatesDirty ? "1px solid #a7f3d0" : "1px solid #ede8e0",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.78rem",
                color: isRatesDirty ? "#065f46" : "#73695b",
                fontWeight: 600
              }}>
                <span className="material-symbols-outlined text-[18px]">
                  {isRatesDirty ? "check_circle" : "info"}
                </span>
                <span>
                  {isRatesDirty
                    ? "Changes detected. Click 'Save New Rates' to apply immediately to all riders."
                    : "No changes made yet. Edit any field above to enable saving."}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "16px 24px",
              background: "#faf8f5",
              borderTop: "1px solid #ede8e0",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px"
            }}>
              <button
                type="button"
                disabled={savingPayout}
                onClick={() => setShowRatesModal(false)}
                style={{
                  padding: "9px 18px",
                  borderRadius: "10px",
                  background: "#fff",
                  border: "1px solid #ede8e0",
                  color: "#423b32",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!isRatesDirty || savingPayout}
                onClick={handleSavePayoutSettings}
                style={{
                  padding: "9px 20px",
                  borderRadius: "10px",
                  background: !isRatesDirty || savingPayout ? "#e5e7eb" : "#941717",
                  color: !isRatesDirty || savingPayout ? "#9ca3af" : "#fff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: !isRatesDirty || savingPayout ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: !isRatesDirty || savingPayout ? "none" : "0 2px 6px rgba(148,23,23,0.25)",
                  transition: "all 0.15s ease"
                }}
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                <span>{savingPayout ? "Saving…" : "Save New Rates"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReturnsTab() {
  const [requests, setRequests] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRiderMap, setSelectedRiderMap] = useState<Record<string, string>>({});
  const [otpInputMap, setOtpInputMap] = useState<Record<string, string>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const fetchReturns = () => {
    setLoading(true);
    api.get<{ success: boolean; returns: any[] }>("/store-admin/returns")
      .then(res => {
        if (res.data.success) {
          setRequests(res.data.returns || []);
        }
      })
      .catch(err => console.warn("Failed to fetch returns:", err))
      .finally(() => setLoading(false));
  };

  const fetchRiders = () => {
    api.get<{ success: boolean; riders: any[] }>("/store-admin/riders")
      .then(res => {
        if (res.data.success) {
          setRiders(res.data.riders || []);
        }
      })
      .catch(err => console.warn("Failed to fetch riders:", err));
  };

  useEffect(() => {
    fetchReturns();
    fetchRiders();
  }, []);

  const updateStatus = async (requestId: string, status: string) => {
    try {
      await api.patch(`/store-admin/returns/${requestId}/status`, { status });
      toast.success(`Exchange status updated to: ${status}`, "Request Updated");
      fetchReturns();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update exchange status", "Exchange Error");
    }
  };

  const assignRider = async (requestId: string) => {
    const riderId = selectedRiderMap[requestId];
    if (!riderId) {
      toast.error("Please select a rider from the dropdown to assign for reverse pickup", "Rider Required");
      return;
    }
    try {
      await api.patch(`/store-admin/returns/${requestId}/assign-rider`, { riderId });
      toast.success("Rider assigned for reverse pickup successfully", "Rider Dispatched");
      fetchReturns();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to assign rider", "Assignment Error");
    }
  };

  const verifyOtpAndComplete = async (requestId: string) => {
    const otp = otpInputMap[requestId];
    if (!otp || otp.trim().length !== 4) {
      toast.error("Please enter the 4-digit reverse pickup OTP provided by customer", "OTP Required");
      return;
    }
    setVerifyingId(requestId);
    try {
      await api.post(`/store-admin/returns/${requestId}/verify-otp`, { otp: otp.trim() });
      toast.success("Return verified! Meat routed to Waste Inventory & Customer refunded.", "Return Completed");
      fetchReturns();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Invalid 4-digit OTP code", "Verification Failed");
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div>
      <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "12px", padding: "14px 18px", marginBottom: "24px", fontSize: "0.875rem", color: "#92400e", display: "flex", alignItems: "center", gap: "10px" }}>
        <FontAwesomeIcon icon={faClock} style={{ color: "#d97706", fontSize: "1.1rem" }} />
        <div>
          <strong>60-Minute Fresh Meat Policy & Reverse Pickup:</strong> All return and exchange requests must be initiated within 60 minutes of delivery. Under FSSAI compliance, returned meat is automatically logged to <strong>Damaged/Waste Inventory</strong> and never restocked to fresh batches.
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#73695b" }}>Loading returns…</div>
      ) : requests.length === 0 ? (
        <div style={{ background: "#fff", padding: "40px", textAlign: "center", borderRadius: "14px", border: "1px solid #ede8e0" }}>
          No pending return or exchange tickets.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {requests.map(r => {
            const reqId = r.requestId || r.id;
            return (
              <div key={reqId} style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <div style={{ fontWeight: 800, color: "#171410", fontSize: "1rem" }}>#{reqId} — {r.customer}</div>
                    <div style={{ color: "#73695b", fontSize: "0.8rem", marginTop: "2px" }}>Order: #{r.orderId} · Phone: {r.phone || "—"}</div>
                  </div>
                  <Badge
                    label={r.status}
                    color={
                      r.status === "Completed" ? "#059669" :
                      r.status === "Pickup Assigned" || r.status === "Approved" ? "#0284c7" :
                      r.status === "Rejected" ? "#941717" : "#d97706"
                    }
                  />
                </div>

                <div style={{ color: "#423b32", fontSize: "0.875rem", marginBottom: "4px" }}>
                  <strong>Items:</strong> {r.items}
                </div>
                <div style={{ color: "#73695b", fontSize: "0.8rem", marginBottom: "12px" }}>
                  <strong>Reason:</strong> {r.reason}
                </div>

                {/* 4-Digit Handover OTP Badge */}
                {r.returnOtp && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "6px 12px", marginBottom: "12px", fontSize: "0.825rem", color: "#0f172a" }}>
                    <FontAwesomeIcon icon={faKey} style={{ color: "#0284c7" }} />
                    <span>Customer Handover OTP: <strong style={{ color: "#941717", letterSpacing: "1.5px", fontSize: "0.95rem" }}>{r.returnOtp}</strong></span>
                  </div>
                )}

                {/* Assigned Rider Info */}
                {r.rider && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "6px 12px", marginBottom: "12px", fontSize: "0.825rem", color: "#166534" }}>
                    <FontAwesomeIcon icon={faMotorcycle} style={{ color: "#16a34a" }} />
                    <span>Pickup Partner: <strong>{r.rider.name}</strong> ({r.rider.phone || r.rider.vehicleNumber || "Insulated Partner"})</span>
                  </div>
                )}

                {/* Completed info banner */}
                {r.status === "Completed" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "8px", padding: "8px 12px", fontSize: "0.825rem", color: "#065f46" }}>
                    <FontAwesomeIcon icon={faTrashCan} style={{ color: "#059669" }} />
                    <span>Returned meat safely routed to <strong>Waste Inventory</strong> · Customer TeFFe Wallet Refunded ₹{r.refundAmount || 0}</span>
                  </div>
                )}

                {/* Action Row for Pending Review */}
                {r.status === "Pending Review" && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => updateStatus(reqId, "Approved")}
                      style={{ background: "#059669", border: "none", borderRadius: "8px", padding: "8px 18px", color: "#fff", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <FontAwesomeIcon icon={faCheck} />
                      Approve Return
                    </button>
                    <button
                      onClick={() => updateStatus(reqId, "Rejected")}
                      style={{ background: "#fdf2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "8px 18px", color: "#941717", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <FontAwesomeIcon icon={faXmark} />
                      Reject
                    </button>
                  </div>
                )}

                {/* Action Row for Approved / Pickup Assigned: Assign Rider or Verify OTP */}
                {(r.status === "Approved" || r.status === "Pickup Assigned") && (
                  <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <select
                        value={selectedRiderMap[reqId] || ""}
                        onChange={(e) => setSelectedRiderMap(prev => ({ ...prev, [reqId]: e.target.value }))}
                        style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "7px 12px", fontSize: "0.825rem", background: "#fff", minWidth: "220px", color: "#334155" }}
                      >
                        <option value="">-- Select Rider for Pickup --</option>
                        {riders.map(rd => (
                          <option key={rd._id || rd.id} value={rd._id || rd.id}>
                            {rd.name} ({rd.phone || rd.riderStatus || "Available"})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => assignRider(reqId)}
                        style={{ background: "#0284c7", border: "none", borderRadius: "8px", padding: "8px 16px", color: "#fff", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <FontAwesomeIcon icon={faMotorcycle} />
                        Assign Pickup Partner
                      </button>
                    </div>

                    {/* Verify 4-digit OTP handover box */}
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", paddingTop: "8px", borderTop: "1px dashed #e2e8f0" }}>
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="Enter 4-digit OTP"
                        value={otpInputMap[reqId] || ""}
                        onChange={(e) => setOtpInputMap(prev => ({ ...prev, [reqId]: e.target.value }))}
                        style={{ border: "1px solid #cbd5e1", borderRadius: "8px", padding: "7px 12px", fontSize: "0.825rem", width: "160px", letterSpacing: "1px", fontWeight: 700, textAlign: "center" }}
                      />
                      <button
                        disabled={verifyingId === reqId}
                        onClick={() => verifyOtpAndComplete(reqId)}
                        style={{ background: "#059669", border: "none", borderRadius: "8px", padding: "8px 16px", color: "#fff", fontSize: "0.8rem", fontWeight: 700, cursor: verifyingId === reqId ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <FontAwesomeIcon icon={faCheck} />
                        {verifyingId === reqId ? "Verifying..." : "Verify OTP & Complete Pickup"}
                      </button>
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        (Automatically logs meat to Waste Stock & credits Customer Wallet)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Store Admin Page ──────────────────────────────────────────────────────
export default function StoreAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [storeData, setStoreData] = useState<any>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [incomingOrders, setIncomingOrders] = useState<any[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const acknowledgedIdsRef = React.useRef<Set<string>>(new Set());

  // Load persistently acknowledged orders from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("teffes_acked_order_ids");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          acknowledgedIdsRef.current = new Set(parsed);
        }
      }
    } catch { }
  }, []);

  // Auto-collapse sidebar on tablet/mobile
  useEffect(() => {
    const checkWidth = () => {
      const mobile = window.innerWidth < 992;
      setIsMobile(mobile);
      setSidebarCollapsed(mobile);
    };
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  useEffect(() => {
    api.get<{ success: boolean; store: any }>("/store-admin/store-status")
      .then(res => {
        if (res.data.success && res.data.store) {
          setStoreData(res.data.store);
        }
      })
      .catch(err => console.warn("Failed to load store status:", err));
  }, []);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored || (stored.role !== "storeadmin" && stored.role !== "superadmin" && stored.role !== "admin")) {
      router.push("/admin-login");
      return;
    }
    setUser(stored);
  }, [router]);

  // Real-time alarm listener for new incoming orders
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    const currentStoreId = user.storeId || "S001";

    // Join store-specific room
    if (currentStoreId) {
      socket.emit("join:store", currentStoreId);
    }
    if (user.role) {
      socket.emit("join:role", user.role);
    }

    const onOrderCreated = (data: any) => {
      const order = data.order || data;
      const orderId = order.orderId;
      if (!orderId || acknowledgedIdsRef.current.has(orderId)) return;

      // ─── STRICT STORE ISOLATION ───
      // Ignore orders that do not belong to this store (unless superadmin)
      const isStoreMatch =
        order.storeId === currentStoreId ||
        ((order.storeId === "S002" || order.storeId === "S004") &&
          (currentStoreId === "S002" || currentStoreId === "S004"));
      if (order.storeId && !isStoreMatch && user.role !== "superadmin") {
        return;
      }

      setIncomingOrders((prev) => {
        if (prev.some((o) => o.orderId === orderId)) return prev;
        return [order, ...prev];
      });

      if (!isMuted) {
        orderAlarm.startAlarm();
      }
      toast.info(`New Order #${orderId} received! Total: ₹${order.amount || order.totalAmount || 0}`, "New Order Alert");
    };

    socket.on("order:created", onOrderCreated);

    // Initial check and 12-second polling redundancy for Pending orders
    const checkPendingOrders = () => {
      api.get<{ success: boolean; orders: any[] }>(`/store-admin/orders?status=Pending&storeId=${currentStoreId}`)
        .then((res) => {
          if (res.data.success && Array.isArray(res.data.orders)) {
            const unacked = res.data.orders.filter((o) => !acknowledgedIdsRef.current.has(o.orderId));
            if (unacked.length > 0) {
              setIncomingOrders(unacked);
              if (!isMuted && !orderAlarm.getIsRinging()) {
                orderAlarm.startAlarm();
              }
            } else {
              setIncomingOrders([]);
              orderAlarm.stopAlarm();
            }
          }
        })
        .catch(() => { });
    };

    checkPendingOrders();
    const pollInterval = setInterval(checkPendingOrders, 12000);

    return () => {
      if (currentStoreId) {
        socket.emit("leave:store", currentStoreId);
      }
      socket.off("order:created", onOrderCreated);
      clearInterval(pollInterval);
      orderAlarm.stopAlarm();
    };
  }, [isMuted, user]);

  const handleLogout = () => {
    clearAuth();
    router.push("/admin-login");
  };

  const handleTestAlarmSound = () => {
    orderAlarm.playChime();
    toast.success("Chime played! Speakers and audio alerts are fully functional.", "Audio Test Successful");
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (incomingOrders.length > 0) {
        orderAlarm.startAlarm();
      }
      toast.info("Audio alarm unmuted");
    } else {
      setIsMuted(true);
      orderAlarm.stopAlarm();
      toast.info("Audio alarm muted for this session");
    }
  };

  const acknowledgeAllIncoming = async () => {
    const ordersToAck = [...incomingOrders];

    // 1. Immediately silence alarm and clear banner UI
    ordersToAck.forEach((o) => {
      if (o.orderId) acknowledgedIdsRef.current.add(o.orderId);
    });
    setIncomingOrders([]);
    orderAlarm.stopAlarm();

    // 2. Persist acknowledged IDs to localStorage (up to last 100 orders)
    try {
      const idsArray = Array.from(acknowledgedIdsRef.current).slice(-100);
      localStorage.setItem("teffes_acked_order_ids", JSON.stringify(idsArray));
    } catch { }

    // 3. Update database status of each acknowledged order to 'Cutting'
    toast.info("Acknowledging orders and moving to Cutting…", "Order Accepted");
    try {
      await Promise.all(
        ordersToAck.map(async (o) => {
          const id = o.orderId || o.id || o._id;
          if (id) {
            await api.patch(`/store-admin/orders/${id}/status`, { status: "Cutting" }).catch(() => { });
          }
        })
      );
      toast.success("Orders moved to Cutting queue in Live Orders", "Orders Acknowledged");
      // Trigger order refresh event so orders tab updates automatically
      const socket = getSocket();
      socket.emit("orders:refresh");
    } catch (err) {
      console.warn("Failed to update order status to Cutting:", err);
    }
  };

  if (!user) return null;



  const tabComponents: Record<string, React.ReactNode> = {
    dashboard: <DashboardTab setActiveTab={setActiveTab} />,
    orders: <LiveOrdersTab />,
    products: <ProductsStockTab />,
    cross_sell: <CrossSellTab />,
    inventory: <InventoryTab />,
    customers: <CustomersTab />,
    riders: <RidersTab />,
    returns: <ReturnsTab />,
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#faf8f5", fontFamily: "Inter, sans-serif" }}>
      {/* ─── Sidebar ─────────────────────────────────────────────── */}
      <aside style={{
        width: sidebarCollapsed ? "68px" : "240px",
        background: "linear-gradient(180deg, #0a1628 0%, #1a1210 100%)",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        transition: "width 280ms cubic-bezier(0.16,1,0.3,1)",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
        overflowX: "hidden",
      }}>
        {/* Logo */}
        <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img
              src="/teffes-logo-white.png"
              alt="TeFFe's"
              style={{
                height: sidebarCollapsed ? "32px" : "42px",
                width: "auto",
                objectFit: "contain",
                display: "block",
                transition: "height 280ms ease",
                maxWidth: sidebarCollapsed ? "40px" : "160px",
              }}
            />
          </div>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: "12px 8px" }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                title={sidebarCollapsed ? tab.label : ""}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 10px",
                  borderRadius: "10px",
                  border: "none",
                  background: isActive ? "rgba(148,23,23,0.8)" : "transparent",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.7)",
                  cursor: "pointer",
                  textAlign: "left",
                  marginBottom: "2px",
                  transition: "all 150ms ease",
                  fontSize: "0.875rem",
                  fontWeight: isActive ? 700 : 500,
                  boxShadow: isActive ? "0 4px 12px rgba(148,23,23,0.35)" : "none",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                }}
              >
                <span className="material-symbols-outlined text-[20px] shrink-0">{tab.icon}</span>
                {!sidebarCollapsed && <span>{tab.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse Toggle + User Info / Sign Out */}
        <div style={{ padding: "12px 8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {/* User info — only when expanded */}
          {!sidebarCollapsed && (
            <div style={{ padding: "10px", background: "rgba(255,255,255,0.07)", borderRadius: "10px", marginBottom: "8px", textAlign: "center" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
            </div>
          )}

          {/* Change Password button */}
          <button
            onClick={() => setShowChangePassword(true)}
            title="Change Password"
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.09)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "8px",
              padding: "9px",
              color: "#fff",
              cursor: "pointer",
              fontSize: sidebarCollapsed ? "1rem" : "0.82rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "7px",
              marginBottom: "8px",
              transition: "background 150ms ease",
            }}
          >
            <span className="material-symbols-outlined text-[17px]">lock_reset</span>
            {!sidebarCollapsed && <span>Change Password</span>}
          </button>
          {/* Sign Out button — below user profile card with matching styling */}
          <button
            onClick={handleLogout}
            title="Sign Out"
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: "8px",
              padding: "9px",
              color: "#f87171",
              cursor: "pointer",
              fontSize: sidebarCollapsed ? "1rem" : "0.82rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "8px",
              transition: "all 150ms ease",
            }}
          >
            <FontAwesomeIcon icon={faPowerOff} style={{ fontSize: "0.88rem", color: "#ef4444" }} />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>

          {/* Collapse toggle — hide on mobile where sidebar is always icon-only */}
          {!isMobile && (
            <button
              onClick={() => setSidebarCollapsed(v => !v)}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.07)",
                border: "none",
                borderRadius: "8px",
                padding: "7px",
                color: "rgba(255,255,255,0.6)",
                cursor: "pointer",
                fontSize: "0.78rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              {sidebarCollapsed ? "→" : "← Collapse"}
            </button>
          )}
        </div>
      </aside>

      {/* ─── Main Content ────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: isMobile ? "16px" : "32px", overflowY: "auto", minWidth: 0 }}>
        {/* CSS Keyframes for Alarm Bell Shake & Glowing Pulse */}
        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes bellRing {
            0%, 100% { transform: rotate(0deg); }
            15% { transform: rotate(18deg) scale(1.1); }
            30% { transform: rotate(-18deg) scale(1.1); }
            45% { transform: rotate(14deg); }
            60% { transform: rotate(-14deg); }
            75% { transform: rotate(8deg); }
          }
          @keyframes pulseGlow {
            0%, 100% { box-shadow: 0 4px 20px rgba(153, 27, 27, 0.4); border-color: #ef4444; }
            50% { box-shadow: 0 4px 30px rgba(239, 68, 68, 0.8); border-color: #fca5a5; }
          }
          .animate-bell-ring {
            display: inline-block;
            animation: bellRing 1.2s infinite ease-in-out;
            transform-origin: top center;
          }
          .animate-pulse-glow {
            animation: pulseGlow 1.8s infinite ease-in-out;
          }
        `}} />

        {/* ─── Active Incoming Order Alarm Banner ────────────────────────────── */}
        {incomingOrders.length > 0 && (
          <div
            className="animate-pulse-glow"
            style={{
              background: "linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)",
              color: "#fff",
              borderRadius: "14px",
              padding: "16px 20px",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
              border: "2px solid #ef4444",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined text-[28px] animate-bell-ring" style={{ color: "#fef08a" }}>
                  notifications_active
                </span>
              </div>
              <div>
                <div style={{ fontSize: "1.1rem", fontWeight: 900, display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>NEW ORDER RECEIVED!</span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      background: "#fef08a",
                      color: "#854d0e",
                      padding: "2px 8px",
                      borderRadius: "99px",
                      fontWeight: 800,
                    }}
                  >
                    {incomingOrders.length} PENDING
                  </span>
                </div>
                <div style={{ fontSize: "0.85rem", opacity: 0.95, marginTop: "3px" }}>
                  Order #{incomingOrders[0]?.orderId} · ₹{incomingOrders[0]?.amount} · {incomingOrders[0]?.items?.length || 1} item(s) · {incomingOrders[0]?.customer?.name || "Customer"} ({incomingOrders[0]?.fulfillmentType === "pickup" ? "Store Pickup" : "Delivery"})
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={toggleMute}
                style={{
                  background: isMuted ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "10px",
                  padding: "8px 14px",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "background 150ms ease",
                }}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isMuted ? "volume_off" : "volume_up"}
                </span>
                <span>{isMuted ? "Unmute Alarm" : "Mute Sound"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("orders");
                  orderAlarm.stopAlarm();
                }}
                style={{
                  background: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  padding: "8px 16px",
                  color: "#991b1b",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                }}
              >
                <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                <span>View in Live Orders</span>
              </button>

              <button
                type="button"
                onClick={acknowledgeAllIncoming}
                style={{
                  background: "#10b981",
                  border: "none",
                  borderRadius: "10px",
                  padding: "8px 16px",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                }}
              >
                <span className="material-symbols-outlined text-[18px]">done_all</span>
                <span>Acknowledge</span>
              </button>
            </div>
          </div>
        )}

        {/* Unified Page Header */}
        {(() => {
          const currentTab = TABS.find((t) => t.key === activeTab);
          return (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "22px",
                paddingBottom: "14px",
                borderBottom: "1px solid #ede8e0",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <div>
                <h1
                  style={{
                    fontSize: "1.35rem",
                    fontWeight: 800,
                    color: "#171410",
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    lineHeight: 1.2,
                  }}
                >
                  <span className="material-symbols-outlined text-[22px]" style={{ color: "#941717" }}>
                    {currentTab?.icon}
                  </span>
                  <span>{currentTab?.label}</span>
                </h1>
                {currentTab?.sub && (
                  <p
                    style={{
                      fontSize: "0.825rem",
                      color: "#73695b",
                      margin: "4px 0 0 0",
                    }}
                  >
                    {currentTab.sub}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleTestAlarmSound}
                  title="Test audio alert chime and confirm speaker volume"
                  style={{
                    background: "#fff",
                    border: "1px solid #ede8e0",
                    borderRadius: "10px",
                    padding: "8px 14px",
                    fontSize: "0.8rem",
                    color: "#73695b",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    transition: "all 150ms ease",
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]" style={{ color: "#941717" }}>
                    volume_up
                  </span>
                  <span>Test Alarm</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(true)}
                  title="Click to toggle Store Online/Paused or update timings & notices"
                  style={{
                    background: storeData?.isOpen === false ? "#fef2f2" : "#ecfdf5",
                    border: `1.5px solid ${storeData?.isOpen === false ? "#fecaca" : "#a7f3d0"}`,
                    borderRadius: "10px",
                    padding: "8px 14px",
                    fontSize: "0.8rem",
                    color: storeData?.isOpen === false ? "#dc2626" : "#059669",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    transition: "all 150ms ease",
                  }}
                >
                  <span
                    style={{
                      width: "9px",
                      height: "9px",
                      borderRadius: "99px",
                      background: storeData?.isOpen === false ? "#ef4444" : "#10b981",
                      display: "inline-block",
                    }}
                  />
                  <span>{storeData?.isOpen === false ? "Store Paused" : "Store Open"}</span>
                  <span className="material-symbols-outlined text-[16px]">tune</span>
                </button>
                <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "10px", padding: "8px 14px", fontSize: "0.8rem", color: "#73695b", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                  <span>{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Tab Content */}
        {tabComponents[activeTab]}

        {/* Operational Control Modal */}
        <StoreStatusModal
          isOpenModal={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          onStatusChange={(updatedStore) => setStoreData(updatedStore)}
        />

        {/* Change Password Modal */}
        <ChangePasswordModal
          isOpen={showChangePassword}
          onClose={() => setShowChangePassword(false)}
          userEmail={user?.email}
          userName={user?.name}
        />
      </main>
    </div>
  );
}
