/**
 * Global design-system state for TwoKit 2.0.
 * Extends the old toolkit model with state palettes, prefixes, and screen UI.
 */

const AppState = {
    colors: [
        { id: 'primary', name: 'primary', baseColor: '#B0C540', shades: [] }
    ],

    stateColors: [
        { id: 'info', name: 'info', baseColor: '#3B82F6', shades: [], roles: null },
        { id: 'success', name: 'success', baseColor: '#14B8A6', shades: [], roles: null, tailwind: 'teal' },
        { id: 'warning', name: 'warning', baseColor: '#F59E0B', shades: [], roles: null },
        { id: 'error', name: 'error', baseColor: '#FF2056', shades: [], roles: null }
    ],

    colorFormat: 'hex',

    prefixes: {
        color: '',
        type: '',
        spacing: '',
        surface: ''
    },

    /** Font library (state/fontModel.js). Local font files live in IndexedDB. */
    fonts: [{
        id: 'inter',
        family: 'Inter',
        source: 'google',
        category: 'sans-serif',
        display: 'swap',
        faces: ['400', '500', '600', '700'].map((key) => ({ key, weight: Number(key), style: 'normal' }))
    }],

    typography: {
        baseHeadingMobile: 18,
        baseHeadingDesktop: 20,
        mobileTypeScaleRatio: 1.2,
        desktopTypeScaleRatio: 1.333,
        baseTextMobile: 16,
        baseTextDesktop: 18,
        scaleSteps: 'xs,s,m,l,xl,2xl,3xl,4xl',
        baseScaleIndex: 2,
        minViewport: 375,
        maxViewport: 1440,
        // Font roles: a library font id (AppState.fonts) or a system stack key.
        headingFont: 'inter',
        bodyFont: 'inter',
        headingWeight: '500',
        headingLineHeight: 'max(1.05em, calc(0.25rem + 2ex))',
        headingLetterSpacing: '-0.03em',
        headingColor: 'var(--text-primary)',
        textWrap: 'pretty',
        bodyWeight: '400',
        bodyLetterSpacing: '0em',
        bodyLineHeight: 'max(1.35em, calc(0.375rem + 2ex))',
        bodyColor: 'var(--text-secondary)',
        bodyTextWrap: 'pretty',
        bodyFontSize: 'var(--text-16)',
        enableBodySizes: true,
        bodySizes: { 'text-12': 12, 'text-14': 14, 'text-16': 16, 'text-18': 18, 'text-20': 20 },
        // Auto: each heading takes a step of the type scale. Manual: headingOverrides.
        headingMode: 'auto',
        headingSteps: { h1: '3xl', h2: '2xl', h3: 'xl', h4: 'l' },
        headingOverrides: {},
        scale: null
    },

    spacing: {
        enableFluidSpacing: true,
        enableFixedSpacing: true,
        fluid: {
            baseSpacingMobile: 16,
            baseSpacingDesktop: 28,
            mobileSpacingScaleRatio: 1.25,
            desktopSpacingScaleRatio: 1.414,
            steps: '4xs,3xs,2xs,xs,s,m,l,xl,2xl,3xl,4xl',
            baseScaleIndex: 5,
            minViewport: 375,
            maxViewport: 1440
        },
        fixed: {
            gridSystem: 4,
            maxValue: 128,
            customSteps: []
        },
        fluidScale: null,
        fixedScale: null,
        // Auto spacing for rich text (core/autoSpacing.js): em margins, on/off.
        auto: { enabled: true, autoApply: true }
    },

    /** Surface system: hue follows primary when linked, otherwise `base`. */
    surface: {
        tint: 0.012,
        linked: true,
        base: '#B0C540'
    },

    layout: {
        inlinePaddingMax: 60,
        inlinePaddingMin: 16,
        blockPaddingMax: 90,
        blockPaddingMin: 48,
        contentWidth: 1366,
        // px per variant (xs, sm, ...); unset variants scale from contentWidth.
        contentWidthOverrides: {},
        // ACSS contextual spacing: each gap points at a fluid spacing step.
        gaps: { container: 'xl', content: 'm', grid: 'm' },
        // Bricks sticky header offset (layoutCalculator.headerCss). Height in px, set by hand like ACSS.
        header: {
            height: 80,
            offsetContent: true,
            offsetAnchors: true,
            smoothScroll: true,
            anchorSpace: 'm'
        },
        maxColumns: 12,
        // full-bleed-left / -right on phones (767px and below): 'keep' the side, bleed 'both' sides, or 'none'.
        bleedMobile: 'keep',
        generated: null
    },

    /** Additional styling: focus, transition, ::selection (core/stylingCss.js). */
    styling: {
        focus: { style: 'outline', color: 'action', width: 2, offset: 2, field: 'halo', ringWidth: 4, ringStrength: 30 },
        transition: { duration: 200, timing: 'cubic-bezier(0.2, 0, 0, 1)', delay: 0, applyToControls: true, reduceMotion: true },
        radius: { base: 4, scale: 1.5, extraSizes: true, auto: false, autoSelectors: 'img:not(header img, .bricks-site-logo)\nvideo' },
        selection: { enabled: false, bg: 'action', text: 'on-action', bgAlt: 'inverse-text', textAlt: 'inverse-surface' }
    },

    /** Buttons (core/buttonsCss.js). Colors are theme-token names. */
    buttons: {
        shape: { paddingBlock: 0.75, paddingInline: 1.25, radius: 'radius', fontSize: 1, fontSizeS: 0.875, fontSizeL: 1.125, fontWeight: 500, lineHeight: 1.2, letterSpacing: 0, borderWidth: 1, gap: 0.5 },
        // Colors follow the palettes until edited (core/buttonsCss.js); {} = default.
        primary: {},
        secondary: {},
        outline: {},
        ghost: {},
        link: { text: 'action', textHover: 'action-hover', underline: 'currentColor', underlineHover: 'currentColor', style: 'underline', thickness: 1, offset: 0.25 },
        icon: { shape: 'square' },
        states: {},
        brands: {}
    },

    /** Utility class groups that ship (surfaces follow theme.enableClasses). */
    utilities: {
        groups: { buttons: true, text: true, type: true, gap: true, layout: true, radius: true, helpers: true }
    },

    /**
     * Export screen choices. Bricks rows: which parts ship and each one's
     * scope (the Style manager row follows theme.defaultMode). Fonts always
     * ship self-hosted (WOFF2).
     */
    exportPrefs: {
        bricks: {
            rows: [
                { part: 'variables', scope: 'all' },
                { part: 'palette', scope: 'all' },
                { part: 'theme', scope: 'site' },
                { part: 'classes', scope: 'all' },
                { part: 'styleManager', scope: '' },
                { part: 'settings', scope: 'all' }
            ]
        }
    },

    /** Maps to the Bricks style manager and what the theme export includes. */
    theme: {
        defaultMode: 'auto',
        enableInverse: true,
        enableAliases: true,
        enableClasses: true,
        // --site-bg: what fills the page behind sections (a token name or 'css:…').
        siteBg: 'surface-0'
    },

    ui: {
        section: 'colors',
        collapsed: false,
        colorsView: 'brand',
        typeView: 'scale',
        spacingView: 'fluid',
        layoutView: 'content',
        stylingView: 'buttons',
        themeView: 'all',
        surfaceView: 'ladder',
        previewMode: 'visual',
        exampleTheme: 'dark',
        exampleKind: 'website',
        exampleDevice: 'fit',
        exampleWidth: 1440,
        exportTarget: 'bricks',
        exportSummaryOpen: false,
        headingFocus: 'all',
        ratioDevice: 'desktop',
        stateEditTheme: {},
        advancedOpen: true
    },

    listeners: [],

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== callback);
        };
    },

    /**
     * Tells listeners a section changed. 'live' is a change the screen painted
     * itself (a color being picked or typed): no render, but autosave and the
     * hosts' unsaved marker still hear it.
     */
    notify(section) {
        for (const listener of this.listeners) listener(section, this);
    },

    addColor(color) {
        this.colors.push(color);
        this.notify('colors');
    },

    removeColor(id) {
        if (this.colors.length > 1) {
            this.colors = this.colors.filter((c) => c.id !== id);
            this.notify('colors');
        }
    },

    updateTypography(updates) {
        this.typography = { ...this.typography, ...updates };
        this.notify('typography');
    },

    updateSpacing(updates) {
        this.spacing = { ...this.spacing, ...updates };
        this.notify('spacing');
    },

    updateSurface(updates) {
        this.surface = { ...this.surface, ...updates };
        this.notify('surface');
    },

    updateFonts(fonts) {
        this.fonts = fonts;
        this.notify('fonts');
    },

    /** Export screen choices (rows, font delivery), saved with the project. */
    updateExportPrefs(bricks) {
        this.exportPrefs = { ...this.exportPrefs, bricks: { ...this.exportPrefs.bricks, ...bricks } };
        this.notify('export');
    },

    updateLayout(updates) {
        this.layout = { ...this.layout, ...updates };
        this.notify('layout');
    },

    updateStyling(updates) {
        this.styling = { ...this.styling, ...updates };
        this.notify('styling');
    },

    updateButtons(updates) {
        this.buttons = { ...this.buttons, ...updates };
        this.notify('buttons');
    },

    updateUtilities(updates) {
        this.utilities = { ...this.utilities, ...updates };
        this.notify('utilities');
    },

    updateTheme(updates) {
        this.theme = { ...this.theme, ...updates };
        this.notify('theme');
    },

    updateUi(updates) {
        this.ui = { ...this.ui, ...updates };
        this.notify('ui');
    },

    generateId() {
        return Math.random().toString(36).substring(2, 8);
    },

    tokenName(section, name) {
        const clean = String(name).replace(/^--/, '');
        const prefix = (this.prefixes[section] || '').trim();
        return prefix ? `${prefix}-${clean}` : clean;
    },

    getExportState() {
        return {
            colors: this.colors,
            stateColors: this.stateColors,
            prefixes: this.prefixes,
            fonts: this.fonts,
            typography: this.typography,
            spacing: this.spacing,
            surface: this.surface,
            layout: this.layout,
            styling: this.styling,
            buttons: this.buttons,
            utilities: this.utilities,
            theme: this.theme,
            exportPrefs: this.exportPrefs
        };
    }
};

export default AppState;
