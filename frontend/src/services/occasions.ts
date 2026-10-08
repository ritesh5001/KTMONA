import { apiRequest } from "@/services/api";
import { CACHE_TAGS } from "@/lib/cache-tags";

export interface Occasion {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  isActive: boolean;
}

const OCCASIONS_REVALIDATE_SECONDS = 300;

export async function getOccasions() {
  return apiRequest<{ occasions: Occasion[] }>("/v1/occasions", {
    method: "GET",
    next: { revalidate: OCCASIONS_REVALIDATE_SECONDS, tags: [CACHE_TAGS.occasions] },
  });
}
