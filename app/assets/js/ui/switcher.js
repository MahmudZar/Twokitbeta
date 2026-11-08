/**
 * Behaviour for every `.switcher` rendered by components.switcher().
 * Installed once on document, so re-rendered markup needs no rebinding.
 * The list is portaled to document.body so the scrolling control panel cannot clip it.
 */

function parts(root) {
    const list = root._list || root.querySelector('.switcher__list');
    return {
        trigger: root.querySelector('.switcher__trigger'),
        list,
        search: list?.querySelector('.switcher__search input') || null,
        options: [...(list || root).querySelectorAll('.switcher__option')]
    };
}

const visible = (root) => parts(root).options.filter((o) => !o.hidden);

/** Search: shows options whose label or value contains the query. */
function filter(root, query) {
    const q = query.trim().toLowerCase();
    const { list, options } = parts(root);
    let shown = 0;
    for (const o of options) {
        const hit = !q || o.textContent.toLowerCase().includes(q) || o.dataset.value.toLowerCase().includes(q);
        o.hidden = !hit;
        if (hit) shown++;
    }
    const empty = list?.querySelector('.switcher__empty');
    if (empty) empty.hidden = shown > 0;
}

/** Tallest an open list gets; longer lists scroll under their search field. */
const MAX_HEIGHT = 320;

function place(root) {
    const { trigger, list } = parts(root);
    if (!trigger || !list || list.hidden) return;
    // Fields anchor the list to their whole box, not just the ▾ button.
    const rect = (root.querySelector('[data-switcher-anchor]') || trigger).getBoundingClientRect();
    const gap = 6;
    const width = Math.max(rect.width, 180);
    list.style.position = 'fixed';
    list.style.inset = 'auto';
    list.style.inlineSize = `${width}px`;
    list.style.minInlineSize = `${width}px`;
    list.style.left = `${Math.min(rect.left, window.innerWidth - width - 8)}px`;
    list.style.zIndex = '80';

    // Capped height, anchored to the trigger: below it, or above when there's more room there.
    const height = Math.min(list.scrollHeight || 220, MAX_HEIGHT);
    const roomBelow = window.innerHeight - rect.bottom - gap - 8;
    const roomAbove = rect.top - gap - 8;
    if (roomBelow < height && roomAbove > roomBelow) {
        list.style.top = 'auto';
        list.style.bottom = `${window.innerHeight - rect.top + gap}px`;
        list.style.maxBlockSize = `${Math.max(120, Math.min(MAX_HEIGHT, roomAbove))}px`;
    } else {
        list.style.top = `${rect.bottom + gap}px`;
        list.style.bottom = 'auto';
        list.style.maxBlockSize = `${Math.max(120, Math.min(MAX_HEIGHT, roomBelow))}px`;
    }
}

function close(root, { focusTrigger = false } = {}) {
    const { trigger, list } = parts(root);
    if (!list || list.hidden) return;
    list.hidden = true;
    list.removeAttribute('style');
    const { search } = parts(root);
    if (search) {
        search.value = '';
        filter(root, '');
    }
    if (root._list) {
        root.appendChild(list);
        root._list = null;
    }
    root.classList.remove('is-open');
    trigger?.setAttribute('aria-expanded', 'false');
    trigger?.removeAttribute('aria-activedescendant');
    if (focusTrigger) trigger?.focus();
}

function closeAll(except) {
    document.querySelectorAll('.switcher.is-open').forEach((root) => {
        if (root !== except) close(root);
    });
}

function open(root, focus = 'selected') {
    closeAll(root);
    const { trigger, list, options, search } = parts(root);
    if (!list) return;
    root._list = list;
    document.body.appendChild(list);
    list.hidden = false;
    root.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    place(root);
    const selected = options.find((o) => o.getAttribute('aria-selected') === 'true') || options[0];
    const target = focus === 'last' ? options.at(-1) : focus === 'first' ? options[0] : selected;
    target?.scrollIntoView({ block: 'nearest' });
    // Long lists open with the search field focused: type to narrow, arrows to move.
    if (search) search.focus();
    else target?.focus();
}

