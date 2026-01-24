/**
 * Firebase Initialization Module
 * Centralized Firebase configuration and service initialization
 *
 * Usage:
 * - Import this module on any page that needs Firebase services
 * - Access services via window.firebaseServices or the exported constants
 */

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD7iFXBzJi5NIK8_CjkfDFbonPdL5Z_SS0",
    authDomain: "apex-labs-18862.firebaseapp.com",
    projectId: "apex-labs-18862",
    storageBucket: "apex-labs-18862.firebasestorage.app",
    messagingSenderId: "257864801015",
    appId: "1:257864801015:web:cb0da3675c646c0f5ed1f2"
};

// Firebase service references (populated after initialization)
let app = null;
let auth = null;
let db = null;
let initialized = false;
let initPromise = null;

/**
 * Initialize Firebase services
 * @returns {Promise<Object>} - Firebase services object
 */
async function initFirebase() {
    if (initialized) {
        return { app, auth, db };
    }

    if (initPromise) {
        return initPromise;
    }

    initPromise = (async () => {
        try {
            // Check if Firebase SDK is loaded
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK not loaded. Include Firebase scripts before firebase-init.js');
            }

            // Initialize Firebase app (if not already initialized)
            if (!firebase.apps.length) {
                app = firebase.initializeApp(firebaseConfig);
            } else {
                app = firebase.apps[0];
            }

            // Initialize Auth
            if (firebase.auth) {
                auth = firebase.auth();

                // Configure auth persistence
                await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            }

            // Initialize Firestore
            if (firebase.firestore) {
                db = firebase.firestore();

                // Enable offline persistence (optional, comment out if not needed)
                try {
                    await db.enablePersistence({ synchronizeTabs: true });
                } catch (err) {
                    if (err.code === 'failed-precondition') {
                        // Multiple tabs open, persistence can only be enabled in one tab at a time
                        console.warn('Firestore persistence unavailable: multiple tabs open');
                    } else if (err.code === 'unimplemented') {
                        // Browser doesn't support persistence
                        console.warn('Firestore persistence unavailable: browser not supported');
                    }
                }
            }

            initialized = true;
            console.log('Firebase initialized successfully');

            // Dispatch custom event for other modules to know Firebase is ready
            window.dispatchEvent(new CustomEvent('firebase-ready', {
                detail: { app, auth, db }
            }));

            return { app, auth, db };
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            throw error;
        }
    })();

    return initPromise;
}

/**
 * Get Firebase Auth instance
 * @returns {firebase.auth.Auth|null}
 */
function getAuth() {
    return auth;
}

/**
 * Get Firestore instance
 * @returns {firebase.firestore.Firestore|null}
 */
function getFirestore() {
    return db;
}

/**
 * Get Firebase App instance
 * @returns {firebase.app.App|null}
 */
function getApp() {
    return app;
}

/**
 * Check if Firebase is initialized
 * @returns {boolean}
 */
function isInitialized() {
    return initialized;
}

/**
 * Wait for Firebase to be ready
 * @returns {Promise<Object>}
 */
function onReady() {
    if (initialized) {
        return Promise.resolve({ app, auth, db });
    }
    return initFirebase();
}

// Firestore helper functions
const firestoreHelpers = {
    /**
     * Get a document by path
     * @param {string} path - Document path (e.g., 'users/userId')
     * @returns {Promise<Object|null>}
     */
    async getDoc(path) {
        if (!db) await initFirebase();
        const doc = await db.doc(path).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },

    /**
     * Set a document
     * @param {string} path - Document path
     * @param {Object} data - Document data
     * @param {Object} options - Set options (merge, etc.)
     * @returns {Promise<void>}
     */
    async setDoc(path, data, options = {}) {
        if (!db) await initFirebase();
        return db.doc(path).set(data, options);
    },

    /**
     * Update a document
     * @param {string} path - Document path
     * @param {Object} data - Fields to update
     * @returns {Promise<void>}
     */
    async updateDoc(path, data) {
        if (!db) await initFirebase();
        return db.doc(path).update(data);
    },

    /**
     * Delete a document
     * @param {string} path - Document path
     * @returns {Promise<void>}
     */
    async deleteDoc(path) {
        if (!db) await initFirebase();
        return db.doc(path).delete();
    },

    /**
     * Query a collection
     * @param {string} collectionPath - Collection path
     * @param {Array} queries - Array of query tuples [field, operator, value]
     * @returns {Promise<Array>}
     */
    async queryCollection(collectionPath, queries = []) {
        if (!db) await initFirebase();

        let ref = db.collection(collectionPath);

        queries.forEach(([field, operator, value]) => {
            ref = ref.where(field, operator, value);
        });

        const snapshot = await ref.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    /**
     * Add a document to a collection
     * @param {string} collectionPath - Collection path
     * @param {Object} data - Document data
     * @returns {Promise<string>} - Document ID
     */
    async addDoc(collectionPath, data) {
        if (!db) await initFirebase();
        const ref = await db.collection(collectionPath).add(data);
        return ref.id;
    },

    /**
     * Get server timestamp
     * @returns {firebase.firestore.FieldValue}
     */
    serverTimestamp() {
        return firebase.firestore.FieldValue.serverTimestamp();
    },

    /**
     * Increment a field value
     * @param {number} n - Amount to increment
     * @returns {firebase.firestore.FieldValue}
     */
    increment(n = 1) {
        return firebase.firestore.FieldValue.increment(n);
    },

    /**
     * Array union operation
     * @param {...any} elements - Elements to add
     * @returns {firebase.firestore.FieldValue}
     */
    arrayUnion(...elements) {
        return firebase.firestore.FieldValue.arrayUnion(...elements);
    },

    /**
     * Array remove operation
     * @param {...any} elements - Elements to remove
     * @returns {firebase.firestore.FieldValue}
     */
    arrayRemove(...elements) {
        return firebase.firestore.FieldValue.arrayRemove(...elements);
    }
};

// Expose globally
window.firebaseServices = {
    init: initFirebase,
    getAuth,
    getFirestore,
    getApp,
    isInitialized,
    onReady,
    helpers: firestoreHelpers,
    config: firebaseConfig
};

// Also expose individual getters for convenience
window.getFirebaseAuth = getAuth;
window.getFirestore = getFirestore;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Only auto-init if Firebase SDK is loaded
        if (typeof firebase !== 'undefined') {
            initFirebase().catch(console.error);
        }
    });
} else {
    if (typeof firebase !== 'undefined') {
        initFirebase().catch(console.error);
    }
}
