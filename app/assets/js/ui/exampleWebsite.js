/**
 * Example website: Wayward, a one-page travel site (Wayward twokit/website),
 * ported onto the user's own TwoKit output.
 *
 *   Type      real h1 / h2 for page and section titles (styles.css sizes them
 *             from --h1 / --h2). Smaller titles keep their tag and borrow a
 *             heading style with .text-style-h3 / -h4; other text uses the
 *             .text-{step} classes. No font sizes, line heights, weights or
 *             letter spacing are set here.
 *   Buttons   every button is .tk-button + a .btn--* class.
 *   Color     theme tokens (surfaces, text, borders, action, states) and the
 *             first brand palette's shades. Accent fills (active nav link,
 *             accent tiles, featured plan, call cards) are --action with
 *             --on-action text.
 *   Space     --space-* / --container-gap / --sctn-* tokens and gap-* classes.
 *
 * The markup and CSS are written with TwoKit's default step names (text-s,
 * gap-m, --space-xl, radius-xxl). resolveClasses() / resolveCss() map each
 * one to the user's step at the same distance from the base of the scale, so
 * renamed, added or removed steps, token prefixes and switched-off radius
 * sizes all still land on a real token.
 *
 * The page script (websiteScript) runs inside the preview iframe. It binds
 * to the page's elements in init(), and init() runs again on 'ex:render',
 * which ExampleSite.refresh() fires after it rebuilds the markup.
 *
 * @module exampleWebsite
 */

import AppState from '../state/appState.js';
import { ensureShades } from '../state/themeModel.js';
import { withDefaults } from '../core/stylingCss.js';
import { parseSteps, DEFAULT_TYPE_STEPS, DEFAULT_TYPE_BASE, DEFAULT_SPACING_STEPS, DEFAULT_SPACING_BASE } from '../core/fluidScale.js';
import { typeStep, spaceStep, THEME_ATTR } from './previewCss.js';

const TYPE_NAMES = parseSteps(DEFAULT_TYPE_STEPS);
const SPACE_NAMES = parseSteps(DEFAULT_SPACING_STEPS);
const EXTRA_RADII = ['xs', 's', 'l', 'xl', 'xxl'];

/* ------------------------------------------------------------------ */
/* Resolving default step names to the user's scales                   */
/* ------------------------------------------------------------------ */

/** The user's type step at the position `name` has on the default scale. */
function typeAt(name) {
    const i = TYPE_NAMES.indexOf(name);
    return i < 0 ? null : typeStep(i - DEFAULT_TYPE_BASE);
}

/** The user's fluid spacing step at the position `name` has on the default scale. */
function spaceAt(name) {
    const i = SPACE_NAMES.indexOf(name);
    return i < 0 ? null : spaceStep(i - DEFAULT_SPACING_BASE);
}

const extraRadii = () => withDefaults(AppState.styling).radius.extraSizes;
const widthKeys = () => (AppState.layout.generated?.contentWidths || []).map((w) => w.key || '');

/** A shade of the first brand palette: { token, hex }. */
function shade(step) {
    const palette = AppState.colors[0];
    if (!palette) return null;
    ensureShades(palette);
    const s = palette.shades.find((x) => x.shade === String(step));
    return s ? { token: AppState.tokenName('color', s.name), hex: s.hex } : null;
}

const shadeVar = (step) => {
    const s = shade(step);
    return s ? `var(--${s.token}, var(--action))` : 'var(--action)';
};

/** Class names in the markup → the user's real utility classes. */
export function resolveClasses(html) {
    const radii = extraRadii();
    const widths = widthKeys();
    const map = (cls) => {
        let m = cls.match(/^text-(xs|s|m|l|xl|2xl|3xl|4xl)$/);
        if (m) { const s = typeAt(m[1]); return s ? `text-${s.step}` : cls; }
        m = cls.match(/^gap-(4xs|3xs|2xs|xs|s|m|l|xl|2xl|3xl|4xl)$/);
        if (m) { const s = spaceAt(m[1]); return s ? `gap-${s.step}` : 'content-gap'; }
        m = cls.match(/^radius-(xs|s|l|xl|xxl)$/);
        if (m) return radii ? cls : 'radius-m';
        m = cls.match(/^content-width-(xs|sm|md|lg|xl)$/);
        if (m) return widths.includes(m[1]) ? cls : 'content-width';
        return cls;
    };
    return html.replace(/class="([^"]*)"/g, (_, list) => `class="${list.split(/\s+/).filter(Boolean).map(map).join(' ')}"`);
}

/** Token names in the CSS → the user's real variables (prefixes, steps, sizes that exist). */
export function resolveCss(css) {
    const type = (n) => AppState.tokenName('type', n);
    const radii = extraRadii();
    const widths = widthKeys();
    return css
        .replace(/var\(--text-(xs|s|m|l|xl|2xl|3xl|4xl)\)/g, (all, n) => { const s = typeAt(n); return s ? `var(--${s.token})` : all; })
        .replace(/var\(--space-(4xs|3xs|2xs|xs|s|m|l|xl|2xl|3xl|4xl)\)/g, (all, n) => { const s = spaceAt(n); return s ? `var(--${s.token})` : all; })
        .replace(/var\(--radius-(xs|s|l|xl|xxl)\)/g, (all) => (radii ? all : 'var(--radius-m)'))
        .replace(/var\(--(h[1-6]|font-heading|font-body)\)/g, (_, n) => `var(--${type(n)})`)
        .replace(/var\(--p-(\d+)\)/g, (_, step) => shadeVar(step))
        .replace(/var\(--content-width-(xs|sm|md|lg|xl)\)/g, (all, k) => (widths.includes(k) ? all : 'var(--content-width)'))
        // --grid-N exist up to the user's max columns.
        .replace(/var\(--grid-(\d+)\)/g, (_, n) => `var(--grid-${n}, repeat(${n}, minmax(0, 1fr)))`)
        .replace(/var\(--grid-(\d)-(\d)\)/g, (_, a, b) => `var(--grid-${a}-${b}, minmax(0, ${a}fr) minmax(0, ${b}fr))`);
}

/* ------------------------------------------------------------------ */
/* Markup                                                              */
/* ------------------------------------------------------------------ */

const img = (id, w, q = 75) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=${q}`;
const icon = (name) => `<svg class="tk-icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

const SPRITE = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-chev" viewBox="0 0 24 24"><path d="m6 7 5 5-5 5M13 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-left" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-right" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="9.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></symbol>
  <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
  <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
  <symbol id="i-rail" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 10h14M8 21l2-4M16 21l-2-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="9" cy="13.5" r="1" fill="currentColor"/><circle cx="15" cy="13.5" r="1" fill="currentColor"/></symbol>
  <symbol id="i-road" viewBox="0 0 24 24"><path d="M5 21 9 3M19 21 15 3M12 4v3M12 11v3M12 18v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
  <symbol id="i-trek" viewBox="0 0 24 24"><path d="m3 20 6-10 4 6 3-4 5 8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="17" cy="5" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/></symbol>
  <symbol id="i-boat" viewBox="0 0 24 24"><path d="M3 17c2 2 4 2 6 0 2 2 4 2 6 0 2 2 4 2 6 0M5 14l-1-4h16l-1 4M12 10V3l5 4h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-compass" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m15.5 8.5-2 5-5 2 2-5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
  <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
  <symbol id="i-star" viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" fill="currentColor"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12 5 5 9-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-flip" viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-up" viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
