/**
 * LayoutModule
 * 
 * Handles layout UI and interactions
 * 
 * @module layoutModule
 */

import AppState from '../state/appState.js';
import LayoutCalculator from '../core/layoutCalculator.js';

const LayoutModule = {
    /**
     * Initialize layout module
     */
    init() {
        this.bindEvents();
        this.generateLayout();

        AppState.subscribe((section) => {
            if (section === 'layout') {
                this.generateLayout();
            }
        });
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Inline padding max
        const inlineMax = document.getElementById('inlinePaddingMax');
        if (inlineMax) {
            inlineMax.addEventListener('change', (e) => {
                AppState.updateLayout({ inlinePaddingMax: parseInt(e.target.value) });
            });
        }

        // Inline padding min
        const inlineMin = document.getElementById('inlinePaddingMin');
        if (inlineMin) {
            inlineMin.addEventListener('change', (e) => {
                AppState.updateLayout({ inlinePaddingMin: parseInt(e.target.value) });
            });
        }

        // Block padding max
        const blockMax = document.getElementById('blockPaddingMax');
        if (blockMax) {
            blockMax.addEventListener('change', (e) => {
                AppState.updateLayout({ blockPaddingMax: parseInt(e.target.value) });
            });
        }

        // Block padding min
        const blockMin = document.getElementById('blockPaddingMin');
        if (blockMin) {
            blockMin.addEventListener('change', (e) => {
                AppState.updateLayout({ blockPaddingMin: parseInt(e.target.value) });
            });
        }

        // Content width
        const contentWidth = document.getElementById('contentWidth');
        if (contentWidth) {
            contentWidth.addEventListener('change', (e) => {
                AppState.updateLayout({ contentWidth: parseInt(e.target.value) });
            });
        }

        // Grid gap
        const gridGap = document.getElementById('gridGap');
        if (gridGap) {
            gridGap.addEventListener('change', (e) => {
                AppState.updateLayout({ gridGap: e.target.value });
            });
        }

        // Max columns
        const maxColumns = document.getElementById('maxColumns');
        if (maxColumns) {
            maxColumns.addEventListener('change', (e) => {
                AppState.updateLayout({ maxColumns: parseInt(e.target.value) });
            });
        }
    },

    /**
     * Generate layout tokens
     */
    generateLayout() {
        const layout = LayoutCalculator.generateLayout(AppState.layout);
        AppState.layout.generated = layout;

        this.renderPreview(layout);
    },

    /**
     * Render layout preview
     */
    renderPreview(layout) {
        const container = document.getElementById('layoutPreview');
        if (!container) return;

        const gridCells = [];
        for (let i = 1; i <= 6; i++) {
            gridCells.push(`<div class="grid-cell">${i}</div>`);
        }

        const inlinePx = layout.sectionPadding.inlinePadding.maxPx;
        const blockPx = Math.min(layout.sectionPadding.blockPadding.maxPx, 80);

        container.innerHTML = `
            <div style="font-size:11px;font-weight:600;color:var(--app-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px;">Section Padding</div>
            <div style="
                background: var(--app-surface-2);
                border: 1px solid var(--app-border);
                padding: ${blockPx}px ${inlinePx}px;
                border-radius: var(--radius-md);
                margin-bottom: 20px;
            ">
                <div style="
                    background: color-mix(in srgb, var(--accent-500) 14%, transparent);
                    border: 1px dashed var(--accent-500);
                    padding: 16px;
                    border-radius: var(--radius-sm);
                    text-align: center;
                    font-size: 12px;
                    color: var(--accent-500);
                    font-family: var(--font-mono);
                ">
                    Content · max-width ${layout.settings.contentWidth}px
                </div>
            </div>

            <div style="font-size:11px;font-weight:600;color:var(--app-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px;">Grid (6 columns)</div>
            <div class="grid-preview" style="grid-template-columns: repeat(6, 1fr);">
                ${gridCells.join('')}
            </div>

            <div style="margin-top:20px;padding:14px;background:var(--app-surface-2);border-radius:var(--radius-md);font-family:var(--font-mono);font-size:11px;color:var(--app-text-secondary);line-height:1.7;">
                <div style="color:var(--accent-500)">--sctn-inline-padding:</div> ${layout.sectionPadding.inlinePadding.value}
                <div style="color:var(--accent-500);margin-top:6px">--sctn-block-padding:</div> ${layout.sectionPadding.blockPadding.value}
                <div style="color:var(--accent-500);margin-top:6px">--content-width:</div> ${layout.contentWidths.find(w => w.name === 'content-width')?.valueRem}
            </div>
        `;
    },

    /**
     * Sync DOM inputs from current AppState (used on project import)
     */
    syncInputsFromState() {
        const s = AppState.layout;
        const set = (id, v) => { const el = document.getElementById(id); if (el != null) el.value = v; };
        set('inlinePaddingMax', s.inlinePaddingMax);
        set('inlinePaddingMin', s.inlinePaddingMin);
        set('blockPaddingMax', s.blockPaddingMax);
        set('blockPaddingMin', s.blockPaddingMin);
        set('contentWidth', s.contentWidth);
        set('gridGap', s.gridGap);
        set('maxColumns', s.maxColumns);
    }
};

export default LayoutModule;
