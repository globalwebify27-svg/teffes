"use client";

import React, { useState, useRef } from "react";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  netWeight?: string;
  cutType?: string;
  cuttingInstructions?: string;
  notes?: string;
}

interface ThermalOrder {
  orderId?: string;
  id?: string;
  createdAt?: string;
  deliverySlot?: string;
  fulfillmentType?: string;
  pickupMode?: boolean;
  status?: string;
  amount: number;
  deliveryFee?: number;
  discountAmount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  deliveryOtp?: string;
  customer?: {
    name?: string;
    phone?: string;
    address?: string;
  };
  items?: OrderItem[];
  itemSummary?: string;
}

interface ThermalKOTModalProps {
  order: ThermalOrder | null;
  onClose: () => void;
}

export default function ThermalKOTModal({ order, onClose }: ThermalKOTModalProps) {
  const [paperWidth, setPaperWidth] = useState<"80mm" | "58mm">("80mm");
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!order) return null;

  const orderId = order.orderId || order.id || "TEF-0000";
  const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const formattedDate = orderDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const formattedTime = orderDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const isPickup =
    order.fulfillmentType === "pickup" ||
    order.pickupMode === true ||
    order.deliverySlot?.toLowerCase().includes("pickup") ||
    order.customer?.address?.toLowerCase().includes("pickup");

  const items = order.items && order.items.length > 0 ? order.items : [];
  const subtotal = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0) || order.amount;
  const deliveryFee = order.deliveryFee != null ? order.deliveryFee : (isPickup ? 0 : 35);
  const discount = order.discountAmount || 0;
  const isPaid = order.paymentStatus?.toLowerCase() === "paid" || order.paymentMethod?.toLowerCase().includes("online") || order.paymentMethod?.toLowerCase().includes("razorpay");

  const handlePrint = () => {
    window.print();
  };

  const receiptWidthPx = paperWidth === "80mm" ? "300px" : "220px";

  return (
    <>
      {/* Print-specific style isolation */}
      <style jsx global>{`
        @media print {
          /* Hide all page content except the printable thermal container */
          body * {
            visibility: hidden !important;
          }
          #thermal-print-area, #thermal-print-area * {
            visibility: visible !important;
          }
          #thermal-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${paperWidth === "80mm" ? "76mm" : "54mm"} !important;
            margin: 0 !important;
            padding: 4px !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            size: ${paperWidth === "80mm" ? "80mm" : "58mm"} auto;
            margin: 0mm;
          }
        }
      `}</style>

      {/* Screen Backdrop & Modal Preview */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:p-0 print:bg-transparent"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden print:max-w-none print:w-auto print:shadow-none print:rounded-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top modal control bar (Hidden in print) */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-gray-50 print:hidden">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">print</span>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Thermal Kitchen Order Ticket (KOT)</h3>
                <p className="text-xs text-gray-500">ESC/POS standard print layout</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Paper size switch */}
              <div className="flex bg-gray-200 rounded-lg p-0.5 text-xs font-semibold text-gray-700">
                <button
                  type="button"
                  onClick={() => setPaperWidth("80mm")}
                  className={`px-2.5 py-1 rounded-md transition-all ${paperWidth === "80mm" ? "bg-white text-primary shadow-sm" : "hover:text-gray-900"}`}
                >
                  80mm
                </button>
                <button
                  type="button"
                  onClick={() => setPaperWidth("58mm")}
                  className={`px-2.5 py-1 rounded-md transition-all ${paperWidth === "58mm" ? "bg-white text-primary shadow-sm" : "hover:text-gray-900"}`}
                >
                  58mm
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Scrollable Receipt Preview */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-100 flex justify-center print:p-0 print:bg-white print:overflow-visible">
            <div
              id="thermal-print-area"
              ref={receiptRef}
              style={{ width: receiptWidthPx }}
              className="bg-white p-4 shadow-md text-black font-mono text-[11px] leading-tight select-none border border-gray-200 print:border-none print:shadow-none print:p-1"
            >
              {/* Receipt Header */}
              <div className="text-center pb-2 border-b border-dashed border-black">
                <div className="font-black text-sm tracking-wider uppercase">TEFFE&apos;S FRESH</div>
                <div className="text-[10px] font-bold text-gray-800">PREMIUM BUTCHERY & FARM FRESH</div>
                <div className="text-[9px] mt-0.5">Harmu Road, Kishore Ganj, Ranchi</div>
                <div className="text-[9px]">Ph: +91 91555 88200 · teffes.in</div>
                <div className="mt-1.5 inline-block border border-black px-2 py-0.5 font-black text-[11px] tracking-wide">
                  {isPickup ? "🏪 STORE PICKUP KOT" : "🛵 HOME DELIVERY KOT"}
                </div>
              </div>

              {/* Order Info Strip */}
              <div className="py-2 border-b border-dashed border-black space-y-0.5 text-[10px]">
                <div className="flex justify-between font-bold">
                  <span>ORDER #: {orderId}</span>
                  <span>{order.status?.toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Date: {formattedDate}</span>
                  <span>{formattedTime}</span>
                </div>
                <div className="text-gray-800">
                  <span className="font-bold">Slot: </span>{order.deliverySlot || "90 Mins Express"}
                </div>
              </div>

              {/* Customer Details */}
              <div className="py-2 border-b border-dashed border-black space-y-0.5 text-[10px]">
                <div className="font-bold text-[11px]">CUSTOMER DETAILS:</div>
                <div className="font-bold">{order.customer?.name || "Customer"}</div>
                <div>Ph: {order.customer?.phone || "—"}</div>
                <div className="text-gray-800 break-words">
                  {isPickup
                    ? "Collection at Store Counter (Kishore Ganj)"
                    : `Addr: ${order.customer?.address || "Ranchi"}`}
                </div>
              </div>

              {/* Butcher Prep / Cutting Items List */}
              <div className="py-2 border-b border-dashed border-black">
                <div className="font-black text-[10.5px] uppercase mb-1">
                  BUTCHERY CUTTING SPECIFICATION:
                </div>
                <div className="border-b border-black pb-1 mb-1.5 flex justify-between font-bold text-[9.5px]">
                  <span>ITEM / CUT SPEC</span>
                  <span>QTY / WT</span>
                </div>

                <div className="space-y-2">
                  {items.length > 0 ? (
                    items.map((item, idx) => (
                      <div key={idx} className="border-b border-dotted border-gray-400 pb-1.5">
                        <div className="flex justify-between items-start font-bold">
                          <span className="flex-1 pr-1">{idx + 1}. {item.name}</span>
                          <span className="text-right whitespace-nowrap">x{item.quantity}</span>
                        </div>
                        <div className="text-[9.5px] text-gray-700 pl-2">
                          <span>Net Weight: <strong>{item.netWeight || "500g"}</strong></span>
                          {item.cutType && <span> · Cut: <strong>{item.cutType}</strong></span>}
                        </div>
                        {(item.cuttingInstructions || item.notes) && (
                          <div className="mt-0.5 pl-2 text-[9px] bg-gray-100 p-0.5 border border-dashed border-gray-400 font-sans">
                            ✂️ <strong>Note:</strong> {item.cuttingInstructions || item.notes}
                          </div>
                        )}
                        <div className="text-right text-[9.5px] text-gray-800 font-semibold mt-0.5">
                          ₹{item.price * (item.quantity || 1)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-[10px] italic">
                      {order.itemSummary || "Fresh Meat Items"}
                    </div>
                  )}
                </div>
              </div>

              {/* Bill Financial Summary */}
              <div className="py-2 border-b border-dashed border-black space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{subtotal}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount Coupon:</span>
                    <span>-₹{discount}</span>
                  </div>
                )}
                {!isPickup && (
                  <div className="flex justify-between">
                    <span>Delivery Charge:</span>
                    <span>₹{deliveryFee}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-[13px] pt-1 border-t border-dashed border-black">
                  <span>TOTAL AMOUNT:</span>
                  <span>₹{order.amount}</span>
                </div>
              </div>

              {/* Payment Status Strip */}
              <div className="py-2 border-b border-dashed border-black text-center">
                <div className="font-bold text-[11px]">
                  PAYMENT: {isPaid ? "✅ PAID ONLINE" : "⚠️ CASH ON DELIVERY (COD)"}
                </div>
                <div className="text-[9.5px] text-gray-700">
                  {isPaid
                    ? `Paid via ${order.paymentMethod || "Online Gateway"} · Collect ₹0`
                    : `Please collect ₹${order.amount} in cash from customer`}
                </div>
              </div>

              {/* Security / Delivery OTP Verification */}
              {order.deliveryOtp && (
                <div className="py-2 border-b border-dashed border-black text-center bg-gray-50">
                  <div className="text-[9px] font-bold text-gray-600">CUSTOMER DELIVERY OTP:</div>
                  <div className="font-black text-base tracking-widest my-0.5">
                    [ {order.deliveryOtp.split("").join(" ")} ]
                  </div>
                  <div className="text-[8.5px] text-gray-500">Rider must verify this code at doorstep</div>
                </div>
              )}

              {/* Thermal Footer */}
              <div className="pt-2 text-center text-[8.5px] text-gray-600 space-y-0.5">
                <div>Freshly cut & packed hygienically.</div>
                <div>Store chilled at 0°C to 4°C.</div>
                <div className="font-bold text-black mt-1">*** THANK YOU FOR YOUR ORDER ***</div>
              </div>
            </div>
          </div>

          {/* Bottom Action Buttons (Hidden in print) */}
          <div className="flex items-center justify-between p-4 bg-white border-t border-gray-200 print:hidden">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/25 hover:bg-primary-dark transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                <span>Print Thermal Ticket ({paperWidth})</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