</svg>`;

const NAV = [['journeys', 'Journeys'], ['routes', 'Routes'], ['postcards', 'Postcards'], ['pricing', 'Pricing'], ['journal', 'Journal'], ['faq', 'FAQ']];

const SLIDES = [
    ['1474487548417-781cb71495f3', 'Yellow and red locomotive running along the tracks under a stormy sky', 'Rail · 12 days', 'The Bernina &amp; beyond', 'Zürich → Tirano → Lake Como'],
    ['1469854523086-cc02fe5d8800', 'Camper van on an empty desert highway', 'Road · 16 days', 'High desert loop', 'Salt Lake → Moab → Monument Valley'],
    ['1476514525535-07fb3b4ae5f1', 'Small boat on a turquoise alpine lake with mountains', 'Trek · 9 days', 'Lakes of the Dolomites', 'Bolzano → Braies → Cortina']
];

const SELECTS = [
    ['when', 'Leaving', ['Next spring', 'This summer', 'Autumn 2027', "I'm flexible"]],
    ['pace', 'Pace', ['Unhurried', 'Balanced', 'Full days']]
];

const MONTHS = [
    ['Jan', 'Northern Lights Line', 'Norway', '1531366936337-7c912a4589a7', 'Green aurora over a snowy landscape'],
    ['Feb', 'Atlas Kasbah Road', 'Morocco', '1489749798305-4fea3ae63d43', 'Desert dunes in Morocco'],
    ['Mar', 'Glacier Express', 'Switzerland', '1464822759023-fed622ff2c3b', 'Snowy alpine peak above a valley'],
    ['Apr', 'Nakasendō Trail', 'Japan', '1493976040374-85c8e12f0c0e', 'Japanese temple among trees'],
    ['May', 'Ligurian Coast Walk', 'Italy', '1516483638261-f4dbaf036963', 'Colourful houses on cliffs above the sea in Cinque Terre'],
    ['Jun', 'Cycladic Ferries', 'Greece', '1533105079780-92b9be482077', 'White-washed houses and blue sea on a Greek island'],
    ['Jul', 'Isle of Skye Loop', 'Scotland', '1506377585622-bedcbb027afc', 'Green rugged hills of the Isle of Skye'],
    ['Aug', 'Lofoten by Sea', 'Norway', '1513519245088-0e12902e5a38', 'Red fishing cabins on the water beneath steep mountains'],
    ['Sep', 'Dolomites Hut Trek', 'Italy', '1519681393784-d120267933ba', 'Snowy mountains under a starry night sky'],
    ['Oct', 'Vermont Back Roads', 'USA', '1470071459604-3b5ec3a7fe05', 'Misty hills with autumn trees'],
    ['Nov', 'Mekong Slow Boat', 'Vietnam', '1528127269322-539801943592', 'Boats among limestone karsts in Vietnam'],
    ['Dec', 'Patagonia Ruta 40', 'Argentina', '1500530855697-b586d89ba3ee', 'Long empty road towards mountains']
];

const POSTCARDS = [
    ['-7deg', '16px', '1483728642387-6c3bdd6c93e5', 'Iceland landscape with river and mountains', 'IS', '“We were told the Westfjords road would add a day. It added the best day of the whole trip.”', '— Amara &amp; Theo, Iceland Ring'],
    ['3deg', '36px', '1441974231531-c6227db76b6e', 'Sunlight streaming through a green forest', 'JP', '“Eight days on the Nakasendō and I didn\'t check my phone once. Our inn hosts sent us off with rice balls every morning.”', '— Priya, Kiso Valley'],
    ['-2deg', '0px', '1507525428034-b723cf961d3e', 'Turquoise sea meeting a white sand beach', 'GR', '“Nine islands, zero flights. The little ferry to Schinoussa is now our favourite place on earth.”', '— The Okafor family'],
    ['9deg', '22px', '1504280390367-361c6d9f38f4', 'Glowing tent under a starry sky', 'AR', '“Ruta 40 for two weeks. Wayward knew which gas stations had the good empanadas. That\'s service.”', '— Jules, Patagonia']
];

const POSTS = [
    ['rail', '1515165562839-978bbcf18277', 'Red and white train waiting at a covered station platform', 'Rail · 6 min read', 'The window seat guide: which side to sit on for 14 classic train rides'],
    ['trek', '1551632811-561732d1e306', 'Hikers walking a mountain trail', 'Trek · 8 min read', 'Inn to inn: how luggage transfer quietly changes everything'],
    ['road', '1500534314209-a25ddb2bd429', 'Layered misty mountain ridges fading into a peach sky', 'Road · 5 min read', 'The two-hour rule: why we never schedule more than one drive a day'],
    ['sea', '1523906834658-6e24ef2386f9', 'Gondolas on a Venetian canal', 'Sea · 7 min read', 'Slow boats of the Adriatic, ranked by sunsets per crossing']
];

const FAQS = [
    ['Do I have to fly anywhere?', 'Not unless you want to. Most European routes start from a train station, and we\'ll happily connect you overland from home. For long-haul trips we keep it to one flight each way and make the rest of the journey slow.'],
    ['How far ahead should I book?', 'Three to six months is the sweet spot. Some sleeper trains and mountain huts open bookings exactly 90 or 180 days out — we track those windows for you.'],
    ['What if a train is cancelled mid-trip?', 'Message your fixer. They\'ll rebook, reroute or find you a lovely place to stay put — and every Pathfinder route comes with a pre-planned backup line.'],
    ['Can I change the route after it\'s planned?', 'Yes. Two rounds of revisions are included, and small tweaks on the road are always free.'],
    ['Is Wayward good for families or solo travellers?', 'Both. About a third of our travellers go solo; families get kid-friendly pacing, shorter legs and accommodation with space to spread out.']
];

const logo = (extra = '') => `
      <a class="tk-logo ww-logo text-l text-primary" href="#top"${extra}>
        <span class="ww-logo__mark" aria-hidden="true">${icon('compass')}</span>
        <span>Wayward</span>
      </a>`;

const callCard = (extra, attrs = '') => `
            <a class="ww-call-card radius-xl text-s ${extra}" ${attrs}>
              <span class="ww-call-card__badges" aria-hidden="true"><span class="text-xs">Zoom</span><span class="text-xs">Meet</span><span class="text-xs">Call</span></span>
              <span>Book a free 20-min<br>route call</span>
              <span class="ww-call-card__arrow">${icon('arrow')}</span>
            </a>`;

const eyebrow = (text, deco = true) => `<p class="ww-eyebrow ${deco ? 'ww-eyebrow--deco text-s' : 'text-xs'}">${text}</p>`;

function header() {
    return `
  <a class="skip-link tk-button btn--primary-s" href="#main">Skip to content</a>
  <header class="ww-header tk-header--fixed" data-header>
    <div class="ww-header__inner content-width-lg">
      ${logo(' aria-label="Wayward home"')}
      <nav class="ww-nav" aria-label="Primary">
        <ul class="tk-list ww-nav__list">
          ${NAV.map(([id, label]) => `<li><a class="ww-nav__link text-s" href="#${id}">${label}</a></li>`).join('')}
        </ul>
      </nav>
      <div class="ww-header__actions">
        <button type="button" class="tk-button btn--ghost btn--icon ww-theme-toggle" data-theme-toggle aria-label="Switch to dark theme">
          <svg class="tk-icon ww-icon-sun" aria-hidden="true"><use href="#i-sun"/></svg>
          <svg class="tk-icon ww-icon-moon" aria-hidden="true"><use href="#i-moon"/></svg>
        </button>
        <a class="tk-button btn--primary-s ww-header__cta" href="#contact">Plan my route ${icon('chev')}</a>
        <button type="button" class="tk-button btn--secondary btn--icon ww-burger" data-menu-toggle aria-expanded="false" aria-controls="ww-menu" aria-label="Open menu">
          <span class="ww-burger__lines" aria-hidden="true"><span></span><span></span><span></span></span>
        </button>
      </div>
    </div>
  </header>

  <div class="ww-drawer surface-1" id="ww-menu" data-menu hidden>
    <nav aria-label="Mobile">
      <ul class="tk-list ww-drawer__list">
        ${NAV.map(([id, label], i) => `<li><a class="text-style-h3 text-primary" href="#${id}"><span class="text-xs">0${i + 1}</span>${label}</a></li>`).join('')}
      </ul>
    </nav>
    <div class="ww-drawer__foot">
      <a class="tk-button btn--primary-l" href="#contact">Plan my route</a>
      <p class="text-s text-muted">hello@wayward.travel · +351 21 000 4242</p>
    </div>
  </div>`;
}

function hero() {
    const slides = SLIDES.map(([id, alt, chip, title, route], i) => `
            <figure class="ww-slide${i === 0 ? ' is-active' : ''}" aria-roledescription="slide" aria-label="${i + 1} of ${SLIDES.length}">
              <img class="img-cover" src="${img(id, 1400, 80)}" alt="${alt}">
              <figcaption>
                <span class="ww-chip ww-chip--glass text-xs">${chip}</span>
                <span class="text-style-h3">${title}</span>
                <span class="text-s">${route}</span>
              </figcaption>
            </figure>`).join('');
    const dots = SLIDES.map((_, i) => `<button type="button" role="tab" aria-selected="${i === 0}" aria-label="Slide ${i + 1}"></button>`).join('');
    const seg = [['Rail', 'rail'], ['Road', 'road'], ['Trek', 'trek'], ['Island', 'boat']]
        .map(([label, ic], i) => `<label><input type="radio" name="style" value="${label}"${i === 0 ? ' checked' : ''}><span class="text-s">${icon(ic)}${label}</span></label>`).join('');
    const selects = SELECTS.map(([key, label, options]) => `
            <div class="ww-field ww-select" data-select>
              <span class="ww-field__label text-xs text-muted" id="${key}-label">${label}</span>
              <button type="button" class="ww-select__btn" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="${key}-label ${key}-value">
                <span id="${key}-value" data-select-value>${options[0]}</span>
                <svg class="tk-icon ww-select__chev" aria-hidden="true"><use href="#i-down"/></svg>
              </button>
              <ul class="ww-select__list surface-4 shadow-4 radius-xl" role="listbox" tabindex="-1" aria-labelledby="${key}-label" hidden>
                ${options.map((o, i) => `<li class="text-s" role="option" id="${key}-opt-${i}" data-value="${o}" aria-selected="${i === 0}">${o}${icon('check')}</li>`).join('')}
              </ul>
              <input type="hidden" name="${key}" value="${options[0]}">
            </div>`).join('');

    return `
    <section class="tk-section ww-hero" id="top">
      <div class="tk-container ww-hero__grid">
        <div class="ww-hero__left">
          <div class="ww-hero__mini">
            <a class="ww-loc-card radius-xxl" href="#routes">
              <img class="img-cover" src="${img('1555881400-74d7acaacd8b', 600, 80)}" alt="Yellow tram climbing a street in Lisbon">
              <span class="ww-chip ww-chip--glass text-xs">${icon('pin')}Based in Lisbon</span>
            </a>
            <div class="ww-trust surface-2 radius-xxl shadow-2">
              <div class="ww-avatars" aria-hidden="true">
                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80" alt="">
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80" alt="">
                <img src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&h=120&q=80" alt="">
              </div>
              <p class="text-s text-secondary">Trusted by <strong class="text-primary">12,000+</strong> travellers<br>
                <span class="ww-stars text-muted" aria-label="Rated 4.9 out of 5">${icon('star')} 4.9 / 5 on 2,140 reviews</span></p>
            </div>
          </div>

          <div class="ww-hero__main surface-2 radius-xxl shadow-2">
            ${eyebrow('Slow travel studio · Est. 2011', false)}
            <h1>Find the long <br>way home</h1>
            <p class="text-l text-secondary ww-hero__sub">Routes worth the detour. Hand-built rail, road, trail and island journeys for people who'd rather arrive changed than arrive early.</p>
            <div class="cluster ww-hero__ctas">
              <a class="tk-button btn--primary" href="#routes">Explore routes ${icon('arrow')}</a>
              <a class="tk-button btn--ghost" href="#journeys">How we travel</a>
            </div>
            ${callCard('', `href="#contact" ${THEME_ATTR}="dark"`)}
          </div>
        </div>

        <div class="ww-slider radius-xxl" data-slider aria-roledescription="carousel" aria-label="Featured routes">
          <div class="ww-slider__track">${slides}
          </div>
          <div class="ww-slider__controls">
            <button type="button" class="tk-button btn--secondary btn--icon" data-slide-prev aria-label="Previous slide">${icon('left')}</button>
            <div class="ww-slider__dots" role="tablist" aria-label="Choose slide">${dots}</div>
            <button type="button" class="tk-button btn--secondary btn--icon" data-slide-next aria-label="Next slide">${icon('right')}</button>
          </div>
        </div>

        <form class="ww-finder surface-2 radius-xxl shadow-3" data-finder novalidate>
          <div class="ww-seg radius-xl" role="radiogroup" aria-label="Travel style">${seg}</div>
          <div class="ww-finder__fields">
            <label class="ww-field">
              <span class="ww-field__label text-xs text-muted">Heading to</span>
              <input type="text" name="where" list="ww-dest-list" placeholder="Anywhere scenic" autocomplete="off">
              <datalist id="ww-dest-list">
                <option value="Swiss Alps"><option value="Scottish Highlands"><option value="Japanese Alps"><option value="Norwegian Fjords"><option value="Amalfi Coast"><option value="Patagonia"><option value="Greek Islands">
              </datalist>
            </label>${selects}
            <button class="tk-button btn--primary ww-finder__go" type="submit">Find my detour ${icon('arrow')}</button>
          </div>
        </form>
      </div>
    </section>`;
}

function journeys() {
    const tile = (cls, ic, title, body, link) => `
          <article class="ww-tile clickable-card radius-xxl shadow-2 ${cls}">
            <span class="ww-tile__icon radius-l">${icon(ic)}</span>
            <div class="ww-tile__body">
              <h3 class="text-style-h4 ww-tile__title">${title}</h3>
              <p class="text-s${cls.includes('surface') ? ' text-secondary' : ''}">${body}</p>
            </div>
            <a href="#routes" class="clickable-card__link" aria-label="${link}"></a>
          </article>`;
    return `
    <section class="tk-section ww-band" id="journeys">
      <div class="tk-container container-gap">
        <div class="ww-sec-head ww-sec-head--split">
          <div class="stack gap-s">
            ${eyebrow('Journeys &amp; styles')}
            <h2>Four ways to take the scenic route, all shaped around your pace</h2>
          </div>
          <a class="tk-button btn--primary" href="#pricing">See trip pricing ${icon('chev')}</a>
        </div>

        <div class="ww-bento">
          ${tile('surface-2', 'rail', 'Rail journeys', 'Panorama cars, sleeper cabins and the slowest trains with the best windows.', 'Explore rail journeys')}
          <article class="ww-tile ww-tile--photo radius-xxl shadow-2">
            <img class="img-cover" src="${img('1506905925346-21bda4d32df4', 900)}" alt="Sea of clouds below jagged mountain peaks at sunrise">
            <div class="ww-tile__body">
              <p class="text-xs ww-tile__meta">${icon('pin')} 46.5° N, 8.0° E · Bernese Oberland</p>
              <h3 class="text-style-h4 ww-tile__title">Handpicked, not mass-produced</h3>
              <p class="text-s">Every route is walked, ridden or driven by our team before it reaches you.</p>
            </div>
          </article>
          ${tile('ww-tile--accent', 'boat', 'Island hopping', 'Ferries, fishing boats and the long way between harbours.', 'Explore island hopping')}
          ${tile('ww-tile--accent', 'road', 'Road trips', 'Backroad itineraries, characterful stays and a car that suits the road.', 'Explore road trips')}
          ${tile('surface-2', 'trek', 'Slow treks', 'Inn-to-inn walking with luggage sent ahead and lunch in your pack.', 'Explore slow treks')}
        </div>
      </div>
    </section>`;
}

function about() {
    const stat = (label, count, unit) => `<div><dt class="text-s text-muted">${label}</dt><dd class="text-style-h2 text-primary"><span data-count="${count}">0</span>${unit}</dd></div>`;
    return `
    <section class="tk-section ww-about" id="about">
      <div class="tk-container ww-about__grid">
        <figure class="ww-about__media full-bleed-left radius-xxl">
          <img class="img-cover" src="${img('1501785888041-af3ef285b470', 1000, 80)}" alt="Calm mountain lake reflecting a forested ridge at dusk">
          <figcaption class="ww-about__badge surface-2 radius-xl shadow-4">
            <span class="text-style-h3 text-primary">4,800 km</span>
            <span class="text-xs text-muted">average distance of a Wayward trip — usually without a single flight</span>
          </figcaption>
        </figure>
        <div class="ww-about__copy stack container-gap">
          <dl class="ww-stats">
            ${stat('Years on the road', 14, '+')}
            ${stat('Routes designed', 3200, '+')}
            ${stat('Travellers who return', 96, '%')}
          </dl>
          <p class="text-style-h4 text-primary">We plan the parts other agencies skip — the village between stations, the ferry nobody mentions, the pass that adds two hours and the view you'll talk about for ten years.</p>
          <div class="cluster">
            <a class="tk-button btn--secondary" href="#postcards">Read traveller postcards ${icon('chev')}</a>
          </div>
        </div>
      </div>
    </section>`;
}

function routes() {
    const items = MONTHS.map(([m, name, country, id, alt]) => `
          <button type="button" class="ww-strip__item${m === 'Mar' ? ' is-active' : ''}" data-name="${name}" aria-pressed="${m === 'Mar'}">
            <span class="ww-strip__label text-m">${m}</span>
            <span class="ww-strip__img radius-l"><img src="${img(id, 600)}" alt="${alt}"></span>
            <span class="ww-strip__name text-xs text-muted">${name} · ${country}</span>
          </button>`).join('');
    return `
    <section class="tk-section ww-routes" id="routes">
      <div class="ww-routes__card surface-0 radius-xxl shadow-2 content-width-lg">
        <div class="ww-sec-head ww-sec-head--split ww-routes__head">
          <div class="stack gap-s">
            ${eyebrow('Routes by season', false)}
            <h2>Twelve months, twelve <br>roads less taken</h2>
          </div>
          <div class="stack gap-m ww-routes__aside">
            <p class="text-s text-secondary">Each month has a route at its best. Drag, scroll or use the arrows — tap a card to bring it into colour.</p>
            <div class="cluster gap-xs">
              <button type="button" class="tk-button btn--secondary btn--icon" data-routes-prev aria-label="Previous routes">${icon('left')}</button>
              <button type="button" class="tk-button btn--secondary btn--icon" data-routes-next aria-label="Next routes">${icon('right')}</button>
              <span class="text-xs text-muted ww-routes__count" data-routes-count>Mar · Glacier Express</span>
            </div>
          </div>
        </div>
        <div class="ww-strip" data-routes tabindex="0" aria-label="Routes by month, scrollable">${items}
        </div>
      </div>
    </section>`;
}

function postcards() {
    const cards = POSTCARDS.map(([r, y, id, alt, stamp, quote, by]) => `
          <button type="button" class="ww-pc" style="--r:${r};--y:${y}" aria-pressed="false">
            <span class="ww-pc__inner">
              <span class="ww-pc__face ww-pc__front radius-xxl"><img class="radius-xl" src="${img(id, 700)}" alt="${alt}"><span class="ww-pc__hint text-xs">${icon('flip')} Turn over</span></span>
              <span class="ww-pc__face ww-pc__back radius-xxl">
                <span class="ww-pc__stamp radius-s text-m">${stamp}</span>
                <span class="ww-pc__quote text-m">${quote}</span>
                <span class="ww-pc__by text-xs">${by}</span>
              </span>
            </span>
          </button>`).join('');
    return `
    <section class="tk-section ww-postcards" id="postcards" ${THEME_ATTR}="dark">
      <div class="tk-container container-gap">
        <div class="ww-sec-head ww-sec-head--split">
          <div class="stack gap-s">
            ${eyebrow('Postcards', false)}
            <h2>Where a detour becomes <br>the whole story</h2>
          </div>
          <p class="ww-postcards__lede text-m">Every trip ends with a postcard from the people who took it. Turn one over and read what they wrote home.</p>
        </div>
        <div class="ww-cards" data-postcards>${cards}
        </div>
      </div>
    </section>`;
}

function pricing() {
    const tabs = [['rail', 'Rail journeys'], ['road', 'Road trips'], ['trek', 'Slow treks'], ['island', 'Island hopping']]
        .map(([id, label], i) => `<button type="button" class="tk-button radius-circle ${i === 0 ? 'btn--primary-s' : 'btn--ghost-s'}" role="tab" aria-selected="${i === 0}" data-plan="${id}">${label}</button>`).join('');
    const steps = [
        ['01', 'Tell us the dream', 'A 20-minute call about pace, places and the trips you loved.'],
        ['02', 'Get your route', 'A day-by-day plan with stays, tickets and the detours in between.'],
        ['03', 'Travel, supported', 'A local fixer on WhatsApp the whole way, from first train to last.']
    ].map(([n, title, body]) => `<li class="radius-xl"><span class="ww-steps__n text-xs">${n}</span><h3 class="text-style-h4">${title}</h3><p class="text-s text-secondary">${body}</p></li>`).join('');
    const price = (key, amount, muted) => `
            <div class="ww-price${muted ? ' ww-price--muted' : ''}">
              <span class="ww-price__amt text-style-h3" data-price="${key}">${amount}</span>
              <span class="ww-price__unit text-xs" data-unit>/ person</span>
              <label class="ww-switch" title="Private group pricing">
                <input type="checkbox" data-group-toggle aria-label="Show private group pricing">
                <span class="ww-switch__track"><span class="ww-switch__thumb"></span></span>
              </label>
            </div>`;
    return `
    <section class="tk-section ww-band" id="pricing">
      <div class="tk-container container-gap ww-pricing">
        <div class="ww-sec-head ww-sec-head--center">
          ${eyebrow('How it works &amp; pricing')}
          <h2>Planning fees that pay for themselves in better days</h2>
        </div>
        <div class="ww-tabs" role="tablist" aria-label="Journey style">${tabs}</div>
        <div class="ww-plans">
          <ol class="tk-list ww-steps surface-2 radius-xxl">${steps}</ol>
          <article class="ww-plan ww-plan--feature radius-xxl shadow-3">
            <header class="stack gap-2xs">
              <h3 class="text-style-h4">Pathfinder</h3>
              <p class="text-s">Fully guided planning with every booking handled.</p>
            </header>${price('pathfinder', '€390', false)}
            <ul class="tk-list ww-plan__list text-s" data-features="pathfinder"></ul>
            <a class="tk-button btn--secondary ww-plan__cta" href="#contact">Start planning ${icon('chev')}</a>
          </article>
          <article class="ww-plan surface-2 radius-xxl shadow-3">
            <header class="stack gap-2xs">
              <h3 class="text-style-h4">Wayfarer</h3>
              <p class="text-s text-secondary">A ready-to-ride route you book at your own pace.</p>
            </header>${price('wayfarer', '€140', true)}
            <ul class="tk-list ww-plan__list text-s" data-features="wayfarer"></ul>
            <a class="tk-button btn--primary ww-plan__cta" href="#contact">Get the route ${icon('chev')}</a>
          </article>
        </div>
        <p class="text-xs text-muted ww-pricing__note">Planning fee only — travel costs are quoted at cost with no markup. Toggle a switch for private groups of up to 6.</p>
      </div>
    </section>`;
}

function journal() {
    const filters = [['all', 'All'], ['rail', 'Rail'], ['road', 'Road'], ['trek', 'Trek'], ['sea', 'Sea']]
        .map(([id, label], i) => `<button type="button" class="tk-button ${i === 0 ? 'btn--primary-s' : 'btn--outline-s'}" data-filter="${id}" aria-pressed="${i === 0}">${label}</button>`).join('');
    const posts = POSTS.map(([cat, id, alt, tag, title], i) => `
          <article class="ww-post clickable-card surface-2 radius-xxl shadow-2" data-cat="${cat}"${i > 2 ? ' hidden' : ''}>
            <div class="ww-post__img radius-xl"><img class="img-cover" src="${img(id, 800)}" alt="${alt}"></div>
            <div class="ww-post__body">
              <p class="ww-post__tag text-xs text-primary">${tag}</p>
              <h3 class="text-style-h4">${title}</h3>
              <div class="ww-post__foot"><a class="text-s text-action clickable-card__link" href="#journal">Read more</a><span class="ww-dot-icon">${icon('chev')}</span></div>
            </div>
          </article>`).join('');
    return `
    <section class="tk-section ww-journal" id="journal">
      <div class="tk-container container-gap">
        <div class="ww-sec-head ww-sec-head--center">
          ${eyebrow('Journal &amp; field notes')}
          <h2>Stories, tips and timetables for taking your time</h2>
        </div>
        <div class="ww-filters cluster gap-xs" role="group" aria-label="Filter articles">${filters}</div>
        <div class="ww-posts">${posts}
        </div>
        <p class="text-s text-muted ww-posts__empty" data-posts-empty hidden>No stories in this category yet — check back soon.</p>
      </div>
    </section>`;
}

function faq() {
    const items = FAQS.map(([q, a], i) => `
          <details class="ww-acc__item surface-2 radius-xl shadow-2" name="ww-faq"${i === 0 ? ' open' : ''}>
            <summary><span class="ww-acc__q text-m">${q}</span><span class="ww-acc__icon">${icon('plus')}</span></summary>
            <div class="ww-acc__body"><p class="text-m text-secondary">${a}</p></div>
          </details>`).join('');
    return `
    <section class="tk-section ww-faq" id="faq">
      <div class="tk-container ww-faq__grid">
        <div class="ww-faq__side stack container-gap">
          <div class="stack gap-s">
            ${eyebrow('FAQ')}
            <h2>Questions travellers ask before the long way</h2>
          </div>
          <div class="ww-ask radius-xxl" ${THEME_ATTR}="dark">
            <h3 class="text-style-h4">Still wondering?</h3>
            <p class="text-s text-secondary">Send us anything — a half-formed idea is plenty. A real planner replies within a day.</p>
            <a class="tk-button btn--primary" href="#contact">Ask a planner ${icon('chev')}</a>
          </div>
        </div>
        <div class="ww-acc stack gap-xs" data-accordion>${items}
        </div>
      </div>
    </section>`;
}

function contact() {
    const col = (title, label, links) => `
          <nav class="ww-footer__col"${label ? ` aria-label="${label}"` : ''}>
            <h3 class="text-s">${title}</h3>
            <ul class="tk-list text-s">${links.map(([href, text]) => (href ? `<li><a href="${href}">${text}</a></li>` : `<li><span>${text}</span></li>`)).join('')}</ul>
          </nav>`;
    return `
    <section class="tk-section ww-band ww-cta-band" id="contact" ${THEME_ATTR}="dark">
      <div class="tk-container container-gap">
        <div class="ww-cta">
          <div class="stack gap-m">
            ${eyebrow('Ready when you are')}
            <h2 class="text-style-h1">Find the long way home</h2>
            <p class="text-l text-secondary">Routes worth the detour — planned by people who've taken them.</p>
          </div>
          <form class="ww-news stack gap-s" data-newsletter novalidate>
            <label class="text-s text-primary" for="ww-news-email">Get one hand-drawn route in your inbox each month</label>
            <div class="ww-news__row radius-xl">
              <input id="ww-news-email" type="email" name="email" placeholder="you@example.com" autocomplete="email" required>
              <button class="tk-button btn--primary" type="submit">Subscribe</button>
            </div>
            <p class="ww-news__msg text-s" data-news-msg role="status" aria-live="polite"></p>
            ${callCard('ww-call-card--accent', 'href="mailto:hello@wayward.travel"')}
          </form>
        </div>

        <footer class="ww-footer surface-1 radius-xxl shadow-4" ${THEME_ATTR}="light">
          <div class="ww-footer__top">
            <div class="stack gap-s ww-footer__brand">
              ${logo()}
              <p class="text-s text-secondary">Wayward is a slow-travel studio in Lisbon designing rail, road, trail and island journeys for people who'd rather take the scenic route.</p>
            </div>
            ${col('Explore', 'Explore', [['#journeys', 'Journeys'], ['#routes', 'Routes'], ['#postcards', 'Postcards'], ['#journal', 'Journal']])}
            ${col('Company', 'Company', [['#about', 'About'], ['#pricing', 'Pricing'], ['#faq', 'FAQ'], ['#contact', 'Contact']])}
            ${col('Say hello', '', [['mailto:hello@wayward.travel', 'hello@wayward.travel'], ['', 'Rua das Flores 28, Lisboa'], ['', 'Mon–Fri · 9–18 WET']])}
          </div>
          <hr class="tk-divider">
          <div class="ww-footer__bottom text-xs text-muted">
            <span>© <span data-year>2026</span> Wayward Travel. All routes reserved.</span>
            <span>Photography via <a href="https://unsplash.com">Unsplash</a></span>
            <span class="cluster gap-s"><a href="#top">Privacy</a><a href="#top">Terms</a></span>
          </div>
        </footer>
      </div>
    </section>`;
}

/** The page body (inside #ex-root). */
export function websiteBody() {
    return resolveClasses(`${SPRITE}
