"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import api from "@/lib/api";
import axios from "axios";
import { toast } from "@/lib/toast";

export interface PopupItem {
  id?: string;
  _id?: string;
  title: string;
  subtitle?: string;
  message?: string;
  imageUrl?: string;
  ctaText?: string;
  ctaLink?: string;
  couponCode?: string;
  targetAudience?: "ALL" | "GUEST" | "LOGGED_IN" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
  startDate?: string | null;
  endDate?: string | null;
  frequency?: "ONCE_PER_DAY" | "ONCE_PER_SESSION" | "ALWAYS";
  priority?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const INITIAL_POPUP: PopupItem = {
  title: "",
  subtitle: "",
  message: "",
  imageUrl: "",
  ctaText: "Shop Now",
  ctaLink: "/category",
  couponCode: "",
  targetAudience: "ALL",
  startDate: "",
  endDate: "",
  frequency: "ONCE_PER_DAY",
  priority: 1,
  isActive: true,
};

export default function PromotionalPopupsTab() {
  const [popups, setPopups] = useState<PopupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingPopup, setEditingPopup] = useState<PopupItem | null>(null);
  const [formData, setFormData] = useState<PopupItem>(INITIAL_POPUP);
  const [submitting, setSubmitting] = useState(false);

  // File upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showManualUrlInput, setShowManualUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live customer preview modal state
  const [previewingPopup, setPreviewingPopup] = useState<PopupItem | null>(null);

