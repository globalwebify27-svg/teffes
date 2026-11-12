"use client";

import React, { useState, useMemo } from "react";
import api from "@/lib/api";
import { toast } from "@/lib/toast";

interface OrderEditModalProps {
  order: any;
  catalogProducts?: any[];
  onClose: () => void;
  onSuccess: () => void;
}

// Grams parser helper
const parseGrams = (weightStr: string): number => {
  if (!weightStr) return 1000;
  const s = String(weightStr).toLowerCase().trim();
  const match = s.match(/([0-9.]+)\s*(kg|kilo|kilogram|g|gm|gram|grams)?/);
  if (!match) return 1000;
  const val = parseFloat(match[1]);
  if (isNaN(val)) return 1000;
  const unit = match[2] || "g";
  if (unit.startsWith("kg") || unit.startsWith("kilo")) {
    return Math.round(val * 1000);
  }
  return Math.round(val);
};

// Grams formatter helper
const formatGrams = (grams: number): string => {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return kg % 1 === 0 ? `${kg} kg` : `${kg.toFixed(2).replace(/\.?0+$/, "")} kg`;
  }
  return `${grams}g`;
};

// Pieces count parser
const parsePieces = (weightStr: string): number | null => {
  if (!weightStr) return null;
  const match = String(weightStr).toLowerCase().match(/([0-9]+)\s*(pcs|piece|pieces|units|pack)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
};

export default function OrderEditModal({
  order,
  catalogProducts = [],
  onClose,
  onSuccess,
}: OrderEditModalProps) {
  const [activeTab, setActiveTab] = useState<"items" | "delay">("items");

  // Prep delay state
  const [selectedDelayMinutes, setSelectedDelayMinutes] = useState<number>(0);
  const [isApplyingDelay, setIsApplyingDelay] = useState(false);

  // Items editing state
  const [items, setItems] = useState<any[]>(() => {
    return (order.items || []).map((it: any) => {
      const originalWeight = it.netWeight || it.weight || "1 kg";
      const originalPrice = Number(it.price) || 0;
      const initialGrams = parseGrams(originalWeight);
      const initialPieces = parsePieces(originalWeight);

      return {
        productId: it.productId || it.id || "",
        name: it.name || "Meat Cut",
        originalWeight,
        netWeight: originalWeight,
        originalPrice,
        price: originalPrice,
        quantity: Math.max(1, Number(it.quantity) || 1),
        image: it.image || "",
        baseGrams: initialGrams,
        currentGrams: initialGrams,
        basePieces: initialPieces,
        currentPieces: initialPieces,
        isPieceBased: initialPieces !== null,
        pricePerGram: initialGrams > 0 ? originalPrice / initialGrams : 0,
        pricePerPiece: (initialPieces && initialPieces > 0) ? originalPrice / initialPieces : 0,
        notes: it.notes || "",
        isModified: false,
      };
    });
  });

  const [modificationReason, setModificationReason] = useState("");
  const [isSavingItems, setIsSavingItems] = useState(false);

  // New item addition from catalog
  const [showAddProductDropdown, setShowAddProductDropdown] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [newAddQty, setNewAddQty] = useState(1);

  // Group catalog products by category
  const groupedProducts = useMemo(() => {
    const groups: { [cat: string]: any[] } = {};
    catalogProducts.forEach((p) => {
      const cat = p.categoryLabel || p.category || "Fresh Cuts";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [catalogProducts]);

  // Handle adding grams to a weight item
  const handleAddGrams = (index: number, gramsToAdd: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const it = { ...copy[index] };
      const newGrams = Math.max(50, (it.currentGrams || 1000) + gramsToAdd);
      it.currentGrams = newGrams;
      it.netWeight = formatGrams(newGrams);

      // Recalculate price: base price per gram * new grams
      if (it.pricePerGram > 0) {
        it.price = Math.round(newGrams * it.pricePerGram);
      }
      it.isModified = true;
      copy[index] = it;
      return copy;
    });
  };

  // Handle pieces adjustment
  const handleAdjustPieces = (index: number, delta: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const it = { ...copy[index] };
      const newPieces = Math.max(1, (it.currentPieces || 1) + delta);
      it.currentPieces = newPieces;
      it.netWeight = `${newPieces} pcs`;

      if (it.pricePerPiece > 0) {
        it.price = Math.round(newPieces * it.pricePerPiece);
      }
      it.isModified = true;
      copy[index] = it;
      return copy;
    });
  };

  // Handle direct weight text edit
  const handleDirectWeightChange = (index: number, newWeightStr: string) => {
    setItems((prev) => {
      const copy = [...prev];
      const it = { ...copy[index] };
      it.netWeight = newWeightStr;
      const parsed = parseGrams(newWeightStr);
      if (parsed > 0) {
        it.currentGrams = parsed;
        if (it.pricePerGram > 0) {
          it.price = Math.round(parsed * it.pricePerGram);
        }
      }
      it.isModified = true;
      copy[index] = it;
      return copy;
    });
  };

  // Handle direct price edit (override)
  const handleDirectPriceChange = (index: number, newPriceVal: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const it = { ...copy[index] };
      it.price = Math.max(0, newPriceVal);
      it.isModified = true;
      copy[index] = it;
      return copy;
    });
  };

  // Handle quantity adjustment
  const handleAdjustQty = (index: number, delta: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const it = { ...copy[index] };
      it.quantity = Math.max(1, it.quantity + delta);
      it.isModified = true;
      copy[index] = it;
      return copy;
    });
  };

  // Handle item removal
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.warning("An order must have at least 1 item. You cannot remove all items.", "Action Blocked");
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Add selected product from catalog
  const handleConfirmAddCatalogProduct = () => {
    if (!selectedCatalogId) return;
    const prod = catalogProducts.find((p) => (p.id || p._id) === selectedCatalogId);
    if (!prod) return;

    const defaultWeight = prod.netWeight || prod.weight || "500g";
    const defaultPrice = Number(prod.price) || 0;
    const grams = parseGrams(defaultWeight);
    const pcs = parsePieces(defaultWeight);

    const newItem = {
      productId: prod.id || prod._id,
      name: prod.name,
      originalWeight: defaultWeight,
      netWeight: defaultWeight,
      originalPrice: defaultPrice,
      price: defaultPrice,
      quantity: newAddQty,
      image: prod.image || "",
      baseGrams: grams,
      currentGrams: grams,
      basePieces: pcs,
      currentPieces: pcs,
      isPieceBased: pcs !== null,
      pricePerGram: grams > 0 ? defaultPrice / grams : 0,
      pricePerPiece: (pcs && pcs > 0) ? defaultPrice / pcs : 0,
      notes: "Added by store admin on call",
      isModified: true,
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedCatalogId("");
    setNewAddQty(1);
    setShowAddProductDropdown(false);
    toast.success(`"${prod.name}" added to order.`, "Item Added");
  };

  // Authoritative calculations
  const originalSubtotal = (order.items || []).reduce(
    (sum: number, it: any) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
    0
  );
  const newSubtotal = items.reduce(
    (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
    0
  );

  const deliveryFee = Number(order.deliveryFee) || 0;
  const expressFee = Number(order.expressFee) || 0;
  const tip = Number(order.tip) || 0;
  const discountAmount = Number(order.discountAmount) || 0;

  const originalGrandTotal = Number(order.amount ?? order.totalAmount ?? originalSubtotal);
  const newGrandTotal = Math.max(0, newSubtotal + deliveryFee + expressFee + tip - discountAmount);
  const differenceAmount = newGrandTotal - originalGrandTotal;

  const isOnlinePrepaid =
    order.paymentStatus === "Paid" &&
    (order.paymentMethod?.toLowerCase().includes("online") ||
      order.paymentMethod?.toLowerCase().includes("payu") ||
      order.paymentMethod?.toLowerCase().includes("razorpay") ||
      order.paymentMethod?.toLowerCase().includes("wallet"));

  // ETA Calculation for Prep Delay
  const currentTargetTimestamp = order.targetDeliveryTime
    ? new Date(order.targetDeliveryTime).getTime()
    : Date.now() + 35 * 60 * 1000;
  const newTargetTimestamp = currentTargetTimestamp + selectedDelayMinutes * 60 * 1000;

  const formatTimeOnly = (ts: number) => {
    try {
      return new Date(ts).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "";
    }
  };

  // Submit Prep Delay
  const handleApplyPrepDelay = async () => {
    if (selectedDelayMinutes <= 0) {
      toast.warning("Please choose an extra delay duration (+10m, +20m, +30m, or +1 hr).", "Delay Required");
      return;
    }
    setIsApplyingDelay(true);
    try {
      const orderId = order.orderId || order.id;
      const res = await api.post(`/store-admin/orders/${orderId}/delay-prep`, {
        extraMinutes: selectedDelayMinutes,
      });
      if (res.data?.success) {
        toast.success(
          `Preparation extended by +${selectedDelayMinutes} mins. Customer ETA updated.`,
          "ETA Extended"
        );
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to extend preparation delay", "Delay Error");
    } finally {
      setIsApplyingDelay(false);
    }
  };

  // Submit Items Revision
  const handleSaveItemsRevision = async () => {
    if (items.length === 0) {
      toast.error("Order cannot have zero items.", "Error");
      return;
    }
    setIsSavingItems(true);
    try {
      const orderId = order.orderId || order.id;
      const res = await api.patch(`/store-admin/orders/${orderId}/modify-items`, {
        items,
        reason: modificationReason.trim() || "Customer requested weight/item adjustment on call",
      });
      if (res.data?.success) {
        toast.success("Order items and price successfully revised! KOT updated.", "Order Revised");
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to modify order items", "Save Error");
    } finally {
      setIsSavingItems(false);
    }
  };

  const orderKey = order.orderId || order.id;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "14px",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "18px",
          width: "100%",
          maxWidth: "620px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            background: "#faf8f5",
            borderBottom: "1px solid #ede8e0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "1rem", fontWeight: 800, color: "#1f2937" }}>
                Modify Order #{orderKey}
              </span>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  background: "#fee2e2",
                  color: "#991b1b",
                  padding: "2px 8px",
                  borderRadius: "6px",
                }}
              >
                {order.status || "Pending"}
              </span>
            </div>
            <p style={{ margin: "3px 0 0 0", fontSize: "0.76rem", color: "#6b7280" }}>
              Customer: <strong>{order.customer?.name || "Customer"}</strong> · {order.customer?.phone || ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#6b7280",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Tab Selector */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #e5e7eb",
            background: "#f9fafb",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("items")}
            style={{
              flex: 1,
              padding: "12px 14px",
              border: "none",
              borderBottom: activeTab === "items" ? "2.5px solid #941717" : "2.5px solid transparent",
              background: activeTab === "items" ? "#fff" : "transparent",
              color: activeTab === "items" ? "#941717" : "#6b7280",
              fontSize: "0.82rem",
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <span className="material-symbols-outlined text-[18px]">scale</span>
            <span>Adjust Weight, Pieces & Items</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("delay")}
            style={{
              flex: 1,
              padding: "12px 14px",
              border: "none",
              borderBottom: activeTab === "delay" ? "2.5px solid #941717" : "2.5px solid transparent",
              background: activeTab === "delay" ? "#fff" : "transparent",
              color: activeTab === "delay" ? "#941717" : "#6b7280",
              fontSize: "0.82rem",
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <span className="material-symbols-outlined text-[18px]">schedule</span>
            <span>Extend Prep Time & ETA</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          {/* TAB 1: ADJUST WEIGHT, PIECES & ITEMS */}
          {activeTab === "items" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  background: "#fef3c7",
                  border: "1px solid #fde68a",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  fontSize: "0.78rem",
                  color: "#92400e",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                }}
              >
                <span className="material-symbols-outlined text-[17px] text-amber-700 shrink-0">info</span>
                <div>
                  <strong>Customer On-Call Revision:</strong> Click quick chips like <strong>+100g</strong>, <strong>+200g</strong> or adjust pieces. The price automatically recalculates based on the base rate.
                </div>
              </div>

              {/* Items List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: "1.5px solid #e5e7eb",
                      borderRadius: "12px",
                      padding: "14px",
                      background: it.isModified ? "#fdfbf7" : "#fff",
                      borderColor: it.isModified ? "#fcd34d" : "#e5e7eb",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "10px",
                        marginBottom: "10px",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, color: "#111827", fontSize: "0.9rem" }}>
                          {it.name}
                        </div>
                        <div style={{ fontSize: "0.74rem", color: "#6b7280", marginTop: "2px" }}>
                          Base Rate: ₹{it.originalPrice} ({it.originalWeight})
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        title="Remove item"
                        style={{
                          background: "#fee2e2",
                          border: "none",
                          borderRadius: "6px",
                          color: "#dc2626",
                          padding: "4px 8px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                        }}
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                        <span>Remove</span>
                      </button>
                    </div>

                    {/* Weight / Pieces Controls */}
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                      {!it.isPieceBased ? (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#374151" }}>Weight:</span>
                            <input
                              type="text"
                              value={it.netWeight}
                              onChange={(e) => handleDirectWeightChange(idx, e.target.value)}
                              style={{
                                width: "85px",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                border: "1px solid #d1d5db",
                                fontSize: "0.8rem",
                                fontWeight: 700,
                                textAlign: "center",
                              }}
                            />
                          </div>

                          {/* Quick Gram Adder Chips */}
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => handleAddGrams(idx, 100)}
                              style={{
                                background: "#f3f4f6",
                                border: "1px solid #d1d5db",
                                borderRadius: "6px",
                                padding: "3px 8px",
                                fontSize: "0.74rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                color: "#1f2937",
                              }}
                            >
                              +100g
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddGrams(idx, 200)}
                              style={{
                                background: "#fef3c7",
                                border: "1px solid #fde68a",
                                borderRadius: "6px",
                                padding: "3px 8px",
                                fontSize: "0.74rem",
                                fontWeight: 800,
                                cursor: "pointer",
                                color: "#92400e",
                              }}
                            >
                              +200g
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddGrams(idx, 500)}
                              style={{
                                background: "#f3f4f6",
                                border: "1px solid #d1d5db",
                                borderRadius: "6px",
                                padding: "3px 8px",
                                fontSize: "0.74rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                color: "#1f2937",
                              }}
                            >
                              +500g
                            </button>
                          </div>
                        </>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#374151" }}>Pieces:</span>
                          <div style={{ display: "flex", alignItems: "center", border: "1px solid #d1d5db", borderRadius: "6px", overflow: "hidden" }}>
                            <button
                              type="button"
                              onClick={() => handleAdjustPieces(idx, -1)}
                              style={{ background: "#f3f4f6", border: "none", padding: "4px 10px", cursor: "pointer", fontWeight: 800 }}
                            >
                              −
                            </button>
                            <span style={{ padding: "0 10px", fontSize: "0.8rem", fontWeight: 800 }}>
                              {it.currentPieces} pcs
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAdjustPieces(idx, 1)}
                              style={{ background: "#f3f4f6", border: "none", padding: "4px 10px", cursor: "pointer", fontWeight: 800 }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Quantity Stepper */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
                        <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#6b7280" }}>Qty:</span>
                        <div style={{ display: "flex", alignItems: "center", border: "1px solid #d1d5db", borderRadius: "6px" }}>
                          <button
                            type="button"
                            onClick={() => handleAdjustQty(idx, -1)}
                            style={{ background: "#f9fafb", border: "none", padding: "3px 8px", cursor: "pointer", fontWeight: 800 }}
                          >
                            −
                          </button>
                          <span style={{ padding: "0 8px", fontSize: "0.78rem", fontWeight: 800 }}>{it.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleAdjustQty(idx, 1)}
                            style={{ background: "#f9fafb", border: "none", padding: "3px 8px", cursor: "pointer", fontWeight: 800 }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Calculated Price Line */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "#fafafa",
                        padding: "6px 10px",
                        borderRadius: "8px",
                        border: "1px dashed #d1d5db",
                      }}
                    >
                      <span style={{ fontSize: "0.76rem", color: "#6b7280" }}>
                        Unit Price (editable):
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>₹</span>
                        <input
                          type="number"
                          value={it.price}
                          onChange={(e) => handleDirectPriceChange(idx, Number(e.target.value))}
                          style={{
                            width: "70px",
                            padding: "3px 6px",
                            borderRadius: "4px",
                            border: "1px solid #d1d5db",
                            fontSize: "0.82rem",
                            fontWeight: 800,
                            color: "#941717",
                            textAlign: "right",
                          }}
                        />
                        <span style={{ fontSize: "0.82rem", fontWeight: 900, color: "#111827", marginLeft: "6px" }}>
                          = ₹{it.price * it.quantity}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Product From Catalog */}
              {!showAddProductDropdown ? (
                <button
                  type="button"
                  onClick={() => setShowAddProductDropdown(true)}
                  style={{
                    background: "#f0fdf4",
                    border: "1.5px dashed #86efac",
                    borderRadius: "10px",
                    padding: "10px",
                    color: "#166534",
                    fontSize: "0.8rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <span className="material-symbols-outlined text-[17px]">add_circle</span>
                  <span>+ Add Another Product from Store Catalog</span>
                </button>
              ) : (
                <div style={{ border: "1.5px solid #86efac", borderRadius: "10px", padding: "12px", background: "#f0fdf4" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#166534", marginBottom: "8px" }}>
                    Select Catalog Product
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <select
                      value={selectedCatalogId}
                      onChange={(e) => setSelectedCatalogId(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: "180px",
                        padding: "7px 10px",
                        borderRadius: "8px",
                        border: "1px solid #bbf7d0",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        background: "#fff",
                      }}
                    >
                      <option value="">-- Choose Item from Store Catalog --</option>
                      {Object.keys(groupedProducts).map((cat) => (
                        <optgroup key={cat} label={`── ${cat} ──`}>
                          {groupedProducts[cat].map((p: any) => (
                            <option key={p.id || p._id} value={p.id || p._id}>
                              {p.name} ({p.netWeight || p.weight || "500g"}) • ₹{p.price}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700 }}>Qty:</span>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={newAddQty}
                        onChange={(e) => setNewAddQty(Math.max(1, Number(e.target.value)))}
                        style={{ width: "50px", padding: "6px", borderRadius: "6px", border: "1px solid #d1d5db", textAlign: "center", fontSize: "0.8rem", fontWeight: 800 }}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={!selectedCatalogId}
                      onClick={handleConfirmAddCatalogProduct}
                      style={{
                        background: selectedCatalogId ? "#16a34a" : "#d1d5db",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "7px 14px",
                        fontSize: "0.8rem",
                        fontWeight: 800,
                        cursor: selectedCatalogId ? "pointer" : "not-allowed",
                      }}
                    >
                      Add Item
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddProductDropdown(false)}
                      style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "0.76rem", fontWeight: 700 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Note / Customer Request Reason */}
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>
                  Reason for Adjustment (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Customer called and asked for +200g extra chicken"
                  value={modificationReason}
                  onChange={(e) => setModificationReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    fontSize: "0.8rem",
                  }}
                />
              </div>

              {/* Bill Comparison Box */}
              <div
                style={{
                  background: "#faf8f5",
                  border: "1px solid #ede8e0",
                  borderRadius: "12px",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontSize: "0.82rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280" }}>
                  <span>Original Bill Total:</span>
                  <span style={{ fontWeight: 700 }}>₹{originalGrandTotal}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#111827", fontWeight: 900, fontSize: "0.95rem" }}>
                  <span>New Revised Total:</span>
                  <span style={{ color: "#941717" }}>₹{newGrandTotal}</span>
                </div>
                {differenceAmount !== 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: differenceAmount > 0 ? "#15803d" : "#b91c1c",
                      fontWeight: 800,
                      fontSize: "0.8rem",
                      paddingTop: "4px",
                      borderTop: "1px dashed #d1d5db",
                    }}
                  >
                    <span>{differenceAmount > 0 ? "Extra Amount to Collect:" : "Reduction:"}</span>
                    <span>{differenceAmount > 0 ? `+₹${differenceAmount}` : `-₹${Math.abs(differenceAmount)}`}</span>
                  </div>
                )}

                {/* Prepaid Note */}
                {isOnlinePrepaid && differenceAmount > 0 && (
                  <div
                    style={{
                      marginTop: "6px",
                      padding: "8px 10px",
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      borderRadius: "8px",
                      fontSize: "0.74rem",
                      color: "#1e40af",
                      fontWeight: 600,
                    }}
                  >
                    ⚠️ Customer already paid <strong>₹{originalGrandTotal}</strong> online via {order.paymentMethod || "Gateway"}. The additional <strong>₹{differenceAmount}</strong> will be collected as Cash/UPI on delivery.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: EXTEND PREP TIME & DELIVERY ETA */}
          {activeTab === "delay" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  fontSize: "0.78rem",
                  color: "#1e40af",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                }}
              >
                <span className="material-symbols-outlined text-[17px] text-blue-700 shrink-0">timer</span>
                <div>
                  <strong>Store Counter Rush:</strong> Select an extra preparation delay. The customer&apos;s expected delivery time will automatically extend and they will receive a notification.
                </div>
              </div>

              {/* Current & New ETA Display */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                  background: "#fafafa",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 700 }}>Current ETA</div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#374151", marginTop: "2px" }}>
                    {formatTimeOnly(currentTargetTimestamp)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "#0284c7", fontWeight: 700 }}>
                    New ETA {selectedDelayMinutes > 0 ? `(+${selectedDelayMinutes}m)` : ""}
                  </div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 900, color: selectedDelayMinutes > 0 ? "#941717" : "#374151", marginTop: "2px" }}>
                    {formatTimeOnly(newTargetTimestamp)}
                  </div>
                </div>
              </div>

              {/* Delay Selector Options */}
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 800, color: "#374151", marginBottom: "8px" }}>
                  Select Extra Preparation Delay:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "8px" }}>
                  {[10, 20, 30, 60].map((mins) => {
                    const isSelected = selectedDelayMinutes === mins;
                    const label = mins === 60 ? "+1 Hour" : `+${mins} Mins`;
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setSelectedDelayMinutes(mins)}
                        style={{
                          padding: "12px 10px",
                          borderRadius: "10px",
                          border: isSelected ? "2px solid #941717" : "1.5px solid #d1d5db",
                          background: isSelected ? "#fff5f5" : "#fff",
                          color: isSelected ? "#941717" : "#374151",
                          fontSize: "0.85rem",
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "4px",
                          transition: "all 150ms ease",
                          boxShadow: isSelected ? "0 2px 8px rgba(148, 23, 23, 0.15)" : "none",
                        }}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {mins === 60 ? "hourglass_top" : "more_time"}
                        </span>
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedDelayMinutes > 0 && (
                <div
                  style={{
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "0.75rem",
                    color: "#065f46",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span className="material-symbols-outlined text-[15px]">notifications_active</span>
                  <span>Customer will be notified: &quot;Store added +{selectedDelayMinutes} mins delay for fresh cutting.&quot;</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "14px 20px",
            background: "#faf8f5",
            borderTop: "1px solid #ede8e0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              background: "#fff",
              color: "#374151",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          {activeTab === "items" ? (
            <button
              type="button"
              disabled={isSavingItems}
              onClick={handleSaveItemsRevision}
              style={{
                padding: "9px 18px",
                borderRadius: "8px",
                border: "none",
                background: "#941717",
                color: "#fff",
                fontSize: "0.82rem",
                fontWeight: 800,
                cursor: isSavingItems ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 6px rgba(148, 23, 23, 0.25)",
              }}
            >
              {isSavingItems ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Revisions…</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[17px]">save</span>
                  <span>Save Revisions & Update KOT (₹{newGrandTotal})</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={isApplyingDelay || selectedDelayMinutes <= 0}
              onClick={handleApplyPrepDelay}
              style={{
                padding: "9px 18px",
                borderRadius: "8px",
                border: "none",
                background: selectedDelayMinutes > 0 ? "#0284c7" : "#9ca3af",
                color: "#fff",
                fontSize: "0.82rem",
                fontWeight: 800,
                cursor: selectedDelayMinutes > 0 ? "pointer" : "not-allowed",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: selectedDelayMinutes > 0 ? "0 2px 6px rgba(2, 132, 199, 0.25)" : "none",
              }}
            >
              {isApplyingDelay ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Applying Delay…</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[17px]">send</span>
                  <span>Apply +{selectedDelayMinutes || 0}m Delay & Notify</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
