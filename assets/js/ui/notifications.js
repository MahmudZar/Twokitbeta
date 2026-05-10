/**
 * Notifications Module — Toast notifications
 *
 * The toast DOM is:
 *   <div id="toast" class="toast">
 *     <span class="toast-icon"><svg class="icon icon-sm"><use href="#i-check"/></svg></span>
 *     <span class="toast-message">…</span>
 *   </div>
 *
 * @module notifications
 */

const ICONS = {
    success: 'i-check',
    error:   'i-alert',
    info:    'i-info'
};

const Notifications = {
    toast: null,
    message: null,
    iconUse: null,
    timeout: null,

    init() {
        this.toast = document.getElementById('toast');
        if (!this.toast) return;
        this.message = this.toast.querySelector('.toast-message');
        this.iconUse = this.toast.querySelector('.toast-icon use');
    },

    show(message, type = 'success', duration = 2600) {
        if (!this.toast) this.init();
        if (!this.toast) return;

        if (this.timeout) clearTimeout(this.timeout);

        if (this.iconUse) {
            this.iconUse.setAttribute('href', `#${ICONS[type] || ICONS.success}`);
        }
        if (this.message) {
            this.message.textContent = message;
        } else {
            this.toast.textContent = message;
        }

        this.toast.className = `toast ${type} show`;

        this.timeout = setTimeout(() => this.hide(), duration);
    },

    hide() {
        if (this.toast) this.toast.classList.remove('show');
    },

    success(message) { this.show(message, 'success'); },
    error(message)   { this.show(message, 'error', 4000); },
    info(message)    { this.show(message, 'info'); }
};

export default Notifications;
