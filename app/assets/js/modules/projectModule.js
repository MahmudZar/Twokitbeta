import AppState from '../state/appState.js';
import Notifications from '../ui/notifications.js';
import ColorModule from './colorModule.js';
import TypographyModule from './typographyModule.js';
import { HEADING_LINE_HEIGHT, TEXT_LINE_HEIGHT, LEGACY_LINE_HEIGHTS } from '../core/typographyCalculator.js';
import SpacingModule from './spacingModule.js';
import SurfaceModule from './surfaceModule.js';
import LayoutModule from './layoutModule.js';
import FontStore, { base64ToBytes } from '../core/fontStore.js';
import { fontSlug } from '../state/fontModel.js';
import { styleGuideName } from './exportModule.js';
import Platform from '../platform.js';
import { createZip } from '../core/zip.js';
import { readZip, isZip } from '../core/unzip.js';
import { sanitizeState, sanitizeMeta } from '../core/projectGuard.js';
import { migrateLink } from '../core/buttonsCss.js';

const store = Platform.storage;

const STORAGE_KEY = 'twokit-project-autosave';
const META_KEY = 'twokit-project-meta';
const UI_KEY = 'twokit-ui';
const SCHEMA_ID = 'twokit/project';

/** A project file: one zip with project.json and the uploaded fonts as real files. */
const PROJECT_JSON = 'project.json';
const FONT_FILE = /^fonts\/[\w.-]+\.(woff2|woff|ttf|otf)$/i;
const MAX_FILE = 80 * 1024 * 1024; // a project file, fonts included
const MAX_JSON = 4 * 1024 * 1024; // project.json alone

/** Font files TwoKit accepts back (WOFF2, WOFF, TrueType, OpenType). */
const isFontBytes = (b) => b instanceof Uint8Array && b.length > 12 && (
    (b[0] === 0x77 && b[1] === 0x4f && b[2] === 0x46 && (b[3] === 0x32 || b[3] === 0x46)) // wOF2 / wOFF
    || (b[0] === 0x00 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00) // TrueType
    || (b[0] === 0x4f && b[1] === 0x54 && b[2] === 0x54 && b[3] === 0x4f) // OTTO
    || (b[0] === 0x74 && b[1] === 0x72 && b[2] === 0x75 && b[3] === 0x65)); // 'true'

/** What "reset" means here. The WordPress and Figma hosts replace it (resetWith). */
const WEB_RESET = {
    title: 'Reset to defaults',
    body: 'Clears colors, fonts, type, spacing and theme settings in this browser. Export the project first if you may need it: this can’t be undone.',
    button: 'Reset to defaults',
    confirm: 'Reset everything to defaults?\n\nThis clears colors, fonts, type, spacing and theme settings, and can’t be undone. Export a .twokit.zip copy first if you may need it.',
    run: null
};

