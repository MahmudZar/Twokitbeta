/**
 * SurfaceSystem Module
 *
 * Builds a surface ladder (0–8) for light and dark themes from one brand
 * color, plus the text, border, state and shadow tokens that sit on it.
 *
 *   • Every level is an OKLCH color: lightness from the ladder, hue from the
 *     brand color, and one small fixed chroma (the tint), so surfaces read as
 *     grays leaning toward the brand hue whatever the brand's saturation.
 *   • Dark climbs in lightness from `dark.start` (surface 1) by `dark.step`
 *     per level; surface 0 sits `depth` below it as a near-black canvas.
 *     Light mirrors it: descending from `light.start`, with surface 0 lifted
 *     `light.depth` toward white.
 *   • Borders and states are translucent overlays, so one token works on
 *     every level.
 *   • Shadows pair 1:1 with levels 1–8: light stacks drops whose offsets
 *     double; dark adds an inset top highlight and inset ring before the
 *     drops, since drops alone barely show on dark grounds.
 *
 * @module surfaceSystem
 */

import ColorScience from './colorScience.js';

export const LEVELS = 8;

/** Brand colors below this OKLCH chroma have no reliable hue to borrow. */
const NEUTRAL_CHROMA = 0.015;

const DROPS = [[1, 1, -0.5], [3, 3, -1.5], [6, 6, -3], [12, 12, -6], [24, 24, -12], [48, 48, -24], [96, 96, -48]];
const DARK_HIGHLIGHT = [0, 0.01, 0.02, 0.02, 0.04, 0.04, 0.06, 0.06];
const DARK_RING = [0.02, 0.02, 0.02, 0.04, 0.04, 0.06, 0.06, 0.06];

const round = (n, d = 3) => +n.toFixed(d);
const hexAt = (L, C, H) => {
    const c = ColorScience.clampToSrgb(Math.max(0, Math.min(1, L)), C, H);
    return ColorScience.oklchToHex(c.L, c.C, c.H).toUpperCase();
};
const alphaAt = (L, C, H, a) => `oklch(${round(L)} ${round(C)} ${round(H, 1)} / ${round(a)})`;

