"use client";

import * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Premium Toast System
 * 
 * Philosophy: Toasts should feel like "a quiet concierge whisper"
 * - Soft cream background
 * - Subtle shadow  
 * - Rounded, elegant shape
 * - No harsh icons
 * - Calm, human, respectful tone
 * 
 * Motion:
 * - Enter: fade + slight rise (300-400ms)
 * - Exit: gentle fade
 * - No bounce, no spring
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const [theme, setTheme] = React.useState<ToasterProps["theme"]>("light");

  React.useEffect(() => {
    const updateTheme = () => {
      setTheme(
        document.documentElement.classList.contains("dark") ? "dark" : "light"
      );
    };

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <Sonner
      theme={theme}
      position="top-center"
      closeButton
      gap={12}
      className="toaster group"
      toastOptions={{
        duration: 3000,
        classNames: {
          toast:
            "border border-border-soft bg-paper text-ink shadow-[0_4px_24px_rgba(12,27,66,0.08)] rounded-xl dark:border-border-strong dark:bg-navy dark:text-paper",
          title: "text-sm font-medium tracking-tight",
          description: "text-xs text-navy-soft dark:text-mist/80",
          actionButton:
            "bg-ink text-paper text-xs font-medium uppercase tracking-wider px-4 py-2 rounded-md hover:bg-navy transition-colors dark:bg-brand dark:text-ink",
          cancelButton:
            "text-xs text-muted-foreground hover:text-foreground",
          closeButton:
            "border-0 bg-transparent text-navy-soft/60 hover:text-ink dark:text-mist/40 dark:hover:text-paper",
          success:
            "border-l-2 border-l-[#7B9971] bg-paper dark:bg-navy dark:border-l-[#8BAA7F]",
          error:
            "border-l-2 border-l-[#A67575] bg-paper dark:bg-navy dark:border-l-[#B88888]",
          warning:
            "border-l-2 border-l-[#FF8A00] bg-paper dark:bg-navy dark:border-l-brand",
          info:
            "border-l-2 border-l-[#8B9CB8] bg-paper dark:bg-navy dark:border-l-[#9EACC4]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
