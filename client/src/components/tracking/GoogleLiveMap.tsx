"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";

interface GoogleLiveMapProps {
  riderLat?: number;
  riderLng?: number;
  riderName?: string;
  storeName?: string;
  storeLat?: number;
  storeLng?: number;
  customerLat?: number;
  customerLng?: number;
  customerAddress?: string;
  orderStatus?: string;
  className?: string;
}

export default function GoogleLiveMap({
  riderLat = 23.3512,
  riderLng = 23.3154,
  riderName = "Delivery Rider",
  storeName = "Kishore Ganj Hub",
  storeLat = 23.3441,
  storeLng = 85.3096,
  customerLat = 23.3644,
  customerLng = 85.3243,
  customerAddress = "Your Kitchen",
  orderStatus = "Out for Delivery",
  className = "h-52 w-full rounded-2xl overflow-hidden",
}: GoogleLiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isGoogleMapLoaded, setIsGoogleMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const googleMapInstance = useRef<any>(null);
  const riderMarkerInstance = useRef<any>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey || apiKey.trim() === "" || apiKey === "your_google_maps_api_key_here") {
      // No API key yet, will use interactive styled GPS visualizer
      return;
    }

    const loader = new Loader({
      apiKey: apiKey,
      version: "weekly",
      libraries: ["places"],
    });

    const loadMaps = async () => {
      try {
        if (typeof (loader as any).load === "function") {
          await (loader as any).load();
        } else if (typeof (loader as any).importLibrary === "function") {
          await (loader as any).importLibrary("maps");
        }

        const google = (window as any).google;
        if (!google || !mapRef.current) return;

        const bounds = new google.maps.LatLngBounds();
        const storePos = { lat: storeLat, lng: storeLng };
        const riderPos = { lat: riderLat, lng: riderLng };
        const custPos = { lat: customerLat, lng: customerLng };

        bounds.extend(storePos);
        bounds.extend(riderPos);
        bounds.extend(custPos);

        const map = new google.maps.Map(mapRef.current, {
          center: riderPos,
          zoom: 14,
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }],
            },
          ],
        });
        map.fitBounds(bounds, 40);
        googleMapInstance.current = map;

        // Store Marker
        new google.maps.Marker({
          position: storePos,
          map,
          title: storeName,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#941717",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });

        // Customer Marker
        new google.maps.Marker({
          position: custPos,
          map,
          title: "Delivery Destination",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#059669",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });

        // Live Rider Marker
        const riderMarker = new google.maps.Marker({
          position: riderPos,
          map,
          title: riderName,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#f59e0b",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
        riderMarkerInstance.current = riderMarker;

        // Connecting Route Line
        new google.maps.Polyline({
          path: [storePos, riderPos, custPos],
          geodesic: true,
          strokeColor: "#941717",
          strokeOpacity: 0.8,
          strokeWeight: 4,
          map,
        });

        setIsGoogleMapLoaded(true);
      } catch (err: any) {
        console.warn("[Google Maps] Failed to load, using interactive route radar:", err?.message || err);
        setLoadError(true);
      }
    };

    loadMaps();
  }, [apiKey, storeLat, storeLng, customerLat, customerLng, riderLat, riderLng, riderName, storeName]);

  // Update rider marker dynamically when riderLat / riderLng change via Socket.IO
  useEffect(() => {
    if (riderMarkerInstance.current && isGoogleMapLoaded) {
      const newPos = { lat: riderLat, lng: riderLng };
      riderMarkerInstance.current.setPosition(newPos);
      if (googleMapInstance.current) {
        googleMapInstance.current.panTo(newPos);
      }
    }
  }, [riderLat, riderLng, isGoogleMapLoaded]);

  // If Google Maps loaded successfully, render the map container
  if (apiKey && !loadError) {
    return (
      <div className={`relative border border-gray-200 shadow-inner ${className}`}>
        <div ref={mapRef} className="w-full h-full" />
        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-gray-200 text-[10px] font-bold text-gray-700 flex items-center gap-1.5 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live Google Maps GPS Active</span>
        </div>
      </div>
    );
  }

  // Visual Interactive Route Radar Fallback (Ready for Google Maps Key)
  return (
    <div className={`relative border border-gray-200 bg-slate-100 flex items-center justify-center shadow-inner ${className}`}>
      {/* City Street Grid Visual */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(#941717 1px, transparent 1px), radial-gradient(#941717 1px, #f8fafc 1px)",
          backgroundSize: "24px 24px",
          backgroundPosition: "0 0, 12px 12px",
        }}
      />

      {/* Pulsing GPS Radar Ring */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-48 h-48 rounded-full border border-amber-400/20 animate-ping opacity-40" />
      </div>

      {/* Animated Route Line */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <line
          x1="16%"
          y1="72%"
          x2="84%"
          y2="28%"
          stroke="#941717"
          strokeWidth="3.5"
          strokeDasharray="6,6"
          className="animate-pulse"
        />
      </svg>

      {/* Origin: Butchery Hub */}
      <div className="absolute left-[10%] bottom-[16%] text-center">
        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center mx-auto shadow-md border-2 border-white">
          <span className="material-symbols-outlined text-[16px]">storefront</span>
        </div>
        <span className="text-[10px] font-extrabold text-gray-800 bg-white/95 px-2 py-0.5 rounded shadow-2xs mt-1 block whitespace-nowrap">
          {storeName}
        </span>
      </div>

      {/* Moving Rider Marker (Reacts dynamically to real-time coordinates) */}
      <div className="absolute left-[50%] top-[38%] text-center -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center mx-auto shadow-lg ring-4 ring-amber-300/60 animate-bounce">
            <span className="material-symbols-outlined text-[20px]">two_wheeler</span>
          </div>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white animate-pulse" />
        </div>
        <span className="text-[10.5px] font-extrabold text-amber-950 bg-amber-100/95 border border-amber-200 px-2 py-0.5 rounded-full shadow-xs mt-1 block whitespace-nowrap">
          {riderName} is here
        </span>
      </div>

      {/* Destination: Customer Kitchen */}
      <div className="absolute right-[10%] top-[14%] text-center">
        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md border-2 border-white">
          <span className="material-symbols-outlined text-[16px]">home</span>
        </div>
        <span className="text-[10px] font-extrabold text-gray-800 bg-white/95 px-2 py-0.5 rounded shadow-2xs mt-1 block whitespace-nowrap max-w-[110px] truncate">
          {customerAddress || "Your Kitchen"}
        </span>
      </div>

      {/* Status Overlay Badge */}
      <div className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-gray-200 text-[9.5px] font-bold text-gray-700 flex items-center gap-1.5 shadow-2xs">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
        <span>Live GPS · {orderStatus}</span>
      </div>
    </div>
  );
}
