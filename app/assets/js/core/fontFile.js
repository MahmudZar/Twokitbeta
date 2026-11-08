/**
 * Font binaries: format sniffing, metadata (family / weight / style) and
 * WOFF 1.0 encode/decode. WOFF2 needs Brotli and Google's table transforms,
 * so that part runs in a worker (core/fontConverter.js).
 *
 * WOFF 1.0 is zlib per table, which the browser's Compression Streams do
 * natively ('deflate' = zlib framing).
 *
 * @module fontFile
 */

export class FontFileError extends Error {}

const MAGIC = {
    0x00010000: 'ttf',
    0x74727565: 'ttf', // 'true' (old Apple TrueType)
    0x4f54544f: 'otf', // 'OTTO' (CFF outlines)
    0x774f4646: 'woff', // 'wOFF'
    0x774f4632: 'woff2', // 'wOF2'
    0x74746366: 'ttc' // 'ttcf'
};

export const FORMAT_LABEL = { ttf: 'TTF', otf: 'OTF', woff: 'WOFF', woff2: 'WOFF2', ttc: 'TTC' };

/** 'ttf' | 'otf' | 'woff' | 'woff2' | 'ttc' | null */
export function detectFormat(bytes) {
    if (!bytes || bytes.length < 12) return null;
    const tag = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0);
    return MAGIC[tag] || null;
}

const tagOf = (view, at) => String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));

/** Table directory of an sfnt (TTF/OTF): { tag: { offset, length } }. */
function sfntTables(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = view.getUint16(4);
    const tables = {};
    for (let i = 0; i < count; i++) {
        const at = 12 + i * 16;
        tables[tagOf(view, at)] = { checksum: view.getUint32(at + 4), offset: view.getUint32(at + 8), length: view.getUint32(at + 12) };
    }
    return { view, tables };
}

function decodeName(bytes, platform) {
    if (platform === 3 || platform === 0) {
        let out = '';
        for (let i = 0; i + 1 < bytes.length; i += 2) out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
        return out;
    }
    return String.fromCharCode(...bytes); // Mac Roman, close enough for names
}

/** Best English string per name id. Windows/Unicode beat Mac, en-US beats other languages. */
function readNames(bytes, view, table) {
    if (!table) return {};
    const base = table.offset;
    const count = view.getUint16(base + 2);
    const strings = base + view.getUint16(base + 4);
    const best = {};
    for (let i = 0; i < count; i++) {
        const at = base + 6 + i * 12;
        const platform = view.getUint16(at);
        const lang = view.getUint16(at + 4);
        const id = view.getUint16(at + 6);
        const length = view.getUint16(at + 8);
        const offset = view.getUint16(at + 10);
        if (![1, 2, 4, 16, 17].includes(id)) continue;
        const score = (platform === 3 ? 4 : platform === 0 ? 3 : 1) + (lang === 0x409 || lang === 0 ? 2 : 0);
        if (best[id] && best[id].score >= score) continue;
        const raw = bytes.subarray(strings + offset, strings + offset + length);
        best[id] = { score, value: decodeName(raw, platform).replace(/\0/g, '').trim() };
    }
    return Object.fromEntries(Object.entries(best).map(([id, v]) => [id, v.value]));
}

const WEIGHT_WORDS = [
    [/thin|hairline/i, 100], [/extra.?light|ultra.?light/i, 200], [/light/i, 300],
    [/medium/i, 500], [/semi.?bold|demi.?bold/i, 600], [/extra.?bold|ultra.?bold/i, 800],
    [/black|heavy/i, 900], [/bold/i, 700]
];

/** Weight from a style name like "SemiBold Italic" (fallback when OS/2 is missing). */
export function weightFromName(name = '') {
    for (const [pattern, weight] of WEIGHT_WORDS) if (pattern.test(name)) return weight;
    return 400;
}

/**
 * Family, weight, style and variable axes from an sfnt.
 * @returns {{ family, subfamily, fullName, weight, style, variable: null | { min, max }, category }}
 */
