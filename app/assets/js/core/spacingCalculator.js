/**
 * SpacingCalculator Module
 *
 * Fluid spacing uses Core Framework's dual-ratio clamp algorithm.
 * Fixed spacing stays on 2/4/8pt grids.
 *
 * @module spacingCalculator
 */

import { generateFluidScale, pxToRem, DEFAULT_SPACING_STEPS, DEFAULT_SPACING_BASE } from './fluidScale.js';

const SpacingCalculator = {

    /**
     * Common spacing scale ratios
     */
    ratios: {
        minorSecond: 1.067,
        majorSecond: 1.125,
        minorThird: 1.2,
        majorThird: 1.25,
        perfectFourth: 1.333,
        perfectFifth: 1.5,
        goldenRatio: 1.618
    },

    /**
     * Generate complete spacing scales (both fluid and fixed)
     */
    generateScales(settings) {
        const fluidScale = settings.enableFluidSpacing
            ? this.generateFluidScale(settings.fluid)
            : null;

        const fixedScale = settings.enableFixedSpacing
            ? this.generateFixedScale(settings.fixed)
            : null;

        return {
            fluidScale,
            fixedScale
        };
    },

    /**
     * Generate fluid spacing scale using clamp() (ACSS-like approach)
     * Formula: size = base * pow(ratio, step)
     */
    generateFluidScale(fluidSettings) {
        const {
            baseSpacingMobile,
            baseSpacingDesktop,
            mobileSpacingScaleRatio,
            desktopSpacingScaleRatio,
            spacingScaleRatio,
            minViewport,
            maxViewport,
            steps,
            baseScaleIndex
        } = fluidSettings;
        const mobileRatio = Number(mobileSpacingScaleRatio) || Number(spacingScaleRatio) || 1.25;
        const desktopRatio = Number(desktopSpacingScaleRatio) || Number(spacingScaleRatio) || 1.414;

        return generateFluidScale({
            steps: steps || DEFAULT_SPACING_STEPS,
            baseScaleIndex: Number.isInteger(baseScaleIndex) ? baseScaleIndex : DEFAULT_SPACING_BASE,
            minBase: baseSpacingMobile,
            maxBase: baseSpacingDesktop,
            minRatio: mobileRatio,
            maxRatio: desktopRatio,
            minViewport,
            maxViewport,
            nameOf: (step) => `space-${step}`
        }).map((item) => ({
            ...item,
            variable: `--${item.name}`,
            isFluid: true
        }));
    },

    /**
     * Generate fixed spacing scale based on grid system
     * Dynamically generates steps based on the grid value
     */
    generateFixedScale(fixedSettings) {
        const { gridSystem, maxValue, customSteps } = fixedSettings;

        // Generate base steps for the grid system
        const steps = this.generateGridSteps(gridSystem, maxValue);

        // Add custom steps if any
        const allSteps = [...steps];
        if (customSteps && customSteps.length > 0) {
            for (const customStep of customSteps) {
                // Only add if not already present and valid for grid
                if (!allSteps.includes(customStep) && customStep % gridSystem === 0) {
                    allSteps.push(customStep);
                }
            }
            allSteps.sort((a, b) => a - b);
        }

        return allSteps.map(value => ({
            name: value === 0 ? 'space-none' : `space-${value}`,
            variable: value === 0 ? '--space-none' : `--space-${value}`,
            valuePx: value,
            valueRem: pxToRem(value),
            isFluid: false
        }));
    },

    /**
     * Generate grid steps dynamically based on grid system
     * Uses a smart progression that increases density at smaller values
     */
    generateGridSteps(gridSystem, maxValue) {
        const steps = [0]; // Always start with 0

        // Different progression strategies based on grid system
        if (gridSystem === 2) {
            // 2pt grid: dense at start, less dense later
            // 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 80, 96, 112, 128...
            for (let i = 2; i <= 20; i += 2) {
                if (i <= maxValue) steps.push(i);
            }
            // Switch to 4px increments
            for (let i = 24; i <= 40; i += 4) {
                if (i <= maxValue && !steps.includes(i)) steps.push(i);
            }
            // Switch to 8px increments
            for (let i = 48; i <= 64; i += 8) {
                if (i <= maxValue && !steps.includes(i)) steps.push(i);
            }
            // Switch to 16px increments for larger values
            for (let i = 80; i <= maxValue; i += 16) {
                if (!steps.includes(i)) steps.push(i);
            }
        } else if (gridSystem === 4) {
            // 4pt grid: 0, 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 112, 128...
            for (let i = 4; i <= 32; i += 4) {
                if (i <= maxValue) steps.push(i);
            }
            // Switch to 8px increments
            for (let i = 40; i <= 64; i += 8) {
                if (i <= maxValue && !steps.includes(i)) steps.push(i);
            }
            // Switch to 16px increments for larger values
            for (let i = 80; i <= maxValue; i += 16) {
                if (!steps.includes(i)) steps.push(i);
            }
        } else if (gridSystem === 8) {
            // 8pt grid: 0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128...
            for (let i = 8; i <= 64; i += 8) {
                if (i <= maxValue) steps.push(i);
            }
            // Switch to 16px increments for larger values
            for (let i = 80; i <= maxValue; i += 16) {
                if (!steps.includes(i)) steps.push(i);
            }
        }

        return steps.sort((a, b) => a - b);
    },

    /**
     * Get the next valid step value for a given grid system beyond current max
     */
    getNextValidStep(gridSystem, currentMax) {
        // Find the next value that's a multiple of the grid system
        const remainder = currentMax % gridSystem;
        if (remainder === 0) {
            return currentMax + gridSystem;
        }
        return currentMax + (gridSystem - remainder);
    },

    /**
     * Generate CSS output for both scales
     */
    generateCSS(fluidScale, fixedScale) {
        let css = ':root {\n';

        // Fluid spacing
        if (fluidScale && fluidScale.length > 0) {
            css += '  /* Spacing - Fluid (Semantic) */\n';
            for (const space of fluidScale) {
                css += `  ${space.variable}: ${space.clamp};\n`;
            }
            css += '\n';
        }

        // Fixed spacing
        if (fixedScale && fixedScale.length > 0) {
            css += '  /* Spacing - Fixed (Grid-based) */\n';
            for (const space of fixedScale) {
                css += `  ${space.variable}: ${space.valueRem};\n`;
            }
        }

        css += '}\n';

        return css;
    }
};

export default SpacingCalculator;
