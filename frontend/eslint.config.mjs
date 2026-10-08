import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // This codebase consumes several intentionally untyped third-party and
      // legacy API payloads. Keep those boundaries explicit in source instead
      // of replacing `any` with equally unsafe assertions solely for lint.
      "@typescript-eslint/no-explicit-any": "off",
      // Admin and seller upload previews intentionally use blob/data URLs,
      // which cannot be optimized by `next/image`.
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
