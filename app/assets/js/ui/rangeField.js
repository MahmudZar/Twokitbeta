/**
 * RangeField: a labelled slider row. Label, a chip naming the nearest mark
 * (Tight / Normal …), an optional "fx" toggle for typing a raw value, a
 * number field with its unit, the slider with tick marks and the mark labels
 * under it.
 *
 * Built on <input type="range">, so keyboard (arrows, PageUp/Down, Home/End),
 * touch, and screen readers work natively. Reusable: a screen renders it and
 * listens to its events (Shell forwards input/change/click):
 *
 *   input  [data-rf-range]   live, while dragging   → paint the preview
 *   change [data-rf-range]   committed              → save
 *   change [data-rf-num]     typed value (Enter / blur)
 *   click  [data-rf-fx]      toggle the raw-value field
 *
 * rangeFieldSync() repaints the fill, number and chip during a drag without
 * re-rendering the row (which would drop the pointer).
 *
 * @module rangeField
 */

import { esc } from './components.js';

const fraction = (value, min, max) => Math.min(1, Math.max(0, (value - min) / (max - min)));
const fmt = (value, decimals) => Number(value).toFixed(decimals);

/** The mark whose value is within `tolerance` of `value` (for the chip), else null. */
export function nearMark(value, marks = [], tolerance = 0) {
    let best = null;
    for (const m of marks) {
        if (!m.label || m.end) continue;
        const d = Math.abs(m.value - value);
        if (d <= tolerance + 1e-9 && (!best || d < Math.abs(best.value - value))) best = m;
    }
    return best;
}

/**
 * @param {object} o
 *   id        identifies the field in events (data-rf-*="id")
 *   label     row label
 *   value     number shown on the slider (clamped to min/max for the thumb)
 *   min max step decimals unit
 *   marks     [{ value, label, end? }]: ticks + labels; `end` labels sit at the ends
 *   tolerance how close a value must be to a mark for the chip (default: 2 steps)
 *   fx        { on, field, title } adds the fx toggle; when on, `field` (html) replaces the slider
 *   chip      override the chip text (e.g. "Custom")
 *   fid       focus id prefix
 */
export function rangeField({ id, label, value, min, max, step = 0.01, decimals = 2, unit = '', marks = [], tolerance, fx = null, chip, fid }) {
    const v = Number(value);
    const p = fraction(v, min, max);
    const near = nearMark(v, marks, tolerance ?? step * 2);
    const chipText = chip ?? near?.label ?? '';
    const ticks = marks.filter((m) => !m.end && m.value > min && m.value < max);
    const labels = marks.filter((m) => m.label);
    const base = fid || `rf-${id}`;
    const fxOn = Boolean(fx?.on);
    return `
      <div class="rf${fxOn ? ' is-fx' : ''}" data-range-field="${esc(id)}" data-min="${min}" data-max="${max}" data-decimals="${decimals}" style="--p:${p}">
        <div class="rf__head">
          <span class="rf__label" id="${esc(base)}-label">${esc(label)}</span>
          <span class="rf__chip" data-rf-chip${chipText ? '' : ' hidden'}>${esc(chipText)}</span>
          ${fx ? `<button type="button" class="rf__fx" data-rf-fx="${esc(id)}" aria-pressed="${fxOn}" data-fid="${esc(base)}-fx" title="${esc(fx.title || 'Type a CSS value')}">fx</button>` : ''}
          <label class="rf__num">
            <input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-rf-num="${esc(id)}" data-fid="${esc(base)}-num"
                   value="${esc(Number.isFinite(v) ? fmt(v, decimals) : '')}" aria-label="${esc(label)}${unit ? ` in ${unit}` : ''}"${fxOn ? ' readonly tabindex="-1"' : ''}>
            ${unit ? `<span aria-hidden="true">${esc(unit)}</span>` : ''}
          </label>
        </div>
        ${fxOn ? `<div class="rf__formula">${fx.field}</div>` : `
        <div class="rf__track">
          ${ticks.map((m) => `<span class="rf__tick" style="--at:${fraction(m.value, min, max)}" aria-hidden="true"></span>`).join('')}
          <input type="range" class="rf__range" data-rf-range="${esc(id)}" data-fid="${esc(base)}-range" min="${min}" max="${max}" step="${step}"
                 value="${Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min}" aria-labelledby="${esc(base)}-label"
                 aria-valuetext="${esc(`${fmt(v, decimals)}${unit ? ` ${unit}` : ''}${chipText ? `, ${chipText}` : ''}`)}">
        </div>
        <div class="rf__scale" aria-hidden="true">
          ${labels.map((m) => `<span class="rf__mark${m.end ? ` rf__mark--${m.value <= min ? 'start' : 'end'}` : ''}${near === m ? ' is-on' : ''}" style="--at:${fraction(m.value, min, max)}" data-value="${m.value}">${esc(m.label)}</span>`).join('')}
        </div>`}
      </div>`;
}

/** Repaint a field while dragging: fill, number, chip, active mark. */
export function rangeFieldSync(field, value, { marks = [], tolerance = 0, chip } = {}) {
    if (!field) return;
    const min = Number(field.dataset.min);
    const max = Number(field.dataset.max);
    const decimals = Number(field.dataset.decimals) || 0;
    field.style.setProperty('--p', String(fraction(value, min, max)));
    const num = field.querySelector('[data-rf-num]');
    if (num && document.activeElement !== num) num.value = fmt(value, decimals);
    const near = nearMark(value, marks, tolerance);
    const text = chip ?? near?.label ?? '';
    const chipEl = field.querySelector('[data-rf-chip]');
    if (chipEl) { chipEl.textContent = text; chipEl.hidden = !text; }
    field.querySelectorAll('.rf__mark').forEach((m) => m.classList.toggle('is-on', Boolean(near) && Number(m.dataset.value) === near.value && !m.classList.contains('rf__mark--start') && !m.classList.contains('rf__mark--end')));
    const range = field.querySelector('[data-rf-range]');
    if (range) range.setAttribute('aria-valuetext', `${fmt(value, decimals)}${text ? `, ${text}` : ''}`);
}
