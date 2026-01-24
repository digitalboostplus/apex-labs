/**
 * WishlistManager - Manage user wishlists
 * Uses localStorage for anonymous users, syncs to Firestore for authenticated users
 */
class WishlistManager {
    constructor() {
        this.items = [];
        this.storageKey = 'apex_labs_wishlist';
        this.subscribers = [];
        this.initialized = false;
        this.userId = null;
    }

    /**
     * Initialize wishlist manager
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) return;

        // Load from localStorage first
        this._loadFromStorage();

        // Subscribe to auth changes
        if (window.authManager) {
            window.authManager.subscribe(async (event, user) => {
                if (event === 'authStateChanged') {
                    if (user) {
                        await this._onUserSignIn(user);
                    } else {
                        this._onUserSignOut();
                    }
                }
            });

            // Check current auth state
            const user = window.authManager.getCurrentUser();
            if (user) {
                await this._onUserSignIn(user);
            }
        }

        this.initialized = true;
        this._notifySubscribers('initialized', this.items);
    }

    /**
     * Add item to wishlist
     * @param {Object} product - Product to add
     * @returns {Promise<boolean>}
     */
    async add(product) {
        if (!product || !product.id) {
            console.error('WishlistManager: Invalid product');
            return false;
        }

        // Check if already in wishlist
        if (this.contains(product.id)) {
            return false;
        }

        const wishlistItem = {
            id: product.id,
            priceId: product.priceId,
            name: product.name,
            price: product.price,
            image: product.image,
            category: product.category,
            addedAt: new Date().toISOString()
        };

        this.items.push(wishlistItem);
        this._saveToStorage();

        // Sync to Firestore if user is logged in
        if (this.userId) {
            await this._syncToFirestore('add', wishlistItem);
        }

        this._notifySubscribers('added', wishlistItem);
        return true;
    }

    /**
     * Remove item from wishlist
     * @param {string} productId - Product ID to remove
     * @returns {Promise<boolean>}
     */
    async remove(productId) {
        const index = this.items.findIndex(item => item.id === productId);
        if (index === -1) return false;

        const removed = this.items.splice(index, 1)[0];
        this._saveToStorage();

        // Sync to Firestore if user is logged in
        if (this.userId) {
            await this._syncToFirestore('remove', { id: productId });
        }

        this._notifySubscribers('removed', removed);
        return true;
    }

    /**
     * Toggle item in wishlist
     * @param {Object} product - Product to toggle
     * @returns {Promise<boolean>} - True if added, false if removed
     */
    async toggle(product) {
        if (this.contains(product.id)) {
            await this.remove(product.id);
            return false;
        } else {
            await this.add(product);
            return true;
        }
    }

    /**
     * Check if product is in wishlist
     * @param {string} productId - Product ID
     * @returns {boolean}
     */
    contains(productId) {
        return this.items.some(item => item.id === productId);
    }

    /**
     * Get all wishlist items
     * @returns {Array}
     */
    getAll() {
        return [...this.items];
    }

    /**
     * Get wishlist count
     * @returns {number}
     */
    getCount() {
        return this.items.length;
    }

    /**
     * Clear wishlist
     * @returns {Promise<void>}
     */
    async clear() {
        this.items = [];
        this._saveToStorage();

        // Clear Firestore if user is logged in
        if (this.userId) {
            await this._clearFirestore();
        }

        this._notifySubscribers('cleared', null);
    }

    /**
     * Move item from wishlist to cart
     * @param {string} productId - Product ID
     * @returns {Promise<boolean>}
     */
    async moveToCart(productId) {
        const item = this.items.find(i => i.id === productId);
        if (!item) return false;

        // Add to cart
        if (window.cartManager) {
            window.cartManager.addItem({
                id: item.id,
                priceId: item.priceId,
                name: item.name,
                price: item.price,
                image: item.image
            });
        }

        // Remove from wishlist
        await this.remove(productId);
        return true;
    }