${header()}
  <main id="main">${hero()}${journeys()}${about()}${routes()}${postcards()}${pricing()}${journal()}${faq()}${contact()}
  </main>

  <button type="button" class="ww-totop tk-button btn--primary btn--icon" data-totop aria-label="Back to top">${icon('up')}</button>
  <div class="ww-toast surface-4 shadow-6 radius-xl text-s" data-toast role="status" aria-live="polite"></div>`);
}

/* ------------------------------------------------------------------ */
/* Layout CSS                                                          */
/* ------------------------------------------------------------------ */

/**
 * Layout only. Written with TwoKit's default token names; resolveCss() maps
 * them onto the user's. Sizes of text come from the classes in the markup.
 */
export function websiteCss() {
    const A = THEME_ATTR;
    const bodyColor = AppState.typography.bodyColor || 'var(--text-secondary)';
    return resolveCss(`
/* Example website: Wayward. Layout only; everything else is TwoKit output. */
body { overflow-x: clip; }

/* A nested theme section re-reads the body color, so its text flips too */
[${A}] { color: ${bodyColor}; }

.skip-link {
  position: fixed;
  inset-block-start: var(--space-s);
  inset-inline-start: var(--space-s);
  z-index: 300;
  translate: 0 -200%;
}
.skip-link:focus-visible { translate: 0 0; }

