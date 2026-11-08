/**
 * Figma package: one JSON file with everything the TwoKit Figma plugin
 * (app/figma-plugin) imports. Schema "twokit/figma", version 1.
 *
 *   collections    Primitives (Value), Theme (Light / Dark), Typography and
 *                  Spacing (Desktop / Mobile: fluid clamps at the max and min
 *                  viewport). Values are colors (#RRGGBBAA), numbers (px),
 *                  strings, or aliases ("collection:variable/name")
 *   textStyles     headings, fluid text steps and fixed body sizes, each bound
 *                  to Typography variables (size, line height, family) so
 *                  switching Desktop / Mobile resizes them
 *   effectStyles   shadow 1–8. Light and dark layers live in one style; each
 *                  layer color is a Theme variable that is transparent in the
 *                  other mode, so one style is exact in both themes
 *   paintStyles    optional color styles bound to the Theme variables
 *   fonts          families, weights and where to get them
 *
 * Line heights are measured in the browser with the real font (TwoKit's
 * line heights are ex-based, so they depend on the font's x-height).
 *
 * @module figmaPackage
 */

import AppState from '../state/appState.js';
import ColorScience from './colorScience.js';
import { currentTheme, ensureShades, buttonContext } from '../state/themeModel.js';
import { headingRole, bodyRole, sortFaces } from '../state/fontModel.js';
import { buttonRows, cssColor as tokenCss } from './buttonsCss.js';
import ThemeTokens from './themeTokens.js';
import { resolveColor } from '../ui/colorResolve.js';
import { withDefaults, radiusScale, RADIUS_STEPS } from './stylingCss.js';

export const FIGMA_SCHEMA = 'twokit/figma';
export const FIGMA_VERSION = 1;

const round = (n, d = 2) => Math.round(Number(n) * 10 ** d) / 10 ** d;
const clamp01 = (n) => Math.min(1, Math.max(0, Number(n)));
const cssName = (section, name) => AppState.tokenName(section, name);

/* ------------------------------------------------------------------ */
/* Colors                                                              */
/* ------------------------------------------------------------------ */

/** #RRGGBB + alpha → #RRGGBBAA. */
export function hex8(hex, alpha = 1) {
    let h = String(hex).replace('#', '').trim();
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    const rgb = h.slice(0, 6).toUpperCase();
    const a = h.length === 8 && alpha === 1 ? h.slice(6, 8).toUpperCase() : Math.round(clamp01(alpha) * 255).toString(16).padStart(2, '0').toUpperCase();
    return `#${rgb}${a}`;
}

const num = (token, scale = 1) => {
    const t = String(token).trim();
    const v = parseFloat(t);
    return t.endsWith('%') ? v / 100 : v / scale;
};

/** Any color TwoKit writes (hex, rgb(), oklch(), transparent) → #RRGGBBAA, or null. */
export function cssColor(value) {
    const s = String(value || '').trim().toLowerCase();
    if (!s) return null;
    if (s === 'transparent') return '#00000000';
    if (s === 'white') return '#FFFFFFFF';
    if (s === 'black') return '#000000FF';
    if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(s)) return hex8(s);
    const fn = /^(rgba?|oklch)\((.*)\)$/.exec(s);
    if (!fn) return null;
    const [main, alphaPart] = fn[2].split('/');
    const parts = main.split(/[\s,]+/).filter(Boolean);
    let alpha = alphaPart != null ? num(alphaPart) : (parts.length === 4 ? num(parts[3]) : 1);
    if (!Number.isFinite(alpha)) alpha = 1;
    if (fn[1] === 'oklch') {
        const L = parts[0].endsWith('%') ? parseFloat(parts[0]) / 100 : parseFloat(parts[0]);
        const hex = ColorScience.oklchToHex(L, parseFloat(parts[1]) || 0, parseFloat(parts[2]) || 0);
        return hex ? hex8(hex, alpha) : null;
    }
    const [r, g, b] = parts.slice(0, 3).map((p) => (p.endsWith('%') ? parseFloat(p) * 2.55 : parseFloat(p)));
    if (![r, g, b].every(Number.isFinite)) return null;
    return hex8(ColorScience.rgbToHex(Math.round(r), Math.round(g), Math.round(b)), alpha);
}

