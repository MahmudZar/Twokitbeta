/**
 * ThemeTokens
 *
 * One model for every themed token TwoKit exports, built from the primary
 * palette, the state palettes and the surface tint:
 *
 *   surfaces 0–8, text, borders, states (surface system, tinted by primary)
 *   action (primary shades picked for 4.5:1 on surface 1)
 *   inverse (the opposite theme's values, for tooltips and toasts)
 *   state colors (surface / border / text / solid per state palette)
 *   shadows 1–8 per theme, plus semantic aliases
 *
 * Each token has a light and a dark entry: { css, hex, alpha, ref? }.
 * `css` is what the fixed --light-* / --dark-* variable holds (a raw color
 * or a palette var()), `hex` + `alpha` are the resolved sRGB value for Figma
 * and Bricks palettes, `ref` names the palette token when there is one.
 *
 * @module themeTokens
 */

import SurfaceSystem, { LEVELS } from './surfaceSystem.js';
import ColorScience from './colorScience.js';

export const STATE_ROLES = ['surface', 'border', 'text', 'solid'];

export const DEFAULT_STATE_ROLES = {
    light: { surface: '50', border: '200', text: '700', solid: '600' },
    dark: { surface: '950', border: '800', text: '300', solid: '500' }
};

export const SURFACE_ALIASES = [
    ['surface-canvas', 'surface-0'],
    ['surface-page', 'surface-1'],
    ['surface-card', 'surface-2'],
    ['surface-raised', 'surface-3'],
    ['surface-popover', 'surface-4'],
    ['surface-dialog', 'surface-5']
];

export const SHADOW_ALIASES = [
    ['shadow-card', 'shadow-2'],
    ['shadow-raised', 'shadow-3'],
    ['shadow-popover', 'shadow-4'],
    ['shadow-dialog', 'shadow-5']
];

const LIGHT_ACTION = ['600', '700', '800', '900', '950'];
const DARK_ACTION = ['400', '300', '200', '100', '50'];
const MIN_CONTRAST = 4.5;

const luminance = (hex) => {
    const { r, g, b } = ColorScience.hexToRgb(hex);
    const lin = (c) => ColorScience.srgbToLinear(c);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

export function contrast(a, b) {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
}

/**
 * APCA lightness contrast (Lc, 0–106), text on background, as a magnitude.
 * WCAG 2's ratio under-rates white on saturated mid-tones (blue, red, teal
 * 500–600) and over-rates near-black on them; APCA tracks what eyes see.
 * Constants: APCA-W3 0.0.98G-4g.
 */
export function apca(text, bg) {
    const y = (hex) => {
        const [r, g, b] = [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255) ** 2.4);
        const v = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
        return v > 0.022 ? v : v + (0.022 - v) ** 1.414; // soft black clamp
    };
    const [t, b] = [y(text), y(bg)];
    if (Math.abs(b - t) < 0.0005) return 0;
    if (b > t) {
        const s = (b ** 0.56 - t ** 0.57) * 1.14; // dark text on light
        return s < 0.1 ? 0 : (s - 0.027) * 100;
    }
    const s = (b ** 0.65 - t ** 0.62) * 1.14; // light text on dark
    return s > -0.1 ? 0 : -(s + 0.027) * 100;
}

/** Button label thresholds: APCA Lc 60, or Lc 55 when WCAG 2 AA (4.5:1) also holds. */
export const LC_TARGET = 60;
export const LC_NEAR = 55;

/** True when button text reads well on its fill (see LC_TARGET). */
export function readable(text, bg) {
    const lc = apca(text, bg);
    return lc >= LC_TARGET || (lc >= LC_NEAR && contrast(text, bg) >= 4.5);
}

const raw = (hex) => ({ css: hex, hex, alpha: 1 });
const WHITE = '#FFFFFF';
const overlay = (o, key) => {
    const { L, C, H } = ColorScience.hexToOklch(o.hex);
    const a = o.alpha[key];
    const f = (n, d = 3) => +n.toFixed(d);
    return { css: `oklch(${f(L)} ${f(C)} ${f(H, 1)} / ${f(a)})`, hex: o.hex, alpha: a };
};

function paletteEntry(palette, step, varName) {
    const shade = palette.shades.find((s) => s.shade === String(step)) || palette.shades[5];
    return { css: `var(--${varName(shade.name)})`, hex: shade.hex, alpha: 1, ref: shade.name };
}

