/**
 * Export screen (Figma: "Export - Bricks / Figma / HTML & CSS - screen").
 * The header's Export button opens it (every host).
 *
 *   Control   "Export to": Bricks Builder · Figma · HTML & CSS · TwoKit, and a project
 *             summary (what ships) that expands into a breakdown
 *   Preview   the chosen destination:
 *               Bricks      one row per part (Variables, Color palette, Theme
 *                           style, Classes, Style manager) with its scope and
 *                           its own download; add / remove rows; fonts (self-hosted)
 *               Figma       what the package holds, the plugin, the package
 *               HTML & CSS  variables.css on its own, or the whole style guide
 *               TwoKit      the project file (.twokit.zip) that opens in the
 *                           web app, the WordPress plugin and the Figma plugin
 *
 * Choices live in AppState.exportPrefs (saved with the project); the target
 * and open panels in AppState.ui. Downloads run through ExportModule
 * ([data-export] buttons).
 */

import AppState from '../state/appState.js';
import ExportModule, { BRICKS_PARTS, styleGuideName, projectName } from './exportModule.js';
import UtilitiesModule from './utilitiesModule.js';
import { currentTheme } from '../state/themeModel.js';
import { esc, switcher } from '../ui/components.js';
import Platform from '../platform.js';
import ProjectModule from './projectModule.js';

const svg = (d, size = 16) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
    braces: svg('<path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1"/>'),
    palette: svg('<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 2-2v-.5a2 2 0 0 1 2-2h2a4 4 0 0 0 4-4A10 10 0 0 0 12 2Z"/>'),
    brush: svg('<path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02Z"/>'),
    hash: svg('<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>'),
    sliders: svg('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'),
    layers: svg('<path d="m12 2 10 5-10 5L2 7l10-5Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>'),
    download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
    minus: svg('<path d="M5 12h14"/>', 18),
    plus: svg('<path d="M12 5v14M5 12h14"/>', 18),
    chev: svg('<path d="m9 18 6-6-6-6"/>', 18),
    expand: svg('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>', 14),
    collapse: svg('<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>', 14),
    file: svg('<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z"/><path d="M14 2v6h6"/>'),
    type: svg('<path d="M4 7V4h16v3M9 20h6M12 4v16"/>'),
    code: svg('<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>'),
    plug: svg('<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>'),
    text: svg('<path d="M17 6H3M21 12H3M15 18H3"/>'),
    shadow: svg('<rect x="3" y="3" width="13" height="13" rx="2"/><path d="M20 8v10a2 2 0 0 1-2 2H8"/>'),
    figma: svg('<path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5ZM12 2h3.5a3.5 3.5 0 1 1 0 7H12V2ZM12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0ZM5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0ZM5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5Z"/>')
};

const TARGETS = [
    { id: 'bricks', title: 'Bricks Builder', detail: 'Global data file · .zip', logo: 'img/export/bricks.png' },
    { id: 'figma', title: 'Figma', detail: 'Variables & styles · .json', logo: 'img/export/figma.svg' },
    { id: 'css', title: 'HTML & CSS', detail: 'Style guide · .zip / .css', logo: 'img/export/css.svg' },
    // Web app only: the plugins keep their four destinations.
    { id: 'webapp', title: 'Web app (shadcn/ui)', detail: 'React + Tailwind kit · .zip', logo: 'img/export/shadcn.svg', web: true },
    { id: 'twokit', title: 'TwoKit', detail: 'Project file · .twokit.zip', logo: 'img/export/twokit.svg' }
].filter((t) => !t.web || Platform.is('web'));

