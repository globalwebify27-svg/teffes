"use client";

import React, { useState } from "react";
import { useLocation, UserAddress } from "@/context/LocationContext";
import { isAuthenticated } from "@/lib/auth";
import api from "@/lib/api";
import { toast } from "@/lib/toast";

export default function LocationModal() {
  const {
    currentLocation,
    savedAddresses,
    isDetecting,
    isLocationModalOpen,
    closeLocationModal,
    detectLocation,
    selectSavedAddress,
    refreshSavedAddresses,
    setCurrentLocation,
  } = useLocation();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddr, setNewAddr] = useState({
    tag: "Home",
    line1: "",
    line2: "",
    city: "",
    pincode: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  if (!isLocationModalOpen) return null;

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddr.line1.trim()) {
      toast.warning("Please enter your flat / house number & building name", "Address Incomplete");
      return;
    }
    if (!newAddr.city.trim()) {
      toast.warning("Please enter your city", "City Missing");
      return;
    }
    if (!newAddr.pincode.trim()) {
      toast.warning("Please enter your pincode", "Pincode Missing");
      return;
    }

    if (!isAuthenticated()) {
      // For guest, save into local state & storage
      const guestLoc = {
        label: newAddr.tag,
        shortAddress: `${newAddr.line1.slice(0, 24)}, ${newAddr.city}`,
        fullAddress: `${newAddr.line1}, ${newAddr.line2 ? newAddr.line2 + ", " : ""}${newAddr.city} ${newAddr.pincode}`,
      };
      setCurrentLocation(guestLoc);
      localStorage.setItem("teffes_current_location", JSON.stringify(guestLoc));
      setShowAddForm(false);
      closeLocationModal();
      toast.success("Delivery address updated!", "Location Set");
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.post<{ success: boolean; addresses: UserAddress[] }>("/user/addresses", newAddr);
      if (res.data.success && res.data.addresses) {
        await refreshSavedAddresses();
        const newest = res.data.addresses[res.data.addresses.length - 1];
        if (newest) selectSavedAddress(newest);
        setShowAddForm(false);
        setNewAddr({ tag: "Home", line1: "", line2: "", city: "", pincode: "" });
        toast.success("Delivery address saved successfully!", "Address Saved");
      }
    } catch (err) {
      console.error("Failed to save address:", err);
      toast.warning("Failed to save address to account. Saved locally instead.", "Address Saved");
      const fallbackLoc = {
        label: newAddr.tag,
        shortAddress: `${newAddr.line1.slice(0, 24)}, ${newAddr.city}`,
        fullAddress: `${newAddr.line1}, ${newAddr.city}`,
      };
      setCurrentLocation(fallbackLoc);
      closeLocationModal();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeLocationModal();
      }}
    >
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">location_on</span>
            </div>
            <div>
              <h3 className="font-headline-sm font-extrabold text-gray-900 text-base">
                Select Delivery Location
              </h3>
              <p className="text-xs text-slate-body">
                Fast 90-min butchery delivery across Ranchi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeLocationModal}
            className="w-9 h-9 rounded-full bg-white text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center border border-gray-200 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Detect Current Location Button */}
          <button
            type="button"
            onClick={detectLocation}
            disabled={isDetecting}
            className="w-full p-4 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors flex items-center justify-between text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-primary text-white flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
                <span className={`material-symbols-outlined text-[22px] ${isDetecting ? "animate-spin" : ""}`}>
                  {isDetecting ? "sync" : "my_location"}
                </span>
              </div>
              <div>
                <span className="font-headline-sm font-black text-primary text-sm block">
                  {isDetecting ? "Detecting your location..." : "Use Current GPS Location"}
                </span>
                <span className="text-xs text-slate-body block mt-0.5">
                  Using high-accuracy browser location
                </span>
              </div>
            </div>

            <span className="material-symbols-outlined text-primary text-[20px] font-bold">
              chevron_right
            </span>
          </button>

          {/* Current Active Location Display */}
          <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 flex items-start gap-3">
            <span className="material-symbols-outlined text-tertiary text-[20px] mt-0.5">check_circle</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-900">{currentLocation.label}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-body mt-0.5 leading-snug">
                {currentLocation.fullAddress || currentLocation.shortAddress}
              </p>
            </div>
          </div>

          {/* Saved Addresses (Logged in) */}
          {savedAddresses.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-body mb-2.5">
                Saved Addresses
              </h4>
              <div className="space-y-2">
                {savedAddresses.map((addr) => {
                  const isSelected =
                    currentLocation.addressId === (addr._id || addr.id) ||
                    currentLocation.fullAddress.includes(addr.line1);
                  return (
                    <div
                      key={addr._id || addr.id || addr.line1}
                      onClick={() => selectSavedAddress(addr)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-[20px] text-gray-500 mt-0.5">
                          {addr.tag?.toLowerCase() === "work" ? "business" : "home"}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-900">{addr.tag}</span>
                            {addr.isDefault && (
                              <span className="text-[9.5px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-body mt-0.5">
                            {addr.line1}, {addr.line2 ? addr.line2 + ", " : ""}{addr.city} - {addr.pincode}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? "border-primary bg-primary" : "border-gray-300"
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add New Address Accordion Form */}
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="w-full py-3 px-4 rounded-2xl border border-gray-200 hover:border-primary text-gray-800 hover:text-primary font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer bg-white"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Add New Address</span>
            </button>
          ) : (
            <form onSubmit={handleSaveAddress} className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-gray-900">New Address Details</span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-gray-500 hover:text-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {/* Tag selector */}
              <div className="flex gap-2">
                {["Home", "Work", "Other"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setNewAddr({ ...newAddr, tag })}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      newAddr.tag === tag
                        ? "bg-primary text-white"
                        : "bg-white text-gray-700 border border-gray-200"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                  Flat / House No., Apartment, Building *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Flat 402, Shivalik Heights"
                  value={newAddr.line1}
                  onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 bg-white focus:outline-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                  Area, Landmark, Street
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kishore Ganj Chowk, Harmu Road"
                  value={newAddr.line2}
                  onChange={(e) => setNewAddr({ ...newAddr, line2: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 bg-white focus:outline-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">City *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ranchi"
                    value={newAddr.city}
                    onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 bg-white focus:outline-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Pincode *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 834001"
                    maxLength={6}
                    value={newAddr.pincode}
                    onChange={(e) => setNewAddr({ ...newAddr, pincode: e.target.value.replace(/\D/g, "") })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 bg-white focus:outline-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
              >
                {isSaving ? "Saving..." : "Save & Deliver Here"}
              </button>
            </form>
          )}

          {/* Delivery Note */}
          <div className="text-[11px] text-slate-body bg-surface-container-low p-3 rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary text-[18px]">bolt</span>
            <span>
              <strong>90-Min Fresh Delivery</strong> available across Kishore Ganj, Harmu, Lalpur, Morabadi, Doranda & Ranchi city.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
