import type { Metadata } from "next";
import HomePageClient from "@/components/home/HomePageClient";
import {
  getPublicSeoSettings,
  buildWebSiteJsonLd,
  buildOrganizationJsonLd,
  safeJsonLdStringify,
} from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSeoSettings();
  const canonicalUrl = settings.canonicalUrl || "https://teffes.com";

  const ogImages: { url: string; alt?: string }[] = [];
  if (settings.logoUrl) {
    const fullLogoUrl = settings.logoUrl.startsWith("http")
      ? settings.logoUrl
      : `${canonicalUrl}${settings.logoUrl.startsWith("/") ? "" : "/"}${settings.logoUrl}`;
    ogImages.push({ url: fullLogoUrl, alt: settings.websiteName });
  }

  return {
    title: settings.metaTitle,
    description: settings.metaDescription,
    keywords: settings.metaKeywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: settings.metaTitle,
      description: settings.metaDescription,
      url: canonicalUrl,
      siteName: settings.websiteName,
      images: ogImages,
      type: "website",
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title: settings.metaTitle,
      description: settings.metaDescription,
      images: ogImages.length > 0 ? [ogImages[0].url] : [],
    },
  };
}

export default async function HomePage() {
  const settings = await getPublicSeoSettings();
  const websiteSchema = buildWebSiteJsonLd(settings);
  const organizationSchema = buildOrganizationJsonLd(settings);

  return (
    <>
      {/* Schema.org WebSite JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(websiteSchema) }}
      />

      {/* Schema.org Organization JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(organizationSchema) }}
      />

      {/* Interactive Client Component */}
      <HomePageClient />
    </>
  );
}
