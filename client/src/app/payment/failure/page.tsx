"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PaymentFailurePage() {
  const router = useRouter();
  useEffect(() => { setTimeout(() => router.replace("/dashboard"), 3000); }, []);
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f9fafb", gap: 16 }}>
      <div style={{ fontSize: 48 }}>?</div>
      <h2 style={{ color: "#dc2626" }}>Payment Failed or Cancelled</h2>
      <p>Your order was not placed. Redirecting back...</p>
    </div>
  );
}
