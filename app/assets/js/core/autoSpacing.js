/**
 * Auto spacing: automatic spacing for rich text (blog posts, Bricks Rich
 * Text, WordPress post content), the ACSS Smart Spacing way.
 *
 *   Rules    margin-block-start only, on an element that has a visible
 *            sibling before it (the first child gets none). Values are em,
 *            so each gap follows the font size of the element it sits on:
 *            1em above a paragraph, 1.2em above a heading.
 *   Tokens   --auto-space-* (em values, Bricks variables). Unregistered, so
 *            the em resolves on the element that uses it.
 *   Weight   one class: beats element margins (Bricks' figure / blockquote /
 *            p:last-of-type + h2), loses to utility classes and Bricks'
 *            per-element styles. Only direct children's block margins are
 *            touched; there is no site-wide reset.
 *   Where    .auto-spacing on any element; automatically on rich text
 *            (.tk-text, .brxe-text, post content) unless autoApply is off.
 *            .auto-spacing--off on the container switches it off; on a child
 *            it leaves that child (and its contents) alone. One unclassed
 *            wrapper level (div / section / article) keeps the spacing.
 *
 * @module autoSpacing
 */

export const AUTO_SPACING_DEFAULTS = { enabled: true, autoApply: true };

/** The tokens: [name, value, what it spaces]. Same defaults as ACSS Smart Spacing. */
export const AUTO_SPACING_TOKENS = [
    ['auto-space-paragraph', '1em', 'Above paragraphs'],
    ['auto-space-heading', '1.2em', 'Above headings'],
    ['auto-space-list', 'var(--auto-space-paragraph)', 'Above lists'],
    ['auto-space-list-item', '0.5em', 'Between list items and nested lists'],
    ['auto-space-list-indent', '2em', 'List indent'],
    ['auto-space-figure', 'var(--auto-space-paragraph)', 'Above figures, images, tables and media'],
    ['auto-space-caption', '0.5em', 'Above figure captions'],
    ['auto-space-blockquote', 'var(--auto-space-paragraph)', 'Above blockquotes'],
    ['auto-space-flow', 'var(--auto-space-paragraph)', 'Above anything else']
];

/** Classes TwoKit ships for it. */
export const AUTO_SPACING_CLASSES = { on: 'auto-spacing', off: 'auto-spacing--off' };

/** Rich text it applies to without a class, per output. */
export const AUTO_SPACING_TARGETS = {
    html: ['.tk-text'],
    bricks: ['.brxe-text', '.brxe-post-content:where(:not([data-source="bricks"]))']
};

export function withAutoSpacing(settings = {}) {
    return {
        enabled: settings?.enabled !== false,
        autoApply: settings?.autoApply !== false
    };
}

/** Token rows ([category, name, value]) for Bricks variables and variables.css. */
export function autoSpacingRows(settings) {
    if (!withAutoSpacing(settings).enabled) return [];
    return AUTO_SPACING_TOKENS.map(([name, value]) => ['Auto spacing', name, value]);
}

const MEDIA = 'figure, picture, img, video, iframe, table, pre, hr, .tk-image, .tk-video, .wp-block-image, .wp-block-embed';
const SKIP = 'script, style, template, link, meta, [hidden]';
const OFF = `.${AUTO_SPACING_CLASSES.off}`;

/** A target that isn't switched off. */
const target = (sel) => (sel ? `:where(${sel}):where(:not(${OFF}))` : `:where(:not(${OFF}, ${SKIP}))`);
/** "Has a visible element before it": the first visible child gets no space. */
const after = `:where(:not(${SKIP})) ~ `;

function rulesFor(scope) {
    const r = (sel, body) => `${scope} > ${sel} {\n  ${body}\n}`;
    const top = (token) => `margin-block-start: var(--${token});`;
    return [
        r(target(), 'margin-block: 0;'),
        r(target('figure, blockquote'), 'margin-inline: 0;'),
        // Space above, by what the element is (later rules win)
        r(`${after}${target()}`, top('auto-space-flow')),
        r(`${after}${target('p')}`, top('auto-space-paragraph')),
        r(`${after}${target('ul, ol, dl')}`, top('auto-space-list')),
        r(`${after}${target(MEDIA)}`, top('auto-space-figure')),
        r(`${after}${target('blockquote')}`, top('auto-space-blockquote')),
        r(`${after}${target('h1, h2, h3, h4, h5, h6')}`, top('auto-space-heading')),
        // Inside lists, figures and quotes
        r(target('ul, ol'), 'padding-inline-start: var(--auto-space-list-indent);'),
        r(`${target('ul, ol')} :where(li)`, 'margin-block: 0;'),
        r(`${target('ul, ol')} :where(li + li)`, top('auto-space-list-item')),
        r(`${target('ul, ol')} :where(ul, ol)`, 'margin-block: var(--auto-space-list-item) 0;'),
        r(`${target('figure')} :where(figcaption)`, 'margin-block: var(--auto-space-caption) 0;'),
        r(`${target('blockquote')} > :where(*)`, 'margin-block: 0;'),
        r(`${target('blockquote')} > :where(* + *)`, top('auto-space-paragraph'))
    ].join('\n\n');
}

/**
 * The stylesheet. `targets`: rich text selectors that get it without the
 * class (AUTO_SPACING_TARGETS.html / .bricks), used when autoApply is on.
 */
export function autoSpacingCss(settings, { targets = [] } = {}) {
    const s = withAutoSpacing(settings);
    if (!s.enabled) return '';
    const list = [`.${AUTO_SPACING_CLASSES.on}`, ...(s.autoApply ? targets : [])];
    const container = `:is(${list.join(', ')}):where(:not(${OFF}))`;
    // One unclassed wrapper level (a div from an embed or a CMS) keeps the spacing.
    const wrapper = `${container} > :where(div, section, article):where(:not([class], ${OFF}))`;
    return `/* Auto spacing: margin-block-start in em on rich text children.
   On: .${AUTO_SPACING_CLASSES.on}${s.autoApply && targets.length ? ` and rich text (${targets.map((t) => t.replace(/:where\(.*\)$/, '')).join(', ')})` : ''}.
   Off: .${AUTO_SPACING_CLASSES.off} on the container, or on one child to leave it alone. */
${container} {
  /* On a flex or grid container the margins own the spacing, not the gap */
  row-gap: 0;
}

${rulesFor(container)}

${rulesFor(wrapper)}`;
}
