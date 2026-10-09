/**
 * Feature switches. Set the env var to "true" to turn a feature on; the
 * backend has a matching flag (FEATURE_ADS) that must be on as well.
 */
export const ADS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_ADS === "true";
