/**
 * Firestore User Schema Definitions
 *
 * This file contains TypeScript interfaces, JSON schemas, and documentation
 * for the users collection in Firestore.
 *
 * Collection Path: users/{uid}
 *
 * Related Collections:
 * - users/{uid}/orders - User's order history (read-only, managed by Cloud Functions)
 * - users/{uid}/addresses - User's saved addresses
 * - users/{uid}/wishlist - User's wishlist items
 */

import { Timestamp, FieldValue } from 'firebase/firestore';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Base User Profile
 *
 * Core user document stored at users/{uid}
 * Created on signup and synced on each login
 */
export interface UserProfile {
    /**
     * User's email address from Firebase Auth
     * Required, indexed for lookup
     * @example "user@example.com"
     */
    email: string;

    /**
     * User's display name
     * Populated from Firebase Auth profile or user input during signup
     * Falls back to email prefix if not provided
     * @example "John Doe"
     */
    displayName: string | null;

    /**
     * User's profile photo URL
     * Automatically populated for Google OAuth users
     * Can be updated by user or left null
     * @example "https://lh3.googleusercontent.com/..."
     */
    photoURL: string | null;

    /**
     * Timestamp when the user account was created
     * Set once during initial signup via serverTimestamp()
     * Never updated after creation
     */
    createdAt: Timestamp;

    /**
     * Timestamp of the last profile update
     * Updated on signup and every login via serverTimestamp()
     * Used to track profile synchronization
     */
    updatedAt: Timestamp;

    /**
     * Timestamp of the last successful login
     * Updated every time user signs in via serverTimestamp()
     * Only exists after first login (not set during signup)
     */
    lastLoginAt?: Timestamp;

    // ========================================================================
    // Future Extension Fields (not yet implemented)
    // ========================================================================

    /**
     * User's phone number for notifications
     * @future Planned for order updates and SMS notifications
     */
    phoneNumber?: string | null;

    /**
     * User's preferred communication preferences
     * @future Planned for marketing and notification settings
     */
    preferences?: UserPreferences;

    /**
     * User's subscription status
     * @future Planned for recurring peptide therapy programs
     */
    subscription?: SubscriptionInfo;

    /**
     * Referral code assigned to this user
     * @future Planned for referral program
     */
    referralCode?: string;

    /**
     * UID of user who referred this user
     * @future Planned for referral program
     */
    referredBy?: string | null;

    /**
     * User's total lifetime value (in cents)
     * @future Calculated from order history
     */
    lifetimeValue?: number;

    /**
     * User's account status
     * @future For account management (active/suspended/deleted)
     */
    status?: 'active' | 'suspended' | 'deleted';
}

/**
 * User Preferences
 * @future Nested object for user communication and UX preferences
 */
export interface UserPreferences {
    /**
     * Opt-in for marketing emails
     * @default true
     */
    marketingEmails: boolean;

    /**
     * Opt-in for order update emails
     * @default true
     */
    orderEmails: boolean;

    /**
     * Opt-in for SMS notifications
     * @default false
     */
    smsNotifications: boolean;

    /**
     * Preferred theme (light/dark/auto)
     * @default "auto"
     */
    theme: 'light' | 'dark' | 'auto';

    /**
     * Preferred units for measurements
     * @default "imperial"
     */
    units: 'metric' | 'imperial';
}

/**
 * Subscription Information
 * @future For recurring peptide therapy programs
 */
export interface SubscriptionInfo {
    /**
     * Subscription plan ID
     */
    planId: string;

    /**
     * Stripe subscription ID
     */
    stripeSubscriptionId: string;

    /**
     * Subscription status
     */
    status: 'active' | 'past_due' | 'canceled' | 'trialing';

    /**
     * Current billing period start
     */
    currentPeriodStart: Timestamp;

    /**
     * Current billing period end
     */
    currentPeriodEnd: Timestamp;

    /**
     * Whether subscription auto-renews
     */
    cancelAtPeriodEnd: boolean;
}

/**
 * User document with Firestore metadata
 * Use this type when reading from Firestore
 */
export interface UserDocument extends UserProfile {
    /**
     * Document ID (same as Firebase Auth UID)
     */
    uid: string;
}

/**
 * User creation input
 * Use this type when creating new user documents
 */
export interface CreateUserInput {
    email: string;
    displayName?: string | null;
    photoURL?: string | null;
}

