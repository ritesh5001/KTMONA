"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { pageVariants } from "@/lib/motion.config";

interface PageTransitionProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    className?: string;
}

/**
 * PageTransition
 * 
 * Wraps page content with a slow, cinematic entrance animation.
 * Use at the top level of each page for consistent page transitions.
 * 
 * Animation: Fade in with subtle upward movement (0.7s)
 */
export function PageTransition({
    children,
    className = "",
    ...props
}: PageTransitionProps) {
    return (
        <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={pageVariants}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    );
}
