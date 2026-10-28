"use client";

import React, { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "@/lib/toast";

interface InventoryLogActor {
  userId?: string | null;
  name?: string;
  role?: string;
  email?: string;
}

interface InventoryLogItem {
  id: string;
  _id?: string;
  storeId: string;
  storeName?: string;
  itemId?: string;
  productName?: string;
  category?: string;
  classification?: string;
  actionType: string;
  quantity: number;
  unit?: string;
  previousQuantity?: number;
  resultingQuantity?: number;
  sourceClassification?: string | null;
  destinationClassification?: string | null;
  reason?: string;
  notes?: string;
  orderId?: string | null;
  actor?: InventoryLogActor;
  createdAt: string;
}

const ACTION_TYPE_LABELS: Record<string, { label: string; icon: string; bg: string; text: string; border: string }> = {
  fresh_stock_added: {
    label: "Fresh Stock Added",
    icon: "add_circle",
    bg: "#ecfdf5",
    text: "#065f46",
    border: "#a7f3d0",
  },
  transfer_defreeze_to_fresh: {
    label: "De-Freeze to Fresh",
    icon: "published_with_changes",
    bg: "#eff6ff",
    text: "#1e40af",
    border: "#bfdbfe",
  },
  record_waste: {
    label: "Damage / Waste Recorded",
    icon: "delete_sweep",
    bg: "#fef2f2",
    text: "#991b1b",
    border: "#fecaca",
  },
  return_waste: {
    label: "Customer Return Waste (FSSAI)",
    icon: "assignment_return",
    bg: "#fff1f2",
    text: "#be123c",
    border: "#fecdd3",
  },
  order_deduction: {
    label: "Order Deduction",
    icon: "shopping_cart_checkout",
    bg: "#faf5ff",
    text: "#6b21a8",
    border: "#e9d5ff",
  },
  stock_adjustment: {
    label: "Stock Adjustment",
    icon: "tune",
    bg: "#fffbeb",
    text: "#92400e",
    border: "#fde68a",
  },
  defreeze_stock_added: {
    label: "De-Freeze Added",
    icon: "ac_unit",
    bg: "#f0fdfa",
    text: "#0f766e",
    border: "#99f6e4",
  },
  transfer_in: {
    label: "Store Transfer In",
    icon: "input",
    bg: "#f0fdf4",
    text: "#15803d",
    border: "#bbf7d0",
  },
  transfer_out: {
    label: "Store Transfer Out",
    icon: "output",
    bg: "#fefce8",
    text: "#854d0e",
    border: "#fef08a",
  },
};

export default function StoreAdminInventoryLogsTab() {
  const [logs, setLogs] = useState<InventoryLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [actionType, setActionType] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Search debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page,
        limit,
      };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (actionType && actionType !== "all") params.actionType = actionType;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await api.get<{
        success: boolean;
        total: number;
        page: number;
        totalPages: number;
        history: InventoryLogItem[];
      }>("/store-admin/inventory/history", { params });

      if (res.data.success) {
        setLogs(res.data.history || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      } else {
        setError("Failed to fetch inventory activity history");
      }
    } catch (err: any) {
      console.error("Error loading inventory history:", err);
      setError(err.response?.data?.message || "Failed to load inventory logs");
      toast.error("Failed to load inventory logs", "Error");
    } finally {
      setLoading(false);
    }
  }, [page, limit, startDate, endDate, actionType, debouncedSearch]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const resetFilters = () => {
    setStartDate("");
    setEndDate("");
    setActionType("all");
    setSearch("");
    setPage(1);
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return "—";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  const getFlowDisplay = (log: InventoryLogItem) => {
    const src = log.sourceClassification;
    const dst = log.destinationClassification;

    if (!src && !dst) {
      return <span style={{ color: "#9ca3af" }}>—</span>;
    }

    const formatClass = (name: string | null | undefined) => {
      if (!name) return "External / Supplier";
      if (name === "fresh") return "Fresh";
      if (name === "defreeze") return "De-Freeze";
      if (name === "waste") return "Waste";
      if (name === "customer_return") return "Customer Return";
      return name.charAt(0).toUpperCase() + name.slice(1);
    };

    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.78rem" }}>
        <span
          style={{
            background: "#f1f5f9",
            color: "#475569",
            padding: "2px 6px",
            borderRadius: "4px",
            fontWeight: 600,
          }}
        >
          {formatClass(src)}
        </span>
        <span className="material-symbols-outlined text-[14px]" style={{ color: "#94a3b8" }}>
          arrow_forward
        </span>
        <span
          style={{
            background: dst === "waste" ? "#fef2f2" : dst === "fresh" ? "#ecfdf5" : "#eff6ff",
            color: dst === "waste" ? "#991b1b" : dst === "fresh" ? "#065f46" : "#1e40af",
            padding: "2px 6px",
            borderRadius: "4px",
            fontWeight: 700,
          }}
        >
          {formatClass(dst)}
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* ─── Header Info Card ────────────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #ede8e0",
          borderRadius: "14px",
          padding: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="material-symbols-outlined text-[24px]" style={{ color: "#941717" }}>
              manage_history
            </span>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#171410", margin: 0 }}>
              Store Inventory Activity Logs
            </h2>
          </div>
          <p style={{ margin: "4px 0 0 0", fontSize: "0.83rem", color: "#73695b" }}>
            Immutable audit record of all fresh additions, de-freeze thawing, customer order deductions, and waste routings.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          style={{
            background: "#faf8f5",
            border: "1px solid #ede8e0",
            borderRadius: "8px",
            padding: "8px 14px",
            fontSize: "0.82rem",
            fontWeight: 700,
            color: "#423b32",
            cursor: loading ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 150ms ease",
          }}
        >
          <span className={`material-symbols-outlined text-[18px] ${loading ? "animate-spin" : ""}`}>
            refresh
          </span>
          <span>Refresh</span>
        </button>
      </div>

      {/* ─── Filter Controls Card ────────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #ede8e0",
          borderRadius: "14px",
          padding: "16px 20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end" }}>
          {/* Search Box */}
          <div style={{ flex: "1 1 220px", minWidth: "200px" }}>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#52483e", marginBottom: "6px" }}>
              Search
            </label>
            <div style={{ position: "relative" }}>
              <span
                className="material-symbols-outlined"
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#9ca3af",
                  fontSize: "18px",
                  pointerEvents: "none",
                }}
              >
                search
              </span>
              <input
                type="text"
                placeholder="Product, SKU, Order #, Actor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 34px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "0.84rem",
                  color: "#1e293b",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Activity Type Dropdown */}
          <div style={{ flex: "1 1 200px", minWidth: "180px" }}>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#52483e", marginBottom: "6px" }}>
              Activity Type
            </label>
            <select
              value={actionType}
              onChange={(e) => {
                setActionType(e.target.value);
                setPage(1);
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "0.84rem",
                color: "#1e293b",
                background: "#fff",
                outline: "none",
                boxSizing: "border-box",
              }}
            >
              <option value="all">All Activities</option>
              <option value="fresh_stock_added">Fresh Stock Added</option>
              <option value="transfer_defreeze_to_fresh">De-Freeze to Fresh</option>
              <option value="record_waste">Damage / Waste Recorded</option>
              <option value="return_waste">Customer Return Waste (FSSAI)</option>
              <option value="order_deduction">Customer Order Deduction</option>
              <option value="stock_adjustment">Stock Adjustment</option>
              <option value="defreeze_stock_added">De-Freeze Added</option>
              <option value="transfer_in">Store Transfer In</option>
              <option value="transfer_out">Store Transfer Out</option>
            </select>
          </div>

          {/* Start Date */}
          <div style={{ flex: "0 1 160px", minWidth: "140px" }}>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#52483e", marginBottom: "6px" }}>
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              style={{
                width: "100%",
                padding: "7px 10px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "0.82rem",
                color: "#1e293b",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* End Date */}
          <div style={{ flex: "0 1 160px", minWidth: "140px" }}>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#52483e", marginBottom: "6px" }}>
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              style={{
                width: "100%",
                padding: "7px 10px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "0.82rem",
                color: "#1e293b",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Reset Filters Button */}
          {(startDate || endDate || actionType !== "all" || search) && (
            <div>
              <button
                type="button"
                onClick={resetFilters}
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "8px 14px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#991b1b",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 150ms ease",
                }}
              >
                <span className="material-symbols-outlined text-[17px]">filter_alt_off</span>
                <span>Reset</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Table Section ───────────────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #ede8e0",
          borderRadius: "14px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          overflow: "hidden",
        }}
      >
        {/* Total Count Badge */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #ede8e0",
            background: "#faf8f5",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#52483e" }}>
            Matching Records: <span style={{ color: "#941717" }}>{total}</span>
          </div>

          {/* Limit selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#64748b" }}>
            <span>Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                padding: "3px 8px",
                fontSize: "0.8rem",
                background: "#fff",
                outline: "none",
              }}
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#73695b" }}>
            <span className="material-symbols-outlined text-[36px] animate-spin" style={{ color: "#941717", marginBottom: "12px", display: "inline-block" }}>
              autorenew
            </span>
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Loading inventory audit trail…</div>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <span className="material-symbols-outlined text-[36px]" style={{ color: "#dc2626", marginBottom: "8px", display: "inline-block" }}>
              error
            </span>
            <div style={{ fontWeight: 700, color: "#991b1b", marginBottom: "8px" }}>{error}</div>
            <button
              type="button"
              onClick={fetchLogs}
              style={{
                background: "#941717",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "6px 14px",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && logs.length === 0 && (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <span className="material-symbols-outlined text-[42px]" style={{ color: "#9ca3af", marginBottom: "10px", display: "inline-block" }}>
              history_toggle_off
            </span>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "1.05rem", fontWeight: 700, color: "#1e293b" }}>
              No Inventory Activity Logs Found
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "0.84rem", color: "#64748b" }}>
              {(startDate || endDate || actionType !== "all" || search)
                ? "No records match your selected filters. Try broadening your filter criteria."
                : "No inventory stock movements or adjustments recorded yet for this store."}
            </p>
            {(startDate || endDate || actionType !== "all" || search) && (
              <button
                type="button"
                onClick={resetFilters}
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
                Clear All Filters
              </button>
            )}
          </div>
        )}

        {/* Responsive Table */}
        {!loading && !error && logs.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.84rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #e2e8f0", color: "#475569" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Date & Time</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Activity</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Product</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Quantity</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Stock Flow</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Performed By</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Reference / Notes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const actionStyle = ACTION_TYPE_LABELS[log.actionType] || {
                    label: log.actionType.replace(/_/g, " "),
                    icon: "info",
                    bg: "#f1f5f9",
                    text: "#334155",
                    border: "#cbd5e1",
                  };

                  return (
                    <tr
                      key={log.id || log._id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background 100ms ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Date & Time */}
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap", color: "#1e293b", fontWeight: 600 }}>
                        {formatDateTime(log.createdAt)}
                      </td>

                      {/* Activity Badge */}
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background: actionStyle.bg,
                            color: actionStyle.text,
                            border: `1px solid ${actionStyle.border}`,
                          }}
                        >
                          <span className="material-symbols-outlined text-[15px]">{actionStyle.icon}</span>
                          <span>{actionStyle.label}</span>
                        </span>
                      </td>

                      {/* Product */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 700, color: "#171410" }}>
                          {log.productName || "Product"}
                        </div>
                        {log.itemId && (
                          <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontFamily: "monospace" }}>
                            SKU: {log.itemId}
                          </div>
                        )}
                      </td>

                      {/* Quantity */}
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 800, color: "#171410", fontSize: "0.9rem" }}>
                          {log.quantity}
                        </span>{" "}
                        <span style={{ color: "#64748b", fontWeight: 600, fontSize: "0.8rem" }}>
                          {log.unit || "kg"}
                        </span>
                      </td>

                      {/* Flow */}
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {getFlowDisplay(log)}
                      </td>

                      {/* Performed By */}
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 600, color: "#1e293b" }}>
                          {log.actor?.name || "System"}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                          {log.actor?.role ? log.actor.role.toUpperCase() : "AUTOMATED"}
                        </div>
                      </td>

                      {/* Reference / Reason */}
                      <td style={{ padding: "12px 16px", color: "#475569", maxWidth: "260px" }}>
                        {log.orderId && (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              background: "#f1f5f9",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontSize: "0.74rem",
                              fontWeight: 700,
                              color: "#0f172a",
                              marginBottom: "2px",
                            }}
                          >
                            <span className="material-symbols-outlined text-[13px]">tag</span>
                            <span>Order #{log.orderId}</span>
                          </div>
                        )}
                        <div style={{ fontSize: "0.79rem", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {log.reason || log.notes || "—"}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Section */}
        {!loading && !error && totalPages > 1 && (
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid #ede8e0",
              background: "#faf8f5",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Showing {Math.min((page - 1) * limit + 1, total)} to {Math.min(page * limit, total)} of {total} records
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  background: page <= 1 ? "#f1f5f9" : "#fff",
                  color: page <= 1 ? "#94a3b8" : "#1e293b",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                <span>Previous</span>
              </button>

              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1e293b", margin: "0 4px" }}>
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  background: page >= totalPages ? "#f1f5f9" : "#fff",
                  color: page >= totalPages ? "#94a3b8" : "#1e293b",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: page >= totalPages ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>Next</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
