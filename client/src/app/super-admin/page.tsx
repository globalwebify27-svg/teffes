"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, clearAuth } from "@/lib/auth";
import type { User } from "@/lib/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPowerOff,
  faStar,
  faTicket,
  faStore,
  faUserTie,
  faMotorcycle,
  faPen,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import api from "@/lib/api";
import { toast } from "@/lib/toast";
import { isYouTubeUrl, getYouTubeThumbnailUrl } from "@/lib/videoUtils";

// ─── Icon helpers ──────────────────────────────────────────────────────────────
const Icon = ({ emoji, size = "1.2rem" }: { emoji: string; size?: string }) => (
  <span style={{ fontSize: size, lineHeight: 1, display: "inline-block" }}>{emoji}</span>
);

// ─── Sidebar navigation items ──────────────────────────────────────────────────
const TABS = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard" },
  { key: "stores", label: "Stores", icon: "storefront" },
  { key: "store-admins", label: "Store Admins", icon: "admin_panel_settings" },
  { key: "products", label: "Products", icon: "restaurant" },
  { key: "categories", label: "Categories", icon: "category" },
  { key: "orders", label: "All Orders", icon: "local_shipping" },
  { key: "riders", label: "Riders", icon: "two_wheeler" },
  { key: "customers", label: "Customers", icon: "group" },
  { key: "coupons", label: "Coupons & Offers", icon: "sell" },
  { key: "banners", label: "Hero Banners", icon: "view_carousel" },
  { key: "settings", label: "Settings", icon: "settings" },
];

// ─── Reusable UI pieces ────────────────────────────────────────────────────────
const KPICard = ({ icon, label, value, sub, color = "#941717" }: {
  icon: string; label: string; value: string; sub: string; color?: string;
}) => (
  <div style={{
    background: "#ffffff",
    border: "1px solid #ede8e0",
    borderRadius: "14px",
    padding: "22px 20px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  }}>
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

const AdminEditButton = ({ onClick, title = "Edit", disabled, style }: { onClick: () => void; title?: string; disabled?: boolean; style?: React.CSSProperties }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      width: "32px",
      height: "32px",
      minWidth: "32px",
      borderRadius: "8px",
      border: "1px solid #bfdbfe",
      background: "#eff6ff",
      color: "#1d4ed8",
      cursor: disabled ? "not-allowed" : "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
      transition: "all 150ms ease",
      boxSizing: "border-box",
      opacity: disabled ? 0.6 : 1,
      ...style,
    }}
  >
    <span className="material-symbols-outlined text-[16px]">edit</span>
  </button>
);

const AdminDeleteButton = ({ onClick, title = "Delete", disabled, loading, style }: { onClick: () => void; title?: string; disabled?: boolean; loading?: boolean; style?: React.CSSProperties }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || loading}
    title={title}
    style={{
      width: "32px",
      height: "32px",
      minWidth: "32px",
      borderRadius: "8px",
      border: "1px solid #fee2e2",
      background: "#fff5f5",
      color: "#dc2626",
      cursor: (disabled || loading) ? "not-allowed" : "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
      transition: "all 150ms ease",
      boxSizing: "border-box",
      opacity: (disabled || loading) ? 0.6 : 1,
      ...style,
    }}
  >
    <span className="material-symbols-outlined text-[16px]">delete</span>
  </button>
);

// ─── Tab Panels ───────────────────────────────────────────────────────────────

