"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, clearAuth } from "@/lib/auth";
import type { User } from "@/lib/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPowerOff } from "@fortawesome/free-solid-svg-icons";
import api from "@/lib/api";

// ─── Icon helpers ──────────────────────────────────────────────────────────────
const Icon = ({ emoji, size = "1.2rem" }: { emoji: string; size?: string }) => (
  <span style={{ fontSize: size, lineHeight: 1, display: "inline-block" }}>{emoji}</span>
);

// ─── Sidebar navigation items ──────────────────────────────────────────────────
const TABS = [
  { key: "dashboard",    label: "Dashboard",        icon: "dashboard" },
  { key: "stores",       label: "Stores",            icon: "storefront" },
  { key: "store-admins", label: "Store Admins",      icon: "admin_panel_settings" },
  { key: "products",     label: "Products",          icon: "restaurant" },
  { key: "categories",   label: "Categories",        icon: "category" },
  { key: "orders",       label: "All Orders",        icon: "local_shipping" },
  { key: "riders",       label: "Riders",            icon: "two_wheeler" },
  { key: "customers",    label: "Customers",         icon: "group" },
  { key: "coupons",      label: "Coupons & Offers",  icon: "sell" },
  { key: "settings",     label: "Settings",          icon: "settings" },
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
      const storeId = `S00${stores.length + 1}`;
      await api.post("/super-admin/stores", { storeId, ...newStore });
      fetchStores();
      setShowAddStoreModal(false);
      setNewStore(initialStoreForm);
    } catch (err) {
      alert("Failed to create store");
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
                {["Store ID", "Name", "City", "Store Admin", "Today's Orders", "Phone", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "#423b32", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stores.map((s, i) => (
                <tr key={s.storeId || s.id} style={{ borderBottom: i < stores.length - 1 ? "1px solid #ede8e0" : "none" }}>
                  <td style={{ padding: "14px 16px", color: "#73695b", fontWeight: 600 }}>{s.storeId || s.id}</td>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#171410" }}>{s.name}</td>
                  <td style={{ padding: "14px 16px", color: "#423b32" }}>{s.city}</td>
                  <td style={{ padding: "14px 16px", color: "#423b32" }}>{s.admin || "—"}</td>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#941717" }}>{s.orders || 0}</td>
                  <td style={{ padding: "14px 16px", color: "#423b32" }}>{s.phone || "—"}</td>
                  <td style={{ padding: "14px 16px" }}><Badge label={s.status} color={s.status === "Active" ? "#059669" : "#d97706"} /></td>
                  <td style={{ padding: "14px 16px" }}>
                    <button
                      onClick={() => {
                        setEditingStore({
                          ...s,
                          name: s.name || "",
                          phone: s.phone || "",
                          address: s.address || "",
                          city: s.city || "Ranchi",
                          timings: s.timings || "08:00 AM - 08:00 PM",
                          status: s.status || "Active",
                          pickupEnabled: s.pickupEnabled !== false,
                          deliveryEnabled: s.deliveryEnabled !== false,
                        });
                      }}
                      className="btn"
                      style={{ padding: "5px 12px", fontSize: "12px", marginRight: "8px", background: "#f5f3ef", border: "1px solid #ede8e0", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setStoreToDelete(s)}
                      className="btn"
                      style={{ padding: "5px 12px", fontSize: "12px", color: "#dc2626", background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
                    >
                      Delete
                    </button>
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
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#171410" }}>🏪 Add New Store Branch</h3>
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
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#171410" }}>✏️ Edit Store</h3>
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
              <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: "50%", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                ⚠️
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
                  <td style={{ padding: "14px 16px" }}>
                    <button
                      onClick={() => setEditingAdmin({ ...a, password: "" })}
                      className="btn"
                      style={{ padding: "5px 12px", fontSize: "12px", marginRight: "8px", background: "#f5f3ef", border: "1px solid #ede8e0", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setAdminToDelete(a)}
                      className="btn"
                      style={{ padding: "5px 12px", fontSize: "12px", color: "#dc2626", background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
                    >
                      Delete
                    </button>
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
            <h3 style={{ margin: "0 0 16px 0", fontSize: "1.25rem", fontWeight: 800, color: "#171410" }}>👤 Create Store Admin</h3>
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
            <h3 style={{ margin: "0 0 16px 0", fontSize: "1.25rem", fontWeight: 800, color: "#171410" }}>✏️ Edit Store Admin</h3>
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
              <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: "50%", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                ⚠️
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

function ProductsTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProds = () => {
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
    fetchProds();
  }, []);

  const toggleStock = async (id: string, current: boolean) => {
    try {
      await api.put(`/products/${id}`, { inStock: !current });
      fetchProds();
    } catch (err) {
      alert("Failed to toggle status");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <SectionTitle title="Products" sub="Master catalog across all Teffes stores" />
      </div>
      <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#73695b" }}>Loading products catalog…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#faf8f5", borderBottom: "1px solid #ede8e0" }}>
                {["Product", "Category", "Net Weight", "Price", "Badge", "Status", "Action"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "#423b32", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: i < products.length - 1 ? "1px solid #ede8e0" : "none" }}>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#171410" }}>{p.name}</td>
                  <td style={{ padding: "14px 16px", color: "#423b32" }}>{p.categoryLabel || p.category}</td>
                  <td style={{ padding: "14px 16px", color: "#73695b" }}>{p.netWeight}</td>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#941717" }}>₹{p.price}</td>
                  <td style={{ padding: "14px 16px" }}>{p.badge ? <Badge label={p.badge} color="#d97706" /> : "—"}</td>
                  <td style={{ padding: "14px 16px" }}><Badge label={p.inStock ? "In Stock" : "Out of Stock"} color={p.inStock ? "#059669" : "#d97706"} /></td>
                  <td style={{ padding: "14px 16px" }}>
                    <button
                      onClick={() => toggleStock(p.id, p.inStock)}
                      style={{ background: "none", border: "1px solid #ede8e0", borderRadius: "6px", padding: "4px 10px", fontSize: "0.775rem", cursor: "pointer", color: "#423b32" }}
                    >
                      Toggle Stock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CategoriesTab() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ success: boolean; categories: any[] }>("/categories")
      .then(res => {
        if (res.data.success) {
          setCategories(res.data.categories || []);
        }
      })
      .catch(err => console.warn("Failed to fetch categories:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <SectionTitle title="Categories" sub="Manage butchery categories and display order" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
        {categories.map(c => (
          <div key={c.slug} style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
              <span style={{ fontSize: "2rem" }}>{c.icon}</span>
              <div>
                <div style={{ fontWeight: 800, color: "#171410", fontSize: "1.05rem" }}>{c.name}</div>
                <div style={{ color: "#73695b", fontSize: "0.75rem" }}>Slug: {c.slug}</div>
              </div>
            </div>
            <div style={{ color: "#73695b", fontSize: "0.85rem" }}>{c.tagline}</div>
          </div>
        ))}
      </div>
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
                {["Order ID", "Customer", "Store", "Amount", "Slot", "Payment", "Status"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "#423b32", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={o.orderId || i} style={{ borderBottom: i < orders.length - 1 ? "1px solid #ede8e0" : "none" }}>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#171410" }}>#{o.orderId}</td>
                  <td style={{ padding: "14px 16px", color: "#423b32" }}>{o.customer?.name} ({o.customer?.phone})</td>
                  <td style={{ padding: "14px 16px", color: "#423b32" }}>{o.storeName || o.storeId}</td>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#941717" }}>₹{o.amount}</td>
                  <td style={{ padding: "14px 16px", color: "#73695b", fontSize: "0.8rem" }}>{o.deliverySlot}</td>
                  <td style={{ padding: "14px 16px", color: "#423b32" }}>{o.paymentMethod}</td>
                  <td style={{ padding: "14px 16px" }}><Badge label={o.status} color={o.status === "Delivered" ? "#059669" : o.status === "Pending" ? "#941717" : "#d97706"} /></td>
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
  const [loading, setLoading] = useState(true);
  const [showAddRiderModal, setShowAddRiderModal] = useState(false);
  const [newRider, setNewRider] = useState({
    name: "",
    phone: "",
    vehicleNumber: "",
    storeId: "S001",
  });
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <SectionTitle title="Delivery Riders" sub="Manage express delivery delivery staff" />
        <button onClick={() => setShowAddRiderModal(true)} className="btn btn-primary" style={{ fontSize: "0.875rem" }}>+ Add Rider</button>
      </div>
      <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#73695b" }}>Loading riders…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#faf8f5", borderBottom: "1px solid #ede8e0" }}>
                {["Rider Name", "Phone", "Vehicle Number", "Assigned Store", "Live Shift Status"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "#423b32", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {riders.map((r, i) => (
                <tr key={r.phone || i} style={{ borderBottom: i < riders.length - 1 ? "1px solid #ede8e0" : "none" }}>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "#171410" }}>{r.name}</td>
                  <td style={{ padding: "14px 16px", color: "#423b32" }}>{r.phone}</td>
                  <td style={{ padding: "14px 16px", color: "#73695b" }}>{r.vehicleNumber || "JH01-EC-4821"}</td>
                  <td style={{ padding: "14px 16px", color: "#423b32" }}>{r.storeName || "Kishore Ganj"}</td>
                  <td style={{ padding: "14px 16px" }}><Badge label={r.riderStatus || "Available"} color={r.riderStatus === "Available" ? "#059669" : "#0284c7"} /></td>
                </tr>
              ))}
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
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#171410" }}>🛵 Add Delivery Rider</h3>
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
  const [showAddCouponModal, setShowAddCouponModal] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    discount: "",
    discountValue: 20,
    minOrder: 399,
  });
  const [submitting, setSubmitting] = useState(false);

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

  const handleAddCoupon = async () => {
    if (!newCoupon.code.trim()) {
      alert("Please enter a coupon code");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/super-admin/coupons", {
        code: newCoupon.code.toUpperCase(),
        discount: newCoupon.discount || `${newCoupon.discountValue}% off on ₹${newCoupon.minOrder}`,
        discountValue: Number(newCoupon.discountValue) || 20,
        minOrder: Number(newCoupon.minOrder) || 399,
        status: "Active",
      });
      fetchCoupons();
      setShowAddCouponModal(false);
      setNewCoupon({ code: "", discount: "", discountValue: 20, minOrder: 399 });
    } catch (err) {
      alert("Failed to add coupon");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <SectionTitle title="Coupons & Offers" sub="Discount codes and marketing promotions" />
        <button onClick={() => setShowAddCouponModal(true)} className="btn btn-primary" style={{ fontSize: "0.875rem" }}>+ Create Coupon</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
        {coupons.map(c => (
          <div key={c.code} style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: "14px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "1.1rem", fontWeight: 900, color: "#941717", fontFamily: "Outfit, sans-serif" }}>{c.code}</span>
              <Badge label={c.status} color={c.status === "Active" ? "#059669" : "#73695b"} />
            </div>
            <div style={{ color: "#423b32", fontSize: "0.875rem", marginBottom: "6px" }}>{c.discount}</div>
            <div style={{ fontSize: "0.75rem", color: "#73695b" }}>Used {c.used || 0} times · Valid till {c.validTill}</div>
          </div>
        ))}
      </div>

      {/* ─── ADD COUPON MODAL ─── */}
      {showAddCouponModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "16px", width: "100%", maxWidth: "440px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#171410" }}>🎟️ Create New Coupon</h3>
              <button onClick={() => setShowAddCouponModal(false)} style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#73695b" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Promo Code *</label>
                <input
                  type="text"
                  placeholder="e.g. MEAT25"
                  value={newCoupon.code}
                  onChange={e => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", fontWeight: 700, letterSpacing: "1px", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Discount %</label>
                  <input
                    type="number"
                    placeholder="20"
                    value={newCoupon.discountValue}
                    onChange={e => setNewCoupon({ ...newCoupon, discountValue: Number(e.target.value) })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Min Order (₹)</label>
                  <input
                    type="number"
                    placeholder="399"
                    value={newCoupon.minOrder}
                    onChange={e => setNewCoupon({ ...newCoupon, minOrder: Number(e.target.value) })}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#423b32", marginBottom: "4px" }}>Display Description</label>
                <input
                  type="text"
                  placeholder="e.g. 25% off on orders above ₹499"
                  value={newCoupon.discount}
                  onChange={e => setNewCoupon({ ...newCoupon, discount: e.target.value })}
                  style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1cbbf", width: "100%", fontSize: "0.9rem", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setShowAddCouponModal(false)} disabled={submitting} style={{ padding: "8px 16px", borderRadius: "8px" }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddCoupon} disabled={submitting} style={{ padding: "8px 20px", borderRadius: "8px" }}>
                {submitting ? "Creating…" : "Create Coupon"}
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

// ─── Main Super Admin Page ──────────────────────────────────────────────────────
export default function SuperAdminPage() {
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
    dashboard:    <DashboardTab />,
    stores:       <StoresTab />,
    "store-admins": <StoreAdminsTab />,
    products:     <ProductsTab />,
    categories:   <CategoriesTab />,
    orders:       <OrdersTab />,
    riders:       <RidersTab />,
    customers:    <CustomersTab />,
    coupons:      <CouponsTab />,
    settings:     <SettingsTab />,
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
