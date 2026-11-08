/**
 * Google Fonts: catalog, CSS2 URLs and self-hosting.
 *
 * Follows Core Framework's approach: the catalog is bundled
 * (data/google-fonts.json), and for self-hosting we ask the CSS2 API for
 * the chosen styles and keep one WOFF2 per style, preferring the latin subset.
 *
 * Variant keys are CSS-style: "400", "700italic".
 *
 * @module googleFonts
 */

import Platform from '../platform.js';

const CSS2 ='https://fonts.googleapis.com/css2';

let catalog = null;

/** @returns {Promise<{ family, category, variants: string[] }[]>} */
export async function loadCatalog() {
    catalog ||= Platform.json('js/data/google-fonts.json')
        .then((data) => data.items.map(([family, category, variants]) => ({ family, category, variants })))
        .catch((error) => {
            catalog = null;
            throw error;
        });
    return catalog;
}

export function parseVariant(key) {
    const match = /^(\d+)(italic)?$/.exec(String(key));
    return match ? { weight: Number(match[1]), style: match[2] ? 'italic' : 'normal' } : null;
}

export const variantKey = (weight, style) => `${weight}${style === 'italic' ? 'italic' : ''}`;

export function sortVariants(keys) {
    return [...keys].sort((a, b) => {
        const pa = parseVariant(a);
        const pb = parseVariant(b);
        return pa.weight - pb.weight || (pa.style === 'italic') - (pb.style === 'italic');
    });
}

function axis(keys) {
    const parsed = sortVariants(keys).map(parseVariant).filter(Boolean)
        .sort((a, b) => (a.style === 'italic') - (b.style === 'italic') || a.weight - b.weight);
    if (!parsed.some((v) => v.style === 'italic')) return `wght@${parsed.map((v) => v.weight).join(';')}`;
    return `ital,wght@${parsed.map((v) => `${v.style === 'italic' ? 1 : 0},${v.weight}`).join(';')}`;
}

const familyParam = (family) => encodeURIComponent(family).replace(/%20/g, '+');

/** Stylesheet URL for the chosen styles. */
export function cssUrl(family, keys, display = 'swap') {
    return `${CSS2}?family=${familyParam(family)}:${axis(keys)}&display=${display}`;
}

/**
 * Tiny stylesheet for several catalog rows: each family gets just the glyphs
 * of all the names together (a few hundred bytes each).
 */
export function namesUrl(families) {
    const text = [...new Set(families.join(''))].sort().join('');
    // `fallback`: a name is hidden for 100ms at most, never blank while scrolling fast.
    return `${CSS2}?${families.map((f) => `family=${familyParam(f)}`).join('&')}&text=${encodeURIComponent(text)}&display=fallback`;
}

/** { "700italic": "https://fonts.gstatic.com/....woff2" } for self-hosting. */
export async function resolveFiles(family, keys) {
    const response = await fetch(cssUrl(family, keys));
    if (!response.ok) throw new Error(`Google Fonts request failed (${response.status})`);
    const css = await response.text();
    const wanted = new Set(keys);
    const best = new Map();
    const pattern = /\/\*\s*([a-z0-9-]+)\s*\*\/|@font-face\s*\{([^}]+)\}/g;
    let subset = '';
    let match;
    while ((match = pattern.exec(css))) {
        if (match[1]) { subset = match[1]; continue; }
        const block = match[2];
        const weight = /font-weight:\s*(\d+)/.exec(block)?.[1];
        const style = /font-style:\s*(\w+)/.exec(block)?.[1];
        const url = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/.exec(block)?.[1];
        if (!weight || !url) continue;
        const key = variantKey(weight, style);
        if (!wanted.has(key)) continue;
        const priority = subset === 'latin' ? 3 : subset === 'latin-ext' ? 2 : 1;
        if (!best.has(key) || priority > best.get(key).priority) best.set(key, { priority, url });
    }
    const files = {};
    for (const key of keys) {
        if (!best.has(key)) throw new Error(`Google Fonts has no WOFF2 for ${family} ${key}`);
        files[key] = best.get(key).url;
    }
    return files;
}

/**
 * Downloads each style's WOFF2 once per file. Variable families (Inter, Roboto
 * Flex…) serve every weight from one file, so several keys can share a file.
 * @returns {Promise<{ keys: string[], bytes: Uint8Array }[]>}
 */
export async function downloadFiles(family, keys) {
    const urls = await resolveFiles(family, keys);
    const byUrl = new Map();
    for (const [key, url] of Object.entries(urls)) {
        if (!byUrl.has(url)) byUrl.set(url, []);
        byUrl.get(url).push(key);
    }
    return Promise.all([...byUrl].map(async ([url, group]) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Download failed for ${family} ${group.join(', ')} (${response.status})`);
        return { keys: sortVariants(group), bytes: new Uint8Array(await response.arrayBuffer()) };
    }));
}