/* ---------- Shared ---------- */
.ww-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  margin: 0;
  text-transform: uppercase;
  color: var(--action);
}
.ww-eyebrow--deco {
  inline-size: fit-content;
  gap: 0.75em;
  padding: 0.6em 1em;
  border: 1px solid var(--border);
  border-radius: var(--radius-l);
  background-color: var(--surface-1);
  color: var(--text-primary);
  box-shadow: var(--shadow-1);
}
.ww-eyebrow--deco::before {
  content: "";
  flex-shrink: 0;
  inline-size: 0.8em;
  block-size: 0.8em;
  border-radius: var(--radius-xs);
  background-color: var(--action);
  box-shadow: 0 0 0.6em color-mix(in oklab, var(--action) 70%, transparent);
}

.ww-sec-head { inline-size: 100%; }
.ww-sec-head--split {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-l);
}
.ww-sec-head--split > :first-child { max-inline-size: var(--content-width-sm); }
.ww-sec-head--center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-s);
  max-inline-size: var(--content-width-sm);
  margin-inline: auto;
  text-align: center;
}

.ww-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.35em 0.75em;
  border-radius: var(--radius-circle);
}
.ww-chip--glass {
  border: 1px solid color-mix(in oklab, var(--white) 18%, transparent);
  background-color: color-mix(in oklab, var(--black) 35%, transparent);
  color: var(--white);
  backdrop-filter: blur(10px);
}

.ww-dot-icon {
  display: inline-grid;
  place-items: center;
  inline-size: 1.75em;
  block-size: 1.75em;
  border-radius: var(--radius-circle);
  background-color: var(--action);
  color: var(--on-action);
  transition: var(--transition);
}
.ww-post:hover .ww-dot-icon { rotate: -45deg; }

/* ---------- Header ---------- */
.ww-header {
  background-color: color-mix(in oklab, var(--surface-1) 78%, transparent);
  backdrop-filter: saturate(1.4) blur(14px);
  border-block-end: 1px solid transparent;
  transition: var(--transition);
}
.ww-header.is-scrolled { border-block-end-color: var(--border-subtle); box-shadow: var(--shadow-2); }
.ww-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-m);
  min-block-size: var(--header-height);
  padding-inline: var(--sctn-inline-padding);
}

.ww-logo { display: inline-flex; align-items: center; gap: 0.55em; font-family: var(--font-heading); text-decoration: none; }
.ww-logo__mark {
  display: inline-grid;
  place-items: center;
  inline-size: 1.6em;
  block-size: 1.6em;
  border-radius: var(--radius-l);
  background-color: var(--action);
  color: var(--on-action);
  transition: rotate 600ms var(--transition-timing);
}
.ww-logo:hover .ww-logo__mark { rotate: 135deg; }

.ww-nav__list {
  display: flex;
  align-items: center;
  gap: var(--space-4xs);
  padding: var(--space-4xs);
  border-radius: var(--radius-circle);
  background-color: var(--surface-3);
  box-shadow: var(--shadow-1);
}
.ww-nav__link {
  display: block;
  padding: 0.45em 0.95em;
  border-radius: var(--radius-circle);
  color: var(--text-secondary);
  text-decoration: none;
  transition: var(--transition);
}
.ww-nav__link:hover { background-color: var(--hover); color: var(--text-primary); }
.ww-nav__link.is-current { background-color: var(--action); color: var(--on-action); }

.ww-header__actions { display: flex; align-items: center; gap: var(--space-2xs); }
.ww-icon-moon { display: none; }
:root[${A}="dark"] .ww-theme-toggle .ww-icon-sun { display: none; }
:root[${A}="dark"] .ww-theme-toggle .ww-icon-moon { display: block; }
.ww-theme-toggle svg { transition: rotate 500ms var(--transition-timing); }
.ww-theme-toggle:hover svg { rotate: 40deg; }

.ww-header .ww-burger { display: none; }
.ww-burger__lines { display: grid; gap: 4px; inline-size: 18px; }
.ww-burger__lines span {
  display: block;
  block-size: 1.5px;
  border-radius: 2px;
  background-color: currentColor;
  transition: var(--transition);
}
.ww-burger[aria-expanded="true"] .ww-burger__lines span:nth-child(1) { translate: 0 5.5px; rotate: 45deg; }
.ww-burger[aria-expanded="true"] .ww-burger__lines span:nth-child(2) { opacity: 0; }
.ww-burger[aria-expanded="true"] .ww-burger__lines span:nth-child(3) { translate: 0 -5.5px; rotate: -45deg; }

.ww-drawer {
  position: fixed;
  inset: var(--header-height) 0 0;
  z-index: 99;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-xl);
  padding: var(--space-l) var(--sctn-inline-padding) var(--space-xl);
  border-block-start: 1px solid var(--border-subtle);
  overflow-y: auto;
  opacity: 0;
  translate: 0 -12px;
  transition: opacity 260ms var(--transition-timing), translate 260ms var(--transition-timing);
}
.ww-drawer.is-open { opacity: 1; translate: 0 0; }
.ww-drawer__list a {
  display: flex;
  align-items: baseline;
  gap: var(--space-s);
  padding-block: var(--space-xs);
  border-block-end: 1px solid var(--border-subtle);
  text-decoration: none;
}
.ww-drawer__list a span { color: var(--action); font-family: var(--font-body); }
.ww-drawer__list a:hover { color: var(--action); }
.ww-drawer__foot { display: grid; gap: var(--space-s); }
.ww-drawer__foot p { margin: 0; }

@media (max-width: 1080px) {
  .ww-nav { display: none; }
  .ww-header .ww-burger { display: inline-flex; }
}
@media (max-width: 560px) {
  .ww-header__cta { display: none; }
}
@media (min-width: 1081px) {
  .ww-drawer { display: none !important; }
}

/* ---------- Hero ---------- */
.ww-hero { --section-padding-top: var(--space-l); padding-block-end: var(--space-2xl); }
.ww-hero__grid { display: grid; grid-template-columns: var(--grid-2); gap: var(--space-s); }
.ww-hero__left { display: grid; grid-template-rows: auto 1fr; gap: var(--space-s); min-inline-size: 0; }
.ww-hero__mini { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr); gap: var(--space-s); }

.ww-loc-card { position: relative; display: block; min-block-size: 9rem; overflow: hidden; isolation: isolate; }
.ww-loc-card img { transition: scale 700ms var(--transition-timing); }
.ww-loc-card:hover img { scale: 1.08; }
.ww-loc-card .ww-chip { position: absolute; inset: var(--space-xs) auto auto var(--space-xs); }

.ww-trust { display: flex; align-items: center; gap: var(--space-s); padding: var(--space-m); }
.ww-trust p { margin: 0; }
.ww-avatars { display: flex; flex-shrink: 0; }
.ww-avatars img {
  inline-size: 2.5rem;
  block-size: 2.5rem;
  border: 2px solid var(--surface-2);
  border-radius: var(--radius-circle);
  object-fit: cover;
  transition: translate 300ms var(--transition-timing);
}
.ww-avatars img + img { margin-inline-start: -0.75rem; }
.ww-trust:hover .ww-avatars img:nth-child(2) { translate: 4px 0; }
.ww-trust:hover .ww-avatars img:nth-child(3) { translate: 8px 0; }
.ww-stars { display: inline-flex; align-items: center; gap: 0.3em; }
.ww-stars svg { color: var(--warning-solid, var(--action)); }

.ww-hero__main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-m);
  padding: var(--space-xl);
}
.ww-hero__sub { margin: 0; max-inline-size: 32rem; }
.ww-hero__ctas { margin-block-end: var(--space-xs); }

