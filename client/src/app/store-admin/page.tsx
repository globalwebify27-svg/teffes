"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
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
import StoreAdminInventoryLogsTab from "@/components/store-admin/InventoryLogsTab";
import StoreTransfersSection from "@/components/store-admin/StoreTransfersSection";
import Pagination from "@/components/common/Pagination";
import StoreScheduleTab from "@/components/store-admin/StoreScheduleTab";
import OrderEditModal from "@/components/store-admin/OrderEditModal";
import DateFilterDropdown from "@/components/store-admin/DateFilterDropdown";

// ─── Sidebar tabs ─────────────────────────────────────────────────────────────
const TABS = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard", sub: "Live overview of today's orders, revenue, and inventory" },
  { key: "orders", label: "Live Orders", icon: "local_shipping", sub: "Manage today's orders from cutting to customer delivery" },
  { key: "schedule", label: "Operating Schedule", icon: "calendar_month", sub: "Manage today's special hours, half-day, late openings, or future holiday timings" },
  { key: "products", label: "Products & Stock", icon: "restaurant", sub: "Toggle live availability of fresh cuts for your store" },
  { key: "cross_sell", label: "Cross-Selling", icon: "shopping_basket", sub: "Manage addon products shown to customers in cart" },
  { key: "inventory", label: "Inventory", icon: "inventory_2", sub: "Track fresh stock levels and morning fresh batches" },
  { key: "inventory_logs", label: "Inventory Logs", icon: "history", sub: "Audit trail of fresh stock additions, thawing, order deductions, and waste" },
  { key: "customers", label: "Customers", icon: "group", sub: "Directory of customers who ordered from your store" },
  { key: "riders", label: "Riders & Dispatch", icon: "two_wheeler", sub: "Assign ready orders to available delivery partners" },
  { key: "returns", label: "Returns & Exchange", icon: "swap_horiz", sub: "Process customer exchange requests under the 60-minute policy" },
];

