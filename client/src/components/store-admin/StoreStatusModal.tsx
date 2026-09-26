"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { toast } from "@/lib/toast";

interface StoreStatusModalProps {
  isOpenModal: boolean;
  onClose: () => void;
  onStatusChange?: (storeData: any) => void;
}

export default function StoreStatusModal({ isOpenModal, onClose, onStatusChange }: StoreStatusModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storeOpen, setStoreOpen] = useState(true);
  const [timings, setTimings] = useState("08:00 AM - 08:00 PM");
  const [emergencyNotice, setEmergencyNotice] = useState("");
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);

  useEffect(() => {
    if (!isOpenModal) return;
    setLoading(true);
    api.get<{ success: boolean; store: any }>("/store-admin/store-status")
      .then((res) => {
        if (res.data.success && res.data.store) {
          const s = res.data.store;
          setStoreOpen(s.isOpen !== false);
          setTimings(s.timings || "08:00 AM - 08:00 PM");
          setEmergencyNotice(s.emergencyNotice || "");
          setPickupEnabled(s.pickupEnabled !== false);
          setDeliveryEnabled(s.deliveryEnabled !== false);
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch store status:", err);
      })
      .finally(() => setLoading(false));
  }, [isOpenModal]);

  if (!isOpenModal) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.patch<{ success: boolean; store: any }>("/store-admin/store-status", {
        isOpen: storeOpen,
        timings,
        emergencyNotice,
        pickupEnabled,
        deliveryEnabled,
      });

      if (res.data.success) {
        toast.success(
          storeOpen ? "Store is now LIVE and accepting orders" : "Store is now PAUSED (Taking orders disabled)",
          "Store Status Updated"
        );
        if (onStatusChange) onStatusChange(res.data.store);
        onClose();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update store status", "Update Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[24px]">storefront</span>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Store Operational Control</h3>
              <p className="text-xs text-gray-500">Kishore Ganj Central Butchery Hub</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading store settings…</div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Live Store Status Switch */}
            <div className={`p-4 rounded-xl border transition-all ${storeOpen ? "bg-emerald-50/80 border-emerald-200" : "bg-rose-50/80 border-rose-200"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full animate-pulse ${storeOpen ? "bg-emerald-500" : "bg-rose-500"}`} />
                    <span className="font-extrabold text-sm text-gray-900">
                      {storeOpen ? "STORE ONLINE (Accepting Orders)" : "STORE PAUSED (Emergency Halt)"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {storeOpen
                      ? "Website and apps allow orders. Delivery slots are active."
                      : "New orders will be blocked on customer apps and website."}
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer ml-3">
                  <input
                    type="checkbox"
                    checked={storeOpen}
                    onChange={(e) => setStoreOpen(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {/* Timings */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Operating Hours
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-[18px]">
                  schedule
                </span>
                <input
                  type="text"
                  value={timings}
                  onChange={(e) => setTimings(e.target.value)}
                  placeholder="e.g. 08:00 AM - 08:00 PM"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">Displayed to customers on the header and checkout.</p>
            </div>

            {/* Emergency Notice / Banner */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Emergency Banner / Closure Notice (Optional)
              </label>
              <textarea
                rows={2}
                value={emergencyNotice}
                onChange={(e) => setEmergencyNotice(e.target.value)}
                placeholder="e.g., Heavy rain delay: orders may take 15 mins extra, or Counter closed for sanitization."
                className="w-full p-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              />
              <p className="text-[11px] text-gray-500 mt-0.5">
                If filled, an announcement banner appears on top of the website and apps.
              </p>
            </div>

            {/* Channel Toggles */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deliveryEnabled}
                  onChange={(e) => setDeliveryEnabled(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-xs font-bold text-gray-700">🛵 Home Delivery</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pickupEnabled}
                  onChange={(e) => setPickupEnabled(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-xs font-bold text-gray-700">🏪 Store Pickup</span>
              </label>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-dark rounded-xl shadow-md transition-all disabled:opacity-50"
          >
            {saving ? "Saving…" : "Apply Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
