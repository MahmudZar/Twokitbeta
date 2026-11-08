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
        contentWidthOverrides: {},
        gaps: { container: 'xl', content: 'm', grid: 'm' },
        header: { height: 80, offsetContent: true, offsetAnchors: true, smoothScroll: true, anchorSpace: 'm' },
        // Formats a spacing step as a CSS value; modules pass one with the token prefix.
        spaceVar: (step) => `var(--space-${step})`,
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
            gaps: this.generateGaps(settings),
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

    /** ACSS contextual gaps, in display order. */
    gapTokens: [
        { key: 'container', name: 'container-gap' },
        { key: 'content', name: 'content-gap' },
        { key: 'grid', name: 'grid-gap' }
    ],

    generateGaps(settings) {
        const gaps = { ...this.defaults.gaps, ...settings.gaps };
        return this.gapTokens.map((g) => ({
            key: g.key,
            name: g.name,
            variable: `--${g.name}`,
            step: gaps[g.key],
            value: settings.spaceVar(gaps[g.key])
        }));
    },

    /**
     * Content width variations. Variants follow contentWidth by multiplier
     * unless contentWidthOverrides pins them to a px value.
     */
    generateContentWidths(settings) {
        const overrides = settings.contentWidthOverrides || {};
        return this.contentWidthVariations.map((variation) => {
            const pinned = variation.name ? Number(overrides[variation.name]) : NaN;
            const value = pinned > 0 ? pinned : Math.round(settings.contentWidth * variation.multiplier);
            const name = variation.name ? `content-width-${variation.name}` : 'content-width';
            return {
                key: variation.name,
                name,
                variable: `--${name}`,
                valuePx: value,
                valueRem: `${(value / 16).toFixed(4)}rem`,
                isCustom: pinned > 0
            };
        });
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
        // Smallest bound first: a mobile padding larger than the desktop one must still shrink.
        const minRem = Math.min(minPx, maxPx) / 16;
        const maxRem = Math.max(minPx, maxPx) / 16;

        const slope = (maxPx - minPx) / (maxVw - minVw);
        const yIntercept = minPx - slope * minVw;
        const slopeVw = slope * 100;

        return `clamp(${minRem.toFixed(4)}rem, ${(yIntercept / 16).toFixed(4)}rem + ${slopeVw.toFixed(4)}vw, ${maxRem.toFixed(4)}rem)`;
    },

    /**
     * Header offset for a Bricks *Sticky* header (position: fixed, out of flow).
     * Everything is gated on #brx-header.brx-sticky:not(.on-scroll), so a normal
     * or "Sticky on scroll" (position: sticky, in flow) header gets no offset.
     *
     *   --header-height       set by hand
     *   first section         section padding + header (bg stays behind the header)
     *   anchors / focus       scroll-padding on html, :target breathing room
     *   smooth scroll         only with prefers-reduced-motion: no-preference
     *
     * `html: true` targets plain HTML instead: a .tk-header--fixed header and
     * the first child of <main> (see core/htmlStyles.js).
     */
    headerCss(settings) {
        const h = { ...this.defaults.header, ...settings.header };
        const html = Boolean(settings.html);
        const fixed = html ? ':root:has(.tk-header--fixed)' : ':root:has(#brx-header.brx-sticky:not(.on-scroll))';
        const content = html ? 'main' : '#brx-content';
        const section = html ? '.tk-section' : '.brxe-section';
        const blocks = [
            `/* Header offset: only while the ${html ? 'header has .tk-header--fixed' : 'Bricks header is Sticky'} (position: fixed).
   Opt a page out with the body class .no-header-offset. */
:root {
  --header-height: ${Number(h.height) || 0}px;
}

${fixed} {
  --header-offset: var(--header-height);
}`
        ];
        if (h.offsetContent) {
            blocks.push(`/* First section: its padding + the header, so a hero background still runs behind it.
   Set --section-padding-top on that section to change its own top padding. */
${fixed} body:not(.no-header-offset) ${content} > ${section}:first-child {
  padding-block-start: calc(var(--section-padding-top, var(--sctn-block-padding)) + var(--header-offset));
}

${fixed} body:not(.no-header-offset) ${content} > :first-child:not(${section}) {
  margin-block-start: var(--header-offset);
}`);
        }
        if (h.offsetAnchors) {
            blocks.push(`/* Anchor links, scrollIntoView() and keyboard focus clear the header */
html {
  scroll-padding-block-start: var(--header-offset, 0px);
}

:target {
  scroll-margin-block-start: ${settings.spaceVar(h.anchorSpace || 'm')};
}`);
        }
        if (h.smoothScroll) {
            blocks.push(`@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
}`);
        }
        return blocks.join('\n\n');
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

        // Contextual gaps
        css += '\n  /* Gaps */\n';
        for (const gap of layout.gaps) {
            css += `  ${gap.variable}: ${gap.value};\n`;
        }

        css += '\n  /* Grid */\n';

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
