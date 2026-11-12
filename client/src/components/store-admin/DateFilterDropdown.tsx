"use client";

import React, { useState, useRef, useEffect } from "react";

export interface DateFilterDropdownProps {
  selectedRange: string;
  customStartDate?: string;
  customEndDate?: string;
  onApply: (range: string, startDate?: string, endDate?: string) => void;
}

const DATE_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "last7days", label: "Last 7 days" },
  { key: "last30days", label: "Last 30 days" },
  { key: "last90days", label: "Last 90 days" },
  { key: "last12months", label: "Last 12 months" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom" },
];

export default function DateFilterDropdown({
  selectedRange,
  customStartDate = "",
  customEndDate = "",
  onApply,
}: DateFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempRange, setTempRange] = useState(selectedRange || "all");
  const [tempStart, setTempStart] = useState(customStartDate);
  const [tempEnd, setTempEnd] = useState(customEndDate);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync internal state when external props change
  useEffect(() => {
    setTempRange(selectedRange || "all");
    setTempStart(customStartDate);
    setTempEnd(customEndDate);
  }, [selectedRange, customStartDate, customEndDate]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const getButtonLabel = () => {
    if (selectedRange === "custom" && customStartDate && customEndDate) {
      return `${customStartDate} to ${customEndDate}`;
    }
    const found = DATE_OPTIONS.find((o) => o.key === selectedRange);
    return found ? found.label : "All time";
  };

  const handleApplyClick = () => {
    onApply(tempRange, tempStart, tempEnd);
    setIsOpen(false);
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }} ref={dropdownRef}>
      {/* Trigger Button Matching Image 1 & 2 */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          background: "#fff",
          border: "1.5px solid #d1d5db",
          borderRadius: "8px",
          padding: "7px 14px",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "#1f2937",
          cursor: "pointer",
          boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
          transition: "all 150ms ease",
        }}
      >
        <span className="material-symbols-outlined text-[17px] text-gray-500">
          calendar_today
        </span>
        <span>{getButtonLabel()}</span>
        <span className="material-symbols-outlined text-[18px] text-gray-500">
          {isOpen ? "expand_less" : "expand_more"}
        </span>
      </button>

      {/* Popover Dropdown with Radio Options & Apply Button */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 1000,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            boxShadow:
              "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
            padding: "14px 16px",
            minWidth: "260px",
            animation: "fadeIn 120ms ease-out",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {DATE_OPTIONS.map((opt) => (
              <label
                key={opt.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "6px 8px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.86rem",
                  fontWeight: tempRange === opt.key ? 700 : 500,
                  color: tempRange === opt.key ? "#1d4ed8" : "#374151",
                  background: tempRange === opt.key ? "#eff6ff" : "transparent",
                  transition: "background 120ms ease",
                }}
              >
                <input
                  type="radio"
                  name="storeAdminDateFilter"
                  value={opt.key}
                  checked={tempRange === opt.key}
                  onChange={() => setTempRange(opt.key)}
                  style={{
                    accentColor: "#2563eb",
                    width: "16px",
                    height: "16px",
                    cursor: "pointer",
                  }}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          {/* Custom Date Range Picker */}
          {tempRange === "custom" && (
            <div
              style={{
                marginTop: "10px",
                paddingTop: "10px",
                borderTop: "1px solid #f3f4f6",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "#6b7280",
                    marginBottom: "3px",
                  }}
                >
                  Start Date (IST)
                </label>
                <input
                  type="date"
                  value={tempStart}
                  onChange={(e) => setTempStart(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    fontSize: "0.82rem",
                    outline: "none",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "#6b7280",
                    marginBottom: "3px",
                  }}
                >
                  End Date (IST)
                </label>
                <input
                  type="date"
                  value={tempEnd}
                  onChange={(e) => setTempEnd(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    fontSize: "0.82rem",
                    outline: "none",
                  }}
                />
              </div>
            </div>
          )}

          {/* Apply Button */}
          <div
            style={{
              marginTop: "12px",
              paddingTop: "10px",
              borderTop: "1px solid #f3f4f6",
            }}
          >
            <button
              type="button"
              onClick={handleApplyClick}
              style={{
                width: "100%",
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
                transition: "background 150ms ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1d4ed8")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#2563eb")}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
