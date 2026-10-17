import type { Metadata } from "next";

export interface PublicSeoSettings {
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string[];
  websiteName: string;
  canonicalUrl: string;
  businessDescription: string;
  logoUrl: string;
  socialLinks: {
    facebook?: string;
    instagram?: string;
    youtube?: string;
    twitter?: string;
    linkedin?: string;
  };
  contactDetails: {
    phone?: string;
    email?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  };
}

export const DEFAULT_SEO_SETTINGS: PublicSeoSettings = {
  metaTitle: "Teffes — Fresh Meat, Chicken, Fish & Mutton in Ranchi",
  metaDescription:
    "Order 100% fresh, hygienic, antibiotic-free Chicken, Tender Mutton, River Fish & Marinated Cuts in Ranchi. Cut fresh after your order with 0% cold storage. Delivered in 90 mins.",
  metaKeywords: [
    "fresh meat in Ranchi",
    "fresh chicken delivery Ranchi",
    "fresh fish Ranchi",
    "mutton delivery Ranchi",
    "desi chicken",
    "teffes",
    "Kishore Ganj meat shop",
  ],
  websiteName: "TeFFe",
  canonicalUrl: "https://teffes.com",
  businessDescription:
    "Teffes is Ranchi's trusted fresh meat delivery platform offering farm-fresh chicken, tender goat mutton, fresh river fish, and ready-to-cook marinated items cut fresh after ordering.",
  logoUrl: "/teffes-logo-white.png",
  socialLinks: {
    facebook: "https://facebook.com/teffes.official",
    instagram: "https://instagram.com/teffes.official",
    youtube: "https://youtube.com/@teffes",
    twitter: "",
    linkedin: "",
  },
  contactDetails: {
    phone: "+91 91539 85949",
    email: "care@teffes.com",
    address: {
      street: "Harmu Road, Kishore Ganj",
      city: "Ranchi",
      state: "Jharkhand",
      postalCode: "834001",
      country: "India",
    },
  },
};

/**
 * Escapes characters to safely embed JSON inside <script type="application/ld+json">
 * Prevents HTML and script injection (XSS)
 */
export function safeJsonLdStringify(data: any): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

/**
 * Server-side fetcher for public SEO settings with ISR / revalidation
 */
export async function getPublicSeoSettings(): Promise<PublicSeoSettings> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  try {
    let res = await fetch(`${apiUrl}/seo`, {
      next: { revalidate: 60, tags: ["seo-settings"] },
    });

    if (!res.ok && apiUrl.includes("onrender.com")) {
      try {
        const localRes = await fetch("http://localhost:5000/api/seo", { cache: "no-store" });
        if (localRes.ok) {
          res = localRes;
        }
      } catch (_) {}
    }

    if (!res.ok) {
      return DEFAULT_SEO_SETTINGS;
    }

    const json = await res.json();
    if (json?.success && json.settings) {
      const s = json.settings;
      return {
        metaTitle: s.metaTitle || DEFAULT_SEO_SETTINGS.metaTitle,
        metaDescription: s.metaDescription || DEFAULT_SEO_SETTINGS.metaDescription,
        metaKeywords: Array.isArray(s.metaKeywords) && s.metaKeywords.length > 0 ? s.metaKeywords : DEFAULT_SEO_SETTINGS.metaKeywords,
        websiteName: s.websiteName || DEFAULT_SEO_SETTINGS.websiteName,
        canonicalUrl: s.canonicalUrl ? s.canonicalUrl.replace(/\/$/, "") : DEFAULT_SEO_SETTINGS.canonicalUrl,
        businessDescription: s.businessDescription || DEFAULT_SEO_SETTINGS.businessDescription,
        logoUrl: s.logoUrl || DEFAULT_SEO_SETTINGS.logoUrl,
        socialLinks: { ...DEFAULT_SEO_SETTINGS.socialLinks, ...(s.socialLinks || {}) },
        contactDetails: {
          phone: s.contactDetails?.phone || DEFAULT_SEO_SETTINGS.contactDetails.phone,
          email: s.contactDetails?.email || DEFAULT_SEO_SETTINGS.contactDetails.email,
          address: {
            ...DEFAULT_SEO_SETTINGS.contactDetails.address,
            ...(s.contactDetails?.address || {}),
          },
        },
      };
    }
  } catch (error) {
    console.warn("[SEO] Error retrieving SEO settings from server, falling back to defaults:", error);
  }

  return DEFAULT_SEO_SETTINGS;
}

/**
 * Build WebSite structured data (Schema.org)
 */
