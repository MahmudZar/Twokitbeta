/**
 * Buttons: tokens, the btn--* classes and the Bricks Button element.
 *
 * Model (Lumos + ACSS): every colored button is six tokens,
 * --btn-{name}-bg / -text / -border and their -hover versions, and each
 * class reads them directly. Colors are picked per state (default, hover)
 * and, when "dark" is customised, per theme (written as light-dark()).
 * Defaults come from the palettes: {palette}-500 fill, black text, -400 on
 * hover, no border, moved to the nearest readable pair (APCA + WCAG 2) when a
 * palette needs it (see paletteSolid). Primary uses the first brand palette,
 * secondary the second, extra brand palettes and the state palettes get a
 * button named after them (btn--accent, btn--success …). Outline takes the
 * primary button's default look on hover. Every button can be edited and reset. Shape tokens are em-based, so the -s / -l
 * sizes only swap the font size.
 *
 * @module buttonsCss
 */

import { apca, readable } from './themeTokens.js';

/** Variants with the six color tokens, in UI order. */
export const COLOR_VARIANTS = ['primary', 'secondary', 'outline', 'ghost'];

/** Class suffix → font-size token. '' is the default size. */
export const BUTTON_SIZES = [
    { suffix: '-s', token: 'btn-font-size-s', label: 'Small' },
    { suffix: '', token: 'btn-font-size', label: 'Default' },
    { suffix: '-l', token: 'btn-font-size-l', label: 'Large' }
];

export const COLOR_KEYS = ['bg', 'text', 'border', 'bgHover', 'textHover', 'borderHover'];
export const REST_KEYS = ['bg', 'text', 'border'];
export const HOVER_KEYS = ['bgHover', 'textHover', 'borderHover'];

const colors = (bg, text, border, bgHover, textHover, borderHover) => ({ bg, text, border, bgHover, textHover, borderHover });

/** Link underline styles: ACSS-like text-decoration, or Lumos' growing line. */
export const LINK_STYLES = [
    { value: 'underline', label: 'Underlined' },
    { value: 'hover', label: 'Underline on hover' },
    { value: 'grow', label: 'Line grows on hover' }
];

export const BUTTON_DEFAULTS = {
    shape: {
        paddingBlock: 0.75, // em
        paddingInline: 1.25, // em
        radius: 'radius', // token name
        fontSize: 1, // rem
        fontSizeS: 0.875, // rem
        fontSizeL: 1.125, // rem
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: 0, // em
        borderWidth: 1, // px
        gap: 0.5 // em
    },
    primary: { ...colors('action', 'on-action', 'action', 'action-hover', 'on-action', 'action-hover'), customDark: false, dark: null },
    secondary: { ...colors('surface-4', 'text-primary', 'border', 'surface-5', 'text-primary', 'border-strong'), customDark: false, dark: null },
    outline: { ...colors('transparent', 'action', 'action', 'action', 'on-action', 'action'), customDark: false, dark: null },
    ghost: { ...colors('transparent', 'text-primary', 'transparent', 'hover', 'text-primary', 'transparent'), customDark: false, dark: null },
    link: { text: 'action', textHover: 'action-hover', underline: 'currentColor', underlineHover: 'currentColor', style: 'underline', thickness: 1, offset: 0.25 },
    icon: { shape: 'square' },
    // State buttons: { [palette id]: picks } — only the ones edited; the rest follow their palette.
    states: {},
    brands: {}
};

const LEGACY_LINK = { animated: 'grow', always: 'underline', hover: 'hover' };

/**
 * Projects from before link.style kept the underline style in link.underline.
 * Run it on the saved link before defaults are merged in (ProjectModule), and
 * again in withButtonDefaults for links saved by 1.0.24 and older, where the
 * load gave them the default style 'underline' and kept 'animated' as a color
 * (var(--animated)). 'hover' is also a real color token, so it only counts as
 * a style when no style is stored.
 */
export function migrateLink(link = {}) {
    const legacy = LEGACY_LINK[link.underline];
    if (!legacy) return link;
    const out = { ...link };
    if (link.underline === 'hover') {
        if (link.style) return link;
        out.style = legacy;
    } else if (!link.style || link.style === 'underline') {
        out.style = legacy;
    }
    out.underline = BUTTON_DEFAULTS.link.underline;
    return out;
}

