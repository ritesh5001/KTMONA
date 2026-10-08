"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /**
   * Marks the field as mandatory and appends the shared red asterisk.
   *
   * The asterisk is aria-hidden because the requirement is already conveyed to
   * assistive tech by the input's own `required` attribute — announcing "star"
   * on top of that is just noise.
   */
  required?: boolean;
}

/**
 * Required-field marker.
 *
 * Exported separately for places that render a plain <label>, a legend or a
 * section heading instead of the Label component, so every form across the
 * storefront, vendor panel and admin marks mandatory fields identically.
 */
export function RequiredMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      title="Required"
      className={cn("ml-0.5 select-none font-semibold text-red-500", className)}
    >
      *
    </span>
  );
}

/**
 * Premium Label Component
 *
 * - Uppercase tracking for form labels
 * - Subtle color hierarchy
 * - `required` renders the shared red asterisk
 */
const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "text-xs font-medium tracking-wider uppercase text-muted-foreground",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
        {required ? <RequiredMark /> : null}
      </label>
    );
  }
);

Label.displayName = "Label";

export { Label };