/**
 * User update input
 * Use this type when updating user profiles
 * Only includes fields users can modify themselves
 */
export interface UpdateUserInput {
    displayName?: string | null;
    photoURL?: string | null;
    phoneNumber?: string | null;
    preferences?: Partial<UserPreferences>;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if value is a valid UserProfile
 */
export function isUserProfile(value: unknown): value is UserProfile {
    if (!value || typeof value !== 'object') return false;
    const user = value as Record<string, unknown>;

    return (
        typeof user.email === 'string' &&
        (user.displayName === null || typeof user.displayName === 'string') &&
        (user.photoURL === null || typeof user.photoURL === 'string') &&
        user.createdAt instanceof Timestamp &&
        user.updatedAt instanceof Timestamp &&
        (user.lastLoginAt === undefined || user.lastLoginAt instanceof Timestamp)
    );
}

/**
 * Type guard to check if value is a valid CreateUserInput
 */
export function isCreateUserInput(value: unknown): value is CreateUserInput {
    if (!value || typeof value !== 'object') return false;
    const input = value as Record<string, unknown>;

    return (
        typeof input.email === 'string' &&
        input.email.length > 0 &&
        (input.displayName === undefined ||
         input.displayName === null ||
         typeof input.displayName === 'string') &&
        (input.photoURL === undefined ||
         input.photoURL === null ||
         typeof input.photoURL === 'string')
    );
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Email regex pattern (basic validation)
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    return EMAIL_REGEX.test(email);
}

/**
 * Validate display name
 */
export function isValidDisplayName(name: string | null): boolean {
    if (name === null) return true;
    return name.length > 0 && name.length <= 100;
}

/**
 * Validate photo URL
 */
export function isValidPhotoURL(url: string | null): boolean {
    if (url === null) return true;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Validate phone number (E.164 format)
 */
export function isValidPhoneNumber(phone: string | null): boolean {
    if (phone === null) return true;
    return /^\+[1-9]\d{1,14}$/.test(phone);
}

/**
 * Sanitize user input for display name
 */
export function sanitizeDisplayName(name: string | null): string | null {
    if (name === null) return null;
    return name.trim().substring(0, 100);
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default user preferences
 */
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
    marketingEmails: true,
    orderEmails: true,
    smsNotifications: false,
    theme: 'auto',
    units: 'imperial'
};

// ============================================================================
// Firestore Converter
// ============================================================================

/**
 * Firestore data converter for UserProfile
 * Use this with Firestore SDK for automatic type conversion
 *
 * @example
 * const userRef = doc(db, 'users', uid).withConverter(userConverter);
 * const userSnap = await getDoc(userRef);
 * const user = userSnap.data(); // Typed as UserProfile
 */
export const userConverter = {
    toFirestore(user: Partial<UserProfile>): Record<string, unknown> {
        // Remove undefined values and convert to plain object
        const data: Record<string, unknown> = {};

        if (user.email !== undefined) data.email = user.email;
        if (user.displayName !== undefined) data.displayName = user.displayName;
        if (user.photoURL !== undefined) data.photoURL = user.photoURL;
        if (user.createdAt !== undefined) data.createdAt = user.createdAt;
        if (user.updatedAt !== undefined) data.updatedAt = user.updatedAt;
        if (user.lastLoginAt !== undefined) data.lastLoginAt = user.lastLoginAt;
        if (user.phoneNumber !== undefined) data.phoneNumber = user.phoneNumber;
        if (user.preferences !== undefined) data.preferences = user.preferences;
        if (user.subscription !== undefined) data.subscription = user.subscription;
        if (user.referralCode !== undefined) data.referralCode = user.referralCode;
        if (user.referredBy !== undefined) data.referredBy = user.referredBy;
        if (user.lifetimeValue !== undefined) data.lifetimeValue = user.lifetimeValue;
        if (user.status !== undefined) data.status = user.status;

        return data;
    },

    fromFirestore(snapshot: any): UserProfile {
        const data = snapshot.data();
        return {
            email: data.email,
            displayName: data.displayName ?? null,
            photoURL: data.photoURL ?? null,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            lastLoginAt: data.lastLoginAt,
            phoneNumber: data.phoneNumber,
            preferences: data.preferences,
            subscription: data.subscription,
            referralCode: data.referralCode,
            referredBy: data.referredBy,
            lifetimeValue: data.lifetimeValue,
            status: data.status ?? 'active'
        };
    }
};
