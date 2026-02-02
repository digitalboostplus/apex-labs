/**
 * Firebase Initialization Module
 * Centralized Firebase configuration and service initialization
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

let app = null;
let auth = null;
let db = null;
let initialized = false;
let initPromise = null;

/**
 * Dynamically load Firebase SDK if not present
 */
async function loadFirebaseSDK() {
    if (typeof firebase !== 'undefined') return;

    const version = '12.8.0';
    const scripts = [
        `https://www.gstatic.com/firebasejs/${version}/firebase-app-compat.js`,
        `https://www.gstatic.com/firebasejs/${version}/firebase-auth-compat.js`,
        `https://www.gstatic.com/firebasejs/${version}/firebase-firestore-compat.js`
    ];

    const loadScript = (src) => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });

    for (const src of scripts) {
        await loadScript(src);
    }
}

/**
 * Initialize Firebase services
 */
async function initFirebase() {
    if (initialized) return { app, auth, db };
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            await loadFirebaseSDK();

            if (!firebase.apps.length) {
                app = firebase.initializeApp(firebaseConfig);
            } else {
                app = firebase.apps[0];
            }

            auth = firebase.auth();
            db = firebase.firestore();

            // Enable persistence
            try {
                await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            } catch (e) { console.warn('Auth persistence error', e); }

            initialized = true;

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

// Helper Getters
const getAuth = () => auth;
const getFirestore = () => db;
const getApp = () => app;
const isInitialized = () => initialized;
const onReady = () => initialized ? Promise.resolve({ app, auth, db }) : initFirebase();

// Firestore Helpers
const helpers = {
    async getDoc(path) {
        const d = await onReady();
        const doc = await d.db.doc(path).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },
    async setDoc(path, data, options = { merge: true }) {
        const d = await onReady();
        return d.db.doc(path).set(data, options);
    },
    async updateDoc(path, data) {
        const d = await onReady();
        return d.db.doc(path).update(data);
    },
    async addDoc(colPath, data) {
        const d = await onReady();
        const ref = await d.db.collection(colPath).add(data);
        return ref.id;
    },
    serverTimestamp: () => firebase.firestore.FieldValue.serverTimestamp(),
    increment: (n) => firebase.firestore.FieldValue.increment(n)
};

// Global Exposure
window.firebaseServices = {
    init: initFirebase,
    getAuth,
    getFirestore,
    getApp,
    isInitialized,
    onReady,
    helpers,
    config: firebaseConfig
};

// Auto-init
initFirebase().catch(console.error);
