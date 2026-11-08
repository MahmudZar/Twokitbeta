/**
 * The project's exported tokens for one theme, as custom properties to put on
 * a preview element: palette shades and aliases (--primary …), base colors,
 * theme tokens (surfaces, text, borders, shadows) and every system token the
 * CSS export writes (type sizes, font families, --heading-line-height,
 * --text-line-height, spacing, layout, styling, buttons). A preview styled
 * with var(--…) inside it looks the way the exported site will.
 *
 * @module tokenScope
 */

import AppState from '../state/appState.js';
import ThemeTokens from '../core/themeTokens.js';
import { currentTheme, paletteAlias } from '../state/themeModel.js';
import ExportModule from '../modules/exportModule.js';

/** [['--name', value], …] for a theme. */
export function tokenPairs(mode = 'light') {
    const palette = [...AppState.colors, ...AppState.stateColors].flatMap((c) => {
        const alias = paletteAlias(c);
        return [
            ...(alias ? [[`--${alias.name}`, alias.hex]] : []),
            ...(c.shades || []).map((s) => [`--${AppState.tokenName('color', s.name)}`, s.hex])
        ];
    });
    const theme = Object.entries(ThemeTokens.vars(currentTheme(), mode));
    const system = ExportModule.systemRows().map(([, name, value]) => [`--${name}`, value]);
    return [['--white', '#ffffff'], ['--black', '#000000'], ...palette, ...theme, ...system];
}

/** Inline style declaring every token for a theme (plus its color-scheme). */
export function tokenStyle(mode = 'light') {
    return [`color-scheme:${mode}`, ...tokenPairs(mode).map(([k, v]) => `${k}:${v}`)].join(';');
}
