/**
 * Color field: a text input that takes a variable (--primary-400) or any CSS
 * color (oklch(from var(--primary-400) l c h / 0.7), color-mix(), #hex …),
 * with the variable list one click away on the ▾ button and a larger editor
 * on the ⤢ button for long values.
 *
 *   Enter / blur   commit (validated; invalid input stays, flagged, unsaved)
 *   Escape         revert
 *   Alt + ↓        open the variable list
 *   @              color functions (color-mix, oklch / hsl / rgb from, light-dark, var):
 *                  inserted as written, the caret lands where the color goes
 *   --             variable autocomplete, also inside var( … )
 *   ⤢ / Ctrl+E     expanded editor: a wrapping text area over the field, no clipping;
 *                  ⤡, Escape or a click outside brings it back
 *
 * Stored values: a token name ('primary-400'), a keyword ('transparent',
 * 'currentColor') or custom CSS prefixed 'css:'. Committing dispatches the
 * same `switcher:change` event as picking from the list, so a module handles
 * both the same way. Validation and swatches use ColorField.resolve, which
 * the module that owns the tokens sets (see ui/colorResolve.js).
 *
 * @module colorField
 */

import { esc, ICON, switcherList } from './components.js';

const CSS_PREFIX = 'css:';

const svg = (d) => `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const EXPAND = svg('<path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9.2 6.8M2.5 13.5l4.3-4.3"/>');
const COLLAPSE = svg('<path d="M13.5 6.5h-4v-4M2.5 9.5h4v4M9.5 6.5l4-4M6.5 9.5l-4 4"/>');

/** Text shown in the input for a stored value. */
export function displayValue(value) {
    const v = String(value ?? '');
    if (v.startsWith(CSS_PREFIX)) return v.slice(CSS_PREFIX.length);
    if (v === 'transparent' || v === 'currentColor' || !v) return v;
    return `--${v}`;
}

/**
 * @param {object} o
 * @param {string} o.key      switcher id (also the change event id)
 * @param {string} o.value    stored value
 * @param {{value,label,swatch?}[]} o.options  pickable variables / keywords
 * @param {string} o.label    accessible name
 * @param {'light'|'dark'} [o.mode]  theme used to validate and preview
 * @param {string} [o.swatch] resolved preview color (CSS)
 * @param {string} [o.self]   the variable this field defines (it can't reference itself)
 */
export function colorField({ key, value, options, label, mode = 'light', swatch = '', self = '' }) {
    const shown = displayValue(value);
    return `
      <div class="switcher switcher--sm switcher--mono cfield" data-switcher="${esc(key)}" data-cfield data-mode="${mode}" data-label="${esc(label)}"${self ? ` data-self="${esc(self)}"` : ''}>
        <div class="cfield__box" data-switcher-anchor>
          <span class="cfield__swatch" aria-hidden="true"><i style="background:${esc(swatch || 'transparent')}"></i></span>
          <input type="text" class="cfield__input" value="${esc(shown)}" data-original="${esc(shown)}" data-fid="cfield-${esc(key)}"
                 aria-label="${esc(label)}. Type a variable or any CSS color; @ for color functions" spellcheck="false" autocomplete="off"
                 aria-autocomplete="list" aria-expanded="false" role="combobox">
          <button type="button" class="cfield__expand" data-cfield-expand data-fid="cfield-expand-${esc(key)}" tabindex="-1"
                  aria-label="Open a larger editor for ${esc(label)}" aria-expanded="false" title="Expand (Ctrl+E)">${EXPAND}</button>
          <button type="button" class="switcher__trigger cfield__toggle" data-fid="switcher-${esc(key)}" tabindex="-1"
                  aria-haspopup="listbox" aria-expanded="false" aria-controls="sw-${esc(key)}-list" aria-label="Choose a variable for ${esc(label)}" title="Variables">
            <span class="switcher__icon">${ICON.updown}</span>
          </button>
        </div>
        <p class="cfield__msg" role="alert" hidden></p>
        ${switcherList({ id: key, options, current: value, label, mono: true })}
      </div>`;
}

/* ---------------- color functions (@) ---------------- */

/**
 * Inserted as written: no lightness, chroma or alpha is changed for you
 * (`l c h / alpha` keep the source color's own values). ▮ marks where the
 * caret lands: the color (or variable) you're working from.
 */
const CARET = '▮';
const RECIPES = [
    { id: 'mix', label: 'color-mix()', detail: 'blend two colors', tpl: `color-mix(in oklab, ${CARET}, )` },
    { id: 'oklch', label: 'oklch(from …)', detail: 'edit in OKLCH', tpl: `oklch(from ${CARET} l c h / alpha)` },
    { id: 'hsl', label: 'hsl(from …)', detail: 'edit in HSL', tpl: `hsl(from ${CARET} h s l / alpha)` },
    { id: 'rgb', label: 'rgb(from …)', detail: 'edit in RGB', tpl: `rgb(from ${CARET} r g b / alpha)` },
    { id: 'light-dark', label: 'light-dark()', detail: 'one color per theme', tpl: `light-dark(${CARET}, )` },
    { id: 'var', label: 'var()', detail: 'a variable', tpl: `var(--${CARET})` }
];

/* ---------------- behaviour ---------------- */

let menu = null; // the shared suggestion popover
let state = null; // { input, items, active, from, to }
let refocus = null; // fid of a field that just committed (the re-render restores focus)
let editor = null; // { root, pop, input, text } while the expanded editor is open

/** The field an element belongs to: inside it, or inside its expanded editor (which lives on <body>). */
const rootOf = (el) => el?.closest?.('[data-cfield]') || el?.closest?.('.cfield-pop')?.cfieldRoot || null;
/** The field plus its open editor, for messages and swatches. */
const scopes = (root) => [root, editor?.root === root ? editor.pop : null].filter(Boolean);
const tokensOf = (root) => [...(root._list || root).querySelectorAll('.switcher__option')].map((o) => o.dataset.value);
const boxInput = (root) => root.querySelector('.cfield__box .cfield__input');

/** Stored value for typed text, or { error }. */
function parse(text, root) {
    const t = text.trim();
    if (!t) return { error: 'Enter a variable or a CSS color' };
    const tokens = tokensOf(root);
    if (/^transparent$/i.test(t) && tokens.includes('transparent')) return { value: 'transparent' };
    if (/^currentcolor$/i.test(t)) return tokens.includes('currentColor') ? { value: 'currentColor' } : { error: 'currentColor isn’t available here' };
    const ref = t.match(/^(?:var\(\s*)?--([\w-]+)\s*\)?$/);
    if (ref) return tokens.includes(ref[1]) ? { value: ref[1] } : { error: `There’s no variable --${ref[1]}` };
    if (/^[\w-]+$/.test(t) && tokens.includes(t)) return { value: t };
    const self = root.dataset.self;
    // Its own variable (e.g. var(--btn-primary-bg) in the primary background) would be circular.
    if (self && [...t.matchAll(/var\(\s*--([\w-]+)/g)].some((m) => m[1] === self)) return { error: `--${self} can’t use itself` };
    const mode = root.dataset.mode || 'light';
    if (!ColorField.resolve?.(t, mode)) {
        const unknown = [...t.matchAll(/var\(\s*--([\w-]+)/g)].map((m) => m[1]).find((n) => !tokens.includes(n));
        return { error: unknown ? `There’s no variable --${unknown}` : 'Not a valid CSS color' };
    }
    return { value: `${CSS_PREFIX}${t}` };
}

function showError(root, message) {
    root.classList.toggle('is-invalid', Boolean(message));
    for (const scope of scopes(root)) {
        scope.querySelectorAll('.cfield__input').forEach((input) => input.toggleAttribute('aria-invalid', Boolean(message)));
        scope.querySelectorAll('.cfield__msg').forEach((msg) => {
            msg.hidden = !message;
            msg.textContent = message || '';
        });
    }
    editor?.pop.classList.toggle('is-invalid', Boolean(message) && editor.root === root);
}

/** Apply typed text. Returns 'unchanged', 'error' or 'saved'. */
function commit(input) {
    const root = rootOf(input);
    if (!root || input.dataset.closed) return 'unchanged';
    const text = input.value.replace(/\s*\n\s*/g, ' ');
    if (text.trim() === input.dataset.original.trim()) {
        showError(root, '');
        return 'unchanged';
    }
    const result = parse(text, root);
    if (result.error) {
        showError(root, result.error);
        return 'error';
    }
    showError(root, '');
    const box = boxInput(root);
    box.value = text.trim();
    box.dataset.original = text.trim();
    input.dataset.original = text.trim();
    refocus = box.dataset.fid;
    // A committed editor closes; the re-render then rebuilds the field.
    if (editor?.root === root) closeEditor({ commit: false });
    root.dispatchEvent(new CustomEvent('switcher:change', { bubbles: true, detail: { id: root.dataset.switcher, value: result.value } }));
    return 'saved';
}

/** Stored value → the CSS it stands for. */
const toCss = (value) => (value === 'transparent' || value === 'currentColor' ? value
    : value.startsWith(CSS_PREFIX) ? value.slice(CSS_PREFIX.length) : `var(--${value})`);

/**
 * Live preview while typing (nothing is saved): the swatch follows the text,
 * and once the text is a valid color ColorField.onPreview shows it in the
 * module's preview. Invalid text keeps the last valid preview.
 */
function preview(input) {
    const root = rootOf(input);
    if (!root) return;
    const swatches = scopes(root).flatMap((s) => [...s.querySelectorAll('.cfield__swatch i')]);
    if (!swatches.length) return;
    const result = input.value.trim() ? parse(input.value, root) : { error: true };
    const ok = !result.error && (result.value === 'currentColor' ? null : ColorField.resolve?.(toCss(result.value), root.dataset.mode || 'light'));
    for (const swatch of swatches) {
        swatch.parentElement.classList.toggle('is-unknown', !ok);
        if (ok) swatch.style.background = `rgb(from ${ok.hex} r g b / ${ok.alpha})`;
    }
    if (!result.error) {
        ColorField.onPreview?.({ key: root.dataset.switcher, token: root.dataset.self, css: toCss(result.value), mode: root.dataset.mode || 'light' });
    }
}

/* ---- suggestions ---- */

function suggestions(input) {
    const root = rootOf(input);
    const caret = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, caret);
    const at = before.match(/@([\w-]*)$/);
    if (at) {
        const q = at[1].toLowerCase();
        const items = RECIPES.filter((r) => r.id.startsWith(q) || r.label.toLowerCase().startsWith(q)).map((r) => ({
            label: r.label, detail: r.detail, preview: r.tpl.replace(CARET, '…'),
            insert: r.tpl.replace(CARET, ''), caret: r.tpl.indexOf(CARET)
        }));
        return { items, from: caret - at[0].length, to: caret };
    }
    const dash = before.match(/--([\w-]*)$/);
    if (dash) {
        const q = dash[1].toLowerCase();
        const inVar = /var\(\s*--[\w-]*$/.test(before);
        const whole = before.trim() === dash[0] && !input.value.slice(caret).trim();
        const tokens = tokensOf(root).filter((t) => t !== 'transparent' && t !== 'currentColor');
        const hit = tokens.filter((t) => t.startsWith(q)).concat(tokens.filter((t) => !t.startsWith(q) && t.includes(q))).slice(0, 8);
        const items = hit.map((t) => ({
            label: `--${t}`, detail: '', token: t,
            // Inside an expression a bare --x needs var(); alone, the field takes --x as is.
            insert: inVar || whole ? `--${t}` : `var(--${t})`, caret: null
        }));
        return { items, from: caret - dash[0].length, to: caret };
    }
    return { items: [], from: caret, to: caret };
}

function ensureMenu() {
    if (menu) return menu;
    menu = document.createElement('ul');
    menu.className = 'cfield-suggest';
    menu.id = 'cfield-suggest';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;
    // mousedown (not click) so the input keeps focus and doesn't commit early.
    menu.addEventListener('mousedown', (event) => {
        const li = event.target.closest('[data-index]');
        if (!li || !state) return;
        event.preventDefault();
        accept(Number(li.dataset.index));
    });
    document.body.appendChild(menu);
    return menu;
}

function closeMenu() {
    if (menu) menu.hidden = true;
    if (state?.input) {
        state.input.setAttribute('aria-expanded', 'false');
        state.input.removeAttribute('aria-activedescendant');
    }
    state = null;
}

function renderMenu(input) {
    const root = rootOf(input);
    if (!root) return closeMenu();
    const { items, from, to } = suggestions(input);
    if (!items.length) return closeMenu();
    ensureMenu();
    state = { input, items, active: 0, from, to };
    const swatch = (it) => (it.token ? ColorField.resolve?.(`var(--${it.token})`, root.dataset.mode || 'light') : null);
    menu.innerHTML = items.map((it, i) => {
        const sw = swatch(it);
        return `<li role="option" id="cfield-opt-${i}" data-index="${i}" aria-selected="${i === 0}">
          ${sw ? `<i class="cfield-suggest__swatch" style="background:rgb(from ${sw.hex} r g b / ${sw.alpha})"></i>` : ''}
          <b>${esc(it.label)}</b>${it.detail ? `<span>${esc(it.detail)}</span>` : ''}
          ${it.preview ? `<code>${esc(it.preview)}</code>` : ''}
        </li>`;
    }).join('');
    // Under the field, or under the expanded editor's text area.
    const anchor = (input.closest('.cfield-pop') ? input : root.querySelector('.cfield__box')).getBoundingClientRect();
    const width = Math.max(Math.min(anchor.width, 420), 260);
    menu.style.cssText = `position:fixed;z-index:120;inline-size:${width}px;left:${Math.max(8, Math.min(anchor.left, innerWidth - width - 8))}px;top:${anchor.bottom + 4}px`;
    menu.hidden = false;
    // Flip above when it would run off the bottom.
    const h = menu.getBoundingClientRect().height;
    if (anchor.bottom + 4 + h > innerHeight - 8) menu.style.top = `${Math.max(8, anchor.top - 4 - h)}px`;
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-controls', 'cfield-suggest');
    input.setAttribute('aria-activedescendant', 'cfield-opt-0');
}

function move(delta) {
    if (!state) return;
    state.active = (state.active + delta + state.items.length) % state.items.length;
    menu.querySelectorAll('[data-index]').forEach((li, i) => li.setAttribute('aria-selected', String(i === state.active)));
    menu.querySelector(`[data-index="${state.active}"]`)?.scrollIntoView({ block: 'nearest' });
    state.input.setAttribute('aria-activedescendant', `cfield-opt-${state.active}`);
}

function accept(index = state?.active ?? 0) {
    if (!state) return;
    const { input, items, from, to } = state;
    const it = items[index];
    input.value = input.value.slice(0, from) + it.insert + input.value.slice(to);
    // Functions: the caret goes where the color is typed. Variables: after the insert.
    const pos = from + (it.caret != null ? it.caret : it.insert.length);
    input.focus();
    input.setSelectionRange(pos, pos);
    closeMenu();
    mirror(input);
    preview(input);
    autosize(input);
    // var(--▮) leaves the caret after "--": open the variable list right away.
    if (it.caret != null) renderMenu(input);
}

/* ---- expanded editor ---- */

/** Keeps the field's own input in step with the editor, so collapsing shows the same text. */
function mirror(input) {
    if (editor && input === editor.text) editor.input.value = input.value.replace(/\s*\n\s*/g, ' ');
}

function autosize(el) {
    if (!el?.matches?.('textarea')) return;
    el.style.blockSize = 'auto';
    el.style.blockSize = `${Math.min(el.scrollHeight, Math.round(innerHeight * 0.5))}px`;
}

/** Over the field: same left edge and top, wide enough to read a long value, inside the window. */
function place() {
    if (!editor) return;
    const box = editor.root.querySelector('.cfield__box');
    if (!box?.isConnected) return closeEditor({ commit: false });
    const r = box.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return closeEditor();
    const width = Math.min(Math.max(r.width, 520), innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, innerWidth - width - 8));
    editor.pop.style.inlineSize = `${width}px`;
    editor.pop.style.left = `${left}px`;
    const h = editor.pop.getBoundingClientRect().height;
    editor.pop.style.top = `${Math.max(8, Math.min(r.top - 6, innerHeight - h - 8))}px`;
}

function openEditor(root) {
    if (editor?.root === root) return closeEditor({ focus: true });
    closeEditor();
    closeMenu();
    const input = boxInput(root);
    const label = root.dataset.label || 'Color';
    const pop = document.createElement('div');
    pop.className = 'cfield-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', `Edit ${label}`);
    pop.innerHTML = `
      <div class="cfield-pop__head">
        <span class="cfield__swatch" aria-hidden="true"><i></i></span>
        <span class="cfield-pop__label">${esc(label)}</span>
        <button type="button" class="cfield-pop__close" data-cfield-collapse aria-label="Back to the field" title="Collapse (Esc)">${COLLAPSE}</button>
      </div>
      <textarea class="cfield__input cfield-pop__text" rows="2" spellcheck="false" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false"
                aria-label="${esc(label)}. Type a variable or any CSS color; @ for color functions"></textarea>
      <p class="cfield__msg" role="alert" hidden></p>
      <p class="cfield-pop__hint"><kbd>Enter</kbd> apply <kbd>Esc</kbd> cancel <kbd>@</kbd> functions <kbd>--</kbd> variables</p>`;
    pop.cfieldRoot = root;
    const text = pop.querySelector('textarea');
    text.value = input.value;
    text.dataset.original = input.dataset.original;
    text.dataset.fid = input.dataset.fid;
    // Same swatch and message as the field.
    const swatch = root.querySelector('.cfield__swatch');
    pop.querySelector('.cfield__swatch').className = swatch.className;
    pop.querySelector('.cfield__swatch i').style.background = swatch.querySelector('i').style.background;
    const msg = root.querySelector('.cfield__msg');
    if (!msg.hidden) {
        const own = pop.querySelector('.cfield__msg');
        own.hidden = false;
        own.textContent = msg.textContent;
        pop.classList.add('is-invalid');
    }
    document.body.appendChild(pop);
    editor = { root, pop, input, text };
    root.classList.add('is-expanded');
    root.querySelector('[data-cfield-expand]')?.setAttribute('aria-expanded', 'true');
    autosize(text);
    place();
    text.focus();
    text.setSelectionRange(text.value.length, text.value.length);
}

/**
 * Close the editor. `commit` (default) applies the text as a blur would;
 * `focus` returns focus to the field.
 */
function closeEditor({ focus = false, commit: apply = true } = {}) {
    if (!editor) return;
    const { root, pop, input, text } = editor;
    editor = null;
    text.dataset.closed = '1'; // its own blur must not apply it a second time
    closeMenu();
    input.value = text.value.replace(/\s*\n\s*/g, ' ').trim();
    root.classList.remove('is-expanded');
    root.querySelector('[data-cfield-expand]')?.setAttribute('aria-expanded', 'false');
    pop.classList.add('is-closing');
    const remove = () => pop.remove();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) remove();
    else setTimeout(remove, 120);
    if (focus && input.isConnected) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    } else if (apply && input.isConnected && document.activeElement !== input) {
        commit(input);
    }
}

const ColorField = {
    /** (css, mode) → {hex, alpha} | null. Set by the module that owns the tokens. */
    resolve: null,

    /** ({ key, token, css, mode }) → void: show a valid typed color live. Set by the module. */
    onPreview: null,

    init() {
        document.addEventListener('input', (event) => {
            const input = event.target.closest?.('.cfield__input');
            if (!input) return;
            const root = rootOf(input);
            if (!root) return;
            showError(root, '');
            mirror(input);
            preview(input);
            autosize(input);
            renderMenu(input);
            if (editor?.text === input) place();
        });

        document.addEventListener('keydown', (event) => {
            const input = event.target.closest?.('.cfield__input');
            if (!input) return;
            const inEditor = editor?.text === input;
            if (state?.input === input) {
                if (event.key === 'ArrowDown') { event.preventDefault(); return move(1); }
                if (event.key === 'ArrowUp') { event.preventDefault(); return move(-1); }
                if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); return accept(); }
                if (event.key === 'Escape') { event.preventDefault(); return closeMenu(); }
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'e') {
                event.preventDefault();
                return inEditor ? closeEditor({ focus: true }) : openEditor(rootOf(input));
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                const result = commit(input);
                // Unchanged text: nothing to save, so the editor just closes. An error keeps it open.
                if (inEditor && editor && result === 'unchanged') closeEditor({ focus: true, commit: false });
            } else if (event.key === 'Escape') {
                event.preventDefault();
                input.value = input.dataset.original;
                if (inEditor) editor.input.value = input.dataset.original;
                showError(rootOf(input), '');
                preview(input);
                if (inEditor) closeEditor({ focus: true, commit: false });
            } else if (event.key === 'ArrowDown' && event.altKey && !inEditor) {
                event.preventDefault();
                rootOf(input).querySelector('.cfield__toggle').click();
            }
            return undefined;
        });

        document.addEventListener('click', (event) => {
            const expand = event.target.closest?.('[data-cfield-expand]');
            if (expand) return openEditor(rootOf(expand));
            if (event.target.closest?.('[data-cfield-collapse]')) return closeEditor({ focus: true });
            // Moving the caret can enter or leave an @ / -- word.
            const input = event.target.closest?.('.cfield__input');
            if (input) renderMenu(input);
            else if (!event.target.closest?.('.cfield-suggest')) closeMenu();
            return undefined;
        });

        // A press outside the editor (and its suggestions) puts it back, applying the text.
        document.addEventListener('pointerdown', (event) => {
            if (!editor) return;
            if (editor.pop.contains(event.target) || menu?.contains(event.target)) return;
            if (event.target.closest?.('[data-cfield-expand]') && rootOf(event.target) === editor.root) return;
            closeEditor();
        }, true);

        document.addEventListener('focusout', (event) => {
            const input = event.target.closest?.('.cfield__input');
            if (!input || input.dataset.closed) return;
            // Focus moving into the editor (or out of it to its own buttons) isn't a commit yet.
            const next = event.relatedTarget;
            if (editor && (next === editor.text || editor.pop.contains(next))) return;
            if (editor?.text === input && next === editor.input) return;
            closeMenu();
            if (editor && input === editor.text) return; // closeEditor applies it
            commit(input);
        });

        // After a commit re-renders, the shell refocuses the field; put the caret at the end.
        document.addEventListener('focusin', (event) => {
            const input = event.target.closest?.('.cfield__input');
            if (!input || input.dataset.fid !== refocus) return;
            refocus = null;
            const end = input.value.length;
            input.setSelectionRange(end, end);
        });

        window.addEventListener('resize', () => { closeMenu(); place(); });
        document.addEventListener('scroll', (event) => {
            if (event.target.closest?.('.cfield-suggest')) return;
            closeMenu();
            if (editor && !editor.pop.contains(event.target)) place();
        }, true);
    }
};

export default ColorField;
