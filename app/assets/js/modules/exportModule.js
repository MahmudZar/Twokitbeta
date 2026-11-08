/**
 * ExportModule
 *
 * Every export is built from the same data: palettes, the theme token model
 * (core/themeTokens.js), typography, spacing and layout.
 *
 *   Bricks  variables · color palette · theme style · classes · style manager
 *           and all of them as one unified global transfer zip (Bricks 2.4.1)
 *   Figma   one package for the TwoKit Figma plugin (core/figmaPackage.js):
 *           variables with modes, text styles, shadows, color styles, fonts
 *   CSS     "<Project> style guide" folder: variables.css, styles.css (reset,
 *           .tk-* element classes mirroring Bricks' .brxe-*, theme style,
 *           utilities), fonts.css + fonts/, and a starter index.html
 *   Fonts   every library font as WOFF2 (Google styles are downloaded at
 *           export), as Bricks custom fonts or as fonts/ + fonts.css
 *
 * @module exportModule
 */

import AppState from '../state/appState.js';
import ThemeTokens from '../core/themeTokens.js';
import { crc32, createZip } from '../core/zip.js';
import { currentTheme, paletteAlias, buttonContext } from '../state/themeModel.js';
import Notifications from '../ui/notifications.js';
import FontStore from '../core/fontStore.js';
import LayoutModule from './layoutModule.js';
import { stylingRows, stylingCss, colorVar } from '../core/stylingCss.js';
import { buttonRows, bricksButtonCss, cssColor } from '../core/buttonsCss.js';
import UtilitiesModule from './utilitiesModule.js';
import { UTILITY_GROUPS } from '../core/utilityClasses.js';
import { downloadFiles, cssUrl } from '../core/googleFonts.js';
import { htmlBaseCss, classMapComment, textCss, ELEMENT_PREFIX } from '../core/htmlStyles.js';
import { autoSpacingRows, autoSpacingCss, AUTO_SPACING_TARGETS } from '../core/autoSpacing.js';
import ProjectModule from './projectModule.js';
import { fontStack, fontVar, resolveRole, headingRole, bodyRole, faceWeight, sortFaces } from '../state/fontModel.js';
import { highlight } from '../ui/highlight.js';
import { buildFigmaPackage } from '../core/figmaPackage.js';
import { buildPickerCatalog } from '../core/pickerCatalog.js';
import { esc } from '../ui/components.js';
import { unsafeCssValue, unsafeCssBlock } from '../core/projectGuard.js';

/**
 * Line heights (and text wrap) on the text elements themselves, so the
 * ex-based formulas resolve at each element's own font size instead of
 * inheriting body's computed px. `text` adds the builder's text elements.
 */
const typeCss = (text) => textCss({ text, headingWrap: AppState.typography.textWrap, bodyWrap: AppState.typography.bodyTextWrap, bodySpacing: AppState.typography.bodyLetterSpacing });

/** Theme attribute in the HTML export: <html data-theme="dark">, on any element to nest. */
const HTML_THEME_ATTR = 'data-theme';

const BRICKS_VERSION = '2.4.1';
const LINE_HEIGHT_TOKENS = ['heading-line-height', 'text-line-height'];
const THEME_STYLE_ID = 'twokit_theme_styles';
const THEME_STYLE_LABEL = 'TwoKit Theme Styles';
const PALETTE_NAME = 'TwoKit';
/** Bricks class categories: "TwoKit - Buttons", "TwoKit - Gap", … */
const categoryName = (groupId) => `TwoKit - ${UTILITY_GROUPS.find((g) => g.id === groupId)?.label || groupId}`;

/** Bricks variable categories: "Tk Base", "Tk Brand - primary", "Tk Theme - tokens", … */
const variableCategoryName = (cat) => `Tk ${cat}`;


/**
 * Theme switches snap instead of animating: transitions pause page-wide while
 * a theme toggle is hovered (mouse, tap) or keyboard-focused, which is exactly
 * when it switches. Bricks' Toggle mode element, .theme-toggle and
 * [data-theme-toggle] all count. In Bricks the builder canvas (no
 * .bricks-is-frontend on body) never animates a theme change. :root, not
 * html: Bricks' block editor scoper keeps what follows :root (html:has(…)
 * lost its condition there and switched transitions off for good).
 */
const themeSwitchCss = ({ bricks = false } = {}) => `/* Theme switches snap: no transitions while a theme toggle is in use${bricks ? ', or in the builder canvas' : ''} */
:root:has(:is(.brxe-toggle-mode, .theme-toggle, [data-theme-toggle]):is(:hover, :focus-visible)) :is(*, *::before, *::after)${bricks ? ',\nbody:not(.bricks-is-frontend) :is(*, *::before, *::after)' : ''} {
  transition: none !important;
}`;

/** Bricks builder settings TwoKit sets, as on the reference site: structure duplicate / delete, media health, … */
const BRICKS_BUILDER_SETTINGS = {
    builderMode: 'dark',
    builderToolbarLogoLink: 'current',
    builderDisablePanelAutoExpand: true,
    builderResponsiveControlIndicator: 'any',
    builderMediaPicker: 'bricks',
    builderMediaHealthEnabled: '1',
    builderMediaHealthCheckOversized: '1',
    builderMediaHealthCheckMissingAlt: '1',
    builderMediaHealthCheckBroken: '1',
    builderMediaHealthCheckObsolete: '1',
    builderMediaHealthCheckDerivatives: '1',
    builderMediaHealthImageMaxSize: '1',
    builderMediaHealthFontMaxSize: '0.5',
    builderMediaHealthDocumentMaxSize: '5',
    builderMediaHealthAudioMaxSize: '10',
    builderMediaHealthVideoMaxSize: '50',
    builderMediaHealthObsoleteExtensions: 'bmp,tif,tiff',
    structureDuplicateElement: true,
    structureDeleteElement: true,
    structureCollapsed: true,
    structureAutoSync: true,
    importImageOnPaste: true,
    enableDynamicDataPreview: true,
    builderGlobalClassesImport: 'conflicts',
    builderHtmlCssConverter: 'confirm',
    builderInstantNavigation: true
};

/** Bricks export defaults: every part, whole scope. Fonts are always self-hosted. */
export function bricksDefaults() {
    return {
        parts: { variables: 'all', palette: 'all', theme: 'site', classes: 'all', styleManager: AppState.theme.defaultMode, settings: 'all' }
    };
}

/** The parts a Bricks package can hold, in their default order. */
export const BRICKS_PARTS = ['variables', 'palette', 'theme', 'classes', 'styleManager', 'settings'];

const encoder = new TextEncoder();

/**
 * A content hash of the fonts a Bricks package would carry (families, face
 * keys, file names and bytes), as hex. SHA-256 where the browser offers it
 * (secure contexts); otherwise two CRC-32s over the same data.
 */
async function fontsHash({ fonts, files }) {
    const parts = [encoder.encode(JSON.stringify(fonts.map((f) => [f.family, f.fontFaces])))];
    const bytesOf = (c) => (c instanceof Uint8Array ? c
        : c instanceof ArrayBuffer ? new Uint8Array(c)
            : ArrayBuffer.isView(c) ? new Uint8Array(c.buffer, c.byteOffset, c.byteLength)
                : encoder.encode(String(c)));
    for (const file of files) parts.push(encoder.encode(file.path), bytesOf(file.content));
    const size = parts.reduce((n, p) => n + p.length, 0);
    const all = new Uint8Array(size);
    let at = 0;
    for (const p of parts) { all.set(p, at); at += p.length; }
    if (globalThis.crypto?.subtle) {
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', all));
        return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
    return hex(crc32(all)) + hex(crc32(all.slice().reverse())) + hex(size);
}

/** Stable 6-letter Bricks id, so re-exports keep matching ids. */
function bricksId(seed) {
    let n = crc32(encoder.encode(`twokit:${seed}`));
    let id = '';
    for (let i = 0; i < 6; i++) {
        id += String.fromCharCode(97 + (n % 26));
        n = Math.floor(n / 26) || crc32(encoder.encode(`${seed}:${i}`));
    }
    return id;
}

const json = (data) => JSON.stringify(data, null, 4);

function slug(value) {
    return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'twokit';
}

const DEFAULT_PROJECT = 'Untitled project';

/**
 * Project name, safe as a file or folder name on every OS: no path or
 * reserved characters, no trailing dots/spaces (Windows), capped length.
 * An unnamed project exports as "TwoKit".
 */
export function projectName(raw = ProjectModule.meta?.name) {
    const name = String(raw || '')
        .normalize('NFC')
        .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80)
        .replace(/[. ]+$/, '');
    return !name || name.toLowerCase() === DEFAULT_PROJECT.toLowerCase() ? 'TwoKit' : name;
}

