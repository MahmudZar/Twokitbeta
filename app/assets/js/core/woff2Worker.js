/*
 * Classic worker around one wawoff2 binding (Google's woff2 in WebAssembly).
 * Both bindings declare a global `Module`, so compress and decompress each get
 * their own worker: woff2Worker.js?mode=compress | ?mode=decompress.
 *
 * Compress jobs may carry `ranges` ([start, end] code points): the font is
 * first subset with HarfBuzz (hb-subset, vendor/harfbuzz), keeping every
 * OpenType feature and name, and only the subset is WOFF2-encoded. Subsetting
 * takes milliseconds; encoding time grows with size, so this is also what
 * makes large desktop fonts convert fast.
 */
/* global importScripts, Module */

const mode = new URL(self.location.href).searchParams.get('mode') === 'decompress' ? 'decompress' : 'compress';

let markReady;
const ready = new Promise((resolve) => { markReady = resolve; });
self.Module = { onRuntimeInitialized: () => markReady() };
importScripts(`../../vendor/wawoff2/${mode}_binding.js`);

/* ---------------- HarfBuzz subset (loaded on first use) ---------------- */

let harfbuzz = null;

function loadHarfBuzz() {
    harfbuzz ||= fetch('../../vendor/harfbuzz/harfbuzz-subset.wasm')
        .then((response) => {
            if (!response.ok) throw new Error(`HarfBuzz subsetter missing (${response.status})`);
            return response.arrayBuffer();
        })
        .then((bytes) => WebAssembly.instantiate(bytes, {}))
        .then(({ instance }) => {
            instance.exports._initialize?.(); // standalone wasm: run its constructors once
            return instance.exports;
        });
    return harfbuzz;
}

const SETS = { NAME_ID: 4, LAYOUT_FEATURE_TAG: 6 }; // hb_subset_sets_t

async function subset(bytes, ranges) {
    const hb = await loadHarfBuzz();
    const ptr = hb.malloc(bytes.length);
    new Uint8Array(hb.memory.buffer).set(bytes, ptr);
    const blob = hb.hb_blob_create(ptr, bytes.length, 2 /* writable */, 0, 0);
    const face = hb.hb_face_create(blob, 0);
    hb.hb_blob_destroy(blob);
    const input = hb.hb_subset_input_create_or_fail();
    try {
        if (!input) throw new Error('HarfBuzz could not start a subset');
        const unicodes = hb.hb_subset_input_unicode_set(input);
        for (const [a, b] of ranges) for (let cp = a; cp <= b; cp++) hb.hb_set_add(unicodes, cp);
        // Keep every name and every layout feature (stylistic sets, tabular figures …).
        for (const which of [SETS.NAME_ID, SETS.LAYOUT_FEATURE_TAG]) {
            const set = hb.hb_subset_input_set(input, which);
            hb.hb_set_clear(set);
            hb.hb_set_invert(set);
        }
        const result = hb.hb_subset_or_fail(face, input);
        if (!result) throw new Error('HarfBuzz could not subset this font');
        const out = hb.hb_face_reference_blob(result);
        const data = hb.hb_blob_get_data(out, 0);
        const length = hb.hb_blob_get_length(out);
        const copy = new Uint8Array(hb.memory.buffer, data, length).slice();
        hb.hb_blob_destroy(out);
        hb.hb_face_destroy(result);
        return copy;
    } finally {
        if (input) hb.hb_subset_input_destroy(input);
        hb.hb_face_destroy(face);
        hb.free(ptr);
    }
}

self.onmessage = async ({ data }) => {
    const { id, buffer, ranges } = data;
    try {
        await ready;
        let bytes = new Uint8Array(buffer);
        let subsetSize = null;
        if (mode === 'compress' && ranges) {
            bytes = await subset(bytes, ranges);
            subsetSize = bytes.length;
        }
        const result = Module[mode](bytes);
        if (result === false || !result) throw new Error(mode === 'compress' ? 'WOFF2 encoder rejected this font' : 'Not a valid WOFF2 file');
        const copy = new Uint8Array(result); // off the wasm heap before transfer
        self.postMessage({ id, ok: true, buffer: copy.buffer, subsetSize }, [copy.buffer]);
    } catch (error) {
        self.postMessage({ id, ok: false, error: String(error?.message || error) });
    }
};
