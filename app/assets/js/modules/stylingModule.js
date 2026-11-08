/**
 * Styling: accessibility (focus), transition and selection.
 * Tokens and rules come from core/stylingCss.js; the preview renders the real
 * theme tokens in light and dark with the scoped rules applied.
 *
 * @module stylingModule
 */

import { highlight } from '../ui/highlight.js';
import AppState from '../state/appState.js';
import ThemeTokens, { contrast, apca, readable, LC_TARGET } from '../core/themeTokens.js';
import { currentTheme, buttonContext, paletteAlias } from '../state/themeModel.js';
import { TRANSITION_PROPERTIES, TIMING_PRESETS, withDefaults, stylingRows, stylingCss, timingPoints, colorVar, radiusScale } from '../core/stylingCss.js';
import ExampleSite from '../ui/exampleSite.js';
import { withButtonDefaults, buttonRows, buttonClasses, targetPicks, isTargetEdited, targetStore, cssColor, CSS_PREFIX, BUTTON_SIZES, COLOR_KEYS, REST_KEYS, HOVER_KEYS, COLOR_VARIANTS, LINK_STYLES } from '../core/buttonsCss.js';
import { esc, switcher, group, selectInput, varTable, varRow, numField, readNum, ICON } from '../ui/components.js';
import { dialSegmented, dialSwitch } from '../ui/dial.js';
import ColorField, { colorField } from '../ui/colorField.js';
import { resolveColor } from '../ui/colorResolve.js';

const VIEWS = [
    { value: 'accessibility', label: 'Accessibility' },
    { value: 'transition', label: 'Transition' },
    { value: 'selection', label: 'Selection' },
    { value: 'radius', label: 'Radius' },
    { value: 'buttons', label: 'Buttons' }
];

const BUTTON_TABS = [
    { value: 'primary', label: 'Primary' },
    { value: 'secondary', label: 'Secondary' },
    { value: 'outline', label: 'Outline' },
    { value: 'ghost', label: 'Ghost' },
    { value: 'link', label: 'Link' },
    { value: 'icon', label: 'Icon' }
];

const COLOR_LABELS = { bg: 'Background', text: 'Text', border: 'Border', bgHover: 'Hover background', textHover: 'Hover text', borderHover: 'Hover border' };
const SHAPE_LIMITS = {
    paddingBlock: [0, 4], paddingInline: [0, 6], fontSize: [0.5, 4], fontSizeS: [0.5, 4], fontSizeL: [0.5, 4], lineHeight: [0.8, 3],
    letterSpacing: [-0.2, 0.5], borderWidth: [0, 8], gap: [0, 3], thickness: [0, 8], offset: [0, 1]
};
const ICON_SVG = '<svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PLUS_SVG = '<svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

const LIMITS = { base: [0, 200], scale: [1, 4], width: [0, 12], offset: [-8, 16], ringWidth: [0, 16], ringStrength: [5, 100], duration: [0, 2000], delay: [0, 2000] };

