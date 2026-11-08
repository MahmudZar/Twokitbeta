/**
 * HTML styles: the plain HTML/CSS counterpart of what Bricks gives a page.
 *
 * Bricks ships a frontend stylesheet (a normalize, base element rules and one
 * class per element: .brxe-section, .brxe-container, …) and the TwoKit theme
 * style layers our tokens on top (section padding, container width, body and
 * heading typography). This module builds the same thing for sites without
 * Bricks, with a `tk-` class per element:
 *
 *   .brxe-section   → .tk-section      .brxe-heading    → .tk-heading
 *   .brxe-container → .tk-container    .brxe-text-basic → .tk-paragraph
 *   .brxe-block     → .tk-block        .brxe-text       → .tk-text
 *   .brxe-div       → .tk-div          .brxe-button     → .tk-button  …
 *
 * Element rules are one class each (like Bricks), so a utility class printed
 * later in the file overrides them; the reset uses tag selectors and :where().
 *
 * @module htmlStyles
 */

export const ELEMENT_PREFIX = 'tk';

/** [tk class, Bricks class, typical tag, what it is] — also printed as the stylesheet's class map. */
export const ELEMENTS = [
    ['section', 'brxe-section', 'section', 'full-width band with section padding'],
    ['container', 'brxe-container', 'div', 'centered, max --content-width'],
    ['block', 'brxe-block', 'div', 'full-width flex column'],
    ['div', 'brxe-div', 'div', 'flex column'],
    ['heading', 'brxe-heading', 'h1–h6', 'heading typography on any tag'],
    ['paragraph', 'brxe-text-basic', 'p', 'one paragraph'],
    ['text', 'brxe-text', 'div', 'rich text (several paragraphs, lists)'],
    ['text-link', 'brxe-text-link', 'a', 'inline link with icon'],
    ['button', 'brxe-button', 'a / button', 'button layout; add a .btn--* class for its look'],
    ['image', 'brxe-image', 'img / figure', 'responsive image'],
    ['icon', 'brxe-icon', 'svg / span', '1em icon'],
    ['list', 'brxe-list', 'ul / ol', 'unstyled list'],
    ['divider', 'brxe-divider', 'hr', 'horizontal rule'],
    ['video', 'brxe-video', 'div', '16:9 video / iframe wrapper'],
    ['code', 'brxe-code', 'pre', 'code block'],
    ['logo', 'brxe-logo', 'a', 'site logo'],
    ['header--fixed', '#brx-header.brx-sticky', 'header', 'fixed header; content is offset by --header-height']
];

const HEADINGS = 'h1, h2, h3, h4, h5, h6';
/** Text elements that get the body line height (ex-based, so it resolves per element). */
const TEXT = 'body, p, li, dd, dt, blockquote, figcaption, td, th, label';

/**
 * Line heights and text wrap on the text elements themselves (zero
 * specificity), so ex-based formulas resolve at each element's own font size.
 * `text` adds the builder's own text element selectors.
 */
export function textCss({ text = '', headingWrap = '', bodyWrap = '', bodySpacing = '' } = {}) {
    const textSel = text ? `${TEXT}, ${text}` : TEXT;
    const wrap = (value) => (value ? `\n  text-wrap: ${value};` : '');
    // Body letter spacing sits with the line height on each text element: an em
    // value set on body alone would be inherited as px, wrong for other sizes.
    const spacing = bodySpacing && !/^-?0+(\.0+)?(em|px|rem)?$|^normal$/.test(String(bodySpacing).trim()) ? `\n  letter-spacing: ${bodySpacing};` : '';
    const bodyTags = text ? `p, li, dd, blockquote, figcaption, ${text}` : 'p, li, dd, blockquote, figcaption';
    return `/* Line heights resolve per element (they are ex-based) */
:where(${textSel}) {
  line-height: var(--text-line-height);${spacing}
}

:where(${HEADINGS}) {
  line-height: var(--heading-line-height);${wrap(headingWrap)}
}${bodyWrap ? `

:where(${bodyTags}) {${wrap(bodyWrap)}
}` : ''}`;
}

/** Bricks' normalize + base rules, pointed at TwoKit tokens. */
function resetCss() {
    return `/* Reset: Bricks' normalize and base rules, pointed at TwoKit tokens */
*,
*::before,
*::after {
  box-sizing: border-box;
}

* {
  border-color: var(--border);
}

html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  font-size: 100%;
}

body {
  margin: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

article, aside, figcaption, figure, footer, header, main, nav, section {
  display: block;
}

[hidden] {
  display: none !important;
}

${HEADINGS} {
  margin: 0;
  text-rendering: optimizeLegibility;
}

:where(${HEADINGS}) a {
  color: currentColor;
}

:where(p) {
  margin-block: 0 1.2em;
}

:where(p:last-of-type) {
  margin-block-end: 0;
}

:where(a) {
  color: currentColor;
  text-decoration: none;
  cursor: pointer;
}

abbr[title] {
  text-decoration: underline dotted;
}

b, strong {
  font-weight: bolder;
}

code, kbd, samp, pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 1em;
}

small {
  font-size: 80%;
}

sub, sup {
  font-size: 75%;
  line-height: 0;
  position: relative;
  vertical-align: baseline;
}

sub { bottom: -0.25em; }
sup { top: -0.5em; }

img {
  height: auto;
  max-width: 100%;
  vertical-align: middle;
  border-style: none;
}

video, audio, iframe {
  max-width: 100%;
}

svg:not([width]) { min-width: 1em; }
svg:not([height]) { min-height: 1em; }

button, input, optgroup, select, textarea {
  margin: 0;
  font-family: inherit;
  font-size: 100%;
  line-height: 1.15;
  color: inherit;
  text-align: inherit;
}

button {
  padding: 0;
  border: none;
  cursor: pointer;
}

button, select {
  text-transform: none;
}

input[type="checkbox"], input[type="radio"], input[type="submit"], select {
  cursor: pointer;
}

textarea {
  overflow: auto;
  resize: vertical;
}

hr {
  box-sizing: content-box;
  height: 0;
  overflow: visible;
  margin: 1em 0;
  border: none;
  border-top: 1px solid var(--border);
}

table {
  width: 100%;
  border-collapse: collapse;
}

fieldset {
  padding: 0.35em 0.75em 0.625em;
}

legend {
  display: table;
  max-width: 100%;
  padding: 0;
  color: inherit;
  white-space: normal;
}

pre {
  margin: 0;
  white-space: pre-wrap;
}`;
}

