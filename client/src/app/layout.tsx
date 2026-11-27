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
import NotificationPrompt from "@/components/common/NotificationPrompt";
import MetaPixel from "@/components/analytics/MetaPixel";

export const metadata: Metadata = {
  title: {
    default: "Teffes — Fresh Meat, Chicken, Fish & Mutton in Ranchi",
    template: "%s | Teffes Ranchi",
  },
  description:
    "Order 100% fresh, hygienic, antibiotic-free Chicken, Tender Mutton, River Fish & Marinated Cuts in Ranchi. Cut fresh after your order with 0% cold storage. Delivered in 90 mins.",
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
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
        {/* Google tag (gtm.js / Google-only tags) */}
        <script async src="https://www.googletagmanager.com/gtm.js?id=G-4TKY8XZSK7" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
            `,
          }}
        />
        {/* Meta Pixel Code */}
        <MetaPixel />
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
              <NotificationPrompt />
              <ToastContainer />
            </WishlistProvider>
          </CartProvider>
        </LocationProvider>
      </body>
    </html>
  );
}
