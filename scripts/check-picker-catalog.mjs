/**
 * Checks the variable picker catalog (app/assets/js/core/pickerCatalog.js)
 * against the real theme token model: every name in the catalog must be a
 * variable the export writes, and the shape must be what the picker and PHP
 * expect. Run: node scripts/check-picker-catalog.mjs
 */
import assert from 'node:assert/strict';
import ThemeTokens from '../app/assets/js/core/themeTokens.js';
import ColorShadeGenerator from '../app/assets/js/core/colorShadeGenerator.js';
import { buildPickerCatalog, gridColumns } from '../app/assets/js/core/pickerCatalog.js';

const palette = (name, hex) => ({ name, baseColor: hex, shades: ColorShadeGenerator.generateShades(hex, name) });
const primary = palette('primary', '#B0C540');
const states = ['info:#3B82F6', 'success:#14B8A6', 'warning:#F59E0B', 'error:#FF2056'].map((s) => palette(...s.split(':')));
const model = ThemeTokens.build({ primary, states });

const themeRows = [];
for (const t of ThemeTokens.tokens(model)) themeRows.push(['Theme - tokens', t.name, 'x']);
for (const [alias] of [...model.aliases.surfaces, ...model.aliases.shadows]) themeRows.push(['Theme - aliases', alias, 'x']);
for (const [name] of ThemeTokens.layers()) themeRows.push(['Theme - interaction layers', name, 'x']);
model.shadows.light.forEach((_, i) => themeRows.push(['Shadows', `shadow-${i + 1}`, 'x']));
themeRows.push(['Shadows', 'inverse-scheme', 'dark'], ['Shadows', 'inverse-shadow-1', 'x']);
for (const m of ['light', 'dark']) for (const [n, v] of ThemeTokens.shadowRows(model, m)) themeRows.push([`Shadows - ${m} values`, n, v]);

const rows = [
    ['Base', 'white', '#FFFFFF'], ['Base', 'black', '#000000'],
    ...['4xs', 'xs', 'm', '4xl'].map((s) => ['Spacing - Fluid', `space-${s}`, 'clamp()']),
    ['Spacing - Fixed', 'space-4', '0.25rem'],
    ['Font family', 'font-inter', '"Inter"'], ['Font family', 'font-heading', 'var(--font-inter)'], ['Font family', 'font-body', 'var(--font-inter)'],
    ['Font size', 'h1', 'clamp()'], ['Font size', 'text-m', 'clamp()'], ['Font size', 'text-16', '1rem'], ['Font size', 'mystery', '1rem'],
    ['Font line height', 'text-line-height', 'x'],
    ['Layout', 'sctn-inline-padding', 'x'], ['Layout', 'content-width', 'x'], ['Layout', 'content-width-xs', 'x'], ['Layout', 'header-height', '75px'],
    ['Theme - tokens', 'site-bg', 'var(--surface-0)'],
    ['Gaps', 'grid-gap', 'var(--space-m)'],
    ['Grid', 'grid-3', 'repeat(3, minmax(0, 1fr))'], ['Grid', 'grid-1-2', 'minmax(0, 1fr) minmax(0, 2fr)'],
    ['Grid', 'grid-auto-4', 'repeat(auto-fit, minmax(min(100%, max(calc(1px), 1px)), 1fr))'], ['Grid', 'grid-auto-aggressiveness', '0.7'],
    ['Accessibility', 'focus-color', 'var(--action)'], ['Transition', 'transition', 'x'],
    ['Radius', 'radius', '4px'], ['Radius', 'radius-scale', '1.5'], ['Radius', 'radius-m', 'var(--radius)'], ['Radius', 'radius-circle', '50vw'],
    ['Buttons', 'btn-radius', 'x'], ['Buttons', 'btn-primary-bg', 'x'], ['Buttons', 'btn-primary-bg-hover', 'x'], ['Buttons', 'btn-link-text', 'x'],
    ['Buttons - states', 'btn-success-bg', 'x'],
    ['Auto spacing', 'auto-space-paragraph', '1em'],
    ['Something new', 'future-token', '1']
];

const catalog = buildPickerCatalog({
    model,
    palettes: [primary, ...states].map((c) => ({
        name: c.name,
        base: { name: c.name, hex: c.shades.find((s) => s.isBase).hex },
        shades: c.shades.map((s) => ({ name: s.name, hex: s.hex, isBase: !!s.isBase }))
    })),
    rows,
    themeRows,
    fontSizes: { headings: ['h1'], fluid: ['text-m'], fixed: ['text-16'] },
    mode: 'auto'
});

