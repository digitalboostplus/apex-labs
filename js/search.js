/**
 * SearchManager - Client-side product search using Fuse.js
 * Provides fuzzy search, filtering, and sorting capabilities
 */
class SearchManager {
    constructor() {
        this.fuse = null;
        this.products = [];
        this.initialized = false;
        this.subscribers = [];

        // Fuse.js options
        this.fuseOptions = {
            keys: [
                { name: 'name', weight: 0.4 },
                { name: 'description', weight: 0.3 },
                { name: 'shortDescription', weight: 0.2 },
                { name: 'category', weight: 0.1 },
                { name: 'tags', weight: 0.15 }
            ],
            threshold: 0.3,
            ignoreLocation: true,
            includeScore: true,
            includeMatches: true,
            minMatchCharLength: 2
        };
    }

    /**
     * Initialize search manager with product data
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) return;

        // Wait for ProductManager to load
        await window.productManager.load();
        this.products = window.productManager.getAll();

        // Initialize Fuse.js
        if (typeof Fuse !== 'undefined') {
            this.fuse = new Fuse(this.products, this.fuseOptions);
        } else {
            console.warn('Fuse.js not loaded, falling back to basic search');
        }

        this.initialized = true;
        this._notifySubscribers('initialized', this.products);
    }

    /**
     * Search products by query string
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Array} - Search results
     */
    search(query, options = {}) {
        if (!query || query.trim().length === 0) {
            return this.products;
        }

        const trimmedQuery = query.trim();

        // Use Fuse.js if available
        if (this.fuse) {
            const results = this.fuse.search(trimmedQuery);
            return results.map(result => ({
                ...result.item,
                _score: result.score,
                _matches: result.matches
            }));
        }

        // Fallback to basic search
        return this._basicSearch(trimmedQuery);
    }

    /**
     * Basic search fallback (no Fuse.js)
     * @param {string} query - Search query
     * @returns {Array}
     */
    _basicSearch(query) {
        const lowerQuery = query.toLowerCase();

        return this.products.filter(product => {
            const searchableText = [
                product.name,
                product.description,
                product.shortDescription,
                product.category,
                ...(product.tags || [])
            ].join(' ').toLowerCase();

            return searchableText.includes(lowerQuery);
        });
    }

    /**
     * Filter products by category
     * @param {string|Array} categories - Category name(s)
     * @returns {Array}
     */
    filterByCategory(categories) {
        if (!categories || categories.length === 0) {
            return this.products;
        }

        const categoryList = Array.isArray(categories) ? categories : [categories];
        const lowerCategories = categoryList.map(c => c.toLowerCase());

        return this.products.filter(product =>
            lowerCategories.includes(product.category.toLowerCase())
        );
    }

    /**
     * Filter products by tags
     * @param {Array} tags - Tag names
     * @param {string} mode - 'any' or 'all'
     * @returns {Array}
     */
    filterByTags(tags, mode = 'any') {
        if (!tags || tags.length === 0) {
            return this.products;
        }

        const lowerTags = tags.map(t => t.toLowerCase());

        return this.products.filter(product => {
            if (!product.tags) return false;

            const productTags = product.tags.map(t => t.toLowerCase());

            if (mode === 'all') {
                return lowerTags.every(tag => productTags.includes(tag));
            }
            return lowerTags.some(tag => productTags.includes(tag));
        });
    }

    /**
     * Filter products by price range
     * @param {number} min - Minimum price
     * @param {number} max - Maximum price
     * @returns {Array}
     */
    filterByPrice(min = 0, max = Infinity) {
        return this.products.filter(product =>
            product.price >= min && product.price <= max
        );
    }