export function buildWebSiteJsonLd(settings: PublicSeoSettings) {
  const baseUrl = settings.canonicalUrl || "https://teffes.com";
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.websiteName || "TeFFe",
    url: baseUrl,
    description: settings.metaDescription,
    potentialAction: {
      "@type": "SearchAction",
      target: `${baseUrl}/categories?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Build Organization structured data (Schema.org)
 */
export function buildOrganizationJsonLd(settings: PublicSeoSettings) {
  const baseUrl = settings.canonicalUrl || "https://teffes.com";
  const logoFullUrl = settings.logoUrl.startsWith("http")
    ? settings.logoUrl
    : `${baseUrl}${settings.logoUrl.startsWith("/") ? "" : "/"}${settings.logoUrl}`;

  const sameAsUrls = Object.values(settings.socialLinks || {})
    .filter((url): url is string => Boolean(url && typeof url === "string" && url.trim().length > 0));

  const org: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.websiteName || "TeFFe",
    url: baseUrl,
    logo: logoFullUrl,
    description: settings.businessDescription,
  };

  if (sameAsUrls.length > 0) {
    org.sameAs = sameAsUrls;
  }

  if (settings.contactDetails?.phone || settings.contactDetails?.email) {
    org.contactPoint = [
      {
        "@type": "ContactPoint",
        ...(settings.contactDetails.phone ? { telephone: settings.contactDetails.phone } : {}),
        ...(settings.contactDetails.email ? { email: settings.contactDetails.email } : {}),
        contactType: "customer service",
        areaServed: "IN",
        availableLanguage: ["English", "Hindi"],
      },
    ];
  }

  if (settings.contactDetails?.address?.street) {
    org.address = {
      "@type": "PostalAddress",
      streetAddress: settings.contactDetails.address.street,
      addressLocality: settings.contactDetails.address.city || "Ranchi",
      addressRegion: settings.contactDetails.address.state || "Jharkhand",
      postalCode: settings.contactDetails.address.postalCode || "834001",
      addressCountry: settings.contactDetails.address.country || "India",
    };
  }

  return org;
}

/**
 * Build Product structured data (Schema.org)
 */
export function buildProductJsonLd(product: any, baseUrl = "https://teffes.com") {
  const cleanBase = baseUrl.replace(/\/$/, "");
  const productUrl = `${cleanBase}/product/${product.id || product._id}`;
  
  const images: string[] = [];
  if (product.image) images.push(product.image);
  if (Array.isArray(product.images)) {
    product.images.forEach((img: string) => {
      if (img && !images.includes(img)) images.push(img);
    });
  }

  const rawDescription = product.seoDescription?.trim() || product.description?.trim();
  const description = rawDescription && rawDescription.length > 0
    ? rawDescription
    : `Buy fresh ${product.name} (${product.netWeight || "500g"}). 100% hygienic, zero cold storage. Fast 90-min delivery across Ranchi from Teffes.`;

  const structuredProduct: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description,
    image: images.length > 0 ? images : [`${cleanBase}/teffes-logo-white.png`],
    sku: String(product.id || product._id),
    category: product.categoryLabel || product.category || "Fresh Meat",
    brand: {
      "@type": "Brand",
      name: "TeFFe",
    },
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "INR",
      price: Number(product.price) || 0,
      itemCondition: "https://schema.org/NewCondition",
      availability: product.inStock !== false ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: "TeFFe",
      },
    },
  };

  // Only include aggregateRating if real and valid rating data exists (never fabricate)
  if (typeof product.rating === "number" && product.rating > 0 && typeof product.ratingCount === "number" && product.ratingCount > 0) {
    structuredProduct.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Math.min(5, Math.max(1, product.rating)),
      reviewCount: product.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return structuredProduct;
}

/**
 * Generate Product SEO Metadata for Next.js App Router
 */
export function generateProductMetadata(product: any, baseUrl = "https://teffes.com"): Metadata {
  const cleanBase = baseUrl.replace(/\/$/, "");
  const productUrl = `${cleanBase}/product/${product.id || product._id}`;

  const title = product.seoTitle?.trim()
    ? product.seoTitle.trim()
    : `${product.name} — Fresh & Hygienic in Ranchi | TeFFe`;

  const description = product.seoDescription?.trim()
    ? product.seoDescription.trim()
    : `${product.name} (${product.netWeight || "500g"}). Cut fresh after ordering with 0% cold storage. Delivered in 90 mins across Ranchi. Order online at TeFFe.`;

  const keywords: string[] = [];
  if (Array.isArray(product.seoKeywords)) {
    product.seoKeywords.forEach((k: string) => {
      if (k && !keywords.includes(k.trim())) keywords.push(k.trim());
    });
  } else if (typeof product.seoKeywords === "string" && product.seoKeywords.trim()) {
    product.seoKeywords.split(",").forEach((k: string) => {
      if (k.trim() && !keywords.includes(k.trim())) keywords.push(k.trim());
    });
  }

  if (keywords.length === 0) {
    keywords.push(
      product.name.toLowerCase(),
      `fresh ${product.category || "meat"} in Ranchi`,
      `${product.name} delivery`,
      "teffes ranchi"
    );
  }

  const images: string[] = [];
  if (product.image) images.push(product.image);
  if (Array.isArray(product.images)) {
    product.images.forEach((img: string) => {
      if (img && !images.includes(img)) images.push(img);
    });
  }

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: productUrl,
    },
    openGraph: {
      title,
      description,
      url: productUrl,
      siteName: "TeFFe Ranchi",
      images: images.map((url) => ({ url, alt: product.name })),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.length > 0 ? [images[0]] : [],
    },
  };
}
