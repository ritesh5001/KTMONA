"use client";

import { motion, type HTMLMotionProps, type Transition } from "framer-motion";
import { transitions, viewportSettings } from "@/lib/motion.config";

interface FadeInProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    className?: string;
    /** Delay before animation starts (in seconds) */
    delay?: number;
    /** Whether to only animate once when in viewport */
    once?: boolean;
}

/**
 * FadeIn
 * 
 * Component-level fade animation with subtle upward movement.
 * Triggers when element enters viewport.
 * 
 * Animation: Opacity 0→1, translateY 8px→0 (0.5s)
 */
export function FadeIn({
    children,
    className = "",
    delay = 0,
    once = true,
    ...props
}: FadeInProps) {
    const baseTransition: Transition = {
        duration: transitions.fade.duration,
        ease: transitions.fade.ease,
        delay,
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once, amount: viewportSettings.amount }}
            transition={baseTransition}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    );
}
