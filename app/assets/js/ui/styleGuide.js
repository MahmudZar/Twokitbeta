/**
 * Style guide: an Example page (Website · Style guide), laid out after the
 * Paper "Style Guide" design (Style guide Previews/). Everything is live:
 *
 *   CSS      the HTML/CSS export itself (ui/previewCss.js): variables.css,
 *            styles.css and the utility classes. Specimens use real tags
 *            (h1–h4, p), .tk-* elements, .btn--* classes and token variables
 *   Chrome   the page's own layout reads TwoKit tokens and classes too:
 *            .tk-section / .tk-container, --container-gap, text-*, surface-*
 *            and shadow-* classes, and --ex-* aliases that point at real
 *            steps of the user's type, spacing and radius scales
 *   Markup   rebuilt from AppState on every refresh, so ramps, steps, button
 *            variants, state palettes, hex values and px labels follow edits
 *
 * Section ids (sg-color, sg-type, sg-radius …) let each screen open the guide
 * at the part it edits (ExampleSite.anchor()).
 *
 * @module styleGuide
 */

import AppState from '../state/appState.js';
import { contrast } from '../core/themeTokens.js';
import { currentTheme, ensureShades, buttonContext } from '../state/themeModel.js';
import { headingRole, bodyRole, sortFaces, WEIGHT_NAMES } from '../state/fontModel.js';
import { withButtonDefaults, COLOR_VARIANTS } from '../core/buttonsCss.js';
import { withDefaults, radiusScale, RADIUS_STEPS } from '../core/stylingCss.js';
import { UTILITY_GROUPS } from '../core/utilityClasses.js';
import UtilitiesModule from '../modules/utilitiesModule.js';
import { projectName } from '../modules/exportModule.js';
import { THEME_ATTR } from './previewCss.js';
import { esc } from './components.js';

const token = (section, name) => AppState.tokenName(section, name);
const cssVar = (section, name) => `var(--${token(section, name)})`;
const color = (name) => `var(--${token('color', name)})`;
const n = (value) => String(Math.round(Number(value) * 100) / 100);
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const ink = (hex) => (contrast(hex, '#000000') >= contrast(hex, '#ffffff') ? '#000' : '#fff');
const pct = (alpha) => `${n((Number(alpha) || 0) * 100)}%`;
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const mono = (text, extra = 'text-muted') => `<span class="sg-mono ${extra}">${text}</span>`;
const over = (text, extra = 'text-muted') => `<span class="sg-over ${extra}">${text}</span>`;

