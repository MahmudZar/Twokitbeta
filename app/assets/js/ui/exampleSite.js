/**
 * Example preview: the user's system on real pages, in an iframe.
 *
 *   Website       Wayward, a one-page travel site built from TwoKit itself
 *                 (ui/exampleWebsite.js): h1/h2 from styles.css, .tk-*
 *                 elements, .btn--* buttons, utility classes and tokens
 *   Blog          one long journal post (ui/exampleBlog.js): h1–h4, body
 *                 copy, lists, quote, figures and a table, for reading the
 *                 type scale and line heights in running text
 *   Style guide   every token, scale and component (ui/styleGuide.js)
 *
 * Both load the HTML/CSS export (ui/previewCss.js), so the preview is what a
 * user ships. On an edit, refresh() swaps the stylesheet and rebuilds the
 * page markup in place: no iframe reload, no scroll jump. Every screen with
 * an Example mode shows the same frame; the style guide opens at the part
 * the screen edits (anchor()).
 *
 * The frame previews at a device width (Fit · Desktop · Tablet · Mobile or a
 * typed px width), scaled to fit the pane: see ui/viewport.js, group 'example'.
 */

import AppState from '../state/appState.js';
import { esc } from './components.js';
import { dialSegmented } from './dial.js';
import FontLoader from './fontLoader.js';
import { previewBaseCss, THEME_ATTR } from './previewCss.js';
import { styleGuideBody, SG_CSS } from './styleGuide.js';
import { websiteBody, websiteCss, websiteScriptTag } from './exampleWebsite.js';
import { blogBody, blogCss, blogScriptTag } from './exampleBlog.js';
import Viewport, { viewportControls, viewportStage } from './viewport.js';

/** Layouts in the Example switch. */
const KINDS = [
    { value: 'website', label: 'Website' },
    { value: 'blog', label: 'Blog' },
    { value: 'styleguide', label: 'Style guide' }
];
const TITLES = { website: 'Example website', blog: 'Example blog post', styleguide: 'Style guide' };
const exampleKind = () => (KINDS.some((k) => k.value === AppState.ui.exampleKind) ? AppState.ui.exampleKind : 'website');

/** Heading tokens carry the type prefix; the page CSS is written with plain h1–h6. */
const withTypePrefix = (css) => css.replace(/var\(--(h[1-6])\)/g, (_, h) => `var(--${AppState.tokenName('type', h)})`);

/** The style guide section a screen edits, so the guide opens there. */
function anchor() {
    const ui = AppState.ui;
    switch (ui.section) {
        case 'colors': return ui.colorsView === 'brand' ? 'sg-color' : 'sg-states';
        case 'fonts':
        case 'typography': return 'sg-type';
        case 'spacing': return ui.spacingView === 'layout' ? 'sg-layout' : 'sg-spacing';
        case 'surface': return 'sg-surfaces';
        case 'theming': return 'sg-tokens';
        case 'styling': return { accessibility: 'sg-fields', radius: 'sg-radius', selection: 'sg-type' }[ui.stylingView] || 'sg-components';
        default: return 'sg-top';
    }
}

/* ------------------------------------------------------------------ */
/* Frame                                                               */
/* ------------------------------------------------------------------ */

const PAGES = {
    website: { render: websiteBody, css: websiteCss, script: websiteScriptTag },
    blog: { render: blogBody, css: blogCss, script: blogScriptTag },
    styleguide: { render: styleGuideBody, css: () => SG_CSS }
};
const page = (name) => PAGES[name] || PAGES.website;

