import { highlight } from '../ui/highlight.js';
import AppState from '../state/appState.js';
import SpacingCalculator from '../core/spacingCalculator.js';
import {
    SPACING_RATIOS, CORE_SPACING_RATIOS, parseSteps, nextStep, stepLabel,
    addStepBefore, addStepAfter, removeStepBefore, removeStepAfter,
    DEFAULT_SPACING_STEPS, DEFAULT_SPACING_BASE
} from '../core/fluidScale.js';
import {
    esc, switcher, group, option, stepper, unitInput, selectInput, choices,
    ratioPresets, scaleEnds, iconButton, varTable, varRow, numField, readNum, ICON
} from '../ui/components.js';
import LayoutModule from './layoutModule.js';
import LayoutCalculator from '../core/layoutCalculator.js';
import { sectionAnatomy } from '../ui/blueprint.js';
import { dialSwitch } from '../ui/dial.js';
import ExampleSite from '../ui/exampleSite.js';
import {
    AUTO_SPACING_TOKENS, AUTO_SPACING_CLASSES, AUTO_SPACING_TARGETS,
    withAutoSpacing, autoSpacingRows, autoSpacingCss
} from '../core/autoSpacing.js';

const VIEWS = [
    { value: 'fluid', label: 'Spacing Scale' },
    { value: 'fixed', label: 'Fixed spacing' },
    { value: 'layout', label: 'Section & gaps' },
    { value: 'auto', label: 'Auto spacing' }
];



/** Section padding lives in AppState.layout; max/min keys per token. */
const PADDING = [
    { token: 'sctn-block-padding', max: 'blockPaddingMax', min: 'blockPaddingMin', label: 'Section block padding' },
    { token: 'sctn-inline-padding', max: 'inlinePaddingMax', min: 'inlinePaddingMin', label: 'Section inline padding' }
];
const PADDING_LIMITS = [0, 400];

const RATIOS = SPACING_RATIOS;

const FLUID_LIMITS = {
    baseSpacingMobile: [4, 64],
    baseSpacingDesktop: [4, 96],
    mobileSpacingScaleRatio: [1.05, 2.5],
    desktopSpacingScaleRatio: [1.05, 2.5],
    minViewport: [280, 1000],
    maxViewport: [600, 2560]
};

