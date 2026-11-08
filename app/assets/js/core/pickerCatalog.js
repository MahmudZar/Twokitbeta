/**
 * PickerCatalog
 *
 * The data behind the variable picker in the Bricks builder (WordPress
 * plugin, assets/picker/picker.js): every variable TwoKit exports, grouped
 * the way the picker shows them, with the colors it needs to draw swatches.
 *
 * Built from the same rows as the Bricks/CSS export, so a name in the picker
 * is always a variable that exists on the site. Sent with each WordPress save
 * and stored as plain data (no CSS, no markup); the picker renders it with
 * textContent only.
 *
 * Shape (version 1):
 *   { v: 1, mode, groups: [{ id, label, sections: [Section] }] }
 *   Section = { type: 'pairs' | 'chips' | 'grid' | 'shadows', label?, items }
 *           | { type: 'palettes', items: [{ n, hex, shades, tints }] }
 *           | { type: 'tabs', tabs: [{ label, c?, sections: [Section] }] }
 *   pairs item  { n, l, d, t? }  auto token n; fixed --light-n / --dark-n; t = role tag
 *   chips item  { n, c? }        c = swatch color
 *   grid item   { n, cols? }     cols = column fractions, absent for auto-fit
 *   shadows item { n }           auto shadow n; fixed --light-n / --dark-n (no values:
 *                                the picker reads them from the canvas page)
 *
 * @module pickerCatalog
 */

export const CATALOG_VERSION = 1;

/** #RRGGBB, or #RRGGBBAA when the token is see-through. */
function swatch(entry) {
    if (!entry?.hex) return '';
    const hex = String(entry.hex).slice(0, 7).toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(hex)) return '';
    const alpha = Number(entry.alpha);
    if (!(alpha >= 0 && alpha < 1)) return hex;
    return hex + Math.round(alpha * 255).toString(16).padStart(2, '0').toUpperCase();
}

const pairs = (tokens, tags = {}) => tokens.map((t) => {
    const item = { n: t.name, l: swatch(t.light), d: swatch(t.dark) };
    if (tags[t.name]) item.t = tags[t.name];
    return item;
});

const chips = (names, colors = {}) => names.map((n) => (colors[n] ? { n, c: colors[n] } : { n }));

const section = (type, items, label) => (label ? { type, label, items } : { type, items });

/** Column fractions of a grid value, or null for auto-fit/other shapes. */
export function gridColumns(value) {
    const v = String(value || '');
    const repeat = v.match(/^repeat\(\s*(\d+)\s*,\s*minmax\(0,\s*1fr\)\s*\)$/);
    if (repeat) return Array(Math.min(24, Number(repeat[1]))).fill(1);
    const parts = [...v.matchAll(/minmax\(0,\s*(\d+(?:\.\d+)?)fr\)/g)].map((m) => Number(m[1]));
    if (parts.length && v.replace(/minmax\(0,\s*\d+(?:\.\d+)?fr\)/g, '').trim() === '') return parts;
    return null;
}

/**
 * @param {object} input
 * @param {object} input.model      ThemeTokens model (core/themeTokens.js)
 * @param {Array}  input.palettes   [{ name, base: { name, hex }|null, shades: [{ name, hex, isBase }] }]
 * @param {Array}  input.rows       [category, name, value] rows (ExportModule.systemRows)
 * @param {Array}  input.themeRows  [category, name, value] rows (ExportModule.themeRows)
 * @param {object} input.fontSizes  { headings: string[], fluid: string[], fixed: string[] }
 * @param {string} [input.mode]     the site's default theme mode
 */
