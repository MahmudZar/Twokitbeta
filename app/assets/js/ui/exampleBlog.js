/**
 * Example blog: one long Wayward journal post, for reading the user's
 * typography in running text.
 *
 *   h1        the post title             (styles.css: --h1, --heading-line-height)
 *   h2 h3 h4  section, subsection, minor (--h2 / --h3 / --h4)
 *   p ul ol   body copy and lists        (body size, --text-line-height)
 *   blockquote, figure + figcaption, table, code, strong / em / links
 *
 * Every size, color and space comes from TwoKit: real tags styled by the
 * HTML export, .text-* / .text-style-h4 / surface / radius classes and
 * tokens. The article body is .auto-spacing (TwoKit's auto spacing, set on
 * Spacing → Auto spacing), so the rhythm between paragraphs, headings,
 * lists, figures and captions is the user's. The CSS here is layout only:
 * the reading column and component looks. Class and token names use
 * TwoKit's default steps and go through the same resolvers as the website.
 *
 * "Show line boxes" stripes every line (1lh bands), so line height can be
 * read at each size: one band per line, headings tight, body roomy.
 *
 * @module exampleBlog
 */

import { resolveClasses, resolveCss } from './exampleWebsite.js';

const img = (id, w, q = 80) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=${q}`;

const LOGO = '<svg class="tk-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m15.5 8.5-2 5-5 2 2-5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const LINES = '<svg class="tk-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

const TOC = [
    ['why-slow', 'Why take the slow line'],
    ['route', 'The route, day by day'],
    ['tickets', 'Tickets, seats and the window question'],
    ['packing', 'What to pack'],
    ['last-word', 'A last word on pace']
];

const RELATED = [
    ['1515165562839-978bbcf18277', 'Red and white train waiting at a covered station platform', 'Rail · 6 min read', 'The window seat guide: which side to sit on for 14 classic train rides'],
    ['1551632811-561732d1e306', 'Hikers walking a mountain trail', 'Trek · 8 min read', 'Inn to inn: how luggage transfer quietly changes everything']
];

function article() {
    return `
    <article class="blog-article">
      <header class="blog-head content-width-md stack gap-m">
        <p class="blog-kicker text-xs text-action">Rail journal · Switzerland &amp; Italy</p>
        <h1>The slow way across the Alps: nine days on the Bernina line</h1>
        <p class="text-l text-secondary">From Zürich's busy concourse to the lemon trees of Lake Como, by the slowest trains we could find. A day-by-day account of the route, the seats worth fighting for and the stops nobody tells you about.</p>
        <div class="blog-meta">
          <img class="blog-avatar radius-circle" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80" alt="">
          <p class="text-s text-muted"><span class="text-primary">Inês Duarte</span>, route planner<br>Published 14 March 2026 · 12 min read</p>
          <button type="button" class="tk-button btn--outline-s blog-lines-toggle" data-lines-toggle aria-pressed="false">${LINES} Show line boxes</button>
        </div>
      </header>

      <figure class="blog-wide">
        <img class="radius-xl" src="${img('1474487548417-781cb71495f3', 1600)}" alt="Yellow and red locomotive running along the tracks under a stormy sky">
        <figcaption class="text-s text-muted">The Bernina Express leaving Pontresina, just before the climb to Ospizio Bernina at 2,253 metres.</figcaption>
      </figure>

      <div class="blog-prose tk-text auto-spacing content-width-xs">
        <nav class="blog-toc surface-2 radius-l" aria-label="In this article">
          <p class="text-xs text-muted">In this article</p>
          <ol class="text-s">${TOC.map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`).join('')}</ol>
        </nav>

        <p>There is a moment, about forty minutes out of Tirano, when the train slows almost to walking pace and begins to turn in a full circle. The track spirals over itself on a stone viaduct, and for a few seconds you can see the carriages ahead of you crossing the bridge you are about to cross. Nobody on board is looking at their phone. Everyone is looking out of the window.</p>
        <p>That moment is the reason for this whole trip. You could cross the Alps in four hours on a fast train through the Gotthard base tunnel, and plenty of people should. But if you have a week, and you would rather <em>see</em> the mountains than pass under them, the old lines are still running, still punctual and still astonishing.</p>

        <h2 id="why-slow">Why take the slow line</h2>
        <p>The fast route is a feat of engineering: 57 kilometres of tunnel, almost no view. The slow routes are a feat of a different kind. They were built a century earlier, when trains could not climb steep grades, so the line had to <strong>loop, spiral and switch back</strong> to gain height. The result is a railway that seems designed for looking.</p>
        <p>Three things make the slow line worth the extra days:</p>
        <ul>
          <li><strong>The views change every few minutes.</strong> Glaciers, larch forest, high moorland and, at the end, palm trees.</li>
          <li><strong>The stops are real villages.</strong> Bergün, Poschiavo and Brusio are places people live, not stations built for tourists.</li>
          <li><strong>It is genuinely relaxing.</strong> No security queue, no luggage limits, and a dining car that serves a decent risotto.
            <ul>
              <li>Most regional trains have open windows in summer.</li>
              <li>Bikes travel free on many sections if you reserve a hook.</li>
            </ul>
          </li>
        </ul>

        <blockquote class="blog-quote">
          <p class="text-style-h4 text-primary">“We were told the Albula pass would add a day. It added the best day of the whole trip.”</p>
          <cite class="text-s text-muted">— Amara &amp; Theo, travelled March 2025</cite>
        </blockquote>

        <h2 id="route">The route, day by day</h2>
        <p>The full trip runs nine days and covers roughly 480 kilometres. We built it around one rule: never more than three hours on a train in a single day. That leaves every afternoon free for walking, swimming or simply sitting by a lake.</p>

        <h3>Days 1–3: Zürich to the Engadin</h3>
        <p>Start with a morning train from Zürich to Chur, the oldest town in Switzerland and the gateway to the narrow-gauge Rhaetian Railway. From Chur, take the Albula line to St. Moritz. This is the stretch with the famous spiral tunnels above Bergün, where the line climbs 400 metres in just 12 kilometres.</p>
        <p>Break the journey in Bergün itself. The village has a railway museum, a good bakery and a sledging run that, in winter, follows the old road all the way down to Preda.</p>

        <h4>Where to stay in Bergün</h4>
        <p>The Hotel Weisses Kreuz has stood on the square since 1588 and still serves its own barley soup. Ask for a room facing the valley; the ones above the street hear the church bells at six.</p>

        <h3>Days 4–6: Over the Bernina pass</h3>
        <p>From St. Moritz, the Bernina line climbs past the Morteratsch glacier to the highest point of the trip at Ospizio Bernina. Then it drops 1,800 metres to Tirano in Italy without a single rack section. Every metre of that descent is done on adhesion alone, which is why the line loops so much.</p>

        <figure class="blog-pair">
          <figure>
            <img class="radius-l" src="${img('1464822759023-fed622ff2c3b', 900)}" alt="Snowy alpine peak above a valley">
            <figcaption class="text-xs text-muted">Morteratsch, seen from the train at kilometre 32.</figcaption>
          </figure>
          <figure>
            <img class="radius-l" src="${img('1506905925346-21bda4d32df4', 900)}" alt="Sea of clouds below jagged mountain peaks at sunrise">
            <figcaption class="text-xs text-muted">Morning cloud filling the Valposchiavo below Alp Grüm.</figcaption>
          </figure>
        </figure>

        <h4>The Brusio spiral</h4>
        <p>The circular viaduct at Brusio is the photograph everyone wants. Sit on the <strong>right-hand side</strong> heading south, and be ready about four minutes after leaving Brusio station. The train completes the loop in under a minute.</p>

        <h3>Days 7–9: Valtellina and Lake Como</h3>
        <p>Tirano feels instantly Italian: espresso at the station bar, vineyards climbing the slopes. From here a regional train follows the Valtellina valley down to Lake Como, where a ferry takes you on to Varenna and Bellagio. End the trip with a swim. You will have earned it.</p>

        <h2 id="tickets">Tickets, seats and the window question</h2>
        <p>The most common mistake is booking the panoramic Bernina Express for every leg. It is a lovely train, but the reservation fee adds up and its big windows don't open. The regular regional trains run the same track every hour, with opening windows and no supplement.</p>

        <div class="blog-table">
          <table class="text-s">
            <caption class="text-xs text-muted">Typical summer prices, second class, one way</caption>
            <thead><tr><th scope="col">Leg</th><th scope="col">Time</th><th scope="col">Regional</th><th scope="col">Panoramic</th></tr></thead>
            <tbody>
              <tr><td>Chur → St. Moritz</td><td>2 h 00</td><td>CHF 34</td><td>CHF 34 + 20</td></tr>
              <tr><td>St. Moritz → Tirano</td><td>2 h 30</td><td>CHF 31</td><td>CHF 31 + 26</td></tr>
              <tr><td>Tirano → Varenna</td><td>1 h 40</td><td>€ 8.50</td><td>—</td></tr>
            </tbody>
          </table>
        </div>

        <p>If you hold a Swiss Travel Pass, every Swiss leg is covered and you only pay the reservation supplement on panoramic trains. Search the timetable for the train number, for example <code>R 1631</code>, rather than the route name: the booking sites list both.</p>

        <h3>Which side to sit on</h3>
        <ol>
          <li>Zürich to Chur: <strong>left</strong>, for Lake Walen and the Churfirsten cliffs.</li>
          <li>Chur to St. Moritz: <strong>right</strong>, for the Landwasser viaduct and the Bergün spirals.</li>
          <li>St. Moritz to Tirano: <strong>right</strong> as far as Alp Grüm, then either side for the descent.</li>
        </ol>

        <h2 id="packing">What to pack</h2>
        <p>Mountain weather changes by the hour, and the trip runs from glacier to lakeshore. Pack in layers and keep it light: you will be lifting your bag onto racks a dozen times.</p>

        <h4>The short list</h4>
        <ul>
          <li>A warm layer for Ospizio Bernina, even in July. It can snow at 2,253 metres in any month.</li>
          <li>Swimwear for Lake Como and the lido at Varenna.</li>
          <li>A paper map of the Rhaetian Railway. Signal disappears in the tunnels, and the map is a lovely souvenir.</li>
          <li>Snacks for the climb. The dining car closes between Pontresina and Poschiavo.</li>
        </ul>

        <h2 id="last-word">A last word on pace</h2>
        <p>The point of a trip like this is not the distance covered. It is the hour you spend on a platform in Poschiavo watching the light move across the valley, waiting for a train that you could have caught an hour earlier. Plan for less than you think you can do. The mountains will fill the gaps.</p>
        <p>If you would like us to build this route for you, with every seat reserved on the right side, <a href="#top">talk to a planner</a>. And if you take it on your own, send us a postcard.</p>

        <footer class="blog-tags cluster gap-2xs" aria-label="Tags">
          <span class="blog-tag surface-2 radius-circle text-xs text-secondary">Rail</span>
          <span class="blog-tag surface-2 radius-circle text-xs text-secondary">Switzerland</span>
          <span class="blog-tag surface-2 radius-circle text-xs text-secondary">Italy</span>
          <span class="blog-tag surface-2 radius-circle text-xs text-secondary">Slow travel</span>
        </footer>
      </div>

      <aside class="blog-author content-width-xs surface-2 radius-xl" aria-label="About the author">
        <img class="blog-avatar blog-avatar--l radius-circle" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&h=160&q=80" alt="">
        <div class="stack gap-2xs">
          <p class="text-style-h4 text-primary">Inês Duarte</p>
          <p class="text-s text-secondary">Inês has planned rail routes at Wayward since 2016. She has ridden the Bernina line eleven times and still sits on the right.</p>
        </div>
      </aside>
    </article>`;
}

