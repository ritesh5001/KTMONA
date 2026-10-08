/**
 * KTMONA Premium Motion Configuration
 * 
 * Centralized animation settings for a luxury, fabric-like motion experience.
 * All animations are slow, intentional, and subtle.
 */

import type { Transition, Variants } from "framer-motion";

// =========================================================================
// CORE TIMING CONFIGURATION
// =========================================================================

/**
 * Premium easing curve - smooth and elegant
 * Cubic bezier that feels like fabric unfolding
 */
export const premiumEase = [0.25, 0.1, 0.25, 1] as const;

/**
 * Slower easing for page transitions
 */
export const pageEase = [0.22, 0.03, 0.26, 1] as const;

// =========================================================================
// TRANSITION PRESETS
// =========================================================================

export const transitions = {
    /** Page entrance - slow and cinematic (0.7s) */
    pageEnter: {
        duration: 0.7,
        ease: pageEase,
    } as Transition,

    /** Standard fade for components (0.5s) */
    fade: {
        duration: 0.5,
        ease: premiumEase,
    } as Transition,

    /** Quick but smooth (0.4s) */
    quick: {
        duration: 0.4,
        ease: premiumEase,
    } as Transition,

    /** Hover effects - subtle and slow (0.4s) */
    hover: {
        duration: 0.4,
        ease: "easeOut",
    } as Transition,

    /** Stagger container */
    stagger: {
        staggerChildren: 0.08,
        delayChildren: 0.15,
    },

    /** Slow stagger for hero sections */
    staggerSlow: {
        staggerChildren: 0.12,
        delayChildren: 0.2,
    },
} as const;

// =========================================================================
// ANIMATION VARIANTS
// =========================================================================

/**
 * Page-level fade in with subtle upward movement
 */
export const pageVariants: Variants = {
    hidden: {
        opacity: 0,
        y: 12,
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: transitions.pageEnter,
    },
    exit: {
        opacity: 0,
        y: -8,
        transition: transitions.fade,
    },
};

/**
 * Component fade in - for cards, sections, etc.
 */
export const fadeInVariants: Variants = {
    hidden: {
        opacity: 0,
        y: 8,
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: transitions.fade,
    },
};

/**
 * Stagger container for lists
 */
export const staggerContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: transitions.stagger,
    },
};

/**
 * Stagger child items
 */
export const staggerItemVariants: Variants = {
    hidden: {
        opacity: 0,
        y: 8,
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: transitions.fade,
    },
};

/**
 * Hero section - slower stagger
 */
export const heroContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: transitions.staggerSlow,
    },
};

export const heroItemVariants: Variants = {
    hidden: {
        opacity: 0,
        y: 16,
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.7,
            ease: pageEase,
        },
    },
};

// =========================================================================
// HOVER ANIMATIONS
// =========================================================================

/**
 * Subtle lift on hover - for cards
 * translateY: -3px max
 */
export const hoverLift = {
    y: -3,
    transition: transitions.hover,
};

/**
 * Reset from hover
 */
export const hoverReset = {
    y: 0,
    transition: transitions.hover,
};

// =========================================================================
// VIEWPORT SETTINGS
// =========================================================================

/**
 * Default viewport trigger settings
 */
export const viewportSettings = {
    once: true,
    amount: 0.2,
    margin: "-50px",
} as const;
