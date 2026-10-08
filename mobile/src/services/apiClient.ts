import axios, {
  AxiosError,
  isAxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { jwtDecode } from "jwt-decode";
import {
  API_BASE_URL,
  ApiError,
  PRODUCTION_API_BASE_URL,
  triggerSessionExpired,
} from "./api";
import { clearSession, getAccessToken, loadSession, updateTokens } from "../storage/auth";

const REFRESH_THRESHOLD_SECONDS = 60;

function isTokenExpiringSoon(token: string): boolean {
  try {
    const { exp } = jwtDecode<{ exp?: number }>(token);
    if (typeof exp !== "number") return false;
    return exp < Date.now() / 1000 + REFRESH_THRESHOLD_SECONDS;
  } catch {
    return false;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function attemptTokenRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async (): Promise<string | null> => {
    try {
      const session = await loadSession();
      if (!session?.refreshToken) return null;

      const refreshBaseUrls =
        __DEV__ && API_BASE_URL !== PRODUCTION_API_BASE_URL
          ? [API_BASE_URL, PRODUCTION_API_BASE_URL]
          : [API_BASE_URL];

      let response:
        | Awaited<
            ReturnType<
              typeof axios.post<{
                accessToken?: string;
                refreshToken?: string;
              }>
            >
          >
        | null = null;
      for (const baseUrl of refreshBaseUrls) {
        try {
          response = await axios.post(
            `${baseUrl}/v1/auth/refresh`,
            { refreshToken: session.refreshToken },
            { headers: { "Content-Type": "application/json", Accept: "application/json" } }
          );
          break;
        } catch {
          response = null;
        }
      }

      if (!response) return null;

      const body = response.data ?? null;
      if (!body?.accessToken || !body?.refreshToken) return null;

      await updateTokens(body.accessToken, body.refreshToken);
      return body.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function extractApiMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const maybe = data as { error?: { message?: string }; message?: string };
  return maybe.error?.message ?? maybe.message ?? null;
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (isAxiosError(err)) {
    const status = err.response?.status ?? 0;
    const msg =
      extractApiMessage(err.response?.data) ??
      err.message ??
      "Request failed";
    return new ApiError(status, msg);
  }
  return new ApiError(0, err instanceof Error ? err.message : "Request failed");
}

function isNetworkFailure(err: unknown): boolean {
  if (!isAxiosError(err)) return false;
  return !err.response;
}

function shouldFallbackToProduction(config: AxiosRequestConfig, err: unknown): boolean {
  if (!__DEV__) return false;
  if (!isNetworkFailure(err)) return false;

  const currentBase = (config.baseURL ?? API_BASE_URL).replace(/\/+$/, "");
  if (currentBase === PRODUCTION_API_BASE_URL) return false;

  const marker = config as AxiosRequestConfig & { _usedProdFallback?: boolean };
  return !marker._usedProdFallback;
}

function createClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      Accept: "application/json",
    },
  });

  client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const nextConfig = config as InternalAxiosRequestConfig & { _retry?: boolean };
    const token = await getAccessToken();

    if (token && !nextConfig._retry && isTokenExpiringSoon(token)) {
      const refreshed = await attemptTokenRefresh();
      if (refreshed) {
        nextConfig.headers = nextConfig.headers ?? {};
        nextConfig.headers.Authorization = `Bearer ${refreshed}`;
        return nextConfig;
      }
    }

    if (token) {
      nextConfig.headers = nextConfig.headers ?? {};
      nextConfig.headers.Authorization = `Bearer ${token}`;
    }

    return nextConfig;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const status = error.response?.status;
      const originalConfig = (error.config ?? {}) as AxiosRequestConfig & { _retry?: boolean };

      if (status === 401 && !originalConfig._retry) {
        const newToken = await attemptTokenRefresh();
        if (newToken) {
          originalConfig._retry = true;
          originalConfig.headers = originalConfig.headers ?? {};
          (originalConfig.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
          return client.request(originalConfig);
        }

        const session = await loadSession();
        if (session?.accessToken) {
          await clearSession();
          triggerSessionExpired();
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
}

export const apiClient = createClient();

export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await apiClient.request<T>(config);
    return response.data as T;
  } catch (err) {
    if (shouldFallbackToProduction(config, err)) {
      if (__DEV__) {
        console.warn("[mobile-api] local request failed, retrying on production", {
          url: config.url,
          localBase: config.baseURL ?? API_BASE_URL,
          productionBase: PRODUCTION_API_BASE_URL,
        });
      }
      const retryConfig = {
        ...config,
        baseURL: PRODUCTION_API_BASE_URL,
        _usedProdFallback: true,
      } as AxiosRequestConfig & { _usedProdFallback?: boolean };

      try {
        const response = await apiClient.request<T>(retryConfig);
        return response.data as T;
      } catch (retryErr) {
        throw toApiError(retryErr);
      }
    }

    throw toApiError(err);
  }
}
