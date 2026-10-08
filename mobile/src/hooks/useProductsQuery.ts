import { useQuery } from "@tanstack/react-query";
import { getProducts, type ProductListResponse } from "../services/products";

type UseProductsQueryParams = {
  page?: number;
  limit?: number;
  categoryId?: string;
  audience?: "MENS" | "KIDS";
  search?: string;
  sort?: string;
};

export function useProductsQuery({
  page = 1,
  limit = 10,
  categoryId,
  audience,
  search,
  sort,
}: UseProductsQueryParams = {}) {
  return useQuery<ProductListResponse>({
    queryKey: ["products", { page, limit, categoryId, audience, search, sort }],
    queryFn: ({ signal }) =>
      getProducts({
        page,
        limit,
        categoryId,
        audience,
        search,
        sort,
        signal,
      }),
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    // Persisted showcase data should paint immediately. Forcing a request on
    // every mount discarded that advantage and put the loader back whenever a
    // shopper returned to Home.
    refetchOnMount: false,
    refetchOnReconnect: true,
    networkMode: "offlineFirst",
  });
}