/* ------------------------------------------------------------------ */
/* Shadows                                                             */
/* ------------------------------------------------------------------ */

/** Splits on commas that are not inside parentheses. */
function splitTop(value, sep = ',') {
    const out = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < value.length; i++) {
        const c = value[i];
        if (c === '(') depth++;
        else if (c === ')') depth--;
        else if (c === sep && depth === 0) {
            out.push(value.slice(start, i));
            start = i + 1;
        }
    }
    out.push(value.slice(start));
    return out.map((s) => s.trim()).filter(Boolean);
}

/** One box-shadow list → [{ inset, x, y, blur, spread, color }]. */
export function parseShadows(value) {
    if (!value || value === 'none') return [];
    return splitTop(value).map((layer) => {
        const tokens = [];
        let depth = 0;
        let cur = '';
        for (const c of layer) {
            if (c === '(') depth++;
            if (c === ')') depth--;
            if (/\s/.test(c) && depth === 0) {
                if (cur) tokens.push(cur);
                cur = '';
            } else cur += c;
        }
        if (cur) tokens.push(cur);
        const inset = tokens.includes('inset');
        const lengths = tokens.filter((t) => /^-?[\d.]+(px)?$/.test(t)).map((t) => parseFloat(t));
        const colorToken = tokens.find((t) => t !== 'inset' && !/^-?[\d.]+(px)?$/.test(t));
        const [x = 0, y = 0, blur = 0, spread = 0] = lengths;
        return { inset, x, y, blur, spread, color: cssColor(colorToken) || '#00000040' };
    });
}

/**
 * One effect style per level for both themes. Layers with the same geometry
 * in light and dark are merged; the rest are kept with a color that is
 * transparent in the other theme. Colors become Theme variables, shared by
 * every layer with the same light/dark pair.
 */
function shadowStyles(model, addThemeColor) {
    const count = Math.max(model.shadows.light.length, model.shadows.dark.length);
    const aliasOf = Object.fromEntries((model.aliases.shadows || []).map(([alias, target]) => [target, alias]));
    const styles = [];
    for (let i = 0; i < count; i++) {
        const light = parseShadows(model.shadows.light[i]);
        const dark = parseShadows(model.shadows.dark[i]);
        const key = (l) => `${l.inset}|${l.x}|${l.y}|${l.blur}|${l.spread}`;
        const used = new Set();
        const layers = light.map((l) => {
            const j = dark.findIndex((d, k) => !used.has(k) && key(d) === key(l));
            if (j >= 0) used.add(j);
            return { ...l, light: l.color, dark: j >= 0 ? dark[j].color : '#00000000' };
        });
        dark.forEach((d, k) => { if (!used.has(k)) layers.push({ ...d, light: '#00000000', dark: d.color }); });
        const name = `shadow-${i + 1}`;
        styles.push({
            name: `Shadow/${i + 1}`,
            description: `var(--${name})${aliasOf[name] ? ` · ${aliasOf[name]}` : ''}`,
            effects: layers.map((l) => ({
                type: l.inset ? 'INNER_SHADOW' : 'DROP_SHADOW',
                color: l.light === '#00000000' ? l.dark : l.light,
                x: round(l.x), y: round(l.y), blur: Math.max(0, round(l.blur)), spread: round(l.spread),
                bind: { color: addThemeColor(l.light, l.dark) }
            }))
        });
    }
    return styles;
}

/* ------------------------------------------------------------------ */
/* Measuring                                                           */
/* ------------------------------------------------------------------ */

