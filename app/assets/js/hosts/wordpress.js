/**
 * WordPress host: the TwoKit plugin's admin page runs the web app with
 *
 *   Setup     one screen, shown until a storage mode is chosen:
 *             closed (TwoKit's two CSS files) or open (everything in Bricks)
 *   Save      Ctrl/Cmd S or the header button: stores the project and applies
 *             it (minified CSS files and/or the Bricks import) through REST
 *   Changes   unsaved changes are marked, and leaving the page asks first
 *   Dashboard the app runs in an iframe inside wp-admin (menu and admin bar
 *             stay); it tells the page about unsaved changes, and the page
 *             forwards Ctrl/Cmd S
 *
 * Data from PHP: window.TWOKIT_HOST.wp = { rest, nonce, mode, bricks, adminUrl, pageUrl, version, built }.
 *
 * @module hosts/wordpress
 */

import AppState from '../state/appState.js';
import Platform from '../platform.js';
import Notifications from '../ui/notifications.js';
import ProjectModule from '../modules/projectModule.js';
import ExportModule, { bricksDefaults } from '../modules/exportModule.js';
import UtilitiesModule from '../modules/utilitiesModule.js';
import { bytesToBase64 } from '../core/fontStore.js';
import { minifyCss } from '../core/minifyCss.js';
import { esc } from '../ui/components.js';

const wp = Platform.host.wp || {};
/** Inside the TwoKit admin page's iframe (the normal case). */
const framed = window.parent !== window;
const toParent = (message) => { if (framed) window.parent.postMessage({ twokit: true, ...message }, window.location.origin); };

/** TwoKit's mark (TwoKit files) and Bricks' logo (Saved in Bricks), as in the header buttons. */
const LOGO = {
    closed: '<svg class="btn__icon" viewBox="0 0 26 24" fill="none" aria-hidden="true"><path d="M13.443 0.0057417C14.3661 0.0283497 15.2398 0.0545009 16.1642 0.0466462C16.9336 0.0401225 17.9084 0.0123401 18.6584 0.0869128C20.4372 0.274338 22.0897 1.09383 23.3153 2.39642C24.7305 3.87737 25.4884 5.86635 25.4179 7.91363C25.3531 10.4397 24.1657 12.1868 22.3957 13.8658C20.7255 15.45 19.1471 17.1917 17.4779 18.7773C17.4346 18.8178 17.391 18.8575 17.3465 18.8965L14.2007 18.8928C13.5738 18.8924 12.8156 18.8753 12.1988 18.9228C13.8567 17.3828 15.4196 15.6662 17.0556 14.0947C17.7408 13.4365 18.4513 12.7297 19.0131 11.9651C22.1889 7.25545 19.3108 0.785887 13.6456 0.101947C13.6162 0.0984793 13.5396 0.0983856 13.5091 0.101947L13.443 0.0057417Z" fill="#5FEA6D"/><path d="M12.4041 5.13131C14.9281 4.95341 16.2017 7.75223 14.4354 9.532C13.6057 10.3681 12.7734 11.2066 11.938 12.0386L7.64627 16.329C6.79669 17.1782 5.89987 18.0415 5.07916 18.9141L5.07897 23.9876C4.62662 23.9445 3.52453 23.9756 3.02381 23.9751L0.0105389 23.9955C-0.00277099 22.2911 -0.0031453 20.5867 0.00941471 18.8823C0.729459 18.0929 1.71345 17.1612 2.48392 16.3909L7.04508 11.8333C7.89822 10.9822 8.97463 9.97385 9.73479 9.05209C10.3109 8.35361 10.004 6.97388 10.6517 6.14867C11.1426 5.52348 11.6424 5.26497 12.4041 5.13131Z" fill="#5FEA6D"/><path d="M10.7349 0.0511455C11.1083 0.0540872 11.7266 0.00540406 12.0983 0.00609767L12.1032 0.0668923C11.8981 0.0916562 11.693 0.114976 11.4876 0.136909C8.98176 0.590025 6.98434 2.03928 5.85113 4.34266C5.27693 5.50999 5.17664 6.392 5.06904 7.65456C3.46285 7.70161 1.61766 7.66431 4.19686e-05 7.66318C-0.00670669 5.63034 0.800695 3.67941 2.24191 2.24577C4.8199 -0.3178 7.43032 0.0353987 10.7349 0.0511455Z" fill="#5FEA6D"/><path d="M10.7349 0.0511455C11.1083 0.0540872 11.7266 0.00540406 12.0983 0.00609767L12.1032 0.0668923C11.8981 0.0916562 11.693 0.114976 11.4876 0.136909L11.4782 0.0948619C11.3719 0.0381544 10.9049 0.0584378 10.7349 0.0511455Z" fill="#5FEA6D"/><path d="M20.3401 18.8706C20.8017 18.9145 21.6402 18.8909 22.1375 18.8907L25.4294 18.8853C25.4059 20.0445 25.4329 21.2177 25.4234 22.3756C25.4207 22.6994 25.4513 23.7436 25.3973 23.9859C23.7081 23.9822 22.0189 23.9869 20.3298 24C20.2912 23.1469 20.3338 22.0819 20.3208 21.2074C20.3118 20.5985 20.2871 19.4289 20.3401 18.8706Z" fill="#5FEA6D"/><path d="M12.0983 0.00609767C12.3287 -0.00758711 13.4276 0.00609841 13.443 0.0057417L13.5091 0.101947C13.415 0.0958918 12.3973 0.073566 12.1032 0.0668923L12.0983 0.00609767Z" fill="#5FEA6D"/></svg>',
    open: () => `<img class="btn__icon" src="${Platform.asset('img/export/bricks.png')}" alt="" width="16" height="16">`
};
const modeIcon = (mode) => (mode === 'open' ? LOGO.open() : LOGO.closed);

