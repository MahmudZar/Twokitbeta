/**
 * TwoKit admin page: tells the app it runs in WordPress (window.TWOKIT_HOST)
 * before the app bundle loads. PHP prints the page data as a JSON block
 * (#twokit-wp-data) just above this: data, not an inline script, so the app
 * document's Content-Security-Policy can forbid inline scripts.
 *
 * The project lives in WordPress, not in this browser: it starts from the
 * saved project and is only written back by Save. Workspace preferences
 * (open screen, preview mode) stay in this browser.
 */
(function () {
    'use strict';

    var data = {};
    try {
        var block = document.getElementById('twokit-wp-data');
        data = block ? JSON.parse(block.textContent || '{}') : {};
    } catch (e) {
        data = {};
    }
    window.TWOKIT_WP = data;
    var PROJECT = 'twokit-project-autosave';
    var META = 'twokit-project-meta';
    var memory = {};
    var reset = false;

    try {
        reset = sessionStorage.getItem('twokit-reset') === '1';
        sessionStorage.removeItem('twokit-reset');
    } catch (e) { /* storage blocked */ }

    if (data.project && !reset) memory[PROJECT] = data.project;

    var owned = function (key) { return key === PROJECT || key === META; };

    window.TWOKIT_HOST = {
        name: 'wordpress',
        assetBase: data.assetBase,
        hide: ['example', 'figma-plugin'],
        wp: data,
        storage: {
            getItem: function (key) {
                if (owned(key)) return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
                try { return localStorage.getItem('twokit-wp:' + key); } catch (e) { return null; }
            },
            setItem: function (key, value) {
                if (owned(key)) { memory[key] = String(value); return; }
                try { localStorage.setItem('twokit-wp:' + key, value); } catch (e) { /* quota */ }
            },
            removeItem: function (key) {
                delete memory[key];
                // Project → Reset reloads the page: start from defaults, not the saved project.
                if (key === PROJECT) {
                    try { sessionStorage.setItem('twokit-reset', '1'); } catch (e) { /* blocked */ }
                }
                try { localStorage.removeItem('twokit-wp:' + key); } catch (e) { /* blocked */ }
            }
        }
    };
}());
