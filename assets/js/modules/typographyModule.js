/**
 * TypographyModule
 * 
 * Handles typography UI and interactions
 * Updated for ACSS-style dual type scale system
 * 
 * @module typographyModule
 */

import AppState from '../state/appState.js';
import TypographyCalculator from '../core/typographyCalculator.js';

const TypographyModule = {
    /**
     * Initialize typography module
     */
    init() {
        this.bindEvents();
        this.generateScale();

        AppState.subscribe((section) => {
            if (section === 'typography') {
                this.generateScale();
            }
        });
    },

    /**
     * Bind event listeners for all typography controls
     */
    bindEvents() {
        // Base heading size (mobile)
        const baseHeadingMobile = document.getElementById('baseHeadingMobile');
        if (baseHeadingMobile) {
            baseHeadingMobile.addEventListener('change', (e) => {
                AppState.updateTypography({ baseHeadingMobile: parseInt(e.target.value) });
            });
        }

        // Base heading size (desktop)
        const baseHeadingDesktop = document.getElementById('baseHeadingDesktop');
        if (baseHeadingDesktop) {
            baseHeadingDesktop.addEventListener('change', (e) => {
                AppState.updateTypography({ baseHeadingDesktop: parseInt(e.target.value) });
            });
        }

        // Mobile type scale ratio
        const mobileTypeScaleRatio = document.getElementById('mobileTypeScaleRatio');
        if (mobileTypeScaleRatio) {
            mobileTypeScaleRatio.addEventListener('change', (e) => {
                AppState.updateTypography({ mobileTypeScaleRatio: parseFloat(e.target.value) });
            });
        }

        // Desktop type scale ratio
        const desktopTypeScaleRatio = document.getElementById('desktopTypeScaleRatio');
        if (desktopTypeScaleRatio) {
            desktopTypeScaleRatio.addEventListener('change', (e) => {
                AppState.updateTypography({ desktopTypeScaleRatio: parseFloat(e.target.value) });
            });
        }

        // Min viewport
        const minViewport = document.getElementById('minViewport');
        if (minViewport) {
            minViewport.addEventListener('change', (e) => {
                AppState.updateTypography({ minViewport: parseInt(e.target.value) });
            });
        }

        // Max viewport
        const maxViewport = document.getElementById('maxViewport');
        if (maxViewport) {
            maxViewport.addEventListener('change', (e) => {
                AppState.updateTypography({ maxViewport: parseInt(e.target.value) });
            });
        }

        // Font family
        const fontFamily = document.getElementById('fontFamily');
        if (fontFamily) {
            fontFamily.addEventListener('change', (e) => {
                AppState.updateTypography({ fontFamily: e.target.value });
            });
        }

        // Heading weight
        const headingWeight = document.getElementById('headingWeight');
        if (headingWeight) {
            headingWeight.addEventListener('change', (e) => {
                AppState.updateTypography({ headingWeight: e.target.value });
            });
        }
    },

    /**
     * Generate typography scale
     */
    generateScale() {
        const scale = TypographyCalculator.generateScale(AppState.typography);
        AppState.typography.scale = scale;

        this.renderPreview(scale);
        this.renderScaleTable(scale);
    },

    /**
     * Render typography preview
     */
    renderPreview(scale) {
        const container = document.getElementById('typographyPreview');
        if (!container) return;

        const fontFamily = AppState.typography.fontFamily;
        const headingWeight = AppState.typography.headingWeight;

        let html = '';

        // Headings preview (H1-H6)
        for (const heading of scale.headings) {
            html += `
                <div class="typography-preview-item">
                    <div class="preview-label">${heading.name.toUpperCase()} - ${heading.minSizePx}px / ${heading.maxSizePx}px</div>
                    <div class="preview-text" style="font-size: ${heading.maxSizePx}px; font-family: ${fontFamily}; font-weight: ${headingWeight}; line-height: 1.1;">
                        The quick brown fox jumps
                    </div>
                </div>
            `;
        }

        // Body text preview
        html += `
            <div class="typography-preview-item">
                <div class="preview-label">BODY TEXT</div>
                <div class="preview-text" style="font-size: 16px; font-family: ${fontFamily}; line-height: 1.6;">
                    Typography is the art and technique of arranging type to make written language legible, readable and appealing when displayed.
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    /**
     * Render scale table with all typography sizes
     * Headings have editable min/max inputs
     */
    renderScaleTable(scale) {
        const container = document.getElementById('typographyScale');
        if (!container) return;

        let html = `
            <table class="scale-table">
                <thead>
                    <tr>
                        <th>Variable</th>
                        <th>Min (Mobile)</th>
                        <th>Max (Desktop)</th>
                        <th>Clamp Value</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Separator for Headings
        html += `<tr class="section-header"><td colspan="4">Headings (Fluid) <span class="section-hint">Click to edit values</span></td></tr>`;

        // Headings (H1-H4) with editable inputs
        for (const heading of scale.headings) {
            const isCustom = heading.isCustom ? 'is-custom' : '';
            html += `
                <tr class="heading-row ${isCustom}" data-heading="${heading.name}">
                    <td>
                        <span class="var-name">${heading.variable}</span>
                        ${heading.isCustom ? '<button class="reset-btn" data-heading="' + heading.name + '" title="Reset to calculated value">↺</button>' : ''}
                    </td>
                    <td>
                        <div class="editable-size">
                            <input type="number" 
                                class="size-input heading-min-input" 
                                data-heading="${heading.name}" 
                                data-type="min"
                                value="${Math.round(heading.minSizePx * 10) / 10}" 
                                min="10" 
                                max="200"
                                step="0.5">
                            <span class="unit">px</span>
                        </div>
                    </td>
                    <td>
                        <div class="editable-size">
                            <input type="number" 
                                class="size-input heading-max-input" 
                                data-heading="${heading.name}" 
                                data-type="max"
                                value="${Math.round(heading.maxSizePx * 10) / 10}" 
                                min="10" 
                                max="200"
                                step="0.5">
                            <span class="unit">px</span>
                        </div>
                    </td>
                    <td><span class="clamp-value">${heading.clamp}</span></td>
                </tr>
            `;
        }

        // Separator for Text Sizes
        html += `<tr class="section-header"><td colspan="4">Text Sizes (Fluid)</td></tr>`;

        // Text sizes (xs, s, m, l, xl, xxl) - read only
        for (const text of scale.textSizes) {
            html += `
                <tr>
                    <td><span class="var-name">${text.variable}</span></td>
                    <td>${text.minSizePx}px</td>
                    <td>${text.maxSizePx}px</td>
                    <td><span class="clamp-value">${text.clamp}</span></td>
                </tr>
            `;
        }

        // Separator for Fixed Sizes
        html += `<tr class="section-header"><td colspan="4">Fixed Body Sizes</td></tr>`;

        // Fixed body sizes
        for (const body of scale.body) {
            html += `
                <tr>
                    <td><span class="var-name">${body.variable}</span></td>
                    <td colspan="2">${body.sizePx}px</td>
                    <td><span class="clamp-value">${body.size}</span></td>
                </tr>
            `;
        }

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;
        this.bindScaleTableEvents(container);
    },

    /**
     * Bind events for editable scale table inputs
     */
    bindScaleTableEvents(container) {
        // Handle input changes for heading sizes
        container.querySelectorAll('.size-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const headingName = e.target.dataset.heading;
                const type = e.target.dataset.type; // 'min' or 'max'
                const value = parseFloat(e.target.value);

                if (isNaN(value) || value < 10) return;

                // Get existing overrides
                const overrides = { ...AppState.typography.headingOverrides };

                if (!overrides[headingName]) {
                    overrides[headingName] = {};
                }

                // Set the appropriate override
                if (type === 'min') {
                    overrides[headingName].minSizePx = value;
                } else {
                    overrides[headingName].maxSizePx = value;
                }

                AppState.updateTypography({ headingOverrides: overrides });
            });
        });

        // Handle reset button clicks
        container.querySelectorAll('.reset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const headingName = e.target.closest('[data-heading]')?.dataset.heading;
                if (!headingName) return;
                const overrides = { ...AppState.typography.headingOverrides };
                delete overrides[headingName];
                AppState.updateTypography({ headingOverrides: overrides });
            });
        });
    },

    /**
     * Sync DOM inputs from current AppState (used on project import)
     */
    syncInputsFromState() {
        const t = AppState.typography;
        const set = (id, v) => { const el = document.getElementById(id); if (el != null) el.value = v; };
        set('baseHeadingMobile', t.baseHeadingMobile);
        set('baseHeadingDesktop', t.baseHeadingDesktop);
        set('mobileTypeScaleRatio', t.mobileTypeScaleRatio);
        set('desktopTypeScaleRatio', t.desktopTypeScaleRatio);
        set('minViewport', t.minViewport);
        set('maxViewport', t.maxViewport);
        set('fontFamily', t.fontFamily);
        set('headingWeight', t.headingWeight);
    }
};

export default TypographyModule;
