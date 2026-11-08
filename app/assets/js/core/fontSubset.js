/**
 * Character sets for uploaded fonts. Subsetting keeps only the characters a
 * site needs before WOFF2 encoding, which is what makes large desktop fonts
 * web-sized (and fast to convert): e.g. a 2.2 MB OTF with thousands of
 * symbols becomes a ~40 KB Latin WOFF2. Every OpenType feature and name
 * is kept for the characters that remain. Ranges follow Google Fonts' own
 * subsets, so uploads match what Google serves.
 *
 * @module fontSubset
 */

/** [start, end] code point ranges (inclusive). */
const LATIN = [
    [0x0000, 0x00FF], [0x0131, 0x0131], [0x0152, 0x0153], [0x02BB, 0x02BC], [0x02C6, 0x02C6],
    [0x02DA, 0x02DA], [0x02DC, 0x02DC], [0x0304, 0x0304], [0x0308, 0x0308], [0x0329, 0x0329],
    [0x2000, 0x206F], [0x20AC, 0x20AC], [0x2122, 0x2122], [0x2191, 0x2191], [0x2193, 0x2193],
    [0x2212, 0x2212], [0x2215, 0x2215], [0xFEFF, 0xFEFF], [0xFFFD, 0xFFFD]
];

/** Google's latin-ext + vietnamese: Central/Eastern European, Turkish, Baltic, Vietnamese … */
const LATIN_EXT = [
    ...LATIN,
    [0x0100, 0x02BA], [0x02BD, 0x02C5], [0x02C7, 0x02CC], [0x02CE, 0x02D7], [0x02DD, 0x02FF],
    [0x0300, 0x0301], [0x0303, 0x0304], [0x0308, 0x0309], [0x0323, 0x0323], [0x0329, 0x0329],
    [0x1D00, 0x1DBF], [0x1E00, 0x1EFF], [0x2020, 0x2020], [0x20A0, 0x20C0], [0x2113, 0x2113],
    [0x2C60, 0x2C7F], [0xA720, 0xA7FF]
];

export const CHARSETS = [
    { value: 'latin', label: 'Latin', detail: 'English and Western European', ranges: LATIN },
    { value: 'latin-ext', label: 'Latin Extended', detail: 'adds Polish, Czech, Turkish, Vietnamese …', ranges: LATIN_EXT },
    { value: 'all', label: 'Everything', detail: 'every character in the file', ranges: null }
];

export const DEFAULT_CHARSET = 'latin';

export const charsetOf = (value) => CHARSETS.find((c) => c.value === value) || CHARSETS[0];

/**
 * Code points a font maps (cmap formats 4 and 12), as a test function.
 * Used to skip subsetting fonts that have no Latin letters at all (icon or
 * non-Latin fonts), which would otherwise be emptied.
 */
export function mappedTester(sfnt) {
    const view = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength);
    const count = view.getUint16(4);
    let cmap = null;
    for (let i = 0; i < count; i++) {
        const at = 12 + i * 16;
        if (String.fromCharCode(...sfnt.subarray(at, at + 4)) === 'cmap') cmap = view.getUint32(at + 8);
    }
    if (cmap === null) return () => false;
    const ranges = [];
    const tables = view.getUint16(cmap + 2);
    for (let i = 0; i < tables; i++) {
        const sub = cmap + view.getUint32(cmap + 4 + i * 8 + 4);
        const format = view.getUint16(sub);
        if (format === 4) {
            const segs = view.getUint16(sub + 6) / 2;
            const ends = sub + 14;
            const starts = ends + segs * 2 + 2;
            for (let s = 0; s < segs; s++) ranges.push([view.getUint16(starts + s * 2), view.getUint16(ends + s * 2)]);
        } else if (format === 12) {
            const groups = view.getUint32(sub + 12);
            for (let g = 0; g < groups; g++) ranges.push([view.getUint32(sub + 16 + g * 12), view.getUint32(sub + 20 + g * 12)]);
        }
    }
    return (cp) => ranges.some(([a, b]) => cp >= a && cp <= b);
}

/** True when the font has the basic Latin letters (A–Z, a–z), so a Latin subset keeps real text. */
export function hasLatin(sfnt) {
    try {
        const maps = mappedTester(sfnt);
        let found = 0;
        for (let cp = 0x41; cp <= 0x7A; cp++) if ((cp <= 0x5A || cp >= 0x61) && maps(cp)) found++;
        return found >= 40; // nearly all 52 letters
    } catch {
        return true; // unreadable cmap: let the subsetter decide
    }
}