  const fetchPopups = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; popups: PopupItem[] }>("/super-admin/popups");
      if (res.data?.success) {
        setPopups(res.data.popups || []);
      }
    } catch (err: any) {
      console.warn("Failed to load popups:", err);
      toast.error(err.response?.data?.message || "Failed to load promotional pop-ups", "Fetch Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPopups();
  }, []);

  const openCreateModal = () => {
    setEditingPopup(null);
    setFormData({
      ...INITIAL_POPUP,
      priority: popups.length + 1,
    });
    setShowManualUrlInput(false);
    setShowModal(true);
  };

  const openEditModal = (p: PopupItem) => {
    setEditingPopup(p);
    setFormData({
      title: p.title || "",
      subtitle: p.subtitle || "",
      message: p.message || "",
      imageUrl: p.imageUrl || "",
      ctaText: p.ctaText || "Shop Now",
      ctaLink: p.ctaLink || "/categories",
      couponCode: p.couponCode || "",
      targetAudience: p.targetAudience || "ALL",
      startDate: p.startDate ? p.startDate.substring(0, 16) : "",
      endDate: p.endDate ? p.endDate.substring(0, 16) : "",
      frequency: p.frequency || "ONCE_PER_DAY",
      priority: typeof p.priority === "number" ? p.priority : 1,
      isActive: Boolean(p.isActive),
    });
    setShowManualUrlInput(Boolean(p.imageUrl && !p.imageUrl.includes("firebasestorage")));
    setShowModal(true);
  };

  // ─── Local Image File Upload to Firebase Storage ──────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 15MB for popup image)
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image file is too large. Max size is 15MB.", "File Too Large");
      return;
    }

    setUploadingImage(true);
    const uploadData = new FormData();
    uploadData.append("file", file);
    uploadData.append("folder", "popups");

    try {
      let publicUrl = "";

      // 1. Primary: Backend endpoint (streams directly into Firebase Storage)
      try {
        const res = await api.post<{ success: boolean; url: string }>("/upload", uploadData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        if (res.data?.success && res.data.url) {
          publicUrl = res.data.url;
        }
      } catch (primaryErr: any) {
        // Fallback 1: Local server port if proxy path mismatch
        if (
          primaryErr.response?.status === 404 ||
          primaryErr.response?.data?.message?.includes("not found") ||
          primaryErr.code === "ERR_NETWORK"
        ) {
          try {
            const localRes = await axios.post<{ success: boolean; url: string }>(
              "http://localhost:5000/api/upload",
              uploadData,
              { headers: { "Content-Type": "multipart/form-data" } }
            );
            if (localRes.data?.success && localRes.data.url) {
              publicUrl = localRes.data.url;
            }
          } catch (localErr: any) {
            console.warn("[Upload] Local upload fallback failed, trying direct Firebase...", localErr);
          }
        }

        // Fallback 2: Direct browser upload to Firebase Storage
        if (!publicUrl) {
          try {
            const { getStorage, ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
            const { firebaseApp } = await import("@/lib/firebase");
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
            const storageRef = ref(getStorage(firebaseApp), `popups/${Date.now()}-${safeName}`);
            const snapshot = await uploadBytes(storageRef, file);
            publicUrl = await getDownloadURL(snapshot.ref);
          } catch (fbErr: any) {
            console.warn("[Upload] Direct Firebase Storage upload failed:", fbErr);
          }
        }

        if (!publicUrl) {
          throw primaryErr;
        }
      }

      if (publicUrl) {
        setFormData((prev) => ({ ...prev, imageUrl: publicUrl }));
        toast.success("Image uploaded to Firebase Storage successfully!", "Upload Complete");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to upload image", "Upload Error");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, imageUrl: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Please provide a title for the pop-up", "Validation Error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
      };

      if (editingPopup && (editingPopup._id || editingPopup.id)) {
        const id = editingPopup._id || editingPopup.id;
        const res = await api.put(`/super-admin/popups/${id}`, payload);
        if (res.data?.success) {
          toast.success("Promotional pop-up updated successfully", "Updated");
          setShowModal(false);
          fetchPopups();
        }
      } else {
        const res = await api.post("/super-admin/popups", payload);
        if (res.data?.success) {
          toast.success("Promotional pop-up created successfully", "Created");
          setShowModal(false);
          fetchPopups();
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save promotional pop-up", "Save Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (p: PopupItem) => {
    const id = p._id || p.id;
    if (!id) return;
    try {
      await api.put(`/super-admin/popups/${id}`, { isActive: !p.isActive });
      toast.success(`Pop-up marked as ${!p.isActive ? "Active" : "Inactive"}`, "Status Changed");
      setPopups((prev) => prev.map((item) => ((item._id || item.id) === id ? { ...item, isActive: !p.isActive } : item)));
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to toggle status", "Update Error");
    }
  };

  const handleDelete = (p: PopupItem) => {
    const id = p._id || p.id;
    if (!id) return;
    toast.confirm({
      title: "Delete Promotional Pop-up?",
      message: `Are you sure you want to delete "${p.title}"? This cannot be undone.`,
      confirmText: "Delete Pop-up",
      type: "danger",
      onConfirm: async () => {
        try {
          await api.delete(`/super-admin/popups/${id}`);
          toast.success("Pop-up deleted successfully", "Deleted");
          setPopups((prev) => prev.filter((item) => (item._id || item.id) !== id));
        } catch (err: any) {
          toast.error(err.response?.data?.message || "Failed to delete pop-up", "Delete Error");
        }
      },
    });
  };

  // Filtered list
  const filteredPopups = useMemo(() => {
    if (filter === "ACTIVE") return popups.filter((p) => p.isActive);
    if (filter === "INACTIVE") return popups.filter((p) => !p.isActive);
    return popups;
  }, [popups, filter]);

  const activeCount = useMemo(() => popups.filter((p) => p.isActive).length, [popups]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* ─── Top KPI & Action Bar ────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
          background: "#fff",
          padding: "16px 20px",
          borderRadius: "14px",
          border: "1px solid #ede8e0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#fee2e2",
              color: "#941717",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="material-symbols-outlined text-[22px]">campaign</span>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#171410" }}>
              Promotional Pop-ups & Announcements
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "#73695b" }}>
              Total: <strong>{popups.length}</strong> | Active:{" "}
              <strong style={{ color: "#15803d" }}>{activeCount}</strong>
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Filter Chips */}
          <div style={{ display: "flex", background: "#f3f0ea", padding: "3px", borderRadius: "8px" }}>
            {(["ALL", "ACTIVE", "INACTIVE"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: filter === mode ? "#fff" : "transparent",
                  color: filter === mode ? "#171410" : "#73695b",
                  boxShadow: filter === mode ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 120ms ease",
                }}
              >
                {mode === "ALL" ? "All" : mode === "ACTIVE" ? "Active" : "Inactive"}
              </button>
            ))}
          </div>

          <button
            onClick={openCreateModal}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 18px",
              borderRadius: "9px",
              fontWeight: 700,
              fontSize: "0.825rem",
              cursor: "pointer",
              backgroundColor: "#941717",
              color: "#fff",
              border: "none",
              boxShadow: "0 2px 6px rgba(148,23,23,0.25)",
            }}
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Create New Pop-up
          </button>
        </div>
      </div>

      {/* ─── Cards Grid ──────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#73695b" }}>
          Loading promotional pop-ups…
        </div>
      ) : filteredPopups.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            background: "#fff",
            borderRadius: "14px",
            border: "1px solid #ede8e0",
          }}
        >
          <span className="material-symbols-outlined text-[48px]" style={{ color: "#a89f91", marginBottom: "12px" }}>
            campaign
          </span>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#171410" }}>
            {filter === "ALL" ? "No Promotional Pop-ups Yet" : `No ${filter.toLowerCase()} pop-ups`}
          </h3>
          <p style={{ color: "#73695b", fontSize: "0.85rem", marginTop: "4px" }}>
            Create an announcement, flash sale alert, or festival banner to engage visitors on your storefront.
          </p>
          {filter === "ALL" && (
            <button
              onClick={openCreateModal}
              style={{
                marginTop: "16px",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 18px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                backgroundColor: "#941717",
                color: "#fff",
                border: "none",
              }}
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              Create First Pop-up
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
          {filteredPopups.map((p) => {
            const id = p._id || p.id;
            const isAudienceTier = ["BRONZE", "SILVER", "GOLD", "PLATINUM"].includes(p.targetAudience || "");

            return (
              <div
                key={id}
                style={{
                  background: "#fff",
                  borderRadius: "14px",
                  border: `1px solid ${p.isActive ? "#ede8e0" : "#f1f1f1"}`,
                  overflow: "hidden",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                  display: "flex",
                  flexDirection: "column",
                  opacity: p.isActive ? 1 : 0.75,
                  transition: "all 150ms ease",
                }}
              >
                {/* Visual Header / Banner Preview */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "160px",
                    background: "linear-gradient(135deg, #1f1b18 0%, #2e2621 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div style={{ textAlign: "center", padding: "16px", color: "rgba(255,255,255,0.7)" }}>
                      <span className="material-symbols-outlined text-[36px]" style={{ color: "#ea580c" }}>
                        announcement
                      </span>
                      <div style={{ fontSize: "0.8rem", fontWeight: 600, marginTop: "4px" }}>
                        Text Announcement (No Image)
                      </div>
                    </div>
                  )}

                  {/* Status Badge in corner */}
                  <div
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      background: p.isActive ? "rgba(22, 101, 52, 0.9)" : "rgba(100, 116, 139, 0.9)",
                      backdropFilter: "blur(4px)",
                      color: "#fff",
                      padding: "3px 10px",
                      borderRadius: "99px",
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {p.isActive ? "Active" : "Inactive"}
                  </div>

                  {/* Audience Pill */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: "10px",
                      left: "10px",
                      background: isAudienceTier ? "rgba(217, 119, 6, 0.92)" : "rgba(15, 23, 42, 0.85)",
                      backdropFilter: "blur(4px)",
                      color: "#fff",
                      padding: "3px 10px",
                      borderRadius: "6px",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {isAudienceTier ? "workspace_premium" : "groups"}
                    </span>
                    {p.targetAudience === "ALL"
                      ? "All Visitors"
                      : p.targetAudience === "GUEST"
                        ? "Guests Only"
                        : p.targetAudience === "LOGGED_IN"
                          ? "Logged-in Users"
                          : `${p.targetAudience} Tier Only`}
                  </div>
                </div>

                {/* Body Details */}
                <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#171410" }}>{p.title}</h4>
                  {p.subtitle && (
                    <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", fontWeight: 600, color: "#941717" }}>
                      {p.subtitle}
                    </p>
                  )}
                  {p.message && (
                    <p
                      style={{
                        margin: "6px 0 0 0",
                        fontSize: "0.78rem",
                        color: "#574e43",
                        lineHeight: 1.4,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {p.message}
                    </p>
                  )}

                  {/* Metadata Chips */}
                  <div
                    style={{
                      marginTop: "12px",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      fontSize: "0.72rem",
                      color: "#73695b",
                    }}
                  >
                    {p.couponCode && (
                      <span
                        style={{
                          background: "#fef3c7",
                          color: "#92400e",
                          border: "1px dashed #f59e0b",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontWeight: 700,
                        }}
                      >
                        Code: {p.couponCode}
                      </span>
                    )}

                    <span
                      style={{
                        background: "#f3f0ea",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontWeight: 600,
                      }}
                    >
                      {p.frequency === "ONCE_PER_DAY"
                        ? "Once / Day"
                        : p.frequency === "ONCE_PER_SESSION"
                          ? "Once / Session"
                          : "Every Visit"}
                    </span>

                    {p.priority !== undefined && (
                      <span
                        style={{
                          background: "#f3f0ea",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontWeight: 600,
                        }}
                      >
                        Priority: {p.priority}
                      </span>
                    )}
                  </div>

                  {/* Schedule dates info */}
                  {(p.startDate || p.endDate) && (
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "0.7rem",
                        color: "#8c8275",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span className="material-symbols-outlined text-[13px]">date_range</span>
                      <span>
                        {p.startDate ? new Date(p.startDate).toLocaleDateString("en-IN") : "Now"} →{" "}
                        {p.endDate ? new Date(p.endDate).toLocaleDateString("en-IN") : "Forever"}
                      </span>
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: "14px",
                      borderTop: "1px solid #f0ede8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                    }}
                  >
                    {/* Toggle Active Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(p)}
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        padding: "5px 10px",
                        borderRadius: "6px",
                        border: `1px solid ${p.isActive ? "#bbf7d0" : "#cbd5e1"}`,
                        background: p.isActive ? "#f0fdf4" : "#f8fafc",
                        color: p.isActive ? "#166534" : "#475569",
                        cursor: "pointer",
                      }}
                    >
                      {p.isActive ? "Deactivate" : "Activate"}
                    </button>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {/* Customer Preview Button */}
                      <button
                        type="button"
                        onClick={() => setPreviewingPopup(p)}
                        title="Preview Customer Modal"
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          border: "1px solid #e0e7ff",
                          background: "#eef2ff",
                          color: "#4338ca",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                        Preview
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        title="Edit Pop-up"
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          border: "1px solid #fed7aa",
                          background: "#fff7ed",
                          color: "#c2410c",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                        Edit
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        title="Delete Pop-up"
                        style={{
                          padding: "5px 8px",
                          borderRadius: "6px",
                          border: "1px solid #fecaca",
                          background: "#fef2f2",
                          color: "#dc2626",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Create / Edit Pop-up Modal ────────────────────────────────────── */}
      {showModal && (
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
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "18px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "92vh",
              overflowY: "auto",
              padding: "26px 28px",
              boxShadow: "0 20px 45px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "20px",
                paddingBottom: "14px",
                borderBottom: "1px solid #ede8e0",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#171410" }}>
                  {editingPopup ? "Edit Promotional Pop-up" : "Create New Promotional Pop-up"}
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "#73695b" }}>
                  Display a visual announcement or offer modal to customers when opening the storefront.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  background: "#f3f0ea",
                  border: "none",
                  borderRadius: "8px",
                  width: "32px",
                  height: "32px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* ─── SECTION 1: Headline & Message ─── */}
              <div
                style={{
                  background: "#faf8f5",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #f0ede8",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#941717", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  1. Pop-up Headline & Message
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#2b251e", marginBottom: "4px" }}>
                      Pop-up Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sunday Fresh Meat Festival!"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.85rem",
                        boxSizing: "border-box",
                      }}
                    />
                    <span style={{ fontSize: "0.72rem", color: "#73695b", marginTop: "3px", display: "block" }}>
                      Main bold headline shown at the top of the modal.
                    </span>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#2b251e", marginBottom: "4px" }}>
                      Subtitle / Offer Tagline
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Flat 20% OFF on all Mutton cuts"
                      value={formData.subtitle || ""}
                      onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.85rem",
                        boxSizing: "border-box",
                      }}
                    />
                    <span style={{ fontSize: "0.72rem", color: "#73695b", marginTop: "3px", display: "block" }}>
                      Highlighted sub-header (shown in maroon color).
                    </span>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#2b251e", marginBottom: "4px" }}>
                    Detailed Message / Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Order fresh cuts today and enjoy express 45-min delivery across Ranchi."
                    value={formData.message || ""}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                  <span style={{ fontSize: "0.72rem", color: "#73695b", marginTop: "3px", display: "block" }}>
                    Optional details, timing, or terms shown under the headline.
                  </span>
                </div>
              </div>

              {/* ─── SECTION 2: Banner Image (Local Upload from Laptop) ─── */}
              <div
                style={{
                  background: "#faf8f5",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #f0ede8",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#941717", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    2. Banner Image (Upload from Laptop)
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowManualUrlInput((v) => !v)}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#64748b",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    {showManualUrlInput ? "Hide URL input" : "Or paste image link directly"}
                  </button>
                </div>

                {/* Upload from Local Device Box */}
                {!formData.imageUrl ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: "2px dashed #cbd5e1",
                      borderRadius: "10px",
                      padding: "24px 20px",
                      textAlign: "center",
                      background: "#fff",
                      cursor: uploadingImage ? "not-allowed" : "pointer",
                      transition: "all 150ms ease",
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      style={{ display: "none" }}
                      disabled={uploadingImage}
                    />

                    {uploadingImage ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                        <span className="material-symbols-outlined text-[32px] animate-spin" style={{ color: "#941717" }}>
                          progress_activity
                        </span>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#171410" }}>
                          Uploading to Firebase Storage…
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#73695b" }}>Please wait a moment</div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "12px",
                            background: "#fee2e2",
                            color: "#941717",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
                        </div>
                        <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#171410", marginTop: "4px" }}>
                          Click to Choose Image from Laptop
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#73695b" }}>
                          Supports JPG, PNG, WEBP (Saved directly to Firebase Storage)
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Image Uploaded Preview Card */
                  <div
                    style={{
                      position: "relative",
                      borderRadius: "10px",
                      overflow: "hidden",
                      border: "1px solid #cbd5e1",
                      background: "#181412",
                      maxHeight: "200px",
                    }}
                  >
                    <img
                      src={formData.imageUrl}
                      alt="Uploaded Banner Preview"
                      style={{ width: "100%", height: "180px", objectFit: "cover", display: "block" }}
                    />

                    {/* Action buttons overlay */}
                    <div
                      style={{
                        position: "absolute",
                        top: "10px",
                        right: "10px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          background: "rgba(0,0,0,0.7)",
                          backdropFilter: "blur(4px)",
                          color: "#fff",
                          border: "1px solid rgba(255,255,255,0.3)",
                          borderRadius: "6px",
                          padding: "5px 10px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span className="material-symbols-outlined text-[13px]">change_circle</span>
                        Change File
                      </button>

                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        style={{
                          background: "rgba(220,38,38,0.85)",
                          backdropFilter: "blur(4px)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "5px 10px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span className="material-symbols-outlined text-[13px]">delete</span>
                        Remove
                      </button>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      style={{ display: "none" }}
                    />
                  </div>
                )}

                {/* Optional Manual URL input */}
                {showManualUrlInput && (
                  <div style={{ marginTop: "4px" }}>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#2b251e", marginBottom: "4px" }}>
                      Or Image URL Directly:
                    </label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={formData.imageUrl || ""}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.825rem",
                        boxSizing: "border-box",
                        background: "#fff",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* ─── SECTION 3: Action Buttons & Coupon Code ─── */}
              <div
                style={{
                  background: "#faf8f5",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #f0ede8",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#941717", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  3. Customer Action & Coupon Link
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#2b251e", marginBottom: "4px" }}>
                      CTA Button Text
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Shop Now or Claim 20% Off"
                      value={formData.ctaText}
                      onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.85rem",
                        boxSizing: "border-box",
                        background: "#fff",
                      }}
                    />
                    <span style={{ fontSize: "0.72rem", color: "#73695b", marginTop: "3px", display: "block" }}>
                      Text on the big button (e.g. Shop Now).
                    </span>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#2b251e", marginBottom: "4px" }}>
                      CTA Target Link
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. /categories/mutton or /offers"
                      value={formData.ctaLink}
                      onChange={(e) => setFormData({ ...formData, ctaLink: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.85rem",
                        boxSizing: "border-box",
                        background: "#fff",
                      }}
                    />
                    <span style={{ fontSize: "0.72rem", color: "#73695b", marginTop: "3px", display: "block" }}>
                      Where the user goes when clicking the button.
                    </span>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#2b251e", marginBottom: "4px" }}>
                    Highlight Coupon Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MUTTON20"
                    value={formData.couponCode || ""}
                    onChange={(e) => setFormData({ ...formData, couponCode: e.target.value.toUpperCase() })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                      fontFamily: "monospace",
                      fontWeight: 700,
                      background: "#fff",
                    }}
                  />
                  <span style={{ fontSize: "0.72rem", color: "#73695b", marginTop: "3px", display: "block" }}>
                    If entered, shows a coupon voucher box with a 1-tap "COPY" button for the customer.
                  </span>
                </div>
              </div>

              {/* ─── SECTION 4: Audience & Display Rules ─── */}
              <div
                style={{
                  background: "#faf8f5",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #f0ede8",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#941717", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  4. Audience Targeting & Display Timing
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#2b251e", marginBottom: "4px" }}>
                      Target Audience
                    </label>
                    <select
                      value={formData.targetAudience}
                      onChange={(e: any) => setFormData({ ...formData, targetAudience: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.85rem",
                        boxSizing: "border-box",
                        background: "#fff",
                      }}
                    >
                      <option value="ALL">All Customers & Visitors</option>
                      <option value="GUEST">Guests Only (Not Logged In)</option>
                      <option value="LOGGED_IN">Logged-In Customers Only</option>
                      <option value="BRONZE">Bronze Tier Members</option>
                      <option value="SILVER">Silver Tier Members</option>
                      <option value="GOLD">Gold Tier Members</option>
                      <option value="PLATINUM">Platinum Tier Members</option>
                    </select>
                    <span style={{ fontSize: "0.72rem", color: "#73695b", marginTop: "3px", display: "block" }}>
                      Filter who is allowed to see this pop-up modal.
                    </span>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#2b251e", marginBottom: "4px" }}>
                      Display Frequency
                    </label>
                    <select
                      value={formData.frequency}
                      onChange={(e: any) => setFormData({ ...formData, frequency: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.85rem",
                        boxSizing: "border-box",
                        background: "#fff",
                      }}
                    >
                      <option value="ONCE_PER_DAY">Once Per Day (shows "Don't show again today")</option>
                      <option value="ONCE_PER_SESSION">Once Per Session</option>
                      <option value="ALWAYS">Every Page Refresh</option>
                    </select>
                    <span style={{ fontSize: "0.72rem", color: "#73695b", marginTop: "3px", display: "block" }}>
                      Controls how often a user sees it before it gets muted.
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#2b251e", marginBottom: "4px" }}>
                      Start Date & Time (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.startDate || ""}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.825rem",
                        boxSizing: "border-box",
                        background: "#fff",
                      }}
                    />
                    <span style={{ fontSize: "0.72rem", color: "#73695b", marginTop: "3px", display: "block" }}>
                      When the announcement automatically goes live.
                    </span>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#2b251e", marginBottom: "4px" }}>
                      End Date & Time (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.endDate || ""}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.825rem",
                        boxSizing: "border-box",
                        background: "#fff",
                      }}
                    />
                    <span style={{ fontSize: "0.72rem", color: "#73695b", marginTop: "3px", display: "block" }}>
                      When it automatically stops showing to customers.
                    </span>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#2b251e", marginBottom: "4px" }}>
                    Priority (Higher number displays first)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) || 1 })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                      background: "#fff",
                    }}
                  />
                  <span style={{ fontSize: "0.72rem", color: "#73695b", marginTop: "3px", display: "block" }}>
                    If multiple popups are active at the same time, the one with highest priority is displayed.
                  </span>
                </div>
              </div>

              {/* Publish Toggle */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 14px",
                  background: "#faf8f5",
                  borderRadius: "10px",
                  border: "1px solid #ede8e0",
                }}
              >
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#941717" }}
                />
                <div>
                  <label
                    htmlFor="isActiveToggle"
                    style={{ fontSize: "0.85rem", fontWeight: 700, color: "#171410", cursor: "pointer", display: "block" }}
                  >
                    Publish Immediately (Active on Storefront)
                  </label>
                  <span style={{ fontSize: "0.72rem", color: "#73695b" }}>
                    Uncheck to save as draft without showing to customers.
                  </span>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  paddingTop: "14px",
                  borderTop: "1px solid #ede8e0",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#475569",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting || uploadingImage}
                  style={{
                    padding: "9px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#941717",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: (submitting || uploadingImage) ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 6px rgba(148,23,23,0.3)",
                  }}
                >
                  {submitting ? "Saving…" : editingPopup ? "Save Changes" : "Create Pop-up"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Realistic Customer Live Preview Modal ──────────────────────────── */}
      {previewingPopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setPreviewingPopup(null)}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "460px",
              background: "#fff",
              borderRadius: "20px",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
              animation: "fadeInUp 200ms ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setPreviewingPopup(null)}
              style={{
                position: "absolute",
                top: "14px",
                right: "14px",
                zIndex: 10,
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "rgba(0,0,0,0.5)",
                color: "#fff",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            {/* Banner Image */}
            {previewingPopup.imageUrl && (
              <div style={{ width: "100%", height: "220px", background: "#1a1210", position: "relative" }}>
                <img
                  src={previewingPopup.imageUrl}
                  alt={previewingPopup.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            )}

            {/* Content Area */}
            <div style={{ padding: "24px 22px", textAlign: "center" }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.25rem",
                  fontWeight: 800,
                  color: "#171410",
                  fontFamily: "Outfit, sans-serif",
                }}
              >
                {previewingPopup.title}
              </h3>

              {previewingPopup.subtitle && (
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    color: "#941717",
                  }}
                >
                  {previewingPopup.subtitle}
                </div>
              )}

              {previewingPopup.message && (
                <p
                  style={{
                    margin: "10px 0 0 0",
                    fontSize: "0.825rem",
                    color: "#574e43",
                    lineHeight: 1.5,
                  }}
                >
                  {previewingPopup.message}
                </p>
              )}

              {/* Coupon Code Pill */}
              {previewingPopup.couponCode && (
                <div
                  style={{
                    marginTop: "16px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 16px",
                    background: "#fef3c7",
                    border: "1.5px dashed #d97706",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    color: "#92400e",
                    fontFamily: "monospace",
                  }}
                >
                  <span>{previewingPopup.couponCode}</span>
                  <span style={{ fontSize: "0.72rem", color: "#b45309", fontWeight: 600 }}>TAP TO COPY</span>
                </div>
              )}

              {/* Action Button */}
              <div style={{ marginTop: "20px" }}>
                <button
                  type="button"
                  onClick={() => {
                    toast.info(`Clicked: ${previewingPopup.ctaLink || "/categories"}`, "Action Triggered");
                    setPreviewingPopup(null);
                  }}
                  style={{
                    width: "100%",
                    padding: "13px 20px",
                    borderRadius: "12px",
                    border: "none",
                    background: "linear-gradient(135deg, #941717 0%, #7f1d1d 100%)",
                    color: "#fff",
                    fontSize: "0.95rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 8px 18px rgba(148,23,23,0.35)",
                  }}
                >
                  {previewingPopup.ctaText || "Shop Now"}
                </button>
              </div>

              {/* Don't show again today checkbox preview */}
              <div
                style={{
                  marginTop: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  fontSize: "0.75rem",
                  color: "#8c8275",
                }}
              >
                <input type="checkbox" id="previewDontShow" defaultChecked style={{ accentColor: "#941717" }} />
                <label htmlFor="previewDontShow" style={{ cursor: "pointer" }}>
                  Don't show this again today
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
