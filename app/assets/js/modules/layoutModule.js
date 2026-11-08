import AppState from '../state/appState.js';
import LayoutCalculator from '../core/layoutCalculator.js';
import { esc, switcher, group, option, selectInput, iconButton, varTable, varRow, numField, readNum } from '../ui/components.js';
import { dialSwitch } from '../ui/dial.js';
import { parseSteps, DEFAULT_SPACING_STEPS } from '../core/fluidScale.js';
import { widthZones, gridExample, headerOffset, chip } from '../ui/blueprint.js';

const VIEWS = [
    { value: 'content', label: 'Content width' },
    { value: 'grid', label: 'Grid' },
    { value: 'header', label: 'Header' }
];

const WIDTH_LIMITS = [240, 3840];
const HEADER_LIMITS = [0, 400];

const LayoutModule = {
    title: 'Layout Preview',
    previewModes: false,

    init() {
        this.generate();
    },

    /** Shared by the Spacing screen, which edits section padding and gaps. */
    generate() {
        // `generated` is left out so the result doesn't nest the previous one.
        const { generated, ...config } = AppState.layout;
        AppState.layout.generated = LayoutCalculator.generateLayout({ ...config, spaceVar: this.spaceVar });
    },

    spaceVar(step) {
        return `var(--${AppState.tokenName('spacing', `space-${step}`)})`;
    },

    /** Header offset CSS, as it goes into the Bricks theme stylesheet and the CSS export. */
    headerCss({ html = false } = {}) {
        return LayoutCalculator.headerCss({ header: AppState.layout.header, spaceVar: this.spaceVar, html });
    },

    view() {
        this.generate();
        const view = AppState.ui.layoutView || 'content';
        const top = switcher({ id: 'layout-view', value: view, options: VIEWS, label: 'Layout view' });
        const body = view === 'grid' ? this.gridView() : view === 'header' ? this.headerView() : this.contentView();
        return { control: `<div class="control__stack">${top}${body}</div>`, preview: this.preview(view) };
    },

    /* ---------------- views ---------------- */

    contentView() {
        const widths = AppState.layout.generated.contentWidths;
        const base = widths.find((w) => !w.key);
        const ordered = [base, ...widths.filter((w) => w.key)];
        const rows = ordered.map((w) => varRow(`--${w.name}`, numField({
            value: w.valuePx,
            data: { width: w.key || 'base' },
            label: `${w.name} in px`,
            fid: `width-${w.key || 'base'}`
        })));
        const bleed = AppState.layout.bleedMobile || 'keep';
        return `${group({
            title: 'Content width',
            badge: `${base.valuePx}px`,
            actions: widths.some((w) => w.isCustom) ? iconButton({ action: 'reset-widths', label: 'Scale all widths from content width', icon: 'reset' }) : '',
            body: `
              ${varTable(rows, { label: 'Content widths', nameMax: '60%' })}
              <p class="dk-hint">Variants follow --content-width until you type a value for one.</p>`
        })}
        ${group({
            title: 'Full bleed',
            body: `
              ${option('On phones', selectInput({
                  key: 'bleedMobile',
                  value: bleed,
                  options: [
                      { value: 'keep', label: 'Keep side' },
                      { value: 'both', label: 'Both sides' },
                      { value: 'none', label: 'No bleed' }
                  ],
                  label: 'One-sided bleed on phones'
              }))}
              <p class="dk-hint">What <code>.full-bleed-left</code> and <code>.full-bleed-right</code> do up to 767px, when columns usually stack. They measure from <code>--bleed-container</code>: your content width, or the width a <code>.content-width-*</code> class sets.</p>`
        })}`;
    },

    gridView() {
        const s = AppState.layout;
        return group({
            title: 'Grid',
            badge: `${s.maxColumns} columns`,
            body: `
              ${varTable([varRow('Max columns', numField({ value: s.maxColumns, unit: 'cols', data: { key: 'maxColumns' }, label: 'Max columns', fid: 'l-cols' }))], { label: 'Grid', nameMax: '60%' })}
              <p class="dk-hint">Generates --grid-1 to --grid-${s.maxColumns}, auto-fit grids and asymmetric grids. Gaps are set in Spacing → Section & gaps.</p>`
        });
    },

    headerView() {
        const h = AppState.layout.header;
        const steps = parseSteps(AppState.spacing.fluid.steps || DEFAULT_SPACING_STEPS);
        return `
          ${group({
              title: 'Header height',
              badge: `${h.height}px`,
              body: `
                ${varTable([varRow('--header-height', numField({ value: h.height, data: { header: 'height' }, label: 'Header height in px', fid: 'hh-height' }))], { label: 'Header height', nameMax: '55%' })}
                <p class="dk-hint">Measure your header in Bricks and enter its height here.</p>`
          })}
          ${group({
              title: 'Offset',
              body: `
                ${dialSwitch({ key: 'header:offsetContent', label: 'Offset first section', checked: h.offsetContent, fid: 'hh-offset-content' })}
                ${dialSwitch({ key: 'header:offsetAnchors', label: 'Offset anchor links', checked: h.offsetAnchors, fid: 'hh-offset-anchors' })}
                ${h.offsetAnchors ? option('Anchor spacing', selectInput({
                    key: 'header-anchor-space',
                    value: h.anchorSpace,
                    options: steps.map((step) => ({ value: step, label: `--${AppState.tokenName('spacing', `space-${step}`)}` })),
                    label: 'Space above anchor targets',
                    mono: true
                })) : ''}
                ${dialSwitch({ key: 'header:smoothScroll', label: 'Smooth scroll', checked: h.smoothScroll, fid: 'hh-smooth' })}
                <p class="dk-hint">Applies only while the Bricks header is <b>Sticky</b> (fixed). A normal or “Sticky on scroll” header already takes its own space.${h.smoothScroll ? ' Smooth scroll respects reduced motion, so turn off Bricks’ own Smooth scroll setting.' : ''}</p>`
          })}`;
    },

    /* ---------------- preview ---------------- */

    preview(view) {
        if (view === 'grid') return this.gridPreview();
        if (view === 'header') return this.headerPreview();
        return this.contentPreview();
    },

    contentPreview() {
        const l = AppState.layout;
        const widths = [...(l.generated?.contentWidths || [])].sort((a, b) => a.valuePx - b.valuePx);
        const widest = Math.max(...widths.map((w) => w.valuePx), 0);
        const viewport = Math.max(1920, widest + 2 * (Number(l.inlinePaddingMax) || 0));
        const zones = [
            ...widths.map((w) => ({ name: `--${w.name}`, px: w.valuePx, label: `${w.valuePx}px`, highlight: !w.key })),
            { name: 'Full width', px: null, label: '100%' },
            { name: 'Full width safe', px: null, gutter: Number(l.inlinePaddingMax) || 0, label: `100% − ${l.inlinePaddingMax}px gutters` }
        ];
        return `
          <article class="preview-card">
            <header class="preview-card__header"><h3>Width zones</h3><span class="preview-card__hint">To scale on a ${viewport}px viewport</span></header>
            <div class="preview-card__body bp">
              ${widthZones(zones, viewport)}
              <div class="bp-chips">${chip('--content-width', '')}<span class="bp-note">is the default container width. Gutters use --sctn-inline-padding.</span></div>
            </div>
          </article>`;
    },

    gridPreview() {
        const l = AppState.layout;
        const g = l.generated;
        const max = Number(l.maxColumns) || 12;
        const gapStep = (AppState.spacing.fluidScale || []).find((s) => s.name === `space-${g.gaps.find((x) => x.key === 'grid')?.step}`);
        const gap = `${Math.min(gapStep?.maxSizePx ?? 16, 32)}px`;
        const counts = [2, 3, 4, 6, 12].filter((c) => c <= max);
        if (!counts.includes(max)) counts.push(max);
        const columns = counts.map((c) => gridExample({ tokens: [`--grid-${c}`], template: `repeat(${c}, minmax(0, 1fr))`, cells: c, gap: 'var(--grid-gap)' })).join('');
        const asymmetric = g.asymmetricGrids.slice(0, 4).map((a) => gridExample({ tokens: [`--${a.name}`], template: a.value, cells: 2, gap: 'var(--grid-gap)' })).join('');
        const autos = g.autoGridTemplates.filter((a) => a.columns && [3, 4].includes(a.columns)).map((a) => gridExample({
            tokens: [`--${a.name}`],
            template: a.value,
            cells: 6,
            gap: 'var(--grid-gap)',
            note: `up to ${a.columns} per row, wraps when a column drops below 70% of its size`
        })).join('');
        return `
          <article class="preview-card">
            <header class="preview-card__header"><h3>Grids</h3><span class="preview-card__hint">Gap: --grid-gap (${gap} on desktop)</span></header>
            <div class="preview-card__body bp" style="--grid-gap:${gap};--content-width:${l.contentWidth}px">
              <h4 class="bp-heading">Columns <small>--grid-1 to --grid-${max}</small></h4>
              <div class="bp-grid-examples">${columns}</div>
              <h4 class="bp-heading">Asymmetric <small>two-column splits</small></h4>
              <div class="bp-grid-examples">${asymmetric}</div>
              <h4 class="bp-heading">Auto-fit <small>responsive without breakpoints</small></h4>
              <div class="bp-grid-examples">${autos}</div>
            </div>
          </article>`;
    },

    headerPreview() {
        const l = AppState.layout;
        const h = l.header;
        const pb = Number(l.blockPaddingMax) || 0;
        const height = Number(h.height) || 0;
        const fact = (label, value, detail) => `<div class="bp-fact"><span>${label}</span><b>${value}</b>${detail ? `<code>${detail}</code>` : ''}</div>`;
        return `
          <article class="preview-card">
            <header class="preview-card__header"><h3>Sticky header offset</h3><span class="preview-card__hint">To scale · desktop · only when the Bricks header is Sticky</span></header>
            <div class="preview-card__body bp">
              ${headerOffset({ height, pb, offsetOn: h.offsetContent })}
              <div class="bp-facts">
                ${fact('Header height', `${height}px`, '--header-height')}
                ${fact('First section top', h.offsetContent ? `${pb + height}px` : 'Not offset', h.offsetContent ? `${pb} + ${height}` : '')}
                ${fact('Anchor links land', h.offsetAnchors ? `${height}px + ${String(h.anchorSpace).toUpperCase()}` : 'Not offset', h.offsetAnchors ? 'scroll-padding + :target' : '')}
                ${fact('Smooth scroll', h.smoothScroll ? 'On' : 'Off', h.smoothScroll ? 'respects reduced motion' : '')}
              </div>
            </div>
          </article>`;
    },

    /* ---------------- events ---------------- */

    setHeader(updates) {
        AppState.updateLayout({ header: { ...AppState.layout.header, ...updates } });
    },

    onSwitch({ id, value }) {
        if (id === 'layout-view') AppState.updateUi({ layoutView: value });
        if (id === 'header-anchor-space') this.setHeader({ anchorSpace: value });
        if (id === 'bleedMobile') AppState.updateLayout({ bleedMobile: value });
    },

    onDial({ key, value, live }) {
        if (live || !key.startsWith('header:')) return;
        this.setHeader({ [key.slice(7)]: Boolean(value) });
    },

    onClick(event) {
        const action = event.target.closest('[data-action]');
        if (action?.dataset.action === 'reset-widths') AppState.updateLayout({ contentWidthOverrides: {} });
    },

    onChange(event) {
        const target = event.target;
        if (target.dataset.width) {
            const value = readNum(target.value, ...WIDTH_LIMITS);
            if (value === null) return AppState.notify('layout');
            const px = Math.round(value);
            if (target.dataset.width === 'base') AppState.updateLayout({ contentWidth: px });
            else AppState.updateLayout({ contentWidthOverrides: { ...AppState.layout.contentWidthOverrides, [target.dataset.width]: px } });
            return;
        }
        if (target.dataset.header) {
            const value = readNum(target.value, ...HEADER_LIMITS);
            if (value === null) return AppState.notify('layout');
            this.setHeader({ height: Math.round(value) });
            return;
        }
        if (target.dataset.key === 'maxColumns') {
            const value = readNum(target.value, 1, 24);
            if (value === null) return AppState.notify('layout');
            AppState.updateLayout({ maxColumns: Math.round(value) });
        }
    }
};

export default LayoutModule;
