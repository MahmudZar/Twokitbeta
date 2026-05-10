/**
 * ColorModule
 * 
 * Handles color palette UI and interactions
 * 
 * @module colorModule
 */

import AppState from '../state/appState.js';
import ColorShadeGenerator from '../core/colorShadeGenerator.js';
import Notifications from '../ui/notifications.js';

const ColorModule = {
    pendingColorUpdate: null,
    
    /**
     * Initialize color module
     */
    init() {
        this.bindEvents();
        this.generateInitialPalette();

        // Subscribe to state changes
        AppState.subscribe((section) => {
            if (section === 'colors') {
                this.render();
            }
        });
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Add color button
        const addBtn = document.getElementById('addColorBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addColorPalette());
        }

        // Delegate events for color inputs
        const container = document.getElementById('colorPalettes');
        if (container) {
            container.addEventListener('input', (e) => this.handleInput(e));
            container.addEventListener('change', (e) => this.handleChange(e));
            container.addEventListener('click', (e) => this.handleClick(e));
        }
    },

    /**
     * Handle input events (real-time)
     */
    handleInput(e) {
        const target = e.target;
        const palette = target.closest('.color-palette');
        if (!palette) return;

        const paletteId = palette.dataset.palette;

        if (target.classList.contains('color-picker')) {
            const hexInput = palette.querySelector('.color-hex-input');
            if (hexInput) hexInput.value = target.value;
            const mini = palette.querySelector('.palette-swatch-mini');
            if (mini) mini.style.background = target.value;

            // Defer state update until color picker closes
            this.pendingColorUpdate = { paletteId, color: target.value };
        }

        if (target.classList.contains('color-hex-input')) {
            const value = target.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                const colorPicker = palette.querySelector('.color-picker');
                if (colorPicker) colorPicker.value = value;
                const mini = palette.querySelector('.palette-swatch-mini');
                if (mini) mini.style.background = value;
                // Silent update to preserve input focus; shades re-render without list rebuild
                this.regenerateShades(paletteId, value);
            }
        }

        if (target.classList.contains('palette-name-input')) {
            // Update state silently to avoid re-rendering (which would steal focus)
            const idx = AppState.colors.findIndex(c => c.id === paletteId);
            if (idx !== -1) AppState.colors[idx].name = target.value;
        }
    },

    /**
     * Handle change events
     */
    handleChange(e) {
        const target = e.target;
        const palette = target.closest('.color-palette');
        if (!palette) return;

        const paletteId = palette.dataset.palette;

        if (target.classList.contains('color-picker')) {
            // When color picker is closed, NOW we can safely update shades
            if (this.pendingColorUpdate && this.pendingColorUpdate.paletteId === paletteId) {
                AppState.updateColor(paletteId, { baseColor: this.pendingColorUpdate.color });
                this.regenerateShades(paletteId, this.pendingColorUpdate.color);
                this.pendingColorUpdate = null;
            }
        }

        if (target.classList.contains('palette-name-input')) {
            // On commit (blur/enter) persist + regenerate shades with renamed palette
            const color = AppState.colors.find(c => c.id === paletteId);
            if (color) {
                AppState.updateColor(paletteId, { name: target.value });
                this.regenerateShades(paletteId, color.baseColor);
            }
        }

        if (target.classList.contains('color-hex-input')) {
            const value = target.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                AppState.updateColor(paletteId, { baseColor: value });
                this.regenerateShades(paletteId, value);
            }
        }
    },

    /**
     * Handle click events
     */
    handleClick(e) {
        const removeBtn = e.target.closest('.remove-btn');
        if (removeBtn) {
            const palette = removeBtn.closest('.color-palette');
            if (palette) this.removeColorPalette(palette.dataset.palette);
            return;
        }

        const shade = e.target.closest('.shade-color');
        if (shade) {
            const hex = shade.dataset.hex;
            if (hex) {
                navigator.clipboard.writeText(hex);
                Notifications.success(`Copied ${hex}`);
            }
        }
    },

    /**
     * Generate initial palette on load
     */
    generateInitialPalette() {
        const primaryColor = AppState.colors[0];
        if (primaryColor) {
            this.regenerateShades(primaryColor.id, primaryColor.baseColor);
        }
    },

    /**
     * Regenerate shades for a palette.
     * Updates state silently (no broadcast) to avoid stealing input focus,
     * then re-renders just the shades grid.
     */
    regenerateShades(paletteId, baseColor) {
        const colorData = AppState.colors.find(c => c.id === paletteId);
        if (!colorData) return;

        const shades = ColorShadeGenerator.generateShades(baseColor, colorData.name);
        colorData.shades = shades;
        colorData.baseColor = baseColor;
        this.renderShades(paletteId, shades);
    },

    /**
     * Render shades for a specific palette
     */
    renderShades(paletteId, shades) {
        const container = document.getElementById(`${paletteId}-shades`);
        if (!container) return;

        container.innerHTML = shades.map(shade => `
            <div class="shade-item">
                <div class="shade-color" style="background-color: ${shade.hex}" data-hex="${shade.hex}" title="Click to copy"></div>
                <span class="shade-label">${shade.shade}</span>
                <span class="shade-hex">${shade.hex}</span>
            </div>
        `).join('');
    },

    /**
     * Add new color palette
     */
    addColorPalette() {
        const id = AppState.generateId();
        const colors = ['secondary', 'tertiary', 'accent', 'custom'];
        const usedNames = AppState.colors.map(c => c.name);
        let name = colors.find(c => !usedNames.includes(c)) || `color-${id}`;

        const newColor = {
            id,
            name,
            baseColor: '#10b981',
            shades: []
        };

        AppState.addColor(newColor);
        this.regenerateShades(id, newColor.baseColor);
        Notifications.success(`Added ${name} palette`);
    },

    /**
     * Remove color palette
     */
    removeColorPalette(id) {
        if (AppState.colors.length <= 1) {
            Notifications.error('Cannot remove the last palette');
            return;
        }

        const color = AppState.colors.find(c => c.id === id);
        if (color) {
            AppState.removeColor(id);
            Notifications.success(`Removed ${color.name} palette`);
        }
    },

    /**
     * Render all color palettes
     */
    render() {
        const container = document.getElementById('colorPalettes');
        if (!container) return;

        container.innerHTML = AppState.colors.map((color, index) => `
            <div class="color-palette" data-palette="${color.id}">
                <div class="palette-header">
                    <div class="palette-info">
                        <div class="palette-swatch-mini" style="background:${color.baseColor}"></div>
                        <input type="text" class="palette-name-input" value="${color.name}" data-field="name" spellcheck="false">
                        ${index === 0 ? '<span class="palette-badge">Primary</span>' : ''}
                    </div>
                    <div class="palette-controls">
                        <div class="color-input-group">
                            <input type="color" class="color-picker" value="${color.baseColor}" data-field="color">
                            <input type="text" class="color-hex-input" value="${color.baseColor}" data-field="hex" spellcheck="false">
                        </div>
                        ${index > 0 ? `
                            <button class="btn btn-ghost btn-icon btn-icon-sm remove-btn" title="Remove palette" aria-label="Remove palette">
                                <svg class="icon icon-sm"><use href="#i-trash"/></svg>
                            </button>` : ''}
                    </div>
                </div>
                <div class="palette-shades" id="${color.id}-shades"></div>
            </div>
        `).join('');

        // Re-render shades for all
        for (const color of AppState.colors) {
            if (color.shades.length > 0) {
                this.renderShades(color.id, color.shades);
            } else {
                this.regenerateShades(color.id, color.baseColor);
            }
        }
    }
};

export default ColorModule;
