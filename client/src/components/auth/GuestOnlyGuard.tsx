"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getStoredUser } from "@/lib/auth";

interface GuestOnlyGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export default function GuestOnlyGuard({ children, redirectTo }: GuestOnlyGuardProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isAuthenticated()) {
      if (redirectTo) {
        router.replace(redirectTo);
        return;
      }
      const user = getStoredUser();
      const role = user?.role;
      if (role === "superadmin" || role === "admin") {
        router.replace("/super-admin");
      } else if (role === "storeadmin") {
        router.replace("/store-admin");
      } else {
        router.replace("/");
      }
    } else {
      setChecking(false);
    }
  }, [router, redirectTo]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-500">Checking session…</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
