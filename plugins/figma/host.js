/**
 * TwoKit Figma plugin UI: tells the app it runs in Figma (window.TWOKIT_HOST),
 * loads the project from the plugin (code.js) and then starts the app.
 * The build puts this, the stylesheet and the app bundle into one ui.html,
 * with window.TWOKIT_FIGMA_FILES (embedded catalog and images) above it.
 */
(function () {
    'use strict';

    var files = window.TWOKIT_FIGMA_FILES || { inline: {}, assets: {} };
    var memory = {};
    var handlers = {};
    var timers = {};
    var started = false;

    function send(type, extra) {
        var message = { type: type };
        for (var key in extra || {}) message[key] = extra[key];
        parent.postMessage({ pluginMessage: message }, '*');
    }

    // Autosave runs on every change; write each key at most every 400 ms.
    function persist(key) {
        clearTimeout(timers[key]);
        timers[key] = setTimeout(function () {
            send('storage-set', { key: key, value: Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null });
        }, 400);
    }

    function start() {
        if (started) return;
        started = true;
        if (typeof window.TwoKitStart === 'function') window.TwoKitStart();
    }

    window.onmessage = function (event) {
        var message = event.data && event.data.pluginMessage;
        if (!message || !message.type) return;
        if (message.type === 'storage') {
            var data = message.data || {};
            memory = data.store || {};
            window.TWOKIT_HOST.figma.applied = data.applied || '';
            start();
            return;
        }
        (handlers[message.type] || []).forEach(function (fn) { fn(message.data); });
    };

    window.TWOKIT_HOST = {
        name: 'figma',
        defer: true,
        hide: ['example', 'font-upload', 'figma-plugin'],
        inline: files.inline,
        assets: files.assets,
        assetBase: 'https://twokit.invalid/assets/',
        storage: {
            getItem: function (key) { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; },
            setItem: function (key, value) { memory[key] = String(value); persist(key); },
            // Right away: Project → Reset reloads the window next.
            removeItem: function (key) { delete memory[key]; clearTimeout(timers[key]); send('storage-set', { key: key, value: null }); }
        },
        figma: {
            send: send,
            on: function (type, fn) { (handlers[type] = handlers[type] || []).push(fn); }
        }
    };

    send('storage-load');
}());
