/**
 * Where the app runs: the web app (default), the WordPress plugin or the
 * Figma plugin. A host page sets `window.TWOKIT_HOST` before the bundle:
 *
 *   name        'wordpress' | 'figma'
 *   storage     { getItem, setItem, removeItem } (sync; the host persists it)
 *   assetBase   URL of the shipped `assets/` folder (bundles have no import.meta)
 *   assets      { 'img/export/figma.svg': 'data:…' } files embedded as data URLs
 *   inline      { 'js/data/google-fonts.json': {...} } files embedded in the page
 *   hide        features this host leaves out ('example', 'font-upload', …)
 *   defer       true: the host calls window.TwoKitStart() when its data is ready
 *
 * The web app never sets it, so nothing changes there.
 *
 * @module platform
 */

const host = globalThis.TWOKIT_HOST || {};

const local = {
    getItem(key) { try { return localStorage.getItem(key); } catch { return null; } },
    setItem(key, value) { localStorage.setItem(key, value); },
    removeItem(key) { try { localStorage.removeItem(key); } catch { /* blocked */ } }
};

const Platform = {
    name: host.name || 'web',
    host,
    storage: host.storage || local,

    is(name) {
        return this.name === name;
    },

    /** Absolute URL of a file under assets/ ('img/export/figma.svg'). */
    asset(path) {
        if (host.assets && path in host.assets) return host.assets[path];
        if (host.assetBase) return new URL(path, host.assetBase).href;
        return new URL(`../${path}`, import.meta.url).href;
    },

    /** A JSON file under assets/, from the page when the host embedded it. */
    async json(path) {
        if (host.inline && path in host.inline) return host.inline[path];
        const response = await fetch(this.asset(path));
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.json();
    },

    hides(feature) {
        return Array.isArray(host.hide) && host.hide.includes(feature);
    }
};

export default Platform;