const SurfaceSystem = {
    defaults: {
        base: '#6348B3',
        tint: 0.012,
        dark: { start: 0.205, step: 0.029, depth: 0.03 },
        light: { start: 0.985, step: 0.018, depth: 0.006 },
        tintShadows: true
    },

    generate(options = {}) {
        const o = {
            ...this.defaults,
            ...options,
            dark: { ...this.defaults.dark, ...options.dark },
            light: { ...this.defaults.light, ...options.light }
        };
        const base = ColorScience.hexToOklch(o.base);
        const H = base.H;
        const C = base.C < NEUTRAL_CHROMA ? 0 : o.tint;
        return {
            hue: round(H, 1),
            chroma: C,
            light: this.mode('light', o, C, H),
            dark: this.mode('dark', o, C, H)
        };
    },

    mode(mode, o, C, H) {
        const dark = mode === 'dark';
        const { start, step, depth } = o[mode];
        const lightness = (i) => {
            if (i === 0) return dark ? start - depth : Math.min(1, start + depth);
            return dark ? start + (i - 1) * step : start - (i - 1) * step;
        };
        const surfaces = Array.from({ length: LEVELS + 1 }, (_, i) => hexAt(lightness(i), C, H));

        const text = dark
            ? { primary: hexAt(0.965, C * 0.6, H), secondary: hexAt(0.8, C, H), muted: hexAt(0.68, C, H), disabled: hexAt(0.52, C, H) }
            : { primary: hexAt(0.21, C * 1.5, H), secondary: hexAt(0.44, C * 1.5, H), muted: hexAt(0.52, C * 1.2, H), disabled: hexAt(0.72, C, H) };

        const [oL, oC] = dark ? [0.96, C] : [0.24, C * 1.5];
        const a = dark
            ? { extraSubtle: 0.035, subtle: 0.06, border: 0.1, strong: 0.16, hover: 0.06, active: 0.1, selected: 0.08 }
            : { extraSubtle: 0.04, subtle: 0.07, border: 0.11, strong: 0.18, hover: 0.045, active: 0.08, selected: 0.06 };

        return {
            surfaces,
            text,
            overlay: { hex: hexAt(oL, oC, H), alpha: a },
            border: {
                extraSubtle: alphaAt(oL, oC, H, a.extraSubtle),
                subtle: alphaAt(oL, oC, H, a.subtle),
                default: alphaAt(oL, oC, H, a.border),
                strong: alphaAt(oL, oC, H, a.strong)
            },
            state: {
                hover: alphaAt(oL, oC, H, a.hover),
                active: alphaAt(oL, oC, H, a.active),
                selected: alphaAt(oL, oC, H, a.selected)
            },
            shadows: this.shadows(dark, C, H, o)
        };
    },

    /** @returns {string[]} one box-shadow per level 1–8. */
    shadows(dark, C, H, o) {
        const tinted = o.tintShadows && C > 0;
        const drops = (n, color) => DROPS.slice(0, n - 1).map(([y, b, s]) => `0 ${y}px ${b}px ${s}px ${color}`);

        if (!dark) {
            const color = tinted ? alphaAt(0.25, C * 2, H, 0.07) : 'rgb(0 0 0 / 0.06)';
            return Array.from({ length: LEVELS }, (_, i) => [`0 0 0 1px ${color}`, ...drops(i + 1, color)].join(', '));
        }

        const drop = tinted ? alphaAt(0.1, C, H, 0.22) : 'rgb(0 0 0 / 0.18)';
        return Array.from({ length: LEVELS }, (_, i) => {
            const n = i + 1;
            const ring = `inset 0 0 0 1px rgb(255 255 255 / ${DARK_RING[i]})`;
            if (n === 1) return ring;
            const layers = [`inset 0 1px 0 0 rgb(255 255 255 / ${DARK_HIGHLIGHT[i]})`, ring];
            if (n >= 3) layers.push(`0 0 0 1px rgb(0 0 0 / ${round(0.12 + (n - 3) * 0.02, 2)})`);
            return [...layers, ...drops(n, drop)].join(', ');
        });
    },

    /** Custom properties for one theme, for painting a scoped preview. */
    vars(theme) {
        const v = {};
        theme.surfaces.forEach((hex, i) => { v[`--surface-${i}`] = hex; });
        theme.shadows.forEach((s, i) => { v[`--shadow-${i + 1}`] = s; });
        for (const [k, hex] of Object.entries(theme.text)) v[`--text-${k}`] = hex;
        v['--border-extra-subtle'] = theme.border.extraSubtle;
        v['--border-subtle'] = theme.border.subtle;
        v['--border'] = theme.border.default;
        v['--border-strong'] = theme.border.strong;
        for (const [k, c] of Object.entries(theme.state)) v[`--${k}`] = c;
        return v;
    },

    /**
     * Export as CSS: fixed --light-* / --dark-* values, theme tokens written
     * once with light-dark(), semantic aliases, and shadows switched per
     * theme attribute.
     */
    toCss(system, attr = 'data-brx-theme') {
        const any = `[${attr}]`;
        const is = (m) => `[${attr}="${m}"]`;
        const colorNames = [
            ...Array.from({ length: LEVELS + 1 }, (_, i) => `surface-${i}`),
            'text-primary', 'text-secondary', 'text-muted', 'text-disabled',
            'border-extra-subtle', 'border-subtle', 'border', 'border-strong',
            'hover', 'active', 'selected'
        ];
        const fixed = (mode) => {
            const v = this.vars(system[mode]);
            return colorNames.map(n => `  --${mode}-${n}: ${v[`--${n}`]};`).join('\n');
        };
        const shadows = (mode) => system[mode].shadows.map((s, i) => `  --shadow-${i + 1}: ${s};`).join('\n');

        return `/* Surface system · hue ${system.hue} · tint ${system.chroma} */

/* Fixed values per theme */
:root {
${fixed('light')}

${fixed('dark')}
}

/* Theme tokens: use these everywhere */
:root,
${any} {
${colorNames.map(n => `  --${n}: light-dark(var(--light-${n}), var(--dark-${n}));`).join('\n')}

  /* Semantic aliases */
  --surface-canvas: var(--surface-0);
  --surface-page: var(--surface-1);
  --surface-card: var(--surface-2);
  --surface-raised: var(--surface-3);
  --surface-popover: var(--surface-4);
  --surface-dialog: var(--surface-5);

  --shadow-card: var(--shadow-2);
  --shadow-raised: var(--shadow-3);
  --shadow-popover: var(--shadow-4);
  --shadow-dialog: var(--shadow-5);
}

/* Theme switch + shadows (light-dark() only takes colors) */
:root,
${is('light')} {
  color-scheme: light;
${shadows('light')}
}

${is('dark')} {
  color-scheme: dark;
${shadows('dark')}
}
`;
    }
};

export default SurfaceSystem;
