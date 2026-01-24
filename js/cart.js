/**
 * Apex Labs Cart Logic
 * Manages cart state using localStorage and handles UI updates.
 */

const CART_STORAGE_KEY = 'apex_labs_cart';

class CartManager {
    constructor() {
        this.cart = this.loadCart();
        this.listeners = [];
    }

    loadCart() {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    }

    saveCart() {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.cart));
        this.notifyListeners();
    }

    addItem(product) {
        // product: { id, priceId, name, price, image }
        const existing = this.cart.find(item => item.priceId === product.priceId || item.id === product.id);
        if (existing) {
            existing.quantity += 1;
        } else {
            this.cart.push({ ...product, quantity: 1 });
        }
        this.saveCart();
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
        return this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    getItemCount() {
        return this.cart.reduce((sum, item) => sum + item.quantity, 0);
    }

    subscribe(callback) {
        this.listeners.push(callback);
        callback(this.cart); // Initial call
    }

    notifyListeners() {
        this.listeners.forEach(callback => callback(this.cart));
    }
}

const cartManager = new CartManager();

// Global access for UI components
window.cartManager = cartManager;
window.CartManager = cartManager; // Expose as class name for existing peptides.html code

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
