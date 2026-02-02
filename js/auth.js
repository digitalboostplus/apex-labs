/**
 * AuthManager - Firebase Authentication handler
 * Manages user sign-in, sign-up, and auth state
 */

// Import validation functions (will work when modules are properly set up)
// For now, validation will be optional until module setup is complete
let userValidation = null;

class AuthManager {
    constructor() {
        this.user = null;
        this.subscribers = [];
        this.initialized = false;
        this.initPromise = null;
    }

    /**
     * Initialize auth manager and set up auth state listener
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            // Wait for Firebase to be ready
            await window.firebaseServices.onReady();
            const auth = window.firebaseServices.getAuth();

            if (!auth) {
                throw new Error('Firebase Auth not available');
            }

            // Set up auth state listener
            auth.onAuthStateChanged((user) => {
                this.user = user;
                this._notifySubscribers('authStateChanged', user);

                if (user) {
                    console.log('User signed in:', user.email);
                    this._syncUserProfile(user);
                } else {
                    console.log('User signed out');
                }
            });

            this.initialized = true;
        })();

        return this.initPromise;
    }

    /**
     * Sign up with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {Object} profile - Optional profile data
     * @returns {Promise<firebase.User>}
     */
    async signUp(email, password, profile = {}) {
        await this.init();
        const auth = window.firebaseServices.getAuth();

        try {
            const result = await auth.createUserWithEmailAndPassword(email, password);

            // Update profile with display name if provided
            if (profile.displayName) {
                await result.user.updateProfile({
                    displayName: profile.displayName
                });
            }

            // Create user profile in Firestore
            await this._createUserProfile(result.user, profile);

            this._notifySubscribers('signUp', result.user);
            return result.user;
        } catch (error) {
            console.error('Sign up error:', error);
            this._notifySubscribers('error', error);
            throw this._formatError(error);
        }
    }

    /**
     * Sign in with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<firebase.User>}
     */
    async signIn(email, password) {
        await this.init();
        const auth = window.firebaseServices.getAuth();

        try {
            const result = await auth.signInWithEmailAndPassword(email, password);
            this._notifySubscribers('signIn', result.user);
            return result.user;
        } catch (error) {
            console.error('Sign in error:', error);
            this._notifySubscribers('error', error);
            throw this._formatError(error);
        }
    }

