/**
 * Names for the icon-only menu. When the nav is collapsed (or the window is
 * narrow enough that it shows icons only), hovering or keyboard-focusing an
 * item shows its name beside it.
 *
 *   - One tooltip element for the whole menu, positioned with `fixed`, so the
 *     sidebar's overflow never clips it (web app, WordPress iframe, Figma).
 *   - Only when the item's label is actually hidden: with labels showing,
 *     nothing appears.
 *   - Mouse: a short delay before the first one, then instant while moving
 *     down the menu. Keyboard: on :focus-visible only, not on click.
 *   - Visual only (aria-hidden): the visually hidden label stays the
 *     button's accessible name, so screen readers don't hear it twice.
 *   - Escape hides it; it can be hovered without closing (WCAG 1.4.13).
 *
 * @module ui/navTooltip
 */

const SHOW_DELAY = 350;
const HIDE_DELAY = 120;
/** Moving to the next item within this time shows its name straight away. */
const WARM_FOR = 400;
const GAP = 10;

const NavTooltip = {
    init(menu) {
        if (!menu || this.menu) return;
        this.menu = menu;
        this.tip = document.createElement('div');
        this.tip.className = 'nav-tip';
        this.tip.setAttribute('aria-hidden', 'true');
        this.tip.hidden = true;
        document.body.append(this.tip);

        menu.addEventListener('pointerover', (event) => {
            if (event.pointerType === 'touch') return;
            const item = event.target.closest('.nav__item');
            if (item) this.schedule(item);
        });
        menu.addEventListener('pointerout', (event) => {
            const item = event.target.closest('.nav__item');
            if (item && !item.contains(event.relatedTarget) && !this.tip.contains(event.relatedTarget)) this.scheduleHide();
        });
        menu.addEventListener('focusin', (event) => {
            const item = event.target.closest('.nav__item');
            if (item && item.matches(':focus-visible')) this.show(item);
        });
        menu.addEventListener('focusout', () => this.hide());
        // A click navigates (or collapses the menu): the name has done its job.
        menu.addEventListener('pointerdown', () => this.hide());
        this.tip.addEventListener('pointerenter', () => clearTimeout(this.timer));
        this.tip.addEventListener('pointerleave', () => this.scheduleHide());
        document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !this.tip.hidden) this.hide(); });
        window.addEventListener('resize', () => this.hide());
        menu.addEventListener('scroll', () => this.hide(), true);
    },

    /** The item's name, when its label isn't on screen. */
    label(item) {
        const label = item.querySelector('.nav__label');
        if (!label) return '';
        return label.getBoundingClientRect().width < 2 ? label.textContent.trim() : '';
    },

    schedule(item) {
        clearTimeout(this.timer);
        if (item === this.item && !this.tip.hidden) return;
        const warm = Date.now() - (this.lastHidden || 0) < WARM_FOR || !this.tip.hidden;
        this.timer = setTimeout(() => this.show(item), warm ? 0 : SHOW_DELAY);
    },

    scheduleHide() {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.hide(), HIDE_DELAY);
    },

    show(item) {
        clearTimeout(this.timer);
        const text = this.label(item);
        if (!text) return this.hide();
        this.item = item;
        this.tip.textContent = text;
        this.tip.hidden = false;
        const box = item.getBoundingClientRect();
        const tip = this.tip.getBoundingClientRect();
        const left = Math.min(box.right + GAP, window.innerWidth - tip.width - 4);
        const top = Math.max(4, Math.min(box.top + (box.height - tip.height) / 2, window.innerHeight - tip.height - 4));
        this.tip.style.left = `${Math.round(left)}px`;
        this.tip.style.top = `${Math.round(top)}px`;
        // Next frame, so the fade starts from the new position.
        requestAnimationFrame(() => this.tip.classList.add('is-visible'));
    },

    hide() {
        clearTimeout(this.timer);
        if (this.tip.hidden) return;
        this.tip.classList.remove('is-visible');
        this.tip.hidden = true;
        this.item = null;
        this.lastHidden = Date.now();
    }
};

export default NavTooltip;