/** Loads the role fonts, then measures line heights with them (px). */
async function lineHeightMeter(stacks) {
    const wait = (p) => Promise.race([p, new Promise((r) => setTimeout(r, 1500))]);
    try {
        await wait(Promise.all(stacks.map(({ stack, weight }) => document.fonts.load(`${weight} 32px ${stack}`).catch(() => null))));
    } catch { /* measured with the fallback font */ }
    const probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;pointer-events:none';
    probe.textContent = 'Hxg';
    document.body.append(probe);
    return {
        measure({ stack, weight, size, formula }) {
            probe.style.fontFamily = stack;
            probe.style.fontWeight = String(weight);
            probe.style.fontSize = `${size}px`;
            probe.style.lineHeight = formula;
            const v = parseFloat(getComputedStyle(probe).lineHeight);
            return round(Number.isFinite(v) ? v : size * 1.3);
        },
        done() { probe.remove(); }
    };
}

/** "-0.03em" / "0.5px" / "2%" → { unit, value } for Figma (em → percent). */
function letterSpacing(value) {
    const s = String(value || '').trim();
    const v = parseFloat(s);
    if (!Number.isFinite(v) || v === 0) return { unit: 'PERCENT', value: 0 };
    if (s.endsWith('em')) return { unit: 'PERCENT', value: round(v * 100) };
    if (s.endsWith('%')) return { unit: 'PERCENT', value: round(v) };
    return { unit: 'PIXELS', value: round(v) };
}

const WRAP = { balance: 'BALANCE', pretty: 'PRETTY' };

