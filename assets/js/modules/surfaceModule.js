/**
 * SurfaceModule
 * 
 * Handles surface/gray color UI and interactions
 * Uses the Surface-Lab algorithm for perceptually uniform grays
 * 
 * @module surfaceModule
 */

import AppState from '../state/appState.js';
import PaletteGenerator from '../core/paletteGenerator.js';
import Notifications from '../ui/notifications.js';

const SurfaceModule = {
    /**
     * Initialize surface module
     */
    init() {
        this.bindEvents();
        this.generateScale();

        AppState.subscribe((section) => {
            if (section === 'surface') {
                this.generateScale();
            }
        });
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Base color picker
        const baseColorPicker = document.getElementById('surfaceBaseColor');
        const baseColorHex = document.getElementById('surfaceBaseHex');

        if (baseColorPicker) {
            baseColorPicker.addEventListener('input', (e) => {
                if (baseColorHex) baseColorHex.value = e.target.value;
                AppState.updateSurface({ baseColor: e.target.value });
            });
        }

        if (baseColorHex) {
            baseColorHex.addEventListener('change', (e) => {
                const value = e.target.value;
                if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                    if (baseColorPicker) baseColorPicker.value = value;
                    AppState.updateSurface({ baseColor: value });
                }
            });
        }

        // Scale name
        const scaleName = document.getElementById('grayScaleName');
        if (scaleName) {
            scaleName.addEventListener('change', (e) => {
                AppState.updateSurface({ scaleName: e.target.value });
            });
        }

        // Number of steps
        const steps = document.getElementById('graySteps');
        if (steps) {
            steps.addEventListener('change', (e) => {
                AppState.updateSurface({ steps: parseInt(e.target.value) });
            });
        }

        // Click to copy
        const grayPreview = document.getElementById('grayScalePreview');
        if (grayPreview) {
            grayPreview.addEventListener('click', (e) => {
                const swatch = e.target.closest('.gray-swatch');
                if (swatch) {
                    const hex = swatch.dataset.hex;
                    if (hex) {
                        navigator.clipboard.writeText(hex);
                        Notifications.success(`Copied ${hex}`);
                    }
                }
            });
        }
    },

    /**
     * Generate gray scale using Surface-Lab algorithm
     */
    generateScale() {
        const { baseColor, steps } = AppState.surface;

        const scale = PaletteGenerator.generateUniformScale(baseColor, steps);
        AppState.surface.scale = scale;

        // Generate surface tokens
        const tokens = this.generateSurfaceTokens(scale);
        AppState.surface.tokens = tokens;

        this.renderScale(scale);
        this.renderTokens(tokens);
    },

    /**
     * Generate surface tokens from gray scale.
     *
     * The scale array is ordered darkest (index 0 = 1000) to lightest
     * (last index = 50).  Tokens reference specific positions so the
     * exported CSS produces correct var(--grey-XXX) links for both
     * Bricks and Figma.
     */
    generateSurfaceTokens(scale) {
        const n = scale.length;
        const last = n - 1;

        // Pick a scale entry by offset from the dark end (0) or light end.
        const dark = (offset) => scale[Math.min(offset, last)].hex;
        const light = (offset) => scale[Math.max(0, last - offset)].hex;

        return {
            light: {
                'surface-main-light': '#ffffff',
                'surface-primary-light': light(0),   // grey-50
                'surface-secondary-light': light(1),  // grey-100
                'surface-elevated-light': light(2),   // grey-150
                'surface-border-primary-light': light(1),  // grey-100
                'surface-border-secondary-light': light(2), // grey-150
                'surface-border-elevated-light': light(3)   // grey-200
            },
            dark: {
                'surface-main-dark': dark(0),          // grey-1000
                'surface-primary-dark': dark(1),       // grey-950
                'surface-secondary-dark': dark(2),     // grey-900
                'surface-elevated-dark': dark(3),      // grey-850
                'surface-border-primary-dark': dark(2), // grey-900
                'surface-border-secondary-dark': dark(3), // grey-850
                'surface-border-elevated-dark': dark(4)   // grey-800
            },
            textLight: {
                'text-primary-light': dark(0),         // grey-1000
                'text-secondary-light': dark(6),       // grey-700
                'text-muted-light': dark(10)           // grey-500
            },
            textDark: {
                'text-primary-dark': light(0),         // grey-50
                'text-secondary-dark': light(5),       // grey-300
                'text-muted-dark': light(8)            // grey-450
            }
        };
    },

    /**
     * Render gray scale preview
     */
    renderScale(scale) {
        const container = document.getElementById('grayScalePreview');
        if (!container) return;

        const scaleName = AppState.surface.scaleName;

        container.innerHTML = scale.map(color => {
            const textColor = color.lightness > 60 ? '#1a1a1a' : '#ffffff';

            return `
                <div class="gray-swatch" 
                     style="background-color: ${color.hex}; color: ${textColor}"
                     data-hex="${color.hex}"
                     title="${scaleName}-${color.name}: ${color.hex}">
                    <span class="swatch-label">${color.name}</span>
                    <span class="swatch-hex">${color.hex}</span>
                </div>
            `;
        }).join('');
    },

    /**
     * Render surface tokens
     */
    renderTokens(tokens) {
        const container = document.getElementById('surfaceTokens');
        if (!container) return;

        const renderGroup = (title, tokenObj) => {
            const items = Object.entries(tokenObj).map(([name, value]) => `
                <div class="token-item">
                    <div class="token-swatch" style="background-color: ${value}"></div>
                    <span class="token-name">--${name}</span>
                </div>
            `).join('');

            return `
                <div class="token-group">
                    <h4 class="token-group-title">${title}</h4>
                    ${items}
                </div>
            `;
        };

        container.innerHTML = `
            ${renderGroup('Surface Light', tokens.light)}
            ${renderGroup('Surface Dark', tokens.dark)}
            ${renderGroup('Text Light', tokens.textLight)}
            ${renderGroup('Text Dark', tokens.textDark)}
        `;
    },

    /**
     * Sync DOM inputs from current AppState (used on project import)
     */
    syncInputsFromState() {
        const s = AppState.surface;
        const set = (id, v) => { const el = document.getElementById(id); if (el != null) el.value = v; };
        set('surfaceBaseColor', s.baseColor);
        set('surfaceBaseHex', s.baseColor);
        set('grayScaleName', s.scaleName);
        set('graySteps', s.steps);
    }
};

export default SurfaceModule;
