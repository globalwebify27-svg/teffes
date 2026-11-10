"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export default function WalletSuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");

  useEffect(() => {
    const creditWallet = async () => {
      try {
        const raw = sessionStorage.getItem("pendingWalletRecharge");
        if (!raw) { router.replace("/dashboard"); return; }
        const { amount, txnid } = JSON.parse(raw);
        sessionStorage.removeItem("pendingWalletRecharge");
        // Verify topup with PayU transaction
        await api.post("/wallet/verify-topup", {
          amount,
          txnid: txnid || `WAL${Date.now()}`,
          status: "success",
        });
        setStatus("success");
        setTimeout(() => router.replace("/dashboard"), 2000);
      } catch (e) {
        setStatus("error");
        setTimeout(() => router.replace("/dashboard"), 3000);
      }
    };
    creditWallet();
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f9fafb", gap: 16 }}>
      {status === "processing" && <><div style={{ fontSize: 48 }}>?</div><h2 style={{ color: "#800020" }}>Adding money to wallet...</h2></>}
      {status === "success" && <><div style={{ fontSize: 48 }}>?</div><h2 style={{ color: "#16a34a" }}>Wallet Recharged!</h2><p>Balance updated. Redirecting...</p></>}
      {status === "error" && <><div style={{ fontSize: 48 }}>??</div><h2>Recharge issue</h2><p>Payment received. Please contact support. Redirecting...</p></>}
    </div>
  );
}
