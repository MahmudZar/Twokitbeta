import { highlight } from '../ui/highlight.js';
import AppState from '../state/appState.js';
import ThemeTokens from '../core/themeTokens.js';
import { currentTheme } from '../state/themeModel.js';
import ExampleSite from '../ui/exampleSite.js';
import { dialSegmented, dialSwitch, dialRow } from '../ui/dial.js';
import { esc, switcher, group, option } from '../ui/components.js';
import StylingModule from './stylingModule.js';
import ColorField from '../ui/colorField.js';

const VIEWS = [
    { value: 'all', label: 'All theming' },
    { value: 'settings', label: 'Theme setting' }
];

const MODES = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'auto', label: 'Auto' }
];

const chip = (entry) => `<span class="th-chip" style="--chip:${esc(entry.alpha < 1 ? entry.css : entry.hex)}" title="${esc(entry.css)}"></span>`;

/**
 * Theming: every themed token with its light and dark value, and the
 * settings that shape the theme export (Bricks default mode, inverse,
 * aliases, utility classes).
 */
const ThemingModule = {
    title: 'Theming Preview',
    previewModes: true,

    init() {},

    view() {
        // The site background field validates and previews colors like the button colors do.
        StylingModule.probeCache = null;
        ColorField.resolve = (css, mode) => StylingModule.resolveCss(css, mode);
        ColorField.onPreview = null;
        const model = currentTheme();
        const body = AppState.ui.themeView === 'settings' ? this.settings() : this.allTheming(model);
        const top = switcher({ id: 'theme', value: AppState.ui.themeView, options: VIEWS, label: 'Theming view' });
        return {
            control: `<div class="control__stack">${top}${body}</div>`,
            preview: this.preview(model)
        };
    },

    allTheming(model) {
        return model.groups.map((g) => group({
            title: g.label,
            badge: `${g.tokens.length}`,
            body: `
              <ul class="th-list">
                ${g.tokens.map((t) => `
                  <li class="th-list__row">
                    <span class="th-list__name">--${esc(t.name)}</span>
                    ${chip(t.light)}${chip(t.dark)}
                  </li>`).join('')}
              </ul>`
        })).join('');
    },

    settings() {
        const t = AppState.theme;
        return `
          ${group({
              title: 'Theme mode',
              body: `
                ${dialRow('Default mode', dialSegmented({ key: 'defaultMode', value: t.defaultMode, options: MODES, label: 'Default theme mode', fid: 'theme-mode' }))}
                <p class="dk-hint">Matches Bricks Style manager. Auto follows the visitor's system setting.</p>
                ${option('Site background', StylingModule.colorField('siteBg', t.siteBg || 'surface-0', 'Site background', { transparent: true, self: 'site-bg' }))}
                <p class="dk-hint">Fills the page behind your sections as <code>--site-bg</code>: the <code>html</code> background in the HTML export and Site background in the Bricks theme style. Pick a variable or type any color.</p>`
          })}
          ${group({
              title: 'Include',
              body: `
                <div class="dk-stack">
                  ${dialSwitch({ key: 'enableInverse', label: 'Inverse tokens', checked: t.enableInverse, fid: 'theme-inverse' })}
                  ${dialSwitch({ key: 'enableAliases', label: 'Semantic aliases', checked: t.enableAliases, fid: 'theme-aliases' })}
                  ${dialSwitch({ key: 'enableClasses', label: 'Surface classes', checked: t.enableClasses, fid: 'theme-classes' })}
                </div>
                <p class="dk-hint">Inverse tokens flip to the other theme for tooltips, toasts and featured cards. Aliases add names like <code>--surface-card</code>. Classes export <code>.surface-0</code>–<code>.surface-8</code> to Bricks.</p>`
          })}`;
    },

    preview(model) {
        const mode = AppState.ui.previewMode;
        if (mode === 'example') return ExampleSite.productFrame();
        if (mode === 'code') {
            return `<pre class="code-block"><code>${highlight(ThemeTokens.toCss(model, { defaultMode: AppState.theme.defaultMode }))}</code></pre>`;
        }
        const boards = ['light', 'dark'].map((m) => {
            const vars = Object.entries(ThemeTokens.vars(model, m)).map(([k, v]) => `${k}:${v}`).join(';');
            const groups = model.groups.map((g) => `
              <section class="th-board__group">
                <h4>${esc(g.label)}</h4>
                <ul>${g.tokens.map((t) => `
                  <li><span class="th-board__chip" style="background:var(--${esc(t.name)})"></span><span class="th-board__name">${esc(t.name)}</span><span class="th-board__value">${esc(t[m].ref || (t[m].alpha < 1 ? `${t[m].hex} / ${Math.round(t[m].alpha * 1000) / 10}%` : t[m].hex))}</span></li>`).join('')}
                </ul>
              </section>`).join('');
            const shadows = model.shadows[m].map((_, i) => `<span class="th-board__shadow" style="box-shadow:var(--shadow-${i + 1})">${i + 1}</span>`).join('');
            return `
              <article class="th-board" data-mode="${m}" style="${esc(vars)}">
                <header class="th-board__head"><h3>${m === 'light' ? 'Light' : 'Dark'}</h3><span>data-brx-theme="${m}"</span></header>
                ${groups}
                <section class="th-board__group"><h4>Shadows</h4><div class="th-board__shadows">${shadows}</div></section>
              </article>`;
        }).join('');
        return `<div class="th-boards">${boards}</div>`;
    },

    onSwitch({ id, value }) {
        if (id === 'theme') AppState.updateUi({ themeView: value });
        if (id === 'siteBg' && value) AppState.updateTheme({ siteBg: value });
    },

    onDial({ key, value, live }) {
        if (live || !(key in AppState.theme)) return;
        AppState.updateTheme({ [key]: value });
    }
};

export default ThemingModule;
