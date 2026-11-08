/**
 * Global Pretty Color Picker (https://github.com/kiiradesign/pretty-color-picker).
 * One popover instance, opened from any `[data-color-swatch]` trigger.
 * Alpha is hidden — brand and surface colors stay opaque.
 */

import '../../vendor/pretty-color-picker.js';
import AppState from '../state/appState.js';
import ColorModule from '../modules/colorModule.js';

let uid = 0;

function opaqueHex(raw) {
    const value = String(raw || '#000000').trim();
    const hex = value.startsWith('#') ? value : `#${value}`;
    if (/^#[0-9a-f]{8}$/i.test(hex)) return `#${hex.slice(1, 7)}`.toLowerCase();
    if (/^#[0-9a-f]{6}$/i.test(hex)) return hex.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(hex)) {
        return `#${hex.slice(1).split('').map((c) => c + c).join('')}`.toLowerCase();
    }
    return '#000000';
}

const ColorPicker = {
    init() {
        this.el = document.createElement('pretty-color-picker');
        this.el.className = 'app-color-picker';
        this.el.setAttribute('mode', 'popover');
        this.el.setAttribute('theme', 'dark');
        this.el.setAttribute('header-action', 'close');
        this.el.setAttribute('label', 'Color picker');
        document.body.appendChild(this.el);
        this.hideAlpha();

        this.el.addEventListener('change', (event) => this.onPick(event));
        this.el.addEventListener('close', () => this.commit());

        document.addEventListener('click', (event) => {
            const swatch = event.target.closest('[data-color-swatch]');
            if (!swatch) return;
            event.preventDefault();
            event.stopPropagation();
            ColorModule.closePicker?.();
            this.toggle(swatch);
        }, true);
    },

    hideAlpha() {
        const root = this.el.shadowRoot;
        if (!root || root.querySelector('[data-twokit-opaque]')) return;
        const style = document.createElement('style');
        style.dataset.twokitOpaque = '';
        style.textContent = `
          .pcp-alpha-row,
          .pcp-alpha-input { display: none !important; }
        `;
        root.appendChild(style);
    },

    toggle(swatch) {
        if (this.target === swatch && this.el.open) {
            this.hide();
            return;
        }
        this.open(swatch);
    },

    open(swatch) {
        this.hideAlpha();
        this.target = swatch;
        if (!swatch.id) swatch.id = `color-swatch-${++uid}`;
        const hex = opaqueHex(swatch.dataset.color || swatch.style.getPropertyValue('--swatch'));
        this.el.anchor = `#${CSS.escape(swatch.id)}`;
        this.el.value = hex;
        const current = this.el.color;
        if (current && current.alpha !== 1) this.el.color = { ...current, alpha: 1 };
        swatch.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => this.el.show());
    },

    hide() {
        if (!this.el) return;
        if (this.el.open) this.el.hide();
        this.release();
    },

    release() {
        this.target?.setAttribute('aria-expanded', 'false');
        this.target = null;
    },

    onPick(event) {
        const hex = opaqueHex(event.detail?.hex || this.el.value);
        const swatch = this.target;
        if (!swatch) return;
        // Opening the picker (or a pick that lands on the same color) changes nothing.
        if (hex === opaqueHex(swatch.dataset.color || swatch.style.getPropertyValue('--swatch'))) return;
        swatch.style.setProperty('--swatch', hex);
        swatch.dataset.color = hex;
        const input = swatch.querySelector('[data-field="picker"]');
        if (input) {
            input.value = hex;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            // The screen paints the pick itself and re-renders when the picker closes; the
            // project has changed already, so autosave and the hosts' Save button hear it now.
            this.picked = true;
            AppState.notify('live');
        }
    },

    commit() {
        const swatch = this.target;
        const input = swatch?.querySelector('[data-field="picker"]');
        const picked = this.picked;
        this.picked = false;
        this.release();
        // Opened and closed without a pick: nothing to commit.
        if (input && picked) input.dispatchEvent(new Event('change', { bubbles: true }));
    }
};

export default ColorPicker;
