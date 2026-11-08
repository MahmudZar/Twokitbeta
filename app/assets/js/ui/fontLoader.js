/**
 * Makes library fonts render in the app and in the example iframe.
 *
 *   Google  <link> to the CSS2 API with the chosen styles
 *   Local   FontFace from IndexedDB bytes + a blob: URL for iframe @font-face
 *
 * @module fontLoader
 */

import AppState from '../state/appState.js';
import FontStore from '../core/fontStore.js';
import { cssUrl, namesUrl } from '../core/googleFonts.js';
import { quoteFamily, faceWeight } from '../state/fontModel.js';

const links = new Map(); // font id → <link>
const loaded = new Map(); // fileId → { url, face: FontFace }
const queued = new Map(); // upload-queue key → FontFace (not in the library yet, so sync() leaves them alone)
const named = new Map(); // catalog family → 'loading' | 'ready' (name-only glyphs, under an alias; dropped on failure so a revisit retries)
let nameQueue = [];
let nameTimer = 0;
let fullPreview = null; // { family, href, link, ready: Promise<boolean> } — the one catalog family being previewed

/** Families per name request: the CSS2 API takes several, sharing one `text`. */
const NAME_BATCH = 12;

/**
 * Alias the name-only glyphs are registered under. Their subset only holds the
 * letters of the name, so under the real family name it would shadow the full
 * styles (the specimen fell back to the system font for every other letter).
 */
export const nameFamily = (family) => `tk-name ${family}`;

/** Re-label every @font-face in a CSS2 response with its nameFamily() alias. */
const aliasFamilies = (css) => css.replace(/font-family:\s*(['"])(.+?)\1/g,
    (_, quote, name) => `font-family: '${nameFamily(name).replace(/'/g, "\\'")}'`);

async function loadNames(families) {
    try {
        const response = await fetch(namesUrl(families));
        if (!response.ok) throw new Error(`Google Fonts request failed (${response.status})`);
        const css = aliasFamilies(await response.text());
        const style = document.createElement('style');
        style.dataset.twokitNames = '';
        style.textContent = css;
        document.head.appendChild(style);
        for (const family of families) named.set(family, 'ready');
    } catch (error) {
        // Offline or blocked: rows keep the fallback font; a later visit retries.
        for (const family of families) named.delete(family);
        console.warn('[TwoKit] Font names failed to load', error);
    }
}

function flushNames() {
    nameTimer = 0;
    const queue = nameQueue;
    nameQueue = [];
    for (let i = 0; i < queue.length; i += NAME_BATCH) loadNames(queue.slice(i, i + NAME_BATCH));
}

/** Resolves once a stylesheet <link> has loaded (true) or failed (false). */
const linkReady = (link) => new Promise((resolve) => {
    if (link.sheet) return resolve(true);
    link.addEventListener('load', () => resolve(true), { once: true });
    link.addEventListener('error', () => resolve(false), { once: true });
});

function ensureLink(id, href) {
    let link = links.get(id);
    if (!link) {
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.dataset.twokitFont = id;
        document.head.appendChild(link);
        links.set(id, link);
    }
    if (link.href !== href) link.href = href;
}

async function loadFace(font, face) {
    if (loaded.has(face.fileId)) return false;
    const bytes = await FontStore.get(face.fileId);
    if (!bytes) {
        console.warn(`[TwoKit] Missing font file for ${font.family} ${face.key}`);
        return false;
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: `font/${face.format || 'woff2'}` }));
    const fontFace = new FontFace(font.family, bytes, { weight: faceWeight(face), style: face.style, display: 'swap' });
    loaded.set(face.fileId, { url, face: fontFace });
    document.fonts.add(fontFace);
    fontFace.load().catch((error) => console.warn(`[TwoKit] ${font.family} ${face.key} failed to load`, error));
    return true;
}

function unload(fileId) {
    const entry = loaded.get(fileId);
    if (!entry) return;
    document.fonts.delete(entry.face);
    URL.revokeObjectURL(entry.url);
    loaded.delete(fileId);
}