const ExampleSite = {
    /** Scroll per page and style guide section: "styleguide:sg-type" → y. */
    scroll: {},

    css(name) {
        return `${previewBaseCss()}\n\n${withTypePrefix(page(name).css())}`;
    },

    document(name) {
        const mode = AppState.ui.exampleTheme === 'dark' ? 'dark' : 'light';
        return `<!doctype html><html lang="en" ${THEME_ATTR}="${mode}" data-brx-theme="${mode}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">${FontLoader.headHtml()}
<style id="tk-css">${this.css(name)}</style></head><body><div id="ex-root">${page(name).render()}</div>${page(name).script?.() || ''}</body></html>`;
    },

    /** The Example frame every screen shows (Website · Blog · Style guide). */
    productFrame() {
        return this.frame({ page: exampleKind(), kinds: true });
    },

    frame({ page: name = exampleKind(), kinds = true } = {}) {
        return `
          <article class="example" data-example-page="${esc(name)}" ${kinds ? 'data-kind-switch' : ''}>
            <header class="example__bar">
              <h3 class="example__title">Example</h3>
              ${kinds ? dialSegmented({
                  key: 'example-kind',
                  value: name,
                  options: KINDS,
                  label: 'Example layout',
                  fid: 'example-kind'
              }) : ''}
              ${viewportControls('example', { label: 'Example width' })}
              ${dialSegmented({
                  key: 'example-theme',
                  value: AppState.ui.exampleTheme,
                  options: [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }],
                  label: 'Example theme',
                  fid: 'example-theme'
              })}
            </header>
            ${viewportStage('example', `<iframe class="example__frame" title="${esc(TITLES[name] || TITLES.website)}" data-page="${esc(name)}" data-anchor="${esc(anchor())}" srcdoc="${esc(this.document(name))}"></iframe>`)}
          </article>`;
    },

    scrollKey(frame) {
        return `${frame.dataset.page}:${frame.dataset.page === 'styleguide' ? frame.dataset.anchor : ''}`;
    },

    /** Jump (no animation) to the remembered position, else the section this screen edits. */
    position(frame) {
        const win = frame.contentWindow;
        const doc = frame.contentDocument;
        if (!win || !doc) return;
        const saved = this.scroll[this.scrollKey(frame)];
        if (saved != null) {
            win.scrollTo({ top: saved, behavior: 'instant' });
            return;
        }
        if (frame.dataset.page !== 'styleguide') return win.scrollTo({ top: 0, behavior: 'instant' });
        const target = doc.getElementById(frame.dataset.anchor) || doc.getElementById('sg-top');
        // Not scrollIntoView(): it would scroll the app's preview pane as well.
        const margin = target ? parseFloat(win.getComputedStyle(target).scrollMarginBlockStart) || 0 : 0;
        const top = target ? target.getBoundingClientRect().top + win.scrollY - margin : 0;
        win.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
    },

    /**
     * New tokens into every open frame: the stylesheet is swapped and the page
     * markup rebuilt in place (ramps, steps and labels are data), keeping the
     * scroll position. Built once per page type per refresh.
     */
    refresh() {
        // Device widths follow the typography viewport range, which may have just changed.
        Viewport.refresh('example');
        const cache = {};
        const current = anchor();
        document.querySelectorAll('.example__frame').forEach((frame) => {
            const doc = frame.contentDocument;
            const win = frame.contentWindow;
            const style = doc?.getElementById('tk-css');
            const root = doc?.getElementById('ex-root');
            if (!style || !root || !win) return;
            const name = frame.dataset.page;
            cache[name] ??= { css: this.css(name), html: page(name).render() };
            const y = win.scrollY;
            if (style.textContent !== cache[name].css) style.textContent = cache[name].css;
            if (root.exHtml !== cache[name].html) {
                root.innerHTML = cache[name].html;
                root.exHtml = cache[name].html;
                // Page scripts (the website's) bind to the new elements.
                win.dispatchEvent(new Event('ex:render'));
            }
            if (frame.dataset.anchor !== current) {
                // Same frame, another part of the screen (e.g. Styling → Radius): go to its section.
                frame.dataset.anchor = current;
                this.position(frame);
            } else if (win.scrollY !== y) {
                win.scrollTo({ top: y, behavior: 'instant' });
            }
        });
    },

    setTheme(mode) {
        AppState.ui.exampleTheme = mode;
        document.querySelectorAll('.example__frame').forEach((frame) => {
            const root = frame.contentDocument?.documentElement;
            root?.setAttribute(THEME_ATTR, mode);
            root?.setAttribute('data-brx-theme', mode);
        });
        // The style guide's "other theme" section flips with it.
        this.refresh();
    },

    setKind(kind) {
        AppState.ui.exampleKind = KINDS.some((k) => k.value === kind) ? kind : 'website';
        const name = AppState.ui.exampleKind;
        document.querySelectorAll('.example[data-kind-switch]').forEach((example) => {
            const frame = example.querySelector('.example__frame');
            example.dataset.examplePage = name;
            frame.dataset.page = name;
            frame.dataset.anchor = anchor();
            frame.title = TITLES[name];
            frame.srcdoc = this.document(name);
        });
    },

    init() {
        if (this.ready) return;
        this.ready = true;
        Viewport.register('example', {
            get: () => ({ device: AppState.ui.exampleDevice, width: AppState.ui.exampleWidth }),
            // Not updateUi(): that re-renders the screen; the stage resizes in place. Saved with the UI on autosave.
            set: ({ device, width }) => { AppState.ui.exampleDevice = device; AppState.ui.exampleWidth = width; }
        });
        document.addEventListener('dial:change', (event) => {
            if (event.detail.key === 'example-theme') this.setTheme(event.detail.value);
            if (event.detail.key === 'example-kind') this.setKind(event.detail.value);
        });
        document.addEventListener('load', (event) => {
            const frame = event.target;
            if (!frame.matches?.('.example__frame')) return;
            const win = frame.contentWindow;
            const doc = frame.contentDocument;
            if (!win || !doc) return;
            const root = doc.getElementById('ex-root');
            if (root) root.exHtml = page(frame.dataset.page).render();
            this.position(frame);
            win.addEventListener('scroll', () => { this.scroll[this.scrollKey(frame)] = win.scrollY; }, { passive: true });
            doc.addEventListener('click', (e) => {
                const link = e.target.closest('a, button');
                if (!link) return;
                e.preventDefault();
                // In-page links (the style guide index) still jump to their section.
                const hash = link.getAttribute('href');
                if (hash?.startsWith('#') && hash.length > 1) doc.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            this.refresh();
        }, true);
    }
};

export default ExampleSite;