const ICONS = {
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

/** Glyph and copy per state palette; unknown (renamed / extra) states get a generic line. */
const STATE_COPY = {
    info: ['i', 'Ferry times updated', 'The 07:40 crossing to Skye now leaves from pier 2.', 'Tide turns at 16:12', 'Cross the strand before 15:30.'],
    success: ['✓', 'Booking confirmed', 'Three nights at Ardmore Bothy, 12–15 October.', 'Seats held', 'Your two seats are held until 18:00.'],
    warning: ['!', 'Weather advisory', 'Strong winds expected on the ridge after 2pm.', 'Limited signal', 'Download offline maps before day two.'],
    error: ['×', 'Payment declined', 'Your card issuer rejected the charge. Try another card.', 'Ferry cancelled', 'We have rebooked you on the 11:05.']
};
const stateCopy = (name) => STATE_COPY[name] || [cap(name).charAt(0) || '•', `${cap(name)} message`, `Uses --${name}-surface, border, text and solid.`, `${cap(name)} notice`, `The ${name} tokens, in the other theme.`];

const HEADING_SAMPLES = ['Find the long way home', 'Routes worth the detour', 'Coastal loop, day three', 'Tide tables and trailheads', 'Pack light, walk far', 'Notes from the ridge'];
const BODY_SAMPLE = 'We plan the route, you choose the pace. Every trip is built around the places in between.';

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

/** A full-width band: .tk-section (section padding) around a .tk-container (content width). */
const section = (id, body, extra = '') => `
  <section class="tk-section sg-sec ${extra}" aria-labelledby="${id}">
    <div class="tk-container sg-wrap">${body}
    </div>
  </section>`;

function sectionHead(id, eyebrow, title, desc) {
    return `
      <header class="sg-head">
        <div class="sg-head__title">
          ${over(esc(eyebrow), 'text-action')}
          <h2 class="sg-title" id="${id}">${esc(title)}</h2>
        </div>
        <p class="sg-desc">${desc}</p>
      </header>`;
}

function alert(state, { alt = false } = {}) {
    const name = state.name;
    const [glyph, title, text, altTitle, altText] = stateCopy(name);
    const t = (role) => `var(--${name}-${role})`;
    return `
        <div class="sg-alert" role="note" style="background-color:${t('surface')};border-color:${t('border')};color:${t('text')}">
          <span class="sg-alert__icon" style="background-color:${t('solid')};color:${t('on-solid')}" aria-hidden="true">${esc(glyph)}</span>
          <span class="sg-alert__body"><b>${esc(alt ? altTitle : title)}</b><span>${esc(alt ? altText : text)}</span></span>
        </div>`;
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function hero(ctx) {
    const { name, model } = ctx;
    const t = AppState.typography;
    const levels = model.groups.find((g) => g.id === 'surfaces')?.tokens.length || 0;
    const heading = headingRole().label;
    const body = bodyRole().label;
    const fonts = heading === body ? heading : `${heading} + ${body}`;
    const ratio = t.desktopTypeScaleRatio ? ` a ${n(t.desktopTypeScaleRatio)} type scale,` : '';
    const intro = `Tokens, type and components for ${esc(name)}: ${plural(AppState.colors.length, 'brand palette')}, ${plural(AppState.stateColors.length, 'state palette')}, a ${levels}-step surface ladder,${ratio} and ${plural(ctx.variants.length, 'button look')}. Every value on this page is a live TwoKit token.`;
    const index = [
        ['sg-color', '01 — Color', 'Brand, state scales, surfaces, text, borders'],
        ['sg-type', '02 — Type', `${esc(fonts)}, fluid scale`],
        ['sg-shape', '03 — Shape', 'Radius, spacing, elevation'],
        ['sg-components', '04 — Components', 'Buttons, alerts, fields, cards, themes'],
        ['sg-utilities', '05 — Utilities', `${UtilitiesModule.classes().length} classes`]
    ];
    return section('sg-top', `
      <div class="sg-hero__top">
        <span class="sg-brand"><span class="sg-dot" aria-hidden="true"></span>${esc(name)}</span>
        ${over('Design system · Generated by TwoKit')}
      </div>
      <div class="sg-hero__main">
        <h1 class="sg-display" id="sg-top">Style<br>Guide</h1>
        <p class="sg-lede">${intro}</p>
      </div>
      <nav class="sg-index" aria-label="Sections">
        ${index.map(([id, label, text]) => `<a class="sg-index__item" href="#${id}">${over(label)}<span class="sg-small">${text}</span></a>`).join('')}
      </nav>`, 'sg-hero');
}

/* ------------------------------------------------------------------ */
/* 01 — Color                                                          */
/* ------------------------------------------------------------------ */

/** Which theme tokens point at each palette shade: { 'primary-400': ['--primary'], … }. */
function shadeTags(model) {
    const tags = {};
    const add = (shade, label) => { (tags[shade] ||= []).push(label); };
    for (const c of AppState.colors) {
        const base = c.shades?.find((s) => s.isBase);
        if (base) add(base.name, `--${token('color', c.name)}`);
    }
    for (const g of model.groups.filter((x) => x.id === 'action' || x.id === 'action-secondary')) {
        const main = g.tokens[0];
        if (main?.light.ref) add(main.light.ref, `--${main.name}`);
        if (main?.dark.ref) add(main.dark.ref, `dark --${main.name}`);
    }
    return tags;
}

function brandRamp(c, tags) {
    const shades = c.shades || [];
    if (!shades.length) return '';
    const first = token('color', shades[0].name);
    const last = token('color', shades[shades.length - 1].name);
    return `
      <div class="sg-block">
        <div class="sg-row-head">
          <h3 class="sg-h4">${esc(cap(c.name))}</h3>
          ${mono(`--${esc(first)} … --${esc(last)}`)}
        </div>
        <div class="sg-ramp">
          ${shades.map((s) => `
          <div class="sg-ramp__cell" style="background-color:${color(s.name)};color:${ink(s.hex)}" title="--${esc(token('color', s.name))} · ${esc(s.hex)}">
            ${(tags[s.name] || []).map((tag) => `<span class="sg-ramp__tag">${esc(tag)}</span>`).join('')}
            <span class="sg-ramp__step">${esc(s.shade ?? s.name)}</span>
          </div>`).join('')}
        </div>
      </div>`;
}

function stateRamp(c) {
    const shades = c.shades || [];
    if (!shades.length) return '';
    return `
        <div class="sg-srow">
          <div class="sg-pair sg-srow__label"><span class="sg-name sg-name--lg">${esc(cap(c.name))}</span>${mono(`--${esc(token('color', c.name))}-*`)}</div>
          <div class="sg-strip">
            ${shades.map((s) => `<div class="sg-strip__cell" style="background-color:${color(s.name)};color:${ink(s.hex)}" title="${esc(s.hex)}">${esc(s.shade ?? s.name)}</div>`).join('')}
          </div>
        </div>`;
}

/** One theme's surface ladder, painted with that theme's fixed values. */
function surfaceStrip(model, mode) {
    const surfaces = model.groups.find((g) => g.id === 'surfaces')?.tokens || [];
    return `
      <div class="sg-surfaces${mode === 'light' ? ' sg-surfaces--ring' : ''}" aria-label="${cap(mode)} surfaces">
        ${surfaces.map((s) => `
        <div class="sg-surface" style="background-color:var(--${mode}-${s.name})">
          <span class="sg-over" style="color:var(--${mode}-text-muted)">${esc(mode)}</span>
          <span class="sg-pair">
            <b style="color:var(--${mode}-text-primary)">--${esc(s.name)}</b>
            <span class="sg-mono" style="color:var(--${mode}-text-muted)">${esc(s[mode].hex)}</span>
          </span>
        </div>`).join('')}
      </div>`;
}

function colorSections(ctx) {
    const { model } = ctx;
    const tags = shadeTags(model);
    const primary = AppState.colors[0];
    const base = primary?.shades?.find((s) => s.isBase);
    const action = model.groups.find((g) => g.id === 'action')?.tokens[0];
    const steps = primary?.shades?.length ? `${primary.shades[0].shade}–${primary.shades[primary.shades.length - 1].shade}` : '';
    const refStep = (ref) => primary?.shades?.find((s) => s.name === ref)?.shade;
    const desc = `${plural(AppState.colors.length, 'brand ramp')} and ${plural(AppState.stateColors.length, 'state ramp')}${steps ? `, each ${steps} in OKLCH` : ''}.${base ? ` --${esc(token('color', primary.name))} points at ${esc(base.shade)};` : ''}${action ? ` --action uses ${esc(refStep(action.light.ref) || action.light.hex)} in light and ${esc(refStep(action.dark.ref) || action.dark.hex)} in dark.` : ''}`;

    const text = model.groups.find((g) => g.id === 'text')?.tokens || [];
    const roles = { 'text-primary': 'headings', 'text-secondary': 'body', 'text-muted': 'captions', 'text-disabled': 'inactive' };
    const borders = model.groups.find((g) => g.id === 'borders')?.tokens || [];
    const layers = model.groups.find((g) => g.id === 'states')?.tokens || [];
    const layer = (name) => layers.find((l) => l.name === name);
    const actions = model.groups.filter((g) => g.id === 'action' || g.id === 'action-secondary');
    const surfaces = model.groups.find((g) => g.id === 'surfaces')?.tokens || [];
    const states = AppState.stateColors.map(ensureShades).filter((c) => c.shades?.length);

    const brand = section('sg-color', `
      ${sectionHead('sg-color', '01 — Color', 'Brand & state', desc)}
      ${AppState.colors.map((c) => brandRamp(ensureShades(c), tags)).join('')}
      ${states.length ? `<div class="sg-stack" id="sg-states">${states.map(stateRamp).join('')}</div>` : ''}`);

    const tiles = actions.map((g) => {
        const main = g.tokens[0].name;
        const on = g.tokens.find((x) => x.name.startsWith('on-'))?.name || 'on-action';
        return `
          <div class="sg-tiles">
            ${g.tokens.map((tk) => {
                const style = tk.name.startsWith('on-')
                    ? `background-color:var(--${tk.name});color:var(--${main});border:1px solid var(--border)`
                    : `background-color:var(--${tk.name});color:var(--${on})`;
                return `<div class="sg-tile" style="${style}">--${esc(tk.name)}</div>`;
            }).join('')}
          </div>`;
    }).join('');

    const ladder = section('sg-surfaces', `
      <header class="sg-head">
        <h2 class="sg-subtitle" id="sg-surfaces">Surfaces</h2>
        <p class="sg-desc">${surfaces.length} steps per theme, --surface-0 to --surface-${Math.max(0, surfaces.length - 1)}. Each step is a touch deeper in light and a touch lighter in dark.</p>
      </header>
      ${surfaceStrip(model, 'light')}
      ${surfaceStrip(model, 'dark')}
      <div class="sg-cols" id="sg-tokens">
        <div class="sg-col">
          ${over('Text')}
          ${text.map((tk) => `
          <div class="sg-trow">
            <span class="sg-aa" style="color:var(--${tk.name})">Aa</span>
            <span class="sg-pair"><span class="sg-name">--${esc(tk.name)}</span>${mono(`${esc(tk.light.hex)} / ${esc(tk.dark.hex)}${roles[tk.name] ? ` · ${roles[tk.name]}` : ''}`)}</span>
          </div>`).join('')}
        </div>
        <div class="sg-col">
          ${over('Borders')}
          <div class="sg-stack sg-stack--tight">
            ${borders.map((b) => `
            <div class="sg-brow surface-0" style="border-color:var(--${b.name})">
              <span class="sg-name">--${esc(b.name)}</span>${mono(`${pct(b.light.alpha)} / ${pct(b.dark.alpha)}${b.name === 'border' ? ' · default' : ''}`)}
            </div>`).join('')}
          </div>
        </div>
        <div class="sg-col">
          ${over('Action & interaction')}
          ${tiles}
          <div class="sg-ilist surface-0">
            <div class="sg-ilist__item"><span class="text-secondary">Rest</span>${mono('transparent')}</div>
            ${['hover', 'selected', 'active'].filter(layer).map((k) => `
            <div class="sg-ilist__item" style="background-color:var(--${k})"><span class="text-primary">${cap(k)}</span>${mono(`--${k} · ${pct(layer(k).light.alpha)} / ${pct(layer(k).dark.alpha)}`)}</div>`).join('')}
          </div>
        </div>
      </div>`, 'sg-sec--flush');
    return brand + ladder;
}

/* ------------------------------------------------------------------ */
/* 02 — Typography                                                     */
/* ------------------------------------------------------------------ */

const DEFAULT_WEIGHTS = [300, 400, 500, 600, 700];

/** Weight range label + the weights worth showing for a font role. */
function roleWeights(role) {
    const font = role.font;
    if (!font?.faces?.length) return { label: 'System stack', list: DEFAULT_WEIGHTS };
    const faces = sortFaces(font.faces);
    const italic = faces.some((f) => f.style === 'italic');
    const variable = faces.find((f) => f.variable);
    let label;
    let list;
    if (variable) {
        const { min, max } = variable.variable;
        list = DEFAULT_WEIGHTS.filter((w) => w >= min && w <= max);
        if (!list.length) list = [min];
        label = `${min} — ${max} variable`;
    } else {
        list = [...new Set(faces.map((f) => Number(f.weight)).filter(Boolean))].sort((a, b) => a - b);
        label = list.length > 1 ? `${list[0]} — ${list[list.length - 1]}` : String(list[0] || 400);
    }
    return { label: `${label}${italic ? ' + italics' : ''}`, list: list.slice(0, 6) };
}

function voiceCard(role, { variable, weight, invert }) {
    const w = roleWeights(role);
    const current = Number(weight) || 400;
    const family = `var(--${token('type', variable)})`;
    return `
        <article class="sg-voice${invert ? ' sg-voice--invert' : ' surface-2'}" style="font-family:${family}">
          <div class="sg-voice__top">${over(`--${esc(token('type', variable))}`, 'sg-voice__muted')}${mono(esc(w.label), 'sg-voice__muted')}</div>
          <div class="sg-voice__aa" style="font-weight:${current}" aria-hidden="true">Aa</div>
          <div class="sg-voice__foot">
            <span class="sg-voice__name" style="font-weight:${current}">${esc(role.label)}</span>
            <span class="sg-voice__weights">${w.list.map((x) => `<span style="font-weight:${x}"${x === current ? ' class="is-current"' : ''}>${esc(WEIGHT_NAMES[x] || x)}</span>`).join('')}</span>
          </div>
        </article>`;
}

function typeSection() {
    const t = AppState.typography;
    const scale = t.scale || { headings: [], textSizes: [], body: [] };
    const heading = headingRole();
    const body = bodyRole();
    const same = heading.label === body.label;
    const lh = `Headings use --heading-line-height, text uses --text-line-height.`;
    const desc = same
        ? `${esc(heading.label)} carries headings at weight ${esc(t.headingWeight)} and body copy at ${esc(t.bodyWeight)}. Sizes are fluid clamps between ${n(t.minViewport)}px and ${n(t.maxViewport)}px. ${lh}`
        : `${esc(heading.label)} carries headings at weight ${esc(t.headingWeight)}. ${esc(body.label)} sets everything you read. Sizes are fluid clamps between ${n(t.minViewport)}px and ${n(t.maxViewport)}px. ${lh}`;

    const headings = (scale.headings || []).filter((h) => /^h[1-6]$/.test(h.name));
    const headingRows = headings.map((h, i) => `
        <div class="sg-hrow">
          <div class="sg-pair sg-hrow__meta"><span class="sg-name">${h.name.toUpperCase()} · --${esc(token('type', h.name))}</span>${mono(`${n(h.minSizePx)} → ${n(h.maxSizePx)}px · ${esc(t.headingWeight)}`)}</div>
          <${h.name} class="sg-hrow__sample">${HEADING_SAMPLES[i] || HEADING_SAMPLES[0]}</${h.name}>
        </div>`).join('');

    const sizes = [...(scale.textSizes || [])].reverse();
    const fluid = sizes.map((s) => {
        const above = s.exponent > 0;
        const text = s.isBase ? 'Default body size for reading copy'
            : above ? (s.exponent > 2 ? 'Wander' : s.exponent > 1 ? 'Wander further' : 'Wander further, slower')
                : s.exponent === -1 ? 'Small print, metadata and helper text' : 'Overline and micro labels';
        const cls = above ? 'sg-fl__sample sg-fl__sample--display text-primary' : s.exponent <= -2 ? 'sg-fl__sample sg-fl__sample--micro text-secondary' : 'sg-fl__sample text-secondary';
        return `
          <div class="sg-fl">
            <span class="sg-pair sg-fl__label">${mono(`--${esc(token('type', s.name))}`, 'text-primary')}${mono(`${n(s.minSizePx)} → ${n(s.maxSizePx)}px`)}</span>
            <span class="${cls}" style="font-size:${cssVar('type', s.name)}">${text}</span>
          </div>`;
    }).join('');

    // Fixed body sizes: plain <p>, so they take --text-line-height from styles.css like any paragraph.
    const fixedOn = t.enableBodySizes !== false && scale.body?.length;
    const fixed = fixedOn ? [...scale.body].reverse().map((b) => `
          <div class="sg-fx">
            ${mono(`--${esc(token('type', b.name))} · ${n(b.sizePx)}px`)}
            <p class="sg-fx__sample" style="font-size:${cssVar('type', b.name)}">${BODY_SAMPLE}</p>
          </div>`).join('') : '';

    return section('sg-type', `
      ${sectionHead('sg-type', '02 — Typography', same ? 'One voice' : 'Two voices', desc)}
      <div class="sg-voices">
        ${voiceCard(heading, { variable: 'font-heading', weight: t.headingWeight })}
        ${voiceCard(body, { variable: 'font-body', weight: t.bodyWeight, invert: true })}
      </div>
      ${headingRows ? `<div class="sg-hlist" id="sg-headings">${headingRows}</div>` : ''}
      <div class="sg-split">
        ${fluid ? `<div class="sg-col">${over('Fluid text')}${fluid}</div>` : ''}
        ${fixed ? `<div class="sg-col">${over('Fixed text · --text-line-height')}${fixed}</div>` : ''}
      </div>`, 'surface-0 sg-sec--rule');
}

/* ------------------------------------------------------------------ */
/* 03 — Shape                                                          */
/* ------------------------------------------------------------------ */

function shapeSection(ctx) {
    const { model } = ctx;
    const s = withDefaults(AppState.styling);
    const r = s.radius;
    const btnRadius = withButtonDefaults(AppState.buttons).shape.radius;
    const px = Object.fromEntries(radiusScale(r).map((x) => [x.name, x.px]));
    const steps = r.extraSizes ? RADIUS_STEPS : [['m', 0]];
    const radii = [
        { name: 'none', cls: 'radius-none', value: '0' },
        ...steps.map(([name]) => ({ name, cls: `radius-${name}`, value: `${n(px[`radius-${name}`])}px`, base: name === 'm' })),
        { name: 'circle / 50', cls: 'radius-circle', value: '50vw · 50%' }
    ].map((x) => {
        const notes = [x.name, x.base ? 'base' : '', (btnRadius === 'radius' && x.base) || btnRadius === `radius-${x.name}` ? 'button' : ''].filter(Boolean).join(' · ');
        return `
          <div class="sg-radius">
            <div class="sg-radius__box ${x.cls}${x.base ? ' is-base' : ' surface-3'}"></div>
            <span class="sg-name">${esc(notes)}</span>${mono(esc(`.${x.cls} · ${x.value}`))}
          </div>`;
    }).join('');

    const sp = AppState.spacing;
    const layout = AppState.layout.generated;
    const gapOf = {};
    for (const g of layout?.gaps || []) (gapOf[g.step] ||= []).push(g.name.replace(/-/g, ' '));
    const fluidOn = sp.enableFluidSpacing && sp.fluidScale?.length;
    const fixedOn = sp.enableFixedSpacing && sp.fixedScale?.length;
    const fluid = fluidOn ? sp.fluidScale.map((step) => {
        const name = token('spacing', step.name);
        const key = step.step ?? String(step.name).replace(/^space-/, '');
        const range = step.maxSizePx != null ? `${n(step.minSizePx)}→${n(step.maxSizePx)}` : n(step.valuePx);
        return `
          <div class="sg-spbar">
            ${mono(`--${esc(name)}`, 'text-primary sg-spbar__name')}
            <span class="sg-spbar__bar" style="inline-size:var(--${name})"></span>
            ${mono(`${range}${gapOf[key] ? ` · ${esc(gapOf[key].join(', '))}` : ''}`)}
          </div>`;
    }).join('') : '';
    const fixed = fixedOn ? sp.fixedScale.filter((x) => x.valuePx > 0).map((x) => `
          <div class="sg-grid4__col" title="--${esc(token('spacing', x.name))}">
            <span class="sg-grid4__bar" style="block-size:var(--${token('spacing', x.name)})"></span>
            ${mono(n(x.valuePx), 'text-muted sg-tiny')}
          </div>`).join('') : '';

    const kv = [];
    if (layout) {
        const p = layout.sectionPadding;
        kv.push(['--sctn-block-padding', `${n(p.blockPadding.minPx)} → ${n(p.blockPadding.maxPx)}`]);
        kv.push(['--sctn-inline-padding · --site-gutter', `${n(p.inlinePadding.minPx)} → ${n(p.inlinePadding.maxPx)}`]);
        const base = layout.contentWidths.find((w) => !w.key);
        const variants = layout.contentWidths.filter((w) => w.key).map((w) => `${w.key} ${w.valuePx}`);
        kv.push(['--content-width', [base ? String(base.valuePx) : '', ...variants].filter(Boolean).join(' · ')]);
        for (const g of layout.gaps || []) kv.push([`--${g.name}`, `--${token('spacing', `space-${g.step}`)}`]);
    }
    kv.push(['--header-height', `${Number(AppState.layout.header?.height) || 0}`]);

    const shadowCount = model.shadows.light.length;
    const shadows = Array.from({ length: shadowCount }, (_, i) => `
          <div class="sg-shadow surface-0 shadow-${i + 1}">
            <b class="text-primary">${i + 1}</b>${mono(`.shadow-${i + 1}`)}
          </div>`).join('');

    const kinds = [fluidOn ? 'fluid t‑shirt sizes' : '', fixedOn ? 'a fixed px scale' : ''].filter(Boolean).join(' and ');
    const desc = `A ${n(r.base)}px base radius${r.extraSizes ? ` scaled by ${n(r.scale)}` : ''}.${kinds ? ` Spacing comes in ${kinds}.` : ''} Shadows stack ${plural(shadowCount, 'layer')}.`;

    return section('sg-shape', `
      ${sectionHead('sg-shape', '03 — Shape', 'Radius, space, depth', desc)}
      <div class="sg-block" id="sg-radius">
        ${over(`Radius · --radius ${n(r.base)}px${r.extraSizes ? ` × --radius-scale ${n(r.scale)}` : ''}`)}
        <div class="sg-radii">${radii}</div>
      </div>
      <div class="sg-split sg-split--rule" id="sg-spacing">
        ${fluid ? `<div class="sg-col">${over('Fluid spacing')}${fluid}</div>` : ''}
        <div class="sg-col" id="sg-layout">
          ${fixed ? `${over('Fixed spacing')}<div class="sg-grid4">${fixed}</div>` : ''}
          ${!fluid && !fixed ? `${over('Spacing')}<p class="sg-small">Fluid and fixed spacing are both off in Spacing.</p>` : ''}
          ${over('Layout')}
          <div class="sg-kvs">${kv.map(([k, v]) => `<div class="sg-kv">${mono(esc(k), 'text-primary')}${mono(esc(v))}</div>`).join('')}</div>
        </div>
      </div>
      ${shadowCount ? `
      <div class="sg-block sg-block--rule" id="sg-elevation">
        ${over(`Elevation · --shadow-1 … ${shadowCount}`)}
        <div class="sg-shadows">${shadows}</div>
      </div>` : ''}`);
}

/* ------------------------------------------------------------------ */
/* 04 — Components                                                     */
/* ------------------------------------------------------------------ */

function componentsSection(ctx) {
    const b = withButtonDefaults(AppState.buttons);
    const sh = b.shape;
    const s = withDefaults(AppState.styling);
    const sizes = [['-s', `Small · ${n(sh.fontSizeS * 16)}`], ['', `Default · ${n(sh.fontSize * 16)}`], ['-l', `Large · ${n(sh.fontSizeL * 16)}`]];
    const btn = (cls, label = 'Book a trip', attrs = '') => `<a class="${cls}" href="#"${attrs}>${label}</a>`;
    const rows = ctx.variants.map((v) => `
          <div class="sg-btable__row">
            <span class="sg-pair"><span class="sg-name">${esc(cap(v))}</span>${mono(`.btn--${esc(v)}`)}</span>
            ${sizes.map(([suffix]) => `<span>${btn(`btn--${v}${suffix}`)}</span>`).join('')}
            <span>${btn(`btn--${v} is-hover`)}</span>
            <span>${btn(`btn--${v}`, 'Book a trip', ' aria-disabled="true" tabindex="-1"')}</span>
          </div>`).join('');
    const focusNote = s.focus.style === 'ring' ? `ring ${n(s.focus.width)}px` : `${n(s.focus.width)}px · offset ${n(s.focus.offset)}`;
    const iconBtn = (variant, icon, label) => `<a class="btn--${variant} btn--icon" href="#" aria-label="${label}">${ICONS[icon]}</a>`;
    const linkRow = `
          <div class="sg-btable__row sg-btable__row--last">
            <span class="sg-pair"><span class="sg-name">Link · Icon</span>${mono('.btn--link · .btn--icon')}</span>
            ${sizes.map(([suffix]) => `<span>${btn(`btn--link${suffix}`, 'See itinerary')}</span>`).join('')}
            <span class="sg-icons">${iconBtn('primary', 'arrow', 'Next')}${iconBtn('secondary', 'plus', 'Add')}${iconBtn('outline', 'heart', 'Save')}</span>
            <span class="sg-focus">${btn('btn--primary is-focus', 'Focus')}${mono(esc(focusNote), 'text-muted sg-tiny')}</span>
          </div>`;

    const states = AppState.stateColors.filter((c) => c.shades?.length);
    const error = states.find((c) => c.name === 'error') || states[states.length - 1];
    const halo = s.focus.field === 'halo';
    const fieldNote = halo
        ? `Fields · focus ring --focus-ring-width ${n(s.focus.ringWidth)}px @ ${n(s.focus.ringStrength)}%`
        : `Fields · focus --focus-width ${n(s.focus.width)}px`;
    const user = ctx.name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'example';

    return section('sg-components', `
      ${sectionHead('sg-components', '04 — Components', 'Buttons', `${plural(ctx.variants.length, 'look')}, three sizes. Padding is ${n(sh.paddingBlock)}em × ${n(sh.paddingInline)}em so it scales with the font; radius is --btn-radius; disabled is 50% opacity.`)}
      <div class="sg-scroll" tabindex="0" aria-label="Button variants">
        <div class="sg-btable">
          <div class="sg-btable__row sg-btable__row--head">
            ${over('Variant')}${sizes.map(([, label]) => over(label)).join('')}${over('Hover')}${over('Disabled')}
          </div>
          ${rows}
          ${linkRow}
        </div>
      </div>
      <div class="sg-split sg-split--rule">
        ${states.length ? `<div class="sg-col sg-col--tight" id="sg-alerts">${over('Alerts · --state-surface / border / text / solid / on-solid')}${states.map((c) => alert(c)).join('')}</div>` : ''}
        <div class="sg-col sg-col--fields" id="sg-fields">
          ${over(esc(fieldNote))}
          <label class="sg-field"><span class="sg-name">Destination</span><input class="sg-input" placeholder="Where to?"></label>
          <label class="sg-field"><span class="sg-name">Travellers · focused</span><input class="sg-input is-focus" value="2 adults, 1 dog"><span class="sg-help text-muted">Dogs travel free on all coastal routes.</span></label>
          <label class="sg-field"><span class="sg-name">Email</span><input class="sg-input" value="mara@${esc(user)}" aria-invalid="true"${error ? ` style="border-color:var(--${error.name}-solid)"` : ''}><span class="sg-help"${error ? ` style="color:var(--${error.name}-text)"` : ''}>Add a domain, like .com</span></label>
        </div>
      </div>`, 'surface-0 sg-sec--rule');
}

/** The opposite theme, on a section: <section data-theme="dark">. */
function flipSection(ctx) {
    const flip = ctx.mode === 'dark' ? 'light' : 'dark';
    const states = AppState.stateColors.filter((c) => c.shades?.length);
    const chip = states.find((c) => c.name === 'success') || states[0];
    const others = states.filter((c) => c !== chip).slice(0, 3);
    const title = flip === 'dark' ? 'After dark' : 'In daylight';
    const desc = `Every theme token resolves through light-dark(). Put ${THEME_ATTR}="${flip}" on any element and that part of the page flips: surfaces, text, action and state colors all switch together.`;
    return `
  <section class="tk-section sg-sec surface-1" ${THEME_ATTR}="${flip}" data-brx-theme="${flip}" aria-labelledby="sg-flip">
    <div class="tk-container sg-wrap">
      ${sectionHead('sg-flip', `${THEME_ATTR}="${flip}"`, title, desc)}
      <div class="sg-flipgrid">
        <article class="sg-card surface-2 shadow-2">
          <div class="sg-card__top">
            ${over('6 days · Outer Hebrides')}
            ${chip ? `<span class="sg-chip" style="background-color:var(--${chip.name}-surface);border-color:var(--${chip.name}-border);color:var(--${chip.name}-text)">4 spots left</span>` : ''}
          </div>
          <div class="sg-card__copy">
            <h3>Machair &amp; standing stones</h3>
            <p>White-sand crossings, Callanish at dawn, and a bothy with the only light for thirty miles.</p>
          </div>
          <div class="sg-card__actions">
            <a class="btn--primary" href="#">Reserve a spot</a>
            <a class="btn--secondary" href="#">Save</a>
            <a class="btn--outline" href="#">Share</a>
            <a class="btn--link" href="#">Route map</a>
          </div>
        </article>
        ${others.length ? `<div class="sg-col sg-col--tight">${others.map((c) => alert(c, { alt: true })).join('')}</div>` : ''}
      </div>
    </div>
  </section>`;
}

/* ------------------------------------------------------------------ */
/* 05 — Utilities                                                      */
/* ------------------------------------------------------------------ */

function utilitiesSection() {
    const groups = UtilitiesModule.groups();
    const all = UtilitiesModule.classes(Object.fromEntries(UTILITY_GROUPS.map((g) => [g.id, true])));
    const shipped = new Set(UtilitiesModule.classes().map((c) => c.name));
    const rows = UTILITY_GROUPS.map((g) => {
        const list = all.filter((c) => c.group === g.id);
        if (!list.length) return '';
        const on = groups[g.id] !== false;
        const sample = list.slice(0, 10).map((c) => `<code class="sg-class${shipped.has(c.name) ? '' : ' is-off'}">.${esc(c.name)}</code>`).join('');
        return `
          <div class="sg-urow">
            <div class="sg-pair"><span class="sg-name">${esc(g.label)}</span>${mono(`${list.length} classes · ${on ? 'ships' : 'off'}`, on ? 'text-muted' : 'text-muted sg-off')}</div>
            <div class="sg-classes">${sample}${list.length > 10 ? mono(`+ ${list.length - 10} more`) : ''}</div>
          </div>`;
    }).join('');
    return section('sg-utilities', `
      ${sectionHead('sg-utilities', '05 — Utilities', 'Utility classes', `${UtilitiesModule.classes().length} classes ship with styles.css. Each reads a token, so editing a variable updates every class that uses it. Groups switched off in Utilities are listed but not exported.`)}
      <div class="sg-ulist">${rows}</div>
      <footer class="sg-foot">
        <span class="sg-brand"><span class="sg-dot" aria-hidden="true"></span>${esc(projectName())}</span>
        ${over('fonts.css · variables.css · styles.css')}
      </footer>`);
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/** Button variants in table order: the four looks, extra brands, then states. */
function variants() {
    const ctx = buttonContext();
    return [...COLOR_VARIANTS, ...ctx.brands.map((x) => x.name), ...ctx.states.map((x) => x.name)];
}

/** Inner markup of the style guide; rebuilt on every refresh. */
export function styleGuideBody() {
    const ctx = {
        model: currentTheme(),
        mode: AppState.ui.exampleTheme === 'dark' ? 'dark' : 'light',
        name: projectName(),
        variants: variants()
    };
    return `
<main class="sg">
  ${hero(ctx)}
  ${colorSections(ctx)}
  ${typeSection()}
  ${shapeSection(ctx)}
  ${componentsSection(ctx)}
  ${flipSection(ctx)}
  ${utilitiesSection()}
</main>`;
}

/**
 * Layout for the guide. Sizes come from TwoKit: --ex-* (steps of the type,
 * spacing and radius scales), --container-gap / --content-gap / --grid-gap,
 * --text-line-height / --heading-line-height, theme colors. Headings take
 * their size, weight, tracking and line height from styles.css (h1–h4).
 * Only swatch sizes and column widths are fixed.
 */
export const SG_CSS = `
/* Style guide */
.sg{display:flex;flex-direction:column;overflow:clip;overflow-wrap:anywhere}
.sg p{margin:0}
.sg-sec{padding-block:var(--sctn-block-padding);padding-inline:var(--sctn-inline-padding)}
.sg-sec--flush{padding-block-start:0}
.sg-sec--rule{border-block:1px solid var(--border)}
.sg-wrap{align-items:stretch;gap:var(--container-gap)}
.sg-over{font-size:var(--ex-text-xs);font-weight:500;letter-spacing:.12em;line-height:var(--text-line-height);text-transform:uppercase}
.sg-mono{font-family:var(--ex-font-mono);font-size:var(--ex-text-xs);line-height:var(--text-line-height)}
.sg-tiny{font-size:calc(var(--ex-text-xs) * .9)}
.sg-small{color:var(--text-secondary);font-size:var(--ex-text-s);line-height:var(--text-line-height)}
.sg-name{color:var(--text-primary);font-size:var(--ex-text-s);font-weight:500;line-height:var(--text-line-height)}
.sg-name--lg{font-family:var(--ex-font-heading);font-size:var(--ex-text-m)}
.sg-pair{display:flex;flex-direction:column;gap:var(--ex-space-3xs);min-inline-size:0}
.sg-stack{display:flex;flex-direction:column;gap:var(--ex-space-xs)}
.sg-stack--tight{gap:var(--ex-space-2xs)}
.sg-block{display:flex;flex-direction:column;gap:var(--content-gap)}
.sg-block--rule,.sg-split--rule{padding-block-start:var(--ex-space-l);border-block-start:1px solid var(--border-subtle)}
.sg-row-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:var(--ex-space-3xs) var(--ex-space-s)}
.sg-h4{margin:0;font-size:var(--${'h4'})}

/* Hero */
.sg-hero{border-block-end:1px solid var(--border)}
.sg-hero__top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--ex-space-xs)}
.sg-brand{display:inline-flex;align-items:center;gap:var(--ex-space-2xs);color:var(--text-primary);font-family:var(--ex-font-heading);font-size:var(--ex-text-m);font-weight:600;line-height:var(--heading-line-height)}
.sg-dot{flex:none;inline-size:.875em;block-size:.875em;border-radius:var(--radius-circle);background:var(--action);box-shadow:0 0 0 .25em color-mix(in oklab,var(--action) 30%,transparent)}
.sg-hero__main{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:var(--ex-space-m) var(--ex-space-2xl)}
.sg-display{margin:0}
.sg-lede{flex:0 1 28rem;color:var(--text-secondary);font-size:var(--ex-text-l)}
.sg-index{display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:var(--grid-gap);padding-block-start:var(--ex-space-l);border-block-start:1px solid var(--border-strong)}
.sg-index__item{display:flex;flex-direction:column;gap:var(--ex-space-3xs);color:inherit;text-decoration:none;border-radius:var(--ex-radius-s)}
.sg-index__item:hover .sg-over{color:var(--action)}

/* Section heads: h2 / h3 styled by styles.css */
.sg-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:var(--ex-space-s) var(--ex-space-2xl)}
.sg-head__title{display:flex;flex-direction:column;gap:var(--ex-space-xs)}
.sg-title,.sg-subtitle{margin:0;scroll-margin-block-start:var(--ex-space-l)}
.sg-subtitle{font-size:var(--${'h3'})}
.sg-desc{flex:0 1 28rem;color:var(--text-secondary);font-size:var(--ex-text-m)}
.sg [id]{scroll-margin-block-start:var(--ex-space-l)}

/* Color */
.sg-ramp{display:flex;border-radius:var(--ex-radius-xl);box-shadow:0 0 0 1px var(--border-subtle);overflow:clip}
.sg-ramp__cell{display:flex;flex:1 1 0;flex-direction:column;justify-content:flex-end;gap:var(--ex-space-3xs);min-inline-size:0;block-size:11rem;padding:var(--ex-space-xs)}
.sg-ramp__tag{font-family:var(--ex-font-mono);font-size:calc(var(--ex-text-xs) * .9);line-height:1.2;opacity:.85;overflow-wrap:anywhere}
.sg-ramp__step{font-family:var(--ex-font-heading);font-size:var(--ex-text-m);font-weight:500;line-height:var(--heading-line-height);white-space:nowrap}
.sg-srow{display:flex;align-items:center;gap:var(--ex-space-s)}
.sg-srow__label{flex:none;inline-size:9rem}
.sg-strip{display:flex;flex:1 1 0;min-inline-size:0;border-radius:var(--ex-radius-l);overflow:clip}
.sg-strip__cell{display:flex;flex:1 1 0;align-items:flex-end;min-inline-size:0;block-size:4rem;padding:var(--ex-space-2xs);overflow:hidden;font-size:var(--ex-text-xs);font-weight:500;line-height:var(--text-line-height);white-space:nowrap}
.sg-surfaces{display:flex;border-radius:var(--ex-radius-xl);overflow:clip}
.sg-surfaces--ring{box-shadow:0 0 0 1px var(--border)}
.sg-surface{display:flex;flex:1 1 0;flex-direction:column;justify-content:space-between;gap:var(--ex-space-2xs);min-inline-size:0;block-size:9rem;padding:var(--ex-space-xs)}
.sg-surface .sg-over{letter-spacing:.08em}
.sg-surface b{font-family:var(--ex-font-mono);font-size:var(--ex-text-xs);font-weight:600;line-height:var(--text-line-height)}
.sg-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:var(--ex-space-2xl);padding-block-start:var(--ex-space-l)}
.sg-col{display:flex;flex-direction:column;gap:var(--content-gap);min-inline-size:0}
.sg-col--tight{gap:var(--ex-space-xs)}
.sg-trow{display:flex;align-items:center;gap:var(--ex-space-s);padding-block-end:var(--ex-space-xs);border-block-end:1px solid var(--border-subtle)}
.sg-trow:last-child{padding-block-end:0;border-block-end:0}
.sg-aa{flex:none;inline-size:3.5rem;font-family:var(--ex-font-heading);font-size:var(--${'h3'});font-weight:500;line-height:var(--heading-line-height)}
.sg-brow{display:flex;align-items:center;justify-content:space-between;gap:var(--ex-space-xs);min-block-size:3.5rem;padding-inline:var(--ex-space-s);border:1px solid;border-radius:var(--ex-radius-l)}
.sg-tiles{display:flex;gap:var(--ex-space-2xs)}
.sg-tile{display:flex;flex:1 1 0;align-items:flex-end;min-inline-size:0;block-size:5.5rem;padding:var(--ex-space-xs);border-radius:var(--ex-radius-l);font-size:var(--ex-text-xs);font-weight:500;line-height:var(--text-line-height)}
.sg-ilist{display:flex;flex-direction:column;gap:2px;padding:var(--ex-space-3xs);border:1px solid var(--border-subtle);border-radius:var(--ex-radius-xl)}
.sg-ilist__item{display:flex;align-items:center;justify-content:space-between;gap:var(--ex-space-xs);min-block-size:2.5rem;padding-inline:var(--ex-space-xs);border-radius:var(--ex-radius-m);font-size:var(--ex-text-s)}

/* Typography */
.sg-voices{display:grid;grid-template-columns:repeat(auto-fit,minmax(18rem,1fr));gap:var(--grid-gap)}
.sg-voice{display:flex;flex-direction:column;justify-content:space-between;gap:var(--ex-space-xl);min-block-size:22rem;padding:var(--ex-space-l);color:var(--text-primary);border-radius:var(--ex-radius-xxl);overflow:hidden}
.sg-voice--invert{background:var(--inverse-surface,var(--dark-surface-2));color:var(--inverse-text,var(--dark-text-primary))}
.sg-voice__top{display:flex;flex-wrap:wrap;justify-content:space-between;gap:var(--ex-space-2xs)}
.sg-voice .sg-voice__muted{color:var(--text-muted)}
.sg-voice--invert .sg-voice__muted{color:var(--inverse-text-muted,var(--dark-text-muted))}
.sg-voice__aa{font-size:calc(var(--${'h1'}) * 2);letter-spacing:-.04em;line-height:var(--heading-line-height)}
.sg-voice__foot{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:var(--ex-space-xs) var(--ex-space-m)}
.sg-voice__name{font-size:var(--${'h3'});line-height:var(--heading-line-height)}
.sg-voice__weights{display:flex;flex-wrap:wrap;gap:var(--ex-space-3xs) var(--ex-space-xs);font-size:var(--ex-text-m);line-height:var(--text-line-height);opacity:.75}
.sg-voice__weights .is-current{color:var(--action);opacity:1}
.sg-voice--invert .sg-voice__weights .is-current{color:var(--inverse-action,var(--dark-action))}
.sg-hlist{display:flex;flex-direction:column}
.sg-hrow{display:flex;align-items:baseline;gap:var(--ex-space-s);padding-block:var(--ex-space-s);border-block-end:1px solid var(--border-subtle)}
.sg-hrow__meta{flex:none;inline-size:11rem}
.sg-hrow__sample{margin:0;min-inline-size:0}
.sg-split{display:grid;grid-template-columns:repeat(auto-fit,minmax(20rem,1fr));gap:var(--ex-space-2xl)}
.sg-fl{display:flex;align-items:baseline;gap:var(--ex-space-s);min-inline-size:0}
.sg-fl__label{flex:none;inline-size:8rem}
.sg-fl__sample{min-inline-size:0;overflow:hidden;line-height:var(--text-line-height);text-overflow:ellipsis;white-space:nowrap}
.sg-fl__sample--display{font-family:var(--ex-font-heading);line-height:var(--heading-line-height)}
.sg-fl__sample--micro{font-weight:500;letter-spacing:.1em;text-transform:uppercase}
.sg-fx{display:flex;flex-direction:column;gap:var(--ex-space-3xs);padding-block-end:var(--ex-space-s);border-block-end:1px solid var(--border-subtle)}
.sg-fx:last-child{padding-block-end:0;border-block-end:0}

/* Shape */
.sg-radii{display:grid;grid-template-columns:repeat(auto-fill,minmax(7rem,1fr));gap:var(--grid-gap)}
.sg-radius{display:flex;flex-direction:column;gap:var(--ex-space-3xs);min-inline-size:0}
.sg-radius__box{block-size:7.5rem;margin-block-end:var(--ex-space-2xs);border:1px solid var(--border-strong)}
.sg-radius__box.is-base{background:color-mix(in oklab,var(--action) 22%,var(--surface-2));border-color:var(--action)}
.sg-spbar{display:flex;align-items:center;gap:var(--ex-space-s);min-inline-size:0}
.sg-spbar__name{flex:none;inline-size:7rem}
.sg-spbar__bar{flex:0 1 auto;min-inline-size:2px;block-size:.875rem;border-radius:var(--radius-xs,2px);background:var(--action)}
.sg-grid4{display:flex;align-items:flex-end;gap:var(--ex-space-2xs);min-block-size:9.5rem;padding-block-end:var(--ex-space-3xs);overflow-x:auto;scrollbar-width:thin}
.sg-grid4__col{display:flex;flex:none;flex-direction:column;align-items:center;gap:var(--ex-space-3xs)}
.sg-grid4__bar{display:block;inline-size:1.25rem;max-block-size:8rem;border-radius:var(--radius-xs,2px);background:var(--action)}
.sg-kvs{display:flex;flex-direction:column}
.sg-kv{display:flex;flex-wrap:wrap;justify-content:space-between;gap:var(--ex-space-3xs) var(--ex-space-s);padding-block:var(--ex-space-2xs);border-block-end:1px solid var(--border-subtle)}
.sg-kv:last-child{border-block-end:0}
.sg-shadows{display:grid;grid-template-columns:repeat(auto-fill,minmax(7rem,1fr));gap:var(--grid-gap);padding-block:var(--ex-space-2xs) var(--ex-space-xl)}
.sg-shadow{display:flex;flex-direction:column;justify-content:space-between;block-size:8rem;padding:var(--ex-space-xs);border-radius:var(--ex-radius-xl)}
.sg-shadow b{font-family:var(--ex-font-heading);font-size:var(--ex-text-l);font-weight:500;line-height:var(--heading-line-height)}

/* Components */
.sg-scroll{overflow-x:auto;scrollbar-width:thin;border-radius:var(--ex-radius-s)}
.sg-btable{display:flex;flex-direction:column;min-inline-size:62rem}
.sg-btable__row{display:grid;grid-template-columns:12rem repeat(5,minmax(9rem,1fr));align-items:center;gap:var(--ex-space-xs);padding-block:var(--ex-space-xs);border-block-end:1px solid var(--border-subtle)}
.sg-btable__row--head{padding-block-start:0;border-block-end-color:var(--border-strong)}
.sg-btable__row--last{border-block-end:0}
.sg-btable__row > span{display:flex;align-items:center;min-inline-size:0}
.sg-btable__row > .sg-pair{align-items:flex-start}
.sg-btable a{white-space:nowrap}
.sg-icons{gap:var(--ex-space-2xs)}
.sg-icons svg{inline-size:1.15em;block-size:1.15em;min-inline-size:0;min-block-size:0}
.sg-btable__row > .sg-focus{flex-direction:column;align-items:flex-start;gap:var(--ex-space-3xs)}
.sg-alert{display:flex;align-items:flex-start;gap:var(--ex-space-xs);padding:var(--ex-space-s);border:1px solid;border-radius:var(--ex-radius-l)}
.sg-alert__icon{display:grid;flex:none;place-items:center;inline-size:1.5em;block-size:1.5em;border-radius:var(--radius-circle);font-size:var(--ex-text-s);font-weight:700;line-height:1}
.sg-alert__body{display:flex;flex-direction:column;gap:var(--ex-space-3xs);font-size:var(--ex-text-s);line-height:var(--text-line-height)}
.sg-alert__body b{font-size:var(--ex-text-m);font-weight:600}
.sg-field{display:flex;flex-direction:column;gap:var(--ex-space-2xs)}
.sg-col--fields{gap:var(--content-gap)}
.sg-input{inline-size:100%;min-block-size:3rem;padding-inline:var(--ex-space-s);background:var(--surface-0);color:var(--text-primary);border:1px solid var(--border-strong);border-radius:var(--ex-radius-m);font:inherit;font-size:var(--ex-text-m);line-height:var(--text-line-height)}
.sg-input::placeholder{color:var(--text-disabled);opacity:1}
.sg-help{font-size:var(--ex-text-s);line-height:var(--text-line-height)}
.sg-flipgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(18rem,1fr));gap:var(--grid-gap)}
.sg-card{display:flex;flex-direction:column;gap:var(--content-gap);padding:var(--ex-space-l);border:1px solid var(--border);border-radius:var(--ex-radius-xxl)}
.sg-card__top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--ex-space-2xs)}
.sg-card__copy{display:flex;flex-direction:column;gap:var(--ex-space-2xs)}
.sg-card__copy h3{margin:0}
.sg-card__actions{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ex-space-xs)}
.sg-chip{padding:var(--ex-space-3xs) var(--ex-space-2xs);border:1px solid;border-radius:var(--radius-circle);font-size:var(--ex-text-xs);font-weight:500;line-height:var(--text-line-height)}

/* Utilities */
.sg-ulist{display:flex;flex-direction:column}
.sg-urow{display:grid;grid-template-columns:12rem 1fr;align-items:start;gap:var(--ex-space-s);padding-block:var(--ex-space-s);border-block-end:1px solid var(--border-subtle)}
.sg-classes{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ex-space-3xs)}
.sg-class{padding:var(--ex-space-3xs) var(--ex-space-2xs);border:1px solid var(--border-subtle);border-radius:var(--ex-radius-s);background:var(--surface-2);color:var(--text-primary);font-family:var(--ex-font-mono);font-size:var(--ex-text-xs);line-height:var(--text-line-height)}
.sg-class.is-off,.sg-off{opacity:.55;text-decoration:line-through}
.sg-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--ex-space-xs);padding-block-start:var(--ex-space-l);border-block-start:1px solid var(--border)}

@media (max-width:720px){
  .sg-srow,.sg-hrow,.sg-fl,.sg-urow{display:flex;flex-direction:column;align-items:stretch;gap:var(--ex-space-2xs)}
  .sg-srow__label,.sg-hrow__meta,.sg-fl__label{inline-size:auto}
  .sg-ramp__cell{block-size:7.5rem}
  .sg-ramp__tag,.sg-surface .sg-over,.sg-surface .sg-mono{display:none}
  .sg-ramp__step{font-size:var(--ex-text-xs)}
  .sg-ramp__cell,.sg-strip__cell,.sg-surface{padding:var(--ex-space-3xs)}
  .sg-strip__cell,.sg-surface b{font-size:calc(var(--ex-text-xs) * .85)}
  .sg-surface{block-size:6.5rem}
  .sg-voice{min-block-size:17rem}
  .sg-btable{min-inline-size:52rem}
  .sg-btable__row{grid-template-columns:9rem repeat(5,minmax(8rem,1fr))}
}
`;
