import { highlight } from '../ui/highlight.js';
import AppState from '../state/appState.js';
import TypographyCalculator, { TYPE_STYLE_DEFAULTS, parseLineHeight, buildLineHeight, parseLetterSpacing } from '../core/typographyCalculator.js';
import {
    TYPE_RATIOS, CORE_TYPE_RATIOS, parseSteps, nextStep, stepLabel,
    addStepBefore, addStepAfter, removeStepBefore, removeStepAfter,
    DEFAULT_TYPE_STEPS, DEFAULT_TYPE_BASE
} from '../core/fluidScale.js';
import {
    esc, switcher, group, option, stepper, unitInput, textInput, selectInput,
    ratioPresets, tokenTable, iconButton, scaleEnds, varTable, varRow, numField, readNum, ICON
} from '../ui/components.js';
import ExampleSite from '../ui/exampleSite.js';
import { roleOptions, headingRole, bodyRole } from '../state/fontModel.js';
import { dialSwitch } from '../ui/dial.js';
import { rangeField, rangeFieldSync } from '../ui/rangeField.js';
import TypeMeter from '../ui/typeMeter.js';

const VIEWS = [
    { value: 'scale', label: 'Type Scale' },
    { value: 'headings', label: 'Headings' },
    { value: 'body', label: 'Body text' }
];

const RATIOS = TYPE_RATIOS;

const HEADING_MODES = [
    { value: 'auto', label: 'Auto: follow the type scale', icon: 'bolt' },
    { value: 'manual', label: 'Manual: set max and min', icon: 'pencil' }
];

const HEADING_TABS = [
    { value: 'all', label: 'All headings' },
    { value: 'h1', label: 'Heading 1' },
    { value: 'h2', label: 'Heading 2' },
    { value: 'h3', label: 'Heading 3' },
    { value: 'h4', label: 'Heading 4' }
];

const WEIGHTS = ['300', '400', '500', '600', '700', '800'];
const WRAPS = [
    { value: 'pretty', label: 'Pretty' },
    { value: 'balance', label: 'Balance' },
    { value: 'wrap', label: 'Wrap' },
    { value: 'nowrap', label: 'No wrap' }
];

const LIMITS = {
    baseTextMobile: [10, 40],
    baseTextDesktop: [10, 48],
    minViewport: [280, 1000],
    maxViewport: [600, 2560],
    mobileTypeScaleRatio: [1, 2],
    desktopTypeScaleRatio: [1, 2]
};

/**
 * Line height and letter spacing sliders, per role. The line-height slider is
 * the ratio at a reference size (H1 at the desktop size; the body font size):
 * buildLineHeight() turns it into the ex-based formula for the role's font.
 */
const LINE = {
    heading: {
        key: 'headingLineHeight', fx: 'fxHeadingLh', min: 0.8, max: 2,
        marks: [{ value: 0.8, label: '0.8', end: true }, { value: 1, label: 'Tight' }, { value: 1.15, label: 'Normal' }, { value: 1.35, label: 'Loose' }, { value: 2, label: '2.0', end: true }]
    },
    body: {
        key: 'bodyLineHeight', fx: 'fxBodyLh', min: 0.8, max: 2,
        marks: [{ value: 0.8, label: '0.8', end: true }, { value: 1.25, label: 'Tight' }, { value: 1.5, label: 'Normal' }, { value: 1.75, label: 'Loose' }, { value: 2, label: '2.0', end: true }]
    }
};
const SPACING = {
    heading: { key: 'headingLetterSpacing', fx: 'fxHeadingLs' },
    body: { key: 'bodyLetterSpacing', fx: 'fxBodyLs' },
    min: -0.05, max: 0.1,
    marks: [{ value: -0.05, label: 'Tighter', end: true }, { value: 0, label: '0' }, { value: 0.1, label: 'Wider', end: true }]
};
const LINE_TOLERANCE = 0.035;
const trimNum = (n, d) => String(Number(Number(n).toFixed(d)));

const SAMPLE = 'The quick brown fox jumps over the lazy dog';
const SCALE_SAMPLE = 'Almost before we knew it, we had left the ground.';

