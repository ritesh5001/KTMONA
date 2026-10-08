"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import {
    staggerContainerVariants,
    staggerItemVariants,
    heroContainerVariants,
    heroItemVariants,
    viewportSettings
} from "@/lib/motion.config";

interface StaggerContainerProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    className?: string;
    /** Use slower hero stagger timing */
    hero?: boolean;
}

interface StaggerItemProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    className?: string;
    /** Use slower hero item timing */
    hero?: boolean;
}

/**
 * StaggerContainer
 * 
 * Wrapper that staggers the entrance of child StaggerItem components.
 * Children animate one after another with a slight delay.
 */
export function StaggerContainer({
    children,
    className = "",
    hero = false,
    ...props
}: StaggerContainerProps) {
    return (
        <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: viewportSettings.amount }}
            variants={hero ? heroContainerVariants : staggerContainerVariants}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    );
}

/**
 * StaggerItem
 * 
 * Child component for StaggerContainer.
 * Inherits stagger timing from parent.
 */
export function StaggerItem({
    children,
    className = "",
    hero = false,
    ...props
}: StaggerItemProps) {
    return (
        <motion.div
            variants={hero ? heroItemVariants : staggerItemVariants}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    );
}
