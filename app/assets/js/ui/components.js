/**
 * Markup helpers for every repeated control in the app.
 * Behaviour is delegated: modules read `data-key` / `data-action`
 * attributes, the switcher is driven by ui/switcher.js.
 */

export function esc(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

const ICON = {
    updown: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M13.65 6.78 9 2.13 4.34 6.78l1.06 1.06L9 4.25l3.6 3.6 1.05-1.07ZM4.34 11.22 9 15.87l4.65-4.65-1.06-1.06L9 13.75l-3.6-3.6-1.06 1.07Z" fill="currentColor"/></svg>',
    check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevron: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15 12.5S11.32 7.5 10 7.5 5 12.5 5 12.5" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    minus: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7M6 2.5v7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    bolt: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8.8 1.8 3.6 9h4l-.6 5.2L12.4 7h-4l.4-5.2Z" fill="none" stroke="currentColor" stroke-linejoin="round"/></svg>',
    pencil: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.6 2.9a1.4 1.4 0 0 1 2 2L5.4 12.1l-2.7.7.7-2.7 7.2-7.2ZM9.6 3.9l2 2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    desktop: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="8" rx="1.5" fill="none" stroke="currentColor"/><path d="M5.5 13.5h5" stroke="currentColor" stroke-linecap="round"/></svg>',
    mobile: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4.5" y="1.8" width="7" height="12.4" rx="1.5" fill="none" stroke="currentColor"/><path d="M7.2 12h1.6" stroke="currentColor" stroke-linecap="round"/></svg>',
    eye: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M14.36 7.36c.2.29.31.43.31.64s-.1.35-.31.64C13.45 9.91 11.13 12.67 8 12.67S2.55 9.91 1.64 8.64C1.43 8.35 1.33 8.21 1.33 8s.1-.35.31-.64C2.55 6.09 4.87 3.33 8 3.33s5.45 2.76 6.36 4.03Z" fill="none" stroke="currentColor"/><circle cx="8" cy="8" r="2" fill="none" stroke="currentColor"/></svg>',
    pen: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m2.5 13.5.6-2.8 7.6-7.6a1.4 1.4 0 0 1 2 0l.2.2a1.4 1.4 0 0 1 0 2l-7.6 7.6-2.8.6ZM9.6 4.2l2.2 2.2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sun: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.6" fill="none" stroke="currentColor"/><path d="M8 1.5v1.3M8 13.2v1.3M1.5 8h1.3M13.2 8h1.3M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" stroke="currentColor" stroke-linecap="round"/></svg>',
    moon: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1Z" fill="none" stroke="currentColor" stroke-linejoin="round"/></svg>',
    lock: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" fill="none" stroke="currentColor"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor"/></svg>',
    reset: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    trash: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 3.67 12.59 10.35c-.1 1.7-.16 2.56-.59 3.18a2.67 2.67 0 0 1-.8.75c-.64.39-1.5.39-3.2.39-1.72 0-2.57 0-3.21-.39a2.67 2.67 0 0 1-.8-.75c-.43-.62-.48-1.47-.58-3.18L3 3.67M2 3.67h12M10.7 3.67l-.45-.94c-.3-.62-.46-.94-.72-1.13a1.33 1.33 0 0 0-.18-.11c-.29-.15-.63-.15-1.33-.15-.7 0-1.06 0-1.36.16a1.33 1.33 0 0 0-.18.12c-.27.2-.41.52-.7 1.17l-.41.88M6.33 11V7M9.67 11V7" fill="none" stroke="currentColor" stroke-linecap="round"/></svg>',
    wave: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M5.06 7.7C5.59 5.6 6.9 4.56 9 4.56c3.15 0 3.54 2.36 5.12 2.75 1.05.26 1.97-.13 2.75-1.18-.52 2.1-1.84 3.15-3.94 3.15-3.15 0-3.54-2.36-5.12-2.76-1.05-.26-1.97.13-2.75 1.18ZM1.13 12.43C1.65 10.33 2.96 9.28 5.06 9.28c3.15 0 3.55 2.36 5.12 2.76 1.05.26 1.97-.13 2.76-1.18-.53 2.1-1.84 3.15-3.94 3.15-3.15 0-3.54-2.36-5.12-2.76-1.05-.26-1.97.13-2.75 1.18Z" fill="currentColor"/></svg>',
    harmonize: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8.00065 13.3148C7.18232 12.5824 6.66732 11.518 6.66732 10.3333C6.66732 9.813 6.76665 9.31587 6.94745 8.85987C7.53412 7.37993 8.97852 6.33333 10.6673 6.33333C11.0319 6.33333 11.385 6.38209 11.7205 6.47344C13.4187 6.93573 14.6673 8.48873 14.6673 10.3333C14.6673 12.5425 12.8765 14.3333 10.6673 14.3333C9.64285 14.3333 8.70832 13.9482 8.00065 13.3148ZM6.94745 8.85987C5.72829 8.528 4.74084 7.634 4.28077 6.47344C4.1 6.01745 4.00065 5.52033 4.00065 5C4.00065 2.79086 5.79151 1 8.00065 1C10.2098 1 12.0007 2.79086 12.0007 5C12.0007 5.52033 11.9013 6.01745 11.7205 6.47344M8.00065 13.3148C7.29298 13.9482 6.35846 14.3333 5.33398 14.3333C3.12484 14.3333 1.33398 12.5425 1.33398 10.3333C1.33398 8.48873 2.58261 6.93573 4.28077 6.47344" stroke="currentColor" stroke-linecap="round"/></svg>',
    addCircle: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M14.67 8A6.67 6.67 0 1 0 1.33 8a6.67 6.67 0 0 0 13.34 0Z" fill="none" stroke="currentColor" stroke-linecap="round"/><path d="M8 5.33v5.34M10.67 8H5.33" stroke="currentColor" stroke-linecap="round"/></svg>',
    shuffle: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M9.63 10.21 10.5 9.19H9.42c-.61 0-.92 0-1.18-.13-.26-.13-.43-.37-.77-.85L5.75 5.79c-.34-.48-.51-.72-.77-.85-.26-.13-.56-.13-1.17-.13H3.5m6.13-1.02.87 1.02H9.42c-.61 0-.92 0-1.18.13-.26.13-.43.37-.77.85M3.5 9.19h.31c.61 0 .91 0 1.17-.13.26-.13.43-.37.77-.85" fill="none" stroke="currentColor" stroke-width=".875" stroke-linecap="round" stroke-linejoin="round"/><path d="M1.46 7c0-2.61 0-3.92.81-4.73.81-.81 2.12-.81 4.73-.81s3.92 0 4.73.81c.81.81.81 2.12.81 4.73s0 3.92-.81 4.73c-.81.81-2.12.81-4.73.81s-3.92 0-4.73-.81C1.46 10.92 1.46 9.61 1.46 7Z" fill="none" stroke="currentColor" stroke-width=".875"/></svg>',
    copyImage: '<svg class="action-icon-btn__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.333 8.667V7.105c0-.545 0-.818-.102-1.063-.101-.245-.294-.438-.68-.823L9.394 2.061C9.061 1.729 8.895 1.563 8.689 1.464a2.4 2.4 0 0 0-.132-.055C8.342 1.334 8.107 1.334 7.637 1.334c-2.164 0-3.245 0-3.978.59A3.33 3.33 0 0 0 2.666 2.326c-.591.733-.591 1.815-.591 3.978v2.363M8.666 1.667V2c0 1.886 0 2.829.586 3.414C9.838 6 10.78 6 12.666 6h.333" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.666 14.667v-2m0 0v-2H4c.552 0 1 .447 1 1s-.448 1-1 1H2.666Zm10.667-1.334c0-.368-.299-.666-.667-.666h-1c-.368 0-.666.298-.666.666v2.667c0 .368.298.666.666.666h1c.368 0 .667-.298.667-.666v-1h-.667M6.666 14.667v-4l2.667 4v-4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    copySvg: '<svg class="action-icon-btn__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.333 8.667V7.105c0-.545 0-.818-.102-1.063-.101-.245-.294-.438-.68-.823L9.394 2.061C9.061 1.729 8.895 1.563 8.689 1.464a2.4 2.4 0 0 0-.132-.055C8.342 1.334 8.107 1.334 7.637 1.334c-2.164 0-3.245 0-3.978.59A3.33 3.33 0 0 0 2.666 2.326c-.591.733-.591 1.815-.591 3.978v2.363M8.666 1.667V2c0 1.886 0 2.829.586 3.414C9.838 6 10.78 6 12.666 6h.333" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.666 10.667H3.333c-.368 0-.667.298-.667.666v.667c0 .368.299.666.667.666h.667c.368 0 .666.299.666.667v.667c0 .368-.298.666-.666.666H2.666" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="m9.334 10.667-1.28 3.841a.333.333 0 0 1-.627 0l-1.28-3.841" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.333 11.333c0-.368-.298-.666-.666-.666h-1c-.369 0-.667.298-.667.666v2.667c0 .368.298.666.667.666h1c.368 0 .666-.298.666-.666v-1h-.666" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

export function rampActions(id) {
    return `
      <div class="color-card__ation">
        <button type="button" class="action-icon-btn" data-action="copy-ramp-image" data-palette="${esc(id)}" aria-label="Copy as image" title="Copy as image">${ICON.copyImage}</button>
        <button type="button" class="action-icon-btn" data-action="copy-ramp-svg" data-palette="${esc(id)}" aria-label="Copy as SVG" title="Copy as SVG">${ICON.copySvg}</button>
      </div>`;
}

export { ICON };

/**
 * Dropdown switcher (button + listbox).
 * Fires a bubbling `switcher:change` CustomEvent with { id, value }.
 */
/** Lists longer than this get a search field. */
const SEARCH_FROM = 10;

const optionSwatch = (o) => (o.swatch ? `<i class="switcher__swatch" style="background:${esc(o.swatch)}"></i>` : '');

/** The popover list of a switcher (options + search for long lists). Shared by switcher() and colorField(). */
export function switcherList({ id, options, current, label, mono = false }) {
    const items = options.map((o) => `
        <li class="switcher__option" role="option" id="sw-${esc(id)}-${esc(o.value)}" data-value="${esc(o.value)}"
            aria-selected="${current != null && String(o.value) === String(current)}" tabindex="-1">
          ${optionSwatch(o)}<span>${esc(o.label)}</span>${ICON.check}
        </li>`).join('');
    const search = options.length > SEARCH_FROM ? `
          <div class="switcher__search">
            <input type="search" placeholder="Search ${options.length}…" aria-label="Search ${esc(label)}" aria-controls="sw-${esc(id)}-list" autocomplete="off" spellcheck="false">
          </div>` : '';
    return `
        <div class="switcher__list${mono ? ' switcher__list--mono' : ''}" hidden>${search}
          <ul class="switcher__options" id="sw-${esc(id)}-list" role="listbox" aria-label="${esc(label)}">${items}</ul>
          ${search ? '<p class="switcher__empty" hidden>No match</p>' : ''}
        </div>`;
}

export function switcher({ id, value, options, label = 'Choose view', size = 'md', extraClass = '' }) {
    const current = options.find((o) => String(o.value) === String(value)) || options[0];
    return `
      <div class="switcher switcher--${size}${extraClass ? ` ${extraClass}` : ''}" data-switcher="${esc(id)}">
        <button type="button" class="switcher__trigger" data-fid="switcher-${esc(id)}"
                aria-haspopup="listbox" aria-expanded="false" aria-controls="sw-${esc(id)}-list"
                aria-label="${esc(label)}: ${esc(current.label)}">
          ${optionSwatch(current)}<span class="switcher__value">${esc(current.label)}</span>
          <span class="switcher__icon">${ICON.updown}</span>
        </button>
        ${switcherList({ id, options, current: current.value, label, mono: extraClass.includes('switcher--mono') })}
      </div>`;
}

export function badge(text) {
    return `<span class="badge">${esc(text)}</span>`;
}

/** Heading + optional badge/actions + body. `card` wraps the body in a panel. */
export function group({ title, badge: badgeText, actions = '', body, card = true, tag = 'section' }) {
    return `
      <${tag} class="setting-group">
        <header class="setting-group__header">
          <h2 class="setting-group__title">${esc(title)}</h2>
          ${badgeText ? badge(badgeText) : ''}${actions ? `<div class="setting-group__actions">${actions}</div>` : ''}
        </header>
        ${card ? `<div class="panel">${body}</div>` : body}
      </${tag}>`;
}

/** Label on the left, control on the right. */
export function option(label, controlHtml, forId) {
    return `
      <div class="option">
        ${forId ? `<label class="option__label" for="${forId}">${esc(label)}</label>` : `<span class="option__label">${esc(label)}</span>`}
        <div class="option__control">${controlHtml}</div>
      </div>`;
}

export function stepper({ key, value, step = 1, min, max, label, decimals = 0 }) {
    const shown = Number(value).toFixed(decimals);
    return `
      <div class="stepper">
        <button type="button" class="stepper__btn" data-step="-1" data-key="${key}" data-size="${step}"
                data-fid="${key}-dec" aria-label="Decrease ${esc(label)}">${ICON.minus}</button>
        <input class="stepper__input" type="number" inputmode="decimal" data-key="${key}" data-fid="${key}-input"
               value="${shown}" step="${step}" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''}
               aria-label="${esc(label)}">
        <button type="button" class="stepper__btn" data-step="1" data-key="${key}" data-size="${step}"
                data-fid="${key}-inc" aria-label="Increase ${esc(label)}">${ICON.plus}</button>
      </div>`;
}

export function unitInput({ key, value, unit = 'px', label, min, max, id }) {
    return `
      <span class="unit-input">
        <input type="number" inputmode="numeric" id="${id || `in-${key}`}" data-key="${key}" data-fid="${key}-input"
               value="${esc(value)}" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''}
               aria-label="${esc(label)}">
        <span class="unit-input__unit" aria-hidden="true">${esc(unit)}</span>
      </span>`;
}

/** Circular swatch that opens the global Pretty Color Picker. */
export function colorSwatch({ hex, label, fid, field = 'picker' }) {
    return `
      <button type="button" class="color-field__swatch" data-color-swatch style="--swatch:${esc(hex)}"
              data-color="${esc(hex)}" aria-label="${esc(label)}" title="${esc(label)}" aria-haspopup="dialog" aria-expanded="false">
        <input type="hidden" value="${esc(hex)}" data-field="${esc(field)}" data-fid="${esc(fid)}">
      </button>`;
}

export function textInput({ key, value, label, id, mono = true }) {
    return `<input class="text-input${mono ? ' text-input--mono' : ''}" id="${id || `in-${key}`}" data-key="${key}"
                   data-fid="${key}-input" value="${esc(value)}" spellcheck="false" aria-label="${esc(label)}">`;
}

export function selectInput({ key, value, options, label, id, mono = false }) {
    const items = options.map((o) => {
        const v = typeof o === 'object' ? o.value : o;
        const l = typeof o === 'object' ? o.label : o;
        return { value: String(v), label: String(l), swatch: o?.swatch };
    });
    return switcher({
        id: key,
        value: String(value ?? ''),
        options: items,
        label,
        size: 'sm',
        extraClass: mono ? 'switcher--mono' : ''
    });
}

/** Row of toggle buttons (aria-pressed). */
export function choices({ key, value, options, columns = 2, label }) {
    return `
      <div class="choices" role="group" aria-label="${esc(label)}" style="--cols:${columns}">
        ${options.map((o) => `
          <button type="button" class="choice" data-choice="${key}" data-value="${esc(o.value)}"
                  data-fid="${key}-${esc(o.value)}" aria-pressed="${String(o.value) === String(value)}">
            <span>${esc(o.label)}</span>
          </button>
        `).join('')}
      </div>`;
}

/**
 * Ratio preset grid. Every chip shows name + value so rows stay even; the
 * recommended ratio for the active device gets a small dot, explained once
 * by the legend underneath.
 */
export function ratioPresets({ ratios, value, recommended, device, label }) {
    const same = (a, b) => Math.abs(Number(a) - Number(b)) < 0.0005;
    return `
      <div class="ratio-presets">
        <div class="choices" role="group" aria-label="${esc(label)}" style="--cols:2">
          ${ratios.map((r) => {
              const isRec = same(r.value, recommended);
              return `
            <button type="button" class="choice choice--ratio" data-choice="ratio" data-value="${esc(r.value)}"
                    data-fid="ratio-${esc(r.value)}" aria-pressed="${same(r.value, value)}"
                    ${isRec ? `title="Recommended for ${esc(device)}"` : ''}>
              <span>${esc(r.label)}</span>
              <span class="choice__value">${Number(r.value).toFixed(3)}</span>
              ${isRec ? `<span class="choice__dot" aria-label="Recommended"></span>` : ''}
            </button>`;
          }).join('')}
        </div>
        <p class="ratio-presets__legend"><span class="choice__dot" aria-hidden="true"></span>Recommended for ${esc(device)}</p>
      </div>`;
}

export function iconButton({ action, label, icon, pressed, expanded, extra = '' }) {
    const pressedAttr = pressed == null ? '' : `aria-pressed="${pressed}"`;
    const expandedAttr = expanded == null ? '' : `aria-expanded="${expanded}" aria-haspopup="dialog"`;
    return `<button type="button" class="icon-btn" data-action="${action}" data-fid="${action}${extra ? '-' + esc(extra) : ''}"
                    aria-label="${esc(label)}" title="${esc(label)}" ${pressedAttr} ${expandedAttr} ${extra ? `data-extra="${esc(extra)}"` : ''}>${ICON[icon] || icon}</button>`;
}

/** Add / remove a step at either end of a Core-style scale. */
export function scaleEnds({ next, current, actionAdd, actionRemove, canRemove, fid }) {
    return `
      <div class="scale-ends">
        <button type="button" class="btn-dashed btn-dashed--sm" data-action="${actionAdd}"
                data-fid="${fid}-add" ${next ? '' : 'disabled'}>
          ${ICON.addCircle}<span>${next ? `Add ${stepLabel(next)}` : 'No more steps'}</span>
        </button>
        <button type="button" class="scale-ends__remove" data-action="${actionRemove}"
                data-fid="${fid}-remove" ${canRemove ? '' : 'disabled'} aria-label="Remove ${esc(stepLabel(current))}">
          ${ICON.minus}<span>Remove ${esc(stepLabel(current))}</span>
        </button>
      </div>`;
}

function stepLabel(step) {
    return String(step || '').toUpperCase();
}

/**
 * Bordered variable table: `--token` name column + control cell.
 * `nameMax` caps the name column (wider for single-control rows).
 */
export function varTable(rows, { label, nameMax } = {}) {
    return `<div class="var-table"${nameMax ? ` style="--name-max:${nameMax}"` : ''}${label ? ` role="group" aria-label="${esc(label)}"` : ''}>${rows.join('')}</div>`;
}

/** One row of varTable. `cols` sets how many controls share the cell. */
export function varRow(name, cell, { cols = 1 } = {}) {
    return `
      <div class="var-row">
        <span class="var-row__name">${esc(name).replace(/(?<=\w)-/g, '-<wbr>')}</span>
        <div class="var-row__cell" style="--cols:${cols}">${cell}</div>
      </div>`;
}

/**
 * Number field with an optional green tag ("Max"/"Min") and inline unit.
 * A text input, so there are no spinner arrows; modules parse it on change.
 * `data` becomes data-* attributes on the input.
 */
export function numField({ tag = '', value, unit = 'px', data = {}, label, fid, placeholder = '' }) {
    const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
    return `
      <label class="num-field">
        ${tag ? `<span class="num-field__tag">${esc(tag)}</span>` : ''}
        <span class="num-field__box">
          <input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(value ?? '')}"
                 ${placeholder !== '' ? `placeholder="${esc(placeholder)}"` : ''}
                 ${attrs} ${fid ? `data-fid="${esc(fid)}"` : ''} aria-label="${esc(label)}">${unit ? `<span class="num-field__unit">${esc(unit)}</span>` : ''}
        </span>
      </label>`;
}

/** Parse a numField value; returns null when it isn't a number. */
export function readNum(raw, min, max) {
    const value = Math.round(Number.parseFloat(String(raw).replace(',', '.')) * 100) / 100;
    if (!Number.isFinite(value)) return null;
    return Math.min(max, Math.max(min, value));
}

/** Simple token table: rows of [label, ...cells]. */
export function tokenTable({ head, rows, caption }) {
    return `
      <table class="token-table">
        ${caption ? `<caption class="visually-hidden">${esc(caption)}</caption>` : ''}
        ${head ? `<thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>` : ''}
        <tbody>${rows.join('')}</tbody>
      </table>`;
}