export function buildPickerCatalog({ model, palettes = [], rows = [], themeRows = [], fontSizes = {}, mode = 'light' }) {
    const groups = [];
    const add = (id, label, sections) => {
        const kept = sections.filter((s) => (s.type === 'tabs' ? s.tabs.length : s.items.length));
        if (kept.length) groups.push({ id, label, sections: kept });
    };
    const theme = Object.fromEntries((model?.groups || []).map((g) => [g.id, g]));
    const tokens = (id) => theme[id]?.tokens || [];
    const byCategory = new Map();
    for (const [cat, name] of rows) {
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat).push(name);
    }
    const valueOf = new Map(rows.map(([, name, value]) => [name, value]));
    const take = (cat) => {
        const list = byCategory.get(cat) || [];
        byCategory.delete(cat);
        return list;
    };

    // Colors ------------------------------------------------------------
    const surfaceTags = {};
    const surfaceSwatch = {};
    for (const [alias, target] of model?.aliases?.surfaces || []) surfaceTags[target] = alias.replace(/^surface-/, '');
    for (const t of tokens('surfaces')) surfaceSwatch[t.name] = t;
    const named = (model?.aliases?.surfaces || []).map(([alias, target]) => {
        const t = surfaceSwatch[target];
        return { n: alias, l: swatch(t?.light), d: swatch(t?.dark) };
    });
    const siteBg = byCategory.get('Theme - tokens')?.includes('site-bg') ? [{ n: 'site-bg' }] : [];
    add('surfaces', 'Surfaces', [
        section('pairs', pairs(tokens('surfaces'), surfaceTags), 'Levels'),
        section('chips', [...named, ...siteBg], 'Named')
    ]);
    add('text', 'Text', [section('pairs', pairs(tokens('text')))]);
    add('action', 'Action', [
        section('pairs', pairs(tokens('action')), theme['action-secondary'] ? 'Primary' : undefined),
        section('pairs', pairs(tokens('action-secondary')), 'Secondary')
    ]);
    const stateGroups = (model?.groups || []).filter((g) => g.id.startsWith('state-'));
    add('states', 'States', [{
        type: 'tabs',
        tabs: stateGroups.map((g) => {
            const name = g.id.slice(6);
            const solid = g.tokens.find((t) => t.name === `${name}-solid`);
            return { label: name, c: swatch(solid?.light), sections: [section('pairs', pairs(g.tokens))] };
        })
    }]);
    add('borders', 'Borders', [section('pairs', pairs(tokens('borders')))]);
    const layers = themeRows.filter(([cat]) => cat === 'Theme - interaction layers').map(([, n]) => n);
    add('interaction', 'Interaction', [
        section('pairs', pairs(tokens('states')), 'Color'),
        section('chips', chips(layers), 'Layer (background-image)')
    ]);
    add('inverse', 'Inverse', [section('pairs', pairs(tokens('inverse')))]);
    add('palettes', 'Palettes', [
        section('palettes', palettes.filter((p) => p.shades?.length).map((p) => {
            const index = Math.max(0, p.shades.findIndex((s) => s.isBase));
            const base = p.shades[index];
            const shade = (s) => ({ n: s.name, hex: swatch(s) });
            return {
                n: p.base?.name || base.name,
                hex: swatch(base),
                // Darker steps after the base, then lighter ones from the base outwards.
                shades: p.shades.slice(index + 1).map(shade),
                tints: p.shades.slice(0, index).reverse().map(shade),
                // The base step itself, when the plain name is an alias of it.
                ...(p.base ? { step: base.name } : {})
            };
        })),
        section('chips', chips(take('Base'), { white: '#FFFFFF', black: '#000000' }), 'Base')
    ]);

    // Space and layout ----------------------------------------------------
    add('spacing', 'Spacing', [
        section('chips', chips(take('Spacing - Fluid')), 'Fluid'),
        section('chips', chips(take('Spacing - Fixed')), 'Fixed')
    ]);
    add('gaps', 'Gaps', [section('chips', chips(take('Gaps')))]);
    const layout = take('Layout');
    const widths = layout.filter((n) => /^content-width/.test(n));
    const header = layout.filter((n) => /^header-/.test(n));
    const sectionNames = layout.filter((n) => !widths.includes(n) && !header.includes(n));
    add('layout', 'Layout', [
        section('chips', chips(widths), 'Content width'),
        section('chips', chips(sectionNames), 'Section'),
        section('chips', chips(header), 'Header')
    ]);
    const grid = take('Grid');
    const shape = (n) => ({ n, cols: gridColumns(valueOf.get(n)) });
    const gridItems = grid.map(shape);
    const equal = gridItems.filter((g) => g.cols && g.cols.every((c) => c === 1));
    const ratio = gridItems.filter((g) => g.cols && !g.cols.every((c) => c === 1));
    const auto = gridItems.filter((g) => !g.cols && /^grid-auto-\d+$/.test(g.n)).map(({ n }) => ({ n, cols: Array(Number(n.slice(10))).fill(1), auto: 1 }));
    const otherGrid = grid.filter((n) => !gridItems.find((g) => g.n === n && (g.cols || /^grid-auto-\d+$/.test(n))));
    add('grid', 'Grid', [
        section('grid', equal, 'Columns'),
        section('grid', ratio, 'Ratios'),
        section('grid', auto, 'Auto-fit'),
        section('chips', chips(otherGrid), 'Settings')
    ]);

    // Type ----------------------------------------------------------------
    const sizes = take('Font size');
    const inList = (list) => sizes.filter((n) => (list || []).includes(n));
    const known = new Set([...(fontSizes.headings || []), ...(fontSizes.fluid || []), ...(fontSizes.fixed || [])]);
    add('font-size', 'Font size', [
        section('chips', chips(inList(fontSizes.headings)), 'Headings'),
        section('chips', chips(inList(fontSizes.fluid)), 'Fluid text'),
        section('chips', chips(inList(fontSizes.fixed)), 'Fixed text'),
        section('chips', chips(sizes.filter((n) => !known.has(n))), 'Other')
    ]);
    add('line-height', 'Line height', [section('chips', chips(take('Font line height')))]);
    const families = take('Font family');
    const roles = families.filter((n) => /(^|-)font-(heading|body)$/.test(n));
    add('font-family', 'Font family', [
        section('chips', chips(roles), 'Roles'),
        section('chips', chips(families.filter((n) => !roles.includes(n))), 'Library')
    ]);

    // Style ---------------------------------------------------------------
    const radius = take('Radius');
    const roundNames = ['radius-50', 'radius-circle'];
    const baseNames = ['radius', 'radius-scale'];
    add('radius', 'Radius', [
        section('chips', chips(radius.filter((n) => !roundNames.includes(n) && !baseNames.includes(n))), 'Scale'),
        section('chips', chips(radius.filter((n) => roundNames.includes(n))), 'Round'),
        section('chips', chips(radius.filter((n) => baseNames.includes(n))), 'Base')
    ]);
    const shadowRows = themeRows.filter(([cat, n]) => cat === 'Shadows' && /^shadow-\d+$/.test(n)).map(([, n]) => n);
    const shadowAliases = (model?.aliases?.shadows || []).map(([alias]) => alias);
    add('shadows', 'Shadows', [
        section('chips', chips(shadowAliases), 'Named'),
        section('shadows', shadowRows.map((n) => {
            // Role tag from the named alias (shadow-2 → card), like surface levels.
            const alias = (model?.aliases?.shadows || []).find(([, target]) => target === n);
            return alias ? { n, t: alias[0].replace(/^shadow-/, '') } : { n };
        }), 'Scale')
    ]);
    const buttons = [...take('Buttons'), ...take('Buttons - brand'), ...take('Buttons - states')];
    const COLOR_SUFFIX = /-(bg|text|border)(-hover)?$/;
    const variants = [];
    for (const n of buttons) {
        if (!COLOR_SUFFIX.test(n) || /^btn-link-/.test(n)) continue;
        const variant = n.slice(4).replace(COLOR_SUFFIX, '');
        if (!variants.includes(variant)) variants.push(variant);
    }
    const ofVariant = (v) => buttons.filter((n) => n.startsWith(`btn-${v}-`) && COLOR_SUFFIX.test(n) && n.slice(4).replace(COLOR_SUFFIX, '') === v);
    const link = buttons.filter((n) => n.startsWith('btn-link-'));
    const sizing = buttons.filter((n) => !link.includes(n) && !variants.some((v) => ofVariant(v).includes(n)));
    add('buttons', 'Buttons', [
        {
            type: 'tabs',
            tabs: [
                ...variants.map((v) => ({ label: v, sections: [section('chips', chips(ofVariant(v)))] })),
                ...(link.length ? [{ label: 'link', sections: [section('chips', chips(link))] }] : [])
            ]
        },
        section('chips', chips(sizing), 'Sizing (all buttons)')
    ]);
    add('focus', 'Focus', [section('chips', chips(take('Accessibility')))]);
    add('transition', 'Transition', [section('chips', chips(take('Transition')))]);
    add('selection', 'Selection', [section('chips', chips(take('Selection')))]);
    add('auto-spacing', 'Auto spacing', [section('chips', chips(take('Auto spacing')))]);

    // Anything a later TwoKit adds lands here until it gets its own group.
    byCategory.delete('Theme - tokens');
    const rest = [...byCategory.values()].flat();
    add('other', 'Other', [section('chips', chips(rest))]);

    return { v: CATALOG_VERSION, mode: ['light', 'dark', 'auto'].includes(mode) ? mode : 'light', groups };
}

export default buildPickerCatalog;
