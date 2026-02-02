/**
 * Zod Schema Definitions for User Profile
 *
 * Provides runtime validation using Zod library
 * Use these schemas for validating user input before Firestore writes
 *
 * Installation:
 * npm install zod
 *
 * Usage:
 * import { createUserSchema, updateUserSchema } from './schemas/user-schema.zod';
 * const result = createUserSchema.safeParse(userData);
 */

import { z } from 'zod';

// ============================================================================
// Validation Constants
// ============================================================================

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Phone number validation (E.164 format)
 */
const PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * Photo URL validation (HTTP/HTTPS only)
 */
const URL_REGEX = /^https?:\/\/.+/;

// ============================================================================
// Firestore Timestamp Schema
// ============================================================================

/**
 * Firestore Timestamp object schema
 */
const firestoreTimestampSchema = z.object({
    _seconds: z.number(),
    _nanoseconds: z.number()
}).or(
    // Also accept Date objects (will be converted)
    z.date()
).or(
    // Accept special serverTimestamp sentinel
    z.any().refine(
        (val) => val?.constructor?.name === 'FieldValue',
        'Must be a Firestore Timestamp, Date, or serverTimestamp()'
    )
);

// ============================================================================
// Preference Schemas
// ============================================================================

/**
 * User preferences schema
 */
export const userPreferencesSchema = z.object({
    marketingEmails: z.boolean()
        .describe('Opt-in for marketing emails'),

    orderEmails: z.boolean()
        .describe('Opt-in for order update emails'),

    smsNotifications: z.boolean()
        .describe('Opt-in for SMS notifications'),

    theme: z.enum(['light', 'dark', 'auto'])
        .describe('Preferred UI theme'),

    units: z.enum(['metric', 'imperial'])
        .describe('Preferred measurement units')
}).strict();

/**
 * Partial user preferences (for updates)
 */
export const partialUserPreferencesSchema = userPreferencesSchema.partial();

// ============================================================================
// Subscription Schema
// ============================================================================

/**
 * Subscription information schema
 */
export const subscriptionSchema = z.object({
    planId: z.string()
        .min(1)
        .describe('Subscription plan identifier'),

    stripeSubscriptionId: z.string()
        .regex(/^sub_[a-zA-Z0-9]+$/, 'Invalid Stripe subscription ID')
        .describe('Stripe subscription ID'),

    status: z.enum(['active', 'past_due', 'canceled', 'trialing'])
        .describe('Current subscription status'),

    currentPeriodStart: firestoreTimestampSchema
        .describe('Start of current billing period'),

    currentPeriodEnd: firestoreTimestampSchema
        .describe('End of current billing period'),

    cancelAtPeriodEnd: z.boolean()
        .describe('Whether subscription will cancel at period end')
}).strict();

// ============================================================================
// User Profile Schemas
// ============================================================================

/**
 * Core user profile schema (complete document)
 */
export const userProfileSchema = z.object({
    // Required fields
    email: z.string()
        .min(3, 'Email must be at least 3 characters')
        .max(254, 'Email must not exceed 254 characters')
        .regex(EMAIL_REGEX, 'Invalid email format')
        .describe('User email address from Firebase Auth'),

    createdAt: firestoreTimestampSchema
        .describe('Account creation timestamp'),

    updatedAt: firestoreTimestampSchema
        .describe('Last profile update timestamp'),

    // Optional profile fields
    displayName: z.string()
        .min(1, 'Display name must not be empty')
        .max(100, 'Display name must not exceed 100 characters')
        .nullable()
        .describe('User display name'),

    photoURL: z.string()
        .min(10, 'Photo URL too short')
        .max(2048, 'Photo URL too long')
        .regex(URL_REGEX, 'Photo URL must be HTTP or HTTPS')
        .nullable()
        .describe('User profile photo URL'),

    lastLoginAt: firestoreTimestampSchema
        .optional()
        .describe('Last successful login timestamp'),

    // Extended fields
    phoneNumber: z.string()
        .regex(PHONE_REGEX, 'Phone number must be in E.164 format (e.g., +12025551234)')
        .nullable()
        .optional()
        .describe('User phone number in E.164 format'),

    preferences: userPreferencesSchema
        .optional()
        .describe('User communication and UX preferences'),

    subscription: subscriptionSchema
        .optional()
        .describe('Active subscription information'),

    referralCode: z.string()
        .regex(/^[A-Z0-9]{6,12}$/, 'Referral code must be 6-12 uppercase alphanumeric characters')
        .optional()
        .describe('Unique referral code assigned to user'),

    referredBy: z.string()
        .length(28, 'Referrer UID must be 28 characters')
        .nullable()
        .optional()
        .describe('UID of user who referred this user'),

    lifetimeValue: z.number()
        .int('Lifetime value must be an integer')
        .min(0, 'Lifetime value cannot be negative')
        .optional()
        .describe('Total lifetime value in cents'),

    status: z.enum(['active', 'suspended', 'deleted'])
        .optional()
        .default('active')
        .describe('Account status')
}).strict();

