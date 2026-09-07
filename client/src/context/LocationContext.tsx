"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

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
}

interface LocationContextType {
  currentLocation: CurrentLocation;
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
  label: "Deliver to (90 Mins)",
  shortAddress: "Kacheri Chowk, Ranchi",
  fullAddress: "Kacheri Chowk, Near Kishore Ganj, Harmu Road, Ranchi 834001",
  lat: 23.3644,
  lng: 85.3243,
};

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation>(DEFAULT_LOCATION);
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Load persisted location from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("teffes_current_location");
      if (saved) {
        setCurrentLocation(JSON.parse(saved));
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

        // If user has saved addresses and current location isn't linked to one, pick default
        const defaultAddr = res.data.addresses.find((a: UserAddress) => a.isDefault) || res.data.addresses[0];
        const savedLocal = localStorage.getItem("teffes_current_location");
        if (defaultAddr && !savedLocal) {
          const newLoc: CurrentLocation = {
            label: defaultAddr.tag || "Home",
            shortAddress: `${defaultAddr.line1.slice(0, 24)}, ${defaultAddr.city}`,
            fullAddress: `${defaultAddr.line1}, ${defaultAddr.line2 ? defaultAddr.line2 + ", " : ""}${defaultAddr.city} ${defaultAddr.pincode}`,
            addressId: defaultAddr._id || defaultAddr.id,
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
      alert("Geolocation is not supported by your browser");
      return false;
    }

    setIsDetecting(true);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          try {
            // Reverse geocode via free OpenStreetMap Nominatim or Google
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
            );
            const data = await res.json();

            const addr = data.address || {};
            const suburb = addr.suburb || addr.neighbourhood || addr.road || addr.village || "Ranchi Local Area";
            const city = addr.city || addr.town || addr.county || "Ranchi";
            const short = `${suburb}, ${city}`;
            const full = data.display_name || `${short} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

            const newLoc: CurrentLocation = {
              label: "Current Location",
              shortAddress: short,
              fullAddress: full,
              lat,
              lng,
            };

            setCurrentLocation(newLoc);
            localStorage.setItem("teffes_current_location", JSON.stringify(newLoc));
            setIsDetecting(false);
            setIsLocationModalOpen(false);
            resolve(true);
          } catch (err) {
            console.warn("Reverse geocode fallback:", err);
            const fallbackLoc: CurrentLocation = {
              label: "Detected GPS",
              shortAddress: `GPS: ${lat.toFixed(3)}, ${lng.toFixed(3)}`,
              fullAddress: `Ranchi Zone (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
              lat,
              lng,
            };
            setCurrentLocation(fallbackLoc);
            localStorage.setItem("teffes_current_location", JSON.stringify(fallbackLoc));
            setIsDetecting(false);
            setIsLocationModalOpen(false);
            resolve(true);
          }
        },
        (error) => {
          setIsDetecting(false);
          let msg = "Could not detect location. Please check your browser location permissions.";
          if (error.code === error.PERMISSION_DENIED) {
            msg = "Location permission denied. Please allow location access in your browser or select an address below.";
          }
          alert(msg);
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
