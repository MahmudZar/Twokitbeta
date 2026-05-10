/**
 * AppState Module
 * 
 * Global state management for TwoKit
 * 
 * @module appState
 */

const AppState = {
    /**
     * Color palettes state
     */
    colors: [
        {
            id: 'primary',
            name: 'primary',
            baseColor: '#2563eb',
            shades: []
        }
    ],

    /**
     * Typography settings
     * ACSS-style dual type scale approach with H4 as base
     */
    typography: {
        // Base heading sizes for H4 (anchor point)
        baseHeadingMobile: 18,
        baseHeadingDesktop: 20,

        // Separate type scale ratios for mobile and desktop
        mobileTypeScaleRatio: 1.2,      // Minor Third
        desktopTypeScaleRatio: 1.333,   // Perfect Fourth

        // Text base sizes
        baseTextMobile: 16,
        baseTextDesktop: 18,

        // Viewport range
        minViewport: 320,
        maxViewport: 1440,

        // Font styling
        fontFamily: 'Inter',
        headingWeight: '500',
        headingLineHeight: 'calc(4px + 2ex)',
        headingLetterSpacing: '-0.03em',

        // Custom heading overrides (min/max sizes per heading)
        // Format: { h1: { minSizePx: 32, maxSizePx: 48 }, ... }
        headingOverrides: {},

        // Generated scale
        scale: null
    },

    /**
     * Spacing settings
     * Supports both fluid (ACSS-like semantic) and fixed (grid-based numeric) spacing
     */
    spacing: {
        // Toggles for which systems to enable/export
        enableFluidSpacing: true,
        enableFixedSpacing: true,

        // Fluid spacing settings (ACSS-like approach)
        fluid: {
            baseSpacingMobile: 16,      // Base value for mobile (in px)
            baseSpacingDesktop: 20,     // Base value for desktop (in px)
            spacingScaleRatio: 1.5,     // Scale multiplier (Perfect Fifth)
            minViewport: 320,
            maxViewport: 1440
        },

        // Fixed spacing settings
        fixed: {
            gridSystem: 2,              // 2, 4, or 8 point grid
            maxValue: 128,              // Default end value
            customSteps: []             // User-added custom steps beyond maxValue
        },

        // Generated scales
        fluidScale: null,
        fixedScale: null
    },

    /**
     * Surface/gray color settings
     */
    surface: {
        baseColor: '#f7f6f5',
        scaleName: 'grey',
        steps: 20,
        scale: null,
        tokens: null
    },

    /**
     * Layout settings
     */
    layout: {
        inlinePaddingMax: 60,
        inlinePaddingMin: 16,
        blockPaddingMax: 90,
        blockPaddingMin: 48,
        contentWidth: 1366,
        gridGap: 'space-24',
        maxColumns: 12,
        generated: null
    },

    /**
     * Listeners for state changes
     */
    listeners: [],

    /**
     * Subscribe to state changes
     */
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    },

    /**
     * Notify all listeners
     */
    notify(section) {
        for (const listener of this.listeners) {
            listener(section, this);
        }
    },

    /**
     * Update color palette
     */
    updateColor(id, updates) {
        const index = this.colors.findIndex(c => c.id === id);
        if (index !== -1) {
            this.colors[index] = { ...this.colors[index], ...updates };
            this.notify('colors');
        }
    },

    /**
     * Add new color palette
     */
    addColor(color) {
        this.colors.push(color);
        this.notify('colors');
    },

    /**
     * Remove color palette
     */
    removeColor(id) {
        if (this.colors.length > 1) {
            this.colors = this.colors.filter(c => c.id !== id);
            this.notify('colors');
        }
    },

    /**
     * Update typography settings
     */
    updateTypography(updates) {
        this.typography = { ...this.typography, ...updates };
        this.notify('typography');
    },

    /**
     * Update spacing settings
     */
    updateSpacing(updates) {
        this.spacing = { ...this.spacing, ...updates };
        this.notify('spacing');
    },

    /**
     * Update surface settings
     */
    updateSurface(updates) {
        this.surface = { ...this.surface, ...updates };
        this.notify('surface');
    },

    /**
     * Update layout settings
     */
    updateLayout(updates) {
        this.layout = { ...this.layout, ...updates };
        this.notify('layout');
    },

    /**
     * Generate unique ID
     */
    generateId() {
        return Math.random().toString(36).substring(2, 8);
    },

    /**
     * Get complete state for export
     */
    getExportState() {
        return {
            colors: this.colors,
            typography: this.typography,
            spacing: this.spacing,
            surface: this.surface,
            layout: this.layout
        };
    }
};

export default AppState;
