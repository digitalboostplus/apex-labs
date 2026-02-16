/**
 * ProductManager - Centralized product data management
 * Loads product catalog from JSON and provides query methods
 */
class ProductManager {
    constructor() {
        this.products = [];
        this.categories = [];
        this.pricingTiers = [];
        this.loaded = false;
        this.loadPromise = null;
        this.subscribers = [];
    }

    /**
     * Load product data from JSON file
     * @returns {Promise<void>}
     */
    async load() {
        if (this.loaded) return;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            try {
                // Detect path context for proper asset resolution
                const isInSubdir = window.location.pathname.includes('/pricing/') ||
                    window.location.pathname.includes('/pages/');
                const basePath = isInSubdir ? '..' : '.';

                const response = await fetch(`${basePath}/data/products.json`);
                if (!response.ok) {
                    throw new Error(`Failed to load products: ${response.status}`);
                }

                const data = await response.json();
                this.products = data.products || [];
                this.categories = data.categories || [];
                this.pricingTiers = data.pricingTiers || [];
                this.loaded = true;

                this._notifySubscribers('loaded', this.products);
            } catch (error) {
                console.error('ProductManager: Failed to load products', error);
                throw error;
            }
        })();

        return this.loadPromise;
    }

    /**
     * Get all products
     * @returns {Array}
     */
    getAll() {
        return [...this.products];
    }

    /**
     * Get product by ID
     * @param {string} id - Product ID
     * @returns {Object|null}
     */
    getById(id) {
        return this.products.find(p => p.id === id) || null;
    }

    /**
     * Get product by SKU identifier
     * @param {string} sku - Product SKU
     * @returns {Object|null}
     */
    getBySku(sku) {
        return this.products.find(p => p.sku === sku) || null;
    }

    /**
     * Get products by category
     * @param {string} category - Category name
     * @returns {Array}
     */
    getByCategory(category) {
        return this.products.filter(p =>
            p.category.toLowerCase() === category.toLowerCase()
        );
    }

    /**
     * Get products by tag
     * @param {string} tag - Tag name
     * @returns {Array}
     */
    getByTag(tag) {
        return this.products.filter(p =>
            p.tags && p.tags.includes(tag.toLowerCase())
        );
    }

    /**
     * Get featured products
     * @returns {Array}
     */
    getFeatured() {
        return this.products.filter(p => p.featured);
    }

    /**
     * Get products in stock
     * @returns {Array}
     */
    getInStock() {
        return this.products.filter(p => p.inStock);
    }

    /**
     * Get products with low stock (less than threshold)
     * @param {number} threshold - Stock level threshold
     * @returns {Array}
     */
    getLowStock(threshold = 30) {
        return this.products.filter(p => p.stockLevel && p.stockLevel < threshold);
    }

    /**
     * Sort products by field
     * @param {string} field - Field to sort by (name, price, stockLevel)
     * @param {string} direction - Sort direction (asc, desc)
     * @returns {Array}
     */
    sort(field = 'name', direction = 'asc') {
        const sorted = [...this.products].sort((a, b) => {
            let valA = a[field];
            let valB = b[field];

            // Handle string comparison
            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    }

    /**
     * Filter products by multiple criteria
     * @param {Object} filters - Filter criteria
     * @returns {Array}
     */
    filter(filters = {}) {
        let results = [...this.products];

        if (filters.category) {
            results = results.filter(p =>
                p.category.toLowerCase() === filters.category.toLowerCase()
            );
        }

        if (filters.tags && filters.tags.length > 0) {
            results = results.filter(p =>
                p.tags && filters.tags.some(tag => p.tags.includes(tag))
            );
        }

        if (filters.minPrice !== undefined) {
            results = results.filter(p => p.price >= filters.minPrice);
        }

        if (filters.maxPrice !== undefined) {
            results = results.filter(p => p.price <= filters.maxPrice);
        }

        if (filters.inStock !== undefined) {
            results = results.filter(p => p.inStock === filters.inStock);
        }

        if (filters.featured !== undefined) {
            results = results.filter(p => p.featured === filters.featured);
        }

        return results;
    }

    /**
     * Get all unique categories from products
     * @returns {Array}
     */
    getUniqueCategories() {
        const categories = new Set(this.products.map(p => p.category));
        return Array.from(categories).sort();
    }

    /**
     * Get all unique tags from products
     * @returns {Array}
     */
    getUniqueTags() {
        const tags = new Set();
        this.products.forEach(p => {
            if (p.tags) {
                p.tags.forEach(tag => tags.add(tag));
            }
        });
        return Array.from(tags).sort();
    }

    /**
     * Get price for a product based on quantity (standard vs wholesale)
     * @param {string} productId - Product ID
     * @param {number} quantity - Quantity
     * @returns {number}
     */
    getPrice(productId, quantity = 1) {
        const product = this.getById(productId);
        if (!product) return 0;

        if (quantity >= product.wholesaleMinQty && product.wholesalePrice) {
            return product.wholesalePrice;
        }
        return product.price;
    }

    /**
     * Calculate total for cart items with tiered pricing
     * @param {Array} items - Cart items with { id, quantity }
     * @returns {Object} - { subtotal, savings, items }
     */
    calculateCartTotal(items) {
        let subtotal = 0;
        let savings = 0;

        const itemDetails = items.map(item => {
            const product = this.getById(item.id);
            if (!product) return null;

            const unitPrice = this.getPrice(item.id, item.quantity);
            const lineTotal = unitPrice * item.quantity;
            const regularTotal = product.price * item.quantity;
            const lineSavings = regularTotal - lineTotal;

            subtotal += lineTotal;
            savings += lineSavings;

            return {
                ...item,
                product,
                unitPrice,
                lineTotal,
                savings: lineSavings
            };
        }).filter(Boolean);

        return {
            subtotal,
            savings,
            items: itemDetails
        };
    }

    /**
     * Subscribe to product manager events
     * @param {Function} callback - Callback function
     * @returns {Function} - Unsubscribe function
     */
    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    /**
     * Notify all subscribers
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    _notifySubscribers(event, data) {
        this.subscribers.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('ProductManager: Subscriber error', error);
            }
        });
    }

    /**
     * Format price for display
     * @param {number} price - Price in dollars
     * @returns {string}
     */
    static formatPrice(price) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(price);
    }
}

// Create singleton instance
const productManager = new ProductManager();

// Expose globally
window.productManager = productManager;
window.ProductManager = ProductManager;

// Auto-load when DOM is ready (optional - pages can call load() explicitly)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        productManager.load().catch(console.error);
    });
} else {
    productManager.load().catch(console.error);
}
