/**
 * InventoryManager - Manage stock levels and availability indicators
 */
class InventoryManager {
    constructor() {
        this.lowStockThreshold = 30;
        this.criticalStockThreshold = 10;
    }

    /**
     * Get stock status for a product
     * @param {Object} product - Product with stockLevel
     * @returns {Object} - Status info
     */
    getStockStatus(product) {
        if (!product) return { available: false, label: 'Unavailable', class: 'bg-slate-100 text-slate-500' };

        if (!product.inStock || product.stockLevel === 0) {
            return {
                available: false,
                label: 'Out of Stock',
                class: 'bg-red-100 text-red-700',
                urgency: 'none'
            };
        }

        if (product.stockLevel <= this.criticalStockThreshold) {
            return {
                available: true,
                label: `Only ${product.stockLevel} Left`,
                class: 'bg-red-100 text-red-700',
                urgency: 'critical'
            };
        }

        if (product.stockLevel <= this.lowStockThreshold) {
            return {
                available: true,
                label: 'Low Stock',
                class: 'bg-amber-100 text-amber-700',
                urgency: 'low'
            };
        }

        return {
            available: true,
            label: 'In Stock',
            class: 'bg-green-100 text-green-700',
            urgency: 'none'
        };
    }

    /**
     * Check if product is high demand (featured + low stock)
     * @param {Object} product - Product
     * @returns {boolean}
     */
    isHighDemand(product) {
        return product.featured && product.stockLevel < 50;
    }

    /**
     * Render stock badge HTML
     * @param {Object} product - Product
     * @returns {string} - HTML string
     */
    renderStockBadge(product) {
        const status = this.getStockStatus(product);

        if (status.urgency === 'none' && status.available) {
            return ''; // Don't show badge for normal stock
        }

        return `
            <span class="px-2 py-1 text-[10px] font-bold uppercase ${status.class} rounded">
                ${status.label}
            </span>
        `;
    }

    /**
     * Render high demand badge
     * @param {Object} product - Product
     * @returns {string} - HTML string
     */
    renderHighDemandBadge(product) {
        if (!this.isHighDemand(product)) return '';

        return `
            <span class="px-2 py-1 text-[10px] font-bold uppercase bg-purple-100 text-purple-700 rounded flex items-center gap-1">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"></path>
                </svg>
                High Demand
            </span>
        `;
    }
}

// Create singleton
const inventoryManager = new InventoryManager();

// Expose globally
window.inventoryManager = inventoryManager;
window.InventoryManager = InventoryManager;
