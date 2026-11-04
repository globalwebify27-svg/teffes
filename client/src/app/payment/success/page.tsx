"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { useCart } from "@/lib/cart";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const { clearCart } = useCart();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");

  useEffect(() => {
    const createOrder = async () => {
      try {
        const raw = sessionStorage.getItem("pendingOrderPayload");
        if (!raw) { router.replace("/dashboard"); return; }
        const orderPayload = JSON.parse(raw);
        sessionStorage.removeItem("pendingOrderPayload");
        await api.post("/orders", orderPayload);
        clearCart();
        setStatus("success");
        setTimeout(() => router.replace("/dashboard"), 2000);
      } catch (e) {
        setStatus("error");
        setTimeout(() => router.replace("/dashboard"), 3000);
      }
    };
    createOrder();
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f9fafb", gap: 16 }}>
      {status === "processing" && <><div style={{ fontSize: 48 }}>?</div><h2 style={{ color: "#800020" }}>Processing your order...</h2></>}
      {status === "success" && <><div style={{ fontSize: 48 }}>?</div><h2 style={{ color: "#16a34a" }}>Payment Successful!</h2><p>Your order has been placed. Redirecting...</p></>}
      {status === "error" && <><div style={{ fontSize: 48 }}>??</div><h2 style={{ color: "#dc2626" }}>Order creation issue</h2><p>Payment received but order may need attention. Redirecting...</p></>}
    </div>
  );
}
