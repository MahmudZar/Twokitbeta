/**
 * LayoutCalculator Module
 * 
 * Generate layout tokens: section padding, content widths, and grid templates
 * 
 * @module layoutCalculator
 */

const LayoutCalculator = {
    /**
     * Default configuration
     */
    defaults: {
        inlinePaddingMax: 60,
        inlinePaddingMin: 16,
        blockPaddingMax: 90,
        blockPaddingMin: 48,
        contentWidth: 1366,
        gridGap: 'space-24',
        maxColumns: 12,
        minViewport: 320,
        maxViewport: 1440
    },

    /**
     * Content width variations
     */
    contentWidthVariations: [
        { name: 'xs', multiplier: 0.47 },  // ~640px
        { name: 'sm', multiplier: 0.56 },  // ~768px
        { name: 'md', multiplier: 0.75 },  // ~1024px
        { name: '', multiplier: 1.0 },      // default
        { name: 'lg', multiplier: 1.05 },  // ~1434px
        { name: 'xl', multiplier: 1.32 }   // ~1800px
    ],

    /**
     * Generate all layout tokens
     */
    generateLayout(config = {}) {
        const settings = { ...this.defaults, ...config };

        return {
            sectionPadding: this.generateSectionPadding(settings),
            contentWidths: this.generateContentWidths(settings),
            gridTemplates: this.generateGridTemplates(settings),
            autoGridTemplates: this.generateAutoGridTemplates(settings),
            asymmetricGrids: this.generateAsymmetricGrids(),
            settings
        };
    },

    /**
     * Generate fluid section padding
     */
    generateSectionPadding(settings) {
        return {
            inlinePadding: {
                variable: '--sctn-inline-padding',
                value: this.calculateClamp(
                    settings.inlinePaddingMin,
                    settings.inlinePaddingMax,
                    settings.minViewport,
                    settings.maxViewport
                ),
                minPx: settings.inlinePaddingMin,
                maxPx: settings.inlinePaddingMax
            },
            blockPadding: {
                variable: '--sctn-block-padding',
                value: this.calculateClamp(
                    settings.blockPaddingMin,
                    settings.blockPaddingMax,
                    settings.minViewport,
                    settings.maxViewport
                ),
                minPx: settings.blockPaddingMin,
                maxPx: settings.blockPaddingMax
            },
            siteGutter: {
                variable: '--site-gutter',
                value: 'var(--sctn-inline-padding)'
            }
        };
    },

    /**
     * Generate content width variations
     */
    generateContentWidths(settings) {
        const widths = [];

        for (const variation of this.contentWidthVariations) {
            const value = Math.round(settings.contentWidth * variation.multiplier);
            const name = variation.name ? `content-width-${variation.name}` : 'content-width';

            widths.push({
                name,
                variable: `--${name}`,
                valuePx: value,
                valueRem: `${(value / 16).toFixed(4)}rem`
            });
        }

        return widths;
    },

    /**
     * Generate fixed grid templates (grid-1 to grid-12)
     */
    generateGridTemplates(settings) {
        const templates = [];

        for (let i = 1; i <= settings.maxColumns; i++) {
            templates.push({
                name: `grid-${i}`,
                variable: `--grid-${i}`,
                value: `repeat(${i}, minmax(0, 1fr))`,
                columns: i
            });
        }

        return templates;
    },

    /**
     * Generate auto-fit grid templates
     */
    generateAutoGridTemplates(settings) {
        const templates = [];

        for (let i = 2; i <= settings.maxColumns; i++) {
            const formula = `repeat(auto-fit, minmax(min(100%, max(calc((var(--content-width) - ((${i} - 1) * var(--grid-gap))) / ${i}) * 0.7, (100% - (${i} - 1) * var(--grid-gap)) / ${i})), 1fr))`;

            templates.push({
                name: `grid-auto-${i}`,
                variable: `--grid-auto-${i}`,
                value: formula,
                columns: i
            });
        }

        // Add aggressiveness variable
        templates.push({
            name: 'grid-auto-aggressiveness',
            variable: '--grid-auto-aggressiveness',
            value: '0.7'
        });

        return templates;
    },

    /**
     * Generate asymmetric grid templates
     */
    generateAsymmetricGrids() {
        return [
            { name: 'grid-1-2', variable: '--grid-1-2', value: 'minmax(0, 1fr) minmax(0, 2fr)' },
            { name: 'grid-1-3', variable: '--grid-1-3', value: 'minmax(0, 1fr) minmax(0, 3fr)' },
            { name: 'grid-2-1', variable: '--grid-2-1', value: 'minmax(0, 2fr) minmax(0, 1fr)' },
            { name: 'grid-2-3', variable: '--grid-2-3', value: 'minmax(0, 2fr) minmax(0, 3fr)' },
            { name: 'grid-3-1', variable: '--grid-3-1', value: 'minmax(0, 3fr) minmax(0, 1fr)' },
            { name: 'grid-3-2', variable: '--grid-3-2', value: 'minmax(0, 3fr) minmax(0, 2fr)' }
        ];
    },

    /**
     * Calculate CSS clamp() value
     */
    calculateClamp(minPx, maxPx, minVw, maxVw) {
        const minRem = minPx / 16;
        const maxRem = maxPx / 16;

        const slope = (maxPx - minPx) / (maxVw - minVw);
        const yIntercept = minPx - slope * minVw;
        const slopeVw = slope * 100;

        return `clamp(${minRem.toFixed(4)}rem, ${(yIntercept / 16).toFixed(4)}rem + ${slopeVw.toFixed(4)}vw, ${maxRem.toFixed(4)}rem)`;
    },

    /**
     * Generate CSS output
     */
    generateCSS(layout) {
        let css = ':root {\n';

        // Section padding
        css += '  /* Section Padding */\n';
        css += `  ${layout.sectionPadding.inlinePadding.variable}: ${layout.sectionPadding.inlinePadding.value};\n`;
        css += `  ${layout.sectionPadding.blockPadding.variable}: ${layout.sectionPadding.blockPadding.value};\n`;
        css += `  ${layout.sectionPadding.siteGutter.variable}: ${layout.sectionPadding.siteGutter.value};\n`;

        // Content widths
        css += '\n  /* Content Width */\n';
        for (const width of layout.contentWidths) {
            css += `  ${width.variable}: ${width.valueRem};\n`;
        }

        // Grid gap
        css += '\n  /* Grid */\n';
        css += `  --grid-gap: var(--${layout.settings.gridGap});\n`;

        // Fixed grids
        for (const grid of layout.gridTemplates) {
            css += `  ${grid.variable}: ${grid.value};\n`;
        }

        // Asymmetric grids
        css += '\n  /* Asymmetric Grids */\n';
        for (const grid of layout.asymmetricGrids) {
            css += `  ${grid.variable}: ${grid.value};\n`;
        }

        // Auto grids
        css += '\n  /* Auto-fit Grids */\n';
        for (const grid of layout.autoGridTemplates) {
            css += `  ${grid.variable}: ${grid.value};\n`;
        }

        css += '}\n';

        return css;
    }
};

export default LayoutCalculator;
