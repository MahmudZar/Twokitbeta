/**
 * TypographyCalculator Module
 * 
 * Generate fluid typography scale using CSS clamp()
 * Based on ACSS approach with dual type scale ratios
 * 
 * @module typographyCalculator
 */

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
        mobileTypeScaleRatio: 1.2,      // Minor Third (default for mobile)
        desktopTypeScaleRatio: 1.333,   // Perfect Fourth (default for desktop)

        // Viewport range for fluid calculations
        minViewport: 320,
        maxViewport: 1440,

        // Font styling
        fontFamily: 'Inter',
        headingWeight: '500',
        headingLineHeight: 'calc(4px + 2ex)',
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
     * Text size steps (based on text-m as base)
     * Similar to ACSS: xs, s, m, l, xl, xxl
     */
    textSteps: [
        { name: 'text-xs', step: -2 },
        { name: 'text-s', step: -1 },
        { name: 'text-m', step: 0 },
        { name: 'text-l', step: 1 },
        { name: 'text-xl', step: 2 },
        { name: 'text-xxl', step: 3 }
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
        const settings = { ...this.defaults, ...config };

        const headings = this.generateHeadings(settings);
        const textSizes = this.generateTextSizes(settings);
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
     * Generate fluid heading sizes using dual type scale ratios
     * Formula: size = base * pow(ratio, step)
     * Where H4 is step 0 (base), H3=1, H2=2, H1=3
     * Supports custom overrides for min/max sizes
     */
    generateHeadings(settings) {
        const headings = [];
        const customOverrides = settings.headingOverrides || {};

        for (const heading of this.headingSteps) {
            // Check for custom overrides first
            const override = customOverrides[heading.name] || {};

            // Calculate default sizes using type scale ratios
            let maxSize = settings.baseHeadingDesktop * Math.pow(settings.desktopTypeScaleRatio, heading.step);
            let minSize = settings.baseHeadingMobile * Math.pow(settings.mobileTypeScaleRatio, heading.step);

            // Apply custom overrides if they exist
            if (override.maxSizePx !== undefined && override.maxSizePx !== null) {
                maxSize = override.maxSizePx;
            }
            if (override.minSizePx !== undefined && override.minSizePx !== null) {
                minSize = override.minSizePx;
            }

            // Enforce minimum font sizes for accessibility
            const clampedMinSize = Math.max(minSize, 10);
            const clampedMaxSize = Math.max(maxSize, 12);

            const clampValue = this.calculateClamp(
                clampedMinSize,
                clampedMaxSize,
                settings.minViewport,
                settings.maxViewport
            );

            headings.push({
                name: heading.name,
                variable: `--${heading.name}`,
                minSize: this.pxToRem(clampedMinSize),
                maxSize: this.pxToRem(clampedMaxSize),
                minSizePx: Math.round(clampedMinSize * 100) / 100,
                maxSizePx: Math.round(clampedMaxSize * 100) / 100,
                clamp: clampValue,
                step: heading.step,
                isCustom: !!(override.maxSizePx !== undefined || override.minSizePx !== undefined)
            });
        }

        // Reverse to have h1 first in display
        return headings.reverse();
    },

    /**
     * Generate fluid text sizes (xs, s, m, l, xl, xxl)
     * Uses same dual-ratio approach as headings
     */
    generateTextSizes(settings) {
        const textSizes = [];

        for (const text of this.textSteps) {
            // Calculate desktop size using desktop ratio
            const maxSize = settings.baseTextDesktop * Math.pow(settings.desktopTypeScaleRatio, text.step);

            // Calculate mobile size using mobile ratio
            const minSize = settings.baseTextMobile * Math.pow(settings.mobileTypeScaleRatio, text.step);

            // Enforce minimum font sizes for accessibility
            const clampedMinSize = Math.max(minSize, 10);
            const clampedMaxSize = Math.max(maxSize, 10);

            const clampValue = this.calculateClamp(
                clampedMinSize,
                clampedMaxSize,
                settings.minViewport,
                settings.maxViewport
            );

            textSizes.push({
                name: text.name,
                variable: `--${text.name}`,
                minSize: this.pxToRem(clampedMinSize),
                maxSize: this.pxToRem(clampedMaxSize),
                minSizePx: Math.round(clampedMinSize * 100) / 100,
                maxSizePx: Math.round(clampedMaxSize * 100) / 100,
                clamp: clampValue,
                step: text.step
            });
        }

        return textSizes;
    },

    /**
     * Generate fixed body text sizes (non-fluid, static values)
     */
    generateFixedBodySizes(settings) {
        return this.fixedBodySizes.map(step => ({
            name: step.name,
            variable: `--${step.name}`,
            size: this.pxToRem(step.size),
            sizePx: step.size
        }));
    },

    /**
     * Generate line heights for headings
     */
    generateLineHeights(headings, settings) {
        const lineHeights = [];

        // Heading line heights (fluid)
        for (const heading of headings) {
            // Line height ratio varies by heading level
            // Larger headings have tighter line height
            const minLhRatio = 1.15;
            const maxLhRatio = 1.1;

            const minLh = heading.minSizePx * minLhRatio;
            const maxLh = heading.maxSizePx * maxLhRatio;

            const clampValue = this.calculateClamp(
                minLh,
                maxLh,
                settings.minViewport,
                settings.maxViewport
            );

            lineHeights.push({
                name: `lh-${heading.name}`,
                variable: `--lh-${heading.name}`,
                clamp: clampValue
            });
        }

        // Body line heights (fixed multiplier)
        for (const body of this.fixedBodySizes) {
            const lh = body.size * 1.5;
            lineHeights.push({
                name: `lh-body-${body.size}`,
                variable: `--lh-body-${body.size}`,
                value: this.pxToRem(lh)
            });
        }

        // Dynamic line heights using calc()
        lineHeights.push({
            name: 'heading-line-height',
            variable: '--heading-line-height',
            value: settings.headingLineHeight || 'calc(4px + 2ex)'
        });

        lineHeights.push({
            name: 'text-line-height',
            variable: '--text-line-height',
            value: 'calc(6px + 2ex)'
        });

        return lineHeights;
    },

    /**
     * Calculate CSS clamp() value
     * Formula: clamp(min, preferred, max)
     * Where preferred = yIntercept + slope * viewport
     */
    calculateClamp(minSize, maxSize, minVw, maxVw) {
        // Convert to rem (assuming 16px base)
        const minRem = minSize / 16;
        const maxRem = maxSize / 16;

        // Calculate slope: (maxSize - minSize) / (maxVw - minVw)
        const slope = (maxSize - minSize) / (maxVw - minVw);

        // Calculate y-intercept: minSize - slope * minVw
        const yIntercept = minSize - slope * minVw;

        // Convert y-intercept to rem
        const yInterceptRem = yIntercept / 16;

        // Convert slope to vw units (multiply by 100)
        const slopeVw = slope * 100;

        // Format the preferred value
        // Format: yIntercept(rem) + slope(vw)
        const preferredValue = `${this.formatNumber(yInterceptRem)}rem + ${this.formatNumber(slopeVw)}vw`;

        return `clamp(${this.formatNumber(minRem)}rem, ${preferredValue}, ${this.formatNumber(maxRem)}rem)`;
    },

    /**
     * Format number to reasonable decimal places
     */
    formatNumber(num) {
        return parseFloat(num.toFixed(4));
    },

    /**
     * Convert pixels to rem
     */
    pxToRem(px) {
        return `${(px / 16).toFixed(4)}rem`;
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