const ProjectModule = {
    meta: { name: 'Untitled project', author: '', notes: '' },

    loadMeta() {
        try {
            const raw = store.getItem(META_KEY);
            if (raw) this.meta = { ...this.meta, ...JSON.parse(raw) };
        } catch { /* ignore */ }
    },

    persistMeta() {
        try { store.setItem(META_KEY, JSON.stringify(this.meta)); } catch { /* ignore */ }
    },

    /** Puts the saved name, author and notes into whichever fields are on screen (header, Project screen). */
    syncMetaInputs() {
        const header = document.getElementById('projectName');
        if (header) header.value = this.meta.name;
        const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
        set('pjName', this.meta.name === 'Untitled project' ? '' : this.meta.name);
        set('pjAuthor', this.meta.author);
        set('pjNotes', this.meta.notes);
    },

    bindUI() {
        document.querySelector('.header').addEventListener('click', (event) => {
            const id = event.target.closest('button')?.id;
            if (id === 'importProjectBtn') this.openImport();
            // Export opens the Export screen on the TwoKit project file (every host); the
            // other destinations are one click away there.
            if (id === 'exportProjectBtn') AppState.updateUi({ section: 'export', exportTarget: 'twokit' });
        });

        // The file input is driven by the import dialog (openImport).

        document.getElementById('projectName')?.addEventListener('input', (event) => {
            this.setName(event.target.value);
        });

        window.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                this.exportProject();
            }
        });
    },

    subscribeAutosave() {
        // rAF doesn't run in hidden tabs; save on the way out as well.
        window.addEventListener('pagehide', () => this.autoSave());
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.autoSave(); });
        let frame = null;
        AppState.subscribe(() => {
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                this.autoSave();
                this.renderSummary();
            });
        });
    },

    autoSave() {
        try {
            store.setItem(STORAGE_KEY, JSON.stringify(this.buildSnapshot()));
            this.lastSaveOk = true;
        } catch {
            this.lastSaveOk = false; // storage full or blocked: the Project screen says so
        }
        this.saveUi();
    },

    /**
     * Workspace preferences (screen, views, preview mode, example theme and
     * layout, color format). Not part of the project file: they belong to
     * this browser, not the design system.
     */
    saveUi() {
        const ui = { colorFormat: AppState.colorFormat };
        for (const [key, value] of Object.entries(AppState.ui)) {
            if (['string', 'boolean', 'number'].includes(typeof value)) ui[key] = value;
        }
        try { store.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* quota */ }
    },

    loadUi() {
        let saved;
        try { saved = JSON.parse(store.getItem(UI_KEY) || 'null'); } catch { return; }
        if (!saved || typeof saved !== 'object') return;
        if (typeof saved.colorFormat === 'string') AppState.colorFormat = saved.colorFormat;
        for (const [key, value] of Object.entries(saved)) {
            if (key === 'colorFormat' || !['string', 'boolean', 'number'].includes(typeof value)) continue;
            // Known keys keep their type; views added later (buttonEditMode …) are free-form.
            if (key in AppState.ui && typeof AppState.ui[key] !== typeof value) continue;
            AppState.ui[key] = value;
        }
    },

    restoreAutosave() {
        try {
            const raw = store.getItem(STORAGE_KEY);
            if (!raw) return;
            this.applySnapshot(JSON.parse(raw), { silent: true });
        } catch (error) {
            console.warn('[TwoKit] Failed to restore autosave:', error);
        }
    },

    buildSnapshot() {
        return {
            $schema: SCHEMA_ID,
            version: 2,
            meta: { ...this.meta, savedAt: new Date().toISOString(), app: 'twokit', appVersion: '2.0.0' },
            state: AppState.getExportState()
        };
    },

    applySnapshot(data, { silent = false } = {}) {
        if (!data?.state) {
            if (!silent) Notifications.error('Missing project state.');
            return false;
        }
        // A project file is outside data: every value is checked before it is
        // used (core/projectGuard.js). Values that fail are dropped and the
        // app's defaults apply; palettes get a strict shape and fresh shades.
        const meta = sanitizeMeta(data.meta);
        if (meta) {
            this.meta = {
                name: meta.name || 'Untitled project',
                author: meta.author,
                notes: meta.notes
            };
            this.persistMeta();
            this.syncMetaInputs();
        }
        const s = sanitizeState(data.state);
        if (Array.isArray(s.colors)) AppState.colors = s.colors;
        if (Array.isArray(s.stateColors)) AppState.stateColors = s.stateColors;
        // Prefixes: keep saved ones (strings only), default to none.
        const prefixes = { color: '', type: '', spacing: '', surface: '' };
        for (const key of Object.keys(prefixes)) {
            const value = s.prefixes?.[key];
            if (typeof value === 'string') prefixes[key] = value.trim().replace(/[^a-z0-9-]/gi, '');
        }
        AppState.prefixes = prefixes;
        this.applyFonts(s);
        if (s.typography) {
            // Projects saved before 1.0.6 can carry a scale nested in itself (see
            // TypographyCalculator.generateScale); keep only the top level.
            if (s.typography.scale?.settings) delete s.typography.scale.settings.scale;
            AppState.typography = {
                ...AppState.typography,
                ...s.typography,
                scaleSteps: s.typography.scaleSteps || AppState.typography.scaleSteps,
                baseScaleIndex: Number.isInteger(s.typography.baseScaleIndex)
                    ? s.typography.baseScaleIndex
                    : AppState.typography.baseScaleIndex,
                headingSteps: { ...AppState.typography.headingSteps, ...s.typography.headingSteps },
                // Projects saved before auto/manual existed: custom sizes mean manual.
                headingMode: s.typography.headingMode
                    || (Object.keys(s.typography.headingOverrides || {}).length ? 'manual' : 'auto'),
                headingFont: s.typography.headingFont || AppState.typography.headingFont,
                bodyFont: s.typography.bodyFont || AppState.typography.bodyFont,
                bodyLetterSpacing: s.typography.bodyLetterSpacing ?? '0em'
            };
            delete AppState.typography.fontFamily;
            // Old default line heights → the current ones (custom values are kept).
            const t = AppState.typography;
            if (t.headingLineHeight === LEGACY_LINE_HEIGHTS.heading) t.headingLineHeight = HEADING_LINE_HEIGHT;
            if (t.bodyLineHeight === LEGACY_LINE_HEIGHTS.text) t.bodyLineHeight = TEXT_LINE_HEIGHT;
        }
        if (s.spacing) {
            const defaultFluid = { ...AppState.spacing.fluid };
            // Fluid spacing is always exported; older projects may carry `false`.
            AppState.spacing = { ...AppState.spacing, ...s.spacing, enableFluidSpacing: true };
            if (s.spacing.fluid) {
                const fluid = s.spacing.fluid;
                const legacy = Number(fluid.spacingScaleRatio);
                AppState.spacing.fluid = {
                    ...defaultFluid,
                    ...fluid,
                    mobileSpacingScaleRatio: Number(fluid.mobileSpacingScaleRatio) || legacy || 1.25,
                    desktopSpacingScaleRatio: Number(fluid.desktopSpacingScaleRatio) || legacy || 1.414,
                    steps: fluid.steps || defaultFluid.steps,
                    baseScaleIndex: Number.isInteger(fluid.baseScaleIndex) ? fluid.baseScaleIndex : defaultFluid.baseScaleIndex
                };
            }
        }
        // Surface: tint, whether the hue follows primary, and its own base color when it doesn't.
        const tint = Number(s.surface?.tint);
        const base = String(s.surface?.base || '');
        AppState.surface = {
            tint: Number.isFinite(tint) ? Math.min(0.03, Math.max(0, tint)) : 0.012,
            linked: typeof s.surface?.linked === 'boolean' ? s.surface.linked : true,
            base: /^#[0-9a-f]{6}$/i.test(base) ? base.toUpperCase() : (AppState.colors[0]?.baseColor || '#B0C540')
        };
        if (s.buttons) {
            const cur = AppState.buttons;
            // The link's old style field is read before the defaults fill in link.style.
            const saved = { ...s.buttons, link: s.buttons.link && migrateLink(s.buttons.link) };
            AppState.buttons = Object.fromEntries(Object.keys(cur).map((k) => [k, { ...cur[k], ...saved[k] }]));
        }
        if (s.utilities?.groups) AppState.utilities = { groups: { ...AppState.utilities.groups, ...s.utilities.groups } };
        if (s.styling) {
            const cur = AppState.styling;
            AppState.styling = {
                focus: { ...cur.focus, ...s.styling.focus },
                transition: { ...cur.transition, ...s.styling.transition },
                radius: { ...cur.radius, ...s.styling.radius },
                selection: { ...cur.selection, ...s.styling.selection }
            };
        }
        if (s.layout) {
            // Older projects stored a single `gridGap` token; gaps now follow the spacing scale.
            const { gridGap, ...layout } = s.layout;
            AppState.layout = {
                ...AppState.layout,
                ...layout,
                gaps: { ...AppState.layout.gaps, ...layout.gaps },
                header: { ...AppState.layout.header, ...layout.header }
            };
        }
        if (s.theme) AppState.theme = migrateTheme(s.theme, AppState.theme);
        if (s.exportPrefs?.bricks) AppState.exportPrefs = { bricks: migrateBricksPrefs(s.exportPrefs.bricks, AppState.exportPrefs.bricks) };
        for (const key of ['headingColor', 'bodyColor']) {
            const value = AppState.typography[key];
            if (typeof value === 'string') AppState.typography[key] = value.replace(/var\(--(text-[a-z]+)-(?:light|dark)\)/g, 'var(--$1)');
        }

        ColorModule.ensureShades?.();
        TypographyModule.generateScale?.();
        SpacingModule.generateScales?.();
        SurfaceModule.init?.();
        LayoutModule.generate?.();
        AppState.notify('project');
        if (!silent) Notifications.success(`Loaded ${this.meta.name}`);
        return true;
    },

    /**
     * Font library from a snapshot. Projects saved before the library had one
     * `typography.fontFamily`; it becomes a Google font used by both roles.
     */
    applyFonts(s) {
        if (Array.isArray(s.fonts)) {
            AppState.fonts = s.fonts;
            return;
        }
        const legacy = String(s.typography?.fontFamily || '').split(',')[0].replace(/['"]/g, '').trim();
        if (!legacy || ['system-ui', 'sans-serif', 'serif', 'monospace', 'inherit'].includes(legacy)) return;
        const id = fontSlug(legacy);
        AppState.fonts = [{
            id,
            family: legacy,
            source: 'google',
            category: 'sans-serif',
            display: 'swap',
            faces: ['400', '500', '600', '700'].map((key) => ({ key, weight: Number(key), style: 'normal' }))
        }];
        if (s.typography) {
            s.typography.headingFont ||= id;
            s.typography.bodyFont ||= id;
        }
    },

    /**
     * The project as one .twokit.zip: project.json, and every uploaded font as
     * its own file under fonts/ (project.json maps each font face to its file).
     * Google fonts are named, not shipped: exports download them when needed.
     */
    async exportProject() {
        const snapshot = this.buildSnapshot();
        const files = [];
        const fontFiles = {};
        try {
            let n = 0;
            for (const font of AppState.fonts) {
                for (const face of font.faces) {
                    if (!face.fileId || fontFiles[face.fileId]) continue;
                    const bytes = await FontStore.get(face.fileId);
                    if (!bytes) continue;
                    const ext = String(face.format || 'woff2').replace(/[^a-z0-9]/gi, '') || 'woff2';
                    const path = `fonts/${++n}-${fontSlug(font.family) || 'font'}-${String(face.key).replace(/[^\w-]/g, '')}.${ext}`;
                    fontFiles[face.fileId] = path;
                    files.push({ path, content: bytes });
                }
            }
        } catch (error) {
            console.warn('[TwoKit] Could not read font files:', error);
            Notifications.error('Exported without uploaded font files');
        }
        if (Object.keys(fontFiles).length) snapshot.fontFiles = fontFiles;
        files.unshift({ path: PROJECT_JSON, content: JSON.stringify(snapshot, null, 2) });
        download(createZip(files), this.fileName(), 'application/zip');
        Notifications.success(`Exported ${this.meta.name}`);
    },

    /**
     * Opens a project file: a .twokit.zip, or an older .twokit.json (fonts as
     * base64). Everything is checked before it replaces the current project:
     * size limits, the zip's own limits (core/unzip.js), the project schema,
     * and fonts must be real font files. Returns true when it was opened.
     */
    async importFromFile(file) {
        if (!file) return false;
        if (file.size > MAX_FILE) {
            Notifications.error('That file is too large for a TwoKit project.');
            return false;
        }
        let data;
        const fonts = new Map();
        try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            if (isZip(bytes)) {
                const entries = await readZip(bytes, (name) => name === PROJECT_JSON || FONT_FILE.test(name));
                const json = entries.get(PROJECT_JSON);
                if (!json) throw new Error('This zip is not a TwoKit project (no project.json).');
                if (json.length > MAX_JSON) throw new Error('project.json is too large.');
                data = JSON.parse(new TextDecoder().decode(json));
                for (const [fileId, path] of Object.entries(data?.fontFiles || {})) {
                    if (typeof path === 'string' && entries.has(path)) fonts.set(fileId, entries.get(path));
                }
            } else {
                data = JSON.parse(new TextDecoder().decode(bytes));
                for (const [fileId, base64] of Object.entries(data?.fontFiles || {})) {
                    if (typeof base64 === 'string') fonts.set(fileId, base64ToBytes(base64));
                }
            }
        } catch (error) {
            Notifications.error(error instanceof SyntaxError ? 'That file is not a TwoKit project.' : error.message);
            return false;
        }
        if (!data || data.$schema !== SCHEMA_ID || typeof data.state !== 'object') {
            Notifications.error('That file is not a TwoKit project.');
            return false;
        }
        delete data.fontFiles;
        let skipped = 0;
        for (const [fileId, bytes] of fonts) {
            if (typeof fileId !== 'string' || fileId.length > 200 || !isFontBytes(bytes)) { skipped++; continue; }
            try { await FontStore.put(fileId, bytes); } catch (error) { console.warn('[TwoKit] Could not restore a font:', error); skipped++; }
        }
        if (this.applySnapshot(data) === false) return false;
        if (skipped) Notifications.error(`Opened · ${skipped} font file${skipped === 1 ? '' : 's'} could not be restored`);
        else Notifications.success(`Opened ${this.meta.name}${Platform.is('wordpress') ? ' · Save to apply it to your site' : ''}`);
        return true;
    },

    /* ---------------- import dialog ---------------- */

    openImport() {
        document.querySelector('.pj-modal')?.remove();
        const note = Platform.is('wordpress') ? ' Nothing changes on your site until you Save.'
            : Platform.is('figma') ? ' Apply to Figma afterwards to update this file.' : '';
        const el = document.createElement('div');
        el.className = 'pj-modal';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-labelledby', 'pjImportTitle');
        el.innerHTML = `
          <div class="pj-modal__panel">
            <header class="pj-modal__head">
              <h2 id="pjImportTitle">Import a TwoKit project</h2>
              <button type="button" class="pj-modal__close" data-act="close" aria-label="Close">×</button>
            </header>
            <p class="pj-modal__text">Choose a <b>.twokit.zip</b> exported from TwoKit (web app, WordPress or Figma). Older <b>.twokit.json</b> files work too. It replaces the current project, uploaded fonts included.${note}</p>
            <div class="pj-drop pj-modal__drop" data-drop>
              <span class="pj-drop__icon">${PJ.upload}</span>
              <span class="pj-drop__text"><b>Drop the project file here</b><small>.twokit.zip or .twokit.json</small></span>
              <button type="button" class="pj-browse" data-act="browse">${PJ.folder}<span>Browse files</span></button>
            </div>
          </div>`;
        const close = () => {
            el.remove();
            document.removeEventListener('keydown', onKey, true);
        };
        const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } };
        const open = async (file) => { if (await this.importFromFile(file)) close(); };
        el.addEventListener('click', (event) => {
            if (event.target === el) return close();
            const act = event.target.closest('[data-act]')?.dataset.act;
            if (act === 'close') close();
            if (act === 'browse') {
                const input = document.getElementById('projectFileInput');
                input.onchange = () => { const f = input.files?.[0]; input.value = ''; input.onchange = null; if (f) open(f); };
                input.click();
            }
        });
        const drop = el.querySelector('[data-drop]');
        drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('is-hot'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('is-hot'));
        drop.addEventListener('drop', (event) => {
            event.preventDefault();
            drop.classList.remove('is-hot');
            open(event.dataTransfer?.files?.[0]);
        });
        document.addEventListener('keydown', onKey, true);
        document.body.append(el);
        el.querySelector('[data-act="browse"]').focus();
    },

    /* ---------------- reset ---------------- */

    /** The WordPress and Figma hosts set their own reset (what it removes, and how). */
    resetWith(options) {
        this.resetOptions = { ...WEB_RESET, ...options };
        if (AppState.ui.section === 'project') AppState.notify('project');
    },

    async runReset() {
        const r = this.resetOptions || WEB_RESET;
        if (!confirm(r.confirm)) return;
        if (r.run) await r.run();
        else this.reset();
    },

    reset() {
        store.removeItem(STORAGE_KEY);
        store.removeItem(META_KEY);
        store.removeItem(UI_KEY);
        window.location.reload();
    },

    /** Keeps the Project screen's overview tiles and save status current (called after each autosave). */
    renderSummary() {
        const grid = document.getElementById('projectOverview');
        if (grid) grid.innerHTML = this.overviewMarkup();
        document.querySelectorAll('[data-pj-status]').forEach((el) => { el.innerHTML = this.statusMarkup(); });
    },

    /** Overview tiles: [key, value, label, icon, go-to { section, ui }]. */
    overviewTiles() {
        const t = AppState.typography;
        const palettes = AppState.colors.length + AppState.stateColors.length;
        const shades = [...AppState.colors, ...AppState.stateColors].reduce((sum, color) => sum + (color.shades?.length || 0), 0);
        const typeCount = (t.scale?.headings?.length || 0) + (t.scale?.textSizes?.length || 0) + (t.enableBodySizes !== false ? t.scale?.body?.length || 0 : 0);
        const fixed = AppState.spacing.enableFixedSpacing ? AppState.spacing.fixedScale?.length || 0 : 0;
        const mode = { auto: 'Auto', light: 'Light', dark: 'Dark' }[AppState.theme.defaultMode] || 'Auto';
        return [
            ['palettes', palettes, 'Palettes', PJ.palette, { section: 'colors', colorsView: 'brand' }],
            ['shades', shades, 'Shades', PJ.layers, { section: 'colors', colorsView: 'brand' }],
            ['fonts', AppState.fonts.length, AppState.fonts.length === 1 ? 'Font' : 'Fonts', PJ.type, { section: 'fonts' }],
            ['type', typeCount, 'Type sizes', PJ.text, { section: 'typography' }],
            ['fluid', AppState.spacing.fluidScale?.length || 0, 'Fluid spacing', PJ.fluid, { section: 'spacing', spacingView: 'fluid' }],
            ['fixed', fixed, 'Fixed spacing', PJ.ruler, { section: 'spacing', spacingView: 'fixed' }],
            ['tint', Number(AppState.surface.tint || 0).toFixed(3), 'Surface tint', PJ.droplet, { section: 'surface' }],
            ['mode', mode, 'Theme mode', PJ.contrast, { section: 'theming' }]
        ];
    },

    overviewMarkup() {
        return this.overviewTiles().map(([key, value, label, icon, go]) => {
            const empty = value === 0 || value === '0.000';
            return `
              <button type="button" class="pj-tile" data-pj-go="${escapeAttr(JSON.stringify(go))}" data-fid="pj-tile-${key}" aria-label="${escapeAttr(`${value} ${label}: open ${go.section}`)}">
                <span class="ex-tile">${icon}</span>
                <span class="pj-tile__text"><b class="${empty ? 'is-empty' : ''}">${escapeAttr(value)}</b><small>${escapeAttr(label)}</small></span>
                <span class="pj-tile__chev">${PJ.chev}</span>
              </button>`;
        }).join('');
    },

    /** Name as typed, for display ("Untitled project" when empty). */
    displayName() {
        return String(this.meta.name || '').trim() || 'Untitled project';
    },

    /** Project file name: the name with characters no OS accepts removed. */
    fileName() {
        const base = this.displayName().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 80);
        return `${base || 'Untitled project'}.twokit.zip`;
    },

    /** Save-status pill: saved in this browser, or why not. */
    statusMarkup() {
        const ok = this.lastSaveOk !== false;
        return ok
            ? `<span class="pj-status" role="status" title="Saved automatically in this browser. Save a .twokit.zip file to keep a copy anywhere.">${PJ.check}<span>All changes saved</span></span>`
            : `<span class="pj-status pj-status--error" role="status" title="This browser refused to store the project (storage full or blocked). Save a .twokit.zip file now.">${PJ.alert}<span>Not saved in this browser</span></span>`;
    },

    screenMarkup() {
        const field = (id, label, control, hint = '') => `
          <div class="pj-field">
            <label class="pj-label" for="${id}">${label}</label>
            ${control}
            ${hint ? `<p class="pj-hint">${hint}</p>` : ''}
          </div>`;
        return `
          <div class="ex-side">
            <section class="pj-details" aria-labelledby="pjDetailsTitle">
              <header class="ex-intro"><h2 id="pjDetailsTitle">Project details</h2><p>Saved inside your .twokit.zip file</p></header>
              <div class="pj-form">
                ${field('pjName', 'Project name', `<input class="pj-input" id="pjName" data-pj-field="name" data-fid="pjName" value="${escapeAttr(this.meta.name === 'Untitled project' ? '' : this.meta.name)}" placeholder="Untitled project" maxlength="80" spellcheck="false" autocomplete="off">`, 'Also used for the header and your export file names')}
                ${field('pjAuthor', 'Author', `<input class="pj-input" id="pjAuthor" data-pj-field="author" data-fid="pjAuthor" value="${escapeAttr(this.meta.author)}" placeholder="Your name or studio" maxlength="120" autocomplete="off">`)}
                ${field('pjNotes', 'Notes', `<textarea class="pj-input pj-input--area" id="pjNotes" data-pj-field="notes" data-fid="pjNotes" rows="6" placeholder="Client, version, anything you want to remember…">${escapeAttr(this.meta.notes)}</textarea>`)}
              </div>
            </section>
            <section class="pj-danger" aria-labelledby="pjDangerTitle">
              <header class="pj-danger__head">${PJ.reset}<h3 id="pjDangerTitle">${escapeAttr((this.resetOptions || WEB_RESET).title)}</h3></header>
              <p>${escapeAttr((this.resetOptions || WEB_RESET).body)}</p>
              <button type="button" class="pj-danger__btn" data-pj-action="reset" data-fid="pjReset">${escapeAttr((this.resetOptions || WEB_RESET).button)}</button>
            </section>
          </div>`;
    },

    previewMarkup() {
        const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
        return `
          <div class="ex-view" data-ex-view="project">
            <div class="ex-panel">
              <div class="ex-panel__body">
                <header class="ex-head">
                  <div class="ex-head__text"><h2 data-pj-name>${escapeAttr(this.displayName())}</h2><p>Save your work as a .twokit.zip file, or open one to pick up where you left off.</p></div>
                  <span data-pj-status>${this.statusMarkup()}</span>
                </header>
                <section class="ex-section ex-section--top" aria-labelledby="pjOverviewTitle">
                  <header class="ex-section__head"><h3 id="pjOverviewTitle">Overview</h3><p>What this project contains — click a tile to jump to that section</p></header>
                  <div class="pj-grid" id="projectOverview">${this.overviewMarkup()}</div>
                </section>
                <hr class="ex-divider">
                <section class="ex-section" aria-labelledby="pjOpenTitle">
                  <header class="ex-section__head"><h3 id="pjOpenTitle">Open a project</h3><p>Opening a file replaces the current project</p></header>
                  <div class="pj-drop" id="projectDropzone" data-fid="pjDrop">
                    <span class="pj-drop__icon">${PJ.upload}</span>
                    <span class="pj-drop__text"><b>Drop a .twokit.zip file here</b><small>or browse your computer</small></span>
                    <button type="button" class="pj-browse" data-pj-action="browse" data-fid="pjBrowse">${PJ.folder}<span>Browse files</span></button>
                  </div>
                </section>
              </div>
              <footer class="ex-foot">
                <button type="button" class="ex-cta" data-pj-action="save" data-fid="pjSave">${PJ.save}<span>Export project (.twokit.zip)</span><kbd class="pj-kbd">${mac ? '⌘ S' : 'Ctrl S'}</kbd></button>
                <p class="ex-meta"><span data-pj-file>${escapeAttr(this.fileName())}</span>  ·  every setting in one file  ·  import it any time to continue</p>
              </footer>
            </div>
          </div>`;
    },

    /* ---------------- screen contract ---------------- */

    title: 'Project',
    previewModes: false,

    view() {
        return { control: this.screenMarkup(), preview: this.previewMarkup() };
    },

    /** Drag and drop needs its own listeners (the shell only forwards click / input / change). */
    afterRender(control, preview) {
        const drop = preview.querySelector('#projectDropzone');
        if (!drop || drop.dataset.bound) return;
        drop.dataset.bound = '1';
        let depth = 0;
        drop.addEventListener('dragenter', (event) => { event.preventDefault(); depth++; drop.classList.add('is-hot'); });
        drop.addEventListener('dragover', (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
        drop.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) drop.classList.remove('is-hot'); });
        drop.addEventListener('drop', (event) => {
            event.preventDefault();
            depth = 0;
            drop.classList.remove('is-hot');
            const file = event.dataTransfer?.files?.[0];
            if (file) this.importFromFile(file);
        });
    },

    /** Name, author and notes: saved as you type, without re-rendering (keeps focus). */
    onInput(event) {
        const field = event.target.dataset?.pjField;
        if (!field) return;
        if (field === 'name') this.setName(event.target.value);
        else {
            this.meta[field] = event.target.value;
            this.persistMeta();
        }
    },

    /** One place for the name: header field, Project screen, file name and style guide folder. */
    setName(value) {
        const clean = String(value || '').replace(/[\u0000-\u001f]/g, '').slice(0, 80);
        this.meta.name = clean.trim() ? clean : 'Untitled project';
        this.persistMeta();
        const header = document.getElementById('projectName');
        if (header && document.activeElement !== header) header.value = this.meta.name;
        const screen = document.getElementById('pjName');
        if (screen && document.activeElement !== screen) screen.value = this.meta.name === 'Untitled project' ? '' : this.meta.name;
        document.querySelectorAll('[data-pj-name]').forEach((el) => { el.textContent = this.displayName(); });
        document.querySelectorAll('[data-pj-file]').forEach((el) => { el.textContent = this.fileName(); });
        document.querySelectorAll('[data-style-guide-name]').forEach((el) => { el.textContent = styleGuideName(); });
    },

    onClick(event) {
        const go = event.target.closest('[data-pj-go]');
        if (go) {
            try {
                AppState.updateUi(JSON.parse(go.dataset.pjGo));
            } catch { /* malformed tile target */ }
            return;
        }
        const action = event.target.closest('[data-pj-action]')?.dataset.pjAction;
        if (action === 'save') this.exportProject();
        if (action === 'browse') this.openImport();
        if (action === 'reset') this.runReset();
    }
};

