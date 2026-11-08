/**
 * Resolves any CSS color (var(), oklch(from …), color-mix(), light-dark(),
 * #hex, named colors) to sRGB + alpha, using the browser's own engine: the
 * value is set on a hidden probe that carries the design tokens for one
 * theme, the computed color is painted on a 1×1 canvas and read back.
 *
 * An invalid value (bad syntax, unknown variable) leaves the probe on a
 * sentinel color inherited from its parent, so it resolves to null.
 *
 * @module colorResolve
 */

const SENTINEL = 'rgb(1, 2, 3)';
const HOST_STYLE = 'position:fixed;inline-size:0;block-size:0;overflow:hidden;visibility:hidden;pointer-events:none';

/** djb2 hash, so any change to the token set invalidates cached results. */
function hash(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}

let canvas = null;
const scopes = new Map(); // mode → { host, probe, varsKey }
const cache = new Map(); // `${mode}|${varsKey}|${value}` → result

function paint(css) {
    canvas ||= Object.assign(document.createElement('canvas'), { width: 1, height: 1 });
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = css; // modern color syntaxes (oklch, color()) are accepted here
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a: a / 255 };
}

function scope(mode, vars, varsKey) {
    let s = scopes.get(mode);
    if (!s) {
        const host = document.createElement('div');
        host.setAttribute('aria-hidden', 'true');
        const probe = document.createElement('span');
        host.appendChild(probe);
        document.body.appendChild(host);
        s = { host, probe, varsKey: null };
        scopes.set(mode, s);
    }
    if (s.varsKey !== varsKey) {
        // Tokens for this theme; the probe inherits the sentinel color.
        s.host.style.cssText = `${HOST_STYLE};color-scheme:${mode};color:${SENTINEL};${vars}`;
        s.varsKey = varsKey;
    }
    return s;
}

/**
 * @param {string} value CSS color
 * @param {'light'|'dark'} mode theme the tokens resolve in
 * @param {string} vars "--name:value;…" token declarations for that theme
 * @returns {{hex:string, alpha:number}|null} null when the value isn't a valid color
 */
export function resolveColor(value, mode, vars) {
    const css = String(value || '').trim();
    if (!css) return null;
    const varsKey = hash(vars);
    const key = `${mode}|${varsKey}|${css}`;
    if (cache.has(key)) return cache.get(key);
    const { probe } = scope(mode, vars, varsKey);
    probe.style.color = '';
    probe.style.setProperty('color', css);
    const set = probe.style.getPropertyValue('color') !== '';
    const computed = getComputedStyle(probe).color;
    let out = null;
    if (set && computed && computed !== SENTINEL) {
        const { r, g, b, a } = paint(computed);
        out = { hex: `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`, alpha: Math.round(a * 1000) / 1000 };
    }
    if (cache.size > 500) cache.clear();
    cache.set(key, out);
    return out;
}
