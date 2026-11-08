/**
 * Utility classes: a small, curated catalog (not a class per token).
 *
 * A class earns its place when it carries the design system into the builder
 * (it reads TwoKit tokens, so editing a variable restyles every use) or when
 * it packages a pattern people would otherwise rebuild by hand (grid
 * templates, clickable cards, full-bleed, sticky under the header). One-
 * property classes that Bricks already offers as a control stay out.
 *
 * Classes ship as Bricks global classes with their CSS in the class's CSS
 * panel, and in styles.css; Bricks prints only the classes a page uses.
 * Names are property-value with one dash (gap-m ↔ --space-m); `--` marks
 * real modifiers (btn--primary, auto-spacing--off), `__` a part of a pattern
 * (clickable-card__link).
 *
 * @module utilityClasses
 */

export const UTILITY_GROUPS = [
    { id: 'buttons', label: 'Buttons', hint: 'btn--primary, secondary, outline, ghost, link, icon, one per state color · each in -s and -l' },
    { id: 'surfaces', label: 'Surfaces & shadows', hint: 'surface-0…8, shadow-1…8, surface-inverse' },
    { id: 'theme', label: 'Theme & states', hint: 'theme-dark, theme-light, theme-inverse, surface-action, surface-{state}' },
    { id: 'text', label: 'Text color', hint: 'text-primary, secondary, muted, action, text-{state}' },
    { id: 'type', label: 'Type', hint: 'text-{size}, text-12…20 (fixed body sizes), text-style-h1…h4, balance, pretty, line clamp 1–3' },
    { id: 'gap', label: 'Gap', hint: 'gap-{fluid step} (gap-m), gap-{fixed step} (gap-16), container-gap, content-gap, grid-gap' },
    { id: 'padding', label: 'Padding', hint: 'padding-{step}, padding-block-{step}, padding-inline-{step} for the fluid steps (padding-m) and the fixed steps (padding-16)' },
    { id: 'layout', label: 'Layout', hint: 'stack, cluster, center, full-bleed, full-bleed-left / -right, full-bleed--padded (and -left / -right), full-bleed__content, margin-top-auto, content-width, auto-spacing' },
    { id: 'grid', label: 'Grid', hint: 'grid-1…12, grid-1-2 … grid-3-2, grid-auto-2…6, col-span-2, col-span-3, col-span-full, row-span-2' },
    { id: 'position', label: 'Position', hint: 'position-relative, position-absolute, inset-0, sticky-top' },
    { id: 'borders', label: 'Borders', hint: 'border, border-subtle, border-strong, border-top, border-bottom' },
    { id: 'radius', label: 'Radius', hint: 'radius-none…xxl, radius-50, radius-circle' },
    { id: 'helpers', label: 'Helpers', hint: 'clickable-card, img-cover, ratios, sr-only, transition' }
];

export const UTILITY_DEFAULTS = {
    buttons: true, theme: true, text: true, type: true, gap: true, padding: true, layout: true,
    grid: true, position: true, borders: true, radius: true, helpers: true
};

/** Auto grids stop here: past six columns a fixed grid reads better. */
const AUTO_GRID_MAX = 6;
/** Spans fall back to one track at this width (Bricks' mobile landscape), so a span never forces an extra column. */
const SPAN_RESET = 767;
/** Container edge → window edge: the container's side space, or the section padding on small screens. */
const BLEED_GUTTER = 'max(var(--sctn-inline-padding), (100vw - var(--bleed-container, var(--content-width))) / 2)';

const rule = (name, body) => `.${name} {\n  ${body.trim().split('\n').map((l) => l.trim()).join('\n  ')}\n}`;
const block = (selector, body) => `${selector} {\n  ${body.trim().split('\n').map((l) => l.trim()).join('\n  ')}\n}`;

/** The main link of a clickable card: a link in a heading, or the one marked __link. */
const CARD_LINK = ':where(h1, h2, h3, h4, h5, h6) a, .clickable-card__link';