function related() {
    return `
    <section class="tk-section surface-0 blog-related" aria-labelledby="blog-related">
      <div class="tk-container container-gap">
        <h2 id="blog-related">Keep reading</h2>
        <div class="grid-auto-2 blog-related__grid">${RELATED.map(([id, alt, tag, title]) => `
          <article class="blog-card clickable-card surface-2 radius-xl shadow-2">
            <img class="radius-l" src="${img(id, 800, 75)}" alt="${alt}">
            <div class="stack gap-2xs">
              <p class="text-xs text-muted">${tag}</p>
              <h3 class="text-style-h4"><a href="#top">${title}</a></h3>
            </div>
          </article>`).join('')}
        </div>
      </div>
    </section>`;
}

/** The page body (inside #ex-root). */
export function blogBody() {
    return resolveClasses(`
  <header class="blog-nav surface-1">
    <div class="tk-container blog-nav__row">
      <a class="tk-logo blog-logo text-l text-primary" href="#top">${LOGO}<span>Wayward</span></a>
      <nav aria-label="Primary"><ul class="tk-list cluster gap-m text-s"><li><a href="#top">Journeys</a></li><li><a href="#top" aria-current="page">Journal</a></li><li><a href="#top">Pricing</a></li></ul></nav>
      <a class="tk-button btn--primary-s" href="#top">Plan my route</a>
    </div>
  </header>
  <main id="top">
    <section class="tk-section">${article()}
    </section>${related()}
  </main>`);
}