export function withButtonDefaults(buttons = {}) {
    const out = {};
    for (const key of ['shape', ...COLOR_VARIANTS, 'link', 'icon', 'states', 'brands']) {
        out[key] = { ...BUTTON_DEFAULTS[key], ...buttons[key] };
    }
    for (const v of COLOR_VARIANTS) {
        const saved = buttons[v] || {};
        if (saved.customDark == null && saved.darkDiffers != null) out[v].customDark = Boolean(saved.darkDiffers);
    }
    out.link = { ...BUTTON_DEFAULTS.link, ...migrateLink(buttons.link || {}) };
    return out;
}

/** Prefix of a stored custom CSS color (oklch(from var(--x) …), color-mix(), #hex …). */
export const CSS_PREFIX = 'css:';

/**
 * Stored color → CSS. Token names become var(--name), keywords pass
 * through, and custom CSS ('css:…') is written as typed.
 */
export const cssColor = (name) => {
    if (name === 'transparent' || name === 'currentColor') return name;
    if (String(name).startsWith(CSS_PREFIX)) return name.slice(CSS_PREFIX.length);
    return `var(--${name})`;
};

/* ---------------- palette defaults ---------------- */

/**
 * Default button colors for one palette, text always readable (APCA Lc 60,
 * or Lc 55 with WCAG 2 AA; see themeTokens.readable):
 *   1. black on {palette}-500, hover 400 (the rule)
 *   2. white on 500 → 600 → 700 → 800; hover one shade lighter when white
 *      still reads there (600 → 500), otherwise one darker
 *   3. black on 400 → 300 (a paler fill, only when white can't read on 500–800)
 * Text is always --white or --black, never a palette shade.
 *   4. the pair with the highest APCA contrast
 * Dark mode steps the fill one shade lighter (two in extreme cases, never
 * past 400), so buttons are softer on a dark page; see `dark` below.
 * Border is transparent.
 * @param {{shades:{name:string, shade:string, hex:string, isBase?:boolean}[]}} palette
 * @param {(name:string) => string} varName palette shade → token name
 */
export function paletteSolid(palette, varName = (n) => n) {
    const shades = palette?.shades || [];
    const n = shades.length;
    if (n < 3) return null;
    let i = shades.findIndex((s) => s.shade === '500');
    if (i < 0) i = Math.max(0, shades.findIndex((s) => s.isBase));
    const WHITE = { name: 'white', hex: '#ffffff', base: true };
    const BLACK = { name: 'black', hex: '#000000', base: true };
    const ok = (ink, k) => readable(ink.hex, shades[k].hex);
    const clampK = (k) => Math.max(0, Math.min(n - 1, k));
    // Hover moves away from the text: lighter under black; under white lighter
    // only while white still reads there (never above the base), else darker.
    const hoverFor = (k, ink, floor = i) => (ink === BLACK ? clampK(k - 1) : (k > floor && ok(WHITE, k - 1) ? k - 1 : clampK(k + 1)));

    /** Light mode: { k, ink } (fill index + text). */
    const light = (() => {
        // 1. The rule: black on 500.
        if (ok(BLACK, i)) return { k: i, ink: BLACK };
        // 2. White on the brand fill or darker.
        for (let k = i; k <= Math.min(n - 2, i + 3); k++) if (ok(WHITE, k)) return { k, ink: WHITE };
        // 3. A paler fill with black: 400 → 300.
        for (let k = i - 1; k >= Math.max(1, i - 2); k--) if (ok(BLACK, k)) return { k, ink: BLACK };
        // 4. Nothing reads: the pair with the most APCA contrast.
        let best = { r: -1, k: i, ink: BLACK };
        shades.forEach((s, k) => {
            for (const ink of [WHITE, BLACK]) {
                const r = apca(ink.hex, s.hex);
                if (r > best.r) best = { r, k, ink };
            }
        });
        return best;
    })();

    /**
     * Dark mode: saturated mid-tones glare on a dark page, so the fill steps
     * one shade lighter (600 → 500), two in extreme cases, never past 400.
     * Keeps the light-mode text when it still reads, else the other one;
     * stays on the light fill when no lighter shade reads.
     */
    const dark = (() => {
        const floor = shades.findIndex((s) => s.shade === '400');
        const lowest = floor >= 0 ? floor : Math.max(0, i - 1);
        const inks = light.ink === WHITE ? [WHITE, BLACK] : [BLACK, WHITE];
        for (const k of [light.k - 1, light.k - 2]) {
            if (k < lowest) break;
            const ink = inks.find((t) => ok(t, k));
            if (ink) return { k, ink };
        }
        return light;
    })();

    const name = (s) => (s.base ? s.name : varName(s.name));
    const set = ({ k, ink }, floor) => colors(name(shades[k]), name(ink), 'transparent', name(shades[hoverFor(k, ink, floor)]), name(ink), 'transparent');
    const lightSet = set(light, i);
    const darkSet = set(dark, dark.k);
    return { ...lightSet, customDark: dark.k !== light.k || dark.ink !== light.ink, dark: darkSet };
}

