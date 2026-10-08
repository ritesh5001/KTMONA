import { apiRequest } from "./apiClient";

export interface TryOnResult {
  predictionId: string;
  status: "completed";
  productImage: string;
  output: string[];
}

export async function createVirtualTryOn(params: {
  productId: string;
  variantId?: string | null;
  userImage: string;
  prompt?: string;
  signal?: AbortSignal;
}): Promise<TryOnResult> {
  return apiRequest<TryOnResult>({
    url: "/v1/try-on",
    method: "POST",
    data: {
      productId: params.productId,
      variantId: params.variantId ?? undefined,
      userImage: params.userImage,
      prompt: params.prompt,
    },
    signal: params.signal,
    timeout: 130000,
  });
}