export function readMeta(bytes) {
    const { view, tables } = sfntTables(bytes);
    const names = readNames(bytes, view, tables.name);
    const subfamily = names[17] || names[2] || 'Regular';
    let weight = weightFromName(subfamily);
    let italic = /italic|oblique/i.test(subfamily);

    const os2 = tables['OS/2'];
    if (os2 && os2.length >= 64) {
        const w = view.getUint16(os2.offset + 4);
        if (w >= 1 && w <= 1000) weight = w;
        const fsSelection = view.getUint16(os2.offset + 62);
        italic = italic || Boolean(fsSelection & 0x1) || Boolean(fsSelection & 0x200);
    } else if (tables.head) {
        italic = italic || Boolean(view.getUint16(tables.head.offset + 44) & 0x2);
    }

    // Category (drives the fallback stack): post.isFixedPitch, then PANOSE.
    let category = 'sans-serif';
    if (tables.post && view.getUint32(tables.post.offset + 12)) category = 'monospace';
    else if (os2 && os2.length >= 42) {
        const familyType = view.getUint8(os2.offset + 32);
        const serifStyle = view.getUint8(os2.offset + 33);
        if (familyType === 3) category = 'handwriting';
        else if (familyType === 4 || familyType === 5) category = 'display';
        else if (familyType === 2 && serifStyle >= 2 && serifStyle <= 10) category = 'serif';
    }

    let variable = null;
    const fvar = tables.fvar;
    if (fvar) {
        const axesAt = fvar.offset + view.getUint16(fvar.offset + 4);
        const axisCount = view.getUint16(fvar.offset + 8);
        const axisSize = view.getUint16(fvar.offset + 10);
        for (let i = 0; i < axisCount; i++) {
            const at = axesAt + i * axisSize;
            if (tagOf(view, at) !== 'wght') continue;
            variable = { min: Math.round(view.getInt32(at + 4) / 65536), max: Math.round(view.getInt32(at + 12) / 65536) };
        }
        variable ||= { min: weight, max: weight };
    }

    return {
        family: names[16] || names[1] || '',
        subfamily,
        fullName: names[4] || '',
        weight: Math.round(weight / 100) * 100 || 400,
        style: italic ? 'italic' : 'normal',
        variable,
        category
    };
}

/* ---------------- WOFF 1.0 ---------------- */

async function pipe(bytes, stream) {
    const out = await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
    return new Uint8Array(out);
}

const inflate = (bytes) => pipe(bytes, new DecompressionStream('deflate'));
const deflate = (bytes) => pipe(bytes, new CompressionStream('deflate'));
const pad4 = (n) => (n + 3) & ~3;

/** WOFF 1.0 → sfnt, so it can be read and re-encoded as WOFF2. */
export async function woffToSfnt(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const flavor = view.getUint32(4);
    const count = view.getUint16(12);
    const entries = [];
    for (let i = 0; i < count; i++) {
        const at = 44 + i * 20;
        const entry = {
            tag: tagOf(view, at),
            offset: view.getUint32(at + 4),
            compLength: view.getUint32(at + 8),
            origLength: view.getUint32(at + 12),
            checksum: view.getUint32(at + 16)
        };
        const raw = bytes.subarray(entry.offset, entry.offset + entry.compLength);
        entry.data = entry.compLength < entry.origLength ? await inflate(raw) : raw.slice();
        entries.push(entry);
    }
    return buildSfnt(flavor, entries);
}

function buildSfnt(flavor, entries) {
    entries.sort((a, b) => (a.tag < b.tag ? -1 : 1));
    const count = entries.length;
    const headerSize = 12 + count * 16;
    const total = entries.reduce((sum, e) => sum + pad4(e.data.length), headerSize);
    const out = new Uint8Array(total);
    const view = new DataView(out.buffer);
    const pow = 2 ** Math.floor(Math.log2(count));
    view.setUint32(0, flavor);
    view.setUint16(4, count);
    view.setUint16(6, pow * 16);
    view.setUint16(8, Math.log2(pow));
    view.setUint16(10, count * 16 - pow * 16);
    let offset = headerSize;
    entries.forEach((e, i) => {
        const at = 12 + i * 16;
        for (let c = 0; c < 4; c++) view.setUint8(at + c, e.tag.charCodeAt(c));
        view.setUint32(at + 4, e.checksum);
        view.setUint32(at + 8, offset);
        view.setUint32(at + 12, e.data.length);
        out.set(e.data, offset);
        offset += pad4(e.data.length);
    });
    return out;
}

/** sfnt → WOFF 1.0. Used only when the WOFF2 encoder can't run. */
export async function sfntToWoff(bytes) {
    const { view, tables } = sfntTables(bytes);
    const flavor = view.getUint32(0);
    const entries = [];
    for (const [tag, t] of Object.entries(tables).sort(([a], [b]) => (a < b ? -1 : 1))) {
        const data = bytes.subarray(t.offset, t.offset + t.length);
        const packed = await deflate(data);
        entries.push({ tag, checksum: t.checksum, origLength: t.length, data: packed.length < data.length ? packed : data });
    }
    const headerSize = 44 + entries.length * 20;
    const total = entries.reduce((sum, e) => sum + pad4(e.data.length), headerSize);
    const out = new Uint8Array(total);
    const w = new DataView(out.buffer);
    w.setUint32(0, 0x774f4646);
    w.setUint32(4, flavor);
    w.setUint32(8, total);
    w.setUint16(12, entries.length);
    w.setUint32(16, 12 + entries.length * 16 + entries.reduce((sum, e) => sum + pad4(e.origLength), 0));
    w.setUint16(20, 1); // major version
    let offset = headerSize;
    entries.forEach((e, i) => {
        const at = 44 + i * 20;
        for (let c = 0; c < 4; c++) w.setUint8(at + c, e.tag.charCodeAt(c));
        w.setUint32(at + 4, offset);
        w.setUint32(at + 8, e.data.length);
        w.setUint32(at + 12, e.origLength);
        w.setUint32(at + 16, e.checksum);
        out.set(e.data, offset);
        offset += pad4(e.data.length);
    });
    return out;
}

export function formatBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