/**
 * User creation schema (for signup)
 */
export const createUserSchema = z.object({
    email: z.string()
        .min(3)
        .max(254)
        .regex(EMAIL_REGEX, 'Invalid email format'),

    displayName: z.string()
        .min(1)
        .max(100)
        .nullable()
        .optional(),

    photoURL: z.string()
        .min(10)
        .max(2048)
        .regex(URL_REGEX)
        .nullable()
        .optional(),

    phoneNumber: z.string()
        .regex(PHONE_REGEX)
        .nullable()
        .optional(),

    preferences: partialUserPreferencesSchema
        .optional()

    // Note: createdAt and updatedAt are added automatically via serverTimestamp()
    // Protected fields like lifetimeValue, subscription cannot be set during creation
}).strict();

/**
 * User update schema (for profile edits)
 */
export const updateUserSchema = z.object({
    displayName: z.string()
        .min(1)
        .max(100)
        .nullable()
        .optional(),

    photoURL: z.string()
        .min(10)
        .max(2048)
        .regex(URL_REGEX)
        .nullable()
        .optional(),

    phoneNumber: z.string()
        .regex(PHONE_REGEX)
        .nullable()
        .optional(),

    preferences: partialUserPreferencesSchema
        .optional()

    // Note: email, createdAt are immutable and cannot be updated
    // updatedAt is automatically set via serverTimestamp()
    // Protected fields like lifetimeValue, subscription can only be updated by Cloud Functions
}).strict();

/**
 * User login sync schema (for syncing profile on login)
 */
export const loginSyncSchema = z.object({
    email: z.string()
        .min(3)
        .max(254)
        .regex(EMAIL_REGEX),

    displayName: z.string()
        .min(1)
        .max(100)
        .nullable()
        .optional(),

    photoURL: z.string()
        .min(10)
        .max(2048)
        .regex(URL_REGEX)
        .nullable()
        .optional()

    // lastLoginAt and updatedAt are set automatically via serverTimestamp()
}).strict();

// ============================================================================
// Subcollection Schemas
// ============================================================================

/**
 * Address schema (for users/{uid}/addresses subcollection)
 */
export const addressSchema = z.object({
    name: z.string()
        .min(1, 'Name is required')
        .max(100, 'Name too long')
        .describe('Recipient name'),

    line1: z.string()
        .min(1, 'Address line 1 is required')
        .max(200, 'Address line 1 too long')
        .describe('Street address line 1'),

    line2: z.string()
        .max(200, 'Address line 2 too long')
        .optional()
        .describe('Street address line 2 (apt, suite, etc.)'),

    city: z.string()
        .min(1, 'City is required')
        .max(100, 'City name too long')
        .describe('City'),

    state: z.string()
        .length(2, 'State must be 2-letter code')
        .regex(/^[A-Z]{2}$/, 'State must be uppercase 2-letter code')
        .describe('State (2-letter code)'),

    postalCode: z.string()
        .min(5, 'Postal code too short')
        .max(10, 'Postal code too long')
        .describe('ZIP/Postal code'),

    country: z.enum(['US', 'CA'])
        .describe('Country (US or CA only)'),

    phoneNumber: z.string()
        .regex(PHONE_REGEX)
        .optional()
        .describe('Contact phone number'),

    isDefault: z.boolean()
        .optional()
        .default(false)
        .describe('Whether this is the default address')
}).strict();

/**
 * Wishlist item schema (for users/{uid}/wishlist subcollection)
 */
