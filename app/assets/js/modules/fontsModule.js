/**
 * Fonts: a project font library, as in Core Framework.
 *
 *   Library   families in the project, their styles, fallback, roles
 *   Google    search the Google Fonts catalog, pick styles, add
 *   Upload    TTF / OTF / WOFF / WOFF2 → WOFF2 (see core/fontConverter.js)
 *
 * @module fontsModule
 */

import { highlight } from '../ui/highlight.js';
import AppState from '../state/appState.js';
import FontStore from '../core/fontStore.js';
import { prepareFontFile } from '../core/fontConverter.js';
import { CHARSETS, DEFAULT_CHARSET, charsetOf } from '../core/fontSubset.js';
import { formatBytes, FontFileError } from '../core/fontFile.js';
import { loadCatalog, parseVariant, sortVariants } from '../core/googleFonts.js';
import FontLoader, { nameFamily } from '../ui/fontLoader.js';
import ExampleSite from '../ui/exampleSite.js';
import Notifications from '../ui/notifications.js';
import Platform from '../platform.js';
import { esc, switcher, group, option, selectInput, iconButton, ICON } from '../ui/components.js';
import { dialSegmented } from '../ui/dial.js';
import { tokenStyle } from '../ui/tokenScope.js';
import {
    fontSlug, fontStack, fontVar, quoteFamily, faceKey, faceLabel, faceWeight, sortFaces, rolesOf,
    roleOptions, resolveRole, CATEGORY_LABEL, WEIGHT_NAMES
} from '../state/fontModel.js';

const VIEWS = [
    { value: 'library', label: 'Font library' },
    { value: 'google', label: 'Google Fonts' },
    { value: 'upload', label: 'Upload fonts' }
].filter((v) => v.value !== 'upload' || !Platform.hides('font-upload'));

/** The fonts view, never one this host leaves out. */
const currentView = () => (VIEWS.some((v) => v.value === AppState.ui.fontsView) ? AppState.ui.fontsView : 'library');

const CATEGORIES = [
    { value: 'all', label: 'All' },
    { value: 'sans-serif', label: 'Sans' },
    { value: 'serif', label: 'Serif' },
    { value: 'display', label: 'Display' },
    { value: 'handwriting', label: 'Hand' },
    { value: 'monospace', label: 'Mono' }
];

const RESULT_LIMIT = 80;
const SAMPLE = 'The quick brown fox jumps over the lazy dog';
const ACCEPT = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2';

const UPLOAD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v2.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const UPLOAD_DONE_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/** Official Google Fonts logo (follows the text color). */
const GOOGLE_ICON = '<svg viewBox="0 0 43 43" aria-hidden="true"><path fill="currentColor" d="M7.16667 5.0166C5.45602 5.0166 3.81544 5.69615 2.60583 6.90576C1.39622 8.11537 0.716667 9.75595 0.716667 11.4666C0.716667 13.1772 1.39622 14.8178 2.60583 16.0274C3.81544 17.237 5.45602 17.9166 7.16667 17.9166C8.87731 17.9166 10.5179 17.237 11.7275 16.0274C12.9371 14.8178 13.6167 13.1772 13.6167 11.4666C13.6167 9.75595 12.9371 8.11537 11.7275 6.90576C10.5179 5.69615 8.87731 5.0166 7.16667 5.0166ZM20.7833 5.0166V37.9833H33.6833C31.2124 37.9833 28.8427 37.0017 27.0955 35.2545C25.3482 33.5073 24.3667 31.1375 24.3667 28.6666C24.3667 26.1957 25.3482 23.8259 27.0955 22.0787C28.8427 20.3315 31.2124 19.3499 33.6833 19.3499C31.7826 19.3499 29.9597 18.5949 28.6157 17.2509C27.2717 15.9069 26.5167 14.084 26.5167 12.1833C26.5167 10.2825 27.2717 8.45968 28.6157 7.11567C29.9597 5.77166 31.7826 5.0166 33.6833 5.0166H20.7833ZM33.6833 5.0166V19.3499C35.584 19.3499 37.4069 18.5949 38.7509 17.2509C40.0949 15.9069 40.85 14.084 40.85 12.1833C40.85 10.2825 40.0949 8.45968 38.7509 7.11567C37.4069 5.77166 35.584 5.0166 33.6833 5.0166ZM33.6833 19.3499V37.9833C34.9068 37.9833 36.1183 37.7423 37.2487 37.2741C38.379 36.8059 39.4061 36.1196 40.2712 35.2545C41.1363 34.3893 41.8226 33.3623 42.2908 32.2319C42.759 31.1016 43 29.8901 43 28.6666C43 26.1957 42.0184 23.8259 40.2712 22.0787C38.524 20.3315 36.1543 19.3499 33.6833 19.3499ZM19.8875 6.43919L0 37.9815H15.7667L19.8875 31.4598V6.43919Z"/></svg>';

const variantName = (key) => {
    const v = parseVariant(key);
    return v ? `${WEIGHT_NAMES[v.weight] || v.weight}${v.style === 'italic' ? ' italic' : ''}` : key;
};