/** Line icons for the Project screen (16px, currentColor). */
const pjIcon = (d, size = 16) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const PJ = {
    palette: pjIcon('<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 2-2v-.5a2 2 0 0 1 2-2h2a4 4 0 0 0 4-4A10 10 0 0 0 12 2Z"/>'),
    layers: pjIcon('<path d="m12 2 10 5-10 5L2 7l10-5Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>'),
    type: pjIcon('<path d="M4 7V4h16v3M9 20h6M12 4v16"/>'),
    text: pjIcon('<path d="M17 6H3M21 12H3M15 18H3"/>'),
    fluid: pjIcon('<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>'),
    ruler: pjIcon('<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/>'),
    droplet: pjIcon('<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7Z"/>'),
    contrast: pjIcon('<circle cx="12" cy="12" r="10"/><path d="M12 18a6 6 0 0 0 0-12v12Z"/>'),
    chev: pjIcon('<path d="m9 18 6-6-6-6"/>'),
    check: pjIcon('<path d="M20 6 9 17l-5-5"/>', 14),
    alert: pjIcon('<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>', 14),
    upload: pjIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>', 20),
    folder: pjIcon('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>'),
    save: pjIcon('<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7"/>', 18),
    reset: pjIcon('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>')
};

/** Saved Bricks export rows: known parts only, each once, scopes kept as strings (checked at export time). */
function migrateBricksPrefs(incoming, defaults) {
    const parts = ['variables', 'palette', 'theme', 'classes', 'styleManager', 'settings'];
    const seen = new Set();
    const rows = (Array.isArray(incoming.rows) ? incoming.rows : defaults.rows).filter((row) => {
        if (!row || !parts.includes(row.part) || seen.has(row.part)) return false;
        seen.add(row.part);
        return true;
    }).map((row) => ({ part: row.part, scope: typeof row.scope === 'string' ? row.scope : '' }));
    // Bricks settings arrived later: add it once to older projects; removing it afterwards sticks.
    if (!incoming.settingsOffered && !seen.has('settings')) rows.push({ part: 'settings', scope: 'all' });
    return { rows, settingsOffered: true };
}

/** Old projects stored followSystem / enableThemeColors / enableOpposite. */
function migrateTheme(incoming, defaults) {
    const modes = ['light', 'dark', 'auto'];
    const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
    return {
        defaultMode: modes.includes(incoming.defaultMode) ? incoming.defaultMode : incoming.followSystem ? 'auto' : defaults.defaultMode,
        enableInverse: bool(incoming.enableInverse, defaults.enableInverse),
        enableAliases: bool(incoming.enableAliases, defaults.enableAliases),
        enableClasses: bool(incoming.enableClasses, defaults.enableClasses),
        siteBg: typeof incoming.siteBg === 'string' && incoming.siteBg ? incoming.siteBg : defaults.siteBg
    };
}

function download(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function escapeAttr(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
}

export default ProjectModule;
