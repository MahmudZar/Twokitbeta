/**
 * ProjectModule
 *
 * Handles entire-project import / export (.twokit files) and
 * auto-persists the working project to localStorage so a
 * refresh does not lose configuration.
 *
 * A .twokit project is a JSON document with shape:
 *   {
 *     "$schema": "twokit/project",
 *     "version": 1,
 *     "meta":    { name, author, notes, savedAt, app: "twokit" },
 *     "state":   { colors, typography, spacing, surface, layout }
 *   }
 *
 * @module projectModule
 */

import AppState from '../state/appState.js';
import Notifications from '../ui/notifications.js';
import ColorModule from './colorModule.js';
import TypographyModule from './typographyModule.js';
import SpacingModule from './spacingModule.js';
import SurfaceModule from './surfaceModule.js';
import LayoutModule from './layoutModule.js';

const STORAGE_KEY   = 'twokit-project-autosave';
const META_KEY      = 'twokit-project-meta';
const SCHEMA_ID     = 'twokit/project';
const SCHEMA_VERSION = 1;

const ProjectModule = {
    meta: {
        name: 'Untitled Project',
        author: '',
        notes: ''
    },

    /** Full init kept for standalone use; main.js drives the pieces individually. */
    init() {
        this.loadMeta();
        this.restoreAutosave();
        this.bindUI();
        this.subscribeAutosave();
        this.renderSummary();
        this.syncMetaInputs();
    },

    /* ---------------------------------------------------------
     * UI BINDING
     * ------------------------------------------------------- */
    bindUI() {
        const fileInput = document.getElementById('projectFileInput');
        const trigger = () => fileInput?.click();

        const bindClick = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);

        bindClick('exportProjectBtn', () => this.exportProject());
        bindClick('exportProjectFileBtn', () => this.exportProject());
        bindClick('projectSaveTopBtn', () => this.exportProject());
        bindClick('projectExportBtn', () => this.exportProject());

        bindClick('importProjectBtn', trigger);
        bindClick('importProjectFileBtn', trigger);
        bindClick('projectImportBtn', trigger);
        bindClick('projectImportTopBtn', trigger);

        bindClick('goExportTopBtn', () => {
            document.querySelector('[data-tab="export"]')?.click();
        });

        bindClick('projectResetBtn', () => {
            if (confirm('Reset everything to defaults? This will clear all current configuration.')) {
                this.reset();
            }
        });

        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) this.importFromFile(file);
            e.target.value = '';
        });

        // Dropzone
        const dropzone = document.getElementById('projectDropzone');
        if (dropzone) {
            dropzone.addEventListener('click', trigger);
            dropzone.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger(); }
            });
            ['dragenter', 'dragover'].forEach(ev => {
                dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
            });
            ['dragleave', 'drop'].forEach(ev => {
                dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); });
            });
            dropzone.addEventListener('drop', (e) => {
                const file = e.dataTransfer?.files?.[0];
                if (file) this.importFromFile(file);
            });
        }

        // Meta inputs
        const nameInput   = document.getElementById('projectName');
        const authorInput = document.getElementById('projectAuthor');
        const notesInput  = document.getElementById('projectNotes');

        nameInput?.addEventListener('input', (e) => { this.meta.name = e.target.value || 'Untitled Project'; this.persistMeta(); this.updateChip(); });
        authorInput?.addEventListener('input', (e) => { this.meta.author = e.target.value; this.persistMeta(); });
        notesInput?.addEventListener('input', (e) => { this.meta.notes = e.target.value; this.persistMeta(); });

        // Keyboard shortcut: Ctrl/Cmd+S to save project
        window.addEventListener('keydown', (e) => {
            const meta = e.ctrlKey || e.metaKey;
            if (meta && e.key.toLowerCase() === 's') {
                e.preventDefault();
                this.exportProject();
            }
        });
    },

    /* ---------------------------------------------------------
     * META
     * ------------------------------------------------------- */
    loadMeta() {
        try {
            const raw = localStorage.getItem(META_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.meta = { ...this.meta, ...parsed };
            }
        } catch (e) { /* ignore */ }
    },

    persistMeta() {
        try { localStorage.setItem(META_KEY, JSON.stringify(this.meta)); } catch (e) {}
    },

    syncMetaInputs() {
        const n = document.getElementById('projectName');
        const a = document.getElementById('projectAuthor');
        const notes = document.getElementById('projectNotes');
        if (n) n.value = this.meta.name;
        if (a) a.value = this.meta.author;
        if (notes) notes.value = this.meta.notes;
        this.updateChip();
    },

    updateChip() {
        const label = document.getElementById('projectChipLabel');
        if (label) label.textContent = this.meta.name || 'Untitled Project';
    },

    /* ---------------------------------------------------------
     * AUTOSAVE
     * ------------------------------------------------------- */
    subscribeAutosave() {
        let scheduled = null;
        AppState.subscribe(() => {
            if (scheduled) cancelAnimationFrame(scheduled);
            scheduled = requestAnimationFrame(() => {
                this.autoSave();
                this.renderSummary();
            });
        });
    },

    autoSave() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.buildSnapshot()));
        } catch (e) { /* quota etc. */ }
    },

    restoreAutosave() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            this.applySnapshot(data, { silent: true });
        } catch (e) {
            console.warn('[TwoKit] Failed to restore autosave:', e);
        }
    },

    /* ---------------------------------------------------------
     * SNAPSHOT BUILDING / APPLYING
     * ------------------------------------------------------- */
    buildSnapshot() {
        return {
            $schema: SCHEMA_ID,
            version: SCHEMA_VERSION,
            meta: {
                ...this.meta,
                savedAt: new Date().toISOString(),
                app: 'twokit',
                appVersion: '1.1.0'
            },
            state: {
                colors:     JSON.parse(JSON.stringify(AppState.colors)),
                typography: JSON.parse(JSON.stringify(AppState.typography)),
                spacing:    JSON.parse(JSON.stringify(AppState.spacing)),
                surface:    JSON.parse(JSON.stringify(AppState.surface)),
                layout:     JSON.parse(JSON.stringify(AppState.layout))
            }
        };
    },

    validateSnapshot(data) {
        if (!data || typeof data !== 'object') return 'File is empty or invalid JSON.';
        if (data.$schema && data.$schema !== SCHEMA_ID) return `Unknown schema: ${data.$schema}`;
        if (!data.state || typeof data.state !== 'object') return 'Missing "state" block.';
        const req = ['colors', 'typography', 'spacing', 'surface', 'layout'];
        for (const key of req) {
            if (!(key in data.state)) return `Missing state.${key}`;
        }
        return null;
    },

    applySnapshot(data, { silent = false } = {}) {
        const err = this.validateSnapshot(data);
        if (err) {
            if (!silent) Notifications.error(err);
            return false;
        }

        if (data.meta) {
            this.meta = {
                name:   data.meta.name   || 'Untitled Project',
                author: data.meta.author || '',
                notes:  data.meta.notes  || ''
            };
            this.persistMeta();
            this.syncMetaInputs();
        }

        const s = data.state;
        if (Array.isArray(s.colors))     AppState.colors     = s.colors;
        if (s.typography)                 AppState.typography = { ...AppState.typography, ...s.typography };
        if (s.spacing)                    AppState.spacing    = { ...AppState.spacing, ...s.spacing };
        if (s.surface)                    AppState.surface    = { ...AppState.surface, ...s.surface };
        if (s.layout)                     AppState.layout     = { ...AppState.layout, ...s.layout };

        // Refresh all modules
        try {
            ColorModule.render?.();
            if (AppState.colors && AppState.colors.length) {
                for (const c of AppState.colors) {
                    ColorModule.regenerateShades?.(c.id, c.baseColor);
                }
            }
            TypographyModule.syncInputsFromState?.();
            TypographyModule.generateScale?.();
            SpacingModule.syncInputsFromState?.();
            SpacingModule.generateScales?.();
            SurfaceModule.syncInputsFromState?.();
            SurfaceModule.generateScale?.();
            LayoutModule.syncInputsFromState?.();
            LayoutModule.generateLayout?.();
        } catch (e) {
            console.warn('[TwoKit] Post-import refresh warning:', e);
        }

        AppState.notify('project');
        this.renderSummary();

        if (!silent) Notifications.success(`Loaded project: ${this.meta.name}`);
        return true;
    },

    /* ---------------------------------------------------------
     * FILE IO
     * ------------------------------------------------------- */
    exportProject() {
        const snap = this.buildSnapshot();
        const text = JSON.stringify(snap, null, 2);
        const filename = `${slugify(this.meta.name || 'project')}.twokit`;
        downloadFile(text, filename, 'application/json');
        Notifications.success(`Project "${this.meta.name}" exported`);
    },

    importFromFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                this.applySnapshot(data, { silent: false });
            } catch (e) {
                Notifications.error('Invalid .twokit file — could not parse JSON.');
            }
        };
        reader.onerror = () => Notifications.error('Failed to read file.');
        reader.readAsText(file);
    },

    /* ---------------------------------------------------------
     * RESET
     * ------------------------------------------------------- */
    reset() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(META_KEY);
        } catch (e) {}
        window.location.reload();
    },

    /* ---------------------------------------------------------
     * SUMMARY
     * ------------------------------------------------------- */
    renderSummary() {
        const el = document.getElementById('projectSummary');
        if (!el) return;

        const palettes  = AppState.colors?.length ?? 0;
        const totalShades = AppState.colors?.reduce((a, c) => a + (c.shades?.length || 0), 0) ?? 0;
        const typeScale = AppState.typography?.scale;
        const fluidN    = AppState.spacing?.fluidScale?.length || 0;
        const fixedN    = AppState.spacing?.fixedScale?.length || 0;
        const grayN     = AppState.surface?.scale?.length || 0;

        const item = (label, value) => `
            <div class="token-item" style="justify-content:space-between">
                <span style="font-size:12px;color:var(--app-text-secondary)">${label}</span>
                <span class="mono" style="font-size:12px;color:var(--app-text)">${value}</span>
            </div>`;

        el.innerHTML = `
            ${item('Palettes', `${palettes}`)}
            ${item('Total Shades', `${totalShades}`)}
            ${item('Type Sizes', `${typeScale ? (typeScale.headings?.length || 0) + (typeScale.body?.length || 0) + (typeScale.textSizes?.length || 0) : 0}`)}
            ${item('Fluid Spacing', `${fluidN}`)}
            ${item('Fixed Spacing', `${fixedN}`)}
            ${item('Gray Steps', `${grayN}`)}
            ${item('Saved Locally', new Date().toLocaleTimeString())}
        `;
    }
};

/* ---------------------------------------------------------
 * Helpers
 * ------------------------------------------------------- */
function slugify(str) {
    return String(str)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'project';
}

function downloadFile(content, filename, mime = 'application/octet-stream') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export default ProjectModule;
