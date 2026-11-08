import { highlight } from '../ui/highlight.js';
import AppState from '../state/appState.js';
import ColorShadeGenerator from '../core/colorShadeGenerator.js';
import ColorScience from '../core/colorScience.js';
import { TAILWIND_FAMILIES, familySwatch, shadesFor } from '../data/tailwindColors.js';
import Notifications from '../ui/notifications.js';
import { formatColor, nextFormat, inkFor, randomBrandHex } from '../ui/colorFormat.js';
import { copyRampImage, copyRampSvg, findRamp } from '../ui/domCapture.js';
import { esc, switcher, selectInput, iconButton, ICON, tokenTable, rampActions, colorSwatch } from '../ui/components.js';
import ExampleSite from '../ui/exampleSite.js';
import { STATE_ROLES, normalizeRoles } from '../core/themeTokens.js';
import { ensureShades, paletteAlias } from '../state/themeModel.js';

const STEPS = ColorShadeGenerator.shadeLabels;
const BRAND_NAMES = ['secondary', 'tertiary', 'accent', 'highlight'];
const MODES = ['light', 'dark'];
const VIEWS = [
    { value: 'brand', label: 'Brand' },
    { value: 'state', label: 'State' }
];

function slug(value) {
    return String(value).toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

const ColorModule = {
    title: 'Color Preview',
    previewModes: true,

    init() {
        for (const color of [...AppState.colors, ...AppState.stateColors]) {
            if (!color.tailwind) color.shades = [];
        }
        this.ensureShades();
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.pickerEl) {
                event.preventDefault();
                this.closePicker({ focusTrigger: true });
                return;
            }
            if (event.code !== 'Space' || event.repeat) return;
            if (AppState.ui.section !== 'colors' || AppState.ui.colorsView !== 'brand') return;
            if (event.target.closest?.('input, textarea, select, button, [role="option"], [contenteditable], .tw-picker')) return;
            event.preventDefault();
            this.randomize();
        });
        document.addEventListener('click', (event) => this.onDocumentClick(event));
        window.addEventListener('resize', () => this.placePicker());
        document.addEventListener('scroll', () => this.placePicker(), true);
    },

    ensureShades() {
        for (const color of [...AppState.colors, ...AppState.stateColors]) ensureShades(color);
        for (const color of AppState.stateColors) color.roles = normalizeRoles(color.roles);
    },

    isBrand() {
        return AppState.ui.colorsView === 'brand';
    },

    list() {
        return this.isBrand() ? AppState.colors : AppState.stateColors;
    },

    find(id) {
        return this.list().find((c) => c.id === id);
    },

    setBase(color, hex) {
        delete color.tailwind;
        color.baseColor = hex;
        color.shades = ColorShadeGenerator.generateShades(hex, color.name);
    },

    randomize() {
        if (!this.isBrand()) return;
        this.closePicker();
        for (const color of AppState.colors) this.setBase(color, randomBrandHex());
        if (AppState.surface.linked === false) AppState.surface.base = randomBrandHex();
        else AppState.surface.base = AppState.colors[0].baseColor;
        this.paintRandomize();
        AppState.notify('live');
    },

    paintRandomize() {
        document.querySelectorAll('#control [data-palette]').forEach((card) => {
            const color = this.find(card.dataset.palette);
            if (color) this.patchCard(card, color);
        });
        if (AppState.ui.previewMode === 'example') {
            ExampleSite.refresh();
            return;
        }
        const preview = document.getElementById('previewBody');
        if (preview) {
            preview.innerHTML = this.preview(this.list());
            preview.dataset.patched = '1';
        }
    },

    /* ---------------- view ---------------- */

    view() {
        this.closePicker();
        this.ensureShades();
        const current = AppState.ui.colorsView === 'edit' ? 'state' : AppState.ui.colorsView;
        const top = switcher({ id: 'colors', value: current, options: VIEWS, label: 'Color group' });
        const editing = AppState.ui.colorsView === 'edit';
        const body = this.isBrand() ? this.brandControls() : editing ? this.stateEdit() : this.stateControls();
        return {
            control: `<div class="control__stack">${top}${body}</div>`,
            preview: this.preview(this.list())
        };
    },

    brandControls() {
        return `
          <section class="setting-group">
            <header class="setting-group__header">
              <h2 class="setting-group__title">Color palettes</h2>
            </header>
            <ul class="card-list">${AppState.colors.map((c) => `<li>${this.paletteCard(c, true)}</li>`).join('')}</ul>
          </section>
          <div class="control__actions">
            <button type="button" class="btn-dashed" data-action="add-color" data-fid="add-color">${ICON.addCircle}<span>Add color</span></button>
            <button type="button" class="btn-outline" data-action="randomize" data-fid="randomize">
              ${ICON.shuffle}<span>Randomize</span><kbd class="kbd">Spacebar</kbd>
            </button>
          </div>`;
    },

    stateModeToggle() {
        const editing = AppState.ui.colorsView === 'edit';
        return `
          <div class="segmented segmented--sm" role="group" aria-label="State mode">
            <button type="button" class="segmented__btn" data-action="state-mode" data-value="state" aria-pressed="${!editing}" aria-label="State palettes" title="State palettes" data-fid="state-mode-state">${ICON.eye}</button>
            <button type="button" class="segmented__btn" data-action="state-mode" data-value="edit" aria-pressed="${editing}" aria-label="Edit state tokens" title="Edit state tokens" data-fid="state-mode-edit">${ICON.pen}</button>
          </div>`;
    },

    stateControls() {
        const actions = this.stateModeToggle();
        return `
          <section class="setting-group">
            <header class="setting-group__header">
              <h2 class="setting-group__title">State palettes</h2>
              <div class="setting-group__actions">${actions}</div>
            </header>
            <ul class="card-list">${AppState.stateColors.map((c) => `<li>${this.paletteCard(c, false)}</li>`).join('')}</ul>
          </section>`;
    },

    stateEditTheme(id) {
        return AppState.ui.stateEditTheme?.[id] === 'dark' ? 'dark' : 'light';
    },

    stateThemeToggle(id, mode) {
        return `
          <div class="segmented segmented--sm" role="group" aria-label="Light or dark tokens">
            <button type="button" class="segmented__btn" data-action="state-theme" data-palette="${esc(id)}" data-value="light"
                    aria-pressed="${mode === 'light'}" aria-label="Light" title="Light" data-fid="state-theme-${esc(id)}-light">${ICON.sun}</button>
            <button type="button" class="segmented__btn" data-action="state-theme" data-palette="${esc(id)}" data-value="dark"
                    aria-pressed="${mode === 'dark'}" aria-label="Dark" title="Dark" data-fid="state-theme-${esc(id)}-dark">${ICON.moon}</button>
          </div>`;
    },

    stateEdit() {
        const actions = this.stateModeToggle();
        const cards = AppState.stateColors.map((color) => {
            const roles = normalizeRoles(color.roles);
            color.roles = roles;
            const mode = this.stateEditTheme(color.id);
            const suffix = mode === 'dark' ? '-dark' : '';
            const token = (role) => `--${AppState.tokenName('color', `${color.name}-${role}${suffix}`)}`;
            const rows = STATE_ROLES.map((role) => {
                const step = roles[mode][role];
                return `
              <tr>
                <th scope="row">${esc(token(role))}</th>
                <td>${selectInput({
                    key: `state-role:${esc(color.id)}:${mode}:${role}`,
                    value: step,
                    options: STEPS.map((s) => ({ value: s, label: `var(--${AppState.tokenName('color', `${color.name}-${s}`)})` })),
                    label: `${color.name} ${role} shade in ${mode} theme`,
                    mono: true
                })}</td>
              </tr>`;
            });
            return `
              <li class="card">
                <header class="card__header">
                  <h3 class="card__title">${esc(color.name[0].toUpperCase() + color.name.slice(1))}</h3>
                  ${this.stateThemeToggle(color.id, mode)}
                </header>
                ${tokenTable({ rows, caption: `${color.name} ${mode} tokens` })}
              </li>`;
        }).join('');
        return `
          <section class="setting-group">
            <header class="setting-group__header">
              <h2 class="setting-group__title">State edit</h2>
              <div class="setting-group__actions">${actions}</div>
            </header>
            <ul class="card-list">${cards}</ul>
          </section>`;
    },

    paletteCard(color, removable) {
        const shown = formatColor(color.baseColor, AppState.colorFormat);
        const stops = color.shades.map((s) => `<li class="strip__stop" style="background:${esc(s.hex)}" title="${esc(s.shade)} · ${esc(s.hex)}"></li>`).join('');
        const canHarmonize = this.isBrand() && color !== AppState.colors[0];
        return `
          <article class="card" data-palette="${esc(color.id)}">
            <header class="card__header">
              <input class="card__title-input" value="${esc(color.name)}" data-field="name" data-fid="name-${esc(color.id)}"
                     aria-label="Palette name" spellcheck="false" ${removable ? '' : 'readonly'}>
              <div class="card__actions">
                ${iconButton({ action: 'tailwind-picker', label: 'Tailwind colors', icon: 'wave', extra: color.id, expanded: this.openPickerId === color.id })}
                ${canHarmonize ? iconButton({ action: 'harmonize', label: 'Harmonize', icon: 'harmonize', extra: color.id }) : ''}
                ${removable ? iconButton({ action: 'remove', label: `Delete ${color.name}`, icon: 'trash', extra: color.id }) : ''}
              </div>
            </header>
            <div class="color-field">
              ${colorSwatch({ hex: color.baseColor, label: `Pick ${color.name} color`, fid: `picker-${esc(color.id)}` })}
              <div class="color-field__value">
                <input value="${esc(shown)}" data-field="value" data-fid="value-${esc(color.id)}" spellcheck="false"
                       aria-label="${esc(color.name)} base color">
                <button type="button" class="color-field__mode" data-action="format" data-fid="format-${esc(color.id)}"
                        aria-label="Color format ${AppState.colorFormat}, switch format">${AppState.colorFormat}${ICON.updown}</button>
              </div>
            </div>
            <ul class="strip" aria-label="${esc(color.name)} shades">${stops}</ul>
          </article>`;
    },

    preview(list) {
        const mode = AppState.ui.previewMode;
        if (mode === 'example') {
            return ExampleSite.productFrame();
        }
        return list.map((color) => {
            const body = mode === 'code' ? this.codeBody(color) : this.rampBody(color);
            return `
              <article class="preview-card" data-preview-palette="${esc(color.id)}">
                <header class="preview-card__header">
                  <h3>${esc(color.name[0].toUpperCase() + color.name.slice(1))}</h3>
                  <div class="preview-card__actions">
                    ${mode === 'visual' ? rampActions(color.id) : ''}
                  </div>
                </header>
                ${body}
              </article>`;
        }).join('');
    },

    rampBody(color) {
        return `
          <ol class="ramp" aria-label="${esc(color.name)} shades">
            ${color.shades.map((s) => `
              <li>
                <button type="button" class="ramp__shade" style="background:${esc(s.hex)};color:${inkFor(s.hex)}" data-action="copy" data-hex="${esc(s.hex)}"
                        aria-label="Copy ${esc(color.name)} ${esc(s.shade)} ${formatColor(s.hex, AppState.colorFormat)}">
                  ${s.isBase ? '<span class="ramp__base">Base</span>' : ''}
                  <span class="ramp__step">${esc(s.shade)}</span>
                  <span class="ramp__value">${esc(formatColor(s.hex, AppState.colorFormat))}</span>
                </button>
              </li>`).join('')}
          </ol>`;
    },

    codeBody(color) {
        return `<pre class="code-block"><code>${highlight(this.css(color))}</code></pre>`;
    },

    css(color) {
        const name = (n) => AppState.tokenName('color', n);
        const alias = paletteAlias(color);
        const lines = [
            ...(alias ? [`  --${alias.name}: ${alias.css};`] : []),
            ...color.shades.map((s) => `  --${name(s.name)}: ${s.oklch};`)
        ];
        if (color.roles) {
            const roles = normalizeRoles(color.roles);
            lines.push('');
            for (const role of STATE_ROLES) {
                const [light, dark] = MODES.map((m) => `var(--${name(`${color.name}-${roles[m][role]}`)})`);
                lines.push(`  --${color.name}-${role}: light-dark(${light}, ${dark});`);
            }
        }
        return `:root {\n${lines.join('\n')}\n}`;
    },

    /* ---------------- events ---------------- */

    onSwitch({ id, value }) {
        if (id === 'colors') AppState.updateUi({ colorsView: value });
        if (id.startsWith('state-role:')) {
            const [, palette, mode, role] = id.split(':');
            const color = AppState.stateColors.find((c) => c.id === palette);
            if (color && MODES.includes(mode) && STATE_ROLES.includes(role)) {
                const roles = normalizeRoles(color.roles);
                roles[mode][role] = value;
                color.roles = roles;
                AppState.notify('colors');
            }
        }
    },

    onClick(event) {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        const card = button.closest('[data-palette]');
        const id = button.dataset.palette || button.dataset.extra || card?.dataset.palette;

        switch (button.dataset.action) {
            case 'add-color': this.addColor(); break;
            case 'remove': this.removeColor(id); break;
            case 'randomize': this.randomize(); break;
            case 'state-mode': AppState.updateUi({ colorsView: button.dataset.value }); break;
            case 'state-theme':
                AppState.updateUi({
                    stateEditTheme: { ...AppState.ui.stateEditTheme, [id]: button.dataset.value }
                });
                break;
            case 'format':
                AppState.colorFormat = nextFormat(AppState.colorFormat);
                AppState.notify('colors');
                break;
            case 'harmonize': this.harmonize(id); break;
            case 'tailwind-picker': this.togglePicker(id, button); break;
            case 'copy': this.copy(formatColor(button.dataset.hex, AppState.colorFormat)); break;
            case 'copy-ramp-image':
                this.copyRamp(button, 'image');
                break;
            case 'copy-ramp-svg':
                this.copyRamp(button, 'svg');
                break;
            default: break;
        }
    },

    onInput(event) {
        const field = event.target.dataset.field;
        const card = event.target.closest('[data-palette]');
        const color = card && this.find(card.dataset.palette);
        if (!color) return;

        if (field === 'picker') {
            this.setBase(color, event.target.value);
            this.patchLive(card, color);
        }
        if (field === 'value') {
            const hex = this.parseColor(event.target.value);
            if (hex) {
                this.setBase(color, hex);
                this.patchLive(card, color, { keepValue: true });
                // Painted without a render (the field keeps its caret); the project changed all the same.
                AppState.notify('live');
            }
        }
    },

    onChange(event) {
        const target = event.target;
        const card = target.closest('[data-palette]');
        const color = card && this.find(card.dataset.palette);
        if (!color) return;

        if (target.dataset.field === 'name') {
            const name = slug(target.value);
            if (!name) { target.value = color.name; return; }
            if (this.list().some((c) => c !== color && c.name === name)) {
                Notifications.error(`A palette named "${name}" already exists`);
                target.value = color.name;
                return;
            }
            color.name = name;
            color.shades = color.tailwind
                ? shadesFor(color.tailwind, name)
                : ColorShadeGenerator.generateShades(color.baseColor, name);
            AppState.notify('colors');
        }
        if (target.dataset.field === 'picker') AppState.notify('colors');
        if (target.dataset.field === 'value') {
            if (!this.parseColor(target.value)) Notifications.error('Enter a valid hex, rgb() or oklch() color');
            AppState.notify('colors');
        }
    },

    patchCard(card, color, { keepValue = false } = {}) {
        const swatch = card.querySelector('.color-field__swatch');
        if (!swatch) return;
        swatch.style.setProperty('--swatch', color.baseColor);
        swatch.dataset.color = color.baseColor;
        const picker = swatch.querySelector('[data-field="picker"]');
        if (picker) picker.value = color.baseColor;
        if (!keepValue) {
            const value = card.querySelector('[data-field="value"]');
            if (value) value.value = formatColor(color.baseColor, AppState.colorFormat);
        }
        card.querySelectorAll('.strip__stop').forEach((stop, i) => {
            if (color.shades[i]) stop.style.background = color.shades[i].hex;
        });
    },

    /** Update swatch, strip and preview without re-rendering the control (keeps the native picker open). */
    patchLive(card, color, { keepValue = false } = {}) {
        this.patchCard(card, color, { keepValue });
        if (AppState.ui.previewMode === 'example') {
            ExampleSite.refresh();
            return;
        }
        const preview = document.getElementById('previewBody');
        preview.innerHTML = this.preview(this.list());
        preview.dataset.patched = '1';
    },

    parseColor(raw) {
        const value = raw.trim();
        const hex = value.startsWith('#') ? value : `#${value}`;
        if (/^#[0-9a-f]{6}$/i.test(hex)) return hex.toLowerCase();
        if (/^#[0-9a-f]{3}$/i.test(hex)) return `#${hex.slice(1).split('').map((c) => c + c).join('')}`.toLowerCase();
        const rgb = value.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
        if (rgb) return ColorScience.rgbToHex(rgb[1] / 255, rgb[2] / 255, rgb[3] / 255);
        const ok = value.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i);
        if (ok) {
            const L = ok[2] ? Number(ok[1]) / 100 : Number(ok[1]);
            return ColorScience.oklchToHex(L, Number(ok[3]), Number(ok[4]));
        }
        return null;
    },

    addColor() {
        const used = new Set(AppState.colors.map((c) => c.name));
        let name = BRAND_NAMES.find((n) => !used.has(n));
        for (let i = 2; !name; i++) if (!used.has(`color-${i}`)) name = `color-${i}`;
        const color = { id: AppState.generateId(), name, baseColor: randomBrandHex(), shades: [] };
        color.shades = ColorShadeGenerator.generateShades(color.baseColor, name);
        AppState.addColor(color);
        Notifications.success(`Added ${name}`);
    },

    removeColor(id) {
        if (AppState.colors.length <= 1) {
            Notifications.error('Keep at least one brand palette');
            return;
        }
        const color = AppState.colors.find((c) => c.id === id);
        AppState.removeColor(id);
        if (color) Notifications.success(`Removed ${color.name}`);
    },

    /** Shift a palette's hue while matching the primary palette's lightness and vividness. */
    harmonize(id) {
        if (!this.isBrand()) return;
        const color = this.find(id);
        const primary = AppState.colors[0];
        if (!color || !primary) return;
        const p = ColorScience.hexToOklch(primary.baseColor);
        const H = ColorScience.hexToOklch(color.baseColor).H;
        const pct = p.C / Math.max(ColorScience.findMaxChroma(p.L, p.H), 0.001);
        const C = pct * ColorScience.findMaxChroma(p.L, H);
        this.setBase(color, ColorScience.oklchToHex(p.L, C, H));
        AppState.notify('colors');
        Notifications.success(`Harmonized ${this.displayName(color)} with primary`);
    },

    onDocumentClick(event) {
        if (!this.pickerEl) return;
        if (event.target.closest('[data-action="tailwind-picker"]')) return;
        const family = event.target.closest('[data-family]')?.dataset.family;
        if (family && this.pickerEl.contains(event.target)) {
            this.applyTailwind(this.openPickerId, family);
            return;
        }
        if (!this.pickerEl.contains(event.target)) this.closePicker();
    },

    togglePicker(id, button) {
        if (this.openPickerId === id) {
            this.closePicker();
            return;
        }
        this.openPicker(id, button);
    },

    openPicker(id, button) {
        this.closePicker();
        this.openPickerId = id;
        this.pickerTrigger = button;
        button.setAttribute('aria-expanded', 'true');
        const panel = document.createElement('div');
        panel.className = 'tw-picker';
        panel.id = 'tw-picker';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Tailwind colors');
        panel.innerHTML = TAILWIND_FAMILIES.map((family) => `
          <button type="button" class="tw-picker__item" data-family="${esc(family.id)}" data-fid="tw-${esc(family.id)}">
            <span class="tw-picker__dot" style="background:${familySwatch(family.id)}"></span>
            ${esc(family.label)}
          </button>`).join('');
        document.body.appendChild(panel);
        this.pickerEl = panel;
        this.placePicker();
        panel.querySelector('button')?.focus();
    },

    placePicker() {
        const panel = this.pickerEl;
        const trigger = this.pickerTrigger;
        if (!panel || !trigger) return;
        const rect = trigger.getBoundingClientRect();
        const gap = 8;
        const width = panel.offsetWidth || 320;
        const height = panel.offsetHeight || 360;
        const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
        const roomBelow = window.innerHeight - rect.bottom - gap - 8;
        panel.style.left = `${left}px`;
        if (roomBelow < height && rect.top > roomBelow) {
            panel.style.top = 'auto';
            panel.style.bottom = `${window.innerHeight - rect.top + gap}px`;
        } else {
            panel.style.bottom = 'auto';
            panel.style.top = `${rect.bottom + gap}px`;
        }
    },

    closePicker({ focusTrigger = false } = {}) {
        const trigger = this.pickerTrigger;
        this.pickerEl?.remove();
        this.pickerEl = null;
        this.pickerTrigger = null;
        this.openPickerId = null;
        trigger?.setAttribute('aria-expanded', 'false');
        if (focusTrigger) trigger?.focus();
    },

    applyTailwind(id, family) {
        const color = this.find(id);
        const shades = shadesFor(family, color?.name);
        const label = TAILWIND_FAMILIES.find((f) => f.id === family)?.label || family;
        if (!color || !shades.length) return;
        color.shades = shades;
        color.tailwind = family;
        color.baseColor = shades.find((s) => s.isBase)?.hex || shades[5].hex;
        this.closePicker();
        AppState.notify('colors');
        Notifications.success(`Applied Tailwind ${label} to ${this.displayName(color)}`);
    },

    copy(text, message) {
        navigator.clipboard?.writeText(text).then(
            () => Notifications.success(message || `Copied ${text}`),
            () => Notifications.error('Clipboard is not available')
        );
    },

    displayName(color) {
        const name = color?.name || 'Color';
        return name.charAt(0).toUpperCase() + name.slice(1);
    },

    async copyRamp(button, kind) {
        const ramp = findRamp(button);
        const color = this.find(button.dataset.palette);
        const label = this.displayName(color);
        if (!ramp) {
            Notifications.error('Open the visual preview to copy the ramp');
            return;
        }
        try {
            if (kind === 'image') {
                await copyRampImage(ramp);
                Notifications.success(`${label} color copied as image`);
            } else {
                await copyRampSvg(ramp);
                Notifications.success(`${label} color copied as SVG`);
            }
        } catch {
            Notifications.error(kind === 'image' ? 'Could not copy image' : 'Could not copy SVG');
        }
    }
};

export default ColorModule;
