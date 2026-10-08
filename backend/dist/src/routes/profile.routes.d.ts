/**
 * Profile Routes
 * Base path: /v1/me
 *
 * Always scoped to the caller's own token — there is no :userId anywhere here,
 * so one account can never read or modify another's profile.
 */
declare const profileRouter: import("express-serve-static-core").Router;
export { profileRouter };
//# sourceMappingURL=profile.routes.d.ts.map