const SpacingModule = {
    title: 'Spacing Preview',
    previewModes: true,

    init() {
        this.generateScales();
    },

    generateScales() {
        const { fluidScale, fixedScale } = SpacingCalculator.generateScales(AppState.spacing);
        AppState.spacing.fluidScale = fluidScale;
        AppState.spacing.fixedScale = fixedScale;
    },

    isFixed() {
        return AppState.ui.spacingView === 'fixed';
    },

    view() {
        this.generateScales();
        const top = switcher({ id: 'spacing', value: AppState.ui.spacingView, options: VIEWS, label: 'Spacing view' });
        const view = AppState.ui.spacingView;
        const body = view === 'auto' ? this.autoView()
            : view === 'layout' ? this.layoutView()
                : this.isFixed() ? this.fixedView() : this.fluidView();
        return {
            control: `<div class="control__stack">${top}${body}</div>`,
            preview: this.preview()
        };
    },

    enableToggle(key, label) {
        return dialSwitch({ key: `toggle:${key}`, label, checked: Boolean(AppState.spacing[key]), bare: true, fid: `toggle-${key}` });
    },

    ratioKey() {
        return AppState.ui.ratioDevice === 'mobile' ? 'mobileSpacingScaleRatio' : 'desktopSpacingScaleRatio';
    },

    scaleSteps() {
        return parseSteps(AppState.spacing.fluid.steps || DEFAULT_SPACING_STEPS);
    },

    baseIndex() {
        const steps = this.scaleSteps();
        const index = Number(AppState.spacing.fluid.baseScaleIndex);
        if (!Number.isInteger(index) || index < 0 || index >= steps.length) return DEFAULT_SPACING_BASE;
        return index;
    },

    applySteps(next) {
        this.setFluidState({ steps: next.steps, baseScaleIndex: next.baseScaleIndex });
    },

    setFluidState(updates) {
        AppState.updateSpacing({ fluid: { ...AppState.spacing.fluid, ...updates } });
    },

    fluidView() {
        const f = AppState.spacing.fluid;
        const key = this.ratioKey();
        const device = AppState.ui.ratioDevice;
        const ratio = Number(f[key] ?? CORE_SPACING_RATIOS[device]);
        const mobileRatio = f.mobileSpacingScaleRatio ?? CORE_SPACING_RATIOS.mobile;
        const desktopRatio = f.desktopSpacingScaleRatio ?? CORE_SPACING_RATIOS.desktop;
        const onRecommended = Math.abs(mobileRatio - CORE_SPACING_RATIOS.mobile) < 0.0005
            && Math.abs(desktopRatio - CORE_SPACING_RATIOS.desktop) < 0.0005;
        const deviceToggle = `
          <div class="segmented segmented--sm" role="group" aria-label="Edit ratio for">
            <button type="button" class="segmented__btn" data-action="device" data-value="desktop" aria-pressed="${device === 'desktop'}" title="Desktop ratio" aria-label="Desktop ratio" data-fid="sp-device-desktop">${ICON.desktop}</button>
            <button type="button" class="segmented__btn" data-action="device" data-value="mobile" aria-pressed="${device === 'mobile'}" title="Mobile ratio" aria-label="Mobile ratio" data-fid="sp-device-mobile">${ICON.mobile}</button>
          </div>`;
        return `
          ${group({
              title: 'Spacing range',
              badge: `${f.baseSpacingMobile}px → ${f.baseSpacingDesktop}px`,
              body: `
                ${option('Minimum (Mobile)', stepper({ key: 'baseSpacingMobile', value: f.baseSpacingMobile, label: 'Minimum base spacing' }))}
                ${option('Maximum (Desktop)', stepper({ key: 'baseSpacingDesktop', value: f.baseSpacingDesktop, label: 'Maximum base spacing' }))}
                ${option('Base step', selectInput({
                    key: 'base-step',
                    value: String(this.baseIndex()),
                    options: this.scaleSteps().map((step, index) => ({ value: String(index), label: stepLabel(step) })),
                    label: 'Base scale step'
                }))}`
          })}
          ${group({
              title: 'Scale ratio',
              badge: `${mobileRatio} → ${desktopRatio}`,
              actions: onRecommended ? '' : iconButton({ action: 'recommend-ratios', label: 'Reset to recommended ratios', icon: 'reset' }),
              body: `
                <div class="panel__corner">${deviceToggle}</div>
                <div class="ratio">
                  <p class="ratio__label">${device === 'mobile' ? 'Mobile' : 'Desktop'} ratio</p>
                  ${stepper({ key, value: ratio, step: 0.001, decimals: 3, label: `${device} spacing scale ratio` })}
                </div>
                ${ratioPresets({ ratios: RATIOS, value: ratio, recommended: CORE_SPACING_RATIOS[device], device, label: 'Spacing ratio presets' })}`
          })}
          ${group({
              title: 'Viewport range',
              badge: `${f.minViewport}px → ${f.maxViewport}px`,
              body: `
                ${option('Minimum (Mobile)', unitInput({ key: 'minViewport', value: f.minViewport, label: 'Minimum viewport', id: 'sp-minvp' }), 'sp-minvp')}
                ${option('Maximum (Desktop)', unitInput({ key: 'maxViewport', value: f.maxViewport, label: 'Maximum viewport', id: 'sp-maxvp' }), 'sp-maxvp')}`
          })}
          ${this.stepControls()}`;
    },

    fixedView() {
        const fixed = AppState.spacing.fixed;
        const custom = fixed.customSteps || [];
        const customRows = custom.map((v) => `
          <li class="chip">
            <span>--${esc(AppState.tokenName('spacing', `space-${v}`))}</span>
            <button type="button" class="chip__remove" data-action="remove-step" data-value="${v}" data-fid="rm-${v}" aria-label="Remove ${v}px step">×</button>
          </li>`).join('');
        return `
          ${group({
              title: 'Fixed spacing',
              actions: this.enableToggle('enableFixedSpacing', 'Export fixed spacing'),
              body: `
                <div class="ratio">
                  <p class="ratio__label">Grid system</p>
                  ${choices({ key: 'grid', value: fixed.gridSystem, columns: 3, options: [2, 4, 8].map((n) => ({ value: n, label: `${n}pt` })), label: 'Grid system' })}
                </div>`
          })}
          ${group({
              title: 'Scale range',
              badge: `0 → ${Math.max(fixed.maxValue, ...custom)}px`,
              body: `
                ${option('Largest step', stepper({ key: 'maxValue', value: fixed.maxValue, step: 16, min: 16, max: 512, label: 'Largest spacing step' }))}
                ${custom.length ? `<ul class="chips" aria-label="Custom steps">${customRows}</ul>` : ''}
                <button type="button" class="btn-dashed btn-dashed--sm" data-action="add-step" data-fid="add-step">${ICON.addCircle}<span>Add step</span></button>`
          })}`;
    },

    /* ---------------- auto spacing ---------------- */

    autoSettings() {
        return withAutoSpacing(AppState.spacing.auto);
    },

    autoView() {
        const a = this.autoSettings();
        return group({
            title: 'Auto spacing',
            actions: dialSwitch({ key: 'auto:enabled', label: 'Auto spacing', checked: a.enabled, bare: true, fid: 'auto-enabled' }),
            body: a.enabled
                ? `
                <div class="dk-stack">
                  ${dialSwitch({ key: 'auto:autoApply', label: 'Apply to rich text', checked: a.autoApply, fid: 'auto-apply' })}
                </div>
                <p class="dk-hint">Spaces the children of rich text with <code>margin-block-start</code> in em, so each gap follows its own font size: 1em above paragraphs, 1.2em above headings. Add <code>.${AUTO_SPACING_CLASSES.on}</code> to any element; rich text${a.autoApply ? ' (Bricks Rich Text, post content, <code>.tk-text</code>) gets it automatically' : ' needs the class'}. <code>.${AUTO_SPACING_CLASSES.off}</code> turns it off. Change a gap with its <code>--auto-space-*</code> variable.</p>`
                : '<p class="dk-hint">Off: no auto spacing CSS, variables or classes are exported. Rich text keeps the default paragraph margins.</p>'
        });
    },

    autoPreview() {
        const a = this.autoSettings();
        const rows = AUTO_SPACING_TOKENS.map(([name, value, what]) => `
              <tr>
                <th scope="row"><code>--${esc(name)}</code></th>
                <td><code>${esc(value)}</code></td>
                <td>${esc(what)}</td>
              </tr>`).join('');
        return `
          <article class="preview-card">
            <header class="preview-card__header">
              <h3>Auto spacing${a.enabled ? '' : ' · off'}</h3>
              <button type="button" class="icon-btn icon-btn--label" data-action="open-blog" data-fid="auto-open-blog">See it on the blog</button>
            </header>
            ${a.enabled
                ? `<table class="token-table auto-table"><caption class="visually-hidden">Auto spacing variables</caption><tbody>${rows}</tbody></table>`
                : '<p class="auto-ruler__off">Auto spacing is off.</p>'}
          </article>`;
    },

    setAuto(updates) {
        AppState.updateSpacing({ auto: { ...this.autoSettings(), ...updates } });
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
                    fid: 'sp-before'
                })}
                ${scaleEnds({
                    next: nextStep(steps.join(','), 'after'),
                    current: steps[steps.length - 1],
                    actionAdd: 'add-step-after',
                    actionRemove: 'remove-step-after',
                    canRemove: steps.length > 1,
                    fid: 'sp-after'
                })}
              </div>`
        });
    },

    /** Fluid step a gap token points at, for px readouts. */
    gapStep(step) {
        return (AppState.spacing.fluidScale || []).find((s) => s.name === `space-${step}`);
    },

    layoutView() {
        LayoutModule.generate();
        const l = AppState.layout;
        const paddingRows = PADDING.map((p) => varRow(`--${p.token}`, ['max', 'min'].map((bound) => numField({
            tag: bound === 'max' ? 'Max' : 'Min',
            value: l[p[bound]],
            data: { layout: p[bound] },
            label: `${p.label} ${bound === 'max' ? 'desktop' : 'mobile'} in px`,
            fid: `${p.token}-${bound}`
        })).join(''), { cols: 2 }));
        const steps = this.scaleSteps();
        const gapRows = l.generated.gaps.map((g) => varRow(`--${g.name}`, switcher({
            id: `gap-${g.key}`,
            value: g.step,
            options: steps.map((step) => ({ value: step, label: `--${AppState.tokenName('spacing', `space-${step}`)}` })),
            label: `${g.name} spacing step`,
            size: 'sm',
            extraClass: 'switcher--mono'
        })));
        return `
          ${group({
              title: 'Section padding',
              badge: `${l.blockPaddingMax}px / ${l.inlinePaddingMax}px`,
              body: varTable(paddingRows, { label: 'Section padding' })
          })}
          ${group({
              title: 'Contextual gaps',
              body: varTable(gapRows, { label: 'Contextual gaps', nameMax: '50%' })
          })}`;
    },

    layoutTokens() {
        const g = AppState.layout.generated;
        const p = g.sectionPadding;
        return [
            [p.blockPadding.variable, p.blockPadding.value],
            [p.inlinePadding.variable, p.inlinePadding.value],
            [p.siteGutter.variable, p.siteGutter.value],
            ...g.gaps.map((gap) => [gap.variable, gap.value])
        ];
    },

    layoutPreview() {
        const l = AppState.layout;
        const gaps = { ...LayoutCalculator.defaults.gaps, ...l.gaps };
        const at = (step, key) => this.gapStep(step)?.[key] ?? 0;
        const values = (key, bound) => ({
            pb: l[`blockPadding${bound}`],
            pi: l[`inlinePadding${bound}`],
            content: at(gaps.content, key),
            container: at(gaps.container, key),
            grid: at(gaps.grid, key)
        });
        const desktop = values('maxSizePx', 'Max');
        const mobile = values('minSizePx', 'Min');
        const rows = [
            ['--sctn-block-padding', desktop.pb, mobile.pb],
            ['--sctn-inline-padding', desktop.pi, mobile.pi],
            [`--content-gap · ${gaps.content.toUpperCase()}`, desktop.content, mobile.content],
            [`--container-gap · ${gaps.container.toUpperCase()}`, desktop.container, mobile.container],
            [`--grid-gap · ${gaps.grid.toUpperCase()}`, desktop.grid, mobile.grid]
        ];
        return `
          <article class="preview-card">
            <header class="preview-card__header"><h3>Section anatomy</h3><span class="preview-card__hint">To scale · fluid from mobile to desktop</span></header>
            <div class="preview-card__body bp">${sectionAnatomy({ desktop, mobile, rows })}</div>
          </article>`;
    },

    preview() {
        const mode = AppState.ui.previewMode;
        if (AppState.ui.spacingView === 'auto') {
            if (mode === 'example') return ExampleSite.productFrame();
            if (mode === 'code') {
                const rows = autoSpacingRows(AppState.spacing.auto);
                const tokens = rows.length ? `:root {\n${rows.map(([, k, v]) => `  --${k}: ${v};`).join('\n')}\n}\n\n` : '';
                const css = autoSpacingCss(AppState.spacing.auto, { targets: AUTO_SPACING_TARGETS.html });
                return `<pre class="code-block"><code>${highlight(`${tokens}${css}` || '/* Auto spacing is off */')}</code></pre>`;
            }
            return this.autoPreview();
        }
        if (AppState.ui.spacingView === 'layout') {
            if (mode === 'example') return ExampleSite.productFrame();
            if (mode === 'code') {
                return `<pre class="code-block"><code>${highlight(`:root {\n${this.layoutTokens().map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`)}</code></pre>`;
            }
            return this.layoutPreview();
        }
        const fixed = this.isFixed();
        const scale = (fixed ? AppState.spacing.fixedScale : AppState.spacing.fluidScale) || [];
        const tokenName = (s) => AppState.tokenName('spacing', s.name);
        const valueOf = (s) => (fixed ? s.valueRem : s.clamp);

        if (mode === 'code') {
            return `<pre class="code-block"><code>${highlight(`:root {\n${scale.map((s) => `  --${tokenName(s)}: ${valueOf(s)};`).join('\n')}\n}`)}</code></pre>`;
        }
        if (mode === 'example') return ExampleSite.productFrame();

        const maxPx = Math.max(...scale.map((s) => s.maxSizePx || s.valuePx || 0), 1);
        const bar = (px) => `style="--n:${Math.max(px, 0)};--max:${maxPx}"`;

        if (fixed) {
            const rows = [...scale].reverse().map((s) => `
              <li class="space-ruler__row${s.isBase ? ' is-base' : ''}">
                <div class="space-ruler__meta">
                  <span class="space-ruler__name">${esc(stepLabel(s.name.replace(/^space-/, '')))}${s.isBase ? '<span class="scale-base">Base</span>' : ''}</span>
                  <code class="space-ruler__token">--${esc(tokenName(s))}</code>
                  <span class="space-ruler__range">${s.valuePx}px · ${esc(s.valueRem)}</span>
                </div>
                <div class="space-ruler__track" aria-hidden="true">
                  <span class="space-ruler__bar" ${bar(s.valuePx)}></span>
                </div>
              </li>`).join('');
            return `<ol class="space-ruler" aria-label="Fixed spacing">${rows}</ol>`;
        }

        const rows = [...scale].reverse().map((s) => `
          <li class="space-ruler__row${s.isBase ? ' is-base' : ''}">
            <div class="space-ruler__meta">
              <span class="space-ruler__name">${esc(stepLabel(s.name.replace(/^space-/, '')))}${s.isBase ? '<span class="scale-base">Base</span>' : ''}</span>
              <code class="space-ruler__token">--${esc(tokenName(s))}</code>
              <span class="space-ruler__range">${s.minSizePx} → ${s.maxSizePx}px</span>
            </div>
            <div class="space-ruler__track" aria-hidden="true">
              <span class="space-ruler__bar space-ruler__bar--max" ${bar(s.maxSizePx)}></span>
              <span class="space-ruler__bar space-ruler__bar--min" ${bar(s.minSizePx)}></span>
            </div>
          </li>`).join('');
        return `<ol class="space-ruler" aria-label="Spacing scale">${rows}</ol>`;
    },

    /* ---------------- events ---------------- */

    paintLive() {
        const body = document.getElementById('previewBody');
        if (!body) return;
        if (AppState.ui.previewMode === 'example') {
            ExampleSite.refresh();
            return;
        }
        body.innerHTML = this.preview();
    },

    setFluid(key, raw, { live = false } = {}) {
        const f = AppState.spacing.fluid;
        let value = Number(raw);
        if (!Number.isFinite(value)) {
            if (!live) AppState.notify('spacing');
            return;
        }
        const [min, max] = FLUID_LIMITS[key];
        value = Math.min(max, Math.max(min, value));
        if (key.endsWith('SpacingScaleRatio')) value = Math.round(value * 1000) / 1000;
        if (key === 'minViewport' && value >= f.maxViewport) value = f.maxViewport - 1;
        if (key === 'maxViewport' && value <= f.minViewport) value = f.minViewport + 1;
        if (live) {
            AppState.spacing.fluid = { ...f, [key]: value };
            this.generateScales();
            this.paintLive();
            return;
        }
        this.setFluidState({ [key]: value });
    },

    setFixed(updates, { live = false } = {}) {
        if (live) {
            AppState.spacing.fixed = { ...AppState.spacing.fixed, ...updates };
            this.generateScales();
            this.paintLive();
            return;
        }
        AppState.updateSpacing({ fixed: { ...AppState.spacing.fixed, ...updates } });
    },

    setKey(key, raw, { live = false } = {}) {
        if (key === 'maxValue') {
            const grid = AppState.spacing.fixed.gridSystem;
            const value = Math.round(Math.min(512, Math.max(16, Number(raw) || 16)) / grid) * grid;
            this.setFixed({ maxValue: value }, { live });
        } else if (key in FLUID_LIMITS) {
            this.setFluid(key, raw, { live });
        }
    },

    applyGrid(raw) {
        const grid = Number(raw);
        const fixed = AppState.spacing.fixed;
        this.setFixed({
            gridSystem: grid,
            maxValue: Math.round(fixed.maxValue / grid) * grid,
            customSteps: (fixed.customSteps || []).filter((v) => v % grid === 0)
        });
    },

    applyBase(index, live) {
        const steps = this.scaleSteps();
        const value = Math.max(0, Math.min(steps.length - 1, Math.round(Number(index))));
        if (live) {
            AppState.spacing.fluid = { ...AppState.spacing.fluid, baseScaleIndex: value };
            this.generateScales();
            this.paintLive();
            return;
        }
        this.setFluidState({ baseScaleIndex: value });
    },

    onSwitch({ id, value }) {
        if (id === 'spacing') AppState.updateUi({ spacingView: value });
        if (id?.startsWith('gap-')) {
            AppState.updateLayout({ gaps: { ...AppState.layout.gaps, [id.slice(4)]: value } });
        }
        if (id === 'base-step') {
            const index = Number(value);
            if (Number.isInteger(index)) this.setFluidState({ baseScaleIndex: index });
        }
    },

    onClick(event) {
        const step = event.target.closest('[data-step]');
        if (step) {
            const key = step.dataset.key;
            const current = key === 'maxValue' ? AppState.spacing.fixed.maxValue : AppState.spacing.fluid[key];
            this.setKey(key, Number(current) + Number(step.dataset.step) * Number(step.dataset.size));
            return;
        }
        const choice = event.target.closest('[data-choice]');
        if (choice?.dataset.choice === 'ratio') { this.setFluid(this.ratioKey(), choice.dataset.value); return; }
        if (choice?.dataset.choice === 'grid') {
            this.applyGrid(choice.dataset.value);
            return;
        }
        const action = event.target.closest('[data-action]');
        if (!action) return;
        if (action.dataset.action === 'device') {
            AppState.updateUi({ ratioDevice: action.dataset.value });
            return;
        }
        if (action.dataset.action === 'open-blog') {
            AppState.ui.exampleKind = 'blog';
            AppState.updateUi({ previewMode: 'example' });
            return;
        }
        if (action.dataset.action === 'recommend-ratios') {
            this.setFluidState({
                mobileSpacingScaleRatio: CORE_SPACING_RATIOS.mobile,
                desktopSpacingScaleRatio: CORE_SPACING_RATIOS.desktop
            });
            return;
        }
        const fluid = AppState.spacing.fluid;
        const currentSteps = fluid.steps || DEFAULT_SPACING_STEPS;
        if (action.dataset.action === 'add-step-before') { this.applySteps(addStepBefore(currentSteps, this.baseIndex())); return; }
        if (action.dataset.action === 'add-step-after') { this.applySteps(addStepAfter(currentSteps, this.baseIndex())); return; }
        if (action.dataset.action === 'remove-step-before') { this.applySteps(removeStepBefore(currentSteps, this.baseIndex())); return; }
        if (action.dataset.action === 'remove-step-after') { this.applySteps(removeStepAfter(currentSteps, this.baseIndex())); return; }
        const fixed = AppState.spacing.fixed;
        if (action.dataset.action === 'add-step') {
            const current = Math.max(fixed.maxValue, ...(fixed.customSteps || []));
            const next = SpacingCalculator.getNextValidStep(fixed.gridSystem, current);
            this.setFixed({ customSteps: [...(fixed.customSteps || []), next] });
        }
        if (action.dataset.action === 'remove-step') {
            const value = Number(action.dataset.value);
            this.setFixed({ customSteps: (fixed.customSteps || []).filter((v) => v !== value) });
        }
    },

    onDial({ key, value, live }) {
        if (key.startsWith('auto:')) {
            if (!live) this.setAuto({ [key.slice(5)]: Boolean(value) });
            return;
        }
        if (key.startsWith('toggle:') && !live) AppState.updateSpacing({ [key.slice(7)]: value });
        else if (key === 'base-step') this.applyBase(value, live);
        else if (key in FLUID_LIMITS || key === 'maxValue') this.setKey(key, value, { live });
    },

    onChange(event) {
        const key = event.target.dataset.layout;
        if (key) {
            const value = readNum(event.target.value, ...PADDING_LIMITS);
            if (value === null) return AppState.notify('layout');
            AppState.updateLayout({ [key]: value });
            return;
        }
        if (event.target.dataset.key) this.setKey(event.target.dataset.key, event.target.value);
    }
};

export default SpacingModule;
