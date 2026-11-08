/**
 * ColorShadeGenerator Module
 *
 * Generates brand color shades (50–950) from one base color, in HSL.
 *
 *   • Hue is held constant at the base color's HSL hue.
 *   • Lightness follows a ladder chosen by how bright the hue is at full
 *     saturation (its relative luminance). Dark hues such as red, blue and
 *     violet pull 400 down and 500 up so the mid-scale doesn't jump; bright
 *     hues such as yellow and lime push 400 lighter. 50–300 barely move and
 *     600–950 sit at fixed distances below 500.
 *   • Saturation peaks at the steps nearest the base color's own lightness
 *     and eases off with distance from it, so a dark input keeps its deep
 *     shades fully saturated and a light input keeps its tints vivid.
 *
 * Edge cases:
 *   • Near-grays: hue brightness fades out below ~25% saturation, so a gray
 *     gets the same ladder whatever hue its rounding noise implies.
 *   • Near-white / near-black: HSL saturation is inflated when a color has
 *     almost no chroma (#FFFAFA reads as 100%), so saturation is capped by
 *     the actual channel spread.
 *   • Very bright hues (pure yellow, lime, cyan): HSL lightness overstates
 *     how dark they get, so 300–500 can look identical. From 400 down each
 *     step is kept at least `minStepGap` OKLCH lightness below the last.
 *   • Shorthand (#abc) and alpha (#rrggbbaa) hex are normalized.
 *
 * Base: of the steps allowed to be base (300, 400, 500, 600), the one whose
 * ladder lightness is closest to the input's HSL lightness is flagged
 * `isBase` (it drives --{name}, the palette alias). Very light or very dark
 * inputs clamp to 300 or 600, so the base is always a usable mid-tone. Its
 * value is not overwritten, which would break the even spacing.
 *
 * @module colorShadeGenerator
 */

import ColorScience from './colorScience.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = t => Math.max(0, Math.min(1, t));

/** Relative luminance of a mid-gray (HSL 50%), used for achromatic colors. */
const NEUTRAL_Y = 0.214;

