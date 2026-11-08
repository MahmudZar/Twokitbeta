/**
 * TypographyCalculator Module
 *
 * Fluid type scale using Core Framework's dual-ratio clamp algorithm.
 *
 * @module typographyCalculator
 */

import { calculateClamp, generateFluidScale, pxToRem, DEFAULT_TYPE_STEPS, DEFAULT_TYPE_BASE } from './fluidScale.js';

/**
 * Default line heights. 2ex scales with the font's x-height (what the eye
 * reads as text size), the rem part makes the ratio shrink as text grows
 * (about 1.5 for body, 1.1–1.2 for large headings), and the em floor keeps
 * fonts with a small x-height (Garamond, Georgia) from collapsing. rem
 * follows the user's browser font size. Apply through the variables
 * (line-height: var(--text-line-height)) so each element resolves ex at its
 * own font size; inherited line heights are already computed to px.
 */
export const HEADING_LINE_HEIGHT = 'max(1.05em, calc(0.25rem + 2ex))';
export const TEXT_LINE_HEIGHT = 'max(1.35em, calc(0.375rem + 2ex))';

/** Earlier defaults, upgraded on load when a project still uses them. */
export const LEGACY_LINE_HEIGHTS = { heading: 'calc(4px + 2ex)', text: 'calc(6px + 2ex)' };

/** Defaults of the Heading / Body text settings cards (font family and size are kept on reset). */
export const TYPE_STYLE_DEFAULTS = {
    heading: { headingColor: 'var(--text-primary)', headingLineHeight: HEADING_LINE_HEIGHT, headingLetterSpacing: '-0.03em', headingWeight: '500', textWrap: 'pretty' },
    body: { bodyColor: 'var(--text-secondary)', bodyLineHeight: TEXT_LINE_HEIGHT, bodyLetterSpacing: '0em', bodyWeight: '400', bodyTextWrap: 'pretty' }
};

/** Fixed part (rem) each role starts from when its formula has none to keep. */
const ROLE_LEAD = { heading: 0.25, body: 0.375 };

const trim = (n, d) => String(Number(Number(n).toFixed(d)));

/**
 * The formula TwoKit writes: max(F em, calc(L rem + K ex)). Returns its parts,
 * or null for anything else (a custom formula, a plain number).
 */
export function parseLineHeight(value) {
    const m = /^max\(\s*([\d.]+)em\s*,\s*calc\(\s*([\d.]+)rem\s*\+\s*([\d.]+)ex\s*\)\s*\)$/.exec(String(value || '').trim());
    return m ? { floor: Number(m[1]), lead: Number(m[2]), k: Number(m[3]) } : null;
}

/**
 * Formula that gives line height `ratio` at `refPx` for a font whose x-height
 * there is `exPx`. The rem part (kept from `current`, else the role default)
 * makes larger sizes tighter and smaller ones roomier; the ex part follows
 * the font's x-height; the em floor (just under the ratio) guards fonts with
 * a small x-height.
 */
export function buildLineHeight({ ratio, refPx, exPx, role = 'heading', current }) {
    const r = Math.max(0.5, Number(ratio) || 1);
    let lead = parseLineHeight(current)?.lead ?? ROLE_LEAD[role] ?? 0.25;
    const ex = exPx > 0 ? exPx : refPx * 0.5;
    let k = (r * refPx - lead * 16) / ex;
    if (k < 0.5) { lead = 0; k = (r * refPx) / ex; }
    return `max(${trim(r * 0.92, 2)}em, calc(${trim(lead, 3)}rem + ${trim(k, 3)}ex))`;
}

/** "-0.03em" → -0.03; "0" / "normal" / "" → 0; anything else (px, calc) → null. */
export function parseLetterSpacing(value) {
    const s = String(value ?? '').trim();
    if (!s || s === 'normal' || /^-?0+(\.0+)?(em|px|rem)?$/.test(s)) return 0;
    const m = /^(-?\d*\.?\d+)em$/.exec(s);
    return m ? Number(m[1]) : null;
}

