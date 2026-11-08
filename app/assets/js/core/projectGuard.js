/**
 * ProjectGuard
 *
 * A project file (.twokit.zip, a saved project, the WordPress copy) is data
 * from outside: anyone can hand someone a "free design kit". Its values end
 * up in three places that must never run anything:
 *
 *   the app's own markup     ids, names and colors are printed into HTML
 *   CSS                      values become custom properties, classes, the
 *                            theme stylesheet (Bricks prints them raw inside
 *                            a <style> tag, so `</style>` would end it)
 *   Bricks                   the same values, through its importer
 *
 * sanitizeState() runs on every snapshot before it is applied: palettes get
 * a strict shape (safe ids and names, #RRGGBB colors, known Tailwind family,
 * shades always regenerated), and every other string anywhere in the state
 * is checked for markup and CSS break-outs. A value that fails is dropped,
 * so the app's default for it applies. Unknown or odd keys are dropped too.
 *
 * unsafeCssValue() / unsafeCssBlock() are the last check before anything is
 * written to Bricks or a stylesheet (ExportModule).
 *
 * @module projectGuard
 */

import { TAILWIND_FAMILIES } from '../data/tailwindColors.js';

/** Characters and words that never belong in a design-token value. */
const UNSAFE_VALUE = /[<>{};\\]|\/\*|\*\/|@import|url\s*\(|expression\s*\(|javascript\s*:|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/i;
/** Markup that would end or open a tag inside CSS text (blocks may hold braces and `>`). */
const UNSAFE_BLOCK = /<\s*\/?\s*(style|script)\b|<!--|<\?|<\s*\/|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/i;

const KEY = /^[A-Za-z0-9_$:.-]{1,80}$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const HEX6 = /^#[0-9a-f]{6}$/i;
const SHADE = /^\d{2,3}$/;
const MAX_STRING = 2000;
const MAX_ARRAY = 1000;
const MAX_DEPTH = 12;
const MAX_PALETTES = 40;

/** Whether a design-token value could break out of CSS (or carry markup). */
export function unsafeCssValue(value) {
    return typeof value === 'string' && UNSAFE_VALUE.test(value);
}

/** Whether CSS text (rules with braces) carries markup that could end its style tag. */
export function unsafeCssBlock(value) {
    return typeof value === 'string' && UNSAFE_BLOCK.test(value);
}

/** Lowercase slug, the same rule the Colors screen applies to names. */
function slug(value) {
    return String(value ?? '').toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/**
 * A plain value tree: objects and arrays rebuilt key by key, strings checked.
 * Returns undefined for anything that must be dropped.
 */
function clean(value, depth = 0) {
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value === 'string') {
        if (value.length > MAX_STRING || UNSAFE_VALUE.test(value)) return undefined;
        return value;
    }
    if (depth >= MAX_DEPTH) return undefined;
    if (Array.isArray(value)) {
        return value.slice(0, MAX_ARRAY).map((v) => clean(v, depth + 1)).filter((v) => v !== undefined);
    }
    if (typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            if (!KEY.test(k) || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
            const c = clean(v, depth + 1);
            if (c !== undefined) out[k] = c;
        }
        return out;
    }
    return undefined;
}

/** State-color roles: { light: { surface: '50', … }, dark: { … } }. */
function cleanRoles(roles) {
    if (!roles || typeof roles !== 'object') return null;
    const out = {};
    for (const mode of ['light', 'dark']) {
        const r = roles[mode];
        if (!r || typeof r !== 'object') continue;
        out[mode] = {};
        for (const [role, shade] of Object.entries(r)) {
            if (/^[a-z]{1,20}$/.test(role) && SHADE.test(String(shade))) out[mode][role] = String(shade);
        }
    }
    return Object.keys(out).length ? out : null;
}

/**
 * Palettes in a strict shape. Shades are left empty so the app regenerates
 * them from the base color (or the Tailwind family): imported shade values
 * are never used.
 */
export function sanitizeColors(list, { stateColors = false } = {}) {
    if (!Array.isArray(list)) return undefined;
    const families = new Set(TAILWIND_FAMILIES.map((f) => f.id));
    const ids = new Set();
    const out = [];
    for (const raw of list.slice(0, MAX_PALETTES)) {
        if (!raw || typeof raw !== 'object') continue;
        const name = slug(raw.name) || slug(raw.id);
        if (!name) continue;
        let id = ID.test(String(raw.id ?? '')) ? String(raw.id) : name;
        while (ids.has(id)) id = `${id}-x`;
        ids.add(id);
        const color = {
            id,
            name,
            baseColor: HEX6.test(String(raw.baseColor ?? '')) ? String(raw.baseColor) : '#808080',
            shades: []
        };
        if (typeof raw.tailwind === 'string' && families.has(raw.tailwind)) color.tailwind = raw.tailwind;
        if (stateColors) color.roles = cleanRoles(raw.roles);
        // Other flags the app may add later: plain booleans and numbers only.
        for (const [k, v] of Object.entries(raw)) {
            if (k in color || !KEY.test(k) || k === 'roles' || k === 'shades') continue;
            if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) color[k] = v;
        }
        out.push(color);
    }
    return out;
}

/**
 * A snapshot's state, safe to apply. Never throws; returns a new object.
 *
 * @param {object} state Raw `state` of a project snapshot.
 * @returns {object}
 */
export function sanitizeState(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) return {};
    const { colors, stateColors, ...rest } = state;
    const out = clean(rest) || {};
    const c = sanitizeColors(colors);
    if (c && c.length) out.colors = c;
    const sc = sanitizeColors(stateColors, { stateColors: true });
    if (sc && sc.length) out.stateColors = sc;
    return out;
}

/** Project meta: short plain strings (shown escaped, never used in CSS). */
export function sanitizeMeta(meta) {
    if (!meta || typeof meta !== 'object') return null;
    const text = (v, max, lines = false) => (typeof v === 'string'
        ? v.replace(lines ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, ' ').slice(0, max)
        : '');
    // The name and author also go into CSS comments of the exports
    // (`/* Name · design tokens */`): nothing that could end a comment or a tag.
    const plain = (v) => text(v, 120).replace(/[<>{}\\]|\/\*|\*\//g, '');
    return { name: plain(meta.name), author: plain(meta.author), notes: text(meta.notes, 4000, true) };
}

export default { sanitizeState, sanitizeColors, sanitizeMeta, unsafeCssValue, unsafeCssBlock };
