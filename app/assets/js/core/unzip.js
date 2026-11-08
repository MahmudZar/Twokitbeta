/**
 * Reads a zip (stored or deflated) in the browser, for TwoKit project files.
 *
 * Built for untrusted input: hard limits on entries, on each file and on the
 * total size, enforced while inflating (a zip bomb stops at the limit, its
 * declared sizes are not trusted), no encrypted entries, and names with
 * "..", absolute paths or backslashes are skipped. `accept(name)` picks which
 * entries are read at all.
 *
 * @module unzip
 */

const LIMITS = { entries: 400, file: 25 * 1024 * 1024, total: 80 * 1024 * 1024 };

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** True for bytes that start like a zip. */
export function isZip(bytes) {
    return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** Inflates raw deflate data, stopping once `max` bytes come out. */
async function inflate(data, max) {
    if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot open compressed zips');
    const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > max) {
            await reader.cancel();
            throw new Error('A file in the zip is too large');
        }
        chunks.push(value);
    }
    const out = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) { out.set(c, at); at += c.length; }
    return out;
}

/**
 * @param {Uint8Array} bytes zip file
 * @param {(name: string) => boolean} accept which entries to read
 * @returns {Promise<Map<string, Uint8Array>>} name → bytes
 */
export async function readZip(bytes, accept = () => true) {
    // End of central directory: the last 22 bytes, or up to 64 KB earlier when there's a comment.
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
        if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a zip file');
    const count = u16(bytes, eocd + 10);
    let at = u32(bytes, eocd + 16);
    if (count > LIMITS.entries) throw new Error('The zip has too many files');

    const decoder = new TextDecoder();
    const files = new Map();
    let total = 0;
    for (let n = 0; n < count; n++) {
        if (at + 46 > bytes.length || u32(bytes, at) !== 0x02014b50) throw new Error('The zip is damaged');
        const flags = u16(bytes, at + 8);
        const method = u16(bytes, at + 10);
        const size = u32(bytes, at + 20);
        const nameLen = u16(bytes, at + 28);
        const next = at + 46 + nameLen + u16(bytes, at + 30) + u16(bytes, at + 32);
        const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLen));
        const local = u32(bytes, at + 42);
        at = next;

        const unsafe = !name || name.endsWith('/') || name.includes('\\') || name.startsWith('/') || name.split('/').includes('..');
        if (unsafe || !accept(name)) continue;
        if (flags & 1) throw new Error('Encrypted zips are not supported');
        if (local + 30 > bytes.length || u32(bytes, local) !== 0x04034b50) throw new Error('The zip is damaged');
        const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
        const end = start + size;
        if (end > bytes.length) throw new Error('The zip is damaged');

        const room = Math.min(LIMITS.file, LIMITS.total - total);
        let data;
        if (method === 0) {
            if (size > room) throw new Error('The zip is too large');
            data = bytes.slice(start, end);
        } else if (method === 8) {
            data = await inflate(bytes.subarray(start, end), room);
        } else {
            throw new Error('The zip uses an unsupported compression');
        }
        total += data.length;
        files.set(name, data);
    }
    return files;
}
