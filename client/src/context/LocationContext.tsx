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
  refreshSavedAddresses: () => Promise<void>;
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

  // Load persisted location from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("teffes_current_location");
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
        }
      }
    } catch (e) {
      console.warn("Could not read location from localStorage", e);
    }
  }, []);

  // Fetch saved addresses from backend if user is authenticated
  const refreshSavedAddresses = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const res = await api.get<{ success: boolean; addresses: UserAddress[] }>("/user/addresses");
      if (res.data.success && Array.isArray(res.data.addresses)) {
        setSavedAddresses(res.data.addresses);

        // If user has saved addresses and current location isn't set, pick default
        const defaultAddr = res.data.addresses.find((a: UserAddress) => a.isDefault) || res.data.addresses[0];
        const savedLocal = localStorage.getItem("teffes_current_location");
        if (defaultAddr && (!savedLocal || savedLocal.includes("Kacheri Chowk, Near Kishore Ganj"))) {
          const newLoc: CurrentLocation = {
            label: defaultAddr.tag || "Home",
            shortAddress: `${defaultAddr.line1.slice(0, 24)}, ${defaultAddr.city}`,
            fullAddress: `${defaultAddr.line1}, ${defaultAddr.line2 ? defaultAddr.line2 + ", " : ""}${defaultAddr.city} ${defaultAddr.pincode}`,
            addressId: defaultAddr._id || defaultAddr.id,
            isSet: true,
          };
          setCurrentLocation(newLoc);
          localStorage.setItem("teffes_current_location", JSON.stringify(newLoc));
        }
      }
    } catch (err) {
      console.warn("Could not fetch user addresses:", err);
    }
  }, []);

  useEffect(() => {
    refreshSavedAddresses();
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
  };

  const openLocationModal = () => setIsLocationModalOpen(true);
  const closeLocationModal = () => setIsLocationModalOpen(false);

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