/** "Soco" → "Soco style guide" (a name that already ends that way is kept). */
export function styleGuideName(raw) {
    const name = projectName(raw);
    return /style ?guide$/i.test(name) ? name : `${name} style guide`;
}

/** Appends -2, -3… to a filename already taken (two fonts with the same family, for instance). */
function uniqueName(used, filename) {
    if (!used.has(filename)) {
        used.add(filename);
        return filename;
    }
    const dot = filename.lastIndexOf('.');
    const [base, ext] = dot > 0 ? [filename.slice(0, dot), filename.slice(dot)] : [filename, ''];
    let i = 2;
    while (used.has(`${base}-${i}${ext}`)) i++;
    used.add(`${base}-${i}${ext}`);
    return `${base}-${i}${ext}`;
}

/** CSS string: escapes quotes and backslashes (font family names). */
const cssString = (value) => `"${String(value).replace(/["\\]/g, '\\$&').replace(/[\n\r]/g, ' ')}"`;

const ExportModule = {
    lastLabel: '',

    init() {
        if (this.ready) return;
        this.ready = true;
        document.addEventListener('click', (event) => {
            const button = event.target.closest('[data-export]');
            if (!button) return;
            try {
                this.run(button.dataset.export);
            } catch (error) {
                console.error(error);
                Notifications.error('Export failed');
            }
        });
    },

    model() {
        return currentTheme();
    },

    /* ================================================================
       Shared token lists
       ================================================================ */

    /**
     * Non-theme variables as [category, name, value] rows.
     *
     * Rule: every CSS variable TwoKit generates must be listed here (or in
     * themeRows) so it ships as a Bricks variable and in the CSS export. A value
     * that the stylesheet sets conditionally (:has(), media queries) still gets
     * a plain default row, e.g. header-offset: 0px.
     */
    systemRows() {
        const rows = [];
        const { typography, spacing, layout } = AppState;
        const type = (n) => AppState.tokenName('type', n);
        const space = (n) => AppState.tokenName('spacing', n);

        if (spacing.enableFluidSpacing && spacing.fluidScale) {
            for (const s of spacing.fluidScale) rows.push(['Spacing - Fluid', space(s.name), s.clamp]);
        }
        if (spacing.enableFixedSpacing && spacing.fixedScale) {
            for (const s of spacing.fixedScale) rows.push(['Spacing - Fixed', space(s.name), s.valueRem]);
        }
        for (const font of AppState.fonts) rows.push(['Font family', fontVar(font), fontStack(font)]);
        const role = (value) => {
            const r = resolveRole(value);
            return r.font ? `var(--${fontVar(r.font)})` : r.stack;
        };
        rows.push(['Font family', type('font-heading'), role(typography.headingFont)]);
        rows.push(['Font family', type('font-body'), role(typography.bodyFont)]);
        const scale = typography.scale;
        if (scale) {
            for (const h of scale.headings) rows.push(['Font size', type(h.name), h.clamp]);
            for (const t of scale.textSizes || []) rows.push(['Font size', type(t.name), t.clamp]);
            const fixedBody = typography.enableBodySizes !== false;
            if (fixedBody) for (const b of scale.body) rows.push(['Font size', type(b.name), b.size]);
            // Only the two role line heights ship; per-size --lh-* tokens are retired.
            for (const lh of (scale.lineHeights || []).filter((l) => LINE_HEIGHT_TOKENS.includes(l.name))) rows.push(['Font line height', lh.name, lh.value]);
        }
        const g = layout.generated;
        if (g) {
            const p = g.sectionPadding;
            rows.push(['Layout', 'sctn-inline-padding', p.inlinePadding.value]);
            rows.push(['Layout', 'sctn-block-padding', p.blockPadding.value]);
            rows.push(['Layout', 'site-gutter', p.siteGutter.value]);
            for (const w of g.contentWidths) rows.push(['Layout', w.name, w.valueRem]);
            // Width full-bleed-left / -right measure from; the content-width-* classes set it on their element.
            rows.push(['Layout', 'bleed-container', 'var(--content-width)']);
            // Pickable in Bricks. --header-offset is 0 here; the theme stylesheet's
            // :root:has(#brx-header.brx-sticky…) rule (higher specificity) sets it for fixed headers.
            rows.push(['Layout', 'header-height', `${Number(layout.header?.height) || 0}px`]);
            // What fills the page behind the sections (html / Bricks site background).
            rows.push(['Theme - tokens', 'site-bg', cssColor(AppState.theme.siteBg || 'surface-0')]);
            rows.push(['Layout', 'header-offset', '0px']);
            for (const gap of g.gaps) rows.push(['Gaps', gap.name, gap.value]);
            rows.push(...autoSpacingRows(spacing.auto));
            for (const grid of [...g.gridTemplates, ...g.asymmetricGrids, ...g.autoGridTemplates]) rows.push(['Grid', grid.name, grid.value]);
        }
        rows.push(...stylingRows(AppState.styling, colorVar));
        rows.push(...buttonRows(AppState.buttons, buttonContext()));
        return rows;
    },

    /** Palette primitives as [category, name, value, hex] rows. */
    paletteRows() {
        const rows = [['Base', 'white', '#FFFFFF', '#FFFFFF'], ['Base', 'black', '#000000', '#000000']];
        for (const c of AppState.colors) {
            const alias = paletteAlias(c);
            if (alias) rows.push([`Brand - ${c.name}`, alias.name, alias.css, alias.hex]);
            for (const s of c.shades) rows.push([`Brand - ${c.name}`, AppState.tokenName('color', s.name), s.oklch || s.hex, s.hex]);
        }
        for (const c of AppState.stateColors) {
            const alias = paletteAlias(c);
            if (alias) rows.push([`State - ${c.name}`, alias.name, alias.css, alias.hex]);
            for (const s of c.shades || []) rows.push([`State - ${c.name}`, AppState.tokenName('color', s.name), s.oklch || s.hex, s.hex]);
        }
        return rows;
    },

    /** Theme variables as [category, name, value] rows (fixed values, tokens, aliases, shadows). */
    themeRows(model) {
        const rows = [];
        const tokens = ThemeTokens.tokens(model);
        for (const t of tokens) rows.push(['Theme - light values', `light-${t.name}`, t.light.css]);
        for (const t of tokens) rows.push(['Theme - dark values', `dark-${t.name}`, t.dark.css]);
        for (const t of tokens) rows.push(['Theme - tokens', t.name, `light-dark(var(--light-${t.name}), var(--dark-${t.name}))`]);
        for (const [alias, target] of [...model.aliases.surfaces, ...model.aliases.shadows]) rows.push(['Theme - aliases', alias, `var(--${target})`]);
        for (const [name, value] of ThemeTokens.layers()) rows.push(['Theme - interaction layers', name, value]);
        // Fixed shadows (never switch), like the light/dark color values.
        for (const [name, value] of ThemeTokens.shadowRows(model, 'light')) rows.push(['Shadows - light values', name, value]);
        for (const [name, value] of ThemeTokens.shadowRows(model, 'dark')) rows.push(['Shadows - dark values', name, value]);
        // Light by default; the theme stylesheet points these at the dark values per theme.
        model.shadows.light.forEach((_, i) => rows.push(['Shadows', `shadow-${i + 1}`, `var(--light-shadow-${i + 1})`]));
        // The opposite theme, for .theme-inverse / .inverse (the theme stylesheet switches these per theme).
        rows.push(['Shadows', 'inverse-scheme', 'dark']);
        model.shadows.dark.forEach((_, i) => rows.push(['Shadows', `inverse-shadow-${i + 1}`, `var(--dark-shadow-${i + 1})`]));
        return rows;
    },

    /**
     * The variable picker's data for the Bricks builder (WordPress plugin):
     * every exported variable, grouped, with swatch colors. Same rows as the
     * Bricks variables, so every name in the picker exists on the site.
     */
    pickerCatalog(model = this.model()) {
        const type = (n) => AppState.tokenName('type', n);
        const scale = AppState.typography.scale || {};
        const palettes = [...AppState.colors, ...AppState.stateColors].map((c) => {
            const alias = paletteAlias(c);
            return {
                name: c.name,
                base: alias ? { name: alias.name, hex: alias.hex } : null,
                shades: (c.shades || []).map((s) => ({ name: AppState.tokenName('color', s.name), hex: s.hex, isBase: !!s.isBase }))
            };
        });
        return buildPickerCatalog({
            model,
            palettes,
            rows: [...this.paletteRows().filter(([cat]) => cat === 'Base'), ...this.systemRows()],
            themeRows: this.themeRows(model),
            fontSizes: {
                headings: (scale.headings || []).map((h) => type(h.name)),
                fluid: (scale.textSizes || []).map((t) => type(t.name)),
                fixed: (scale.body || []).map((b) => type(b.name))
            },
            mode: AppState.theme.defaultMode
        });
    },

    /* ================================================================
       Bricks
       ================================================================ */

    /**
     * Variables; `scope` is 'all' or one category ("Tk Font size", or the plain
     * "Font size" an older saved export setting holds).
     *
     * In Bricks every TwoKit category starts with "Tk " (Tk Base, Tk Brand - primary,
     * Tk Theme - tokens …), so a site's own categories and TwoKit's are told apart
     * at a glance in Bricks' Variables manager. Only Bricks gets the prefix; the
     * CSS files, the HTML & CSS export and the picker keep the plain names.
     */
    bricksVariables(model = this.model(), scope = 'all') {
        const categories = [];
        const byName = new Map();
        const category = (raw) => {
            const name = variableCategoryName(raw);
            if (!byName.has(name)) {
                const id = bricksId(`cat:${name}`);
                byName.set(name, id);
                categories.push({ id, name });
            }
            return byName.get(name);
        };
        const variables = this.variableRows(model)
            .filter(([cat]) => scope === 'all' || cat === scope || variableCategoryName(cat) === scope)
            .map(([cat, name, value]) => ({ id: bricksId(`var:${name}`), name, value: String(value), category: category(cat) }));
        return { variables, categories };
    },

    /** Every variable as [category, name, value] (palette, theme, system). */
    variableRows(model = this.model()) {
        return [
            ...this.paletteRows().map(([cat, name, value]) => [cat, name, value]),
            ...this.themeRows(model),
            ...this.systemRows()
        ];
    },

    /**
     * Ids of the variable categories TwoKit wrote before the "Tk " prefix (1.0.16 and
     * earlier: "Base", "Brand - primary" …). Ids are made from the name, so they are
     * the same on every site, also after a manual Bricks import. WordPress removes
     * them once empty.
     */
    legacyVariableCategoryIds(model = this.model()) {
        return [...new Set(this.variableRows(model).map(([cat]) => cat))].map((cat) => bricksId(`cat:${cat}`));
    },

    /**
     * Bricks color palette: var() only. If a palette color also carries a
     * hex/light value, Bricks writes `--name: <that value>` into :root
     * (includes/assets.php, generate_inline_css_color_vars), which overrides
     * our light-dark() tokens and freezes them in light mode.
     */
    bricksPalette(model = this.model(), scope = 'all') {
        const aliases = [...AppState.colors, ...AppState.stateColors]
            .map(paletteAlias)
            .filter(Boolean)
            .map((a) => ({ name: a.name, hex: a.hex }));
        const shades = [...AppState.colors, ...AppState.stateColors].flatMap((c) =>
            (c.shades || []).map((s) => ({
                name: AppState.tokenName('color', s.name),
                hex: s.hex
            }))
        );
        const tokens = ThemeTokens.tokens(model).map((t) => ({ name: t.name, hex: t.light.hex }));
        return {
            id: bricksId('palette'),
            name: PALETTE_NAME,
            // scope: 'all', 'theme' (the light-dark() tokens people paint with) or 'shades' (palette primitives).
            colors: (scope === 'theme' ? tokens : scope === 'shades' ? [{ name: 'white' }, { name: 'black' }, ...aliases, ...shades] : [{ name: 'white' }, { name: 'black' }, ...aliases, ...tokens, ...shades]).map(({ name }) => ({
                id: bricksId(`color:${name}`),
                name,
                raw: `var(--${name})`
            }))
        };
    },

    themeStylesheet(model = this.model()) {
        const bodyColor = AppState.typography.bodyColor || 'var(--text-secondary)';
        const inverse = AppState.theme.enableInverse
            ? `\n\n/* Inverse: this part of the page in the opposite theme (colors, borders, hover, shadows) */\n${ThemeTokens.inverseCss(model, '.inverse', { bg: 'var(--surface-2)', color: bodyColor })}`
            : '';
        // Auto without an attribute yet. Never in the block editor canvas (Bricks rewrites
        // :root to .block-editor-iframe__html there, so this can't match): the editor
        // around it is light, so the canvas stays light too.
        const auto = AppState.theme.defaultMode === 'auto'
            ? `\n\n@media (prefers-color-scheme: dark) {\n  :root:not([data-brx-theme]):not(.block-editor-iframe__html) {\n${ThemeTokens.contextVars(model, 'dark').map((l) => `    ${l}`).join('\n')}\n  }\n}`
            : '';
        // Block editor canvas: white like WordPress' own canvas, not the site background
        // from the theme style (Bricks copies that into the editor). It must be a color:
        // Bricks removes WordPress' white editor reset and the theme style clears body's
        // background, so a transparent <html> showed the editor frame behind the iframe
        // (gray or dark). The zoom-out frame keeps WordPress' look. Everything inside
        // (fonts, components, light colors) stays as on the site.
        const editor = `\n\n/* Block editor canvas: white like WordPress' own, not the site background */\n.block-editor-iframe__html:not(.is-zoomed-out) {\n  background-color: #fff;\n}`;
        // The fixed --light-* / --dark-* values and the light-dark() tokens are Bricks
        // variables (themeRows): Bricks prints them on the site, in the canvas and in the
        // block editor, and closed mode writes them to twokit-tokens.css, which loads
        // before this. Writing them here too only doubled them on every page.
        return `/* TwoKit theme styles · light, dark and auto (Bricks Style manager).
   Theme switch and shadows; the theme values themselves are Bricks variables. */

${ThemeTokens.switchCss(model, { bricks: true })}${auto}${editor}

${LayoutModule.headerCss()}

${stylingCss(AppState.styling)}

${typeCss('[class*="brxe-text"]')}

${autoSpacingCss(AppState.spacing.auto, { targets: AUTO_SPACING_TARGETS.bricks })}

${bricksButtonCss(AppState.buttons, buttonContext())}${inverse}

${themeSwitchCss({ bricks: true })}`;
    },

    /** `scope`: 'site' applies it to the whole website; 'none' leaves conditions to set in Bricks. */
    bricksThemeStyle(model = this.model(), scope = 'site') {
        const t = AppState.typography;
        const type = (n) => `var(--${AppState.tokenName('type', n)})`;
        const color = (value, fallback) => ({ raw: String(value || fallback) });
        return {
            id: THEME_STYLE_ID,
            label: THEME_STYLE_LABEL,
            settings: {
                _custom: true,
                conditions: { conditions: scope === 'none' ? [] : [{ id: bricksId('condition'), main: 'any' }] },
                // Theme style → General → Site background (Bricks paints html and clears body).
                general: { siteBackground: { color: color('var(--site-bg)') } },
                links: { typography: { color: color('var(--action)') } },
                typography: {
                    typographyHtml: '100%',
                    typographyBody: {
                        'font-size': t.bodyFontSize || type('text-16'),
                        'font-weight': t.bodyWeight,
                        'line-height': 'var(--text-line-height)',
                        'letter-spacing': t.bodyLetterSpacing || '0em',
                        color: color(t.bodyColor, 'var(--text-secondary)'),
                        'font-family': bodyRole().family || bodyRole().stack,
                        // Bricks' own "Fallback fonts" field: it writes "Family", fallback.
                        fallback: bodyRole().fallback || undefined
                    },
                    typographyHeadings: {
                        'font-family': headingRole().family || headingRole().stack,
                        fallback: headingRole().fallback || undefined,
                        'font-weight': t.headingWeight,
                        'line-height': 'var(--heading-line-height)',
                        'letter-spacing': t.headingLetterSpacing,
                        color: color(t.headingColor, 'var(--text-primary)')
                    },
                    typographyHeadingH1: { 'font-size': type('h1') },
                    typographyHeadingH2: { 'font-size': type('h2') },
                    typographyHeadingH3: { 'font-size': type('h3') },
                    typographyHeadingH4: { 'font-size': type('h4') }
                },
                section: {
                    _rowGap: 'var(--container-gap)',
                    _columnGap: 'var(--container-gap)',
                    padding: {
                        top: 'var(--sctn-block-padding)',
                        bottom: 'var(--sctn-block-padding)',
                        left: 'var(--sctn-inline-padding)',
                        right: 'var(--sctn-inline-padding)'
                    }
                },
                container: {
                    width: '100%',
                    widthMax: 'var(--content-width)',
                    _columnGap: 'var(--grid-gap)',
                    _rowGap: 'var(--grid-gap)'
                },
                div: { _display: 'flex', _direction: 'column' },
                css: { stylesheet: this.themeStylesheet(model) }
            }
        };
    },

    /**
     * The theme style's base settings as plain CSS (html, body, headings), for
     * the WordPress plugin's closed mode on a site without Bricks: there is no
     * Bricks theme style to hold them, so twokit.css does. With Bricks the theme
     * style stays in Bricks and this isn't used. Built from bricksThemeStyle(),
     * so the two never drift.
     */
    themeStyleCss(model = this.model()) {
        const s = this.bricksThemeStyle(model).settings;
        const t = s.typography;
        const raw = (v) => (v && typeof v === 'object' ? v.raw : v);
        const block = (selector, props) => {
            const body = Object.entries(props).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}:${raw(v)}`).join(';');
            return body ? `${selector}{${body}}` : '';
        };
        // Bricks writes the family name; TwoKit's font variables carry the whole stack.
        // `fallback` is a Bricks field, not a CSS property: the variable already has it.
        const font = ({ fallback, ...props }, role) => ({ ...props, 'font-family': `var(--${AppState.tokenName('type', role)})` });
        return [
            block('html', { 'font-size': t.typographyHtml, background: s.general.siteBackground.color }),
            block('body', font(t.typographyBody, 'font-body')),
            block('h1,h2,h3,h4,h5,h6', font(t.typographyHeadings, 'font-heading')),
            ...[1, 2, 3, 4, 5, 6].map((n) => (t[`typographyHeadingH${n}`] ? block(`h${n}`, t[`typographyHeadingH${n}`]) : ''))
        ].filter(Boolean).join('\n');
    },

    /** Utility classes as Bricks global classes, one category per group. CSS lives in each class's CSS panel. */
    bricksClasses(scope = 'all') {
        const list = UtilitiesModule.classes().filter((c) => scope === 'all' || c.group === scope);
        const categories = [...new Set(list.map((c) => c.group))].map((g) => ({ id: bricksId(`cat:${categoryName(g)}`), name: categoryName(g) }));
        const catId = Object.fromEntries(categories.map((c) => [c.name, c.id]));
        const classes = list.map((c) => ({
            id: bricksId(`class:${c.name}`),
            name: c.name,
            settings: { _cssCustom: c.css },
            category: catId[categoryName(c.group)]
        }));
        return { classes, categories };
    },

    /**
     * Bricks settings (Settings → Builder / Performance), as one transfer
     * file. Bricks replaces a whole tab on import, so only these two tabs
     * ship; General, Custom code and the rest are never touched.
     *
     * Google Fonts are always turned off: TwoKit never links the Google CDN.
     * Library fonts from Google ship self-hosted (WOFF2 custom fonts in the
     * package / fonts zip), uploads are custom fonts, so Bricks has nothing to
     * load from Google (faster, no third-party request, GDPR-safe). Custom
     * fonts are preloaded when there are any.
     */
    bricksSettings(scope = 'all') {
        const fonts = AppState.fonts || [];
        const performance = { disableGoogleFonts: true };
        if (fonts.length) performance.customFontsPreload = true;
        const tabs = {};
        if (scope === 'all' || scope === 'builder') tabs.builder = { settings: { ...BRICKS_BUILDER_SETTINGS } };
        if (scope === 'all' || scope === 'performance') tabs.performance = { settings: performance };
        return { version: 1, tabs };
    },

    bricksStyleManager(mode = AppState.theme.defaultMode) {
        return { styleManager: { defaultMode: mode }, version: BRICKS_VERSION };
    },

    /**
     * Every library file as bytes: local files from IndexedDB, Google styles
     * downloaded as WOFF2 (Core Framework does the same when self-hosting).
     * One asset per file; `keys` lists the styles it serves (several when a
     * Google family is variable) and `face` spans them.
     *
     * `onError(font, error)`: when given, a font that fails (offline, or an
     * uploaded file missing from IndexedDB) is reported and skipped instead of
     * failing the whole export.
     * @returns {Promise<{ font, face, keys, bytes, format, filename }[]>}
     */
    async fontAssets({ onError, only } = {}) {
        const assets = [];
        const used = new Set();
        for (const font of AppState.fonts.filter((f) => !only || only(f))) {
            try {
                assets.push(...await this.fontFiles(font, used));
            } catch (error) {
                if (!onError) throw error;
                console.warn(error);
                onError(font, error);
            }
        }
        return assets;
    },

    /** One library font's files (all or nothing). `used` keeps filenames unique across fonts. */
    async fontFiles(font, used) {
        const assets = [];
        const name = font.family.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'font';
        if (font.source === 'google') {
            const faces = sortFaces(font.faces);
            const byKey = Object.fromEntries(faces.map((f) => [f.key, f]));
            for (const { keys, bytes } of await downloadFiles(font.family, faces.map((f) => f.key))) {
                const weights = keys.map((k) => byKey[k].weight);
                const first = byKey[keys[0]];
                const face = keys.length > 1
                    ? { ...first, variable: { min: Math.min(...weights), max: Math.max(...weights) } }
                    : first;
                const label = keys.length > 1 ? `${face.variable.min}-${face.variable.max}${first.style === 'italic' ? 'italic' : ''}` : first.key;
                assets.push({ font, face, keys, bytes, format: 'woff2', filename: uniqueName(used, `${name}-${label}.woff2`) });
            }
            return assets;
        }
        for (const face of sortFaces(font.faces)) {
            const bytes = await FontStore.get(face.fileId);
            if (!bytes) throw new Error(`${font.family} ${face.key} is missing its file. Re-upload it in Fonts.`);
            const format = face.format || 'woff2';
            assets.push({ font, face, keys: [face.key], bytes, format, filename: uniqueName(used, `${name}-${face.key}.${format}`) });
        }
        return assets;
    },

    /** Bricks custom fonts (styles/custom-fonts) in the 2.4.1 transfer format. */
    bricksFonts(assets) {
        const byFont = new Map();
        for (const asset of assets) {
            if (!byFont.has(asset.font.id)) byFont.set(asset.font.id, []);
            byFont.get(asset.font.id).push(asset);
        }
        const fonts = [];
        const files = [];
        for (const [fontId, list] of byFont) {
            const { font } = list[0];
            const postId = 900000 + (crc32(encoder.encode(`font:${fontId}`)) % 90000);
            const fontFaces = {};
            for (const asset of list) {
                const attachmentId = 900000 + (crc32(encoder.encode(`file:${fontId}:${asset.filename}`)) % 90000);
                const path = `styles/custom-fonts/assets/${attachmentId}/${asset.filename}`;
                const entry = { [asset.format]: { path, filename: asset.filename, mimeType: `font/${asset.format}`, attachmentId } };
                // Bricks keys faces by weight + "italic". A shared (variable) Google file is listed under each
                // weight it serves; an uploaded variable font sits under its lowest weight.
                const keys = asset.font.source === 'google'
                    ? asset.keys
                    : [`${asset.face.variable ? asset.face.variable.min : asset.face.weight}${asset.face.style === 'italic' ? 'italic' : ''}`];
                for (const key of keys) (fontFaces[key] ||= []).push(entry);
                files.push({ path, content: asset.bytes });
            }
            const path = `styles/custom-fonts/custom-font-${postId}.json`;
            fonts.push({ id: `custom_font_${postId}`, postId, family: font.family, fontFaces, path });
        }
        return { fonts, files };
    },

    /**
     * Bricks 2.4.1 unified global transfer (Bricks → Import → global data zip).
     *
     * `options.parts`: { variables, palette, theme, classes, styleManager } →
     * scope, only the parts to ship (see ExportScreen). Every library font
     * ships self-hosted as WOFF2 custom fonts.
     */
    async bricksPackage(model = this.model(), options = bricksDefaults()) {
        const parts = options.parts || {};
        const has = (part) => Object.prototype.hasOwnProperty.call(parts, part);
        const type = (id, label, categories, items) => ({ id, label, group: 'style', singleton: false, count: items.length, categories, items });
        const types = {};
        const files = [];
        // Bricks prints variable values, class CSS and the theme stylesheet raw inside a
        // <style> tag: anything that could end it (or a CSS rule) never reaches Bricks.
        const unsafe = [];
        const VALID_NAME = /^-?[A-Za-z_][A-Za-z0-9_-]*$/;
        const deepMarkup = (value, where) => {
            if (typeof value === 'string') {
                if (unsafeCssBlock(value)) unsafe.push(where);
            } else if (value && typeof value === 'object') {
                for (const v of Object.values(value)) deepMarkup(v, where);
            }
        };

        if (has('theme')) {
            const theme = this.bricksThemeStyle(model, parts.theme);
            deepMarkup(theme.settings, 'theme style');
            // WordPress closed mode: Bricks keeps every setting (site background, typography,
            // section padding, container width…); only the stylesheet moves to twokit.css.
            if (options.cssInBricks === false) theme.settings.css = { stylesheet: '' };
            const themePath = `styles/theme-styles/${slug(theme.label)}-${theme.id}.json`;
            types['theme-styles'] = type('theme-styles', 'Theme styles', [], [{ id: theme.id, label: theme.label, path: themePath, category: '' }]);
            files.push({ path: themePath, content: json(theme) });
        }
        if (has('variables')) {
            const vars = this.bricksVariables(model, parts.variables);
            // Closed mode: names only. Bricks lists them in its variable picker but prints no
            // CSS for an empty value (assets.php format_variables_as_css); the values are in twokit-tokens.css.
            if (options.cssInBricks === false) for (const v of vars.variables) v.value = '';
            for (const v of vars.variables) {
                if (!VALID_NAME.test(v.name) || unsafeCssValue(v.value)) unsafe.push(`--${v.name}`);
            }
            if (vars.variables.length) {
                types.variables = type('variables', 'Variables', vars.categories, vars.variables.map((v) => ({
                    id: v.id, label: v.name, path: 'styles/variables/variables.json', category: v.category
                })));
                files.push({ path: 'styles/variables/variables.json', content: json(vars.variables) });
                files.push({ path: 'styles/variables/categories.json', content: json(vars.categories) });
            }
        }
        if (has('palette')) {
            const palette = this.bricksPalette(model, parts.palette);
            for (const c of palette.colors) {
                if (['raw', 'light', 'dark'].some((k) => unsafeCssValue(c[k]))) unsafe.push(`palette ${c.raw || c.id}`);
            }
            const palettePath = `styles/color-palettes/${slug(palette.name)}-${palette.id}.json`;
            if (palette.colors.length) {
                types['color-palettes'] = type('color-palettes', 'Color palette', [{ id: palette.id, name: palette.name }], palette.colors.map((c, i) => ({
                    id: `${palette.id}:${c.id}`, label: c.raw.slice(6, -1), path: palettePath, category: palette.id, meta: c.raw, colorId: c.id, colorIndex: i
                })));
                files.push({ path: palettePath, content: json(palette) });
            }
        }
        if (has('classes')) {
            const { classes, categories: classCats } = this.bricksClasses(parts.classes);
            // Closed mode: names only, for the class picker; the CSS is in twokit.css.
            if (options.cssInBricks === false) for (const c of classes) c.settings = {};
            for (const c of classes) {
                if (!VALID_NAME.test(c.name)) unsafe.push(`.${c.name}`);
                else deepMarkup(c.settings, `.${c.name}`);
            }
            if (classes.length) {
                types.classes = type('classes', 'Classes', classCats, classes.map((c) => ({
                    id: c.id, label: c.name, path: 'styles/classes/classes.json', category: c.category
                })));
                files.push({ path: 'styles/classes/classes.json', content: json(classes) });
                files.push({ path: 'styles/classes/categories.json', content: json(classCats) });
            }
        }
        if (unsafe.length) {
            const list = [...new Set(unsafe)];
            throw new Error(`These values can't go to Bricks because they could break the page's CSS: ${list.slice(0, 6).join(', ')}${list.length > 6 ? '…' : ''}. Check them in TwoKit and try again.`);
        }

        // `skipMissingFonts`: a font this browser can't produce (an upload saved from another
        // browser, or offline) is left out; Bricks keeps the copy it already has.
        const assets = await this.fontAssets(options.skipMissingFonts ? { onError: (font) => (options.skippedFonts ||= []).push(font.family) } : {});
        const customFonts = this.bricksFonts(assets);
        // WordPress: Bricks' importer uploads every font file again on each import, so
        // fonts are only sent when they changed (same hash as the ones Bricks has: left out).
        options.fontFamilies = customFonts.fonts.map((f) => f.family);
        options.fontNames = Object.fromEntries(customFonts.fonts.map((f) => [f.id, f.family]));
        options.fontsHash = customFonts.fonts.length ? await fontsHash(customFonts) : '';
        options.fontsUnchanged = !!options.knownFontsHash && options.knownFontsHash === options.fontsHash;
        if (customFonts.fonts.length && !options.fontsUnchanged) {
            types['custom-fonts'] = type('custom-fonts', 'Custom fonts', [], customFonts.fonts.map((f) => ({
                id: f.id, label: f.family, path: f.path, category: '', meta: 1, postId: f.postId
            })));
            for (const { path, ...font } of customFonts.fonts) files.push({ path, content: json(font) });
            files.push(...customFonts.files);
        }

        if (has('settings')) {
            // Every library font ships above as a custom font, so Google Fonts can go.
            const settings = this.bricksSettings(parts.settings);
            const labels = { builder: 'Builder', performance: 'Performance' };
            const tabs = Object.keys(settings.tabs);
            if (tabs.length) {
                types.settings = {
                    id: 'settings', label: 'Settings', group: 'settings', singleton: false, count: tabs.length, categories: [],
                    items: tabs.map((id) => ({ id, label: labels[id], path: 'settings/wp-dashboard/settings.json', category: '' }))
                };
                files.push({ path: 'settings/wp-dashboard/settings.json', content: json(settings) });
            }
        }

        const manifest = {
            schema: 'bricks/unified-global-transfer',
            version: 1,
            createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00'),
            site: { name: projectName(), homeUrl: '', bricksVersion: BRICKS_VERSION },
            selectedTypes: Object.keys(types),
            types
        };
        files.unshift({ path: 'manifest.json', content: json(manifest) });
        // Not a transfer type in Bricks; kept alongside for Style manager → Import.
        if (has('styleManager')) files.push({ path: 'twokit/bricks-style-manager-settings.json', content: json(this.bricksStyleManager(parts.styleManager || AppState.theme.defaultMode)) });
        // Bricks ignores it; the TwoKit Figma plugin reads it straight from this zip.
        const figma = await this.figmaPackageSafe();
        if (figma) files.push({ path: `twokit/${this.figmaFileName()}`, content: figma });
        return { zip: createZip(files), manifest, files };
    },

    /* ================================================================
       Figma
       ================================================================ */

    /**
     * The one Figma export: variables (with modes and aliases), text styles,
     * shadows, optional color styles and fonts, for the TwoKit Figma plugin
     * (app/figma-plugin). Also shipped inside the style guide and Bricks zips.
     */
    figmaPackage() {
        return buildFigmaPackage({ name: projectName() });
    },

    /** The package as JSON text, or null (with a console warning) so a zip export never fails on it. */
    async figmaPackageSafe() {
        try {
            return JSON.stringify(await this.figmaPackage(), null, 2);
        } catch (error) {
            console.warn('[TwoKit] Figma package skipped:', error);
            return null;
        }
    },

    figmaFileName() {
        return `${slug(projectName())}.twokit-figma.json`;
    },

    /** The plugin itself, zipped from app/figma-plugin, ready for Figma → Plugins → Development → Import. */
    async figmaPluginZip() {
        const folder = 'TwoKit Figma plugin';
        const names = ['manifest.json', 'code.js', 'ui.html', 'README.md'];
        const files = [];
        for (const name of names) {
            const response = await fetch(new URL(`../../../figma-plugin/${name}`, import.meta.url));
            if (!response.ok) throw new Error(`Could not read the plugin file ${name}`);
            files.push({ path: `${folder}/${name}`, content: await response.text() });
        }
        return createZip(files);
    },

    /* ================================================================
       CSS
       ================================================================ */

    /** Rows as one :root block, with a comment per category. */
    rootBlock(rows) {
        const lines = [];
        let last = null;
        for (const [cat, name, value] of rows) {
            if (cat !== last) {
                if (last !== null) lines.push('');
                lines.push(`  /* ${cat} */`);
                last = cat;
            }
            lines.push(`  --${name}: ${value};`);
        }
        return `:root {\n${lines.join('\n')}\n}`;
    },

    /** variables.css: palette, theme tokens (light/dark via [data-theme]) and every system token. */
    variablesCss(model = this.model()) {
        const auto = AppState.theme.defaultMode === 'auto' ? ' Without it, the OS setting decides.' : '';
        return `${[
            `/* ${projectName()} · design tokens, generated by TwoKit.
   Theme: <html ${HTML_THEME_ATTR}="light|dark">, or put the attribute on any element
   to switch just that part of the page.${auto} */`,
            this.rootBlock(this.paletteRows()),
            ThemeTokens.toCss(model, { attr: HTML_THEME_ATTR, defaultMode: AppState.theme.defaultMode }),
            this.rootBlock(this.systemRows())
        ].join('\n\n')}\n`;
    },

    /**
     * styles.css: reset, typography and .tk-* element classes (the Bricks
     * frontend + TwoKit theme style), header offset, focus/transition/radius/
     * selection, inverse and the utility classes. Needs variables.css first.
     */
    stylesCss() {
        const t = AppState.typography;
        const type = (n) => `var(--${AppState.tokenName('type', n)})`;
        const headings = (t.scale?.headings || [])
            .filter((h) => /^h[1-6]$/.test(h.name))
            .map((h) => ({ tag: h.name, size: type(h.name) }));
        const bodySize = t.bodyFontSize || (t.enableBodySizes !== false ? type('text-16') : '1rem');
        const inverse = AppState.theme.enableInverse
            ? `/* Inverse: this part of the page in the opposite theme (colors, borders, hover, shadows) */\n${ThemeTokens.inverseCss(this.model(), '.inverse', { bg: 'var(--surface-2)', color: t.bodyColor || 'var(--text-secondary)' })}`
            : '';
        const classes = UtilitiesModule.css();
        return `${[
            `/* ${projectName()} · styles, generated by TwoKit.
   Load after variables.css (and fonts.css). Element classes use the .${ELEMENT_PREFIX}- prefix;
   utility classes come last, so they override element defaults. */`,
            classMapComment(),
            htmlBaseCss({
                typography: t,
                bodyFont: type('font-body'),
                headingFont: type('font-heading'),
                bodySize,
                headings
            }),
            LayoutModule.headerCss({ html: true }),
            stylingCss(AppState.styling, { root: ':root', html: true }),
            autoSpacingCss(AppState.spacing.auto, { targets: AUTO_SPACING_TARGETS.html }),
            inverse,
            themeSwitchCss(),
            classes ? `/* Utility classes */\n${classes}` : ''
        ].filter(Boolean).join('\n\n')}\n`;
    },

    /** variables.css + styles.css as one stylesheet (fonts are separate: they need their files). */
    css(model = this.model()) {
        return `${this.variablesCss(model)}\n${this.stylesCss()}`;
    },

    /** Starter page that links the stylesheets and shows the element classes in use. */
    indexHtml(title, { fonts = false } = {}) {
        const p = ELEMENT_PREFIX;
        const buttons = UtilitiesModule.classes()
            .filter((c) => c.group === 'buttons' && !/-(s|l)$/.test(c.name))
            .map((c) => c.name);
        const solid = buttons[0] || '';
        const alt = buttons.find((n) => /outline|ghost|secondary/.test(n)) || buttons[1] || '';
        const cls = (...names) => names.filter(Boolean).join(' ');
        const mode = AppState.theme.defaultMode;
        const attr = mode === 'auto' ? '' : ` ${HTML_THEME_ATTR}="${mode === 'dark' ? 'dark' : 'light'}"`;
        const flip = mode === 'dark' ? 'light' : 'dark';
        return `<!doctype html>
<html lang="en"${attr}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
${fonts ? '  <link rel="stylesheet" href="fonts.css">\n' : ''}  <link rel="stylesheet" href="variables.css">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main>
    <section class="${p}-section">
      <div class="${p}-container">
        <h1 class="${p}-heading">${esc(projectName())}</h1>
        <p class="${p}-paragraph">A starter page for your style guide. Sections, containers and text use the .${p}-* element classes; the rest comes from the utility classes in styles.css.</p>
        <div class="${p}-block" style="flex-direction: row; flex-wrap: wrap; gap: var(--content-gap);">
          <a class="${cls(`${p}-button`, solid)}" href="#">Get started</a>
          <button type="button" class="${cls(`${p}-button`, alt)}" onclick="var r = document.documentElement; r.setAttribute('${HTML_THEME_ATTR}', getComputedStyle(r).colorScheme.indexOf('dark') > -1 ? 'light' : 'dark');">Toggle theme</button>
        </div>
      </div>
    </section>
    <section class="${p}-section" ${HTML_THEME_ATTR}="${flip}" style="background-color: var(--surface-1); color: var(--text-secondary);">
      <div class="${p}-container">
        <h2 class="${p}-heading">A ${flip} section</h2>
        <div class="${p}-text">
          <p>${HTML_THEME_ATTR}="${flip}" on any element switches its tokens, so one page can mix light and dark sections.</p>
          <p>Headings, paragraphs and <a href="#">links</a> pick up the theme style.</p>
        </div>
      </div>
    </section>
  </main>
</body>
</html>
`;
    },

    /**
     * The HTML/CSS style guide: "<Project> style guide/" with variables.css,
     * styles.css, index.html and (with a font library) fonts.css + fonts/.
     * A font that cannot be packaged does not stop the export: Google fonts
     * fall back to an @import of Google Fonts, missing uploads are listed.
     */
    async cssPackage(model = this.model()) {
        const folder = styleGuideName();
        const skipped = [];
        const hasFonts = AppState.fonts.length > 0;
        const assets = hasFonts ? await this.fontAssets({ onError: (font) => skipped.push(font) }) : [];
        const files = [
            { path: 'variables.css', content: this.variablesCss(model) },
            { path: 'styles.css', content: this.stylesCss() },
            { path: 'index.html', content: this.indexHtml(folder, { fonts: hasFonts }) }
        ];
        const figma = await this.figmaPackageSafe();
        if (figma) files.push({ path: `figma/${this.figmaFileName()}`, content: figma });
        if (hasFonts) {
            files.push({ path: 'fonts.css', content: this.fontFaceCss(assets, { vars: false, skipped }) });
            for (const a of assets) files.push({ path: `fonts/${a.filename}`, content: a.bytes });
        }
        return { folder, skipped, files: files.map((f) => ({ ...f, path: `${folder}/${f.path}` })) };
    },

    /** Folder name of the web app kit: "Soco web app". */
    webAppName() {
        return `${projectName()} web app`;
    },

    /**
     * The web app kit (core/shadcnKit.js): a React + Tailwind + shadcn/ui
     * starter linked to these tokens. The components load only here.
     */
    async shadcnPackage(model = this.model()) {
        const [{ buildShadcnKit }, shadcn] = await Promise.all([import('../core/shadcnKit.js'), import('../data/shadcnComponents.js')]);
        const folder = this.webAppName();
        const skipped = [];
        const assets = AppState.fonts.length ? await this.fontAssets({ onError: (font) => skipped.push(font) }) : [];
        // Palette shades as their token names, grouped per palette ("primary-500").
        const palettes = [...AppState.colors, ...AppState.stateColors].map((c) => ({
            shades: (c.shades || []).map((s) => AppState.tokenName('color', s.name))
        }));
        const headings = (AppState.typography.scale?.headings || [])
            .filter((h) => /^h[1-6]$/.test(h.name))
            .map((h) => ({ tag: h.name, token: AppState.tokenName('type', h.name) }));
        const files = buildShadcnKit({
            name: projectName(),
            folder,
            slug: slug(folder),
            variablesCss: this.variablesCss(model),
            mode: AppState.theme.defaultMode,
            palettes,
            headings,
            fonts: AppState.fonts.length
                ? { fontsCss: this.fontFaceCss(assets, { vars: false, skipped }), files: assets.map((a) => ({ path: a.filename, content: a.bytes })) }
                : null,
            shadcn: { files: shadcn.SHADCN_FILES, components: shadcn.SHADCN_COMPONENTS, packages: shadcn.SHADCN_PACKAGES }
        });
        return { folder, skipped, files, components: shadcn.SHADCN_COMPONENTS };
    },

    /* ================================================================
       Actions
       ================================================================ */

    run(kind) {
        const model = this.model();
        const skippedMessage = (skipped) => `Exported without ${skipped.map((f) => f.family).join(', ')} files. See fonts.css`;
        const actions = {
            'bricks-all': () => this.busy('Packaging Bricks global data', async () => {
                const options = this.bricksOptions();
                if (!Object.keys(options.parts).length) {
                    Notifications.info('Add at least one item to the Bricks package');
                    return;
                }
                const { zip, files } = await this.bricksPackage(model, options);
                const date = new Date().toISOString().slice(0, 10);
                this.downloadFile(zip, `${projectName()} bricks global data ${date}.zip`, 'application/zip');
                this.showPreview('Bricks global data (.zip)', `${files.map((f) => f.path).join('\n')}\n\n── manifest.json ──\n${files[0].content}`);
                Notifications.success('Bricks global data exported');
            }),
            'css-all': () => this.busy('Packaging style guide', async () => {
                const { folder, files, skipped } = await this.cssPackage(model);
                this.downloadFile(createZip(files), `${folder}.zip`, 'application/zip');
                const styles = files.find((f) => f.path.endsWith('/styles.css'));
                this.showPreview(`${folder} (.zip)`, `${files.map((f) => f.path).join('\n')}\n\n── styles.css ──\n${styles.content}`);
                if (skipped.length) Notifications.error(skippedMessage(skipped));
                else Notifications.success(`${folder} exported`);
            }),
            'shadcn-all': () => this.busy('Packaging the web app kit', async () => {
                const { folder, files, skipped, components } = await this.shadcnPackage(model);
                this.downloadFile(createZip(files), `${folder}.zip`, 'application/zip');
                const css = files.find((f) => f.path.endsWith('/src/index.css'));
                this.showPreview(`${folder} (.zip)`, `${files.filter((f) => !f.path.includes('/components/ui/') && !f.path.includes('/fonts/')).map((f) => f.path).join('\n')}\n${folder}/src/components/ui/ (${components.length} components)\n\n── src/index.css ──\n${css.content}`);
                if (skipped.length) Notifications.error(skippedMessage(skipped));
                else Notifications.success(`${folder} exported. Unzip, then npm install and npm run dev`);
            }),
            'fonts-zip': () => this.busy('Packaging fonts', async () => {
                if (!AppState.fonts.length) {
                    Notifications.info('Your font library is empty');
                    return;
                }
                const skipped = [];
                const assets = await this.fontAssets({ onError: (font) => skipped.push(font) });
                const css = this.fontFaceCss(assets, { skipped });
                const zip = createZip([{ path: 'fonts.css', content: css }, ...assets.map((a) => ({ path: `fonts/${a.filename}`, content: a.bytes }))]);
                this.downloadFile(zip, `${projectName()} fonts.zip`, 'application/zip');
                this.showPreview('Fonts (.zip) · fonts.css', css);
                if (skipped.length) Notifications.error(skippedMessage(skipped));
                else Notifications.success(`${assets.length} font files exported`);
            }),
            'figma-package': () => this.busy('Building the Figma package', async () => {
                const pkg = await this.figmaPackage();
                const text = JSON.stringify(pkg, null, 2);
                this.showPreview('Figma package', text);
                this.downloadFile(text, this.figmaFileName(), 'application/json');
                const c = pkg.meta.counts;
                Notifications.success(`Figma package: ${c.variables} variables, ${c.textStyles + c.effectStyles} styles`);
            }),
            'figma-plugin': () => this.busy('Packaging the Figma plugin', async () => {
                this.downloadFile(await this.figmaPluginZip(), 'TwoKit Figma plugin.zip', 'application/zip');
                Notifications.success('Figma plugin downloaded. Unzip it, then in Figma: Plugins → Development → Import plugin from manifest');
            }),
            'css-variables': () => this.exportCss('variables.css', this.variablesCss(model), 'variables.css'),
            'css-styles': () => this.exportCss('styles.css', this.stylesCss(), 'styles.css'),
            'css-copy': () => {
                const css = this.css(model);
                this.showPreview('CSS · variables + styles', css);
                this.copyText(css, 'CSS copied to clipboard');
            },
            'css-file': () => this.exportCss('CSS · variables + styles', this.css(model), `${slug(projectName())}.css`),
            'copy-preview': () => {
                const text = document.getElementById('exportCodePreview')?.textContent;
                if (text) this.copyText(text, 'Copied to clipboard');
            }
        };
        if (kind?.startsWith('bricks-part:')) return this.exportBricksPart(kind.slice('bricks-part:'.length), model);
        actions[kind]?.();
    },

    /**
     * The Bricks rows (AppState.exportPrefs.bricks) as package options, with
     * every scope checked against what exists now (a category or class group
     * can disappear after an edit): unknown scopes fall back to the whole part.
     */
    bricksOptions() {
        const prefs = AppState.exportPrefs?.bricks || {};
        const scopes = this.bricksScopes();
        const parts = {};
        for (const row of Array.isArray(prefs.rows) ? prefs.rows : []) {
            if (!BRICKS_PARTS.includes(row?.part) || row.part in parts) continue;
            if (row.part === 'styleManager') {
                parts.styleManager = AppState.theme.defaultMode;
                continue;
            }
            if (!scopes[row.part]) continue;
            const valid = scopes[row.part].some((o) => o.value === row.scope);
            parts[row.part] = valid ? row.scope : scopes[row.part][0].value;
        }
        return { parts };
    },

    /** Scope choices per Bricks part, with live counts: { part: [{ value, label, count }] }. */
    bricksScopes(model = this.model()) {
        const vars = this.bricksVariables(model);
        const perCategory = new Map();
        for (const v of vars.variables) perCategory.set(v.category, (perCategory.get(v.category) || 0) + 1);
        const classes = UtilitiesModule.classes();
        const groups = [...new Set(classes.map((c) => c.group))];
        const paletteCount = (scope) => this.bricksPalette(model, scope).colors.length;
        const label = (id) => UTILITY_GROUPS.find((g) => g.id === id)?.label || id;
        return {
            variables: [
                { value: 'all', label: 'All collections', count: vars.variables.length },
                ...vars.categories.map((c) => ({ value: c.name, label: c.name, count: perCategory.get(c.id) || 0 }))
            ],
            palette: [
                { value: 'all', label: `${PALETTE_NAME} palette`, count: paletteCount('all') },
                { value: 'theme', label: 'Theme colors only', count: paletteCount('theme') },
                { value: 'shades', label: 'Palette shades only', count: paletteCount('shades') }
            ],
            theme: [
                { value: 'site', label: 'Default theme · entire website', count: null },
                { value: 'none', label: 'No conditions · assign in Bricks', count: null }
            ],
            classes: [
                { value: 'all', label: 'Utility classes', count: classes.length },
                ...groups.map((g) => ({ value: g, label: label(g), count: classes.filter((c) => c.group === g).length }))
            ],
            styleManager: [
                { value: 'auto', label: 'Auto · follows the visitor', count: null },
                { value: 'light', label: 'Light', count: null },
                { value: 'dark', label: 'Dark', count: null }
            ],
            settings: [
                { value: 'all', label: 'Builder & performance', count: null },
                { value: 'builder', label: 'Builder only', count: null },
                { value: 'performance', label: 'Performance only', count: null }
            ]
        };
    },

    /** One Bricks part as its own JSON file, with the row's scope. */
    exportBricksPart(part, model = this.model()) {
        const { parts } = this.bricksOptions();
        const scope = parts[part] ?? this.bricksScopes(model)[part]?.[0]?.value;
        if (part === 'variables') {
            const data = this.bricksVariables(model, scope);
            if (!data.variables.length) return Notifications.info('No variables in that collection');
            return this.exportJson('Bricks variables', data, 'bricks-variables.json');
        }
        if (part === 'palette') return this.exportJson('Bricks color palette', this.bricksPalette(model, scope), 'bricks-styles-color-palette-twokit.json');
        if (part === 'theme') return this.exportJson('Bricks theme style', this.bricksThemeStyle(model, scope), `bricks-theme-style-${THEME_STYLE_ID}.json`);
        if (part === 'classes') {
            const { classes, categories } = this.bricksClasses(scope);
            if (!classes.length) return Notifications.info('All class groups are off in Utilities');
            const byId = Object.fromEntries(categories.map((c) => [c.id, c]));
            return this.exportJson('Bricks classes', classes.map((c) => ({ ...c, _categoryData: byId[c.category] })), 'bricks-classes.json');
        }
        if (part === 'styleManager') return this.exportJson('Bricks style manager', this.bricksStyleManager(), 'bricks-style-manager-settings.json');
        // Google Fonts are off here too: the fonts reach Bricks self-hosted (package or fonts zip).
        if (part === 'settings') return this.exportJson('Bricks settings', this.bricksSettings(scope), 'bricks-settings.json');
        return undefined;
    },

    exportCss(label, css, filename) {
        this.showPreview(label, css);
        this.downloadFile(css, filename, 'text/css');
        Notifications.success(`${filename} downloaded`);
    },

    /**
     * Self-hosted @font-face (+ the font variables unless `vars` is false).
     * `skipped` fonts: Google ones load from Google Fonts instead (@import
     * must come first), uploaded ones are listed as missing.
     */
    fontFaceCss(assets, { vars = true, skipped = [] } = {}) {
        const offline = skipped.filter((f) => f.source === 'google');
        const missing = skipped.filter((f) => f.source !== 'google');
        const names = (list) => list.map((f) => f.family.replace(/\*\//g, '* /')).join(', ');
        const imports = offline.map((f) => `@import url("${cssUrl(f.family, sortFaces(f.faces).map((face) => face.key))}");`);
        const notes = [
            offline.length ? `   Could not download ${names(offline)}: loaded from Google Fonts instead.\n   Export again when online to self-host them.` : '',
            missing.length ? `   Missing files for ${names(missing)}: re-upload them in Fonts and export again.` : ''
        ].filter(Boolean);
        const faces = assets.map(({ font, face, format, filename }) => `@font-face {
  font-family: ${cssString(font.family)};
  font-style: ${face.style};
  font-weight: ${faceWeight(face)};
  font-display: swap;
  src: url("fonts/${filename}") format("${format}");
}`);
        const rows = vars ? this.systemRows().filter(([cat]) => cat === 'Font family').map(([, name, value]) => `  --${name}: ${value};`) : [];
        return `${[
            ...imports,
            `/* ${projectName()} fonts: self-hosted${notes.length ? `\n${notes.join('\n')}` : ''} */`,
            ...faces,
            rows.length ? `:root {\n${rows.join('\n')}\n}` : ''
        ].filter(Boolean).join('\n\n')}\n`;
    },

    /** Runs an async export once at a time, with a status toast. */
    async busy(label, task) {
        if (this.running) return;
        this.running = true;
        const buttons = [...document.querySelectorAll('[data-export]')];
        buttons.forEach((b) => { b.disabled = true; });
        Notifications.info(`${label}…`);
        try {
            await task();
        } catch (error) {
            console.error(error);
            Notifications.error(error.message?.includes('fetch') || error instanceof TypeError
                ? 'Export needs an internet connection to download Google Fonts'
                : `Export failed: ${error.message}`);
        } finally {
            this.running = false;
            buttons.forEach((b) => { b.disabled = false; });
        }
    },

    exportJson(label, data, filename) {
        const text = JSON.stringify(data, null, 2);
        this.showPreview(label, text);
        this.downloadFile(text, filename, 'application/json');
        Notifications.success(`${label} exported`);
    },

    showPreview(label, content) {
        this.lastLabel = label;
        this.lastContent = content;
        const code = document.getElementById('exportCodePreview');
        const title = document.getElementById('exportPreviewTitle');
        if (code) code.innerHTML = highlight(content);
        if (title) title.textContent = label;
    },

    copyText(text, message) {
        if (!navigator.clipboard?.writeText) {
            Notifications.info('Preview updated (clipboard unavailable)');
            return;
        }
        navigator.clipboard.writeText(text).then(
            () => Notifications.success(message || 'Copied to clipboard'),
            () => Notifications.info('Preview updated (clipboard unavailable)')
        );
    },

    downloadFile(content, filename, mime) {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
};

export default ExportModule;