.ww-call-card {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: end;
  gap: var(--space-s) var(--space-l);
  margin-block-start: auto;
  padding: var(--space-m);
  background-color: var(--surface-0);
  color: var(--action);
  font-family: var(--font-heading);
  text-transform: uppercase;
  text-decoration: none;
  transition: var(--transition);
}
.ww-call-card:hover { translate: 0 -3px; box-shadow: var(--shadow-5); }
.ww-call-card__badges { grid-column: 1 / -1; display: flex; gap: var(--space-4xs); }
.ww-call-card__badges span {
  padding: 0.2em 0.55em;
  border-radius: var(--radius-s);
  background-color: var(--white);
  color: var(--light-text-primary);
  font-family: var(--font-body);
  text-transform: none;
}
.ww-call-card__arrow {
  display: grid;
  place-items: center;
  inline-size: 2.25rem;
  block-size: 2.25rem;
  border-radius: var(--radius-l);
  background-color: var(--action);
  color: var(--on-action);
  transition: var(--transition);
}
.ww-call-card:hover .ww-call-card__arrow { rotate: 45deg; background-color: var(--action-hover); }
.ww-call-card--accent { margin-block-start: var(--space-s); background-color: var(--action); color: var(--on-action); }
.ww-call-card--accent .ww-call-card__arrow { background-color: var(--on-action); color: var(--action); }

/* Slider */
.ww-slider { position: relative; block-size: 100%; min-block-size: 34rem; overflow: hidden; isolation: isolate; background-color: var(--surface-4); }
.ww-slider__track, .ww-slide { position: absolute; inset: 0; margin: 0; }
.ww-slide { opacity: 0; transition: opacity 900ms var(--transition-timing); }
.ww-slide img { scale: 1.08; transition: scale 6s linear; }
.ww-slide.is-active { z-index: 1; opacity: 1; }
.ww-slide.is-active img { scale: 1; }
.ww-slide::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, color-mix(in oklab, var(--black) 75%, transparent), transparent 55%);
}
.ww-slide figcaption {
  position: absolute;
  inset: auto var(--space-l) calc(var(--space-l) + 3.5rem) var(--space-l);
  z-index: 2;
  display: grid;
  justify-items: start;
  gap: var(--space-3xs);
  color: var(--white);
}
.ww-slide figcaption .text-style-h3 { margin-block-start: var(--space-2xs); }
.ww-slider__controls {
  position: absolute;
  inset: auto var(--space-l) var(--space-l);
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-s);
}
.ww-slider__dots { display: flex; gap: var(--space-4xs); }
.ww-slider__dots button {
  inline-size: 1.75rem;
  block-size: 5px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-circle);
  background-color: color-mix(in oklab, var(--white) 55%, transparent);
  cursor: pointer;
  transition: var(--transition), inline-size 300ms var(--transition-timing);
}
.ww-slider__dots button[aria-selected="true"] { inline-size: 3rem; background-color: var(--action); }

/* Route finder */
.ww-finder {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-m);
  padding: var(--space-s);
}
.ww-seg {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4xs);
  block-size: 100%;
  padding: var(--space-4xs);
  background-color: var(--surface-4);
}
.ww-seg label { display: flex; }
.ww-seg input { position: absolute; opacity: 0; pointer-events: none; }
.ww-seg span {
  display: inline-flex;
  flex: 1;
  align-items: center;
  gap: 0.45em;
  padding: 0.65em 0.95em;
  border-radius: var(--radius-l);
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition);
}
.ww-seg label:hover span { background-color: var(--hover); color: var(--text-primary); }
.ww-seg input:checked + span { background-color: var(--surface-1); color: var(--text-primary); box-shadow: var(--shadow-3); }
.ww-seg input:checked + span svg { color: var(--action); }
.ww-seg input:focus-visible + span { outline: var(--focus-width) solid var(--focus-color); outline-offset: 1px; }

.ww-finder__fields { display: grid; grid-template-columns: 1.4fr 1fr 1fr auto; align-items: stretch; gap: var(--space-2xs); }
.ww-field {
  display: grid;
  gap: 2px;
  padding: 0.5em 0.9em;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-l);
  background-color: var(--surface-1);
  transition: var(--transition);
}
.ww-field:hover { border-color: var(--border-strong); }
.ww-field:focus-within { border-color: var(--focus-color); box-shadow: 0 0 0 var(--focus-ring-width) var(--focus-ring-color); }
.ww-field input, .ww-select__btn {
  inline-size: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--text-m);
  line-height: var(--text-line-height);
}
.ww-field input::placeholder { color: var(--text-disabled); }
/* The field wrapper shows focus (:focus-within), so the input itself doesn't */
body .ww-field input:focus-visible { outline: none; border-color: transparent; box-shadow: none; }

.ww-select { position: relative; cursor: pointer; }
.ww-select__btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2xs);
  text-align: start;
  cursor: pointer;
}
body .ww-select__btn:focus-visible { outline: none; }
.ww-select__btn::after { content: ""; position: absolute; inset: 0; }
.ww-select__chev { color: var(--text-muted); transition: rotate 250ms var(--transition-timing); }
.ww-select__btn[aria-expanded="true"] .ww-select__chev { rotate: 180deg; color: var(--action); }
.ww-select__list {
  position: absolute;
  inset: calc(100% + 6px) 0 auto;
  z-index: 20;
  min-inline-size: 12rem;
  margin: 0;
  padding: var(--space-4xs);
  list-style: none;
  outline: none;
  animation: ww-pop 180ms var(--transition-timing);
}
.ww-select__list [role="option"] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-s);
  padding: 0.6em 0.75em;
  border-radius: var(--radius-l);
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition);
}
.ww-select__list [role="option"] svg { opacity: 0; color: var(--action); }
.ww-select__list [role="option"]:hover,
.ww-select__list [role="option"].is-focused { background-color: var(--hover); color: var(--text-primary); }
.ww-select__list [role="option"][aria-selected="true"] { background-color: var(--selected); color: var(--text-primary); }
.ww-select__list [role="option"][aria-selected="true"] svg { opacity: 1; }
@keyframes ww-pop { from { opacity: 0; translate: 0 -4px; } }
.ww-finder__go { white-space: nowrap; }

@media (max-width: 1180px) {
  .ww-finder { grid-template-columns: var(--grid-1); }
}
@media (max-width: 960px) {
  .ww-hero__grid { grid-template-columns: var(--grid-1); }
  .ww-slider { min-block-size: 26rem; }
  .ww-finder__fields { grid-template-columns: var(--grid-2); }
  .ww-finder__go { grid-column: 1 / -1; }
}
@media (max-width: 560px) {
  .ww-hero__mini { grid-template-columns: var(--grid-1); }
  .ww-hero__main { padding: var(--space-l); }
  .ww-finder__fields { grid-template-columns: var(--grid-1); }
  .ww-seg { inline-size: 100%; }
  .ww-seg label { flex: 1 1 40%; }
  .ww-seg span { inline-size: 100%; justify-content: center; }
}

/* ---------- Bands ---------- */
.ww-band {
  position: relative;
  border-block: 1px solid var(--border-subtle);
  background-color: var(--surface-0);
  background-image:
    radial-gradient(60rem 30rem at 85% 0%, color-mix(in oklab, var(--action) 14%, transparent), transparent 70%),
    radial-gradient(40rem 24rem at 0% 100%, color-mix(in oklab, var(--action) 8%, transparent), transparent 70%);
}

/* ---------- Journeys bento ---------- */
.ww-bento {
  display: grid;
  inline-size: 100%;
  grid-template-columns: var(--grid-3);
  grid-template-rows: repeat(2, minmax(15rem, auto));
  gap: var(--space-s);
}
.ww-bento > :nth-child(2) { grid-column: 2; grid-row: 1 / span 2; }
.ww-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-xl);
  padding: var(--space-l);
  overflow: hidden;
  isolation: isolate;
  transition: var(--transition);
}
.ww-tile:hover { translate: 0 -4px; box-shadow: var(--shadow-5); }
.ww-tile__icon {
  display: grid;
  place-items: center;
  inline-size: 2.75rem;
  block-size: 2.75rem;
  background-color: var(--surface-4);
  color: var(--action);
  transition: var(--transition);
}
.ww-tile:hover .ww-tile__icon { rotate: -8deg; background-color: var(--action); color: var(--on-action); }
.ww-tile__body { display: grid; gap: var(--space-2xs); }
.ww-tile__body p { margin: 0; }
.ww-tile__title { color: var(--action); }
.ww-tile--accent { background-color: var(--action); color: var(--on-action); }
.ww-tile--accent .ww-tile__title { color: var(--on-action); }
.ww-tile--accent .ww-tile__icon,
.ww-tile--accent:hover .ww-tile__icon { background-color: var(--on-action); color: var(--action); }
.ww-tile--photo { justify-content: flex-end; min-block-size: 24rem; color: var(--white); }
.ww-tile--photo img { z-index: -2; transition: scale 900ms var(--transition-timing); }
.ww-tile--photo:hover img { scale: 1.06; }
.ww-tile--photo::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(to top, color-mix(in oklab, var(--black) 85%, transparent), transparent 60%);
}
.ww-tile--photo .ww-tile__title { color: var(--dark-action); }
.ww-tile__meta { display: inline-flex; align-items: center; gap: 0.35em; opacity: 0.85; }

@media (max-width: 960px) {
  .ww-bento { grid-template-columns: var(--grid-2); grid-template-rows: none; }
  .ww-bento > :nth-child(2) { grid-column: 1 / -1; grid-row: auto; order: -1; }
}
@media (max-width: 560px) {
  .ww-bento { grid-template-columns: var(--grid-1); }
}

/* ---------- About + stats ---------- */
.ww-about__grid { display: grid; grid-template-columns: var(--grid-2-3); align-items: center; gap: var(--space-2xl); }
.ww-about__media { position: relative; margin: 0; aspect-ratio: 4 / 5; }
.ww-about__media img { border-radius: inherit; }
/* full-bleed-left: square on the side that meets the window edge */
.ww-about__media.full-bleed-left { border-start-start-radius: 0; border-end-start-radius: 0; }
.ww-about__badge {
  position: absolute;
  inset: auto calc(var(--space-l) * -1) var(--space-xl) auto;
  display: grid;
  gap: var(--space-4xs);
  max-inline-size: 14rem;
  padding: var(--space-s) var(--space-m);
  animation: ww-float 6s ease-in-out infinite;
}
@keyframes ww-float { 50% { translate: 0 -10px; } }
.ww-about__copy > p { margin: 0; }
.ww-stats {
  display: grid;
  grid-template-columns: var(--grid-3);
  gap: var(--space-m);
  margin: 0;
  padding-block-end: var(--space-l);
  border-block-end: 1px solid var(--border);
}
.ww-stats div { display: flex; flex-direction: column-reverse; gap: var(--space-4xs); }
.ww-stats dd { margin: 0; font-variant-numeric: tabular-nums; }

@media (max-width: 860px) {
  .ww-about__grid { grid-template-columns: var(--grid-1); }
  .ww-about__media { aspect-ratio: 4 / 3; }
  .ww-about__badge { inset-inline-end: var(--space-s); }
}
@media (max-width: 480px) {
  .ww-stats { grid-template-columns: var(--grid-1); }
}