const TypographyCalculator = {
    /**
     * Default configuration
     * Following ACSS approach with dual ratios and H4 as base
     */
    defaults: {
        // Base heading sizes for H4 (anchor point)
        baseHeadingMobile: 18,
        baseHeadingDesktop: 20,

        // Separate type scale ratios for mobile and desktop
        mobileTypeScaleRatio: 1.2,
        desktopTypeScaleRatio: 1.333,

        // Viewport range for fluid calculations
        minViewport: 320,
        maxViewport: 1440,

        // Font styling
        fontFamily: 'Inter',
        headingWeight: '500',
        headingLineHeight: HEADING_LINE_HEIGHT,
        headingLetterSpacing: '-0.03em',

        // Text base sizes
        baseTextMobile: 16,
        baseTextDesktop: 18
    },

    /**
     * Type scale steps for headings
     * H4 is the anchor point (step 0)
     * Larger headings multiply by ratio
     */
    headingSteps: [
        { name: 'h4', step: 0 },   // base (anchor)
        { name: 'h3', step: 1 },   // base * ratio
        { name: 'h2', step: 2 },   // base * ratio^2
        { name: 'h1', step: 3 }    // base * ratio^3
    ],

    /**
     * Fixed body text sizes (for static sizes like labels)
     */
    fixedBodySizes: [
        { name: 'text-12', size: 12 },
        { name: 'text-14', size: 14 },
        { name: 'text-16', size: 16 },
        { name: 'text-18', size: 18 },
        { name: 'text-20', size: 20 }
    ],

    /**
     * Generate complete typography scale
     */
    generateScale(config = {}) {
        // config is AppState.typography, which holds the previous scale: leave it out, or
        // every regeneration nests one level deeper (scale.settings.scale.settings…) and the
        // saved project grows until WordPress refuses it (PHP json_decode depth 64).
        const { scale: _previous, ...rest } = config;
        const settings = { ...this.defaults, ...rest };

        const textSizes = this.generateTextSizes(settings);
        const headings = this.generateHeadings(settings, textSizes);
        const body = this.generateFixedBodySizes(settings);
        const lineHeights = this.generateLineHeights(headings, settings);

        return {
            headings,
            textSizes,
            body,
            lineHeights,
            settings
        };
    },

    /**
     * Default type-scale step per heading (auto mode). If a step was removed
     * from the scale, the heading falls back to base + offset.
     */
    defaultHeadingSteps: { h1: '3xl', h2: '2xl', h3: 'xl', h4: 'l' },
    headingOffsets: { h1: 4, h2: 3, h3: 2, h4: 1 },

    /** Scale step a heading uses in auto mode, resolved against the current scale. */
    resolveHeadingStep(name, textSizes, settings) {
        const wanted = (settings.headingSteps || {})[name] || this.defaultHeadingSteps[name];
        const hit = textSizes.find((t) => t.step === wanted);
        if (hit) return hit;
        const base = Number.isInteger(settings.baseScaleIndex) ? settings.baseScaleIndex : DEFAULT_TYPE_BASE;
        return textSizes[Math.min(textSizes.length - 1, base + this.headingOffsets[name])];
    },

    /**
     * Heading sizes. Auto: each heading copies a step of the fluid type scale.
     * Manual: headingOverrides hold explicit min/max px (missing values fall
     * back to the auto size).
     */
    generateHeadings(settings, textSizes = this.generateTextSizes(settings)) {
        const manual = settings.headingMode === 'manual';
        const overrides = manual ? settings.headingOverrides || {} : {};

        const headings = this.headingSteps.map((heading) => {
            const source = this.resolveHeadingStep(heading.name, textSizes, settings);
            const override = overrides[heading.name] || {};
            const maxSize = Math.max(Number(override.maxSizePx ?? source.maxSizePx), 12);
            const minSize = Math.max(Number(override.minSizePx ?? source.minSizePx), 10);
            return {
                name: heading.name,
                variable: `--${heading.name}`,
                minSize: pxToRem(minSize),
                maxSize: pxToRem(maxSize),
                minSizePx: Math.round(minSize * 100) / 100,
                maxSizePx: Math.round(maxSize * 100) / 100,
                clamp: calculateClamp(minSize, maxSize, settings.minViewport, settings.maxViewport),
                step: heading.step,
                scaleStep: source.step,
                // Differs from its scale step (manual values seeded from auto don't count).
                isCustom: Math.abs(maxSize - source.maxSizePx) > 0.005 || Math.abs(minSize - source.minSizePx) > 0.005
            };
        });

        // h1 first in display
        return headings.reverse();
    },

    /**
     * Generate fluid text sizes (xs, s, m, l, xl, xxl)
     * Uses same dual-ratio approach as headings
     */
    generateTextSizes(settings) {
        return generateFluidScale({
            steps: settings.scaleSteps || DEFAULT_TYPE_STEPS,
            baseScaleIndex: Number.isInteger(settings.baseScaleIndex) ? settings.baseScaleIndex : DEFAULT_TYPE_BASE,
            minBase: settings.baseTextMobile,
            maxBase: settings.baseTextDesktop,
            minRatio: settings.mobileTypeScaleRatio,
            maxRatio: settings.desktopTypeScaleRatio,
            minViewport: settings.minViewport,
            maxViewport: settings.maxViewport,
            nameOf: (step) => `text-${step}`
        }).map((item) => ({
            ...item,
            variable: `--${item.name}`,
            minSize: item.minSizeRem,
            maxSize: item.maxSizeRem
        }));
    },

    /**
     * Generate fixed body text sizes (non-fluid, static values)
     */
    generateFixedBodySizes(settings) {
        const custom = settings.bodySizes || {};
        return this.fixedBodySizes.map(step => {
            const px = Number(custom[step.name]) > 0 ? Number(custom[step.name]) : step.size;
            return {
                name: step.name,
                variable: `--${step.name}`,
                size: pxToRem(px),
                sizePx: px
            };
        });
    },

    /**
     * The two line-height tokens. Per-size tokens (--lh-h1, --lh-body-16) are
     * gone: these are ex-based, so one value per role resolves at each
     * element's own font size (headings tight, text roomy).
     */
    generateLineHeights(headings, settings) {
        return [
            { name: 'heading-line-height', variable: '--heading-line-height', value: settings.headingLineHeight || HEADING_LINE_HEIGHT },
            { name: 'text-line-height', variable: '--text-line-height', value: settings.bodyLineHeight || TEXT_LINE_HEIGHT }
        ];
    },

    /**
     * Generate CSS output
     */
    generateCSS(scale) {
        let css = ':root {\n';
        css += '  /* Typography - Headings (Fluid) */\n';

        for (const heading of scale.headings) {
            css += `  ${heading.variable}: ${heading.clamp};\n`;
        }

        css += '\n  /* Typography - Text Sizes (Fluid) */\n';
        for (const text of scale.textSizes) {
            css += `  ${text.variable}: ${text.clamp};\n`;
        }

        css += '\n  /* Typography - Fixed Body Sizes */\n';
        for (const body of scale.body) {
            css += `  ${body.variable}: ${body.size};\n`;
        }

        css += '\n  /* Line Heights */\n';
        for (const lh of scale.lineHeights) {
            const value = lh.clamp || lh.value;
            css += `  ${lh.variable}: ${value};\n`;
        }

        css += '}\n';

        return css;
    }
};

export default TypographyCalculator;