/**
 * @param {object} ctx
 *   groups        { id: boolean } (surfaces comes from theme.enableClasses)
 *   levels        surface levels (8)
 *   inverse       inverse tokens exist
 *   shadows       { light: [], dark: [] } box-shadow per level (theme classes)
 *   themeVars     { dark: [], light: [], inverse: [] } declarations per theme context (ThemeTokens)
 *   bodyColor     body text color (theme classes)
 *   states        state palette names ['info', …]
 *   spaceSteps    fluid spacing steps ['2xs', …] ([] when fluid spacing is off)
 *   fixedSteps    fixed spacing steps ['none', '4', …] ([] when fixed spacing is off)
 *   typeSteps     type scale steps ['xs', …]
 *   bodySizes     fixed body size tokens ['text-12', …] (empty when off)
 *   headings      [{ name: 'h1', … }]
 *   heading       { weight, letterSpacing, color }
 *   widths        content-width keys ['', 'xs', …]
 *   bleedMobile   one-sided bleeds on phones: 'keep' | 'both' | 'none'
 *   maxColumns    grid columns (Layout → Max columns)
 *   asymmetric    asymmetric grid names ['grid-1-2', …]
 *   radius        { extraSizes }
 *   selection     selection styling on
 *   autoSpacing   auto spacing on
 *   buttonClasses [[name, css]] from core/buttonsCss.js
 *   v(section, name) → CSS variable name with the right prefix
 * @returns {{ group, name, css }[]}
 */
