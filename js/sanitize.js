/**
 * Security Sanitization Utilities
 * Prevents XSS attacks by escaping user-controlled data
 */

(function() {
    'use strict';

    /**
     * Escape HTML entities to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string safe for innerHTML
     */
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        if (typeof str !== 'string') str = String(str);

        const htmlEntities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;',
            '`': '&#x60;',
            '=': '&#x3D;'
        };

        return str.replace(/[&<>"'`=\/]/g, char => htmlEntities[char]);
    }

    /**
     * Escape a string for use in HTML attributes (like onclick handlers)
     * @param {string} str - String to escape
     * @returns {string} Escaped string safe for attributes
     */
    function escapeAttr(str) {
        if (str === null || str === undefined) return '';
        if (typeof str !== 'string') str = String(str);

        // First escape HTML, then escape for JS string context
        return escapeHtml(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
    }

    /**
     * Validate and sanitize a product ID
     * Only allows alphanumeric, dash, underscore
     * @param {string} id - Product ID to validate
     * @returns {string|null} Sanitized ID or null if invalid
     */
    function sanitizeId(id) {
        if (typeof id !== 'string') return null;
        // Only allow alphanumeric, dash, underscore, colon (for priceId format)
        const sanitized = id.replace(/[^a-zA-Z0-9\-_:]/g, '');
        return sanitized.length > 0 ? sanitized : null;
    }

    /**
     * Validate a URL for safe usage in img src
     * @param {string} url - URL to validate
     * @param {string} basePath - Base path for relative URLs
     * @returns {string} Safe URL or placeholder
     */
    function sanitizeImageUrl(url, basePath = '.') {
        if (!url || typeof url !== 'string') {
            return `${basePath}/assets/placeholder.png`;
        }

        // Allow relative paths starting with assets/
        if (url.startsWith('assets/') || url.startsWith('./assets/') || url.startsWith('../assets/')) {
            return url;
        }

        // Allow absolute paths from root
        if (url.startsWith('/assets/')) {
            return url;
        }

        // For full URLs, only allow HTTPS from trusted domains
        if (url.startsWith('http://') || url.startsWith('https://')) {
            try {
                const parsed = new URL(url);
                const trustedDomains = [
                    'apex-labs-18862.web.app',
                    'apex-labs-18862.firebaseapp.com',
                    'firebasestorage.googleapis.com',
                    'localhost'
                ];
                if (trustedDomains.some(domain => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain))) {
                    return url;
                }
            } catch (e) {
                // Invalid URL
            }
            return `${basePath}/assets/placeholder.png`;
        }

        // Assume it's a relative path, prepend basePath
        return `${basePath}/${url}`;
    }

    /**
     * Validate a price value
     * @param {*} price - Price to validate
     * @returns {number} Valid price or 0
     */
    function sanitizePrice(price) {
        const num = parseFloat(price);
        if (isNaN(num) || num < 0 || num > 100000) {
            return 0;
        }
        return num;
    }

    /**
     * Validate a quantity value
     * @param {*} quantity - Quantity to validate
     * @returns {number} Valid quantity or 1
     */
    function sanitizeQuantity(quantity) {
        const num = parseInt(quantity, 10);
        if (isNaN(num) || num < 1 || num > 1000) {
            return 1;
        }
        return num;
    }

    /**
     * Validate a cart item object
     * @param {Object} item - Cart item to validate
     * @returns {Object|null} Validated item or null if invalid
     */
    function validateCartItem(item) {
        if (!item || typeof item !== 'object') return null;

        const id = sanitizeId(item.id || item.priceId);
        if (!id) return null;

        return {
            id: id,
            priceId: item.priceId ? sanitizeId(item.priceId) : id,
            name: typeof item.name === 'string' ? item.name.substring(0, 200) : 'Unknown Item',
            price: sanitizePrice(item.price),
            quantity: sanitizeQuantity(item.quantity),
            category: typeof item.category === 'string' ? item.category.substring(0, 100) : 'Compound',
            image: typeof item.image === 'string' ? item.image.substring(0, 500) : null
        };
    }

    /**
     * Validate an entire cart array from localStorage
     * @param {Array} cart - Cart array to validate
     * @returns {Array} Array of validated items
     */
    function validateCart(cart) {
        if (!Array.isArray(cart)) return [];

        return cart
            .map(item => validateCartItem(item))
            .filter(item => item !== null);
    }

    // Export to global scope
    window.sanitize = {
        html: escapeHtml,
        attr: escapeAttr,
        id: sanitizeId,
        imageUrl: sanitizeImageUrl,
        price: sanitizePrice,
        quantity: sanitizeQuantity,
        cartItem: validateCartItem,
        cart: validateCart
    };
})();