// Helper to extract specific hour slot (e.g., '07:00 AM – 09:00 AM') while omitting generic on-demand labels
const getSpecificDeliverySlot = (slot?: string, scheduledDeliveryDate?: string, targetDeliveryTime?: string) => {
  if (!slot || typeof slot !== "string") return null;
  let s = slot.trim();
  const isGeneric = /^\s*(60\s*min|90\s*min|express|standard|home\s*delivery|store\s*pickup|pickup)\b/i.test(s) && !/(am|pm|\d{1,2}:\d{2})/i.test(s);
  if (isGeneric) return null;
  if (/(am|pm|\d{1,2}:\d{2}|\d{1,2}\s*(am|pm)?\s*[-–—to]\s*\d{1,2}\s*(am|pm))/i.test(s)) {
    // If slot says "Tomorrow" but delivery is scheduled for today in IST:
    const now = new Date();
    const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const todayIST = `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${String(ist.getUTCDate()).padStart(2, '0')}`;
    let targetIST = scheduledDeliveryDate || "";
    if (!targetIST && targetDeliveryTime) {
      const dt = new Date(targetDeliveryTime);
      if (!isNaN(dt.getTime())) {
        const dtIST = new Date(dt.getTime() + (5.5 * 60 * 60 * 1000));
        targetIST = `${dtIST.getUTCFullYear()}-${String(dtIST.getUTCMonth() + 1).padStart(2, '0')}-${String(dtIST.getUTCDate()).padStart(2, '0')}`;
      }
    }
    if ((!targetIST || targetIST <= todayIST) && /tomorrow/i.test(s)) {
      s = s.replace(/Next-Day Delivery:\s*Tomorrow/i, "Morning Delivery: Today").replace(/Tomorrow/i, "Today");
    }
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
  hasInfo = false,
  infoText = "",
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  color?: string;
  onClick?: () => void;
  hasInfo?: boolean;
  infoText?: string;
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
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
          title={infoText || label}
        >
          <span>{label}</span>
          {(hasInfo || infoText) && (
            <span
              className="material-symbols-outlined text-[13px] text-gray-400 hover:text-gray-700 cursor-help"
              style={{ display: "inline-block", verticalAlign: "middle" }}
              title={infoText || label}
            >
              info
            </span>
          )}
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
    <div
      className="no-scrollbar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        overflowX: "auto",
        whiteSpace: "nowrap",
        flexWrap: "nowrap",
        WebkitOverflowScrolling: "touch",
        maxWidth: "100%",
        padding: "2px 0",
      }}
    >
      {stages.map((s, i) => (
        <React.Fragment key={s}>
          <div style={{
            fontSize: "0.68rem",
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: "99px",
            background: i <= idx ? "#941717" : "#ede8e0",
            color: i <= idx ? "#fff" : "#73695b",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}>{s}</div>
          {i < stages.length - 1 && <span style={{ color: "#d6cec5", fontSize: "0.7rem", flexShrink: 0 }}>→</span>}
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

let cachedStoreDashboardData: { range: string; kpis: any[]; latestOrders: any[] } | null = null;

function DashboardTab({ setActiveTab }: { setActiveTab: (t: string) => void }) {
  const [timeRange, setTimeRange] = useState("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [kpis, setKpis] = useState<any[]>(cachedStoreDashboardData?.range === "today" ? cachedStoreDashboardData.kpis : []);
  const [latestOrders, setLatestOrders] = useState<any[]>(cachedStoreDashboardData?.range === "today" ? cachedStoreDashboardData.latestOrders : []);
  const [loading, setLoading] = useState(!cachedStoreDashboardData || cachedStoreDashboardData?.range !== "today");

  const loadData = (range = timeRange, start = customStartDate, end = customEndDate) => {
    if (!cachedStoreDashboardData || cachedStoreDashboardData.range !== range) {
      setLoading(true);
    }
    api.get<{ success: boolean; kpis: any[]; latestOrders: any[] }>(
      "/store-admin/dashboard",
      {
        params: {
          timeRange: range,
          startDate: start || undefined,
          endDate: end || undefined,
        },
      }
    )
      .then(res => {
        if (res.data.success) {
          const freshKpis = res.data.kpis || [];
          const freshOrders = res.data.latestOrders || [];

          cachedStoreDashboardData = {
            range,
            kpis: freshKpis,
            latestOrders: freshOrders,
          };
          setKpis(freshKpis);
          setLatestOrders(freshOrders);
        }
      })
      .catch(err => console.warn("Failed to load store-admin dashboard:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData(timeRange, customStartDate, customEndDate);
    const socket = getSocket();
    const handleUpdate = () => {
      loadData(timeRange, customStartDate, customEndDate);
    };
    socket.on("orders:refreshed", handleUpdate);
    socket.on("order:created", handleUpdate);
    socket.on("order:status_updated", handleUpdate);
    socket.on("order:status_changed", handleUpdate);
    socket.on("inventory:updated", handleUpdate);

    // 60-second backup polling
    const pollTimer = setInterval(() => {
      loadData(timeRange, customStartDate, customEndDate);
    }, 60000);

    return () => {
      clearInterval(pollTimer);
      socket.off("orders:refreshed", handleUpdate);
      socket.off("order:created", handleUpdate);
      socket.off("order:status_updated", handleUpdate);
      socket.off("order:status_changed", handleUpdate);
      socket.off("inventory:updated", handleUpdate);
    };
  }, [timeRange, customStartDate, customEndDate]);

  const placeholderKpis = [
    { icon: "receipt_long", label: "Total orders", value: "—", sub: "All placed orders", color: "#1e3a8a", tab: "orders", hasInfo: true, infoText: "Total orders scheduled for delivery in selected date range" },
    { icon: "payments", label: "Total revenue", value: "—", sub: "Excluding cancellations", color: "#047857", tab: "orders", hasInfo: true, infoText: "Gross revenue of valid orders in selected date range" },
    { icon: "pending_actions", label: "Total pending orders", value: "—", sub: "Pending, Cutting & Transit", color: "#b45309", tab: "orders", hasInfo: true, infoText: "Orders currently awaiting fulfillment or in transit" },
    { icon: "check_circle", label: "Total completed orders", value: "—", sub: "Successfully delivered", color: "#059669", tab: "orders", hasInfo: true, infoText: "Orders successfully delivered in selected date range" },
    { icon: "two_wheeler", label: "Total riders", value: "—", sub: "Delivery fleet partners", color: "#0284c7", tab: "riders", hasInfo: true, infoText: "Total registered delivery partners" },
  ];

  const displayKpis = kpis.length > 0 ? kpis : placeholderKpis;

  const labelToTab: Record<string, string> = {
    "Total orders": "orders",
    "Total revenue": "orders",
    "Total pending orders": "orders",
    "Total completed orders": "orders",
    "Total riders": "riders",
  };

  return (
    <div>
      {/* Top Header: Orders title + Date Range Dropdown Filter */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "18px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <h2 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#171410", margin: 0 }}>
            Orders
          </h2>
          <DateFilterDropdown
            selectedRange={timeRange}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onApply={(range, start, end) => {
              setTimeRange(range);
              setCustomStartDate(start || "");
              setCustomEndDate(end || "");
              loadData(range, start || "", end || "");
            }}
          />
        </div>
      </div>

      {/* 5 KPI Cards in responsive 5-column grid */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5"
        style={{
          gap: "14px",
          marginBottom: "32px",
        }}
      >
        {displayKpis.map(k => {
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
          <div style={{ padding: "30px", textAlign: "center", color: "#73695b" }}>No active orders in queue for selected period</div>
        ) : (
          latestOrders.map((o, i, arr) => (
            <div
              key={o.orderId || o.id}
              onClick={() => setActiveTab("orders")}
              title="Click to view in Live Orders"
              className="cursor-pointer transition-colors hover:bg-[#faf7f2]"
              style={{
                padding: "14px 18px",
                borderBottom: i < arr.length - 1 ? "1px solid #ede8e0" : "none",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                flexWrap: "wrap",
                cursor: "pointer",
              }}
            >
              <div style={{ flex: 1, minWidth: "220px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, color: "#171410", fontSize: "0.92rem" }}>
                    #{o.orderId || o.id}
                  </span>
                  <span style={{ color: "#423b32", fontWeight: 700, fontSize: "0.88rem" }}>
                    — {o.customer?.name || "Customer"}
                  </span>
                  {o.customer?.phone && (
                    <span style={{ color: "#0284c7", fontSize: "0.82rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "2px" }}>
                      · <span className="material-symbols-outlined text-[14px]">call</span> {o.customer.phone}
                    </span>
                  )}
                  {o.createdAt && (
                    <span style={{
                      fontSize: "0.72rem",
                      color: "#78716c",
                      background: "#f5f5f4",
                      padding: "2px 7px",
                      borderRadius: "6px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px"
                    }}>
                      <span className="material-symbols-outlined text-[12px]">schedule</span>
                      {new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
                <div style={{ color: "#73695b", fontSize: "0.8rem", marginTop: "3px" }}>
                  {o.itemSummary || o.items?.map((item: any) => `${item.name} ×${item.quantity}`).join(", ")}
                </div>
                {(o.deliveryInstruction || o.customer?.deliveryInstruction) && (
                  <div style={{
                    marginTop: "4px",
                    fontSize: "0.75rem",
                    color: "#92400e",
                    background: "#fef3c7",
                    border: "1px solid #fde68a",
                    borderRadius: "6px",
                    padding: "2px 8px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontWeight: 600,
                  }}>
                    <span className="material-symbols-outlined text-[13px]">note_alt</span>
                    <span>Instruction: {o.deliveryInstruction || o.customer?.deliveryInstruction}</span>
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 900, color: "#941717", fontSize: "1rem", fontFamily: "Outfit, sans-serif" }}>₹{o.amount}</div>
                <div style={{ color: "#73695b", fontSize: "0.75rem", fontWeight: 600 }}>{o.deliverySlot}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Badge label={o.status} color={
                  o.status === "Pending" ? "#941717" : o.status === "Cutting" ? "#d97706" : o.status === "Delivered" ? "#059669" : "#7c3aed"
                } />
                <span className="material-symbols-outlined text-[18px] text-gray-400">chevron_right</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LiveOrdersTab({ onOrderAdvanced, storeData }: { onOrderAdvanced?: (orderId: string) => void; storeData?: any } = {}) {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");
  const [areaFilter, setAreaFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [loading, setLoading] = useState(true);
  const [printModalOrder, setPrintModalOrder] = useState<any>(null);

  // Store delivery settings (standard fee & free delivery threshold)
  const [storeSettings, setStoreSettings] = useState<{ standardDeliveryFee: number; freeDeliveryThreshold: number } | null>(() => {
    if (storeData) {
      return {
        standardDeliveryFee: typeof storeData.standardDeliveryFee === "number" ? storeData.standardDeliveryFee : 40,
        freeDeliveryThreshold: typeof storeData.freeDeliveryThreshold === "number" ? storeData.freeDeliveryThreshold : 399,
      };
    }
    return null;
  });

  useEffect(() => {
    if (storeData) {
      setStoreSettings({
        standardDeliveryFee: typeof storeData.standardDeliveryFee === "number" ? storeData.standardDeliveryFee : 40,
        freeDeliveryThreshold: typeof storeData.freeDeliveryThreshold === "number" ? storeData.freeDeliveryThreshold : 399,
      });
    }
  }, [storeData]);

  // In-Place Assign Rider & Dispatch Modal state
  const [assignModalOrder, setAssignModalOrder] = useState<any>(null);
  const [availableRiders, setAvailableRiders] = useState<any[]>([]);
  const [loadingRiders, setLoadingRiders] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const [assigningRider, setAssigningRider] = useState(false);

  // Store Admin Cancel Order Modal state
  const [cancelModalOrder, setCancelModalOrder] = useState<any | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [cancellingOrder, setCancellingOrder] = useState(false);

  // Edit Order & Prep Delay Modal state
  const [editModalOrder, setEditModalOrder] = useState<any | null>(null);

  const handleCancelOrderStoreAdmin = async () => {
    if (!cancelModalOrder) return;
    if (!cancelReasonInput.trim()) {
      toast.warning("Please provide a reason for cancellation", "Reason Required");
      return;
    }
    setCancellingOrder(true);
    try {
      const orderId = cancelModalOrder.orderId || cancelModalOrder.id;
      const res = await api.patch<{ success: boolean; message?: string }>(`/store-admin/orders/${orderId}/status`, {
        status: "Cancelled",
        reason: cancelReasonInput.trim(),
      });
      if (res.data?.success) {
        toast.success("Order cancelled. Customer has been notified.", "Order Cancelled");
        setCancelModalOrder(null);
        setCancelReasonInput("");
        fetchOrders();
      } else {
        toast.error(res.data?.message || "Failed to cancel order", "Cancellation Failed");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to cancel order", "Cancellation Failed");
    } finally {
      setCancellingOrder(false);
    }
  };

  // Manual / Phone Order Creation Modal state
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [manualCustName, setManualCustName] = useState("");
  const [manualCustPhone, setManualCustPhone] = useState("");
  const [manualCustAddress, setManualCustAddress] = useState("");
  const [manualIsPickup, setManualIsPickup] = useState(false);
  const [manualPaymentMethod, setManualPaymentMethod] = useState("Cash on Delivery");
  const [manualPaymentStatus, setManualPaymentStatus] = useState("Pending");
  const [manualOrderNotes, setManualOrderNotes] = useState("");
  const [manualItems, setManualItems] = useState<any[]>([]);
  const [submittingManualOrder, setSubmittingManualOrder] = useState(false);

  // Quick item entry states
  const [quickItemName, setQuickItemName] = useState("");
  const [quickItemPrice, setQuickItemPrice] = useState("");
  const [quickItemQty, setQuickItemQty] = useState(1);
  const [quickItemWeight, setQuickItemWeight] = useState("500g");
  const [inventorySuggestions, setInventorySuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [isCustomItem, setIsCustomItem] = useState(false);

  // Group catalog products by categoryLabel or category for clean optgroup display
  const groupedCatalogProducts = useMemo(() => {
    const groups: { [cat: string]: any[] } = {};
    catalogProducts.forEach((prod: any) => {
      const cat = prod.categoryLabel || prod.category || "Fresh Cuts";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(prod);
    });
    return groups;
  }, [catalogProducts]);

  const openEditOrderModal = (orderToEdit: any) => {
    setEditModalOrder(orderToEdit);
    if (catalogProducts.length === 0) {
      setLoadingCatalog(true);
      api.get<{ success: boolean; products: any[] }>("/products?limit=250&all=true")
        .then(res => {
          if (res.data?.success && Array.isArray(res.data.products)) {
            setCatalogProducts(res.data.products);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingCatalog(false));
    }
  };

  const openCreateManualOrderModal = () => {
    setShowCreateOrderModal(true);
    setSelectedProductId("");
    setIsCustomItem(false);

    if (catalogProducts.length === 0) {
      setLoadingCatalog(true);
      api.get<{ success: boolean; products: any[] }>("/products?limit=250&all=true")
        .then(res => {
          if (res.data?.success && Array.isArray(res.data.products)) {
            setCatalogProducts(res.data.products);
          }
        })
        .catch(err => console.warn("Failed to load catalog products for manual order:", err))
        .finally(() => setLoadingCatalog(false));
    }

    if (inventorySuggestions.length === 0) {
      setLoadingSuggestions(true);
      api.get<{ success: boolean; inventory: any[] }>("/store-admin/inventory")
        .then(res => {
          if (res.data.success && Array.isArray(res.data.inventory)) {
            setInventorySuggestions(res.data.inventory.filter((i: any) => (Number(i.stock) || 0) > 0));
          }
        })
        .catch(() => {})
        .finally(() => setLoadingSuggestions(false));
    }

    if (!storeSettings) {
      api.get<{ success: boolean; store: any }>("/store-admin/store-status")
        .then(res => {
          if (res.data?.success && res.data.store) {
            setStoreSettings({
              standardDeliveryFee: typeof res.data.store.standardDeliveryFee === "number" ? res.data.store.standardDeliveryFee : 40,
              freeDeliveryThreshold: typeof res.data.store.freeDeliveryThreshold === "number" ? res.data.store.freeDeliveryThreshold : 399,
            });
          }
        })
        .catch(() => {});
    }
  };

  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    if (!prodId) {
      setIsCustomItem(false);
      setQuickItemName("");
      setQuickItemPrice("");
      setQuickItemWeight("500g");
      return;
    }
    if (prodId === "custom") {
      setIsCustomItem(true);
      setQuickItemName("");
      setQuickItemPrice("");
      setQuickItemWeight("500g");
      return;
    }
    setIsCustomItem(false);
    const prod = catalogProducts.find((p: any) => String(p.id) === String(prodId));
    if (prod) {
      setQuickItemName(prod.name || "");
      setQuickItemPrice(prod.price != null ? String(prod.price) : "");
      setQuickItemWeight(prod.netWeight || prod.grossWeight || "500g");
    }
  };

  const handleSelectInventorySuggestion = (invItem: any) => {
    const itemName = invItem.item || invItem.name || "";
    const matched = catalogProducts.find(
      (p: any) =>
        String(p.id) === String(invItem.id || invItem.productId) ||
        (p.name && itemName && p.name.toLowerCase().trim() === itemName.toLowerCase().trim())
    );
    if (matched) {
      setSelectedProductId(matched.id);
      setIsCustomItem(false);
      setQuickItemName(matched.name || itemName);
      setQuickItemPrice(matched.price != null ? String(matched.price) : (invItem.price ? String(invItem.price) : "220"));
      setQuickItemWeight(matched.netWeight || matched.grossWeight || (invItem.unit === "piece" ? "1 piece" : "500g"));
    } else {
      setSelectedProductId("custom");
      setIsCustomItem(true);
      setQuickItemName(itemName);
      setQuickItemPrice(invItem.price ? String(invItem.price) : "220");
      setQuickItemWeight(invItem.unit === "piece" ? "1 piece" : "500g");
    }
  };

  const handleAddManualItem = () => {
    if (!quickItemName.trim()) {
      toast.error("Please select a product or enter item name", "Item Missing");
      return;
    }
    const priceNum = Number(quickItemPrice) || 0;
    if (priceNum <= 0) {
      toast.error("Please enter a valid price", "Invalid Price");
      return;
    }
    setManualItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: quickItemName.trim(),
        price: priceNum,
        quantity: quickItemQty,
        netWeight: quickItemWeight,
      }
    ]);
    setSelectedProductId("");
    setIsCustomItem(false);
    setQuickItemName("");
    setQuickItemPrice("");
    setQuickItemQty(1);
    setQuickItemWeight("500g");
  };

  const handleSaveManualOrder = async () => {
    const cleanPhone = manualCustPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit customer phone number", "Invalid Phone");
      return;
    }
    if (manualItems.length === 0) {
      toast.error("Please add at least one meat item to the order", "Items Required");
      return;
    }
    if (!manualIsPickup && !manualCustAddress.trim()) {
      toast.error("Please enter a delivery address or choose Store Pickup", "Address Required");
      return;
    }

    setSubmittingManualOrder(true);
    try {
      const subtotal = manualItems.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
      const configuredFee = typeof storeSettings?.standardDeliveryFee === "number" ? storeSettings.standardDeliveryFee : 40;
      const freeThreshold = typeof storeSettings?.freeDeliveryThreshold === "number" ? storeSettings.freeDeliveryThreshold : 399;
      const deliveryFee = manualIsPickup ? 0 : (subtotal >= freeThreshold ? 0 : configuredFee);

      const res = await api.post<{ success: boolean; message: string; order: any }>(
        "/store-admin/orders/create-manual",
        {
          customerName: manualCustName.trim() || "Valued Customer",
          customerPhone: cleanPhone,
          shippingAddress: manualIsPickup ? "Store Takeaway Counter, Ranchi" : manualCustAddress.trim(),
          pickupMode: manualIsPickup,
          fulfillmentType: manualIsPickup ? "pickup" : "delivery",
          items: manualItems,
          deliveryFee,
          paymentMethod: manualIsPickup ? (manualPaymentStatus === "Paid" ? "Paid at Store Counter" : "Pay at Store Counter") : manualPaymentMethod,
          paymentStatus: manualPaymentStatus,
          deliverySlot: manualIsPickup ? "Store Pickup (Counter Takeaway)" : "60-90 Mins Express Delivery",
          notes: manualOrderNotes.trim(),
        }
      );

      if (res.data.success) {
        toast.success(
          `Order #${res.data.order?.orderId || ""} created successfully (Created by Self)! Moved to Cutting.`,
          "Order Created"
        );
        setShowCreateOrderModal(false);
        setManualCustName("");
        setManualCustPhone("");
        setManualCustAddress("");
        setManualIsPickup(false);
        setManualPaymentMethod("Cash on Delivery");
        setManualPaymentStatus("Pending");
        setManualOrderNotes("");
        setManualItems([]);
        fetchOrders();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create manual order", "Order Error");
    } finally {
      setSubmittingManualOrder(false);
    }
  };

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

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [filter, areaFilter, dateFilter]);

  // Detected areas / pincodes from orders
  const availableAreas = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      const addr = o.shippingAddress?.address || o.customer?.address || "";
      const pincode = o.shippingAddress?.pincode || o.customer?.pincode;
      if (pincode) set.add(String(pincode));
      // Extract common Ranchi localities if mentioned in address
      const knownLocalities = ["Kishore Ganj", "Doranda", "Harmu", "Lalpur", "Argora", "Booty More", "Kantatoli", "Ratu Road", "Bariatu", "Morabadi", "Hinoo"];
      knownLocalities.forEach(loc => {
        if (addr.toLowerCase().includes(loc.toLowerCase())) {
          set.add(loc);
        }
      });
    });
    return Array.from(set).sort();
  }, [orders]);

  // Filtered orders applying Area/Pincode and Date filters
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (areaFilter !== "All") {
        const addr = (o.shippingAddress?.address || o.customer?.address || "").toLowerCase();
        const pin = String(o.shippingAddress?.pincode || o.customer?.pincode || "");
        const target = areaFilter.toLowerCase();
        const matchesArea = addr.includes(target) || pin.includes(target);
        if (!matchesArea) return false;
      }
      if (dateFilter) {
        let deliveryDate = o.scheduledDeliveryDate;
        if (!deliveryDate && o.targetDeliveryTime) {
          try {
            const dt = new Date(o.targetDeliveryTime);
            if (!isNaN(dt.getTime())) {
              const istMs = dt.getTime() + (5.5 * 60 * 60 * 1000);
              deliveryDate = new Date(istMs).toISOString().slice(0, 10);
            }
          } catch (_) {}
        }
        if (!deliveryDate && o.createdAt) {
          try {
            const dt = new Date(o.createdAt);
            if (!isNaN(dt.getTime())) {
              const slot = String(o.deliverySlot || '').toLowerCase();
              const isNextDay = Boolean(
                o.isNextDayOrder ||
                slot.includes('tomorrow') ||
                slot.includes('next-day') ||
                slot.includes('9:00 am')
              );
              const istMs = dt.getTime() + (5.5 * 60 * 60 * 1000) + (isNextDay ? 24 * 60 * 60 * 1000 : 0);
              deliveryDate = new Date(istMs).toISOString().slice(0, 10);
            }
          } catch (_) {}
        }
        if (deliveryDate !== dateFilter) return false;
      }
      return true;
    });
  }, [orders, areaFilter, dateFilter]);

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page, pageSize]);

  const openAssignRiderModal = (order: any) => {
    setAssignModalOrder(order);
    setSelectedRiderId("");
    setLoadingRiders(true);
    api.get<{ success: boolean; riders: any[] }>("/store-admin/riders")
      .then(res => {
        if (res.data.success && Array.isArray(res.data.riders)) {
          setAvailableRiders(res.data.riders);
          const firstAvailable = res.data.riders.find(r => r.riderStatus === "Available");
          if (firstAvailable) {
            setSelectedRiderId(firstAvailable.id || firstAvailable._id);
          }
        }
      })
      .catch(err => {
        console.warn("Failed to fetch riders:", err);
        toast.error("Failed to load active riders", "Rider Error");
      })
      .finally(() => setLoadingRiders(false));
  };

  const handleConfirmAssignRider = async () => {
    if (!assignModalOrder || !selectedRiderId) {
      toast.error("Please select an active delivery partner", "Rider Required");
      return;
    }
    setAssigningRider(true);
    try {
      const orderId = assignModalOrder.orderId || assignModalOrder.id;
      const res = await api.patch<{ success: boolean; message: string; rider?: any }>(
        `/store-admin/orders/${orderId}/assign-rider`,
        { riderId: selectedRiderId }
      );
      if (res.data.success) {
        const riderName = res.data.rider?.name || "Rider";
        toast.success(
          `Rider ${riderName} assigned! Order #${orderId} is now Out for Delivery.`,
          "Rider Dispatched"
        );
        setAssignModalOrder(null);
        setSelectedRiderId("");
        fetchOrders();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to assign rider", "Dispatch Error");
    } finally {
      setAssigningRider(false);
    }
  };

  // Multi-Order Batch Dispatch state
  const [selectedBatchOrderIds, setSelectedBatchOrderIds] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchFeasibility, setBatchFeasibility] = useState<any>(null);
  const [checkingFeasibility, setCheckingFeasibility] = useState(false);
  const [batchRiderId, setBatchRiderId] = useState("");
  const [dispatchingBatch, setDispatchingBatch] = useState(false);

  const toggleSelectOrderForBatch = (orderId: string) => {
    setSelectedBatchOrderIds(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const openBatchModal = async () => {
    if (selectedBatchOrderIds.length === 0) return;
    setShowBatchModal(true);
    setCheckingFeasibility(true);
    setBatchFeasibility(null);
    setBatchRiderId("");

    api.get<{ success: boolean; riders: any[] }>("/store-admin/riders")
      .then(res => {
        if (res.data.success && Array.isArray(res.data.riders)) {
          setAvailableRiders(res.data.riders);
          const firstAvailable = res.data.riders.find(r => r.riderStatus === "Available");
          if (firstAvailable) {
            setBatchRiderId(firstAvailable.id || firstAvailable._id);
          }
        }
      })
      .catch(err => console.warn("Failed to fetch riders:", err));

    try {
      const res = await api.post<{ success: boolean; isFeasible: boolean; reason?: string; optimalSequence?: string[]; totalDistanceKm?: number; estimatedDurationMinutes?: number }>(
        "/store-admin/batches/check-feasibility",
        { orderIds: selectedBatchOrderIds }
      );
      setBatchFeasibility(res.data);
    } catch (err: any) {
      setBatchFeasibility({
        isFeasible: false,
        reason: err.response?.data?.message || "Route feasibility check failed",
      });
    } finally {
      setCheckingFeasibility(false);
    }
  };

  const handleConfirmBatchDispatch = async () => {
    if (!batchRiderId || selectedBatchOrderIds.length === 0) {
      toast.error("Please select an active delivery partner", "Rider Required");
      return;
    }
    setDispatchingBatch(true);
    try {
      const res = await api.post<{ success: boolean; message: string; batch: any; rider: any }>(
        "/store-admin/batches/assign",
        {
          riderId: batchRiderId,
          orderIds: selectedBatchOrderIds,
        }
      );
      if (res.data.success) {
        toast.success(res.data.message || `Batch dispatched successfully`, "Batch Dispatched");
        setShowBatchModal(false);
        setSelectedBatchOrderIds([]);
        setBatchFeasibility(null);
        fetchOrders();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to dispatch batch", "Dispatch Error");
    } finally {
      setDispatchingBatch(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  useEffect(() => {
    const socket = getSocket();
    const storedUser = getStoredUser();
    const currentStoreId = storedUser?.storeId || "S001";

    const joinStoreRoom = () => {
      if (currentStoreId) {
        socket.emit("join:store", currentStoreId);
      }
      if (storedUser?.role) {
        socket.emit("join:role", storedUser.role);
      }
    };
    joinStoreRoom();

    const handleRefresh = () => {
      fetchOrders();
    };
    const handleOrderDeclined = (data: any) => {
      const orderId = data?.orderId || data?.id;
      const riderName = data?.riderName || "Rider";
      toast.warning(
        `Rider ${riderName} declined Order #${orderId}. Reverted to Ready stage for reassignment.`,
        "Rider Declined Delivery"
      );
      fetchOrders();
    };

    socket.on("orders:refreshed", handleRefresh);
    socket.on("order:created", handleRefresh);
    socket.on("order:status_updated", handleRefresh);
    socket.on("order:status_changed", handleRefresh);
    socket.on("order:updated", handleRefresh);
    socket.on("store:order:declined", handleOrderDeclined);
    socket.on("order:declined", handleOrderDeclined);
    socket.on("connect", () => {
      joinStoreRoom();
      handleRefresh();
    });

    const handleFocusSync = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchOrders();
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleFocusSync);
      document.addEventListener("visibilitychange", handleFocusSync);
    }

    // Zero polling: live updates are driven 100% by WebSockets

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleFocusSync);
        document.removeEventListener("visibilitychange", handleFocusSync);
      }
      socket.off("connect");
      socket.off("orders:refreshed", handleRefresh);
      socket.off("order:created", handleRefresh);
      socket.off("order:status_updated", handleRefresh);
      socket.off("order:status_changed", handleRefresh);
      socket.off("order:updated", handleRefresh);
      socket.off("store:order:declined", handleOrderDeclined);
      socket.off("order:declined", handleOrderDeclined);
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

    // Intercept: Home delivery orders at Ready MUST be assigned a rider via Modal
    if (next === "Out for Delivery" && !isPickup) {
      const targetOrder = orders.find(o => (o.orderId || o.id) === orderId);
      if (targetOrder) {
        openAssignRiderModal(targetOrder);
        return;
      }
    }

    try {
      await api.patch(`/store-admin/orders/${orderId}/status`, { status: next });
      toast.success(`Order advanced to: ${next}`, "Order Updated");
      fetchOrders();
      if (onOrderAdvanced) {
        onOrderAdvanced(orderId);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to advance order status", "Order Error");
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
      "Ready": "Assign Rider & Dispatch",
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
      {/* Filter toolbar: Status pills + Area/Pincode selector + Date filter */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
        marginBottom: "20px",
        background: "#faf8f5",
        padding: "12px 16px",
        borderRadius: "12px",
        border: "1px solid #ede8e0",
      }}>
        {/* Status filter pills */}
        <div
          className="no-scrollbar"
          style={{
            display: "flex",
            gap: "6px",
            overflowX: "auto",
            whiteSpace: "nowrap",
            flexWrap: "nowrap",
            WebkitOverflowScrolling: "touch",
            width: "100%",
            paddingBottom: "4px",
          }}
        >
          {["All", "Pending", "Cutting", "Ready", "Out for Delivery", "Delivered"].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                padding: "6px 12px", borderRadius: "99px", border: "1.5px solid #ede8e0",
                background: filter === s ? "#941717" : "#fff", color: filter === s ? "#fff" : "#423b32",
                fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
                whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Locality / Pincode Dropdown & Date Picker + Manual Order button */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", width: "100%" }}>
          <button
            type="button"
            onClick={openCreateManualOrderModal}
            className="w-full sm:w-auto"
            style={{
              background: "#065f46",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "7px 14px",
              fontSize: "0.8rem",
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              boxShadow: "0 2px 6px rgba(6, 95, 70, 0.2)",
            }}
          >
            <span className="material-symbols-outlined text-[17px]">add_shopping_cart</span>
            <span>+ Create Manual Order</span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: "160px" }}>
            <span className="material-symbols-outlined text-[18px] text-gray-500">pin_drop</span>
            <input
              list="store-area-suggestions"
              type="text"
              placeholder="Search area or pincode..."
              value={areaFilter === "All" ? "" : areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "0.8rem",
                background: "#fff",
                fontWeight: 600,
                color: "#374151",
                width: "100%",
              }}
            />
            <datalist id="store-area-suggestions">
              {availableAreas.map((a: string) => (
                <option key={a} value={a} />
              ))}
            </datalist>
            {areaFilter && areaFilter !== "All" && (
              <button
                onClick={() => setAreaFilter("All")}
                title="Clear area filter"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#941717",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                }}
              >
                Clear
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="material-symbols-outlined text-[18px] text-gray-500">calendar_today</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                padding: "5px 10px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "0.8rem",
                background: "#fff",
                fontWeight: 600,
                color: "#374151",
              }}
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter("")}
                title="Clear date"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#941717",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#73695b" }}>Fetching live orders from database…</div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ background: "#fff", padding: "40px", textAlign: "center", borderRadius: "14px", border: "1px solid #ede8e0" }}>
          No orders found matching the selected filters.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {paginatedOrders.map((o: any) => {
            const isPickup =
              o.fulfillmentType === "pickup" ||
              o.pickupMode === true ||
              o.deliverySlot?.toLowerCase().includes("pickup") ||
              o.customer?.address?.toLowerCase().includes("pickup");
            const nextLabel = getNextStatusLabel(o.status, isPickup);
            const canBatch = !isPickup && (o.status === "Ready" || o.status === "Packed");
            const orderKey = o.orderId || o.id;
            const rawPhone = o.customer?.phone || o.customerPhone || o.phone || "";
            const cleanPhone = String(rawPhone).replace(/\D/g, "");
            const phoneForWa = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
            const waUrl = cleanPhone
              ? `https://wa.me/${phoneForWa}?text=${encodeURIComponent(`Hello ${o.customer?.name || "Customer"}, this is TeFFe's regarding your order #${orderKey}.`)}`
              : "";
            const callUrl = cleanPhone ? `tel:${cleanPhone}` : "";

            return (
              <div
                key={orderKey}
                style={{
                  background: "#fff",
                  border: isPickup
                    ? "1.5px solid #f59e0b"
                    : selectedBatchOrderIds.includes(orderKey)
                    ? "2px solid #941717"
                    : "1px solid #ede8e0",
                  borderRadius: "14px",
                  padding: "18px 20px",
                  boxShadow: isPickup
                    ? "0 2px 10px rgba(245, 158, 11, 0.08)"
                    : selectedBatchOrderIds.includes(orderKey)
                    ? "0 4px 14px rgba(148, 23, 23, 0.12)"
                    : "none",
                  transition: "border 150ms ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      {canBatch && (
                        <input
                          type="checkbox"
                          checked={selectedBatchOrderIds.includes(orderKey)}
                          onChange={() => toggleSelectOrderForBatch(orderKey)}
                          style={{ width: "16px", height: "16px", accentColor: "#941717", cursor: "pointer" }}
                          title="Select order for multi-delivery batch dispatch"
                        />
                      )}
                      <div style={{ fontWeight: 800, color: "#171410", fontSize: "0.95rem" }}>#{orderKey}</div>
                      {o.batchId && (
                        <span style={{
                          background: "#fdf4ff",
                          color: "#86198f",
                          border: "1px solid #f0abfc",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}>
                          <span className="material-symbols-outlined text-[13px]">local_shipping</span>
                          Batch #{String(o.batchId).slice(-6)} • Stop {o.deliverySequence || 1}
                        </span>
                      )}
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
                      {(o.createdByType === "self_store_admin" || o.orderSource === "store_direct") && (
                        <span style={{
                          background: "#ecfdf5",
                          color: "#065f46",
                          border: "1px solid #a7f3d0",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          letterSpacing: "0.2px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}>
                          <span className="material-symbols-outlined text-[14px]">person_check</span>
                          Created by Self
                        </span>
                      )}
                      {(() => {
                        const isMorningSlot = Boolean(
                          o.isNextDayOrder ||
                          (o.deliverySlot && (
                            o.deliverySlot.toLowerCase().includes('tomorrow') ||
                            o.deliverySlot.toLowerCase().includes('next-day') ||
                            o.deliverySlot.toLowerCase().includes('09:00 am') ||
                            o.deliverySlot.toLowerCase().includes('today by 09:00 am')
                          ))
                        );
                        if (!isMorningSlot) return null;

                        const now = new Date();
                        const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
                        const todayIST = `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${String(ist.getUTCDate()).padStart(2, '0')}`;
                        let targetIST = o.scheduledDeliveryDate || "";
                        if (!targetIST && o.targetDeliveryTime) {
                          const dt = new Date(o.targetDeliveryTime);
                          if (!isNaN(dt.getTime())) {
                            const dtIST = new Date(dt.getTime() + (5.5 * 60 * 60 * 1000));
                            targetIST = `${dtIST.getUTCFullYear()}-${String(dtIST.getUTCMonth() + 1).padStart(2, '0')}-${String(dtIST.getUTCDate()).padStart(2, '0')}`;
                          }
                        }
                        if (!targetIST && o.createdAt) {
                          const placedD = new Date(o.createdAt);
                          const placedIST = new Date(placedD.getTime() + (5.5 * 60 * 60 * 1000));
                          const hour = placedIST.getUTCHours();
                          const minute = placedIST.getUTCMinutes();
                          if (hour >= 20 || (hour === 19 && minute >= 59)) {
                            const nextDay = new Date(placedD.getTime() + 24 * 60 * 60 * 1000 + 5.5 * 60 * 60 * 1000);
                            targetIST = `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDay.getUTCDate()).padStart(2, '0')}`;
                          } else {
                            targetIST = `${placedIST.getUTCFullYear()}-${String(placedIST.getUTCMonth() + 1).padStart(2, '0')}-${String(placedIST.getUTCDate()).padStart(2, '0')}`;
                          }
                        }
                        const isToday = !targetIST || targetIST <= todayIST;
                        return (
                          <span style={{
                            background: isToday ? "#ecfdf5" : "#fef3c7",
                            color: isToday ? "#065f46" : "#92400e",
                            border: isToday ? "1px solid #a7f3d0" : "1px solid #fde68a",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            letterSpacing: "0.2px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}>
                            <span className="material-symbols-outlined text-[14px]">{isToday ? "wb_twilight" : "wb_sunny"}</span>
                            DELIVER {isToday ? "TODAY" : "TOMORROW"} BY 9:00 AM
                          </span>
                        );
                      })()}
                      {o.isModified && (
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
                          <span className="material-symbols-outlined text-[13px]">edit_note</span>
                          REVISED ORDER
                        </span>
                      )}
                      {o.additionalAmountDue > 0 && (
                        <span style={{
                          background: "#ecfdf5",
                          color: "#065f46",
                          border: "1px solid #a7f3d0",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          letterSpacing: "0.2px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}>
                          <span className="material-symbols-outlined text-[13px]">payments</span>
                          Collect ₹{o.additionalAmountDue} Extra
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                      <span style={{ color: "#1f2937", fontSize: "0.82rem", fontWeight: 700 }}>
                        {o.customer?.name || "Customer"}
                      </span>
                      {rawPhone && (
                        <>
                          <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>·</span>
                          <span style={{ color: "#4b5563", fontSize: "0.8rem", fontWeight: 600 }}>{rawPhone}</span>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginLeft: "4px" }}>
                            {/* Phone call button */}
                            <a
                              href={callUrl}
                              title={`Call Customer (${rawPhone})`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "28px",
                                height: "28px",
                                background: "#eff6ff",
                                color: "#0284c7",
                                border: "1px solid #bae6fd",
                                borderRadius: "7px",
                                textDecoration: "none",
                                cursor: "pointer",
                                transition: "all 150ms ease",
                              }}
                            >
                              <span className="material-symbols-outlined text-[16px]">call</span>
                            </a>

                            {/* WhatsApp chat button */}
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Message Customer on WhatsApp (${rawPhone})`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "28px",
                                height: "28px",
                                background: "#ecfdf5",
                                color: "#16a34a",
                                border: "1px solid #a7f3d0",
                                borderRadius: "7px",
                                textDecoration: "none",
                                cursor: "pointer",
                                transition: "all 150ms ease",
                              }}
                            >
                              <svg style={{ width: "16px", height: "16px", fill: "currentColor", flexShrink: 0 }} viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            </a>
                          </div>
                        </>
                      )}
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
                    {(o.deliveryInstruction || o.customer?.deliveryInstruction) && (
                      <div style={{
                        marginTop: "6px",
                        background: "#fffbeb",
                        border: "1px solid #fde68a",
                        borderRadius: "6px",
                        padding: "4px 8px",
                        fontSize: "0.78rem",
                        color: "#92400e",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}>
                        <span className="material-symbols-outlined text-[15px] text-amber-700">note_alt</span>
                        <span><strong>Customer Instruction:</strong> {o.deliveryInstruction || o.customer?.deliveryInstruction}</span>
                      </div>
                    )}
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
                      const specificSlot = getSpecificDeliverySlot(o.slot || o.timeSlot || o.scheduledSlot || o.deliverySlot, o.scheduledDeliveryDate, o.targetDeliveryTime);
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

                  {(o.status === "Pending" || o.status === "Cutting" || o.status === "Ready") && (
                    <button
                      type="button"
                      onClick={() => openEditOrderModal(o)}
                      title="Open delay & item adjustment modal"
                      style={{
                        background: "#fffbeb",
                        border: "1px solid #fcd34d",
                        borderRadius: "6px",
                        padding: "4px 10px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "#b45309",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span className="material-symbols-outlined text-[14px]">more_time</span>
                      <span>+ Delay / Edit</span>
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #f5f2ed" }}>
                  <div style={{ width: "100%", overflowX: "auto" }} className="no-scrollbar">
                    <OrderStatusPipeline status={o.status} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-start" }}>
                    {o.rider?.name && (
                      <div style={{
                        fontSize: "0.75rem",
                        color: "#0369a1",
                        background: "#f0f9ff",
                        border: "1px solid #bae6fd",
                        borderRadius: "8px",
                        padding: "6px 10px",
                        display: "inline-flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "6px",
                        fontWeight: 600,
                      }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 700 }}>
                          <span className="material-symbols-outlined text-[15px]">two_wheeler</span>
                          <span>Rider: {o.rider.name}</span>
                        </div>
                        {(() => {
                          const assignedTime = o.riderAssignedAt || o.rider?.assignedAt || o.dispatchedAt || (o.rider?.name && o.status === "Out for Delivery" ? o.updatedAt : null);
                          if (!assignedTime) return null;
                          let formatted = "";
                          try {
                            const d = new Date(assignedTime);
                            if (!isNaN(d.getTime())) {
                              formatted = d.toLocaleString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              });
                            }
                          } catch {}
                          if (!formatted) return null;
                          return (
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                              color: "#0284c7",
                              fontSize: "0.71rem",
                              background: "#e0f2fe",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              fontWeight: 700,
                            }}>
                              <span className="material-symbols-outlined text-[13px]">schedule</span>
                              <span>Assigned: {formatted}</span>
                            </span>
                          );
                        })()}
                      </div>
                    )}
                    {nextLabel && (
                      <button
                        onClick={() => advanceStatus(o.orderId || o.id, o.status, isPickup)}
                        style={{
                          background: o.status === "Ready" && !isPickup ? "#941717" : "rgba(148, 23, 23, 0.08)",
                          color: o.status === "Ready" && !isPickup ? "#fff" : "#941717",
                          border: o.status === "Ready" && !isPickup ? "1.5px solid #941717" : "1.5px solid rgba(148, 23, 23, 0.25)",
                          borderRadius: "8px",
                          padding: "7px 14px",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 150ms ease",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          boxShadow: o.status === "Ready" && !isPickup ? "0 2px 6px rgba(148, 23, 23, 0.25)" : "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {o.status === "Ready" && !isPickup ? "two_wheeler" : "check_circle"}
                        </span>
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
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px]">print</span>
                      <span>Print KOT</span>
                    </button>
                    {["Pending", "Cutting", "Ready"].includes(o.status) && (
                      <button
                        type="button"
                        onClick={() => openEditOrderModal(o)}
                        title="Edit order items / add weight or pieces / extend prep delay"
                        style={{
                          background: "#eff6ff",
                          border: "1.5px solid #bfdbfe",
                          borderRadius: "8px",
                          padding: "7px 12px",
                          color: "#1d4ed8",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span className="material-symbols-outlined text-[16px]">edit_note</span>
                        <span>Edit / Delay</span>
                      </button>
                    )}
                    {o.status !== "Delivered" && o.status !== "Cancelled" && (
                      <button
                        type="button"
                        onClick={() => {
                          setCancelModalOrder(o);
                          setCancelReasonInput("");
                        }}
                        title="Cancel this order if cannot deliver"
                        style={{
                          background: "#fff1f2",
                          border: "1.5px solid #fecdd3",
                          borderRadius: "8px",
                          padding: "7px 12px",
                          color: "#e11d48",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span className="material-symbols-outlined text-[16px]">cancel</span>
                        <span>Cancel Order</span>
                      </button>
                    )}
                    <div style={{
                      background: "#faf8f5",
                      border: "1px solid #ede8e0",
                      borderRadius: "8px",
                      padding: "6px 12px",
                      color: "#423b32",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      whiteSpace: "nowrap",
                    }}>
                      <span className="material-symbols-outlined text-[15px] text-gray-500">payments</span>
                      <span>{o.paymentStatus} ({o.paymentMethod || "COD"})</span>
                    </div>
                    {o.changeCreditedToWallet > 0 && (
                      <div style={{
                        fontSize: "0.75rem",
                        color: "#059669",
                        background: "#ecfdf5",
                        border: "1px solid #a7f3d0",
                        borderRadius: "8px",
                        padding: "6px 10px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }} title={`Cash Received: ₹${o.cashCollected} | Bill: ₹${o.amount} | Credited to Wallet: ₹${o.changeCreditedToWallet}`}>
                        <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
                        <span>₹{o.changeCreditedToWallet} Change to Wallet</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination
        currentPage={page}
        totalItems={filteredOrders.length}
        pageSize={pageSize}
        onPageChange={setPage}
        itemLabel="orders"
      />

      {/* ─── IN-PLACE ASSIGN RIDER & DISPATCH MODAL ─── */}
      {assignModalOrder && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.55)",
          backdropFilter: "blur(3px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
          padding: "16px",
        }}>
          <div style={{
            background: "#fff",
            borderRadius: "18px",
            width: "100%",
            maxWidth: "460px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            overflow: "hidden",
          }}>
            {/* Modal Header */}
            <div style={{
              background: "#faf8f5",
              borderBottom: "1px solid #ede8e0",
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "#941717",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <span className="material-symbols-outlined text-[20px]">two_wheeler</span>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#171410" }}>
                    Assign Rider & Dispatch
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#73695b" }}>
                    Order #{assignModalOrder.orderId || assignModalOrder.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOrder(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#73695b",
                  cursor: "pointer",
                  padding: "4px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px" }}>
              {/* Customer / Order Summary */}
              <div style={{
                background: "#faf8f5",
                border: "1px solid #ede8e0",
                borderRadius: "12px",
                padding: "12px 14px",
                marginBottom: "16px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 800, color: "#171410", fontSize: "0.85rem" }}>
                    {assignModalOrder.customer?.name || "Customer"}
                  </span>
                  <span style={{ fontWeight: 800, color: "#941717", fontSize: "0.85rem" }}>
                    ₹{assignModalOrder.amount || assignModalOrder.totalAmount}
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#73695b", marginBottom: "4px" }}>
                  📍 {assignModalOrder.customer?.address || "Ranchi Delivery"}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#423b32", fontWeight: 600 }}>
                  Items: {assignModalOrder.itemSummary || assignModalOrder.items?.map((it: any) => `${it.name} ×${it.quantity}`).join(", ") || "Fresh Meat Cuts"}
                </div>
              </div>

              {/* Rider Selection Header */}
              <div style={{ marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 800, color: "#171410" }}>
                  Select Delivery Partner:
                </label>
                {availableRiders.length > 0 && (
                  <span style={{ fontSize: "0.72rem", color: "#059669", fontWeight: 700, background: "#ecfdf5", padding: "2px 8px", borderRadius: "99px" }}>
                    {availableRiders.filter(r => r.riderStatus === "Available").length} Online
                  </span>
                )}
              </div>

              {/* Riders List */}
              {loadingRiders ? (
                <div style={{ padding: "30px", textAlign: "center", color: "#73695b", fontSize: "0.82rem" }}>
                  Loading active fleet partners…
                </div>
              ) : availableRiders.length === 0 ? (
                <div style={{
                  padding: "18px",
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "10px",
                  color: "#92400e",
                  fontSize: "0.8rem",
                  textAlign: "center",
                }}>
                  No registered delivery riders found for this store.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "240px", overflowY: "auto", paddingRight: "4px" }}>
                  {availableRiders.map((r: any) => {
                    const rId = r.id || r._id;
                    const isSelected = selectedRiderId === rId;
                    const isAvailable = r.riderStatus === "Available";
                    return (
                      <div
                        key={rId}
                        onClick={() => setSelectedRiderId(rId)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: isSelected ? "2px solid #941717" : "1px solid #ede8e0",
                          background: isSelected ? "#fff5f5" : "#fff",
                          cursor: "pointer",
                          transition: "all 120ms ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <input
                            type="radio"
                            name="selectedRiderLive"
                            checked={isSelected}
                            onChange={() => setSelectedRiderId(rId)}
                            style={{ accentColor: "#941717", cursor: "pointer" }}
                          />
                          <div>
                            <div style={{ fontWeight: 800, color: "#171410", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
                              <span>{r.name}</span>
                              <span style={{ fontSize: "0.7rem", color: "#d97706", fontWeight: 700 }}>
                                ★ {(r.riderRating || "4.9").toString().replace("★", "").trim()}
                              </span>
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#73695b" }}>
                              {r.phone} • {r.vehicleNumber || "Fleet Bike"}
                            </div>
                          </div>
                        </div>

                        <span style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "99px",
                          background: isAvailable ? "#ecfdf5" : r.riderStatus === "On Delivery" ? "#eff6ff" : "#f3f4f6",
                          color: isAvailable ? "#059669" : r.riderStatus === "On Delivery" ? "#2563eb" : "#6b7280",
                        }}>
                          {r.riderStatus === "On Delivery"
                            ? `On Delivery (${r.activeOrdersCount || 1} active)`
                            : (r.riderStatus || "Available")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              background: "#faf8f5",
              borderTop: "1px solid #ede8e0",
              padding: "14px 20px",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
            }}>
              <button
                type="button"
                onClick={() => setAssignModalOrder(null)}
                style={{
                  background: "#fff",
                  border: "1px solid #ede8e0",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "#423b32",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssignRider}
                disabled={assigningRider || !selectedRiderId}
                style={{
                  background: !selectedRiderId ? "#d1d5db" : "#941717",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 18px",
                  color: "#fff",
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  cursor: !selectedRiderId ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: !selectedRiderId ? "none" : "0 2px 6px rgba(148, 23, 23, 0.3)",
                }}
              >
                <span className="material-symbols-outlined text-[16px]">two_wheeler</span>
                <span>{assigningRider ? "Dispatching…" : "Assign & Dispatch"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Batch Dispatch Action Bar */}
      {selectedBatchOrderIds.length > 0 && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "#171410",
          color: "#fff",
          padding: "12px 24px",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          gap: "24px",
          zIndex: 100,
          border: "1px solid rgba(255,255,255,0.15)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span className="material-symbols-outlined text-[24px]" style={{ color: "#f59e0b" }}>local_shipping</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.92rem" }}>
                {selectedBatchOrderIds.length} Orders Selected for Multi-Order Delivery
              </div>
              <div style={{ fontSize: "0.75rem", color: "#a89f91" }}>
                Combine compatible nearby orders into a single delivery run
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setSelectedBatchOrderIds([])}
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "none",
                borderRadius: "8px",
                padding: "8px 14px",
                color: "#fff",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={openBatchModal}
              style={{
                background: "#941717",
                border: "none",
                borderRadius: "8px",
                padding: "8px 18px",
                color: "#fff",
                fontSize: "0.82rem",
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 8px rgba(148, 23, 23, 0.4)",
              }}
            >
              <span className="material-symbols-outlined text-[16px]">alt_route</span>
              <span>Check Feasibility &amp; Dispatch</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL: MULTI-ORDER BATCH DISPATCH ─── */}
      {showBatchModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 110,
          padding: "20px",
        }}>
          <div style={{
            background: "#fff",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "600px",
            overflow: "hidden",
            boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
          }}>
            {/* Modal Header */}
            <div style={{
              background: "#941717",
              color: "#fff",
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="material-symbols-outlined text-[24px]">local_shipping</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>Dispatch Multi-Order Delivery Batch</h3>
                  <div style={{ fontSize: "0.74rem", opacity: 0.9 }}>{selectedBatchOrderIds.length} orders queued for simultaneous dispatch</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Feasibility Evaluation Card */}
              {checkingFeasibility ? (
                <div style={{ padding: "20px", textAlign: "center", background: "#f8fafc", borderRadius: "10px" }}>
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-3 border-[#941717] border-t-transparent" />
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#475569", marginTop: "8px" }}>
                    Evaluating road detour &amp; cold-chain freshness window…
                  </div>
                </div>
              ) : batchFeasibility ? (
                <div style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: batchFeasibility.isFeasible ? "1.5px solid #a7f3d0" : "1.5px solid #fecaca",
                  background: batchFeasibility.isFeasible ? "#ecfdf5" : "#fef2f2",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <span className="material-symbols-outlined text-[22px]" style={{ color: batchFeasibility.isFeasible ? "#059669" : "#dc2626" }}>
                      {batchFeasibility.isFeasible ? "verified" : "error"}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: "0.88rem", color: batchFeasibility.isFeasible ? "#065f46" : "#991b1b" }}>
                        {batchFeasibility.isFeasible ? "Route Feasible & Optimized" : "Batch Rejected by Safety Feasibility Engine"}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: batchFeasibility.isFeasible ? "#047857" : "#b91c1c", marginTop: "3px" }}>
                        {batchFeasibility.isFeasible ? (
                          <>
                            Estimated route distance: <strong>{batchFeasibility.totalDistanceKm} km</strong> • Delivery window: <strong>~{batchFeasibility.estimatedDurationMinutes} mins</strong>.
                          </>
                        ) : (
                          batchFeasibility.reason
                        )}
                      </div>
                    </div>
                  </div>

                  {batchFeasibility.isFeasible && Array.isArray(batchFeasibility.optimalSequence) && (
                    <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed #a7f3d0" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#065f46", marginBottom: "6px" }}>
                        Optimized Stop Sequence:
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                        {batchFeasibility.optimalSequence.map((seqId: string, idx: number) => (
                          <span
                            key={seqId}
                            style={{
                              background: "#fff",
                              border: "1px solid #a7f3d0",
                              color: "#065f46",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontSize: "0.74rem",
                              fontWeight: 800,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <span>Stop {idx + 1}:</span>
                            <span style={{ color: "#171410" }}>#{seqId}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Rider Selection */}
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 800, color: "#171410", marginBottom: "8px" }}>
                  Select Delivery Partner
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                  {availableRiders.map((r: any) => {
                    const rId = r.id || r._id;
                    const isSelected = batchRiderId === rId;
                    const isAvail = r.riderStatus === "Available";
                    return (
                      <div
                        key={rId}
                        onClick={() => setBatchRiderId(rId)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: isSelected ? "2px solid #941717" : "1px solid #ede8e0",
                          background: isSelected ? "#fff5f5" : "#fff",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <input
                            type="radio"
                            name="batchRiderSelect"
                            checked={isSelected}
                            onChange={() => setBatchRiderId(rId)}
                            style={{ accentColor: "#941717", cursor: "pointer" }}
                          />
                          <div>
                            <div style={{ fontWeight: 800, color: "#171410", fontSize: "0.85rem" }}>{r.name}</div>
                            <div style={{ fontSize: "0.72rem", color: "#73695b" }}>{r.phone} • {r.vehicleNumber || "Fleet Bike"}</div>
                          </div>
                        </div>
                        <span style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "99px",
                          background: isAvail ? "#ecfdf5" : "#eff6ff",
                          color: isAvail ? "#059669" : "#2563eb",
                        }}>
                          {r.riderStatus || "Available"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              background: "#faf8f5",
              borderTop: "1px solid #ede8e0",
              padding: "14px 20px",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
            }}>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                style={{
                  background: "#fff",
                  border: "1px solid #ede8e0",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  color: "#423b32",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchDispatch}
                disabled={dispatchingBatch || !batchRiderId || !batchFeasibility?.isFeasible}
                style={{
                  background: !batchRiderId || !batchFeasibility?.isFeasible ? "#d1d5db" : "#941717",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 18px",
                  color: "#fff",
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  cursor: !batchRiderId || !batchFeasibility?.isFeasible ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: !batchRiderId || !batchFeasibility?.isFeasible ? "none" : "0 2px 6px rgba(148, 23, 23, 0.3)",
                }}
              >
                <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                <span>{dispatchingBatch ? "Dispatching…" : `Confirm Dispatch (${selectedBatchOrderIds.length} Orders)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Manual / Phone Order Modal */}
      {showCreateOrderModal && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-[1000] p-2 sm:p-4">
          <div style={{
            background: "#fff",
            borderRadius: "18px",
            width: "100%",
            maxWidth: "660px",
            maxHeight: "92vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
            border: "1px solid #e5e7eb",
            overflow: "hidden",
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "16px 20px",
              background: "#065f46",
              color: "#fff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="material-symbols-outlined text-[24px]">phone_in_talk</span>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>
                    Create Manual / Phone Order
                  </h3>
                  <p style={{ fontSize: "0.72rem", opacity: 0.9, margin: "2px 0 0" }}>
                    Placed directly by Store Admin • Tagged as "Created by Self"
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateOrderModal(false)}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-3 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-3.5">
              {/* Section 1: Customer Details */}
              <div style={{ background: "#f9fafb", padding: "14px", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#111827", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="material-symbols-outlined text-[16px] text-emerald-700">person</span>
                  <span>Customer Information</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label style={{ fontSize: "0.74rem", fontWeight: 700, color: "#374151", display: "block", marginBottom: "4px" }}>
                      Phone Number * (10 Digits)
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={manualCustPhone}
                      onChange={(e) => setManualCustPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.74rem", fontWeight: 700, color: "#374151", display: "block", marginBottom: "4px" }}>
                      Customer Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={manualCustName}
                      onChange={(e) => setManualCustName(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                      }}
                    />
                  </div>
                </div>

                {/* Fulfillment toggle: Home Delivery vs Counter Pickup */}
                <div style={{ marginTop: "12px" }}>
                  <label style={{ fontSize: "0.74rem", fontWeight: 700, color: "#374151", display: "block", marginBottom: "6px" }}>
                    Fulfillment Method
                  </label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setManualIsPickup(false)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "8px",
                        border: !manualIsPickup ? "2px solid #065f46" : "1px solid #d1d5db",
                        background: !manualIsPickup ? "#ecfdf5" : "#fff",
                        color: !manualIsPickup ? "#065f46" : "#374151",
                        fontWeight: 800,
                        fontSize: "0.78rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px]">delivery_dining</span>
                      <span>Home Delivery</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualIsPickup(true)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "8px",
                        border: manualIsPickup ? "2px solid #b45309" : "1px solid #d1d5db",
                        background: manualIsPickup ? "#fef3c7" : "#fff",
                        color: manualIsPickup ? "#b45309" : "#374151",
                        fontWeight: 800,
                        fontSize: "0.78rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px]">storefront</span>
                      <span>Store Counter Takeaway</span>
                    </button>
                  </div>
                </div>

                {!manualIsPickup && (
                  <div style={{ marginTop: "10px" }}>
                    <label style={{ fontSize: "0.74rem", fontWeight: 700, color: "#374151", display: "block", marginBottom: "4px" }}>
                      Delivery Address *
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. House No 42, Main Road, Kishore Ganj / Doranda, Ranchi"
                      value={manualCustAddress}
                      onChange={(e) => setManualCustAddress(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        fontSize: "0.82rem",
                        fontWeight: 500,
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Section 2: Add Meat Items */}
              <div style={{ background: "#f9fafb", padding: "14px", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#111827", marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="material-symbols-outlined text-[16px] text-emerald-700">restaurant</span>
                    <span>Meat Items ({manualItems.length})</span>
                  </div>
                  {inventorySuggestions.length > 0 && (
                    <span style={{ fontSize: "0.7rem", color: "#6b7280" }}>
                      {inventorySuggestions.length} items in live stock
                    </span>
                  )}
                </div>

                {/* Quick select from Store Inventory */}
                {inventorySuggestions.length > 0 && (
                  <div style={{ marginBottom: "10px" }}>
                    <label style={{ fontSize: "0.72rem", color: "#6b7280", display: "block", marginBottom: "3px" }}>
                      Quick Pick from Store Stock:
                    </label>
                    <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
                      {inventorySuggestions.slice(0, 6).map((inv: any) => (
                        <button
                          key={inv.id || inv.item}
                          type="button"
                          onClick={() => handleSelectInventorySuggestion(inv)}
                          style={{
                            whiteSpace: "nowrap",
                            background: "#fff",
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            padding: "4px 8px",
                            fontSize: "0.72rem",
                            cursor: "pointer",
                            fontWeight: 600,
                            color: "#374151",
                          }}
                        >
                          + {inv.item || inv.name} ({inv.stock}{inv.unit || "kg"})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Item Entry Row: Responsive on Mobile & Desktop */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {/* Product Selection Dropdown */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label style={{ fontSize: "0.74rem", fontWeight: 700, color: "#374151" }}>
                        Select Product / Meat Cut *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (isCustomItem) {
                            setIsCustomItem(false);
                            setSelectedProductId("");
                            setQuickItemName("");
                            setQuickItemPrice("");
                            setQuickItemWeight("500g");
                          } else {
                            setIsCustomItem(true);
                            setSelectedProductId("custom");
                            setQuickItemName("");
                            setQuickItemPrice("");
                            setQuickItemWeight("500g");
                          }
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#047857",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "3px",
                          padding: "2px 4px",
                        }}
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {isCustomItem ? "format_list_bulleted" : "edit_note"}
                        </span>
                        <span>{isCustomItem ? "Select from Dropdown" : "Write Custom Item"}</span>
                      </button>
                    </div>

                    {!isCustomItem ? (
                      <div style={{ position: "relative" }}>
                        <select
                          value={selectedProductId}
                          onChange={(e) => handleSelectProduct(e.target.value)}
                          disabled={loadingCatalog}
                          style={{
                            width: "100%",
                            padding: "8px 30px 8px 10px",
                            borderRadius: "8px",
                            border: "1.5px solid #10b981",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            color: selectedProductId ? "#111827" : "#6b7280",
                            background: "#fff",
                            cursor: "pointer",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                          }}
                        >
                          <option value="">
                            {loadingCatalog ? "Loading products catalog..." : "-- Choose Product (Auto-fills Price & Weight) --"}
                          </option>
                          {Object.entries(groupedCatalogProducts).map(([categoryName, prods]) => (
                            <optgroup key={categoryName} label={categoryName}>
                              {prods.map((p: any) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} — ₹{p.price} ({p.netWeight || p.grossWeight || "500g"})
                                  {!p.inStock ? " [Out of Stock]" : ""}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                          <option value="custom">✏️ Enter Custom / Unlisted Cut...</option>
                        </select>
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder="e.g. Skinless Special Cut, Soup Bones, Custom Cut"
                        value={quickItemName}
                        onChange={(e) => setQuickItemName(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1.5px solid #10b981",
                          fontSize: "0.82rem",
                          fontWeight: 500,
                        }}
                        autoFocus
                      />
                    )}
                  </div>

                  {/* Auto-filled Item Details: Weight, Price, Qty, Add button */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
                    <div>
                      <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#4b5563", display: "block", marginBottom: "3px" }}>
                        Weight / Cut
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 500g, 1kg"
                        value={quickItemWeight}
                        onChange={(e) => setQuickItemWeight(e.target.value)}
                        list="weight-preset-options"
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "6px",
                          border: "1px solid #d1d5db",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          background: "#fff",
                          height: "35px",
                        }}
                      />
                      <datalist id="weight-preset-options">
                        <option value="250g" />
                        <option value="500g" />
                        <option value="750g" />
                        <option value="1kg" />
                        <option value="1 piece" />
                        <option value="4 pieces" />
                        <option value="6 pieces" />
                      </datalist>
                    </div>

                    <div>
                      <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#4b5563", display: "block", marginBottom: "3px" }}>
                        Price (₹)
                      </label>
                      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        <span style={{ position: "absolute", left: "8px", fontSize: "0.8rem", color: "#6b7280", fontWeight: 700 }}>₹</span>
                        <input
                          type="number"
                          placeholder="220"
                          value={quickItemPrice}
                          onChange={(e) => setQuickItemPrice(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "7px 10px 7px 22px",
                            borderRadius: "6px",
                            border: "1px solid #d1d5db",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            height: "35px",
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#4b5563", display: "block", marginBottom: "3px" }}>
                        Qty
                      </label>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        overflow: "hidden",
                        background: "#fff",
                        height: "35px",
                      }}>
                        <button
                          type="button"
                          onClick={() => setQuickItemQty((q) => Math.max(1, q - 1))}
                          style={{
                            width: "32px",
                            height: "100%",
                            background: "#f3f4f6",
                            border: "none",
                            color: "#374151",
                            fontWeight: 800,
                            fontSize: "0.9rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={quickItemQty}
                          onChange={(e) => setQuickItemQty(Math.max(1, Number(e.target.value) || 1))}
                          style={{
                            width: "100%",
                            textAlign: "center",
                            fontWeight: 800,
                            fontSize: "0.82rem",
                            border: "none",
                            outline: "none",
                            height: "100%",
                            color: "#111827",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setQuickItemQty((q) => Math.min(50, q + 1))}
                          style={{
                            width: "32px",
                            height: "100%",
                            background: "#f3f4f6",
                            border: "none",
                            color: "#374151",
                            fontWeight: 800,
                            fontSize: "0.9rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={handleAddManualItem}
                        style={{
                          width: "100%",
                          background: "#065f46",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          fontWeight: 800,
                          fontSize: "0.82rem",
                          cursor: "pointer",
                          height: "35px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                          boxShadow: "0 1px 3px rgba(6, 95, 70, 0.25)",
                        }}
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        <span>Add Item</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Added Items List */}
                {manualItems.length > 0 && (
                  <div style={{ marginTop: "12px", borderTop: "1px solid #e5e7eb", paddingTop: "8px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {manualItems.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "#fff",
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "1px solid #e5e7eb",
                            fontSize: "0.8rem",
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 700, color: "#111827" }}>{item.name}</span>
                            <span style={{ color: "#6b7280", marginLeft: "6px" }}>({item.netWeight} ×{item.quantity})</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontWeight: 800, color: "#065f46" }}>₹{(item.price || 0) * (item.quantity || 1)}</span>
                            <button
                              type="button"
                              onClick={() => setManualItems(prev => prev.filter((_, i) => i !== idx))}
                              style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: "2px" }}
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Payment & Notes */}
              <div style={{ background: "#f9fafb", padding: "14px", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label style={{ fontSize: "0.74rem", fontWeight: 700, color: "#374151", display: "block", marginBottom: "4px" }}>
                      Payment Method
                    </label>
                    <select
                      value={manualPaymentMethod}
                      onChange={(e) => setManualPaymentMethod(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "0.82rem", background: "#fff" }}
                    >
                      <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                      <option value="UPI on Delivery">UPI QR on Delivery</option>
                      <option value="Paid at Store Counter">Paid at Store Counter</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.74rem", fontWeight: 700, color: "#374151", display: "block", marginBottom: "4px" }}>
                      Payment Status
                    </label>
                    <select
                      value={manualPaymentStatus}
                      onChange={(e) => setManualPaymentStatus(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "0.82rem", background: "#fff" }}
                    >
                      <option value="Pending">Pending (Collect on Delivery)</option>
                      <option value="Paid">Paid (Already Received)</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: "10px" }}>
                  <label style={{ fontSize: "0.74rem", fontWeight: 700, color: "#374151", display: "block", marginBottom: "4px" }}>
                    Special Cutting / Preparation Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Skinless medium cut, extra curry pieces"
                    value={manualOrderNotes}
                    onChange={(e) => setManualOrderNotes(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "0.8rem" }}
                  />
                </div>
              </div>

              {/* Total Calculation Summary */}
              {manualItems.length > 0 && (() => {
                const subtotal = manualItems.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
                const configuredFee = typeof storeSettings?.standardDeliveryFee === "number" ? storeSettings.standardDeliveryFee : 40;
                const freeThreshold = typeof storeSettings?.freeDeliveryThreshold === "number" ? storeSettings.freeDeliveryThreshold : 399;
                const deliveryFee = manualIsPickup ? 0 : (subtotal >= freeThreshold ? 0 : configuredFee);
                const total = subtotal + deliveryFee;

                return (
                  <div style={{ background: "#ecfdf5", padding: "12px 16px", borderRadius: "10px", border: "1px solid #a7f3d0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#065f46" }}>
                        Subtotal: ₹{subtotal} {deliveryFee > 0 ? `+ ₹${deliveryFee} Delivery` : "(Free Delivery)"}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#047857", fontWeight: 600 }}>
                        📱 Customer can track live on TeFFe App/Web under #{manualCustPhone}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.72rem", color: "#065f46", textTransform: "uppercase", fontWeight: 700 }}>Total Order Value</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#065f46" }}>₹{total}</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "14px 20px",
              background: "#f9fafb",
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
            }}>
              <button
                type="button"
                onClick={() => setShowCreateOrderModal(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  color: "#374151",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveManualOrder}
                disabled={submittingManualOrder || manualItems.length === 0 || manualCustPhone.replace(/\D/g, "").length < 10}
                style={{
                  padding: "8px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: submittingManualOrder || manualItems.length === 0 || manualCustPhone.replace(/\D/g, "").length < 10 ? "#9ca3af" : "#065f46",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                  cursor: submittingManualOrder || manualItems.length === 0 || manualCustPhone.replace(/\D/g, "").length < 10 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 6px rgba(6, 95, 70, 0.25)",
                }}
              >
                <span className="material-symbols-outlined text-[17px]">check_circle</span>
                <span>{submittingManualOrder ? "Placing Order…" : "Place Order (Created by Self)"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {printModalOrder && (
        <ThermalKOTModal
          order={printModalOrder}
          onClose={() => setPrintModalOrder(null)}
        />
      )}

      {editModalOrder && (
        <OrderEditModal
          order={editModalOrder}
          catalogProducts={catalogProducts}
          onClose={() => setEditModalOrder(null)}
          onSuccess={() => {
            setEditModalOrder(null);
            fetchOrders();
          }}
        />
      )}

      {/* ─── CANCEL ORDER CONFIRMATION MODAL (MOBILE RESPONSIVE) ─── */}
      {cancelModalOrder && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "16px"
        }}>
          <div style={{
            background: "#fff",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "460px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            overflow: "hidden"
          }}>
            <div style={{
              padding: "16px 20px",
              background: "#fff1f2",
              borderBottom: "1px solid #ffe4e6",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#fecdd3", display: "flex", alignItems: "center", justifyContent: "center", color: "#e11d48", flexShrink: 0 }}>
                  <span className="material-symbols-outlined text-[20px]">cancel</span>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#9f1239" }}>
                    Cancel Order #{cancelModalOrder.orderId || cancelModalOrder.id}
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "0.74rem", color: "#e11d48" }}>
                    Customer will be notified with this reason
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#be123c", padding: "4px" }}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ background: "#faf8f5", border: "1px solid #ede8e0", borderRadius: "10px", padding: "10px 14px", fontSize: "0.82rem" }}>
                <div style={{ fontWeight: 700, color: "#171410" }}>
                  {cancelModalOrder.customer?.name || "Customer"}{cancelModalOrder.customer?.phone ? ` · 📞 ${cancelModalOrder.customer.phone}` : ""}
                </div>
                <div style={{ color: "#73695b", fontSize: "0.76rem", marginTop: "2px", wordBreak: "break-word" }}>
                  {cancelModalOrder.customer?.address || "Ranchi"}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>
                  Reason for Cancellation *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Delivery location outside coverage area / Stock unavailable / Customer requested cancellation"
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1.5px solid #d1d5db",
                    fontSize: "0.85rem",
                    outline: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box"
                  }}
                />
              </div>
            </div>

            <div style={{
              padding: "14px 20px",
              background: "#faf8f5",
              borderTop: "1px solid #ede8e0",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "flex-end",
              gap: "10px"
            }}>
              <button
                type="button"
                disabled={cancellingOrder}
                onClick={() => setCancelModalOrder(null)}
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  background: "#fff",
                  border: "1px solid #d1d5db",
                  color: "#374151",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  flex: "1 1 auto",
                  textAlign: "center"
                }}
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={cancellingOrder || !cancelReasonInput.trim()}
                onClick={handleCancelOrderStoreAdmin}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  background: cancellingOrder || !cancelReasonInput.trim() ? "#fca5a5" : "#e11d48",
                  color: "#fff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: cancellingOrder || !cancelReasonInput.trim() ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  flex: "1 1 auto"
                }}
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                <span>{cancellingOrder ? "Cancelling…" : "Confirm Cancel"}</span>
              </button>
            </div>
          </div>
        </div>
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
            <div
              key={p.id}
              className="bg-white border border-[#ede8e0] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs"
            >
              <div className="w-full sm:flex-1">
                <div style={{ fontWeight: 700, color: "#171410", marginBottom: "3px", fontSize: "0.95rem" }}>{p.name}</div>
                <div style={{ fontSize: "0.8rem", color: "#73695b" }}>{p.categoryLabel || p.category} · <span style={{ fontWeight: 700, color: "#941717" }}>₹{p.price}</span> ({p.netWeight})</div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2.5 sm:pt-0 border-t border-[#f5f2ed] sm:border-0">
                <Badge label={p.inStock ? "In Stock" : "Out of Stock"} color={p.inStock ? "#059669" : "#d97706"} />
                <button
                  onClick={() => toggleStock(p.id, p.inStock)}
                  style={{
                    background: p.inStock ? "#fdf2f2" : "#ecfdf5",
                    border: `1.5px solid ${p.inStock ? "#fecaca" : "#a7f3d0"}`,
                    borderRadius: "8px",
                    padding: "7px 14px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    color: p.inStock ? "#941717" : "#059669",
                    whiteSpace: "nowrap",
                    transition: "all 150ms ease",
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
  const [activeFilter, setActiveFilter] = useState<"all" | "fresh" | "defreeze" | "waste" | "transfers" | "history">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const currentUser = getStoredUser();

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
        // Immediately reflect update on the card
        setItems(prev => prev.map(it => {
          const matchId = (it.itemId || it.id) === (moveModalItem.itemId || moveModalItem.id) || it.id === moveModalItem.id || it.itemId === moveModalItem.itemId;
          if (matchId) {
            return {
              ...it,
              stock: res.data.stock !== undefined ? res.data.stock : Math.round(((Number(it.stock) || 0) + parsedMoveQty) * 1000) / 1000,
              defreezeStock: res.data.defreezeStock !== undefined ? res.data.defreezeStock : Math.max(0, Math.round(((Number(it.defreezeStock) || 0) - parsedMoveQty) * 1000) / 1000),
            };
          }
          return it;
        }));
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
        // Immediately reflect update on the card
        setItems(prev => prev.map(it => {
          const matchId = (it.itemId || it.id) === (wasteModalItem.itemId || wasteModalItem.id) || it.id === wasteModalItem.id || it.itemId === wasteModalItem.itemId;
          if (matchId) {
            return {
              ...it,
              stock: wasteSource === "fresh" ? (res.data.remainingSourceStock !== undefined ? res.data.remainingSourceStock : Math.max(0, Math.round(((Number(it.stock) || 0) - parsedWasteQty) * 1000) / 1000)) : it.stock,
              defreezeStock: wasteSource === "defreeze" ? (res.data.remainingSourceStock !== undefined ? res.data.remainingSourceStock : Math.max(0, Math.round(((Number(it.defreezeStock) || 0) - parsedWasteQty) * 1000) / 1000)) : it.defreezeStock,
              wasteStock: res.data.wasteStock !== undefined ? res.data.wasteStock : Math.round(((Number(it.wasteStock) || 0) + parsedWasteQty) * 1000) / 1000,
            };
          }
          return it;
        }));
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
      const payload: any = {
        classification: adjustClass,
        operation: adjustOp,
        quantity: parsedAdjustQty,
        reason: adjustReason.trim(),
      };
      if (adjustClass === "fresh") {
        payload.stock = projectedAdjustResult;
        if (adjustMin !== undefined && adjustMin !== "") {
          payload.min = Math.max(0, Number(adjustMin) || 0);
        }
      } else if (adjustClass === "defreeze") {
        payload.defreezeStock = projectedAdjustResult;
      }

      const res = await api.patch(`/store-admin/inventory/${id}`, payload);
      if (res.data?.success) {
        toast.success("Inventory stock adjusted successfully", "Stock Updated");
        const updatedItem = res.data.item;
        // Immediately reflect update on the card
        setItems(prev => prev.map(it => {
          const matchId = (it.itemId || it.id) === id || it.id === adjustModalItem.id || it.itemId === adjustModalItem.itemId;
          if (matchId) {
            return {
              ...it,
              ...(updatedItem || {}),
              stock: adjustClass === "fresh" ? projectedAdjustResult : (updatedItem?.stock !== undefined ? updatedItem.stock : it.stock),
              defreezeStock: adjustClass === "defreeze" ? projectedAdjustResult : (updatedItem?.defreezeStock !== undefined ? updatedItem.defreezeStock : it.defreezeStock),
              min: adjustClass === "fresh" && adjustMin !== "" ? Number(adjustMin) : (updatedItem?.min !== undefined ? updatedItem.min : it.min),
            };
          }
          return it;
        }));
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 w-full">
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
            { key: "transfers", label: "Inter-Store Transfers", icon: "swap_horiz" },
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

      {/* ─── BODY CONTENT: TRANSFERS, AUDIT HISTORY, OR CARDS GRID ────────────────── */}
      {activeFilter === "transfers" ? (
        <StoreTransfersSection
          currentStoreId={currentUser?.storeId}
          currentStoreName={currentUser?.storeName}
          inventoryItems={items}
          onInventoryUpdated={fetchInventory}
        />
      ) : activeFilter === "history" ? (
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
                <option value="return_waste">Customer Return Waste</option>
                <option value="add_stock">Stock Received (Add)</option>
                <option value="reduce_stock">Stock Reduced</option>
                <option value="set_stock">Stock Set Exact</option>
                <option value="order_restock">Order Restocks (Cancellations)</option>
                <option value="transfer_in">Inter-Store Inbound (Transfers)</option>
                <option value="transfer_out">Inter-Store Outbound (Transfers)</option>
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
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", textAlign: "left", minWidth: "720px" }}>
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
                    const actionType = h.actionType || "updated";
                    const actionBadge = (() => {
                      switch (actionType) {
                        case "transfer_defreeze_to_fresh":
                          return <Badge label="De-Freeze → Fresh" color="#2563eb" />;
                        case "order_deduction":
                          return <Badge label="Order Deduction" color="#d97706" />;
                        case "record_waste":
                          return <Badge label="Damage / Waste" color="#dc2626" />;
                        case "return_waste":
                          return <Badge label="Customer Return Waste" color="#be123c" />;
                        case "fresh_stock_added":
                        case "add_stock":
                          return <Badge label="Stock Added" color="#059669" />;
                        case "defreeze_stock_added":
                          return <Badge label="De-Freeze Added" color="#0f766e" />;
                        case "reduce_stock":
                          return <Badge label="Stock Reduced" color="#ea580c" />;
                        case "set_stock":
                          return <Badge label="Stock Reconciled" color="#7c3aed" />;
                        case "order_restock":
                          return <Badge label="Order Restocked" color="#059669" />;
                        case "transfer_in":
                        case "transfer_store_credit":
                          return <Badge label="Transfer Inbound" color="#059669" />;
                        case "transfer_out":
                        case "transfer_store_deduct":
                          return <Badge label="Transfer Outbound" color="#2563eb" />;
                        case "transfer_store_reversal":
                          return <Badge label="Transfer Cancelled" color="#7c3aed" />;
                        default:
                          return <Badge label={actionType.replace(/_/g, " ")} color="#73695b" />;
                      }
                    })();

                    const isDeduction =
                      actionType === "order_deduction" ||
                      actionType === "record_waste" ||
                      actionType === "return_waste" ||
                      actionType === "reduce_stock" ||
                      actionType === "transfer_out" ||
                      actionType === "transfer_store_deduct";

                    const rawQuantity = h.quantity != null ? h.quantity : (h.quantityChanged != null ? Math.abs(h.quantityChanged) : 0);
                    const numQuantity = !isNaN(Number(rawQuantity)) ? Math.abs(Number(rawQuantity)) : 0;
                    const safeUnit = h.unit || "kg";

                    const prevRaw = h.previousQuantity != null ? h.previousQuantity : (h.previousStock != null ? h.previousStock : null);
                    const resRaw = h.resultingQuantity != null ? h.resultingQuantity : (h.newStock != null ? h.newStock : null);
                    const hasPrev = prevRaw != null && !isNaN(Number(prevRaw));
                    const hasRes = resRaw != null && !isNaN(Number(resRaw));

                    const dateObj = h.createdAt ? new Date(h.createdAt) : null;
                    const dateDisplay = dateObj && !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
                      : "—";
                    const timeDisplay = dateObj && !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                      : "";

                    const actorName = h.actor?.name || (typeof h.performedBy === "string" ? h.performedBy : h.performedBy?.name) || "System";
                    const actorRole = h.actor?.role || (typeof h.performedBy === "object" ? h.performedBy?.role : "system") || "system";

                    return (
                      <tr key={h._id || h.id || Math.random()} style={{ borderBottom: "1px solid #ede8e0" }}>
                        <td style={{ padding: "10px 14px", color: "#73695b", whiteSpace: "nowrap" }}>
                          {dateDisplay}{" "}
                          {timeDisplay && (
                            <span style={{ fontSize: "0.74rem", color: "#a89f91" }}>
                              {timeDisplay}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ fontWeight: 700, color: "#171410" }}>
                            {h.productName || h.itemName || "Product Cut"}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "#73695b" }}>
                            {h.category || h.itemId || ""}
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{actionBadge}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 800, color: isDeduction ? "#dc2626" : "#059669", whiteSpace: "nowrap" }}>
                          {isDeduction ? `-${numQuantity}` : `+${numQuantity}`} {safeUnit}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#73695b", whiteSpace: "nowrap" }}>
                          {hasPrev && hasRes ? (
                            <span>{Number(prevRaw)} → <strong>{Number(resRaw)}</strong> {safeUnit}</span>
                          ) : "—"}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#423b32", maxWidth: "260px" }}>
                          <div>{h.reason || h.notes || "—"}</div>
                          {h.orderId && (
                            <div style={{ fontSize: "0.72rem", color: "#941717", fontWeight: 700 }}>
                              Order #{h.orderId}
                            </div>
                          )}
                          {h.notes && h.notes !== h.reason && (
                            <div style={{ fontSize: "0.72rem", color: "#73695b", fontStyle: "italic" }}>
                              {h.notes}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#73695b", whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 600, color: "#171410" }}>{actorName}</div>
                          <div style={{ fontSize: "0.7rem", color: "#a89f91", textTransform: "capitalize" }}>{actorRole}</div>
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
        <div style={{ width: "100%" }}>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 w-full">
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
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {defreezeStock > 0 ? `Move De-Freeze to Fresh (${defreezeStock} ${item.unit})` : `De-Freeze Pool Empty (0 ${item.unit})`}
                        </span>
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
                            padding: "7px 10px",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "5px",
                            whiteSpace: "nowrap",
                            transition: "background 120ms ease",
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
                            padding: "7px 10px",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "5px",
                            whiteSpace: "nowrap",
                            transition: "background 120ms ease",
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

const formatDateDDMMYYYY = (val: any) => {
  if (!val) return "—";
  const str = String(val).trim();
  // If already in DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  // If in MM/DD/YYYY format from older node locale (e.g. 11/12/2026), check and convert
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const p1 = Number(parts[0]);
      const p2 = Number(parts[1]);
      const p3 = parts[2];
      if (p1 > 12) {
        return `${String(p1).padStart(2, '0')}/${String(p2).padStart(2, '0')}/${p3}`;
      }
    }
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return str;
  // Format in IST DD/MM/YYYY
  const istDate = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const year = istDate.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

function CustomersTab() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<"all" | "active" | "new" | "inactive">("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

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

  // Reset page when search or segment filter changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, segmentFilter]);

  // Counts for segmentation pills
  const segmentCounts = useMemo(() => {
    let active = 0;
    let newCust = 0;
    let inactive = 0;
    customers.forEach(c => {
      const seg = c.segment || "new";
      if (seg === "active") active++;
      else if (seg === "new") newCust++;
      else if (seg === "inactive") inactive++;
    });
    return { all: customers.length, active, new: newCust, inactive };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      // Segment filter
      if (segmentFilter !== "all") {
        const seg = c.segment || "new";
        if (seg !== segmentFilter) return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (c.name || "").toLowerCase();
        const phone = (c.phone || "").toLowerCase();
        const addr = (c.address || "").toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !addr.includes(q)) return false;
      }
      return true;
    });
  }, [customers, searchQuery, segmentFilter]);

  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, page, pageSize]);

  return (
    <div>
      {/* Segment Filter Pills Bar - Mobile View Optimized */}
      <div
        className="no-scrollbar"
        style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          whiteSpace: "nowrap",
          padding: "2px 2px 10px 2px",
          marginBottom: "16px",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {[
          { key: "all", label: "All Customers", count: segmentCounts.all, color: "#1e3a8a", bg: "#eff6ff" },
          { key: "active", label: "Active / Repeat", count: segmentCounts.active, color: "#047857", bg: "#ecfdf5", desc: "≥ 2 orders, last 30d" },
          { key: "new", label: "New Customers", count: segmentCounts.new, color: "#2563eb", bg: "#eff6ff", desc: "1st order, last 30d" },
          { key: "inactive", label: "Inactive (Win-Back)", count: segmentCounts.inactive, color: "#dc2626", bg: "#fef2f2", desc: "No order > 30d" },
        ].map(tab => {
          const isSelected = segmentFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSegmentFilter(tab.key as any)}
              style={{
                padding: "8px 14px",
                borderRadius: "10px",
                border: "1.5px solid",
                borderColor: isSelected ? tab.color : "#e5e7eb",
                background: isSelected ? tab.bg : "#ffffff",
                color: isSelected ? tab.color : "#4b5563",
                fontWeight: 700,
                fontSize: "0.8rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                flexShrink: 0,
                boxShadow: isSelected ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 120ms ease",
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  background: isSelected ? tab.color : "#f3f4f6",
                  color: isSelected ? "#ffffff" : "#4b5563",
                  padding: "1px 7px",
                  borderRadius: "99px",
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  lineHeight: 1.2,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Toolbar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
        marginBottom: "16px",
        background: "#faf8f5",
        padding: "12px 16px",
        borderRadius: "12px",
        border: "1px solid #ede8e0",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, maxWidth: "420px" }}>
          <span className="material-symbols-outlined text-[18px] text-gray-500">search</span>
          <input
            type="text"
            placeholder="Search customer by name, phone, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "7px 12px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "0.825rem",
              background: "#fff",
              width: "100%",
              outline: "none",
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                background: "transparent",
                border: "none",
                color: "#73695b",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: 700,
              }}
            >
              Clear
            </button>
          )}
        </div>
        <div style={{ fontSize: "0.8rem", color: "#73695b", fontWeight: 600 }}>
          Showing: <strong style={{ color: "#941717" }}>{filteredCustomers.length}</strong> customers
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#73695b" }}>Loading customers…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", minWidth: "750px" }}>
            <thead>
              <tr style={{ background: "#faf8f5", borderBottom: "1px solid #ede8e0" }}>
                {["Customer", "Status / Segment", "Phone", "Total Orders", "Total Spent", "Last Order", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "#423b32", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#73695b" }}>
                    No customer accounts found matching this segment/search.
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((c, i) => {
                  const seg = c.segment || "new";
                  const cleanPhone = String(c.phone || "").replace(/\D/g, "").slice(-10);
                  const isInactive = seg === "inactive";
                  const isActive = seg === "active";
                  const isNew = seg === "new";

                  return (
                    <tr key={c.id || c._id || (c.phone ? `${c.phone}-${i}` : i)} style={{ borderBottom: i < paginatedCustomers.length - 1 ? "1px solid #ede8e0" : "none" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, color: "#171410" }}>{c.name}</div>
                        <div style={{ color: "#73695b", fontSize: "0.75rem", marginTop: "2px" }}>{c.address}</div>
                      </td>
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        {isActive && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", borderRadius: "99px", background: "#ecfdf5", color: "#047857", fontSize: "0.74rem", fontWeight: 800 }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#059669" }} />
                            Active Repeat ({c.daysSinceLastOrder != null ? (c.daysSinceLastOrder === 0 ? "Today" : c.daysSinceLastOrder === 1 ? "1d ago" : `${c.daysSinceLastOrder}d ago`) : "Recent"})
                          </span>
                        )}
                        {isNew && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", borderRadius: "99px", background: "#eff6ff", color: "#1d4ed8", fontSize: "0.74rem", fontWeight: 800 }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#2563eb" }} />
                            New Customer ({c.daysSinceLastOrder != null ? (c.daysSinceLastOrder === 0 ? "Today" : c.daysSinceLastOrder === 1 ? "1d ago" : `${c.daysSinceLastOrder}d ago`) : "1st order"})
                          </span>
                        )}
                        {isInactive && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", borderRadius: "99px", background: "#fef2f2", color: "#b91c1c", fontSize: "0.74rem", fontWeight: 800 }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#dc2626" }} />
                            Inactive ({c.daysSinceLastOrder != null ? `${c.daysSinceLastOrder}d idle` : "No recent orders"})
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#423b32", fontWeight: 600, fontSize: "0.82rem" }}>{c.phone}</td>
                      <td style={{ padding: "14px 16px", fontWeight: 800, color: "#941717" }}>{c.totalOrders ?? c.orders ?? 0}</td>
                      <td style={{ padding: "14px 16px", fontWeight: 800, color: "#059669" }}>₹{c.totalSpent != null ? Number(c.totalSpent).toLocaleString("en-IN") : 0}</td>
                      <td style={{ padding: "14px 16px", color: "#73695b", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 600, color: "#1f2937" }}>
                          {formatDateDDMMYYYY(c.lastOrder || c.lastOrderDate)}
                        </div>
                        {c.daysSinceLastOrder != null && (
                          <div style={{ fontSize: "0.72rem", marginTop: "2px", color: isInactive ? "#dc2626" : "#4b5563", fontWeight: 600 }}>
                            {c.daysSinceLastOrder === 0
                              ? "Today"
                              : c.daysSinceLastOrder === 1
                              ? "Yesterday (1d ago)"
                              : `${c.daysSinceLastOrder} days ago`}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {cleanPhone && (
                            <>
                              <a
                                href={`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(
                                  isInactive
                                    ? `Hello ${c.name || "Customer"}, we miss you at Teffes! We have fresh premium cuts ready today with special discounts. Order now!`
                                    : `Hello ${c.name || "Customer"}, thank you for being a valued Teffes customer! Need fresh cuts today?`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Chat on WhatsApp"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: "30px",
                                  height: "30px",
                                  borderRadius: "7px",
                                  background: "#ecfdf5",
                                  color: "#16a34a",
                                  border: "1px solid #a7f3d0",
                                  textDecoration: "none",
                                  fontWeight: 800,
                                }}
                              >
                                <svg style={{ width: "16px", height: "16px", fill: "currentColor", flexShrink: 0 }} viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                              </a>
                              <a
                                href={`tel:${cleanPhone}`}
                                title="Call Customer"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: "30px",
                                  height: "30px",
                                  borderRadius: "7px",
                                  background: "#f3f4f6",
                                  color: "#374151",
                                  textDecoration: "none",
                                  fontWeight: 800,
                                }}
                              >
                                <span className="material-symbols-outlined text-[16px]">call</span>
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        currentPage={page}
        totalItems={filteredCustomers.length}
        pageSize={pageSize}
        onPageChange={setPage}
        itemLabel="customers"
      />
    </div>
  );
}

function RidersTab({ storeId }: { storeId?: string }) {
  const [riders, setRiders] = useState<any[]>([]);
  const [readyOrders, setReadyOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pagination & Filtering
  const [riderSearch, setRiderSearch] = useState("");
  const [riderStatusFilter, setRiderStatusFilter] = useState("All");
  const [riderPage, setRiderPage] = useState(1);
  const [dispatchPage, setDispatchPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setRiderPage(1);
  }, [riderSearch, riderStatusFilter]);

  const filteredPoolRiders = useMemo(() => {
    return riders.filter(r => {
      if (riderStatusFilter !== "All" && (r.riderStatus || "Available") !== riderStatusFilter) return false;
      if (riderSearch.trim()) {
        const q = riderSearch.toLowerCase().trim();
        const matchesName = (r.name || "").toLowerCase().includes(q);
        const matchesPhone = (r.phone || "").toLowerCase().includes(q);
        const matchesVehicle = (r.vehicleNumber || "").toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesVehicle) return false;
      }
      return true;
    });
  }, [riders, riderSearch, riderStatusFilter]);

  const paginatedPoolRiders = useMemo(() => {
    const start = (riderPage - 1) * pageSize;
    return filteredPoolRiders.slice(start, start + pageSize);
  }, [filteredPoolRiders, riderPage, pageSize]);

  const paginatedReadyOrders = useMemo(() => {
    const start = (dispatchPage - 1) * pageSize;
    return readyOrders.slice(start, start + pageSize);
  }, [readyOrders, dispatchPage, pageSize]);

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

  // Cash Remittances & Fleet Collection
  const [remittances, setRemittances] = useState<any[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectRider, setCollectRider] = useState<any | null>(null);
  const [collectAmount, setCollectAmount] = useState<string>("");
  const [collectNotes, setCollectNotes] = useState<string>("");
  const [collectingCash, setCollectingCash] = useState(false);

  // Multi-Order Batch Dispatch Configuration
  const [batchConfig, setBatchConfig] = useState({
    maxBatchSize: 3,
    maxDetourKm: 3.5,
    maxTotalRouteKm: 15.0,
    maxEstimatedMinutes: 45,
    maxBatchWeightKg: 10.0,
  });
  const [draftBatchConfig, setDraftBatchConfig] = useState({
    maxBatchSize: 3,
    maxDetourKm: 3.5,
    maxTotalRouteKm: 15.0,
    maxEstimatedMinutes: 45,
    maxBatchWeightKg: 10.0,
  });
  const [showBatchConfigModal, setShowBatchConfigModal] = useState(false);
  const [savingBatchConfig, setSavingBatchConfig] = useState(false);

  const isBatchConfigDirty =
    draftBatchConfig.maxBatchSize !== batchConfig.maxBatchSize ||
    draftBatchConfig.maxDetourKm !== batchConfig.maxDetourKm ||
    draftBatchConfig.maxTotalRouteKm !== batchConfig.maxTotalRouteKm ||
    draftBatchConfig.maxEstimatedMinutes !== batchConfig.maxEstimatedMinutes ||
    draftBatchConfig.maxBatchWeightKg !== batchConfig.maxBatchWeightKg;

  const fetchData = async () => {
    setLoading(true);
    try {
      const qStore = storeId ? `?storeId=${storeId}` : "";
      const [ridersResult, ordersResult, storeResult, remittancesResult, batchResult] = await Promise.allSettled([
        api.get<{ success: boolean; riders: any[] }>(`/store-admin/riders${qStore}`),
        api.get<{ success: boolean; orders: any[] }>(`/store-admin/orders?status=all${storeId ? `&storeId=${storeId}` : ""}`),
        api.get<{ success: boolean; store: any }>(`/store-admin/store-status${qStore}`),
        api.get<{ success: boolean; remittances: any[] }>(`/store-admin/remittances${qStore}`),
        api.get<{ success: boolean; settings: any; config: any }>(`/store-admin/batches/settings${qStore}`),
      ]);

      let relevantOrders: any[] = [];
      if (ordersResult.status === "fulfilled" && ordersResult.value.data?.success) {
        relevantOrders = (ordersResult.value.data.orders || []).filter((o: any) => {
          const isPickup =
            o.fulfillmentType === "pickup" ||
            o.pickupMode === true ||
            o.deliverySlot?.toLowerCase().includes("pickup") ||
            o.customer?.address?.toLowerCase().includes("pickup");
          return (o.status === "Ready" || o.status === "Out for Delivery") && !isPickup;
        });
        setReadyOrders(relevantOrders);
      }

      if (ridersResult.status === "fulfilled" && ridersResult.value.data?.success) {
        const outForDeliveryRiderNames = new Set(
          relevantOrders
            .filter((o: any) => o.status === "Out for Delivery")
            .map((o: any) => o.rider?.name?.trim().toLowerCase())
            .filter(Boolean)
        );

        const rawRiders = ridersResult.value.data.riders || [];
        const syncedRiders = rawRiders.map((r: any) => {
          const isBusy = outForDeliveryRiderNames.has(r.name?.trim().toLowerCase());
          if (isBusy && r.riderStatus !== "On Delivery") {
            return { ...r, riderStatus: "On Delivery" };
          }
          return r;
        });
        setRiders(syncedRiders);
      }

      if (storeResult.status === "fulfilled" && storeResult.value.data?.success && storeResult.value.data.store) {
        const s = storeResult.value.data.store;
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

      if (remittancesResult.status === "fulfilled" && remittancesResult.value.data?.success && Array.isArray(remittancesResult.value.data.remittances)) {
        setRemittances(remittancesResult.value.data.remittances);
      }

      if (batchResult.status === "fulfilled" && batchResult.value.data?.success) {
        const bs = batchResult.value.data.settings || batchResult.value.data.config;
        if (bs) {
          const cfg = {
            maxBatchSize: Number(bs.maxBatchSize) || 3,
            maxDetourKm: Number(bs.maxDetourKm) || 3.5,
            maxTotalRouteKm: Number(bs.maxTotalRouteKm) || 15.0,
            maxEstimatedMinutes: Number(bs.maxEstimatedMinutes) || 45,
            maxBatchWeightKg: Number(bs.maxBatchWeightKg) || 10.0,
          };
          setBatchConfig(cfg);
          setDraftBatchConfig(cfg);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch dispatch data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [storeId]);

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

  const handleSaveBatchConfig = async () => {
    if (!isBatchConfigDirty) return;
    setSavingBatchConfig(true);
    try {
      const res = await api.patch<{ success: boolean; settings?: any; config?: any; message?: string }>("/store-admin/batches/settings", draftBatchConfig);
      const bs = res.data?.settings || res.data?.config;
      if (res.data?.success && bs) {
        const cfg = {
          maxBatchSize: Number(bs.maxBatchSize) || 3,
          maxDetourKm: Number(bs.maxDetourKm) || 3.5,
          maxTotalRouteKm: Number(bs.maxTotalRouteKm) || 15.0,
          maxEstimatedMinutes: Number(bs.maxEstimatedMinutes) || 45,
          maxBatchWeightKg: Number(bs.maxBatchWeightKg) || 10.0,
        };
        setBatchConfig(cfg);
        setDraftBatchConfig(cfg);
        setShowBatchConfigModal(false);
        toast.success("Multi-order batch limits updated. Feasibility checks will use new thresholds.", "Batch Policy Updated");
      } else {
        toast.error(res.data?.message || "Failed to update batch limits", "Settings Error");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || "Failed to update batch limits", "Settings Error");
    } finally {
      setSavingBatchConfig(false);
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

  const handleOpenCollectModal = (rider: any) => {
    setCollectRider(rider);
    setCollectAmount(String(rider.cashInHand || ""));
    setCollectNotes(`Counter deposit received from ${rider.name || 'Rider'}`);
    setShowCollectModal(true);
  };

  const handleConfirmCollectCash = async () => {
    if (!collectRider || !collectAmount) return;
    const num = Number(collectAmount);
    if (isNaN(num) || num <= 0) {
      toast.error("Please enter a valid deposit amount", "Invalid Amount");
      return;
    }
    setCollectingCash(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>("/store-admin/remittances/collect", {
        riderId: collectRider.id || collectRider._id,
        amount: num,
        notes: collectNotes,
      });
      if (res.data.success) {
        toast.success(res.data.message || `Cash collected from ${collectRider.name}`, "Cash Settled");
        setShowCollectModal(false);
        setCollectRider(null);
        setCollectAmount("");
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to collect cash", "Collection Error");
    } finally {
      setCollectingCash(false);
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
  const totalFleetCashInHand = riders.reduce((acc, r) => acc + (Number(r.cashInHand) || 0), 0);
  const pendingRemittances = remittances.filter(r => r.status === "Pending");
  const confirmedRemittances = remittances.filter(r => r.status === "Confirmed");

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
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => {
                setDraftBatchConfig({ ...batchConfig });
                setShowBatchConfigModal(true);
              }}
              style={{
                background: "#0f172a",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                padding: "9px 16px",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 6px rgba(15,23,42,0.25)",
                transition: "transform 0.15s ease, background 0.15s ease"
              }}
            >
              <span className="material-symbols-outlined text-[18px]">alt_route</span>
              <span>Batch Limits</span>
            </button>
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

        {/* Multi-Order Batching Live Policy Banner */}
        <div style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "14px 18px",
          marginTop: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined text-[20px]" style={{ color: "#0284c7" }}>alt_route</span>
              <span style={{ fontWeight: 800, fontSize: "0.92rem", color: "#0f172a" }}>Multi-Order Batch Dispatch Policy</span>
              <span style={{ fontSize: "0.7rem", background: "#e0f2fe", color: "#0369a1", fontWeight: 700, padding: "2px 8px", borderRadius: "99px" }}>
                Configurable Limits
              </span>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.78rem", color: "#64748b" }}>
              Max {batchConfig.maxBatchSize} orders/trip &bull; Max detour: {batchConfig.maxDetourKm} km &bull; Max route: {batchConfig.maxTotalRouteKm} km &bull; Max time: {batchConfig.maxEstimatedMinutes} min &bull; Max weight: {batchConfig.maxBatchWeightKg} kg
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDraftBatchConfig({ ...batchConfig });
              setShowBatchConfigModal(true);
            }}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              background: "#fff",
              border: "1px solid #cbd5e1",
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "#334155",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
            }}
          >
            Configure Rules
          </button>
        </div>
      </div>

      {/* ─── RIDERS POOL ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", marginTop: "12px", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#171410", margin: 0 }}>Active Rider Pool</h3>
          <p style={{ fontSize: "0.78rem", color: "#73695b", margin: "2px 0 0 0" }}>Delivery partners active in your hub delivery area with live Cash in Hand</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={fetchData}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "#fff",
              border: "1px solid #cbd5e1",
              borderRadius: "99px",
              padding: "4px 10px",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#334155",
              cursor: "pointer",
            }}
          >
            <span className="material-symbols-outlined text-[15px]">refresh</span>
            <span>Refresh Pool</span>
          </button>
          {riders.length > 0 && (
            <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "99px", padding: "4px 12px", fontSize: "0.75rem", color: "#059669", fontWeight: 700 }}>
              {availableRiders.length} Available for Dispatch
            </div>
          )}
          <div style={{ background: totalFleetCashInHand > 0 ? "#fef3c7" : "#f5f3ef", border: `1px solid ${totalFleetCashInHand > 0 ? "#fde68a" : "#ede8e0"}`, borderRadius: "99px", padding: "4px 12px", fontSize: "0.75rem", color: totalFleetCashInHand > 0 ? "#b45309" : "#73695b", fontWeight: 800 }}>
            Fleet Cash in Hand: ₹{totalFleetCashInHand.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Rider Pool Filters */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "10px",
        marginBottom: "14px",
        background: "#faf8f5",
        padding: "10px 14px",
        borderRadius: "10px",
        border: "1px solid #ede8e0",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, maxWidth: "340px" }}>
          <span className="material-symbols-outlined text-[16px] text-gray-500">search</span>
          <input
            type="text"
            placeholder="Search rider by name, phone, vehicle..."
            value={riderSearch}
            onChange={(e) => setRiderSearch(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "0.8rem",
              background: "#fff",
              width: "100%",
              outline: "none",
            }}
          />
          {riderSearch && (
            <button
              type="button"
              onClick={() => setRiderSearch("")}
              style={{
                background: "transparent",
                border: "none",
                color: "#73695b",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              Clear
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {["All", "Available", "On Delivery", "Offline"].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setRiderStatusFilter(s)}
              style={{
                padding: "4px 10px",
                borderRadius: "99px",
                border: "1px solid #ede8e0",
                background: riderStatusFilter === s ? "#941717" : "#fff",
                color: riderStatusFilter === s ? "#fff" : "#423b32",
                fontSize: "0.74rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px", marginBottom: "16px" }}>
        {filteredPoolRiders.length === 0 && !loading && (
          <div style={{ padding: "24px", background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", color: "#73695b", fontSize: "0.85rem", textAlign: "center", gridColumn: "1 / -1" }}>
            No riders found matching your search.
          </div>
        )}
        {paginatedPoolRiders.map(r => {
          const cashOnHand = Number(r.cashInHand) || 0;
          const riderPendingRemit = pendingRemittances.find(
            (p: any) => p.riderId === (r.id || r._id) || (p.riderPhone && r.phone && p.riderPhone.replace(/\D/g, '') === r.phone.replace(/\D/g, ''))
          );

          return (
            <div key={r._id || r.id} style={{
              background: "#fff", border: "1px solid #ede8e0", borderRadius: "12px", padding: "16px",
              borderLeft: `4px solid ${r.riderStatus === "Available" ? "#059669" : r.riderStatus === "On Delivery" ? "#0284c7" : "#73695b"}`
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ fontWeight: 800, color: "#171410", fontSize: "1rem" }}>{r.name}</div>
                <Badge label={r.riderStatus || "Unknown"} color={r.riderStatus === "Available" ? "#059669" : r.riderStatus === "On Delivery" ? "#0284c7" : "#73695b"} />
              </div>
              <div style={{ fontSize: "0.8rem", color: "#423b32", marginBottom: "3px" }}>Phone: {r.phone}</div>
              <div style={{ fontSize: "0.75rem", color: "#73695b", marginBottom: "10px" }}>Vehicle: {r.vehicleNumber || "—"}</div>

              {/* Cash in Hand & Collect/Accept Action */}
              <div style={{
                background: cashOnHand > 0 ? "#fef3c7" : "#faf8f5",
                border: `1px solid ${cashOnHand > 0 ? "#fde68a" : "#ede8e0"}`,
                borderRadius: "8px",
                padding: "8px 10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "8px"
              }}>
                <div>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, color: cashOnHand > 0 ? "#92400e" : "#73695b", textTransform: "uppercase" }}>
                    Cash in Hand
                  </div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: cashOnHand > 0 ? "#b45309" : "#059669" }}>
                    ₹{cashOnHand.toFixed(2)}
                  </div>
                </div>

                {riderPendingRemit ? (
                  <button
                    onClick={() => handleConfirmRemittance(riderPendingRemit.remittanceId || riderPendingRemit._id)}
                    disabled={confirmingId === (riderPendingRemit.remittanceId || riderPendingRemit._id)}
                    style={{
                      background: "#059669",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 10px",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    <span>{confirmingId === (riderPendingRemit.remittanceId || riderPendingRemit._id) ? "Confirming…" : "Accept Cash"}</span>
                  </button>
                ) : cashOnHand > 0 ? (
                  <button
                    onClick={() => handleOpenCollectModal(r)}
                    style={{
                      background: "#941717",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "5px 10px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    Collect Cash
                  </button>
                ) : (
                  <span style={{ fontSize: "0.72rem", color: "#059669", fontWeight: 700 }}>
                    Settled
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: "24px" }}>
        <Pagination
          currentPage={riderPage}
          totalItems={filteredPoolRiders.length}
          pageSize={pageSize}
          onPageChange={setRiderPage}
          itemLabel="active riders"
        />
      </div>

      {/* ─── PENDING RIDER DEPOSIT REQUESTS (ONLY DISPLAYED IF ACTION IS REQUIRED) ─── */}
      {pendingRemittances.length > 0 && (
        <div style={{
          background: "#fffbeb",
          border: "1.5px solid #fde68a",
          borderRadius: "14px",
          padding: "16px 20px",
          marginBottom: "24px",
          boxShadow: "0 2px 6px rgba(245, 158, 11, 0.1)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined text-[20px]" style={{ color: "#b45309" }}>notifications_active</span>
              <h4 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#92400e", margin: 0 }}>
                {pendingRemittances.length} Rider Cash Deposit Awaiting Counter Acceptance
              </h4>
            </div>
            <span style={{ fontSize: "0.75rem", color: "#92400e", fontWeight: 700 }}>
              Verify physical banknotes before accepting
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {pendingRemittances.map((rem: any) => (
              <div key={rem._id || rem.remittanceId} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                background: "#fff",
                borderRadius: "10px",
                border: "1px solid #fde68a",
                flexWrap: "wrap",
                gap: "8px"
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: 800, color: "#171410", fontSize: "0.95rem" }}>
                      {rem.riderName || "Rider Partner"} ({rem.riderPhone})
                    </span>
                    <Badge label="Awaiting Confirmation" color="#d97706" />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#73695b", marginTop: "2px" }}>
                    Ref: #{rem.remittanceId} · Submitted: {new Date(rem.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    {rem.notes && ` · Notes: ${rem.notes}`}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "1.15rem", fontWeight: 900, color: "#941717" }}>
                    ₹{Number(rem.amount).toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleConfirmRemittance(rem.remittanceId || rem._id)}
                    disabled={confirmingId === (rem.remittanceId || rem._id)}
                    style={{
                      background: "#059669",
                      color: "#fff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "7px 14px",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>{confirmingId === (rem.remittanceId || rem._id) ? "Confirming…" : "Accept Cash"}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          {paginatedReadyOrders.map(o => (
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
                  {(o.deliveryInstruction || o.customer?.deliveryInstruction) && (
                    <div style={{
                      marginTop: "6px",
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderRadius: "6px",
                      padding: "3px 8px",
                      fontSize: "0.75rem",
                      color: "#92400e",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}>
                      <span className="material-symbols-outlined text-[14px] text-amber-700">note_alt</span>
                      <span><strong>Customer Instruction:</strong> {o.deliveryInstruction || o.customer?.deliveryInstruction}</span>
                    </div>
                  )}
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

      <Pagination
        currentPage={dispatchPage}
        totalItems={readyOrders.length}
        pageSize={pageSize}
        onPageChange={setDispatchPage}
        itemLabel="orders pending dispatch"
      />

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
      {/* ─── CONFIGURE MULTI-ORDER BATCH LIMITS MODAL ─── */}
      {showBatchConfigModal && (
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
            maxWidth: "540px",
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
                  background: "#f0f9ff",
                  border: "1px solid #bae6fd",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <span className="material-symbols-outlined text-[20px]" style={{ color: "#0284c7" }}>alt_route</span>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#171410" }}>
                    Configure Multi-Order Batch Limits
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "0.75rem", color: "#73695b" }}>
                    Set dynamic route thresholds, detour tolerance, and cold-chain safety limits
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchConfigModal(false)}
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
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px", maxHeight: "75vh", overflowY: "auto" }}>
              {/* Field 1: Max Batch Size */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                  <span>Max Orders per Batch</span>
                  <span style={{ fontSize: "0.75rem", color: "#73695b", fontWeight: 600 }}>Current: {batchConfig.maxBatchSize} Orders</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="number"
                    min={1}
                    value={draftBatchConfig.maxBatchSize}
                    onChange={(e) => setDraftBatchConfig({ ...draftBatchConfig, maxBatchSize: Math.max(1, Number(e.target.value) || 1) })}
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
                  <span style={{ fontWeight: 800, color: "#73695b", fontSize: "0.9rem", paddingRight: "4px" }}>Orders</span>
                </div>
                <span style={{ fontSize: "0.72rem", color: "#8a7f72", marginTop: "4px", display: "block" }}>
                  Maximum ready orders clubbed into a single rider dispatch (minimum: 1)
                </span>
              </div>

              {/* Field 2: Max Detour Km */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                  <span>Max Detour Distance</span>
                  <span style={{ fontSize: "0.75rem", color: "#73695b", fontWeight: 600 }}>Current: {batchConfig.maxDetourKm} km</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="number"
                    step="0.1"
                    min={0.5}
                    max={10.0}
                    value={draftBatchConfig.maxDetourKm}
                    onChange={(e) => setDraftBatchConfig({ ...draftBatchConfig, maxDetourKm: Math.max(0.5, Math.min(10.0, Number(e.target.value) || 1.0)) })}
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
                  <span style={{ fontWeight: 800, color: "#73695b", fontSize: "0.9rem", paddingRight: "4px" }}>km</span>
                </div>
                <span style={{ fontSize: "0.72rem", color: "#8a7f72", marginTop: "4px", display: "block" }}>
                  Max route deviation allowed per stop vs direct trip to maintain delivery speed
                </span>
              </div>

              {/* Field 3: Max Total Route Km */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                  <span>Max Total Route Distance</span>
                  <span style={{ fontSize: "0.75rem", color: "#73695b", fontWeight: 600 }}>Current: {batchConfig.maxTotalRouteKm} km</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="number"
                    step="0.5"
                    min={5.0}
                    max={30.0}
                    value={draftBatchConfig.maxTotalRouteKm}
                    onChange={(e) => setDraftBatchConfig({ ...draftBatchConfig, maxTotalRouteKm: Math.max(5.0, Math.min(30.0, Number(e.target.value) || 5.0)) })}
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
                  <span style={{ fontWeight: 800, color: "#73695b", fontSize: "0.9rem", paddingRight: "4px" }}>km</span>
                </div>
                <span style={{ fontSize: "0.72rem", color: "#8a7f72", marginTop: "4px", display: "block" }}>
                  Upper limit on cumulative circuit mileage from hub through all customers
                </span>
              </div>

              {/* Field 4: Max Estimated Minutes */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                  <span>Max Cold-Chain Route Time</span>
                  <span style={{ fontSize: "0.75rem", color: "#73695b", fontWeight: 600 }}>Current: {batchConfig.maxEstimatedMinutes} min</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="number"
                    step="5"
                    min={20}
                    max={90}
                    value={draftBatchConfig.maxEstimatedMinutes}
                    onChange={(e) => setDraftBatchConfig({ ...draftBatchConfig, maxEstimatedMinutes: Math.max(20, Math.min(90, Number(e.target.value) || 20)) })}
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
                  <span style={{ fontWeight: 800, color: "#73695b", fontSize: "0.9rem", paddingRight: "4px" }}>min</span>
                </div>
                <span style={{ fontSize: "0.72rem", color: "#8a7f72", marginTop: "4px", display: "block" }}>
                  Strict time window to guarantee fresh temperature retention in thermal delivery bags
                </span>
              </div>

              {/* Field 5: Max Weight Kg */}
              <div>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                  <span>Max Batch Weight</span>
                  <span style={{ fontSize: "0.75rem", color: "#73695b", fontWeight: 600 }}>Current: {batchConfig.maxBatchWeightKg} kg</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="number"
                    step="0.5"
                    min={2.0}
                    max={25.0}
                    value={draftBatchConfig.maxBatchWeightKg}
                    onChange={(e) => setDraftBatchConfig({ ...draftBatchConfig, maxBatchWeightKg: Math.max(2.0, Math.min(25.0, Number(e.target.value) || 2.0)) })}
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
                  <span style={{ fontWeight: 800, color: "#73695b", fontSize: "0.9rem", paddingRight: "4px" }}>kg</span>
                </div>
                <span style={{ fontSize: "0.72rem", color: "#8a7f72", marginTop: "4px", display: "block" }}>
                  Maximum aggregate weight allowed in rider delivery box for safe transport
                </span>
              </div>

              {/* Dirty State Indicator */}
              <div style={{
                padding: "12px 14px",
                borderRadius: "10px",
                background: isBatchConfigDirty ? "#f0fdf4" : "#faf8f5",
                border: isBatchConfigDirty ? "1px solid #bbf7d0" : "1px solid #ede8e0",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.78rem",
                color: isBatchConfigDirty ? "#166534" : "#73695b",
                fontWeight: 600
              }}>
                <span className="material-symbols-outlined text-[18px]">
                  {isBatchConfigDirty ? "check_circle" : "info"}
                </span>
                <span>
                  {isBatchConfigDirty
                    ? "Changes detected. Click 'Save Batch Limits' to apply immediately to dispatch checks."
                    : "No changes made yet. Edit any limit above to update store policy."}
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
                disabled={savingBatchConfig}
                onClick={() => setShowBatchConfigModal(false)}
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
                disabled={!isBatchConfigDirty || savingBatchConfig}
                onClick={handleSaveBatchConfig}
                style={{
                  padding: "9px 20px",
                  borderRadius: "10px",
                  background: !isBatchConfigDirty || savingBatchConfig ? "#e2e8f0" : "#0f172a",
                  color: !isBatchConfigDirty || savingBatchConfig ? "#94a3b8" : "#fff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: !isBatchConfigDirty || savingBatchConfig ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: !isBatchConfigDirty || savingBatchConfig ? "none" : "0 2px 6px rgba(15,23,42,0.25)",
                  transition: "all 0.15s ease"
                }}
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                <span>{savingBatchConfig ? "Saving…" : "Save Batch Limits"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── DIRECT COUNTER CASH COLLECTION MODAL ─── */}
      {showCollectModal && collectRider && (
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
            maxWidth: "460px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            overflow: "hidden"
          }}>
            {/* Header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #ede8e0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#faf8f5"
            }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#171410", margin: 0 }}>
                  Collect COD Cash at Counter
                </h3>
                <p style={{ fontSize: "0.78rem", color: "#73695b", margin: "2px 0 0 0" }}>
                  Record physical cash received from {collectRider.name}
                </p>
              </div>
              <button
                onClick={() => { setShowCollectModal(false); setCollectRider(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#73695b" }}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{
                background: "#fef3c7",
                border: "1px solid #fde68a",
                borderRadius: "10px",
                padding: "12px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "#92400e", fontWeight: 700, textTransform: "uppercase" }}>
                    Verified Cash with Rider
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#78350f" }}>
                    {collectRider.name} ({collectRider.phone})
                  </div>
                </div>
                <div style={{ fontSize: "1.35rem", fontWeight: 900, color: "#b45309" }}>
                  ₹{(Number(collectRider.cashInHand) || 0).toFixed(2)}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                  Physical Cash Amount Received (₹)
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <span style={{ position: "absolute", left: "14px", fontWeight: 800, color: "#171410", fontSize: "1.1rem" }}>₹</span>
                  <input
                    type="number"
                    min={1}
                    max={Number(collectRider.cashInHand) || 99999}
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px 10px 32px",
                      borderRadius: "10px",
                      border: "1.5px solid #d4cdc5",
                      fontWeight: 800,
                      fontSize: "1.1rem",
                      color: "#171410",
                      background: "#fff",
                      outline: "none"
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                  <span style={{ fontSize: "0.72rem", color: "#8a7f72" }}>
                    Enter banknotes handed over at counter
                  </span>
                  <button
                    type="button"
                    onClick={() => setCollectAmount(String(collectRider.cashInHand || 0))}
                    style={{ background: "none", border: "none", color: "#941717", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}
                  >
                    Deposit Full Amount
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                  Counter Receipt Notes / Shift Notes
                </label>
                <input
                  type="text"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  placeholder="e.g. Evening shift closing cash deposit"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #d4cdc5",
                    fontSize: "0.85rem",
                    color: "#171410",
                    background: "#fff",
                    outline: "none"
                  }}
                />
              </div>
            </div>

            {/* Footer */}
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
                disabled={collectingCash}
                onClick={() => { setShowCollectModal(false); setCollectRider(null); }}
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
                disabled={collectingCash || !collectAmount || Number(collectAmount) <= 0}
                onClick={handleConfirmCollectCash}
                style={{
                  padding: "9px 20px",
                  borderRadius: "10px",
                  background: collectingCash || !collectAmount || Number(collectAmount) <= 0 ? "#e5e7eb" : "#059669",
                  color: collectingCash || !collectAmount || Number(collectAmount) <= 0 ? "#9ca3af" : "#fff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: collectingCash || !collectAmount || Number(collectAmount) <= 0 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>{collectingCash ? "Settling…" : "Confirm Cash Receipt"}</span>
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
  const [editingRiderMap, setEditingRiderMap] = useState<Record<string, boolean>>({});
  const [otpInputMap, setOtpInputMap] = useState<Record<string, string>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

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

    const socket = getSocket();
    const handleReturnEvent = () => {
      fetchReturns();
    };
    socket.on("return:created", handleReturnEvent);
    socket.on("returns:refreshed", handleReturnEvent);
    return () => {
      socket.off("return:created", handleReturnEvent);
      socket.off("returns:refreshed", handleReturnEvent);
    };
  }, []);

  // Reset pagination when status or search filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchQuery]);

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCustomer = (r.customer || "").toLowerCase().includes(q);
        const matchesPhone = (r.phone || "").toLowerCase().includes(q);
        const matchesOrder = String(r.orderId || "").toLowerCase().includes(q);
        const matchesReq = String(r.requestId || r.id || "").toLowerCase().includes(q);
        if (!matchesCustomer && !matchesPhone && !matchesOrder && !matchesReq) return false;
      }
      return true;
    });
  }, [requests, statusFilter, searchQuery]);

  const paginatedRequests = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, page, pageSize]);

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
      setEditingRiderMap(prev => ({ ...prev, [requestId]: false }));
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

      {/* Filter toolbar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
        marginBottom: "16px",
        background: "#faf8f5",
        padding: "12px 16px",
        borderRadius: "12px",
        border: "1px solid #ede8e0",
      }}>
        {/* Status filter pills */}
        <div
          className="no-scrollbar"
          style={{
            display: "flex",
            gap: "6px",
            overflowX: "auto",
            whiteSpace: "nowrap",
            flexWrap: "nowrap",
            WebkitOverflowScrolling: "touch",
            width: "100%",
            paddingBottom: "4px",
          }}
        >
          {["All", "Pending Review", "Approved", "Pickup Assigned", "Completed", "Rejected"].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "6px 12px",
                borderRadius: "99px",
                border: "1.5px solid #ede8e0",
                background: statusFilter === s ? "#941717" : "#fff",
                color: statusFilter === s ? "#fff" : "#423b32",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "160px", maxWidth: "420px" }}>
          <span className="material-symbols-outlined text-[18px] text-gray-500">search</span>
          <input
            type="text"
            placeholder="Search return by order, customer, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "7px 12px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "0.825rem",
              background: "#fff",
              width: "100%",
              outline: "none",
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                background: "transparent",
                border: "none",
                color: "#73695b",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: 700,
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#73695b" }}>Loading returns…</div>
      ) : filteredRequests.length === 0 ? (
        <div style={{ background: "#fff", padding: "40px", textAlign: "center", borderRadius: "14px", border: "1px solid #ede8e0" }}>
          No return or exchange tickets found matching your filters.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {paginatedRequests.map(r => {
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "8px 12px", marginBottom: "12px", fontSize: "0.825rem", color: "#166534" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <FontAwesomeIcon icon={faMotorcycle} style={{ color: "#16a34a" }} />
                      <span>Pickup Partner: <strong>{r.rider.name}</strong> ({r.rider.phone || r.rider.vehicleNumber || "Insulated Partner"})</span>
                    </div>
                    {r.status !== "Completed" && (
                      <button
                        type="button"
                        onClick={() => setEditingRiderMap(prev => ({ ...prev, [reqId]: !prev[reqId] }))}
                        style={{ background: "transparent", border: "none", color: "#0284c7", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, textDecoration: "underline" }}
                      >
                        {editingRiderMap[reqId] ? "Cancel" : "Change Partner"}
                      </button>
                    )}
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
                    {/* Rider selection dropdown and assign button: hidden once rider is selected unless admin clicks Change */}
                    {(!r.rider || editingRiderMap[reqId]) && r.status !== "Completed" && (
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
                    )}

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

      <Pagination
        currentPage={page}
        totalItems={filteredRequests.length}
        pageSize={pageSize}
        onPageChange={setPage}
        itemLabel="returns"
      />
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
  const [incomingReturns, setIncomingReturns] = useState<any[]>([]);
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
    const q = user?.storeId ? `?storeId=${user.storeId}` : "";
    api.get<{ success: boolean; store: any }>(`/store-admin/store-status${q}`)
      .then(res => {
        if (res.data.success && res.data.store) {
          setStoreData(res.data.store);
        }
      })
      .catch(err => console.warn("Failed to load store status:", err));
  }, [user?.storeId]);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored || (stored.role !== "storeadmin" && stored.role !== "superadmin" && stored.role !== "admin")) {
      router.push("/admin-login");
      return;
    }
    setUser(stored);
  }, [router]);

  // Real-time alarm listener for new incoming orders and customer return requests
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

    const onReturnCreated = (data: any) => {
      const returnReq = data.returnRequest || data;
      const orderId = returnReq.orderId || data.orderId;
      const requestId = returnReq.requestId || data.requestId;
      if (!requestId || acknowledgedIdsRef.current.has(requestId)) return;

      const isStoreMatch =
        returnReq.storeId === currentStoreId ||
        ((returnReq.storeId === "S002" || returnReq.storeId === "S004") &&
          (currentStoreId === "S002" || currentStoreId === "S004"));
      if (returnReq.storeId && !isStoreMatch && user.role !== "superadmin") {
        return;
      }

      setIncomingReturns((prev) => {
        if (prev.some((r) => r.requestId === requestId)) return prev;
        return [returnReq, ...prev];
      });

      if (!isMuted) {
        orderAlarm.startAlarm();
      }
      toast.warning(
        `Customer requested Return #${requestId} for Order #${orderId}! Reason: ${returnReq.reason || "Return Requested"}`,
        "Return Request Alert"
      );
    };

    // Initial check and 12-second polling redundancy for Pending orders & Pending Review return requests
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
              if (incomingReturns.length === 0) {
                orderAlarm.stopAlarm();
              }
            }
          }
        })
        .catch(() => { });
    };

    const checkPendingReturns = () => {
      api.get<{ success: boolean; returns: any[] }>(`/store-admin/returns?storeId=${currentStoreId}`)
        .then((res) => {
          if (res.data.success && Array.isArray(res.data.returns)) {
            const unackedReturns = res.data.returns.filter(
              (r) => r.status === "Pending Review" && !acknowledgedIdsRef.current.has(r.requestId)
            );
            if (unackedReturns.length > 0) {
              setIncomingReturns(unackedReturns);
              if (!isMuted && !orderAlarm.getIsRinging()) {
                orderAlarm.startAlarm();
              }
            } else {
              setIncomingReturns([]);
            }
          }
        })
        .catch(() => { });
    };

    const handleStatusChanged = (data: any) => {
      const orderId = data?.orderId || data?.id || data?.order?.orderId || data?.order?.id;
      const status = data?.status || data?.order?.status;
      if (orderId && status && status !== "Pending") {
        acknowledgedIdsRef.current.add(orderId);
        setIncomingOrders((prev) => {
          const remaining = prev.filter((o) => (o.orderId || o.id || o._id) !== orderId);
          if (remaining.length === 0 && incomingReturns.length === 0) {
            orderAlarm.stopAlarm();
          }
          return remaining;
        });
      }
      checkPendingOrders();
    };

    socket.on("order:created", onOrderCreated);
    socket.on("return:created", onReturnCreated);
    socket.on("orders:refreshed", checkPendingOrders);
    socket.on("order:status_changed", handleStatusChanged);
    socket.on("order:status_updated", handleStatusChanged);

    checkPendingOrders();
    checkPendingReturns();
    // 60-second (1 minute) gentle fallback polling (instant alerts arrive via order:created socket)
    const pollInterval = setInterval(() => {
      checkPendingOrders();
      checkPendingReturns();
    }, 60000);

    return () => {
      if (currentStoreId) {
        socket.emit("leave:store", currentStoreId);
      }
      socket.off("order:created", onOrderCreated);
      socket.off("return:created", onReturnCreated);
      socket.off("orders:refreshed", checkPendingOrders);
      socket.off("order:status_changed", handleStatusChanged);
      socket.off("order:status_updated", handleStatusChanged);
      clearInterval(pollInterval);
      orderAlarm.stopAlarm();
    };
  }, [isMuted, user, incomingReturns.length]);

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
      if (incomingOrders.length > 0 || incomingReturns.length > 0) {
        orderAlarm.startAlarm();
      }
      toast.info("Audio alarm unmuted");
    } else {
      setIsMuted(true);
      orderAlarm.stopAlarm();
      toast.info("Audio alarm muted for this session");
    }
  };

  const acknowledgeIncomingOrders = async () => {
    const ordersToAck = [...incomingOrders];
    if (ordersToAck.length === 0) return;

    // 1. Mark orders as acknowledged and clear order banner
    ordersToAck.forEach((o) => {
      if (o.orderId) acknowledgedIdsRef.current.add(o.orderId);
      if (o.id) acknowledgedIdsRef.current.add(o.id);
      if (o._id) acknowledgedIdsRef.current.add(o._id);
    });
    setIncomingOrders([]);

    // 2. Only stop alarm if no pending return requests remain
    if (incomingReturns.length === 0) {
      orderAlarm.stopAlarm();
    }

    // 3. Persist acknowledged IDs to localStorage
    try {
      const idsArray = Array.from(acknowledgedIdsRef.current).slice(-100);
      localStorage.setItem("teffes_acked_order_ids", JSON.stringify(idsArray));
    } catch { }

    // 4. Update database status of each acknowledged order to 'Cutting'
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
      const socket = getSocket();
      socket.emit("orders:refresh");
    } catch (err) {
      console.warn("Failed to update order status to Cutting:", err);
    }
  };

  const acknowledgeIncomingReturns = () => {
    const returnsToAck = [...incomingReturns];
    if (returnsToAck.length === 0) return;

    // 1. Mark return requests as acknowledged and clear return banner
    returnsToAck.forEach((r) => {
      if (r.requestId) acknowledgedIdsRef.current.add(r.requestId);
      if (r.id) acknowledgedIdsRef.current.add(r.id);
      if (r._id) acknowledgedIdsRef.current.add(r._id);
    });
    setIncomingReturns([]);

    // 2. Only stop alarm if no incoming orders remain
    if (incomingOrders.length === 0) {
      orderAlarm.stopAlarm();
    }

    // 3. Persist acknowledged IDs to localStorage
    try {
      const idsArray = Array.from(acknowledgedIdsRef.current).slice(-100);
      localStorage.setItem("teffes_acked_order_ids", JSON.stringify(idsArray));
    } catch { }

    toast.success("Return request alert acknowledged", "Return Acknowledged");
  };

  const acknowledgeAllIncoming = async () => {
    await acknowledgeIncomingOrders();
    acknowledgeIncomingReturns();
  };

  const handleOrderAdvanced = (orderId: string) => {
    if (orderId) {
      acknowledgedIdsRef.current.add(orderId);
      setIncomingOrders((prev) => {
        const remaining = prev.filter((o) => (o.orderId || o.id || o._id) !== orderId);
        if (remaining.length === 0 && incomingReturns.length === 0) {
          orderAlarm.stopAlarm();
        }
        return remaining;
      });
    }
  };

  if (!user) return null;

  const effectiveStoreId = user?.storeId || storeData?.storeId || "S001";
  const storeDisplayName =
    storeData?.name ||
    user?.storeName ||
    (effectiveStoreId === "S004" || effectiveStoreId === "S002"
      ? "TeFFe's — Doranda Hub"
      : "TeFFe's — Kishore Ganj Store");

  const tabComponents: Record<string, React.ReactNode> = {
    dashboard: <DashboardTab setActiveTab={setActiveTab} />,
    orders: <LiveOrdersTab onOrderAdvanced={handleOrderAdvanced} storeData={storeData} />,
    schedule: <StoreScheduleTab storeId={effectiveStoreId} storeName={storeDisplayName} />,
    products: <ProductsStockTab />,
    cross_sell: <CrossSellTab />,
    inventory: <InventoryTab />,
    inventory_logs: <StoreAdminInventoryLogsTab />,
    customers: <CustomersTab />,
    riders: <RidersTab storeId={effectiveStoreId} />,
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
      <main style={{ flex: 1, padding: isMobile ? "14px 10px" : "32px", overflowY: "auto", minWidth: 0 }}>
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
                  if (incomingReturns.length === 0) {
                    orderAlarm.stopAlarm();
                  }
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
            </div>
          </div>
        )}

        {/* ─── Active Return Request Alarm Banner ────────────────────────────── */}
        {incomingReturns.length > 0 && (
          <div
            className="animate-pulse-glow"
            style={{
              background: "linear-gradient(135deg, #c2410c 0%, #9a3412 100%)",
              color: "#fff",
              borderRadius: "14px",
              padding: "16px 20px",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
              border: "2px solid #ea580c",
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
                  assignment_return
                </span>
              </div>
              <div>
                <div style={{ fontSize: "1.1rem", fontWeight: 900, display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>CUSTOMER RETURN REQUEST RECEIVED!</span>
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
                    {incomingReturns.length} PENDING REVIEW
                  </span>
                </div>
                <div style={{ fontSize: "0.85rem", opacity: 0.95, marginTop: "3px" }}>
                  Return #{incomingReturns[0]?.requestId} · Order #{incomingReturns[0]?.orderId} · {incomingReturns[0]?.reason || "Return Requested"}
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
                  setActiveTab("returns");
                  // Clear return banner & mark as viewed/acknowledged
                  incomingReturns.forEach((r) => {
                    if (r.requestId) acknowledgedIdsRef.current.add(r.requestId);
                    if (r.id) acknowledgedIdsRef.current.add(r.id);
                    if (r._id) acknowledgedIdsRef.current.add(r._id);
                  });
                  try {
                    const idsArray = Array.from(acknowledgedIdsRef.current).slice(-100);
                    localStorage.setItem("teffes_acked_order_ids", JSON.stringify(idsArray));
                  } catch { }
                  setIncomingReturns([]);
                  if (incomingOrders.length === 0) {
                    orderAlarm.stopAlarm();
                  }
                }}
                style={{
                  background: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  padding: "8px 16px",
                  color: "#c2410c",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                }}
              >
                <span className="material-symbols-outlined text-[18px]">assignment_return</span>
                <span>Review Returns</span>
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
          storeId={effectiveStoreId}
          storeName={storeDisplayName}
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