/**
 * Outline text + border: the shade nearest 500 that reads on the page,
 * per theme (darker on a light page, lighter on a dark one).
 * @returns {{light:string, dark:string}} token names
 */
export function paletteOutlineInk(palette, varName = (n) => n, page = { light: '#ffffff', dark: '#121212' }) {
    const shades = palette?.shades || [];
    const n = shades.length;
    if (n < 3) return null;
    let i = shades.findIndex((s) => s.shade === '500');
    if (i < 0) i = Math.max(0, shades.findIndex((s) => s.isBase));
    const find = (ground, dir) => {
        for (let k = i; k >= 0 && k < n; k += dir) if (readable(shades[k].hex, ground)) return shades[k];
        return dir > 0 ? shades[n - 1] : shades[0];
    };
    return { light: varName(find(page.light, 1).name), dark: varName(find(page.dark, -1).name) };
}

/* ---------------- picks ---------------- */

/** Colors earlier versions saved as the default; they count as "not edited". */
const LEGACY_DEFAULTS = {
    primary: [colors('action', 'on-action', 'action', 'action-hover', 'on-action', 'action-hover')],
    secondary: [colors('surface-4', 'text-primary', 'border', 'surface-5', 'text-primary', 'border-strong')],
    outline: [colors('transparent', 'action', 'action', 'action', 'on-action', 'action')],
    ghost: [colors('transparent', 'text-primary', 'transparent', 'hover', 'text-primary', 'transparent')]
};

const sameColors = (a, b) => COLOR_KEYS.every((k) => a[k] === b[k]);

/** True when the user picked this variant's colors (so it no longer follows the palette). */
function edited(variant, saved) {
    if (!saved || !('bg' in saved) || saved.source) return false;
    if (!saved.customDark && (LEGACY_DEFAULTS[variant] || []).some((d) => sameColors(d, saved))) return false;
    return true;
}

const clean = (v) => {
    const out = { customDark: false, dark: null, ...v };
    delete out.source;
    delete out.darkDiffers;
    delete out.customHover;
    return out;
};

/** Default picks for a variant, from the palettes in ctx.defaults. */
function defaultPicks(buttons, variant, ctx) {
    const d = ctx.defaults || {};
    if (variant === 'outline' && d.outlineInk) {
        // Hover takes the primary button's default look (fill, text, border),
        // read live so edits to primary carry over, in both themes.
        const p = variantPicks(buttons, 'primary', ctx);
        const pd = p.customDark ? { ...p, ...p.dark } : p;
        const { light, dark } = d.outlineInk;
        return clean({
            ...colors('transparent', light, light, p.bg, p.text, p.border),
            customDark: light !== dark || p.customDark,
            dark: colors('transparent', dark, dark, pd.bg, pd.text, pd.border)
        });
    }
    return clean(d[variant] || BUTTON_DEFAULTS[variant]);
}

/** Picks for a variant: the user's edit, else the palette default. Token names, not CSS. */
export function variantPicks(buttons, variant, ctx = {}) {
    const saved = buttons?.[variant];
    return edited(variant, saved) ? clean(saved) : defaultPicks(buttons, variant, ctx);
}

/** Picks for a state / extra brand button: the saved edit, else the palette default. */
function palettePicks(saved, entry) {
    return clean(saved && 'bg' in saved ? saved : entry.colors);
}