const ColorShadeGenerator = {
    shadeLabels: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],

    /**
     * HSL lightness (%) per step, keyed by `y`: the relative luminance of the
     * hue at full saturation. Interpolated between, clamped outside.
     */
    ladders: [
        { y: 0.22, l: [97.25, 93.53, 86.8, 77.95, 67.14, 54.51, 44.9, 36.15, 28.35, 23.45, 17.33] },
        { y: 0.77, l: [97.25, 93.53, 86.67, 78.04, 69.22, 53.14, 43.33, 34.71, 26.86, 21.96, 15.69] },
        { y: 0.874, l: [97.25, 93.53, 86.67, 78.04, 72.16, 52.94, 43.33, 34.71, 26.86, 21.76, 15.88] }
    ],

    /**
     * Saturation falloff by lightness distance from the base color:
     * k = max(floor, 1 − slope · max(0, |Δl| − knee)).
     */
    falloff: {
        lighter: { knee: 8, slope: 0.003, floor: 0.88 },
        darker: { knee: 9.5, slope: 0.0029, floor: 0.8 }
    },

    /** Saturation (%) below which hue brightness stops steering the ladder. */
    hueInfluenceSaturation: 25,

    /** Max HSL saturation per unit of channel spread (max − min, 0–1). */
    chromaCap: 500,

    /** Steps that may be flagged as base: mid-tones only. */
    baseSteps: ['300', '400', '500', '600'],

    /** Minimum OKLCH lightness drop between consecutive steps, from 400 on. */
    minStepGap: 0.02,
    gapFromIndex: 4,

    normalizeHex(hex) {
        let h = String(hex).trim().replace('#', '');
        if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map(c => c + c).join('');
        return '#' + h.slice(0, 6).padEnd(6, '0');
    },

    hueLuminance(h) {
        const { r, g, b } = ColorScience.hexToRgb(ColorScience.hslToHex(h, 100, 50));
        const lin = ColorScience.srgbToLinear;
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    },

    ladderFor(h, s) {
        const y = lerp(NEUTRAL_Y, this.hueLuminance(h), clamp01(s / this.hueInfluenceSaturation));
        const p = this.ladders;
        if (y <= p[0].y) return p[0].l;
        if (y >= p[p.length - 1].y) return p[p.length - 1].l;
        const i = p.findIndex(q => q.y >= y) - 1;
        const t = (y - p[i].y) / (p[i + 1].y - p[i].y);
        return p[i].l.map((v, j) => lerp(v, p[i + 1].l[j], t));
    },

    saturationScale(stepL, baseL) {
        const d = stepL - baseL;
        const { knee, slope, floor } = d >= 0 ? this.falloff.lighter : this.falloff.darker;
        return Math.max(floor, 1 - slope * Math.max(0, Math.abs(d) - knee));
    },

    /**
     * @param {string} baseColor  Hex color (#RGB, #RRGGBB or #RRGGBBAA)
     * @param {string} colorName  Token prefix, e.g. "primary"
     * @returns {Array<{name,shade,hex,oklch,lightness,isBase}>}
     */
    generateShades(baseColor, colorName = 'primary') {
        const hex = this.normalizeHex(baseColor);
        const base = ColorScience.hexToHsl(hex);
        const { r, g, b } = ColorScience.hexToRgb(hex);
        const s = Math.min(base.s, (Math.max(r, g, b) - Math.min(r, g, b)) * this.chromaCap);
        const ladder = this.ladderFor(base.h, s);

        let prevOkL = Infinity;
        const shades = this.shadeLabels.map((shade, i) => {
            let L = ladder[i];
            const hslAt = l => ColorScience.hslToHex(base.h, Math.min(100, s * this.saturationScale(l, base.l)), l);
            let out = hslAt(L);
            let ok = ColorScience.hexToOklch(out);

            const maxOkL = prevOkL - this.minStepGap;
            if (i >= this.gapFromIndex && ok.L > maxOkL) {
                let lo = 0, hi = L;
                for (let n = 0; n < 20; n++) {
                    const mid = (lo + hi) / 2;
                    if (ColorScience.hexToOklch(hslAt(mid)).L > maxOkL) hi = mid; else lo = mid;
                }
                L = lo;
                out = hslAt(L);
                ok = ColorScience.hexToOklch(out);
            }
            prevOkL = ok.L;

            return {
                name: `${colorName}-${shade}`,
                shade,
                hex: out,
                oklch: ColorScience.oklchToString(ok.L, ok.C, ok.H),
                lightness: Math.round(L),
                isBase: false
            };
        });

        // Nearest mid-tone step (by ladder lightness) to the input.
        const allowed = this.baseSteps.map((step) => this.shadeLabels.indexOf(step));
        const closest = allowed.reduce((best, i) => (Math.abs(ladder[i] - base.l) < Math.abs(ladder[best] - base.l) ? i : best));
        shades[closest].isBase = true;

        return shades;
    },

    /**
     * Re-flags the base of a saved ramp whose base sits outside baseSteps
     * (ramps saved before the 300–600 rule), using the steps' stored
     * lightness. Colors are untouched. Returns true when it changed.
     */
    fixBase(shades, baseColor) {
        const current = shades.find((s) => s.isBase);
        if (current && this.baseSteps.includes(current.shade)) return false;
        const l = ColorScience.hexToHsl(this.normalizeHex(baseColor)).l;
        const candidates = shades.filter((s) => this.baseSteps.includes(s.shade) && Number.isFinite(s.lightness));
        if (!candidates.length) return false;
        const pick = candidates.reduce((best, s) => (Math.abs(s.lightness - l) < Math.abs(best.lightness - l) ? s : best));
        for (const s of shades) s.isBase = s === pick;
        return true;
    }
};

export default ColorShadeGenerator;
