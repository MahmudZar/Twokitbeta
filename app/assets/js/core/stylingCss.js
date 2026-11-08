/**
 * Additional styling: focus (accessibility), transition, ::selection and radius.
 *
 * Tokens go out as Bricks variables (rows); rules go into the Bricks theme
 * stylesheet, the CSS export and the example iframe. Rules only read the
 * tokens, so editing a variable in Bricks updates everything.
 *
 * @module stylingCss
 */

export const STYLING_DEFAULTS = {
    // field: 'halo' = accent border + soft ring on text fields; 'global' = same as everything else.
    focus: { style: 'outline', color: 'action', width: 2, offset: 2, field: 'halo', ringWidth: 4, ringStrength: 30 },
    transition: {
        duration: 200,
        timing: 'cubic-bezier(0.2, 0, 0, 1)',
        delay: 0,
        applyToControls: true,
        reduceMotion: true
    },
    // Radius scale: sizes are calc() of --radius and --radius-scale, so editing
    // either variable in Bricks rescales everything (ACSS bakes numbers in SCSS).
    radius: {
        base: 4,
        scale: 1.5,
        extraSizes: true,
        auto: false,
        autoSelectors: 'img:not(header img, .bricks-site-logo)\nvideo'
    },
    selection: {
        enabled: false, // opt-in: browsers' default selection until turned on
        bg: 'action',
        text: 'on-action',
        bgAlt: 'inverse-text',
        textAlt: 'inverse-surface'
    }
};

/** What --transition animates: paint-only properties, never layout (width, padding…). */
export const TRANSITION_PROPERTIES = [
    'color', 'background-color', 'background-image', 'border-color', 'outline-color',
    'text-decoration-color', 'fill', 'stroke', 'box-shadow', 'opacity', 'translate', 'scale', 'rotate'
];

export const TIMING_PRESETS = [
    { value: 'cubic-bezier(0.2, 0, 0, 1)', label: 'Smooth', points: [0.2, 0, 0, 1] },
    { value: 'ease', label: 'ease', points: [0.25, 0.1, 0.25, 1] },
    { value: 'ease-out', label: 'ease-out', points: [0, 0, 0.58, 1] },
    { value: 'ease-in-out', label: 'ease-in-out', points: [0.42, 0, 0.58, 1] },
    { value: 'linear', label: 'linear', points: [0, 0, 1, 1] },
    { value: 'cubic-bezier(0.34, 1.56, 0.64, 1)', label: 'Springy', points: [0.34, 1.56, 0.64, 1] }
];

/** Text-like fields that get the halo (checkbox, radio, range, file… keep the outline). */
const FIELDS = ':is(input:not([type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="file"], [type="submit"], [type="button"], [type="reset"], [type="image"]), textarea, select)';

/**
 * Bricks ships `body.bricks-is-frontend :focus-visible { outline: auto }` (0,2,1).
 * This prefix matches that specificity (and still works outside Bricks); the
 * theme style prints after Bricks' stylesheet, so the tie goes to us without
 * outranking users' own classes.
 */
const FOCUS_SCOPE = ':is(body.bricks-is-frontend, body)';

/** Selectors that get --transition automatically (zero specificity, so Bricks settings win). */
const CONTROLS = ':where(a, button, input, select, textarea, summary, [role="button"], .brxe-button)';
const HTML_CONTROLS = ':where(a, button, input, select, textarea, summary, [role="button"], .tk-button)';

/** Stored color → CSS value. Colors are theme tokens or palette shade names. */
export const colorVar = (name) => (name === 'currentColor' ? 'currentColor' : `var(--${name})`);

export function withDefaults(styling = {}) {
    return {
        focus: { ...STYLING_DEFAULTS.focus, ...styling.focus },
        transition: { ...STYLING_DEFAULTS.transition, ...styling.transition },
        radius: { ...STYLING_DEFAULTS.radius, ...styling.radius },
        selection: { ...STYLING_DEFAULTS.selection, ...styling.selection }
    };
}

/**
 * Token rows [category, name, value]. `colorVar(name)` turns a stored color
 * (theme token or palette shade name) into a CSS value.
 */
export function stylingRows(styling, colorVar) {
    const s = withDefaults(styling);
    const t = s.transition;
    const rows = [
        ['Accessibility', 'focus-color', colorVar(s.focus.color)],
        ['Accessibility', 'focus-width', `${s.focus.width}px`],
        ['Accessibility', 'focus-offset', `${s.focus.offset}px`],
        ['Accessibility', 'focus-ring-width', `${s.focus.ringWidth}px`],
        ['Accessibility', 'focus-ring-color', `color-mix(in oklab, var(--focus-color) ${s.focus.ringStrength}%, transparent)`],
        ['Transition', 'transition-duration', `${t.duration}ms`],
        ['Transition', 'transition-timing', t.timing],
        ['Transition', 'transition-delay', `${t.delay}ms`],
        ['Transition', 'transition', TRANSITION_PROPERTIES
            .map((p) => `${p} var(--transition-duration) var(--transition-timing) var(--transition-delay)`).join(', ')]
    ];
    rows.push(...radiusRows(s.radius));
    if (s.selection.enabled) {
        rows.push(
            ['Selection', 'selection-bg', colorVar(s.selection.bg)],
            ['Selection', 'selection-text', colorVar(s.selection.text)],
            ['Selection', 'selection-bg-alt', colorVar(s.selection.bgAlt)],
            ['Selection', 'selection-text-alt', colorVar(s.selection.textAlt)]
        );
    }
    return rows;
}

