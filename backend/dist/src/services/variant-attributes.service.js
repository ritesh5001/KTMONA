/**
 * Variant attribute normalisation: colour names, swatch hexes and size labels.
 *
 * The catalogue was bulk-imported from vendor spreadsheets where the colour was
 * folded into the size cell ("GREEN38", "LB44") and the `color` column was left
 * empty, so the storefront had nothing to draw a swatch from and rendered every
 * product as a single "Default" colour with sizes that read like SKUs.
 *
 * This module is the one place that decides what a colour and a size *are*, so
 * the backfill script and the seller/admin write paths agree.
 */
// ============================================================================
// COLOUR VOCABULARY
// ============================================================================
/**
 * Canonical colour name -> swatch hex. Keys are lowercase with single spaces;
 * lookups go through `colorKey`. Multi-word entries must be listed here for the
 * greedy tokeniser to keep them together ("navy blue" beats "navy" + "blue").
 */
export const COLOR_LIBRARY = {
    // Neutrals
    white: '#ffffff',
    'off white': '#f5f1e8',
    ivory: '#fffff0',
    cream: '#e8dcc8',
    'dark cream': '#d9c9a3',
    'light cream': '#f2e9d6',
    beige: '#d6c7a8',
    sand: '#b8a888',
    khaki: '#b3a06a',
    grey: '#9c9c9c',
    'light grey': '#c4c4c4',
    'dark grey': '#6b6b6b',
    charcoal: '#4a4a4a',
    black: '#111111',
    'jet black': '#000000',
    silver: '#c0c0c0',
    // Browns
    brown: '#7b4b2a',
    'light brown': '#a9754f',
    'dark brown': '#4e2f1c',
    tan: '#c49a6c',
    coffee: '#4b3621',
    camel: '#c19a6b',
    copper: '#b87333',
    bronze: '#8b6914',
    terracotta: '#b5651d',
    rust: '#a3401a',
    // Reds & pinks
    red: '#c62828',
    'dark red': '#8e1c1c',
    crimson: '#a4133c',
    cherry: '#b31232',
    maroon: '#5c1a1b',
    wine: '#7b2d3b',
    burgundy: '#6d1f2e',
    pink: '#e75480',
    'baby pink': '#f8a5c2',
    'light pink': '#f7bdd0',
    'dark pink': '#c2185b',
    'rani pink': '#d81b60',
    rose: '#d1567a',
    'purple rose': '#9b4a72',
    blush: '#ffd1dc',
    magenta: '#b3117a',
    fuchsia: '#c2185b',
    coral: '#e46a5b',
    peach: '#ffb995',
    /** Vendor spelling of "peach" that arrived on the shirt line. */
    pitch: '#ffb995',
    // Oranges & yellows
    orange: '#e07a20',
    'dark orange': '#c25a06',
    mustard: '#d4a017',
    yellow: '#f2c744',
    'light yellow': '#f7e08a',
    'dark yellow': '#d1a520',
    gold: '#c9a227',
    golden: '#c9a227',
    marigold: '#ffc300',
    apricot: '#f4a261',
    // Greens
    green: '#2e7d32',
    'light green': '#7cb342',
    'dark green': '#1b5e20',
    'bottle green': '#0a4c3a',
    'sage green': '#8a9a7b',
    sage: '#8a9a7b',
    'olive green': '#6b7a3a',
    olive: '#6b7a3a',
    mint: '#8fd6b4',
    pista: '#a5c882',
    teal: '#0f766e',
    // Blues
    blue: '#1d4ed8',
    'light blue': '#7cb3e8',
    'dark blue': '#123a75',
    'navy blue': '#0f172a',
    navy: '#0f172a',
    'royal blue': '#1d3fb5',
    'sky blue': '#8ecae6',
    'powder blue': '#b0cfe6',
    'ice blue': '#d3e6f0',
    turquoise: '#2ec4b6',
    cyan: '#00b4d8',
    denim: '#3b5f88',
    // Purples
    purple: '#6b3fa0',
    'dark purple': '#4a2670',
    'light purple': '#9c7bc4',
    violet: '#7c3aed',
    lavender: '#b39ddb',
    lilac: '#c8a2c8',
    mauve: '#a06f8c',
    plum: '#7b3f61',
    // Catch-alls the vendors use
    multi: '#9b7fb8',
    multicolor: '#9b7fb8',
    multicolour: '#9b7fb8',
};
/**
 * Vendor spellings mapped onto a name in the library. Keeps "Greay" off the
 * storefront while still letting it be recognised in a filename or a title.
 */
