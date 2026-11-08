/**
 * DialKit controls for TwoKit: slider, switch, segmented control.
 *
 * Markup and interaction follow DialKit 2.0 (MIT, Josh Puckett,
 * see assets/vendor/dialkit/LICENSE); colors come from TwoKit variables
 * in css/components/dial.css.
 *
 * Every control fires bubbling CustomEvents with { key, value }:
 *   dial:input   while a slider is being dragged (patch previews only)
 *   dial:change  when the value is committed (update state)
 */

import { esc } from './components.js';

const CLICK_THRESHOLD = 3;
const DEAD_ZONE = 32;
const MAX_CURSOR_RANGE = 200;
const MAX_STRETCH = 8;
const HANDLE_BUFFER = 8;
const LABEL_LEFT = 10;
const VALUE_RIGHT = 12;
const EDIT_DELAY = 800;
const PILL_MS = 180;

const decimalsFor = (...values) => Math.min(6, Math.max(...values.map((v) => {
    const [coefficient, exponent = '0'] = String(v).toLowerCase().split('e');
    return Math.max(0, (coefficient.split('.')[1]?.length ?? 0) - Number(exponent));
})));

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function roundTo(value, step, min, max) {
    const clamped = clamp(value, min, max);
    if (clamped === min || clamped === max || !(step > 0)) return clamped;
    const snapped = min + Math.round((clamped - min) / step) * step;
    return clamp(Number(snapped.toPrecision(14)), min, max);
}

function snapToDecile(raw, min, max) {
    const normalized = (raw - min) / (max - min);
    const nearest = Math.round(normalized * 10) / 10;
    return Math.abs(normalized - nearest) <= 0.03125 ? min + nearest * (max - min) : raw;
}

function keyValue(key, value, min, max, step, shift) {
    if (key === 'Home') return min;
    if (key === 'End') return max;
    const direction = ['ArrowRight', 'ArrowUp', 'PageUp'].includes(key) ? 1 : ['ArrowLeft', 'ArrowDown', 'PageDown'].includes(key) ? -1 : 0;
    if (!direction) return undefined;
    const amount = key.startsWith('Page') || shift ? 10 : 1;
    const position = (value - min) / step;
    const next = direction > 0 ? Math.floor(position + 1e-9) + amount : Math.ceil(position - 1e-9) - amount;
    return clamp(Number((min + next * step).toPrecision(14)), min, max);
}

// ─── Markup ────────────────────────────────────────────────────────────────

export function dialSlider({ key, label, value, min = 0, max = 1, step = 0.01, unit = '', fid }) {
    const pct = ((value - min) / (max - min)) * 100;
    const steps = (max - min) / step;
    const marks = steps <= 10
        ? Array.from({ length: Math.max(steps - 1, 0) }, (_, i) => (((i + 1) * step) / (max - min)) * 100)
        : Array.from({ length: 9 }, (_, i) => (i + 1) * 10);
    const shown = Number(value).toFixed(decimalsFor(step, min, max));
    return `
      <div class="dk-slider-wrap">
        <div class="dk-slider" role="slider" tabindex="0" data-dial-slider data-key="${esc(key)}" data-fid="${esc(fid || `dial-${key}`)}"
             data-min="${min}" data-max="${max}" data-step="${step}" data-value="${value}" data-unit="${esc(unit)}"
             aria-label="${esc(label)}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${value}"
             aria-valuetext="${esc(`${shown}${unit ? ` ${unit}` : ''}`)}" style="--pct:${pct}%">
          <div class="dk-slider__marks" aria-hidden="true">${marks.map((left) => `<span class="dk-slider__mark" style="left:${left}%"></span>`).join('')}</div>
          <div class="dk-slider__fill" aria-hidden="true"></div>
          <div class="dk-slider__handle" aria-hidden="true"></div>
          <span class="dk-slider__label">${esc(label)}</span>
          <span class="dk-slider__value">${esc(shown)}</span>
        </div>
      </div>`;
}

export function dialSegmented({ key, value, options, label, fid }) {
    const index = options.findIndex((o) => String(o.value) === String(value));
    const shown = index < 0 ? 0 : index;
    return `
      <div class="dk-segmented${index < 0 ? ' dk-segmented--none' : ''}" role="radiogroup" aria-label="${esc(label)}" data-dial-segmented data-key="${esc(key)}"
           style="--count:${options.length};--index:${shown}">
        <span class="dk-segmented__pill" aria-hidden="true"></span>
        ${options.map((o, i) => `
          <button type="button" class="dk-segmented__btn" role="radio" data-value="${esc(o.value)}"
                  data-fid="${esc(fid || `dial-${key}`)}-${esc(o.value)}"
                  aria-checked="${i === index}" tabindex="${i === shown ? 0 : -1}">${esc(o.label)}</button>`).join('')}
      </div>`;
}