/* ---------- Routes ---------- */
.ww-routes { padding-block-start: 0; }
.ww-routes__card {
  --strip-max: 24rem;
  min-block-size: calc(var(--strip-max) + 18rem);
  padding-block: var(--space-2xl);
  overflow: hidden;
}
.ww-routes__head { padding-inline: var(--space-2xl); margin-block-end: var(--space-2xl); }
.ww-routes__aside { max-inline-size: 22rem; }
.ww-routes__aside p { margin: 0; }
.ww-routes__count { margin-inline-start: var(--space-2xs); white-space: nowrap; }
.ww-strip {
  display: flex;
  align-items: flex-end;
  gap: var(--space-s);
  padding: var(--space-m) var(--space-2xl) var(--space-s);
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  cursor: grab;
  outline-offset: -4px;
}
.ww-strip::-webkit-scrollbar { display: none; }
.ww-strip.is-dragging { cursor: grabbing; scroll-snap-type: none; }
.ww-strip.is-dragging * { pointer-events: none; }
.ww-strip__item {
  --h: 16rem;
  flex: 0 0 clamp(11rem, 18vw, 15rem);
  display: grid;
  align-content: end;
  gap: var(--space-2xs);
  block-size: calc(var(--strip-max) + 4rem);
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-primary);
  text-align: start;
  scroll-snap-align: center;
  cursor: pointer;
}
.ww-strip__item:nth-child(4n + 1) { --h: 15rem; }
.ww-strip__item:nth-child(4n + 2) { --h: 18rem; }
.ww-strip__item:nth-child(4n + 3) { --h: 21rem; }
.ww-strip__item:nth-child(4n) { --h: 18rem; }
.ww-strip__img {
  display: block;
  block-size: var(--h);
  overflow: hidden;
  background-color: var(--surface-4);
  transition: block-size 500ms var(--transition-timing);
}
.ww-strip__img img {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  filter: grayscale(1) contrast(1.05);
  transition: filter 500ms var(--transition-timing), scale 700ms var(--transition-timing);
}
.ww-strip__name { opacity: 0; translate: 0 -4px; transition: var(--transition); }
.ww-strip__item:hover .ww-strip__img img { filter: grayscale(0.4); scale: 1.04; }
.ww-strip__item.is-active { --h: var(--strip-max); }
.ww-strip__item.is-active .ww-strip__img img { filter: none; }
.ww-strip__item.is-active .ww-strip__label { color: var(--action); }
.ww-strip__item.is-active .ww-strip__name,
.ww-strip__item:hover .ww-strip__name { opacity: 1; translate: 0 0; }

@media (max-width: 640px) {
  .ww-routes__head { padding-inline: var(--space-l); }
  .ww-strip { padding-inline: var(--space-l); }
  .ww-routes__card { --strip-max: 20rem; }
}

/* ---------- Postcards ---------- */
.ww-postcards { position: relative; padding-block-end: 0; overflow: hidden; background-color: var(--p-900); }
.ww-postcards .ww-eyebrow { color: var(--p-200); }
.ww-postcards__lede { max-inline-size: 24rem; margin: 0; color: var(--p-100); }
.ww-cards {
  display: flex;
  justify-content: center;
  inline-size: 100%;
  margin-block-end: -1.5rem;
  padding-inline: var(--space-l);
}
.ww-pc {
  --r: 0deg;
  --y: 0px;
  position: relative;
  z-index: 1;
  flex: 0 1 19rem;
  aspect-ratio: 4 / 4.6;
  margin-inline: -0.9rem;
  padding: 0;
  border: 0;
  background: none;
  perspective: 1200px;
  rotate: var(--r);
  translate: 0 var(--y);
  cursor: pointer;
  transition: rotate 500ms var(--transition-timing), translate 500ms var(--transition-timing);
}
.ww-pc:hover, .ww-pc:focus-visible, .ww-pc[aria-pressed="true"] { z-index: 5; rotate: 0deg; translate: 0 calc(var(--y) - 2.5rem); }
.ww-pc__inner { position: absolute; inset: 0; display: block; transform-style: preserve-3d; transition: transform 700ms var(--transition-timing); }
.ww-pc[aria-pressed="true"] .ww-pc__inner { transform: rotateY(180deg); }
.ww-pc__face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: var(--space-4xs);
  overflow: hidden;
  background-color: var(--white);
  box-shadow: var(--shadow-6);
  backface-visibility: hidden;
}
.ww-pc__front img { inline-size: 100%; block-size: 100%; object-fit: cover; }
.ww-pc__hint {
  position: absolute;
  inset: auto auto 1rem 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.35em 0.7em;
  border-radius: var(--radius-circle);
  background-color: var(--action);
  color: var(--on-action);
  opacity: 0;
  translate: 0 6px;
  transition: var(--transition);
}
.ww-pc:hover .ww-pc__hint, .ww-pc:focus-visible .ww-pc__hint { opacity: 1; translate: 0 0; }
.ww-pc__back {
  transform: rotateY(180deg);
  justify-content: space-between;
  gap: var(--space-s);
  padding: var(--space-l);
  background:
    repeating-linear-gradient(to bottom, transparent 0 1.9rem, var(--light-border-subtle) 1.9rem calc(1.9rem + 1px)),
    var(--light-surface-1);
  color: var(--light-text-primary);
  text-align: start;
}
.ww-pc__stamp {
  align-self: flex-end;
  display: grid;
  place-items: center;
  inline-size: 3rem;
  block-size: 3.5rem;
  border: 2px dashed var(--p-800);
  color: var(--p-800);
  font-family: var(--font-heading);
  rotate: 6deg;
}
.ww-pc__quote { font-family: var(--font-heading); }
.ww-pc__by { color: var(--light-text-muted); }

@media (max-width: 860px) {
  .ww-cards {
    justify-content: flex-start;
    inline-size: calc(100% + var(--sctn-inline-padding) * 2);
    max-inline-size: none;
    margin-inline: calc(var(--sctn-inline-padding) * -1);
    padding: 3rem var(--space-l) 0;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
  }
  .ww-pc { flex: 0 0 15rem; margin-inline: 0.25rem; scroll-snap-align: center; }
}

/* ---------- Pricing ---------- */
.ww-pricing { align-items: center; }
.ww-tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-4xs);
  padding: var(--space-4xs);
  border: 1px solid var(--border);
  border-radius: var(--radius-circle);
  background-color: var(--surface-2);
}
.ww-plans { display: grid; grid-template-columns: var(--grid-3); align-items: stretch; gap: var(--space-s); inline-size: 100%; }
.ww-steps { display: grid; gap: var(--space-4xs); padding: var(--space-4xs); }
.ww-steps li {
  display: grid;
  gap: var(--space-3xs);
  padding: var(--space-m) var(--space-l);
  background-color: var(--surface-3);
  transition: var(--transition);
}
.ww-steps li:hover { background-color: var(--surface-4); }
.ww-steps p { margin: 0; }
.ww-steps__n { color: var(--action); }
.ww-plan { display: flex; flex-direction: column; gap: var(--space-l); padding: var(--space-l); transition: var(--transition); }
.ww-plan:hover { translate: 0 -4px; box-shadow: var(--shadow-6); }
.ww-plan header p { margin: 0; }
.ww-plan--feature { background-color: var(--action); color: var(--on-action); }
.ww-plan--feature h3 { color: var(--on-action); }

.ww-price {
  display: flex;
  align-items: baseline;
  gap: 0.35em;
  padding: 0.55em 0.6em 0.55em 1em;
  border-radius: var(--radius-circle);
  background-color: var(--white);
  color: var(--light-text-primary);
}
.ww-price--muted { background-color: var(--surface-4); color: var(--text-primary); }
.ww-price__amt { transition: opacity 200ms; }
.ww-price__amt.is-swapping { opacity: 0; }
.ww-price__unit { opacity: 0.7; }
.ww-switch { align-self: center; margin-inline-start: auto; cursor: pointer; }
.ww-switch input { position: absolute; opacity: 0; }
.ww-switch__track {
  display: block;
  inline-size: 2.6rem;
  block-size: 1.5rem;
  padding: 3px;
  border-radius: var(--radius-circle);
  background-color: var(--light-surface-6);
  transition: var(--transition);
}
.ww-switch__thumb {
  display: block;
  inline-size: calc(1.5rem - 6px);
  block-size: calc(1.5rem - 6px);
  border-radius: var(--radius-circle);
  background-color: var(--white);
  box-shadow: var(--shadow-3);
  transition: translate 300ms var(--transition-timing);
}
.ww-switch input:checked + .ww-switch__track { background-color: var(--p-900); }
.ww-switch input:checked + .ww-switch__track .ww-switch__thumb { translate: 1.1rem 0; background-color: var(--action); }
.ww-switch input:focus-visible + .ww-switch__track { outline: var(--focus-width) solid var(--focus-color); outline-offset: 2px; }

.ww-plan__list { display: grid; gap: var(--space-2xs); }
.ww-plan__list li { display: flex; align-items: flex-start; gap: 0.6em; animation: ww-fade-in 400ms var(--transition-timing) both; }
.ww-plan__list svg { flex-shrink: 0; margin-block-start: 0.2em; color: var(--action); }
.ww-plan--feature .ww-plan__list svg { color: var(--on-action); }
@keyframes ww-fade-in { from { opacity: 0; translate: -6px 0; } }
.ww-plan__cta { inline-size: 100%; margin-block-start: auto; }
.ww-pricing__note { margin: 0; text-align: center; }

@media (max-width: 960px) {
  .ww-plans { grid-template-columns: var(--grid-2); }
  .ww-steps { grid-column: 1 / -1; grid-template-columns: var(--grid-3); }
}
@media (max-width: 640px) {
  .ww-plans, .ww-steps { grid-template-columns: var(--grid-1); }
  .ww-tabs { border-radius: var(--radius-xxl); }
}

/* ---------- Journal ---------- */
.ww-filters { justify-content: center; inline-size: 100%; }
.ww-posts { display: grid; grid-template-columns: var(--grid-3); gap: var(--grid-gap); inline-size: 100%; }
.ww-post { position: relative; display: flex; flex-direction: column; padding: var(--space-4xs); animation: ww-fade-in 400ms var(--transition-timing) both; }
.ww-post__img { position: relative; aspect-ratio: 4 / 3; overflow: hidden; }
.ww-post__img img { transition: scale 700ms var(--transition-timing); }
.ww-post:hover .ww-post__img img { scale: 1.05; }
.ww-post__body { display: flex; flex: 1; flex-direction: column; gap: var(--space-2xs); padding: var(--space-m); }
.ww-post__tag { margin: 0; text-transform: uppercase; }
.ww-post__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-block-start: auto;
  padding-block-start: var(--space-s);
  border-block-start: 1px solid var(--border-subtle);
}
.ww-posts__empty { inline-size: 100%; text-align: center; }

@media (max-width: 960px) { .ww-posts { grid-template-columns: var(--grid-2); } }
@media (max-width: 600px) { .ww-posts { grid-template-columns: var(--grid-1); } }

