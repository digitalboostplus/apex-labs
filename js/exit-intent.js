/**
 * Exit Intent Detection and Popup Management
 * Detects when users are about to leave and shows recovery popup
 */
(function() {
    const STORAGE_KEY = 'apex_labs_exit_shown';
    const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
    let hasShown = false;
    let isEnabled = true;

    /**
     * Check if popup can be shown
     * @returns {boolean}
     */
    function canShowPopup() {
        if (hasShown || !isEnabled) return false;

        // Check if cart has items
        if (!window.cartManager || window.cartManager.getItemCount() === 0) {
            return false;
        }

        // Check cooldown
        const lastShown = localStorage.getItem(STORAGE_KEY);
        if (lastShown) {
            const elapsed = Date.now() - parseInt(lastShown, 10);
            if (elapsed < COOLDOWN_MS) {
                return false;
            }
        }

        return true;
    }

    /**
     * Mark popup as shown
     */
    function markAsShown() {
        hasShown = true;
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
    }

    /**
     * Show the exit intent popup
     */
    function showExitPopup() {
        if (!canShowPopup()) return;

        // Check if popup exists
        const popup = document.getElementById('exit-intent-popup');
        if (!popup) {
            // Try to load the popup component
            loadExitPopup().then(() => {
                if (window.showExitPopup) {
                    window.showExitPopup();
                }
            });
            return;
        }

        // Use the global function from the component
        if (window.showExitPopup) {
            window.showExitPopup();
        }

        markAsShown();
    }

    /**
     * Load exit popup component dynamically
     */
    async function loadExitPopup() {
        const isInSubdir = window.location.pathname.includes('/pricing/') ||
                          window.location.pathname.includes('/pages/');
        const basePath = isInSubdir ? '..' : '.';

        try {
            const response = await fetch(`${basePath}/components/exit-intent-popup.html`);
            const html = await response.text();

            // Create container if needed
            let container = document.getElementById('exit-popup-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'exit-popup-container';
                document.body.appendChild(container);
            }

            container.innerHTML = html;
        } catch (error) {
            console.error('Failed to load exit popup:', error);
        }
    }

    /**
     * Initialize exit intent detection
     */
    function init() {
        // Skip on checkout and confirmation pages
        const skipPages = ['checkout', 'order-confirmation', 'cart'];
        const currentPath = window.location.pathname.toLowerCase();
        if (skipPages.some(page => currentPath.includes(page))) {
            isEnabled = false;
            return;
        }

        // Mouse leave detection (desktop)
        document.addEventListener('mouseout', (e) => {
            // Check if mouse is leaving the viewport from the top
            if (e.clientY <= 0 && e.relatedTarget === null) {
                showExitPopup();
            }
        });

        // Visibility change detection (tab switching)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                // User is leaving the tab - could trigger popup on return
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose for manual triggering
    window.triggerExitIntent = showExitPopup;
    window.exitIntentEnabled = (enabled) => { isEnabled = enabled; };
})();
