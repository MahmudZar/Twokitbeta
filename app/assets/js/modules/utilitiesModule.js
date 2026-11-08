/**
 * Utilities (Figma: "Utilities - screen").
 *
 *   Control   class groups as cards: open one to browse its classes, switch
 *             it on or off for export; search ("/" focuses it), expand /
 *             collapse all, live counts and the shipped size
 *   Preview   the selected class: breadcrumb, what it does, copy, a live
 *             Light / Dark preview on the real tokens, its CSS, and the other
 *             classes in its group
 *
 * Classes export as Bricks global classes (CSS in each class's CSS panel) and
 * in styles.css; Bricks prints only the classes a page uses. Groups that are
 * off can still be browsed, they just don't ship.
 *
 * Search, selection, opening groups and the preview theme update the page in
 * place (no re-render), so typing in the search field never loses focus.
 *
 * @module utilitiesModule
 */

import AppState from '../state/appState.js';
import { LEVELS } from '../core/surfaceSystem.js';
import { UTILITY_GROUPS, UTILITY_DEFAULTS, utilityClasses } from '../core/utilityClasses.js';
import { buttonClasses } from '../core/buttonsCss.js';
import { withDefaults as stylingDefaults } from '../core/stylingCss.js';
import { parseSteps, DEFAULT_SPACING_STEPS, DEFAULT_TYPE_STEPS } from '../core/fluidScale.js';

/** Step names of a spacing scale ('space-m' → 'm'); the step list when the scale isn't built yet. */
const stepNames = (scale, fallback) => (Array.isArray(scale) && scale.length
    ? scale.map((s) => String(s.name).replace(/^space-/, ''))
    : fallback ? parseSteps(fallback || DEFAULT_SPACING_STEPS) : []);
import { buttonContext, currentTheme } from '../state/themeModel.js';
import ThemeTokens from '../core/themeTokens.js';
import { autoSpacingCss } from '../core/autoSpacing.js';
import Notifications from '../ui/notifications.js';
import { esc } from '../ui/components.js';
import { highlight } from '../ui/highlight.js';
import { tokenPairs } from '../ui/tokenScope.js';

const svg = (d, size = 16) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    chev: svg('<path d="m9 18 6-6-6-6"/>'),
    chevSmall: svg('<path d="m9 18 6-6-6-6"/>', 12),
    copy: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    copySmall: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', 13),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>', 13),
    moon: svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>', 13),
    info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
    arrow: '<svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
const SAMPLE = 'The quick brown fox jumps over the lazy dog';
const LONG = 'Design tokens keep every page consistent. Change a variable once in Bricks and every class that reads it follows, across light and dark, on every page that uses it.';
const SIBLINGS_SHOWN = 12;