    /**
     * Sign in with Google
     * @returns {Promise<firebase.User>}
     */
    async signInWithGoogle() {
        await this.init();
        const auth = window.firebaseServices.getAuth();

        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');

            const result = await auth.signInWithPopup(provider);

            // Check if this is a new user
            if (result.additionalUserInfo?.isNewUser) {
                await this._createUserProfile(result.user, {
                    displayName: result.user.displayName,
                    photoURL: result.user.photoURL
                });
            }

            this._notifySubscribers('signIn', result.user);
            return result.user;
        } catch (error) {
            console.error('Google sign in error:', error);
            this._notifySubscribers('error', error);
            throw this._formatError(error);
        }
    }

    /**
     * Sign out
     * @returns {Promise<void>}
     */
    async signOut() {
        await this.init();
        const auth = window.firebaseServices.getAuth();

        try {
            await auth.signOut();
            this._notifySubscribers('signOut', null);
        } catch (error) {
            console.error('Sign out error:', error);
            throw this._formatError(error);
        }
    }

    /**
     * Send password reset email
     * @param {string} email - User email
     * @returns {Promise<void>}
     */
    async sendPasswordReset(email) {
        await this.init();
        const auth = window.firebaseServices.getAuth();

        try {
            await auth.sendPasswordResetEmail(email);
            this._notifySubscribers('passwordResetSent', email);
        } catch (error) {
            console.error('Password reset error:', error);
            throw this._formatError(error);
        }
    }

    /**
     * Get current user
     * @returns {firebase.User|null}
     */
    getCurrentUser() {
        return this.user;
    }

    /**
     * Check if user is signed in
     * @returns {boolean}
     */
    isSignedIn() {
        return this.user !== null;
    }

    /**
     * Get user display name
     * @returns {string}
     */
    getDisplayName() {
        if (!this.user) return '';
        return this.user.displayName || this.user.email?.split('@')[0] || 'User';
    }

    /**
     * Get user email
     * @returns {string}
     */
    getEmail() {
        return this.user?.email || '';
    }

    /**
     * Get user photo URL
     * @returns {string|null}
     */
    getPhotoURL() {
        return this.user?.photoURL || null;
    }

    /**
     * Subscribe to auth events
     * @param {Function} callback - Callback function (event, data)
     * @returns {Function} - Unsubscribe function
     */
    subscribe(callback) {
        this.subscribers.push(callback);

        // Immediately notify of current state
        if (this.initialized) {
            callback('authStateChanged', this.user);
        }

        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    /**
     * Wait for auth to be ready
     * @returns {Promise<firebase.User|null>}
     */
    async waitForAuth() {
        await this.init();
        return new Promise((resolve) => {
            const auth = window.firebaseServices.getAuth();
            const unsubscribe = auth.onAuthStateChanged((user) => {
                unsubscribe();
                resolve(user);
            });
        });
    }

    /**
     * Create user profile in Firestore
     * @param {firebase.User} user - Firebase user
     * @param {Object} profile - Profile data
     */
    async _createUserProfile(user, profile = {}) {
        const db = window.firebaseServices.getFirestore();
        if (!db) return;

        try {
            // Prepare profile data with validation
            const profileData = {
                email: user.email,
                displayName: profile.displayName || user.displayName || null,
                photoURL: profile.photoURL || user.photoURL || null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Basic client-side validation
            if (!profileData.email || !profileData.email.includes('@')) {
                throw new Error('Invalid email address');
            }

            if (profileData.displayName && profileData.displayName.length > 100) {
                throw new Error('Display name too long (max 100 characters)');
            }

            if (profileData.photoURL && !profileData.photoURL.match(/^https?:\/\//)) {
                throw new Error('Photo URL must use HTTP or HTTPS protocol');
            }

            await db.collection('users').doc(user.uid).set(profileData, { merge: true });
            console.log('User profile created successfully:', user.uid);
        } catch (error) {
            console.error('Failed to create user profile:', error);
            throw error;
        }
    }

    /**
     * Sync user profile on sign in
     * @param {firebase.User} user - Firebase user
     */
    async _syncUserProfile(user) {
        const db = window.firebaseServices.getFirestore();
        if (!db) return;

        try {
            // Prepare sync data with validation
            const syncData = {
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Basic client-side validation
            if (!syncData.email || !syncData.email.includes('@')) {
                throw new Error('Invalid email address');
            }

            if (syncData.displayName && syncData.displayName.length > 100) {
                throw new Error('Display name too long (max 100 characters)');
            }

            if (syncData.photoURL && !syncData.photoURL.match(/^https?:\/\//)) {
                throw new Error('Photo URL must use HTTP or HTTPS protocol');
            }

            await db.collection('users').doc(user.uid).set(syncData, { merge: true });
            console.log('User profile synced successfully:', user.uid);
        } catch (error) {
            console.error('Failed to sync user profile:', error);
            // Don't throw - sync failures shouldn't block sign in
        }
    }

    /**
     * Format Firebase error for display
     * @param {Error} error - Firebase error
     * @returns {Error}
     */
    _formatError(error) {
        const errorMessages = {
            'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/operation-not-allowed': 'This sign-in method is not enabled.',
            'auth/weak-password': 'Password should be at least 6 characters.',
            'auth/user-disabled': 'This account has been disabled.',
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password. Please try again.',
            'auth/too-many-requests': 'Too many attempts. Please try again later.',
            'auth/popup-closed-by-user': 'Sign-in popup was closed.',
            'auth/cancelled-popup-request': 'Sign-in was cancelled.',
            'auth/popup-blocked': 'Sign-in popup was blocked. Please allow popups.',
            'auth/network-request-failed': 'Network error. Please check your connection.'
        };

        const message = errorMessages[error.code] || error.message;
        const formattedError = new Error(message);
        formattedError.code = error.code;
        return formattedError;
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
                console.error('AuthManager: Subscriber error', error);
            }
        });
    }
}

// Create singleton instance
const authManager = new AuthManager();

// Expose globally
window.authManager = authManager;
window.AuthManager = AuthManager;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        authManager.init().catch(console.error);
    });
} else {
    authManager.init().catch(console.error);
}
