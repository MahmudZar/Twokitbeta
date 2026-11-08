/**
 * Viewport: show any preview at a real device width, scaled down to fit its
 * pane. Same approach as Bricks' builder canvas:
 *
 *   scale  = min(paneWidth / deviceWidth, 1)        never zooms in
 *   frame  width  = deviceWidth                     media queries and vw see the device
 *          height = paneHeight / scale              fills the pane after scaling
 *          transform: scale(scale), origin 0 0
 *          margin-inline-start = (paneWidth − deviceWidth × scale) / 2   centered
 *
 * Global and reusable. A preview opts in with two pieces of markup, tied by a
 * group name, and one registration that says where the group's choice lives:
 *
 *   Viewport.register('example', { get: () => state, set: (state) => … });
 *   viewportControls('example')                    device switch + width field + scale
 *   viewportStage('example', '<iframe …>')          the scaled stage (first child is scaled)
 *
 * Stages are found automatically (MutationObserver) and re-measured on every
 * resize (ResizeObserver), so re-rendered screens, window resizes and a
 * collapsing sidebar all keep the scale right. Device widths follow the
 * user's viewport range: Mobile = typography min viewport, Desktop = max.
 *
 * @module viewport
 */

import AppState from '../state/appState.js';
import { esc } from './components.js';
import { dialSegmented } from './dial.js';

export const MIN_WIDTH = 320;
export const MAX_WIDTH = 2560;
const TABLET = 768;
const MIN_SCALE = 0.1;

const clampWidth = (n) => Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number(n) || 0)));

/** Device presets. Fit = the pane's own width, unscaled. */
export function devices() {
    const t = AppState.typography;
    return [
        { value: 'fit', label: 'Fit', width: 0 },
        { value: 'desktop', label: 'Desktop', width: clampWidth(t.maxViewport || 1440) },
        { value: 'tablet', label: 'Tablet', width: TABLET },
        { value: 'mobile', label: 'Mobile', width: clampWidth(t.minViewport || 375) }
    ];
}

/** px width for a { device, width } state; 0 = fit the pane. */
export function widthOf(state = {}) {
    if (state.device === 'custom') return clampWidth(state.width);
    return devices().find((d) => d.value === state.device)?.width ?? 0;
}

const groups = new Map();
const stateOf = (group) => {
    const s = groups.get(group)?.get() || {};
    const known = s.device === 'custom' || devices().some((d) => d.value === s.device);
    return { device: known ? s.device : 'fit', width: Number(s.width) || 0 };
};
const sel = (group) => CSS.escape(group);

/** The scaled stage. `inner` should be one element (an iframe, usually). */
export function viewportStage(group, inner) {
    return `<div class="vp" data-viewport="${esc(group)}" data-vp-width="${widthOf(stateOf(group))}">${inner}</div>`;
}

/** Device switch, width field and scale readout for a group. */
export function viewportControls(group, { label = 'Preview width' } = {}) {
    const state = stateOf(group);
    const width = widthOf(state);
    return `
      <div class="vp-controls" data-vp-controls="${esc(group)}">
        ${segmented(group, state, label)}
        <label class="vp-controls__width" title="Preview width (${MIN_WIDTH}–${MAX_WIDTH}px). Arrow keys step 1px, Shift 10px.">
          <input type="text" inputmode="numeric" autocomplete="off" spellcheck="false" data-vp-input="${esc(group)}"
                 value="${width || ''}" placeholder="Auto" aria-label="${esc(label)} in px"><span aria-hidden="true">px</span>
        </label>
        <output class="vp-controls__scale" data-vp-readout="${esc(group)}" title="Preview scale"></output>
      </div>`;
}

function segmented(group, state, label) {
    return dialSegmented({
        key: `viewport:${group}`,
        value: state.device,
        options: devices().map(({ value, label: text }) => ({ value, label: text })),
        label,
        fid: `vp-${group}`
    });
}