    /**
     * Move all wishlist items to cart
     * @returns {Promise<number>} - Number of items moved
     */
    async moveAllToCart() {
        let count = 0;
        const itemsToMove = [...this.items];

        for (const item of itemsToMove) {
            if (await this.moveToCart(item.id)) {
                count++;
            }
        }

        return count;
    }

    /**
     * Subscribe to wishlist changes
     * @param {Function} callback - Callback function
     * @returns {Function} - Unsubscribe function
     */
    subscribe(callback) {
        this.subscribers.push(callback);

        // Immediately notify of current state
        callback('initialized', this.items);

        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    /**
     * Load wishlist from localStorage
     */
    _loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.items = JSON.parse(stored);
            }
        } catch (error) {
            console.error('WishlistManager: Failed to load from storage', error);
            this.items = [];
        }
    }

    /**
     * Save wishlist to localStorage
     */
    _saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.items));
        } catch (error) {
            console.error('WishlistManager: Failed to save to storage', error);
        }
    }

    /**
     * Handle user sign in
     * @param {Object} user - Firebase user
     */
    async _onUserSignIn(user) {
        this.userId = user.uid;

        // Load wishlist from Firestore
        const firestoreItems = await this._loadFromFirestore();

        // Merge local items with Firestore items
        await this._mergeWishlists(firestoreItems);
    }

    /**
     * Handle user sign out
     */
    _onUserSignOut() {
        this.userId = null;
        // Keep local wishlist, don't clear
    }

    /**
     * Load wishlist from Firestore
     * @returns {Promise<Array>}
     */
    async _loadFromFirestore() {
        if (!this.userId) return [];

        const db = window.firebaseServices?.getFirestore();
        if (!db) return [];

        try {
            const snapshot = await db
                .collection('users')
                .doc(this.userId)
                .collection('wishlist')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('WishlistManager: Failed to load from Firestore', error);
            return [];
        }
    }

    /**
     * Merge local and Firestore wishlists
     * @param {Array} firestoreItems - Items from Firestore
     */
    async _mergeWishlists(firestoreItems) {
        const localItems = [...this.items];
        const merged = new Map();

        // Add Firestore items first
        firestoreItems.forEach(item => {
            merged.set(item.id, item);
        });

        // Merge local items (may be newer)
        localItems.forEach(item => {
            if (!merged.has(item.id)) {
                merged.set(item.id, item);
            }
        });

        this.items = Array.from(merged.values());
        this._saveToStorage();

        // Sync any new local items to Firestore
        for (const item of localItems) {
            if (!firestoreItems.find(fi => fi.id === item.id)) {
                await this._syncToFirestore('add', item);
            }
        }

        this._notifySubscribers('merged', this.items);
    }

    /**
     * Sync action to Firestore
     * @param {string} action - 'add' or 'remove'
     * @param {Object} item - Wishlist item
     */
    async _syncToFirestore(action, item) {
        if (!this.userId) return;

        const db = window.firebaseServices?.getFirestore();
        if (!db) return;

        try {
            const docRef = db
                .collection('users')
                .doc(this.userId)
                .collection('wishlist')
                .doc(item.id);

            if (action === 'add') {
                await docRef.set({
                    ...item,
                    syncedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else if (action === 'remove') {
                await docRef.delete();
            }
        } catch (error) {
            console.error('WishlistManager: Failed to sync to Firestore', error);
        }
    }

    /**
     * Clear Firestore wishlist
     */
    async _clearFirestore() {
        if (!this.userId) return;

        const db = window.firebaseServices?.getFirestore();
        if (!db) return;

        try {
            const snapshot = await db
                .collection('users')
                .doc(this.userId)
                .collection('wishlist')
                .get();

            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
        } catch (error) {
            console.error('WishlistManager: Failed to clear Firestore', error);
        }
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
                console.error('WishlistManager: Subscriber error', error);
            }
        });
    }
}

// Create singleton instance
const wishlistManager = new WishlistManager();

// Expose globally
window.wishlistManager = wishlistManager;
window.WishlistManager = WishlistManager;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        wishlistManager.init().catch(console.error);
    });
} else {
    wishlistManager.init().catch(console.error);
}
