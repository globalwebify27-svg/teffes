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
  const [storeName, setStoreName] = useState("Store Outlet");
  const [baseDeliveryPay, setBaseDeliveryPay] = useState<number>(65);
  const [distanceIncentive, setDistanceIncentive] = useState<number>(15);
  const [peakHourSurge, setPeakHourSurge] = useState<number>(20);

  // Customer Delivery Fees & Operational Controls
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState<number>(399);
  const [standardDeliveryFee, setStandardDeliveryFee] = useState<number>(40);
  const [expressDeliveryFee, setExpressDeliveryFee] = useState<number>(50);
  const [expressDeliveryEnabled, setExpressDeliveryEnabled] = useState<boolean>(true);
  const [rainSurgeEnabled, setRainSurgeEnabled] = useState<boolean>(false);
  const [rainSurgeFee, setRainSurgeFee] = useState<number>(15);
  const [freeGiftThreshold, setFreeGiftThreshold] = useState<number>(499);
  const [freeGiftName, setFreeGiftName] = useState<string>("Free Biryani Rice (500g)");
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState<number>(5);
  const [defaultRiderDailyTarget, setDefaultRiderDailyTarget] = useState<number>(16);

  useEffect(() => {
    if (!isOpenModal) return;
    setLoading(true);
    api.get<{ success: boolean; store: any }>("/store-admin/store-status")
      .then((res) => {
        if (res.data.success && res.data.store) {
          const s = res.data.store;
          if (s.name) setStoreName(s.name);
          setStoreOpen(s.isOpen !== false);
          setTimings(s.timings || "08:00 AM - 08:00 PM");
          setEmergencyNotice(s.emergencyNotice || "");
          setPickupEnabled(s.pickupEnabled !== false);
          setDeliveryEnabled(s.deliveryEnabled !== false);

          if (typeof s.freeDeliveryThreshold === "number") setFreeDeliveryThreshold(s.freeDeliveryThreshold);
          if (typeof s.standardDeliveryFee === "number") setStandardDeliveryFee(s.standardDeliveryFee);
          if (typeof s.expressDeliveryFee === "number") setExpressDeliveryFee(s.expressDeliveryFee);
          if (typeof s.expressDeliveryEnabled === "boolean") setExpressDeliveryEnabled(s.expressDeliveryEnabled);
          if (typeof s.rainSurgeEnabled === "boolean") setRainSurgeEnabled(s.rainSurgeEnabled);
          if (typeof s.rainSurgeFee === "number") setRainSurgeFee(s.rainSurgeFee);
          if (typeof s.freeGiftThreshold === "number") setFreeGiftThreshold(s.freeGiftThreshold);
          if (s.freeGiftName) setFreeGiftName(s.freeGiftName);
          if (typeof s.deliveryRadiusKm === "number") setDeliveryRadiusKm(s.deliveryRadiusKm);
          if (typeof s.defaultRiderDailyTarget === "number") setDefaultRiderDailyTarget(s.defaultRiderDailyTarget);

          if (s.riderPayoutSettings) {
            if (typeof s.riderPayoutSettings.baseDeliveryPay === "number") setBaseDeliveryPay(s.riderPayoutSettings.baseDeliveryPay);
            if (typeof s.riderPayoutSettings.distanceIncentive === "number") setDistanceIncentive(s.riderPayoutSettings.distanceIncentive);
            if (typeof s.riderPayoutSettings.peakHourSurge === "number") setPeakHourSurge(s.riderPayoutSettings.peakHourSurge);
          }
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
        freeDeliveryThreshold: Number(freeDeliveryThreshold),
        standardDeliveryFee: Number(standardDeliveryFee),
        expressDeliveryFee: Number(expressDeliveryFee),
        expressDeliveryEnabled,
        rainSurgeEnabled,
        rainSurgeFee: Number(rainSurgeFee),
        freeGiftThreshold: Number(freeGiftThreshold),
        freeGiftName,
        deliveryRadiusKm: Number(deliveryRadiusKm),
        defaultRiderDailyTarget: Number(defaultRiderDailyTarget),
        riderPayoutSettings: {
          baseDeliveryPay: Number(baseDeliveryPay),
          distanceIncentive: Number(distanceIncentive),
          peakHourSurge: Number(peakHourSurge),
        },
      });

      if (res.data.success) {
        toast.success(
          "Store operational controls & delivery pricing saved successfully.",
          "Settings Updated"
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
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[24px]">storefront</span>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Store Operational Control</h3>
              <p className="text-xs text-gray-500">{storeName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading store settings…</div>
        ) : (
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {/* Live Store Status Switch */}
            <div className={`p-4 rounded-xl border transition-all ${storeOpen ? "bg-red-50/70 border-red-200" : "bg-gray-50 border-gray-200"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full animate-pulse"
                      style={{ backgroundColor: storeOpen ? "#941717" : "#9ca3af" }}
                    />
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

                <button
                  type="button"
                  role="switch"
                  aria-checked={storeOpen}
                  onClick={() => setStoreOpen(!storeOpen)}
                  style={{
                    width: "48px",
                    height: "26px",
                    borderRadius: "9999px",
                    backgroundColor: storeOpen ? "#941717" : "#cbd5e1",
                    transition: "all 200ms ease",
                    position: "relative",
                    cursor: "pointer",
                    border: "none",
                    padding: 0,
                    outline: "none",
                    flexShrink: 0,
                    boxShadow: storeOpen ? "0 2px 6px rgba(148, 23, 23, 0.35)" : "none",
                  }}
                  title={storeOpen ? "Click to Pause Store" : "Click to Open Store"}
                >
                  <span
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "9999px",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                      position: "absolute",
                      top: "3px",
                      left: "3px",
                      transform: storeOpen ? "translateX(22px)" : "translateX(0px)",
                      transition: "transform 200ms ease",
                      display: "block",
                    }}
                  />
                </button>
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
            <div className={`grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 transition-opacity ${!storeOpen ? "opacity-45" : ""}`}>
              <label className={`flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 transition-all ${!storeOpen ? "cursor-not-allowed bg-gray-50 text-gray-400" : "hover:bg-gray-50 cursor-pointer"}`}>
                <input
                  type="checkbox"
                  disabled={!storeOpen}
                  checked={storeOpen && deliveryEnabled}
                  onChange={(e) => setDeliveryEnabled(e.target.checked)}
                  style={{ accentColor: "#941717" }}
                  className="rounded h-4 w-4 disabled:cursor-not-allowed cursor-pointer"
                />
                <span className={`text-xs font-bold flex items-center gap-1 ${!storeOpen ? "text-gray-400" : "text-gray-700"}`}>
                  <span className="material-symbols-outlined text-[16px] text-primary">two_wheeler</span>
                  <span>Home Delivery</span>
                </span>
              </label>

              <label className={`flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 transition-all ${!storeOpen ? "cursor-not-allowed bg-gray-50 text-gray-400" : "hover:bg-gray-50 cursor-pointer"}`}>
                <input
                  type="checkbox"
                  disabled={!storeOpen}
                  checked={storeOpen && pickupEnabled}
                  onChange={(e) => setPickupEnabled(e.target.checked)}
                  style={{ accentColor: "#941717" }}
                  className="rounded h-4 w-4 disabled:cursor-not-allowed cursor-pointer"
                />
                <span className={`text-xs font-bold flex items-center gap-1 ${!storeOpen ? "text-gray-400" : "text-gray-700"}`}>
                  <span className="material-symbols-outlined text-[16px] text-primary">storefront</span>
                  <span>Store Pickup</span>
                </span>
              </label>
            </div>

            {!storeOpen && (
              <div className="mt-2.5 px-3 py-2 bg-amber-50 border border-amber-200/80 rounded-xl flex items-center gap-2 text-[11px] text-amber-900 font-medium">
                <span className="material-symbols-outlined text-[16px] text-amber-600 shrink-0">lock</span>
                <span>Both fulfillment channels are automatically locked while store is marked offline.</span>
              </div>
            )}

            {/* ─── 1. CUSTOMER DELIVERY FEES & RADIUS ─── */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Customer Delivery Fees & Radius
                </label>
                <span className="text-[10px] text-primary font-bold bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                  Customer Checkout
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mb-2.5">
                Fees and order thresholds shown on website and mobile checkout.
              </p>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-500 block uppercase">Standard Fee</span>
                  <div className="relative mt-1">
                    <span className="absolute left-2 top-1.5 text-xs font-bold text-gray-400">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={standardDeliveryFee}
                      onChange={(e) => setStandardDeliveryFee(Math.max(0, Number(e.target.value)))}
                      className="w-full pl-5 pr-1 py-1 text-sm font-bold border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary text-gray-900"
                    />
                  </div>
                  <span className="text-[9.5px] text-gray-400 block mt-1">If below threshold</span>
                </div>

                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-500 block uppercase">Free Delivery Min</span>
                  <div className="relative mt-1">
                    <span className="absolute left-2 top-1.5 text-xs font-bold text-gray-400">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={freeDeliveryThreshold}
                      onChange={(e) => setFreeDeliveryThreshold(Math.max(0, Number(e.target.value)))}
                      className="w-full pl-5 pr-1 py-1 text-sm font-bold border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary text-gray-900"
                    />
                  </div>
                  <span className="text-[9.5px] text-gray-400 block mt-1">Free if cart ≥ this</span>
                </div>

                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-500 block uppercase">Delivery Radius</span>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      min={1}
                      max={25}
                      value={deliveryRadiusKm}
                      onChange={(e) => setDeliveryRadiusKm(Math.max(1, Number(e.target.value)))}
                      className="w-full px-2 py-1 text-sm font-bold border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary text-gray-900"
                    />
                  </div>
                  <span className="text-[9.5px] text-gray-400 block mt-1">Kilometers (Km)</span>
                </div>
              </div>
            </div>

            {/* ─── 2. EXPRESS 60-MIN RUSH DELIVERY ─── */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[17px] text-amber-700">bolt</span>
                    <span className="font-bold text-xs text-gray-900">Express 60-Min Delivery Slot</span>
                  </div>
                  <p className="text-[10.5px] text-gray-500 mt-0.5">
                    Enable priority quick dispatch slot on checkout drawer
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={expressDeliveryEnabled}
                  onClick={() => setExpressDeliveryEnabled(!expressDeliveryEnabled)}
                  style={{
                    width: "44px",
                    height: "24px",
                    borderRadius: "9999px",
                    backgroundColor: expressDeliveryEnabled ? "#941717" : "#cbd5e1",
                    transition: "all 200ms ease",
                    position: "relative",
                    cursor: "pointer",
                    border: "none",
                    padding: 0,
                    outline: "none",
                    flexShrink: 0,
                    boxShadow: expressDeliveryEnabled ? "0 2px 6px rgba(148, 23, 23, 0.35)" : "none",
                  }}
                  title={expressDeliveryEnabled ? "Express Delivery Enabled (Maroon)" : "Express Delivery Disabled (Gray)"}
                >
                  <span
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "9999px",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                      position: "absolute",
                      top: "3px",
                      left: "3px",
                      transform: expressDeliveryEnabled ? "translateX(20px)" : "translateX(0px)",
                      transition: "transform 200ms ease",
                      display: "block",
                    }}
                  />
                </button>
              </div>

              {expressDeliveryEnabled && (
                <div className="mt-2 pt-2 border-t border-gray-200/60 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-600">Express Surcharge Amount:</span>
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1.5 text-xs font-bold text-gray-400">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={expressDeliveryFee}
                      onChange={(e) => setExpressDeliveryFee(Math.max(0, Number(e.target.value)))}
                      className="w-full pl-6 pr-2 py-1 text-xs font-bold border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary text-gray-900"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ─── 3. BAD WEATHER / RAIN SURGE FEE TOGGLE ─── */}
            <div className={`p-3 rounded-xl border transition-all ${rainSurgeEnabled ? "bg-red-50/70 border-red-200" : "bg-gray-50 border-gray-200"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[17px] text-amber-700">rainy</span>
                    <span className="font-bold text-xs text-gray-900">Rain / High Demand Surge</span>
                  </div>
                  <p className="text-[10.5px] text-gray-500 mt-0.5">
                    Activate during bad weather to offset higher rider delivery costs
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={rainSurgeEnabled}
                  onClick={() => setRainSurgeEnabled(!rainSurgeEnabled)}
                  style={{
                    width: "44px",
                    height: "24px",
                    borderRadius: "9999px",
                    backgroundColor: rainSurgeEnabled ? "#941717" : "#cbd5e1",
                    transition: "all 200ms ease",
                    position: "relative",
                    cursor: "pointer",
                    border: "none",
                    padding: 0,
                    outline: "none",
                    flexShrink: 0,
                    boxShadow: rainSurgeEnabled ? "0 2px 6px rgba(148, 23, 23, 0.35)" : "none",
                  }}
                  title={rainSurgeEnabled ? "Rain Surge Active (Maroon)" : "Rain Surge Disabled (Gray)"}
                >
                  <span
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "9999px",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                      position: "absolute",
                      top: "3px",
                      left: "3px",
                      transform: rainSurgeEnabled ? "translateX(20px)" : "translateX(0px)",
                      transition: "transform 200ms ease",
                      display: "block",
                    }}
                  />
                </button>
              </div>

              {rainSurgeEnabled && (
                <div className="mt-2 pt-2 border-t border-amber-200 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-amber-900">Customer Rain Surge Fee:</span>
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1.5 text-xs font-bold text-gray-400">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={rainSurgeFee}
                      onChange={(e) => setRainSurgeFee(Math.max(0, Number(e.target.value)))}
                      className="w-full pl-6 pr-2 py-1 text-xs font-bold border border-amber-300 rounded-lg bg-white focus:outline-none focus:border-amber-600 text-gray-900"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ─── 4. FREE GIFT PROMOTION TIER ─── */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-emerald-700">featured_seasonal_and_gifts</span>
                  <span className="font-bold text-xs text-gray-900">Promotional Free Gift Tier</span>
                </div>
                <span className="text-[9.5px] text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded font-bold">Cart Reward</span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 block uppercase">Min Cart Value</span>
                  <div className="relative mt-1">
                    <span className="absolute left-2 top-1.5 text-xs font-bold text-gray-400">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={freeGiftThreshold}
                      onChange={(e) => setFreeGiftThreshold(Math.max(0, Number(e.target.value)))}
                      className="w-full pl-5 pr-1 py-1 text-xs font-bold border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-500 block uppercase">Gift Item Name</span>
                  <input
                    type="text"
                    value={freeGiftName}
                    onChange={(e) => setFreeGiftName(e.target.value)}
                    placeholder="e.g. Free Biryani Rice (500g)"
                    className="w-full px-2 py-1 mt-1 text-xs font-bold border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary text-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* ─── 5. RIDER DELIVERY COMPENSATION & DAILY TARGET ─── */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Rider Payout Rates & Daily Target
                </label>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Rider Partner Pay
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mb-2.5">
                Earnings per completed delivery calculated live in rider app.
              </p>

              <div className="grid grid-cols-4 gap-2">
                <div className="p-2 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[9.5px] font-bold text-gray-500 block uppercase">Base Pay</span>
                  <div className="relative mt-1">
                    <span className="absolute left-1.5 top-1 text-xs font-bold text-gray-400">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={baseDeliveryPay}
                      onChange={(e) => setBaseDeliveryPay(Math.max(0, Number(e.target.value)))}
                      className="w-full pl-4 pr-1 py-1 text-xs font-bold border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary text-gray-900"
                    />
                  </div>
                </div>

                <div className="p-2 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[9.5px] font-bold text-gray-500 block uppercase">Fuel Dist.</span>
                  <div className="relative mt-1">
                    <span className="absolute left-1.5 top-1 text-xs font-bold text-gray-400">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={distanceIncentive}
                      onChange={(e) => setDistanceIncentive(Math.max(0, Number(e.target.value)))}
                      className="w-full pl-4 pr-1 py-1 text-xs font-bold border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary text-gray-900"
                    />
                  </div>
                </div>

                <div className="p-2 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[9.5px] font-bold text-gray-500 block uppercase">Peak Surge</span>
                  <div className="relative mt-1">
                    <span className="absolute left-1.5 top-1 text-xs font-bold text-gray-400">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={peakHourSurge}
                      onChange={(e) => setPeakHourSurge(Math.max(0, Number(e.target.value)))}
                      className="w-full pl-4 pr-1 py-1 text-xs font-bold border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary text-gray-900"
                    />
                  </div>
                </div>

                <div className="p-2 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[9.5px] font-bold text-gray-500 block uppercase">Daily Target</span>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      min={1}
                      value={defaultRiderDailyTarget}
                      onChange={(e) => setDefaultRiderDailyTarget(Math.max(1, Number(e.target.value)))}
                      className="w-full px-1.5 py-1 text-xs font-bold border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary text-gray-900"
                    />
                  </div>
                </div>
              </div>
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