const Viewport = {
    register(group, { get, set }) {
        groups.set(group, { get, set });
    },

    /** Change a group's device/width: store it, resize its stages, update its controls. */
    set(group, next, { fromSwitch = false } = {}) {
        const state = { device: next.device, width: next.device === 'custom' ? clampWidth(next.width) : stateOf(group).width };
        // A typed width that matches a preset selects the preset.
        if (state.device === 'custom') {
            const preset = devices().find((d) => d.width && d.width === state.width);
            if (preset) state.device = preset.value;
        }
        groups.get(group)?.set(state);
        this.refresh(group, { fromSwitch });
    },

    /** Re-read a group's state (preset widths follow the typography viewport range). */
    refresh(group, { fromSwitch = false } = {}) {
        const state = stateOf(group);
        const width = widthOf(state);
        document.querySelectorAll(`[data-viewport="${sel(group)}"]`).forEach((vp) => {
            vp.dataset.vpWidth = String(width);
            this.apply(vp);
        });
        document.querySelectorAll(`[data-vp-controls="${sel(group)}"]`).forEach((controls) => {
            const current = controls.querySelector('[data-dial-segmented]');
            const label = current?.getAttribute('aria-label') || 'Preview width';
            // The switch animates itself when clicked; otherwise redraw it (typed width, new preset widths).
            if (current && !fromSwitch) current.outerHTML = segmented(group, state, label);
            const input = controls.querySelector('[data-vp-input]');
            if (input && document.activeElement !== input) input.value = width || '';
        });
    },

    /** Size and scale one stage's first child to its device width. */
    apply(vp) {
        const target = vp.firstElementChild;
        if (!target) return;
        const paneW = vp.clientWidth;
        const paneH = vp.clientHeight;
        if (!paneW || !paneH) return; // hidden: the ResizeObserver calls again when it shows
        const width = Number(vp.dataset.vpWidth) || 0;
        const s = target.style;
        let scale = 1;
        if (!width) {
            s.width = '100%';
            s.height = '100%';
            s.transform = '';
            s.marginInlineStart = '';
            vp.classList.remove('is-device');
        } else {
            scale = Math.max(MIN_SCALE, Math.min(1, Math.floor((paneW / width) * 10000) / 10000));
            s.width = `${width}px`;
            s.height = `${paneH / scale}px`;
            s.transform = scale < 1 ? `scale(${scale})` : '';
            s.marginInlineStart = `${Math.max(0, (paneW - width * scale) / 2)}px`;
            vp.classList.add('is-device');
        }
        vp.dataset.vpScale = String(scale);
        const readout = document.querySelector(`[data-vp-readout="${sel(vp.dataset.viewport)}"]`);
        if (readout) {
            readout.textContent = `${width || paneW}px · ${Math.round(scale * 100)}%`;
            readout.title = width ? `Previewing ${width}px wide at ${Math.round(scale * 100)}% to fit the pane` : 'Fills the pane at 100%';
        }
    },

    commitInput(input) {
        const group = input.dataset.vpInput;
        const raw = input.value.trim();
        if (!raw) return this.set(group, { device: 'fit' });
        const n = Number.parseFloat(raw.replace(',', '.'));
        if (!Number.isFinite(n)) {
            input.value = widthOf(stateOf(group)) || '';
            return;
        }
        this.set(group, { device: 'custom', width: n });
        input.value = widthOf(stateOf(group)) || '';
    },

    init() {
        if (this.ready) return;
        this.ready = true;

        const watched = new WeakSet();
        const resize = new ResizeObserver((entries) => entries.forEach((e) => this.apply(e.target)));
        const scan = () => document.querySelectorAll('[data-viewport]').forEach((vp) => {
            if (watched.has(vp)) return;
            watched.add(vp);
            resize.observe(vp); // first callback sizes it before paint
        });
        new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
        scan();

        // Captured at the document so screens never see these controls' events.
        document.addEventListener('dial:change', (event) => {
            const m = /^viewport:(.+)$/.exec(event.detail?.key || '');
            if (!m) return;
            event.stopPropagation();
            this.set(m[1], { device: event.detail.value }, { fromSwitch: true });
        }, true);
        for (const type of ['input', 'change']) {
            document.addEventListener(type, (event) => {
                if (!event.target.matches?.('[data-vp-input]')) return;
                event.stopPropagation();
                if (type === 'change') this.commitInput(event.target);
            }, true);
        }
        document.addEventListener('keydown', (event) => {
            const input = event.target.closest?.('[data-vp-input]');
            if (!input) return;
            event.stopPropagation();
            if (event.key === 'Enter') { event.preventDefault(); this.commitInput(input); input.select(); }
            if (event.key === 'Escape') { input.value = widthOf(stateOf(input.dataset.vpInput)) || ''; input.blur(); }
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                const group = input.dataset.vpInput;
                const vp = document.querySelector(`[data-viewport="${sel(group)}"]`);
                const from = widthOf(stateOf(group)) || vp?.clientWidth || 1440;
                const step = (event.shiftKey ? 10 : 1) * (event.key === 'ArrowUp' ? 1 : -1);
                this.set(group, { device: 'custom', width: from + step });
                input.value = widthOf(stateOf(group));
            }
        }, true);
    }
};

export default Viewport;