/* ---------- FAQ ---------- */
.ww-faq__grid { display: grid; grid-template-columns: var(--grid-2-3); align-items: start; gap: var(--space-2xl); }
.ww-faq__side { position: sticky; inset-block-start: calc(var(--header-offset, 0px) + var(--space-l)); }
.ww-ask {
  display: grid;
  justify-items: start;
  gap: var(--space-s);
  padding: var(--space-xl);
  background-color: var(--surface-0);
  background-image: radial-gradient(20rem 12rem at 100% 0%, color-mix(in oklab, var(--p-900) 50%, transparent), transparent 70%);
}
.ww-ask p { margin: 0; }
.ww-acc { inline-size: 100%; }
.ww-acc__item { overflow: hidden; transition: var(--transition); }
.ww-acc__item[open] { background-color: var(--surface-3); }
.ww-acc__item summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-m);
  padding: var(--space-m) var(--space-l);
  color: var(--text-primary);
  list-style: none;
  cursor: pointer;
}
.ww-acc__item summary::-webkit-details-marker { display: none; }
.ww-acc__item summary:hover { background-image: var(--hover-layer); }
.ww-acc__q { font-family: var(--font-heading); }
.ww-acc__icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  inline-size: 1.9rem;
  block-size: 1.9rem;
  border-radius: var(--radius-circle);
  background-color: var(--surface-4);
  color: var(--text-primary);
  transition: var(--transition);
}
.ww-acc__item[open] .ww-acc__icon { rotate: 45deg; background-color: var(--action); color: var(--on-action); }
.ww-acc__body { padding: 0 var(--space-l) var(--space-l); }
.ww-acc__body p { margin: 0; }
.ww-acc__item[open] .ww-acc__body { animation: ww-acc-open 350ms var(--transition-timing); }
@keyframes ww-acc-open { from { opacity: 0; translate: 0 -6px; } }

@media (max-width: 860px) {
  .ww-faq__grid { grid-template-columns: var(--grid-1); }
  .ww-faq__side { position: static; }
}

/* ---------- CTA + footer ---------- */
.ww-cta-band { padding-block-end: var(--space-xl); }
.ww-cta { display: grid; grid-template-columns: var(--grid-3-2); align-items: end; gap: var(--space-2xl); inline-size: 100%; }
.ww-cta p { margin: 0; }
.ww-news__row {
  display: flex;
  gap: var(--space-4xs);
  padding: var(--space-4xs);
  border: 1px solid var(--border);
  background-color: var(--surface-3);
  transition: var(--transition);
}
.ww-news__row:focus-within { border-color: var(--focus-color); box-shadow: 0 0 0 var(--focus-ring-width) var(--focus-ring-color); }
.ww-news__row.is-error { border-color: var(--error-border, var(--border-strong)); }
.ww-news__row input {
  flex: 1;
  min-inline-size: 0;
  padding: 0 0.75em;
  border: 0;
  background: transparent;
  color: var(--text-primary);
}
.ww-news__row input::placeholder { color: var(--text-disabled); }
body .ww-news__row input:focus-visible { outline: none; border-color: transparent; box-shadow: none; }
.ww-news__msg { min-block-size: 1lh; }
.ww-news__msg.is-error { color: var(--error-text, var(--text-primary)); }
.ww-news__msg.is-ok { color: var(--success-text, var(--text-primary)); }

.ww-footer { inline-size: 100%; padding: var(--space-2xl); color: var(--text-secondary); }
/* In dark mode the footer card follows the page instead of staying light */
:root[${A}="dark"] .ww-footer { color-scheme: dark; background-color: var(--surface-2); }
.ww-footer__top {
  display: grid;
  grid-template-columns: minmax(0, 2fr) repeat(3, minmax(0, 1fr));
  gap: var(--space-xl);
  padding-block-end: var(--space-xl);
}
.ww-footer__brand p { max-inline-size: 24rem; margin: 0; }
.ww-footer__col h3 { margin-block-end: var(--space-s); }
.ww-footer__col ul { display: grid; gap: var(--space-3xs); }
.ww-footer__col a { color: inherit; text-decoration: none; }
.ww-footer__col a:hover { color: var(--action); }
.ww-footer__bottom {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-s);
  padding-block-start: var(--space-m);
}
.ww-footer__bottom a { color: inherit; }
.ww-footer__bottom a:hover { color: var(--text-primary); }

@media (max-width: 960px) {
  .ww-cta { grid-template-columns: var(--grid-1); }
  .ww-footer__top { grid-template-columns: var(--grid-3); }
  .ww-footer__brand { grid-column: 1 / -1; }
}
@media (max-width: 560px) {
  .ww-footer { padding: var(--space-l); }
  .ww-footer__top { grid-template-columns: var(--grid-2); }
  .ww-news__row { flex-direction: column; }
  .ww-news__row input { padding: 0.75em; }
}

/* ---------- Floating ---------- */
.ww-totop {
  position: fixed;
  inset: auto var(--space-m) var(--space-m) auto;
  z-index: 90;
  box-shadow: var(--shadow-5);
  opacity: 0;
  translate: 0 1rem;
  pointer-events: none;
}
.ww-totop.is-visible { opacity: 1; translate: 0 0; pointer-events: auto; }
.ww-toast {
  position: fixed;
  inset: auto auto var(--space-m) 50%;
  z-index: 200;
  max-inline-size: min(28rem, calc(100vw - 2rem));
  padding: var(--space-s) var(--space-m);
  color: var(--text-primary);
  opacity: 0;
  translate: -50% 150%;
  transition: translate 400ms var(--transition-timing), opacity 300ms;
}
.ww-toast.is-visible { opacity: 1; translate: -50% 0; }
.ww-toast strong { color: var(--action); }

@media (prefers-reduced-motion: reduce) {
  .ww-about__badge { animation: none; }
}

