/**
 * Theme Module
 *
 * Light/Dark theme toggle with localStorage persistence and
 * respect for system preference on first visit.
 *
 * @module theme
 */

const STORAGE_KEY = 'twokit-theme';

const Theme = {
    current: 'dark',

    init() {
        const saved = this.getSaved();
        const initial = saved || this.getSystemPreference();
        this.apply(initial, false);

        document.querySelectorAll('[data-theme-set]').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-theme-set');
                this.apply(target, true);
            });
        });

        if (window.matchMedia && !saved) {
            try {
                window.matchMedia('(prefers-color-scheme: light)')
                    .addEventListener('change', (e) => {
                        if (!this.getSaved()) {
                            this.apply(e.matches ? 'light' : 'dark', false);
                        }
                    });
            } catch (e) { /* older browsers */ }
        }
    },

    getSaved() {
        try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    },

    getSystemPreference() {
        try {
            return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        } catch (e) {
            return 'dark';
        }
    },

    apply(theme, persist = true) {
        if (theme !== 'light' && theme !== 'dark') theme = 'dark';
        this.current = theme;
        document.documentElement.setAttribute('data-theme', theme);

        document.querySelectorAll('[data-theme-set]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-theme-set') === theme);
        });

        if (persist) {
            try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
        }
    },

    toggle() {
        this.apply(this.current === 'dark' ? 'light' : 'dark', true);
    }
};

export default Theme;