const TypographyModule = {
    title: 'Type Preview',
    previewModes: true,

    init() {
        this.generateScale();
    },

    generateScale() {
        AppState.typography.scale = TypographyCalculator.generateScale(AppState.typography);
    },

    ratioKey() {
        return AppState.ui.ratioDevice === 'mobile' ? 'mobileTypeScaleRatio' : 'desktopTypeScaleRatio';
    },

    scaleSteps() {
        return parseSteps(AppState.typography.scaleSteps || DEFAULT_TYPE_STEPS);
    },

    baseIndex() {
        const steps = this.scaleSteps();
        const index = Number(AppState.typography.baseScaleIndex);
        if (!Number.isInteger(index) || index < 0 || index >= steps.length) return DEFAULT_TYPE_BASE;
        return index;
    },

    applySteps(next) {
        AppState.updateTypography({ scaleSteps: next.steps, baseScaleIndex: next.baseScaleIndex });
    },

    /* ---------------- view ---------------- */

    view() {
        this.generateScale();
        const view = AppState.ui.typeView;
        const top = switcher({ id: 'type', value: view, options: VIEWS, label: 'Typography view' });
        const body = view === 'headings' ? this.headingsView() : view === 'body' ? this.bodyView() : this.scaleView();
        return {
            control: `<div class="control__stack">${top}${body}</div>`,
            preview: this.preview()
        };
    },

    viewport() {
        const t = AppState.typography;
        return group({
            title: 'Viewport range',
            badge: `${t.minViewport}px → ${t.maxViewport}px`,
            body: `
              ${option('Minimum (Mobile)', unitInput({ key: 'minViewport', value: t.minViewport, label: 'Minimum viewport', id: 'type-minvp' }), 'type-minvp')}
              ${option('Maximum (Desktop)', unitInput({ key: 'maxViewport', value: t.maxViewport, label: 'Maximum viewport', id: 'type-maxvp' }), 'type-maxvp')}`
        });
    },

    scaleView() {
        const t = AppState.typography;
        const key = this.ratioKey();
        const device = AppState.ui.ratioDevice;
        const ratio = Number(t[key]);
        const deviceToggle = `
          <div class="segmented segmented--sm" role="group" aria-label="Edit ratio for">
            <button type="button" class="segmented__btn" data-action="device" data-value="desktop" aria-pressed="${device === 'desktop'}" title="Desktop ratio" aria-label="Desktop ratio" data-fid="device-desktop">${ICON.desktop}</button>
            <button type="button" class="segmented__btn" data-action="device" data-value="mobile" aria-pressed="${device === 'mobile'}" title="Mobile ratio" aria-label="Mobile ratio" data-fid="device-mobile">${ICON.mobile}</button>
          </div>`;
        const steps = this.scaleSteps();
        const base = this.baseIndex();
        const onRecommended = Math.abs(t.mobileTypeScaleRatio - CORE_TYPE_RATIOS.mobile) < 0.0005
            && Math.abs(t.desktopTypeScaleRatio - CORE_TYPE_RATIOS.desktop) < 0.0005;
        return `
          ${group({
              title: 'Font size range',
              badge: `${t.baseTextMobile}px → ${t.baseTextDesktop}px`,
              body: `
                ${option('Minimum (Mobile)', stepper({ key: 'baseTextMobile', value: t.baseTextMobile, label: 'Minimum font size' }))}
                ${option('Maximum (Desktop)', stepper({ key: 'baseTextDesktop', value: t.baseTextDesktop, label: 'Maximum font size' }))}
                ${option('Base step', selectInput({
                    key: 'base-step',
                    value: String(base),
                    options: steps.map((step, index) => ({ value: String(index), label: stepLabel(step) })),
                    label: 'Base scale step'
                }))}`
          })}
          ${group({
              title: 'Type scale ratio',
              badge: `${t.mobileTypeScaleRatio} → ${t.desktopTypeScaleRatio}`,
              actions: onRecommended ? '' : iconButton({ action: 'recommend-ratios', label: 'Reset to recommended ratios', icon: 'reset' }),
              body: `
                <div class="panel__corner">${deviceToggle}</div>
                <div class="ratio">
                  <p class="ratio__label">${device === 'mobile' ? 'Mobile' : 'Desktop'} ratio</p>
                  ${stepper({ key, value: ratio, step: 0.001, decimals: 3, label: `${device} type scale ratio` })}
                </div>
                ${ratioPresets({ ratios: RATIOS, value: ratio, recommended: CORE_TYPE_RATIOS[device], device, label: 'Type scale presets' })}`
          })}
          ${this.stepControls()}
          ${this.viewport()}`;
    },

    headingsView() {
        const t = AppState.typography;
        const focus = AppState.ui.headingFocus;
        const headings = t.scale.headings.filter((h) => focus === 'all' || h.name === focus);
        const manual = t.headingMode === 'manual';
        const px = (n) => Number(n.toFixed(2));
        const stepOptions = this.scaleSteps().map((step) => ({ value: step, label: stepLabel(step) }));
        const field = (h, bound, value) => numField({
            tag: bound === 'max' ? 'Max' : 'Min',
            value: px(value),
            data: { heading: h.name, bound },
            label: `${h.name} ${bound === 'max' ? 'desktop' : 'mobile'} size in px`,
            fid: `${h.name}-${bound}`
        });
        const rows = headings.map((h) => varRow(`--${AppState.tokenName('type', h.name)}`, manual
            ? `${field(h, 'max', h.maxSizePx)}${field(h, 'min', h.minSizePx)}`
            : `${switcher({ id: `hstep-${h.name}`, value: h.scaleStep, options: stepOptions, label: `${h.name} scale step`, size: 'sm', extraClass: 'switcher--mono' })}
               <span class="var-row__meta">${px(h.maxSizePx)} / ${px(h.minSizePx)}px</span>`, { cols: 2 }));
        const anyCustom = manual && t.scale.headings.some((h) => h.isCustom);
        const modeToggle = `
          <div class="segmented segmented--sm" role="group" aria-label="Heading sizing mode">
            ${HEADING_MODES.map((m) => `
              <button type="button" class="segmented__btn" data-action="heading-mode" data-value="${m.value}"
                      aria-pressed="${(manual ? 'manual' : 'auto') === m.value}" title="${m.label}" aria-label="${m.label}"
                      data-fid="heading-mode-${m.value}">${ICON[m.icon]}</button>`).join('')}
          </div>`;
        const sizeActions = `${anyCustom ? iconButton({ action: 'reset-all-headings', label: 'Reset all headings to scale', icon: 'reset' }) : ''}${modeToggle}`;

        const tabs = `
          <div class="tabs" role="group" aria-label="Heading">
            ${HEADING_TABS.map((tab) => `<button type="button" class="tab" data-action="heading-tab" data-value="${tab.value}" data-fid="tab-${tab.value}" aria-pressed="${focus === tab.value}">${tab.label}</button>`).join('')}
          </div>`;
        const styleChanged = Object.entries(TYPE_STYLE_DEFAULTS.heading).some(([k, v]) => String(t[k] ?? '') !== String(v));
        return `
          ${tabs}
          ${this.viewport()}
          ${group({
              title: 'Heading sizes',
              actions: sizeActions,
              body: `
                ${varTable(rows, { label: 'Heading sizes' })}`
          })}
          ${group({
              title: 'Heading setting',
              actions: `${styleChanged ? iconButton({ action: 'reset-heading-style', label: 'Reset heading settings to defaults (keeps the font)', icon: 'reset' }) : ''}${this.manageFonts()}`,
              body: `
                ${option('Font family', selectInput({ key: 'headingFont', value: t.headingFont, options: roleOptions(), label: 'Heading font family', id: 'h-ff' }), 'h-ff')}
                ${option('Color', textInput({ key: 'headingColor', value: t.headingColor, label: 'Heading color', id: 'h-color' }), 'h-color')}
                ${this.lineField('heading')}
                ${this.spacingField('heading')}
                ${option('Font weight', selectInput({ key: 'headingWeight', value: t.headingWeight, options: WEIGHTS, label: 'Heading font weight', id: 'h-fw' }), 'h-fw')}
                ${option('Text wrap', selectInput({ key: 'textWrap', value: t.textWrap, options: WRAPS, label: 'Heading text wrap', id: 'h-tw' }), 'h-tw')}`
          })}`;
    },

    bodyView() {
        const t = AppState.typography;
        const on = t.enableBodySizes !== false;
        // Fixed sizes (when on) and the fluid text sizes.
        const sizeOptions = [...(on ? t.scale.body : []), ...t.scale.textSizes].map((b) => ({ value: `var(--${AppState.tokenName('type', b.name)})`, label: `var(--${AppState.tokenName('type', b.name)})` }));
        const rows = t.scale.body.map((b) => `
          <tr>
            <th scope="row">--${esc(AppState.tokenName('type', b.name))}</th>
            <td>
              <span class="unit-input unit-input--wide">
                <input type="number" min="8" max="64" step="1" value="${b.sizePx}" data-body-size="${b.name}" data-fid="body-${b.name}" aria-label="${b.name} size in px">
                <span class="unit-input__unit" aria-hidden="true">px</span>
              </span>
            </td>
            <td class="token-table__meta">${esc(b.size)}</td>
          </tr>`);
        const styleChanged = Object.entries(TYPE_STYLE_DEFAULTS.body).some(([k, v]) => String(t[k] ?? '') !== String(v));
        return `
          ${group({
              title: 'Body text setting',
              actions: `${styleChanged ? iconButton({ action: 'reset-body-style', label: 'Reset body text settings to defaults (keeps the font and size)', icon: 'reset' }) : ''}${this.manageFonts()}`,
              body: `
                ${option('Font family', selectInput({ key: 'bodyFont', value: t.bodyFont, options: roleOptions(), label: 'Body font family', id: 'b-ff' }), 'b-ff')}
                ${option('Font size', selectInput({ key: 'bodyFontSize', value: t.bodyFontSize, options: sizeOptions, label: 'Body font size', id: 'b-fs', mono: true }), 'b-fs')}
                ${option('Color', textInput({ key: 'bodyColor', value: t.bodyColor, label: 'Body color', id: 'b-color' }), 'b-color')}
                ${this.lineField('body')}
                ${this.spacingField('body')}
                ${option('Font weight', selectInput({ key: 'bodyWeight', value: t.bodyWeight, options: WEIGHTS, label: 'Body font weight', id: 'b-fw' }), 'b-fw')}
                ${option('Text wrap', selectInput({ key: 'bodyTextWrap', value: t.bodyTextWrap, options: WRAPS, label: 'Body text wrap', id: 'b-tw' }), 'b-tw')}`
          })}
          ${group({
              title: 'Fixed body sizes',
              actions: `${on ? iconButton({ action: 'reset-body', label: 'Reset body sizes', icon: 'reset' }) : ''}${dialSwitch({ key: 'enableBodySizes', label: 'Fixed body sizes', checked: on, bare: true, fid: 'body-sizes-on' })}`,
              body: on
                  ? `${tokenTable({ rows, caption: 'Fixed body sizes' })}
                <p class="dk-hint">Static px sizes for labels and UI text. Exported as variables and as .text-12 … utility classes.</p>`
                  : '<p class="dk-hint">Off: no fixed --text-12 … variables or classes are exported. Body text uses the fluid scale.</p>'
          })}`;
    },

    /* ---------------- line height + letter spacing ---------------- */

    /** Font, weight and the reference size a role's sliders are read at. */
    role(role) {
        const t = AppState.typography;
        const font = role === 'heading' ? headingRole() : bodyRole();
        const weight = role === 'heading' ? t.headingWeight : t.bodyWeight;
        let refPx = 16;
        if (role === 'heading') {
            const h1 = t.scale.headings.find((h) => h.name === 'h1') || t.scale.headings[0];
            if (h1) refPx = h1.maxSizePx;
        } else {
            const all = [...(t.scale.body || []), ...(t.scale.textSizes || [])];
            const hit = all.find((x) => `var(--${AppState.tokenName('type', x.name)})` === t.bodyFontSize);
            if (hit) refPx = hit.sizePx ?? hit.maxSizePx;
        }
        return { stack: font.stack, weight, refPx };
    },

    /** Slider value for the stored line height (measured, so custom formulas show too). */
    lineState(role) {
        const formula = AppState.typography[LINE[role].key];
        const r = this.role(role);
        const ratio = TypeMeter.lineRatio(formula, r.stack, r.weight, r.refPx);
        return { formula, ratio, custom: !parseLineHeight(formula), invalid: ratio == null };
    },

    lineField(role) {
        const cfg = LINE[role];
        const s = this.lineState(role);
        const fxOn = AppState.ui[cfg.fx] ?? (s.custom || s.invalid);
        return rangeField({
            id: `lh-${role}`,
            label: 'Line height',
            value: s.ratio ?? cfg.min,
            min: cfg.min, max: cfg.max, step: 0.01, decimals: 2, unit: 'em',
            marks: cfg.marks,
            tolerance: LINE_TOLERANCE,
            chip: s.invalid ? 'Invalid' : s.custom ? 'Custom' : undefined,
            fx: {
                on: fxOn,
                title: 'Edit the CSS formula',
                field: textInput({ key: cfg.key, value: s.formula, label: `${role === 'heading' ? 'Heading' : 'Body'} line height formula`, id: `${role}-lh-formula` })
            },
            fid: `lh-${role}`
        });
    },

    spacingState(role) {
        const value = AppState.typography[SPACING[role].key] ?? '0em';
        const r = this.role(role);
        const em = parseLetterSpacing(value);
        const measured = em ?? TypeMeter.letterEm(value, r.stack, r.weight, r.refPx);
        return { value, em: measured, custom: em == null, invalid: measured == null };
    },

    spacingField(role) {
        const cfg = SPACING[role];
        const s = this.spacingState(role);
        const fxOn = AppState.ui[cfg.fx] ?? (s.custom || s.invalid);
        return rangeField({
            id: `ls-${role}`,
            label: 'Letter spacing',
            value: s.em ?? 0,
            min: SPACING.min, max: SPACING.max, step: 0.001, decimals: 3, unit: 'em',
            marks: SPACING.marks,
            tolerance: 0.0015,
            chip: s.invalid ? 'Invalid' : s.custom ? 'Custom' : '',
            fx: {
                on: fxOn,
                title: 'Type a CSS value (px, em, calc() …)',
                field: textInput({ key: cfg.key, value: s.value, label: `${role === 'heading' ? 'Heading' : 'Body'} letter spacing`, id: `${role}-ls-value` })
            },
            fid: `ls-${role}`
        });
    },

    /** Slider or number value → { key, css } to store. */
    rangeValue(id, value) {
        const [kind, role] = id.split('-');
        if (kind === 'lh') {
            const r = this.role(role);
            const current = AppState.typography[LINE[role].key];
            return { key: LINE[role].key, css: buildLineHeight({ ratio: value, refPx: r.refPx, exPx: TypeMeter.exPx(r.stack, r.weight, r.refPx), role, current }) };
        }
        return { key: SPACING[role].key, css: `${trimNum(Math.round(value * 1000) / 1000, 3)}em` };
    },

    applyRange(id, raw, live) {
        const [kind, role] = String(id).split('-');
        if (!LINE[role] || !['lh', 'ls'].includes(kind)) return;
        const isLine = kind === 'lh';
        const min = isLine ? LINE[role].min : SPACING.min;
        const max = isLine ? LINE[role].max : SPACING.max;
        const n = Number(raw);
        if (!Number.isFinite(n)) return AppState.notify('typography');
        const value = Math.min(max, Math.max(min, n));
        const { key, css } = this.rangeValue(id, value);
        if (!live) {
            // Slider or number used: the value is ours again, so the fx field closes.
            AppState.ui = { ...AppState.ui, [isLine ? LINE[role].fx : SPACING[role].fx]: undefined };
            return this.set(key, css);
        }
        this.set(key, css, { live: true });
        const field = document.querySelector(`[data-range-field="${id}"]`);
        rangeFieldSync(field, value, isLine
            ? { marks: LINE[role].marks, tolerance: LINE_TOLERANCE }
            : { marks: SPACING.marks, tolerance: 0.0015, chip: '' });
    },

    /** Defaults for a settings card. Font family and size stay: they belong to the font library. */
    resetStyle(role) {
        const fx = role === 'heading' ? { fxHeadingLh: undefined, fxHeadingLs: undefined } : { fxBodyLh: undefined, fxBodyLs: undefined };
        AppState.ui = { ...AppState.ui, ...fx };
        AppState.updateTypography({ ...TYPE_STYLE_DEFAULTS[role] });
    },

    manageFonts() {
        return `<button type="button" class="icon-btn icon-btn--label" data-action="manage-fonts" data-fid="manage-fonts">Manage fonts</button>`;
    },

    stepControls() {
        const steps = this.scaleSteps();
        return group({
            title: 'Scale steps',
            badge: `${stepLabel(steps[0])} → ${stepLabel(steps[steps.length - 1])}`,
            body: `
              <div class="step-rail">
                ${scaleEnds({
                    next: nextStep(steps.join(','), 'before'),
                    current: steps[0],
                    actionAdd: 'add-step-before',
                    actionRemove: 'remove-step-before',
                    canRemove: steps.length > 1,
                    fid: 'type-before'
                })}
                ${scaleEnds({
                    next: nextStep(steps.join(','), 'after'),
                    current: steps[steps.length - 1],
                    actionAdd: 'add-step-after',
                    actionRemove: 'remove-step-after',
                    canRemove: steps.length > 1,
                    fid: 'type-after'
                })}
              </div>`
        });
    },

    paintLive() {
        const body = document.getElementById('previewBody');
        if (!body) return;
        if (AppState.ui.previewMode === 'example') {
            ExampleSite.refresh();
            return;
        }
        body.innerHTML = this.preview();
    },

    /* ---------------- preview ---------------- */

    preview() {
        const mode = AppState.ui.previewMode;
        const t = AppState.typography;
        const view = AppState.ui.typeView;
        const focus = AppState.ui.headingFocus;
        const headings = t.scale.headings.filter((h) => view !== 'headings' || focus === 'all' || h.name === focus);
        const tokens = view === 'body' ? t.scale.body : view === 'headings' ? headings : t.scale.textSizes;

        if (mode === 'code') return `<pre class="code-block"><code>${highlight(this.css(tokens))}</code></pre>`;
        if (mode === 'example') return ExampleSite.productFrame();

        const headingStyle = `font-family:${esc(headingRole().stack)};font-weight:${esc(t.headingWeight)};letter-spacing:${esc(t.headingLetterSpacing)};line-height:${esc(t.headingLineHeight)};text-wrap:${esc(t.textWrap)}`;
        const bodyStyle = `font-family:${esc(bodyRole().stack)};font-weight:${esc(t.bodyWeight)};letter-spacing:${esc(t.bodyLetterSpacing || '0em')};line-height:${esc(t.bodyLineHeight)};text-wrap:${esc(t.bodyTextWrap)}`;
        const desktop = AppState.ui.ratioDevice !== 'mobile';
        const px = (n) => trimNum(n, 2);
        // Specimens show one device's size (the switch in the card header), not the window-dependent clamp.
        const specimen = (tk, style, isHeading) => {
            const min = tk.minSizePx ?? tk.sizePx;
            const max = tk.maxSizePx ?? tk.sizePx;
            const size = desktop ? max : min;
            return `
          <li class="specimen">
            <div class="specimen__meta">
              <span class="specimen__token">--${esc(AppState.tokenName('type', tk.name))}</span>
              <span class="specimen__sizes">
                <span class="specimen__size${desktop ? '' : ' is-on'}" title="Mobile (${t.minViewport}px)">${ICON.mobile}${px(min)}px</span>
                <span class="specimen__size${desktop ? ' is-on' : ''}" title="Desktop (${t.maxViewport}px)">${ICON.desktop}${px(max)}px</span>
              </span>
            </div>
            <p class="specimen__text" style="font-size:${size / 16}rem;${style}">${isHeading ? SAMPLE : `${SAMPLE}. Good typography creates rhythm and hierarchy that readers can follow.`}</p>
          </li>`;
        };
        const deviceSwitch = `
          <div class="segmented segmented--sm" role="group" aria-label="Preview size">
            <button type="button" class="segmented__btn segmented__btn--text type-device" data-action="device" data-value="desktop" aria-pressed="${desktop}" data-fid="preview-desktop">${ICON.desktop}<span>Desktop · ${t.maxViewport}</span></button>
            <button type="button" class="segmented__btn segmented__btn--text type-device" data-action="device" data-value="mobile" aria-pressed="${!desktop}" data-fid="preview-mobile">${ICON.mobile}<span>Mobile · ${t.minViewport}</span></button>
          </div>`;

        if (view === 'scale') {
            const rows = [...t.scale.textSizes].reverse().map((tk) => {
                const size = desktop ? tk.maxSizePx : tk.minSizePx;
                return `
              <li class="type-scale__row${tk.isBase ? ' is-base' : ''}">
                <div class="type-scale__meta">
                  <span class="type-scale__name">${esc(tk.label || tk.name)}${tk.isBase ? '<span class="scale-base">Base</span>' : ''}</span>
                  <span class="specimen__sizes">
                    <span class="specimen__size${desktop ? '' : ' is-on'}" title="Mobile (${t.minViewport}px) · ${esc(tk.minSize)}">${ICON.mobile}${px(tk.minSizePx)}px</span>
                    <span class="specimen__size${desktop ? ' is-on' : ''}" title="Desktop (${t.maxViewport}px) · ${esc(tk.maxSize)}">${ICON.desktop}${px(tk.maxSizePx)}px</span>
                  </span>
                </div>
                <p class="type-scale__text" style="font-size:${size / 16}rem;${bodyStyle}">${SCALE_SAMPLE}</p>
              </li>`;
            }).join('');
            return `
              <article class="preview-card preview-card--scale">
                <header class="preview-card__header"><h3>Type scale</h3>${deviceSwitch}</header>
                <ol class="type-scale" aria-label="Type scale">${rows}</ol>
              </article>`;
        }
        if (view === 'body') {
            // Fixed sizes when they're on, else the fluid text sizes body copy can use.
            const fixed = t.enableBodySizes !== false && t.scale.body?.length;
            const list = fixed ? t.scale.body : t.scale.textSizes;
            return `
              <article class="preview-card">
                <header class="preview-card__header"><h3>${fixed ? 'Body sizes' : 'Text sizes'}</h3>${deviceSwitch}</header>
                <ol class="specimens">${list.map((b) => specimen(b, bodyStyle, false)).join('')}</ol>
              </article>`;
        }
        return `
          <article class="preview-card">
            <header class="preview-card__header"><h3>Headings</h3>${deviceSwitch}</header>
            <ol class="specimens">${headings.map((h) => specimen(h, headingStyle, true)).join('')}</ol>
          </article>`;
    },

    css(tokens) {
        return `:root {\n${tokens.map((tk) => `  --${AppState.tokenName('type', tk.name)}: ${tk.clamp || tk.size};`).join('\n')}\n}`;
    },

    /* ---------------- events ---------------- */

    set(key, raw, { live = false } = {}) {
        const t = AppState.typography;
        if (key in LIMITS) {
            let value = Number(raw);
            if (!Number.isFinite(value)) {
                if (!live) AppState.notify('typography');
                return;
            }
            const [min, max] = LIMITS[key];
            value = Math.min(max, Math.max(min, value));
            if (key.includes('Ratio')) value = Math.round(value * 1000) / 1000;
            if (key === 'minViewport' && value >= t.maxViewport) value = t.maxViewport - 1;
            if (key === 'maxViewport' && value <= t.minViewport) value = t.minViewport + 1;
            if (live) {
                t[key] = value;
                this.generateScale();
                this.paintLive();
                return;
            }
            AppState.updateTypography({ [key]: value });
            return;
        }
        const next = String(raw).trim();
        if (live) {
            t[key] = next;
            this.generateScale();
            this.paintLive();
            return;
        }
        AppState.updateTypography({ [key]: next });
    },

    applyBase(index, live) {
        const steps = this.scaleSteps();
        const value = Math.max(0, Math.min(steps.length - 1, Math.round(Number(index))));
        if (live) {
            AppState.typography.baseScaleIndex = value;
            this.generateScale();
            this.paintLive();
            return;
        }
        AppState.updateTypography({ baseScaleIndex: value });
    },

    onSwitch({ id, value }) {
        if (id === 'type') AppState.updateUi({ typeView: value });
        else if (id?.startsWith('hstep-')) {
            AppState.updateTypography({ headingSteps: { ...AppState.typography.headingSteps, [id.slice(6)]: value } });
        }
        else if (id === 'base-step') {
            const index = Number(value);
            if (Number.isInteger(index)) AppState.updateTypography({ baseScaleIndex: index });
        } else if (id) this.set(id, value);
    },

    /** Manual starts from the current auto sizes so nothing jumps. */
    setHeadingMode(mode) {
        const t = AppState.typography;
        if (mode !== 'manual') return AppState.updateTypography({ headingMode: 'auto' });
        const overrides = { ...t.headingOverrides };
        for (const h of t.scale.headings) {
            overrides[h.name] = { minSizePx: h.minSizePx, maxSizePx: h.maxSizePx, ...overrides[h.name] };
        }
        AppState.updateTypography({ headingMode: 'manual', headingOverrides: overrides });
    },

    setHeadingSize(name, bound, value) {
        const t = AppState.typography;
        const key = bound === 'min' ? 'minSizePx' : 'maxSizePx';
        AppState.updateTypography({ headingOverrides: { ...t.headingOverrides, [name]: { ...t.headingOverrides[name], [key]: value } } });
    },

    /** Turning fixed sizes off moves body text off them, onto the fluid base step. */
    setBodySizes(on) {
        const t = AppState.typography;
        const updates = { enableBodySizes: on };
        const fixed = t.scale.body.map((b) => `var(--${AppState.tokenName('type', b.name)})`);
        const base = t.scale.textSizes.find((x) => x.isBase) || t.scale.textSizes[0];
        if (!on && fixed.includes(t.bodyFontSize) && base) updates.bodyFontSize = `var(--${AppState.tokenName('type', base.name)})`;
        AppState.updateTypography(updates);
    },

    onDial({ key, value, live }) {
        if (key === 'enableBodySizes') {
            if (!live) this.setBodySizes(Boolean(value));
            return;
        }
        if (key === 'base-step') this.applyBase(value, live);
        else this.set(key, value, { live });
    },

    onInput(event) {
        const range = event.target.closest?.('[data-rf-range]');
        if (range) this.applyRange(range.dataset.rfRange, range.value, true);
    },

    onClick(event) {
        const fx = event.target.closest('[data-rf-fx]');
        if (fx) {
            const [kind, role] = fx.dataset.rfFx.split('-');
            const flag = kind === 'lh' ? LINE[role].fx : SPACING[role].fx;
            AppState.updateUi({ [flag]: fx.getAttribute('aria-pressed') !== 'true' });
            return;
        }
        const step = event.target.closest('[data-step]');
        if (step) {
            const key = step.dataset.key;
            const next = Number(AppState.typography[key]) + Number(step.dataset.step) * Number(step.dataset.size);
            this.set(key, next);
            return;
        }
        const choice = event.target.closest('[data-choice="ratio"]');
        if (choice) {
            this.set(this.ratioKey(), choice.dataset.value);
            return;
        }
        const action = event.target.closest('[data-action]');
        if (!action) return;
        const t = AppState.typography;
        switch (action.dataset.action) {
            case 'device': AppState.updateUi({ ratioDevice: action.dataset.value }); break;
            case 'heading-mode': this.setHeadingMode(action.dataset.value); break;
            case 'manage-fonts': AppState.updateUi({ section: 'fonts', fontsView: 'library' }); break;
            case 'heading-tab': AppState.updateUi({ headingFocus: action.dataset.value }); break;
            case 'recommend-ratios':
                AppState.updateTypography({
                    mobileTypeScaleRatio: CORE_TYPE_RATIOS.mobile,
                    desktopTypeScaleRatio: CORE_TYPE_RATIOS.desktop
                });
                break;
            case 'add-step-before': this.applySteps(addStepBefore(t.scaleSteps || DEFAULT_TYPE_STEPS, this.baseIndex())); break;
            case 'add-step-after': this.applySteps(addStepAfter(t.scaleSteps || DEFAULT_TYPE_STEPS, this.baseIndex())); break;
            case 'remove-step-before': this.applySteps(removeStepBefore(t.scaleSteps || DEFAULT_TYPE_STEPS, this.baseIndex())); break;
            case 'remove-step-after': this.applySteps(removeStepAfter(t.scaleSteps || DEFAULT_TYPE_STEPS, this.baseIndex())); break;
            case 'reset-heading': {
                const overrides = { ...t.headingOverrides };
                delete overrides[action.dataset.extra];
                AppState.updateTypography({ headingOverrides: overrides });
                break;
            }
            case 'reset-all-headings': AppState.updateTypography({ headingOverrides: {} }); break;
            case 'reset-heading-style': this.resetStyle('heading'); break;
            case 'reset-body-style': this.resetStyle('body'); break;
            case 'reset-body':
                AppState.updateTypography({ bodySizes: { 'text-12': 12, 'text-14': 14, 'text-16': 16, 'text-18': 18, 'text-20': 20 } });
                break;
            default: break;
        }
    },

    onChange(event) {
        const target = event.target;
        if (target.dataset.rfRange) return this.applyRange(target.dataset.rfRange, target.value, false);
        if (target.dataset.rfNum) {
            const n = readNum(target.value, -100, 100);
            if (n === null) return AppState.notify('typography');
            return this.applyRange(target.dataset.rfNum, n, false);
        }
        // Raw line-height / letter-spacing (fx): must be valid CSS; empty restores the default.
        const prop = { headingLineHeight: 'line-height', bodyLineHeight: 'line-height', headingLetterSpacing: 'letter-spacing', bodyLetterSpacing: 'letter-spacing' }[target.dataset.key];
        if (prop) {
            const value = target.value.trim();
            const defaults = { ...TYPE_STYLE_DEFAULTS.heading, ...TYPE_STYLE_DEFAULTS.body };
            if (!value) return AppState.updateTypography({ [target.dataset.key]: defaults[target.dataset.key] });
            if (!TypeMeter.valid(prop, value)) return AppState.notify('typography');
            return this.set(target.dataset.key, value);
        }
        if (target.dataset.heading) {
            const value = readNum(target.value, 10, 240);
            if (value === null) return AppState.notify('typography');
            this.setHeadingSize(target.dataset.heading, target.dataset.bound, value);
            return;
        }
        if (target.dataset.bodySize) {
            const value = Number(target.value);
            if (!Number.isFinite(value) || value < 8) return AppState.notify('typography');
            AppState.updateTypography({ bodySizes: { ...AppState.typography.bodySizes, [target.dataset.bodySize]: value } });
            return;
        }
        if (target.dataset.key) this.set(target.dataset.key, target.value);
    }
};

export default TypographyModule;
