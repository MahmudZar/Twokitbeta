/**
 * Turns any font file into the best web format.
 *
 *   TTF / OTF / WOFF / WOFF2  →  subset to a character set (HarfBuzz)  →  WOFF2
 *   'Everything'              →  TTF / OTF / WOFF → WOFF2; WOFF2 kept as is
 *   if the encoder can't run  →  WOFF 1.0 (native zlib), still a web font
 *
 * Encoding runs in a pool of workers (one per spare CPU core, up to 4), so a
 * family of several files converts in parallel instead of one after another.
 *
 * @module fontConverter
 */

import { detectFormat, readMeta, woffToSfnt, sfntToWoff, weightFromName, FontFileError, FORMAT_LABEL } from './fontFile.js';
import { charsetOf, hasLatin } from './fontSubset.js';
import Platform from '../platform.js';

/** Encoders running at once: spare cores, at least 1, at most 4 (each holds a ~1 MB wasm). */
const POOL_SIZE = Math.max(1, Math.min(4, (globalThis.navigator?.hardwareConcurrency || 2) - 1));

const pools = { compress: [], decompress: [] };
let nextId = 0;

function spawn(mode) {
    const w = new Worker(Platform.asset(`js/core/woff2Worker.js?mode=${mode}`));
    const entry = { w, pending: new Map() };
    w.onmessage = ({ data }) => {
        const job = entry.pending.get(data.id);
        if (!job) return;
        entry.pending.delete(data.id);
        if (data.ok) job.resolve({ bytes: new Uint8Array(data.buffer), subsetSize: data.subsetSize });
        else job.reject(new Error(data.error));
    };
    w.onerror = (event) => {
        for (const job of entry.pending.values()) job.reject(new Error(event.message || 'Font worker failed'));
        entry.pending.clear();
        pools[mode] = pools[mode].filter((e) => e !== entry);
        w.terminate();
    };
    pools[mode].push(entry);
    return entry;
}

/** The least busy worker; a new one while the pool isn't full and all are busy. */
function worker(mode) {
    const pool = pools[mode];
    const max = mode === 'compress' ? POOL_SIZE : 1;
    const idle = pool.find((e) => e.pending.size === 0);
    if (idle) return idle;
    if (pool.length < max) return spawn(mode);
    return pool.reduce((a, b) => (b.pending.size < a.pending.size ? b : a));
}

function run(mode, bytes, ranges = null) {
    const { w, pending } = worker(mode);
    const id = ++nextId;
    const copy = bytes.slice();
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        w.postMessage({ id, buffer: copy.buffer, ranges }, [copy.buffer]);
    });
}

/** sfnt → WOFF2, subset to `ranges` first when given. Resolves { bytes, subsetSize }. */
export const toWoff2 = (sfnt, ranges = null) => run('compress', sfnt, ranges);
export const fromWoff2 = async (woff2) => (await run('decompress', woff2)).bytes;

/** "Geist-SemiBoldItalic.ttf" → family/weight/style guesses when a file has no readable names. */
function metaFromFileName(name) {
    const base = name.replace(/\.[^.]+$/, '');
    const [familyPart, stylePart = ''] = base.split(/[-_](?=[^-_]*$)/);
    return {
        family: familyPart.replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim() || base,
        subfamily: stylePart || 'Regular',
        fullName: base,
        weight: weightFromName(stylePart),
        style: /italic|oblique/i.test(stylePart) ? 'italic' : 'normal',
        variable: null
    };
}

/**
 * @param {File} file
 * @returns {Promise<{ meta, source: { name, format, size }, output: { bytes, format, size }, note }>}
 */
/**
 * @param {File} file
 * @param {{ charset?: string }} [options] 'latin' | 'latin-ext' | 'all' (see core/fontSubset.js)
 */
export async function prepareFontFile(file, { charset = 'all' } = {}) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const format = detectFormat(bytes);
    if (format === 'ttc') throw new FontFileError(`${file.name} is a font collection. Export the single style you need as .ttf or .otf.`);
    if (!format) throw new FontFileError(`${file.name} isn't a font file TwoKit can read.`);

    let sfnt = null;
    try {
        if (format === 'woff2') sfnt = await fromWoff2(bytes);
        else if (format === 'woff') sfnt = await woffToSfnt(bytes);
        else sfnt = bytes;
    } catch (error) {
        if (format !== 'woff2') throw new FontFileError(`${file.name} looks damaged: ${error.message}`);
    }

    let meta;
    try { meta = sfnt ? readMeta(sfnt) : metaFromFileName(file.name); } catch { meta = metaFromFileName(file.name); }
    if (!meta.family) meta = { ...metaFromFileName(file.name), variable: meta.variable };

    // Subset only fonts that have Latin letters; icon and non-Latin fonts would be emptied.
    let set = charsetOf(charset);
    let note = '';
    if (set.ranges && sfnt && !hasLatin(sfnt)) {
        set = charsetOf('all');
        note = 'No Latin letters in this font, so every character was kept';
    }
    const ranges = set.ranges && sfnt ? set.ranges : null;

    let output = bytes;
    let outFormat = format;
    let subsetSize = null;
    if (format !== 'woff2' || ranges) {
        try {
            ({ bytes: output, subsetSize } = await toWoff2(sfnt, ranges));
            outFormat = 'woff2';
        } catch (error) {
            console.warn('[TwoKit] WOFF2 encoder unavailable, using WOFF:', error);
            output = format === 'woff' ? bytes : format === 'woff2' ? bytes : await sfntToWoff(sfnt);
            outFormat = format === 'woff2' ? 'woff2' : 'woff';
            note = format === 'woff2' ? `Couldn't subset (${error.message}); kept the original` : 'WOFF2 encoder unavailable, saved as WOFF';
            set = charsetOf('all');
        }
    }

    return {
        meta,
        source: { name: file.name, format, size: bytes.length, label: FORMAT_LABEL[format] },
        output: { bytes: output, format: outFormat, size: output.length, label: FORMAT_LABEL[outFormat] },
        charset: set.value,
        subsetSize,
        note
    };
}
