import type { DecodedAccessToken } from '../utils/jwt.util.js';

/**
 * Extend Express Request interface to include authenticated user
 */
declare global {
    namespace Express {
        interface Request {
            /**
             * Authenticated user payload from JWT
             * Added by auth.middleware.ts after token verification
             */
            user?: DecodedAccessToken;

            /**
             * Session ID from refresh token
             * Added by auth.middleware.ts for session management
             */
            sessionId?: string;
        }
    }
}

export { };
