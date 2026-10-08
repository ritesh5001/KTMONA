import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_WIDTH = 720;
const LOGO_HEIGHT = 141;

/**
 * KTMONA wordmark. Renders the navy-text logo on light surfaces and the
 * white-text logo in dark mode (or always, with `variant="light"` for navy
 * backgrounds). Size it with a height class, e.g. `className="h-8"`.
 */
export function BrandLogo({
  className,
  variant = "auto",
  priority = false,
}: {
  className?: string;
  variant?: "auto" | "light";
  priority?: boolean;
}) {
  const sizing = cn("w-auto", className);

  if (variant === "light") {
    return (
      <Image
        src="/ktmona-logo-light.webp"
        alt="KTMONA"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        className={sizing}
        priority={priority}
      />
    );
  }

  return (
    <>
      <Image
        src="/ktmona-logo.webp"
        alt="KTMONA"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        className={cn(sizing, "dark:hidden")}
        priority={priority}
      />
      <Image
        src="/ktmona-logo-light.webp"
        alt=""
        aria-hidden
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        className={cn(sizing, "hidden dark:block")}
        priority={priority}
      />
    </>
  );
}
