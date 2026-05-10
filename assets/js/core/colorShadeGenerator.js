/**
 * ColorShadeGenerator Module
 *
 * Generates brand color shades (50–950) following the oklch-skill
 * palette generation algorithm and Tailwind v4 conventions.
 *
 * Core principles (from the skill):
 *   • Same lightness scale for every hue → consistent perceived brightness
 *   • Same chroma PERCENTAGE (not absolute) → equal vividness across hues
 *   • Constant hue across all steps → no perceptual drift
 *   • Gamut-clamped chroma per step → every colour is displayable in sRGB
 *
 * The lightness values are taken from the oklch-skill's Tailwind v4
 * reference (@theme example in gamut-and-tailwind.md).  Using a fixed,
 * proven scale guarantees that every palette — regardless of input hue —
 * has identical gap progression and harmonious spacing.
 *
 * @module colorShadeGenerator
 */

import ColorScience from './colorScience.js';

const ColorShadeGenerator = {
    shadeLabels: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],

    /**
     * Fixed lightness scale from the oklch-skill Tailwind v4 reference.
     *
     * Gaps: 3.9, 5.0, 7.0, 9.0, 9.9, 8.8, 9.0, 8.3, 7.3, 7.4
     * Bell-shaped distribution — gentle at the extremes, largest steps
     * in the mid-range — which matches how design systems are used:
     * fine pastel distinctions at the top, fine dark distinctions at
     * the bottom, bold jumps in the middle.
     */
    shadeLightness: [
        0.971,  // 50
        0.932,  // 100
        0.882,  // 200
        0.812,  // 300
        0.722,  // 400
        0.623,  // 500
        0.535,  // 600
        0.445,  // 700
        0.362,  // 800
        0.289,  // 900
        0.215   // 950
    ],

    /**
     * Generate a complete 50–950 shade palette from a base hex color.
     *
     * Algorithm (per oklch-skill palette-generation.md):
     *   1. Convert base to OKLCH → extract hue (H) and chroma percentage.
     *   2. Use the fixed lightness scale for all 11 steps.
     *   3. At each step, compute maxChroma for that L and H, then set
     *      C = chromaPct × maxChroma.  Clamp to sRGB gamut.
     *   4. Pin the exact base colour at the closest matching shade.
     *
     * @param {string} baseColor  Hex color (#RRGGBB)
     * @param {string} colorName  Token prefix, e.g. "primary"
     * @returns {Array<{name,shade,hex,oklch,lightness,isBase}>}
     */
    generateShades(baseColor, colorName = 'primary') {
        const base = ColorScience.hexToOklch(baseColor);

        const baseMaxC = ColorScience.findMaxChroma(base.L, base.H);
        const chromaPct = baseMaxC > 0.001 ? base.C / baseMaxC : 0;

        const steps = this.shadeLabels.length;
        const shades = [];

        let closestIdx = 0;
        let closestDist = Infinity;

        for (let i = 0; i < steps; i++) {
            const L = this.shadeLightness[i];

            const dist = Math.abs(L - base.L);
            if (dist < closestDist) {
                closestDist = dist;
                closestIdx = i;
            }

            const maxC = ColorScience.findMaxChroma(L, base.H);
            const C = chromaPct * maxC;
            const clamped = ColorScience.clampToSrgb(L, C, base.H);

            shades.push({
                name: `${colorName}-${this.shadeLabels[i]}`,
                shade: this.shadeLabels[i],
                hex: ColorScience.oklchToHex(clamped.L, clamped.C, clamped.H),
                oklch: ColorScience.oklchToString(clamped.L, clamped.C, clamped.H),
                lightness: Math.round(L * 100),
                isBase: false
            });
        }

        shades[closestIdx].isBase = true;
        shades[closestIdx].hex = baseColor;
        shades[closestIdx].oklch = ColorScience.oklchToString(base.L, base.C, base.H);

        return shades;
    }
};

export default ColorShadeGenerator;
