"use client";

import { usePathname } from "next/navigation";
import React from "react";

// Routes that must NOT show the storefront AnnouncementBar, Header, or Footer
const NO_STOREFRONT_ROUTES = [
  "/super-admin",
  "/store-admin",
  "/login",
  "/admin-login",
];

interface AdminLayoutWrapperProps {
  storefront: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}

export default function AdminLayoutWrapper({ storefront, footer, children }: AdminLayoutWrapperProps) {
  const pathname = usePathname();
  const hideStorefront = NO_STOREFRONT_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );

  if (hideStorefront) {
    // Auth & Admin portals: clean full-viewport layout without storefront navbar, offers bar, or footer
    return <>{children}</>;
  }

  return (
    <>
      {storefront}
      <main>{children}</main>
      {footer}
    </>
  );
}
