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
      className="flex flex-col sm:flex-row items-center sm:justify-between gap-3 p-3 sm:px-4 sm:py-3 mt-4 bg-white border border-[#ede8e0] rounded-2xl shadow-xs select-none w-full"
    >
      {/* Left: Summary text with maroon highlights */}
      <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start w-full sm:w-auto text-center sm:text-left">
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
            whiteSpace: "nowrap",
          }}
        >
          {pageSize} per page
        </span>
      </div>

      {/* Right: Unified compact navigation controls with center editable page input */}
      <div className="flex items-center justify-center sm:justify-end gap-1.5 sm:gap-2 w-full sm:w-auto">
        {/* First Page Button */}
        <button
          type="button"
          onClick={() => handlePageSelect(1)}
          disabled={currentPage === 1}
          title="First Page"
          style={{
            width: "30px",
            height: "32px",
            padding: 0,
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
            flexShrink: 0,
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
          className="px-2 sm:px-3"
          style={{
            height: "32px",
            borderRadius: "8px",
            border: "1px solid #e7e5e4",
            background: currentPage === 1 ? "#fafaf9" : "#fff",
            color: currentPage === 1 ? "#cbd5e1" : "#44403c",
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            fontSize: "0.8rem",
            fontWeight: 700,
            transition: "all 150ms ease",
            opacity: currentPage === 1 ? 0.6 : 1,
            flexShrink: 0,
          }}
        >
          <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: "0.7rem" }} />
          <span className="hidden sm:inline">Prev</span>
        </button>

        {/* Center: Interactive Page Input Box */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            background: "#faf8f5",
            border: isFocused ? "1.5px solid #941717" : "1px solid #ede8e0",
            borderRadius: "8px",
            padding: "2px 6px",
            transition: "all 150ms ease",
            boxShadow: isFocused ? "0 0 0 2px rgba(148, 23, 23, 0.12)" : "none",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "#57534e", fontWeight: 600 }}>Page</span>
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
              width: "34px",
              height: "26px",
              padding: "0 2px",
              borderRadius: "5px",
              border: "1.5px solid #d6ccc2",
              background: "#ffffff",
              fontSize: "0.8rem",
              textAlign: "center",
              fontWeight: 800,
              color: "#941717",
              outline: "none",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
            }}
          />
          <span style={{ fontSize: "0.75rem", color: "#78716c", fontWeight: 600 }}>
            of <strong style={{ color: "#1c1917", fontWeight: 800 }}>{totalPages}</strong>
          </span>
        </div>

        {/* Next Page Button */}
        <button
          type="button"
          onClick={() => handlePageSelect(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Next Page"
          className="px-2 sm:px-3"
          style={{
            height: "32px",
            borderRadius: "8px",
            border: "1px solid #e7e5e4",
            background: currentPage === totalPages ? "#fafaf9" : "#fff",
            color: currentPage === totalPages ? "#cbd5e1" : "#44403c",
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            fontSize: "0.8rem",
            fontWeight: 700,
            transition: "all 150ms ease",
            opacity: currentPage === totalPages ? 0.6 : 1,
            flexShrink: 0,
          }}
        >
          <span className="hidden sm:inline">Next</span>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: "0.7rem" }} />
        </button>

        {/* Last Page Button */}
        <button
          type="button"
          onClick={() => handlePageSelect(totalPages)}
          disabled={currentPage === totalPages}
          title="Last Page"
          style={{
            width: "30px",
            height: "32px",
            padding: 0,
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
            flexShrink: 0,
          }}
        >
          <FontAwesomeIcon icon={faAnglesRight} />
        </button>
      </div>
    </div>
  );
}