/* No transitions while the theme flips (the page script adds this for one style recalc) */
.theme-switching,
.theme-switching *,
.theme-switching *::before,
.theme-switching *::after { transition: none !important; }
`);
}

/* ------------------------------------------------------------------ */
/* Page script (runs inside the preview iframe)                        */
/* ------------------------------------------------------------------ */

/**
 * Wayward's interactions. Stringified into the iframe, so it may not use
 * anything from this module. Listeners on window/document are added once;
 * init() binds the page's elements and runs again after each rebuild.
 */
function websiteScript(attr) {
    const doc = document;
    const root = doc.documentElement;
    const $ = (sel, ctx) => (ctx || doc).querySelector(sel);
    const $$ = (sel, ctx) => Array.from((ctx || doc).querySelectorAll(sel));
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timers = {};
    const observers = [];
    // Survives rebuilds, so an edit in TwoKit keeps the page as the user left it.
    const state = { slide: 0, route: 'Glacier Express', plan: 'rail', group: false, filter: 'all' };
    const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function toast(html) {
        const el = $('[data-toast]');
        if (!el) return;
        el.innerHTML = html;
        el.classList.add('is-visible');
        clearTimeout(timers.toast);
        timers.toast = setTimeout(() => el.classList.remove('is-visible'), 3800);
    }

    /* Theme: the TwoKit Example switch owns it; the page's toggle presses that switch. */
    function syncThemeButton() {
        const btn = $('[data-theme-toggle]');
        if (!btn) return;
        const dark = root.getAttribute(attr) === 'dark';
        btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
        btn.setAttribute('aria-pressed', String(dark));
    }
    new MutationObserver(() => {
        // Snap colors: no transitions for the one style recalc that flips the theme.
        root.classList.add('theme-switching');
        void getComputedStyle(root).color;
        root.classList.remove('theme-switching');
        syncThemeButton();
    }).observe(root, { attributes: true, attributeFilter: [attr] });
    function toggleTheme() {
        const next = root.getAttribute(attr) === 'dark' ? 'light' : 'dark';
        const host = window.frameElement && window.frameElement.closest('.example');
        const option = host && host.querySelector(`[data-key="example-theme"] [data-value="${next}"]`);
        if (option) option.click();
        else root.setAttribute(attr, next);
    }

    /* Mobile menu */
    function setMenu(open) {
        const btn = $('[data-menu-toggle]');
        const menu = $('[data-menu]');
        if (!btn || !menu) return;
        btn.setAttribute('aria-expanded', String(open));
        btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        doc.body.style.overflow = open ? 'hidden' : '';
        clearTimeout(timers.menu);
        if (open) {
            menu.hidden = false;
            void menu.offsetHeight;
            menu.classList.add('is-open');
        } else {
            menu.classList.remove('is-open');
            timers.menu = setTimeout(() => { if (btn.getAttribute('aria-expanded') === 'false') menu.hidden = true; }, 260);
        }
    }
    doc.addEventListener('keydown', (e) => {
        const btn = $('[data-menu-toggle]');
        if (e.key === 'Escape' && btn && btn.getAttribute('aria-expanded') === 'true') { setMenu(false); btn.focus(); }
    });
    matchMedia('(min-width: 1081px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

    function onScroll() {
        const y = window.scrollY;
        const header = $('[data-header]');
        const totop = $('[data-totop]');
        if (header) header.classList.toggle('is-scrolled', y > 8);
        if (totop) totop.classList.toggle('is-visible', y > 900);
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    /* Selects close on any click outside them */
    doc.addEventListener('click', (e) => {
        $$('[data-select]').forEach((w) => { if (!w.contains(e.target) && w.wwClose) w.wwClose(false); });
    });

    /* Route strip drag (window-level, follows the current strip) */
    const drag = { strip: null, down: false, moved: false, x: 0, left: 0 };
    window.addEventListener('pointermove', (e) => {
        if (!drag.down) return;
        const dx = e.clientX - drag.x;
        if (Math.abs(dx) > 5) { drag.moved = true; drag.strip.classList.add('is-dragging'); }
        drag.strip.scrollLeft = drag.left - dx;
    });
    window.addEventListener('pointerup', () => {
        if (!drag.down) return;
        drag.down = false;
        drag.strip.classList.remove('is-dragging');
        setTimeout(() => { drag.moved = false; }, 0);
    });

    const PLANS = {
        rail: { pathfinder: [390, ['Sleeper & panorama seats reserved', 'Station-side stays, hand-picked', 'Backup line for every leg', 'Local fixer on WhatsApp']], wayfarer: [140, ['Day-by-day rail itinerary', 'Booking windows & seat tips', 'Offline route map']] },
        road: { pathfinder: [460, ['Car or camper sourced for the road', 'Two-hour-a-day driving rule', 'Characterful stays held for you', '24/7 roadside fixer']], wayfarer: [160, ['Turn-by-turn backroad route', 'Fuel, food & viewpoint stops', 'Offline route map']] },
        trek: { pathfinder: [420, ['Inn-to-inn bookings', 'Luggage sent ahead daily', 'Packed lunches arranged', 'Local trail fixer']], wayfarer: [150, ['Stage-by-stage trail notes', 'GPX files & elevation profiles', 'Hut booking calendar']] },
        island: { pathfinder: [480, ['Ferry & boat tickets secured', 'Harbour-side stays', 'Weather-day backup plans', 'Local island fixer']], wayfarer: [170, ['Island-hop sequence & timetables', 'Port-to-stay transfer notes', 'Offline route map']] }
    };
    const GROUP_MULT = 3.2;
    const CHECK = '<svg class="tk-icon" aria-hidden="true"><use href="#i-check"/></svg>';

    /** Swap a button between its on and off .btn--* classes. */
    function setButton(btn, on, onClass, offClass) {
        btn.classList.toggle(onClass, on);
        btn.classList.toggle(offClass, !on);
    }

    function renderPlans(animate) {
        ['pathfinder', 'wayfarer'].forEach((key) => {
            const data = PLANS[state.plan][key];
            const price = state.group ? Math.round(data[0] * GROUP_MULT / 10) * 10 : data[0];
            const amt = $(`[data-price="${key}"]`);
            const list = $(`[data-features="${key}"]`);
            if (!amt || !list) return;
            const update = () => { amt.textContent = `€${price.toLocaleString()}`; amt.classList.remove('is-swapping'); };
            if (animate) { amt.classList.add('is-swapping'); setTimeout(update, 180); } else update();
            list.innerHTML = data[1].map((f, i) => `<li style="animation-delay:${i * 60}ms">${CHECK}<span>${f}</span></li>`).join('');
        });
        $$('[data-unit]').forEach((u) => { u.textContent = state.group ? '/ group of 6' : '/ person'; });
        $$('[data-group-toggle]').forEach((t) => { t.checked = state.group; });
        $$('.ww-tabs [role=tab]').forEach((t) => {
            const on = t.dataset.plan === state.plan;
            t.setAttribute('aria-selected', String(on));
            t.tabIndex = on ? 0 : -1;
            setButton(t, on, 'btn--primary-s', 'btn--ghost-s');
        });
    }

    function applyFilter() {
        let shown = 0;
        $$('.ww-post').forEach((p) => {
            const on = state.filter === 'all' ? shown < 3 : p.dataset.cat === state.filter;
            p.hidden = !on;
            if (on) shown++;
        });
        $$('[data-filter]').forEach((b) => {
            const on = b.dataset.filter === state.filter;
            b.setAttribute('aria-pressed', String(on));
            setButton(b, on, 'btn--primary-s', 'btn--outline-s');
        });
        const empty = $('[data-posts-empty]');
        if (empty) empty.hidden = shown > 0;
    }

    function init() {
        observers.splice(0).forEach((o) => o.disconnect());
        clearInterval(timers.slide);
        doc.body.style.overflow = '';

        const themeBtn = $('[data-theme-toggle]');
        if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
        syncThemeButton();

        const menuBtn = $('[data-menu-toggle]');
        if (menuBtn) menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
        $$('[data-menu] a').forEach((a) => a.addEventListener('click', () => setMenu(false)));

        const totop = $('[data-totop]');
        if (totop) totop.addEventListener('click', () => window.scrollTo({ top: 0 }));
        onScroll();

        /* Current section in the nav */
        const navLinks = $$('.ww-nav__link');
        const spy = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                navLinks.forEach((a) => {
                    const on = a.getAttribute('href') === `#${entry.target.id}`;
                    a.classList.toggle('is-current', on);
                    if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
                });
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean).forEach((s) => spy.observe(s));
        observers.push(spy);

        /* Hero slider */
        const slider = $('[data-slider]');
        if (slider) {
            const slides = $$('.ww-slide', slider);
            const dots = $$('.ww-slider__dots button', slider);
            const go = (i) => {
                state.slide = (i + slides.length) % slides.length;
                slides.forEach((s, n) => s.classList.toggle('is-active', n === state.slide));
                dots.forEach((d, n) => d.setAttribute('aria-selected', String(n === state.slide)));
            };
            const start = () => {
                clearInterval(timers.slide);
                if (!reduceMotion) timers.slide = setInterval(() => go(state.slide + 1), 6000);
            };
            $('[data-slide-next]', slider).addEventListener('click', () => { go(state.slide + 1); start(); });
            $('[data-slide-prev]', slider).addEventListener('click', () => { go(state.slide - 1); start(); });
            dots.forEach((d, n) => d.addEventListener('click', () => { go(n); start(); }));
            slider.addEventListener('mouseenter', () => clearInterval(timers.slide));
            slider.addEventListener('mouseleave', start);
            let touchX = null;
            slider.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
            slider.addEventListener('touchend', (e) => {
                if (touchX === null) return;
                const dx = e.changedTouches[0].clientX - touchX;
                if (Math.abs(dx) > 40) { go(state.slide + (dx < 0 ? 1 : -1)); start(); }
                touchX = null;
            });
            go(state.slide);
            start();
        }

        /* Custom selects */
        $$('[data-select]').forEach((wrap) => {
            const btn = $('.ww-select__btn', wrap);
            const list = $('[role=listbox]', wrap);
            const opts = $$('[role=option]', list);
            const valueEl = $('[data-select-value]', wrap);
            const input = $('input[type=hidden]', wrap);
            let focusIdx = 0;
            const selectedIdx = () => opts.findIndex((o) => o.getAttribute('aria-selected') === 'true');
            const setFocus = (i) => {
                focusIdx = (i + opts.length) % opts.length;
                opts.forEach((o, n) => o.classList.toggle('is-focused', n === focusIdx));
                list.setAttribute('aria-activedescendant', opts[focusIdx].id);
            };
            const open = () => {
                $$('[data-select]').forEach((w) => { if (w !== wrap && w.wwClose) w.wwClose(false); });
                list.hidden = false;
                btn.setAttribute('aria-expanded', 'true');
                setFocus(Math.max(0, selectedIdx()));
                list.focus();
            };
            const close = (refocus) => {
                if (list.hidden) return;
                list.hidden = true;
                btn.setAttribute('aria-expanded', 'false');
                if (refocus) btn.focus();
            };
            const choose = (i) => {
                opts.forEach((o, n) => o.setAttribute('aria-selected', String(n === i)));
                valueEl.textContent = opts[i].dataset.value;
                input.value = opts[i].dataset.value;
                close(true);
            };
            wrap.wwClose = close;
            btn.addEventListener('click', () => (list.hidden ? open() : close(true)));
            btn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } });
            opts.forEach((o, i) => {
                o.addEventListener('click', (e) => { e.stopPropagation(); choose(i); });
                o.addEventListener('mousemove', () => setFocus(i));
            });
            list.addEventListener('keydown', (e) => {
                switch (e.key) {
                    case 'ArrowDown': e.preventDefault(); setFocus(focusIdx + 1); break;
                    case 'ArrowUp': e.preventDefault(); setFocus(focusIdx - 1); break;
                    case 'Home': e.preventDefault(); setFocus(0); break;
                    case 'End': e.preventDefault(); setFocus(opts.length - 1); break;
                    case 'Enter': case ' ': e.preventDefault(); choose(focusIdx); break;
                    case 'Escape': e.preventDefault(); close(true); break;
                    case 'Tab': close(false); break;
                    default: {
                        const ch = e.key.length === 1 && e.key.toLowerCase();
                        if (!ch) return;
                        for (let k = 1; k <= opts.length; k++) {
                            const n = (focusIdx + k) % opts.length;
                            if (opts[n].textContent.trim().toLowerCase().startsWith(ch)) { setFocus(n); break; }
                        }
                    }
                }
            });
        });

        /* Forms: submit buttons, not the submit event (the preview cancels default actions of buttons) */
        const finder = $('[data-finder]');
        if (finder) {
            $('[type=submit]', finder).addEventListener('click', (e) => {
                e.preventDefault();
                const where = finder.elements.where.value.trim() || 'somewhere scenic';
                const style = $('input[name=style]:checked', finder).value;
                toast(`<strong>${style} route</strong> to ${escapeHtml(where)}, leaving ${finder.elements.when.value.toLowerCase()} at a ${finder.elements.pace.value.toLowerCase()} pace — a planner will be in touch.`);
            });
        }
        const news = $('[data-newsletter]');
        if (news) {
            $('[type=submit]', news).addEventListener('click', (e) => {
                e.preventDefault();
                const input = news.elements.email;
                const row = $('.ww-news__row', news);
                const msg = $('[data-news-msg]', news);
                const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
                row.classList.toggle('is-error', !ok);
                input.setAttribute('aria-invalid', String(!ok));
                msg.classList.toggle('is-ok', ok);
                msg.classList.toggle('is-error', !ok);
                msg.textContent = ok ? "You're on the list — your first route arrives next month." : "That email doesn't look quite right. Mind checking it?";
                if (ok) { input.value = ''; toast('<strong>Subscribed.</strong> Welcome aboard the slow lane.'); }
            });
        }

        /* Stat counters */
        const counters = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                const target = Number(el.dataset.count);
                counters.unobserve(el);
                if (reduceMotion) { el.textContent = target.toLocaleString(); return; }
                const t0 = performance.now();
                const tick = (now) => {
                    const p = Math.min((now - t0) / 1600, 1);
                    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString();
                    if (p < 1) requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            });
        }, { threshold: 0.6 });
        $$('[data-count]').forEach((el) => counters.observe(el));
        observers.push(counters);

        /* Routes strip */
        const strip = $('[data-routes]');
        if (strip) {
            const items = $$('.ww-strip__item', strip);
            const count = $('[data-routes-count]');
            const center = (item, smooth) => strip.scrollTo({ left: item.offsetLeft - (strip.clientWidth - item.offsetWidth) / 2, behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
            const activate = (item, scroll) => {
                state.route = item.dataset.name;
                items.forEach((it) => { it.classList.toggle('is-active', it === item); it.setAttribute('aria-pressed', String(it === item)); });
                if (count) count.textContent = `${$('.ww-strip__label', item).textContent} · ${item.dataset.name}`;
                if (scroll) center(item, true);
            };
            const step = (dir) => {
                const i = items.findIndex((it) => it.classList.contains('is-active'));
                activate(items[Math.max(0, Math.min(items.length - 1, i + dir))], true);
            };
            items.forEach((it) => it.addEventListener('click', () => { if (!drag.moved) activate(it, true); }));
            $('[data-routes-next]').addEventListener('click', () => step(1));
            $('[data-routes-prev]').addEventListener('click', () => step(-1));
            strip.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
            });
            strip.addEventListener('pointerdown', (e) => {
                if (e.pointerType !== 'mouse') return;
                Object.assign(drag, { strip, down: true, moved: false, x: e.clientX, left: strip.scrollLeft });
            });
            const current = items.find((it) => it.dataset.name === state.route) || items[0];
            activate(current, false);
            requestAnimationFrame(() => center(current, false));
        }

        /* Postcards */
        const cards = $$('.ww-pc');
        cards.forEach((pc) => pc.addEventListener('click', () => {
            const flipped = pc.getAttribute('aria-pressed') === 'true';
            cards.forEach((o) => o.setAttribute('aria-pressed', 'false'));
            pc.setAttribute('aria-pressed', String(!flipped));
        }));

        /* Pricing tabs + group toggle */
        const tabs = $$('.ww-tabs [role=tab]');
        tabs.forEach((tab, i) => {
            tab.addEventListener('click', () => { state.plan = tab.dataset.plan; renderPlans(true); });
            tab.addEventListener('keydown', (e) => {
                const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                if (!d) return;
                const next = tabs[(i + d + tabs.length) % tabs.length];
                next.focus();
                next.click();
            });
        });
        $$('[data-group-toggle]').forEach((t) => t.addEventListener('change', () => { state.group = t.checked; renderPlans(true); }));
        renderPlans(false);

        /* Journal filter */
        $$('[data-filter]').forEach((btn) => btn.addEventListener('click', () => { state.filter = btn.dataset.filter; applyFilter(); }));
        applyFilter();

        /* FAQ: one open at a time (browsers without details[name]) */
        const faqs = $$('[data-accordion] details');
        faqs.forEach((d) => d.addEventListener('toggle', () => {
            if (d.open) faqs.forEach((o) => { if (o !== d) o.open = false; });
        }));

        const year = $('[data-year]');
        if (year) year.textContent = new Date().getFullYear();
    }

    window.addEventListener('ex:render', init);
    init();
}

/** The script tag for the iframe document. */
export function websiteScriptTag() {
    return `<script>(${websiteScript.toString()})(${JSON.stringify(THEME_ATTR)});</script>`;
}
