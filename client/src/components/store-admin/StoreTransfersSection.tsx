"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { toast } from "@/lib/toast";

interface TransferItem {
  productId: string;
  name: string;
  quantity: number;
  unit?: string;
}

interface TransferRecord {
  id?: string;
  _id?: string;
  transferId: string;
  fromStoreId: string;
  toStoreId: string;
  items: TransferItem[];
  status: "Pending" | "In-Transit" | "Approved" | "Rejected" | "Completed" | "Cancelled";
  requestedByName?: string;
  dispatchedByName?: string;
  dispatchedAt?: string;
  receivedByName?: string;
  receivedAt?: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;
}

interface StoreOption {
  id?: string;
  storeId?: string;
  name: string;
  address?: string;
}

interface StoreTransfersSectionProps {
  currentStoreId?: string;
  currentStoreName?: string;
  inventoryItems?: any[];
  onInventoryUpdated?: () => void;
}

export default function StoreTransfersSection({
  currentStoreId,
  currentStoreName,
  inventoryItems = [],
  onInventoryUpdated,
}: StoreTransfersSectionProps) {
  const [inbound, setInbound] = useState<TransferRecord[]>([]);
  const [outbound, setOutbound] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"inbound" | "outbound">("inbound");
  const [stores, setStores] = useState<StoreOption[]>([]);

  // Modal State: Request New Transfer
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestFromStoreId, setRequestFromStoreId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedItemName, setSelectedItemName] = useState("");
  const [requestQty, setRequestQty] = useState("");
  const [requestUnit, setRequestUnit] = useState("kg");
  const [requestNotes, setRequestNotes] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Modal State: Action Confirmations
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Fetch Transfers
  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; inbound?: TransferRecord[]; outbound?: TransferRecord[] }>(
        "/transfers"
      );
      if (res.data.success) {
        setInbound(res.data.inbound || []);
        setOutbound(res.data.outbound || []);
      }
    } catch (err: any) {
      console.warn("Failed to fetch store transfers:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Other Stores List
  const fetchStores = async () => {
    try {
      const res = await api.get<{ success: boolean; stores: StoreOption[] }>("/stores");
      if (res.data.success) {
        const otherStores = (res.data.stores || []).filter(
          (s) => (s.storeId || s.id) !== currentStoreId
        );
        setStores(otherStores);
        if (otherStores.length > 0 && !requestFromStoreId) {
          setRequestFromStoreId(otherStores[0].storeId || otherStores[0].id || "");
        }
      }
    } catch (err) {
      console.warn("Failed to fetch stores list:", err);
    }
  };

  useEffect(() => {
    fetchTransfers();
    fetchStores();
  }, [currentStoreId]);

  // Open Request Modal
  const openNewRequestModal = () => {
    if (inventoryItems.length > 0) {
      const first = inventoryItems[0];
      setSelectedProductId(first.itemId || first.id || "");
      setSelectedItemName(first.item || first.name || "");
      setRequestUnit(first.unit || "kg");
    }
    setRequestQty("");
    setRequestNotes("");
    setShowRequestModal(true);
  };

  // Submit New Transfer Request
  const handleSubmitRequest = async () => {
    if (!requestFromStoreId) {
      toast.warning("Please select a source store", "Validation");
      return;
    }
    const qty = parseFloat(requestQty);
    if (isNaN(qty) || qty <= 0) {
      toast.warning("Please enter a valid positive quantity", "Validation");
      return;
    }
    if (!selectedProductId) {
      toast.warning("Please select a product to transfer", "Validation");
      return;
    }

    setSubmittingRequest(true);
    try {
      const payload = {
        fromStoreId: requestFromStoreId,
        items: [
          {
            productId: selectedProductId,
            name: selectedItemName || selectedProductId,
            quantity: qty,
            unit: requestUnit,
          },
        ],
        notes: requestNotes.trim(),
      };

      const res = await api.post("/transfers/request", payload);
      if (res.data.success) {
        toast.success(
          `Transfer request ${res.data.transfer?.transferId || ""} created successfully`,
          "Request Sent"
        );
        setShowRequestModal(false);
        fetchTransfers();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to request transfer", "Error");
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Dispatch Outbound Transfer (Pending -> In-Transit)
  const handleDispatch = async (transfer: TransferRecord) => {
    const transferId = transfer.transferId || transfer.id || "";
    setActionLoadingId(transferId);
    try {
      const res = await api.post(`/transfers/${transferId}/dispatch`);
      if (res.data.success) {
        toast.success(
          `Transfer ${transferId} dispatched. Stock deducted from your store.`,
          "Dispatched"
        );
        fetchTransfers();
        if (onInventoryUpdated) onInventoryUpdated();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to dispatch transfer", "Dispatch Failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Receive Inbound Transfer (In-Transit -> Completed)
  const handleReceive = async (transfer: TransferRecord) => {
    const transferId = transfer.transferId || transfer.id || "";
    setActionLoadingId(transferId);
    try {
      const res = await api.post(`/transfers/${transferId}/receive`);
      if (res.data.success) {
        toast.success(
          `Transfer ${transferId} received and accepted. Stock credited to your inventory.`,
          "Stock Received"
        );
        fetchTransfers();
        if (onInventoryUpdated) onInventoryUpdated();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to receive transfer", "Receive Failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reject Outbound Transfer (Pending -> Rejected)
  const handleReject = async (transfer: TransferRecord) => {
    const transferId = transfer.transferId || transfer.id || "";
    const reason = window.prompt("Reason for rejecting this transfer request:");
    if (reason === null) return; // user cancelled prompt

    setActionLoadingId(transferId);
    try {
      const res = await api.post(`/transfers/${transferId}/reject`, { notes: reason.trim() });
      if (res.data.success) {
        toast.info(`Transfer ${transferId} marked as Rejected`, "Transfer Rejected");
        fetchTransfers();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reject transfer", "Error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Helper status badge renderer
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "99px",
              fontSize: "0.72rem",
              fontWeight: 800,
              background: "#fef3c7",
              color: "#92400e",
              border: "1px solid #fde68a",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span className="material-symbols-outlined text-[13px]">pending</span>
            Pending Request
          </span>
        );
      case "In-Transit":
        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "99px",
              fontSize: "0.72rem",
              fontWeight: 800,
              background: "#dbeafe",
              color: "#1e40af",
              border: "1px solid #bfdbfe",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span className="material-symbols-outlined text-[13px]">local_shipping</span>
            In-Transit (Dispatched)
          </span>
        );
      case "Completed":
        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "99px",
              fontSize: "0.72rem",
              fontWeight: 800,
              background: "#dcfce7",
              color: "#166534",
              border: "1px solid #bbf7d0",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span className="material-symbols-outlined text-[13px]">check_circle</span>
            Completed
          </span>
        );
      case "Rejected":
        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "99px",
              fontSize: "0.72rem",
              fontWeight: 800,
              background: "#fee2e2",
              color: "#991b1b",
              border: "1px solid #fecaca",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span className="material-symbols-outlined text-[13px]">cancel</span>
            Rejected
          </span>
        );
      case "Cancelled":
        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "99px",
              fontSize: "0.72rem",
              fontWeight: 800,
              background: "#f3f4f6",
              color: "#4b5563",
              border: "1px solid #e5e7eb",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span className="material-symbols-outlined text-[13px]">block</span>
            Cancelled
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const activeList = activeTab === "inbound" ? inbound : outbound;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* ─── Header & Top Actions ────────────────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #ede8e0",
          borderRadius: "14px",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: "1.05rem",
              fontWeight: 800,
              color: "#171410",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ color: "#941717" }}>
              swap_horiz
            </span>
            <span>Inter-Store Inventory Transfers</span>
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#73695b" }}>
            Reallocate fresh cuts and stock between Ranchi dark stores with atomic audit logging.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={fetchTransfers}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #d1cbbf",
              background: "#fff",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              color: "#423b32",
            }}
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={openNewRequestModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: "#941717",
              color: "#fff",
              fontSize: "0.82rem",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(148,23,23,0.3)",
            }}
          >
            <span className="material-symbols-outlined text-[17px]">add_circle</span>
            <span>+ Request Stock Transfer</span>
          </button>
        </div>
      </div>

      {/* ─── Sub-Tab Selector: Inbound vs Outbound ────────────────────────────── */}
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          type="button"
          onClick={() => setActiveTab("inbound")}
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: "12px",
            border: activeTab === "inbound" ? "2px solid #941717" : "1px solid #ede8e0",
            background: activeTab === "inbound" ? "#fff" : "#faf8f5",
            cursor: "pointer",
            textAlign: "left",
            transition: "all 150ms ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ color: activeTab === "inbound" ? "#941717" : "#73695b" }}
              >
                call_received
              </span>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: "0.88rem",
                  color: activeTab === "inbound" ? "#941717" : "#171410",
                }}
              >
                Inbound Transfers (Receiving)
              </span>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: "99px",
                background: activeTab === "inbound" ? "#941717" : "#ede8e0",
                color: activeTab === "inbound" ? "#fff" : "#574e42",
              }}
            >
              {inbound.length}
            </span>
          </div>
          <div style={{ fontSize: "0.74rem", color: "#73695b", marginTop: "4px" }}>
            Stock requested into this store. Click "Receive" when items arrive.
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("outbound")}
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: "12px",
            border: activeTab === "outbound" ? "2px solid #941717" : "1px solid #ede8e0",
            background: activeTab === "outbound" ? "#fff" : "#faf8f5",
            cursor: "pointer",
            textAlign: "left",
            transition: "all 150ms ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ color: activeTab === "outbound" ? "#941717" : "#73695b" }}
              >
                call_made
              </span>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: "0.88rem",
                  color: activeTab === "outbound" ? "#941717" : "#171410",
                }}
              >
                Outbound Transfers (Dispatching)
              </span>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: "99px",
                background: activeTab === "outbound" ? "#941717" : "#ede8e0",
                color: activeTab === "outbound" ? "#fff" : "#574e42",
              }}
            >
              {outbound.length}
            </span>
          </div>
          <div style={{ fontSize: "0.74rem", color: "#73695b", marginTop: "4px" }}>
            Requests from other stores. Click "Approve &amp; Dispatch" to send stock.
          </div>
        </button>
      </div>

      {/* ─── Transfers List ─────────────────────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #ede8e0",
          borderRadius: "14px",
          overflow: "hidden",
          boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
        }}
      >
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#73695b" }}>
            Loading store transfers…
          </div>
        ) : activeList.length === 0 ? (
          <div style={{ padding: "50px 20px", textAlign: "center" }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "40px", color: "#a89f91", marginBottom: "8px" }}
            >
              sync_alt
            </span>
            <div style={{ fontWeight: 800, color: "#171410", fontSize: "1rem" }}>
              No {activeTab} transfers found
            </div>
            <div style={{ fontSize: "0.8rem", color: "#73695b", marginTop: "4px" }}>
              {activeTab === "inbound"
                ? "You have not requested stock from other stores yet."
                : "No other store has requested stock from this location."}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ background: "#faf8f5", borderBottom: "1.5px solid #ede8e0", color: "#73695b", textAlign: "left" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Transfer ID</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>
                    {activeTab === "inbound" ? "From Source Store" : "To Destination Store"}
                  </th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Items &amp; Quantities</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Requested Date</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Status</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeList.map((tr) => {
                  const transferId = tr.transferId || tr.id || "";
                  const isBusy = actionLoadingId === transferId;
                  const dateDisplay = tr.createdAt ? new Date(tr.createdAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }) : "—";

                  return (
                    <tr
                      key={transferId}
                      style={{
                        borderBottom: "1px solid #f1ede6",
                        transition: "background 100ms ease",
                      }}
                    >
                      <td style={{ padding: "14px 16px", fontWeight: 800, color: "#171410" }}>
                        <div>{transferId}</div>
                        {tr.requestedByName && (
                          <div style={{ fontSize: "0.72rem", color: "#73695b", fontWeight: 500 }}>
                            By: {tr.requestedByName}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "14px 16px", color: "#423b32" }}>
                        <div style={{ fontWeight: 700 }}>
                          {activeTab === "inbound" ? tr.fromStoreId : tr.toStoreId}
                        </div>
                        {tr.notes && (
                          <div style={{ fontSize: "0.72rem", color: "#73695b", fontStyle: "italic", marginTop: "2px" }}>
                            "{tr.notes}"
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        {tr.items && tr.items.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            {tr.items.map((it, idx) => (
                              <div key={idx} style={{ color: "#171410", fontWeight: 600 }}>
                                <span style={{ color: "#941717", fontWeight: 800 }}>{it.quantity} {it.unit || "kg"}</span> · {it.name}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "#a89f91" }}>No items</span>
                        )}
                      </td>

                      <td style={{ padding: "14px 16px", color: "#574e42" }}>
                        {dateDisplay}
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        {renderStatusBadge(tr.status)}
                      </td>

                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        {/* INBOUND ACTIONS: Receive stock when in-transit */}
                        {activeTab === "inbound" && (
                          <>
                            {tr.status === "In-Transit" ? (
                              <button
                                type="button"
                                onClick={() => handleReceive(tr)}
                                disabled={isBusy}
                                style={{
                                  background: "#15803d",
                                  color: "#fff",
                                  border: "none",
                                  padding: "7px 14px",
                                  borderRadius: "8px",
                                  fontSize: "0.78rem",
                                  fontWeight: 800,
                                  cursor: isBusy ? "not-allowed" : "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  boxShadow: "0 2px 6px rgba(21,128,61,0.25)",
                                }}
                              >
                                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                <span>{isBusy ? "Receiving…" : "Receive & Accept Stock"}</span>
                              </button>
                            ) : tr.status === "Pending" ? (
                              <span style={{ fontSize: "0.75rem", color: "#92400e", fontWeight: 600 }}>
                                Waiting for dispatch
                              </span>
                            ) : (
                              <span style={{ fontSize: "0.75rem", color: "#73695b" }}>Completed</span>
                            )}
                          </>
                        )}

                        {/* OUTBOUND ACTIONS: Dispatch or Reject when pending */}
                        {activeTab === "outbound" && (
                          <>
                            {tr.status === "Pending" ? (
                              <div style={{ display: "inline-flex", gap: "6px" }}>
                                <button
                                  type="button"
                                  onClick={() => handleDispatch(tr)}
                                  disabled={isBusy}
                                  style={{
                                    background: "#941717",
                                    color: "#fff",
                                    border: "none",
                                    padding: "7px 12px",
                                    borderRadius: "8px",
                                    fontSize: "0.78rem",
                                    fontWeight: 800,
                                    cursor: isBusy ? "not-allowed" : "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                  }}
                                >
                                  <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                                  <span>{isBusy ? "Dispatching…" : "Approve & Dispatch"}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleReject(tr)}
                                  disabled={isBusy}
                                  style={{
                                    background: "#fee2e2",
                                    color: "#991b1b",
                                    border: "1px solid #fecaca",
                                    padding: "7px 10px",
                                    borderRadius: "8px",
                                    fontSize: "0.78rem",
                                    fontWeight: 700,
                                    cursor: isBusy ? "not-allowed" : "pointer",
                                  }}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : tr.status === "In-Transit" ? (
                              <span style={{ fontSize: "0.75rem", color: "#1e40af", fontWeight: 600 }}>
                                In-Transit to destination
                              </span>
                            ) : (
                              <span style={{ fontSize: "0.75rem", color: "#73695b" }}>{tr.status}</span>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── MODAL: Request Stock Transfer ─────────────────────────────────── */}
      {showRequestModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              maxWidth: "520px",
              width: "100%",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
                borderBottom: "1px solid #ede8e0",
                paddingBottom: "12px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: "#171410",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span className="material-symbols-outlined text-[20px]" style={{ color: "#941717" }}>
                  add_shopping_cart
                </span>
                <span>Request Inter-Store Stock</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#73695b" }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Source Store Selector */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "5px" }}>
                  Transfer From (Source Store) *
                </label>
                <select
                  value={requestFromStoreId}
                  onChange={(e) => setRequestFromStoreId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d1cbbf",
                    fontSize: "0.85rem",
                    background: "#fff",
                  }}
                >
                  {stores.map((s) => (
                    <option key={s.storeId || s.id} value={s.storeId || s.id}>
                      {s.name} ({s.storeId || s.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Selector */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "5px" }}>
                  Product to Request *
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    const found = inventoryItems.find(
                      (it) => (it.itemId || it.id) === e.target.value
                    );
                    setSelectedProductId(e.target.value);
                    if (found) {
                      setSelectedItemName(found.item || found.name || "");
                      setRequestUnit(found.unit || "kg");
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d1cbbf",
                    fontSize: "0.85rem",
                    background: "#fff",
                  }}
                >
                  {inventoryItems.map((it) => (
                    <option key={it.itemId || it.id} value={it.itemId || it.id}>
                      {it.item || it.name} (Current Stock: {it.stock || 0} {it.unit || "kg"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity & Unit */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "5px" }}>
                    Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="e.g. 5"
                    value={requestQty}
                    onChange={(e) => setRequestQty(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d1cbbf",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "5px" }}>
                    Unit
                  </label>
                  <input
                    type="text"
                    disabled
                    value={requestUnit}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #ede8e0",
                      background: "#f5f3ef",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "5px" }}>
                  Notes / Dispatch Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Urgent evening surge restock"
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d1cbbf",
                    fontSize: "0.85rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                disabled={submittingRequest}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  border: "1px solid #d1cbbf",
                  background: "#fff",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitRequest}
                disabled={submittingRequest}
                style={{
                  padding: "9px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#941717",
                  color: "#fff",
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  cursor: submittingRequest ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 8px rgba(148,23,23,0.3)",
                }}
              >
                {submittingRequest ? "Sending Request…" : "Send Transfer Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
