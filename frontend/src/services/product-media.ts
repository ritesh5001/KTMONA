import { apiRequest } from "@/services/api";

export interface ProductMedia {
  id: string;
  productId: string;
  type: "IMAGE" | "VIDEO";
  url: string;
  isThumbnail: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface AddMediaPayload {
  type: "IMAGE" | "VIDEO";
  url: string;
  isThumbnail?: boolean;
  sortOrder?: number;
}

export interface UpdateMediaPayload {
  type?: "IMAGE" | "VIDEO";
  url?: string;
  isThumbnail?: boolean;
  sortOrder?: number;
}

export async function addProductMedia(
  productId: string,
  data: AddMediaPayload,
  token?: string | null
) {
  return apiRequest<{ message: string; media: ProductMedia }>(
    `/v1/seller/products/${productId}/media`,
    { method: "POST", body: data, token }
  );
}

export async function updateProductMedia(
  mediaId: string,
  data: UpdateMediaPayload,
  token?: string | null
) {
  return apiRequest<{ message: string; media: ProductMedia }>(
    `/v1/seller/products/media/${mediaId}`,
    { method: "PUT", body: data, token }
  );
}

export async function deleteProductMedia(
  mediaId: string,
  token?: string | null
) {
  return apiRequest<{ message: string }>(
    `/v1/seller/products/media/${mediaId}`,
    { method: "DELETE", token }
  );
}