/** The ctx entry and storage key for 'state:{id}' / 'brand:{id}' targets. */
function paletteTarget(target, ctx) {
    const [kind, id] = target.split(':');
    const list = kind === 'state' ? ctx.states : kind === 'brand' ? ctx.brands : null;
    const entry = (list || []).find((s) => s.id === id);
    return entry ? { entry, store: kind === 'state' ? 'states' : 'brands', id } : null;
}

/** Picks for any edit target: a variant name, 'state:{id}' or 'brand:{id}'. */
export function targetPicks(buttons, target, ctx = {}) {
    if (!target.includes(':')) return variantPicks(buttons, target, ctx);
    const t = paletteTarget(target, ctx);
    return t ? palettePicks(buttons?.[t.store]?.[t.id], t.entry) : null;
}

/** True when a target has the user's own colors (Reset brings back the default). */
export function isTargetEdited(buttons, target, ctx = {}) {
    if (!target.includes(':')) return edited(target, buttons?.[target]);
    const t = paletteTarget(target, ctx);
    return Boolean(t && buttons?.[t.store]?.[t.id] && 'bg' in buttons[t.store][t.id]);
}

/** Where a target's picks are stored: { key, id? } (id for states / brands). */
export function targetStore(target, ctx = {}) {
    if (!target.includes(':')) return { key: target };
    const t = paletteTarget(target, ctx);
    return t ? { key: t.store, id: t.id } : null;
}

/** Picks → CSS colors; dark picks become light-dark(). */
export function resolvePicks(v) {
    const dark = v.customDark ? v.dark || {} : {};
    const out = {};
    for (const key of COLOR_KEYS) {
        const light = cssColor(v[key]);
        out[key] = dark[key] && dark[key] !== v[key] ? `light-dark(${light}, ${cssColor(dark[key])})` : light;
    }
    return out;
}

/** Resolved CSS colors for a colored variant. */
export function variantColors(buttons, variant, ctx = {}) {
    return resolvePicks(variantPicks(buttons, variant, ctx));
}

/** State palettes and extra brand palettes that carry a button (ctx from state/themeModel.js). */
const stateButtons = (ctx) => (ctx.states || []).filter((s) => s.colors);
const brandButtons = (ctx) => (ctx.brands || []).filter((s) => s.colors);

const kebab = (key) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Button tokens [category, name, value] (Bricks variables + CSS export). */
export function buttonRows(buttons, ctx = {}) {
    const b = withButtonDefaults(buttons);
    const s = b.shape;
    const l = b.link;
    const rows = [
        ['Buttons', 'btn-padding-block', `${s.paddingBlock}em`],
        ['Buttons', 'btn-padding-inline', `${s.paddingInline}em`],
        ['Buttons', 'btn-radius', cssColor(s.radius)],
        ['Buttons', 'btn-font-size', `${s.fontSize}rem`],
        ['Buttons', 'btn-font-size-s', `${s.fontSizeS}rem`],
        ['Buttons', 'btn-font-size-l', `${s.fontSizeL}rem`],
        ['Buttons', 'btn-font-weight', String(s.fontWeight)],
        ['Buttons', 'btn-line-height', String(s.lineHeight)],
        ['Buttons', 'btn-letter-spacing', `${s.letterSpacing}em`],
        ['Buttons', 'btn-border-width', `${s.borderWidth}px`],
        ['Buttons', 'btn-gap', `${s.gap}em`]
    ];
    for (const variant of COLOR_VARIANTS) {
        const c = variantColors(buttons, variant, ctx);
        for (const key of COLOR_KEYS) rows.push(['Buttons', `btn-${variant}-${kebab(key)}`, c[key]]);
    }
    for (const brand of brandButtons(ctx)) {
        const c = resolvePicks(targetPicks(buttons, `brand:${brand.id}`, ctx));
        for (const key of COLOR_KEYS) rows.push(['Buttons - brand', `btn-${brand.name}-${kebab(key)}`, c[key]]);
    }
    for (const state of stateButtons(ctx)) {
        const c = resolvePicks(targetPicks(buttons, `state:${state.id}`, ctx));
        for (const key of COLOR_KEYS) rows.push(['Buttons - states', `btn-${state.name}-${kebab(key)}`, c[key]]);
    }
    rows.push(
        ['Buttons', 'btn-link-text', cssColor(l.text)],
        ['Buttons', 'btn-link-text-hover', cssColor(l.textHover)],
        ['Buttons', 'btn-link-underline', cssColor(l.underline)],
        ['Buttons', 'btn-link-underline-hover', cssColor(l.underlineHover)],
        ['Buttons', 'btn-link-underline-thickness', `${l.thickness}px`],
        ['Buttons', 'btn-link-underline-offset', `${l.offset}em`]
    );
    return rows;
}

