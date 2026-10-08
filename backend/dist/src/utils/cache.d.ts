export declare function getCache<T = unknown>(key: string): Promise<T | null>;
export declare function setCache(key: string, value: unknown, ttlSeconds: number): Promise<void>;
export declare function deleteCache(key: string | string[]): Promise<void>;
export declare function clearCache(pattern: string): Promise<void>;
//# sourceMappingURL=cache.d.ts.map