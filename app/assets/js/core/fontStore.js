/**
 * Font binaries live in IndexedDB, not in AppState: autosave writes AppState
 * to localStorage, which would hit its ~5 MB quota after a few fonts.
 * AppState keeps only metadata and a `fileId` per face.
 *
 * @module fontStore
 */

const DB_NAME = 'twokit-fonts';
const STORE = 'files';

let dbPromise = null;

function open() {
    dbPromise ||= new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return dbPromise;
}

async function tx(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const result = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(result?.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
    });
}

const FontStore = {
    /** @param {Uint8Array} bytes */
    put(id, bytes) {
        return tx('readwrite', (store) => store.put(bytes.slice().buffer, id));
    },

    /** @returns {Promise<Uint8Array | null>} */
    async get(id) {
        const buffer = await tx('readonly', (store) => store.get(id));
        return buffer ? new Uint8Array(buffer) : null;
    },

    remove(id) {
        return tx('readwrite', (store) => store.delete(id));
    },

    keys() {
        return tx('readonly', (store) => store.getAllKeys());
    },

    /** Deletes files no library face points at (uploads that never got saved). */
    async prune(liveIds) {
        const live = new Set(liveIds);
        const stale = (await this.keys()).filter((key) => !live.has(key));
        await Promise.all(stale.map((key) => this.remove(key)));
        return stale.length;
    }
};

export default FontStore;

/** Base64 helpers for embedding fonts in .twokit project files. */
export function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return btoa(binary);
}

export function base64ToBytes(text) {
    const binary = atob(text);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}
