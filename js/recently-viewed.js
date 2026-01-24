/**
 * RecentlyViewedManager - Track and display recently viewed products
 */
class RecentlyViewedManager {
    constructor() {
        this.storageKey = 'apex_labs_recently_viewed';
        this.maxItems = 6;
        this.items = [];
        this._loadFromStorage();
    }

    /**
     * Track a product view
     * @param {Object} product - Product that was viewed
     */
    trackView(product) {
        if (!product || !product.id) return;

        // Remove if already exists
        this.items = this.items.filter(item => item.id !== product.id);

        // Add to beginning
        this.items.unshift({
            id: product.id,
            priceId: product.priceId,
            name: product.name,
            price: product.price,
            image: product.image,
            category: product.category,
            viewedAt: new Date().toISOString()
        });

        // Limit to max items
        if (this.items.length > this.maxItems) {
            this.items = this.items.slice(0, this.maxItems);
        }

        this._saveToStorage();
    }

    /**
     * Get recently viewed products
     * @param {number} limit - Max items to return
     * @returns {Array}
     */
    getItems(limit = this.maxItems) {
        return this.items.slice(0, limit);
    }

    /**
     * Clear recently viewed
     */
    clear() {
        this.items = [];
        this._saveToStorage();
    }

    /**
     * Load from localStorage
     */
    _loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.items = JSON.parse(stored);
            }
        } catch (error) {
            console.error('RecentlyViewedManager: Failed to load', error);
            this.items = [];
        }
    }

    /**
     * Save to localStorage
     */
    _saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.items));
        } catch (error) {
            console.error('RecentlyViewedManager: Failed to save', error);
        }
    }

    /**
     * Render recently viewed section
     * @param {string} containerId - Container element ID
     * @param {Object} options - Render options
     */
    render(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const items = this.getItems(options.limit || 4);

        if (items.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';

        const isInSubdir = window.location.pathname.includes('/pricing/') ||
                          window.location.pathname.includes('/pages/');
        const basePath = isInSubdir ? '..' : '.';

        container.innerHTML = `
            <div class="py-12 bg-slate-50 rounded-xl">
                <div class="max-w-6xl mx-auto px-6">
                    <h3 class="text-lg font-bold text-slate-900 mb-6">Recently Viewed</h3>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        ${items.map(item => `
                            <a href="${basePath}/pricing/${item.id}.html" class="bg-white rounded-xl p-4 border border-slate-100 hover:border-amber-200 hover:shadow-md transition-all group">
                                <div class="aspect-square bg-slate-50 rounded-lg p-4 mb-3">
                                    <img src="${item.image || basePath + '/assets/placeholder.png'}" alt="${item.name}" class="w-full h-full object-contain">
                                </div>
                                <p class="text-xs text-amber-600 font-medium">${item.category || 'Peptide'}</p>
                                <h4 class="font-bold text-slate-900 group-hover:text-amber-600 transition-colors">${item.name}</h4>
                                <p class="text-slate-900 font-bold">$${(item.price || 0).toFixed(2)}</p>
                            </a>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
}

// Create singleton
const recentlyViewedManager = new RecentlyViewedManager();

// Expose globally
window.recentlyViewedManager = recentlyViewedManager;
window.RecentlyViewedManager = RecentlyViewedManager;
