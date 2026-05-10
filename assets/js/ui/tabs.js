/**
 * Tabs Module
 * 
 * Tab navigation handling
 * 
 * @module tabs
 */

const Tabs = {
    /**
     * Initialize tab navigation
     */
    init() {
        const navTabs = document.querySelectorAll('.nav-tab');
        const panels = document.querySelectorAll('.tab-panel');

        navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;

                // Update active states
                navTabs.forEach(t => t.classList.remove('active'));
                panels.forEach(p => p.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById(`${targetTab}-panel`).classList.add('active');
            });
        });
    },

    /**
     * Switch to specific tab programmatically
     */
    switchTo(tabName) {
        const tab = document.querySelector(`[data-tab="${tabName}"]`);
        if (tab) {
            tab.click();
        }
    }
};

export default Tabs;
