/**
 * TwoKit Main Entry Point
 *
 * Application initialization and setup.
 *
 * @module main
 * @version 1.1.0
 */

import Theme          from './ui/theme.js';
import Tabs           from './ui/tabs.js';
import Notifications  from './ui/notifications.js';
import ColorModule    from './modules/colorModule.js';
import TypographyModule from './modules/typographyModule.js';
import SpacingModule  from './modules/spacingModule.js';
import SurfaceModule  from './modules/surfaceModule.js';
import LayoutModule   from './modules/layoutModule.js';
import ExportModule   from './modules/exportModule.js';
import ProjectModule  from './modules/projectModule.js';

function initApp() {
    console.log('%cTwoKit v1.1.0', 'color:#5FEA6D;font-weight:bold;', '— Design System Generator');

    try {
        // UI shell
        Theme.init();
        Notifications.init();
        Tabs.init();
        initTopbarTitleSync();

        // Restore project meta/state before modules so module init reads restored values
        ProjectModule.loadMeta();
        ProjectModule.restoreAutosave();

        // Design system modules
        ColorModule.init();
        TypographyModule.init();
        SpacingModule.init();
        SurfaceModule.init();
        LayoutModule.init();

        // Output & project (bind UI + autosave subscription)
        ExportModule.init();
        ProjectModule.bindUI();
        ProjectModule.subscribeAutosave();
        ProjectModule.renderSummary();
        ProjectModule.syncMetaInputs();

        // Sync inputs after initial module render (so defaults from autosave show correctly)
        TypographyModule.syncInputsFromState?.();
        SpacingModule.syncInputsFromState?.();
        SurfaceModule.syncInputsFromState?.();
        LayoutModule.syncInputsFromState?.();

        console.log('%c✓ All modules initialized', 'color:#22c55e;');

        setTimeout(() => {
            Notifications.success('TwoKit is ready');
        }, 400);

    } catch (error) {
        console.error('Failed to initialize application:', error);
        showFatalError(error?.message || 'Failed to initialize application.');
    }
}

/**
 * Keep topbar title in sync with active tab
 */
function initTopbarTitleSync() {
    const titleEl = document.getElementById('topbarTitle');
    if (!titleEl) return;

    const labels = {
        color: 'Colors',
        typography: 'Typography',
        spacing: 'Spacing',
        surface: 'Surface',
        layout: 'Layout',
        export: 'Export',
        project: 'Project'
    };

    const sync = () => {
        const active = document.querySelector('.nav-tab.active');
        const key = active?.dataset.tab;
        titleEl.textContent = labels[key] || 'TwoKit';
    };

    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => setTimeout(sync, 0));
    });

    sync();
}

function showFatalError(message) {
    const container = document.querySelector('.panel-scroll') || document.body;
    const box = document.createElement('div');
    box.style.cssText = `
        margin: 32px; padding: 24px; border-radius: 14px;
        background: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #ef4444; font-family: var(--font-sans);
    `;
    box.innerHTML = `<strong style="font-size:15px">Application Error</strong><p style="margin-top:6px;font-size:13px;color:inherit">${message}</p>`;
    container.prepend(box);
}

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

export { initApp };
