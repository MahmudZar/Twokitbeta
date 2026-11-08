/**
 * TwoKit variable picker for the Bricks builder.
 *
 *   Bricks fields    right-click a value field that takes variables, or press
 *                    Alt+V in it. Hover a variable to preview it: like Core
 *                    Framework, it is typed into the field and Bricks renders
 *                    it; moving off types the old value back; click keeps it.
 *                    Not on a locked class.
 *   Code2Bricks      registers as a value picker for Code2Bricks' CSS
 *                    editors (Alt+V or right-click on a value there).
 *
 * Data: window.TWOKIT_PICKER, printed by TwoKit_Picker (PHP) from the catalog
 * the TwoKit app sends with each save (core/pickerCatalog.js). Everything is
 * rendered with textContent; colors are re-checked before they reach a style.
 *
 * Loaded only in the builder's main window. No requests, no storage.
 *
 * @package TwoKit
 */
(function () {
    'use strict';

    if (window.TwoKitPicker) return;

    const DATA = window.TWOKIT_PICKER && window.TWOKIT_PICKER.v === 1 ? window.TWOKIT_PICKER : null;
    const NAME_RE = /^[A-Za-z0-9_-]{1,80}$/;
    const COLOR_RE = /^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/;
    const WIDTH = 320;
    const MAX_HEIGHT = 560;
    const MAX_RESULTS = 400;

    const cssVar = (name) => `var(--${name})`;
    const okColor = (c) => (typeof c === 'string' && COLOR_RE.test(c) ? c : '');
    /**
     * Color groups lead, in this order: Palettes, States, Action, Surfaces, then
     * Text, Borders … and every other group in the catalog's own order. Applied on
     * load, so a catalog stored by an older TwoKit follows it too.
     */
    const GROUP_ORDER = ['palettes', 'states', 'action', 'surfaces', 'text', 'borders', 'interaction', 'inverse'];
    const groupRank = (id) => {
        const i = GROUP_ORDER.indexOf(id);
        return i === -1 ? GROUP_ORDER.length : i;
    };
    const groups = DATA ? DATA.groups.filter((g) => g && typeof g.id === 'string' && Array.isArray(g.sections)) : [];
    // Array.prototype.sort is stable: groups outside GROUP_ORDER keep their order.
    groups.sort((a, b) => groupRank(a.id) - groupRank(b.id));

    /** border, border-top, border-block-start, outline, column-rule (not border-color, -width, -radius). */
    const BORDER_SHORTHAND = /^(border(-(top|right|bottom|left|block|inline)(-(start|end))?)?|outline|column-rule)$/;

    /** Groups that hold colors only, and groups that hold no colors at all. */
    const COLOR_GROUPS = ['palettes', 'surfaces', 'text', 'action', 'states', 'borders', 'inverse', 'selection'];
    const VALUE_GROUPS = ['spacing', 'gaps', 'layout', 'grid', 'font-size', 'line-height', 'font-family', 'radius', 'shadows', 'transition', 'auto-spacing'];
    const LENGTH_GROUPS = ['spacing', 'gaps', 'layout', 'font-size', 'radius', 'auto-spacing'];
    const COLOR_NAME = /(^|-)(bg|text|border|color|surface)(-hover)?$/;

    /* ------------------------------------------------------------------ */
    /* Which groups fit a CSS property                                     */
    /* ------------------------------------------------------------------ */

    /**
     * Group ids to open first for a property, most relevant first.
     * @param {string} property e.g. "padding-inline", "background-color"
     * @returns {string[]}
     */
    function contextGroups(property) {
        const p = String(property || '').trim().toLowerCase().replace(/^-(webkit|moz|ms)-/, '');
        if (!p) return [];
        // Color fields list Palettes first (see PRIMARY_COLOR in ordered()).
        if (p === 'background' || p === 'background-color') return ['palettes', 'surfaces', 'states'];
        if (p === 'background-image') return ['interaction'];
        if (BORDER_SHORTHAND.test(p)) return ['palettes', 'borders'];
        if (/(^border|^outline|^column-rule)(-[a-z]+)*-color$/.test(p) || p === 'border-color') return ['palettes', 'borders'];
        // The color and the offsets of a Bricks box-shadow / text-shadow field.
        if (p === 'shadow-color') return ['palettes', 'text', 'borders'];
        if (p === 'shadow-offset') return ['spacing'];
        if (/color$/.test(p) || p === 'fill' || p === 'stroke') return ['palettes', 'text', 'action', 'states'];
        if (p === 'box-shadow' || p === 'text-shadow') return ['shadows'];
        if (/^(gap|row-gap|column-gap|grid-gap|grid-row-gap|grid-column-gap)$/.test(p)) return ['gaps', 'spacing'];
        if (/^(padding|margin|inset|scroll-padding|scroll-margin)(-|$)/.test(p) || /^(top|right|bottom|left)$/.test(p)) return ['spacing'];
        if (p === 'letter-spacing' || p === 'word-spacing' || p === 'text-indent' || p === 'text-underline-offset') return ['spacing'];
        if (p === 'font-size') return ['font-size'];
        if (p === 'line-height') return ['line-height'];
        if (p === 'font-family' || p === 'font') return ['font-family'];
        if (/radius$/.test(p)) return ['radius'];
        if (/^grid-template(-columns|-rows)?$/.test(p) || p === 'grid-auto-columns') return ['grid'];
        if (/(^|-)(width|height|inline-size|block-size)$/.test(p) || p === 'flex-basis') return ['layout', 'spacing'];
        if (/^transition/.test(p)) return ['transition'];
        if (/^outline(-width|-offset)?$/.test(p)) return ['focus'];
        return [];
    }

    /* ------------------------------------------------------------------ */
    /* Search                                                              */
    /* ------------------------------------------------------------------ */

    /** Every variable with where it lives, built once. */
    const INDEX = [];
    groups.forEach((g) => {
        const words = `${g.label || ''} ${g.id}`.toLowerCase().split(/[\s-]+/).filter(Boolean);
        const addItems = (sections, tab) => sections.forEach((s, si) => {
            if (s.type === 'tabs') {
                (s.tabs || []).forEach((t, ti) => addItems(t.sections || [], { label: String(t.label || '').toLowerCase(), index: ti, section: si }));
                return;
            }
            (s.items || []).forEach((item) => {
                if (s.type === 'palettes') {
                    const shades = [{ n: item.n, hex: item.hex }, ...paletteScale(item)];
                    shades.forEach((sh) => NAME_RE.test(sh.n) && INDEX.push({ group: g, words, tab, section: s, item: { n: sh.n, c: sh.hex }, name: sh.n.toLowerCase() }));
                    return;
                }
                if (NAME_RE.test(item.n)) INDEX.push({ group: g, words, tab, section: s, item, name: item.n.toLowerCase() });
            });
        });
        addItems(g.sections);
    });

    /**
     * What a variable holds, for hosts that build a value around it (Code2Bricks
     * puts a color into `border: 1px solid …`): 'color' | 'shadow' | 'length' | ''.
     */
    const KIND = new Map();
    INDEX.forEach((e) => {
        const it = e.item;
        let kind = '';
        if (it.c || it.l || it.d || e.section.type === 'pairs' || e.section.type === 'palettes' || COLOR_NAME.test(it.n)) kind = 'color';
        else if (e.group.id === 'shadows') kind = 'shadow';
        else if (LENGTH_GROUPS.includes(e.group.id)) kind = 'length';
        if (!KIND.has(it.n)) KIND.set(it.n, kind);
        // Paired tokens also come as --light-* / --dark-*.
        if (e.section.type === 'pairs') ['light', 'dark'].forEach((m) => KIND.set(`${m}-${it.n}`, 'color'));
        if (e.section.type === 'shadows') ['light', 'dark'].forEach((m) => KIND.set(`${m}-${it.n}`, 'shadow'));
    });
    const kindOf = (name) => KIND.get(name) || '';

    /** Groups the open picker may show (a Bricks color field hides spacing, …). */
    const shown = (g) => !(state.session && state.session.hide && state.session.hide.has(g.id));

    /**
     * Matches for a query. A term matches a variable's name, its group
     * ("state", "shadow") or its tab ("success"); at least one term must hit
     * the name or tab, unless the whole query names the group.
     * @returns {{ group: object, whole: boolean, entries: object[] }[]}
     */
    function search(query) {
        const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
        if (!terms.length) return [];
        const groupHit = (words, t) => words.some((w) => w.startsWith(t) || t.startsWith(w));
        const out = new Map();
        let count = 0;
        for (const g of groups) {
            if (!shown(g)) continue;
            const words = `${g.label || ''} ${g.id}`.toLowerCase().split(/[\s-]+/).filter(Boolean);
            if (terms.every((t) => groupHit(words, t))) out.set(g.id, { group: g, whole: true, entries: [] });
        }
        for (const entry of INDEX) {
            if (count >= MAX_RESULTS) break;
            if (!shown(entry.group)) continue;
            const hit = out.get(entry.group.id);
            if (hit && hit.whole) continue;
            const tabLabel = entry.tab ? entry.tab.label : '';
            const ok = terms.every((t) => entry.name.includes(t) || (tabLabel && tabLabel.startsWith(t)) || groupHit(entry.words, t));
            const own = terms.some((t) => entry.name.includes(t) || (tabLabel && tabLabel.startsWith(t)));
            if (!ok || !own) continue;
            if (!out.has(entry.group.id)) out.set(entry.group.id, { group: entry.group, whole: false, entries: [] });
            out.get(entry.group.id).entries.push(entry);
            count++;
        }
        return [...out.values()];
    }

    /* ------------------------------------------------------------------ */
    /* DOM helpers                                                         */
    /* ------------------------------------------------------------------ */

    let doc = document;
    const h = (tag, cls, text) => {
        const el = doc.createElement(tag);
        if (cls) el.className = cls;
        if (text != null) el.textContent = text;
        return el;
    };
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const icon = (paths, size = 14) => {
        const svg = doc.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        paths.forEach((d) => {
            const p = doc.createElementNS(SVG_NS, 'path');
            p.setAttribute('d', d);
            svg.append(p);
        });
        return svg;
    };
    const ICONS = {
        search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-3.5-3.5'],
        close: ['M18 6 6 18', 'M6 6l12 12'],
        chevron: ['M9 6l6 6-6 6']
    };

    /** Text with the matched part of a name highlighted (no markup from data). */
    function label(name, terms) {
        const frag = doc.createDocumentFragment();
        const lower = name.toLowerCase();
        let at = -1;
        let len = 0;
        for (const t of terms || []) {
            const i = lower.indexOf(t);
            if (i !== -1 && t.length > len) { at = i; len = t.length; }
        }
        if (at === -1) {
            frag.append(name);
            return frag;
        }
        frag.append(name.slice(0, at), h('mark', 'tkp-mark', name.slice(at, at + len)), name.slice(at + len));
        return frag;
    }

    const swatch = (cls, color) => {
        const el = h('i', cls);
        const c = okColor(color);
        if (c) el.style.setProperty('--tkp-c', c);
        return el;
    };
    const split = (light, dark) => {
        const el = h('i', 'tkp-split');
        const l = okColor(light);
        const d = okColor(dark);
        if (l) el.style.setProperty('--tkp-l', l);
        if (d) el.style.setProperty('--tkp-d', d);
        return el;
    };

    /** A variable button. */
    function chip(name, opts = {}) {
        const b = h('button', `tkp-chip${opts.cls ? ` ${opts.cls}` : ''}`);
        b.type = 'button';
        b.dataset.v = name;
        b.dataset.nav = '';
        b.title = cssVar(name);
        if (opts.split) b.append(split(opts.split[0], opts.split[1]));
        else if (opts.color) b.append(swatch('tkp-dot', opts.color));
        b.append(label(opts.text || name, opts.terms));
        return b;
    }

    /* ------------------------------------------------------------------ */
    /* Sections                                                            */
    /* ------------------------------------------------------------------ */

    function sectionLabel(text) {
        return text ? h('div', 'tkp-label', text) : null;
    }

    function renderPairs(section, terms, items = section.items) {
        const wrap = h('div', 'tkp-pairs');
        const head = h('div', 'tkp-pairs-head');
        head.append(h('span', 'tkp-label', section.label || ''), h('span', 'tkp-mode-label', 'light'), h('span', 'tkp-mode-label', 'dark'));
        wrap.append(head);
        items.forEach((item) => {
            if (!NAME_RE.test(item.n)) return;
            const row = h('div', 'tkp-pair');
            const main = chip(item.n, { split: [item.l, item.d], terms });
            row.append(main);
            if (item.t) row.append(h('span', 'tkp-tag', item.t));
            row.append(h('span', 'tkp-grow'));
            ['light', 'dark'].forEach((mode) => {
                const name = `${mode}-${item.n}`;
                const b = h('button', 'tkp-mode');
                b.type = 'button';
                b.dataset.v = name;
                b.dataset.nav = '';
                b.title = cssVar(name);
                b.setAttribute('aria-label', `${item.n}, ${mode}`);
                b.append(swatch('tkp-dot', mode === 'light' ? item.l : item.d));
                row.append(b);
            });
            wrap.append(row);
        });
        return wrap;
    }

    /**
     * A shadow's value as the site prints it (Bricks variables / twokit.css in
     * the canvas), or ''. The catalog holds names only. Only plain shadow
     * syntax is let through to a style; the browser drops anything invalid.
     */
    let pageStyle = null;
    function shadowValue(name) {
        if (pageStyle === null) {
            pageStyle = false;
            for (const d of [canvasDocument(), document]) {
                try {
                    const s = d && d.defaultView.getComputedStyle(d.documentElement);
                    if (s && s.getPropertyValue(`--${name}`).trim()) {
                        pageStyle = s;
                        break;
                    }
                } catch (e) { /* no canvas yet */ }
            }
        }
        const v = pageStyle ? pageStyle.getPropertyValue(`--${name}`).trim() : '';
        return v.length <= 1000 && /^[\w\s.,%#()/-]+$/.test(v) && !/url\(/i.test(v) ? v : '';
    }

    /** A small square showing a shadow on a light or dark ground. */
    function shadowTile(name, mode) {
        const el = h('i', `tkp-shade tkp-shade--${mode}`);
        const v = shadowValue(name);
        if (v) el.style.setProperty('box-shadow', v);
        return el;
    }

    /** Shadow levels: shadow-N (follows the theme) + fixed light / dark, like color pairs. */
    function renderShadows(section, terms, items = section.items) {
        const wrap = h('div', 'tkp-pairs');
        const head = h('div', 'tkp-pairs-head');
        head.append(h('span', 'tkp-label', section.label || ''), h('span', 'tkp-mode-label', 'light'), h('span', 'tkp-mode-label', 'dark'));
        wrap.append(head);
        items.forEach((item) => {
            if (!NAME_RE.test(item.n)) return;
            const row = h('div', 'tkp-pair');
            row.append(chip(item.n, { terms }));
            if (item.t) row.append(h('span', 'tkp-tag', item.t));
            row.append(h('span', 'tkp-grow'));
            ['light', 'dark'].forEach((mode) => {
                const name = `${mode}-${item.n}`;
                const b = h('button', 'tkp-mode');
                b.type = 'button';
                b.dataset.v = name;
                b.dataset.nav = '';
                b.title = cssVar(name);
                b.setAttribute('aria-label', `${item.n}, ${mode}`);
                b.append(shadowTile(name, mode));
                row.append(b);
            });
            wrap.append(row);
        });
        return wrap;
    }

    function renderChips(section, terms, items = section.items) {
        const wrap = h('div', 'tkp-section');
        const l = sectionLabel(section.label);
        if (l) wrap.append(l);
        const list = h('div', 'tkp-chips');
        items.forEach((item) => {
            if (!NAME_RE.test(item.n)) return;
            list.append(chip(item.n, { color: item.c, split: item.l || item.d ? [item.l, item.d] : null, terms }));
        });
        wrap.append(list);
        return wrap;
    }

    function renderGrid(section) {
        const wrap = h('div', 'tkp-section');
        const l = sectionLabel(section.label);
        if (l) wrap.append(l);
        const list = h('div', 'tkp-tiles');
        section.items.forEach((item) => {
            if (!NAME_RE.test(item.n)) return;
            const b = h('button', 'tkp-tile');
            b.type = 'button';
            b.dataset.v = item.n;
            b.dataset.nav = '';
            b.title = cssVar(item.n);
            const cols = h('span', 'tkp-cols');
            (Array.isArray(item.cols) ? item.cols : [1]).slice(0, 12).forEach((fr) => {
                const c = h('i');
                c.style.flexGrow = String(Math.max(0.1, Math.min(12, Number(fr) || 1)));
                cols.append(c);
            });
            b.append(cols, h('span', 'tkp-tile-name', item.n));
            list.append(b);
        });
        wrap.append(list);
        return wrap;
    }

    /**
     * A palette's steps as one scale, lightest to darkest: the tints (stored
     * from the base outwards), the base step (`step`, e.g. primary-500, in the
     * base color), then the shades. Sorted by the step number when every name
     * ends in one (primary-50 … primary-950).
     */
    function paletteScale(p) {
        const tints = (p.tints || []).slice().reverse();
        const base = p.step && NAME_RE.test(p.step) ? [{ n: p.step, hex: p.hex }] : [];
        const list = [...tints, ...base, ...(p.shades || [])].filter((sh) => sh && NAME_RE.test(sh.n));
        const num = (n) => {
            const m = /-(\d+)$/.exec(n);
            return m ? Number(m[1]) : NaN;
        };
        if (list.every((sh) => !Number.isNaN(num(sh.n)))) list.sort((a, b) => num(a.n) - num(b.n));
        const seen = new Set();
        return list.filter((sh) => !seen.has(sh.n) && seen.add(sh.n));
    }

    function renderPalettes(section) {
        const wrap = h('div', 'tkp-palettes');
        section.items.forEach((p) => {
            if (!NAME_RE.test(p.n)) return;
            const box = h('div', 'tkp-palette');
            box.append(h('div', 'tkp-palette-name', p.n));
            const base = h('button', 'tkp-base');
            base.type = 'button';
            base.dataset.v = p.n;
            base.dataset.nav = '';
            base.title = cssVar(p.n);
            base.setAttribute('aria-label', p.n);
            const c = okColor(p.hex);
            if (c) base.style.setProperty('--tkp-c', c);
            box.append(base);
            // One scale, lightest to darkest (50 → 950), with the base step in its place.
            const scale = paletteScale(p);
            if (scale.length) {
                const s = h('div', 'tkp-strip');
                scale.forEach((sh) => {
                    const cell = h('button', 'tkp-cell');
                    cell.type = 'button';
                    cell.dataset.v = sh.n;
                    cell.dataset.nav = '';
                    cell.title = cssVar(sh.n);
                    cell.setAttribute('aria-label', sh.n);
                    const sc = okColor(sh.hex);
                    if (sc) cell.style.setProperty('--tkp-c', sc);
                    s.append(cell);
                });
                box.append(s);
            }
            wrap.append(box);
        });
        return wrap;
    }

    function renderTabs(section, state, key, filter) {
        const wrap = h('div', 'tkp-tabs-wrap');
        const tabs = (section.tabs || []).map((t, i) => ({ t, i, entries: filter ? filter(i) : null })).filter((x) => !filter || x.entries.length);
        if (!tabs.length) return wrap;
        let active = state.tabs.get(key);
        if (!tabs.some((x) => x.i === active)) active = tabs[0].i;
        const bar = h('div', 'tkp-tabs');
        bar.setAttribute('role', 'tablist');
        const panel = h('div', 'tkp-tab-panel');
        const show = (index) => {
            state.tabs.set(key, index);
            bar.querySelectorAll('.tkp-tab').forEach((b) => b.setAttribute('aria-selected', String(Number(b.dataset.tab) === index)));
            panel.replaceChildren();
            const x = tabs.find((y) => y.i === index);
            if (!x) return;
            (x.t.sections || []).forEach((s) => {
                const items = x.entries ? s.items.filter((it) => x.entries.some((e) => e.item === it)) : s.items;
                if (items && items.length) panel.append(renderSection(s, state, `${key}.${index}`, null, items));
            });
        };
        tabs.forEach(({ t, i, entries }) => {
            const b = h('button', 'tkp-tab');
            b.type = 'button';
            b.dataset.tab = String(i);
            b.dataset.nav = '';
            b.setAttribute('role', 'tab');
            if (t.c) b.append(swatch('tkp-dot tkp-dot--s', t.c));
            b.append(String(t.label || ''));
            if (entries) b.append(h('span', 'tkp-count', String(entries.length)));
            b.addEventListener('click', () => show(i));
            bar.append(b);
        });
        wrap.append(bar, panel);
        show(active);
        return wrap;
    }

    function renderSection(section, state, key, terms, items) {
        switch (section.type) {
            case 'pairs': return renderPairs(section, terms, items || section.items);
            case 'shadows': return renderShadows(section, terms, items || section.items);
            case 'grid': return renderGrid(items ? { ...section, items } : section);
            case 'palettes': return renderPalettes(section);
            case 'tabs': return renderTabs(section, state, key);
            default: return renderChips(section, terms, items || section.items);
        }
    }

    /* ------------------------------------------------------------------ */
    /* The panel                                                           */
    /* ------------------------------------------------------------------ */

    const state = {
        root: null,
        body: null,
        input: null,
        session: null, // { preview, clear, apply, close, current, anchor, doc }
        open: new Set(),
        tabs: new Map(),
        rendered: new Map(),
        query: '',
        previewing: '',
        cleanup: []
    };

    function ensureStyle(target) {
        if (target.getElementById('twokit-picker-style')) return;
        const style = target.createElement('style');
        style.id = 'twokit-picker-style';
        style.textContent = CSS;
        (target.head || target.documentElement).append(style);
    }

    function build(target) {
        doc = target;
        ensureStyle(target);
        const root = h('div', 'tkp');
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', 'TwoKit variables');
        // Code2Bricks keeps its editor focused unless focus moves into a marked zone.
        root.setAttribute('data-c2b-focus-zone', '');
        root.hidden = true;

        const head = h('div', 'tkp-head');
        const field = h('label', 'tkp-search');
        field.append(icon(ICONS.search, 13));
        const input = h('input');
        input.type = 'text';
        input.placeholder = 'Search variables';
        input.setAttribute('aria-label', 'Search variables');
        input.autocomplete = 'off';
        input.spellcheck = false;
        field.append(input);
        const close = h('button', 'tkp-close');
        close.type = 'button';
        close.setAttribute('aria-label', 'Close');
        close.append(icon(ICONS.close, 14));
        head.append(field, close);

        const body = h('div', 'tkp-body');
        root.append(head, body);
        target.body.append(root);

        // A few hundred names: searching on every keystroke costs well under a frame.
        input.addEventListener('input', () => {
            state.query = input.value;
            renderBody();
        });
        close.addEventListener('click', () => closePicker());
        root.addEventListener('keydown', onKeyDown);
        // Bricks closes an open control popup (box-shadow, typography, border …) on any
        // click outside it (its "clickaway" listens to click/touchstart on the document)
        // and on Escape: clicks and keys in the picker stay in the picker.
        ['click', 'touchstart', 'mousedown', 'mouseup'].forEach((type) => root.addEventListener(type, (e) => e.stopPropagation()));
        root.addEventListener('keyup', (e) => e.stopPropagation());
        body.addEventListener('pointerover', onPointerOver);
        body.addEventListener('pointerleave', () => clearPreview());
        body.addEventListener('focusin', (e) => {
            const v = e.target.closest && e.target.closest('[data-v]');
            if (v && e.target.matches(':focus-visible')) preview(v.dataset.v);
        });
        body.addEventListener('click', onClick);

        state.root = root;
        state.body = body;
        state.input = input;
        state.rendered = new Map();
    }

    /**
     * The color groups always keep GROUP_ORDER (Palettes, States, Action,
     * Surfaces …), in every field: a color field only opens the groups that fit
     * (state.open). Other fitting groups (Spacing for padding, Shadows for
     * box-shadow) move to the top.
     */
    function ordered() {
        const fit = state.session ? state.session.fit : [];
        const list = groups.filter(shown);
        const first = fit
            .filter((id) => !GROUP_ORDER.includes(id))
            .map((id) => list.find((g) => g.id === id))
            .filter(Boolean);
        return [...first, ...list.filter((g) => !first.includes(g))];
    }

    function groupContent(g) {
        if (state.rendered.has(g.id)) return state.rendered.get(g.id);
        const content = h('div', 'tkp-content');
        g.sections.forEach((s, i) => content.append(renderSection(s, state, `${g.id}.${i}`)));
        state.rendered.set(g.id, content);
        return content;
    }

    function accordion(g, open, count, contentFn) {
        const box = h('section', 'tkp-group');
        box.dataset.group = g.id;
        const btn = h('button', 'tkp-acc');
        btn.type = 'button';
        btn.dataset.nav = '';
        btn.setAttribute('aria-expanded', String(open));
        btn.append(h('span', 'tkp-acc-title', g.label || g.id));
        if (count != null) btn.append(h('span', 'tkp-count', String(count)));
        btn.append(h('span', 'tkp-grow'), icon(ICONS.chevron, 12));
        box.append(btn);
        if (open) box.append(contentFn());
        btn.addEventListener('click', () => {
            const isOpen = btn.getAttribute('aria-expanded') === 'true';
            btn.setAttribute('aria-expanded', String(!isOpen));
            if (isOpen) {
                box.querySelector(':scope > .tkp-content')?.remove();
                if (!state.query) state.open.delete(g.id);
            } else {
                box.append(contentFn());
                if (!state.query) state.open.add(g.id);
            }
        });
        return box;
    }

    const countOf = (g) => {
        let n = 0;
        const walk = (sections) => sections.forEach((s) => {
            if (s.type === 'tabs') (s.tabs || []).forEach((t) => walk(t.sections || []));
            else if (s.type === 'palettes') (s.items || []).forEach((p) => { n += 1 + paletteScale(p).length; });
            else n += (s.items || []).length;
        });
        walk(g.sections);
        return n;
    };

    function renderBody() {
        const body = state.body;
        body.replaceChildren();
        if (!groups.length) {
            body.append(empty('No TwoKit variables on this site yet', 'Save your design system in TwoKit, then reload the builder.'));
            return;
        }
        const query = state.query.trim();
        if (!query) {
            ordered().forEach((g) => body.append(accordion(g, state.open.has(g.id), countOf(g), () => groupContent(g))));
            markCurrent();
            return;
        }
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        const results = search(query);
        if (!results.length) {
            body.append(empty(`No variable matches “${query.slice(0, 40)}”`, 'Search looks at every TwoKit group.'));
            return;
        }
        results.forEach(({ group, whole, entries }) => {
            const count = whole ? countOf(group) : entries.length;
            body.append(accordion(group, true, count, () => (whole ? groupContent(group) : filtered(group, entries, terms))));
        });
        markCurrent();
    }

    /** A group with only the matching variables. */
    function filtered(g, entries, terms) {
        const content = h('div', 'tkp-content');
        g.sections.forEach((s, si) => {
            if (s.type === 'tabs') {
                const filter = (ti) => entries.filter((e) => e.tab && e.tab.section === si && e.tab.index === ti);
                if (entries.some((e) => e.tab && e.tab.section === si)) content.append(renderTabs(s, state, `q.${g.id}.${si}`, filter));
                return;
            }
            const mine = entries.filter((e) => e.section === s && !e.tab);
            if (!mine.length) return;
            if (s.type === 'palettes') {
                content.append(renderChips({ label: '', items: mine.map((e) => e.item) }, terms));
                return;
            }
            content.append(renderSection(s, state, `q.${g.id}.${si}`, terms, mine.map((e) => e.item)));
        });
        return content;
    }

    function empty(title, text) {
        const box = h('div', 'tkp-empty');
        box.append(h('strong', '', title), h('span', '', text));
        return box;
    }

    /** Variable names used in a value: `1px solid var(--a)` → ['a']. */
    function varNames(value) {
        const out = [];
        const re = /var\(\s*--([A-Za-z0-9_-]{1,80})/g;
        let m;
        while ((m = re.exec(String(value || '')))) out.push(m[1]);
        return out;
    }

    /** Where a variable lives in the catalog (group, tab), or null. --light-x / --dark-x live with x. */
    function locate(name) {
        const base = name.replace(/^(light|dark)-/, '');
        for (const n of base === name ? [name] : [name, base]) {
            const hit = INDEX.find((e) => e.item.n === n);
            if (hit) return hit;
        }
        return null;
    }

    function markCurrent() {
        const names = state.session ? state.session.currentNames : null;
        if (!names || !names.size) return;
        state.body.querySelectorAll('[data-v]').forEach((el) => {
            el.classList.toggle('is-current', names.has(el.dataset.v));
        });
    }

    /** Scroll the variable that is set now into view (the picker shows its group open). */
    function revealCurrent() {
        const name = state.session && state.session.reveal;
        if (!name) return;
        const el = [...state.body.querySelectorAll('[data-v]')].find((x) => x.dataset.v === name);
        if (!el) return;
        const body = state.body;
        const r = el.getBoundingClientRect();
        const b = body.getBoundingClientRect();
        // Its group header stays in view above it when there is room.
        const head = el.closest('.tkp-group');
        const headTop = head ? head.getBoundingClientRect().top : r.top;
        const fits = r.bottom - headTop <= b.height - 16;
        const target = fits ? headTop - b.top - 8 : r.top - b.top - (b.height - r.height) / 2;
        body.scrollTop = Math.max(0, body.scrollTop + target);
    }

    /* ------------------------------------------------------------------ */
    /* Preview, apply, keyboard                                            */
    /* ------------------------------------------------------------------ */

    function preview(name) {
        if (!state.session || !NAME_RE.test(name) || state.previewing === name) return;
        state.previewing = name;
        try { state.session.preview(cssVar(name), { kind: kindOf(name) }); } catch (e) { /* preview is a nicety */ }
    }

    function clearPreview() {
        if (!state.session || !state.previewing) return;
        state.previewing = '';
        try { state.session.clear(); } catch (e) { /* ignore */ }
    }

    function choose(name, keepOpen) {
        if (!state.session || !NAME_RE.test(name)) return;
        const session = state.session;
        state.previewing = '';
        try { session.clear(); } catch (e) { /* ignore */ }
        const value = cssVar(name);
        const ok = session.apply(value, { keepOpen: !!keepOpen, kind: kindOf(name) });
        if (ok === false) return;
        if (keepOpen) {
            session.current = value;
            session.currentNames = new Set([name]);
            markCurrent();
        } else {
            closePicker({ applied: true });
        }
    }

    function onPointerOver(e) {
        const v = e.target.closest && e.target.closest('[data-v]');
        if (v) preview(v.dataset.v);
    }

    function onClick(e) {
        const v = e.target.closest && e.target.closest('[data-v]');
        if (v) {
            e.preventDefault();
            choose(v.dataset.v, e.shiftKey);
        }
    }

    function navItems() {
        return [...state.root.querySelectorAll('[data-nav]')].filter((el) => el.offsetParent !== null);
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            if (state.input.value) {
                state.input.value = '';
                state.query = '';
                renderBody();
                state.input.focus();
            } else {
                closePicker();
            }
            return;
        }
        const inSearch = e.target === state.input;
        if (inSearch && e.key === 'Enter') {
            e.preventDefault();
            const first = state.body.querySelector('[data-v]');
            if (first) choose(first.dataset.v, e.shiftKey);
            return;
        }
        if (!inSearch && e.key === 'Enter' && e.target.dataset && e.target.dataset.v) {
            e.preventDefault();
            choose(e.target.dataset.v, e.shiftKey);
            return;
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            const items = navItems();
            if (!items.length) return;
            if (inSearch && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
            e.preventDefault();
            const at = items.indexOf(doc.activeElement);
            const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
            if (at === -1) items[step > 0 ? 0 : items.length - 1].focus();
            else if (at + step < 0) state.input.focus();
            else items[Math.min(items.length - 1, at + step)].focus();
            return;
        }
        // Typing anywhere in the panel goes to the search field.
        if (!inSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ') {
            state.input.focus();
        }
    }

    function position(anchor) {
        const root = state.root;
        const view = doc.defaultView;
        const vw = view.innerWidth;
        const vh = view.innerHeight;
        const height = Math.min(MAX_HEIGHT, vh - 16);
        root.style.maxHeight = `${height}px`;
        const rect = root.getBoundingClientRect();
        const h0 = Math.min(rect.height || height, height);
        let left = anchor ? anchor.left : (vw - WIDTH) / 2;
        let top = anchor ? anchor.bottom + 4 : (vh - h0) / 2;
        if (anchor && top + h0 > vh - 8 && anchor.top - 4 - h0 >= 8) top = anchor.top - 4 - h0;
        left = Math.max(8, Math.min(left, vw - WIDTH - 8));
        top = Math.max(8, Math.min(top, vh - h0 - 8));
        root.style.left = `${Math.round(left)}px`;
        root.style.top = `${Math.round(top)}px`;
    }

    /**
     * Opens the picker.
     * @param {object} session
     * @param {Document} [session.doc]     document to show it in (default: this one)
     * @param {{left:number, top:number, bottom:number}} [session.anchor]
     * @param {string} [session.property]  CSS property, for the groups that open first
     * @param {string} [session.current]   current value, marked in the list
     * @param {string} [session.target]    the part a pick replaces; its variable's group opens
     * @param {Set<string>} [session.hide] group ids that can't go in this field
     * @param {(value: string, opts: {kind: string}) => void} session.preview
     * @param {() => void} session.clear
     * @param {(value: string, opts: {keepOpen: boolean, kind: string}) => boolean|void} session.apply
     * @param {(info: {applied: boolean}) => void} [session.onClose]
     */
    function openPicker(session) {
        if (state.session) closePicker();
        const target = session.doc && session.doc.body ? session.doc : document;
        if (!state.root || state.root.ownerDocument !== target || !state.root.isConnected) {
            if (state.root) state.root.remove();
            build(target);
        }
        doc = target;
        const hide = session.hide instanceof Set ? session.hide : null;
        state.session = {
            ...session,
            hide,
            fit: contextGroups(session.property).filter((id) => groups.some((g) => g.id === id) && !(hide && hide.has(id)))
        };
        state.query = '';
        state.input.value = '';
        state.tabs = new Map();
        // Shadow values are read from the page again for each open (a save may have changed them).
        pageStyle = null;
        // Tab choices live in the rendered groups: render them fresh for this field.
        state.rendered = new Map();
        // Palettes lead the list for colors but stay closed when a more specific group fits.
        const specific = state.session.fit.filter((id) => id !== 'palettes');
        state.open = new Set((specific.length ? specific : state.session.fit).slice(0, 2));
        // The variable the value uses now (the one under the cursor in Code2Bricks):
        // open its group, on its tab (States → info), and show it.
        state.session.currentNames = new Set(varNames(session.current));
        const active = varNames(session.target || session.current)
            .map(locate)
            .find((e) => e && shown(e.group));
        state.session.reveal = '';
        if (active) {
            state.open = new Set([active.group.id]);
            if (active.tab) state.tabs.set(`${active.group.id}.${active.tab.section}`, active.tab.index);
            const name = varNames(session.target || session.current).find((n) => locate(n) === active);
            state.session.reveal = name || active.item.n;
            state.session.currentNames.add(state.session.reveal);
        }
        state.root.hidden = false;
        renderBody();
        position(session.anchor);
        state.body.scrollTop = 0;
        revealCurrent();
        state.input.focus({ preventScroll: true });

        const outside = (e) => {
            if (!state.root.contains(e.target)) closePicker();
        };
        const view = target.defaultView;
        const onResize = () => position(session.anchor);
        target.addEventListener('pointerdown', outside, true);
        view.addEventListener('resize', onResize);
        view.addEventListener('blur', onWindowBlur);
        state.cleanup.push(() => {
            target.removeEventListener('pointerdown', outside, true);
            view.removeEventListener('resize', onResize);
            view.removeEventListener('blur', onWindowBlur);
        });
        // A click in the Bricks canvas (an iframe) never reaches this document.
        const canvas = canvasDocument();
        if (canvas && canvas !== target) {
            canvas.addEventListener('pointerdown', outside, true);
            state.cleanup.push(() => canvas.removeEventListener('pointerdown', outside, true));
        }
    }

    function onWindowBlur() {
        // Focus moved to another window: close. Focus that moved into the canvas
        // without a click (Bricks re-rendering an element after a hover preview,
        // a text element taking focus) keeps the picker open; a real click in the
        // canvas closes it through the canvas pointerdown listener.
        setTimeout(() => {
            if (!state.session || doc.hasFocus()) return;
            const active = doc.activeElement;
            if (active && active.tagName === 'IFRAME') return;
            closePicker();
        }, 0);
    }

    function closePicker(info = {}) {
        const session = state.session;
        if (!session) return;
        clearPreview();
        state.session = null;
        state.previewing = '';
        state.cleanup.splice(0).forEach((fn) => fn());
        if (state.root) state.root.hidden = true;
        try { if (session.onClose) session.onClose({ applied: !!info.applied }); } catch (e) { /* ignore */ }
    }

    /* ------------------------------------------------------------------ */
    /* Bricks fields                                                       */
    /* ------------------------------------------------------------------ */

    /** The Bricks builder app's mount point (main window, not the canvas). */
    function bricksBody() {
        for (const b of document.querySelectorAll('.brx-body')) if (b.__vue_app__) return b;
        return null;
    }

    function bricksState() {
        const body = bricksBody();
        return (body && body.__vue_app__.config.globalProperties.$_state) || null;
    }

    function canvasDocument() {
        try {
            const frame = document.getElementById('bricks-builder-iframe');
            return frame && frame.contentDocument;
        } catch (e) {
            return null;
        }
    }

    /** A Bricks value field that takes variables, or null. */
    function bricksField(el) {
        const input = el && el.closest ? el.closest('input') : null;
        if (!input || input.disabled || input.readOnly) return null;
        if (input.type && !['text', 'search', ''].includes(input.type)) return null;
        if (!input.closest('#bricks-panel')) return null;
        if (input.closest('.c2b-panel, #c2b-panel, .tkp, .CodeMirror')) return null;
        if (!input.closest('.has-variables, [data-control="number"], [data-control="color"]')) return null;
        // A locked Bricks class can't be styled: the browser's menu, no picker.
        if (activeClassLocked()) return null;
        return input;
    }

    /* Vue components behind a field ------------------------------------- */

    /**
     * The Vue component instances from the app root down to `el`, outermost
     * first, or null.
     *
     * Bricks ships Vue's production build, which does not put components on
     * DOM elements (`__vueParentComponent` exists only in development), so the
     * field's component can't be read from the input. Vue does always keep the
     * root vnode on the mount container (`._vnode`): walk down from there,
     * skipping every element that does not contain `el`.
     */
    function vueChain(el) {
        const body = bricksBody();
        const root = body && body._vnode;
        if (!root || !el) return null;
        const chain = [];
        let found = false;
        let steps = 0;
        const visit = (vn) => {
            if (found || !vn || typeof vn !== 'object' || ++steps > 100000) return;
            if (vn.component) {
                chain.push(vn.component);
                visit(vn.component.subTree);
                if (!found) chain.pop();
                return;
            }
            if (vn.el === el) {
                found = true;
                return;
            }
            const node = vn.el;
            if (typeof vn.type === 'string' && node && node.nodeType === 1 && !node.contains(el)) return;
            if (Array.isArray(vn.children)) {
                for (const child of vn.children) {
                    visit(child);
                    if (found) return;
                }
            }
            if (vn.suspense) visit(vn.suspense.activeBranch);
        };
        visit(root);
        return found ? chain : null;
    }

    /**
     * What Bricks knows about a field: its input component (the one with
     * addVariable(), which Bricks' own variable picker calls) and the control
     * it belongs to.
     * @returns {null|{ field: object, color: boolean, controlKey: string, parentKey: string, parentType: string }}
     */
    function bricksControl(input) {
        let chain = null;
        try { chain = vueChain(input); } catch (e) { chain = null; }
        if (!chain) return null;
        let inst = null;
        for (let i = chain.length - 1; i >= 0; i--) {
            const p = chain[i].proxy;
            if (p && typeof p.addVariable === 'function') {
                inst = chain[i];
                break;
            }
        }
        if (!inst) return null;
        const field = inst.proxy;
        const parent = field.$parent;
        return {
            field,
            // Same test as Bricks' variable picker: the input sits in a color control.
            color: !!(parent && parent.control && parent.control.type === 'color') || !!input.closest('[data-control="color"]'),
            controlKey: String(field.controlKey || ''),
            parentKey: String(field.parentKey || ''),
            parentType: String(field.parentType || '')
        };
    }

    const kebab = (s) => String(s || '').replace(/^_+/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

    const PROPERTY_MAP = [
        [/font-size/, 'font-size'], [/line-height/, 'line-height'], [/letter-spacing/, 'letter-spacing'],
        [/font-family/, 'font-family'], [/radius/, 'border-radius'], [/box-shadow|shadow/, 'box-shadow'],
        [/grid-template-columns/, 'grid-template-columns'], [/grid-template-rows/, 'grid-template-rows'],
        [/row-gap/, 'row-gap'], [/column-gap/, 'column-gap'], [/gap/, 'gap'],
        [/padding/, 'padding'], [/margin/, 'margin'],
        [/(max|min)-?width|(^|-)width/, 'width'], [/(max|min)-?height|(^|-)height/, 'height'],
        [/transition/, 'transition'], [/(^|-)(top|right|bottom|left)$/, 'inset']
    ];

    /**
     * Best guess of the CSS property a Bricks field sets. Nested controls
     * (box-shadow, border, typography …) are read from Bricks' own component
     * props; the DOM is the fallback.
     */
    function bricksProperty(input, ctl) {
        const top = input.closest('[data-controlkey]');
        const domKey = kebab(top && top.dataset ? top.dataset.controlkey : '');
        const own = kebab(input.id || input.name || '');
        const key = ctl ? kebab(ctl.controlKey) : '';
        const parentKey = ctl ? kebab(ctl.parentKey) : '';
        const parentType = ctl ? ctl.parentType : '';
        const isColor = ctl ? ctl.color : !!input.closest('[data-control="color"]');
        const hint = `${parentType} ${parentKey} ${key} ${domKey} ${own}`;
        // A Bricks shadow is offsetX offsetY blur spread color: a whole shadow
        // variable fits none of these fields.
        if (/shadow/.test(`${parentType} ${parentKey}`)) return isColor || key === 'color' ? 'shadow-color' : 'shadow-offset';
        if (isColor) {
            if (/background/.test(hint)) return 'background-color';
            if (/border|outline/.test(hint)) return 'border-color';
            return 'color';
        }
        if (parentType === 'border' && key === 'width') return 'border-width';
        for (const k of [key, parentKey, domKey, own]) {
            if (!k) continue;
            for (const [re, prop] of PROPERTY_MAP) if (re.test(k)) return prop;
        }
        return key || domKey || own;
    }

    /** Groups that can't hold a value for this field. */
    function hiddenGroups(property, isColor) {
        if (isColor) return new Set(VALUE_GROUPS);
        // No Bricks number/text field takes a color or a whole shadow.
        return new Set([...COLOR_GROUPS, 'shadows']);
    }

    /**
     * Core Framework's way: the value goes into the field and Bricks takes it
     * from the input event (its controls emit on input). Bricks then does
     * everything itself: units, linked spacing sides, colors, breakpoints,
     * states and the canvas.
     */
    function typeInto(input, value, commit) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (commit) input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /** A Bricks class that is locked can't be styled: no picker on its fields. */
    function activeClassLocked() {
        const st = bricksState();
        if (!st || (st.activePanel && st.activePanel !== 'element')) return false;
        return !!st.activeClassIsLocked;
    }

    function openForField(input) {
        const rect = input.getBoundingClientRect();
        const ctl = bricksControl(input);
        const property = bricksProperty(input, ctl);
        const isColor = ctl ? ctl.color : !!input.closest('[data-control="color"]');
        const st = bricksState();
        // Hover types the variable into the field; moving off types the old text back.
        let original = null; // the field's text before the first hover
        const clearSuggestions = () => setTimeout(() => {
            // Bricks fills its own variable suggestions when a field's value
            // changes while an input has focus (here: the picker's search).
            if (st && Array.isArray(st.globalVariableSuggestions) && st.globalVariableSuggestions.length) st.globalVariableSuggestions = [];
        }, 50);
        const restore = () => {
            if (original === null) return;
            const text = original;
            original = null;
            if (input.isConnected && input.value !== text) typeInto(input, text, false);
            clearSuggestions();
        };
        openPicker({
            doc: document,
            anchor: { left: rect.left, top: rect.top, bottom: rect.bottom },
            property,
            hide: hiddenGroups(property, isColor),
            current: input.value.trim(),
            preview: (value) => {
                if (!input.isConnected || activeClassLocked()) return;
                if (original === null) original = input.value;
                typeInto(input, value, false);
                clearSuggestions();
            },
            clear: restore,
            apply: (value) => {
                if (!input.isConnected || activeClassLocked()) return false;
                original = null; // the pick stays
                typeInto(input, value, true);
                clearSuggestions();
                return true;
            },
            onClose: ({ applied }) => {
                restore();
                // Back to the field; its control popup stays open. After an apply,
                // wait until Bricks has taken the new value, or its own variable
                // suggestions would open on the focused field.
                const focus = () => input.isConnected && input.focus({ preventScroll: true });
                if (applied) setTimeout(focus, 60);
                else focus();
            }
        });
    }

    document.addEventListener('contextmenu', (e) => {
        const input = bricksField(e.target);
        if (!input) return;
        e.preventDefault();
        e.stopPropagation();
        openForField(input);
    }, true);

    document.addEventListener('keydown', (e) => {
        if (!e.altKey || e.ctrlKey || e.metaKey || e.code !== 'KeyV') return;
        const input = bricksField(e.target);
        if (!input) return;
        e.preventDefault();
        e.stopPropagation();
        if (state.session) closePicker();
        else openForField(input);
    }, true);

    /* ------------------------------------------------------------------ */
    /* Code2Bricks                                                         */
    /* ------------------------------------------------------------------ */

    const STYLE_PANEL_START = '/* Styling panel css starts here */';
    const STYLE_PANEL_END = '/* Styling panel css ends here */';

    /**
     * The Code2Bricks editor asking for the picker can't be edited at the cursor:
     * a read-only editor (locked class, component) or the Styling panel CSS block
     * (comes from Bricks' Style panel, never saved as CSS). Code2Bricks checks
     * this itself; this keeps TwoKit right with a Code2Bricks that doesn't.
     * Code2Bricks marks the editor with `c2b-value-picking` before it asks.
     */
    function c2bReadOnly(target) {
        try {
            const wrap = target && target.querySelector('.CodeMirror.c2b-value-picking');
            const cm = wrap && wrap.CodeMirror;
            if (!cm) return false;
            if (cm.isReadOnly()) return true;
            const text = cm.getValue();
            const start = text.indexOf(STYLE_PANEL_START);
            if (start === -1) return false;
            const at = cm.indexFromPos(cm.getCursor());
            const end = text.indexOf(STYLE_PANEL_END, start);
            return at >= start && (end === -1 || at <= end + STYLE_PANEL_END.length);
        } catch (e) {
            return false;
        }
    }

    const provider = {
        id: 'twokit',
        label: 'TwoKit',
        apiVersion: 1,
        /**
         * @param {object} ctx Code2Bricks' value-picker context (API version 1):
         *   { property, value, document, anchorRect, preview(v), clearPreview(),
         *     apply(v, opts) → boolean, onClose? }
         */
        open(ctx) {
            if (!ctx || typeof ctx.apply !== 'function') return null;
            if (c2bReadOnly(ctx.document)) return null;
            const rect = ctx.anchorRect || null;
            openPicker({
                doc: ctx.document,
                anchor: rect ? { left: rect.left, top: rect.top, bottom: rect.bottom } : null,
                property: ctx.property,
                current: String(ctx.value || '').trim(),
                // API 1 addition: the part a pick replaces (the var() under the cursor).
                target: typeof ctx.target === 'string' ? ctx.target : '',
                preview: (v) => ctx.preview && ctx.preview(v),
                clear: () => ctx.clearPreview && ctx.clearPreview(),
                apply: (v, opts) => ctx.apply(v, opts),
                onClose: (info) => ctx.onClose && ctx.onClose(info)
            });
            return { close: () => closePicker() };
        },
        isOpen: () => !!state.session
    };
    (window.code2bricksValuePickers = window.code2bricksValuePickers || []).push(provider);

    window.TwoKitPicker = Object.freeze({
        version: 1,
        open: (session) => openPicker(session || {}),
        close: () => closePicker(),
        contextGroups,
        search: (q) => search(q).map((r) => ({ group: r.group.id, whole: r.whole, names: r.entries.map((e) => e.item.n) }))
    });

    /* ------------------------------------------------------------------ */
    /* Styles: Bricks' builder variables, so light and dark follow Bricks  */
    /* ------------------------------------------------------------------ */

    const CSS = `
.tkp{--tkp-bg:var(--builder-bg,#1e2226);--tkp-bg-2:var(--builder-bg-2,#262b30);--tkp-bg-3:var(--builder-bg-3,#2f353b);--tkp-bg-4:var(--builder-bg-4,#3a4148);--tkp-text:var(--builder-color,#e9ebed);--tkp-muted:var(--builder-color-description,#8a99a8);--tkp-border:var(--builder-border-color,#3a4148);--tkp-accent:var(--builder-color-accent,#ffd54d);--tkp-mono:var(--builder-font-family-monospace,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);position:fixed;z-index:2147483000;width:${WIDTH}px;display:flex;flex-direction:column;background:var(--tkp-bg);color:var(--tkp-text);border:1px solid var(--tkp-border);border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,.45),0 2px 6px rgba(0,0,0,.3);font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif;overflow:hidden;box-sizing:border-box}
.tkp[hidden]{display:none}
.tkp *,.tkp *::before,.tkp *::after{box-sizing:border-box}
.tkp button{font:inherit;color:inherit;margin:0;cursor:pointer}
.tkp-head{display:flex;align-items:center;gap:6px;padding:8px;background:var(--tkp-bg-2);border-bottom:1px solid var(--tkp-border);flex:none}
.tkp-search{flex:1;display:flex;align-items:center;gap:6px;height:28px;padding:0 8px;background:var(--tkp-bg);border:1px solid var(--tkp-border);border-radius:4px;color:var(--tkp-muted);cursor:text}
.tkp-search:focus-within{border-color:var(--tkp-accent);color:var(--tkp-text)}
.tkp-search input{flex:1;min-width:0;height:100%;padding:0;margin:0;border:0;outline:0;background:none;box-shadow:none;color:var(--tkp-text);font:inherit}
.tkp-search input::placeholder{color:var(--tkp-muted);opacity:1}
.tkp-close{flex:none;display:grid;place-items:center;width:26px;height:26px;padding:0;border:0;border-radius:4px;background:none;color:var(--tkp-muted)}
.tkp-close:hover,.tkp-close:focus-visible{background:var(--tkp-bg-3);color:var(--tkp-text);outline:0}
.tkp-body{overflow-y:auto;overscroll-behavior:contain;padding:8px 6px 8px 8px;display:flex;flex-direction:column;gap:6px;scrollbar-width:auto;scrollbar-color:auto}
.tkp-body::-webkit-scrollbar{width:6px;height:6px;background:transparent}
.tkp-body::-webkit-scrollbar-track{background:transparent;margin:8px 0}
.tkp-body::-webkit-scrollbar-thumb{background:var(--tkp-bg-4);background-clip:padding-box;border:0 solid transparent;border-right-width:2px;border-radius:3px;min-height:32px}
.tkp-body::-webkit-scrollbar-thumb:hover{background-color:var(--tkp-muted)}
.tkp-body::-webkit-scrollbar-corner,.tkp-body::-webkit-scrollbar-button{display:none;background:transparent}
@supports not selector(::-webkit-scrollbar){.tkp-body{scrollbar-width:thin;scrollbar-color:var(--tkp-bg-4) transparent}}
.tkp-group{display:flex;flex-direction:column}
.tkp-acc{display:flex;align-items:center;gap:6px;width:100%;padding:8px 10px;border:0;border-radius:5px;background:var(--tkp-bg-2);text-align:left}
.tkp-acc[aria-expanded="true"]{background:var(--tkp-bg-3)}
.tkp-acc:hover{background:var(--tkp-bg-3)}
.tkp-acc:focus-visible{outline:1px solid var(--tkp-accent);outline-offset:-1px}
.tkp-acc svg{color:var(--tkp-muted);transition:transform .12s}
.tkp-acc[aria-expanded="true"] svg{transform:rotate(90deg)}
.tkp-acc-title{font-weight:600}
.tkp-count{color:var(--tkp-muted);font-size:11px}
.tkp-grow{flex:1}
.tkp-content{display:flex;flex-direction:column;gap:12px;padding:10px 2px 6px}
.tkp-section{display:flex;flex-direction:column;gap:6px}
.tkp-label{color:var(--tkp-muted);font-size:11px}
.tkp-chips{display:flex;flex-wrap:wrap;gap:5px}
.tkp-chip{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:4px 8px;border:1px solid transparent;border-radius:4px;background:var(--tkp-bg-3);font-family:var(--tkp-mono);font-size:12px;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tkp-chip:has(i){padding-left:5px}
.tkp-chip:hover,.tkp-chip:focus-visible{background:var(--tkp-bg-4);outline:0}
.tkp-chip:focus-visible,.tkp-mode:focus-visible,.tkp-tile:focus-visible,.tkp-base:focus-visible,.tkp-cell:focus-visible,.tkp-tab:focus-visible{box-shadow:0 0 0 1px var(--tkp-accent);outline:0}
.is-current.tkp-chip,.is-current.tkp-tile{border-color:var(--tkp-accent);color:var(--tkp-accent)}
.is-current.tkp-mode,.is-current.tkp-base,.is-current.tkp-cell{box-shadow:inset 0 0 0 2px var(--tkp-accent)}
.tkp-mark{background:none;color:var(--tkp-accent);padding:0}
.tkp-dot,.tkp-split{flex:none;display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--tkp-c,transparent);box-shadow:inset 0 0 0 1px rgba(128,128,128,.45)}
.tkp-dot--s{width:8px;height:8px;box-shadow:none}
.tkp-split{background:linear-gradient(135deg,var(--tkp-l,transparent) 50%,var(--tkp-d,transparent) 50%)}
.tkp-pairs{display:flex;flex-direction:column;gap:4px}
.tkp-pairs-head,.tkp-pair{display:flex;align-items:center;gap:4px}
.tkp-pairs-head .tkp-label:first-child{flex:1}
.tkp-mode-label{width:32px;text-align:center;color:var(--tkp-muted);font-size:10px}
.tkp-pair .tkp-chip{min-width:0;flex:0 1 auto}
.tkp-tag{color:var(--tkp-muted);font-size:11px;white-space:nowrap;margin-left:2px}
.tkp-mode{flex:none;display:grid;place-items:center;width:32px;height:26px;padding:0;border:0;border-radius:4px;background:var(--tkp-bg-3)}
.tkp-mode:hover{background:var(--tkp-bg-4)}
.tkp-mode .tkp-dot{width:14px;height:14px}
.tkp-mode:has(.tkp-shade){overflow:hidden}
.tkp-shade{display:block;width:14px;height:12px;border-radius:3px}
.tkp-shade--light{background:#fff}
.tkp-shade--dark{background:#1f2124}
.tkp-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}
.tkp-tile{display:flex;flex-direction:column;gap:5px;padding:6px;border:1px solid transparent;border-radius:4px;background:var(--tkp-bg-3);font-family:var(--tkp-mono);font-size:11px;text-align:left;min-width:0}
.tkp-tile:hover{background:var(--tkp-bg-4)}
.tkp-tile-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tkp-cols{display:flex;gap:2px;height:20px}
.tkp-cols i{flex:1 1 0;border-radius:2px;background:var(--tkp-muted);opacity:.55}
.tkp-tile:hover .tkp-cols i,.is-current .tkp-cols i{opacity:.9}
.tkp-palettes{display:flex;flex-direction:column;gap:14px}
.tkp-palette{display:flex;flex-direction:column;gap:6px}
.tkp-palette-name{font-weight:700}
.tkp-base{height:28px;width:100%;padding:0;border:0;border-radius:4px;background:var(--tkp-c,transparent)}
.tkp-strip{display:flex;height:24px;border-radius:4px;overflow:hidden}
.tkp-cell{flex:1;padding:0;border:0;border-radius:0;background:var(--tkp-c,transparent)}
.tkp-base:hover,.tkp-cell:hover{box-shadow:inset 0 0 0 2px var(--tkp-accent)}
.tkp-tabs-wrap{display:flex;flex-direction:column;gap:10px}
.tkp-tabs{display:flex;flex-wrap:wrap;gap:2px;padding:2px;border-radius:5px;background:var(--tkp-bg-2)}
.tkp-tab{flex:1 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:5px 8px;border:0;border-radius:4px;background:none;color:var(--tkp-muted);font-size:11px;font-weight:500}
.tkp-tab[aria-selected="true"]{background:var(--tkp-bg-4);color:var(--tkp-text);font-weight:600}
.tkp-tab .tkp-count{font-size:10px}
.tkp-tab-panel{display:flex;flex-direction:column;gap:12px}
.tkp-empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:28px 16px;text-align:center}
.tkp-empty span{color:var(--tkp-muted);font-size:11px}
@media (prefers-reduced-motion:reduce){.tkp-acc svg{transition:none}}
`;
})();