const FontLoader = {
    /** Bumps when local files finish loading, so the example iframe rebuilds with them. */
    version: 0,

    /** Bring loaded fonts in line with AppState.fonts. Resolves true when new local files were added. */
    async sync() {
        const fonts = AppState.fonts;
        const liveIds = new Set(fonts.map((f) => f.id));
        for (const [id, link] of links) {
            if (!liveIds.has(id) || fonts.find((f) => f.id === id)?.source !== 'google') {
                link.remove();
                links.delete(id);
            }
        }
        const liveFiles = new Set(fonts.flatMap((f) => f.faces.map((face) => face.fileId).filter(Boolean)));
        for (const fileId of [...loaded.keys()]) if (!liveFiles.has(fileId)) unload(fileId);

        const jobs = [];
        for (const font of fonts) {
            if (font.source === 'google' && font.faces.length) ensureLink(font.id, cssUrl(font.family, font.faces.map((f) => f.key)));
            if (font.source === 'local') for (const face of font.faces) jobs.push(loadFace(font, face));
        }
        const results = await Promise.all(jobs);
        const added = results.some(Boolean);
        if (added) this.version++;
        return added;
    },

    /**
     * Load just enough of a catalog font to draw its name (as nameFamily()).
     * Rows that scroll in together share one request.
     */
    preview(family) {
        if (named.has(family)) return;
        named.set(family, 'loading');
        nameQueue.push(family);
        nameTimer ||= setTimeout(flushNames, 60);
    },

    /**
     * Load every style of one catalog family so its specimen renders before
     * it's added. Straight from the Google Fonts CDN, nothing is downloaded
     * into the project; only the latest pick stays linked. Resolves true once
     * the regular style is ready to draw.
     */
    previewFull(family, keys) {
        const href = cssUrl(family, keys);
        if (fullPreview?.href === href && !fullPreview.failed) return fullPreview.ready;
        fullPreview?.link.remove();
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.dataset.twokitPreviewFull = family;
        document.head.appendChild(link);
        const ready = linkReady(link).then(async (ok) => {
            if (!ok) return false;
            // The browser only fetches a face once text uses it, so ask for the specimen's glyphs now.
            const faces = await document.fonts.load(`400 1em ${quoteFamily(family)}`, 'Aa Bb Cc 0123 The quick brown fox').catch(() => []);
            return faces.length > 0;
        }).then((ok) => {
            if (!ok && fullPreview?.link === link) fullPreview.failed = true; // the next pick retries
            return ok;
        });
        fullPreview = { family, href, link, ready, failed: false };
        return ready;
    },

    /** Register bytes that aren't in the library yet (upload queue). */
    previewBytes(key, family, bytes, face) {
        if (queued.has(key)) return;
        const fontFace = new FontFace(family, bytes, { weight: faceWeight(face), style: face.style });
        queued.set(key, fontFace);
        document.fonts.add(fontFace);
        fontFace.load().catch((error) => console.warn('[TwoKit] Preview font failed to load', error));
    },

    dropPreview(key) {
        const fontFace = queued.get(key);
        if (!fontFace) return;
        document.fonts.delete(fontFace);
        queued.delete(key);
    },

    /** <link>/<style> markup for the example iframe. */
    headHtml() {
        const parts = [];
        for (const font of AppState.fonts) {
            if (font.source === 'google' && font.faces.length) {
                parts.push(`<link rel="stylesheet" href="${cssUrl(font.family, font.faces.map((f) => f.key))}">`);
            }
        }
        const faces = AppState.fonts.filter((f) => f.source === 'local').flatMap((font) => font.faces.map((face) => {
            const entry = loaded.get(face.fileId);
            if (!entry?.url) return '';
            return `@font-face{font-family:${quoteFamily(font.family)};src:url(${entry.url}) format("${face.format || 'woff2'}");font-weight:${faceWeight(face)};font-style:${face.style};font-display:${font.display || 'swap'}}`;
        })).join('');
        if (parts.length) parts.unshift('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
        if (faces) parts.push(`<style>${faces}</style>`);
        return parts.join('\n');
    }
};

export default FontLoader;
