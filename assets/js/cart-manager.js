/**
 * Cart Manager for Apex Labs
 * Handles cart state, localStorage persistence, and UI updates for the cart counter.
 */

window.CartManager = {
    cart: [],

    init() {
        this.loadCart();
        this.updateCartCounter();
        
        // Listen for storage changes from other tabs
        window.addEventListener('storage', (e) => {
            if (e.key === 'apex_labs_cart') {
                this.loadCart();
                this.updateCartCounter();
            }
        });

        // Initialize Lucide icons if present
        if (window.lucide) {
            window.lucide.createIcons();
        }
    },

    loadCart() {
        const savedCart = localStorage.getItem('apex_labs_cart');
        if (savedCart) {
            try {
                this.cart = JSON.parse(savedCart);
            } catch (e) {
                console.error('Failed to parse cart', e);
                this.cart = [];
            }
        }
    },

    saveCart() {
        localStorage.setItem('apex_labs_cart', JSON.stringify(this.cart));
        this.updateCartCounter();
        // Dispatch custom event for page-specific UI updates
        window.dispatchEvent(new CustomEvent('cartUpdated', { detail: this.cart }));
    },

    addItem(product) {
        // Expected product: { id, name, price, image, category }
        const existingItem = this.cart.find(item => item.id === product.id);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.cart.push({
                ...product,
                quantity: 1
            });
        }
        this.saveCart();
    },

    removeItem(productId) {
        this.cart = this.cart.filter(item => item.id !== productId);
        this.saveCart();
    },

    updateQuantity(productId, quantity) {
        const item = this.cart.find(item => item.id === productId);
        if (item) {
            item.quantity = Math.max(1, parseInt(quantity));
            this.saveCart();
        }
    },

    clearCart() {
        this.cart = [];
        this.saveCart();
    },

    getCartTotal() {
        return this.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    },

    getItemCount() {
        return this.cart.reduce((count, item) => count + item.quantity, 0);
    },

    updateCartCounter() {
        const counters = document.querySelectorAll('.cart-counter');
        const count = this.getItemCount();
        counters.forEach(counter => {
            counter.textContent = count;
            if (count > 0) {
                counter.classList.remove('hidden');
            } else {
                counter.classList.add('hidden');
            }
        });
    }
};

// Auto-init on load
document.addEventListener('DOMContentLoaded', () => CartManager.init());