const PARTS = {
    variables: { label: 'Variables', icon: I.braces },
    palette: { label: 'Color palette', icon: I.palette },
    theme: { label: 'Theme style', icon: I.brush },
    classes: { label: 'Classes', icon: I.hash },
    styleManager: { label: 'Style manager', icon: I.sliders },
    settings: { label: 'Bricks settings', icon: I.sliders }
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const target = () => (TARGETS.some((t) => t.id === AppState.ui.exportTarget) ? AppState.ui.exportTarget : 'bricks');
const rows = () => (AppState.exportPrefs?.bricks?.rows || []).filter((r) => BRICKS_PARTS.includes(r.part));

/** Numbers for the summary card and the panels (synchronous; the Figma package counts arrive later). */
function counts() {
    const model = currentTheme();
    const t = AppState.typography;
    const scale = t.scale || {};
    const headings = (scale.headings || []).filter((h) => /^h[1-6]$/.test(h.name)).length;
    const textStyles = headings + (scale.textSizes || []).length + (t.enableBodySizes !== false ? (scale.body || []).length : 0);
    return {
        variables: ExportModule.bricksVariables(model).variables.length,
        colors: ExportModule.bricksPalette(model).colors.length,
        textStyles,
        fonts: AppState.fonts.length,
        themeTokens: model.groups.reduce((n, g) => n + g.tokens.length, 0),
        palettes: AppState.colors.length + AppState.stateColors.length,
        classes: UtilitiesModule.classes().length,
        shadows: model.shadows.light.length,
        spaceSteps: (AppState.spacing.fluidScale || []).length,
        typeSteps: (scale.textSizes || []).length,
        properties: (ExportModule.variablesCss().match(/^\s*--[\w-]+\s*:/gm) || []).length
    };
}

/* ------------------------------------------------------------------ */
/* Control: targets + summary                                          */
/* ------------------------------------------------------------------ */

function targetList() {
    const current = target();
    return TARGETS.map((t) => {
        const on = t.id === current;
        return `
          <button type="button" class="ex-target${on ? ' is-active' : ''}" role="tab" aria-selected="${on}" data-ex-target="${t.id}" data-fid="ex-target-${t.id}">
            <span class="ex-logo"><img src="${Platform.asset(t.logo)}" alt="" width="28" height="28"></span>
            <span class="ex-target__label"><b>${esc(t.title)}</b><small>${esc(t.detail)}</small></span>
            ${on ? `<span class="ex-target__chev">${I.chev}</span>` : ''}
          </button>`;
    }).join('');
}

/** The summary follows the destination: its own variable and color counts (Figma's arrive after render). */
function summary(c, t) {
    const open = AppState.ui.exportSummaryOpen === true;
    const stat = (n, label, key = '') => `<div class="ex-stat"><b${key ? ` data-ex-count="${key}"` : ''}>${n}</b><span>${esc(label)}</span></div>`;
    const pending = '…';
    const css = t === 'css' || t === 'twokit' || t === 'webapp';
    const variables = t === 'figma' ? pending : css ? c.properties : c.variables;
    const more = [
        ['Palettes', c.palettes], ['Theme tokens', c.themeTokens], ['Utility classes', c.classes],
        ['Shadows', c.shadows], ['Fluid spacing steps', c.spaceSteps], ['Type scale steps', c.typeSteps]
    ];
    return `
      <section class="ex-summary" aria-labelledby="exSummaryTitle">
        <header class="ex-summary__head">
          <div><h3 id="exSummaryTitle">${esc(projectName() === 'TwoKit' ? 'Untitled project' : projectName())}</h3><p>Everything below ships in this export</p></div>
          <button type="button" class="ex-square" data-ex-action="toggle-summary" data-fid="ex-summary-toggle" aria-expanded="${open}" aria-controls="exSummaryMore" aria-label="${open ? 'Show less' : 'Show the full breakdown'}">${open ? I.collapse : I.expand}</button>
        </header>
        <div class="ex-stats">
          ${stat(variables, css ? 'CSS variables' : 'Variables', t === 'figma' ? 'variables' : '')}${stat(t === 'figma' ? pending : c.colors, css ? 'Color tokens' : 'Color styles', t === 'figma' ? 'paintStyles' : '')}${stat(c.textStyles, 'Text styles')}${stat(c.fonts, c.fonts === 1 ? 'Font family' : 'Font families')}
        </div>
        <dl class="ex-more" id="exSummaryMore" ${open ? '' : 'hidden'}>
          ${more.map(([label, n]) => `<div><dt>${esc(label)}</dt><dd>${n}</dd></div>`).join('')}
        </dl>
      </section>`;
}

/* ------------------------------------------------------------------ */
/* Shared panel pieces                                                 */
/* ------------------------------------------------------------------ */

const head = (title, desc, action = '') => `
    <header class="ex-head">
      <div class="ex-head__text"><h2>${esc(title)}</h2><p>${desc}</p></div>${action}
    </header>`;

const sectionHead = (title, desc) => `<header class="ex-section__head"><h3>${esc(title)}</h3><p>${desc}</p></header>`;

const contentRow = ({ icon, title, desc, count, dim = false, key = '' }) => `
    <div class="ex-content${dim ? ' is-dim' : ''}">
      <span class="ex-tile">${icon}</span>
      <span class="ex-content__text"><b>${esc(title)}</b><small>${desc}</small></span>
      <span class="ex-count"${key ? ` data-ex-count="${key}"` : ''}>${count}</span>
    </div>`;

const cta = (action, label, meta, disabled = false) => `
    <footer class="ex-foot">
      <button type="button" class="ex-cta" data-export="${action}" data-fid="ex-cta-${action}"${disabled ? ' disabled' : ''}>${I.download}<span>${esc(label)}</span></button>
      <p class="ex-meta">${meta}</p>
    </footer>`;

/* ------------------------------------------------------------------ */
/* Bricks                                                              */
/* ------------------------------------------------------------------ */

function bricksPanel(c) {
    const prefs = AppState.exportPrefs.bricks;
    const scopes = ExportModule.bricksScopes();
    const options = ExportModule.bricksOptions();
    const list = rows();
    const used = new Set(list.map((r) => r.part));
    const missing = BRICKS_PARTS.filter((p) => !used.has(p));

    const rowHtml = list.map((row, i) => {
        const part = PARTS[row.part];
        const partOptions = BRICKS_PARTS.filter((p) => p === row.part || !used.has(p)).map((p) => ({ value: p, label: PARTS[p].label }));
        const scopeValue = row.part === 'styleManager' ? AppState.theme.defaultMode : (options.parts[row.part] ?? scopes[row.part]?.[0]?.value);
        const scopeOptions = scopes[row.part].map((o) => ({ value: o.value, label: o.count == null ? o.label : `${o.label} (${o.count})` }));
        return `
          <div class="ex-row">
            <div class="ex-select ex-select--part"><span class="ex-select__icon">${part.icon}</span>${switcher({ id: `ex-part-${i}`, value: row.part, options: partOptions, label: `Item ${i + 1}`, size: 'sm' })}</div>
            <div class="ex-select ex-select--scope"><span class="ex-select__icon ex-select__icon--muted">${I.layers}</span>${switcher({ id: `ex-scope-${i}`, value: scopeValue, options: scopeOptions, label: `${part.label} scope`, size: 'sm' })}</div>
            <button type="button" class="ex-btn" data-export="bricks-part:${row.part}" data-fid="ex-download-${row.part}">${I.download}<span>Download</span></button>
            <button type="button" class="ex-icon" data-ex-action="remove-row" data-row="${i}" data-fid="ex-remove-${row.part}" aria-label="Remove ${esc(part.label)} from the package" title="Remove from the package">${I.minus}</button>
          </div>`;
    }).join('');

    // Fonts: always self-hosted, every face as WOFF2 in the zip (Bricks custom fonts).
    const fonts = AppState.fonts;
    const fontList = fonts.map((f) => {
        const how = f.source === 'google' ? 'Google Fonts · downloaded as WOFF2' : 'Uploaded · WOFF2';
        const weights = [...new Set((f.faces || []).map((x) => x.weight))].sort((x, y) => x - y).join(', ');
        return `<li><b>${esc(f.family)}</b><span>${esc(how)}${weights ? ` · ${esc(weights)}` : ''}</span></li>`;
    }).join('');

    // Edge cases worth saying out loud.
    const notes = [];
    if (!list.length) notes.push('The package is empty. Add an item with +.');
    const readsVariables = ['palette', 'theme', 'classes'].filter((p) => used.has(p));
    if (readsVariables.length && !used.has('variables')) notes.push(`${readsVariables.map((p) => PARTS[p].label).join(', ')} read TwoKit variables. Keep Variables in the package unless they are already in Bricks.`);
    if (used.has('variables') && options.parts.variables !== 'all' && readsVariables.length) notes.push('Only one variable collection ships. The rest must already be in Bricks for the theme style, palette and classes to resolve.');
    if (used.has('classes') && !c.classes) notes.push('Every utility group is off in Utilities, so no classes ship.');

    const vars = options.parts.variables != null ? ExportModule.bricksVariables(undefined, options.parts.variables).variables.length : 0;
    const colors = options.parts.palette != null ? ExportModule.bricksPalette(undefined, options.parts.palette).colors.length : 0;
    const classes = options.parts.classes != null ? ExportModule.bricksClasses(options.parts.classes).classes.length : 0;
    const meta = ['Bricks 2.4.1', plural(vars, 'variable'), plural(colors, 'color'), plural(classes, 'class').replace('classs', 'classes'), plural(fonts.length, 'font')].join('  ·  ');

    return `
      <div class="ex-panel">
        <div class="ex-panel__body">
          ${head('Bricks Builder', 'One Bricks 2.4.1 global data file. Import it in Bricks → Settings → Import.',
              `<button type="button" class="ex-square ex-square--lg" data-ex-action="add-row" data-fid="ex-add-row" aria-label="Add an item to the package" title="${missing.length ? `Add ${esc(PARTS[missing[0]].label)}` : 'Every item is in the package'}"${missing.length ? '' : ' disabled'}>${I.plus}</button>`)}
          <div class="ex-rows" role="list" aria-label="Package items">${rowHtml || '<p class="ex-empty">No items. Use + to add Variables, Color palette, Theme style, Classes or Style manager.</p>'}</div>
          <hr class="ex-divider">
          <section class="ex-section">
            ${sectionHead('Fonts', 'Self-hosted: every font ships as WOFF2 custom fonts inside the package')}
            ${fonts.length ? `<ul class="ex-fontlist">${fontList}</ul>` : '<p class="ex-note">Your font library is empty, so headings and body use system fonts and no font files ship.</p>'}
          </section>
          ${notes.length ? `<ul class="ex-notes" role="status">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
        </div>
        ${cta('bricks-all', 'Export Bricks package (.zip)', esc(meta), !list.length)}
      </div>`;
}

/* ------------------------------------------------------------------ */
/* Figma                                                               */
/* ------------------------------------------------------------------ */

function figmaPanel(c) {
    const pending = '<span class="ex-dots" aria-label="Counting">…</span>';
    return `
      <div class="ex-panel">
        <div class="ex-panel__body">
          ${head('Figma', 'Everything in one file for the TwoKit Figma plugin. Drop it into the plugin to rebuild your design system in any Figma file.')}
          <section class="ex-section ex-section--top">
            ${sectionHead('What’s in the package', 'All of this ships inside a single .json file')}
            <div class="ex-list">
              ${contentRow({ icon: I.braces, title: 'Variables', desc: 'Light / Dark and Desktop / Mobile modes', count: pending, key: 'variables' })}
              ${contentRow({ icon: I.palette, title: 'Color styles', desc: 'Paint styles linked to your color variables', count: pending, key: 'paintStyles' })}
              ${contentRow({ icon: I.text, title: 'Text styles', desc: 'Your full type scale for mobile and desktop', count: c.textStyles, key: 'textStyles' })}
              ${contentRow({ icon: I.shadow, title: 'Effect styles', desc: 'Shadows and elevation', count: c.shadows, key: 'effectStyles' })}
              ${contentRow({ icon: I.type, title: 'Fonts', desc: 'Font families and weights used in the project', count: pending, key: 'fonts' })}
            </div>
          </section>
          ${Platform.hides('figma-plugin') ? '' : `<hr class="ex-divider">
          <section class="ex-section">
            ${sectionHead('TwoKit Figma plugin', 'Needed once to import the package into Figma')}
            <div class="ex-card">
              <span class="ex-tile">${I.plug}</span>
              <span class="ex-content__text"><b>One-time setup</b><small>Unzip, then in Figma desktop go to Plugins → Development → Import plugin from manifest.</small></span>
              <button type="button" class="ex-btn ex-btn--auto" data-export="figma-plugin" data-fid="ex-figma-plugin">${I.download}<span>Download plugin</span></button>
            </div>
          </section>`}
        </div>
        ${cta('figma-package', 'Download Figma package (.json)', `${esc(ExportModule.figmaFileName())}  ·  TwoKit schema v1  ·  one file`)}
      </div>`;
}

/* ------------------------------------------------------------------ */
/* HTML & CSS                                                          */
/* ------------------------------------------------------------------ */

function cssPanel(c) {
    const properties = c.properties;
    const fonts = AppState.fonts.length;
    const files = ['variables.css', 'styles.css', 'index.html', 'figma package'].length + (fonts ? 1 : 0);
    const meta = [`${esc(styleGuideName())}.zip`, plural(files, 'file'), fonts ? `${plural(fonts, 'font')} (WOFF2)` : 'system fonts'].join('  ·  ');
    return `
      <div class="ex-panel">
        <div class="ex-panel__body">
          ${head('HTML & CSS', 'Download just your variables, or the full style guide package with CSS, fonts and a starter page, all zipped into one file.')}
          <section class="ex-section ex-section--top">
            ${sectionHead('Variables only', 'Just the CSS custom properties, ready to drop into any project')}
            <div class="ex-row ex-row--css">
              <div class="ex-select ex-select--part ex-select--static"><span class="ex-select__icon">${I.braces}</span><span>Variables</span></div>
              <div class="ex-select ex-select--scope ex-select--static"><span class="ex-select__icon ex-select__icon--muted">${I.file}</span><span class="ex-grow">variables.css</span><small>${plural(properties, 'custom property').replace('propertys', 'properties')}</small></div>
              <button type="button" class="ex-btn" data-export="css-variables" data-fid="ex-css-variables">${I.download}<span>Download</span></button>
            </div>
          </section>
          <hr class="ex-divider">
          <section class="ex-section">
            ${sectionHead('Full package', 'Everything below is bundled into one .zip')}
            <div class="ex-list">
              ${contentRow({ icon: I.braces, title: 'variables.css', desc: 'All design tokens as CSS custom properties', count: properties })}
              ${contentRow({ icon: I.brush, title: 'styles.css', desc: 'Reset, element classes (.tk-*), typography and utility classes', count: c.classes })}
              ${contentRow({ icon: I.type, title: 'fonts.css + WOFF2 files', desc: fonts ? 'Self-hosted font files with their @font-face rules' : 'Your font library is empty: system fonts, nothing to ship', count: fonts, dim: !fonts })}
              ${contentRow({ icon: I.code, title: 'index.html', desc: 'Starter page that links everything together', count: 1 })}
              ${contentRow({ icon: I.figma, title: 'figma/…twokit-figma.json', desc: 'The Figma package, for the TwoKit Figma plugin', count: 1 })}
            </div>
          </section>
        </div>
        ${cta('css-all', 'Download style guide package (.zip)', meta)}
      </div>`;
}

/* ------------------------------------------------------------------ */
/* Web app (shadcn/ui)                                                 */
/* ------------------------------------------------------------------ */

const KIT_COMPONENTS = 34;

function webappPanel(c) {
    const fonts = AppState.fonts.length;
    const meta = [`${esc(ExportModule.webAppName())}.zip`, 'React 19 · Tailwind CSS 4 · Vite', fonts ? `${plural(fonts, 'font')} (WOFF2)` : 'system fonts'].join('  ·  ');
    return `
      <div class="ex-panel">
        <div class="ex-panel__body">
          ${head('Web app (shadcn/ui)', 'A React + Tailwind starter with shadcn/ui components already linked to your design system. Unzip, run <code>npm install</code> and <code>npm run dev</code>.')}
          <section class="ex-section ex-section--top">
            ${sectionHead('What’s in the kit', 'One project folder, ready to run or to copy into an app you already have')}
            <div class="ex-list">
              ${contentRow({ icon: I.layers, title: 'shadcn/ui components', desc: 'Buttons, form fields, tabs, popover, dialog, menus, search, table and more', count: KIT_COMPONENTS })}
              ${contentRow({ icon: I.braces, title: 'twokit.css', desc: 'Your tokens, the same file as variables.css', count: c.properties })}
              ${contentRow({ icon: I.palette, title: 'Theme links', desc: 'Every shadcn color, radius and font points at a TwoKit token, light and dark included', count: 'All' })}
              ${contentRow({ icon: I.type, title: 'Fonts', desc: fonts ? 'Self-hosted WOFF2 files with their @font-face rules' : 'Your font library is empty: system fonts, nothing to ship', count: fonts, dim: !fonts })}
              ${contentRow({ icon: I.code, title: 'Demo page', desc: 'Every component in use, with a theme switch and Ctrl/Cmd K search', count: 1 })}
            </div>
          </section>
          <hr class="ex-divider">
          <section class="ex-section">
            ${sectionHead('Add more later', 'The kit is set up for the shadcn CLI, so new components use the same theme')}
            <div class="ex-card">
              <span class="ex-tile">${I.plug}</span>
              <span class="ex-content__text"><b>npx shadcn@latest add calendar</b><small>Any component from ui.shadcn.com. Export again and replace public/twokit.css when the design changes.</small></span>
            </div>
          </section>
        </div>
        ${cta('shadcn-all', 'Download web app kit (.zip)', meta)}
      </div>`;
}

/* ------------------------------------------------------------------ */
/* TwoKit project                                                      */
/* ------------------------------------------------------------------ */

const HOSTS = [
    { title: 'Web app', desc: 'Import in the header, drop the file in, done' },
    { title: 'WordPress', desc: 'Import in the header, then Save to apply it to the site' },
    { title: 'Figma', desc: 'Import in the plugin header, then Apply to Figma' }
];

function twokitPanel() {
    const fonts = AppState.fonts;
    const files = new Set(fonts.flatMap((f) => f.faces.filter((face) => face.fileId).map((face) => face.fileId))).size;
    const named = fonts.filter((f) => !f.faces.some((face) => face.fileId)).length;
    const meta = [esc(ProjectModule.fileName()), files ? `project.json + ${plural(files, 'font file')}` : 'project.json'].join('  ·  ');
    return `
      <div class="ex-panel">
        <div class="ex-panel__body">
          ${head('TwoKit', 'Your whole project in one file. Open it on another TwoKit site, in the web app or in Figma and carry on where you left off.')}
          <section class="ex-section ex-section--top">
            ${sectionHead('What’s in the file', 'One .twokit.zip, nothing else to keep track of')}
            <div class="ex-list">
              ${contentRow({ icon: I.sliders, title: 'Project settings', desc: 'Colors, typography, spacing, theming, layout, utilities and export choices', count: 1 })}
              ${contentRow({ icon: I.type, title: 'Uploaded fonts', desc: files ? 'The font files you uploaded, as real files under fonts/' : 'No uploaded fonts in this project', count: files, dim: !files })}
              ${contentRow({ icon: I.text, title: 'Google fonts', desc: named ? 'Saved by name and downloaded again when they are needed' : 'No Google fonts in this project', count: named, dim: !named })}
            </div>
          </section>
          <hr class="ex-divider">
          <section class="ex-section">
            ${sectionHead('Opens anywhere TwoKit runs', 'The same file works in all three')}
            <div class="ex-hosts">
              ${HOSTS.map((h) => `<div class="ex-host"><b>${esc(h.title)}</b><small>${esc(h.desc)}</small></div>`).join('')}
            </div>
          </section>
        </div>
        <footer class="ex-foot">
          <button type="button" class="ex-cta" data-ex-action="twokit-project" data-fid="ex-cta-twokit-project">${I.download}<span>Export TwoKit project (.twokit.zip)</span></button>
          <p class="ex-meta">${meta}</p>
        </footer>
      </div>`;
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

const ExportScreen = {
    title: 'Export',
    previewModes: false,

    init() {
        ExportModule.init();
    },

    view() {
        const c = counts();
        const t = target();
        const control = `
          <div class="ex-side">
            <section class="ex-targets" aria-labelledby="exTargetsTitle">
              <header class="ex-intro"><h2 id="exTargetsTitle">Export to</h2><p>Pick a destination for your design system</p></header>
              <div class="ex-target-list" role="tablist" aria-orientation="vertical" aria-labelledby="exTargetsTitle">${targetList()}</div>
            </section>
            ${summary(c, t)}
          </div>`;
        const panels = { figma: figmaPanel, css: cssPanel, webapp: webappPanel, twokit: twokitPanel };
        const preview = (panels[t] || bricksPanel)(c);
        return { control, preview: `<div class="ex-view" data-ex-view="${t}">${preview}</div>` };
    },

    /** Figma counts need the built package (line heights are measured), so they fill in after render. */
    afterRender(control, preview) {
        if (target() !== 'figma') return;
        const token = (this.figmaRun = (this.figmaRun || 0) + 1);
        ExportModule.figmaPackage().then((pkg) => {
            if (token !== this.figmaRun) return;
            const values = { ...pkg.meta.counts, fonts: pkg.fonts.length };
            [...control.querySelectorAll('[data-ex-count]'), ...preview.querySelectorAll('[data-ex-count]')].forEach((el) => {
                const v = values[el.dataset.exCount];
                if (v != null) el.textContent = v;
            });
        }).catch((error) => {
            console.warn('[TwoKit] Figma counts:', error);
            [...control.querySelectorAll('[data-ex-count]'), ...preview.querySelectorAll('[data-ex-count]')].forEach((el) => { if (el.textContent === '…') el.textContent = '–'; });
        });
    },

    setRows(next) {
        AppState.updateExportPrefs({ rows: next });
    },

    onClick(event) {
        const tab = event.target.closest('[data-ex-target]');
        if (tab) {
            if (tab.dataset.exTarget !== target()) AppState.updateUi({ exportTarget: tab.dataset.exTarget });
            return;
        }
        const action = event.target.closest('[data-ex-action]');
        if (!action || action.disabled) return;
        const list = rows();
        switch (action.dataset.exAction) {
            case 'twokit-project':
                ProjectModule.exportProject();
                break;
            case 'toggle-summary':
                AppState.updateUi({ exportSummaryOpen: AppState.ui.exportSummaryOpen !== true });
                break;
            case 'add-row': {
                const part = BRICKS_PARTS.find((p) => !list.some((r) => r.part === p));
                if (part) this.setRows([...list, { part, scope: ExportModule.bricksScopes()[part][0].value }]);
                break;
            }
            case 'remove-row': {
                const index = Number(action.dataset.row);
                this.setRows(list.filter((_, i) => i !== index));
                break;
            }
            default:
        }
    },

    onSwitch({ id, value }) {
        const match = /^ex-(part|scope)-(\d+)$/.exec(id || '');
        if (!match) return;
        const list = rows().map((r) => ({ ...r }));
        const row = list[Number(match[2])];
        if (!row) return;
        if (match[1] === 'part') {
            if (!BRICKS_PARTS.includes(value) || list.some((r) => r !== row && r.part === value)) return;
            row.part = value;
            row.scope = ExportModule.bricksScopes()[value][0].value;
        } else if (row.part === 'styleManager') {
            // The Style manager row is the theme's default mode, the same setting as Theming → Settings.
            if (['auto', 'light', 'dark'].includes(value)) AppState.updateTheme({ defaultMode: value });
            return;
        } else {
            row.scope = value;
        }
        this.setRows(list);
    }
};

export default ExportScreen;