function select(root, option) {
    const value = option.dataset.value;
    const { options } = parts(root);
    options.forEach((o) => o.setAttribute('aria-selected', String(o === option)));
    const label = option.querySelector('span')?.textContent || value;
    const shown = root.querySelector('.switcher__value');
    if (shown) shown.textContent = label;
    close(root, { focusTrigger: true });
    root.dispatchEvent(new CustomEvent('switcher:change', {
        bubbles: true,
        detail: { id: root.dataset.switcher, value }
    }));
}

function move(root, current, delta) {
    const options = visible(root);
    const index = options.indexOf(current);
    const { search } = parts(root);
    // Up from the first option goes back to the search field.
    if (search && delta < 0 && index === 0) return search.focus();
    const next = options[(index + delta + options.length) % options.length];
    next?.focus();
}

function rootOf(node) {
    const home = node.closest?.('.switcher');
    if (home) return home;
    const list = node.closest?.('.switcher__list');
    if (!list) return null;
    return [...document.querySelectorAll('.switcher.is-open')].find((root) => root._list === list) || null;
}

const Switcher = {
    init() {
        document.addEventListener('click', (event) => {
            const trigger = event.target.closest('.switcher__trigger');
            if (trigger) {
                const root = trigger.closest('.switcher');
                root.classList.contains('is-open') ? close(root) : open(root);
                return;
            }
            if (event.target.closest('.switcher__search, .switcher__empty')) return;
            const option = event.target.closest('.switcher__option');
            if (option) {
                const root = rootOf(option);
                if (root) select(root, option);
                return;
            }
            closeAll();
        });

        document.addEventListener('input', (event) => {
            if (!event.target.matches?.('.switcher__search input')) return;
            const root = rootOf(event.target);
            if (root) filter(root, event.target.value);
        });

        document.addEventListener('keydown', (event) => {
            if (event.target.matches?.('.switcher__search input')) {
                const root = rootOf(event.target);
                if (!root) return;
                const first = visible(root)[0];
                if (event.key === 'ArrowDown') { event.preventDefault(); first?.focus(); }
                else if (event.key === 'Enter') { event.preventDefault(); if (first) select(root, first); }
                else if (event.key === 'Escape') { event.preventDefault(); close(root, { focusTrigger: true }); }
                else if (event.key === 'Tab') close(root);
                return;
            }
            const trigger = event.target.closest?.('.switcher__trigger');
            if (trigger) {
                const root = trigger.closest('.switcher');
                if (['ArrowDown', 'Enter', ' '].includes(event.key)) {
                    event.preventDefault();
                    open(root);
                } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    open(root, 'last');
                }
                return;
            }
            const option = event.target.closest?.('.switcher__option');
            if (!option) return;
            const root = rootOf(option);
            if (!root) return;
            switch (event.key) {
                case 'ArrowDown': event.preventDefault(); move(root, option, 1); break;
                case 'ArrowUp': event.preventDefault(); move(root, option, -1); break;
                case 'Home': event.preventDefault(); visible(root)[0]?.focus(); break;
                case 'End': event.preventDefault(); visible(root).at(-1)?.focus(); break;
                case 'Enter':
                case ' ': event.preventDefault(); select(root, option); break;
                case 'Escape': event.preventDefault(); close(root, { focusTrigger: true }); break;
                case 'Tab': close(root); break;
                default: break;
            }
        });

        window.addEventListener('resize', () => {
            document.querySelectorAll('.switcher.is-open').forEach(place);
        });
        document.addEventListener('scroll', () => {
            document.querySelectorAll('.switcher.is-open').forEach(place);
        }, true);
    },

    closeAll
};

export default Switcher;
