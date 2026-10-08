/**
 * Palette an admin picks a variant swatch from.
 *
 * The colour *name* stays whatever the vendor typed ("Bottle Green", "Wine").
 * This grid only supplies the hex the storefront paints the circle with, so the
 * options are grouped by family to make finding a close match quick.
 */
export interface SwatchOption {
    hex: string;
    label: string;
}

export interface SwatchGroup {
    family: string;
    options: SwatchOption[];
}

export const SWATCH_GROUPS: SwatchGroup[] = [
    {
        family: "Neutrals",
        options: [
            { hex: "#ffffff", label: "White" },
            { hex: "#f5f1e8", label: "Off White" },
            { hex: "#e8dcc8", label: "Cream" },
            { hex: "#d6c7a8", label: "Beige" },
            { hex: "#b8a888", label: "Sand" },
            { hex: "#9c9c9c", label: "Grey" },
            { hex: "#5a5a5a", label: "Charcoal" },
            { hex: "#2b2b2b", label: "Jet Black" },
            { hex: "#000000", label: "Black" },
        ],
    },
    {
        family: "Reds & Pinks",
        options: [
            { hex: "#ffd1dc", label: "Blush" },
            { hex: "#f8a5c2", label: "Baby Pink" },
            { hex: "#e75480", label: "Rose" },
            { hex: "#c2185b", label: "Magenta" },
            { hex: "#d32f2f", label: "Red" },
            { hex: "#a4133c", label: "Crimson" },
            { hex: "#7b2d3b", label: "Wine" },
            { hex: "#5c1a1b", label: "Maroon" },
        ],
    },
    {
        family: "Oranges & Yellows",
        options: [
            { hex: "#ffe5b4", label: "Peach" },
            { hex: "#ffc300", label: "Marigold" },
            { hex: "#f4a261", label: "Apricot" },
            { hex: "#e07a20", label: "Orange" },
            { hex: "#cc5500", label: "Rust" },
            { hex: "#b5651d", label: "Terracotta" },
            { hex: "#daa520", label: "Mustard" },
            { hex: "#8b6914", label: "Bronze" },
        ],
    },
    {
        family: "Greens",
        options: [
            { hex: "#d8e8d0", label: "Mint" },
            { hex: "#a8c69f", label: "Sage" },
            { hex: "#7b9971", label: "Pista" },
            { hex: "#4f7942", label: "Fern" },
            { hex: "#2e6f40", label: "Emerald" },
            { hex: "#14452f", label: "Bottle Green" },
            { hex: "#556b2f", label: "Olive" },
            { hex: "#3d4f2f", label: "Mehendi" },
        ],
    },
    {
        family: "Blues & Purples",
        options: [
            { hex: "#cfe8f3", label: "Powder Blue" },
            { hex: "#7ab8d9", label: "Sky" },
            { hex: "#2a6f97", label: "Teal Blue" },
            { hex: "#1d3557", label: "Navy" },
            { hex: "#0d1b3e", label: "Midnight" },
            { hex: "#8e7cc3", label: "Lilac" },
            { hex: "#6a4c93", label: "Purple" },
            { hex: "#4a235a", label: "Aubergine" },
        ],
    },
    {
        family: "Metallics & Browns",
        options: [
            { hex: "#d4af37", label: "Gold" },
            { hex: "#c0c0c0", label: "Silver" },
            { hex: "#b87333", label: "Copper" },
            { hex: "#e5c07b", label: "Champagne" },
            { hex: "#a0522d", label: "Sienna" },
            { hex: "#6f4e37", label: "Coffee" },
            { hex: "#4b3621", label: "Chocolate" },
            { hex: "#2f1b0c", label: "Espresso" },
        ],
    },
];

/** Accepts `#rgb` or `#rrggbb`, normalised to lowercase `#rrggbb`. */
export function normalizeHex(value?: string | null): string | null {
    const trimmed = value?.trim().toLowerCase();
    if (!trimmed) return null;

    const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    if (/^#[0-9a-f]{6}$/.test(withHash)) return withHash;
    if (/^#[0-9a-f]{3}$/.test(withHash)) {
        const [, r, g, b] = withHash;
        return `#${r}${r}${g}${g}${b}${b}`;
    }

    return null;
}

/**
 * Relative luminance, used to decide whether a swatch needs a visible outline
 * (a white circle on a white card is otherwise invisible).
 */
export function isLightHex(hex: string): boolean {
    const normalized = normalizeHex(hex);
    if (!normalized) return false;

    const r = parseInt(normalized.slice(1, 3), 16) / 255;
    const g = parseInt(normalized.slice(3, 5), 16) / 255;
    const b = parseInt(normalized.slice(5, 7), 16) / 255;
    const channel = (c: number) =>
        c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b) > 0.7;
}

// ---------------------------------------------------------------------------
// Full spectrum matrix
// ---------------------------------------------------------------------------

/**
 * A hue × lightness grid, generated rather than hand-listed.
 *
 * The named families above cover the colours vendors actually type, but they
 * cannot express "a slightly darker teal". This produces an even spectrum so any
 * shade is reachable in one tap, the way a designer's colour matrix works.
 */
const SPECTRUM_HUES = 16;
const SPECTRUM_STEPS = 10;

function hslToHex(h: number, sPct: number, lPct: number): string {
    const s = sPct / 100;
    const l = lPct / 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) =>
        l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = (v: number) =>
        Math.round(v * 255)
            .toString(16)
            .padStart(2, "0");
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/** Rows of hex values: one row per lightness band, one column per hue. */
export const SPECTRUM_ROWS: string[][] = Array.from(
    { length: SPECTRUM_STEPS },
    (_, rowIndex) => {
        // 92% (near white) down to 18% (near black), skipping the extremes where
        // every hue collapses to the same colour.
        const lightness = 92 - (rowIndex * (92 - 18)) / (SPECTRUM_STEPS - 1);
        const saturation = 68;
        return Array.from({ length: SPECTRUM_HUES }, (_, colIndex) =>
            hslToHex((colIndex * 360) / SPECTRUM_HUES, saturation, lightness)
        );
    }
);

/** Greys get their own row — zero saturation is unreachable on the hue grid. */
export const SPECTRUM_GREYS: string[] = Array.from({ length: SPECTRUM_HUES }, (_, i) =>
    hslToHex(0, 0, 100 - (i * 100) / (SPECTRUM_HUES - 1))
);