export const wishlistItemSchema = z.object({
    productId: z.string()
        .min(1, 'Product ID is required')
        .describe('Product identifier'),

    addedAt: firestoreTimestampSchema
        .describe('When item was added to wishlist'),

    priceId: z.string()
        .min(1)
        .optional()
        .describe('Stripe price ID for the product'),

    name: z.string()
        .min(1)
        .optional()
        .describe('Product name (cached for display)'),

    price: z.number()
        .min(0)
        .optional()
        .describe('Product price in cents (cached for display)'),

    image: z.string()
        .optional()
        .describe('Product image URL (cached for display)')
}).strict();

// ============================================================================
// Type Inference
// ============================================================================

/**
 * Infer TypeScript types from Zod schemas
 */
export type UserProfile = z.infer<typeof userProfileSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginSyncInput = z.infer<typeof loginSyncSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type Subscription = z.infer<typeof subscriptionSchema>;
export type Address = z.infer<typeof addressSchema>;
export type WishlistItem = z.infer<typeof wishlistItemSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate and parse user creation data
 * @throws ZodError if validation fails
 */
export function validateCreateUser(data: unknown): CreateUserInput {
    return createUserSchema.parse(data);
}

/**
 * Safely validate user creation data (returns result object)
 */
export function safeValidateCreateUser(data: unknown) {
    return createUserSchema.safeParse(data);
}

/**
 * Validate and parse user update data
 * @throws ZodError if validation fails
 */
export function validateUpdateUser(data: unknown): UpdateUserInput {
    return updateUserSchema.parse(data);
}

/**
 * Safely validate user update data (returns result object)
 */
export function safeValidateUpdateUser(data: unknown) {
    return updateUserSchema.safeParse(data);
}

/**
 * Validate and parse address data
 * @throws ZodError if validation fails
 */
export function validateAddress(data: unknown): Address {
    return addressSchema.parse(data);
}

/**
 * Safely validate address data (returns result object)
 */
export function safeValidateAddress(data: unknown) {
    return addressSchema.safeParse(data);
}

/**
 * Validate and parse wishlist item data
 * @throws ZodError if validation fails
 */
export function validateWishlistItem(data: unknown): WishlistItem {
    return wishlistItemSchema.parse(data);
}

/**
 * Safely validate wishlist item data (returns result object)
 */
export function safeValidateWishlistItem(data: unknown) {
    return wishlistItemSchema.safeParse(data);
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Format Zod validation errors for user-friendly display
 */
export function formatZodError(error: z.ZodError): string[] {
    return error.errors.map(err => {
        const path = err.path.join('.');
        return path ? `${path}: ${err.message}` : err.message;
    });
}

/**
 * Get first validation error message
 */
export function getFirstError(error: z.ZodError): string {
    const formatted = formatZodError(error);
    return formatted[0] || 'Validation failed';
}

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Example: Validate user creation
 *
 * ```typescript
 * import { safeValidateCreateUser } from './schemas/user-schema.zod';
 *
 * const result = safeValidateCreateUser({
 *     email: 'user@example.com',
 *     displayName: 'John Doe',
 *     photoURL: null
 * });
 *
 * if (result.success) {
 *     // Data is valid, safe to use
 *     await createUserInFirestore(result.data);
 * } else {
 *     // Validation failed, show errors
 *     const errors = formatZodError(result.error);
 *     console.error('Validation errors:', errors);
 * }
 * ```
 */

/**
 * Example: Validate user update
 *
 * ```typescript
 * import { validateUpdateUser } from './schemas/user-schema.zod';
 *
 * try {
 *     const validData = validateUpdateUser({
 *         displayName: 'Jane Doe',
 *         preferences: {
 *             theme: 'dark',
 *             marketingEmails: false
 *         }
 *     });
 *
 *     await updateUserInFirestore(userId, validData);
 * } catch (error) {
 *     if (error instanceof z.ZodError) {
 *         console.error('Invalid data:', formatZodError(error));
 *     }
 * }
 * ```
 */

/**
 * Example: Validate address
 *
 * ```typescript
 * import { safeValidateAddress } from './schemas/user-schema.zod';
 *
 * const result = safeValidateAddress({
 *     name: 'John Doe',
 *     line1: '123 Main St',
 *     city: 'San Francisco',
 *     state: 'CA',
 *     postalCode: '94105',
 *     country: 'US'
 * });
 *
 * if (!result.success) {
 *     console.error('Invalid address:', formatZodError(result.error));
 * }
 * ```
 */
