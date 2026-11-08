/**
 * Figma host: the TwoKit Figma plugin runs the web app, and "Apply to Figma"
 * turns the project into this file's variables, text styles and shadows
 * (the importer in plugins/figma/code.js, same package as Export → Figma).
 *
 *   Apply     builds the Figma package → the plugin inspects the file →
 *             a short review (new / updated, mode limits, missing fonts) →
 *             import, with progress
 *   Update    once TwoKit has been applied to a file, the button reads
 *             "Update Figma": every variable and style TwoKit made is
 *             updated in place (matched by name), so bound layers follow
 *
 * Messages go through window.TWOKIT_HOST.figma = { send(type, data), on(type, fn) }.
 * The project itself is saved in the Figma file by the host (storage).
 *
 * @module hosts/figma
 */

import Platform from '../platform.js';
import Notifications from '../ui/notifications.js';
import ExportModule from '../modules/exportModule.js';
import { esc } from '../ui/components.js';

const bridge = Platform.host.figma;

import AppState from '../state/appState.js';
import ProjectModule from '../modules/projectModule.js';

const ICON = '<svg viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 7.5 5.5 10.5 11.5 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const FigmaHost = {
    pkg: null,
    busy: false,
    applied: Boolean(bridge.applied),

    /** "Apply" the first time, "Update" once this file has TwoKit variables. */
    label() {
        return this.applied ? 'Update Figma' : 'Apply to Figma';
    },

    init() {
        const actions = document.querySelector('.header__actions');
        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'btn wp-save is-dirty';
        this.button.innerHTML = `${ICON}${this.label()}`;
        this.button.addEventListener('click', () => this.inspect());
        // Changes since the last apply: the button turns green again.
        this.button.classList.toggle('is-dirty', !this.applied);
        queueMicrotask(() => AppState.subscribe((section) => { if (section !== 'ui') this.button.classList.add('is-dirty'); }));
        actions.append(this.button);

        bridge.on('inspection', (report) => this.review(report));
        bridge.on('progress', (p) => this.progress(p));
        bridge.on('done', (report) => this.done(report));
        bridge.on('error', (e) => this.fail(e?.message || 'Import failed'));

        // Project → Reset: in Figma it takes TwoKit out of this file. The plugin closes
        // afterwards; opening it again starts from the defaults.
        ProjectModule.resetWith({
            title: 'Remove TwoKit from this file',
            body: 'Deletes the variables, collections, text styles and effect and color styles TwoKit created in this Figma file, and resets the project to defaults. Layers that used them keep their look but are no longer linked. Your own variables and styles are never touched. Export the project first (.twokit.zip) to keep a copy.',
            button: 'Remove TwoKit from file',
            confirm: 'Remove TwoKit from this file?\n\nThis deletes every variable, collection and style TwoKit created here and resets the project. Layers keep their look but lose the link. The plugin closes when it is done. This can’t be undone.',
            run: () => {
                this.setBusy(true, 'Removing TwoKit…');
                bridge.send('remove-all');
            }
        });
    },

    setBusy(busy, label = '') {
        this.busy = busy;
        this.button.disabled = busy;
        this.button.innerHTML = busy ? `<span class="spinner" aria-hidden="true"></span>${esc(label)}` : `${ICON}${this.label()}`;
    },

    async inspect() {
        if (this.busy) return;
        this.setBusy(true, 'Reading this file…');
        try {
            this.pkg = await ExportModule.figmaPackage();
            bridge.send('inspect', { pkg: this.pkg });
        } catch (error) {
            this.fail(error.message);
        }
    },

    review(report) {
        this.setBusy(false);
        document.querySelector('.wp-setup')?.remove();
        const sum = (items) => items.reduce((n, c) => n + c.count, 0);
        const upd = (items) => items.reduce((n, c) => n + c.update, 0);
        const vars = sum(report.collections);
        const updates = upd(report.collections) + report.textStyles.update + report.effectStyles.update;
        const fresh = vars + report.textStyles.count + report.effectStyles.count - updates;
        const split = report.collections.filter((c) => c.split).map((c) => c.name);
        const missing = report.fonts.filter((f) => f.status !== 'exact');
        const row = (label, value) => `<li><span>${esc(label)}</span><b>${esc(value)}</b></li>`;
        const el = document.createElement('div');
        el.className = 'wp-setup';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-labelledby', 'fgTitle');
        el.innerHTML = `
          <div class="wp-setup__panel wp-setup__panel--narrow">
            <h2 id="fgTitle">${updates ? 'Update this file' : 'Apply to this file'}</h2>
            <p>${updates ? `${updates} variables and styles already in this file get the new values, so layers using them update too.${fresh > 0 ? ` ${fresh} are new.` : ''}` : 'Everything is new in this file.'}</p>
            <ul class="fg-list">
              ${report.collections.map((c) => row(c.name, `${c.count} variables${c.update ? ` (${c.update} updated)` : ''} · ${c.modes.join(' / ')}`)).join('')}
              ${row('Text styles', `${report.textStyles.count}${report.textStyles.update ? ` (${report.textStyles.update} updated)` : ''}`)}
              ${row('Effect styles', `${report.effectStyles.count}${report.effectStyles.update ? ` (${report.effectStyles.update} updated)` : ''}`)}
            </ul>
            ${split.length ? `<p class="fg-note">Your Figma plan allows ${report.modeLimit} mode${report.modeLimit === 1 ? '' : 's'} per collection, so ${esc(split.join(', '))} ${split.length === 1 ? 'is' : 'are'} split into one collection per mode.</p>` : ''}
            ${missing.length ? `<p class="fg-note">Not installed: ${missing.map((f) => esc(f.family)).join(', ')}. The nearest installed font is used; install it and apply again.</p>` : ''}
            <label class="fg-check"><input type="checkbox" data-opt="paintStyles"> Also make color styles</label>
            <label class="fg-check"><input type="checkbox" data-opt="prune"> Remove what TwoKit made earlier and is no longer in the project</label>
            <div class="wp-setup__actions">
              <button type="button" class="btn" data-act="cancel">Cancel</button>
              <button type="button" class="btn wp-save is-dirty" data-act="apply">${updates ? 'Update' : 'Apply'} ${vars} variables</button>
            </div>
          </div>`;
        el.addEventListener('click', (event) => {
            const act = event.target.closest('[data-act]')?.dataset.act;
            if (act === 'cancel') el.remove();
            if (act !== 'apply') return;
            const opt = (name) => el.querySelector(`[data-opt="${name}"]`).checked;
            const options = {
                collections: Object.fromEntries(report.collections.map((c) => [c.id, true])),
                textStyles: true,
                effectStyles: true,
                paintStyles: opt('paintStyles'),
                prune: opt('prune')
            };
            el.remove();
            this.setBusy(true, updates ? 'Updating…' : 'Applying…');
            bridge.send('import', { pkg: this.pkg, options });
        });
        el.addEventListener('keydown', (event) => { if (event.key === 'Escape') el.remove(); });
        document.body.append(el);
        el.querySelector('[data-act="apply"]').focus();
    },

    progress(p) {
        if (!this.busy || !p) return;
        const pct = p.total ? ` ${Math.round((p.done / p.total) * 100)}%` : '';
        this.setBusy(true, `${p.label}${pct}`);
    },

    done(report) {
        this.applied = true;
        this.button.classList.remove('is-dirty');
        this.setBusy(false);
        const made = report.variables.created + report.textStyles.created + report.effectStyles.created + report.paintStyles.created;
        const updated = report.variables.updated + report.textStyles.updated + report.effectStyles.updated + report.paintStyles.updated;
        const extra = report.errors.length ? ` · ${report.errors.length} failed (see the console)` : report.warnings.length ? ` · ${report.warnings[0]}` : '';
        if (report.errors.length) console.warn('[TwoKit] Import errors:', report.errors);
        Notifications[report.errors.length ? 'error' : 'success'](`Figma ${updated ? 'updated' : 'applied'}: ${updated} updated, ${made} created${extra}`);
    },

    fail(message) {
        this.setBusy(false);
        Notifications.error(message);
    }
};

export default FigmaHost;