const StylingModule = {
    title: 'Styling Preview',
    previewModes: true,

    get s() {
        return withDefaults(AppState.styling);
    },

    /** Token rows (Bricks variables + CSS export). */
    rows() {
        return stylingRows(AppState.styling, colorVar);
    },

    css(options) {
        return stylingCss(AppState.styling, options);
    },

    /** Every color a setting can point at, with its resolved hex per mode. */
    colors(model = currentTheme(), { overlays = false } = {}) {
        const list = [];
        for (const t of ThemeTokens.tokens(model)) {
            if (t.light.alpha < 1 && !overlays) continue; // overlays can't carry text or focus rings
            list.push({ name: t.name, light: t.light.hex, dark: t.dark.hex });
        }
        list.push({ name: 'white', light: '#ffffff', dark: '#ffffff' }, { name: 'black', light: '#000000', dark: '#000000' });
        for (const c of [...AppState.colors, ...AppState.stateColors]) {
            // --primary, --success … (the palette's base shade) before its ramp.
            const alias = paletteAlias(c);
            if (alias) list.push({ name: alias.name, light: alias.hex, dark: alias.hex });
            for (const shade of c.shades || []) {
                const name = AppState.tokenName('color', shade.name);
                list.push({ name, light: shade.hex, dark: shade.hex });
            }
        }
        return list;
    },

    colorOptions({ keepText = false, overlays = false, transparent = false, mode = 'light' } = {}) {
        return [
            ...(transparent ? [{ value: 'transparent', label: 'transparent' }] : []),
            ...(keepText ? [{ value: 'currentColor', label: 'Same as text' }] : []),
            ...this.colors(undefined, { overlays }).map((c) => ({ value: c.name, label: `--${c.name}`, swatch: c[mode] }))
        ];
    },

    colorSelect(key, value, label, opts = {}) {
        return selectInput({ key, value, options: this.colorOptions(opts), label, mono: true });
    },

    /** Variable or free CSS color (ui/colorField.js), with a resolved swatch. */
    colorField(key, value, label, opts = {}) {
        const mode = opts.mode || 'light';
        const shown = value === 'currentColor' ? null : this.resolveCss(cssColor(value), mode);
        const swatch = shown ? `rgb(from ${shown.hex} r g b / ${shown.alpha})` : '';
        return colorField({ key, value, options: this.colorOptions(opts), label, mode, swatch, self: opts.self });
    },

    /**
     * Token declarations for one theme ("--name:value;…"): palette, base
     * colors, theme tokens and button tokens, so custom CSS such as
     * oklch(from var(--primary-400) l c h / 0.7) resolves like the export.
     * Cached per render (reset in view()).
     */
    probeVars(mode) {
        this.probeCache ||= new Map();
        if (!this.probeCache.has(mode)) {
            const palette = [...AppState.colors, ...AppState.stateColors].flatMap((c) => {
                const alias = paletteAlias(c);
                return [...(alias ? [`--${alias.name}:${alias.hex}`] : []), ...(c.shades || []).map((s) => `--${AppState.tokenName('color', s.name)}:${s.hex}`)];
            });
            const theme = Object.entries(ThemeTokens.vars(currentTheme(), mode)).map(([k, v]) => `${k}:${v}`);
            const buttons = buttonRows(AppState.buttons, buttonContext()).map(([, name, value]) => `--${name}:${value}`);
            this.probeCache.set(mode, ['--white:#ffffff', '--black:#000000', ...palette, ...theme, ...buttons].join(';'));
        }
        return this.probeCache.get(mode);
    },

    /**
     * Typed-but-unsaved color on the buttons preview: overrides that token on
     * the board. Themed fields only apply while the board shows their theme;
     * link colors have one value for both.
     */
    previewColor({ key, token, css, mode }) {
        const board = document.querySelector('#previewBody .btnp');
        if (!board || !token) return;
        if (!key.startsWith('btn:link.') && board.dataset.mode !== mode) return;
        board.style.setProperty(`--${token}`, css);
        // The board now differs from its markup: the next render rebuilds it, dropping unsaved overrides.
        document.getElementById('previewBody').dataset.patched = '1';
    },

    /** Any CSS color → { hex, alpha } in a theme, or null when invalid. */
    resolveCss(css, mode = 'light') {
        if (!css || css === 'transparent') return css === 'transparent' ? { hex: '#000000', alpha: 0 } : null;
        return resolveColor(css, mode, this.probeVars(mode));
    },

    view() {
        this.probeCache = null;
        ColorField.resolve = (css, mode) => this.resolveCss(css, mode);
        ColorField.onPreview = (change) => this.previewColor(change);
        const view = AppState.ui.stylingView || 'buttons';
        const top = switcher({ id: 'styling-view', value: view, options: VIEWS, label: 'Styling view' });
        const body = view === 'transition' ? this.transitionView()
            : view === 'selection' ? this.selectionView()
                : view === 'radius' ? this.radiusView()
                    : view === 'buttons' ? this.buttonsView()
                        : this.accessibilityView();
        return { control: `<div class="control__stack">${top}${body}</div>`, preview: this.preview(view) };
    },

    /* ---------------- views ---------------- */

    accessibilityView() {
        const f = this.s.focus;
        const ring = f.style === 'ring';
        return `
          ${group({
              title: 'Focus',
              badge: ':focus-visible',
              actions: dialSegmented({ key: 'focus.style', value: f.style, options: [{ value: 'outline', label: 'Outline' }, { value: 'ring', label: 'Ring' }], label: 'Focus style', fid: 'focus-style' }),
              body: `
                ${varTable([
                    varRow('--focus-color', this.colorSelect('focus.color', f.color, 'Focus color')),
                    varRow('--focus-width', numField({ value: f.width, data: { styling: 'focus.width' }, label: 'Focus width in px', fid: 'focus-width' })),
                    ...(ring ? [] : [varRow('--focus-offset', numField({ value: f.offset, data: { styling: 'focus.offset' }, label: 'Focus offset in px', fid: 'focus-offset' }))])
                ], { label: 'Focus tokens', nameMax: '50%' })}
                <p class="dk-hint">Shows only for keyboard focus (:focus-visible), never when a button or link is clicked. ${ring
                    ? 'Ring draws a box-shadow, which replaces an element’s own shadow while focused; a transparent outline keeps it visible in high-contrast mode.'
                    : 'Outline sits outside the element and never shifts layout.'} Aim for 3:1 contrast against the page (WCAG 2.2).</p>`
          })}
          ${group({
              title: 'Fields',
              badge: 'input · textarea · select',
              actions: dialSegmented({ key: 'focus.field', value: f.field, options: [{ value: 'halo', label: 'Halo' }, { value: 'global', label: 'Same as above' }], label: 'Field focus style', fid: 'focus-field' }),
              body: f.field === 'halo' ? `
                ${varTable([
                    varRow('--focus-ring-width', numField({ value: f.ringWidth, data: { styling: 'focus.ringWidth' }, label: 'Halo width in px', fid: 'focus-ring-width' })),
                    varRow('--focus-ring-color', numField({ value: f.ringStrength, unit: '%', data: { styling: 'focus.ringStrength' }, label: 'Halo strength in percent of the focus color', fid: 'focus-ring-strength' }))
                ], { label: 'Field focus tokens', nameMax: '50%' })}
                <p class="dk-hint">The border turns --focus-color and a soft halo of the same color (at this strength) surrounds the field. It shows on click as well, since fields are always keyboard targets. Checkboxes and radios keep the outline.</p>`
                  : '<p class="dk-hint">Fields use the same focus style as buttons and links.</p>'
          })}`;
    },

    transitionView() {
        const t = this.s.transition;
        const timings = TIMING_PRESETS.map((p) => ({ value: p.value, label: p.label === p.value ? p.label : `${p.label} · ${p.value}` }));
        return `
          ${group({
              title: 'Transition',
              badge: `${t.duration}ms`,
              body: `
                ${varTable([
                    varRow('--transition-duration', numField({ value: t.duration, unit: 'ms', data: { styling: 'transition.duration' }, label: 'Transition duration in ms', fid: 'tr-duration' })),
                    varRow('--transition-timing', selectInput({ key: 'transition.timing', value: t.timing, options: timings, label: 'Timing function', mono: true })),
                    varRow('--transition-delay', numField({ value: t.delay, unit: 'ms', data: { styling: 'transition.delay' }, label: 'Transition delay in ms', fid: 'tr-delay' }))
                ], { label: 'Transition tokens', nameMax: '50%' })}
                <p class="dk-hint">Keep delay at 0 for hover and focus: delayed feedback feels laggy. Use it for staggered or decorative motion.</p>`
          })}
          ${group({
              title: 'Behaviour',
              body: `
                ${dialSwitch({ key: 'transition.applyToControls', label: 'Apply to links, buttons & fields', checked: t.applyToControls, fid: 'tr-controls' })}
                ${dialSwitch({ key: 'transition.reduceMotion', label: 'Respect reduced motion', checked: t.reduceMotion, fid: 'tr-reduce' })}
                <p class="dk-hint">--transition animates ${TRANSITION_PROPERTIES.join(', ')}. Layout properties (width, padding) are left out on purpose. Add the <code>.transition</code> class to anything else.</p>`
          })}`;
    },

    selectionView() {
        const sel = this.s.selection;
        return `
          ${group({
              title: 'Selection',
              actions: dialSwitch({ key: 'selection.enabled', label: 'Selection styling', checked: sel.enabled, bare: true, fid: 'sel-enabled' }),
              body: sel.enabled ? `
                ${varTable([
                    varRow('--selection-bg', this.colorSelect('selection.bg', sel.bg, 'Selection background')),
                    varRow('--selection-text', this.colorSelect('selection.text', sel.text, 'Selection text', { keepText: true }))
                ], { label: 'Selection tokens', nameMax: '50%' })}
                <p class="dk-hint">Used everywhere on the page.</p>` : '<p class="dk-hint">Off: browsers use their default selection colors.</p>'
          })}
          ${sel.enabled ? group({
              title: 'Alt selection',
              badge: '.inverse · .selection--alt',
              body: `
                ${varTable([
                    varRow('--selection-bg-alt', this.colorSelect('selection.bgAlt', sel.bgAlt, 'Alt selection background')),
                    varRow('--selection-text-alt', this.colorSelect('selection.textAlt', sel.textAlt, 'Alt selection text', { keepText: true }))
                ], { label: 'Alt selection tokens', nameMax: '50%' })}
                <p class="dk-hint">Applies inside .inverse surfaces automatically, and anywhere you add .selection--alt, e.g. on a section filled with your brand color.</p>`
          }) : ''}`;
    },

    radiusView() {
        const r = this.s.radius;
        const px = (v) => `${Math.round(v * 100) / 100}px`;
        const scale = radiusScale(r);
        return `
          ${group({
              title: 'Radius',
              badge: `${r.base}px × ${r.scale}`,
              body: `
                ${varTable([
                    varRow('--radius', numField({ value: r.base, data: { styling: 'radius.base' }, label: 'Default radius in px', fid: 'radius-base' })),
                    varRow('--radius-scale', numField({ value: r.scale, unit: '×', data: { styling: 'radius.scale' }, label: 'Radius scale ratio', fid: 'radius-scale' }))
                ], { label: 'Radius tokens', nameMax: '50%' })}
                ${dialSwitch({ key: 'radius.extraSizes', label: 'Generate extra sizes (xs–xxl)', checked: r.extraSizes, fid: 'radius-sizes' })}
                <p class="dk-hint">${r.extraSizes
                    ? `Each size is --radius × or ÷ the scale: ${scale.map((s) => `${s.name.slice(7)} ${px(s.px)}`).join(' · ')}. They stay linked, so changing --radius in Bricks rescales them all.`
                    : 'Only --radius, --radius-m (same value), --radius-none, --radius-50 and --radius-circle are exported.'}</p>`
          })}
          ${group({
              title: 'Auto radius',
              actions: dialSwitch({ key: 'radius.auto', label: 'Add radius automatically', checked: r.auto, bare: true, fid: 'radius-auto' }),
              body: `
                <textarea class="text-input text-input--mono text-input--area" rows="3" spellcheck="false" data-radius-selectors
                          data-fid="radius-selectors" aria-label="Auto radius selectors, one per line">${esc(r.autoSelectors)}</textarea>
                <p class="dk-hint">One selector per line. ${r.auto ? 'They get border-radius: var(--radius)' : 'When on, they get border-radius: var(--radius)'} at zero specificity (:where), so a radius set on an element in Bricks still wins.</p>`
          })}`;
    },

    get b() {
        return withButtonDefaults(AppState.buttons);
    },

    /** Light / dark switch (segmented--sm, sun + moon). */
    modeToggle(action, mode, label, flags = {}) {
        const btn = (m, icon, name) => `<button type="button" class="segmented__btn" data-action="${action}" data-value="${m}" aria-pressed="${mode === m}"${flags[m] ? ' data-issue' : ''} aria-label="${name}${flags[m] ? ', has contrast issues' : ''}" title="${name}${flags[m] ? ' · contrast issue' : ''}" data-fid="${action}-${m}">${icon}</button>`;
        return `
          <div class="segmented segmented--sm" role="group" aria-label="${esc(label)}">
            ${btn('light', ICON.sun, 'Light')}
            ${btn('dark', ICON.moon, 'Dark')}
          </div>`;
    },

    /** Default / Hover switch, same control with text labels. */
    stateToggle(state, flags = {}) {
        return `
          <div class="segmented segmented--sm" role="group" aria-label="Edit default or hover colors">
            ${['default', 'hover'].map((v) => `<button type="button" class="segmented__btn segmented__btn--text" data-action="btn-edit-state" data-value="${v}" aria-pressed="${state === v}"${flags[v] ? ' data-issue title="Contrast issue"' : ''} data-fid="btn-edit-state-${v}">${v === 'default' ? 'Default' : 'Hover'}</button>`).join('')}
          </div>`;
    },

    /** Failing pairs of the current button as clickable chips, plus Fix. */
    issueStrip(tab, issues) {
        if (!issues?.length) return '';
        const label = (i) => `${i.state === 'hover' ? 'Hover' : 'Default'} · ${i.mode === 'dark' ? 'Dark' : 'Light'}`;
        return `
          <div class="btn-issues" role="status">
            <span class="btn-issues__title">Contrast</span>
            ${issues.map((i) => `<button type="button" class="btn-issue" data-action="btn-goto" data-state="${i.state}" data-mode="${i.mode}" data-fid="btn-goto-${i.state}-${i.mode}">${label(i)} <b>Lc ${Math.round(i.lc)}</b></button>`).join('')}
            <button type="button" class="btn-issues__fix" data-action="btn-fix" data-target="${esc(tab)}" data-fid="btn-fix">Fix</button>
          </div>`;
    },

    /** Variant picker options: the variants, then one per state palette. */
    buttonTargets() {
        const ctx = buttonContext();
        const label = (s, kind) => `${s.name[0].toUpperCase()}${s.name.slice(1)} (${kind})`;
        const brands = ctx.brands.filter((s) => s.colors).map((s) => ({ value: `brand:${s.id}`, label: label(s, 'brand') }));
        const states = ctx.states.filter((s) => s.colors).map((s) => ({ value: `state:${s.id}`, label: label(s, 'state') }));
        return [...BUTTON_TABS.slice(0, 4), ...brands, ...BUTTON_TABS.slice(4), ...states];
    },

    /* ---------------- buttons: contrast audit ---------------- */

    /** name → { light: {hex, alpha}, dark: {hex, alpha} } for every pickable color. */
    colorInfo(model = currentTheme()) {
        const info = new Map();
        const both = (hex) => ({ light: { hex, alpha: 1 }, dark: { hex, alpha: 1 } });
        for (const t of ThemeTokens.tokens(model)) {
            info.set(t.name, { light: { hex: t.light.hex, alpha: t.light.alpha }, dark: { hex: t.dark.hex, alpha: t.dark.alpha } });
        }
        info.set('white', both('#ffffff'));
        info.set('black', both('#000000'));
        for (const c of [...AppState.colors, ...AppState.stateColors]) {
            const alias = paletteAlias(c);
            if (alias) info.set(alias.name, both(alias.hex));
            for (const s of c.shades || []) info.set(AppState.tokenName('color', s.name), both(s.hex));
        }
        return info;
    },

    /** Hex a color shows on `ground` (overlays composited, transparent = ground). */
    shownHex(name, mode, ground, info) {
        if (!name || name === 'transparent') return ground;
        const e = String(name).startsWith(CSS_PREFIX) ? this.resolveCss(cssColor(name), mode) : info.get(name)?.[mode];
        if (!e) return null;
        if (e.alpha >= 1) return e.hex;
        const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
        const [a, g] = [rgb(e.hex), rgb(ground)];
        return `#${a.map((v, i) => Math.round(v * e.alpha + g[i] * (1 - e.alpha)).toString(16).padStart(2, '0')).join('')}`;
    },

    /**
     * Every failing text/fill pair of one target, as { state, mode, lc, ratio }
     * (APCA Lc and WCAG 2 ratio; readable() decides).
     * Checks default + hover in light + dark; transparent fills sit on the page.
     * `picks` audits unsaved colors (while fixing).
     */
    auditTarget(tab, env, picks = null) {
        const { info, pages, ctx } = env;
        const issues = [];
        const check = (state, mode, fillName, textName) => {
            const bg = this.shownHex(fillName, mode, pages[mode], info);
            const fg = textName === 'currentColor' ? null : this.shownHex(textName, mode, bg, info);
            if (!bg || !fg) return;
            if (!readable(fg, bg)) issues.push({ state, mode, lc: apca(fg, bg), ratio: contrast(fg, bg) });
        };
        if (tab === 'link') {
            const l = this.b.link;
            for (const mode of ['light', 'dark']) {
                check('default', mode, 'transparent', l.text);
                check('hover', mode, 'transparent', l.textHover);
            }
            return issues;
        }
        const v = picks || targetPicks(AppState.buttons, tab, ctx);
        if (!v) return issues;
        const val = (key, mode) => (mode === 'dark' && v.customDark ? (v.dark?.[key] ?? v[key]) : v[key]);
        for (const mode of ['light', 'dark']) {
            check('default', mode, val('bg', mode), val('text', mode));
            check('hover', mode, val('bgHover', mode), val('textHover', mode));
        }
        return issues;
    },

    /** Shared inputs for an audit pass. */
    auditEnv() {
        this.probeCache = null; // tokens may have changed since the last render
        const model = currentTheme();
        const page = model.groups.find((g) => g.id === 'surfaces').tokens.find((t) => t.name === 'surface-1');
        return { info: this.colorInfo(model), pages: { light: page.light.hex, dark: page.dark.hex }, ctx: buttonContext() };
    },

    /** target → issues, for every button that has colors (runs on every render). */
    buttonAudit(env = this.auditEnv()) {
        const out = new Map();
        for (const t of this.buttonTargets()) {
            if (t.value === 'icon') continue;
            const issues = this.auditTarget(t.value, env);
            if (issues.length) out.set(t.value, issues);
        }
        return out;
    },

    /**
     * Readable text for a fill: white first (it reads best on saturated
     * 500–700 shades), then black; surfaces and other theme fills try
     * --text-primary first. Falls back to the one with the most APCA contrast.
     */
    readableText(fillName, mode, env) {
        const { info, pages } = env;
        const bg = this.shownHex(fillName, mode, pages[mode], info);
        const candidates = [];
        const palette = [...AppState.colors, ...AppState.stateColors].some((c) => (c.shades || []).some((s) => AppState.tokenName('color', s.name) === fillName));
        // Colored fills (palette shades, custom CSS, white/black) take white or black; theme surfaces try --text-primary first.
        const colored = palette || fillName === 'white' || fillName === 'black' || String(fillName).startsWith(CSS_PREFIX);
        candidates.push(...(colored ? [] : ['text-primary']), 'white', 'black');
        const scored = candidates.map((name) => {
            const fg = this.shownHex(name, mode, bg, info);
            return { name, ok: readable(fg, bg), lc: apca(fg, bg) };
        });
        return (scored.find((c) => c.ok) || scored.sort((a, b) => b.lc - a.lc)[0]).name;
    },

    /**
     * A readable { fill, text } for one failing pair. Text first (fill kept);
     * when no text reads on that fill (a mid-tone like lime 600, where white
     * and black both fall short), the fill moves to the nearest shade of its
     * palette that works, keeping the current text color when it can.
     */
    fixPair(fillName, textName, mode, env) {
        const { info, pages } = env;
        const works = (fill, text) => {
            const bg = this.shownHex(fill, mode, pages[mode], info);
            return readable(this.shownHex(text, mode, bg, info), bg);
        };
        const text = this.readableText(fillName, mode, env);
        if (works(fillName, text)) return { fill: fillName, text };
        const palette = [...AppState.colors, ...AppState.stateColors].find((c) => (c.shades || []).some((s) => AppState.tokenName('color', s.name) === fillName));
        if (!palette) return { fill: fillName, text };
        const names = palette.shades.map((s) => AppState.tokenName('color', s.name));
        const at = names.indexOf(fillName);
        const inks = [...new Set([textName, 'white', 'black'].filter((t) => t === 'white' || t === 'black'))];
        // Nearest shade first; at the same distance, keeping the current text color wins.
        for (let d = 1; d < names.length; d++) {
            const steps = [at + d, at - d].filter((k) => k >= 0 && k < names.length);
            for (const ink of inks) {
                const k = steps.find((i) => works(names[i], ink));
                if (k !== undefined) return { fill: names[k], text: ink };
            }
        }
        return { fill: fillName, text };
    },

    /** Fixes a target's failing pairs: text colors first, the fill only when no text can read on it. */
    fixTarget(tab, env = this.auditEnv()) {
        if (tab === 'link') {
            // Link colors are theme tokens; pick ones that pass in both themes.
            const options = ['action', 'action-hover', 'text-primary'];
            const passes = (name) => ['light', 'dark'].every((m) => readable(this.shownHex(name, m, env.pages[m], env.info), env.pages[m]));
            const l = { ...this.b.link };
            for (const key of ['text', 'textHover']) if (!passes(l[key])) l[key] = options.find(passes) || 'text-primary';
            return AppState.updateButtons({ link: l });
        }
        const picks = { ...targetPicks(AppState.buttons, tab, env.ctx) };
        // Light first (it also drives dark when dark isn't customised), then dark.
        for (const mode of ['light', 'dark']) {
            const issues = this.auditTarget(tab, env, picks).filter((i) => i.mode === mode);
            for (const { state } of issues) {
                const [fillKey, textKey, borderKey] = state === 'hover' ? ['bgHover', 'textHover', 'borderHover'] : ['bg', 'text', 'border'];
                const set = mode === 'light'
                    ? picks
                    : (picks.customDark && picks.dark ? { ...picks.dark } : Object.fromEntries(COLOR_KEYS.map((k) => [k, picks[k]])));
                const { fill, text } = this.fixPair(set[fillKey], set[textKey], mode, env);
                // A border drawn in the fill color moves with it.
                if (set[borderKey] === set[fillKey]) set[borderKey] = fill;
                set[fillKey] = fill;
                set[textKey] = text;
                if (mode === 'dark') Object.assign(picks, { customDark: true, dark: set });
            }
        }
        this.saveTarget(tab, picks);
    },

    buttonsView() {
        const b = this.b;
        const s = b.shape;
        // The contrast audit runs on every render, across every button, state and theme.
        const audit = this.buttonAudit();
        const targets = this.buttonTargets().map((t) => (audit.has(t.value) ? { ...t, label: `${t.label}  ⚠` } : t));
        const tab = targets.some((t) => t.value === AppState.ui.buttonTab) ? AppState.ui.buttonTab : 'primary';
        const failing = [...audit.values()].reduce((n, list) => n + list.length, 0);
        const num = (key, unit, label) => numField({ value: s[key], unit, data: { btn: `shape.${key}` }, label, fid: `btn-${key}` });
        const radii = ['radius-none', 'radius-xs', 'radius-s', 'radius', 'radius-l', 'radius-xl', 'radius-circle'];
        const shape = group({
            title: 'Shape',
            badge: 'all buttons',
            body: varTable([
                varRow('--btn-padding-block', num('paddingBlock', 'em', 'Vertical padding')),
                varRow('--btn-padding-inline', num('paddingInline', 'em', 'Horizontal padding')),
                varRow('--btn-radius', selectInput({ key: 'btn:shape.radius', value: s.radius, options: radii.map((r) => ({ value: r, label: `--${r}` })), label: 'Button radius', mono: true })),
                varRow('--btn-font-size', num('fontSize', 'rem', 'Font size')),
                varRow('--btn-font-size-s', num('fontSizeS', 'rem', 'Small font size (btn--*-s)')),
                varRow('--btn-font-size-l', num('fontSizeL', 'rem', 'Large font size (btn--*-l)')),
                varRow('--btn-font-weight', selectInput({ key: 'btn:shape.fontWeight', value: String(s.fontWeight), options: ['300', '400', '500', '600', '700', '800'], label: 'Font weight' })),
                varRow('--btn-line-height', num('lineHeight', '×', 'Line height')),
                varRow('--btn-letter-spacing', num('letterSpacing', 'em', 'Letter spacing')),
                varRow('--btn-border-width', num('borderWidth', 'px', 'Border width')),
                varRow('--btn-gap', num('gap', 'em', 'Gap between icon and text'))
            ], { label: 'Button shape tokens', nameMax: '50%' })
        });
        const picker = switcher({ id: 'btn-tab', value: tab, options: targets, label: 'Button variant', size: 'sm' });
        const fixAll = failing
            ? `<button type="button" class="btn-audit" data-action="btn-fix-all" data-fid="btn-fix-all" title="Change only the failing text colors">${failing} contrast ${failing === 1 ? 'issue' : 'issues'} · Fix all</button>` : '';
        const variant = group({ title: 'Variants', actions: `${fixAll}<div class="btn-variant-pick">${picker}</div>`, body: this.variantBody(tab, audit.get(tab)) });
        return `${shape}${variant}`;
    },

    variantBody(tab, issues) {
        if (tab === 'link') return this.linkBody(issues);
        if (tab === 'icon') return this.iconBody();
        return this.colorBody(tab, issues);
    },

    /** Token name of a target's color key: --btn-primary-bg-hover, --btn-success-text … */
    tokenFor(tab, key) {
        const [kind, id] = tab.split(':');
        const ctx = buttonContext();
        const name = id ? (kind === 'state' ? ctx.states : ctx.brands).find((s) => s.id === id)?.name : tab;
        return `--btn-${name}-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
    },

    /** Colors of a variant or state button: Default/Hover × Light/Dark pickers. */
    colorBody(tab, issues = []) {
        const ctx = buttonContext();
        const v = targetPicks(AppState.buttons, tab, ctx);
        if (!v) return '';
        const mode = AppState.ui.buttonEditMode === 'dark' ? 'dark' : 'light';
        const state = AppState.ui.buttonEditState === 'hover' ? 'hover' : 'default';
        const keys = state === 'hover' ? HOVER_KEYS : REST_KEYS;
        const valueOf = (key, m = mode) => (m === 'dark' && v.customDark ? (v.dark?.[key] ?? v[key]) : v[key]);

        // Contrast of the pair on screen (overlays composited, transparent = page).
        const env = this.auditEnv();
        const fillKey = state === 'hover' ? 'bgHover' : 'bg';
        const textKey = state === 'hover' ? 'textHover' : 'text';
        const bg = this.shownHex(valueOf(fillKey), mode, env.pages[mode], env.info);
        const fg = valueOf(textKey) === 'currentColor' ? null : this.shownHex(valueOf(textKey), mode, bg, env.info);
        const badge = fg && bg
            ? `<span class="btn-ratio${readable(fg, bg) ? ' is-pass' : ' is-fail'}" title="APCA Lc ${apca(fg, bg).toFixed(1)} · WCAG 2 ${contrast(fg, bg).toFixed(2)}:1. Passes at Lc ${LC_TARGET}, or Lc 55 with 4.5:1.">Lc ${Math.round(apca(fg, bg))}</span>` : '';
        const has = (st, m) => issues.some((i) => i.state === st && i.mode === m);
        const reset = isTargetEdited(AppState.buttons, tab, ctx)
            ? `<button type="button" class="btn-reset" data-action="btn-reset" data-target="${esc(tab)}" data-fid="btn-reset" title="Back to the default colors">${ICON.reset}<span>Reset</span></button>` : '';

        const pick = (key) => this.colorField(`btnc:${tab}:${mode}:${key}`, valueOf(key), `${COLOR_LABELS[key]}${mode === 'dark' ? ' (dark)' : ''}`, { overlays: true, transparent: true, mode, self: this.tokenFor(tab, key).slice(2) });
        return `
          ${this.issueStrip(tab, issues)}
          <div class="btn-edit">
            <div class="btn-edit__head">
              ${this.stateToggle(state, { default: has('default', mode), hover: has('hover', mode) })}
              <div class="btn-edit__tools">${badge}${reset}${this.modeToggle('btn-edit-mode', mode, 'Edit light or dark colors', { light: has(state, 'light'), dark: has(state, 'dark') })}</div>
            </div>
            ${varTable(keys.map((key) => varRow(this.tokenFor(tab, key), pick(key))), { label: 'Button colors', nameMax: '48%' })}
          </div>`;
    },

    linkBody(issues) {
        const l = this.b.link;
        const num = (key, unit, label) => numField({ value: l[key], unit, data: { btn: `link.${key}` }, label, fid: `btn-link-${key}` });
        return `
          ${this.issueStrip('link', issues)}
          <div class="btn-edit">
            ${varTable([
                varRow('Style', selectInput({ key: 'btn:link.style', value: l.style, options: LINK_STYLES, label: 'Link underline style' })),
                varRow('--btn-link-text', this.colorField('btn:link.text', l.text, 'Link text', { self: 'btn-link-text' })),
                varRow('--btn-link-text-hover', this.colorField('btn:link.textHover', l.textHover, 'Link hover text', { self: 'btn-link-text-hover' })),
                varRow('--btn-link-underline', this.colorField('btn:link.underline', l.underline, 'Underline color', { keepText: true, overlays: true, self: 'btn-link-underline' })),
                varRow('--btn-link-underline-hover', this.colorField('btn:link.underlineHover', l.underlineHover, 'Hover underline color', { keepText: true, overlays: true, self: 'btn-link-underline-hover' })),
                varRow('--btn-link-underline-thickness', num('thickness', 'px', 'Underline thickness')),
                varRow('--btn-link-underline-offset', num('offset', 'em', 'Underline offset'))
            ], { label: 'Link button', nameMax: '50%' })}
          </div>`;
    },

    iconBody() {
        return varTable([
            varRow('Shape', dialSegmented({ key: 'btn:icon.shape', value: this.b.icon.shape, options: [{ value: 'square', label: 'Square' }, { value: 'circle', label: 'Circle' }], label: 'Icon button shape', fid: 'btn-icon-shape' }))
        ], { label: 'Icon button', nameMax: '50%' });
    },

    /* ---------------- buttons preview ---------------- */

    buttonsPreview() {
        const ctx = buttonContext();
        const mode = AppState.ui.buttonEditMode === 'dark' ? 'dark' : 'light';
        const palette = [...AppState.colors, ...AppState.stateColors].flatMap((c) => (c.shades || []).map((sh) => `--${AppState.tokenName('color', sh.name)}:${sh.hex}`));
        const theme = Object.entries(ThemeTokens.vars(currentTheme(), mode)).map(([k, v]) => `${k}:${v}`);
        const styling = this.rows().map(([, name, value]) => `--${name}:${value}`);
        const tokens = buttonRows(AppState.buttons, ctx).map(([, name, value]) => `--${name}:${value}`);
        const style = [`color-scheme:${mode}`, '--white:#ffffff', '--black:#000000', ...palette, ...theme, ...styling, ...tokens].join(';');
        const css = buttonClasses(AppState.buttons, ctx).map(([, c]) => c).join('\n');
        const btn = (cls, text, icon = '') => `<button type="button" class="${cls}">${text}${icon}</button>`;
        const title = (s) => s[0].toUpperCase() + s.slice(1);
        const states = ctx.states.filter((s) => s.colors);
        const sizes = BUTTON_SIZES.map((size) => `
              <div class="btnp__size">
                <span class="btnp__label">${size.label}</span>
                <div class="btnp__row">
                  ${btn(`btn--primary${size.suffix}`, 'Primary', ICON_SVG)}
                  ${btn(`btn--secondary${size.suffix}`, 'Secondary')}
                  <button type="button" class="btn--primary btn--icon${size.suffix}" aria-label="Add">${PLUS_SVG}</button>
                  <button type="button" class="btn--outline btn--icon${size.suffix}" aria-label="Add">${PLUS_SVG}</button>
                  <a class="btn--link${size.suffix}" href="#" data-noop>Link ${ICON_SVG}</a>
                </div>
              </div>`).join('');
        return `
          <article class="btnp" data-mode="${mode}" style="${esc(style)}">
            <style>.btnp { ${css} }</style>
            <header class="btnp__head">
              <h3>Buttons</h3>
              ${this.modeToggle('btn-edit-mode', mode, 'Preview theme')}
            </header>
            <div class="btnp__group">
              <h4>Variants</h4>
              <div class="btnp__row">
                ${COLOR_VARIANTS.map((v) => btn(`btn--${v}`, title(v))).join('')}
                ${ctx.brands.filter((s) => s.colors).map((s) => btn(`btn--${s.name}`, title(s.name))).join('')}
                <a class="btn--link" href="#" data-noop>Link ${ICON_SVG}</a>
                <button type="button" class="btn--primary" disabled>Disabled</button>
              </div>
            </div>
            ${states.length ? `
            <div class="btnp__group">
              <h4>States</h4>
              <div class="btnp__row">${states.map((s) => btn(`btn--${s.name}`, title(s.name))).join('')}</div>
            </div>` : ''}
            <div class="btnp__group">
              <h4>Sizes</h4>
              <div class="btnp__sizes">${sizes}</div>
            </div>
          </article>`;
    },

    /* ---------------- buttons events ---------------- */

    /** Shape, link, icon and Bricks settings (not colors). */
    setButton(path, value) {
        const [head, ...rest] = path.split('.');
        const section = { ...withButtonDefaults(AppState.buttons)[head] };
        section[rest[0]] = value;
        AppState.updateButtons({ [head]: section });
    },

    /** Saves picks for a variant or 'state:{id}'. */
    /** Saves picks for a target; null picks resets it to the palette default. */
    saveTarget(target, picks) {
        const store = targetStore(target, buttonContext());
        if (!store) return;
        if (!store.id) return AppState.updateButtons({ [store.key]: picks || {} });
        const saved = { ...withButtonDefaults(AppState.buttons)[store.key] };
        if (picks) saved[store.id] = picks;
        else delete saved[store.id];
        AppState.updateButtons({ [store.key]: saved });
    },

    /** One color pick. Picking in dark mode turns on dark colors, seeded from light. */
    setColor(target, mode, key, value) {
        const picks = { ...targetPicks(AppState.buttons, target, buttonContext()) };
        if (mode === 'dark') {
            const dark = picks.customDark && picks.dark ? { ...picks.dark } : Object.fromEntries(COLOR_KEYS.map((k) => [k, picks[k]]));
            dark[key] = value;
            Object.assign(picks, { customDark: true, dark });
        } else {
            picks[key] = value;
        }
        this.saveTarget(target, picks);
    },

    /** Button clicks; true when handled. */
    onButtonClick(event) {
        const el = event.target.closest('[data-action]');
        if (!el) return false;
        switch (el.dataset.action) {
            case 'btn-edit-mode': AppState.updateUi({ buttonEditMode: el.dataset.value }); return true;
            case 'btn-edit-state': AppState.updateUi({ buttonEditState: el.dataset.value }); return true;
            case 'btn-reset': this.saveTarget(el.dataset.target, null); return true;
            case 'btn-fix': this.fixTarget(el.dataset.target); return true;
            case 'btn-fix-all':
                for (const target of this.buttonAudit().keys()) this.fixTarget(target);
                return true;
            case 'btn-goto': AppState.updateUi({ buttonEditState: el.dataset.state, buttonEditMode: el.dataset.mode }); return true;
            default: return false;
        }
    },

    radiusPreview() {
        const r = this.s.radius;
        const tokens = this.rows().filter(([cat]) => cat === 'Radius').map(([, name, value]) => `--${name}:${value}`).join(';');
        const px = (v) => `${Math.round(v * 100) / 100}px`;
        const steps = [
            { name: 'radius-none', label: '0' },
            ...(r.extraSizes ? radiusScale(r) : [{ name: 'radius-m', px: r.base }]).map((s) => ({ name: s.name, label: px(s.px), base: s.name === 'radius-m' })),
            { name: 'radius-50', label: '50%' },
            { name: 'radius-circle', label: '50vw' }
        ];
        const tiles = steps.map((s) => `
          <li class="rad-tile${s.base ? ' is-base' : ''}">
            <span class="rad-tile__box" style="border-radius:var(--${s.name})"></span>
            <code>--${s.name}</code>
            <span>${s.label}${s.base ? ' · --radius' : ''}</span>
          </li>`).join('');
        const size = (name) => (r.extraSizes ? `var(--radius-${name})` : 'var(--radius)');
        return `
          <article class="preview-card rad" style="${esc(tokens)}">
            <header class="preview-card__header"><h3>Radius scale</h3><span class="preview-card__hint">--radius ${r.base}px × ${r.scale}</span></header>
            <div class="preview-card__body">
              <ol class="rad-scale">${tiles}</ol>
            </div>
          </article>
          <article class="preview-card rad" style="${esc(tokens)}">
            <header class="preview-card__header"><h3>In use</h3><span class="preview-card__hint">Suggested pairings</span></header>
            <div class="preview-card__body rad-use">
              <figure class="rad-card" style="border-radius:${size('l')}">
                <span class="rad-card__media" style="border-radius:${size('m')}"></span>
                <figcaption><b>Card</b><code>${r.extraSizes ? '--radius-l' : '--radius'} · media ${r.extraSizes ? '--radius-m' : '--radius'}</code></figcaption>
              </figure>
              <div class="rad-stack">
                <span class="rad-btn" style="border-radius:var(--radius)">Button · --radius</span>
                <span class="rad-input" style="border-radius:var(--radius)">Input · --radius</span>
                <span class="rad-row">
                  <span class="rad-avatar" style="border-radius:var(--radius-50)"></span>
                  <span class="rad-tag" style="border-radius:var(--radius-circle)">Tag · --radius-circle</span>
                  <span class="rad-chip" style="border-radius:${size('xs')}">${r.extraSizes ? '--radius-xs' : '--radius'}</span>
                </span>
              </div>
            </div>
          </article>`;
    },

    /* ---------------- preview ---------------- */

    preview(view) {
        const mode = AppState.ui.previewMode;
        if (mode === 'example') return ExampleSite.productFrame();
        if (mode === 'code') {
            const rows = this.rows().map(([, name, value]) => `  --${name}: ${value};`).join('\n');
            return `<pre class="code-block"><code>${highlight(`:root {\n${rows}\n}\n\n${this.css()}`)}</code></pre>`;
        }
        if (view === 'radius') return this.radiusPreview();
        if (view === 'buttons') return this.buttonsPreview();
        const model = currentTheme();
        const colors = this.colors(model);
        const boards = ['light', 'dark'].map((m) => this.board(view, m, model, colors)).join('');
        return `<div class="sty-boards">${boards}</div>`;
    },

    board(view, mode, model, colors) {
        const scope = `.sty-board[data-mode="${mode}"]`;
        const palette = [...AppState.colors, ...AppState.stateColors]
            .flatMap((c) => (c.shades || []).map((s) => `--${AppState.tokenName('color', s.name)}:${s.hex}`));
        const theme = Object.entries(ThemeTokens.vars(model, mode)).map(([k, v]) => `${k}:${v}`);
        const tokens = this.rows().map(([, name, value]) => `--${name}:${value}`);
        const style = [...palette, ...theme, ...tokens].join(';');
        const hex = (name) => colors.find((c) => c.name === name)?.[mode] || null;
        const surface = hex('surface-1');
        const badge = (a, b, min, label) => {
            if (!a || !b) return '';
            const ratio = contrast(a, b);
            return `<span class="sty-badge${ratio >= min ? ' is-pass' : ' is-fail'}" title="${esc(label)}">${ratio.toFixed(1)}:1 ${ratio >= min ? '✓' : '✕'}</span>`;
        };
        const body = view === 'transition' ? this.transitionDemo() : view === 'selection' ? this.selectionDemo(hex, badge) : this.focusDemo(hex, badge, surface);
        return `
          <article class="sty-board" data-mode="${mode}" style="${esc(style)}">
            <style>${this.css({ scope })}
${scope} .is-focus { ${this.s.focus.style === 'ring'
        ? 'outline: var(--focus-width) solid transparent; box-shadow: 0 0 0 var(--focus-width) var(--focus-color);'
        : 'outline: var(--focus-width) solid var(--focus-color); outline-offset: var(--focus-offset);'} }
${scope} .is-focus-field { ${this.s.focus.field === 'halo'
        ? 'outline: var(--focus-width) solid transparent; border-color: var(--focus-color); box-shadow: 0 0 0 var(--focus-ring-width) var(--focus-ring-color);'
        : (this.s.focus.style === 'ring'
            ? 'outline: var(--focus-width) solid transparent; box-shadow: 0 0 0 var(--focus-width) var(--focus-color);'
            : 'outline: var(--focus-width) solid var(--focus-color); outline-offset: var(--focus-offset);')} }</style>
            <header class="sty-board__head"><h3>${mode === 'light' ? 'Light' : 'Dark'}</h3><span>data-brx-theme="${mode}"</span></header>
            ${body}
          </article>`;
    },

    focusDemo(hex, badge, surface) {
        const f = this.s.focus;
        return `
          <div class="sty-demo">
            <p class="sty-demo__label">Focused <span>(static)</span>${badge(hex(f.color), surface, 3, 'Focus color vs --surface-1, needs 3:1')}</p>
            <div class="sty-row">
              <button type="button" class="sty-btn sty-btn--primary is-focus" tabindex="-1">Primary</button>
              <button type="button" class="sty-btn is-focus" tabindex="-1">Secondary</button>
              <a class="sty-link is-focus" tabindex="-1">Text link</a>
              <input class="sty-input is-focus-field" tabindex="-1" value="Field" aria-label="Focused field example">
            </div>
            <p class="sty-demo__label">Try it <span>click here, then press Tab</span></p>
            <div class="sty-row">
              <button type="button" class="sty-btn sty-btn--primary">Primary</button>
              <button type="button" class="sty-btn">Secondary</button>
              <a class="sty-link" href="#" data-noop>Text link</a>
              <input class="sty-input" placeholder="Input" aria-label="Demo input">
            </div>
          </div>`;
    },

    transitionDemo() {
        const t = this.s.transition;
        const [x1, y1, x2, y2] = timingPoints(t.timing);
        const Y = (v) => 100 - v * 80 - 10; // leave room for overshoot
        const path = `M0 ${Y(0)} C${x1 * 100} ${Y(y1)} ${x2 * 100} ${Y(y2)} 100 ${Y(1)}`;
        const label = TIMING_PRESETS.find((p) => p.value === t.timing)?.label || 'Custom';
        return `
          <div class="sty-demo">
            <div class="sty-curve">
              <svg viewBox="-4 -4 108 108" aria-hidden="true">
                <path d="M0 ${Y(0)} L100 ${Y(1)}" class="sty-curve__linear"/>
                <path d="M0 ${Y(0)} L${x1 * 100} ${Y(y1)} M100 ${Y(1)} L${x2 * 100} ${Y(y2)}" class="sty-curve__handle"/>
                <path d="${path}" class="sty-curve__path"/>
              </svg>
              <div class="sty-curve__meta"><b>${t.duration}ms</b><span>${esc(label)}</span>${t.delay ? `<span>delay ${t.delay}ms</span>` : ''}</div>
            </div>
            <p class="sty-demo__label">Hover <span>uses var(--transition)</span></p>
            <div class="sty-row">
              <button type="button" class="sty-btn sty-btn--primary sty-btn--hover">Primary</button>
              <button type="button" class="sty-btn sty-btn--hover">Secondary</button>
              <a class="sty-link sty-link--hover" href="#" data-noop>Text link</a>
            </div>
            <p class="sty-demo__label">Play <span>colors, border, shadow and translate at once</span></p>
            <button type="button" class="sty-play" data-action="play-transition" data-fid="sty-play"><span class="sty-play__dot"></span>Toggle state</button>
          </div>`;
    },

    selectionDemo(hex, badge) {
        const sel = this.s.selection;
        if (!sel.enabled) return '<div class="sty-demo"><p class="sty-demo__label">Selection styling is off.</p></div>';
        const text = sel.text === 'currentColor' ? hex('text-primary') : hex(sel.text);
        const textAlt = sel.textAlt === 'currentColor' ? hex('text-primary') : hex(sel.textAlt);
        return `
          <div class="sty-demo">
            <p class="sty-demo__label">Page${badge(hex(sel.bg), text, 4.5, 'Selected text vs selection background, needs 4.5:1')}</p>
            <p class="sty-text">Design tokens <span class="sty-selected">keep every page</span> consistent. Select any of this text to try it.</p>
            <p class="sty-demo__label">.inverse / .selection--alt${badge(hex(sel.bgAlt), textAlt, 4.5, 'Selected text vs alt selection background, needs 4.5:1')}</p>
            <p class="sty-text sty-text--inverse inverse">Inverse surfaces <span class="sty-selected sty-selected--alt">use the alt colors</span> so selection stays visible.</p>
          </div>`;
    },

    /* ---------------- events ---------------- */

    set(path, value) {
        const [group, key] = path.split('.');
        const s = withDefaults(AppState.styling);
        AppState.updateStyling({ [group]: { ...s[group], [key]: value } });
    },

    onSwitch({ id, value }) {
        if (id === 'styling-view') return AppState.updateUi({ stylingView: value });
        if (id === 'btn-tab') return AppState.updateUi({ buttonTab: value });
        if (id?.startsWith('btnc:')) {
            // btnc:{target}:{mode}:{key}; the target itself may contain ':' (state:{id}).
            const parts = id.slice(5).split(':');
            const key = parts.pop();
            const mode = parts.pop();
            return this.setColor(parts.join(':'), mode, key, value);
        }
        if (id?.startsWith('btn:')) return this.setButton(id.slice(4), id === 'btn:shape.fontWeight' ? Number(value) : value);
        if (/^(focus|transition|selection)\./.test(id)) this.set(id, value);
    },

    onDial({ key, value, live }) {
        if (live) return;
        if (key === 'btn:tab') return AppState.updateUi({ buttonTab: value });
        if (key.startsWith('btn:')) return this.setButton(key.slice(4), value);
        if (!/^(focus|transition|selection|radius)\./.test(key)) return;
        this.set(key, value);
    },

    onClick(event) {
        if (this.onButtonClick(event)) return;
        const play = event.target.closest('[data-action="play-transition"]');
        if (play) play.classList.toggle('is-on');
    },

    onChange(event) {
        if (event.target.matches('[data-radius-selectors]')) return this.set('radius.autoSelectors', event.target.value);
        const btn = event.target.dataset.btn;
        if (btn) {
            const [min, max] = SHAPE_LIMITS[btn.split('.')[1]];
            const value = readNum(event.target.value, min, max);
            if (value === null) return AppState.notify('buttons');
            return this.setButton(btn, value);
        }
        const path = event.target.dataset.styling;
        if (!path) return;
        const [min, max] = LIMITS[path.split('.')[1]];
        const value = readNum(event.target.value, min, max);
        if (value === null) return AppState.notify('styling');
        this.set(path, value);
    }
};

export default StylingModule;