    /**
     * Apply multiple filters
     * @param {Object} filters - Filter criteria
     * @returns {Array}
     */
    filter(filters = {}) {
        let results = [...this.products];

        // Text search
        if (filters.query) {
            results = this.search(filters.query);
        }

        // Category filter
        if (filters.categories && filters.categories.length > 0) {
            const lowerCategories = filters.categories.map(c => c.toLowerCase());
            results = results.filter(p =>
                lowerCategories.includes(p.category.toLowerCase())
            );
        }

        // Tags filter
        if (filters.tags && filters.tags.length > 0) {
            const lowerTags = filters.tags.map(t => t.toLowerCase());
            results = results.filter(p =>
                p.tags && lowerTags.some(tag => p.tags.includes(tag))
            );
        }

        // Price range filter
        if (filters.minPrice !== undefined) {
            results = results.filter(p => p.price >= filters.minPrice);
        }
        if (filters.maxPrice !== undefined) {
            results = results.filter(p => p.price <= filters.maxPrice);
        }

        // In stock filter
        if (filters.inStock !== undefined) {
            results = results.filter(p => p.inStock === filters.inStock);
        }

        // Featured filter
        if (filters.featured !== undefined) {
            results = results.filter(p => p.featured === filters.featured);
        }

        // Apply sorting
        if (filters.sortBy) {
            results = this.sort(results, filters.sortBy, filters.sortDirection);
        }

        return results;
    }

    /**
     * Sort products
     * @param {Array} products - Products to sort
     * @param {string} field - Sort field
     * @param {string} direction - 'asc' or 'desc'
     * @returns {Array}
     */
    sort(products, field = 'name', direction = 'asc') {
        const sorted = [...products].sort((a, b) => {
            let valA = a[field];
            let valB = b[field];

            // Handle special sort fields
            switch (field) {
                case 'price-low':
                    valA = a.price;
                    valB = b.price;
                    break;
                case 'price-high':
                    valA = a.price;
                    valB = b.price;
                    direction = 'desc';
                    break;
                case 'name-az':
                    valA = a.name.toLowerCase();
                    valB = b.name.toLowerCase();
                    break;
                case 'name-za':
                    valA = a.name.toLowerCase();
                    valB = b.name.toLowerCase();
                    direction = 'desc';
                    break;
            }

            // Handle string comparison
            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            // Handle undefined values
            if (valA === undefined) return 1;
            if (valB === undefined) return -1;

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    }

    /**
     * Get search suggestions based on partial query
     * @param {string} query - Partial search query
     * @param {number} limit - Max suggestions
     * @returns {Array}
     */
    getSuggestions(query, limit = 5) {
        if (!query || query.length < 2) return [];

        const results = this.search(query);
        const suggestions = [];

        // Extract unique suggestions from matches
        results.slice(0, limit * 2).forEach(result => {
            if (suggestions.length >= limit) return;

            // Add product name as suggestion
            if (!suggestions.includes(result.name)) {
                suggestions.push(result.name);
            }

            // Add matching category
            if (suggestions.length < limit && !suggestions.includes(result.category)) {
                suggestions.push(result.category);
            }
        });

        return suggestions.slice(0, limit);
    }

    /**
     * Get all unique categories
     * @returns {Array}
     */
    getCategories() {
        const categories = new Set();
        this.products.forEach(p => categories.add(p.category));
        return Array.from(categories).sort();
    }

    /**
     * Get all unique tags
     * @returns {Array}
     */
    getTags() {
        const tags = new Set();
        this.products.forEach(p => {
            if (p.tags) p.tags.forEach(tag => tags.add(tag));
        });
        return Array.from(tags).sort();
    }

    /**
     * Get price range
     * @returns {Object} - { min, max }
     */
    getPriceRange() {
        if (this.products.length === 0) return { min: 0, max: 0 };

        const prices = this.products.map(p => p.price);
        return {
            min: Math.min(...prices),
            max: Math.max(...prices)
        };
    }

    /**
     * Subscribe to search events
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
     * Notify subscribers
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    _notifySubscribers(event, data) {
        this.subscribers.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('SearchManager: Subscriber error', error);
            }
        });
    }
}

// Create singleton instance
const searchManager = new SearchManager();

// Expose globally
window.searchManager = searchManager;
window.SearchManager = SearchManager;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        searchManager.init().catch(console.error);
    });
} else {
    searchManager.init().catch(console.error);
}