/** First step in `order` that reaches 4.5:1 on `ground`, else the best one. */
function readableStep(palette, order, ground) {
    let best = order[0];
    let bestRatio = 0;
    for (const step of order) {
        const shade = palette.shades.find((s) => s.shade === step);
        if (!shade) continue;
        const ratio = contrast(shade.hex, ground);
        if (ratio >= MIN_CONTRAST) return step;
        if (ratio > bestRatio) { best = step; bestRatio = ratio; }
    }
    return best;
}

function actionSet(palette, ground, order, varName) {
    const steps = palette.shades.map((s) => s.shade);
    const step = readableStep(palette, order, ground);
    const i = order.indexOf(step);
    const hoverStep = order[Math.min(order.length - 1, i + 1)];
    const action = paletteEntry(palette, step, varName);
    const light = steps[0];
    const dark = steps[steps.length - 1];
    const lightInk = palette.shades.find((s) => s.shade === light);
    const darkInk = palette.shades.find((s) => s.shade === dark);
    const onStep = contrast(lightInk.hex, action.hex) >= contrast(darkInk.hex, action.hex) ? light : dark;
    return {
        action,
        'action-hover': paletteEntry(palette, hoverStep, varName),
        'on-action': paletteEntry(palette, onStep, varName)
    };
}

