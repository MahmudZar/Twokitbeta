/**
 * App shell. Owns the control panel and preview body, binds every
 * DOM listener exactly once and forwards events to the active screen.
 *
 * Screen contract:
 *   title: string
 *   previewModes?: boolean          show the visual/example/code segment
 *   view(): { control, preview }    markup strings
 *   onClick?(event), onInput?(event), onChange?(event)
 *   onSwitch?({ id, value })        from a switcher
 *   onDial?({ key, value, live })   from a DialKit control (live while dragging)
 *   afterRender?(controlEl, previewEl)
 */

import AppState from '../state/appState.js';
import Platform from '../platform.js';
import Switcher from './switcher.js';
import ColorPicker from './colorPicker.js';
import ExampleSite from './exampleSite.js';
import FontLoader from './fontLoader.js';
import NavTooltip from './navTooltip.js';
import ColorModule from '../modules/colorModule.js';
import FontsModule from '../modules/fontsModule.js';
import TypographyModule from '../modules/typographyModule.js';
import SpacingModule from '../modules/spacingModule.js';
import SurfaceModule from '../modules/surfaceModule.js';
import LayoutModule from '../modules/layoutModule.js';
import ThemingModule from '../modules/themingModule.js';
import StylingModule from '../modules/stylingModule.js';
import UtilitiesModule from '../modules/utilitiesModule.js';
import ExportScreen from '../modules/exportScreen.js';
import ProjectModule from '../modules/projectModule.js';

const SCREENS = {
    colors: ColorModule,
    fonts: FontsModule,
    typography: TypographyModule,
    spacing: SpacingModule,
    surface: SurfaceModule,
    layout: LayoutModule,
    theming: ThemingModule,
    styling: StylingModule,
    utilities: UtilitiesModule,
    export: ExportScreen,
    project: ProjectModule
};

const RENDER_ON = new Set(['ui', 'colors', 'fonts', 'typography', 'spacing', 'surface', 'layout', 'styling', 'buttons', 'utilities', 'theme', 'project', 'export']);