/** Labeled Off/On row, DialKit's toggle. `bare` renders the segmented part alone. */
export function dialSwitch({ key, label, checked, bare = false, fid }) {
    const control = dialSegmented({
        key,
        value: checked ? 'on' : 'off',
        options: [{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }],
        label,
        fid
    }).replace('data-dial-segmented', 'data-dial-segmented data-dial-switch');
    if (bare) return control;
    return `
      <div class="dk-row">
        <span class="dk-row__label">${esc(label)}</span>
        ${control}
      </div>`;
}

/** Labeled row with any DialKit segmented control on the right. */
export function dialRow(label, control) {
    return `
      <div class="dk-row">
        <span class="dk-row__label">${esc(label)}</span>
        ${control}
      </div>`;
}

export function dialButton({ action, label, fid, disabled = false }) {
    return `<button type="button" class="dk-button" data-action="${esc(action)}" data-fid="${esc(fid || action)}"${disabled ? ' disabled' : ''}>${esc(label)}</button>`;
}

// ─── Behaviour ─────────────────────────────────────────────────────────────

function emit(el, type, key, value) {
    el.dispatchEvent(new CustomEvent(type, { bubbles: true, detail: { key, value } }));
}

function readSlider(el) {
    return {
        key: el.dataset.key,
        min: Number(el.dataset.min),
        max: Number(el.dataset.max),
        step: Number(el.dataset.step),
        value: Number(el.dataset.value),
        unit: el.dataset.unit || ''
    };
}

function paintSlider(el, value) {
    const { min, max, step, unit } = readSlider(el);
    const pct = ((value - min) / (max - min)) * 100;
    const shown = value.toFixed(decimalsFor(step, min, max));
    el.dataset.value = String(value);
    el.style.setProperty('--pct', `${pct}%`);
    el.setAttribute('aria-valuenow', String(value));
    el.setAttribute('aria-valuetext', `${shown}${unit ? ` ${unit}` : ''}`);
    const valueEl = el.querySelector('.dk-slider__value');
    if (valueEl) valueEl.textContent = shown;
    dodge(el, pct);
}

/** Fade the handle when it would sit on top of the label or the value. */
function dodge(el, pct) {
    const width = el.offsetWidth;
    const label = el.querySelector('.dk-slider__label');
    const value = el.querySelector('.dk-slider__value');
    if (!width || !label || !value) return;
    const left = ((LABEL_LEFT + label.offsetWidth + HANDLE_BUFFER) / width) * 100;
    const right = ((width - VALUE_RIGHT - value.offsetWidth - HANDLE_BUFFER) / width) * 100;
    el.classList.toggle('is-dodging', pct < left || pct > right);
}

const drag = { el: null, start: null, isClick: true, rect: null, id: null };

function positionValue(el, clientX) {
    const { min, max } = readSlider(el);
    const rect = drag.rect || el.getBoundingClientRect();
    const percent = clamp((clientX - rect.left) / rect.width, 0, 1);
    return min + percent * (max - min);
}

function stretch(el, clientX) {
    const rect = drag.rect;
    let px = 0;
    if (clientX < rect.left || clientX > rect.right) {
        const sign = clientX < rect.left ? -1 : 1;
        const past = sign < 0 ? rect.left - clientX : clientX - rect.right;
        px = sign * MAX_STRETCH * Math.sqrt(Math.min(Math.max(0, past - DEAD_ZONE) / MAX_CURSOR_RANGE, 1));
    }
    el.style.width = `calc(100% + ${Math.abs(px)}px)`;
    el.style.transform = `translateX(${px < 0 ? px : 0}px)`;
}

function onPointerDown(event) {
    const el = event.target.closest('[data-dial-slider]');
    if (!el || event.button !== 0 || event.target.closest('.dk-slider__input')) return;
    if (event.target.closest('.dk-slider__value.is-editable')) return;
    event.preventDefault();
    el.setPointerCapture(event.pointerId);
    el.focus({ preventScroll: true });
    Object.assign(drag, { el, start: { x: event.clientX, y: event.clientY }, isClick: true, rect: el.getBoundingClientRect(), id: event.pointerId });
    el.classList.add('is-interacting');
}

function onPointerMove(event) {
    const el = drag.el;
    if (!el || event.pointerId !== drag.id) return;
    const distance = Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y);
    if (drag.isClick && distance > CLICK_THRESHOLD) {
        drag.isClick = false;
        el.classList.add('is-dragging');
    }
    if (drag.isClick) return;
    stretch(el, event.clientX);
    const { key, min, max, step } = readSlider(el);
    const value = roundTo(positionValue(el, event.clientX), step, min, max);
    if (value !== Number(el.dataset.value)) {
        paintSlider(el, value);
        emit(el, 'dial:input', key, value);
    }
}

