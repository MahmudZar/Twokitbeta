const Notifications = {
    toast: null,
    message: null,
    timeout: null,

    init() {
        this.toast = document.getElementById('toast');
        this.message = this.toast?.querySelector('.toast__message');
    },

    show(message, type = 'success', duration = 2600) {
        if (!this.toast) this.init();
        if (!this.toast) return;
        if (this.timeout) clearTimeout(this.timeout);
        if (this.message) this.message.textContent = message;
        this.toast.className = `toast ${type} show`;
        this.toast.hidden = false;
        this.timeout = setTimeout(() => this.hide(), duration);
    },

    hide() {
        if (!this.toast) return;
        this.toast.classList.remove('show');
    },

    success(message) { this.show(message, 'success'); },
    error(message) { this.show(message, 'error', 4000); },
    info(message) { this.show(message, 'info'); }
};

export default Notifications;