const Shell = {
    init() {
        this.app = document.querySelector('.app');
        this.control = document.getElementById('control');
        this.previewBody = document.getElementById('previewBody');
        this.previewTitle = document.getElementById('previewTitle');
        this.segment = document.getElementById('previewModes');
        // Plugins have no Example site: the preview stays on the settings it belongs to.
        if (Platform.hides('example')) {
            this.segment.querySelector('[data-preview-mode="example"]')?.remove();
            if (AppState.ui.previewMode === 'example') AppState.ui.previewMode = 'visual';
        }

        document.querySelector('.menu').addEventListener('click', (event) => {
            const item = event.target.closest('[data-section]');
            if (item) {
                AppState.updateUi({ section: item.dataset.section });
                return;
            }
            if (event.target.closest('#collapseNav')) this.toggleCollapse();
        });
        NavTooltip.init(document.querySelector('.menu'));

        this.segment.addEventListener('click', (event) => {
            const button = event.target.closest('[data-preview-mode]');
            if (button) AppState.updateUi({ previewMode: button.dataset.previewMode });
        });

        for (const el of [this.control, this.previewBody]) {
            el.addEventListener('click', (event) => this.dispatch('onClick', event));
            el.addEventListener('input', (event) => this.dispatch('onInput', event));
            el.addEventListener('change', (event) => this.handleChange(event));
            el.addEventListener('switcher:change', (event) => this.screen().onSwitch?.(event.detail));
            el.addEventListener('dial:input', (event) => this.screen().onDial?.({ ...event.detail, live: true }));
            el.addEventListener('dial:change', (event) => this.screen().onDial?.({ ...event.detail, live: false }));
        }

        AppState.subscribe((section) => {
            if (RENDER_ON.has(section)) this.scheduleRender();
        });

        this.syncCollapse();
        this.render();
    },

    screen() {
        return SCREENS[AppState.ui.section] || ColorModule;
    },

    dispatch(method, event) {
        this.screen()[method]?.(event);
    },

    handleChange(event) {
        this.dispatch('onChange', event);
    },

    toggleCollapse() {
        AppState.ui.collapsed = !AppState.ui.collapsed;
        this.syncCollapse();
    },

    /** The menu's state, its button's label and aria-expanded (also on start, from saved preferences). */
    syncCollapse() {
        const collapsed = AppState.ui.collapsed === true;
        this.app.classList.toggle('is-collapsed', collapsed);
        const button = document.getElementById('collapseNav');
        button.setAttribute('aria-expanded', String(!collapsed));
        button.querySelector('.nav__label').textContent = collapsed ? 'Expand' : 'Collapse';
    },

    scheduleRender() {
        if (this.frame) return;
        this.frame = requestAnimationFrame(() => {
            this.frame = null;
            this.render();
        });
    },

    render() {
        Switcher.closeAll();
        ColorPicker.hide();
        const screen = this.screen();
        const section = AppState.ui.section;

        document.querySelectorAll('.menu [data-section]').forEach((item) => {
            if (item.dataset.section === section) item.setAttribute('aria-current', 'page');
            else item.removeAttribute('aria-current');
        });

        this.previewTitle.textContent = screen.title;
        this.segment.hidden = !screen.previewModes;
        this.segment.querySelectorAll('[data-preview-mode]').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.previewMode === AppState.ui.previewMode));
        });

        const focusId = document.activeElement?.closest?.('#control, #previewBody')
            ? document.activeElement.dataset.fid
            : null;
        const controlScroll = this.control.scrollTop;
        const previewScroll = this.previewBody.scrollTop;
        const sameSection = this.lastSection === section;

        const { control, preview } = screen.view();
        this.control.innerHTML = control;
        // The example frame refreshes in place (CSS + markup), even across screens; see ExampleSite.refresh.
        const keepExample = this.canKeepExample(preview);
        if (keepExample) {
            ExampleSite.refresh();
            delete this.previewBody.dataset.patched;
        } else if (preview !== this.lastPreview || !sameSection || this.previewBody.dataset.patched) {
            this.previewBody.innerHTML = preview;
            delete this.previewBody.dataset.patched;
        }
        this.lastPreview = preview;
        this.lastExampleSig = this.exampleSignature(preview);
        this.previewBody.dataset.screen = section;

        if (sameSection) {
            this.control.scrollTop = controlScroll;
            this.previewBody.scrollTop = previewScroll;
        } else {
            this.control.scrollTop = 0;
            this.previewBody.scrollTop = 0;
        }
        this.lastSection = section;

        if (focusId) {
            const target = document.querySelector(`[data-fid="${CSS.escape(focusId)}"]`);
            target?.focus({ preventScroll: true });
        }

        screen.afterRender?.(this.control, this.previewBody);
    },

    /**
     * What forces a new example iframe. Tokens, palettes, scales and labels
     * don't: ExampleSite.refresh() swaps the CSS and rebuilds the markup in
     * place. Fonts do, since their @font-face links sit in the iframe <head>.
     */
    exampleSignature(preview) {
        const page = preview.match(/data-page="([^"]+)"/)?.[1] || '';
        return [
            AppState.ui.previewMode,
            page,
            AppState.fonts.map((f) => `${f.id}:${f.faces.map((x) => x.fileId || x.key).join(',')}`).join(';'),
            FontLoader.version
        ].join('|');
    },

    canKeepExample(preview) {
        const frame = this.previewBody.querySelector('.example__frame');
        if (!frame || !preview.includes('example__frame')) return false;
        const page = preview.match(/data-page="([^"]+)"/)?.[1];
        if (page && frame.dataset.page !== page) return false;
        return this.lastExampleSig === this.exampleSignature(preview);
    }
};

export default Shell;
