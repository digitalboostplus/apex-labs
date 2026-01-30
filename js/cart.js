/**
 * Apex Labs Cart Logic
 * Manages cart state using localStorage and handles UI updates.
 */

const CART_STORAGE_KEY = 'apex_labs_cart';

class Cart {
    constructor() {
        this.cart = this.loadCart();
        this.listeners = [];
        this.productData = null;
        this.initProductData();
    }

    async initProductData() {
        try {
            // Detect path context for products.json
            const isInSubdir = window.location.pathname.includes('/pricing/') ||
                window.location.pathname.includes('/pages/');
            const jsonPath = isInSubdir ? '../data/products.json' : 'data/products.json';

            const response = await fetch(jsonPath);
            const data = await response.json();
            this.productData = data.products;
            this.notifyListeners(); // Refresh UI once data is loaded
        } catch (e) {
            console.error('Error loading product data for cart:', e);
        }
    }

    loadCart() {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        try {
            const parsed = saved ? JSON.parse(saved) : [];

            // Security: Validate cart data structure from localStorage
            if (!Array.isArray(parsed)) return [];

            return parsed.filter(item => {
                // Validate item is an object with required fields
                if (!item || typeof item !== 'object') return false;

                // Validate ID (required, must be string with safe characters)
                const id = item.id || item.priceId;
                if (typeof id !== 'string' || !/^[a-zA-Z0-9\-_:]+$/.test(id)) return false;

                // Validate quantity (must be positive number)
                if (typeof item.quantity !== 'number' || item.quantity < 1 || item.quantity > 1000) return false;

                // Validate price if present (must be reasonable number)
                if (item.price !== undefined) {
                    if (typeof item.price !== 'number' || item.price < 0 || item.price > 100000) return false;
                }

                // Validate name if present (must be string, reasonable length)
                if (item.name !== undefined && (typeof item.name !== 'string' || item.name.length > 200)) return false;

                // Validate category if present
                if (item.category !== undefined && (typeof item.category !== 'string' || item.category.length > 100)) return false;

                // Validate image if present
                if (item.image !== undefined && (typeof item.image !== 'string' || item.image.length > 500)) return false;

                return true;
            });
        } catch (e) {
            // If parsing fails, return empty cart
            return [];
        }
    }

    saveCart() {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.cart));
        this.notifyListeners();
    }

    getItemPrice(productId, quantity) {
        if (!this.productData) return null;
        const product = this.productData.find(p => p.id === productId);
        if (!product) return null;

        if (quantity >= 25) return product.wholesale2Price || product.wholesale1Price || product.price;
        if (quantity >= 10) return product.wholesale1Price || product.price;
        return product.price;
    }

    addItem(product, quantity = 1) {
        // Unify product IDs (remove '-wholesale' suffix if present)
        const baseId = product.id.replace('-wholesale', '');

        // Lookup full product info to ensure we have the correct priceId and base price
        const productInfo = this.productData ? this.productData.find(p => p.id === baseId) : null;

        const existing = this.cart.find(item => item.id === baseId);

        if (existing) {
            existing.quantity += quantity;
            // Refresh info in case it changed
            if (productInfo) {
                existing.priceId = productInfo.priceId;
                existing.price = productInfo.price;
            }
        } else {
            // Store with base ID and ensure priceId is attached
            const newItem = {
                ...product,
                id: baseId,
                quantity: quantity
            };

            if (productInfo) {
                newItem.priceId = productInfo.priceId;
                newItem.price = productInfo.price;
            }

            this.cart.push(newItem);
        }

        this.saveCart();

        // Visual feedback
        const drawer = document.getElementById('cart-drawer');
        if (drawer && drawer.classList.contains('translate-x-full')) {
            if (typeof window.toggleCart === 'function') {
                window.toggleCart();
            }
        }
    }

    removeItem(id) {
        this.cart = this.cart.filter(item => item.id !== id && item.priceId !== id);
        this.saveCart();
    }

    updateQuantity(id, delta) {
        const item = this.cart.find(item => item.id === id || item.priceId === id);
        if (item) {
            item.quantity += delta;
            if (item.quantity <= 0) {
                this.removeItem(id);
            } else {
                this.saveCart();
            }
        }
    }

    clearCart() {
        this.cart = [];
        this.saveCart();
    }

    getTotal() {
        return this.cart.reduce((sum, item) => {
            const unitPrice = this.getItemPrice(item.id, item.quantity) || Number(item.price);
            return sum + (unitPrice * item.quantity);
        }, 0);
    }

    getItemCount() {
        return this.cart.reduce((sum, item) => sum + item.quantity, 0);
    }

    subscribe(callback) {
        this.listeners.push(callback);
        callback(this.cart);
    }

    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this.cart);
            } catch (e) {
                // Silently handle if UI component is not ready
            }
        });
        window.dispatchEvent(new CustomEvent('cartUpdated', { detail: this.cart }));
    }
}

// Initialize the instance
const cartInstance = new Cart();

// Global access for UI components
window.cartManager = cartInstance;
window.CartManager = cartInstance;

// UI Initialization helper
window.toggleCart = function () {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if (drawer) {
        drawer.classList.toggle('translate-x-full');
        document.body.classList.toggle('overflow-hidden');
    }
    if (overlay) {
        overlay.classList.toggle('hidden');
    }
};

