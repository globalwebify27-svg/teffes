"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { toast } from "@/lib/toast";

export interface UserAddress {
  _id?: string;
  id?: string;
  tag: string;
  line1: string;
  line2?: string;
  city: string;
  pincode: string;
  isDefault?: boolean;
}

export interface CurrentLocation {
  label: string;
  shortAddress: string;
  fullAddress: string;
  lat?: number;
  lng?: number;
  addressId?: string;
  isSet?: boolean;
}

interface LocationContextType {
  currentLocation: CurrentLocation;
  isLocationSet: boolean;
  savedAddresses: UserAddress[];
  isDetecting: boolean;
  isLocationModalOpen: boolean;
  detectLocation: () => Promise<boolean>;
  selectSavedAddress: (addr: UserAddress) => void;
  refreshSavedAddresses: (explicitAddresses?: UserAddress[]) => Promise<void>;
  handleAddressDeleted: (deletedId: string) => Promise<void>;
  clearLocation: () => void;
  openLocationModal: () => void;
  closeLocationModal: () => void;
  setCurrentLocation: (loc: CurrentLocation) => void;
}

const DEFAULT_LOCATION: CurrentLocation = {
  label: "Select Location",
  shortAddress: "Choose delivery address",
  fullAddress: "",
  isSet: false,
};

const LocationContext = createContext<LocationContextType | undefined>(undefined);

