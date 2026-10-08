import { apiRequest } from "./api";

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  bannerImage?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CategoryListResponse {
  categories: Category[];
}

export async function getCategories(): Promise<CategoryListResponse> {
  return apiRequest<CategoryListResponse>("/v1/categories", { method: "GET" });
}

export interface Occasion {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface OccasionListResponse {
  occasions: Occasion[];
}

export async function getOccasions(): Promise<OccasionListResponse> {
  return apiRequest<OccasionListResponse>("/v1/occasions", { method: "GET" });
}