/** Unique var(--x) names a class reads, in order. */
const usedVars = (css) => [...new Set([...css.matchAll(/var\(--([\w-]+)/g)].map((m) => m[1]))];
const groupLabel = (id) => UTILITY_GROUPS.find((g) => g.id === id)?.label || id;
const isTyping = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** One sentence on what a class does, for the inspector. */
function describe(c) {
    const n = c.name;
    const step = (prefix) => n.slice(prefix.length);
    if (c.group === 'buttons') {
        if (n.startsWith('btn--icon')) return 'Makes a button square (or round) for a single icon. Use it next to a variant, like btn--primary btn--icon.';
        if (n.startsWith('btn--link')) return 'A text-only button that reads like a link, with the underline style from your button settings.';
        const size = /-s$/.test(n) ? 'small' : /-l$/.test(n) ? 'large' : 'default';
        const variant = n.replace(/^btn--/, '').replace(/-[sl]$/, '');
        return `The ${variant} button at the ${size} size, with hover, pressed and disabled states from your button settings.`;
    }
    if (c.group === 'surfaces') {
        if (n === 'surface-inverse') return 'Flips a block to the opposite theme’s surface and text, for tooltips, toasts and contrast bands.';
        if (n.startsWith('shadow-')) return `Adds elevation level ${step('shadow-')}: a shadow tuned for both light and dark themes.`;
        return `Sets the background to surface ${step('surface-')} of your surface ladder, so it follows light and dark.`;
    }
    if (c.group === 'theme') {
        if (n === 'theme-inverse') return 'Shows this part of the page in the opposite theme of where it sits: dark on a light page, light on a dark page or section. Surfaces, text, borders, hover states and shadows all switch.';
        if (n === 'theme-dark' || n === 'theme-light') {
            const mode = step('theme-');
            return `Shows this part of the page in the ${mode} theme, whatever the page uses: surfaces, text, borders, buttons and shadows all switch. It gets surface 1 as its background; add a surface class to pick another.`;
        }
        if (n === 'surface-action') return 'Fills a block with your action color and makes the headings and text inside readable on it (--on-action). For call-to-action bands and highlighted cards.';
        return `The ${step('surface-')} callout: its surface, text and border colors together, and headings inside follow. Add .border for an outline.`;
    }
    if (c.group === 'text') {
        return {
            'text-primary': 'Sets text to your primary text color. Use it for headings and the content people read first.',
            'text-secondary': 'Sets text to your secondary text color. Use it for supporting copy, captions and meta info.',
            'text-muted': 'Sets text to your muted text color, for timestamps, hints and captions that should recede.',
            'text-action': 'Colors text with your action color, for links, highlights and anything clickable.'
        }[n] || `Colors text with your ${step('text-')} text color, for messages, form feedback and status labels.`;
    }
    if (c.group === 'type') {
        if (n.startsWith('text-style-')) return `Gives any element the ${step('text-style-').toUpperCase()} heading style: font, size, weight, line height, tracking and color.`;
        if (n === 'text-balance') return 'Balances line lengths so short headings don’t end with a lonely word.';
        if (n === 'text-pretty') return 'Avoids a single word on the last line of paragraphs.';
        if (n.startsWith('line-clamp-')) return step('line-clamp-') === '1' ? 'Keeps text to one line and ends it with an ellipsis, for titles in cards, menus and tables.' : `Cuts text after ${step('line-clamp-')} lines with an ellipsis.`;
        if (/^text-\d+$/.test(n)) return `Sets a fixed ${step('text-')}px font size (it doesn’t scale with the viewport), with the text line height.`;
        return `Sets the font size to the ${step('text-')} step of your fluid type scale, with the matching line height.`;
    }
    if (c.group === 'gap') {
        if (n.endsWith('-gap')) return `Sets the gap between flex or grid children to your ${n.replace('-gap', '')} gap.`;
        return `Sets the gap between flex or grid children to the ${step('gap-')} spacing step.`;
    }
    if (c.group === 'padding') {
        const [, side, s] = n.match(/^padding-(?:(block|inline)-)?(.+)$/) || [];
        const where = side === 'block' ? 'top and bottom' : side === 'inline' ? 'left and right' : 'all four sides';
        return `Pads ${where} with the ${s} spacing step (--space-${s}), so the padding follows your spacing scale.`;
    }
    if (c.group === 'layout') {
        if (n === 'stack') return 'Stacks children vertically with your content gap between them.';
        if (n === 'cluster') return 'Lays children out in a row that wraps, with your content gap between them.';
        if (n === 'center') return 'Centers its content both ways (grid + place-items), for icons, empty states and hero content.';
        if (n === 'full-bleed') return 'Breaks out of a centered container to the full width of the window, for images and color bands. The page never scrolls sideways because of it.';
        if (n === 'full-bleed-left' || n === 'full-bleed-right') {
            const side = step('full-bleed-');
            const phone = { keep: `On phones it keeps bleeding ${side}`, both: 'On phones it goes edge to edge', none: 'On phones it stays inside the container' }[AppState.layout.bleedMobile] || `On phones it keeps bleeding ${side}`;
            return `Reaches the ${side} edge of the window while the other side stays on the container, for a split section's image or slider. Use it on an element that touches the container's ${side} edge: in any column, or straight in a section, where the other side starts on the container line. ${phone} (Layout → Content width).`;
        }
        if (n === 'full-bleed--padded') return 'Breaks out of the container to the width of the window minus your section’s inline padding (--sctn-inline-padding) on each side, so it lines up with the section padding instead of touching the edges. Works on its own. On phones it stays on the container line. For cards, images and color bands that should breathe.';
        if (n === 'full-bleed-left--padded' || n === 'full-bleed-right--padded') {
            const side = n.includes('left') ? 'left' : 'right';
            return `Like full-bleed-${side}, but the ${side} side stops at your section’s inline padding instead of the window edge; the other side stays on the container line. Works on its own. On phones it stays on the container line.`;
        }
        if (n === 'full-bleed__content') return 'Put it on a direct child of any full-bleed box (full-bleed, -left, -right, or their --padded versions): the box reaches the edge of the window, this child stays within the container and lines up with the content around it. For a caption, a text panel or a card on a bled image or color band.';
        if (n === 'margin-top-auto') return 'Pushes the element to the end of a flex column, so card buttons and footers line up at the bottom.';
        if (n === 'auto-spacing') return 'Spaces rich text automatically with em top margins: 1em above paragraphs, 1.2em above headings, lists and figures too. Rich text gets it without the class.';
        if (n === 'auto-spacing--off') return 'Turns auto spacing off: on a rich text block, or on one child so it keeps its own margins.';
        if (n.startsWith('content-width')) return `Caps the width at ${n === 'content-width' ? 'your content width' : `the ${step('content-width-')} content width`} and centers the block.`;
    }
    if (c.group === 'grid') {
        if (/^grid-\d+$/.test(n)) return step('grid-') === '1' ? 'A one-column grid with your grid gap, for stacking cards or form rows.' : `${step('grid-')} equal columns with your grid gap. They don’t collapse on their own: set the columns per breakpoint in Bricks, or use grid-auto for a responsive grid.`;
        if (/^grid-\d-\d$/.test(n)) { const [a, b] = step('grid-').split('-'); return `Two columns in a ${a}:${b} ratio with your grid gap, for text and image, or content and sidebar.`; }
        if (n.startsWith('grid-auto-')) return `A responsive grid of up to ${step('grid-auto-')} columns that drops columns as space runs out, no breakpoints needed.`;
        if (n === 'col-span-full') return 'Spans every column of its grid, for a full-width row inside a grid.';
        if (n.startsWith('col-span-')) return `Makes an item span ${step('col-span-')} columns of its grid. Up to 767px it falls back to one column, so it never forces an extra one.`;
        if (n === 'row-span-2') return 'Makes an item two rows tall in its grid, for bento layouts. Up to 767px it falls back to one row.';
    }
    if (c.group === 'position') {
        return {
            'position-relative': 'Makes the element the anchor for positioned children: badges, overlays, img-cover and clickable cards.',
            'position-absolute': 'Takes the element out of the flow and places it in its nearest positioned ancestor. Pair it with inset-0 or your own offsets.',
            'inset-0': 'Stretches a positioned element over its anchor on all four sides, for overlays and background media.',
            'sticky-top': 'Sticks to the top while scrolling, below your fixed header (--header-offset) with your content gap. Works inside grid and flex layouts too.'
        }[n];
    }
    if (c.group === 'borders') {
        if (n === 'border-top' || n === 'border-bottom') return `A 1px ${step('border-')} border in your border color, for dividers between rows and sections.`;
        return `A 1px border in your ${n === 'border' ? 'default' : step('border-')} border color, for cards, fields and outlines. It follows light and dark.`;
    }
    if (c.group === 'radius') return n === 'radius-circle' ? 'Rounds corners fully, for pills and circles.' : n === 'radius-none' ? 'Removes corner rounding.' : `Rounds corners with the ${step('radius-')} step of your radius scale.`;
    return {
        'sr-only': 'Hides content visually but keeps it for screen readers.',
        'clickable-card': 'Makes the whole card a link: the link in its heading (or .clickable-card__link) covers the card. Other links and buttons inside stay clickable, and keyboard focus rings the whole card.',
        'clickable-card__link': 'Picks the link that makes a .clickable-card clickable, when it isn’t the one in the heading (a "Read more" link, a button-styled link).',
        'img-cover': 'Makes an image fill its positioned parent, cropping to fit.',
        transition: 'Adds your transition to any property change.',
        'selection--alt': 'Uses the alternate selection colors inside this element.'
    }[n] || (n.startsWith('ratio-') ? `Keeps a ${step('ratio-').replace('-', ':')} aspect ratio.` : `A utility class from ${groupLabel(c.group)}.`);
}

/** Theme tokens as light-dark() pairs, so a theme-dark / theme-light demo flips inside the preview. */
function switchableTokens() {
    const val = (e) => (e.alpha < 1 ? e.css : e.hex);
    return ThemeTokens.tokens(currentTheme()).map((t) => `--${t.name}:light-dark(${val(t.light)},${val(t.dark)})`).join(';');
}

const UtilitiesModule = {
    title: 'Utility classes',
    previewModes: false,
    query: '',

    groups() {
        return { ...UTILITY_DEFAULTS, ...AppState.utilities?.groups, surfaces: Boolean(AppState.theme.enableClasses) };
    },

    /** Every class that ships, as { group, name, css }. */
    classes(groups = this.groups()) {
        const t = AppState.typography;
        const styling = stylingDefaults(AppState.styling);
        const model = currentTheme();
        return utilityClasses({
            groups,
            levels: LEVELS,
            inverse: AppState.theme.enableInverse,
            shadows: model.shadows,
            themeVars: { dark: ThemeTokens.contextVars(model, 'dark'), light: ThemeTokens.contextVars(model, 'light'), inverse: ThemeTokens.inverseVars(model) },
            bodyColor: t.bodyColor,
            states: AppState.stateColors.filter((c) => c.shades?.length || c.baseColor).map((c) => c.name),
            maxColumns: AppState.layout.maxColumns,
            bleedMobile: AppState.layout.bleedMobile,
            asymmetric: (AppState.layout.generated?.asymmetricGrids || []).map((g) => g.name),
            // Gap classes follow the spacing scales that are on: every fluid step (gap-m) and every
            // fixed step (gap-16), named after their variables (--space-m, --space-16).
            spaceSteps: AppState.spacing.enableFluidSpacing ? stepNames(AppState.spacing.fluidScale, AppState.spacing.fluid.steps) : [],
            fixedSteps: AppState.spacing.enableFixedSpacing ? stepNames(AppState.spacing.fixedScale) : [],
            typeSteps: parseSteps(t.scaleSteps || DEFAULT_TYPE_STEPS),
            bodySizes: t.enableBodySizes !== false ? (t.scale?.body || []).map((b) => b.name) : [],
            headings: (t.scale?.headings || []).slice().sort((a, b) => a.name.localeCompare(b.name)),
            heading: { weight: t.headingWeight || '600', letterSpacing: t.headingLetterSpacing || 'normal', color: t.headingColor || 'var(--text-primary)' },
            widths: (AppState.layout.generated?.contentWidths || []).map((w) => w.key || ''),
            radius: styling.radius,
            selection: styling.selection.enabled,
            autoSpacing: AppState.spacing.auto?.enabled !== false,
            buttonClasses: buttonClasses(AppState.buttons, buttonContext()),
            v: (section, name) => AppState.tokenName(section, name)
        });
    },

    /** Every class, shipped or not (browsing works for groups that are off). */
    allClasses() {
        return this.classes(Object.fromEntries(UTILITY_GROUPS.map((g) => [g.id, true])));
    },

    /** All class CSS (CSS export). */
    css() {
        return this.classes().map((c) => c.css).join('\n\n');
    },

    /* ---------------- state ---------------- */

    /** Open groups, kept in ui as "text,type" (a string persists with the workspace). */
    openGroups() {
        return new Set(String(AppState.ui.utilityOpen ?? 'text').split(',').filter((id) => UTILITY_GROUPS.some((g) => g.id === id)));
    },

    setOpen(ids) {
        AppState.ui.utilityOpen = [...ids].join(',');
    },

    selected(classes = this.cache || this.allClasses()) {
        return classes.find((c) => c.name === AppState.ui.utilityClass) || classes[0] || null;
    },

    matches(c) {
        const q = this.query.trim().toLowerCase().replace(/^\./, '');
        return !q || c.name.includes(q) || c.css.toLowerCase().includes(q);
    },

    /* ---------------- control ---------------- */

    view() {
        const on = this.groups();
        const all = this.allClasses();
        this.cache = all;
        const shipped = this.classes(on);
        const bytes = new TextEncoder().encode(shipped.map((c) => c.css).join('\n')).length;
        const current = this.selected(all);
        const open = this.openGroups();
        // A remembered class that no longer exists (group edited away) falls back to the first one, shown open.
        if (current && current.name !== AppState.ui.utilityClass) {
            AppState.ui.utilityClass = current.name;
            open.add(current.group);
            this.setOpen(open);
        } else if (current && !open.has(current.group) && AppState.ui.utilityOpen == null) open.add(current.group);
        const groupsWithClasses = UTILITY_GROUPS.filter((g) => all.some((c) => c.group === g.id));
        const onCount = groupsWithClasses.filter((g) => on[g.id] !== false).length;

        const control = `
          <div class="ex-side ut-side" data-utl-root>
            <section class="ut-groups" aria-labelledby="utTitle">
              <header class="ut-head">
                <div class="ut-head__row"><h2 id="utTitle">Class groups</h2><span class="ut-badge" title="What ships in styles.css and to Bricks">${shipped.length} ${shipped.length === 1 ? 'class' : 'classes'} · ${(bytes / 1024).toFixed(1)} KB</span></div>
                <p>Turn groups on or off, open one to browse</p>
              </header>
              <label class="ut-search">
                ${I.search}
                <input type="search" data-utl-search data-fid="utl-search" value="${esc(this.query)}" placeholder="Search classes" aria-label="Search classes" autocomplete="off" spellcheck="false">
                <kbd aria-hidden="true">/</kbd>
              </label>
              <div class="ut-toolbar">
                <span data-utl-summary>${groupsWithClasses.length} groups · ${onCount} on</span>
                <span class="ut-toolbar__actions">
                  <button type="button" data-utl-all="open" data-fid="utl-expand">Expand all</button>
                  <button type="button" data-utl-all="close" data-fid="utl-collapse">Collapse all</button>
                </span>
              </div>
              <div class="ut-list" data-utl-list>
                ${groupsWithClasses.map((g) => this.groupCard(g, all.filter((c) => c.group === g.id), on[g.id] !== false, open.has(g.id), current)).join('')}
                <p class="ut-empty" data-utl-empty hidden>No class matches “<span></span>”.</p>
              </div>
            </section>
            <p class="ut-note">${I.info}<span>Exported as Bricks global classes. Bricks only prints the classes a page uses, so unused ones cost nothing.</span></p>
          </div>`;
        return { control, preview: this.preview(current) };
    },

    groupCard(g, items, on, open, current) {
        const shown = items.filter((c) => this.matches(c)).length;
        const searching = Boolean(this.query.trim());
        const expanded = searching ? shown > 0 : open;
        return `
          <section class="ut-group${expanded ? ' is-open' : ''}${on ? '' : ' is-off'}" data-utl-group="${g.id}"${searching && !shown ? ' hidden' : ''}>
            <div class="ut-group__head">
              <button type="button" class="ut-group__toggle" data-utl-open="${g.id}" aria-expanded="${expanded}" aria-controls="utl-body-${g.id}" data-fid="utl-open-${g.id}" title="${esc(g.hint)}">
                <span class="ut-group__chev">${I.chev}</span>
                <span class="ut-group__name">${esc(g.label)}</span>
                <span class="ut-count" data-utl-count>${searching ? shown : items.length}</span>
              </button>
              ${on ? '' : '<span class="ut-group__off">Not exported</span>'}
              <button type="button" class="ut-switch" role="switch" aria-checked="${on}" data-utl-switch="${g.id}" data-fid="utl-${g.id}" aria-label="Export ${esc(g.label)} classes"><span></span></button>
            </div>
            <div class="ut-group__body" id="utl-body-${g.id}">
              <ul class="ut-rows" role="list">${items.map((c) => this.row(c, c === current)).join('')}</ul>
            </div>
          </section>`;
    },

    row(c, active) {
        const vars = usedVars(c.css);
        // The class's own token (btn--primary-s → --btn-primary-bg), else the first one it reads.
        const key = c.name.replace(/^btn--/, 'btn-').replace(/-[sl]$/, '');
        const lead = vars.find((v) => v === `${key}-bg`) || vars.find((v) => v === c.name) || vars.find((v) => v.startsWith(key)) || vars[0];
        const meta = lead ? `--${lead}` : c.css.match(/\{\s*([\w-]+)\s*:/)?.[1] || '';
        return `<li${this.matches(c) ? '' : ' hidden'}>
            <button type="button" class="ut-row${active ? ' is-selected' : ''}" data-utl-class="${esc(c.name)}" aria-current="${active}">
              <code>.${esc(c.name)}</code><span>${esc(meta)}</span>
            </button>
          </li>`;
    },

    /* ---------------- preview (inspector) ---------------- */

    preview(c) {
        if (!c) return '<div class="ex-view"><div class="ex-panel"><p class="ut-none">No utility classes: every group is empty.</p></div></div>';
        return `<div class="ex-view" data-ex-view="utilities"><div class="ex-panel"><div class="ex-panel__body" data-utl-inspector aria-live="polite">${this.inspector(c)}</div></div></div>`;
    },

    inspector(c) {
        const mode = AppState.ui.utilityDemoMode === 'dark' ? 'dark' : 'light';
        const label = groupLabel(c.group);
        const on = this.groups()[c.group] !== false;
        const siblings = (this.cache || []).filter((x) => x.group === c.group && x !== c);
        const shownSiblings = siblings.slice(0, SIBLINGS_SHOWN);
        const demo = this.demo(c);
        return `
          <header class="ut-title">
            <div class="ut-title__text">
              <nav class="ut-crumbs" aria-label="Breadcrumb"><span>Utilities</span>${I.chevSmall}<button type="button" data-utl-reveal="${c.group}">${esc(label)}</button></nav>
              <h2><code>.${esc(c.name)}</code></h2>
              <p>${esc(describe(c))}</p>
            </div>
            <button type="button" class="ut-btn" data-utl-copy="name" data-fid="utl-copy-name">${I.copy}<span>Copy class</span></button>
          </header>
          <div class="ut-cards">
            ${on ? '' : `
            <div class="ut-off" role="status">
              <span>${esc(label)} is off, so <code>.${esc(c.name)}</code> isn’t exported to Bricks or styles.css.</span>
              <button type="button" class="ut-btn ut-btn--sm" data-utl-switch="${c.group}" data-utl-value="on" data-fid="utl-enable-${c.group}">Turn on ${esc(label)}</button>
            </div>`}
            ${demo ? `
            <section class="ut-card" aria-label="Preview">
              <header class="ut-card__head">
                <h3>Preview</h3>
                <div class="ut-modes" role="group" aria-label="Preview theme">
                  ${['light', 'dark'].map((m) => `<button type="button" data-utl-mode="${m}" aria-pressed="${m === mode}">${m === 'light' ? I.sun : I.moon}<span>${m === 'light' ? 'Light' : 'Dark'}</span></button>`).join('')}
                </div>
              </header>
              <div class="ut-card__pad">
                <div class="ucb__stage ut-stage" data-mode="${mode}" style="${esc(tokenPairs(mode).map(([k, v]) => `${k}:${v}`).join(';'))}">
                  <style>.ut-stage { ${(this.cache || []).map((x) => x.css).join('\n')}\n${autoSpacingCss(AppState.spacing.auto)} }</style>
                  ${demo}
                </div>
              </div>
            </section>` : ''}
            <section class="ut-card" aria-label="CSS">
              <header class="ut-card__head">
                <h3>CSS</h3>
                <button type="button" class="ut-btn ut-btn--sm" data-utl-copy="css" data-fid="utl-copy-css">${I.copySmall}<span>Copy CSS</span></button>
              </header>
              <pre class="code-block ut-code"><code>${highlight(c.css)}</code></pre>
            </section>
            ${siblings.length ? `
            <section class="ut-siblings" aria-label="More in ${esc(label)}">
              <h3>More in ${esc(label)}</h3>
              <div class="ut-chips">
                ${shownSiblings.map((x) => `<button type="button" class="ut-chip" data-utl-class="${esc(x.name)}"><code>.${esc(x.name)}</code></button>`).join('')}
                ${siblings.length > SIBLINGS_SHOWN ? `<button type="button" class="ut-chip ut-chip--more" data-utl-reveal="${c.group}">+${siblings.length - SIBLINGS_SHOWN} more</button>` : ''}
              </div>
            </section>` : ''}
          </div>`;
    },

    /** Live demo markup for a class, or '' when it has nothing to show. */
    demo(c) {
        const n = esc(c.name);
        const boxes = (count, extra = () => '') => Array.from({ length: count }, (_, i) => `<span class="ucb-box"${extra(i)}>${i + 1}</span>`).join('');
        const noop = 'href="#" data-noop';
        if (c.group === 'buttons') {
            if (c.name.startsWith('btn--icon')) {
                return `<div class="ucb-row">${['primary', 'secondary', 'ghost'].map((v) => `<button type="button" class="btn--${v} ${n}" aria-label="Next">${I.arrow}</button>`).join('')}</div>
                  <p class="ucb-note">Used next to a variant: <code>btn--primary ${n}</code></p>`;
            }
            return `<div class="ucb-row"><a class="${n}" ${noop}>Button</a><a class="${n}" ${noop}>With icon ${I.arrow}</a><button type="button" class="${n}" disabled>Disabled</button></div>
              <p class="ucb-note">Hover to see the hover colors.</p>`;
        }
        if (c.group === 'surfaces') {
            if (c.name.startsWith('shadow')) return `<div class="ucb-card ${n}">${n}</div>`;
            return `<div class="ucb-card ucb-card--flat ${n}">${n}<span>${SAMPLE}</span></div>`;
        }
        if (c.group === 'theme') {
            if (c.name.startsWith('theme-')) {
                const stageMode = AppState.ui.utilityDemoMode === 'dark' ? 'dark' : 'light';
                const other = stageMode === 'dark' ? 'light' : 'dark';
                const mode = c.name === 'theme-inverse' ? other : c.name.slice(6);
                // The stage is one theme; give it what a theme context sets, so theme-inverse knows its opposite.
                const ctxVars = ThemeTokens.contextVars(currentTheme(), stageMode).map((l) => l.replace(/;$/, '')).join(';');
                return `<div class="ucb-switchable" style="${esc(`${switchableTokens()};${ctxVars}`)}">
                    <section class="${n} ucb-section">
                      <p class="ucb-text"><b>A ${mode} section</b></p>
                      <p class="ucb-sub">Surfaces, text, borders and shadows follow the ${mode} theme.</p>
                      <div class="ucb-card surface-2 shadow-2">Card on surface 2<span>${SAMPLE}</span></div>
                      <div class="ucb-row"><a class="btn--primary-s" ${noop}>Primary</a><a class="btn--outline-s" ${noop}>Outline</a></div>
                    </section>
                  </div>
                  <p class="ucb-note">${c.name === 'theme-inverse' ? 'Switch the preview between Light and Dark: this section always takes the other one.' : `Switch the preview between Light and Dark: this section stays ${mode}.`}</p>`;
            }
            return `<div class="${n} ucb-section${c.name === 'surface-action' ? '' : ' border'}">
                <p class="ucb-text"><b>${c.name === 'surface-action' ? 'Start planning today' : 'Heads up'}</b></p>
                <p class="ucb-sub">${c.name === 'surface-action' ? 'Headings and text inside read on the action color.' : `The ${esc(c.name.slice(8))} surface, text and border, together.`}</p>
              </div>${c.name === 'surface-action' ? '' : '<p class="ucb-note">Shown with <code>.border</code> for the outline.</p>'}`;
        }
        if (c.group === 'text') {
            if (!['text-primary', 'text-secondary', 'text-muted', 'text-action'].includes(c.name)) {
                return `<p class="ut-sample-title ${n}">Your changes were saved.</p><p class="ut-sample-body ${n}">${esc(describe(c))}</p>`;
            }
            return `<p class="ut-sample-title ${n}">${SAMPLE}</p><p class="ut-sample-body ${n}">${esc(describe(c).replace(/^Sets text to your |^Colors text with your /, 'This text uses your '))}</p>`;
        }
        if (c.group === 'type') {
            if (c.name.startsWith('line-clamp') || c.name === 'text-balance' || c.name === 'text-pretty') return `<p class="ucb-text ucb-text--narrow ${n}">${LONG}</p>`;
            return `<p class="ucb-text ${n}">${SAMPLE}</p>`;
        }
        if (c.group === 'gap') return `<div class="ucb-flex ${n}">${boxes(4)}</div>`;
        if (c.group === 'padding') return `<div class="ucb-pad ${n}"><span class="ucb-box ucb-box--wide">Content</span></div><p class="ucb-note">The tinted area is the padding.</p>`;
        if (c.group === 'layout') {
            if (c.name.startsWith('content-width')) return `<div class="ucb-ruler"><div class="${n} ucb-box ucb-box--wide">max-inline-size: var(--${n})</div></div>`;
            if (c.name === 'center') return `<div class="${n} ucb-pos"><span class="ucb-badge">Centered</span></div>`;
            if (/^full-bleed-(left|right)(--padded)?$/.test(c.name)) {
                const left = c.name.includes('left');
                const padded = c.name.endsWith('--padded');
                return `<div class="ucb-split${left ? ' ucb-split--left' : ''}${padded ? ' ucb-split--padded' : ''}" aria-hidden="true">
                    <span class="ucb-split__line"></span><span class="ucb-split__line ucb-split__line--end"></span>
                    <div class="ucb-split__text"><b>Split section</b><span>Text stays on the container line.</span></div>
                    <div class="ucb-split__media">.${n}</div>
                  </div>
                  <p class="ucb-note">Dashed lines: the container. The image runs past it to the ${left ? 'left' : 'right'} ${padded ? 'section padding, short of the window edge' : 'edge of the window'}. Drawn to scale.</p>`;
            }
            if (c.name === 'full-bleed__content') {
                return `<div class="ucb-split" aria-hidden="true">
                    <span class="ucb-split__line"></span><span class="ucb-split__line ucb-split__line--end"></span>
                    <div class="ucb-split__text"><b>Split section</b><span>Text stays on the container line.</span></div>
                    <div class="ucb-split__media ucb-split__media--content"><span class="ucb-split__caption">.${n} stops at the container line</span></div>
                  </div>
                  <p class="ucb-note">The image is <code>full-bleed-right</code>; the panel inside it is <code>${n}</code>. Dashed lines: the container.</p>`;
            }
            if (c.name === 'full-bleed--padded') {
                return `<div class="ucb-bleed" aria-hidden="true">
                    <div class="ucb-bleed__container">Container content</div>
                    <div class="ucb-bleed__band ucb-bleed__band--padded">Window width minus the section padding on each side</div>
                    <div class="ucb-bleed__container">Container content</div>
                  </div>
                  <p class="ucb-note">The gaps at the sides are your section’s inline padding. Drawn to scale.</p>`;
            }
            if (c.name === 'full-bleed') {
                return `<div class="ucb-bleed" aria-hidden="true">
                    <div class="ucb-bleed__container">Container content</div>
                    <div class="ucb-bleed__band">.full-bleed reaches both edges of the window</div>
                    <div class="ucb-bleed__container">Container content</div>
                  </div>
                  <p class="ucb-note">Drawn to scale here: the real class spans the whole browser window.</p>`;
            }
            if (c.name === 'margin-top-auto') {
                return `<div class="ucb-pair">
                    <div class="ucb-card"><b>Short card</b><span>One line of text.</span><a class="btn--secondary-s ${n}" ${noop}>Read</a></div>
                    <div class="ucb-card"><b>Longer card</b><span>${LONG}</span><a class="btn--secondary-s ${n}" ${noop}>Read</a></div>
                  </div>
                  <p class="ucb-note">Both buttons sit at the bottom, whatever the text length.</p>`;
            }
            if (c.name.startsWith('auto-spacing')) {
                const off = c.name === 'auto-spacing--off';
                return `<div class="auto-spacing ucb-ruler ucb-prose${off ? ' auto-spacing--off' : ''}">
                    <h4>The route, day by day</h4>
                    <p>We built it around one rule: never more than three hours on a train in a day.</p>
                    <p>That leaves every afternoon free for walking or sitting by a lake.</p>
                    <ul><li>Panorama seats reserved</li><li>Local fixer on call</li></ul>
                  </div>
                  <p class="ucb-note">${off ? 'Auto spacing switched off: the children keep their own margins.' : 'Spaced by auto spacing alone: no margins on the children.'}</p>`;
            }
            return `<div class="${n}">${boxes(c.name === 'stack' ? 3 : 6)}</div>`;
        }
        if (c.group === 'grid') {
            if (/^grid-\d+$/.test(c.name)) {
                const cols = Number(c.name.slice(5));
                return `<div class="${n}">${boxes(cols < 4 ? cols * 2 : cols)}</div>`;
            }
            if (/^grid-\d-\d$/.test(c.name)) {
                const [a, b] = c.name.slice(5).split('-');
                return `<div class="${n}"><span class="ucb-box">${a}fr</span><span class="ucb-box">${b}fr</span></div>`;
            }
            if (c.name.startsWith('grid-auto-')) return `<div class="${n}">${boxes(6)}</div><p class="ucb-note">Columns drop as the space gets narrower.</p>`;
            if (c.name === 'row-span-2') return `<div class="grid-3">${boxes(5, (i) => (i === 0 ? ` class-extra` : ''))}</div>`.replace('class="ucb-box" class-extra', `class="ucb-box ucb-box--on ${n}"`);
            const host = c.name === 'col-span-3' ? 'grid-4' : 'grid-3';
            return `<div class="${host}">${boxes(c.name === 'col-span-full' ? 4 : 5, (i) => (i === 0 ? ' class-extra' : ''))}</div><p class="ucb-note">Shown in a .${host}.</p>`.replace('class="ucb-box" class-extra', `class="ucb-box ucb-box--on ${n}"`);
        }
        if (c.group === 'position') {
            if (c.name === 'sticky-top') {
                return `<div class="ucb-scroll">
                    <aside class="${n} ucb-box ucb-box--on">Sticky</aside>
                    <div class="stack">${Array.from({ length: 8 }, (_, i) => `<span class="ucb-box ucb-box--wide">Content ${i + 1}</span>`).join('')}</div>
                  </div>
                  <p class="ucb-note">Scroll the box: the sticky item stays at the top.</p>`;
            }
            if (c.name === 'inset-0') return `<div class="position-relative ucb-pos"><span class="ucb-sub">Card content</span><span class="position-absolute ${n} ucb-overlay">.inset-0 overlay</span></div>`;
            if (c.name === 'position-absolute') return `<div class="position-relative ucb-pos"><span class="ucb-sub">.position-relative card</span><span class="${n} ucb-badge" style="inset-block-start:8px;inset-inline-end:8px">.position-absolute</span></div>`;
            return `<div class="${n} ucb-pos"><span class="ucb-sub">.position-relative card</span><span class="position-absolute ucb-badge" style="inset-block-start:8px;inset-inline-end:8px">Badge</span></div><p class="ucb-note">The badge is placed against this card.</p>`;
        }
        if (c.group === 'borders') {
            if (c.name === 'border-top' || c.name === 'border-bottom') return `<div class="ucb-rows">${['Bernina Express', 'Glacier Express', 'Golden Pass'].map((x) => `<div class="${n}">${x}</div>`).join('')}</div>`;
            return `<div class="ucb-card ${n}">.${n}<span>${SAMPLE}</span></div>`;
        }
        if (c.group === 'radius') return `<div class="ucb-card ucb-card--radius ${n}"></div>`;
        if (c.name.startsWith('ratio')) return `<div class="ucb-card ucb-card--ratio ${n}">${n.slice(6).replace('-', ' : ')}</div>`;
        if (c.name === 'img-cover') return `<div class="ucb-frame"><span class="ucb-img ${n}"></span><span class="ucb-note">image fills its positioned parent</span></div>`;
        if (c.name === 'clickable-card') {
            return `<article class="ucb-card ucb-card--click clickable-card">
                <h4><a ${noop}>The window seat guide</a></h4>
                <span>${SAMPLE}</span>
                <a class="ucb-tag" ${noop}>Rail</a>
              </article>
              <p class="ucb-note">Hover anywhere: the title link reacts. The “Rail” tag stays its own link. Tab to the title and the whole card gets the focus ring.</p>`;
        }
        if (c.name === 'clickable-card__link') {
            return `<article class="ucb-card ucb-card--click clickable-card">
                <b>Inn to inn</b>
                <span>${SAMPLE}</span>
                <a class="btn--secondary-s clickable-card__link" ${noop}>Read more</a>
              </article>
              <p class="ucb-note">No link in the heading, so “Read more” carries the card.</p>`;
        }
        if (c.name === 'transition') return `<div class="ucb-card ucb-card--hover ${n}">Hover me</div>`;
        if (c.name === 'sr-only') return `<p class="ucb-text">Visible text <span class="${n}">and a part only screen readers hear</span></p><p class="ucb-note">The second half is hidden on screen but still read aloud.</p>`;
        return '';
    },

    /* ---------------- in-place updates ---------------- */

    patch() {
        document.getElementById('previewBody')?.setAttribute('data-patched', '1');
    },

    /** Select a class: highlight its row (opening its group) and redraw the inspector. */
    select(name, { focusRow = false } = {}) {
        const c = (this.cache || []).find((x) => x.name === name);
        if (!c) return;
        AppState.ui.utilityClass = name; // no re-render; the next render reads it
        document.querySelectorAll('.ut-row').forEach((el) => {
            const on = el.dataset.utlClass === name;
            el.classList.toggle('is-selected', on);
            el.setAttribute('aria-current', String(on));
        });
        this.openGroup(c.group, true);
        const row = document.querySelector(`.ut-row[data-utl-class="${CSS.escape(name)}"]`);
        row?.scrollIntoView({ block: 'nearest' });
        if (focusRow) row?.focus();
        const inspector = document.querySelector('[data-utl-inspector]');
        if (inspector) {
            inspector.innerHTML = this.inspector(c);
            inspector.scrollTop = 0;
        }
        this.patch();
    },

    openGroup(id, open) {
        const section = document.querySelector(`[data-utl-group="${CSS.escape(id)}"]`);
        if (!section) return;
        section.classList.toggle('is-open', open);
        section.querySelector('.ut-group__toggle')?.setAttribute('aria-expanded', String(open));
        if (!this.query.trim()) {
            const ids = this.openGroups();
            if (open) ids.add(id); else ids.delete(id);
            this.setOpen(ids);
        }
    },

    /** Search: rows and groups filter in place; groups with matches open while searching. */
    filter() {
        const searching = Boolean(this.query.trim());
        const open = this.openGroups();
        let any = false;
        document.querySelectorAll('[data-utl-group]').forEach((section) => {
            let shown = 0;
            const rows = section.querySelectorAll('.ut-row');
            rows.forEach((el) => {
                const c = this.cache.find((x) => x.name === el.dataset.utlClass);
                const ok = Boolean(c && this.matches(c));
                el.parentElement.hidden = !ok;
                if (ok) shown++;
            });
            section.hidden = searching && !shown;
            const expanded = searching ? shown > 0 : open.has(section.dataset.utlGroup);
            section.classList.toggle('is-open', expanded);
            section.querySelector('.ut-group__toggle')?.setAttribute('aria-expanded', String(expanded));
            section.querySelector('[data-utl-count]').textContent = searching ? shown : rows.length;
            any ||= shown > 0;
        });
        const empty = document.querySelector('[data-utl-empty]');
        if (empty) {
            empty.hidden = any;
            empty.querySelector('span').textContent = this.query;
        }
    },

    visibleRows() {
        return [...document.querySelectorAll('.ut-group.is-open:not([hidden]) .ut-row')].filter((el) => !el.parentElement.hidden);
    },

    afterRender(control) {
        const root = control.querySelector('[data-utl-root]');
        if (!root || root.dataset.bound) return;
        root.dataset.bound = '1';
        // Arrow keys move through the visible rows and select as they go.
        root.addEventListener('keydown', (event) => {
            const search = event.target.matches('[data-utl-search]');
            if (search && event.key === 'Escape' && this.query) {
                event.preventDefault();
                event.target.value = '';
                this.query = '';
                this.filter();
                return;
            }
            if (search && (event.key === 'Enter' || event.key === 'ArrowDown')) {
                const first = this.visibleRows()[0];
                if (!first) return;
                event.preventDefault();
                this.select(first.dataset.utlClass, { focusRow: true });
                return;
            }
            if (!event.target.matches('.ut-row') || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            const rows = this.visibleRows();
            const i = rows.indexOf(event.target);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1
                : Math.max(0, Math.min(rows.length - 1, i + (event.key === 'ArrowDown' ? 1 : -1)));
            event.preventDefault();
            if (rows[next]) this.select(rows[next].dataset.utlClass, { focusRow: true });
        });
        root.querySelector('.ut-row.is-selected')?.scrollIntoView({ block: 'nearest' });
        // "/" focuses search from anywhere on this screen (bound once for the app).
        if (!this.slashBound) {
            this.slashBound = true;
            document.addEventListener('keydown', (event) => {
                if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || isTyping(document.activeElement)) return;
                const input = document.querySelector('[data-utl-search]');
                if (!input) return;
                event.preventDefault();
                input.focus();
                input.select();
            });
        }
    },

    copy(text, message) {
        if (!navigator.clipboard?.writeText) return Notifications.info('Clipboard unavailable');
        navigator.clipboard.writeText(text).then(() => Notifications.success(message), () => Notifications.info('Clipboard unavailable'));
        return undefined;
    },

    /** Turn a group on or off (surfaces is the theme's enableClasses). */
    setGroup(id, value) {
        if (id === 'surfaces') return AppState.updateTheme({ enableClasses: Boolean(value) });
        return AppState.updateUtilities({ groups: { ...AppState.utilities?.groups, [id]: Boolean(value) } });
    },

    /* ---------------- events ---------------- */

    onInput(event) {
        if (!event.target.matches('[data-utl-search]')) return;
        this.query = event.target.value;
        this.filter();
    },

    onClick(event) {
        const toggle = event.target.closest('[data-utl-switch]');
        if (toggle) {
            const id = toggle.dataset.utlSwitch;
            const value = toggle.dataset.utlValue ? toggle.dataset.utlValue === 'on' : this.groups()[id] === false;
            this.setGroup(id, value);
            return;
        }
        const row = event.target.closest('[data-utl-class]');
        if (row) return this.select(row.dataset.utlClass, { focusRow: row.classList.contains('ut-chip') ? false : true });
        const opener = event.target.closest('[data-utl-open]');
        if (opener) {
            if (this.query.trim()) return undefined; // search decides what's open
            const section = opener.closest('[data-utl-group]');
            return this.openGroup(opener.dataset.utlOpen, !section.classList.contains('is-open'));
        }
        const reveal = event.target.closest('[data-utl-reveal]');
        if (reveal) {
            this.openGroup(reveal.dataset.utlReveal, true);
            document.querySelector(`[data-utl-group="${CSS.escape(reveal.dataset.utlReveal)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            return undefined;
        }
        const all = event.target.closest('[data-utl-all]');
        if (all) {
            if (this.query.trim()) return undefined;
            const open = all.dataset.utlAll === 'open';
            document.querySelectorAll('[data-utl-group]').forEach((s) => this.openGroup(s.dataset.utlGroup, open));
            return undefined;
        }
        const mode = event.target.closest('[data-utl-mode]');
        if (mode) {
            AppState.ui.utilityDemoMode = mode.dataset.utlMode;
            const current = this.selected();
            if (current) this.select(current.name);
            return undefined;
        }
        const copy = event.target.closest('[data-utl-copy]');
        if (copy) {
            const c = this.selected();
            if (!c) return undefined;
            if (copy.dataset.utlCopy === 'name') return this.copy(c.name, `Copied ${c.name}`);
            return this.copy(c.css, `Copied the CSS of .${c.name}`);
        }
        return undefined;
    }
};

export default UtilitiesModule;