/** First family name of a font stack, unquoted. */
const firstFamily = (stack) => String(stack || '').split(',')[0].replace(/["']/g, '').trim();

/* ------------------------------------------------------------------ */
/* Package                                                             */
/* ------------------------------------------------------------------ */

/**
 * @param {{ name: string }} meta
 * @returns {Promise<object>} the package (JSON-safe)
 */
export async function buildFigmaPackage({ name }) {
    const model = currentTheme();
    const t = AppState.typography;
    const sp = AppState.spacing;
    const layout = AppState.layout.generated;
    const styling = withDefaults(AppState.styling);

    const collections = {
        primitives: { id: 'primitives', name: 'Primitives', modes: ['Value'], variables: [] },
        theme: { id: 'theme', name: 'Theme', modes: ['Light', 'Dark'], variables: [] },
        typography: { id: 'typography', name: 'Typography', modes: ['Desktop', 'Mobile'], variables: [] },
        spacing: { id: 'spacing', name: 'Spacing', modes: ['Desktop', 'Mobile'], variables: [] }
    };
    const ref = (collection, variable) => `${collection}:${variable}`;
    const byCss = new Map(); // CSS variable name (no --) → reference, for aliases
    const resolved = new Map(); // reference → { mode → plain value }, so every alias also carries its value
    const plain = (value, mode) => {
        if (!value?.alias) return value;
        const target = resolved.get(value.alias);
        const v = target && (target[mode] || Object.values(target)[0]);
        return v ? { ...value, ...v } : value;
    };
    const add = (collection, variable) => {
        const r = ref(collection, variable.name);
        // Alias values keep their target's value too: the plugin falls back to it if that collection isn't imported.
        variable.values = Object.fromEntries(Object.entries(variable.values).map(([mode, value]) => [mode, plain(value, mode)]));
        resolved.set(r, Object.fromEntries(Object.entries(variable.values).map(([mode, value]) => {
            const { alias, ...rest } = value;
            return [mode, rest];
        })));
        collections[collection].variables.push(variable);
        if (variable.css) byCss.set(variable.css, r);
        return r;
    };
    const same = (collection, value) => Object.fromEntries(collections[collection].modes.map((m) => [m, value]));

    /* Primitives: palettes, radius, fixed spacing */
    const shadeRef = new Map(); // palette shade name ("primary-500") → reference
    add('primitives', { name: 'color/base/white', type: 'COLOR', values: same('primitives', { color: '#FFFFFFFF' }), css: 'white', scopes: ['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR'] });
    add('primitives', { name: 'color/base/black', type: 'COLOR', values: same('primitives', { color: '#000000FF' }), css: 'black', scopes: ['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR'] });
    for (const c of [...AppState.colors, ...AppState.stateColors].map(ensureShades)) {
        for (const s of c.shades || []) {
            const r = add('primitives', {
                name: `color/${c.name}/${s.shade ?? s.name}`,
                type: 'COLOR',
                values: same('primitives', { color: hex8(s.hex) }),
                css: cssName('color', s.name),
                description: s.oklch || s.hex,
                scopes: ['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR']
            });
            shadeRef.set(s.name, r);
        }
        const base = c.shades?.find((s) => s.isBase);
        if (base) {
            add('primitives', {
                name: `color/${c.name}/base`,
                type: 'COLOR',
                values: same('primitives', { alias: shadeRef.get(base.name) }),
                css: cssName('color', c.name),
                description: `--${cssName('color', c.name)} → ${base.shade}`,
                scopes: ['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR']
            });
        }
    }
    const radius = styling.radius;
    const px = Object.fromEntries(radiusScale(radius).map((x) => [x.name, x.px]));
    // --radius: the base every step is calculated from (the CSS and Bricks variable of the same name).
    add('primitives', { name: 'radius/base', type: 'FLOAT', values: same('primitives', { number: round(radius.base ?? px['radius-m']) }), css: 'radius', scopes: ['CORNER_RADIUS'] });
    add('primitives', { name: 'radius/none', type: 'FLOAT', values: same('primitives', { number: 0 }), css: 'radius-none', scopes: ['CORNER_RADIUS'] });
    for (const [step] of radius.extraSizes ? RADIUS_STEPS : [['m', 0]]) {
        add('primitives', { name: `radius/${step}`, type: 'FLOAT', values: same('primitives', { number: round(px[`radius-${step}`]) }), css: `radius-${step}`, scopes: ['CORNER_RADIUS'] });
    }
    add('primitives', { name: 'radius/circle', type: 'FLOAT', values: same('primitives', { number: 9999 }), css: 'radius-circle', description: '50vw / 50% in CSS', scopes: ['CORNER_RADIUS'] });
    if (sp.enableFixedSpacing && sp.fixedScale?.length) {
        for (const s of sp.fixedScale) {
            add('primitives', { name: `space-fixed/${s.valuePx}`, type: 'FLOAT', values: same('primitives', { number: s.valuePx }), css: cssName('spacing', s.name), scopes: ['GAP', 'WIDTH_HEIGHT'] });
        }
    }

    /* Theme: every themed token, Light / Dark */
    const GROUPS = {
        surfaces: ['surface', ['FRAME_FILL', 'SHAPE_FILL']],
        text: ['text', ['TEXT_FILL']],
        borders: ['border', ['STROKE_COLOR']],
        states: ['interaction', ['FRAME_FILL', 'SHAPE_FILL']],
        action: ['action', ['ALL_FILLS', 'STROKE_COLOR']],
        'action-secondary': ['action', ['ALL_FILLS', 'STROKE_COLOR']],
        inverse: ['inverse', ['ALL_FILLS', 'STROKE_COLOR']]
    };
    const themeValue = (entry) => (entry.ref && shadeRef.has(entry.ref) ? { alias: shadeRef.get(entry.ref) } : { color: hex8(entry.hex, entry.alpha ?? 1) });
    for (const g of model.groups) {
        // Inverse tokens flip to the other theme on a part of a web page (.theme-inverse).
        // Figma frames pick Light or Dark directly, so they'd only be noise there.
        if (g.id === 'inverse') continue;
        const [group, scopes] = GROUPS[g.id] || [`state/${g.id.replace(/^state-/, '')}`, ['ALL_FILLS', 'STROKE_COLOR']];
        for (const tk of g.tokens) {
            add('theme', {
                name: `${group}/${tk.name}`,
                type: 'COLOR',
                values: { Light: themeValue(tk.light), Dark: themeValue(tk.dark) },
                css: tk.name,
                scopes
            });
        }
    }
    for (const [alias, target] of model.aliases.surfaces || []) {
        const r = byCss.get(target);
        if (r) add('theme', { name: `surface-alias/${alias}`, type: 'COLOR', values: same('theme', { alias: r }), css: alias, scopes: ['FRAME_FILL', 'SHAPE_FILL'] });
    }
    // Button colors: aliases of the theme / palette tokens they point at.
    for (const [, rowName, value] of buttonRows(AppState.buttons, buttonContext())) {
        if (!/-(bg|text|border|underline)(-hover)?$/.test(rowName)) continue;
        const target = /^var\(--([\w-]+)\)$/.exec(String(value).trim())?.[1];
        const v = target && byCss.has(target) ? { alias: byCss.get(target) } : (cssColor(value) ? { color: cssColor(value) } : null);
        if (!v) continue;
        add('theme', { name: `button/${rowName.replace(/^btn-/, '')}`, type: 'COLOR', values: same('theme', v), css: rowName, scopes: ['ALL_FILLS', 'STROKE_COLOR', 'TEXT_FILL'] });
    }
    // --btn-radius: an alias of the radius step the buttons use.
    const btnRadius = buttonRows(AppState.buttons, buttonContext()).find(([, rowName]) => rowName === 'btn-radius')?.[2];
    const btnRadiusTarget = /^var\(--([\w-]+)\)$/.exec(String(btnRadius || '').trim())?.[1];
    if (btnRadiusTarget && byCss.has(btnRadiusTarget)) {
        add('primitives', { name: 'radius/button', type: 'FLOAT', values: same('primitives', { alias: byCss.get(btnRadiusTarget) }), css: 'btn-radius', scopes: ['CORNER_RADIUS'] });
    } else if (Number.isFinite(parseFloat(btnRadius))) {
        add('primitives', { name: 'radius/button', type: 'FLOAT', values: same('primitives', { number: round(parseFloat(btnRadius)) }), css: 'btn-radius', scopes: ['CORNER_RADIUS'] });
    }

    // --site-bg: what fills the page. A theme token becomes an alias of it; any
    // other color (custom CSS) is resolved in each theme.
    const siteBg = AppState.theme.siteBg || 'surface-0';
    const siteTarget = !String(siteBg).startsWith('css:') && byCss.get(siteBg);
    const siteValue = (mode) => {
        if (siteTarget) return { alias: siteTarget };
        if (siteBg === 'transparent') return { color: '#00000000' };
        const probe = Object.entries(ThemeTokens.vars(model, mode)).map(([k, v]) => `${k}:${v}`).concat(
            [...AppState.colors, ...AppState.stateColors].flatMap((c) => (c.shades || []).map((s) => `--${cssName('color', s.name)}:${s.hex}`))
        ).join(';');
        const r = resolveColor(tokenCss(siteBg), mode, probe);
        return r ? { color: hex8(r.hex, r.alpha) } : null;
    };
    const siteLight = siteValue('light');
    const siteDark = siteValue('dark');
    if (siteLight && siteDark) {
        add('theme', { name: 'site/background', type: 'COLOR', values: { Light: siteLight, Dark: siteDark }, css: 'site-bg', description: 'Fills the page behind sections (--site-bg)', scopes: ['FRAME_FILL'] });
    }

    // Shadow colors, shared by every layer with the same light/dark pair.
    const shadowColors = new Map();
    const addThemeColor = (light, dark) => {
        const k = `${light}|${dark}`;
        if (!shadowColors.has(k)) {
            const n = shadowColors.size + 1;
            shadowColors.set(k, add('theme', {
                name: `shadow/color-${n}`,
                type: 'COLOR',
                values: { Light: { color: light }, Dark: { color: dark } },
                description: `Shadow layer · light ${light} · dark ${dark}`,
                scopes: ['EFFECT_COLOR']
            }));
        }
        return shadowColors.get(k);
    };
    const effectStyles = shadowStyles(model, addThemeColor);

    /* Typography: Desktop = max viewport, Mobile = min viewport */
    const heading = headingRole();
    const body = bodyRole();
    const headingFamily = heading.family || firstFamily(heading.stack);
    const bodyFamily = body.family || firstFamily(body.stack);
    const fontFamily = add('typography', { name: 'font/heading', type: 'STRING', values: same('typography', { string: headingFamily }), css: cssName('type', 'font-heading'), scopes: ['FONT_FAMILY'] });
    const bodyFamilyRef = add('typography', { name: 'font/body', type: 'STRING', values: same('typography', { string: bodyFamily }), css: cssName('type', 'font-body'), scopes: ['FONT_FAMILY'] });
    add('typography', { name: 'weight/heading', type: 'FLOAT', values: same('typography', { number: Number(t.headingWeight) || 400 }), scopes: ['FONT_WEIGHT'] });
    add('typography', { name: 'weight/body', type: 'FLOAT', values: same('typography', { number: Number(t.bodyWeight) || 400 }), scopes: ['FONT_WEIGHT'] });

    const scale = t.scale || { headings: [], textSizes: [], body: [] };
    const meter = await lineHeightMeter([
        { stack: heading.stack, weight: t.headingWeight },
        { stack: body.stack, weight: t.bodyWeight }
    ]);
    const headingLh = t.headingLineHeight || 'var(--heading-line-height)';
    const bodyLh = t.bodyLineHeight || 'var(--text-line-height)';
    const textStyles = [];
    const sizeStyle = ({ styleName, token, max, min, role, isHeading, description }) => {
        const stack = role.stack;
        const weight = isHeading ? t.headingWeight : t.bodyWeight;
        const formula = isHeading ? headingLh : bodyLh;
        const size = add('typography', {
            name: `font-size/${token}`, type: 'FLOAT',
            values: { Desktop: { number: round(max) }, Mobile: { number: round(min) } },
            css: cssName('type', token), description, scopes: ['FONT_SIZE']
        });
        const lh = add('typography', {
            name: `line-height/${token}`, type: 'FLOAT',
            values: {
                Desktop: { number: meter.measure({ stack, weight, size: max, formula }) },
                Mobile: { number: meter.measure({ stack, weight, size: min, formula }) }
            },
            description: `${isHeading ? '--heading-line-height' : '--text-line-height'}, measured with ${role.label}`,
            scopes: ['LINE_HEIGHT']
        });
        textStyles.push({
            name: styleName,
            description: `var(--${cssName('type', token)})${min !== max ? ` · ${round(min)}–${round(max)}px` : ` · ${round(max)}px`}`,
            fontFamily: isHeading ? headingFamily : bodyFamily,
            fontWeight: Number(weight) || 400,
            italic: false,
            fontSize: round(max),
            lineHeight: { unit: 'PIXELS', value: meter.measure({ stack, weight, size: max, formula }) },
            letterSpacing: letterSpacing(isHeading ? t.headingLetterSpacing : t.bodyLetterSpacing),
            textWrap: WRAP[isHeading ? t.textWrap : t.bodyTextWrap] || 'AUTO',
            bind: { fontSize: size, lineHeight: lh, fontFamily: isHeading ? fontFamily : bodyFamilyRef }
        });
    };
    try {
        for (const h of (scale.headings || []).filter((x) => /^h[1-6]$/.test(x.name))) {
            sizeStyle({ styleName: `Heading/${h.name.toUpperCase()}`, token: h.name, max: h.maxSizePx, min: h.minSizePx, role: heading, isHeading: true, description: h.clamp });
        }
        for (const s of [...(scale.textSizes || [])].reverse()) {
            sizeStyle({ styleName: `Text/${s.label || s.step || s.name}`, token: s.name, max: s.maxSizePx, min: s.minSizePx, role: body, isHeading: false, description: s.clamp });
        }
        if (t.enableBodySizes !== false) {
            for (const b of [...(scale.body || [])].reverse()) {
                sizeStyle({ styleName: `Body/${b.sizePx}`, token: b.name, max: b.sizePx, min: b.sizePx, role: body, isHeading: false, description: b.size });
            }
        }
    } finally {
        meter.done();
    }

    /* Spacing: fluid steps + layout, Desktop / Mobile */
    const spaceRef = {};
    if (sp.fluidScale?.length) {
        for (const s of sp.fluidScale) {
            spaceRef[s.step ?? String(s.name).replace(/^space-/, '')] = add('spacing', {
                name: `space/${s.step ?? s.name}`, type: 'FLOAT',
                values: { Desktop: { number: round(s.maxSizePx) }, Mobile: { number: round(s.minSizePx) } },
                css: cssName('spacing', s.name), description: s.clamp, scopes: ['GAP', 'WIDTH_HEIGHT']
            });
        }
    }
    if (layout) {
        const p = layout.sectionPadding;
        const fluid = (varName, key, pad, scopes) => add('spacing', {
            name: `layout/${key}`, type: 'FLOAT',
            values: { Desktop: { number: round(pad.maxPx) }, Mobile: { number: round(pad.minPx) } },
            css: varName, description: pad.value, scopes
        });
        fluid('sctn-block-padding', 'section-block-padding', p.blockPadding, ['GAP']);
        fluid('sctn-inline-padding', 'section-inline-padding', p.inlinePadding, ['GAP']);
        fluid('site-gutter', 'site-gutter', p.siteGutter || p.inlinePadding, ['GAP']);
        for (const w of layout.contentWidths) {
            add('spacing', { name: `layout/${w.name}`, type: 'FLOAT', values: same('spacing', { number: w.valuePx }), css: w.name, scopes: ['WIDTH_HEIGHT'] });
        }
        for (const g of layout.gaps || []) {
            const target = spaceRef[g.step];
            if (target) add('spacing', { name: `layout/${g.name}`, type: 'FLOAT', values: same('spacing', { alias: target }), css: g.name, scopes: ['GAP'] });
        }
    }
    add('spacing', { name: 'layout/header-height', type: 'FLOAT', values: same('spacing', { number: Number(AppState.layout.header?.height) || 0 }), css: 'header-height', scopes: ['WIDTH_HEIGHT'] });

    /* Color styles (optional in the plugin): the theme tokens people paint with */
    const paintStyles = collections.theme.variables
        .filter((v) => /^(surface|text|border|action|inverse|state)\//.test(v.name))
        .map((v) => ({ name: `Theme/${v.name}`, description: v.css ? `var(--${v.css})` : '', color: v.values.Light.color || null, bind: ref('theme', v.name) }));

    /* Fonts */
    const roles = (font) => [font.id === t.headingFont ? 'Headings' : '', font.id === t.bodyFont ? 'Body' : ''].filter(Boolean);
    const fonts = AppState.fonts.map((f) => {
        const faces = sortFaces(f.faces || []);
        const variable = faces.find((x) => x.variable)?.variable;
        return {
            family: f.family,
            source: f.source === 'google' ? 'google' : 'upload',
            roles: roles(f),
            weights: [...new Set(faces.map((x) => Number(x.weight)).filter(Boolean))],
            variable: variable ? { min: variable.min, max: variable.max } : null,
            italic: faces.some((x) => x.style === 'italic'),
            url: f.source === 'google' ? `https://fonts.google.com/specimen/${encodeURIComponent(f.family).replace(/%20/g, '+')}` : null
        };
    });
    for (const role of [heading, body]) {
        if (!role.font && !fonts.some((f) => f.family === firstFamily(role.stack))) {
            fonts.push({ family: firstFamily(role.stack), source: 'system', roles: [role === heading ? 'Headings' : 'Body'], weights: [], variable: null, italic: false, url: null });
        }
    }

    const list = Object.values(collections).filter((c) => c.variables.length);
    return {
        $schema: FIGMA_SCHEMA,
        version: FIGMA_VERSION,
        meta: {
            name,
            generatedAt: new Date().toISOString(),
            generator: 'TwoKit 2.0',
            viewports: { mobile: t.minViewport, desktop: t.maxViewport },
            counts: {
                variables: list.reduce((n, c) => n + c.variables.length, 0),
                textStyles: textStyles.length,
                effectStyles: effectStyles.length,
                paintStyles: paintStyles.length
            }
        },
        fonts,
        collections: list,
        textStyles,
        effectStyles,
        paintStyles
    };
}