/* ---------------- CSS ---------------- */

/** Shape declarations every button shares. `font` is the font-size token. */
function shape(font) {
    return `  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--btn-gap);
  padding: var(--btn-padding-block) var(--btn-padding-inline);
  border-radius: var(--btn-radius);
  font-size: var(--${font});
  font-weight: var(--btn-font-weight);
  line-height: var(--btn-line-height);
  letter-spacing: var(--btn-letter-spacing);
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  transition: var(--transition);`;
}

/** Splits a selector list on top-level commas (not the ones inside :where()). */
function selectors(sel) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < sel.length; i++) {
        if (sel[i] === '(') depth++;
        else if (sel[i] === ')') depth--;
        else if (sel[i] === ',' && depth === 0) {
            parts.push(sel.slice(start, i).trim());
            start = i + 1;
        }
    }
    parts.push(sel.slice(start).trim());
    return parts;
}

const each = (sel, suffix, join = ',\n') => selectors(sel).map((p) => `${p}${suffix}`).join(join);

function pressed(sel) {
    return `${each(sel, ':active')} {
  background-image: var(--active-layer);
}`;
}

function disabled(sel) {
    return `${each(sel, ':is(:disabled, [aria-disabled="true"])')} {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}`;
}

/** Colors + hover. `c`: { bg, text, border, bgHover, textHover, borderHover } as CSS. */
function colorRules(sel, c) {
    return `${sel} {
  border-color: ${c.border};
  background-color: ${c.bg};
  color: ${c.text};
}

@media (hover: hover) {
  ${each(sel, ':hover', ',\n  ')} {
    border-color: ${c.borderHover};
    background-color: ${c.bgHover};
    color: ${c.textHover};
  }
}`;
}

/** --btn-{name}-* tokens as a color set. */
const tokenColors = (name) => {
    const t = (k) => `var(--btn-${name}-${k})`;
    return { bg: t('bg'), text: t('text'), border: t('border'), bgHover: t('bg-hover'), textHover: t('text-hover'), borderHover: t('border-hover') };
};

function filledCss(sel, name, font) {
    const c = tokenColors(name);
    return `${sel} {
${shape(font)}
  border: var(--btn-border-width) solid ${c.border};
  background-color: ${c.bg};
  color: ${c.text};
}

@media (hover: hover) {
  ${sel}:hover {
    border-color: ${c.borderHover};
    background-color: ${c.bgHover};
    color: ${c.textHover};
  }
}

${pressed(sel)}

${disabled(sel)}`;
}

/**
 * Link button: no padding or box, so it lines up with text and other
 * buttons' labels. underline / hover: text-decoration (ACSS). grow: a
 * resting line with a hover-colored line growing over it (Lumos).
 */
function linkCss(sel, style, font) {
    const head = `${sel} {
  display: inline-flex;
  align-items: center;
  gap: var(--btn-gap);
  padding: 0;
  border: 0;
  border-radius: 0;
  background-color: transparent;
  color: var(--btn-link-text);
  font-size: var(--${font});
  font-weight: var(--btn-font-weight);
  line-height: var(--btn-line-height);
  letter-spacing: var(--btn-letter-spacing);
  cursor: pointer;`;
    let rules;
    if (style === 'grow') {
        rules = `${head}
  padding-block-end: var(--btn-link-underline-offset);
  text-decoration: none;
  background-image:
    linear-gradient(var(--btn-link-underline-hover) 0 0),
    linear-gradient(var(--btn-link-underline) 0 0);
  background-repeat: no-repeat;
  background-position: 100% 100%, 0 100%;
  background-size: 0 var(--btn-link-underline-thickness), 100% var(--btn-link-underline-thickness);
  transition: var(--transition), background-size calc(var(--transition-duration) * 2) var(--transition-timing);
}

@media (hover: hover) {
  ${sel}:hover {
    color: var(--btn-link-text-hover);
    background-position: 0 100%, 0 100%;
    background-size: 100% var(--btn-link-underline-thickness), 100% var(--btn-link-underline-thickness);
  }
}`;
    } else {
        rules = `${head}
  text-decoration-line: ${style === 'hover' ? 'none' : 'underline'};
  text-decoration-color: var(--btn-link-underline);
  text-decoration-thickness: var(--btn-link-underline-thickness);
  text-underline-offset: var(--btn-link-underline-offset);
  transition: var(--transition);
}

@media (hover: hover) {
  ${sel}:hover {
    color: var(--btn-link-text-hover);
    text-decoration-line: underline;
    text-decoration-color: var(--btn-link-underline-hover);
  }
}`;
    }
    return `${rules}\n\n${disabled(sel)}`;
}

