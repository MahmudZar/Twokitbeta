/**
 * Font library model: one entry per family in AppState.fonts.
 *
 *   { id, family, source: 'google' | 'local', category, display,
 *     faces: [{ key, weight, style, variable?, fileId?, format?, size?, sourceName?, sourceFormat? }] }
 *
 * Google faces carry no file: they're served by Google in the app and
 * downloaded at export. Local faces point at a WOFF2/WOFF in core/fontStore.
 *
 * Typography roles (typography.headingFont / bodyFont) hold a font id or a
 * system stack key.
 *
 * @module fontModel
 */

import AppState from './appState.js';

export const SYSTEM_STACKS = {
    'system-sans': { label: 'System sans', stack: 'ui-sans-serif, system-ui, sans-serif' },
    'system-serif': { label: 'System serif', stack: 'ui-serif, Georgia, serif' },
    'system-mono': { label: 'System mono', stack: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
};

const FALLBACKS = {
    'sans-serif': SYSTEM_STACKS['system-sans'].stack,
    serif: SYSTEM_STACKS['system-serif'].stack,
    monospace: SYSTEM_STACKS['system-mono'].stack,
    display: SYSTEM_STACKS['system-sans'].stack,
    handwriting: 'cursive, ui-sans-serif, sans-serif'
};

export const CATEGORY_LABEL = {
    'sans-serif': 'Sans serif', serif: 'Serif', display: 'Display', handwriting: 'Handwriting', monospace: 'Monospace'
};

export const WEIGHT_NAMES = {
    100: 'Thin', 200: 'Extra light', 300: 'Light', 400: 'Regular', 500: 'Medium',
    600: 'Semibold', 700: 'Bold', 800: 'Extra bold', 900: 'Black'
};

export function fontSlug(family) {
    return String(family).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'font';
}

export const quoteFamily = (family) => `"${String(family).replace(/["\\]/g, '')}"`;

/** System fonts that stand in for a library font of this category. */
export const fontFallback = (font) => FALLBACKS[font.category] || FALLBACKS['sans-serif'];

export function fontStack(font) {
    return `${quoteFamily(font.family)}, ${fontFallback(font)}`;
}

/** CSS variable name (no leading dashes) for a library font. */
export const fontVar = (font) => AppState.tokenName('type', `font-${font.id}`);

export const findFont = (id) => AppState.fonts.find((f) => f.id === id) || null;

/** { label, family, stack, fallback, font } for a role value (fallback: '' for a system stack). */
export function resolveRole(value) {
    const font = findFont(value);
    if (font) return { label: font.family, family: font.family, stack: fontStack(font), fallback: fontFallback(font), font };
    const system = SYSTEM_STACKS[value] || SYSTEM_STACKS['system-sans'];
    return { label: system.label, family: '', stack: system.stack, fallback: '', font: null };
}

export const headingRole = () => resolveRole(AppState.typography.headingFont);
export const bodyRole = () => resolveRole(AppState.typography.bodyFont);

export function roleOptions() {
    return [
        ...AppState.fonts.map((f) => ({ value: f.id, label: f.family })),
        ...Object.entries(SYSTEM_STACKS).map(([value, s]) => ({ value, label: s.label }))
    ];
}

export function faceKey(weight, style, variable) {
    const w = variable ? `${variable.min}-${variable.max}` : weight;
    return `${w}${style === 'italic' ? 'italic' : ''}`;
}

/** "400", "700 Italic", "100–900 Italic" */
export function faceLabel(face) {
    const w = face.variable ? `${face.variable.min}–${face.variable.max}` : face.weight;
    return `${w}${face.style === 'italic' ? ' Italic' : ''}`;
}

/** CSS font-weight value for @font-face. */
export const faceWeight = (face) => (face.variable ? `${face.variable.min} ${face.variable.max}` : String(face.weight));

export function sortFaces(faces) {
    return [...faces].sort((a, b) => (a.variable ? a.variable.min : a.weight) - (b.variable ? b.variable.min : b.weight)
        || (a.style === 'italic') - (b.style === 'italic'));
}

/** Which role(s) use a font: ['Headings', 'Body']. */
export function rolesOf(font) {
    const t = AppState.typography;
    return [t.headingFont === font.id && 'Headings', t.bodyFont === font.id && 'Body'].filter(Boolean);
}
