/**
 * Blueprint previews: to-scale diagrams for spacing and layout tokens.
 *
 * A canvas stands for a real viewport (e.g. 1440px). Inside it `--u` is one
 * CSS pixel of that viewport (100cqi / canvas width), so every size is written
 * as calc(value * var(--u)) and the drawing fits any preview width.
 *
 * @module blueprint
 */

import { esc } from './components.js';

const n = (v) => Math.max(0, Number(v) || 0);
const px = (v) => `${Math.round(n(v) * 10) / 10}px`;

/** Numbered marker placed inside a band. */
const marker = (i) => (i ? `<span class="bp-marker" aria-hidden="true">${i}</span>` : '');

export function chip(text, tone = '') {
    return `<span class="bp-chip${tone ? ` bp-chip--${tone}` : ''}">${esc(text)}</span>`;
}

function canvas({ label, width, body, className = '' }) {
    return `
      <figure class="bp-canvas ${className}" style="--canvas:${width}">
        <figcaption class="bp-canvas__label">${esc(label)} <span>${width}px</span></figcaption>
        <div class="bp-frame">${body}</div>
      </figure>`;
}

/* ---------------- section anatomy ---------------- */

/**
 * One section drawn to scale: block/inline padding, and inside it the
 * content gap (between text), container gap (text → grid) and grid gap.
 * @param {{ pb, pi, container, content, grid }} v  px values
 */
function sectionBody(v, { stacked = false, markers = true } = {}) {
    const m = (i) => (markers ? marker(i) : '');
    const band = (kind, size, i, axis = 'y') => `<span class="bp-band bp-band--${kind} bp-band--${axis}" style="--s:${n(size)}">${m(i)}</span>`;
    // Three cards with a grid-gap band between each; the first band carries marker 5.
    const grid = [0, 1, 2].map((i) => `${i ? band('grid', v.grid, i === 1 ? 5 : 0, stacked ? 'y' : 'x') : ''}<span class="bp-card"></span>`).join('');
    return `
      <div class="bp-section" style="--pb:${n(v.pb)};--pi:${n(v.pi)}">
        <span class="bp-pad bp-pad--top">${m(1)}</span>
        <span class="bp-pad bp-pad--bottom"></span>
        <span class="bp-pad bp-pad--left">${m(2)}</span>
        <span class="bp-pad bp-pad--right"></span>
        <div class="bp-stack">
          <span class="bp-line bp-line--eyebrow"></span>
          ${band('content', v.content, 3)}
          <span class="bp-line bp-line--title"></span>
          ${band('content', v.content, 0)}
          <span class="bp-line bp-line--text"></span>
          ${band('container', v.container, 4)}
          <div class="bp-grid${stacked ? ' is-stacked' : ''}">${grid}</div>
        </div>
      </div>`;
}

/**
 * @param {{ desktop: object, mobile: object, rows: [token, desktopPx, mobilePx][] }} spec
 */
export function sectionAnatomy({ desktop, mobile, rows }) {
    const kinds = ['pad', 'pad', 'content', 'container', 'grid'];
    const legend = rows.map(([token, max, min], i) => `
      <tr>
        <td><span class="bp-marker bp-marker--${kinds[i]}">${i + 1}</span></td>
        <th scope="row"><code>${esc(token)}</code></th>
        <td>${px(max)}</td>
        <td>${px(min)}</td>
      </tr>`).join('');
    return `
      <div class="bp-pair">
        ${canvas({ label: 'Desktop', width: 1440, body: sectionBody(desktop) })}
        ${canvas({ label: 'Mobile', width: 375, body: sectionBody(mobile, { stacked: true, markers: false }), className: 'bp-canvas--phone' })}
      </div>
      <table class="bp-legend">
        <thead><tr><th></th><th scope="col">Token</th><th scope="col">Desktop</th><th scope="col">Mobile</th></tr></thead>
        <tbody>${legend}</tbody>
      </table>`;
}

/* ---------------- width zones ---------------- */

/**
 * Centered zones with a measurement arrow, widest last.
 * @param {{ name, px, highlight?, gutter? }[]} zones  gutter: px of padding on each side (full-width safe)
 */
export function widthZones(zones, viewport) {
    const rows = zones.map((z) => {
        const width = z.px == null ? 100 : Math.min(100, (z.px / viewport) * 100);
        const gutter = z.gutter ? (z.gutter / viewport) * 100 : 0;
        return `
          <div class="bp-zone${z.highlight ? ' is-highlight' : ''}${z.px == null ? ' is-full' : ''}" style="--w:${width}%;--g:${gutter}%">
            ${gutter ? '<span class="bp-zone__gutter bp-zone__gutter--start"></span><span class="bp-zone__gutter bp-zone__gutter--end"></span>' : ''}
            <span class="bp-zone__name">${esc(z.name)}</span>
            <span class="bp-measure"><span>${esc(z.label)}</span></span>
          </div>`;
    }).join('');
    return `<div class="bp-zones">${rows}</div>`;
}

/* ---------------- grids ---------------- */

/** One labelled grid example: title chips, then cells. */
export function gridExample({ tokens, template, cells, gap, note = '' }) {
    const items = Array.from({ length: cells }, (_, i) => `<span class="bp-cell">${chip(`${i + 1}`, 'cell')}</span>`).join('');
    return `
      <div class="bp-grid-example">
        <div class="bp-chips">${tokens.map((t, i) => chip(t, i ? 'muted' : '')).join('')}${note ? `<span class="bp-note">${esc(note)}</span>` : ''}</div>
        <div class="bp-cells" style="grid-template-columns:${template};gap:${gap}">${items}</div>
      </div>`;
}

/* ---------------- header ---------------- */

function headerPage({ header, pb, offset, label, tone }) {
    const hidden = !offset;
    return `
      <figure class="bp-canvas bp-browser" style="--canvas:1440">
        <figcaption class="bp-canvas__label">${esc(label)}</figcaption>
        <div class="bp-frame">
          <div class="bp-browser__chrome"><span></span><span></span><span></span></div>
          <div class="bp-page" style="--hh:${n(header)};--pb:${n(pb)}">
            <div class="bp-header">
              <span class="bp-header__logo"></span>
              <span class="bp-header__nav"><i></i><i></i><i></i></span>
              <span class="bp-header__cta"></span>
            </div>
            <div class="bp-hero${hidden ? ' is-covered' : ''}">
              ${offset ? `<span class="bp-hero__band bp-hero__band--offset">${chip('--header-offset', 'dark')}</span>` : ''}
              <span class="bp-hero__band bp-hero__band--pad">${chip('--sctn-block-padding', 'dark')}</span>
              <div class="bp-hero__content">
                <span class="bp-line bp-line--eyebrow"></span>
                <span class="bp-line bp-line--title"></span>
                <span class="bp-line bp-line--title bp-line--short"></span>
                <span class="bp-line bp-line--text"></span>
              </div>
              ${hidden ? `<span class="bp-hero__warning">${chip(n(pb) <= n(header) ? 'Content sits under the header' : `Only ${Math.round(n(pb) - n(header))}px left below the header`, tone)}</span>` : ''}
            </div>
          </div>
        </div>
      </figure>`;
}

export function headerOffset({ height, pb, offsetOn }) {
    return `
      <div class="bp-pair bp-pair--stack">
        ${headerPage({ header: height, pb, offset: false, label: 'Sticky header, no offset', tone: 'warn' })}
        ${headerPage({ header: height, pb, offset: true, label: offsetOn ? 'With TwoKit offset' : 'With TwoKit offset (turned off)' })}
      </div>`;
}
