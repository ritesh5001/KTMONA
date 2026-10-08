import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Premium Button Variants
 * - Navy primary, orange focus
 * - Heavy typography with letter-spacing
 * - Subtle hover states
 */
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-paper hover:bg-navy dark:bg-brand dark:text-ink dark:hover:bg-brand-muted",
  secondary:
    "bg-mist text-ink hover:bg-border-soft dark:bg-navy dark:text-paper dark:hover:bg-navy-soft",
  ghost:
    "bg-transparent text-ink hover:bg-mist dark:text-paper dark:hover:bg-navy/50",
  outline:
    "border border-border-strong bg-transparent text-ink hover:bg-mist dark:border-border dark:text-paper dark:hover:bg-navy/30",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-10 px-5 text-xs",
  md: "h-12 px-6 text-sm",
  lg: "h-14 px-8 text-sm",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        className={cn(
          // Base styles
          "inline-flex items-center justify-center gap-2 font-medium tracking-wide uppercase",
          // Premium transition
          "transition-all duration-400 ease-out active:scale-[0.985]",
          // Focus ring - brand orange
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          // Disabled state
          "disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className,
          "rounded-lg"
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
