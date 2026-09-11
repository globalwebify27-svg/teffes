export interface Product {
  id: string;
  name: string;
  hindiName?: string;
  category: string;
  categoryLabel: string;
  description: string;
  pieces?: string;
  serves?: string;
  badge?: string;
  isBestseller?: boolean;
  image: string;
  images?: string[];
  netWeight: string;
  grossWeight?: string;
  price: number;
  originalPrice: number;
  rating: number;
  ratingCount: number;
  inStock: boolean;
  cutType?: string;
  cookingTime?: string;
  benefits?: string[];
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  icon: string;
  image: string;
  order?: number;
  isActive?: boolean;
}

export const CATEGORIES: Category[] = [];
export const PRODUCTS: Product[] = [];

// ─── Live Backend API Fetchers ────────────────────────────────────────────────
import api from "./api";

export async function fetchCategories(): Promise<Category[]> {
  try {
    const { data } = await api.get<{ success: boolean; categories: Category[] }>("/categories");
    if (data.success && data.categories && data.categories.length > 0) {
      const allItem: Category = {
        id: "all",
        slug: "all",
        name: "All Items",
        tagline: "Fresh Daily Catch & Cuts",
        icon: "",
        image: "",
      };
      return [allItem, ...data.categories.filter((c) => (c as any).isActive !== false)];
    }
  } catch (err) {
    console.warn("Backend categories unavailable:", err);
  }
  return [];
}

export async function fetchProducts(filters?: {
  category?: string;
  search?: string;
  bestseller?: boolean;
  sort?: string;
  limit?: number;
}): Promise<Product[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.category && filters.category !== "all") params.append("category", filters.category);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.bestseller) params.append("bestseller", "true");
    if (filters?.sort) params.append("sort", filters.sort);
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const { data } = await api.get<{ success: boolean; products: Product[] }>(
      `/products?${params.toString()}`
    );
    if (data.success && Array.isArray(data.products)) {
      return data.products;
    }
  } catch (err) {
    console.warn("Backend products unavailable:", err);
  }

  return [];
}

export async function fetchProductById(id: string): Promise<{ product: Product; related: Product[] } | null> {
  try {
    const { data } = await api.get<{ success: boolean; product: Product; related: Product[] }>(
      `/products/${id}`
    );
    if (data.success && data.product) {
      return { product: data.product, related: data.related || [] };
    }
  } catch (err) {
    console.warn(`Backend product ${id} unavailable:`, err);
  }

  return null;
}

export function getProductById(id: string, list: Product[] = []): Product | undefined {
  return list.find((p) => p.id === id || p.id.toLowerCase() === id.toLowerCase());
}

export function getRelatedProducts(currentProduct: Product, limit = 4, list: Product[] = []): Product[] {
  return list
    .filter((p) => p.id !== currentProduct.id && (p.category === currentProduct.category || p.isBestseller))
    .slice(0, limit);
}
