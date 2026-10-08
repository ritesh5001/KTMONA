import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Premium Input Component
 * 
 * - Calm focus states with muted gold ring
 * - Soft ivory backgrounds
 * - Generous padding
 * - Smooth transitions
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          // Base structure
          "flex h-12 w-full rounded-lg border border-border-soft bg-card px-4",
          // Typography
          "text-sm text-foreground placeholder:text-muted-foreground",
          // Premium transition
          "transition-all duration-300 ease-out",
          // Focus state - muted gold ring
          "focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20",
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
          // File input styling
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
