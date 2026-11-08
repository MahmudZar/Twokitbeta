import { highlight } from '../ui/highlight.js';
import AppState from '../state/appState.js';
import ThemeTokens from '../core/themeTokens.js';
import { LEVELS } from '../core/surfaceSystem.js';
import { currentTheme } from '../state/themeModel.js';
import ExampleSite from '../ui/exampleSite.js';
import { formatColor, randomBrandHex } from '../ui/colorFormat.js';
import { dialSlider, dialSwitch, dialButton } from '../ui/dial.js';
import { esc, group, colorSwatch } from '../ui/components.js';

const SURFACE_GROUPS = new Set(['surfaces', 'text', 'borders', 'states']);

const SurfaceModule = {
    title: 'Surface Preview',
    previewModes: true,

    init() {
        const s = AppState.surface;
        if (!Number.isFinite(Number(s.tint))) s.tint = 0.012;
        if (typeof s.linked !== 'boolean') s.linked = true;
        if (!s.base) s.base = AppState.colors[0]?.baseColor || '#B0C540';
        AppState.ui.surfacePreview = { cardEdge: 'border', pageLevel: 1, pinned: false, ...AppState.ui.surfacePreview };
    },

    model() {
        return currentTheme();
    },

    hueHex() {
        return AppState.surface.linked !== false
            ? AppState.colors[0].baseColor
            : (AppState.surface.base || AppState.colors[0].baseColor);
    },

    view() {
        const s = AppState.surface;
        const linked = s.linked !== false;
        const hue = this.hueHex();
        const control = `
          <div class="control__stack">
            ${group({
                title: 'Surface color',
                body: `
                  <div class="dk-stack">
                    ${dialSwitch({ key: 'linked', label: 'Link to primary', checked: linked, fid: 'surface-linked' })}
                    ${linked
                        ? `<p class="dk-hint"><span class="swatch-dot" style="background:${hue}" aria-hidden="true"></span>
                            Hue follows <strong>${esc(AppState.colors[0].name)}</strong>. Randomize on Brand also updates this.</p>`
                        : `<div class="color-field">
                            ${colorSwatch({ hex: hue, label: 'Surface hue', fid: 'surface-base' })}
                            <div class="color-field__value">
                              <input value="${esc(formatColor(hue, AppState.colorFormat))}" data-field="surface-hex" data-fid="surface-hex" spellcheck="false" aria-label="Surface hue">
                            </div>
                          </div>
                          ${dialButton({ action: 'randomize-surface', label: 'Randomize hue', fid: 'surface-random' })}
                          <p class="dk-hint">Unlinked: pick any hue. Tint still decides how strong it reads on the surfaces.</p>`}
                  </div>`
            })}
            ${group({
                title: 'Surface tint',
                badge: Number(s.tint).toFixed(3),
                body: `
                  ${dialSlider({ key: 'tint', label: 'Tint strength', value: Number(s.tint), min: 0, max: 0.03, step: 0.001, fid: 'surface-tint' })}
                  <p class="dk-hint">0 is pure neutral gray.</p>`
            })}
          </div>`;
        return { control, preview: this.preview() };
    },

    preview() {
        const mode = AppState.ui.previewMode;
        const model = this.model();
        if (mode === 'example') return ExampleSite.productFrame();
        if (mode === 'code') return `<pre class="code-block"><code data-surface-code>${highlight(this.css(model))}</code></pre>`;
        return `
          <article class="preview-card">
            <header class="preview-card__header"><h3>Hierarchy</h3><span class="preview-card__hint">Hover More, then Share, then Embed code. Page → card 2 → button 3 → menu 4 → submenu 6 → tooltip 8</span></header>
            <div class="sp-stages">${['light', 'dark'].map((m) => this.stage(m, model)).join('')}</div>
          </article>`;
    },

    css(model) {
        const surfaceOnly = { ...model, groups: model.groups.filter((g) => SURFACE_GROUPS.has(g.id)) };
        return ThemeTokens.toCss(surfaceOnly, { defaultMode: AppState.theme.defaultMode });
    },

    stageStyle(mode, model) {
        const vars = ThemeTokens.vars(model, mode);
        vars['--page'] = `var(--surface-${AppState.ui.surfacePreview.pageLevel})`;
        return Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');
    },

    stage(mode, model) {
        const p = AppState.ui.surfacePreview;
        const nested = (level) => `<div class="sp-stack__box sp-s-${level} sp-e-${level}"><span class="sp-lvl">${level}</span>${level < LEVELS ? nested(level + 1) : ''}</div>`;
        const cls = ['sp-stage', p.pinned ? 'is-pinned' : '', p.cardEdge === 'shadow' ? 'edge-shadow' : ''].filter(Boolean).join(' ');
        return `
          <section class="${cls}" data-mode="${mode}" style="${esc(this.stageStyle(mode, model))}" aria-label="${mode} theme">
            <span class="sp-stage__label">${mode === 'light' ? 'Light' : 'Dark'}</span>
            <div class="sp-stage__canvas">
              <article class="sp-card sp-s-2">
                <h3 class="sp-card__title">TwoKit</h3>
                <p class="sp-card__body">TwoKit is a design system platform that bridges design and development. Create, manage and export complete systems to Figma and Bricks Builder, so no project starts from scratch.</p>
                <p class="sp-card__meta">Updated 2 days ago · v2.0</p>
                <div class="sp-card__actions">
                  <button type="button" class="sp-btn sp-s-3">Get it now</button>
                  <button type="button" class="sp-btn sp-s-3" disabled>Sold out</button>
                  <div class="sp-pop-host">
                    <button type="button" class="sp-btn sp-btn--ghost" aria-haspopup="menu">More
                      <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                    <div class="sp-pop sp-s-4 sp-e-4" role="menu">
                      <span class="sp-lvl">surface-4</span>
                      <button type="button" class="sp-item" role="menuitemradio" aria-checked="true">Pinned <span class="sp-item__check">✓</span></button>
                      <button type="button" class="sp-item" role="menuitem">Duplicate</button>
                      <div class="sp-pop-host">
                        <button type="button" class="sp-item" role="menuitem" aria-haspopup="menu">Share <span class="sp-item__chev">›</span></button>
                        <div class="sp-pop sp-pop--side sp-s-6 sp-e-6" role="menu">
                          <span class="sp-lvl">surface-6</span>
                          <button type="button" class="sp-item" role="menuitem">Copy link</button>
                          <div class="sp-pop-host sp-pop-host--tip">
                            <button type="button" class="sp-item" role="menuitem">Embed code</button>
                            <div class="sp-tip sp-s-8 sp-e-8" role="tooltip"><span class="sp-lvl sp-lvl--inline">surface-8</span> Paste into any page</div>
                          </div>
                          <button type="button" class="sp-item" role="menuitem">Email</button>
                        </div>
                      </div>
                      <button type="button" class="sp-item" role="menuitem" disabled>Move to team</button>
                      <hr class="sp-sep">
                      <button type="button" class="sp-item sp-item--muted" role="menuitem">Archive</button>
                    </div>
                  </div>
                </div>
              </article>
              <div class="sp-stack" aria-label="Elevation ladder">${nested(0)}</div>
            </div>
          </section>`;
    },

    paintLive() {
        const model = this.model();
        const body = document.getElementById('previewBody');
        body.querySelectorAll('.sp-stage').forEach((el) => el.setAttribute('style', this.stageStyle(el.dataset.mode, model)));
        const code = body.querySelector('[data-surface-code]');
        if (code) code.innerHTML = highlight(this.css(model));
        ExampleSite.refresh();
        body.dataset.patched = '1';
    },

    setBase(hex, live) {
        AppState.surface.base = hex;
        if (live) this.paintLive();
        else AppState.updateSurface({ base: hex });
    },

    onDial({ key, value, live }) {
        if (key === 'tint') {
            AppState.surface.tint = value;
            if (live) this.paintLive();
            else AppState.updateSurface({ tint: value });
            return;
        }
        if (key === 'linked' && !live) {
            const updates = { linked: value };
            if (!value) updates.base = AppState.surface.base || AppState.colors[0].baseColor;
            AppState.updateSurface(updates);
        }
    },

    onInput(event) {
        if (event.target.dataset.field === 'picker') this.setBase(event.target.value, true);
    },

    onChange(event) {
        if (event.target.dataset.field === 'picker') {
            this.setBase(event.target.value, false);
            return;
        }
        if (event.target.dataset.field === 'surface-hex') {
            const raw = event.target.value.trim();
            const hex = raw.startsWith('#') ? raw : `#${raw}`;
            if (/^#[0-9a-f]{6}$/i.test(hex)) this.setBase(hex.toUpperCase(), false);
            else AppState.notify('surface');
        }
    },

    onClick(event) {
        if (event.target.closest('[data-action="randomize-surface"]')) {
            this.setBase(randomBrandHex(), false);
            return;
        }
    }
};

export default SurfaceModule;
