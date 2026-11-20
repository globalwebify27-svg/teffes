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
  totalAmount?: number;
  deliveryFee?: number;
  tipAmount?: number;
  discountAmount?: number;
  manualDiscount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  deliveryOtp?: string;
  deliveryInstruction?: string;
  notes?: string;
  specialInstructions?: string;
  customer?: {
    name?: string;
    phone?: string;
    receiverPhone?: string;
    alternatePhone?: string;
    receiverName?: string;
    alternateName?: string;
    address?: string;
    deliveryInstruction?: string;
  };
  customerName?: string;
  customerPhone?: string;
  receiverPhone?: string;
  alternatePhone?: string;
  receiverName?: string;
  alternateName?: string;
  phone?: string;
  shippingAddress?: string;
  deliveryAddress?: string;
  address?: string;
  items?: OrderItem[];
  itemSummary?: string;
  storeName?: string;
  storeAddress?: string;
  isModified?: boolean;
  originalAmount?: number;
  additionalAmountDue?: number;
  modifiedAt?: string;
  modificationReason?: string;
  scheduledDeliveryDate?: string;
  targetDeliveryTime?: string;
}

interface ThermalKOTModalProps {
  order: ThermalOrder | null;
  onClose: () => void;
}

const IST_MS = 5.5 * 60 * 60 * 1000;
const ymd = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

function getSlotDisplay(order: ThermalOrder): string | null {
  if (!order.deliverySlot) return null;
  let slot = order.deliverySlot;
  const todayIST = ymd(new Date(Date.now() + IST_MS));
  let targetIST = order.scheduledDeliveryDate || "";
  if (!targetIST && order.targetDeliveryTime) {
    const dt = new Date(order.targetDeliveryTime);
    if (!isNaN(dt.getTime())) targetIST = ymd(new Date(dt.getTime() + IST_MS));
  }
  if (!targetIST && order.createdAt) {
    const placed = new Date(order.createdAt);
    const placedIST = new Date(placed.getTime() + IST_MS);
    const h = placedIST.getUTCHours();
    const m = placedIST.getUTCMinutes();
    targetIST =
      h >= 20 || (h === 19 && m >= 59)
        ? ymd(new Date(placed.getTime() + 24 * 60 * 60 * 1000 + IST_MS))
        : ymd(placedIST);
  }
  const isToday = !targetIST || targetIST <= todayIST;
  if (isToday && /tomorrow/i.test(slot)) {
    slot = slot
      .replace(/Next-Day Delivery:\s*Tomorrow/i, "Morning Delivery: Today")
      .replace(/Tomorrow/i, "Today");
  }
  return slot;
}