/**
 * Icon-only shape, used next to a variant (btn--primary btn--icon). The
 * doubled class outranks the variant's padding and size; it sets no colors.
 * No font-size on the default size, so btn--primary-l btn--icon stays large.
 */
function iconCss(sel, shapeName, font) {
    return `${sel}${sel} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: var(--btn-padding-block);
  aspect-ratio: 1;${font ? `\n  font-size: var(--${font});` : ''}${shapeName === 'circle' ? '\n  border-radius: var(--radius-circle, 50vw);' : ''}
}`;
}

/**
 * The btn--* classes as [name, css], each self-contained (Bricks global
 * classes keep their CSS in the class's own CSS panel), in three sizes:
 * btn--primary, btn--primary-s, btn--primary-l. State buttons are named
 * after the state palettes (btn--success, btn--error …).
 */
export function buttonClasses(buttons, ctx = {}) {
    const b = withButtonDefaults(buttons);
    const classes = [];
    const sized = (name, css) => {
        for (const size of [BUTTON_SIZES[1], BUTTON_SIZES[0], BUTTON_SIZES[2]]) {
            const cls = `btn--${name}${size.suffix}`;
            classes.push([cls, css(`.${cls}`, size)]);
        }
    };
    for (const variant of COLOR_VARIANTS) sized(variant, (sel, size) => filledCss(sel, variant, size.token));
    for (const brand of brandButtons(ctx)) sized(brand.name, (sel, size) => filledCss(sel, brand.name, size.token));
    for (const state of stateButtons(ctx)) sized(state.name, (sel, size) => filledCss(sel, state.name, size.token));
    sized('link', (sel, size) => linkCss(sel, b.link.style, size.token));
    sized('icon', (sel, size) => iconCss(sel, b.icon.shape, size.suffix ? size.token : null));
    return classes;
}

/* ---------------- Bricks Button element + --bricks-* colors ---------------- */

/** Bricks style names → TwoKit state palette ids (Bricks' danger is TwoKit's error). */
const STATE_IDS = { info: ['info'], success: ['success'], warning: ['warning'], danger: ['error', 'danger'] };

/**
 * State palette token name for a Bricks style, or null. `states` are
 * { id, name }; ids are stable, names can be renamed.
 */
export function stateFor(bricks, states = []) {
    const list = states.map((s) => (typeof s === 'string' ? { id: s, name: s } : s));
    for (const id of STATE_IDS[bricks]) {
        const hit = list.find((s) => s.id === id) || list.find((s) => s.name === id);
        if (hit) return hit.name;
    }
    return null;
}

const SURFACE_LIKE = /^(transparent|surface-|light-surface|dark-surface|text-)/;

/**
 * Bricks button style → { filled, outline } color sets. Outline is
 * transparent with text + border in the style color and fills in on hover.
 */