export function utilityClasses(ctx) {
    const out = [];
    const on = (id) => ctx.groups[id] !== false;
    const add = (group, name, body) => out.push({ group, name, css: rule(name, body) });
    const raw = (group, name, css) => out.push({ group, name, css });
    const v = ctx.v;

    if (on('buttons')) {
        for (const [name, css] of ctx.buttonClasses) out.push({ group: 'buttons', name, css });
    }

    if (on('surfaces')) {
        for (let i = 0; i <= ctx.levels; i++) add('surfaces', `surface-${i}`, `background-color: var(--surface-${i});`);
        for (let i = 1; i <= ctx.levels; i++) add('surfaces', `shadow-${i}`, `box-shadow: var(--shadow-${i});`);
        if (ctx.inverse) add('surfaces', 'surface-inverse', 'background-color: var(--inverse-surface);\ncolor: var(--inverse-text);');
    }

    if (on('theme')) {
        // Theme tokens are light-dark(), so color-scheme alone flips them; shadows aren't colors, so they're set here.
        const bodyColor = ctx.bodyColor || 'var(--text-secondary)';
        for (const mode of ['dark', 'light', 'inverse']) {
            const lines = ctx.themeVars?.[mode] || [];
            const what = mode === 'inverse' ? 'the opposite theme of where it sits' : `the ${mode} theme`;
            raw('theme', `theme-${mode}`, `/* This part of the page in ${what}: surfaces, text, borders, hover states and shadows all follow */
${block(`.theme-${mode}`, lines.join('\n'))}

/* A background and text color of its own (any surface-* class replaces the background) */
${block(`:where(.theme-${mode})`, `background-color: var(--surface-1);\ncolor: ${bodyColor};`)}`);
        }
        add('theme', 'surface-action', `background-color: var(--action);
color: var(--on-action);
--text-primary: var(--on-action);
--text-secondary: var(--on-action);
--text-muted: color-mix(in oklab, var(--on-action) 75%, transparent);`);
        for (const s of ctx.states || []) {
            add('theme', `surface-${s}`, `background-color: var(--${s}-surface);
color: var(--${s}-text);
border-color: var(--${s}-border);
--text-primary: var(--${s}-text);
--text-secondary: var(--${s}-text);
--text-muted: var(--${s}-text);`);
        }
    }

    if (on('type')) {
        // line-height re-applied: it's ex-based, so it must resolve at the new font size.
        for (const step of ctx.typeSteps) add('type', `text-${step}`, `font-size: var(--${v('type', `text-${step}`)});\nline-height: var(--text-line-height);`);
        for (const name of ctx.bodySizes || []) add('type', name, `font-size: var(--${v('type', name)});\nline-height: var(--text-line-height);`);
        for (const h of ctx.headings) {
            add('type', `text-style-${h.name}`, `font-family: var(--${v('type', 'font-heading')});
font-size: var(--${v('type', h.name)});
font-weight: ${ctx.heading.weight};
line-height: var(--heading-line-height);
letter-spacing: ${ctx.heading.letterSpacing};
color: ${ctx.heading.color || 'var(--text-primary)'};`);
        }
        add('type', 'text-balance', 'text-wrap: balance;');
        add('type', 'text-pretty', 'text-wrap: pretty;');
        for (const n of [1, 2, 3]) {
            add('type', `line-clamp-${n}`, `display: -webkit-box;
-webkit-box-orient: vertical;
-webkit-line-clamp: ${n};
line-clamp: ${n};
overflow: hidden;`);
        }
    }

    // After the type classes: text-style-h1…h4 set a color, and text-muted etc. next to one must still win.
    if (on('text')) {
        for (const k of ['primary', 'secondary', 'muted']) add('text', `text-${k}`, `color: var(--text-${k});`);
        add('text', 'text-action', 'color: var(--action);');
        for (const s of ctx.states || []) add('text', `text-${s}`, `color: var(--${s}-text);`);
    }

    if (on('gap')) {
        // Both scales share the --space-* names (--space-m, --space-16), so the steps never clash.
        for (const step of [...ctx.spaceSteps, ...(ctx.fixedSteps || [])]) add('gap', `gap-${step}`, `gap: var(--${v('spacing', `space-${step}`)});`);
        for (const g of ['container', 'content', 'grid']) add('gap', `${g}-gap`, `gap: var(--${g}-gap);`);
    }

    if (on('padding')) {
        // Same steps as the gap classes: the fluid scale and, when it's on, the fixed scale.
        for (const step of [...ctx.spaceSteps, ...(ctx.fixedSteps || [])]) {
            const value = `var(--${v('spacing', `space-${step}`)})`;
            add('padding', `padding-${step}`, `padding: ${value};`);
            add('padding', `padding-block-${step}`, `padding-block: ${value};`);
            add('padding', `padding-inline-${step}`, `padding-inline: ${value};`);
        }
    }

    if (on('layout')) {
        add('layout', 'stack', `display: flex;
flex-direction: column;
gap: var(--content-gap);`);
        add('layout', 'cluster', `display: flex;
flex-wrap: wrap;
align-items: center;
gap: var(--content-gap);`);
        add('layout', 'center', `display: grid;
place-items: center;`);
        // 100vw includes the scrollbar: clip the sideways overflow (clip keeps position: sticky working).
        // :root, not html: Bricks' block editor scoper drops everything after `html` (html:has(.x)
        // became a bare .block-editor-iframe__html, once per class) but keeps what follows :root.
        const clip = (cls) => `/* No sideways scroll from the bleed */\n${block(`:root:has(.${cls})`, 'overflow-x: clip;')}`;
        raw('layout', 'full-bleed', `/* Full viewport width from inside a centered container */
${block('.full-bleed.full-bleed', `--_bleed: ${BLEED_GUTTER};
inline-size: 100vw;
max-inline-size: 100vw;
margin-inline: calc(50% - 50vw);`)}

${clip('full-bleed')}`);
        // Bleed selectors are doubled: they must beat a plain `margin: 0` on the same element.
        // One side: the gap between the container edge and the window edge, from the tokens, so it
        // works in any column that touches the container edge (not only in a centered parent).
        // --_keep: how far the parent reaches past the container on each side. 0 in a container
        // or a column; in a full-width parent (straight in a section) the kept side steps in to
        // the container line. Width + both margins always add up to the parent's width, so
        // centering (Bricks sections), block flow and grid tracks all place it the same.
        const mobile = ctx.bleedMobile === 'both' || ctx.bleedMobile === 'none' ? ctx.bleedMobile : 'keep';
        // Padded: the bleed stops short of the window edge by the section's inline padding, so the
        // box spans the viewport minus --sctn-inline-padding on each bled side (no padding of its
        // own). Only --_bleed differs, so the geometry, the phone options and full-bleed__content
        // children are shared. On phones the reach is 0: the box stays on the container line,
        // which already sits at the section padding.
        const reach = `max(0px, ${BLEED_GUTTER} - var(--sctn-inline-padding))`;
        const oneSide = (name, side, bleed) => {
            const other = side === 'left' ? 'right' : 'left';
            const phone = mobile === 'both'
                ? `\n\n/* Phones: edge to edge on both sides */\n@media (max-width: ${SPAN_RESET}px) {\n  .${name}.${name} {\n    inline-size: calc(100% - var(--_keep) * 2 + var(--_bleed) * 2);\n    margin-inline: calc(var(--_keep) - var(--_bleed));\n  }\n}`
                : mobile === 'none'
                    ? `\n\n/* Phones: no bleed */\n@media (max-width: ${SPAN_RESET}px) {\n  .${name}.${name} {\n    inline-size: calc(100% - var(--_keep) * 2);\n    margin-inline: var(--_keep);\n  }\n}`
                    : '';
            return `${block(`.${name}.${name}`, `--_bleed: ${bleed};
--_keep: max(0px, (100% - var(--bleed-container, var(--content-width))) / 2);
inline-size: calc(100% - var(--_keep) * 2 + var(--_bleed));
max-inline-size: none;
margin-${other}: var(--_keep);
margin-${side}: calc(var(--_keep) - var(--_bleed));`)}${phone}

${clip(name)}`;
        };
        for (const side of ['left', 'right']) {
            const other = side === 'left' ? 'right' : 'left';
            raw('layout', `full-bleed-${side}`, `/* Reaches the ${side} edge of the window; the ${other} side stays on the container line. Use it on an element that touches the container's ${side} edge: in a column, or straight in a section. */
${oneSide(`full-bleed-${side}`, side, BLEED_GUTTER)}`);
        }
        // On its own: both sides, the window minus the section padding. Next to full-bleed-left /
        // -right (the 1.0.10 combo) it only shortens their bleed, so existing pages keep working.
        raw('layout', 'full-bleed--padded', `/* The window width minus the section's inline padding on each side. Next to full-bleed-left / -right: that side stops at the section padding */
${block('.full-bleed--padded.full-bleed--padded:not(.full-bleed-left, .full-bleed-right)', `--_bleed: ${reach};
inline-size: calc(100vw - var(--sctn-inline-padding) * 2);
max-inline-size: calc(100vw - var(--sctn-inline-padding) * 2);
margin-inline: calc(50% - 50vw + var(--sctn-inline-padding));`)}

${block(':is(.full-bleed-left, .full-bleed-right):is(.full-bleed-left, .full-bleed-right).full-bleed--padded', `--_bleed: ${reach};`)}

${clip('full-bleed--padded')}`);
        for (const side of ['left', 'right']) {
            const other = side === 'left' ? 'right' : 'left';
            raw('layout', `full-bleed-${side}--padded`, `/* Reaches the ${side} edge of the window minus the section's inline padding; the ${other} side stays on the container line */
${oneSide(`full-bleed-${side}--padded`, side, reach)}`);
        }
        // A child of a bled box, back on the container line: the bled side gives the bleed back
        // (--_bleed, set by the full-bleed class and shortened by full-bleed--padded), so its
        // edges line up with the content around it in any column. Explicit width + margins work
        // in block, flex and grid parents alike. Doubled class: it must beat a plain width / margin.
        const inner = (side) => `inline-size: calc(100% - var(--_bleed));\nmax-inline-size: none;\nmargin-${side}: var(--_bleed);\nmargin-${side === 'left' ? 'right' : 'left'}: 0;`;
        const both = 'inline-size: calc(100% - var(--_bleed) * 2);\nmax-inline-size: none;\nmargin-inline: var(--_bleed);';
        const sides = ':is(.full-bleed-left, .full-bleed-right, .full-bleed-left--padded, .full-bleed-right--padded)';
        const phoneContent = mobile === 'both'
            ? `\n\n/* Phones: the box bleeds on both sides, so the content steps in on both */\n@media (max-width: ${SPAN_RESET}px) {\n  ${sides} > .full-bleed__content.full-bleed__content {\n    inline-size: calc(100% - var(--_bleed) * 2);\n    margin-inline: var(--_bleed);\n  }\n}`
            : mobile === 'none'
                ? `\n\n/* Phones: no bleed, so nothing to give back */\n@media (max-width: ${SPAN_RESET}px) {\n  ${sides} > .full-bleed__content.full-bleed__content {\n    inline-size: 100%;\n    margin-inline: 0;\n  }\n}`
                : '';
        raw('layout', 'full-bleed__content', `/* On a direct child of a full-bleed box: the box reaches the edge, this child stays within the container */
${block(':is(.full-bleed, .full-bleed--padded):not(.full-bleed-left, .full-bleed-right) > .full-bleed__content.full-bleed__content', both)}

${block(':is(.full-bleed-left, .full-bleed-left--padded) > .full-bleed__content.full-bleed__content', inner('left'))}

${block(':is(.full-bleed-right, .full-bleed-right--padded) > .full-bleed__content.full-bleed__content', inner('right'))}${phoneContent}`);
        add('layout', 'margin-top-auto', 'margin-block-start: auto;');
        for (const key of ctx.widths) {
            const name = key ? `content-width-${key}` : 'content-width';
            // Tells full-bleed-left / -right inside how wide this container is.
            add('layout', name, `inline-size: 100%;
max-inline-size: var(--${name});
margin-inline: auto;
--bleed-container: var(--${name});`);
        }
        if (ctx.autoSpacing) {
            raw('layout', 'auto-spacing', '/* Auto spacing: em top margins for the children (rules in the theme stylesheet) */\n.auto-spacing {}');
            raw('layout', 'auto-spacing--off', '/* Auto spacing off: on a container, or on one child to leave it alone */\n.auto-spacing--off {}');
        }
    }

    if (on('grid')) {
        const cols = Math.max(1, Math.min(12, Number(ctx.maxColumns) || 12));
        for (let n = 1; n <= cols; n++) {
            add('grid', `grid-${n}`, `display: grid;
grid-template-columns: var(--grid-${n});
gap: var(--grid-gap);`);
        }
        for (const name of ctx.asymmetric || []) {
            add('grid', name, `display: grid;
grid-template-columns: var(--${name});
gap: var(--grid-gap);`);
        }
        for (let n = 2; n <= Math.min(AUTO_GRID_MAX, cols); n++) {
            add('grid', `grid-auto-${n}`, `display: grid;
grid-template-columns: var(--grid-auto-${n});
gap: var(--grid-gap);`);
        }
        const span = (name, prop, value) => raw('grid', name, `${rule(name, `${prop}: ${value};`)}

/* One track on small screens, so the span never forces an extra column */
@media (max-width: ${SPAN_RESET}px) {
  .${name} {
    ${prop}: auto;
  }
}`);
        span('col-span-2', 'grid-column', 'span 2');
        span('col-span-3', 'grid-column', 'span 3');
        add('grid', 'col-span-full', 'grid-column: 1 / -1;');
        span('row-span-2', 'grid-row', 'span 2');
    }

    if (on('position')) {
        add('position', 'position-relative', 'position: relative;');
        add('position', 'position-absolute', 'position: absolute;');
        add('position', 'inset-0', 'inset: 0;');
        // align-self: start, or the sticky item stretches to its grid / flex row and never sticks.
        add('position', 'sticky-top', `position: sticky;
inset-block-start: calc(var(--header-offset, 0px) + var(--content-gap));
align-self: start;`);
    }

    if (on('borders')) {
        add('borders', 'border', 'border: 1px solid var(--border);');
        add('borders', 'border-subtle', 'border: 1px solid var(--border-subtle);');
        add('borders', 'border-strong', 'border: 1px solid var(--border-strong);');
        add('borders', 'border-top', 'border-block-start: 1px solid var(--border);');
        add('borders', 'border-bottom', 'border-block-end: 1px solid var(--border);');
    }

    if (on('radius')) {
        const sizes = ctx.radius.extraSizes ? ['none', 'xs', 's', 'm', 'l', 'xl', 'xxl', '50', 'circle'] : ['none', 'm', '50', 'circle'];
        for (const s of sizes) add('radius', `radius-${s}`, `border-radius: var(--radius-${s});`);
    }

    if (on('helpers')) {
        raw('helpers', 'clickable-card', `/* The whole card follows its main link: the link in its heading, or the one with .clickable-card__link */
${block(':where(.clickable-card)', 'position: relative;\nisolation: isolate;\ncursor: pointer;')}

${block(`.clickable-card :is(${CARD_LINK})::after`, `content: "";
position: absolute;
inset: 0;
z-index: 1;
border-radius: inherit;`)}

/* Other links, buttons and fields in the card stay clickable above it */
${block(`.clickable-card :where(a, button, input, select, textarea, label, summary, [tabindex]):not(${CARD_LINK})`, 'position: relative;\nz-index: 2;')}

/* Keyboard focus on the main link rings the whole card */
${block(`.clickable-card:has(:is(${CARD_LINK}):focus-visible)`, 'outline: var(--focus-width, 2px) solid var(--focus-color, currentColor);\noutline-offset: var(--focus-offset, 2px);')}

${block(`.clickable-card :is(${CARD_LINK}):focus-visible`, 'outline: none;')}`);
        raw('helpers', 'clickable-card__link', '/* Marks the main link of a .clickable-card when it isn\'t in the heading (rules on .clickable-card) */\n.clickable-card__link {}');
        add('helpers', 'img-cover', `position: absolute;
inset: 0;
inline-size: 100%;
block-size: 100%;
object-fit: cover;`);
        for (const [name, ratio] of [['ratio-1-1', '1'], ['ratio-3-2', '3 / 2'], ['ratio-4-3', '4 / 3'], ['ratio-4-5', '4 / 5'], ['ratio-16-9', '16 / 9']]) add('helpers', name, `aspect-ratio: ${ratio};`);
        add('helpers', 'sr-only', `position: absolute;
inline-size: 1px;
block-size: 1px;
padding: 0;
margin: -1px;
overflow: hidden;
clip-path: inset(50%);
white-space: nowrap;
border: 0;`);
        add('helpers', 'transition', 'transition: var(--transition);');
        if (ctx.selection) raw('helpers', 'selection--alt', '/* ::selection uses --selection-bg-alt / --selection-text-alt inside this element */\n.selection--alt {}');
    }
    return out;
}