/**
 * Body, headings and links: the TwoKit theme style (Theme style → Typography
 * and Links in Bricks), as plain CSS.
 */
function typographyCss(ctx) {
    const t = ctx.typography;
    const decl = (props) => Object.entries(props)
        .filter(([, value]) => value != null && String(value).trim() !== '')
        .map(([prop, value]) => `  ${prop}: ${value};`)
        .join('\n');
    const sizes = ctx.headings.map(({ tag, size }) => `${tag} {\n  font-size: ${size};\n}`).join('\n\n');
    return `/* Typography: the TwoKit theme style (body, headings, links) */
html {
  background-color: var(--site-bg, var(--surface-0));
}

body {
${decl({
        'font-family': ctx.bodyFont,
        'font-size': ctx.bodySize,
        'font-weight': t.bodyWeight,
        'line-height': 'var(--text-line-height)',
        color: t.bodyColor || 'var(--text-secondary)'
    })}
}

${HEADINGS}, .${ELEMENT_PREFIX}-heading {
${decl({
        'font-family': ctx.headingFont,
        'font-weight': t.headingWeight,
        'line-height': 'var(--heading-line-height)',
        'letter-spacing': t.headingLetterSpacing,
        color: t.headingColor || 'var(--text-primary)'
    })}
}${sizes ? `\n\n${sizes}` : ''}

/* Links inside text; nav and button links keep their own color */
:where(p, li, dd, blockquote, figcaption, td, .${ELEMENT_PREFIX}-text, .${ELEMENT_PREFIX}-paragraph) a {
  color: var(--action);
}`;
}

/** One class per element, mirroring Bricks' element CSS and the theme style layout settings. */
function elementCss() {
    const p = ELEMENT_PREFIX;
    return `/* Elements: .${p}-* mirrors Bricks' .brxe-* element classes */
:where([class^="${p}-"], [class*=" ${p}-"]) {
  max-width: 100%;
}

.${p}-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-inline: auto;
  padding-block: var(--sctn-block-padding);
  padding-inline: var(--sctn-inline-padding);
  gap: var(--container-gap);
}

.${p}-container {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  max-width: var(--content-width);
  margin-inline: auto;
  gap: var(--grid-gap);
}

.${p}-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
}

.${p}-div {
  display: flex;
  flex-direction: column;
}

.${p}-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5em;
  width: auto;
  padding: 0.5em 1em;
  border-width: 0;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
}

.${p}-text-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
}

.${p}-text-link svg {
  flex-shrink: 0;
}

a.${p}-image {
  display: inline-block;
}

figure.${p}-image {
  margin: 0;
}

:where(.${p}-image) img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
}

.${p}-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
}

svg.${p}-icon,
.${p}-icon svg {
  width: 1em;
  height: 1em;
}

:where(.${p}-list) {
  width: 100%;
  margin: 0;
  padding: 0;
  list-style-type: none;
}

:where(.${p}-list) li {
  position: relative;
}

:where(.${p}-divider) {
  width: 100%;
  height: 0;
  margin: 0;
  border: none;
  border-top: 1px solid var(--border);
}

:where(.${p}-video) {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

:where(.${p}-video) :is(iframe, video) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
}

.${p}-code {
  width: 100%;
}

.${p}-logo {
  color: currentColor;
  font-weight: 600;
  line-height: 1;
}

.${p}-logo img {
  display: block;
  width: auto;
  height: auto;
}

.${p}-header--fixed {
  position: fixed;
  inset-block-start: 0;
  inset-inline: 0;
  z-index: 100;
}`;
}

/**
 * Everything for styles.css before the header, styling and utility blocks.
 *
 * @param {object} ctx
 *   typography   AppState.typography
 *   bodyFont     CSS font-family value (var(--font-body))
 *   headingFont  CSS font-family value (var(--font-heading))
 *   bodySize     CSS font-size value for body
 *   headings     [{ tag: 'h1', size: 'var(--h1)' }]
 */
export function htmlBaseCss(ctx) {
    const t = ctx.typography;
    return [
        resetCss(),
        typographyCss(ctx),
        textCss({ text: `.${ELEMENT_PREFIX}-text, .${ELEMENT_PREFIX}-paragraph`, headingWrap: t.textWrap, bodyWrap: t.bodyTextWrap, bodySpacing: t.bodyLetterSpacing }),
        elementCss()
    ].join('\n\n');
}

/** The class map as a CSS comment, for the top of styles.css. */
export function classMapComment() {
    const rows = ELEMENTS.map(([name, bricks, tag, what]) =>
        `   .${`${ELEMENT_PREFIX}-${name}`.padEnd(18)} ${tag.padEnd(13)} ${what}  (${bricks})`);
    return `/* Element classes (Bricks equivalent in brackets):\n${rows.join('\n')}\n*/`;
}
