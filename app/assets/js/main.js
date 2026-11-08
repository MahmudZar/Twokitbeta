import Notifications from './ui/notifications.js';
import Switcher from './ui/switcher.js';
import ColorField from './ui/colorField.js';
import ColorPicker from './ui/colorPicker.js';
import Dial from './ui/dial.js';
import ExampleSite from './ui/exampleSite.js';
import ProjectModule from './modules/projectModule.js';
import ColorModule from './modules/colorModule.js';
import FontsModule from './modules/fontsModule.js';
import FontLoader from './ui/fontLoader.js';
import AppState from './state/appState.js';
import FontStore from './core/fontStore.js';
import TypographyModule from './modules/typographyModule.js';
import SpacingModule from './modules/spacingModule.js';
import SurfaceModule from './modules/surfaceModule.js';
import LayoutModule from './modules/layoutModule.js';
import ExportModule from './modules/exportModule.js';
import Shell from './ui/shell.js';
import Viewport from './ui/viewport.js';
import Platform from './platform.js';

/**
 * Sample links in the previews (href="#") do nothing. One delegated listener
 * instead of inline onclick handlers, so the app runs under a strict
 * Content-Security-Policy (script-src without unsafe-inline) in WordPress.
 */
document.addEventListener('click', (e) => {
    if (e.target.closest?.('[data-noop]')) e.preventDefault();
});

async function initApp() {
    Notifications.init();
    Switcher.init();
    ColorField.init();
    ColorPicker.init();
    Dial.init();
    Viewport.init();
    ExampleSite.init();

    ProjectModule.loadMeta();
    ProjectModule.loadUi();
    ProjectModule.restoreAutosave();
    ProjectModule.syncMetaInputs();

    ColorModule.init();
    FontsModule.init();
    TypographyModule.init();
    SpacingModule.init();
    SurfaceModule.init();
    LayoutModule.init();
    ExportModule.init();

    ProjectModule.bindUI();
    ProjectModule.subscribeAutosave();

    Shell.init();

    // WordPress / Figma: Save & apply, setup, storage (app/assets/js/hosts).
    if (Platform.is('wordpress')) (await import('./hosts/wordpress.js')).default.init();
    if (Platform.is('figma')) (await import('./hosts/figma.js')).default.init();

    // Local fonts load from IndexedDB; once new files are in, re-render so the
    // example iframe picks up their @font-face rules (the next sync adds nothing).
    const syncFonts = () => FontLoader.sync()
        .then((added) => { if (added) AppState.notify('fonts'); })
        .catch((error) => console.warn('[TwoKit] Font sync failed:', error));
    AppState.subscribe((section) => { if (section === 'fonts' || section === 'project') syncFonts(); });
    syncFonts();
    FontStore.prune(AppState.fonts.flatMap((f) => f.faces.map((face) => face.fileId).filter(Boolean)))
        .catch((error) => console.warn('[TwoKit] Font cleanup failed:', error));
}

// A host that loads its data first (Figma) starts the app itself.
if (Platform.host.defer) {
    globalThis.TwoKitStart = initApp;
} else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
