"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, clearAuth } from "@/lib/auth";
import type { User } from "@/lib/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPowerOff } from "@fortawesome/free-solid-svg-icons";
import api from "@/lib/api";

// ─── Sidebar tabs ─────────────────────────────────────────────────────────────
const TABS = [
  { key: "dashboard",  label: "Dashboard",         icon: "dashboard" },
  { key: "orders",     label: "Live Orders",        icon: "local_shipping" },
  { key: "products",   label: "Products & Stock",   icon: "restaurant" },
  { key: "inventory",  label: "Inventory",          icon: "inventory_2" },
  { key: "customers",  label: "Customers",          icon: "group" },
  { key: "riders",     label: "Riders & Dispatch",  icon: "two_wheeler" },
  { key: "returns",    label: "Returns & Exchange", icon: "swap_horiz" },
];

// ─── Reusable UI pieces ────────────────────────────────────────────────────────
const KPICard = ({ icon, label, value, sub, color = "#941717", onClick }: {
  icon: string; label: string; value: string; sub: string; color?: string; onClick?: () => void;
}) => (
  <div
    onClick={onClick}
    style={{
      background: "#ffffff",
      border: "1px solid #ede8e0",
      borderRadius: "14px",
      padding: "22px 20px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      cursor: onClick ? "pointer" : "default",
      transition: "box-shadow 150ms ease",
      borderLeft: `4px solid ${color}`,
    }}
  >
    <div style={{ marginBottom: "10px" }}>
      <span className="material-symbols-outlined text-[30px]" style={{ color }}>{icon}</span>
    </div>
    <div style={{ fontSize: "1.85rem", fontWeight: 900, color, fontFamily: "Outfit, sans-serif", lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#423b32", marginTop: "4px" }}>{label}</div>
    <div style={{ fontSize: "0.75rem", color: "#73695b", marginTop: "2px" }}>{sub}</div>
  </div>
);

const SectionTitle = ({ title, sub }: { title: string; sub?: string }) => (
  <div style={{ marginBottom: "24px" }}>
    <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#171410", margin: 0 }}>{title}</h2>
    {sub && <p style={{ color: "#73695b", fontSize: "0.875rem", marginTop: "4px" }}>{sub}</p>}
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

// ─── Tab Panels ───────────────────────────────────────────────────────────────

function DashboardTab({ setActiveTab }: { setActiveTab: (t: string) => void }) {
  const [kpis, setKpis] = useState<any[]>([]);
  const [latestOrders, setLatestOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    api.get<{ success: boolean; kpis: any[]; latestOrders: any[] }>("/store-admin/dashboard")
      .then(res => {
        if (res.data.success) {
          setKpis(res.data.kpis || []);
          setLatestOrders(res.data.latestOrders || []);
        }
      })
      .catch(err => console.warn("Failed to load store-admin dashboard:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const defaultKpis = [
    { icon: "inventory_2", label: "Pending Orders", value: "2", sub: "Awaiting cutting or dispatch", color: "#941717", tab: "orders" },
    { icon: "check_circle", label: "Delivered Today", value: "2", sub: "Successfully completed", color: "#059669", tab: "orders" },
    { icon: "payments", label: "Today's Revenue", value: "₹449", sub: "From completed orders", color: "#c28114", tab: "orders" },
    { icon: "restaurant", label: "Chicken Stock", value: "98 kg", sub: "Fresh morning batch", color: "#7c3aed", tab: "inventory" },
    { icon: "kebab_dining", label: "Mutton Stock", value: "42 kg", sub: "Young goat — fresh stock", color: "#d97706", tab: "inventory" },
    { icon: "two_wheeler", label: "Active Riders", value: "4", sub: "Available in Ranchi", color: "#0284c7", tab: "riders" },
  ];

  const displayKpis = kpis.length > 0 ? kpis : defaultKpis;

  return (
    <div>
      <SectionTitle title="Store Dashboard" sub={`Kishore Ganj — Live overview · ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}`} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px", marginBottom: "36px" }}>
        {displayKpis.map(k => <KPICard key={k.label} {...k} onClick={() => setActiveTab(k.tab)} />)}
      </div>

      {/* Live order summary mini-list */}
      <SectionTitle title="Latest Incoming Orders" sub="Live queue from MongoDB Atlas" />
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
      fetchOrders();
    } catch (err) {
      alert("Failed to advance order status");
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
    if (!window.confirm("Add +10 minutes rush preparation delay for this order?\n\nThe customer's arrival time will automatically be extended and updated in real-time.")) {
      return;
    }
    try {
      await api.post(`/store-admin/orders/${orderId}/delay-prep`, { extraMinutes: 10 });
      fetchOrders();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to extend prep time");
    }
  };

  return (
    <div>
      <SectionTitle title="Live Order Queue" sub="Manage today's orders from cutting to delivery" />

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
                        }}>
                          🏪 STORE PICKUP (Customer Takeaway)
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
                        }}>
                          🛵 HOME EXPRESS DELIVERY
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
                      {isPickup
                        ? "🏪 Customer will collect at Kishore Ganj Butchery Counter"
                        : `📍 ${o.customer?.address || "Ranchi"}`}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900, color: "#941717", fontSize: "1.15rem", fontFamily: "Outfit, sans-serif" }}>₹{o.amount}</div>
                    <div style={{ color: "#73695b", fontSize: "0.75rem", fontWeight: 600 }}>{o.deliverySlot}</div>
                  </div>
                </div>

                <div style={{ color: "#423b32", fontSize: "0.875rem", fontWeight: 600, marginBottom: "12px" }}>
                  🛒 {o.itemSummary || o.items?.map((item: any) => `${item.name} ×${item.quantity}`).join(", ")}
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
                    <span>⏱️ Prep Time: <strong>{o.prepTimeMinutes || 25} mins</strong></span>
                    <span>•</span>
                    <span>
                      🎯 Target Delivery: <strong>
                        {o.targetDeliveryTime
                          ? new Date(o.targetDeliveryTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                          : "Calculated"}
                      </strong>
                    </span>
                    {o.status === "Out for Delivery" && (
                      <>
                        <span>•</span>
                        <span style={{ color: "#0369a1", fontWeight: 700 }}>
                          🛵 Rider in transit (~{o.remainingTransitMinutes != null ? o.remainingTransitMinutes : 15} mins away)
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
                          background: isPickup ? "#d97706" : "#941717",
                          border: "none",
                          borderRadius: "8px",
                          padding: "7px 14px",
                          color: "#fff",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {nextLabel}
                      </button>
                    )}
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
      fetchProducts();
    } catch (err) {
      alert("Failed to toggle stock status");
    }
  };

  return (
    <div>
      <SectionTitle title="Products & Stock" sub="Toggle availability for your store" />
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#73695b" }}>Loading products from MongoDB Atlas…</div>
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

function InventoryTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchInventory();
  }, []);

  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [operation, setOperation] = useState<"add" | "reduce" | "set">("add");
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState<string>("Fresh supply arrival");
  const [submitting, setSubmitting] = useState(false);

  // Compute calculated projected stock
  const currentStock = selectedItem ? Number(selectedItem.stock || 0) : 0;
  const inputQty = parseFloat(quantity) || 0;
  let projectedStock = currentStock;
  if (operation === "add") {
    projectedStock = currentStock + inputQty;
  } else if (operation === "reduce") {
    projectedStock = Math.max(0, currentStock - inputQty);
  } else if (operation === "set") {
    projectedStock = Math.max(0, inputQty);
  }

  const handleUpdateStock = async () => {
    if (!selectedItem) return;
    if (operation !== "set" && (!quantity || inputQty <= 0)) {
      alert("Please enter a valid quantity");
      return;
    }
    setSubmitting(true);
    try {
      const id = selectedItem.itemId || selectedItem.id;
      await api.patch(`/store-admin/inventory/${id}`, { stock: projectedStock });
      fetchInventory();
      setShowStockModal(false);
      setSelectedItem(null);
      setQuantity("");
    } catch (err) {
      alert("Failed to update stock quantity");
    } finally {
      setSubmitting(false);
    }
  };

  const getReasonOptions = () => {
    if (operation === "add") {
      return [
        "Fresh supply received from supplier",
        "Inter-store transfer in",
        "Customer order cancellation / restock",
        "Other / Manual correction",
      ];
    } else if (operation === "reduce") {
      return [
        "Daily butchery trimming & fat/bone discard",
        "Spoilage / quality rejection",
        "Walk-in offline counter sale",
        "Damaged / expired meat removal",
        "Other / Manual reduction",
      ];
    } else {
      return [
        "End-of-day physical count reconciliation",
        "Weekly stock audit",
        "Morning opening count adjustment",
        "Other / Calibration",
      ];
    }
  };

  return (
    <div>
      <SectionTitle title="Raw Butchery Inventory" sub="Track fresh stock levels for today's butchery" />
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#73695b" }}>Loading live inventory…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {items.map(item => {
            const isLow = item.status === "Low Stock" || item.stock <= (item.min || 15);
            return (
              <div key={item.itemId || item.id} style={{ background: "#fff", border: `1px solid ${isLow ? "#fecaca" : "#ede8e0"}`, borderRadius: "14px", padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#171410", fontSize: "1rem" }}>{item.item}</div>
                    <div style={{ color: "#73695b", fontSize: "0.75rem" }}>Category: {item.category}</div>
                  </div>
                  <Badge label={item.status} color={isLow ? "#d97706" : "#059669"} />
                </div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: isLow ? "#d97706" : "#059669", fontFamily: "Outfit, sans-serif" }}>
                  {item.stock} <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#73695b" }}>{item.unit}</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#73695b", marginTop: "6px" }}>Min Alert: {item.min} {item.unit} · {item.lastRestocked}</div>
                <button
                  onClick={() => {
                    setSelectedItem(item);
                    setOperation("add");
                    setQuantity("");
                    setReason("Fresh supply received from supplier");
                    setShowStockModal(true);
                  }}
                  style={{
                    marginTop: "14px",
                    background: isLow ? "#d97706" : "#941717",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 14px",
                    color: "#fff",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <span>📦 Adjust Stock (+ / - / Set)</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── STOCK ADJUSTMENT MODAL (ADD / REDUCE / SET EXACT) ─── */}
      {showStockModal && selectedItem && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "480px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#171410" }}>Adjust Stock Level</h3>
                <div style={{ fontSize: "0.9rem", color: "#941717", fontWeight: 700, marginTop: "3px" }}>
                  {selectedItem.item} ({selectedItem.category})
                </div>
              </div>
              <button
                onClick={() => { setShowStockModal(false); setSelectedItem(null); }}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#73695b" }}
              >
                ✕
              </button>
            </div>

            {/* Current Balance Banner */}
            <div style={{
              background: "#faf8f5",
              border: "1px solid #ede8e0",
              borderRadius: "10px",
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}>
              <span style={{ fontSize: "0.85rem", color: "#73695b", fontWeight: 600 }}>Current Live Stock:</span>
              <span style={{ fontSize: "1.25rem", fontWeight: 900, color: "#171410", fontFamily: "Outfit, sans-serif" }}>
                {currentStock} {selectedItem.unit}
              </span>
            </div>

            {/* Operation Mode Selector Tabs */}
            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>Select Action:</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setOperation("add");
                    setReason("Fresh supply received from supplier");
                  }}
                  style={{
                    padding: "10px 8px",
                    borderRadius: "8px",
                    border: operation === "add" ? "2px solid #059669" : "1px solid #d1cbbf",
                    background: operation === "add" ? "#ecfdf5" : "#fff",
                    color: operation === "add" ? "#059669" : "#423b32",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  ➕ Add Stock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOperation("reduce");
                    setReason("Daily butchery trimming & fat/bone discard");
                  }}
                  style={{
                    padding: "10px 8px",
                    borderRadius: "8px",
                    border: operation === "reduce" ? "2px solid #dc2626" : "1px solid #d1cbbf",
                    background: operation === "reduce" ? "#fef2f2" : "#fff",
                    color: operation === "reduce" ? "#dc2626" : "#423b32",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  ➖ Reduce Stock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOperation("set");
                    setReason("End-of-day physical count reconciliation");
                  }}
                  style={{
                    padding: "10px 8px",
                    borderRadius: "8px",
                    border: operation === "set" ? "2px solid #2563eb" : "1px solid #d1cbbf",
                    background: operation === "set" ? "#eff6ff" : "#fff",
                    color: operation === "set" ? "#2563eb" : "#423b32",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  🎯 Set Exact
                </button>
              </div>
            </div>

            {/* Quick Increment/Decrement Chips */}
            {operation !== "set" && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#73695b", marginBottom: "6px" }}>
                  Quick select amount ({selectedItem.unit}):
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {(operation === "add" ? [5, 10, 25, 50] : [2, 5, 10, 20]).map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setQuantity(String(val))}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "20px",
                        border: "1px solid #d1cbbf",
                        background: quantity === String(val) ? "#423b32" : "#fff",
                        color: quantity === String(val) ? "#fff" : "#423b32",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {operation === "add" ? `+${val}` : `-${val}`} {selectedItem.unit}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity Input Field */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>
                {operation === "add" && `Quantity to Add (${selectedItem.unit}) *`}
                {operation === "reduce" && `Quantity to Deduct (${selectedItem.unit}) *`}
                {operation === "set" && `New Total Stock (${selectedItem.unit}) *`}
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder={operation === "set" ? `e.g. ${currentStock}` : "Enter quantity (e.g. 10)"}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
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
              {operation === "reduce" && inputQty > currentStock && (
                <div style={{ color: "#dc2626", fontSize: "0.75rem", marginTop: "4px", fontWeight: 600 }}>
                  ⚠️ Deducting more than current stock ({currentStock} {selectedItem.unit}). Balance will drop to 0.
                </div>
              )}
            </div>

            {/* Projected Stock Calculation Preview */}
            <div style={{
              background: operation === "add" ? "#f0fdf4" : operation === "reduce" ? "#fff5f5" : "#f0f9ff",
              border: `1px solid ${operation === "add" ? "#bbf7d0" : operation === "reduce" ? "#fecaca" : "#bae6fd"}`,
              borderRadius: "10px",
              padding: "12px 16px",
              marginBottom: "18px",
            }}>
              <div style={{ fontSize: "0.78rem", color: "#73695b", marginBottom: "4px", fontWeight: 600 }}>Projected Result:</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.9rem", color: "#423b32" }}>
                  {currentStock} {selectedItem.unit}{" "}
                  {operation === "add" && `+ ${inputQty} ${selectedItem.unit}`}
                  {operation === "reduce" && `- ${inputQty} ${selectedItem.unit}`}
                  {operation === "set" && `➔ New Balance`}
                </span>
                <span style={{ fontSize: "1.2rem", fontWeight: 900, color: projectedStock <= (selectedItem.min || 15) ? "#d97706" : "#059669", fontFamily: "Outfit, sans-serif" }}>
                  = {projectedStock} {selectedItem.unit}
                </span>
              </div>
            </div>

            {/* Reason Selector */}
            <div style={{ marginBottom: "22px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Reason / Note:</label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
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
                {getReasonOptions().map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn"
                onClick={() => { setShowStockModal(false); setSelectedItem(null); }}
                disabled={submitting}
                style={{ padding: "9px 18px", borderRadius: "8px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleUpdateStock}
                disabled={submitting}
                style={{
                  padding: "9px 22px",
                  borderRadius: "8px",
                  background: operation === "reduce" ? "#dc2626" : operation === "set" ? "#2563eb" : "#059669",
                  borderColor: operation === "reduce" ? "#dc2626" : operation === "set" ? "#2563eb" : "#059669",
                  fontWeight: 700,
                }}
              >
                {submitting ? "Updating…" : operation === "add" ? `Add ${inputQty} ${selectedItem.unit}` : operation === "reduce" ? `Deduct ${inputQty} ${selectedItem.unit}` : `Set to ${inputQty} ${selectedItem.unit}`}
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
      <SectionTitle title="Store Customers" sub="Customers who ordered from your store" />
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ridersRes, ordersRes] = await Promise.all([
        api.get<{ success: boolean; riders: any[] }>("/store-admin/riders"),
        api.get<{ success: boolean; orders: any[] }>("/store-admin/orders?status=all")
      ]);
      if (ridersRes.data.success) setRiders(ridersRes.data.riders || []);
      if (ordersRes.data.success) {
        // Filter only Ready and Out for Delivery orders that require home delivery (exclude store takeaway)
        const relevantOrders = (ordersRes.data.orders || []).filter((o: any) => {
          const isPickup =
            o.fulfillmentType === "pickup" ||
            o.pickupMode === true ||
            o.deliverySlot?.toLowerCase().includes("pickup") ||
            o.customer?.address?.toLowerCase().includes("pickup");
          return (o.status === "Ready" || o.status === "Out for Delivery") && !isPickup;
        });
        setReadyOrders(relevantOrders);
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

  const handleAssignRider = async () => {
    if (!selectedOrder || !selectedRiderId) return;
    setSubmitting(true);
    try {
      await api.patch(`/store-admin/orders/${selectedOrder.orderId || selectedOrder.id}/assign-rider`, {
        riderId: selectedRiderId
      });
      fetchData();
      setShowAssignModal(false);
      setSelectedOrder(null);
      setSelectedRiderId("");
    } catch (err) {
      alert("Failed to assign rider to order");
    } finally {
      setSubmitting(false);
    }
  };

  const availableRiders = riders.filter(r => r.riderStatus === "Available");

  return (
    <div>
      <SectionTitle title="Riders & Dispatch" sub="Assign ready orders to available delivery partners" />
      
      {/* ─── RIDERS POOL ─── */}
      <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#171410", marginBottom: "12px", marginTop: "24px" }}>👥 Active Rider Pool</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "12px", marginBottom: "32px" }}>
        {riders.length === 0 && !loading && (
          <div style={{ padding: "16px", background: "#fff", border: "1px solid #ede8e0", borderRadius: "12px", color: "#73695b", fontSize: "0.85rem" }}>
            No riders assigned to this store.
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
            <div style={{ fontSize: "0.8rem", color: "#423b32", marginBottom: "4px" }}>📞 {r.phone}</div>
            <div style={{ fontSize: "0.75rem", color: "#73695b" }}>🛵 {r.vehicleNumber}</div>
          </div>
        ))}
      </div>

      {/* ─── ORDERS READY FOR DISPATCH ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#171410", margin: 0 }}>📦 Orders Pending Dispatch (Home Delivery Only)</h3>
        <span style={{ fontSize: "0.78rem", color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", padding: "3px 10px", borderRadius: "99px", fontWeight: 700 }}>
          🏪 Store Pickup orders are excluded (handled at counter)
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
                    📍 {o.customer?.address}
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
                🥩 <strong>Items:</strong> {o.itemSummary || o.items?.map((item: any) => `${item.name} ×${item.quantity}`).join(", ")}
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
            <h3 style={{ margin: "0 0 16px 0", fontSize: "1.2rem", fontWeight: 800, color: "#171410" }}>🛵 Dispatch Order #{selectedOrder.orderId || selectedOrder.id}</h3>
            
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
                  ⚠️ There are no available riders right now. Please wait until a rider completes their delivery or comes online.
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
    </div>
  );
}

function ReturnsTab() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchReturns();
  }, []);

  const updateStatus = async (requestId: string, status: string) => {
    try {
      await api.patch(`/store-admin/returns/${requestId}/status`, { status });
      fetchReturns();
    } catch (err) {
      alert("Failed to update exchange status");
    }
  };

  return (
    <div>
      <SectionTitle title="Returns & Exchange Requests" sub="Process 60-minute fresh meat exchange policy" />

      <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "12px", padding: "14px 18px", marginBottom: "24px", fontSize: "0.875rem", color: "#92400e" }}>
        ⚠️ <strong>60-Minute Policy:</strong> All exchange requests must be processed within 60 minutes of delivery to be eligible.
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#73695b" }}>Loading returns…</div>
      ) : requests.length === 0 ? (
        <div style={{ background: "#fff", padding: "40px", textAlign: "center", borderRadius: "14px", border: "1px solid #ede8e0" }}>
          No pending return or exchange tickets.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {requests.map(r => (
            <div key={r.requestId || r.id} style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <div style={{ fontWeight: 800, color: "#171410" }}>#{r.requestId || r.id} — {r.customer}</div>
                  <div style={{ color: "#73695b", fontSize: "0.8rem", marginTop: "2px" }}>Order: #{r.orderId} · {r.condition}</div>
                </div>
                <Badge label={r.status} color={r.status === "Approved" || r.status === "Exchange Dispatched" ? "#059669" : r.status === "Rejected" ? "#941717" : "#d97706"} />
              </div>
              <div style={{ color: "#423b32", fontSize: "0.875rem", marginBottom: "4px" }}>🥩 <strong>{r.items}</strong></div>
              <div style={{ color: "#73695b", fontSize: "0.8rem", marginBottom: "14px" }}>Reason: {r.reason}</div>
              {r.status === "Pending Review" && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => updateStatus(r.requestId || r.id, "Approved")}
                    style={{ background: "#059669", border: "none", borderRadius: "8px", padding: "7px 16px", color: "#fff", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}
                  >
                    ✓ Approve Exchange
                  </button>
                  <button
                    onClick={() => updateStatus(r.requestId || r.id, "Rejected")}
                    style={{ background: "#fdf2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "7px 16px", color: "#941717", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}
                  >
                    ✕ Reject
                  </button>
                </div>
              )}
              {r.status === "Approved" && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => updateStatus(r.requestId || r.id, "Exchange Dispatched")}
                    style={{ background: "#0284c7", border: "none", borderRadius: "8px", padding: "7px 16px", color: "#fff", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}
                  >
                    Mark Dispatched
                  </button>
                </div>
              )}
              {r.status === "Exchange Dispatched" && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => updateStatus(r.requestId || r.id, "Delivered")}
                    style={{ background: "#059669", border: "none", borderRadius: "8px", padding: "7px 16px", color: "#fff", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}
                  >
                    Mark Delivered
                  </button>
                </div>
              )}
            </div>
          ))}
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
    const stored = getStoredUser();
    if (!stored || (stored.role !== "storeadmin" && stored.role !== "superadmin" && stored.role !== "admin")) {
      router.push("/admin-login");
      return;
    }
    setUser(stored);
  }, [router]);

  const handleLogout = () => {
    clearAuth();
    router.push("/admin-login");
  };

  if (!user) return null;

  const tabComponents: Record<string, React.ReactNode> = {
    dashboard:  <DashboardTab setActiveTab={setActiveTab} />,
    orders:     <LiveOrdersTab />,
    products:   <ProductsStockTab />,
    inventory:  <InventoryTab />,
    customers:  <CustomersTab />,
    riders:     <RidersTab />,
    returns:    <ReturnsTab />,
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
            {!sidebarCollapsed && (
              <div style={{ fontSize: "0.6rem", color: "#fde68a", fontWeight: 700, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>STORE ADMIN</div>
            )}
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
          {/* Always-visible sign-out icon */}
          <button
            onClick={handleLogout}
            title="Sign Out"
            style={{
              width: "100%",
              background: "rgba(148,23,23,0.55)",
              border: "none",
              borderRadius: "8px",
              padding: "9px",
              color: "#fff",
              cursor: "pointer",
              fontSize: sidebarCollapsed ? "1rem" : "0.78rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "7px",
              marginBottom: "8px",
              transition: "background 150ms ease",
            }}
          >
            <FontAwesomeIcon icon={faPowerOff} style={{ fontSize: "0.9rem" }} />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>

          {/* User info — only when expanded */}
          {!sidebarCollapsed && (
            <div style={{ padding: "10px", background: "rgba(255,255,255,0.07)", borderRadius: "10px", marginBottom: "8px" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
              <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
            </div>
          )}

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
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
          <div>
            <div style={{ fontSize: "0.78rem", color: "#73695b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>
              Store Admin · {user.name || "Kishore Ganj"}, Ranchi
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#171410", display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined text-[24px] text-primary">{TABS.find(t => t.key === activeTab)?.icon}</span>
              <span>{TABS.find(t => t.key === activeTab)?.label}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "10px", padding: "8px 14px", fontSize: "0.8rem", color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="material-symbols-outlined text-[16px]">bolt</span>
              <span>Store Open</span>
            </div>
            <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "10px", padding: "8px 14px", fontSize: "0.8rem", color: "#73695b", display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="material-symbols-outlined text-[16px]">calendar_today</span>
              <span>{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {tabComponents[activeTab]}
      </main>
    </div>
  );
}
