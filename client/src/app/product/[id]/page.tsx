import type { Metadata } from "next";
import ProductDetailClient from "@/components/products/ProductDetailClient";
import { fetchProductById } from "@/lib/products";
import {
  getPublicSeoSettings,
  generateProductMetadata,
  buildProductJsonLd,
  safeJsonLdStringify,
} from "@/lib/seo";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const [data, settings] = await Promise.all([
    fetchProductById(id),
    getPublicSeoSettings(),
  ]);

  if (!data || !data.product) {
    return {
      title: "Product Details | TeFFe Ranchi",
      description: "Order fresh chicken, mutton, river fish and marinated cuts with 90-min fast delivery across Ranchi.",
    };
  }

  return generateProductMetadata(data.product, settings.canonicalUrl);
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { id } = await params;
  const [data, settings] = await Promise.all([
    fetchProductById(id),
    getPublicSeoSettings(),
  ]);

  const product = data?.product;
  const productJsonLd = product ? buildProductJsonLd(product, settings.canonicalUrl) : null;

  return (
    <>
      {productJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(productJsonLd) }}
        />
      )}
      <ProductDetailClient productId={id} initialProduct={product} />
    </>
  );
}
