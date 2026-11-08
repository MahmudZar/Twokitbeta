import AppState from './appState.js';
import ThemeTokens, { normalizeRoles } from '../core/themeTokens.js';
import ColorShadeGenerator from '../core/colorShadeGenerator.js';
import { shadesFor } from '../data/tailwindColors.js';
import { paletteSolid, paletteOutlineInk } from '../core/buttonsCss.js';

export function ensureShades(color) {
    if (color.shades?.length) {
        // Saved ramps may carry a base from before the 300–600 rule.
        if (!color.tailwind) ColorShadeGenerator.fixBase(color.shades, color.baseColor);
        return color;
    }
    if (color.tailwind) {
        color.shades = shadesFor(color.tailwind, color.name);
        const base = color.shades.find((s) => s.isBase);
        if (base) color.baseColor = base.hex;
        return color;
    }
    color.shades = ColorShadeGenerator.generateShades(color.baseColor, color.name);
    return color;
}

/** `--primary` (etc.) pointing at the calculated base step on the ramp. */
export function paletteAlias(color) {
    const base = color.shades?.find((s) => s.isBase);
    if (!base) return null;
    const name = AppState.tokenName('color', color.name);
    const ref = AppState.tokenName('color', base.name);
    return { name, ref, css: `var(--${ref})`, hex: base.hex, oklch: base.oklch };
}

/** Theme token model for the current state (see core/themeTokens.js). */
export function currentTheme(overrides = {}) {
    const { theme, surface } = AppState;
    for (const state of AppState.stateColors) state.roles = normalizeRoles(state.roles);
    const primary = ensureShades(AppState.colors[0]);
    const linked = surface.linked !== false;
    return ThemeTokens.build({
        primary,
        secondary: AppState.colors[1] ? ensureShades(AppState.colors[1]) : null,
        surfaceBase: linked ? primary.baseColor : (surface.base || primary.baseColor),
        states: AppState.stateColors.map(ensureShades),
        tint: surface.tint,
        options: { inverse: theme.enableInverse, aliases: theme.enableAliases },
        varName: (name) => AppState.tokenName('color', name),
        ...overrides
    });
}

/** What the button generators need from the current palettes (core/buttonsCss.js). */
export function buttonContext() {
    const varName = (name) => AppState.tokenName('color', name);
    const solid = (color) => paletteSolid(ensureShades(color), varName);
    const [first, second, ...more] = AppState.colors;
    // Outline text is checked against the real page color per theme.
    const page = currentTheme().groups.find((g) => g.id === 'surfaces')?.tokens.find((t) => t.name === 'surface-1');
    const pages = page ? { light: page.light.hex, dark: page.dark.hex } : undefined;
    return {
        hasSecondaryBrand: Boolean(second),
        brand: solid(first),
        // Palette defaults: primary ← first brand palette, secondary ← second (else the surface button).
        defaults: {
            primary: solid(first),
            secondary: second ? solid(second) : null,
            outlineInk: paletteOutlineInk(ensureShades(first), varName, pages)
        },
        // Extra brand palettes and the state palettes each get a button named after them.
        brands: more.map((c) => ({ id: c.id, name: c.name, colors: solid(c) })),
        states: AppState.stateColors.map((c) => ({ id: c.id, name: c.name, colors: solid(c) }))
    };
}

/** Palette primitives (brand + state shades) as CSS, with the color prefix applied. */
export function paletteCss() {
    const lines = [...AppState.colors, ...AppState.stateColors].map(ensureShades).map((color) => {
        const alias = paletteAlias(color);
        return [
            `  /* ${color.name} */`,
            alias ? `  --${alias.name}: ${alias.css};` : '',
            ...color.shades.map((s) => `  --${AppState.tokenName('color', s.name)}: ${s.oklch};`)
        ].filter(Boolean).join('\n');
    });
    return `:root {\n${lines.join('\n\n')}\n}`;
}

export default currentTheme;