function DashboardTab() {
  const [kpis, setKpis] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ success: boolean; kpis: any[]; recentActivity: any[] }>("/super-admin/dashboard")
      .then(res => {
        if (res.data.success) {
          setKpis(res.data.kpis || []);
          setRecentActivity(res.data.recentActivity || []);
        }
      })
      .catch(err => console.warn("Failed to load platform dashboard:", err))
      .finally(() => setLoading(false));
  }, []);

  const defaultKpis = [
    { icon: "inventory_2", label: "Total Orders Today", value: "6", sub: "↑ 18% vs yesterday", color: "#941717" },
    { icon: "payments", label: "Revenue Today", value: "₹449", sub: "Across 2 active stores", color: "#c28114" },
    { icon: "storefront", label: "Active Stores", value: "2", sub: "Ranchi Kishore Ganj, Doranda", color: "#059669" },
    { icon: "two_wheeler", label: "Active Riders", value: "4", sub: "2 out for delivery", color: "#7c3aed" },
    { icon: "group", label: "Total Customers", value: "2,841", sub: "↑ 34 new today", color: "#0284c7" },
    { icon: "star", label: "Avg Rating", value: "4.8 / 5", sub: "Based on 1,240 reviews", color: "#d97706" },
  ];

  const displayKpis = kpis.length > 0 ? kpis : defaultKpis;

  return (
    <div>
      <SectionTitle title="Platform Overview" sub="Live metrics across all Teffes stores in Ranchi" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px", marginBottom: "36px" }}>
        {displayKpis.map(k => <KPICard key={k.label} {...k} />)}
      </div>

      {/* Recent activity */}
      <SectionTitle title="Recent Platform Activity" sub="Live event stream from MongoDB Atlas" />
      <div style={{ background: "#ffffff", border: "1px solid #ede8e0", borderRadius: "14px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#73695b" }}>Loading platform activity…</div>
        ) : recentActivity.length === 0 ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#73695b" }}>No recent platform activity.</div>
        ) : (
          recentActivity.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "14px 20px", borderBottom: i < recentActivity.length - 1 ? "1px solid #ede8e0" : "none" }}>
              <span style={{ color: "#73695b", fontSize: "0.8rem", minWidth: "60px" }}>{a.time}</span>
              <span style={{ flex: 1, fontSize: "0.875rem", color: "#423b32" }}>{a.event}</span>
              <span style={{ fontSize: "0.78rem", color: "#73695b" }}>{a.store}</span>
              <Badge label={a.status} color={
                a.status === "Delivered" ? "#059669" :
                  a.status === "Cutting" ? "#d97706" :
                    a.status === "Pending" ? "#941717" : "#0284c7"
              } />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StoresTab() {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStores = () => {
    setLoading(true);
    api.get<{ success: boolean; stores: any[] }>("/super-admin/stores")
      .then(res => {
        if (res.data.success) {
          setStores(res.data.stores || []);
        }
      })
      .catch(err => console.warn("Failed to fetch stores:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const initialStoreForm = {
    name: "",
    phone: "",
    address: "",
    city: "Ranchi",
    image: "",
    timings: "08:00 AM - 08:00 PM",
    status: "Active",
    pickupEnabled: true,
    deliveryEnabled: true,
  };

  const [showAddStoreModal, setShowAddStoreModal] = useState(false);
  const [newStore, setNewStore] = useState(initialStoreForm);
  const [editingStore, setEditingStore] = useState<any | null>(null);
  const [storeToDelete, setStoreToDelete] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAddStore = async () => {
    if (!newStore.name.trim()) {
      alert("Please enter a store name");
      return;
    }
    setSubmitting(true);
    try {
      let maxNum = 0;
      stores.forEach((s) => {
        const match = (s.storeId || "").match(/^S(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      const storeId = `S${String(maxNum + 1).padStart(3, "0")}`;
      await api.post("/super-admin/stores", { storeId, ...newStore });
      fetchStores();
      setShowAddStoreModal(false);
      setNewStore(initialStoreForm);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to create store");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStore = async () => {
    if (!editingStore || !editingStore.name.trim()) {
      alert("Please enter a store name");
      return;
    }
    setSubmitting(true);
    try {
      const id = editingStore.id || editingStore.storeId;
      await api.put(`/super-admin/stores/${id}`, {
        name: editingStore.name,
        phone: editingStore.phone,
        address: editingStore.address,
        city: editingStore.city,
        image: editingStore.image || "",
        timings: editingStore.timings,
        status: editingStore.status,
        pickupEnabled: editingStore.pickupEnabled,
        deliveryEnabled: editingStore.deliveryEnabled,
      });
      fetchStores();
      setEditingStore(null);
    } catch (err) {
      alert("Failed to update store");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStore = async () => {
    if (!storeToDelete) return;
    setSubmitting(true);
    try {
      const id = storeToDelete.id || storeToDelete.storeId;
      await api.delete(`/super-admin/stores/${id}`);
      fetchStores();
      setStoreToDelete(null);
    } catch (err) {
      alert("Failed to delete store");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <SectionTitle title="Stores" sub="Manage all Teffes store branches in Ranchi" />
        <button onClick={() => setShowAddStoreModal(true)} className="btn btn-primary" style={{ fontSize: "0.875rem" }}>+ Add Store</button>
      </div>
      <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#73695b" }}>Loading stores from database…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#faf8f5", borderBottom: "1px solid #ede8e0" }}>
                {["Store ID", "Photo", "Name", "City", "Store Admin", "Today's Orders", "Phone", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "#423b32", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stores.map((s, i) => (
                <tr key={s.storeId || s.id} style={{ borderBottom: i < stores.length - 1 ? "1px solid #ede8e0" : "none" }}>
                  <td style={{ padding: "14px 16px", color: "#73695b", fontWeight: 600 }}>{s.storeId || s.id}</td>
                  <td style={{ padding: "14px 16px" }}>
                    {s.image ? (
                      <img
                        src={s.image}
                        alt={s.name}
                        style={{ width: "38px", height: "38px", borderRadius: "8px", objectFit: "cover", border: "1px solid #e2e8f0" }}
                      />
                    ) : (
                      <div style={{ width: "38px", height: "38px", borderRadius: "8px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>store</span>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#171410" }}>{s.name}</td>
                  <td style={{ padding: "14px 16px", color: "#423b32" }}>{s.city}</td>
                  <td style={{ padding: "14px 16px", color: "#423b32" }}>{s.admin || "—"}</td>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#941717" }}>{s.orders || 0}</td>
                  <td style={{ padding: "14px 16px", color: "#423b32" }}>{s.phone || "—"}</td>
                  <td style={{ padding: "14px 16px" }}><Badge label={s.status} color={s.status === "Active" ? "#059669" : "#d97706"} /></td>
                  <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                      <AdminEditButton
                        onClick={() => {
                          setEditingStore({
                            ...s,
                            name: s.name || "",
                            phone: s.phone || "",
                            address: s.address || "",
                            city: s.city || "Ranchi",
                            image: s.image || "",
                            timings: s.timings || "08:00 AM - 08:00 PM",
                            status: s.status || "Active",
                            pickupEnabled: s.pickupEnabled !== false,
                            deliveryEnabled: s.deliveryEnabled !== false,
                          });
                        }}
                        title="Edit Store"
                      />
                      <AdminDeleteButton
                        onClick={() => setStoreToDelete(s)}
                        title="Delete Store"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── ADD STORE MODAL ─── */}
      {showAddStoreModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "520px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#171410", display: "flex", alignItems: "center", gap: "8px" }}>
                <FontAwesomeIcon icon={faStore} style={{ color: "#941717" }} /> Add New Store Branch
              </h3>
              <button onClick={() => setShowAddStoreModal(false)} style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#73695b" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Store Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ranchi Kishore Ganj"
                  value={newStore.name}
                  onChange={e => setNewStore({ ...newStore, name: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>City</label>
                  <input
                    type="text"
                    placeholder="Ranchi"
                    value={newStore.city}
                    onChange={e => setNewStore({ ...newStore, city: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={newStore.phone}
                    onChange={e => setNewStore({ ...newStore, phone: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Full Address</label>
                <textarea
                  rows={2}
                  placeholder="Shop #, Street / Colony, Landmark"
                  value={newStore.address}
                  onChange={e => setNewStore({ ...newStore, address: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box", fontFamily: "inherit" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Operating Timings</label>
                  <input
                    type="text"
                    placeholder="08:00 AM - 08:00 PM"
                    value={newStore.timings}
                    onChange={e => setNewStore({ ...newStore, timings: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Status</label>
                  <select
                    value={newStore.status}
                    onChange={e => setNewStore({ ...newStore, status: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", background: "#fff", boxSizing: "border-box" }}
                  >
                    <option value="Active">Active</option>
                    <option value="Planned">Planned</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Store Photo / Image URL</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/... or direct image link"
                  value={newStore.image || ""}
                  onChange={e => setNewStore({ ...newStore, image: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                />
                {newStore.image && newStore.image.trim() !== "" && (
                  <div style={{ marginTop: "8px", width: "100%", height: "100px", borderRadius: "8px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                    <img src={newStore.image} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "20px", marginTop: "4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer", color: "#423b32" }}>
                  <input
                    type="checkbox"
                    checked={newStore.deliveryEnabled}
                    onChange={e => setNewStore({ ...newStore, deliveryEnabled: e.target.checked })}
                  />
                  <span>Delivery Enabled</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer", color: "#423b32" }}>
                  <input
                    type="checkbox"
                    checked={newStore.pickupEnabled}
                    onChange={e => setNewStore({ ...newStore, pickupEnabled: e.target.checked })}
                  />
                  <span>Store Pickup Enabled</span>
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setShowAddStoreModal(false)} disabled={submitting} style={{ padding: "8px 16px", borderRadius: "8px" }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddStore} disabled={submitting} style={{ padding: "8px 20px", borderRadius: "8px" }}>
                {submitting ? "Saving…" : "Add Store"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── EDIT STORE MODAL (PRE-FILLED WITH BACKEND DATA) ─── */}
      {editingStore && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "520px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#171410", display: "flex", alignItems: "center", gap: "8px" }}>
                  <FontAwesomeIcon icon={faPen} style={{ color: "#941717" }} /> Edit Store
                </h3>
                <span style={{ fontSize: "0.8rem", color: "#73695b" }}>Store ID: {editingStore.storeId || editingStore.id}</span>
              </div>
              <button onClick={() => setEditingStore(null)} style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#73695b" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Store Name *</label>
                <input
                  type="text"
                  value={editingStore.name}
                  onChange={e => setEditingStore({ ...editingStore, name: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>City</label>
                  <input
                    type="text"
                    value={editingStore.city || "Ranchi"}
                    onChange={e => setEditingStore({ ...editingStore, city: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Contact Phone</label>
                  <input
                    type="text"
                    value={editingStore.phone || ""}
                    onChange={e => setEditingStore({ ...editingStore, phone: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Full Address</label>
                <textarea
                  rows={2}
                  value={editingStore.address || ""}
                  onChange={e => setEditingStore({ ...editingStore, address: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box", fontFamily: "inherit" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Operating Timings</label>
                  <input
                    type="text"
                    value={editingStore.timings || "08:00 AM - 08:00 PM"}
                    onChange={e => setEditingStore({ ...editingStore, timings: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Status</label>
                  <select
                    value={editingStore.status || "Active"}
                    onChange={e => setEditingStore({ ...editingStore, status: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", background: "#fff", boxSizing: "border-box" }}
                  >
                    <option value="Active">Active</option>
                    <option value="Planned">Planned</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Store Photo / Image URL</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/... or direct image link"
                  value={editingStore.image || ""}
                  onChange={e => setEditingStore({ ...editingStore, image: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                />
                {editingStore.image && editingStore.image.trim() !== "" && (
                  <div style={{ marginTop: "8px", width: "100%", height: "100px", borderRadius: "8px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                    <img src={editingStore.image} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "20px", marginTop: "4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer", color: "#423b32" }}>
                  <input
                    type="checkbox"
                    checked={editingStore.deliveryEnabled !== false}
                    onChange={e => setEditingStore({ ...editingStore, deliveryEnabled: e.target.checked })}
                  />
                  <span>Delivery Enabled</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer", color: "#423b32" }}>
                  <input
                    type="checkbox"
                    checked={editingStore.pickupEnabled !== false}
                    onChange={e => setEditingStore({ ...editingStore, pickupEnabled: e.target.checked })}
                  />
                  <span>Store Pickup Enabled</span>
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setEditingStore(null)} disabled={submitting} style={{ padding: "8px 16px", borderRadius: "8px" }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpdateStore} disabled={submitting} style={{ padding: "8px 20px", borderRadius: "8px" }}>
                {submitting ? "Updating…" : "Update Store"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE STORE MODAL (REPLACES BROWSER CONFIRM) ─── */}
      {storeToDelete && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "420px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: "50%", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                <FontAwesomeIcon icon={faTriangleExclamation} />
              </div>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#171410" }}>Delete Store Entry?</h3>
            </div>
            <p style={{ color: "#73695b", fontSize: "0.9rem", lineHeight: 1.5, margin: "0 0 24px 0" }}>
              Are you sure you want to delete <strong>{storeToDelete.name}</strong> ({storeToDelete.storeId || storeToDelete.id})? This will remove this store branch and its configuration.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                className="btn"
                onClick={() => setStoreToDelete(null)}
                disabled={submitting}
                style={{ padding: "9px 18px", borderRadius: "8px", background: "#f5f3ef", border: "1px solid #ede8e0", fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteStore}
                disabled={submitting}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
              >
                {submitting ? "Deleting…" : "Delete Store"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StoreAdminsTab() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [adminsRes, storesRes] = await Promise.all([
        api.get<{ success: boolean; admins: any[] }>("/super-admin/store-admins"),
        api.get<{ success: boolean; stores: any[] }>("/super-admin/stores")
      ]);
      if (adminsRes.data.success) {
        setAdmins(adminsRes.data.admins || []);
      }
      if (storesRes.data.success) {
        setStores(storesRes.data.stores || []);
      }
    } catch (err) {
      console.warn("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: "", email: "", phone: "", storeId: "", password: "" });
  const [editingAdmin, setEditingAdmin] = useState<any | null>(null);
  const [adminToDelete, setAdminToDelete] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Available stores are those where admin is not assigned (or explicitly '—')
  const availableStores = stores.filter(s => !s.admin || s.admin === "—" || s.admin === "");

  const handleCreate = async () => {
    if (!newAdmin.name || !newAdmin.email || !newAdmin.storeId) {
      alert("Name, Email and Assigned Store are required.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/super-admin/store-admins", newAdmin);
      fetchData();
      setShowCreateModal(false);
      setNewAdmin({ name: "", email: "", phone: "", storeId: "", password: "" });
    } catch (err) {
      alert("Failed to create store admin");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingAdmin || !editingAdmin.name || !editingAdmin.email) {
      alert("Name and Email are required.");
      return;
    }
    setSubmitting(true);
    try {
      await api.put(`/super-admin/store-admins/${editingAdmin._id || editingAdmin.id}`, {
        name: editingAdmin.name,
        email: editingAdmin.email,
        phone: editingAdmin.phone,
        password: editingAdmin.password, // Optional
        isActive: editingAdmin.isActive,
      });
      fetchData();
      setEditingAdmin(null);
    } catch (err) {
      alert("Failed to update store admin");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!adminToDelete) return;
    setSubmitting(true);
    try {
      await api.delete(`/super-admin/store-admins/${adminToDelete._id || adminToDelete.id}`);
      fetchData();
      setAdminToDelete(null);
    } catch (err) {
      alert("Failed to delete store admin");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <SectionTitle title="Store Admins" sub="Manage who can access which store" />
        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary" style={{ fontSize: "0.875rem" }}>+ Create Admin</button>
      </div>
      <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#73695b" }}>Loading store admins…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#faf8f5", borderBottom: "1px solid #ede8e0" }}>
                {["Name", "Email", "Phone", "Assigned Store", "Role", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "#423b32", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {admins.map((a, i) => (
                <tr key={a._id || i} style={{ borderBottom: i < admins.length - 1 ? "1px solid #ede8e0" : "none" }}>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#171410" }}>{a.name}</td>
                  <td style={{ padding: "14px 16px", color: "#423b32" }}>{a.email}</td>
                  <td style={{ padding: "14px 16px", color: "#423b32" }}>{a.phone || "—"}</td>
                  <td style={{ padding: "14px 16px", color: "#423b32" }}>{a.storeName || a.storeId || "All Stores"}</td>
                  <td style={{ padding: "14px 16px", color: "#73695b" }}>Store Admin</td>
                  <td style={{ padding: "14px 16px" }}><Badge label={a.isActive ? "Active" : "Inactive"} color={a.isActive ? "#059669" : "#d97706"} /></td>
                  <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                      <AdminEditButton
                        onClick={() => setEditingAdmin({ ...a, password: "" })}
                        title="Edit Admin"
                      />
                      <AdminDeleteButton
                        onClick={() => setAdminToDelete(a)}
                        title="Delete Admin"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── CREATE ADMIN MODAL ─── */}
      {showCreateModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "420px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "1.25rem", fontWeight: 800, color: "#171410", display: "flex", alignItems: "center", gap: "8px" }}>
              <FontAwesomeIcon icon={faUserTie} style={{ color: "#941717" }} /> Create Store Admin
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Name *</label>
                <input type="text" placeholder="e.g. Rahul Sharma" value={newAdmin.name} onChange={e => setNewAdmin({ ...newAdmin, name: e.target.value })} style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc", width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Email *</label>
                <input type="email" placeholder="email@example.com" value={newAdmin.email} onChange={e => setNewAdmin({ ...newAdmin, email: e.target.value })} style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc", width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Phone</label>
                <input type="text" placeholder="+91 XXXXXXXXXX" value={newAdmin.phone} onChange={e => setNewAdmin({ ...newAdmin, phone: e.target.value })} style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc", width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Password</label>
                <input type="password" placeholder="Leave empty for 'Store@12345'" value={newAdmin.password} onChange={e => setNewAdmin({ ...newAdmin, password: e.target.value })} style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc", width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Assign to Store *</label>
                <select
                  value={newAdmin.storeId}
                  onChange={e => setNewAdmin({ ...newAdmin, storeId: e.target.value })}
                  style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc", width: "100%", boxSizing: "border-box", background: "#fff" }}
                >
                  <option value="">Select a store...</option>
                  {availableStores.map(s => (
                    <option key={s.storeId} value={s.storeId}>{s.name} ({s.storeId})</option>
                  ))}
                </select>
                {availableStores.length === 0 && (
                  <p style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "4px" }}>No stores available to assign. Please create a new store first.</p>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn" disabled={submitting} onClick={() => setShowCreateModal(false)} style={{ padding: "8px 16px", borderRadius: "8px" }}>Cancel</button>
              <button className="btn btn-primary" disabled={submitting} onClick={handleCreate} style={{ padding: "8px 20px", borderRadius: "8px" }}>{submitting ? "Creating..." : "Create Admin"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── EDIT ADMIN MODAL ─── */}
      {editingAdmin && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "420px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "1.25rem", fontWeight: 800, color: "#171410", display: "flex", alignItems: "center", gap: "8px" }}>
              <FontAwesomeIcon icon={faPen} style={{ color: "#941717" }} /> Edit Store Admin
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Name *</label>
                <input type="text" value={editingAdmin.name} onChange={e => setEditingAdmin({ ...editingAdmin, name: e.target.value })} style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc", width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Email *</label>
                <input type="email" value={editingAdmin.email} onChange={e => setEditingAdmin({ ...editingAdmin, email: e.target.value })} style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc", width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Phone</label>
                <input type="text" value={editingAdmin.phone} onChange={e => setEditingAdmin({ ...editingAdmin, phone: e.target.value })} style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc", width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>New Password</label>
                <input type="password" placeholder="Leave empty to keep current" value={editingAdmin.password} onChange={e => setEditingAdmin({ ...editingAdmin, password: e.target.value })} style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc", width: "100%", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginTop: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer", color: "#423b32" }}>
                  <input
                    type="checkbox"
                    checked={editingAdmin.isActive}
                    onChange={e => setEditingAdmin({ ...editingAdmin, isActive: e.target.checked })}
                  />
                  <span style={{ fontWeight: 600 }}>Active Account</span>
                </label>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn" disabled={submitting} onClick={() => setEditingAdmin(null)} style={{ padding: "8px 16px", borderRadius: "8px" }}>Cancel</button>
              <button className="btn btn-primary" disabled={submitting} onClick={handleUpdate} style={{ padding: "8px 20px", borderRadius: "8px" }}>{submitting ? "Updating..." : "Update Admin"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE ADMIN MODAL ─── */}
      {adminToDelete && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "420px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: "50%", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                <FontAwesomeIcon icon={faTriangleExclamation} />
              </div>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#171410" }}>Remove Store Admin?</h3>
            </div>
            <p style={{ color: "#73695b", fontSize: "0.9rem", lineHeight: 1.5, margin: "0 0 24px 0" }}>
              Are you sure you want to remove <strong>{adminToDelete.name}</strong>? This user will lose access to the <strong>{adminToDelete.storeName}</strong> portal, and the store will be left unassigned until a new admin is appointed.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                className="btn"
                disabled={submitting}
                onClick={() => setAdminToDelete(null)}
                style={{ padding: "9px 18px", borderRadius: "8px", background: "#f5f3ef", border: "1px solid #ede8e0", fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={handleDelete}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
              >
                {submitting ? "Removing…" : "Remove Admin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductMediaManager({
  images,
  onImagesChange,
  videoURLs,
  onVideoURLsChange,
  pendingImageUrl = "",
  onPendingImageUrlChange,
  pendingVideoUrl = "",
  onPendingVideoUrlChange,
}: {
  images: string[];
  onImagesChange: (imgs: string[]) => void;
  videoURLs: string[];
  onVideoURLsChange: (vids: string[]) => void;
  pendingImageUrl?: string;
  onPendingImageUrlChange?: (val: string) => void;
  pendingVideoUrl?: string;
  onPendingVideoUrlChange?: (val: string) => void;
}) {
  const [localImageUrl, setLocalImageUrl] = useState("");
  const [localVideoUrl, setLocalVideoUrl] = useState("");
  const [imageInputError, setImageInputError] = useState("");
  const [videoInputError, setVideoInputError] = useState("");

  const currentImageUrl = onPendingImageUrlChange ? pendingImageUrl : localImageUrl;
  const setImageUrl = (val: string) => {
    if (onPendingImageUrlChange) onPendingImageUrlChange(val);
    else setLocalImageUrl(val);
  };

  const currentVideoUrl = onPendingVideoUrlChange ? pendingVideoUrl : localVideoUrl;
  const setVideoUrl = (val: string) => {
    if (onPendingVideoUrlChange) onPendingVideoUrlChange(val);
    else setLocalVideoUrl(val);
  };

  const handleAddImage = () => {
    const trimmed = currentImageUrl.trim();
    if (!trimmed) {
      setImageInputError("Please paste an image URL first");
      return;
    }
    setImageInputError("");
    onImagesChange([...images, trimmed]);
    setImageUrl("");
  };

  const handleRemoveImage = (indexToRemove: number) => {
    onImagesChange(images.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSetAsCover = (indexToCover: number) => {
    if (indexToCover <= 0 || indexToCover >= images.length) return;
    const target = images[indexToCover];
    const remaining = images.filter((_, idx) => idx !== indexToCover);
    onImagesChange([target, ...remaining]);
  };

  const handleAddVideo = () => {
    const trimmed = currentVideoUrl.trim();
    console.log('[ProductMediaManager] handleAddVideo called, URL:', trimmed);
    if (!trimmed) {
      setVideoInputError("Please paste a YouTube or direct video URL first");
      return;
    }
    setVideoInputError("");
    const newList = [...videoURLs, trimmed];
    console.log('[ProductMediaManager] calling onVideoURLsChange with:', newList);
    onVideoURLsChange(newList);
    setVideoUrl("");
  };

  const handleRemoveVideo = (indexToRemove: number) => {
    onVideoURLsChange(videoURLs.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* ─── Product Images Section ─── */}
      <div style={{ background: "#fdfbf9", border: "1.5px solid #ece7df", borderRadius: "12px", padding: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#2d241e", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>Product Photos</span>
              <span style={{ fontSize: "0.72rem", background: "#fef2f2", color: "#941717", padding: "2px 8px", borderRadius: "12px", border: "1px solid #fecaca", fontWeight: 700 }}>
                {images.length} {images.length === 1 ? "Photo" : "Photos"}
              </span>
            </div>
            <div style={{ fontSize: "0.72rem", color: "#786f66", marginTop: "2px" }}>
              Cover photo is marked with ★ Cover. First photo is always the storefront cover.
            </div>
          </div>
        </div>

        {/* Thumbnail Grid - Visual preview cards with Cover badge and remove action */}
        {images.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
            {images.map((imgUrl, idx) => {
              const isCover = idx === 0;
              return (
                <div
                  key={`media-img-${idx}`}
                  style={{
                    position: "relative",
                    width: "82px",
                    height: "82px",
                    borderRadius: "10px",
                    border: isCover ? "2px solid #941717" : "1.5px solid #e2dcd4",
                    overflow: "hidden",
                    background: "#1c1815",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={imgUrl}
                    alt={isCover ? "Cover" : `Gallery photo ${idx + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.opacity = "0.3";
                    }}
                  />

                  {/* Cover Badge */}
                  {isCover && (
                    <div
                      style={{
                        position: "absolute",
                        top: "4px",
                        left: "4px",
                        background: "#941717",
                        color: "#fff",
                        fontSize: "9px",
                        fontWeight: 800,
                        padding: "1px 5px",
                        borderRadius: "4px",
                        letterSpacing: "0.03em",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                      }}
                    >
                      ★ Cover
                    </div>
                  )}

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    title="Remove this photo"
                    style={{
                      position: "absolute",
                      top: "4px",
                      right: "4px",
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: "rgba(220, 38, 38, 0.9)",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      fontWeight: 800,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                      transition: "transform 150ms ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.15)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    ✕
                  </button>

                  {/* Make Cover Button for non-cover photos */}
                  {!isCover && (
                    <button
                      type="button"
                      onClick={() => handleSetAsCover(idx)}
                      title="Set as Cover Photo"
                      style={{
                        position: "absolute",
                        bottom: "0",
                        left: "0",
                        right: "0",
                        background: "rgba(0, 0, 0, 0.68)",
                        color: "#fff",
                        border: "none",
                        fontSize: "8.5px",
                        fontWeight: 700,
                        padding: "2px 0",
                        cursor: "pointer",
                        textAlign: "center",
                        backdropFilter: "blur(2px)",
                      }}
                    >
                      Make Cover
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: "14px",
              background: "#fff",
              border: "1px dashed #d1cbbf",
              borderRadius: "8px",
              textAlign: "center",
              color: "#8c8275",
              fontSize: "0.8rem",
              marginBottom: "10px",
            }}
          >
            No photos added yet. Paste an image URL below to add the cover photo.
          </div>
        )}

        {/* Clean Add Photo Input Row */}
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            placeholder="Paste image URL (e.g. https://...)"
            value={currentImageUrl}
            onChange={(e) => {
              setImageUrl(e.target.value);
              if (imageInputError) setImageInputError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddImage();
              }
            }}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "8px",
              border: imageInputError ? "1.5px solid #dc2626" : "1px solid #d1cbbf",
              fontSize: "0.84rem",
              background: "#fff",
              boxSizing: "border-box",
            }}
          />
          <button
            type="button"
            onClick={handleAddImage}
            style={{
              background: "#941717",
              color: "#fff",
              border: "none",
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            + Add Photo
          </button>
        </div>
        {imageInputError && (
          <div style={{ color: "#dc2626", fontSize: "0.74rem", marginTop: "4px", fontWeight: 600 }}>
            {imageInputError}
          </div>
        )}
      </div>

      {/* ─── Product Videos Section ─── */}
      <div style={{ background: "#fcfdfe", border: "1.5px solid #e0e7ee", borderRadius: "12px", padding: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>Product Videos</span>
              <span style={{ fontSize: "0.72rem", background: "#f0fdf4", color: "#166534", padding: "2px 8px", borderRadius: "12px", border: "1px solid #bbf7d0", fontWeight: 700 }}>
                {videoURLs.length} {videoURLs.length === 1 ? "Video" : "Videos"}
              </span>
            </div>
            <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>
              Supports YouTube links or direct MP4/WebM URLs. Videos will appear after all photos in gallery.
            </div>
          </div>
        </div>

        {/* Clean Videos List */}
        {videoURLs.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
            {videoURLs.map((vUrl, vIdx) => {
              const isYT = isYouTubeUrl(vUrl);
              const ytThumb = isYT ? getYouTubeThumbnailUrl(vUrl) : null;
              return (
                <div
                  key={`media-vid-${vIdx}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    gap: "10px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
                    {isYT ? (
                      <span
                        style={{
                          background: "#fef2f2",
                          color: "#dc2626",
                          border: "1px solid #fecaca",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        ▶ YouTube
                      </span>
                    ) : (
                      <span
                        style={{
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          border: "1px solid #bfdbfe",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        🎬 Direct Video
                      </span>
                    )}

                    {ytThumb ? (
                      <img
                        src={ytThumb}
                        alt="Video thumbnail"
                        style={{ width: "42px", height: "26px", objectFit: "cover", borderRadius: "4px", border: "1px solid #e2e8f0", flexShrink: 0 }}
                      />
                    ) : (
                      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#64748b" }}>
                        videocam
                      </span>
                    )}

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <a
                        href={vUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: "0.78rem",
                          color: "#2563eb",
                          textDecoration: "none",
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={vUrl}
                      >
                        {vUrl} ↗
                      </a>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveVideo(vIdx)}
                    title="Remove video"
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "6px",
                      background: "#fee2e2",
                      color: "#dc2626",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: "14px",
              background: "#fff",
              border: "1px dashed #cbd5e1",
              borderRadius: "8px",
              textAlign: "center",
              color: "#94a3b8",
              fontSize: "0.78rem",
              marginBottom: "10px",
            }}
          >
            No videos attached yet. Paste a YouTube link or direct video URL below.
          </div>
        )}

        {/* Clean Add Video Input Row */}
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            data-testid="video-url-input"
            placeholder="Paste YouTube or direct MP4/WebM URL..."
            value={currentVideoUrl}
            onChange={(e) => {
              setVideoUrl(e.target.value);
              if (videoInputError) setVideoInputError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddVideo();
              }
            }}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "8px",
              border: videoInputError ? "1.5px solid #dc2626" : "1px solid #cbd5e1",
              fontSize: "0.84rem",
              background: "#fff",
              boxSizing: "border-box",
            }}
          />
          <button
            type="button"
            onClick={handleAddVideo}
            style={{
              background: "#1e293b",
              color: "#fff",
              border: "none",
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            + Add Video
          </button>
        </div>
        {videoInputError && (
          <div style={{ color: "#dc2626", fontSize: "0.74rem", marginTop: "4px", fontWeight: 600 }}>
            {videoInputError}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductsTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "chicken",
    price: "",
    originalPrice: "",
    netWeight: "500g",
    grossWeight: "",
    pieces: "",
    serves: "",
    description: "",
    badge: "",
    image: "",
    images: [] as string[],
    videoURLs: [] as string[],
    pendingImageUrl: "",
    pendingVideoUrl: "",
    inStock: true,
  });

  // Edit product state
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editProductForm, setEditProductForm] = useState({
    name: "",
    category: "chicken",
    price: "",
    originalPrice: "",
    netWeight: "500g",
    grossWeight: "",
    pieces: "",
    serves: "",
    description: "",
    badge: "",
    image: "",
    images: [] as string[],
    videoURLs: [] as string[],
    pendingImageUrl: "",
    pendingVideoUrl: "",
    inStock: true,
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchProds = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setLoading(true);
    try {
      const res = await api.get<{ success: boolean; products: any[] }>(
        `/products?limit=100&all=true&_t=${Date.now()}`
      );
      if (res.data?.success && Array.isArray(res.data.products)) {
        setProducts(res.data.products);
      }
    } catch (err) {
      console.warn("Failed to fetch products:", err);
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProds(true);
    api.get<{ success: boolean; categories: any[] }>("/categories")
      .then(res => {
        if (res.data.success && res.data.categories) {
          const valid = res.data.categories.filter((c: any) => c.slug !== "all");
          setCategories(valid);
          if (valid.length > 0 && !newProduct.category) {
            setNewProduct(prev => ({ ...prev, category: valid[0].slug }));
          }
        }
      })
      .catch(err => console.warn("Failed to fetch categories:", err));
  }, []);

  const toggleStock = async (id: string, current: boolean) => {
    setTogglingId(id);
    try {
      await api.put(`/products/${id}`, { inStock: !current });
      setProducts(prev => prev.map(item => ((item.id || item._id) === id ? { ...item, inStock: !current } : item)));
      fetchProds(false);
    } catch (err) {
      alert("Failed to toggle status");
    } finally {
      setTogglingId(null);
    }
  };

  const populateEditForm = (p: any) => {
    const rawImages: string[] = Array.isArray(p.images) && p.images.length > 0 
      ? p.images.map((s: any) => String(s).trim()).filter(Boolean)
      : (p.image ? [p.image.trim()] : []);
    const primaryImg = rawImages[0] || p.image || "";
    const additionalImgs = rawImages.slice(1);
    const rawVideos: string[] = Array.isArray(p.videoURLs) 
      ? p.videoURLs.map((s: any) => String(s).trim()).filter(Boolean) 
      : (typeof p.videoURLs === "string" && p.videoURLs ? [p.videoURLs.trim()] : []);

    setEditingProduct(p);
    setEditProductForm({
      name: p.name || "",
      category: p.category || (categories[0]?.slug || "chicken"),
      price: p.price !== undefined ? String(p.price) : "",
      originalPrice: p.originalPrice !== undefined ? String(p.originalPrice) : "",
      netWeight: p.netWeight || "500g",
      grossWeight: p.grossWeight || "",
      pieces: p.pieces || "",
      serves: p.serves || "",
      description: p.description || "",
      badge: p.badge || "",
      image: primaryImg,
      images: additionalImgs,
      videoURLs: rawVideos,
      pendingImageUrl: "",
      pendingVideoUrl: "",
      inStock: Boolean(p.inStock),
    });
  };

  const handleStartEdit = (p: any) => {
    // Open the edit modal immediately with the current row data
    populateEditForm(p);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editProductForm.name.trim()) {
      toast.error("Please enter a product name", "Validation Error");
      return;
    }
    if (!editProductForm.price || isNaN(Number(editProductForm.price))) {
      toast.error("Please enter a valid price", "Validation Error");
      return;
    }

    // Auto-commit any pending image URL typed in the input box
    const pendingImg = editProductForm.pendingImageUrl?.trim();
    const rawImgs = [editProductForm.image, ...editProductForm.images, ...(pendingImg ? [pendingImg] : [])];
    const uniqueImages = Array.from(new Set(rawImgs.map(s => s.trim()).filter(Boolean)));

    if (uniqueImages.length === 0) {
      toast.error("Please add at least one product photo", "Validation Error");
      return;
    }

    // Auto-commit any pending video URL typed in the input box
    const pendingVid = editProductForm.pendingVideoUrl?.trim();
    // Also read directly from DOM input as a last-resort fallback
    const domVidInput = (typeof document !== 'undefined' ? document.querySelector('[data-testid="video-url-input"]') as HTMLInputElement | null : null);
    const domVidVal = domVidInput?.value?.trim() || '';
    const rawVids = [...editProductForm.videoURLs, ...(pendingVid ? [pendingVid] : []), ...(domVidVal && domVidVal !== pendingVid ? [domVidVal] : [])];
    const cleanVideos = Array.from(new Set(rawVids.map(s => s.trim()).filter(Boolean)));
    console.log('[handleSaveEdit] editProductForm.videoURLs:', editProductForm.videoURLs);
    console.log('[handleSaveEdit] pendingVideoUrl:', pendingVid);
    console.log('[handleSaveEdit] DOM input value:', domVidVal);
    console.log('[handleSaveEdit] cleanVideos to be saved:', cleanVideos);

    setSubmittingEdit(true);
    try {
      const selectedCatObj = categories.find(c => c.slug === editProductForm.category);
      const targetId = editingProduct.id || editingProduct._id;

      const res = await api.put(`/products/${targetId}`, {
        name: editProductForm.name.trim(),
        category: editProductForm.category,
        categoryLabel: selectedCatObj ? selectedCatObj.name : editProductForm.category,
        price: Number(editProductForm.price),
        originalPrice: editProductForm.originalPrice ? Number(editProductForm.originalPrice) : Number(editProductForm.price),
        netWeight: editProductForm.netWeight.trim() || "500g",
        grossWeight: editProductForm.grossWeight.trim(),
        pieces: editProductForm.pieces.trim(),
        serves: editProductForm.serves.trim(),
        description: editProductForm.description.trim(),
        badge: editProductForm.badge.trim(),
        image: uniqueImages[0],
        images: uniqueImages,
        videoURLs: cleanVideos,
        inStock: editProductForm.inStock,
      });

      if (res.data?.success) {
        toast.success(`Product "${editProductForm.name}" updated successfully!`, "Product Saved");
        const updated = res.data.product || {
          ...editingProduct,
          name: editProductForm.name.trim(),
          price: Number(editProductForm.price),
          image: uniqueImages[0],
          images: uniqueImages,
          videoURLs: cleanVideos,
          inStock: editProductForm.inStock,
        };
        // Update product in table state immediately
        setProducts(prev => prev.map(item => {
          const itemId = item.id || item._id;
          const uId = updated.id || updated._id;
          return (itemId && uId && itemId === uId) || (item.id && updated.id && item.id === updated.id) || (item._id && updated._id && item._id === updated._id)
            ? { ...item, ...updated }
            : item;
        }));
      }
      setEditingProduct(null);
      // Background re-fetch with cache-buster, without unmounting the table
      await fetchProds(false);
    } catch (err: any) {
      console.error("Failed to update product:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to update product", "Update Failed");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name.trim()) {
      toast.error("Please enter a product name", "Validation Error");
      return;
    }
    if (!newProduct.price || isNaN(Number(newProduct.price))) {
      toast.error("Please enter a valid price", "Validation Error");
      return;
    }

    // Auto-commit any pending image URL typed in the input box
    const pendingImg = newProduct.pendingImageUrl?.trim();
    const rawImgs = [newProduct.image, ...newProduct.images, ...(pendingImg ? [pendingImg] : [])];
    const uniqueImages = Array.from(new Set(rawImgs.map(s => s.trim()).filter(Boolean)));

    if (uniqueImages.length === 0) {
      toast.error("Please add at least one product photo", "Validation Error");
      return;
    }

    // Auto-commit any pending video URL typed in the input box
    const pendingVid = newProduct.pendingVideoUrl?.trim();
    // Also read directly from DOM input as a last-resort fallback
    const domVidInput = (typeof document !== 'undefined' ? document.querySelector('[data-testid="video-url-input"]') as HTMLInputElement | null : null);
    const domVidVal = domVidInput?.value?.trim() || '';
    const rawVids = [...newProduct.videoURLs, ...(pendingVid ? [pendingVid] : []), ...(domVidVal && domVidVal !== pendingVid ? [domVidVal] : [])];
    const cleanVideos = Array.from(new Set(rawVids.map(s => s.trim()).filter(Boolean)));
    console.log('[handleAddProduct] newProduct.videoURLs:', newProduct.videoURLs);
    console.log('[handleAddProduct] pendingVideoUrl:', pendingVid);
    console.log('[handleAddProduct] DOM input value:', domVidVal);
    console.log('[handleAddProduct] cleanVideos to be saved:', cleanVideos);


    setSubmitting(true);
    try {
      const selectedCatObj = categories.find(c => c.slug === newProduct.category);

      const res = await api.post("/products", {
        name: newProduct.name.trim(),
        category: newProduct.category,
        categoryLabel: selectedCatObj ? selectedCatObj.name : newProduct.category,
        price: Number(newProduct.price),
        originalPrice: newProduct.originalPrice ? Number(newProduct.originalPrice) : Number(newProduct.price),
        netWeight: newProduct.netWeight.trim() || "500g",
        grossWeight: newProduct.grossWeight.trim(),
        pieces: newProduct.pieces.trim(),
        serves: newProduct.serves.trim(),
        description: newProduct.description.trim(),
        badge: newProduct.badge.trim(),
        image: uniqueImages[0],
        images: uniqueImages,
        videoURLs: cleanVideos,
        inStock: newProduct.inStock,
      });

      if (res.data?.success) {
        toast.success(`Product "${newProduct.name}" created successfully!`, "Product Created");
      }

      await fetchProds(false);
      setShowAddModal(false);
      setNewProduct({
        name: "",
        category: categories[0]?.slug || "chicken",
        price: "",
        originalPrice: "",
        netWeight: "500g",
        grossWeight: "",
        pieces: "",
        serves: "",
        description: "",
        badge: "",
        image: "",
        images: [],
        videoURLs: [],
        pendingImageUrl: "",
        pendingVideoUrl: "",
        inStock: true,
      });
    } catch (err: any) {
      console.error("Failed to add product:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to add product", "Add Product Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (p: any) => {
    const pId = p.id || p._id;
    toast.confirm({
      title: "Delete Product?",
      message: `Are you sure you want to delete product "${p.name}"? This action cannot be undone.`,
      confirmText: "Delete Product",
      type: "danger",
      onConfirm: async () => {
        try {
          await api.delete(`/products/${pId}`);
          toast.success(`Product "${p.name}" deleted successfully`, "Product Deleted");
          setProducts(prev => prev.filter(item => (item.id || item._id) !== pId));
          fetchProds(false);
        } catch (err: any) {
          toast.error(err.response?.data?.message || "Failed to delete product", "Delete Error");
        }
      },
    });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <SectionTitle title="Products" sub="Master catalog across all Teffes stores" />
        <button
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "10px",
            fontWeight: 700,
            cursor: "pointer",
            backgroundColor: "#941717",
            color: "#fff",
            border: "none",
          }}
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add New Product
        </button>
      </div>

      {/* Responsive styles for table actions and layout */}
      <style>{`
        @media (max-width: 1260px) {
          .product-action-group {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 6px !important;
            min-width: 95px !important;
          }
          .product-action-group .stock-btn {
            width: 100% !important;
          }
          .product-action-icons {
            display: flex !important;
            justify-content: center !important;
            gap: 8px !important;
          }
        }
      `}</style>

      <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%", boxShadow: "0 1px 4px rgba(0,0,0,0.02)" }}>
        {loading ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#73695b" }}>Loading products catalog…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", minWidth: "720px" }}>
            <thead>
              <tr style={{ background: "#faf8f5", borderBottom: "1px solid #ede8e0" }}>
                {["Product", "Category", "Net Weight", "Price", "Badge", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "#423b32", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.id || i} style={{ borderBottom: i < products.length - 1 ? "1px solid #ede8e0" : "none" }}>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#171410" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {p.image && (
                        <img
                          src={p.image}
                          alt={p.name}
                          style={{ width: "36px", height: "36px", borderRadius: "6px", objectFit: "cover" }}
                          onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                        />
                      )}
                      <span>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", color: "#423b32" }}>{p.categoryLabel || p.category}</td>
                  <td style={{ padding: "14px 16px", color: "#73695b" }}>{p.netWeight}</td>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#941717" }}>
                    ₹{p.price}
                    {p.originalPrice > p.price && (
                      <span style={{ fontSize: "0.75rem", textDecoration: "line-through", color: "#a89f91", marginLeft: "5px" }}>₹{p.originalPrice}</span>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px" }}>{p.badge ? <Badge label={p.badge} color="#d97706" /> : "—"}</td>
                  <td style={{ padding: "14px 16px" }}><Badge label={p.inStock ? "In Stock" : "Out of Stock"} color={p.inStock ? "#059669" : "#d97706"} /></td>
                  <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                    <div className="product-action-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {/* Consistent Toggle Stock Button with Fixed Width */}
                      <button
                        className="stock-btn"
                        onClick={() => toggleStock(p.id || p._id, p.inStock)}
                        disabled={togglingId === (p.id || p._id)}
                        style={{
                          border: "1px solid #d1cbbf",
                          borderRadius: "8px",
                          padding: "6px 10px",
                          fontSize: "0.775rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          background: p.inStock ? "#f5f2eb" : "#fef3c7",
                          color: p.inStock ? "#423b32" : "#92400e",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "95px",
                          height: "32px",
                          boxSizing: "border-box",
                        }}
                        title={p.inStock ? "Currently In Stock. Click to set Out of Stock" : "Currently Out of Stock. Click to set In Stock"}
                      >
                        {togglingId === (p.id || p._id) ? "Updating…" : "Toggle Stock"}
                      </button>

                      <div className="product-action-icons" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                        <AdminEditButton
                          onClick={() => handleStartEdit(p)}
                          title="Edit Product"
                        />
                        <AdminDeleteButton
                          onClick={() => handleDeleteProduct(p)}
                          title="Delete Product"
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── ADD PRODUCT MODAL ─── */}
      {showAddModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#171410" }}>Add New Product</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#73695b" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddProduct} noValidate style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fresh Chicken Curry Cut, Rohu Fish Steaks"
                  value={newProduct.name}
                  onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Category *</label>
                  <select
                    value={newProduct.category}
                    onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", background: "#fff", boxSizing: "border-box" }}
                  >
                    {categories.length > 0 ? (
                      categories.map(c => (
                        <option key={c.slug} value={c.slug}>{c.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="chicken">Fresh Chicken</option>
                        <option value="mutton">Rich Mutton</option>
                        <option value="fish">Fish &amp; Seafood</option>
                        <option value="eggs">Farm Eggs</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Badge (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Bestseller, Special Cut"
                    value={newProduct.badge}
                    onChange={e => setNewProduct({ ...newProduct, badge: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Selling Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 240"
                    value={newProduct.price}
                    onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Original / MRP (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 270"
                    value={newProduct.originalPrice}
                    onChange={e => setNewProduct({ ...newProduct, originalPrice: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Net Weight *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 500g, 1kg, 6 Pieces"
                    value={newProduct.netWeight}
                    onChange={e => setNewProduct({ ...newProduct, netWeight: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Gross Weight</label>
                  <input
                    type="text"
                    placeholder="e.g. 550g"
                    value={newProduct.grossWeight}
                    onChange={e => setNewProduct({ ...newProduct, grossWeight: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Product Media: Photos and Videos */}
              <ProductMediaManager
                images={[newProduct.image, ...newProduct.images].filter(Boolean)}
                onImagesChange={(imgs) => {
                  setNewProduct(prev => ({
                    ...prev,
                    image: imgs[0] || "",
                    images: imgs.slice(1),
                    pendingImageUrl: "",
                  }));
                }}
                videoURLs={newProduct.videoURLs}
                onVideoURLsChange={(vids) => {
                  setNewProduct(prev => ({
                    ...prev,
                    videoURLs: vids,
                    pendingVideoUrl: "",
                  }));
                }}
                pendingImageUrl={newProduct.pendingImageUrl}
                onPendingImageUrlChange={(val) => {
                  setNewProduct(prev => ({ ...prev, pendingImageUrl: val }));
                }}
                pendingVideoUrl={newProduct.pendingVideoUrl}
                onPendingVideoUrlChange={(val) => {
                  setNewProduct(prev => ({ ...prev, pendingVideoUrl: val }));
                }}
              />

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of cut and freshness..."
                  value={newProduct.description}
                  onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box", resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                <input
                  type="checkbox"
                  id="prodInStock"
                  checked={newProduct.inStock}
                  onChange={e => setNewProduct({ ...newProduct, inStock: e.target.checked })}
                  style={{ width: "16px", height: "16px", accentColor: "#941717", cursor: "pointer" }}
                />
                <label htmlFor="prodInStock" style={{ fontSize: "0.85rem", fontWeight: 600, color: "#423b32", cursor: "pointer" }}>
                  Available in stock immediately
                </label>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "14px" }}>
                <button type="button" className="btn" disabled={submitting} onClick={() => setShowAddModal(false)} style={{ padding: "9px 18px", borderRadius: "8px" }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ padding: "9px 24px", borderRadius: "8px" }}>
                  {submitting ? "Adding…" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT PRODUCT MODAL ─── */}
      {editingProduct && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#171410" }}>Edit Product</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "#73695b" }}>Update price, name, category, or stock details</p>
              </div>
              <button onClick={() => setEditingProduct(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#73695b" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} noValidate style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Product Name *</label>
                <input
                  type="text"
                  required
                  value={editProductForm.name}
                  onChange={e => setEditProductForm({ ...editProductForm, name: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Category *</label>
                  <select
                    value={editProductForm.category}
                    onChange={e => setEditProductForm({ ...editProductForm, category: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", background: "#fff", boxSizing: "border-box" }}
                  >
                    {categories.length > 0 ? (
                      categories.map(c => (
                        <option key={c.slug} value={c.slug}>{c.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="chicken">Fresh Chicken</option>
                        <option value="mutton">Rich Mutton</option>
                        <option value="fish">Fish &amp; Seafood</option>
                        <option value="eggs">Farm Eggs</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Badge</label>
                  <input
                    type="text"
                    placeholder="e.g. Bestseller, Special Cut"
                    value={editProductForm.badge}
                    onChange={e => setEditProductForm({ ...editProductForm, badge: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Selling Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 240"
                    value={editProductForm.price}
                    onChange={e => setEditProductForm({ ...editProductForm, price: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Original / MRP (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 270"
                    value={editProductForm.originalPrice}
                    onChange={e => setEditProductForm({ ...editProductForm, originalPrice: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Net Weight *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 500g, 1kg, 6 Pieces"
                    value={editProductForm.netWeight}
                    onChange={e => setEditProductForm({ ...editProductForm, netWeight: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Gross Weight</label>
                  <input
                    type="text"
                    placeholder="e.g. 550g"
                    value={editProductForm.grossWeight}
                    onChange={e => setEditProductForm({ ...editProductForm, grossWeight: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Product Media: Photos and Videos */}
              <ProductMediaManager
                images={[editProductForm.image, ...editProductForm.images].filter(Boolean)}
                onImagesChange={(imgs) => {
                  setEditProductForm(prev => ({
                    ...prev,
                    image: imgs[0] || "",
                    images: imgs.slice(1),
                    pendingImageUrl: "",
                  }));
                }}
                videoURLs={editProductForm.videoURLs}
                onVideoURLsChange={(vids) => {
                  setEditProductForm(prev => ({
                    ...prev,
                    videoURLs: vids,
                    pendingVideoUrl: "",
                  }));
                }}
                pendingImageUrl={editProductForm.pendingImageUrl}
                onPendingImageUrlChange={(val) => {
                  setEditProductForm(prev => ({ ...prev, pendingImageUrl: val }));
                }}
                pendingVideoUrl={editProductForm.pendingVideoUrl}
                onPendingVideoUrlChange={(val) => {
                  setEditProductForm(prev => ({ ...prev, pendingVideoUrl: val }));
                }}
              />

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of cut and freshness..."
                  value={editProductForm.description}
                  onChange={e => setEditProductForm({ ...editProductForm, description: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box", resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                <input
                  type="checkbox"
                  id="editProdInStock"
                  checked={editProductForm.inStock}
                  onChange={e => setEditProductForm({ ...editProductForm, inStock: e.target.checked })}
                  style={{ width: "16px", height: "16px", accentColor: "#941717", cursor: "pointer" }}
                />
                <label htmlFor="editProdInStock" style={{ fontSize: "0.85rem", fontWeight: 600, color: "#423b32", cursor: "pointer" }}>
                  Available in stock
                </label>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "14px" }}>
                <button type="button" className="btn" disabled={submittingEdit} onClick={() => setEditingProduct(null)} style={{ padding: "9px 18px", borderRadius: "8px" }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submittingEdit} style={{ padding: "9px 24px", borderRadius: "8px" }}>
                  {submittingEdit ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoriesTab() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newCat, setNewCat] = useState({
    name: "",
    slug: "",
    tagline: "",
    icon: "",
    image: "",
    order: 1,
    isActive: true,
  });

  const fetchCategories = () => {
    setLoading(true);
    api.get<{ success: boolean; categories: any[] }>("/categories")
      .then(res => {
        if (res.data.success) {
          setCategories(res.data.categories || []);
        }
      })
      .catch(err => console.warn("Failed to fetch categories:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.name.trim()) {
      alert("Please enter a category name");
      return;
    }
    setSubmitting(true);
    try {
      const slug = newCat.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const maxOrder = categories.reduce((max, c) => Math.max(max, Number(c.order) || 0), 0);
      await api.post("/super-admin/categories", {
        name: newCat.name.trim(),
        slug,
        tagline: newCat.tagline,
        image: newCat.image,
        order: Number(newCat.order) || (maxOrder + 1),
        isActive: newCat.isActive,
      });
      fetchCategories();
      setShowAddModal(false);
      setNewCat({
        name: "",
        slug: "",
        tagline: "",
        icon: "",
        image: "",
        order: maxOrder + 2,
        isActive: true,
      });
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to create category");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name.trim()) {
      alert("Please enter category name");
      return;
    }
    setSubmitting(true);
    const targetId = editingCategory.slug || editingCategory._id || editingCategory.id;
    try {
      await api.put(`/super-admin/categories/${targetId}`, {
        name: editingCategory.name,
        tagline: editingCategory.tagline,
        image: editingCategory.image,
        order: Number(editingCategory.order) || 0,
        isActive: editingCategory.isActive,
      });
      fetchCategories();
      setEditingCategory(null);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update category");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (cat: any) => {
    toast.confirm({
      title: "Delete Category?",
      message: `Are you sure you want to delete category "${cat.name}"? It will be removed from both the customer website and mobile app.`,
      confirmText: "Delete Category",
      type: "danger",
      onConfirm: async () => {
        const targetId = cat.slug || cat._id || cat.id;
        try {
          await api.delete(`/super-admin/categories/${targetId}`);
          toast.success(`Category "${cat.name}" deleted successfully`, "Category Deleted");
          fetchCategories();
        } catch (err: any) {
          toast.error(err.response?.data?.message || "Failed to delete category", "Delete Error");
        }
      },
    });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <SectionTitle title="Categories Management" sub="Manage butchery categories that reflect live across website and mobile app" />
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setNewCat({
              name: "",
              slug: "",
              tagline: "",
              icon: "",
              image: "",
              order: categories.reduce((max, c) => Math.max(max, Number(c.order) || 0), 0) + 1,
              isActive: true,
            });
            setShowAddModal(true);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "10px",
            fontWeight: 700,
            cursor: "pointer",
            backgroundColor: "#941717",
            color: "#fff",
            border: "none",
          }}
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add New Category
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#73695b" }}>Loading categories…</div>
      ) : categories.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: "14px", border: "1px solid #ede8e0" }}>
          <span className="material-symbols-outlined text-[48px]" style={{ color: "#a89f91", marginBottom: "12px" }}>category</span>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#171410" }}>No Categories Configured</h3>
          <p style={{ color: "#73695b", fontSize: "0.85rem", marginTop: "4px" }}>Add your first butchery category to populate products.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "18px" }}>
          {categories.map((c: any) => (
            <div
              key={c.slug}
              style={{
                background: "#fff",
                border: "1px solid #ede8e0",
                borderRadius: "14px",
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              {/* Category Image Header / Banner */}
              <div style={{ height: "130px", width: "100%", background: "#1c1815", position: "relative", overflow: "hidden" }}>
                {c.image ? (
                  <img
                    src={c.image}
                    alt={c.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#73695b" }}>
                    <span className="material-symbols-outlined text-[42px]">image</span>
                  </div>
                )}
                <div style={{ position: "absolute", top: "10px", right: "10px", display: "flex", gap: "6px" }}>
                  <span style={{ background: "rgba(0,0,0,0.75)", color: "#fff", fontSize: "0.72rem", fontWeight: 800, padding: "3px 8px", borderRadius: "6px", backdropFilter: "blur(4px)" }}>
                    Order #{c.order}
                  </span>
                  <span style={{ background: c.isActive ? "#059669" : "#64748b", color: "#fff", fontSize: "0.72rem", fontWeight: 800, padding: "3px 8px", borderRadius: "6px" }}>
                    {c.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: "16px" }}>
                <div style={{ marginBottom: "8px" }}>
                  <div style={{ fontWeight: 800, color: "#171410", fontSize: "1.15rem" }}>{c.name}</div>
                </div>
                <div style={{ color: "#73695b", fontSize: "0.85rem", minHeight: "36px" }}>{c.tagline || "No description"}</div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "8px", borderTop: "1px solid #f1ece4", paddingTop: "12px", marginTop: "12px" }}>
                  <button
                    onClick={() => setEditingCategory({ ...c })}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #ede8e0",
                      background: "#f9f8f6",
                      color: "#423b32",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                    }}
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    Edit
                  </button>

                  <button
                    onClick={() => handleDelete(c)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1px solid #fee2e2",
                      background: "#fff5f5",
                      color: "#dc2626",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── ADD CATEGORY MODAL ─── */}
      {showAddModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "480px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#171410" }}>Add New Category</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#73695b" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Desi Chicken, Marinated & Ready-to-Cook"
                  value={newCat.name}
                  onChange={e => setNewCat({ ...newCat, name: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Tagline / Short Description</label>
                <input
                  type="text"
                  placeholder="e.g. Free-range country chicken cut fresh"
                  value={newCat.tagline}
                  onChange={e => setNewCat({ ...newCat, tagline: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Image URL</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={newCat.image}
                  onChange={e => setNewCat({ ...newCat, image: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box" }}
                />
                {newCat.image.trim() && (
                  <div style={{ marginTop: "8px", height: "90px", borderRadius: "8px", overflow: "hidden", border: "1px solid #e5e0d8", background: "#1c1815" }}>
                    <img src={newCat.image} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => (e.target as HTMLElement).style.display = "none"} />
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", alignItems: "center" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Display Order</label>
                  <input
                    type="number"
                    min="1"
                    value={newCat.order}
                    onChange={e => setNewCat({ ...newCat, order: parseInt(e.target.value) || 1 })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ marginTop: "18px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", fontWeight: 700, color: "#423b32", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={newCat.isActive}
                      onChange={e => setNewCat({ ...newCat, isActive: e.target.checked })}
                      style={{ width: "16px", height: "16px", accentColor: "#941717" }}
                    />
                    Active Live
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "14px" }}>
                <button type="button" className="btn" disabled={submitting} onClick={() => setShowAddModal(false)} style={{ padding: "9px 18px", borderRadius: "8px" }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ padding: "9px 24px", borderRadius: "8px" }}>
                  {submitting ? "Adding…" : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT CATEGORY MODAL ─── */}
      {editingCategory && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "480px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#171410" }}>Edit Category</h3>
              <button onClick={() => setEditingCategory(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#73695b" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Category Name *</label>
                <input
                  type="text"
                  required
                  value={editingCategory.name}
                  onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Tagline / Short Description</label>
                <input
                  type="text"
                  value={editingCategory.tagline || ""}
                  onChange={e => setEditingCategory({ ...editingCategory, tagline: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Image URL</label>
                <input
                  type="url"
                  value={editingCategory.image || ""}
                  onChange={e => setEditingCategory({ ...editingCategory, image: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box" }}
                />
                {editingCategory.image && (
                  <div style={{ marginTop: "8px", height: "90px", borderRadius: "8px", overflow: "hidden", border: "1px solid #e5e0d8", background: "#1c1815" }}>
                    <img src={editingCategory.image} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => (e.target as HTMLElement).style.display = "none"} />
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", alignItems: "center" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Display Order</label>
                  <input
                    type="number"
                    min="1"
                    value={editingCategory.order || 1}
                    onChange={e => setEditingCategory({ ...editingCategory, order: parseInt(e.target.value) || 1 })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ marginTop: "18px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", fontWeight: 700, color: "#423b32", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={editingCategory.isActive}
                      onChange={e => setEditingCategory({ ...editingCategory, isActive: e.target.checked })}
                      style={{ width: "16px", height: "16px", accentColor: "#941717" }}
                    />
                    Active Live
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "14px" }}>
                <button type="button" className="btn" disabled={submitting} onClick={() => setEditingCategory(null)} style={{ padding: "9px 18px", borderRadius: "8px" }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ padding: "9px 24px", borderRadius: "8px" }}>
                  {submitting ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ success: boolean; orders: any[] }>("/super-admin/orders")
      .then(res => {
        if (res.data.success) {
          setOrders(res.data.orders || []);
        }
      })
      .catch(err => console.warn("Failed to fetch all orders:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <SectionTitle title="Platform Orders" sub="All orders placed across all store branches" />
      <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#73695b" }}>Loading platform orders…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#faf8f5", borderBottom: "1px solid #ede8e0" }}>
                {["Order ID", "Fulfillment", "Customer", "Store", "Amount", "Slot", "Payment", "Status"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "#423b32", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => {
                const isPickup =
                  o.fulfillmentType === "pickup" ||
                  o.pickupMode === true ||
                  o.deliverySlot?.toLowerCase().includes("pickup") ||
                  o.customer?.address?.toLowerCase().includes("pickup");

                return (
                  <tr key={o.orderId || i} style={{ borderBottom: i < orders.length - 1 ? "1px solid #ede8e0" : "none" }}>
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: "#171410" }}>#{o.orderId}</td>
                    <td style={{ padding: "14px 16px" }}>
                      {isPickup ? (
                        <span style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "2px 8px", borderRadius: "6px", fontSize: "0.72rem", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <FontAwesomeIcon icon={faStore} /> Store Pickup
                        </span>
                      ) : (
                        <span style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd", padding: "2px 8px", borderRadius: "6px", fontSize: "0.72rem", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <FontAwesomeIcon icon={faMotorcycle} /> Home Delivery
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#423b32" }}>{o.customer?.name} ({o.customer?.phone})</td>
                    <td style={{ padding: "14px 16px", color: "#423b32" }}>{o.storeName || o.storeId}</td>
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: "#941717" }}>₹{o.amount}</td>
                    <td style={{ padding: "14px 16px", color: "#73695b", fontSize: "0.8rem" }}>{o.deliverySlot}</td>
                    <td style={{ padding: "14px 16px", color: "#423b32" }}>{o.paymentMethod}</td>
                    <td style={{ padding: "14px 16px" }}><Badge label={o.status} color={o.status === "Delivered" ? "#059669" : o.status === "Pending" ? "#941717" : "#d97706"} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RidersTab() {
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddRiderModal, setShowAddRiderModal] = useState(false);
  const [newRider, setNewRider] = useState({
    name: "",
    phone: "",
    vehicleNumber: "",
    storeId: "S001",
  });
  const [submitting, setSubmitting] = useState(false);

  // Edit rider state
  const [editingRider, setEditingRider] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    vehicleNumber: "",
    storeId: "S001",
    riderStatus: "Available",
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRiders = () => {
    setLoading(true);
    api.get<{ success: boolean; riders: any[] }>("/super-admin/riders")
      .then(res => {
        if (res.data.success) {
          setRiders(res.data.riders || []);
        }
      })
      .catch(err => console.warn("Failed to fetch riders:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRiders();
  }, []);

  const handleAddRider = async () => {
    if (!newRider.name.trim() || !newRider.phone.trim()) {
      alert("Please enter rider name and phone number");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/super-admin/riders", {
        name: newRider.name.trim(),
        email: `rider_${Date.now()}@teffes.com`,
        phone: newRider.phone.trim(),
        vehicleNumber: newRider.vehicleNumber.trim() || "JH01-EC-1234",
        storeId: newRider.storeId || "S001",
      });
      fetchRiders();
      setShowAddRiderModal(false);
      setNewRider({ name: "", phone: "", vehicleNumber: "", storeId: "S001" });
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to add rider");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (r: any) => {
    setEditingRider(r);
    setEditForm({
      name: r.name || "",
      phone: r.phone || "",
      vehicleNumber: r.vehicleNumber || "",
      storeId: r.storeId || "S001",
      riderStatus: r.riderStatus || "Available",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRider?._id) return;
    if (!editForm.phone.trim()) {
      alert("Phone number cannot be empty");
      return;
    }
    setSubmittingEdit(true);
    try {
      const res = await api.put(`/super-admin/riders/${editingRider._id}`, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        vehicleNumber: editForm.vehicleNumber.trim(),
        storeId: editForm.storeId,
        riderStatus: editForm.riderStatus,
      });
      if (res.data.success) {
        setEditingRider(null);
        fetchRiders();
      } else {
        alert(res.data.message || "Failed to update rider");
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update rider");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteRider = async (r: any) => {
    toast.confirm({
      title: "Remove Rider?",
      message: `Are you sure you want to remove rider "${r.name}" (${r.phone})?\n\nThis will permanently remove the rider account.`,
      confirmText: "Remove Rider",
      type: "danger",
      onConfirm: async () => {
        setDeletingId(r._id);
        try {
          const res = await api.delete(`/super-admin/riders/${r._id}`);
          if (res.data.success) {
            toast.success(`Rider "${r.name}" removed successfully`, "Rider Removed");
            fetchRiders();
          } else {
            toast.error(res.data.message || "Failed to delete rider", "Delete Failed");
          }
        } catch (err: any) {
          toast.error(err.response?.data?.message || "Failed to delete rider", "Delete Failed");
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <SectionTitle title="Delivery Riders" sub="Manage express delivery staff, assigned stores, and vehicle info" />
        <button onClick={() => setShowAddRiderModal(true)} className="btn btn-primary" style={{ fontSize: "0.875rem" }}>+ Add Rider</button>
      </div>
      {/* Responsive styles for rider actions and layout */}
      <style>{`
        @media (max-width: 1260px) {
          .rider-action-group {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 5px !important;
            min-width: 80px !important;
          }
          .rider-action-group button {
            width: 100% !important;
            min-width: 0 !important;
            justify-content: center !important;
            height: 28px !important;
            font-size: 0.75rem !important;
            padding: 4px 6px !important;
          }
        }
      `}</style>

      <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%", boxShadow: "0 1px 4px rgba(0,0,0,0.02)" }}>
        {loading ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#73695b" }}>Loading riders…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", minWidth: "640px" }}>
            <thead>
              <tr style={{ background: "#faf8f5", borderBottom: "1px solid #ede8e0" }}>
                {["Rider Name", "Phone", "Vehicle Number", "Assigned Store", "Live Shift Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "#423b32", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {riders.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#73695b" }}>No delivery riders registered yet. Click &quot;+ Add Rider&quot; above.</td>
                </tr>
              ) : (
                riders.map((r, i) => (
                  <tr key={r._id || r.phone || i} style={{ borderBottom: i < riders.length - 1 ? "1px solid #ede8e0" : "none" }}>
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: "#171410" }}>{r.name}</td>
                    <td style={{ padding: "14px 16px", color: "#423b32", fontFamily: "monospace" }}>{r.phone}</td>
                    <td style={{ padding: "14px 16px", color: "#73695b", fontWeight: 600 }}>{r.vehicleNumber || "—"}</td>
                    <td style={{ padding: "14px 16px", color: "#423b32" }}>
                      <span style={{ background: "#f5f2eb", padding: "4px 8px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 600 }}>
                        {r.storeId ? `${r.storeId} — ` : ""}{r.storeName || "Kishore Ganj"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <Badge label={r.riderStatus || "Available"} color={r.riderStatus === "Available" ? "#059669" : r.riderStatus === "On Delivery" ? "#0284c7" : "#64748b"} />
                    </td>
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <div className="rider-action-group" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                        <AdminEditButton
                          onClick={() => handleStartEdit(r)}
                          title="Edit Rider"
                        />
                        <AdminDeleteButton
                          onClick={() => handleDeleteRider(r)}
                          disabled={deletingId === r._id}
                          loading={deletingId === r._id}
                          title="Delete Rider"
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── ADD RIDER MODAL ─── */}
      {showAddRiderModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "460px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#171410", display: "flex", alignItems: "center", gap: "8px" }}>
                <FontAwesomeIcon icon={faMotorcycle} style={{ color: "#941717" }} /> Add Delivery Rider
              </h3>
              <button onClick={() => setShowAddRiderModal(false)} style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#73695b" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Rider Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={newRider.name}
                  onChange={e => setNewRider({ ...newRider, name: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Phone Number *</label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={newRider.phone}
                  onChange={e => setNewRider({ ...newRider, phone: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Vehicle Registration Number</label>
                <input
                  type="text"
                  placeholder="JH01-EC-4821"
                  value={newRider.vehicleNumber}
                  onChange={e => setNewRider({ ...newRider, vehicleNumber: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Assigned Store Branch</label>
                <select
                  value={newRider.storeId}
                  onChange={e => setNewRider({ ...newRider, storeId: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", background: "#fff", boxSizing: "border-box" }}
                >
                  <option value="S001">S001 — Ranchi Kishore Ganj</option>
                  <option value="S002">S002 — Ranchi Doranda</option>
                  <option value="S003">S003 — Ranchi Lalpur</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setShowAddRiderModal(false)} disabled={submitting} style={{ padding: "8px 16px", borderRadius: "8px" }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddRider} disabled={submitting} style={{ padding: "8px 20px", borderRadius: "8px" }}>
                {submitting ? "Adding…" : "Add Rider"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── EDIT RIDER MODAL ─── */}
      {editingRider && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "480px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#171410", display: "flex", alignItems: "center", gap: "8px" }}>
                  <FontAwesomeIcon icon={faPen} style={{ color: "#941717" }} /> Edit Rider Details
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "#73695b" }}>Update phone, vehicle number, and store assignment</p>
              </div>
              <button onClick={() => setEditingRider(null)} style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#73695b" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Rider Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Phone Number *</label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                />
                <span style={{ fontSize: "0.75rem", color: "#73695b" }}>Rider logs into the rider app with this phone number</span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Vehicle Registration Number</label>
                <input
                  type="text"
                  placeholder="JH01-EC-4821"
                  value={editForm.vehicleNumber}
                  onChange={e => setEditForm({ ...editForm, vehicleNumber: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Assigned Store Branch</label>
                <select
                  value={editForm.storeId}
                  onChange={e => setEditForm({ ...editForm, storeId: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", background: "#fff", boxSizing: "border-box" }}
                >
                  <option value="S001">S001 — Ranchi Kishore Ganj</option>
                  <option value="S002">S002 — Ranchi Doranda</option>
                  <option value="S003">S003 — Ranchi Lalpur</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Live Shift Status</label>
                <select
                  value={editForm.riderStatus}
                  onChange={e => setEditForm({ ...editForm, riderStatus: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", background: "#fff", boxSizing: "border-box" }}
                >
                  <option value="Available">Available (Ready for delivery)</option>
                  <option value="On Delivery">On Delivery</option>
                  <option value="Offline">Offline</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setEditingRider(null)} disabled={submittingEdit} style={{ padding: "8px 16px", borderRadius: "8px" }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveEdit} disabled={submittingEdit} style={{ padding: "8px 20px", borderRadius: "8px" }}>
                {submittingEdit ? "Saving…" : "Save Changes"}
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

  // Modal State for Adding Balance to Customer
  const [balanceModalUser, setBalanceModalUser] = useState<{ id: string; name: string; phone: string; balance: number } | null>(null);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceDesc, setBalanceDesc] = useState("Money added by Super Admin");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchCustomers = () => {
    api.get<{ success: boolean; customers: any[] }>("/super-admin/customers")
      .then(res => {
        if (res.data.success) {
          setCustomers(res.data.customers || []);
        }
      })
      .catch(err => console.warn("Failed to fetch platform customers:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const openBalanceModal = (customer: any) => {
    setBalanceModalUser({
      id: customer._id,
      name: customer.name || "Customer",
      phone: customer.phone || "",
      balance: customer.walletBalance || 0,
    });
    setBalanceAmount("");
    setBalanceDesc("Money added by Super Admin");
    setFeedback(null);
  };

  const closeBalanceModal = () => {
    setBalanceModalUser(null);
    setBalanceAmount("");
    setBalanceDesc("Money added by Super Admin");
    setFeedback(null);
    setIsSubmitting(false);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceModalUser) return;
    const amountNum = Number(balanceAmount);
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      setFeedback({ type: "error", message: "Please enter a valid amount (e.g. 500)" });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await api.post<{ success: boolean; message: string }>("/wallet/admin/add-money", {
        userId: balanceModalUser.id,
        amount: amountNum,
        description: balanceDesc || "Money added by Super Admin",
      });

      if (res.data.success) {
        setFeedback({
          type: "success",
          message: `Successfully credited ₹${amountNum} to ${balanceModalUser.name}'s wallet!`,
        });
        fetchCustomers();
        setTimeout(() => {
          closeBalanceModal();
        }, 1200);
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.response?.data?.message || "Failed to add balance",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <SectionTitle title="Customer Directory" sub="Registered customers across Ranchi" />
      <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#73695b" }}>Loading customers…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#faf8f5", borderBottom: "1px solid #ede8e0" }}>
                {["Name", "Phone", "Wallet", "Role", "Verified", "Default Address", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "#423b32", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={c.phone || i} style={{ borderBottom: i < customers.length - 1 ? "1px solid #ede8e0" : "none" }}>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#171410" }}>{c.name || "Customer"}</td>
                  <td style={{ padding: "14px 16px", color: "#423b32" }}>{c.phone}</td>
                  <td style={{ padding: "14px 16px", color: "#059669", fontWeight: "bold" }}>₹{c.walletBalance || 0}</td>
                  <td style={{ padding: "14px 16px", color: "#73695b" }}>Customer</td>
                  <td style={{ padding: "14px 16px" }}><Badge label={c.isVerified ? "Verified" : "Pending"} color={c.isVerified ? "#059669" : "#d97706"} /></td>
                  <td style={{ padding: "14px 16px", color: "#73695b", fontSize: "0.8rem" }}>
                    {c.addresses && c.addresses.length > 0 ? `${c.addresses[0].line1}, ${c.addresses[0].city}` : "Ranchi"}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <button
                      type="button"
                      onClick={() => openBalanceModal(c)}
                      style={{
                        padding: "7px 14px",
                        background: "#91000a",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                        transition: "all 0.2s"
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>add_card</span>
                      <span>Add Balance</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Super Admin Add Balance Modal */}
      {balanceModalUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeBalanceModal();
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "420px",
              overflow: "hidden",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              border: "1px solid #ede8e0",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid #ede8e0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#faf8f5",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "rgba(145, 0, 10, 0.1)",
                    color: "#91000a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                    account_balance_wallet
                  </span>
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#171410" }}>
                    Add Customer Balance
                  </h4>
                  <span style={{ fontSize: "0.75rem", color: "#73695b" }}>
                    Credit wallet directly in real-time
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeBalanceModal}
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  border: "none",
                  background: "#ede8e0",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#423b32",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px" }}>
              {/* Customer summary card */}
              <div
                style={{
                  padding: "12px 14px",
                  background: "#faf8f5",
                  borderRadius: "12px",
                  border: "1px solid #ede8e0",
                  marginBottom: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, color: "#171410", fontSize: "0.85rem" }}>
                    {balanceModalUser.name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#73695b" }}>
                    {balanceModalUser.phone || "No phone listed"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.7rem", color: "#73695b", fontWeight: 600 }}>Current Balance</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#059669" }}>
                    ₹{balanceModalUser.balance}
                  </div>
                </div>
              </div>

              {/* Feedback Alert */}
              {feedback && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "10px",
                    marginBottom: "14px",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: feedback.type === "success" ? "#ecfdf5" : "#fef2f2",
                    color: feedback.type === "success" ? "#065f46" : "#991b1b",
                    border: `1px solid ${feedback.type === "success" ? "#a7f3d0" : "#fecaca"}`,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    {feedback.type === "success" ? "check_circle" : "error"}
                  </span>
                  <span>{feedback.message}</span>
                </div>
              )}

              <form onSubmit={handleModalSubmit}>
                {/* Amount */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                    Amount to Add (₹) *
                  </label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <span style={{ position: "absolute", left: "12px", fontWeight: 800, color: "#73695b" }}>₹</span>
                    <input
                      type="number"
                      value={balanceAmount}
                      onChange={(e) => {
                        setBalanceAmount(e.target.value);
                        if (feedback) setFeedback(null);
                      }}
                      placeholder="e.g. 500"
                      min="1"
                      required
                      style={{
                        width: "100%",
                        padding: "10px 14px 10px 30px",
                        borderRadius: "10px",
                        border: "1px solid #d5cec5",
                        outline: "none",
                        fontSize: "0.95rem",
                        fontWeight: 700,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  {/* Quick Pills */}
                  <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                    {[100, 200, 500, 1000, 2000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setBalanceAmount(amt.toString());
                          if (feedback) setFeedback(null);
                        }}
                        style={{
                          flex: 1,
                          padding: "5px 0",
                          borderRadius: "6px",
                          border: balanceAmount === amt.toString() ? "1px solid #91000a" : "1px solid #ede8e0",
                          background: balanceAmount === amt.toString() ? "#91000a" : "#fff",
                          color: balanceAmount === amt.toString() ? "#fff" : "#423b32",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        +₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom: "18px" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                    Description / Reason
                  </label>
                  <input
                    type="text"
                    value={balanceDesc}
                    onChange={(e) => setBalanceDesc(e.target.value)}
                    placeholder="e.g. Promotional goodwill / Refund adjustment"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid #d5cec5",
                      outline: "none",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                    }}
                  />
                  {/* Preset reason chips */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                    {["Promotional bonus", "Refund adjustment", "Goodwill credit"].map((r) => (
                      <span
                        key={r}
                        onClick={() => setBalanceDesc(r)}
                        style={{
                          fontSize: "0.7rem",
                          background: "#faf8f5",
                          border: "1px solid #ede8e0",
                          borderRadius: "6px",
                          padding: "3px 8px",
                          cursor: "pointer",
                          color: "#73695b",
                          fontWeight: 600,
                        }}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Buttons */}
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={closeBalanceModal}
                    style={{
                      flex: 1,
                      padding: "10px 16px",
                      borderRadius: "10px",
                      border: "1px solid #ede8e0",
                      background: "#faf8f5",
                      color: "#423b32",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      flex: 1,
                      padding: "10px 16px",
                      borderRadius: "10px",
                      border: "none",
                      background: isSubmitting ? "#73695b" : "#91000a",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                      boxShadow: "0 2px 4px rgba(145, 0, 10, 0.25)",
                    }}
                  >
                    {isSubmitting ? "Adding..." : `Credit ₹${balanceAmount || "0"}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CouponsTab() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string>("");

  const defaultCouponForm = {
    code: "",
    discountType: "percentage",
    discountValue: 20,
    minOrderAmount: 399,
    maxDiscountAmount: 100 as number | string,
    validFrom: new Date().toISOString().slice(0, 10),
    validTill: "2026-12-31",
    firstOrderOnly: false,
    usageLimit: "" as number | string,
    description: "",
    isSuperOffer: false,
    isActive: true,
  };

  const [formData, setFormData] = useState(defaultCouponForm);

  const fetchCoupons = () => {
    setLoading(true);
    api.get<{ success: boolean; coupons: any[] }>("/super-admin/coupons")
      .then(res => {
        if (res.data.success) {
          setCoupons(res.data.coupons || []);
        }
      })
      .catch(err => console.warn("Failed to fetch coupons:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const openCreateModal = () => {
    setEditingCoupon(null);
    setValidationError("");
    setFormData(defaultCouponForm);
    setShowModal(true);
  };

  const openEditModal = (coupon: any) => {
    setEditingCoupon(coupon);
    setValidationError("");
    const fromStr = coupon.validFrom ? new Date(coupon.validFrom).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const tillStr = coupon.validTill ? new Date(coupon.validTill).toISOString().slice(0, 10) : "2026-12-31";
    setFormData({
      code: coupon.code || "",
      discountType: coupon.discountType || "percentage",
      discountValue: coupon.discountValue !== undefined ? coupon.discountValue : 20,
      minOrderAmount: coupon.minOrderAmount !== undefined ? coupon.minOrderAmount : (coupon.minOrder || 0),
      maxDiscountAmount: coupon.maxDiscountAmount !== undefined && coupon.maxDiscountAmount !== null ? coupon.maxDiscountAmount : "",
      validFrom: fromStr,
      validTill: tillStr,
      firstOrderOnly: Boolean(coupon.firstOrderOnly),
      usageLimit: coupon.usageLimit !== undefined && coupon.usageLimit !== null ? coupon.usageLimit : "",
      description: coupon.description || coupon.discount || "",
      isSuperOffer: Boolean(coupon.isSuperOffer),
      isActive: coupon.isActive !== false && coupon.status !== "Paused",
    });
    setShowModal(true);
  };

  const handleSaveCoupon = async () => {
    setValidationError("");
    const cleanCode = formData.code.trim().toUpperCase();
    if (!cleanCode) {
      setValidationError("Promo Code is required.");
      return;
    }
    const val = Number(formData.discountValue);
    if (isNaN(val) || val <= 0) {
      setValidationError("Discount value must be greater than 0.");
      return;
    }
    if (formData.discountType === "percentage" && (val < 1 || val > 100)) {
      setValidationError("Percentage discount must be between 1 and 100.");
      return;
    }
    const minOrder = Number(formData.minOrderAmount) || 0;
    if (minOrder < 0) {
      setValidationError("Minimum order amount cannot be negative.");
      return;
    }
    const maxDiscount = formData.maxDiscountAmount !== "" && formData.maxDiscountAmount !== null
      ? Number(formData.maxDiscountAmount)
      : null;
    if (maxDiscount !== null && maxDiscount < 0) {
      setValidationError("Maximum discount cannot be negative.");
      return;
    }
    if (!formData.validTill) {
      setValidationError("Valid Till date is required.");
      return;
    }
    if (new Date(formData.validTill) < new Date(formData.validFrom)) {
      setValidationError("Valid Till cannot be before Valid From.");
      return;
    }
    const limit = formData.usageLimit !== "" && formData.usageLimit !== null
      ? Number(formData.usageLimit)
      : null;
    if (limit !== null && limit < 0) {
      setValidationError("Usage limit cannot be negative.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        code: cleanCode,
        discountType: formData.discountType,
        discountValue: val,
        minOrderAmount: minOrder,
        minOrder: minOrder,
        maxDiscountAmount: maxDiscount,
        validFrom: formData.validFrom,
        validTill: formData.validTill,
        firstOrderOnly: Boolean(formData.firstOrderOnly),
        usageLimit: limit,
        description: formData.description.trim(),
        discount: formData.description.trim(),
        isSuperOffer: Boolean(formData.isSuperOffer),
        isActive: Boolean(formData.isActive),
        status: formData.isActive ? "Active" : "Paused",
      };

      if (editingCoupon) {
        const id = editingCoupon._id || editingCoupon.id;
        await api.put(`/super-admin/coupons/${id}`, payload);
        toast.success(`Coupon "${cleanCode}" updated successfully!`, "Coupon Updated");
      } else {
        await api.post("/super-admin/coupons", payload);
        toast.success(`Coupon "${cleanCode}" created successfully!`, "Coupon Created");
      }

      fetchCoupons();
      setShowModal(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to save coupon";
      setValidationError(msg);
      toast.error(msg, "Coupon Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetSuperOffer = async (coupon: any) => {
    const couponId = coupon._id || coupon.id;
    setActionLoading(couponId);
    try {
      await api.put(`/super-admin/coupons/${couponId}/super-offer`);
      toast.success(`Coupon "${coupon.code}" set as platform Super Offer!`, "Super Offer Active");
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to set Super Offer", "Update Error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (coupon: any) => {
    const couponId = coupon._id || coupon.id;
    const currentlyActive = coupon.isActive !== false && coupon.status === "Active";
    const nextActive = !currentlyActive;
    setActionLoading(couponId);
    try {
      await api.put(`/super-admin/coupons/${couponId}`, {
        isActive: nextActive,
        status: nextActive ? "Active" : "Paused",
      });
      toast.success(`Coupon "${coupon.code}" is now ${nextActive ? "Active" : "Disabled"}.`);
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCoupon = async (coupon: any) => {
    const couponId = coupon._id || coupon.id;
    toast.confirm({
      title: "Delete Coupon?",
      message: `Are you sure you want to permanently delete coupon "${coupon.code}"?\n\nThis will immediately remove it from the customer app and website.`,
      confirmText: "Delete Coupon",
      type: "danger",
      onConfirm: async () => {
        setActionLoading(couponId);
        try {
          await api.delete(`/super-admin/coupons/${couponId}`);
          toast.success(`Coupon "${coupon.code}" deleted successfully`, "Coupon Deleted");
          fetchCoupons();
        } catch (err: any) {
          toast.error(err.response?.data?.message || "Failed to delete coupon", "Delete Error");
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <SectionTitle title="Coupons & Promo Codes" sub="Full lifecycle promo engine for discounts, first-order deals & Super Offers" />
        <button onClick={openCreateModal} className="btn btn-primary" style={{ fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "6px" }}>
          <FontAwesomeIcon icon={faTicket} /> Create New Coupon
        </button>
      </div>

      <div style={{
        background: "#fffbeb",
        border: "1px solid #fef3c7",
        borderRadius: "12px",
        padding: "12px 16px",
        marginBottom: "24px",
        fontSize: "0.82rem",
        color: "#92400e",
        display: "flex",
        alignItems: "center",
        gap: "10px"
      }}>
        <span style={{ fontSize: "1.2rem", color: "#f59e0b" }}>
          <FontAwesomeIcon icon={faStar} />
        </span>
        <div>
          <strong>Super Offer Engine:</strong> Designating a coupon as Super Offer highlights it across the <strong>Top Announcement Bar</strong>, <strong>Home Celebration Ribbon</strong>, and <strong>Offers Page</strong>. Coupons require explicit customer Claim/Apply and are revalidated on backend during order placement.
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#73695b" }}>Loading coupons…</div>
      ) : coupons.length === 0 ? (
        <div style={{ padding: "48px", textAlign: "center", background: "#fff", borderRadius: "16px", border: "1px dashed #d1cbbf" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "8px", color: "#941717" }}>
            <FontAwesomeIcon icon={faTicket} />
          </div>
          <div style={{ fontWeight: 700, color: "#171410", marginBottom: "4px" }}>No Coupons Created Yet</div>
          <p style={{ color: "#73695b", fontSize: "0.85rem", marginBottom: "16px" }}>Create promo codes with min order limits, percentage caps, and first-order validation.</p>
          <button onClick={openCreateModal} className="btn btn-primary" style={{ fontSize: "0.85rem" }}>
            + Create Coupon
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "18px" }}>
          {coupons.map((c) => {
            const couponId = c._id || c.id;
            const isBusy = actionLoading === couponId;
            const isActive = c.isActive !== false && c.status === "Active";
            const usageCount = c.usageCount !== undefined ? c.usageCount : (c.used || 0);
            const usageLimit = c.usageLimit !== undefined && c.usageLimit !== null && c.usageLimit > 0 ? c.usageLimit : "Unlimited";
            const isPercentage = c.discountType === "percentage";
            const validTillDisplay = c.validTill ? new Date(c.validTill).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Open";
            const validFromDisplay = c.validFrom ? new Date(c.validFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Immediate";

            return (
              <div key={couponId || c.code} style={{
                background: "#fff",
                border: c.isSuperOffer ? "2px solid #f59e0b" : "1px solid #ede8e0",
                borderRadius: "16px",
                padding: "20px",
                boxShadow: c.isSuperOffer ? "0 4px 14px rgba(245, 158, 11, 0.15)" : "0 2px 8px rgba(0,0,0,0.02)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "14px",
                position: "relative"
              }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", gap: "8px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                        <span style={{ fontSize: "1.25rem", fontWeight: 900, color: "#941717", fontFamily: "Outfit, sans-serif", letterSpacing: "1px" }}>
                          {c.code}
                        </span>
                        <span style={{
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          padding: "2px 7px",
                          borderRadius: "6px",
                          background: isPercentage ? "#eef2ff" : "#f0fdf4",
                          color: isPercentage ? "#4338ca" : "#15803d"
                        }}>
                          {isPercentage ? `${c.discountValue}% OFF` : c.discountType === "free_delivery" ? "Free Delivery" : `₹${c.discountValue} OFF`}
                        </span>
                        {c.firstOrderOnly && (
                          <span style={{
                            fontSize: "0.68rem",
                            fontWeight: 800,
                            padding: "2px 7px",
                            borderRadius: "6px",
                            background: "#fef3c7",
                            color: "#92400e"
                          }}>
                            1st Order
                          </span>
                        )}
                      </div>
                      {c.isSuperOffer && (
                        <div style={{
                          background: "#fef3c7",
                          color: "#92400e",
                          border: "1px solid #fde68a",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          marginTop: "2px"
                        }}>
                          <FontAwesomeIcon icon={faStar} style={{ color: "#f59e0b" }} /> Super Offer
                        </div>
                      )}
                    </div>
                    <Badge label={isActive ? "Active" : "Disabled"} color={isActive ? "#059669" : "#dc2626"} />
                  </div>

                  <div style={{ color: "#171410", fontSize: "0.88rem", fontWeight: 600, marginBottom: "10px", lineHeight: "1.35" }}>
                    {c.description || c.discount || `${c.discountValue}${isPercentage ? "%" : "₹"} discount on orders above ₹${c.minOrderAmount || c.minOrder || 0}`}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "0.75rem", color: "#574e42", background: "#faf8f5", padding: "10px 12px", borderRadius: "10px" }}>
                    <div>Min Order: <strong>₹{c.minOrderAmount !== undefined ? c.minOrderAmount : (c.minOrder || 0)}</strong></div>
                    <div>Max Cap: <strong>{c.maxDiscountAmount ? `₹${c.maxDiscountAmount}` : "No Limit"}</strong></div>
                    <div>Valid Till: <strong>{validTillDisplay}</strong></div>
                    <div>Usage: <strong>{usageCount} / {usageLimit}</strong></div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "12px", borderTop: "1px solid #f1ede6" }}>
                  {!c.isSuperOffer && isActive && (
                    <button
                      onClick={() => handleSetSuperOffer(c)}
                      disabled={isBusy}
                      style={{
                        background: "#fffbeb",
                        color: "#b45309",
                        border: "1px solid #fcd34d",
                        borderRadius: "8px",
                        padding: "6px 12px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: isBusy ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px"
                      }}
                    >
                      <FontAwesomeIcon icon={faStar} style={{ fontSize: "12px" }} />
                      <span>Set as Super Offer</span>
                    </button>
                  )}

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <button
                      onClick={() => handleToggleStatus(c)}
                      disabled={isBusy}
                      style={{
                        background: isActive ? "#fef2f2" : "#f0fdf4",
                        color: isActive ? "#b91c1c" : "#15803d",
                        border: `1px solid ${isActive ? "#fecaca" : "#bbf7d0"}`,
                        borderRadius: "8px",
                        padding: "6px 12px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: isBusy ? "not-allowed" : "pointer"
                      }}
                    >
                      {isBusy ? "Updating…" : isActive ? "Disable" : "Enable"}
                    </button>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => openEditModal(c)}
                        disabled={isBusy}
                        style={{
                          background: "#f8fafc",
                          color: "#334155",
                          border: "1px solid #cbd5e1",
                          borderRadius: "8px",
                          padding: "6px 12px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: isBusy ? "not-allowed" : "pointer"
                        }}
                      >
                        Edit
                      </button>

                      <AdminDeleteButton
                        onClick={() => handleDeleteCoupon(c)}
                        disabled={isBusy}
                        title="Delete Coupon"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── CREATE / EDIT COUPON MODAL ─── */}
      {showModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "26px", borderRadius: "18px", width: "100%", maxWidth: "520px", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#171410", display: "flex", alignItems: "center", gap: "8px" }}>
                <FontAwesomeIcon icon={faTicket} style={{ color: "#941717" }} /> {editingCoupon ? "Edit Coupon" : "Create New Coupon"}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#73695b" }}>✕</button>
            </div>

            {validationError && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: "8px", fontSize: "0.82rem", fontWeight: 700, marginBottom: "14px" }}>
                {validationError}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
              {/* Promo Code */}
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Promo Code *</label>
                <input
                  type="text"
                  placeholder="e.g. MEAT25"
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.95rem", fontWeight: 800, letterSpacing: "1px", boxSizing: "border-box" }}
                />
              </div>

              {/* Discount Type & Value */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Discount Type *</label>
                  <select
                    value={formData.discountType}
                    onChange={e => setFormData({ ...formData, discountType: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box", background: "#fff" }}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                    <option value="free_delivery">Free Delivery</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>
                    {formData.discountType === "percentage" ? "Percentage (%) *" : "Discount Value (₹) *"}
                  </label>
                  <input
                    type="number"
                    placeholder={formData.discountType === "percentage" ? "20" : "100"}
                    value={formData.discountValue}
                    onChange={e => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Min Order & Max Discount */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Minimum Order (₹)</label>
                  <input
                    type="number"
                    placeholder="399"
                    value={formData.minOrderAmount}
                    onChange={e => setFormData({ ...formData, minOrderAmount: Number(e.target.value) })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>
                    Max Discount Cap (₹)
                  </label>
                  <input
                    type="number"
                    placeholder={formData.discountType === "percentage" ? "e.g. 100" : "Optional"}
                    value={formData.maxDiscountAmount}
                    onChange={e => setFormData({ ...formData, maxDiscountAmount: e.target.value === "" ? "" : Number(e.target.value) })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Validity Dates */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Valid From *</label>
                  <input
                    type="date"
                    value={formData.validFrom}
                    onChange={e => setFormData({ ...formData, validFrom: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Valid Till *</label>
                  <input
                    type="date"
                    value={formData.validTill}
                    onChange={e => setFormData({ ...formData, validTill: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Usage Limit & Display Description */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Usage Limit</label>
                  <input
                    type="number"
                    placeholder="e.g. 1000 (blank = ∞)"
                    value={formData.usageLimit}
                    onChange={e => setFormData({ ...formData, usageLimit: e.target.value === "" ? "" : Number(e.target.value) })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Display Description</label>
                  <input
                    type="text"
                    placeholder="e.g. 20% instant discount on orders above ₹399"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Toggles: First order only, Super Offer, Active/Enabled */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 700, color: "#423b32" }}>
                  <input
                    type="checkbox"
                    checked={formData.firstOrderOnly}
                    onChange={e => setFormData({ ...formData, firstOrderOnly: e.target.checked })}
                    style={{ width: "16px", height: "16px", accentColor: "#941717", cursor: "pointer" }}
                  />
                  <span>Only for first order (verified against user's actual order history)</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 700, color: "#92400e", background: "#fffbeb", padding: "8px 10px", borderRadius: "8px", border: "1px solid #fef3c7" }}>
                  <input
                    type="checkbox"
                    checked={formData.isSuperOffer}
                    onChange={e => setFormData({ ...formData, isSuperOffer: e.target.checked })}
                    style={{ width: "16px", height: "16px", accentColor: "#941717", cursor: "pointer" }}
                  />
                  <span><FontAwesomeIcon icon={faStar} style={{ color: "#f59e0b" }} /> Set as Super Offer (Feature on Top Bar, Home Banner &amp; Offers Page)</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 700, color: "#15803d" }}>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                    style={{ width: "16px", height: "16px", accentColor: "#15803d", cursor: "pointer" }}
                  />
                  <span>Coupon Active / Enabled</span>
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setShowModal(false)} disabled={submitting} style={{ padding: "8px 16px", borderRadius: "8px" }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveCoupon} disabled={submitting} style={{ padding: "8px 20px", borderRadius: "8px" }}>
                {submitting ? "Saving…" : editingCoupon ? "Save Changes" : "Create Coupon"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    api.get<{ success: boolean; settings: any }>("/super-admin/settings")
      .then(res => {
        if (res.data.success) {
          setSettings(res.data.settings);
        }
      })
      .catch(err => console.warn("Failed to fetch settings:", err));
  }, []);

  return (
    <div>
      <SectionTitle title="Platform Settings" sub="Global configurations for Teffes Butchery Network" />
      <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", padding: "24px", maxWidth: "600px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #ede8e0", paddingBottom: "12px" }}>
            <span style={{ fontWeight: 600 }}>Delivery Radius</span>
            <span style={{ color: "#941717", fontWeight: 700 }}>{settings?.deliveryRadiusKm || 5} km from Kacheri Chowk</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #ede8e0", paddingBottom: "12px" }}>
            <span style={{ fontWeight: 600 }}>Min Order Amount</span>
            <span style={{ color: "#941717", fontWeight: 700 }}>₹{settings?.minOrderAmount || 199}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #ede8e0", paddingBottom: "12px" }}>
            <span style={{ fontWeight: 600 }}>Free Delivery Above</span>
            <span style={{ color: "#059669", fontWeight: 700 }}>₹{settings?.freeDeliveryThreshold || 399}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #ede8e0", paddingBottom: "12px" }}>
            <span style={{ fontWeight: 600 }}>Hygiene Standard</span>
            <span style={{ color: "#059669", fontWeight: 700 }}>RO Purified Cleaned · ISO-22000</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 600 }}>Maintenance Mode</span>
            <span style={{ color: "#73695b" }}>Disabled (Online)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BannersTab() {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newBanner, setNewBanner] = useState({
    title: "",
    image: "",
    link: "",
    order: 1,
    isActive: true,
  });

  const fetchBanners = () => {
    setLoading(true);
    api.get<{ success: boolean; banners: any[] }>("/super-admin/banners")
      .then(res => {
        if (res.data.success) {
          setBanners(res.data.banners || []);
        }
      })
      .catch(err => console.warn("Failed to fetch banners:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleCreateBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBanner.image.trim()) {
      alert("Please provide an image URL for the banner.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/super-admin/banners", newBanner);
      if (res.data?.success) {
        setShowAddModal(false);
        setNewBanner({
          title: "",
          image: "",
          link: "",
          order: banners.reduce((max, b) => Math.max(max, Number(b.order) || 0), 0) + 2,
          isActive: true,
        });
        fetchBanners();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to create banner");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (banner: any) => {
    const id = banner._id || banner.id;
    try {
      await api.put(`/super-admin/banners/${id}`, {
        isActive: !banner.isActive,
      });
      fetchBanners();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update banner status");
    }
  };

  const handleDeleteBanner = async (banner: any) => {
    const id = banner._id || banner.id;
    toast.confirm({
      title: "Remove Banner?",
      message: "Are you sure you want to remove this banner from the storefront carousel?",
      confirmText: "Remove Banner",
      type: "danger",
      onConfirm: async () => {
        try {
          await api.delete(`/super-admin/banners/${id}`);
          toast.success("Banner removed successfully", "Banner Removed");
          fetchBanners();
        } catch (err: any) {
          toast.error(err.response?.data?.message || "Failed to delete banner", "Delete Error");
        }
      },
    });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#171410", margin: 0 }}>Hero Sliding Banners</h2>
          <p style={{ color: "#73695b", fontSize: "0.875rem", marginTop: "4px" }}>
            Add and manage dynamic sliding banners displayed at the top of the Customer Website and Customer Mobile App.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setNewBanner({
              title: "",
              image: "",
              link: "",
              order: banners.reduce((max, b) => Math.max(max, Number(b.order) || 0), 0) + 1,
              isActive: true,
            });
            setShowAddModal(true);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "10px",
            fontWeight: 700,
            cursor: "pointer",
            backgroundColor: "#941717",
            color: "#fff",
            border: "none",
          }}
        >
          <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
          Add New Banner
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#73695b" }}>Loading hero banners…</div>
      ) : banners.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: "14px", border: "1px solid #ede8e0" }}>
          <span className="material-symbols-outlined text-[48px]" style={{ color: "#a89f91", marginBottom: "12px" }}>view_carousel</span>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#171410" }}>No Banners Configured</h3>
          <p style={{ color: "#73695b", fontSize: "0.85rem", marginTop: "4px" }}>Add your first hero banner to engage customers on web and mobile.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
          {banners.map((b: any, idx: number) => (
            <div
              key={b._id || idx}
              style={{
                background: "#ffffff",
                borderRadius: "14px",
                border: "1px solid #ede8e0",
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                transition: "transform 150ms ease, box-shadow 150ms ease",
              }}
            >
              {/* Image Preview Container */}
              <div
                style={{
                  width: "100%",
                  height: "170px",
                  background: "#181412",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <img
                  src={b.image}
                  alt={b.title || "Banner Preview"}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "10px",
                    left: "10px",
                    display: "flex",
                    gap: "6px",
                  }}
                >
                  <span
                    style={{
                      background: "rgba(0,0,0,0.75)",
                      color: "#fff",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      padding: "3px 8px",
                      borderRadius: "6px",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    #{b.order ?? idx + 1}
                  </span>
                  <span
                    style={{
                      background: b.isActive ? "#059669" : "#64748b",
                      color: "#fff",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      padding: "3px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    {b.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
              </div>

              {/* Details & Actions */}
              <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "14px" }}>
                <div>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95rem", fontWeight: 700, color: "#171410" }}>
                    {b.title || <span style={{ color: "#a89f91", fontStyle: "italic" }}>No Title Specified</span>}
                  </h4>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", borderTop: "1px solid #f1ece4", paddingTop: "12px" }}>
                  <button
                    onClick={() => handleToggleActive(b)}
                    style={{
                      flex: 1,
                      height: "38px",
                      padding: "0 14px",
                      borderRadius: "8px",
                      border: "1px solid #ede8e0",
                      background: b.isActive ? "#fef2f2" : "#f0fdf4",
                      color: b.isActive ? "#b91c1c" : "#15803d",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      boxSizing: "border-box",
                    }}
                  >
                    <span className="material-symbols-outlined text-[16px]">{b.isActive ? "visibility_off" : "visibility"}</span>
                    {b.isActive ? "Deactivate" : "Activate"}
                  </button>

                  <AdminDeleteButton
                    onClick={() => handleDeleteBanner(b)}
                    title="Delete Banner"
                    style={{ height: "38px", width: "38px", minWidth: "38px" }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Banner Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "28px",
              width: "100%",
              maxWidth: "540px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#171410" }}>Add New Hero Banner</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#73695b" }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateBanner} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                  Image URL <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="url"
                  placeholder="https://.../banner.webp"
                  required
                  value={newBanner.image}
                  onChange={(e) => setNewBanner({ ...newBanner, image: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #d1cbbf",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Live Image Preview */}
              {newBanner.image.trim() && (
                <div style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid #e5e0d8", background: "#181412" }}>
                  <div style={{ fontSize: "0.72rem", color: "#a89f91", padding: "6px 10px", background: "#26201c" }}>
                    Live Preview:
                  </div>
                  <div style={{ height: "140px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img
                      src={newBanner.image}
                      alt="Banner Preview"
                      style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                  Title / Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fresh Butchery Cut • Delivered in 90 Mins"
                  value={newBanner.title}
                  onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #d1cbbf",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#423b32", marginBottom: "6px" }}>
                  Display Order
                </label>
                <input
                  type="number"
                  min="1"
                  value={newBanner.order}
                  onChange={(e) => setNewBanner({ ...newBanner, order: parseInt(e.target.value) || 1 })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #d1cbbf",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                <input
                  type="checkbox"
                  id="bannerActive"
                  checked={newBanner.isActive}
                  onChange={(e) => setNewBanner({ ...newBanner, isActive: e.target.checked })}
                  style={{ width: "16px", height: "16px", accentColor: "#941717", cursor: "pointer" }}
                />
                <label htmlFor="bannerActive" style={{ fontSize: "0.85rem", fontWeight: 600, color: "#423b32", cursor: "pointer" }}>
                  Active immediately on Website &amp; Mobile App
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "8px",
                    border: "1px solid #ede8e0",
                    background: "#f7f5f0",
                    color: "#423b32",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "9px 24px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#941717",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {submitting ? "Saving…" : "Add Banner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Super Admin Page ──────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Auto-collapse sidebar earlier (below 1200px) so wide catalog and admin tables have maximum breathing room
  useEffect(() => {
    const checkWidth = () => {
      const width = window.innerWidth;
      const mobile = width < 768;
      setIsMobile(mobile);
      // Collapse sidebar earlier (under 1200px) to provide ample space for wide tables
      if (width < 1200) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    };
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored || (stored.role !== "superadmin" && stored.role !== "admin")) {
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
    dashboard: <DashboardTab />,
    stores: <StoresTab />,
    "store-admins": <StoreAdminsTab />,
    products: <ProductsTab />,
    categories: <CategoriesTab />,
    orders: <OrdersTab />,
    riders: <RidersTab />,
    customers: <CustomersTab />,
    coupons: <CouponsTab />,
    banners: <BannersTab />,
    settings: <SettingsTab />,
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#faf8f5", fontFamily: "Inter, sans-serif" }}>
      {/* ─── Sidebar ─────────────────────────────────────────────── */}
      <aside style={{
        width: sidebarCollapsed ? "68px" : "240px",
        background: "linear-gradient(180deg, #0f172a 0%, #1a1210 100%)",
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
              <div style={{ fontSize: "0.6rem", color: "#fde68a", fontWeight: 700, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>SUPER ADMIN</div>
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

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.07)",
              border: "none",
              borderRadius: "8px",
              padding: "7px",
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              fontSize: "0.78rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            {sidebarCollapsed ? "→" : "← Collapse"}
          </button>
        </div>
      </aside>

      {/* ─── Main Content ────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: isMobile ? "16px 12px" : "28px 24px", overflowY: "auto", minWidth: 0, width: "100%", boxSizing: "border-box" }}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "14px" }}>
          <div>
            <div style={{ fontSize: "0.78rem", color: "#73695b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>
              Super Admin Portal · Teffes Headquarters
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#171410", display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined text-[24px] text-primary">{TABS.find(t => t.key === activeTab)?.icon}</span>
              <span>{TABS.find(t => t.key === activeTab)?.label}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "10px", padding: "8px 14px", fontSize: "0.8rem", color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>All Systems Normal</span>
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