export const COLOR_ALIASES = {
    greay: 'grey',
    gray: 'grey',
    'light gray': 'light grey',
    'dark gray': 'dark grey',
    voilet: 'violet',
    vilot: 'violet',
    meroon: 'maroon',
    marron: 'maroon',
    purpal: 'purple',
    mustered: 'mustard',
    firozi: 'turquoise',
    golden: 'gold',
    multicolor: 'multi',
    multicolour: 'multi',
    'jet black': 'black',
};
/** Everything the tokeniser may recognise: library names plus vendor spellings. */
const COLOR_VOCABULARY = [...Object.keys(COLOR_LIBRARY), ...Object.keys(COLOR_ALIASES)];
/**
 * Longest-first so the greedy tokeniser prefers "navy blue" over "navy", and
 * "bottle green" over "green".
 */
const COLOR_PHRASES = [...new Set(COLOR_VOCABULARY)].sort((a, b) => b.split(' ').length - a.split(' ').length || b.length - a.length);
/** Folds a vendor spelling onto its library name. */
export function canonicalizeColor(name) {
    const key = colorKey(name);
    return COLOR_ALIASES[key] ?? key;
}
/** Words that qualify a colour but are not colours on their own. */
const COLOR_MODIFIERS = new Set(['light', 'dark', 'deep', 'bright', 'pale', 'royal', 'jet', 'baby', 'off']);
function colorKey(value) {
    return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}
