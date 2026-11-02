"use client";

import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight, faAnglesLeft, faAnglesRight } from "@fortawesome/free-solid-svg-icons";

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}

export default function Pagination({
  currentPage,
  totalItems,
  pageSize = 50,
  onPageChange,
  itemLabel = "items",
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const [inputValue, setInputValue] = useState(String(currentPage));
  const [isFocused, setIsFocused] = useState(false);

  // Sync input value whenever currentPage changes from external controls
  useEffect(() => {
    setInputValue(String(currentPage));
  }, [currentPage]);

  if (totalItems <= 0) {
    return null;
  }

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const handlePageSelect = (page: number) => {
    const clamped = Math.max(1, Math.min(page, totalPages));
    if (clamped !== currentPage) {
      onPageChange(clamped);
    }
  };

  const commitPageJump = () => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(1, Math.min(parsed, totalPages));
      if (clamped !== currentPage) {
        onPageChange(clamped);
      }
      setInputValue(String(clamped));
    } else {
      setInputValue(String(currentPage));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitPageJump();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      setInputValue(String(currentPage));
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "14px",
        padding: "12px 18px",
        marginTop: "16px",
        background: "#ffffff",
        border: "1px solid #ede8e0",
        borderRadius: "14px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        userSelect: "none",
      }}
    >
      {/* Left: Summary text with maroon highlights */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: "0.825rem",
            color: "#57534e",
            fontWeight: 500,
          }}
        >
          Showing <strong style={{ color: "#941717" }}>{startItem}</strong> – <strong style={{ color: "#941717" }}>{endItem}</strong> of{" "}
          <strong style={{ color: "#1c1917" }}>{totalItems}</strong> {itemLabel}
        </span>
        <span
          style={{
            fontSize: "0.72rem",
            background: "#fef2f2",
            color: "#941717",
            padding: "2px 8px",
            borderRadius: "99px",
            fontWeight: 700,
            border: "1px solid #fecaca",
          }}
        >
          {pageSize} per page
        </span>
      </div>

      {/* Right: Unified compact navigation controls with center editable page input */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* First Page Button */}
        <button
          type="button"
          onClick={() => handlePageSelect(1)}
          disabled={currentPage === 1}
          title="First Page"
          style={{
            minWidth: "32px",
            height: "34px",
            padding: "0 8px",
            borderRadius: "8px",
            border: "1px solid #e7e5e4",
            background: currentPage === 1 ? "#fafaf9" : "#fff",
            color: currentPage === 1 ? "#cbd5e1" : "#44403c",
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            transition: "all 150ms ease",
            opacity: currentPage === 1 ? 0.6 : 1,
          }}
        >
          <FontAwesomeIcon icon={faAnglesLeft} />
        </button>

        {/* Previous Page Button */}
        <button
          type="button"
          onClick={() => handlePageSelect(currentPage - 1)}
          disabled={currentPage === 1}
          title="Previous Page"
          style={{
            height: "34px",
            padding: "0 12px",
            borderRadius: "8px",
            border: "1px solid #e7e5e4",
            background: currentPage === 1 ? "#fafaf9" : "#fff",
            color: currentPage === 1 ? "#cbd5e1" : "#44403c",
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.8rem",
            fontWeight: 700,
            transition: "all 150ms ease",
            opacity: currentPage === 1 ? 0.6 : 1,
          }}
        >
          <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: "0.7rem" }} />
          <span>Prev</span>
        </button>

        {/* Center: Interactive Page Input Box */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "#faf8f5",
            border: isFocused ? "1.5px solid #941717" : "1px solid #ede8e0",
            borderRadius: "10px",
            padding: "3px 10px",
            transition: "all 150ms ease",
            boxShadow: isFocused ? "0 0 0 3px rgba(148, 23, 23, 0.12)" : "none",
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "#57534e", fontWeight: 600 }}>Page</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={(e) => {
              setIsFocused(true);
              e.target.select();
            }}
            onBlur={() => {
              setIsFocused(false);
              commitPageJump();
            }}
            onKeyDown={handleKeyDown}
            title="Type page number and press Enter"
            style={{
              width: "44px",
              height: "28px",
              padding: "0 4px",
              borderRadius: "6px",
              border: "1.5px solid #d6ccc2",
              background: "#ffffff",
              fontSize: "0.85rem",
              textAlign: "center",
              fontWeight: 800,
              color: "#941717",
              outline: "none",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
            }}
          />
          <span style={{ fontSize: "0.8rem", color: "#78716c", fontWeight: 600 }}>
            of <strong style={{ color: "#1c1917", fontWeight: 800 }}>{totalPages}</strong>
          </span>
        </div>

        {/* Next Page Button */}
        <button
          type="button"
          onClick={() => handlePageSelect(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Next Page"
          style={{
            height: "34px",
            padding: "0 12px",
            borderRadius: "8px",
            border: "1px solid #e7e5e4",
            background: currentPage === totalPages ? "#fafaf9" : "#fff",
            color: currentPage === totalPages ? "#cbd5e1" : "#44403c",
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.8rem",
            fontWeight: 700,
            transition: "all 150ms ease",
            opacity: currentPage === totalPages ? 0.6 : 1,
          }}
        >
          <span>Next</span>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: "0.7rem" }} />
        </button>

        {/* Last Page Button */}
        <button
          type="button"
          onClick={() => handlePageSelect(totalPages)}
          disabled={currentPage === totalPages}
          title="Last Page"
          style={{
            minWidth: "32px",
            height: "34px",
            padding: "0 8px",
            borderRadius: "8px",
            border: "1px solid #e7e5e4",
            background: currentPage === totalPages ? "#fafaf9" : "#fff",
            color: currentPage === totalPages ? "#cbd5e1" : "#44403c",
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            transition: "all 150ms ease",
            opacity: currentPage === totalPages ? 0.6 : 1,
          }}
        >
          <FontAwesomeIcon icon={faAnglesRight} />
        </button>
      </div>
    </div>
  );
}
