import { colors } from "./colors";
import { spacing, radius } from "./spacing";
import { typography } from "./typography";

// Re-export the canonical scales. Keeping one source prevents `lg` from being
// 16 in one component and 24 in the next.
export { colors, spacing, radius, typography };

export const shadow = {
  card: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
} as const;