/** Scale steps: [name, power of --radius-scale]. m is --radius itself. */
export const RADIUS_STEPS = [['xs', -2], ['s', -1], ['m', 0], ['l', 1], ['xl', 2], ['xxl', 3]];

function radiusRows(radius) {
    const rows = [
        ['Radius', 'radius', `${radius.base}px`],
        ['Radius', 'radius-scale', String(radius.scale)],
        ['Radius', 'radius-none', '0']
    ];
    if (radius.extraSizes) {
        for (const [name, power] of RADIUS_STEPS) {
            const op = power < 0 ? ' / ' : ' * ';
            const value = power === 0
                ? 'var(--radius)'
                : `calc(var(--radius)${op}${Array(Math.abs(power)).fill('var(--radius-scale)').join(op)})`;
            rows.push(['Radius', `radius-${name}`, value]);
        }
    } else {
        rows.push(['Radius', 'radius-m', 'var(--radius)']);
    }
    rows.push(['Radius', 'radius-50', '50%'], ['Radius', 'radius-circle', '50vw']);
    return rows;
}

/** Resolved px of each radius token (for previews). */
export function radiusScale(radius) {
    const r = { ...STYLING_DEFAULTS.radius, ...radius };
    return RADIUS_STEPS.map(([name, power]) => ({ name: `radius-${name}`, px: r.base * r.scale ** power }));
}

/** One selector per line (commas stay inside :not()/:is()). */
export function radiusSelectors(text) {
    return String(text || '').split('\n').map((line) => line.trim().replace(/^["']|["'],?$/g, '').trim()).filter(Boolean);
}

/**
 * Rules that use the tokens. `scope` prefixes selectors (for scoped previews);
 * `root` is the selector used for token overrides (html:root outranks the
 * :root Bricks variables whatever order Bricks prints them in). `html: true`
 * drops the Bricks-only hooks for the plain HTML/CSS export.
 */
export function stylingCss(styling, { scope = '', root = 'html:root', html = false } = {}) {
    const s = withDefaults(styling);
    const at = (sel) => (scope ? sel.split(',').map((p) => `${scope} ${p.trim()}`).join(',\n') : sel);
    const blocks = [];

    // Focus: keyboard focus only. Built without at(): the selectors contain commas.
    const ring = s.focus.style === 'ring';
    const base = scope || (html ? 'body' : FOCUS_SCOPE);
    const focus = [`/* Focus: keyboard only (:focus-visible), so mouse clicks on buttons and links show nothing */
${base} :focus:not(:focus-visible) {
  outline: none;
}

${base} :focus-visible {
${ring
        ? `  /* Transparent outline keeps focus visible in forced-colors (high contrast) mode */
  outline: var(--focus-width) solid transparent;
  box-shadow: 0 0 0 var(--focus-width) var(--focus-color);`
        : `  outline: var(--focus-width) solid var(--focus-color);
  outline-offset: var(--focus-offset);`}
}`];
    if (s.focus.field === 'halo') {
        focus.push(`/* Fields: accent border + soft halo. Text fields are :focus-visible on click too,
   because they take keyboard input, so the halo shows as soon as someone clicks in. */
${base} ${FIELDS}:focus-visible {
  outline: var(--focus-width) solid transparent;
  border-color: var(--focus-color);
  box-shadow: 0 0 0 var(--focus-ring-width) var(--focus-ring-color);
}`);
    }
    if (!scope && !html) {
        focus.push(`/* Bricks checkboxes, radios and filters use this for their focus indicator */
:root {
  --brx-indicator-focus-color: var(--focus-color);
}`);
    }
    blocks.push(focus.join('\n\n'));

    // Transition.
    const t = s.transition;
    const transition = [`/* Transition: use var(--transition) or the .transition class */
${at('.transition')} {
  transition: var(--transition);
}`];
    if (t.applyToControls) {
        transition.push(`${at(html ? HTML_CONTROLS : CONTROLS)} {
  transition: var(--transition);
}`);
    }
    if (t.reduceMotion) {
        transition.push(`@media (prefers-reduced-motion: reduce) {
  ${scope || root} {
    --transition-duration: 0.01ms;
    --transition-delay: 0ms;
  }
}`);
    }
    blocks.push(transition.join('\n\n'));

    // Auto radius: zero specificity, and :where() forgives an invalid selector.
    const selectors = radiusSelectors(s.radius.autoSelectors);
    if (s.radius.auto && selectors.length) {
        blocks.push(`/* Auto radius */
${scope ? `${scope} ` : ''}:where(${selectors.join(', ')}) {
  border-radius: var(--radius);
}`);
    }

    // Selection.
    if (s.selection.enabled) {
        blocks.push(`/* Selection: alt colors inside .selection--alt and .inverse */
${at('::selection')} {
  background-color: var(--selection-bg);
  color: var(--selection-text);
}

${at(':is(.selection--alt, .inverse)::selection, :is(.selection--alt, .inverse) ::selection')} {
  background-color: var(--selection-bg-alt);
  color: var(--selection-text-alt);
}`);
    }
    return blocks.join('\n\n');
}

/** Control points for a timing value (for the easing curve). */
export function timingPoints(timing) {
    const preset = TIMING_PRESETS.find((p) => p.value === timing);
    if (preset) return preset.points;
    const match = /cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(timing);
    return match ? match.slice(1).map(Number) : [0.25, 0.1, 0.25, 1];
}