function endDrag(event, cancelled) {
    const el = drag.el;
    if (!el || event.pointerId !== drag.id) return;
    const { key, min, max, step } = readSlider(el);
    if (!cancelled && drag.isClick) {
        const raw = positionValue(el, event.clientX);
        const snapped = (max - min) / step <= 10
            ? clamp(min + Math.round((raw - min) / step) * step, min, max)
            : snapToDecile(raw, min, max);
        paintSlider(el, roundTo(snapped, step, min, max));
    }
    el.classList.add('is-settling');
    el.style.width = '';
    el.style.transform = '';
    setTimeout(() => el.classList.remove('is-settling'), 260);
    el.classList.remove('is-interacting', 'is-dragging');
    Object.assign(drag, { el: null, start: null, rect: null, id: null });
    if (!cancelled) emit(el, 'dial:change', key, Number(el.dataset.value));
}

function onSliderKey(event) {
    const el = event.target;
    if (!el.matches?.('[data-dial-slider]') || event.altKey || event.metaKey || event.ctrlKey) return;
    const { key, min, max, step, value } = readSlider(el);
    if (event.key === 'Enter') {
        event.preventDefault();
        openEditor(el);
        return;
    }
    const next = keyValue(event.key, value, min, max, step, event.shiftKey);
    if (next === undefined) return;
    event.preventDefault();
    paintSlider(el, next);
    emit(el, 'dial:change', key, next);
}

function openEditor(el) {
    const valueEl = el.querySelector('.dk-slider__value');
    if (!valueEl || el.querySelector('.dk-slider__input')) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'dk-slider__input';
    input.value = valueEl.textContent;
    input.setAttribute('aria-label', `${el.getAttribute('aria-label')} value`);
    valueEl.hidden = true;
    el.appendChild(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (commit) => {
        if (done) return;
        done = true;
        const { key, min, max, step } = readSlider(el);
        const parsed = Number.parseFloat(input.value);
        input.remove();
        valueEl.hidden = false;
        valueEl.classList.remove('is-editable');
        if (commit && Number.isFinite(parsed)) {
            const next = roundTo(parsed, step, min, max);
            paintSlider(el, next);
            emit(el, 'dial:change', key, next);
        }
        el.focus({ preventScroll: true });
    };
    input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('pointerdown', (e) => e.stopPropagation());
}

let hoverTimer = null;

function onValueHover(event) {
    const valueEl = event.target.closest?.('.dk-slider__value');
    if (!valueEl) return;
    clearTimeout(hoverTimer);
    if (event.type === 'mouseover') {
        hoverTimer = setTimeout(() => valueEl.classList.add('is-editable'), EDIT_DELAY);
    } else if (!valueEl.contains(event.relatedTarget)) {
        valueEl.classList.remove('is-editable');
    }
}

function onClick(event) {
    const editable = event.target.closest('.dk-slider__value.is-editable');
    if (editable) {
        event.preventDefault();
        openEditor(editable.closest('[data-dial-slider]'));
        return;
    }
    const button = event.target.closest('.dk-segmented__btn');
    if (!button) return;
    selectSegment(button);
}

function selectSegment(button) {
    const group = button.closest('[data-dial-segmented]');
    const buttons = [...group.querySelectorAll('.dk-segmented__btn')];
    const index = buttons.indexOf(button);
    if (button.getAttribute('aria-checked') === 'true') return;
    group.style.setProperty('--index', index);
    buttons.forEach((b, i) => {
        b.setAttribute('aria-checked', String(i === index));
        b.tabIndex = i === index ? 0 : -1;
    });
    const raw = button.dataset.value;
    const value = group.hasAttribute('data-dial-switch') ? raw === 'on' : raw;
    setTimeout(() => emit(group, 'dial:change', group.dataset.key, value), PILL_MS);
}

function onSegmentKey(event) {
    const button = event.target.closest?.('.dk-segmented__btn');
    if (!button || event.altKey || event.metaKey || event.ctrlKey) return;
    const buttons = [...button.parentElement.querySelectorAll('.dk-segmented__btn:not(:disabled)')];
    const i = buttons.indexOf(button);
    const delta = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
    let next;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else if (delta) next = (i + delta + buttons.length) % buttons.length;
    if (next === undefined) return;
    event.preventDefault();
    buttons[next].focus();
    selectSegment(buttons[next]);
}

function onHover(event) {
    const el = event.target.closest?.('[data-dial-slider]');
    if (!el) return;
    if (event.type === 'mouseover') {
        el.classList.add('is-hovered');
        dodge(el, parseFloat(el.style.getPropertyValue('--pct')) || 0);
    } else if (!el.contains(event.relatedTarget)) {
        el.classList.remove('is-hovered');
    }
}

const Dial = {
    init() {
        if (this.ready) return;
        this.ready = true;
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', (e) => endDrag(e, false));
        document.addEventListener('pointercancel', (e) => endDrag(e, true));
        document.addEventListener('keydown', onSliderKey);
        document.addEventListener('keydown', onSegmentKey);
        document.addEventListener('click', onClick);
        document.addEventListener('mouseover', onHover);
        document.addEventListener('mouseout', onHover);
        document.addEventListener('mouseover', onValueHover);
        document.addEventListener('mouseout', onValueHover);
    }
};

export default Dial;
