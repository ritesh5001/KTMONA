import { PrismaClient } from '@prisma/client';
/**
 * Singleton PrismaClient instance used across the entire backend.
 * In non-production environments it is pinned to globalThis so tsx
 * watch-mode restarts reuse the same connection pool.
 */
export declare const prisma: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import(".prisma/client").Prisma.RejectOnNotFound | import(".prisma/client").Prisma.RejectPerOperation | undefined, import("@prisma/client/runtime/index.js").DefaultArgs>;
/**
 * Graceful shutdown handler for Prisma connection.
 * Safe to call multiple times (Prisma ignores repeat disconnects).
 */
export declare function disconnectDatabase(): Promise<void>;
/**
 * Health check for database connection
 */
export declare function checkDatabaseConnection(): Promise<boolean>;
//# sourceMappingURL=db.d.ts.map