const FontsModule = {
    title: 'Fonts',
    previewModes: true,

    catalog: null,
    catalogError: '',
    query: '',
    category: 'all',
    selected: null, // { family, category, variants, keys: Set }
    queue: [], // upload queue
    observer: null,
    resultsScroll: 0, // the results list keeps its place across re-renders
    previewState: new Map(), // catalog family → 'ready' | 'failed' (full styles from the Google CDN)

    init() {
        loadCatalog()
            .then((items) => {
                this.catalog = items;
                if (AppState.ui.section === 'fonts') AppState.notify('fonts');
            })
            .catch((error) => {
                this.catalogError = error.message;
                if (AppState.ui.section === 'fonts') AppState.notify('fonts');
            });
    },

    view() {
        const view = currentView();
        const top = switcher({ id: 'fonts-view', value: view, options: VIEWS, label: 'Fonts view' });
        const body = view === 'google' ? this.googleView() : view === 'upload' ? this.uploadView() : this.libraryView();
        return { control: `<div class="control__stack">${top}${body}</div>`, preview: this.preview() };
    },

    /* ---------------- library ---------------- */

    libraryView() {
        const t = AppState.typography;
        const fonts = AppState.fonts;
        const roles = group({
            title: 'Roles',
            body: `
              ${option('Headings', selectInput({ key: 'headingFont', value: t.headingFont, options: roleOptions(), label: 'Heading font family' }))}
              ${option('Body text', selectInput({ key: 'bodyFont', value: t.bodyFont, options: roleOptions(), label: 'Body font family' }))}`
        });
        const add = `
          <div class="font-add">
            <button type="button" class="btn-dashed btn-dashed--sm" data-action="goto" data-value="google" data-fid="font-add-google">${GOOGLE_ICON}<span>Add Google font</span></button>
            ${Platform.hides('font-upload') ? '' : `<button type="button" class="btn-dashed btn-dashed--sm" data-action="goto" data-value="upload" data-fid="font-add-upload">${UPLOAD_ICON}<span>Upload font files</span></button>`}
          </div>`;
        const list = fonts.length
            ? `<div class="font-list">${fonts.map((f) => this.fontCard(f)).join('')}</div>${add}`
            : `<div class="font-empty"><p class="font-empty__title">No fonts yet</p><p class="dk-hint">Add a family from Google Fonts or upload your own files. Uploads are converted to WOFF2.</p>${add}</div>`;
        return `
          ${roles}
          ${group({ title: 'Library', badge: `${fonts.length} ${fonts.length === 1 ? 'family' : 'families'}`, card: false, body: list })}`;
    },

    fontCard(font) {
        const roles = rolesOf(font);
        const faces = sortFaces(font.faces);
        const size = faces.reduce((sum, f) => sum + (f.size || 0), 0);
        const formats = [...new Set(faces.map((f) => (f.format || 'woff2').toUpperCase()))].join(' + ');
        const meta = font.source === 'google'
            ? `Google Fonts · ${CATEGORY_LABEL[font.category] || 'Font'}`
            : `Uploaded · ${formats}${size ? ` · ${formatBytes(size)}` : ''}`;
        const available = font.source === 'google' ? this.catalogEntry(font.family)?.variants : null;
        const chips = available
            ? sortVariants(available).map((key) => `
                <button type="button" class="face-chip" data-action="face-toggle" data-font="${esc(font.id)}" data-key="${esc(key)}"
                        aria-pressed="${faces.some((f) => f.key === key)}" data-fid="face-${esc(font.id)}-${esc(key)}"
                        title="${esc(variantName(key))}">${esc(faceLabel(parseVariant(key)))}</button>`).join('')
            : faces.map((face) => `
                <span class="face-chip is-static" title="${esc(face.sourceName ? `${face.sourceName} → ${(face.format || 'woff2').toUpperCase()}` : variantName(face.key))}">
                  ${esc(faceLabel(face))}
                  ${font.source === 'local' ? `<button type="button" class="face-chip__remove" data-action="face-remove" data-font="${esc(font.id)}" data-key="${esc(face.key)}" aria-label="Remove ${esc(faceLabel(face))}">×</button>` : ''}
                </span>`).join('');
        const metaParts = [...meta.split(' · '), `${faces.length} ${faces.length === 1 ? 'style' : 'styles'}`];
        const slug = esc(font.id);
        return `
          <article class="font-card" aria-labelledby="font-name-${slug}">
            <header class="font-card__head">
              <div class="font-card__title">
                <h3 class="font-card__name" id="font-name-${slug}" style="font-family:${esc(fontStack(font))}" title="--${esc(fontVar(font))}">${esc(font.family)}</h3>
                <p class="font-card__meta">${metaParts.map((p) => `<span>${esc(p)}</span>`).join('')}</p>
              </div>
              <div class="font-card__actions">
                ${roles.length ? `<span class="font-card__roles">${roles.map((r) => `<span class="badge">${esc(r)}</span>`).join('')}</span><span class="font-card__sep" aria-hidden="true"></span>` : ''}
                ${iconButton({ action: 'font-remove', label: `Remove ${font.family}`, icon: 'trash', extra: font.id })}
              </div>
            </header>
            <section class="font-card__section" aria-labelledby="font-styles-${slug}">
              <h4 class="font-card__label" id="font-styles-${slug}">Font styles</h4>
              <div class="font-card__faces" role="group" aria-labelledby="font-styles-${slug}">${chips}</div>
            </section>
            ${font.source === 'local' ? `
            <section class="font-card__section" aria-labelledby="font-fallback-${slug}">
              <h4 class="font-card__label" id="font-fallback-${slug}">Fallback</h4>
              ${switcher({ id: `category:${font.id}`, value: font.category, options: Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label })), label: `${font.family} fallback stack`, size: 'md' })}
            </section>` : ''}
          </article>`;
    },

    catalogEntry(family) {
        return this.catalog?.find((f) => f.family === family) || null;
    },

    /* ---------------- google ---------------- */

    googleView() {
        const count = this.catalog ? this.catalog.length.toLocaleString() : '';
        return `
          <div class="font-search">
            <svg class="font-search__icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor"/><path d="m10.5 10.5 3 3" stroke="currentColor" stroke-linecap="round"/></svg>
            <input class="text-input font-search__input" type="search" value="${esc(this.query)}" placeholder="Search ${count} Google Fonts families"
                   data-font-search data-fid="font-search" aria-label="Search Google Fonts" autocomplete="off" spellcheck="false">
          </div>
          ${dialSegmented({ key: 'font-category', value: this.category, options: CATEGORIES, label: 'Font category', fid: 'font-category' })}
          <div class="font-results" id="fontResults" role="listbox" aria-label="Google Fonts">${this.resultsHtml()}</div>`;
    },

    matches() {
        const q = this.query.trim().toLowerCase();
        return (this.catalog || []).filter((f) => (this.category === 'all' || f.category === this.category)
            && (!q || f.family.toLowerCase().includes(q)))
            .sort((a, b) => {
                if (!q) return 0;
                const ai = a.family.toLowerCase().startsWith(q) ? 0 : 1;
                const bi = b.family.toLowerCase().startsWith(q) ? 0 : 1;
                return ai - bi;
            });
    },

    resultsHtml() {
        if (this.catalogError) return `<p class="font-results__note">Couldn't load the Google Fonts catalog: ${esc(this.catalogError)}</p>`;
        if (!this.catalog) return '<p class="font-results__note">Loading catalog…</p>';
        const all = this.matches();
        if (!all.length) return `<p class="font-results__note">No families match “${esc(this.query)}”.</p>`;
        const inLibrary = new Set(AppState.fonts.filter((f) => f.source === 'google').map((f) => f.family));
        const rows = all.slice(0, RESULT_LIMIT).map((f) => `
          <button type="button" class="font-result" role="option" data-google="${esc(f.family)}" data-fid="gf-${esc(fontSlug(f.family))}"
                  aria-selected="${this.selected?.family === f.family}">
            <span class="font-result__name" style="font-family:${esc(quoteFamily(nameFamily(f.family)))}, ${esc(quoteFamily(f.family))}, var(--font-fallback, sans-serif)">${esc(f.family)}</span>
            <span class="font-result__meta">${esc(CATEGORY_LABEL[f.category] || f.category)} · ${f.variants.length} ${f.variants.length === 1 ? 'style' : 'styles'}</span>
            ${inLibrary.has(f.family) ? '<span class="badge">Added</span>' : ''}
          </button>`).join('');
        const more = all.length > RESULT_LIMIT
            ? `<p class="font-results__note">Showing ${RESULT_LIMIT} of ${all.length.toLocaleString()}. Keep typing to narrow it down.</p>`
            : '';
        return rows + more;
    },

    selectGoogle(family) {
        const entry = this.catalogEntry(family);
        if (!entry) return;
        const existing = AppState.fonts.find((f) => f.source === 'google' && f.family === family);
        const defaults = entry.variants.filter((k) => ['400', '700'].includes(k));
        const keys = existing ? existing.faces.map((f) => f.key) : (defaults.length ? defaults : [entry.variants[0]]);
        this.selected = { ...entry, keys: new Set(keys) };
        // Every style straight from the Google CDN (preview only; the export self-hosts).
        // The specimen fades in once the regular style has arrived. A failed load retries on the next pick.
        if (this.previewState.get(family) === 'failed') this.previewState.delete(family);
        FontLoader.previewFull(family, entry.variants).then((ok) => {
            if (this.previewState.get(family) === (ok ? 'ready' : 'failed')) return;
            this.previewState.set(family, ok ? 'ready' : 'failed');
            if (this.selected?.family !== family) return;
            if (ok) document.querySelectorAll('[data-font-loading]').forEach((el) => el.removeAttribute('data-font-loading'));
            else AppState.notify('fonts');
        });
        AppState.notify('fonts');
    },

    addGoogle() {
        const s = this.selected;
        if (!s || !s.keys.size) return;
        const faces = sortVariants([...s.keys]).map((key) => ({ key, ...parseVariant(key) }));
        const fonts = [...AppState.fonts];
        const index = fonts.findIndex((f) => f.source === 'google' && f.family === s.family);
        if (index >= 0) {
            fonts[index] = { ...fonts[index], faces };
            Notifications.success(`${s.family} updated · ${faces.length} styles`);
        } else {
            if (fonts.some((f) => f.family.toLowerCase() === s.family.toLowerCase())) {
                Notifications.error(`${s.family} is already in your library as an upload`);
                return;
            }
            fonts.push({ id: this.uniqueId(s.family), family: s.family, source: 'google', category: s.category, faces });
            Notifications.success(`${s.family} added to your library`);
        }
        AppState.updateFonts(fonts);
    },

    uniqueId(family) {
        const base = fontSlug(family);
        let id = base;
        for (let i = 2; AppState.fonts.some((f) => f.id === id); i++) id = `${base}-${i}`;
        return id;
    },

    /* ---------------- upload ---------------- */

    uploadView() {
        const ready = this.queue.filter((q) => q.status === 'ready');
        const rows = this.queue.map((q) => this.uploadRow(q)).join('');
        const charset = charsetOf(AppState.ui.fontCharset || DEFAULT_CHARSET);
        return `
          <div class="font-charset">
            <div class="font-charset__head">
              <span class="font-card__label">Character set</span>
              ${dialSegmented({ key: 'font-charset', value: charset.value, options: CHARSETS.map((c) => ({ value: c.value, label: c.label })), label: 'Character set', fid: 'font-charset' })}
            </div>
            <p class="font-charset__detail">${esc(charset.detail)}${charset.ranges ? '. Only these characters are kept, which makes large fonts web-sized and fast to convert.' : '. Large desktop fonts can stay very big.'}</p>
          </div>
          <label class="dropzone font-drop" data-font-drop data-fid="font-drop">
            <input class="visually-hidden" type="file" multiple accept="${ACCEPT}" data-font-files>
            <span class="font-drop__icon">${UPLOAD_ICON}</span>
            <strong>Drop font files or click to browse</strong>
            <span>TTF, OTF, WOFF or WOFF2, converted to WOFF2 (the smallest web format).</span>
          </label>
          ${this.queue.length ? group({
              title: 'Ready to add',
              badge: `${ready.length} of ${this.queue.length}`,
              actions: iconButton({ action: 'upload-clear', label: 'Clear list', icon: 'trash' }),
              card: false,
              body: `${this.uploadBar(ready)}<div class="upload-list">${rows}</div>`
          }) : ''}`;
    },

    /**
     * The next step, right under the header (sticky while the list scrolls):
     * progress while files convert, then the add button with what it adds.
     * Adding waits for every conversion so a family goes in together.
     */
    uploadBar(ready) {
        const total = this.queue.length;
        const converting = this.queue.filter((q) => q.status === 'converting').length;
        const failed = this.queue.filter((q) => q.status === 'error').length;
        const done = total - converting;
        const size = ready.reduce((sum, q) => sum + q.result.output.size, 0);
        const styles = (n) => `${n} ${n === 1 ? 'style' : 'styles'}`;
        const status = converting
            ? `<span class="spinner" aria-hidden="true"></span>Converting ${done + 1 > total ? total : done + 1} of ${total}…`
            : ready.length
                ? `<b>${styles(ready.length)} ready</b> · ${formatBytes(size)}${failed ? ` · <span class="upload-bar__failed">${failed} failed</span>` : ''}`
                : `<span class="upload-bar__failed">Nothing could be converted</span>`;
        const label = converting ? 'Converting…' : `Add ${styles(ready.length)} to library`;
        return `
          <div class="upload-bar${converting ? ' is-busy' : ready.length ? ' is-ready' : ''}">
            <p class="upload-bar__status" role="status" aria-live="polite">${status}</p>
            <button type="button" class="upload-add" data-action="upload-add" data-fid="upload-add" ${!converting && ready.length ? '' : 'disabled'}>
              ${!converting && ready.length ? UPLOAD_DONE_ICON : ''}<span>${label}</span>
            </button>
            ${converting ? `<span class="upload-bar__progress" aria-hidden="true"><i style="inline-size:${Math.round((done / total) * 100)}%"></i></span>` : ''}
          </div>`;
    },

    uploadRow(q) {
        const head = `<span class="upload-row__file" title="${esc(q.name)}">${esc(q.name)}</span>`;
        if (q.status === 'converting') {
            return `<div class="upload-row is-busy">${head}<span class="upload-row__status"><span class="spinner" aria-hidden="true"></span>Converting…</span></div>`;
        }
        if (q.status === 'error') {
            return `
              <div class="upload-row is-error">${head}
                <span class="upload-row__status">${esc(q.error)}</span>
                ${iconButton({ action: 'upload-remove', label: `Remove ${q.name}`, icon: 'trash', extra: q.id })}
              </div>`;
        }
        const { source, output, note } = q.result;
        const saved = Math.round((1 - output.size / source.size) * 100);
        const kept = q.result.charset && q.result.charset !== 'all' ? ` · ${charsetOf(q.result.charset).label}` : '';
        const conversion = source.format === output.format && output.size === source.size
            ? `${output.label} · ${formatBytes(output.size)} · already a web font`
            : `${source.label} ${formatBytes(source.size)} → ${output.label} ${formatBytes(output.size)}${saved > 0 ? ` · ${saved}% smaller` : ''}${kept}`;
        const weights = q.variable
            ? [{ value: 'variable', label: `${q.variable.min}–${q.variable.max} variable` }]
            : Object.entries(WEIGHT_NAMES).map(([w, name]) => ({ value: w, label: `${w} ${name}` }));
        return `
          <div class="upload-row">
            ${head}
            <span class="upload-row__status is-ok" title="${esc(note)}">${esc(conversion)}</span>
            ${iconButton({ action: 'upload-remove', label: `Remove ${q.name}`, icon: 'trash', extra: q.id })}
            <div class="upload-row__fields">
              <label class="upload-field"><span>Family</span>
                <input class="text-input" value="${esc(q.family)}" data-upload-family="${esc(q.id)}" data-fid="uf-${esc(q.id)}" spellcheck="false" aria-label="Family name for ${esc(q.name)}">
              </label>
              <div class="upload-field"><span>Weight</span>
                ${switcher({ id: `uw:${q.id}`, value: q.variable ? 'variable' : String(q.weight), options: weights, label: `Weight for ${q.name}`, size: 'sm' })}
              </div>
              <div class="upload-field"><span>Style</span>
                ${switcher({ id: `us:${q.id}`, value: q.style, options: [{ value: 'normal', label: 'Normal' }, { value: 'italic', label: 'Italic' }], label: `Style for ${q.name}`, size: 'sm' })}
              </div>
            </div>
          </div>`;
    },

    async enqueue(files) {
        if (Platform.hides('font-upload')) return;
        const list = [...files];
        if (!list.length) return;
        const items = list.map((file) => ({ id: AppState.generateId(), name: file.name, status: 'converting', file }));
        this.queue = [...this.queue, ...items];
        if (AppState.ui.fontsView !== 'upload') AppState.updateUi({ fontsView: 'upload' });
        else AppState.notify('fonts');
        await this.convert(items);
    },

    /** Converts queue items with the current character set (all at once; the encoder pool runs them in parallel). */
    async convert(items) {
        const charset = AppState.ui.fontCharset || DEFAULT_CHARSET;
        await Promise.all(items.map(async (item) => {
            const run = (item.run || 0) + 1;
            item.run = run;
            try {
                const result = await prepareFontFile(item.file, { charset });
                if (item.run !== run) return; // a newer conversion (character set changed) replaced this one
                Object.assign(item, {
                    status: 'ready',
                    result,
                    family: result.meta.family,
                    weight: result.meta.weight,
                    style: result.meta.style,
                    variable: result.meta.variable
                });
                FontLoader.previewBytes(`queue:${item.id}`, `twokit-queue-${item.id}`, result.output.bytes, { weight: result.meta.weight, style: result.meta.style, variable: result.meta.variable });
            } catch (error) {
                if (item.run !== run) return;
                Object.assign(item, { status: 'error', error: error instanceof FontFileError ? error.message : `Couldn't convert: ${error.message}` });
            }
            AppState.notify('fonts');
        }));
    },

    /** New character set: re-convert everything still waiting to be added. */
    setCharset(value) {
        AppState.ui.fontCharset = value;
        const waiting = this.queue.filter((q) => q.file);
        for (const q of waiting) {
            FontLoader.dropPreview(`queue:${q.id}`);
            Object.assign(q, { status: 'converting', result: null, error: null });
        }
        AppState.notify('fonts');
        if (waiting.length) this.convert(waiting);
    },

    removeQueued(id) {
        FontLoader.dropPreview(`queue:${id}`);
        this.queue = this.queue.filter((q) => q.id !== id);
        AppState.notify('fonts');
    },

    async addUploads() {
        const ready = this.queue.filter((q) => q.status === 'ready');
        if (!ready.length) return;
        const fonts = AppState.fonts.map((f) => ({ ...f, faces: [...f.faces] }));
        const byFamily = new Map();
        for (const q of ready) {
            const family = q.family.trim() || q.result.meta.family;
            const clash = fonts.find((f) => f.family.toLowerCase() === family.toLowerCase() && f.source === 'google');
            if (clash) {
                Notifications.error(`${family} is already in your library from Google Fonts. Remove it first or rename the upload.`);
                return;
            }
            if (!byFamily.has(family)) byFamily.set(family, []);
            byFamily.get(family).push(q);
        }
        try {
            for (const [family, items] of byFamily) {
                let font = fonts.find((f) => f.source === 'local' && f.family.toLowerCase() === family.toLowerCase());
                if (!font) {
                    font = { id: this.uniqueId(family), family, source: 'local', category: items[0].result.meta.category || 'sans-serif', faces: [] };
                    fonts.push(font);
                }
                for (const q of items) {
                    const key = faceKey(q.weight, q.style, q.variable);
                    const fileId = `${font.id}:${key}:${AppState.generateId()}`;
                    await FontStore.put(fileId, q.result.output.bytes);
                    const old = font.faces.find((f) => f.key === key);
                    if (old?.fileId) FontStore.remove(old.fileId).catch(() => {});
                    font.faces = font.faces.filter((f) => f.key !== key).concat({
                        key,
                        weight: q.variable ? q.variable.min : Number(q.weight),
                        style: q.style,
                        ...(q.variable ? { variable: q.variable } : {}),
                        fileId,
                        format: q.result.output.format,
                        size: q.result.output.size,
                        sourceName: q.name,
                        sourceFormat: q.result.source.format,
                        charset: q.result.charset
                    });
                }
                font.faces = sortFaces(font.faces);
            }
        } catch (error) {
            console.error(error);
            Notifications.error(`Couldn't store the fonts: ${error.message}`);
            return;
        }
        for (const q of ready) FontLoader.dropPreview(`queue:${q.id}`);
        this.queue = this.queue.filter((q) => q.status !== 'ready');
        Notifications.success(`${ready.length} ${ready.length === 1 ? 'style' : 'styles'} added · ${[...byFamily.keys()].join(', ')}`);
        AppState.ui = { ...AppState.ui, fontsView: 'library' };
        AppState.updateFonts(fonts);
    },

    /* ---------------- library edits ---------------- */

    removeFont(id) {
        const font = AppState.fonts.find((f) => f.id === id);
        if (!font) return;
        for (const face of font.faces) if (face.fileId) FontStore.remove(face.fileId).catch(() => {});
        const t = AppState.typography;
        const moved = [];
        const updates = {};
        if (t.headingFont === id) { updates.headingFont = 'system-sans'; moved.push('Headings'); }
        if (t.bodyFont === id) { updates.bodyFont = 'system-sans'; moved.push('Body text'); }
        AppState.fonts = AppState.fonts.filter((f) => f.id !== id);
        if (moved.length) AppState.updateTypography(updates);
        AppState.updateFonts(AppState.fonts);
        Notifications.info(moved.length ? `${font.family} removed · ${moved.join(' and ')} now use System sans` : `${font.family} removed`);
    },

    toggleGoogleFace(id, key) {
        const fonts = AppState.fonts.map((f) => {
            if (f.id !== id) return f;
            const has = f.faces.some((face) => face.key === key);
            if (has && f.faces.length === 1) {
                Notifications.info('A font needs at least one style');
                return f;
            }
            const faces = has ? f.faces.filter((face) => face.key !== key) : [...f.faces, { key, ...parseVariant(key) }];
            return { ...f, faces: sortFaces(faces) };
        });
        AppState.updateFonts(fonts);
    },

    removeLocalFace(id, key) {
        const font = AppState.fonts.find((f) => f.id === id);
        if (!font) return;
        if (font.faces.length === 1) return this.removeFont(id);
        const face = font.faces.find((f) => f.key === key);
        if (face?.fileId) FontStore.remove(face.fileId).catch(() => {});
        AppState.updateFonts(AppState.fonts.map((f) => (f.id === id ? { ...f, faces: f.faces.filter((x) => x.key !== key) } : f)));
    },

    /* ---------------- preview ---------------- */

    preview() {
        const mode = AppState.ui.previewMode;
        if (mode === 'code') return `<pre class="code-block"><code>${highlight(this.css())}</code></pre>`;
        if (mode === 'example') return ExampleSite.productFrame();
        const view = currentView();
        if (view === 'google') return this.googlePreview();
        if (view === 'upload') return this.uploadPreview();
        return this.libraryPreview();
    },

    specimenRows(family, faces, stack) {
        return faces.map((face) => `
          <li class="font-specimen__row">
            <span class="font-specimen__label">${esc(faceLabel(face))}<small>${esc(variantName(face.variable ? `${face.variable.min}` : face.key))}</small></span>
            <p style="font-family:${esc(stack || quoteFamily(family))};font-weight:${face.variable ? 400 : face.weight};font-style:${face.style};font-size:var(--${this.type('text-l')}, 22px);line-height:var(--text-line-height)">${SAMPLE}</p>
          </li>`).join('');
    },

    /** Type token name with the project prefix (h1, text-l, font-heading …). */
    type(name) {
        return AppState.tokenName('type', name);
    },

    /**
     * A themed board carrying the exported tokens, so everything inside is
     * styled by var(--…) exactly like the site: theme colors, type sizes,
     * font variables and the ex-based heading / text line heights.
     */
    stage(content, { head = '' } = {}) {
        const mode = AppState.ui.fontsPreviewMode === 'dark' ? 'dark' : 'light';
        return `
          <div class="font-stage" data-mode="${mode}" style="${esc(tokenStyle(mode))}">
            ${head ? `<div class="font-stage__head">${head}${this.modeToggle(mode)}</div>` : ''}
            ${content}
          </div>`;
    },

    modeToggle(mode) {
        const btn = (m, icon, name) => `<button type="button" class="segmented__btn" data-action="fonts-preview-mode" data-value="${m}" aria-pressed="${mode === m}" aria-label="${name}" title="${name}" data-fid="fonts-preview-${m}">${icon}</button>`;
        return `<div class="segmented segmented--sm" role="group" aria-label="Preview theme">${btn('light', ICON.sun, 'Light')}${btn('dark', ICON.moon, 'Dark')}</div>`;
    },

    /** Inline heading / body styles from the typography settings, all on tokens. */
    textStyles() {
        const t = AppState.typography;
        const heading = (level) => [
            `font-family:var(--${this.type('font-heading')})`,
            `font-size:var(--${this.type(level)})`,
            `font-weight:${t.headingWeight}`,
            `letter-spacing:${t.headingLetterSpacing}`,
            'line-height:var(--heading-line-height)',
            `color:${t.headingColor || 'var(--text-primary)'}`,
            `text-wrap:${t.textWrap}`
        ].join(';');
        const body = (size = t.bodyFontSize || `var(--${this.type('text-16')})`) => [
            `font-family:var(--${this.type('font-body')})`,
            `font-size:${size}`,
            `font-weight:${t.bodyWeight}`,
            `letter-spacing:${t.bodyLetterSpacing || '0em'}`,
            'line-height:var(--text-line-height)',
            `color:${t.bodyColor || 'var(--text-secondary)'}`,
            `text-wrap:${t.bodyTextWrap}`
        ].join(';');
        return { heading, body };
    },

    libraryPreview() {
        const heading = resolveRole(AppState.typography.headingFont);
        const body = resolveRole(AppState.typography.bodyFont);
        const { heading: h, body: b } = this.textStyles();
        const tokens = (list) => `<p class="font-stage__tokens">${list.map((x) => `<code>${esc(x)}</code>`).join('')}</p>`;
        const pairing = this.stage(`
            <div class="font-stage__pair">
              <h1 style="${esc(h('h1'))}">Design systems that ship without the guesswork</h1>
              ${tokens([`--${this.type('h1')}`, '--heading-line-height'])}
              <p style="${esc(b())}">Tokens for color, type and space, exported straight to Bricks. Every size, color and line height here is a variable from your project, so this is how the text will look on the site: headings in ${esc(heading.label)}, body text in ${esc(body.label)}.</p>
              ${tokens([(AppState.typography.bodyFontSize || `--${this.type('text-16')}`).replace(/^var\((--[\w-]+)\)$/, '$1'), '--text-line-height'])}
              <h3 style="${esc(h('h3'))}">Line heights that follow the font</h3>
              <p style="${esc(b())}">Line height is worked out from each font’s x-height, so large headings sit tight and body text stays open and easy to read, whatever the size.</p>
            </div>`, { head: `<span class="font-stage__title">Pairing <b>${esc(heading.label)} / ${esc(body.label)}</b></span>` });
        const cards = AppState.fonts.map((font) => `
          <article class="preview-card">
            <header class="preview-card__header"><h3>${esc(font.family)}</h3><span class="preview-card__hint">${rolesOf(font).join(' · ') || (font.source === 'google' ? 'Google Fonts' : 'Uploaded')}</span></header>
            ${this.stage(`
              <p class="font-specimen__display" style="font-family:${esc(fontStack(font))};font-size:var(--${this.type('h1')});line-height:var(--heading-line-height)">Aa Bb Cc 0123</p>
              <ol class="font-specimen">${this.specimenRows(font.family, sortFaces(font.faces), fontStack(font))}</ol>`)}
          </article>`).join('');
        return pairing + cards;
    },

    googlePreview() {
        const s = this.selected;
        if (!s) {
            return `<div class="font-placeholder"><p>Pick a family on the left to preview its styles.</p></div>`;
        }
        const exists = AppState.fonts.some((f) => f.source === 'google' && f.family === s.family);
        const chips = sortVariants(s.variants).map((key) => `
          <button type="button" class="face-chip" data-action="google-toggle" data-key="${esc(key)}" aria-pressed="${s.keys.has(key)}"
                  data-fid="gk-${esc(key)}" title="${esc(variantName(key))}">${esc(faceLabel(parseVariant(key)))}</button>`).join('');
        const faces = sortVariants([...s.keys]).map((key) => ({ key, ...parseVariant(key) }));
        const state = this.previewState.get(s.family);
        const loading = state ? '' : ' data-font-loading';
        const failed = state === 'failed'
            ? '<p class="font-detail__note">Couldn’t reach Google Fonts, so this preview uses a fallback font. Pick the family again to retry.</p>'
            : '';
        return `
          <article class="preview-card font-detail"${loading} aria-busy="${!state}">
            <header class="preview-card__header">
              <h3>${esc(s.family)}</h3>
              <span class="preview-card__hint">${esc(CATEGORY_LABEL[s.category] || s.category)} · ${s.variants.length} styles available</span>
            </header>
            <div class="preview-card__body font-detail__body">
              ${failed}
              ${this.stage(`<p class="font-specimen__display" style="font-family:${esc(quoteFamily(s.family))}, var(--font-fallback, sans-serif);font-size:var(--${this.type('h1')});line-height:var(--heading-line-height)">Aa Bb Cc 0123</p>`)}
              <div class="font-detail__row">
                <span class="font-detail__label">Styles</span>
                <div class="font-detail__chips" role="group" aria-label="Styles to include">${chips}</div>
              </div>
              <div class="font-detail__row font-detail__row--end">
                <button type="button" class="btn font-detail__add" data-action="google-add" data-fid="google-add" ${s.keys.size ? '' : 'disabled'}>
                  ${exists ? 'Update styles' : `Add ${s.keys.size} ${s.keys.size === 1 ? 'style' : 'styles'}`}
                </button>
              </div>
            </div>
          </article>
          <article class="preview-card"${loading}>
            <header class="preview-card__header"><h3>Selected styles</h3><span class="preview-card__hint">Self-hosted as WOFF2 when you export</span></header>
            ${this.stage(`<ol class="font-specimen">${this.specimenRows(s.family, faces)}</ol>`)}
          </article>`;
    },

    uploadPreview() {
        const ready = this.queue.filter((q) => q.status === 'ready');
        if (!ready.length) {
            return `<div class="font-placeholder"><p>Converted fonts show up here before you add them.</p></div>`;
        }
        return ready.map((q) => {
            const face = { weight: q.weight, style: q.style, variable: q.variable, key: faceKey(q.weight, q.style, q.variable) };
            const style = `font-family:${quoteFamily(`twokit-queue-${q.id}`)};font-weight:${q.variable ? 400 : q.weight};font-style:${q.style}`;
            return `
              <article class="preview-card">
                <header class="preview-card__header"><h3>${esc(q.family || q.result.meta.family)} · ${esc(faceLabel(face))}</h3><span class="preview-card__hint">${esc(q.result.meta.fullName || q.name)}</span></header>
                ${this.stage(`
                  <p class="font-specimen__display" style="${esc(style)};font-size:var(--${this.type('h1')});line-height:var(--heading-line-height)">Aa Bb Cc 0123</p>
                  <p class="font-specimen__sample" style="${esc(style)};font-size:var(--${this.type('text-l')}, 22px);line-height:var(--text-line-height)">${SAMPLE}</p>`)}
              </article>`;
        }).join('');
    },

    /** Library as CSS, with the file names the Fonts zip uses (fonts/<Family>-<style>.woff2). */
    css() {
        const t = AppState.typography;
        const fileBase = (family) => family.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'font';
        const faces = AppState.fonts.flatMap((font) => sortFaces(font.faces).map((face) => {
            const format = font.source === 'google' ? 'woff2' : face.format || 'woff2';
            const src = `url("fonts/${fileBase(font.family)}-${face.key}.${format}") format("${format}")`;
            return `@font-face {\n  font-family: ${quoteFamily(font.family)};\n  font-style: ${face.style};\n  font-weight: ${faceWeight(face)};\n  font-display: swap;\n  src: ${src};\n}`;
        }));
        const note = AppState.fonts.some((f) => f.source === 'google')
            ? '/* Google styles are downloaded as WOFF2 at export. Variable families\n   (one file for every weight) become a single @font-face with a weight range. */\n\n'
            : '';
        const vars = AppState.fonts.map((f) => `  --${fontVar(f)}: ${fontStack(f)};`);
        const role = (value) => {
            const r = resolveRole(value);
            return r.font ? `var(--${fontVar(r.font)})` : r.stack;
        };
        vars.push(`  --${AppState.tokenName('type', 'font-heading')}: ${role(t.headingFont)};`);
        vars.push(`  --${AppState.tokenName('type', 'font-body')}: ${role(t.bodyFont)};`);
        return `${note}${faces.join('\n\n')}${faces.length ? '\n\n' : ''}:root {\n${vars.join('\n')}\n}`;
    },

    /* ---------------- events ---------------- */

    onSwitch({ id, value }) {
        if (id === 'fonts-view') return AppState.updateUi({ fontsView: value });
        if (id === 'headingFont' || id === 'bodyFont') return AppState.updateTypography({ [id]: value });
        if (id?.startsWith('category:')) {
            const fontId = id.slice('category:'.length);
            return AppState.updateFonts(AppState.fonts.map((f) => (f.id === fontId ? { ...f, category: value } : f)));
        }
        const q = this.queue.find((item) => id === `uw:${item.id}` || id === `us:${item.id}`);
        if (!q) return;
        if (id.startsWith('uw:') && value !== 'variable') q.weight = Number(value);
        if (id.startsWith('us:')) q.style = value;
        FontLoader.dropPreview(`queue:${q.id}`);
        FontLoader.previewBytes(`queue:${q.id}`, `twokit-queue-${q.id}`, q.result.output.bytes, q);
        AppState.notify('fonts');
    },

    onDial({ key, value, live }) {
        if (key === 'font-charset') {
            if (!live) this.setCharset(value);
            return;
        }
        if (key !== 'font-category') return;
        this.category = value;
        this.refreshResults();
    },

    onInput(event) {
        if (!event.target.matches('[data-font-search]')) return;
        this.query = event.target.value;
        this.refreshResults();
    },

    onChange(event) {
        const target = event.target;
        if (target.matches('[data-font-files]')) {
            this.enqueue(target.files);
            target.value = '';
            return;
        }
        if (target.dataset.uploadFamily) {
            const q = this.queue.find((item) => item.id === target.dataset.uploadFamily);
            if (q) {
                q.family = target.value.trim() || q.result.meta.family;
                AppState.notify('fonts');
            }
        }
    },

    onClick(event) {
        const themed = event.target.closest('[data-action="fonts-preview-mode"]');
        if (themed) return AppState.updateUi({ fontsPreviewMode: themed.dataset.value });
        const pick = event.target.closest('[data-google]');
        if (pick) return this.selectGoogle(pick.dataset.google);
        const action = event.target.closest('[data-action]');
        if (!action) return;
        const { font, key, value, extra } = action.dataset;
        switch (action.dataset.action) {
            case 'goto': AppState.updateUi({ fontsView: value }); break;
            case 'font-remove': this.removeFont(extra); break;
            case 'face-toggle': this.toggleGoogleFace(font, key); break;
            case 'face-remove': this.removeLocalFace(font, key); break;
            case 'google-toggle':
                if (this.selected.keys.has(key)) this.selected.keys.delete(key);
                else this.selected.keys.add(key);
                AppState.notify('fonts');
                break;
            case 'google-add': this.addGoogle(); break;
            case 'upload-remove': this.removeQueued(extra); break;
            case 'upload-clear':
                for (const q of this.queue) FontLoader.dropPreview(`queue:${q.id}`);
                this.queue = [];
                AppState.notify('fonts');
                break;
            case 'upload-add': this.addUploads(); break;
            default: break;
        }
    },

    /** New search or category: new list, so it starts at the top. */
    refreshResults() {
        const el = document.getElementById('fontResults');
        if (!el) return;
        el.innerHTML = this.resultsHtml();
        el.scrollTop = 0;
        this.resultsScroll = 0;
        this.observeResults(el);
    },

    /** Load a family's glyphs only once its row scrolls into view. */
    observeResults(root) {
        this.observer?.disconnect();
        this.observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                FontLoader.preview(entry.target.dataset.google);
                this.observer.unobserve(entry.target);
            }
        }, { root, rootMargin: '200px' });
        root.querySelectorAll('[data-google]').forEach((row) => this.observer.observe(row));
    },

    afterRender(control) {
        const results = control.querySelector('#fontResults');
        if (results) {
            // Picking a family re-renders the panel; the list stays where it was.
            results.scrollTop = this.resultsScroll;
            results.addEventListener('scroll', () => { this.resultsScroll = results.scrollTop; }, { passive: true });
            this.observeResults(results);
        }
        const drop = control.querySelector('[data-font-drop]');
        if (drop && !drop.dataset.bound) {
            drop.dataset.bound = '1';
            drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('is-hot'); });
            drop.addEventListener('dragleave', () => drop.classList.remove('is-hot'));
            drop.addEventListener('drop', (event) => {
                event.preventDefault();
                drop.classList.remove('is-hot');
                this.enqueue(event.dataTransfer?.files || []);
            });
        }
    }
};

export default FontsModule;
