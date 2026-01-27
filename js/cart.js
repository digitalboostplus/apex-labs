/**
 * Apex Labs Cart Logic
 * Manages cart state using localStorage and handles UI updates.
 */

const CART_STORAGE_KEY = 'apex_labs_cart';

class Cart {
    constructor() {
        this.cart = this.loadCart();
        this.listeners = [];
    }

    loadCart() {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        try {
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Error parsing cart from localStorage:', e);
            return [];
        }
    }

    saveCart() {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.cart));
        this.notifyListeners();
    }

    addItem(product) {
        // product: { id, priceId, name, price, image }
        if (!product || (!product.id && !product.priceId)) {
            console.error('Invalid product added to cart:', product);
            return;
        }

        const existing = this.cart.find(item =>
            (product.priceId && item.priceId === product.priceId) ||
            (product.id && item.id === product.id)
        );

        if (existing) {
            existing.quantity += 1;
        } else {
            this.cart.push({ ...product, quantity: 1 });
        }

        this.saveCart();

        // Visual feedback: open the cart drawer if it's not already open
        const drawer = document.getElementById('cart-drawer');
        if (drawer && drawer.classList.contains('translate-x-full')) {
            if (typeof window.toggleCart === 'function') {
                window.toggleCart();
            }
        }
    }

    removeItem(priceId) {
        this.cart = this.cart.filter(item => item.priceId !== priceId && item.id !== priceId);
        this.saveCart();
    }

    updateQuantity(priceId, delta) {
        const item = this.cart.find(item => item.priceId === priceId || item.id === priceId);
        if (item) {
            item.quantity += delta;
            if (item.quantity <= 0) {
                this.removeItem(priceId);
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
        return this.cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
    }

    getItemCount() {
        return this.cart.reduce((sum, item) => sum + item.quantity, 0);
    }

    subscribe(callback) {
        this.listeners.push(callback);
        callback(this.cart); // Initial call
    }

    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this.cart);
            } catch (e) {
                console.error('Error in cart listener:', e);
            }
        });

        // Backward compatibility for components listening to window event
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

