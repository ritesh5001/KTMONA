"use client";

import useSWR from "swr";
import { swrConfig } from "@/services/api";

export function useHydratedSWR<T>(options: {
  key: string;
  fetcher: () => Promise<T>;
  fallbackData?: T;
  enabled?: boolean;
  onError?: (error: unknown) => void;
}) {
  const { key, fetcher, fallbackData, enabled = true, onError } = options;

  return useSWR<T>(enabled ? key : null, fetcher, {
    ...swrConfig,
    fallbackData,
    revalidateOnMount: fallbackData === undefined,
    keepPreviousData: true,
    onError,
  });
}
