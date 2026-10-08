import { apiRequest } from "@/services/api";

export type ProductAudience = "MENS" | "KIDS";

export interface SellerProduct {
  id: string;
  title: string;
  audience?: ProductAudience;
  description?: string | null;
  sellerPrice?: number;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  approvedAt?: string | null;
  approvedById?: string | null;
  isPublished: boolean;
  deletedByAdmin?: boolean;
  deletedByAdminAt?: string | null;
  deletedByAdminReason?: string | null;
  category?: {
    id: string;
    name: string;
  };
  variants: Array<{
    id: string;
    size: string;
    color?: string | null;
    colorHex?: string | null;
    images?: string[];
    sku: string;
    sellerPrice: number;
    compareAtPrice?: number | null;
    status: "PENDING" | "APPROVED" | "REJECTED";
    rejectionReason?: string | null;
    approvedAt?: string | null;
    inventory?: {
      stock: number;
    } | null;
  }>;
}

export interface SellerProductListResponse {
  products: SellerProduct[];
}

export interface CreateProductPayload {
  categoryId: string;
  audience?: ProductAudience;
  title: string;
  description?: string;
  isPublished?: boolean;
  images?: string[];
  occasionIds?: string[];
  variants: CreateVariantPayload[];
}

export interface CreateVariantPayload {
  size: string;
  color?: string;
  colorHex?: string | null;
  images?: string[];
  sku: string;
  sellerPrice: number;
  compareAtPrice?: number;
  initialStock?: number;
}

export interface UpdateVariantPayload {
  size?: string;
  color?: string | null;
  colorHex?: string | null;
  sku?: string;
  images?: string[];
  sellerPrice?: number;
  compareAtPrice?: number | null;
}

export async function listSellerProducts(token?: string | null) {
  return apiRequest<SellerProductListResponse>("/v1/seller/products", {
    method: "GET",
    token,
  });
}

export async function createSellerProduct(
  payload: CreateProductPayload,
  token?: string | null
) {
  return apiRequest<{ message: string; product: SellerProduct }>(
    "/v1/seller/products",
    {
      method: "POST",
      body: payload,
      token,
    }
  );
}

export async function deleteSellerProduct(
  productId: string,
  token?: string | null
) {
  return apiRequest<{ message: string }>(`/v1/seller/products/${productId}`,
    {
      method: "DELETE",
      token,
    }
  );
}

export async function updateSellerProduct(
  productId: string,
  payload: Partial<CreateProductPayload>,
  token?: string | null
) {
  return apiRequest<{ message: string; product: SellerProduct }>(
    `/v1/seller/products/${productId}`,
    {
      method: "PUT",
      body: payload,
      token,
    }
  );
}

export async function addVariantToProduct(
  productId: string,
  payload: CreateVariantPayload,
  token?: string | null
) {
  return apiRequest<{ message: string; variant: SellerProduct["variants"][0] }>(
    `/v1/seller/products/${productId}/variants`,
    {
      method: "POST",
      body: payload,
      token,
    }
  );
}

export async function updateVariantStock(
  variantId: string,
  stock: number,
  token?: string | null
) {
  return apiRequest<{ message: string; inventory: { variantId: string; stock: number } }>(
    `/v1/seller/products/variants/${variantId}/stock`,
    {
      method: "PUT",
      body: { stock },
      token,
    }
  );
}

export async function updateVariant(
  variantId: string,
  payload: UpdateVariantPayload,
  token?: string | null
) {
  return apiRequest<{ message: string; variant: SellerProduct["variants"][0] }>(
    `/v1/seller/products/variants/${variantId}`,
    {
      method: "PUT",
      body: payload,
      token,
    }
  );
}
