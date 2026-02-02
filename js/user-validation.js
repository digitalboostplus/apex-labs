/**
 * User Profile Validation
 * Uses Zod schemas for runtime validation of user data
 */

// Import Zod from CDN or npm (this will use npm installed version)
import { z } from 'https://esm.sh/zod@3';

// ============================================================================
// Zod Schemas (JavaScript-compatible)
// ============================================================================

/**
 * Email validation schema
 */
const emailSchema = z.string()
    .email('Invalid email format')
    .min(3, 'Email must be at least 3 characters')
    .max(254, 'Email must not exceed 254 characters');

/**
 * Display name validation schema
 */
const displayNameSchema = z.string()
    .min(1, 'Display name cannot be empty')
    .max(100, 'Display name must not exceed 100 characters')
    .optional()
    .nullable();

/**
 * Photo URL validation schema
 */
const photoURLSchema = z.string()
    .url('Invalid photo URL format')
    .min(10, 'Photo URL must be at least 10 characters')
    .max(2048, 'Photo URL must not exceed 2048 characters')
    .refine(url => url.startsWith('http://') || url.startsWith('https://'), {
        message: 'Photo URL must use HTTP or HTTPS protocol'
    })
    .optional()
    .nullable();

/**
 * Phone number validation schema (E.164 format)
 */
const phoneNumberSchema = z.string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format (e.g., +12125551234)')
    .optional()
    .nullable();

/**
 * User preferences schema
 */
const preferencesSchema = z.object({
    marketingEmails: z.boolean().optional(),
    orderEmails: z.boolean().optional(),
    smsNotifications: z.boolean().optional(),
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    units: z.enum(['metric', 'imperial']).optional()
}).strict().optional();

/**
 * Create user profile schema (for signup)
 */
const createUserProfileSchema = z.object({
    email: emailSchema,
    displayName: displayNameSchema,
    photoURL: photoURLSchema,
    phoneNumber: phoneNumberSchema,
    preferences: preferencesSchema,
    // Timestamps will be added by Firestore
    createdAt: z.any().optional(),
    updatedAt: z.any().optional()
}).strict();

/**
 * Update user profile schema (for profile updates)
 */
const updateUserProfileSchema = z.object({
    displayName: displayNameSchema,
    photoURL: photoURLSchema,
    phoneNumber: phoneNumberSchema,
    preferences: preferencesSchema,
    // Email and createdAt are immutable
    // updatedAt will be set by Firestore
    updatedAt: z.any().optional()
}).partial().strict();

/**
 * Login sync schema (minimal update on login)
 */
const loginSyncSchema = z.object({
    email: emailSchema.optional(),
    displayName: displayNameSchema,
    photoURL: photoURLSchema,
    lastLoginAt: z.any().optional(),
    updatedAt: z.any().optional()
}).partial().strict();

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate user profile data for creation
 * @param {Object} data - User profile data
 * @returns {{ success: boolean, data?: Object, error?: Object }}
 */
export function validateCreateUserProfile(data) {
    try {
        const validData = createUserProfileSchema.parse(data);
        return { success: true, data: validData };
    } catch (error) {
        return {
            success: false,
            error: {
                message: 'User profile validation failed',
                details: error.errors
            }
        };
    }
}

/**
 * Validate user profile data for update
 * @param {Object} data - User profile update data
 * @returns {{ success: boolean, data?: Object, error?: Object }}
 */
export function validateUpdateUserProfile(data) {
    try {
        const validData = updateUserProfileSchema.parse(data);
        return { success: true, data: validData };
    } catch (error) {
        return {
            success: false,
            error: {
                message: 'User profile update validation failed',
                details: error.errors
            }
        };
    }
}

/**
 * Validate login sync data
 * @param {Object} data - Login sync data
 * @returns {{ success: boolean, data?: Object, error?: Object }}
 */
export function validateLoginSync(data) {
    try {
        const validData = loginSyncSchema.parse(data);
        return { success: true, data: validData };
    } catch (error) {
        return {
            success: false,
            error: {
                message: 'Login sync validation failed',
                details: error.errors
            }
        };
    }
}

/**
 * Validate email only
 * @param {string} email - Email address
 * @returns {{ success: boolean, data?: string, error?: Object }}
 */
export function validateEmail(email) {
    try {
        const validEmail = emailSchema.parse(email);
        return { success: true, data: validEmail };
    } catch (error) {
        return {
            success: false,
            error: {
                message: 'Email validation failed',
                details: error.errors
            }
        };
    }
}

/**
 * Format validation errors for user display
 * @param {Object} error - Validation error object
 * @returns {string}
 */
export function formatValidationError(error) {
    if (!error || !error.details) {
        return 'Validation failed';
    }

    return error.details
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
}

// Export schemas for advanced usage
export const schemas = {
    createUserProfile: createUserProfileSchema,
    updateUserProfile: updateUserProfileSchema,
    loginSync: loginSyncSchema,
    email: emailSchema,
    displayName: displayNameSchema,
    photoURL: photoURLSchema,
    phoneNumber: phoneNumberSchema,
    preferences: preferencesSchema
};
