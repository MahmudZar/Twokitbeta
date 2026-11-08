/**
 * Preview CSS: what every Example page (Website, Style guide) is styled with.
 *
 *   variables.css + styles.css   the HTML/CSS export itself: tokens, reset,
 *                                .tk-* elements, typography, focus, and the
 *                                utility classes the user ships
 *   + utility classes that are   so pages can use them whatever groups are on
 *     switched off
 *   + forced states              .is-hover / .is-focus copies of the real
 *                                :hover / :focus-visible rules
 *   + --ex-* aliases             pointers at real tokens, picked by position
 *                                on the user's scales (steps can be renamed,
 *                                added or removed), never fixed values
 *
 * @module previewCss
 */

import AppState from '../state/appState.js';
import ThemeTokens from '../core/themeTokens.js';
import { currentTheme } from '../state/themeModel.js';
import { withDefaults, stylingCss } from '../core/stylingCss.js';
import { UTILITY_GROUPS } from '../core/utilityClasses.js';
import UtilitiesModule from '../modules/utilitiesModule.js';
import ExportModule from '../modules/exportModule.js';

/** Theme attribute in the previews, as in the HTML export. */
export const THEME_ATTR = 'data-theme';

/** The step `offset` places from the base of a scale (clamped to its ends). */
function around(scale, offset) {
    if (!scale?.length) return null;
    const base = Math.max(0, scale.findIndex((s) => s.isBase));
    return scale[Math.min(scale.length - 1, Math.max(0, base + offset))];
}

/** The type step `offset` from the base: { name, token } (token = CSS var name). */
export function typeStep(offset) {
    const step = around(AppState.typography.scale?.textSizes, offset);
    return step ? { ...step, token: AppState.tokenName('type', step.name) } : null;
}

/** The fluid spacing step `offset` from the base. */
export function spaceStep(offset) {
    const sp = AppState.spacing;
    const scale = sp.fluidScale?.length ? sp.fluidScale : null;
    const step = around(scale, offset);
    return step ? { ...step, token: AppState.tokenName('spacing', step.name) } : null;
}

/**
 * --ex-* aliases. Each is var(--real-token); a fallback is only used when the
 * scale is missing altogether (a project mid-load).
 */
function aliases() {
    const type = (offset, fallback) => { const s = typeStep(offset); return s ? `var(--${s.token})` : fallback; };
    const space = (offset, fallback) => { const s = spaceStep(offset); return s ? `var(--${s.token})` : fallback; };
    const r = withDefaults(AppState.styling).radius;
    const radius = (name) => (r.extraSizes ? `var(--radius-${name})` : 'var(--radius-m)');
    const font = (name) => `var(--${AppState.tokenName('type', name)})`;
    return `:root {
  /* Type: steps around the base of the type scale */
  --ex-font-heading: ${font('font-heading')};
  --ex-font-body: ${font('font-body')};
  --ex-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --ex-text-xs: ${type(-2, '0.75rem')};
  --ex-text-s: ${type(-1, '0.875rem')};
  --ex-text-m: ${type(0, '1rem')};
  --ex-text-l: ${type(1, '1.25rem')};
  --ex-text-xl: ${type(2, '1.5rem')};

  /* Space: steps around the base of the fluid spacing scale */
  --ex-space-3xs: ${space(-3, '0.25rem')};
  --ex-space-2xs: ${space(-2, '0.5rem')};
  --ex-space-xs: ${space(-1, '0.75rem')};
  --ex-space-s: ${space(0, '1rem')};
  --ex-space-m: ${space(1, '1.5rem')};
  --ex-space-l: ${space(2, '2rem')};
  --ex-space-xl: ${space(3, '3rem')};
  --ex-space-2xl: ${space(4, '4rem')};

  /* Radius: the scale's sizes, or --radius-m when extra sizes are off */
  --ex-radius-s: ${radius('s')};
  --ex-radius-m: var(--radius-m);
  --ex-radius-l: ${radius('l')};
  --ex-radius-xl: ${radius('xl')};
  --ex-radius-xxl: ${radius('xxl')};
}`;
}

/**
 * .is-hover / .is-focus copies of the generated :hover and :focus-visible
 * rules, so a static specimen shows the real hover and focus styles.
 */
function forcedStatesCss(buttonCss, focusCss) {
    const blocks = (css) => css
        .replace(/@media \(hover: hover\) \{\n([\s\S]*?)\n\}/g, '$1')
        .split(/\n\s*\n/);
    const hover = blocks(buttonCss)
        .filter((b) => b.includes(':hover'))
        .map((b) => b.replace(/:hover/g, '.is-hover').trim());
    const focus = blocks(focusCss)
        .filter((b) => b.includes(':focus-visible') && !b.includes(':not(:focus-visible)'))
        .map((b) => b.replace(/:focus-visible/g, '.is-focus').trim());
    return `/* Preview only: forced hover and focus states */\n${[...hover, ...focus].join('\n\n')}`;
}

/** Everything a preview page needs before its own layout CSS. */
export function previewBaseCss() {
    const model = currentTheme();
    const mode = AppState.ui.exampleTheme === 'dark' ? 'dark' : 'light';
    const shipped = new Set(UtilitiesModule.classes().map((c) => c.name));
    const all = UtilitiesModule.classes(Object.fromEntries(UTILITY_GROUPS.map((g) => [g.id, true])));
    const missing = all.filter((c) => !shipped.has(c.name)).map((c) => c.css);
    const buttonCss = all.filter((c) => c.group === 'buttons').map((c) => c.css).join('\n\n');
    return [
        ExportModule.rootBlock(ExportModule.paletteRows()),
        ThemeTokens.toCss(model, { attr: THEME_ATTR, defaultMode: mode }),
        ExportModule.rootBlock(ExportModule.systemRows()),
        ExportModule.stylesCss(),
        missing.length ? `/* Preview only: utility classes from groups that are switched off */\n${missing.join('\n\n')}` : '',
        forcedStatesCss(buttonCss, stylingCss(AppState.styling, { root: ':root', html: true })),
        aliases(),
        // Anchor jumps and scroll restores are instant in the preview (the export keeps the user's setting).
        'html { scroll-behavior: auto !important; scrollbar-width: thin; }'
    ].filter(Boolean).join('\n\n');
}