export default function ThermalKOTModal({ order, onClose }: ThermalKOTModalProps) {
  const [paperWidth, setPaperWidth] = useState<"80mm" | "58mm">("80mm");
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!order) return null;

  const is58 = paperWidth === "58mm";
  // Real printable widths of thermal paper
  const printWidth = is58 ? "48mm" : "72mm";

  // Font sizes (px) per paper width
  const F = is58
    ? { small: 10.5, base: 12, info: 14, name: 13, bill: 12, total: 14, otp: 20, head: 15 }
    : { small: 12, base: 13, info: 16, name: 15, bill: 14, total: 17, otp: 24, head: 18 };
  const QTY_W = is58 ? 24 : 28;
  const TOT_W = is58 ? 58 : 66;

  const now = new Date();
  const printDate = now.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const printTime = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  const orderId = order.orderId || order.id || "TEF-0000";
  const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const orderDateStr = orderDate.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const orderTimeStr = orderDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  const isPickup =
    order.fulfillmentType === "pickup" ||
    order.pickupMode === true ||
    order.deliverySlot?.toLowerCase().includes("pickup") ||
    order.customer?.address?.toLowerCase().includes("pickup");

  const customerName = order.customer?.name || order.customerName || "Valued Customer";
  const customerPhone = order.customer?.phone || order.customerPhone || order.phone || "—";
  const altPhone = order.receiverPhone || order.alternatePhone || order.customer?.receiverPhone || order.customer?.alternatePhone || "";
  const altName = order.receiverName || order.alternateName || order.customer?.receiverName || order.customer?.alternateName || "";
  const customerAddress =
    order.customer?.address || order.shippingAddress || order.deliveryAddress || order.address || "Ranchi, Jharkhand";
  const specialInstruction =
    order.deliveryInstruction || order.customer?.deliveryInstruction || order.notes || order.specialInstructions;

  const items = order.items && order.items.length > 0 ? order.items : [];
  const subtotal = items.reduce((sum, it) => sum + it.price * (it.quantity || 1), 0) || order.amount;
  const deliveryFee = order.deliveryFee != null ? order.deliveryFee : isPickup ? 0 : 35;
  const discount = order.discountAmount || 0;
  const isPaid =
    order.paymentStatus?.toLowerCase() === "paid" ||
    order.paymentMethod?.toLowerCase().includes("online") ||
    order.paymentMethod?.toLowerCase().includes("razorpay") ||
    order.paymentMethod?.toLowerCase().includes("upi");
  const slotDisplay = getSlotDisplay(order);

  const handlePrint = () => {
    const el = receiptRef.current;
    if (!el) return;

    document.getElementById("thermal-kot-print-frame")?.remove();

    const frame = document.createElement("iframe");
    frame.id = "thermal-kot-print-frame";
    frame.style.cssText = `position:fixed;left:-9999px;top:0;width:${printWidth};height:100px;border:0;`;
    document.body.appendChild(frame);

    const doc = frame.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <base href="${window.location.origin}/">
  <title>KOT_${orderId}</title>
  <style>
    @page { size: ${paperWidth} auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      width: ${printWidth};
      height: auto; overflow: visible;
      background: #fff; color: #000;
      font-family: monospace;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    #kot-root { width: ${printWidth}; padding-bottom: 10mm; }
    #kot-root * { color: #000 !important; }
    #kot-root img { max-width: 100%; }
  </style>
</head>
<body><div id="kot-root">${el.outerHTML}</div></body>
</html>`);
    doc.close();

    const imgs = Array.from(doc.images);
    const waitImgs = Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((r) => {
            img.onload = img.onerror = () => r();
          })
      )
    );
    Promise.race([waitImgs, new Promise((r) => setTimeout(r, 1500))]).then(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    });
  };

  const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "4px" };
  const nowrap: React.CSSProperties = { whiteSpace: "nowrap" };
  const section: React.CSSProperties = {
    paddingBottom: "6px",
    borderBottom: "1px dashed #000",
    marginBottom: "6px",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[94vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-800 text-[22px]">print</span>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Thermal Kitchen Order Ticket (KOT)</h3>
              <p className="text-xs text-gray-500">Preview is at real paper width</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-200 rounded-lg p-0.5 text-xs font-semibold text-gray-700">
              <button
                type="button"
                onClick={() => setPaperWidth("80mm")}
                className={`px-3.5 py-1 rounded-md transition-all ${paperWidth === "80mm" ? "bg-white text-emerald-900 font-bold shadow-sm" : "hover:text-gray-900"}`}
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

        {/* Preview (zoom is only on this wrapper, not on the printed element) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/90">
          <div style={{ zoom: 1.3, display: "flex", justifyContent: "center" }}>
            <div
              ref={receiptRef}
              style={{
                width: printWidth,
                boxSizing: "border-box",
                background: "#fff",
                color: "#000",
                fontFamily: "monospace",
                lineHeight: 1.25,
                padding: "6px 1mm",
                textAlign: "left",
                overflow: "hidden",
              }}
            >
              {/* Top row */}
              <div style={{ ...row, fontSize: `${F.small}px`, fontWeight: 700, paddingBottom: "4px", borderBottom: "1px solid #000", marginBottom: "6px" }}>
                <span>{printDate}, {printTime}</span>
                <span>KOT</span>
              </div>

              {/* Store */}
              <div style={{ ...section, textAlign: "center" }}>
                <div style={{ width: "46px", height: "46px", background: "#000", padding: "5px", margin: "0 auto 4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img src="/teffes-logo-white.png" alt="TeFFe's" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                </div>
                <div style={{ fontWeight: 900, fontSize: `${F.head}px`, letterSpacing: "2px" }}>TEFFES</div>
                <div style={{ fontSize: `${F.small}px`, fontWeight: 600, marginTop: "2px", wordBreak: "break-word" }}>
                  teffes.com, near Kishore Ganj chowk, harmu road, Ranchi, JH - 834001
                </div>
                <div style={{ fontSize: `${F.small}px`, fontWeight: 700, marginTop: "2px" }}>
                  Order: {orderDateStr} {orderTimeStr}
                </div>
                <div style={{ fontSize: `${F.base}px`, fontWeight: 900, marginTop: "2px" }}>Ph: 9279682955</div>
                <div style={{ marginTop: "5px", display: "inline-block", border: "1.5px solid #000", padding: "2px 8px", fontWeight: 900, fontSize: `${F.base}px`, letterSpacing: "1px" }}>
                  {isPickup ? "STORE TAKEAWAY KOT" : "HOME DELIVERY KOT"}
                </div>
              </div>

              {/* Customer — larger text */}
              <div style={{ ...section, fontSize: `${F.info}px`, lineHeight: 1.35, fontWeight: 700 }}>
                <div style={{ wordBreak: "break-word" }}><b style={{ fontWeight: 900 }}>Name:</b> {customerName}</div>
                <div><b style={{ fontWeight: 900 }}>Phone:</b> {customerPhone}</div>
                {altPhone && (
                  <div><b style={{ fontWeight: 900 }}>Alt/Receiver:</b> {altName ? `${altName} (${altPhone})` : altPhone}</div>
                )}
                <div style={{ wordBreak: "break-all" }}><b style={{ fontWeight: 900 }}>Order:</b> {orderId}</div>
                {slotDisplay && (
                  <div style={{ wordBreak: "break-word" }}><b style={{ fontWeight: 900 }}>Slot:</b> {slotDisplay}</div>
                )}
                <div style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                  <b style={{ fontWeight: 900 }}>Address:</b>{" "}
                  {isPickup ? `Pickup at Store (${order.storeName || "Teffes Ranchi"})` : customerAddress}
                </div>
                {specialInstruction && (
                  <div style={{ marginTop: "4px", padding: "3px 5px", border: "1px solid #000", fontSize: `${F.base}px`, fontWeight: 800, wordBreak: "break-word" }}>
                    INSTRUCTION: {specialInstruction}
                  </div>
                )}
                {order.modificationReason && (
                  <div style={{ marginTop: "4px", padding: "3px 5px", border: "1px solid #000", fontSize: `${F.base}px`, fontWeight: 900, wordBreak: "break-word" }}>
                    REVISION: {order.modificationReason}
                  </div>
                )}
              </div>

              {/* Items */}
              <div style={section}>
                <div style={{ display: "flex", gap: "3px", borderBottom: "1.5px solid #000", paddingBottom: "3px", marginBottom: "5px", fontWeight: 900, fontSize: `${F.base}px` }}>
                  <span style={{ flex: 1, minWidth: 0 }}>ITEMS</span>
                  <span style={{ width: `${QTY_W}px`, textAlign: "center" }}>QTY</span>
                  <span style={{ width: `${TOT_W}px`, textAlign: "right" }}>TOTAL</span>
                </div>
                {items.length > 0 ? (
                  items.map((item, idx) => (
                    <div key={idx} style={{ borderBottom: "1px dotted #000", paddingBottom: "5px", marginBottom: "5px" }}>
                      <div style={{ display: "flex", gap: "3px", alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 900, fontSize: `${F.name}px`, wordBreak: "break-word", overflowWrap: "anywhere" }}>{item.name}</div>
                          <div style={{ fontWeight: 700, fontSize: `${F.small}px`, marginTop: "1px" }}>
                            Wt: {item.netWeight || "500g"}
                            {item.cutType && <span> · Cut: {item.cutType}</span>}
                          </div>
                        </div>
                        <div style={{ width: `${QTY_W}px`, textAlign: "center", fontWeight: 900, fontSize: `${F.name}px` }}>
                          {item.quantity || 1}
                        </div>
                        <div style={{ width: `${TOT_W}px`, textAlign: "right", fontWeight: 900, fontSize: `${F.name}px`, ...nowrap }}>
                          {(item.price * (item.quantity || 1)).toFixed(0)}
                        </div>
                      </div>
                      {(item.cuttingInstructions || item.notes) && (
                        <div style={{ marginTop: "3px", padding: "2px 4px", border: "1px solid #000", fontSize: `${F.small}px`, fontWeight: 700, wordBreak: "break-word" }}>
                          Note: {item.cuttingInstructions || item.notes}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: `${F.base}px`, fontStyle: "italic" }}>{order.itemSummary || "Fresh Meat Items"}</div>
                )}
              </div>

              {/* Bill summary */}
              <div style={{ ...section, fontSize: `${F.bill}px`, fontWeight: 700 }}>
                <div style={row}><span>Subtotal:</span><span style={nowrap}>Rs.{Number(subtotal).toFixed(2)}</span></div>
                {discount > 0 && (
                  <div style={row}><span>Discount{order.manualDiscount ? " (Store)" : ""}:</span><span style={nowrap}>-Rs.{Number(discount).toFixed(2)}</span></div>
                )}
                {!isPickup && (
                  <div style={row}><span>Delivery:</span><span style={nowrap}>Rs.{Number(deliveryFee).toFixed(2)}</span></div>
                )}
                {order.tipAmount != null && order.tipAmount > 0 && (
                  <div style={row}><span>Rider Tip:</span><span style={nowrap}>Rs.{Number(order.tipAmount).toFixed(2)}</span></div>
                )}
                <div style={{ ...row, fontWeight: 900, fontSize: `${F.total}px`, paddingTop: "4px", borderTop: "2px dashed #000", marginTop: "4px" }}>
                  <span>TOTAL:</span>
                  <span style={nowrap}>Rs.{Number(order.amount ?? order.totalAmount ?? 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Payment */}
              <div style={{ ...section, textAlign: "center", fontSize: `${F.base}px` }}>
                {order.isModified && (
                  <div style={{ marginBottom: "4px", padding: "3px 5px", border: "1px solid #000", fontWeight: 900, fontSize: `${F.small}px` }}>
                    REVISED ORDER (MODIFIED)
                    {order.modificationReason && <div style={{ fontWeight: 700, marginTop: "2px", wordBreak: "break-word" }}>Reason: {order.modificationReason}</div>}
                  </div>
                )}
                <div style={{ fontWeight: 900, fontSize: `${F.name}px` }}>
                  PAYMENT: {isPaid ? "PAID ONLINE" : "CASH ON DELIVERY (COD)"}
                </div>
                <div style={{ fontWeight: 700, marginTop: "2px", wordBreak: "break-word" }}>
                  {isPaid
                    ? (order.additionalAmountDue ?? 0) > 0
                      ? `Online Paid: Rs.${order.originalAmount || order.amount - (order.additionalAmountDue || 0)} · COLLECT Rs.${order.additionalAmountDue} EXTRA`
                      : `Paid via ${order.paymentMethod || "Online"} · Collect Rs.0`
                    : `Collect Rs.${order.amount} in cash from customer`}
                </div>
              </div>

              {/* OTP */}
              {order.deliveryOtp && (
                <div style={{ ...section, textAlign: "center" }}>
                  <div style={{ fontWeight: 900, fontSize: `${F.base}px`, marginBottom: "3px" }}>CUSTOMER DELIVERY OTP:</div>
                  <div style={{ display: "inline-block", border: "2px solid #000", padding: "3px 12px", fontWeight: 900, fontSize: `${F.otp}px`, letterSpacing: "4px" }}>
                    {order.deliveryOtp.split("").join(" ")}
                  </div>
                  <div style={{ fontSize: `${F.small}px`, fontWeight: 700, marginTop: "3px" }}>
                    Rider must verify this code at doorstep
                  </div>
                </div>
              )}

              {/* Footer */}
              <div style={{ textAlign: "center", fontSize: `${F.small}px`, fontWeight: 600, paddingTop: "2px" }}>
                <div>Freshly cut &amp; packed hygienically.</div>
                <div>Store chilled at 0°C to 4°C.</div>
                <div style={{ fontWeight: 900, fontSize: `${F.base}px`, marginTop: "3px" }}>*** THANK YOU ***</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom buttons */}
        <div className="flex items-center justify-between p-4 bg-white border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Close
          </button>
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
  );
}