/**
 * ExportModule
 * 
 * Handles all export functionality for Bricks Builder and Figma
 * 
 * @module exportModule
 */

import AppState from '../state/appState.js';
import ColorScience from '../core/colorScience.js';
import Notifications from '../ui/notifications.js';

const ExportModule = {
    /**
     * Initialize export module
     */
    init() {
        this.bindEvents();
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Bricks CSS Variables
        document.getElementById('exportBricksVars')?.addEventListener('click', () => {
            this.exportBricksVariables();
        });

        // Bricks Theme Styles
        document.getElementById('exportBricksTheme')?.addEventListener('click', () => {
            this.exportBricksThemeStyles();
        });

        // Figma Variables
        document.getElementById('exportFigmaVars')?.addEventListener('click', () => {
            this.exportFigmaVariables();
        });

        // Figma Text Styles
        document.getElementById('exportFigmaStyles')?.addEventListener('click', () => {
            this.exportFigmaTextStyles();
        });

        // Raw CSS — copy to clipboard
        document.getElementById('exportCSS')?.addEventListener('click', () => {
            this.exportRawCSS({ download: false });
        });

        // Raw CSS — download .css file
        document.getElementById('exportCSSFile')?.addEventListener('click', () => {
            this.exportRawCSS({ download: true });
        });

        // Copy preview
        document.getElementById('copyPreview')?.addEventListener('click', () => {
            this.copyPreview();
        });
    },

    /**
     * Generate unique 6-char ID
     */
    generateId() {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        return Array.from({ length: 6 }, () =>
            chars[Math.floor(Math.random() * chars.length)]
        ).join('');
    },

    /**
     * Export Bricks CSS Variables
     */
    exportBricksVariables() {
        const variables = [];
        const categories = [];
        const categoryMap = {};

        // Helper to add category
        const addCategory = (name) => {
            if (!categoryMap[name]) {
                const id = this.generateId();
                categoryMap[name] = id;
                categories.push({ id, name });
            }
            return categoryMap[name];
        };

        // Base Colors (white, black)
        const baseCatId = addCategory('Base');
        variables.push(
            { id: this.generateId(), name: 'white', value: '#FFFFFF', category: baseCatId },
            { id: this.generateId(), name: 'black', value: '#000000', category: baseCatId }
        );

        // Brand Colors
        let primaryColorName = null;
        let secondaryColorName = null;

        for (let i = 0; i < AppState.colors.length; i++) {
            const color = AppState.colors[i];
            const catId = addCategory(`Brand ${color.name}`);

            // Track primary (first) and secondary (second) colors
            if (i === 0) primaryColorName = color.name;
            if (i === 1) secondaryColorName = color.name;

            for (const shade of color.shades) {
                variables.push({
                    id: this.generateId(),
                    name: shade.name,
                    value: shade.oklch || shade.hex,
                    category: catId
                });
            }
        }

        // Surface/Gray
        if (AppState.surface.scale) {
            const catId = addCategory(`${AppState.surface.scaleName} - Primitive`);
            for (const gray of AppState.surface.scale) {
                variables.push({
                    id: this.generateId(),
                    name: `${AppState.surface.scaleName}-${gray.name}`,
                    value: gray.oklch || gray.hex,
                    category: catId
                });
            }
        }

        // Surface Tokens
        if (AppState.surface.tokens) {
            const getRef = (hex) => {
                const match = this.findScaleNameByHex(hex);
                return match ? `${AppState.surface.scaleName}-${match}` : null;
            };

            const tokenValue = (hex) => {
                const ref = getRef(hex);
                if (ref) return `var(--${ref})`;
                return this.hexToOklchString(hex);
            };

            // Surface light
            const lightCatId = addCategory('Surface light - Token');
            for (const [name, value] of Object.entries(AppState.surface.tokens.light)) {
                variables.push({
                    id: this.generateId(),
                    name,
                    value: tokenValue(value),
                    category: lightCatId
                });
            }

            // Surface dark
            const darkCatId = addCategory('Surface dark - Token');
            for (const [name, value] of Object.entries(AppState.surface.tokens.dark)) {
                variables.push({
                    id: this.generateId(),
                    name,
                    value: tokenValue(value),
                    category: darkCatId
                });
            }

            // Text light
            const textLightCatId = addCategory('Font color light - Token');
            for (const [name, value] of Object.entries(AppState.surface.tokens.textLight)) {
                variables.push({
                    id: this.generateId(),
                    name,
                    value: tokenValue(value),
                    category: textLightCatId
                });
            }

            // Text dark
            const textDarkCatId = addCategory('Font color dark - Token');
            for (const [name, value] of Object.entries(AppState.surface.tokens.textDark)) {
                variables.push({
                    id: this.generateId(),
                    name,
                    value: tokenValue(value),
                    category: textDarkCatId
                });
            }

            // Text Link Colors - linked to brand colors
            // Add text-link-light linked to primary-600
            if (primaryColorName) {
                variables.push({
                    id: this.generateId(),
                    name: 'text-link-light',
                    value: `var(--${primaryColorName}-600)`,
                    category: textLightCatId
                });
            }

            // Add text-link-dark linked to primary-500
            if (primaryColorName) {
                variables.push({
                    id: this.generateId(),
                    name: 'text-link-dark',
                    value: `var(--${primaryColorName}-500)`,
                    category: textDarkCatId
                });
            }

            // Add text-link-secondary if secondary color exists
            if (secondaryColorName) {
                variables.push({
                    id: this.generateId(),
                    name: 'text-link-secondary-light',
                    value: `var(--${secondaryColorName}-600)`,
                    category: textLightCatId
                });
                variables.push({
                    id: this.generateId(),
                    name: 'text-link-secondary-dark',
                    value: `var(--${secondaryColorName}-500)`,
                    category: textDarkCatId
                });
            }
        }

        // Spacing - Fluid
        if (AppState.spacing.enableFluidSpacing && AppState.spacing.fluidScale) {
            const catId = addCategory('Spacing - Fluid');
            for (const space of AppState.spacing.fluidScale) {
                variables.push({
                    id: this.generateId(),
                    name: space.name,
                    value: space.clamp,
                    category: catId
                });
            }
        }

        // Spacing - Fixed
        if (AppState.spacing.enableFixedSpacing && AppState.spacing.fixedScale) {
            const catId = addCategory('Spacing - Fixed');
            for (const space of AppState.spacing.fixedScale) {
                variables.push({
                    id: this.generateId(),
                    name: space.name,
                    value: space.valueRem,
                    category: catId
                });
            }
        }

        // Typography
        if (AppState.typography.scale) {
            const fontSizeCatId = addCategory('Font size');
            for (const heading of AppState.typography.scale.headings) {
                variables.push({
                    id: this.generateId(),
                    name: heading.name,
                    value: heading.clamp,
                    category: fontSizeCatId
                });
            }
            // Text sizes (xs, s, m, l, xl, xxl)
            if (AppState.typography.scale.textSizes) {
                for (const text of AppState.typography.scale.textSizes) {
                    variables.push({
                        id: this.generateId(),
                        name: text.name.replace('--', ''),
                        value: text.clamp,
                        category: fontSizeCatId
                    });
                }
            }
            for (const body of AppState.typography.scale.body) {
                variables.push({
                    id: this.generateId(),
                    name: body.name.replace('--', ''),
                    value: body.size,
                    category: fontSizeCatId
                });
            }

            const lineHeightCatId = addCategory('Font line height');
            for (const lh of AppState.typography.scale.lineHeights) {
                variables.push({
                    id: this.generateId(),
                    name: lh.name,
                    value: lh.clamp || lh.value,
                    category: lineHeightCatId
                });
            }
        }

        // Layout
        if (AppState.layout.generated) {
            const layoutCatId = addCategory('Layout');
            const padding = AppState.layout.generated.sectionPadding;

            variables.push(
                { id: this.generateId(), name: 'sctn-inline-padding', value: padding.inlinePadding.value, category: layoutCatId },
                { id: this.generateId(), name: 'sctn-block-padding', value: padding.blockPadding.value, category: layoutCatId },
                { id: this.generateId(), name: 'site-gutter', value: padding.siteGutter.value, category: layoutCatId }
            );

            for (const width of AppState.layout.generated.contentWidths) {
                variables.push({
                    id: this.generateId(),
                    name: width.name,
                    value: width.valueRem,
                    category: layoutCatId
                });
            }

            const gridCatId = addCategory('Grid');
            variables.push({
                id: this.generateId(),
                name: 'grid-gap',
                value: `var(--${AppState.layout.gridGap})`,
                category: gridCatId
            });

            for (const grid of AppState.layout.generated.gridTemplates) {
                variables.push({
                    id: this.generateId(),
                    name: grid.name,
                    value: grid.value,
                    category: gridCatId
                });
            }

            for (const grid of AppState.layout.generated.asymmetricGrids) {
                variables.push({
                    id: this.generateId(),
                    name: grid.name,
                    value: grid.value,
                    category: gridCatId
                });
            }

            for (const grid of AppState.layout.generated.autoGridTemplates) {
                variables.push({
                    id: this.generateId(),
                    name: grid.name,
                    value: grid.value,
                    category: gridCatId
                });
            }
        }

        const output = { variables, categories };
        this.showPreview(JSON.stringify(output, null, 2));
        this.downloadJSON(output, 'bricks-css-variables.json');
        Notifications.success('Bricks CSS Variables exported!');
    },

    /**
     * Export Bricks Theme Styles
     */
    exportBricksThemeStyles() {
        const typography = AppState.typography;
        const layout = AppState.layout;

        const output = {
            label: "TwoKit Theme Styles",
            settings: {
                _custom: true,
                conditions: {
                    conditions: [{ id: this.generateId(), main: "any" }]
                },
                links: {
                    typography: {
                        color: { raw: "var(--text-link-light)" }
                    }
                },
                typography: {
                    typographyHtml: "100%",
                    typographyBody: {
                        "font-size": "var(--text-16)",
                        color: { raw: "var(--text-secondary-light)" },
                        "font-family": typography.fontFamily
                    },
                    typographyHeadings: {
                        "font-family": typography.fontFamily,
                        "font-weight": typography.headingWeight,
                        "line-height": "var(--heading-line-height)",
                        "letter-spacing": "-0.03em",
                        color: { raw: "var(--text-primary-light)" }
                    },
                    typographyHeadingH1: { "font-size": "var(--h1)" },
                    typographyHeadingH2: { "font-size": "var(--h2)" },
                    typographyHeadingH3: { "font-size": "var(--h3)" },
                    typographyHeadingH4: { "font-size": "var(--h4)" }
                },
                section: {
                    padding: {
                        top: "var(--sctn-block-padding)",
                        bottom: "var(--sctn-block-padding)",
                        left: "var(--sctn-inline-padding)",
                        right: "var(--sctn-inline-padding)"
                    }
                },
                container: {
                    width: "100%",
                    widthMax: "var(--content-width)",
                    _columnGap: "var(--grid-gap)",
                    _rowGap: "var(--grid-gap)"
                },
                div: {
                    _display: "flex",
                    _direction: "column"
                }
            },
            id: "twokit_theme_styles"
        };

        this.showPreview(JSON.stringify(output, null, 2));
        this.downloadJSON(output, 'bricks-theme-style-twokit.json');
        Notifications.success('Bricks Theme Styles exported!');
    },

    /**
     * Export Figma Variables
     */
    exportFigmaVariables() {
        const output = {};

        // Track primary and secondary color names for linking
        let primaryColorName = AppState.colors.length > 0 ? AppState.colors[0].name : null;
        let secondaryColorName = AppState.colors.length > 1 ? AppState.colors[1].name : null;

        // Base colors (white, black)
        output["Base"] = {
            "white": {
                $type: "color",
                $value: {
                    colorSpace: "srgb",
                    components: [1, 1, 1],
                    alpha: 1,
                    hex: "#FFFFFF"
                }
            },
            "black": {
                $type: "color",
                $value: {
                    colorSpace: "srgb",
                    components: [0, 0, 0],
                    alpha: 1,
                    hex: "#000000"
                }
            }
        };

        // Brand colors
        for (const color of AppState.colors) {
            const collectionName = `Brand - ${color.name}`;
            output[collectionName] = {};

            for (const shade of color.shades) {
                const rgb = this.hexToRgbComponents(shade.hex);
                output[collectionName][shade.name.replace(`${color.name}-`, '')] = {
                    $type: "color",
                    $value: {
                        colorSpace: "srgb",
                        components: rgb,
                        alpha: 1,
                        hex: shade.hex.toUpperCase()
                    }
                };
            }
        }

        // Gray/Surface colors - Primitive
        if (AppState.surface.scale) {
            const collectionName = `${AppState.surface.scaleName} - Primitive`;
            output[collectionName] = {};

            for (const gray of AppState.surface.scale) {
                const rgb = this.hexToRgbComponents(gray.hex);
                output[collectionName][`${AppState.surface.scaleName}-${gray.name}`] = {
                    $type: "color",
                    $value: {
                        colorSpace: "srgb",
                        components: rgb,
                        alpha: 1,
                        hex: gray.hex.toUpperCase()
                    }
                };
            }
        }

        // Surface Tokens - with linked variables
        if (AppState.surface.tokens) {
            const surfaceScaleName = AppState.surface.scaleName || 'grey';
            const primitiveRef = `${surfaceScaleName} - Primitive`;

            // Helper to determine value (linked or raw)
            const getFigmaValue = (hex) => {
                const matchName = this.findScaleNameByHex(hex);
                if (matchName) {
                    return `{${primitiveRef}.${surfaceScaleName}-${matchName}}`;
                }
                return this.hexToFigmaColor(hex);
            };

            // Light surfaces
            output["Surface light - Token"] = {};
            for (const [name, value] of Object.entries(AppState.surface.tokens.light)) {
                output["Surface light - Token"][name] = {
                    $type: "color",
                    $value: getFigmaValue(value)
                };
            }

            // Dark surfaces
            output["Surface dark - Token"] = {};
            for (const [name, value] of Object.entries(AppState.surface.tokens.dark)) {
                output["Surface dark - Token"][name] = {
                    $type: "color",
                    $value: getFigmaValue(value)
                };
            }

            // Text colors - Light (with linked text-link colors)
            output["Font color light - Token"] = {};
            for (const [name, value] of Object.entries(AppState.surface.tokens.textLight)) {
                output["Font color light - Token"][name] = {
                    $type: "color",
                    $value: getFigmaValue(value)
                };
            }
            // Add text-link-light linked to primary-600
            if (primaryColorName) {
                output["Font color light - Token"]["text-link-light"] = {
                    $type: "color",
                    $value: `{Brand - ${primaryColorName}.${primaryColorName}-600}`
                };
            }
            // Add text-link-secondary-light if secondary exists
            if (secondaryColorName) {
                output["Font color light - Token"]["text-link-secondary-light"] = {
                    $type: "color",
                    $value: `{Brand - ${secondaryColorName}.${secondaryColorName}-600}`
                };
            }

            // Text colors - Dark (with linked text-link colors)
            output["Font color dark - Token"] = {};
            for (const [name, value] of Object.entries(AppState.surface.tokens.textDark)) {
                output["Font color dark - Token"][name] = {
                    $type: "color",
                    $value: getFigmaValue(value)
                };
            }
            // Add text-link-dark linked to primary-500
            if (primaryColorName) {
                output["Font color dark - Token"]["text-link-dark"] = {
                    $type: "color",
                    $value: `{Brand - ${primaryColorName}.${primaryColorName}-500}`
                };
            }
            // Add text-link-secondary-dark if secondary exists
            if (secondaryColorName) {
                output["Font color dark - Token"]["text-link-secondary-dark"] = {
                    $type: "color",
                    $value: `{Brand - ${secondaryColorName}.${secondaryColorName}-500}`
                };
            }
        }

        // Spacing - Primitive (fixed scale for Figma)
        if (AppState.spacing.enableFixedSpacing && AppState.spacing.fixedScale) {
            output["Spacing - Primitive"] = {};
            for (const space of AppState.spacing.fixedScale) {
                output["Spacing - Primitive"][space.name] = {
                    $type: "number",
                    $value: space.valuePx
                };
            }
        }

        // Spacing - Token (with Desktop/Mobile modes for layout)
        if (AppState.layout.generated) {
            const padding = AppState.layout.generated.sectionPadding;

            output["Spacing - Token"] = {
                "Desktop": {
                    "grid-gap": {
                        $type: "number",
                        $value: "{Spacing - Primitive.space-24}"
                    },
                    "site-gutter": {
                        $type: "number",
                        $value: padding.siteGutter.desktopPx || 60
                    },
                    "section-inline": {
                        $type: "number",
                        $value: padding.inlinePadding.desktopPx || 60
                    },
                    "section-block": {
                        $type: "number",
                        $value: padding.blockPadding.desktopPx || 90
                    }
                },
                "Mobile": {
                    "grid-gap": {
                        $type: "number",
                        $value: "{Spacing - Primitive.space-16}"
                    },
                    "site-gutter": {
                        $type: "number",
                        $value: padding.siteGutter.mobilePx || 16
                    },
                    "section-inline": {
                        $type: "number",
                        $value: padding.inlinePadding.mobilePx || 16
                    },
                    "section-block": {
                        $type: "number",
                        $value: padding.blockPadding.mobilePx || 48
                    }
                }
            };
        }

        this.showPreview(JSON.stringify(output, null, 2));
        this.downloadJSON(output, 'figma-variables.tokens.json');
        Notifications.success('Figma Variables exported!');
    },

    /**
     * Export Figma Text Styles
     */
    exportFigmaTextStyles() {
        const typography = AppState.typography;
        const textStyles = [];

        if (typography.scale) {
            // Desktop headings
            for (const heading of typography.scale.headings) {
                textStyles.push({
                    name: `Desktop headline/${heading.name}`,
                    token: `desktop-headline-${heading.name}`,
                    type: "text",
                    fontFamily: typography.fontFamily,
                    fontWeight: typography.headingWeight,
                    fontSize: `${heading.maxSizePx}px`,
                    lineHeight: `${Math.round(heading.maxSizePx * 1.1)}px`,
                    letterSpacing: "-0.5px"
                });
            }

            // Mobile headings
            for (const heading of typography.scale.headings) {
                textStyles.push({
                    name: `Mobile headline/${heading.name}`,
                    token: `mobile-headline-${heading.name}`,
                    type: "text",
                    fontFamily: typography.fontFamily,
                    fontWeight: typography.headingWeight,
                    fontSize: `${heading.minSizePx}px`,
                    letterSpacing: "-0.5px"
                });
            }

            // Body text
            for (const body of typography.scale.body) {
                textStyles.push({
                    name: `Body text/${body.name.replace('text-', '')}px`,
                    token: `body-${body.name.replace('text-', '')}`,
                    type: "text",
                    fontFamily: typography.fontFamily,
                    fontWeight: "400",
                    fontSize: `${body.sizePx}px`,
                    letterSpacing: "0px"
                });
            }
        }

        const output = {
            styles: {
                colors: [],
                textStyles,
                effectStyles: []
            }
        };

        this.showPreview(JSON.stringify(output, null, 2));
        this.downloadJSON(output, 'figma-text-styles.json');
        Notifications.success('Figma Text Styles exported!');
    },

    /**
     * Export Raw CSS
     * @param {object} [opts]
     * @param {boolean} [opts.download=false] - when true, also download a .css file
     */
    exportRawCSS(opts = {}) {
        const { download = false } = opts;
        let css = ':root {\n';

        // Track primary/secondary color names
        const primaryColorName = AppState.colors.length > 0 ? AppState.colors[0].name : null;
        const secondaryColorName = AppState.colors.length > 1 ? AppState.colors[1].name : null;

        // Base colors
        css += '  /* Base */\n';
        css += '  --white: #FFFFFF;\n';
        css += '  --black: #000000;\n\n';

        // Brand Colors (OKLCH)
        for (const color of AppState.colors) {
            css += `  /* ${color.name} */\n`;
            for (const shade of color.shades) {
                css += `  --${shade.name}: ${shade.oklch || shade.hex};\n`;
            }
            css += '\n';
        }

        // Text Link Colors
        if (primaryColorName) {
            css += '  /* Text Link Colors */\n';
            css += `  --text-link-light: var(--${primaryColorName}-600);\n`;
            css += `  --text-link-dark: var(--${primaryColorName}-500);\n`;
            if (secondaryColorName) {
                css += `  --text-link-secondary-light: var(--${secondaryColorName}-600);\n`;
                css += `  --text-link-secondary-dark: var(--${secondaryColorName}-500);\n`;
            }
            css += '\n';
        }

        // Gray scale (OKLCH)
        if (AppState.surface.scale) {
            css += `  /* ${AppState.surface.scaleName} */\n`;
            for (const gray of AppState.surface.scale) {
                css += `  --${AppState.surface.scaleName}-${gray.name}: ${gray.oklch || gray.hex};\n`;
            }
            css += '\n';
        }

        // Surface Tokens
        if (AppState.surface.tokens) {
            const surfaceScaleName = AppState.surface.scaleName || 'grey';

            const cssTokenValue = (hex) => {
                const match = this.findScaleNameByHex(hex);
                if (match) return `var(--${surfaceScaleName}-${match})`;
                return this.hexToOklchString(hex);
            };

            css += '  /* Surface light - Token */\n';
            for (const [name, value] of Object.entries(AppState.surface.tokens.light)) {
                css += `  --${name}: ${cssTokenValue(value)};\n`;
            }
            css += '\n';

            css += '  /* Surface dark - Token */\n';
            for (const [name, value] of Object.entries(AppState.surface.tokens.dark)) {
                css += `  --${name}: ${cssTokenValue(value)};\n`;
            }
            css += '\n';

            css += '  /* Font color light - Token */\n';
            for (const [name, value] of Object.entries(AppState.surface.tokens.textLight)) {
                css += `  --${name}: ${cssTokenValue(value)};\n`;
            }
            css += '\n';

            css += '  /* Font color dark - Token */\n';
            for (const [name, value] of Object.entries(AppState.surface.tokens.textDark)) {
                css += `  --${name}: ${cssTokenValue(value)};\n`;
            }
            css += '\n';
        }

        // Spacing - Fluid
        if (AppState.spacing.enableFluidSpacing && AppState.spacing.fluidScale) {
            css += '  /* Spacing - Fluid (Semantic) */\n';
            for (const space of AppState.spacing.fluidScale) {
                css += `  ${space.variable}: ${space.clamp};\n`;
            }
            css += '\n';
        }

        // Spacing - Fixed
        if (AppState.spacing.enableFixedSpacing && AppState.spacing.fixedScale) {
            css += '  /* Spacing - Fixed (Grid-based) */\n';
            for (const space of AppState.spacing.fixedScale) {
                css += `  ${space.variable}: ${space.valueRem};\n`;
            }
            css += '\n';
        }

        // Typography
        if (AppState.typography.scale) {
            css += '  /* Typography - Headings */\n';
            for (const heading of AppState.typography.scale.headings) {
                css += `  ${heading.variable}: ${heading.clamp};\n`;
            }
            css += '\n  /* Typography - Text Sizes */\n';
            if (AppState.typography.scale.textSizes) {
                for (const text of AppState.typography.scale.textSizes) {
                    css += `  ${text.variable}: ${text.clamp};\n`;
                }
            }
            css += '\n  /* Typography - Fixed Body Sizes */\n';
            for (const body of AppState.typography.scale.body) {
                css += `  ${body.variable}: ${body.size};\n`;
            }
            css += '\n';
        }

        // Layout
        if (AppState.layout.generated) {
            css += '  /* Layout */\n';
            const padding = AppState.layout.generated.sectionPadding;
            css += `  --sctn-inline-padding: ${padding.inlinePadding.value};\n`;
            css += `  --sctn-block-padding: ${padding.blockPadding.value};\n`;
            css += `  --site-gutter: ${padding.siteGutter.value};\n`;

            for (const width of AppState.layout.generated.contentWidths) {
                css += `  --${width.name}: ${width.valueRem};\n`;
            }
            css += '\n';

            // Grid Variables
            css += '  /* Grid */\n';
            css += `  --grid-gap: var(--${AppState.layout.gridGap});\n`;

            for (const grid of AppState.layout.generated.gridTemplates) {
                css += `  --${grid.name}: ${grid.value};\n`;
            }

            for (const grid of AppState.layout.generated.asymmetricGrids) {
                css += `  --${grid.name}: ${grid.value};\n`;
            }

            for (const grid of AppState.layout.generated.autoGridTemplates) {
                css += `  --${grid.name}: ${grid.value};\n`;
            }
            css += '\n';
        }

        css += '}\n';

        this.showPreview(css);

        if (download) {
            const blob = new Blob([css], { type: 'text/css' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'twokit-design-system.css';
            a.click();
            URL.revokeObjectURL(url);
            Notifications.success('CSS file downloaded');
        } else {
            try {
                navigator.clipboard.writeText(css);
                Notifications.success('CSS copied to clipboard');
            } catch (e) {
                Notifications.info('Preview updated (clipboard unavailable)');
            }
        }
    },

    /**
     * Show preview in code area
     */
    showPreview(content) {
        const preview = document.getElementById('exportCodePreview');
        if (preview) {
            preview.textContent = content;
        }
    },

    /**
     * Copy preview content
     */
    copyPreview() {
        const preview = document.getElementById('exportCodePreview');
        if (preview && preview.textContent) {
            navigator.clipboard.writeText(preview.textContent);
            Notifications.success('Copied to clipboard!');
        }
    },

    /**
     * Download JSON file
     */
    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    /**
     * Convert hex to RGB components (0-1 range)
     */
    hexToRgbComponents(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return [r, g, b];
    },

    /**
     * Convert hex to Figma color object format
     */
    hexToFigmaColor(hex) {
        const rgb = this.hexToRgbComponents(hex);
        return {
            colorSpace: "srgb",
            components: rgb,
            alpha: 1,
            hex: hex.toUpperCase()
        };
    },

    /**
     * Find variable reference name by hex value in surface scale
     */
    findScaleNameByHex(hex) {
        if (!AppState.surface.scale) return null;
        const target = hex.toLowerCase();
        const match = AppState.surface.scale.find(s => s.hex.toLowerCase() === target);
        return match ? match.name : null;
    },

    /**
     * Convert a hex color to an oklch() CSS string
     */
    hexToOklchString(hex) {
        const oklch = ColorScience.hexToOklch(hex);
        return ColorScience.oklchToString(oklch.L, oklch.C, oklch.H);
    }
};

export default ExportModule;