const ThemeTokens = {
    LEVELS,

    /**
     * @param {object} input
     * @param {{name:string, baseColor:string, shades:object[]}} input.primary
     * @param {{name:string, shades:object[], roles?:object}[]} [input.states]
     * @param {number} [input.tint]
     * @param {string} [input.surfaceBase] hue for the surface ladder; defaults to primary
     * @param {{inverse?:boolean, aliases?:boolean}} [input.options]
     * @param {(name:string) => string} [input.varName] palette token → CSS variable name
     */
    build({ primary, secondary = null, states = [], tint = SurfaceSystem.defaults.tint, surfaceBase, options = {}, varName = (n) => n }) {
        const opts = { inverse: true, aliases: true, ...options };
        const system = SurfaceSystem.generate({ base: surfaceBase || primary.baseColor, tint });
        const groups = [];
        const add = (id, label, rows) => groups.push({ id, label, tokens: rows.map(([name, light, dark]) => ({ name, light, dark })) });

        const L = system.light;
        const D = system.dark;

        add('surfaces', 'Surfaces', L.surfaces.map((hex, i) => [`surface-${i}`, raw(hex), raw(D.surfaces[i])]));

        add('text', 'Text', ['primary', 'secondary', 'muted', 'disabled']
            .map((k) => [`text-${k}`, raw(L.text[k]), raw(D.text[k])]));

        add('borders', 'Borders', [
            ['border-extra-subtle', 'extraSubtle'],
            ['border-subtle', 'subtle'],
            ['border', 'border'],
            ['border-strong', 'strong']
        ].map(([name, key]) => [name, overlay(L.overlay, key), overlay(D.overlay, key)]));

        add('states', 'Interaction states', ['hover', 'active', 'selected']
            .map((k) => [k, overlay(L.overlay, k), overlay(D.overlay, k)]));

        const lightAction = actionSet(primary, L.surfaces[1], LIGHT_ACTION, varName);
        const darkAction = actionSet(primary, D.surfaces[1], DARK_ACTION, varName);
        add('action', 'Action', Object.keys(lightAction).map((k) => [k, lightAction[k], darkAction[k]]));

        // Second brand palette (when there is one): the same readable-step logic,
        // used by the secondary button and Bricks' "secondary" style.
        if (secondary?.shades?.length) {
            const light2 = actionSet(secondary, L.surfaces[1], LIGHT_ACTION, varName);
            const dark2 = actionSet(secondary, D.surfaces[1], DARK_ACTION, varName);
            const rename = { action: 'action-secondary', 'action-hover': 'action-secondary-hover', 'on-action': 'on-action-secondary' };
            add('action-secondary', 'Action · secondary', Object.keys(light2).map((k) => [rename[k], light2[k], dark2[k]]));
        }

        if (opts.inverse) {
            const flip = (group, name) => {
                const token = groups.find((g) => g.id === group).tokens.find((t) => t.name === name);
                const fixed = (mode, entry) => ({ ...entry, css: `var(--${mode}-${name})` });
                return [fixed('dark', token.dark), fixed('light', token.light)];
            };
            add('inverse', 'Inverse', [
                ['inverse-surface', 'surfaces', 'surface-2'],
                ['inverse-surface-raised', 'surfaces', 'surface-4'],
                ['inverse-text', 'text', 'text-primary'],
                ['inverse-text-muted', 'text', 'text-muted'],
                ['inverse-border', 'borders', 'border'],
                ['inverse-action', 'action', 'action']
            ].map(([name, group, source]) => [name, ...flip(group, source)]));
        }

        for (const state of states) {
            if (!state.shades?.length) continue;
            const roles = normalizeRoles(state.roles);
            // on-solid (icons, labels on the solid): white whenever it passes the
            // button-label rule (APCA Lc 60, or 55 + WCAG AA), since a pale tint
            // of the palette always reads worse than white. Otherwise the darker of
            // the palette's ends, or white, whichever has more APCA contrast.
            const darkEnd = state.shades[state.shades.length - 1];
            const onSolid = (mode) => {
                const solid = paletteEntry(state, roles[mode].solid, varName);
                if (readable(WHITE, solid.hex)) return raw(WHITE);
                return Math.abs(apca(darkEnd.hex, solid.hex)) > Math.abs(apca(WHITE, solid.hex))
                    ? paletteEntry(state, darkEnd.shade, varName)
                    : raw(WHITE);
            };
            add(`state-${state.name}`, `State · ${state.name}`, [
                ...STATE_ROLES.map((role) => [
                    `${state.name}-${role}`,
                    paletteEntry(state, roles.light[role], varName),
                    paletteEntry(state, roles.dark[role], varName)
                ]),
                [`${state.name}-on-solid`, onSolid('light'), onSolid('dark')]
            ]);
        }

        return {
            hue: system.hue,
            chroma: system.chroma,
            groups,
            shadows: { light: L.shadows, dark: D.shadows },
            aliases: opts.aliases ? { surfaces: SURFACE_ALIASES, shadows: SHADOW_ALIASES } : { surfaces: [], shadows: [] },
            system
        };
    },

    /**
     * Interaction layers. --hover etc. are translucent overlays; used as
     * `background` they replace the element's surface. As a background-image
     * they sit on top of it, giving the same step on every surface:
     *   background-image: var(--hover-layer);
     */
    layers() {
        return ['hover', 'active', 'selected'].map((k) => [`${k}-layer`, `linear-gradient(var(--${k}) 0 0)`]);
    },

    /** Flat list of every themed token. */
    tokens(model) {
        return model.groups.flatMap((g) => g.tokens);
    },

    /** Resolved values for one theme, for painting a scoped preview. */
    vars(model, mode) {
        const v = {};
        for (const t of this.tokens(model)) {
            const e = t[mode];
            v[`--${t.name}`] = e.alpha < 1 ? e.css : e.hex;
        }
        model.shadows[mode].forEach((s, i) => { v[`--shadow-${i + 1}`] = s; });
        // Fixed shadows, like --light-surface-* / --dark-surface-*: theme contexts point at them.
        for (const m of ['light', 'dark']) model.shadows[m].forEach((s, i) => { v[`--${m}-shadow-${i + 1}`] = s; });
        for (const [name, value] of this.layers()) v[`--${name}`] = value;
        for (const [alias, target] of model.aliases.surfaces) v[`--${alias}`] = `var(--${target})`;
        for (const [alias, target] of model.aliases.shadows) v[`--${alias}`] = `var(--${target})`;
        return v;
    },

    /**
     * CSS in three layers: fixed values, light-dark() theme tokens, and the
     * theme switch with shadows (light-dark() only takes colors).
     * `defaultMode` decides which theme :root gets without an attribute.
     */
    toCss(model, { attr = 'data-brx-theme', defaultMode = 'light' } = {}) {
        return [this.fixedCss(model), this.tokenCss(model, { attr }), this.switchCss(model, { attr, defaultMode })].join('\n\n');
    },

    /** Fixed shadow values, [name, value] per level: light-shadow-1 … / dark-shadow-1 … */
    shadowRows(model, mode) {
        return model.shadows[mode].map((s, i) => [`${mode}-shadow-${i + 1}`, s]);
    },

    fixedCss(model) {
        const lines = (mode) => [
            ...model.groups.map((g) => [
                `  /* ${g.label} */`,
                ...g.tokens.map((t) => `  --${mode}-${t.name}: ${t[mode].css};`)
            ].join('\n')),
            [`  /* Shadows */`, ...this.shadowRows(model, mode).map(([n, s]) => `  --${n}: ${s};`)].join('\n')
        ].join('\n\n');
        return `/* Theme · fixed values (never switch) */
:root {
${lines('light')}

${lines('dark')}
}`;
    },

    tokenCss(model, { attr = 'data-brx-theme' } = {}) {
        const body = model.groups.map((g) => [
            `  /* ${g.label} */`,
            ...g.tokens.map((t) => `  --${t.name}: light-dark(var(--light-${t.name}), var(--dark-${t.name}));`)
        ].join('\n')).join('\n\n');
        const alias = [...model.aliases.surfaces, ...model.aliases.shadows];
        const aliasBlock = alias.length
            ? `\n\n  /* Semantic aliases */\n${alias.map(([a, t]) => `  --${a}: var(--${t});`).join('\n')}`
            : '';
        const layers = `\n\n  /* Interaction layers: stack on the element's own background.
     .button:hover { background-image: var(--hover-layer); } */\n${this.layers().map(([n, v]) => `  --${n}: ${v};`).join('\n')}`;
        return `/* Theme tokens: use these everywhere. light-dark() resolves on the
   element that uses them, so a nested [${attr}] section just works. */
:root {
${body}${aliasBlock}${layers}
}`;
    },

    /**
     * What a theme context sets besides colors (light-dark() only takes
     * colors): color-scheme, shadows, the shadow aliases (re-declared so a
     * nested theme section gets its own, not the page's), and the opposite
     * theme's scheme and shadows, which .theme-inverse reads. Shadows point at
     * the fixed --light-shadow-* / --dark-shadow-* values (fixedCss).
     */
    contextVars(model, mode) {
        const other = mode === 'dark' ? 'light' : 'dark';
        const lines = [`color-scheme: ${mode};`];
        model.shadows[mode].forEach((_, i) => lines.push(`--shadow-${i + 1}: var(--${mode}-shadow-${i + 1});`));
        for (const [alias, target] of model.aliases.shadows) lines.push(`--${alias}: var(--${target});`);
        lines.push(`--inverse-scheme: ${other};`);
        model.shadows[other].forEach((_, i) => lines.push(`--inverse-shadow-${i + 1}: var(--${other}-shadow-${i + 1});`));
        return lines;
    },

    /** The opposite theme of wherever the element sits (.theme-inverse, .inverse). */
    inverseVars(model) {
        const lines = ['color-scheme: var(--inverse-scheme, dark);'];
        model.shadows.light.forEach((_, i) => lines.push(`--shadow-${i + 1}: var(--inverse-shadow-${i + 1});`));
        for (const [alias, target] of model.aliases.shadows) lines.push(`--${alias}: var(--${target});`);
        return lines;
    },

    /** .inverse / .theme-inverse rules: a full flip (colors, borders, hover, shadows), background `bg`. */
    inverseCss(model, selector, { bg = 'var(--surface-1)', color = 'var(--text-secondary)' } = {}) {
        return `${selector} {\n${this.inverseVars(model).map((l) => `  ${l}`).join('\n')}\n}\n\n:where(${selector}) {\n  background-color: ${bg};\n  color: ${color};\n}`;
    },

    switchCss(model, { attr = 'data-brx-theme', defaultMode = 'light', bricks = false } = {}) {
        const is = (m) => `[${attr}="${m}"]`;
        const block = (selector, mode) => `${selector} {\n${this.contextVars(model, mode).map((l) => `  ${l}`).join('\n')}\n}`;
        if (bricks) {
            // Bricks sets the attribute on <html> on the site and in the builder;
            // :root[...] outranks the :root variables. Plain :root is light: that's
            // what the Gutenberg canvas gets, where there is no attribute. Bricks
            // rewrites :root to .block-editor-iframe__html there and keeps the
            // attribute (an html[...] selector would lose it and always go dark).
            return [
                `/* Theme switch + shadows */`,
                block(`:root,\n:root${is('light')},\n${is('light')}`, 'light'),
                block(`:root${is('dark')},\n${is('dark')}`, 'dark')
            ].join('\n\n');
        }
        const fallback = defaultMode === 'dark' ? 'dark' : 'light';
        const other = fallback === 'dark' ? 'light' : 'dark';
        const parts = [
            `/* Theme switch + shadows */`,
            block(`:root,\n${is(fallback)}`, fallback),
            block(is(other), other)
        ];
        if (defaultMode === 'auto') {
            parts.push(`@media (prefers-color-scheme: dark) {\n${block(`  :root:not([${attr}])`, 'dark').replace(/\n/g, '\n  ')}\n}`);
        }
        return parts.join('\n\n');
    }
};

/** Accept the current { light, dark } roles or the old dark-only { surface, text, stroke }. */
export function normalizeRoles(roles) {
    if (roles?.light && roles?.dark) {
        return {
            light: { ...DEFAULT_STATE_ROLES.light, ...roles.light },
            dark: { ...DEFAULT_STATE_ROLES.dark, ...roles.dark }
        };
    }
    return structuredClone(DEFAULT_STATE_ROLES);
}

export default ThemeTokens;