function bricksStyles(buttons, ctx) {
    const fixed = (bg, text, border, bgHover) => colors(bg, text, border, bgHover, text, border);
    const outlineOf = (filled, ink) => ({ ...colors('transparent', ink, ink), bgHover: filled.bg, textHover: filled.text, borderHover: filled.border });
    // Surface secondary: its own text; brand secondary: the page text (a brand fill can be too light to outline with).
    const secondaryInk = SURFACE_LIKE.test(variantPicks(buttons, 'secondary', ctx).bg) ? 'var(--btn-secondary-text)' : 'var(--text-primary)';
    const styles = {
        primary: { filled: tokenColors('primary'), outline: tokenColors('outline') },
        secondary: { filled: tokenColors('secondary'), outline: outlineOf(tokenColors('secondary'), secondaryInk) },
        light: { filled: fixed('var(--light-surface-2)', 'var(--light-text-primary)', 'var(--light-border)', 'var(--light-surface-3)') },
        dark: { filled: fixed('var(--dark-surface-3)', 'var(--dark-text-primary)', 'var(--dark-border)', 'var(--dark-surface-4)') },
        muted: { filled: fixed('var(--surface-3)', 'var(--text-secondary)', 'var(--border)', 'var(--surface-4)') }
    };
    styles.light.outline = outlineOf(styles.light.filled, 'var(--light-surface-2)');
    styles.dark.outline = outlineOf(styles.dark.filled, 'var(--dark-surface-3)');
    styles.muted.outline = outlineOf(styles.muted.filled, 'var(--text-secondary)');
    for (const bricks of Object.keys(STATE_IDS)) {
        const name = stateFor(bricks, ctx.states);
        const state = (ctx.states || []).find((s) => s.name === name);
        if (!state?.colors) continue;
        const filled = tokenColors(name);
        styles[bricks] = { filled, outline: outlineOf(filled, `var(--${name}-text)`) };
    }
    return styles;
}

/**
 * Theme-stylesheet CSS: --bricks-* colors mapped to TwoKit tokens, and the
 * Bricks Button element (all 9 styles, filled + outline, sizes) on the
 * button tokens. Selectors mirror Bricks' own (:where() keeps them at the
 * specificity of .bricks-button, so global classes still override).
 */
export function bricksButtonCss(buttons, ctx = {}) {
    const states = ctx.states || [];
    const map = [
        ['--bricks-color-primary', 'var(--action)'],
        ['--bricks-color-secondary', ctx.hasSecondaryBrand ? 'var(--action-secondary)' : 'var(--text-secondary)'],
        ['--bricks-text-dark', 'var(--text-primary)'],
        ['--bricks-text-muted', 'var(--text-muted)'],
        ['--bricks-text-light', 'var(--text-disabled)'],
        ['--bricks-bg-dark', 'var(--dark-surface-2)'],
        ['--bricks-bg-light', 'var(--light-surface-2)'],
        ['--bricks-border-color', 'var(--border)'],
        ['--bricks-border-radius', 'var(--radius, 4px)']
    ];
    for (const bricks of Object.keys(STATE_IDS)) {
        const name = stateFor(bricks, states);
        if (!name) continue;
        map.push([`--bricks-text-${bricks}`, `var(--${name}-text)`], [`--bricks-bg-${bricks}`, `var(--${name}-surface)`]);
    }
    // Site and builder only: the block editor canvas keeps Bricks' own --bricks-* colors
    // (Bricks rewrites :root to .block-editor-iframe__html there, so this never matches).
    const blocks = [`/* Bricks colors → TwoKit tokens (buttons, alerts, progress bars, ribbons…) */
:root:not(.block-editor-iframe__html) {
${map.map(([k, v]) => `  ${k}: ${v};`).join('\n')}
}`, `/* Bricks Button element: shape from the --btn-* tokens */
.bricks-button {
${shape('btn-font-size')}
  border: var(--btn-border-width) solid transparent;
  background-color: transparent;
  color: inherit;
}

${pressed('.bricks-button')}

${disabled('.bricks-button')}`];
    for (const [style, { filled, outline }] of Object.entries(bricksStyles(buttons, { ...ctx, states }))) {
        blocks.push(`/* ${style} */
${colorRules(`.bricks-button:where(.bricks-background-${style}, .bricks-color-${style})`, filled)}

${colorRules(`.bricks-button:where(.outline.bricks-color-${style})`, outline)}`);
    }
    blocks.push(`/* Sizes (padding is em, so it scales with the font) */
.bricks-button:where(.sm) { font-size: var(--btn-font-size-s); }
.bricks-button:where(.lg) { font-size: var(--btn-font-size-l); }
.bricks-button:where(.xl) { font-size: calc(var(--btn-font-size-l) * 1.2); }`);
    return blocks.join('\n\n');
}
