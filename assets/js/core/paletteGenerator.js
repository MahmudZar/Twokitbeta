/**
 * PaletteGenerator Module
 *
 * Generates surface / neutral color palettes using the OKLCH color space.
 *
 * OKLCH lightness is perceptually uniform, so evenly-spaced L values
 * produce visually even brightness steps — no hand-tuned curves needed.
 * Hue stays constant across the scale (no warm→cool drift) and chroma
 * is scaled as a percentage of each step's gamut maximum, keeping the
 * tint consistently subtle.
 *
 * @module paletteGenerator
 */

import ColorScience from './colorScience.js';

const PaletteGenerator = {
    /**
     * Lightness bounds for the surface scale.
     * Darkest shade (step 0 / label 1000) to lightest (last step / label 50).
     * L_MIN ≈ 0.19 produces a grey-1000 around #141415 — dark enough for
     * true dark-mode surfaces without descending into unreadable near-black.
     */
    L_MIN: 0.19,
    L_MAX: 0.985,

    /**
     * Generate a perceptually uniform surface color scale.
     *
     * Algorithm:
     *   1. Convert base hex to OKLCH.
     *   2. Compute chromaRatio = baseC / maxChroma(baseL, baseH).
     *   3. Linearly distribute L from L_MIN to L_MAX across `steps` entries.
     *   4. At each step: C = chromaRatio × maxChroma(stepL, baseH), clamped.
     *   5. Hue is constant (= baseH) for the entire scale.
     *
     * @param {string} baseColor  Hex color (#RRGGBB), typically near-white
     * @param {number} [steps=20] Number of shades (default 20)
     * @returns {Array<{hex,oklch,name,isBase,lightness}>}
     */
    generateUniformScale(baseColor, steps = 20) {
        const base = ColorScience.hexToOklch(baseColor);

        const baseMaxC = ColorScience.findMaxChroma(base.L, base.H);
        const chromaRatio = baseMaxC > 0.001 ? base.C / baseMaxC : 0;

        const colors = [];

        for (let i = 0; i < steps; i++) {
            const L = this.L_MIN + i * (this.L_MAX - this.L_MIN) / (steps - 1);

            const maxC = ColorScience.findMaxChroma(L, base.H);
            const C = chromaRatio * maxC;
            const clamped = ColorScience.clampToSrgb(L, C, base.H);

            const hex = ColorScience.oklchToHex(clamped.L, clamped.C, clamped.H);
            const oklch = ColorScience.oklchToString(clamped.L, clamped.C, clamped.H);

            const isBase = Math.abs(L - base.L) < 0.02;

            colors.push({
                hex,
                oklch,
                name: this.generateColorName(i, steps),
                isBase,
                lightness: Math.round(L * 100)
            });
        }

        return colors;
    },

    /**
     * Generate the numeric label for a scale position.
     * Step 0 → 1000 (darkest), last step → 50 (lightest).
     */
    generateColorName(index, total) {
        return Math.round(1000 - (index * 950 / (total - 1)));
    }
};

export default PaletteGenerator;