/** Layout only: the reading column and the rhythm between blocks. */
export function blogCss() {
    return resolveCss(`
/* Example blog. Layout only; type, color and space are TwoKit output. */
.blog-nav { position: sticky; inset-block-start: 0; z-index: 10; padding-inline: var(--sctn-inline-padding); border-block-end: 1px solid var(--border-subtle); }
.blog-nav__row { flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-m); padding-block: var(--space-xs); }
.blog-nav a:not(.tk-button) { color: var(--text-secondary); text-decoration: none; }
.blog-nav a:not(.tk-button):hover, .blog-nav [aria-current="page"] { color: var(--text-primary); }
.blog-logo { display: inline-flex; align-items: center; gap: 0.4em; font-family: var(--font-heading); text-decoration: none; }
.blog-logo .tk-icon { color: var(--action); }

.blog-article { display: flex; flex-direction: column; align-items: center; gap: var(--space-xl); inline-size: 100%; }
.blog-head p { margin: 0; }
.blog-kicker { text-transform: uppercase; }
.blog-meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-s); padding-block-start: var(--space-xs); border-block-start: 1px solid var(--border-subtle); }
.blog-avatar { inline-size: 2.75rem; block-size: 2.75rem; object-fit: cover; }
.blog-avatar--l { inline-size: 4rem; block-size: 4rem; flex-shrink: 0; }
.blog-lines-toggle { margin-inline-start: auto; }

/* Figures (outside the article body; inside it auto spacing places captions) */
:where(.blog-article figure) { margin: 0; }
.blog-article figure img { display: block; inline-size: 100%; object-fit: cover; }
.blog-wide figcaption { margin-block-start: var(--space-2xs); }
.blog-wide { inline-size: 100%; max-inline-size: var(--content-width-md); }
.blog-wide img { aspect-ratio: 16 / 9; }
.blog-pair { display: grid; grid-template-columns: var(--grid-2); gap: var(--space-s); }
.blog-pair img { aspect-ratio: 4 / 5; }

/* The rhythm between blocks is auto spacing (.auto-spacing); only looks here */
.blog-prose { inline-size: 100%; }
.blog-prose :is(h2, h3, h4) { scroll-margin-block-start: calc(var(--space-3xl) + var(--space-m)); }
.blog-prose li::marker { color: var(--action); }

.blog-toc { padding: var(--space-s) var(--space-m); }
.blog-toc p { margin: 0 0 var(--space-2xs); text-transform: uppercase; }
.blog-toc ol { margin: 0; padding-inline-start: 1.25em; }
.blog-toc li + li { margin-block-start: var(--space-4xs); }

.blog-quote { padding-inline-start: var(--space-m); border-inline-start: 3px solid var(--action); }
.blog-quote p { margin: 0 0 var(--space-2xs); }
.blog-quote cite { font-style: normal; }

.blog-table { inline-size: 100%; overflow-x: auto; }
.blog-table table { inline-size: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.blog-table caption { padding-block-end: var(--space-2xs); text-align: start; }
.blog-table th { color: var(--text-primary); text-align: start; }
.blog-table :is(th, td) { padding: var(--space-2xs) var(--space-xs); border-block-end: 1px solid var(--border-subtle); }
.blog-table tr > :first-child { padding-inline-start: 0; }

.blog-tags { padding-block-start: var(--space-l); border-block-start: 1px solid var(--border-subtle); }
.blog-tag { padding: 0.3em 0.9em; }

.blog-author { display: flex; align-items: flex-start; gap: var(--space-s); padding: var(--space-m); }
.blog-author p { margin: 0; }

.blog-related__grid { inline-size: 100%; }
.blog-card { position: relative; display: grid; gap: var(--space-s); padding: var(--space-2xs) var(--space-2xs) var(--space-m); }
.blog-card img { display: block; inline-size: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.blog-card .stack { padding-inline: var(--space-s); }
.blog-card p { margin: 0; }
.blog-card a { color: inherit; text-decoration: none; }
.blog-card:hover a { color: var(--action); }

/* Show line boxes: one band per line (1lh), so line height is visible at every size */
.show-lines .blog-article :is(h1, h2, h3, h4, p, li, figcaption, cite, td, th) {
  background-image: repeating-linear-gradient(to bottom, color-mix(in oklab, var(--action) 16%, transparent) 0 1lh, transparent 1lh 2lh);
}

@media (max-width: 640px) {
  .blog-pair { grid-template-columns: var(--grid-1); }
  .blog-author { flex-direction: column; }
}
`);
}

/**
 * Line-box toggle. The class lives on <html> (survives markup rebuilds) and
 * the choice in localStorage (survives a new frame when the screen changes).
 */
function blogScript() {
    const KEY = 'twokit-blog-lines';
    const root = document.documentElement;
    const sync = () => document.querySelectorAll('[data-lines-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(root.classList.contains('show-lines'))));
    try { root.classList.toggle('show-lines', localStorage.getItem(KEY) === '1'); } catch { /* storage blocked */ }
    document.addEventListener('click', (e) => {
        if (!e.target.closest('[data-lines-toggle]')) return;
        const on = root.classList.toggle('show-lines');
        try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage blocked */ }
        sync();
    });
    window.addEventListener('ex:render', sync);
    sync();
}

export function blogScriptTag() {
    return `<script>(${blogScript.toString()})();</script>`;
}