// In-memory flag: resets on every browser refresh (F5), but persists during Next.js client-side page navigation
let hasDismissedInCurrentPageLoad = false;

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation>(DEFAULT_LOCATION);
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Determine if a real location has been chosen or detected by the user
  const isLocationSet = Boolean(
    currentLocation?.isSet ||
    currentLocation?.addressId ||
    (currentLocation?.fullAddress &&
      !currentLocation.fullAddress.includes("Kacheri Chowk, Near Kishore Ganj") &&
      currentLocation.shortAddress !== "Choose delivery address" &&
      currentLocation.shortAddress !== "Select Location")
  );

  // Load persisted location from localStorage on client mount, or prompt location upfront if unset
  useEffect(() => {
    try {
      const saved = localStorage.getItem("teffes_current_location");
      let hasValidSaved = false;
      if (saved) {
        const parsed = JSON.parse(saved);
        // Clear old default fallback if it was never explicitly set by user
        if (
          parsed.fullAddress?.includes("Kacheri Chowk, Near Kishore Ganj") &&
          !parsed.isSet &&
          !parsed.addressId
        ) {
          localStorage.removeItem("teffes_current_location");
          setCurrentLocation(DEFAULT_LOCATION);
        } else if (
          parsed.shortAddress &&
          parsed.shortAddress !== "Choose delivery address" &&
          parsed.shortAddress !== "Select Location"
        ) {
          setCurrentLocation({ ...parsed, isSet: true });
          hasValidSaved = true;
        }
      }

      // Clean up any legacy sessionStorage flags
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("teffes_location_modal_dismissed");
        sessionStorage.removeItem("teffes_location_prompted");
        sessionStorage.removeItem("teffes_initial_loc_dismissed");
      }

      // If location is unset, prompt LocationModal upfront on every browser refresh / first mount
      if (!hasValidSaved && !hasDismissedInCurrentPageLoad) {
        const timer = setTimeout(() => {
          setIsLocationModalOpen(true);
        }, 400);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.warn("Could not read location from localStorage", e);
    }
  }, []);

  const clearLocation = useCallback(() => {
    setCurrentLocation(DEFAULT_LOCATION);
    if (typeof window !== "undefined") {
      localStorage.removeItem("teffes_current_location");
      window.dispatchEvent(new CustomEvent("teffes:location_cleared"));
    }
  }, []);

  // Fetch saved addresses from backend if user is authenticated
  const refreshSavedAddresses = useCallback(async (explicitAddresses?: UserAddress[]) => {
    if (!isAuthenticated()) return;
    try {
      let addrs = explicitAddresses;
      if (!addrs) {
        const res = await api.get<{ success: boolean; addresses: UserAddress[] }>("/user/addresses");
        if (res.data?.success && Array.isArray(res.data.addresses)) {
          addrs = res.data.addresses;
        }
      }
      if (Array.isArray(addrs)) {
        setSavedAddresses(addrs);

        const savedLocal = typeof window !== "undefined" ? localStorage.getItem("teffes_current_location") : null;
        let localAddrId: string | undefined;
        let isLocalSet = false;
        if (savedLocal) {
          try {
            const parsed = JSON.parse(savedLocal);
            localAddrId = parsed.addressId;
            isLocalSet = Boolean(parsed.isSet);
          } catch {}
        }

        const activeAddrId = currentLocation?.addressId || localAddrId;

        if (activeAddrId) {
          const stillExists = addrs.find((a) => (a._id || a.id) === activeAddrId);
          if (!stillExists) {
            // Active address was deleted from backend!
            if (addrs.length > 0) {
              const fallbackAddr = addrs.find((a) => a.isDefault) || addrs[0];
              const newLoc: CurrentLocation = {
                label: fallbackAddr.tag || "Home",
                shortAddress: `${fallbackAddr.line1.slice(0, 24)}, ${fallbackAddr.city}`,
                fullAddress: `${fallbackAddr.line1}, ${fallbackAddr.line2 ? fallbackAddr.line2 + ", " : ""}${fallbackAddr.city} ${fallbackAddr.pincode}`,
                addressId: fallbackAddr._id || fallbackAddr.id,
                isSet: true,
              };
              setCurrentLocation(newLoc);
              if (typeof window !== "undefined") {
                localStorage.setItem("teffes_current_location", JSON.stringify(newLoc));
              }
            } else {
              // No addresses left in user account
              clearLocation();
            }
          } else {
            // Update in case address fields were edited
            const updatedLoc: CurrentLocation = {
              label: stillExists.tag || "Home",
              shortAddress: `${stillExists.line1.slice(0, 24)}, ${stillExists.city}`,
              fullAddress: `${stillExists.line1}, ${stillExists.line2 ? stillExists.line2 + ", " : ""}${stillExists.city} ${stillExists.pincode}`,
              addressId: stillExists._id || stillExists.id,
              isSet: true,
            };
            setCurrentLocation(updatedLoc);
            if (typeof window !== "undefined") {
              localStorage.setItem("teffes_current_location", JSON.stringify(updatedLoc));
            }
          }
        } else if (addrs.length === 0 && (!currentLocation?.lat || !currentLocation?.lng)) {
          if (currentLocation?.isSet || isLocalSet) {
            clearLocation();
          }
        } else if (addrs.length > 0 && !currentLocation?.isSet && !isLocalSet) {
          const defaultAddr = addrs.find((a) => a.isDefault) || addrs[0];
          const newLoc: CurrentLocation = {
            label: defaultAddr.tag || "Home",
            shortAddress: `${defaultAddr.line1.slice(0, 24)}, ${defaultAddr.city}`,
            fullAddress: `${defaultAddr.line1}, ${defaultAddr.line2 ? defaultAddr.line2 + ", " : ""}${defaultAddr.city} ${defaultAddr.pincode}`,
            addressId: defaultAddr._id || defaultAddr.id,
            isSet: true,
          };
          setCurrentLocation(newLoc);
          if (typeof window !== "undefined") {
            localStorage.setItem("teffes_current_location", JSON.stringify(newLoc));
          }
        }
      }
    } catch (err) {
      console.warn("Could not fetch user addresses:", err);
    }
  }, [currentLocation, clearLocation]);

  const handleAddressDeleted = useCallback(
    async (deletedId: string) => {
      let remaining: UserAddress[] = [];
      setSavedAddresses((prev) => {
        remaining = prev.filter((a) => (a._id || a.id) !== deletedId);
        return remaining;
      });

      const savedLocal = typeof window !== "undefined" ? localStorage.getItem("teffes_current_location") : null;
      let localAddrId: string | undefined;
      if (savedLocal) {
        try {
          const parsed = JSON.parse(savedLocal);
          localAddrId = parsed.addressId;
        } catch {}
      }

      const isCurrentDeleted =
        currentLocation?.addressId === deletedId ||
        localAddrId === deletedId;

      if (isCurrentDeleted) {
        if (remaining.length > 0) {
          const fallback = remaining.find((a) => a.isDefault) || remaining[0];
          const newLoc: CurrentLocation = {
            label: fallback.tag || "Home",
            shortAddress: `${fallback.line1.slice(0, 24)}, ${fallback.city}`,
            fullAddress: `${fallback.line1}, ${fallback.line2 ? fallback.line2 + ", " : ""}${fallback.city} ${fallback.pincode}`,
            addressId: fallback._id || fallback.id,
            isSet: true,
          };
          setCurrentLocation(newLoc);
          if (typeof window !== "undefined") {
            localStorage.setItem("teffes_current_location", JSON.stringify(newLoc));
          }
        } else {
          clearLocation();
        }
      } else if (remaining.length === 0 && (!currentLocation?.lat || !currentLocation?.lng)) {
        clearLocation();
      }

      await refreshSavedAddresses();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("teffes:addresses_updated"));
      }
    },
    [currentLocation, clearLocation, refreshSavedAddresses]
  );

  useEffect(() => {
    refreshSavedAddresses();
  }, [refreshSavedAddresses]);

  useEffect(() => {
    const handleSync = () => {
      refreshSavedAddresses();
    };
    window.addEventListener("teffes:addresses_updated", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("teffes:addresses_updated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [refreshSavedAddresses]);

  // GPS Location Detection via browser navigator.geolocation
  const detectLocation = async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      toast.warning("Geolocation is not supported by your browser.", "Location Unsupported");
      return false;
    }

    setIsDetecting(true);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          try {
            // Google Maps Reverse Geocode via backend proxy
            const res = await api.get<{
              success: boolean;
              formattedAddress?: string;
              address?: {
                street?: string;
                suburb?: string;
                city?: string;
                state?: string;
                pincode?: string;
              };
            }>(`/location/reverse-geocode?lat=${lat}&lng=${lng}`);

            let short = "Ranchi Local Area";
            let full = `Ranchi (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

            if (res.data?.success && res.data.formattedAddress) {
              full = res.data.formattedAddress;
              const addr = res.data.address || {};
              const locality = addr.suburb || addr.street || "Ranchi";
              const city = addr.city || "Ranchi";
              short = `${locality}, ${city}`;
            }

            const newLoc: CurrentLocation = {
              label: "Current Location",
              shortAddress: short,
              fullAddress: full,
              lat,
              lng,
              isSet: true,
            };

            setCurrentLocation(newLoc);
            localStorage.setItem("teffes_current_location", JSON.stringify(newLoc));
            setIsDetecting(false);
            setIsLocationModalOpen(false);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("teffes:location_changed", { detail: newLoc }));
            }
            toast.success(`Location detected: ${short}`, "Location Updated");
            resolve(true);
          } catch (err) {
            console.warn("Reverse geocode fallback:", err);
            const fallbackLoc: CurrentLocation = {
              label: "Detected GPS",
              shortAddress: `GPS: ${lat.toFixed(3)}, ${lng.toFixed(3)}`,
              fullAddress: `Ranchi Zone (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
              lat,
              lng,
              isSet: true,
            };
            setCurrentLocation(fallbackLoc);
            localStorage.setItem("teffes_current_location", JSON.stringify(fallbackLoc));
            setIsDetecting(false);
            setIsLocationModalOpen(false);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("teffes:location_changed", { detail: fallbackLoc }));
            }
            toast.success(`Location set to GPS: ${lat.toFixed(3)}, ${lng.toFixed(3)}`, "Location Set");
            resolve(true);
          }
        },
        (error) => {
          setIsDetecting(false);
          let msg = "Could not detect location. Please check your browser location permissions.";
          if (error.code === error.PERMISSION_DENIED) {
            msg = "Location permission denied. Please allow location access in your browser or select an address below.";
          }
          toast.warning(msg, "Location Access");
          resolve(false);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  };

  const selectSavedAddress = (addr: UserAddress) => {
    const newLoc: CurrentLocation = {
      label: addr.tag || "Saved Address",
      shortAddress: `${addr.line1.slice(0, 24)}, ${addr.city}`,
      fullAddress: `${addr.line1}, ${addr.line2 ? addr.line2 + ", " : ""}${addr.city} ${addr.pincode}`,
      addressId: addr._id || addr.id,
      isSet: true,
    };
    setCurrentLocation(newLoc);
    localStorage.setItem("teffes_current_location", JSON.stringify(newLoc));
    setIsLocationModalOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teffes:location_changed", { detail: newLoc }));
      window.dispatchEvent(new CustomEvent("teffes:addresses_updated"));
    }
  };

  const openLocationModal = () => setIsLocationModalOpen(true);
  const closeLocationModal = () => {
    hasDismissedInCurrentPageLoad = true;
    setIsLocationModalOpen(false);
  };

  return (
    <LocationContext.Provider
      value={{
        currentLocation,
        isLocationSet,
        savedAddresses,
        isDetecting,
        isLocationModalOpen,
        detectLocation,
        selectSavedAddress,
        refreshSavedAddresses,
        handleAddressDeleted,
        clearLocation,
        openLocationModal,
        closeLocationModal,
        setCurrentLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
}