const ids = catalog.groups.map((g) => g.id);
assert.equal(catalog.v, 1);
assert.equal(catalog.mode, 'auto');
for (const id of ['surfaces', 'text', 'action', 'states', 'borders', 'interaction', 'inverse', 'palettes', 'spacing', 'gaps', 'layout', 'grid', 'font-size', 'line-height', 'font-family', 'radius', 'shadows', 'buttons', 'focus', 'transition', 'auto-spacing', 'other']) {
    assert.ok(ids.includes(id), `group ${id}`);
}

// Every name is a real variable.
const known = new Set([...rows.map((r) => r[1]), ...themeRows.map((r) => r[1]), ...[primary, ...states].flatMap((c) => [c.name, ...c.shades.map((s) => s.name)])]);
const names = [];
const walk = (sections) => sections.forEach((s) => {
    if (s.type === 'tabs') return s.tabs.forEach((t) => walk(t.sections));
    s.items.forEach((it) => {
        names.push(it.n);
        if (s.type === 'palettes') [...it.shades, ...it.tints].forEach((sh) => names.push(sh.n));
    });
});
catalog.groups.forEach((g) => walk(g.sections));
for (const n of names) {
    assert.ok(known.has(n), `unknown name ${n}`);
    assert.match(n, /^[A-Za-z0-9_-]{1,80}$/);
}
assert.ok(!names.includes('inverse-shadow-1') && !names.includes('inverse-scheme'), 'inverse shadows stay out');
assert.ok(names.includes('future-token'), 'unknown categories land in Other');

// Shadow levels come as light/dark pairs; the fixed names are real variables.
const scale = catalog.groups.find((g) => g.id === 'shadows').sections.find((s) => s.type === 'shadows');
assert.ok(scale && scale.items.length === model.shadows.light.length, 'shadows section');
for (const it of scale.items) for (const m of ['light', 'dark']) assert.ok(known.has(`${m}-${it.n}`), `fixed ${m}-${it.n}`);
assert.equal(scale.items.find((it) => it.n === 'shadow-2').t, 'card');
assert.ok(!catalog.groups.some((g) => g.id === 'other' && JSON.stringify(g).includes('light-shadow')), 'fixed shadows are not in Other');

// Pairs carry light and dark colors.
const surfaces = catalog.groups.find((g) => g.id === 'surfaces');
const levels = surfaces.sections[0].items;
assert.equal(levels.length, 9);
assert.match(levels[0].l, /^#[0-9A-F]{6}$/);
assert.equal(levels[0].t, 'canvas');
const borders = catalog.groups.find((g) => g.id === 'borders').sections[0].items;
assert.match(borders[0].l, /^#[0-9A-F]{8}$/, 'see-through borders keep alpha');

// States are tabs with five roles each.
const statesTabs = catalog.groups.find((g) => g.id === 'states').sections[0];
assert.equal(statesTabs.type, 'tabs');
assert.deepEqual(statesTabs.tabs.map((t) => t.label), ['info', 'success', 'warning', 'error']);
assert.equal(statesTabs.tabs[1].sections[0].items.length, 5);

// Palettes: base, darker shades, lighter tints from the base outwards.
const pal = catalog.groups.find((g) => g.id === 'palettes').sections[0].items[0];
assert.equal(pal.n, 'primary');
assert.equal(pal.shades.length + pal.tints.length, primary.shades.length - 1);

// Grid shapes.
assert.deepEqual(gridColumns('repeat(3, minmax(0, 1fr))'), [1, 1, 1]);
assert.deepEqual(gridColumns('minmax(0, 1fr) minmax(0, 2fr)'), [1, 2]);
assert.equal(gridColumns('repeat(auto-fit, minmax(10px, 1fr))'), null);
const grid = catalog.groups.find((g) => g.id === 'grid');
assert.deepEqual(grid.sections.map((s) => s.label), ['Columns', 'Ratios', 'Auto-fit', 'Settings']);

// Buttons: variants as tabs, sizing apart.
const buttons = catalog.groups.find((g) => g.id === 'buttons');
assert.deepEqual(buttons.sections[0].tabs.map((t) => t.label), ['primary', 'success', 'link']);
assert.deepEqual(buttons.sections[1].items.map((i) => i.n), ['btn-radius']);

// Font sizes split by kind; an unknown size goes to Other.
const fs = catalog.groups.find((g) => g.id === 'font-size');
assert.deepEqual(fs.sections.map((s) => s.label), ['Headings', 'Fluid text', 'Fixed text', 'Other']);

// `--write <file>`: keep this catalog as a sample for the picker's browser harness.
const out = process.argv.indexOf('--write');
if (out !== -1 && process.argv[out + 1]) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(process.argv[out + 1], JSON.stringify(catalog, null, 1));
}

const size = JSON.stringify(catalog).length;
assert.ok(size < 262144, `catalog fits the PHP limit (${size} bytes)`);
console.log(`picker catalog ok: ${catalog.groups.length} groups, ${names.length} names, ${size} bytes`);
