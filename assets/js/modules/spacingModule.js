/**
 * SpacingModule
 * 
 * Handles spacing UI and interactions for both
 * fluid (ACSS-like) and fixed (grid-based) spacing
 * 
 * @module spacingModule
 */

import AppState from '../state/appState.js';
import SpacingCalculator from '../core/spacingCalculator.js';

const SpacingModule = {
    /**
     * Initialize spacing module
     */
    init() {
        this.bindEvents();
        this.generateScales();

        AppState.subscribe((section) => {
            if (section === 'spacing') {
                this.generateScales();
            }
        });
    },

    /**
     * Bind event listeners for all controls
     */
    bindEvents() {
        // Fluid spacing toggle
        const fluidToggle = document.getElementById('enableFluidSpacing');
        if (fluidToggle) {
            fluidToggle.addEventListener('change', (e) => {
                AppState.updateSpacing({ enableFluidSpacing: e.target.checked });
            });
        }

        // Fixed spacing toggle
        const fixedToggle = document.getElementById('enableFixedSpacing');
        if (fixedToggle) {
            fixedToggle.addEventListener('change', (e) => {
                AppState.updateSpacing({ enableFixedSpacing: e.target.checked });
            });
        }

        // Fluid settings
        this.bindFluidSettings();

        // Fixed settings
        this.bindFixedSettings();
    },

    /**
     * Bind fluid spacing settings
     */
    bindFluidSettings() {
        // Base spacing mobile
        const baseSpacingMobile = document.getElementById('baseSpacingMobile');
        if (baseSpacingMobile) {
            baseSpacingMobile.addEventListener('change', (e) => {
                const fluid = { ...AppState.spacing.fluid, baseSpacingMobile: parseInt(e.target.value) };
                AppState.updateSpacing({ fluid });
            });
        }

        // Base spacing desktop
        const baseSpacingDesktop = document.getElementById('baseSpacingDesktop');
        if (baseSpacingDesktop) {
            baseSpacingDesktop.addEventListener('change', (e) => {
                const fluid = { ...AppState.spacing.fluid, baseSpacingDesktop: parseInt(e.target.value) };
                AppState.updateSpacing({ fluid });
            });
        }

        // Spacing scale ratio
        const spacingScaleRatio = document.getElementById('spacingScaleRatio');
        if (spacingScaleRatio) {
            spacingScaleRatio.addEventListener('change', (e) => {
                const fluid = { ...AppState.spacing.fluid, spacingScaleRatio: parseFloat(e.target.value) };
                AppState.updateSpacing({ fluid });
            });
        }

        // Min viewport
        const spacingMinViewport = document.getElementById('spacingMinViewport');
        if (spacingMinViewport) {
            spacingMinViewport.addEventListener('change', (e) => {
                const fluid = { ...AppState.spacing.fluid, minViewport: parseInt(e.target.value) };
                AppState.updateSpacing({ fluid });
            });
        }

        // Max viewport
        const spacingMaxViewport = document.getElementById('spacingMaxViewport');
        if (spacingMaxViewport) {
            spacingMaxViewport.addEventListener('change', (e) => {
                const fluid = { ...AppState.spacing.fluid, maxViewport: parseInt(e.target.value) };
                AppState.updateSpacing({ fluid });
            });
        }
    },

    /**
     * Bind fixed spacing settings
     */
    bindFixedSettings() {
        // Grid system radio buttons
        const gridRadios = document.querySelectorAll('input[name="gridSystem"]');
        gridRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const fixed = { ...AppState.spacing.fixed, gridSystem: parseInt(e.target.value) };
                AppState.updateSpacing({ fixed });
            });
        });

        // Max value
        const fixedMaxValue = document.getElementById('fixedMaxValue');
        if (fixedMaxValue) {
            fixedMaxValue.addEventListener('change', (e) => {
                const fixed = { ...AppState.spacing.fixed, maxValue: parseInt(e.target.value) };
                AppState.updateSpacing({ fixed });
            });
        }

        // Add step button
        const addStepBtn = document.getElementById('addSpacingStep');
        if (addStepBtn) {
            addStepBtn.addEventListener('click', () => {
                this.addCustomStep();
            });
        }
    },

    /**
     * Add a custom step beyond the current max
     */
    addCustomStep() {
        const { fixed, fixedScale } = AppState.spacing;

        // Find the current maximum value in the scale
        let currentMax = fixed.maxValue;
        if (fixed.customSteps && fixed.customSteps.length > 0) {
            currentMax = Math.max(currentMax, ...fixed.customSteps);
        }

        // Calculate next valid step
        const nextStep = SpacingCalculator.getNextValidStep(fixed.gridSystem, currentMax);

        // Add to custom steps
        const customSteps = [...(fixed.customSteps || []), nextStep];
        const newFixed = { ...fixed, customSteps };

        AppState.updateSpacing({ fixed: newFixed });
    },

    /**
     * Remove a custom step
     */
    removeCustomStep(stepValue) {
        const { fixed } = AppState.spacing;
        const customSteps = (fixed.customSteps || []).filter(s => s !== stepValue);
        const newFixed = { ...fixed, customSteps };
        AppState.updateSpacing({ fixed: newFixed });
    },

    /**
     * Generate both spacing scales
     */
    generateScales() {
        const scales = SpacingCalculator.generateScales(AppState.spacing);

        AppState.spacing.fluidScale = scales.fluidScale;
        AppState.spacing.fixedScale = scales.fixedScale;

        this.renderScaleTable(scales.fluidScale, scales.fixedScale);
        this.renderPreview(scales.fluidScale, scales.fixedScale);
    },

    /**
     * Render the scale table
     */
    renderScaleTable(fluidScale, fixedScale) {
        const container = document.getElementById('spacingScaleTable');
        if (!container) return;

        let html = `
            <table class="scale-table">
                <thead>
                    <tr>
                        <th>Variable</th>
                        <th>Min (Mobile)</th>
                        <th>Max (Desktop)</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Fluid spacing section
        if (fluidScale && fluidScale.length > 0 && AppState.spacing.enableFluidSpacing) {
            html += `<tr class="section-header"><td colspan="4">Fluid Spacing (Semantic)</td></tr>`;

            for (const space of fluidScale) {
                html += `
                    <tr class="fluid-row">
                        <td><span class="var-name">${space.variable}</span></td>
                        <td>${space.minSizePx}px</td>
                        <td>${space.maxSizePx}px</td>
                        <td><span class="clamp-value">${space.clamp}</span></td>
                    </tr>
                `;
            }
        }

        // Fixed spacing section
        if (fixedScale && fixedScale.length > 0 && AppState.spacing.enableFixedSpacing) {
            html += `<tr class="section-header"><td colspan="4">Fixed Spacing (${AppState.spacing.fixed.gridSystem}pt Grid)</td></tr>`;

            const customSteps = AppState.spacing.fixed.customSteps || [];

            for (const space of fixedScale) {
                const isCustom = customSteps.includes(space.valuePx);
                const customClass = isCustom ? 'is-custom' : '';
                const removeBtn = isCustom
                    ? `<button class="remove-step-btn" data-step="${space.valuePx}" title="Remove step">×</button>`
                    : '';

                html += `
                    <tr class="fixed-row ${customClass}">
                        <td>
                            <span class="var-name">${space.variable}</span>
                            ${removeBtn}
                        </td>
                        <td colspan="2">${space.valuePx}px</td>
                        <td><span class="clamp-value">${space.valueRem}</span></td>
                    </tr>
                `;
            }
        }

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;

        // Bind remove button events
        container.querySelectorAll('.remove-step-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const stepValue = parseInt(e.target.dataset.step);
                this.removeCustomStep(stepValue);
            });
        });
    },

    /**
     * Render spacing preview
     */
    renderPreview(fluidScale, fixedScale) {
        const container = document.getElementById('spacingPreview');
        if (!container) return;

        let html = '';
        const maxDisplayValue = 160;

        // Combine and filter scales for preview
        const allSpaces = [];

        if (fluidScale && AppState.spacing.enableFluidSpacing) {
            // Show a few key fluid spaces
            const keyFluid = fluidScale.filter(s =>
                ['space-xs', 'space-s', 'space-m', 'space-l', 'space-xl', 'space-2xl'].includes(s.name)
            );
            for (const space of keyFluid) {
                allSpaces.push({
                    name: space.name,
                    variable: space.variable,
                    displayValue: `${space.minSizePx} → ${space.maxSizePx}px`,
                    barValue: space.maxSizePx,
                    type: 'fluid'
                });
            }
        }

        if (fixedScale && AppState.spacing.enableFixedSpacing) {
            // Show key fixed spaces
            const keyValues = [0, 4, 8, 16, 24, 32, 48, 64, 96, 128];
            const keyFixed = fixedScale.filter(s => keyValues.includes(s.valuePx));
            for (const space of keyFixed) {
                allSpaces.push({
                    name: space.name,
                    variable: space.variable,
                    displayValue: `${space.valuePx}px`,
                    barValue: space.valuePx,
                    type: 'fixed'
                });
            }
        }

        // Group by type for display
        const fluidSpaces = allSpaces.filter(s => s.type === 'fluid');
        const fixedSpaces = allSpaces.filter(s => s.type === 'fixed');

        if (fluidSpaces.length > 0) {
            html += '<div class="preview-section"><div class="preview-section-title">Fluid Spacing</div>';
            for (const space of fluidSpaces) {
                const widthPercent = (space.barValue / maxDisplayValue) * 100;
                html += `
                    <div class="spacing-item">
                        <span class="spacing-name">${space.variable}</span>
                        <div class="spacing-bar fluid-bar" style="width: ${Math.max(widthPercent, 1)}%"></div>
                        <span class="spacing-value">${space.displayValue}</span>
                    </div>
                `;
            }
            html += '</div>';
        }

        if (fixedSpaces.length > 0) {
            html += '<div class="preview-section"><div class="preview-section-title">Fixed Spacing</div>';
            for (const space of fixedSpaces) {
                const widthPercent = (space.barValue / maxDisplayValue) * 100;
                html += `
                    <div class="spacing-item">
                        <span class="spacing-name">${space.variable}</span>
                        <div class="spacing-bar fixed-bar" style="width: ${Math.max(widthPercent, 1)}%"></div>
                        <span class="spacing-value">${space.displayValue}</span>
                    </div>
                `;
            }
            html += '</div>';
        }

        if (html === '') {
            html = '<p class="no-spacing">Enable at least one spacing mode to see preview.</p>';
        }

        container.innerHTML = html;
    },

    /**
     * Sync DOM inputs from current AppState (used on project import)
     */
    syncInputsFromState() {
        const s = AppState.spacing;
        const set = (id, v) => { const el = document.getElementById(id); if (el != null) el.value = v; };
        const check = (id, v) => { const el = document.getElementById(id); if (el != null) el.checked = !!v; };

        check('enableFluidSpacing', s.enableFluidSpacing);
        check('enableFixedSpacing', s.enableFixedSpacing);

        if (s.fluid) {
            set('baseSpacingMobile', s.fluid.baseSpacingMobile);
            set('baseSpacingDesktop', s.fluid.baseSpacingDesktop);
            set('spacingScaleRatio', s.fluid.spacingScaleRatio);
            set('spacingMinViewport', s.fluid.minViewport);
            set('spacingMaxViewport', s.fluid.maxViewport);
        }
        if (s.fixed) {
            set('fixedMaxValue', s.fixed.maxValue);
            const grid = s.fixed.gridSystem;
            document.querySelectorAll('input[name="gridSystem"]').forEach(r => {
                r.checked = parseInt(r.value, 10) === grid;
            });
        }
    }
};

export default SpacingModule;
