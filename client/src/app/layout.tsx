import type { Metadata } from "next";
import "./globals.css";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { config } from "@fortawesome/fontawesome-svg-core";
config.autoAddCss = false;

import { CartProvider } from "@/lib/cart";
import { WishlistProvider } from "@/lib/wishlist";
import AnnouncementBar from "@/components/layout/AnnouncementBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CartDrawer from "@/components/cart/CartDrawer";
import AdminLayoutWrapper from "@/components/layout/AdminLayoutWrapper";
import { LocationProvider } from "@/context/LocationContext";
import { ToastContainer } from "@/lib/toast";

export const metadata: Metadata = {
  title: {
    default: "Teffes — Fresh Meat, Chicken, Fish & Mutton in Ranchi",
    template: "%s | Teffes Ranchi",
  },
  description:
    "Order 100% fresh, hygienic, antibiotic-free Chicken, Tender Mutton, River Fish & Eggs in Ranchi. Cut fresh after your order with 0% cold storage. Delivered in 90 mins.",
  keywords: [
    "fresh meat in Ranchi",
    "fresh chicken delivery Ranchi",
    "fresh fish Ranchi",
    "mutton delivery Ranchi",
    "desi chicken",
    "teffes",
    "Kishore Ganj meat shop",
  ],
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "Teffes Ranchi",
  },
};

import { Plus_Jakarta_Sans } from "next/font/google";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
      </head>
      <body
        className={`${plusJakartaSans.variable} font-body-md text-body-md text-on-surface antialiased bg-background`}
        suppressHydrationWarning
      >
        <LocationProvider>
          <CartProvider>
            <WishlistProvider>
              <AdminLayoutWrapper
                storefront={
                  <>
                    <AnnouncementBar />
                    <Header />
                  </>
                }
                footer={<Footer />}
              >
                {children}
              </AdminLayoutWrapper>
              <CartDrawer />
              <ToastContainer />
            </WishlistProvider>
          </CartProvider>
        </LocationProvider>
      </body>
    </html>
  );
}