/** "navy blue" -> "Navy Blue". Preserves an already mixed-case vendor name. */
export function titleCaseColor(value) {
    return colorKey(value)
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
/**
 * Swatch hex for a colour name. Falls back to the base colour when the name is
 * a modifier phrase we don't stock ("deep teal" -> teal, darkened).
 */
export function resolveColorHex(name) {
    const key = canonicalizeColor(name ?? '');
    if (!key)
        return null;
    const exact = COLOR_LIBRARY[key];
    if (exact)
        return exact;
    const words = key.split(' ');
    // Try the trailing base colour with its modifier dropped, then shade it.
    for (let start = 0; start < words.length; start += 1) {
        const candidate = words.slice(start).join(' ');
        const base = COLOR_LIBRARY[candidate];
        if (!base)
            continue;
        const modifiers = words.slice(0, start);
        if (modifiers.includes('light') || modifiers.includes('pale'))
            return shade(base, 0.35);
        if (modifiers.includes('dark') || modifiers.includes('deep'))
            return shade(base, -0.3);
        return base;
    }
    return null;
}
/** Mixes `hex` toward white (amount > 0) or black (amount < 0). */
function shade(hex, amount) {
    const value = hex.replace('#', '');
    const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
    const target = amount > 0 ? 255 : 0;
    const ratio = Math.abs(amount);
    const mixed = channels.map((channel) => Math.round(channel + (target - channel) * ratio));
    return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
/**
 * Pulls the colour phrase out of free text — a product title or an image
 * filename. Returns the canonical multi-word name, or null.
 *
 * Scans right-to-left because vendors suffix the colour ("… Formal Trousers
 * Dark Brown", "2114DarkBlueFront").
 */
export function extractColorPhrase(text) {
    const words = tokenize(text ?? '');
    if (words.length === 0)
        return null;
    for (let end = words.length; end > 0; end -= 1) {
        for (const phrase of COLOR_PHRASES) {
            const parts = phrase.split(' ');
            const start = end - parts.length;
            if (start < 0)
                continue;
            if (!parts.every((part, index) => words[start + index] === part))
                continue;
            // Absorb a leading modifier the library didn't spell out ("bright red").
            let from = start;
            while (from > 0 && COLOR_MODIFIERS.has(words[from - 1]) && !COLOR_LIBRARY[words.slice(from - 1, end).join(' ')]) {
                from -= 1;
            }
            // A vendor title that stacked contradictory modifiers ("Light Dark
            // Blue") keeps only the one nearest the colour.
            const picked = words.slice(from, end).filter((word, index, all) => {
                if (word !== 'light' && word !== 'dark')
                    return true;
                return !all.slice(index + 1).some((later) => later === 'light' || later === 'dark');
            });
            return canonicalizeColor(picked.join(' '));
        }
    }
    return null;
}
/**
 * Splits text into lowercase words, breaking camelCase and glued uppercase runs
 * so "2114DarkBlueFront" and "BLUEROYALPINK" both tokenise usefully.
 */
function tokenize(text) {
    const withoutExtension = text.replace(/\.[a-z0-9]{2,4}$/i, '');
    const spaced = withoutExtension
        .replace(/[^a-zA-Z]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    const words = [];
    for (const raw of spaced.split(/\s+/)) {
        if (!raw)
            continue;
        const word = raw.toLowerCase();
        // A run with no case boundary to split on ("BLUEROYALPINK", "whiteside")
        // has to be broken against the vocabulary instead.
        if (word.length > 5 && !COLOR_LIBRARY[word]) {
            words.push(...splitGluedColors(word));
            continue;
        }
        words.push(word);
    }
    return words;
}
/**
 * Greedy longest-match split of a glued run: "blueroyalpink" ->
 * ["blue","royal","pink"], "whiteside" -> ["white","side"]. Segments shorter
 * than four characters are not matched, so "tan" inside an unrelated word can't
 * masquerade as a colour.
 */
function splitGluedColors(word) {
    const vocabulary = [...COLOR_PHRASES.map((phrase) => phrase.replace(/ /g, '')), ...COLOR_MODIFIERS]
        .filter((entry) => entry.length >= 4)
        .sort((a, b) => b.length - a.length);
    const parts = [];
    let buffer = '';
    let cursor = 0;
    while (cursor < word.length) {
        const match = vocabulary.find((entry) => word.startsWith(entry, cursor));
        if (match) {
            if (buffer)
                parts.push(buffer);
            buffer = '';
            parts.push(match);
            cursor += match.length;
            continue;
        }
        buffer += word[cursor];
        cursor += 1;
    }
    if (buffer)
        parts.push(buffer);
    return parts.length > 0 ? parts : [word];
}
// ============================================================================
// SIZES
// ============================================================================
/** Display order for lettered sizes. Numeric sizes sort on their own value. */
const ALPHA_SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', 'FREE'];
const ALPHA_SIZE_ALIASES = {
    XXS: 'XXS',
    XS: 'XS',
    'EXTRA SMALL': 'XS',
    S: 'S',
    SM: 'S',
    SMALL: 'S',
    M: 'M',
    MED: 'M',
    MEDIUM: 'M',
    L: 'L',
    LG: 'L',
    LARGE: 'L',
    XL: 'XL',
    'X L': 'XL',
    'EXTRA LARGE': 'XL',
    XXL: 'XXL',
    '2XL': 'XXL',
    XXXL: '3XL',
    '3XL': '3XL',
    XXXXL: '4XL',
    '4XL': '4XL',
    '5XL': '5XL',
    FREE: 'FREE',
    'FREE SIZE': 'FREE',
    ONESIZE: 'FREE',
    'ONE SIZE': 'FREE',
};
/**
 * Splits a vendor size cell into a real size and the colour that was glued to
 * it: "GREEN38" -> { size: "38", colorPrefix: "GREEN" }, "2xl" -> "XXL".
 */
export function parseSizeLabel(raw) {
    const trimmed = (raw ?? '').trim();
    if (!trimmed)
        return { size: 'Free Size', colorPrefix: null };
    // <colour><number>, the dominant bad shape. The number is the real size.
    const glued = /^([A-Za-z][A-Za-z\s._-]*?)[\s._-]*(\d{1,3})$/.exec(trimmed);
    if (glued) {
        return { size: glued[2], colorPrefix: glued[1].trim() || null };
    }
    // Bare numeric waist/chest size.
    if (/^\d{1,3}$/.test(trimmed)) {
        return { size: trimmed, colorPrefix: null };
    }
    const upper = trimmed.toUpperCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ');
    const alias = ALPHA_SIZE_ALIASES[upper] ?? ALPHA_SIZE_ALIASES[upper.replace(/\s+/g, '')];
    if (alias) {
        return { size: alias === 'FREE' ? 'Free Size' : alias, colorPrefix: null };
    }
    // Anything else (including the "Default" placeholder) becomes a free size.
    if (/^(DEFAULT|STANDARD|NA|N\/A)$/.test(upper)) {
        return { size: 'Free Size', colorPrefix: null };
    }
    return { size: trimmed, colorPrefix: null };
}
/** Sort key so "36" < "38" < "40" and XS < S < M < L < XL < XXL. */
export function sizeSortKey(size) {
    const trimmed = size.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed))
        return [0, Number(trimmed), trimmed];
    const upper = trimmed.toUpperCase().replace(/\s+/g, ' ');
    const alias = ALPHA_SIZE_ALIASES[upper] ?? ALPHA_SIZE_ALIASES[upper.replace(/\s+/g, '')];
    const index = ALPHA_SIZE_ORDER.indexOf(alias ?? upper);
    if (index >= 0)
        return [1, index, trimmed];
    return [2, 0, trimmed];
}
export function compareSizes(left, right) {
    const [leftGroup, leftRank, leftText] = sizeSortKey(left);
    const [rightGroup, rightRank, rightText] = sizeSortKey(right);
    if (leftGroup !== rightGroup)
        return leftGroup - rightGroup;
    if (leftRank !== rightRank)
        return leftRank - rightRank;
    return leftText.localeCompare(rightText);
}
/**
 * Cleans a seller/admin variant payload before it is validated for uniqueness
 * and written.
 *
 * Sellers keep typing the colour into the size box ("Green 38"), which is how
 * the imported catalogue ended up with sizes that read like SKUs. Here the
 * colour is lifted out of the size, sizes are normalised to a single spelling
 * ("2xl" -> "XXL") so two spellings can't become two chips, and a recognised
 * colour name supplies its own swatch when nobody picked one.
 *
 * Only keys present on `input` come back, so this is safe for PATCH payloads.
 */
export function normalizeVariantAttributes(input) {
    const result = {
        size: undefined,
        color: undefined,
        derivedColorHex: null,
    };
    let liftedColor = null;
    if (input.size !== undefined && input.size !== null) {
        const parsed = parseSizeLabel(input.size);
        result.size = parsed.size;
        if (parsed.colorPrefix) {
            liftedColor = extractColorPhrase(parsed.colorPrefix);
        }
    }
    const providedColor = input.color?.trim();
    if (input.color !== undefined || liftedColor) {
        const chosen = providedColor || liftedColor;
        result.color = chosen ? titleCaseColor(canonicalizeColor(chosen)) : null;
    }
    // A recognised name can supply its own swatch, so the storefront is never
    // left with a colour it cannot draw.
    if (result.color) {
        result.derivedColorHex = resolveColorHex(result.color);
    }
    return result;
}
// ============================================================================
// SKU
// ============================================================================
/** "Dark Blue" -> "DARKBLUE", for a readable SKU segment. */
export function skuColorSegment(color) {
    return colorKey(color ?? '')
        .replace(/[^a-z0-9]/g, '')
        .toUpperCase();
}
/**
 * `<base>-<COLOUR>-<SIZE>`, e.g. "2114-DARKBLUE-38". Falls back to the base
 * plus size when the product has no colour axis.
 */
export function buildSku(base, color, size) {
    const cleanBase = base.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase();
    const cleanSize = size.trim().replace(/[^a-zA-Z0-9]+/g, '').toUpperCase();
    const colorSegment = skuColorSegment(color);
    return [cleanBase, colorSegment, cleanSize].filter(Boolean).join('-');
}
//# sourceMappingURL=variant-attributes.service.js.map