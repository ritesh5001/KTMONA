type ZRangeOptions = {
    rev?: boolean;
    withScores?: boolean;
};
export declare const redis: {
    ping(): Promise<string | null>;
    get<T = unknown>(key: string): Promise<T | null>;
    set(key: string, value: unknown, options?: {
        ex?: number;
    }): Promise<"OK" | null>;
    del(...keys: string[]): Promise<number>;
    incr(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    scan(cursor: string, matchPattern: string, count?: number): Promise<[string, string[]]>;
    zincrby(key: string, increment: number, member: string): Promise<string | null>;
    zadd(key: string, input: {
        score: number;
        member: string;
    }): Promise<number>;
    zremrangebyrank(key: string, start: number, stop: number): Promise<number>;
    zrange<T = string[]>(key: string, start: number, stop: number, options?: ZRangeOptions): Promise<T>;
    hincrby(key: string, field: string, increment: number): Promise<number>;
    hgetall(key: string): Promise<Record<string, string>>;
};
export declare function checkRedisConnection(): Promise<boolean>;
export {};
//# sourceMappingURL=redis.d.ts.map