/** The builder's variable picker data; a problem building it never blocks a save. */
function pickerCatalog(model) {
    try {
        return ExportModule.pickerCatalog(model);
    } catch (error) {
        console.warn('[TwoKit] Variable picker data skipped:', error);
        return null;
    }
}

const ICON = {
    save: '<svg viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 7.5 5.5 10.5 11.5 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

const MODES = {
    closed: {
        title: 'TwoKit files',
        icon: 'closed',
        lines: ['Variables, classes and theme CSS in two minified CSS files, cached by the browser', 'Bricks keeps the theme style settings, the fonts, and the names of variables, classes and colors', 'Uninstall TwoKit and everything it added is removed']
    },
    open: {
        title: 'Saved in Bricks',
        icon: 'open',
        lines: ['Variables, classes, theme style and fonts live in Bricks', 'Bricks prints only the classes each page uses', 'Uninstall TwoKit after setup: the site stays styled']
    }
};

const WordPressHost = {
    mode: wp.mode || '',
    bricksMode: wp.bricksMode || '',
    dirty: false,
    saving: false,

    init() {
        // The app belongs in the dashboard. Opened on its own (the iframe URL in a tab),
        // send the browser to the TwoKit page instead of showing a second copy of wp-admin.
        if (!framed && wp.adminUrl) {
            window.location.replace(wp.pageUrl || `${wp.adminUrl}admin.php?page=twokit`);
            return;
        }
        this.header();
        // Changes after start-up mark the project unsaved (the first notify is the boot render).
        // Moving between screens and opening panels ('ui') changes nothing to save.
        queueMicrotask(() => AppState.subscribe((section) => { if (section !== 'ui') this.setDirty(true); }));
        // In the dashboard the page asks before leaving (it knows about changes via toParent).
        if (!framed) {
            window.addEventListener('beforeunload', (event) => {
                if (!this.dirty) return;
                event.preventDefault();
                event.returnValue = '';
            });
        }
        // Ctrl/Cmd S pressed while focus is in wp-admin, outside the iframe.
        window.addEventListener('message', (event) => {
            if (event.source !== window.parent || event.origin !== window.location.origin) return;
            if (event.data?.twokit && event.data.action === 'save') this.save();
        });
        // Ctrl/Cmd S saves to WordPress (the web app downloads a file instead).
        window.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.save();
            }
        }, true);
        // Bricks' Style manager mode is the theme's default mode. Coming back to this tab
        // (from the Bricks builder, say) picks up a change made there.
        document.addEventListener('visibilitychange', () => { if (!document.hidden) this.syncMode(); });
        // Project → Reset: on WordPress it removes TwoKit from the site, not just this screen.
        ProjectModule.resetWith({
            title: 'Remove TwoKit from this site',
            body: 'Deletes everything TwoKit added: its two CSS files, and its variables, classes, color palette, theme style and fonts in Bricks, then the saved project. Pages that use TwoKit classes or variables lose those styles. Export the project first (.twokit.zip) to keep a copy.',
            button: 'Remove TwoKit from site',
            confirm: 'Remove TwoKit from this site?\n\nThis deletes TwoKit’s CSS files and everything TwoKit added to Bricks (variables, classes, palette, theme style, fonts), and the saved project. Pages that use them lose those styles. This can’t be undone.',
            run: () => this.removeAll()
        });
        if (wp.canSave === false) {
            Notifications.error('Your account can view TwoKit but not save it (saving needs permission to edit site CSS).');
        }
        if (!this.mode) this.setup();
        // The site's CSS is built here at save time: after a plugin update the site keeps the
        // old CSS (and its fixes are missing) until the next save.
        else if (wp.canSave !== false && wp.version && wp.built !== wp.version) {
            this.setDirty(true);
            Notifications.info(`TwoKit was updated to ${wp.version}. Save once to update your site’s CSS.`);
        }
    },

    /** POST /twokit/v1/… with the REST nonce; errors carry WordPress' message. */
    async request(route, body) {
        // A save with a Bricks zip goes as multipart/form-data: the JSON in `payload`
        // and the zip as a file, which PHP streams to disk instead of holding a base64
        // copy in memory.
        let init;
        // Larger than the site's upload limit (upload_max_filesize, as low as 2 MB on some
        // hosts): base64 inside the JSON, as before, which only post_max_size limits.
        const maxUpload = Number(wp.maxUpload) || 0;
        if (body?.bricks?.zipBytes && maxUpload && body.bricks.zipBytes.length > maxUpload * 0.95) {
            const { zipBytes, ...bricks } = body.bricks;
            body = { ...body, bricks: { ...bricks, zip: bytesToBase64(zipBytes) } };
        }
        if (body?.bricks?.zipBytes) {
            const { zipBytes, ...bricks } = body.bricks;
            const form = new FormData();
            form.append('payload', JSON.stringify({ ...body, bricks }));
            form.append('bricks_zip', new Blob([zipBytes], { type: 'application/zip' }), 'twokit-bricks.zip');
            init = { headers: { 'X-WP-Nonce': wp.nonce }, body: form };
        } else {
            init = { headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': wp.nonce }, body: JSON.stringify(body) };
        }
        const response = await fetch(`${wp.rest}${route}`, {
            method: 'POST',
            credentials: 'same-origin',
            ...init
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (result.code === 'rest_cookie_invalid_nonce') throw new Error('Your login session expired. Reload the page (your changes are kept until you leave) and save again.');
            if (response.status === 413) throw new Error('The upload is too large for this server');
            if (response.status === 401 || response.status === 403) throw new Error(result.message || 'Your account is not allowed to change TwoKit.');
            throw new Error(result.message || `WordPress returned ${response.status}`);
        }
        return result;
    },

    /**
     * Follows Bricks' Style manager default mode when it changed in Bricks. A
     * mode changed in TwoKit and not saved yet is left as it is (Save decides).
     * Following Bricks doesn't make the project unsaved: Bricks already has it.
     */
    async syncMode() {
        if (!wp.bricks || this.saving || this.syncingMode) return;
        this.syncingMode = true;
        try {
            const { bricksMode } = await this.request('status', {});
            if (!['light', 'dark', 'auto'].includes(bricksMode) || bricksMode === this.bricksMode) return;
            const followed = AppState.theme.defaultMode === this.bricksMode || !this.bricksMode;
            this.bricksMode = bricksMode;
            if (!followed || AppState.theme.defaultMode === bricksMode) return;
            const dirty = this.dirty;
            AppState.updateTheme({ defaultMode: bricksMode });
            this.setDirty(dirty);
            Notifications.info(`Default mode is now ${bricksMode}, as set in Bricks`);
        } catch (error) {
            console.warn('[TwoKit] Could not read Bricks\' theme mode:', error);
        } finally {
            this.syncingMode = false;
        }
    },

    /** Project → Remove TwoKit from this site: everything TwoKit added goes, then setup starts over. */
    async removeAll() {
        try {
            const model = ExportModule.model();
            const result = await this.request('reset', {
                confirm: 'remove-twokit',
                themeStyle: ExportModule.bricksThemeStyle(model).id,
                variables: ExportModule.bricksVariables(model).variables.map((v) => v.id)
            });
            this.setDirty(false);
            Notifications.success(result.message || 'TwoKit removed');
            // Start from defaults: the saved project is gone on the server, so drop the in-memory one too.
            ProjectModule.reset();
        } catch (error) {
            Notifications.error(`Not removed: ${error.message}`);
        }
    },

    header() {

        const actions = document.querySelector('.header__actions');
        this.chip = document.createElement('button');
        this.chip.type = 'button';
        this.chip.className = 'btn wp-mode';
        this.chip.addEventListener('click', () => this.setup());
        this.saveBtn = document.createElement('button');
        this.saveBtn.type = 'button';
        this.saveBtn.className = 'btn wp-save';
        this.saveBtn.addEventListener('click', () => this.save());
        actions.prepend(this.chip);
        actions.append(this.saveBtn);
        this.renderHeader();
    },

    renderHeader() {
        this.chip.hidden = !this.mode;
        this.chip.innerHTML = this.mode ? `${modeIcon(this.mode)}${esc(MODES[this.mode].title)}` : '';
        this.chip.title = 'Storage mode. Click to change.';
        this.chip.setAttribute('aria-label', `Storage mode: ${this.mode ? MODES[this.mode].title : 'not set'}. Change`);
        this.saveBtn.disabled = this.saving;
        this.saveBtn.classList.toggle('is-dirty', this.dirty);
        this.saveBtn.innerHTML = this.saving ? '<span class="spinner" aria-hidden="true"></span>Saving…' : `${ICON.save}${this.dirty ? 'Save' : 'Saved'}`;
    },

    setDirty(value) {
        if (this.dirty === value) return;
        this.dirty = value;
        toParent({ action: 'dirty', value });
        this.renderHeader();
    },

    /* ---------------- setup ---------------- */

    setup() {
        document.querySelector('.wp-setup')?.remove();
        const first = !this.mode;
        let pick = this.mode || 'open';
        const el = document.createElement('div');
        el.className = 'wp-setup';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-labelledby', 'wpSetupTitle');
        const card = (id) => `
          <button type="button" class="wp-setup__option" data-mode="${id}" aria-pressed="${pick === id}">
            <span class="wp-setup__icon">${modeIcon(id)}</span>
            <b>${esc(MODES[id].title)}</b>
            <ul>${MODES[id].lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
          </button>`;
        el.innerHTML = `
          <div class="wp-setup__panel">
            <h2 id="wpSetupTitle">${first ? 'Where should TwoKit keep your styles?' : 'Storage mode'}</h2>
            <p>${wp.bricks ? `Bricks ${esc(wp.bricks)} is active.` : '<b>Bricks is not active.</b> TwoKit files work with any theme; Saved in Bricks needs Bricks 2.4 or newer.'} You can switch later.</p>
            <div class="wp-setup__options">${card('open')}${card('closed')}</div>
            <div class="wp-setup__actions">
              ${first ? '' : '<button type="button" class="btn" data-setup="cancel">Cancel</button>'}
              <button type="button" class="btn wp-save is-dirty" data-setup="done">${first ? 'Finish setup' : 'Switch and save'}</button>
            </div>
          </div>`;
        const sync = () => el.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === pick)));
        el.addEventListener('click', async (event) => {
            const option = event.target.closest('[data-mode]');
            if (option) {
                pick = option.dataset.mode;
                sync();
                return;
            }
            const action = event.target.closest('[data-setup]')?.dataset.setup;
            if (action === 'cancel') el.remove();
            if (action === 'done') {
                if (pick === 'open' && !wp.bricks) return Notifications.error('Saved in Bricks needs Bricks to be active');
                el.remove();
                const changed = pick !== this.mode;
                const before = this.mode;
                this.mode = pick;
                this.renderHeader();
                // The chip shows where the styles really are: if the switch didn't go through,
                // ask WordPress which mode the site is in now (a failed Bricks import after the
                // files were written still leaves the site on TwoKit files).
                if ((changed || first) && !(await this.save())) await this.syncStorageMode(before);
            }
        });
        el.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !first) el.remove(); });
        document.body.append(el);
        el.querySelector('[data-setup="done"]').focus();
    },

    /* ---------------- save ---------------- */

    async payload() {
        const model = ExportModule.model();
        const closed = this.mode === 'closed';
        const body = {
            mode: this.mode,
            project: JSON.stringify(ProjectModule.buildSnapshot()),
            defaultMode: AppState.theme.defaultMode,
            // Bricks' Style manager mode when the app loaded (or last saved): lets WordPress
            // keep a change made in Bricks meanwhile.
            bricksMode: this.bricksMode,
            // TwoKit's theme style id, so closed mode can clear its stylesheet and reset can
            // remove it, even if WordPress lost track of it.
            themeStyle: ExportModule.bricksThemeStyle(model).id,
            // TwoKit's variable ids are stable, so closed mode can remove them from Bricks
            // even if WordPress lost track of them.
            variables: ExportModule.bricksVariables(model).variables.map((v) => v.id),
            // The variable picker's data for the Bricks builder (names + swatch colors only).
            picker: pickerCatalog(model)
        };
        if (closed) {
            // Variable values, the theme style's stylesheet and the utility classes. The theme
            // style's settings stay in Bricks, which prints them as in open mode.
            const vars = ExportModule.bricksVariables(model).variables;
            body.css = {
                tokens: minifyCss(`:root{${vars.map((v) => `--${v.name}:${v.value};`).join('')}}`),
                // Without Bricks there's no theme style, so its base settings come along as CSS.
                styles: minifyCss([wp.bricks ? '' : ExportModule.themeStyleCss(model), ExportModule.themeStylesheet(model), ...UtilitiesModule.classes().map((c) => c.css)].join('\n'))
            };
        }
        if (wp.bricks) {
            const parts = { ...bricksDefaults().parts };
            delete parts.styleManager; // written by PHP (not a transfer type)
            // Closed: variables and classes go in as names only (pickers), the theme style with
            // all its settings but an empty stylesheet, fonts to the font library.
            // knownFontsHash: the fonts Bricks has from TwoKit; unchanged fonts are left out
            // (Bricks would upload every file again and keep the old ones).
            const options = { parts, skipMissingFonts: true, cssInBricks: !closed, knownFontsHash: wp.fontsHash || '' };
            const pkg = await ExportModule.bricksPackage(model, options);
            const types = Object.keys(pkg.manifest.types);
            body.bricks = {
                // Sent as a file by request() (multipart), not base64 in the JSON.
                zipBytes: pkg.zip,
                types,
                items: Object.fromEntries(types.map((t) => [t, pkg.manifest.types[t].items.map((i) => i.id)])),
                classes: pkg.manifest.types.classes?.items.map((i) => i.id) || [],
                variables: pkg.manifest.types.variables?.items.map((i) => i.id) || [],
                classCategories: pkg.manifest.types.classes?.categories.map((c) => c.id) || [],
                variableCategories: pkg.manifest.types.variables?.categories.map((c) => c.id) || [],
                // Categories from before the "Tk " prefix: removed once empty.
                legacyVariableCategories: ExportModule.legacyVariableCategoryIds(model),
                // Every TwoKit font family, also when unchanged fonts were left out of the zip.
                fonts: options.fontFamilies || [],
                fontsHash: options.fontsHash || '',
                themeStyle: pkg.manifest.types['theme-styles']?.items[0]?.id || '',
                palette: pkg.manifest.types['color-palettes']?.categories[0]?.id || '',
                // id → name, so WordPress can leave a site's own --radius, .btn or font alone.
                names: {
                    variables: Object.fromEntries((pkg.manifest.types.variables?.items || []).map((i) => [i.id, i.label])),
                    classes: Object.fromEntries((pkg.manifest.types.classes?.items || []).map((i) => [i.id, i.label])),
                    fonts: options.fontNames || {}
                }
            };
            body.skippedFonts = options.skippedFonts || [];
        }
        return body;
    },

    async save() {
        if (this.saving) return;
        if (!this.mode) return this.setup();
        this.saving = true;
        this.renderHeader();
        try {
            const body = await this.payload();
            const result = await this.request('save', body);
            // Bricks' Style manager is the same setting as the theme's default mode.
            let synced = '';
            if (['light', 'dark', 'auto'].includes(result.defaultMode)) {
                this.bricksMode = result.defaultMode;
                if (AppState.theme.defaultMode !== result.defaultMode) {
                    AppState.updateTheme({ defaultMode: result.defaultMode });
                    synced = ` · default mode ${result.defaultMode}, as set in Bricks`;
                }
            }
            this.setDirty(false);
            // Bricks now has these fonts: the next save leaves them out while unchanged.
            if (body.bricks?.fontsHash) wp.fontsHash = body.bricks.fontsHash;
            const skipped = body.skippedFonts?.length ? ` · kept Bricks' copy of ${body.skippedFonts.join(', ')}` : '';
            Notifications[result.kept?.length ? 'info' : 'success'](`${result.message || 'Saved'}${synced}${skipped}`);
            if (result.kept?.length) console.info('[TwoKit] Left alone in Bricks (same name, not made by TwoKit):', result.kept);
            return true;
        } catch (error) {
            console.error('[TwoKit] Save failed:', error);
            Notifications.error(`Not saved: ${error.message}`);
            return false;
        } finally {
            this.saving = false;
            this.renderHeader();
        }
    },

    /** After a failed mode switch: the mode WordPress has now ('' → `fallback`). */
    async syncStorageMode(fallback) {
        let mode = '';
        try {
            mode = (await this.request('status', {})).mode || '';
        } catch (error) {
            console.warn('[TwoKit] Could not read the storage mode:', error);
        }
        this.mode = ['closed', 'open'].includes(mode) ? mode : fallback;
        this.renderHeader();
        if (!this.mode) this.setup();
    }
};

export default WordPressHost;
