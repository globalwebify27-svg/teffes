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
  tipAmount?: number;
  discountAmount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  deliveryOtp?: string;
  deliveryInstruction?: string;
  notes?: string;
  specialInstructions?: string;
  customer?: {
    name?: string;
    phone?: string;
    address?: string;
    deliveryInstruction?: string;
  };
  customerName?: string;
  customerPhone?: string;
  phone?: string;
  shippingAddress?: string;
  deliveryAddress?: string;
  address?: string;
  items?: OrderItem[];
  itemSummary?: string;
  storeName?: string;
  storeAddress?: string;
}

interface ThermalKOTModalProps {
  order: ThermalOrder | null;
  onClose: () => void;
}

export default function ThermalKOTModal({ order, onClose }: ThermalKOTModalProps) {
  const [paperWidth, setPaperWidth] = useState<"80mm" | "58mm">("80mm");
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!order) return null;

  // Print generation date & time (top of KOT)
  const printTimestamp = new Date();
  const formattedPrintDate = printTimestamp.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const formattedPrintTime = printTimestamp.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // Order Placement Date & Time
  const orderId = order.orderId || order.id || "TEF-0000";
  const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const formattedOrderDate = orderDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const formattedOrderTime = orderDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const isPickup =
    order.fulfillmentType === "pickup" ||
    order.pickupMode === true ||
    order.deliverySlot?.toLowerCase().includes("pickup") ||
    order.customer?.address?.toLowerCase().includes("pickup");

  // Customer info extraction with fallbacks
  const customerName = order.customer?.name || order.customerName || "Valued Customer";
  const customerPhone = order.customer?.phone || order.customerPhone || order.phone || "—";
  const customerAddress =
    order.customer?.address ||
    order.shippingAddress ||
    order.deliveryAddress ||
    order.address ||
    "Ranchi, Jharkhand";
  const specialInstruction =
    order.deliveryInstruction ||
    order.customer?.deliveryInstruction ||
    order.notes ||
    order.specialInstructions;

  const items = order.items && order.items.length > 0 ? order.items : [];
  const subtotal = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0) || order.amount;
  const deliveryFee = order.deliveryFee != null ? order.deliveryFee : (isPickup ? 0 : 35);
  const discount = order.discountAmount || 0;
  const isPaid =
    order.paymentStatus?.toLowerCase() === "paid" ||
    order.paymentMethod?.toLowerCase().includes("online") ||
    order.paymentMethod?.toLowerCase().includes("razorpay") ||
    order.paymentMethod?.toLowerCase().includes("upi");

  const handlePrint = () => {
    window.print();
  };

  const receiptWidthPx = paperWidth === "80mm" ? "330px" : "250px";

  return (
    <>
      {/* Print-specific style isolation */}
      <style jsx global>{`
        @media print {
          /* Hide all surrounding page content */
          body * {
            visibility: hidden !important;
          }
          #thermal-print-area, #thermal-print-area * {
            visibility: visible !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #thermal-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${paperWidth === "80mm" ? "76mm" : "54mm"} !important;
            height: auto !important;
            min-height: fit-content !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 2mm !important;
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm print:p-0 print:bg-transparent"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[94vh] flex flex-col overflow-hidden print:max-w-none print:w-auto print:shadow-none print:rounded-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top modal control bar (Hidden in print) */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-gray-50 print:hidden">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-800 text-[22px]">print</span>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Thermal Kitchen Order Ticket (KOT)</h3>
                <p className="text-xs text-gray-500">Optimized high-contrast readable print layout</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Paper size switch */}
              <div className="flex bg-gray-200 rounded-lg p-0.5 text-xs font-semibold text-gray-700">
                <button
                  type="button"
                  onClick={() => setPaperWidth("80mm")}
                  className={`px-3 py-1 rounded-md transition-all ${paperWidth === "80mm" ? "bg-white text-emerald-900 font-bold shadow-sm" : "hover:text-gray-900"}`}
                >
                  80mm
                </button>
                <button
                  type="button"
                  onClick={() => setPaperWidth("58mm")}
                  className={`px-3 py-1 rounded-md transition-all ${paperWidth === "58mm" ? "bg-white text-emerald-900 font-bold shadow-sm" : "hover:text-gray-900"}`}
                >
                  58mm
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          {/* Scrollable Receipt Preview */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/90 print:p-0 print:bg-white print:overflow-visible">
            <div
              id="thermal-print-area"
              ref={receiptRef}
              style={{ width: receiptWidthPx }}
              className="mx-auto bg-white p-4 shadow-xl text-black font-mono leading-tight select-none border border-gray-300 rounded-sm mb-8 print:border-none print:shadow-none print:p-0 print:m-0 print:w-full min-h-fit"
            >
              {/* Top KOT Download / Print Date-Time Header */}
              <div className="flex justify-between items-center text-[11.5px] font-bold pb-1 border-b border-black text-black">
                <span>{formattedPrintDate}, {formattedPrintTime}</span>
                <span>KOT / Digital Invoice</span>
              </div>

              {/* Receipt Header with Teffe's Logo & Details */}
              <div className="text-center pt-2.5 pb-2.5 border-b border-dashed border-black">
                {/* Black square logo container matching Teffe's original bill */}
                <div className="w-14 h-14 bg-black p-1.5 mx-auto flex items-center justify-center mb-1.5 rounded-sm">
                  <img
                    src="/teffes-logo-white.png"
                    alt="TeFFe's"
                    className="max-h-full max-w-full object-contain filter invert-0"
                  />
                </div>
                <div className="font-black text-lg tracking-wider uppercase text-black">
                  Teffes
                </div>
                <div className="text-[12.5px] font-medium leading-snug text-black mt-1">
                  teffes.com , near Kishore Ganj chowk, harmu road, ranchi , Jharkhand - 834001
                </div>
                <div className="text-[12px] font-bold text-black mt-1">
                  Order Placed On: {formattedOrderDate} {formattedOrderTime}
                </div>
                <div className="text-[13px] font-bold text-black mt-0.5">
                  Phone Number - 9279682955
                </div>

                <div className="mt-2 inline-block border-2 border-black px-3 py-1 font-black text-xs tracking-wider uppercase">
                  {isPickup ? "STORE COUNTER TAKEAWAY KOT" : "HOME DELIVERY KOT"}
                </div>
              </div>

              {/* Customer Information Section */}
              <div className="py-2.5 border-b border-dashed border-black space-y-1 text-[13px] text-black">
                <div className="flex items-baseline gap-1">
                  <span className="font-bold whitespace-nowrap">Customer Name -</span>
                  <span className="font-semibold">{customerName}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-bold whitespace-nowrap">Customer Number -</span>
                  <span className="font-semibold">{customerPhone}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-bold whitespace-nowrap">Order Number -</span>
                  <span className="font-black text-[14px]">{orderId}</span>
                </div>
                {order.deliverySlot && (
                  <div className="flex items-baseline gap-1">
                    <span className="font-bold whitespace-nowrap">Delivery Slot -</span>
                    <span className="font-semibold">{order.deliverySlot}</span>
                  </div>
                )}
                <div>
                  <span className="font-bold">Address - </span>
                  <span className="font-semibold break-words">
                    {isPickup
                      ? `Collection at Store Counter (${order.storeName || "Teffes Ranchi Flagship"})`
                      : customerAddress}
                  </span>
                </div>
                {specialInstruction && (
                  <div className="mt-1.5 p-1.5 bg-gray-100 border border-black text-[12px] font-bold">
                    <span>INSTRUCTION: </span>
                    <span>{specialInstruction}</span>
                  </div>
                )}
              </div>

              {/* Items & Cutting Specifications Table */}
              <div className="py-2.5 border-b border-dashed border-black">
                <div className="border-b border-black pb-1 mb-2 flex justify-between font-bold text-[13px] text-black uppercase">
                  <span className="flex-1">Items</span>
                  <span className="w-12 text-center">Qty.</span>
                  <span className="w-20 text-right">Total(₹)</span>
                </div>

                <div className="space-y-2.5">
                  {items.length > 0 ? (
                    items.map((item, idx) => (
                      <div key={idx} className="border-b border-dotted border-gray-400 pb-2">
                        <div className="flex justify-between items-start text-black">
                          <div className="flex-1 pr-2">
                            <div className="font-bold text-[13.5px] leading-snug">
                              {item.name}
                            </div>
                            <div className="text-[12px] font-semibold text-black mt-0.5">
                              <span>Weight: <strong>{item.netWeight || "500g"}</strong></span>
                              {item.cutType && <span> · Cut: <strong>{item.cutType}</strong></span>}
                            </div>
                          </div>
                          <div className="w-12 text-center font-bold text-[14px] text-black">
                            {item.quantity || 1}
                          </div>
                          <div className="w-20 text-right font-bold text-[13.5px] text-black">
                            ₹{(item.price * (item.quantity || 1)).toFixed(2)}
                          </div>
                        </div>
                        {(item.cuttingInstructions || item.notes) && (
                          <div className="mt-1 p-1 bg-gray-100 border border-black text-[12px] font-bold text-black font-sans">
                            <strong>Note:</strong> {item.cuttingInstructions || item.notes}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-[13px] font-semibold italic text-black">
                      {order.itemSummary || "Fresh Meat Items"}
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Bill Summary */}
              <div className="py-2.5 border-b border-dashed border-black space-y-1 text-[13px] text-black font-semibold">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{Number(subtotal).toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>-₹{Number(discount).toFixed(2)}</span>
                  </div>
                )}
                {!isPickup && (
                  <div className="flex justify-between">
                    <span>Delivery Charge:</span>
                    <span>₹{Number(deliveryFee).toFixed(2)}</span>
                  </div>
                )}
                {order.tipAmount != null && order.tipAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Rider Tip:</span>
                    <span>₹{Number(order.tipAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-[17px] pt-1.5 border-t border-dashed border-black text-black">
                  <span>TOTAL AMOUNT:</span>
                  <span>₹{Number(order.amount).toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Status Strip */}
              <div className="py-2.5 border-b border-dashed border-black text-center text-black">
                <div className="font-bold text-[13.5px]">
                  PAYMENT: {isPaid ? "PAID ONLINE" : "CASH ON DELIVERY (COD)"}
                </div>
                <div className="text-[12px] font-semibold mt-0.5">
                  {isPaid
                    ? `Paid via ${order.paymentMethod || "Online Gateway"} · Collect ₹0`
                    : `Please collect ₹${order.amount} in cash from customer`}
                </div>
              </div>

              {/* Customer Delivery OTP Verification */}
              {order.deliveryOtp && (
                <div className="py-2.5 border-b border-dashed border-black text-center text-black">
                  <div className="text-[12px] font-bold text-black uppercase">
                    CUSTOMER DELIVERY OTP:
                  </div>
                  <div className="inline-block border-2 border-black px-4 py-1 font-black text-xl tracking-[0.25em] my-1 text-black bg-white">
                    {order.deliveryOtp.split("").join(" ")}
                  </div>
                  <div className="text-[11px] font-medium text-black">
                    Rider must verify this code at doorstep
                  </div>
                </div>
              )}

              {/* Thermal Receipt Footer */}
              <div className="pt-3 pb-2 text-center text-[12px] text-black font-medium space-y-0.5">
                <div>Freshly cut & packed hygienically.</div>
                <div>Store chilled at 0°C to 4°C.</div>
                <div className="font-bold text-[13px] mt-1.5 text-black">
                  *** THANK YOU FOR YOUR ORDER ***
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Buttons (Hidden in print) */}
          <div className="flex items-center justify-between p-4 bg-white border-t border-gray-200 print:hidden">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Close
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#065f46] text-white text-sm font-bold rounded-xl shadow-lg hover:bg-[#044e39] transition-all cursor-pointer"
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
