# Schema Integration Guide

This guide shows how to integrate the new schema definitions with the existing Apex Labs codebase.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Firestore Rules Integration](#firestore-rules-integration)
3. [TypeScript Integration](#typescript-integration)
4. [Zod Validation Integration](#zod-validation-integration)
5. [Testing Integration](#testing-integration)
6. [Migration Checklist](#migration-checklist)

---

## Prerequisites

### Install Dependencies

```bash
# Install Zod for runtime validation
npm install zod

# Install TypeScript (if not already installed)
npm install --save-dev typescript @types/node

# Install type definitions for Firebase
npm install --save-dev @firebase/auth-types @firebase/firestore-types
```

### Configure TypeScript

Create or update `tsconfig.json` in the project root:

```json
{
    "compilerOptions": {
        "target": "ES2020",
        "module": "ESNext",
        "lib": ["ES2020", "DOM"],
        "moduleResolution": "node",
        "resolveJsonModule": true,
        "allowJs": true,
        "checkJs": false,
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "outDir": "./dist",
        "rootDir": ".",
        "baseUrl": ".",
        "paths": {
            "@schemas/*": ["./schemas/*"]
        }
    },
    "include": [
        "js/**/*",
        "schemas/**/*",
        "functions/**/*"
    ],
    "exclude": [
        "node_modules",
        "dist"
    ]
}
```

---

## Firestore Rules Integration

### Step 1: Review Current Rules

The existing `firestore.rules` file already has a users collection section. The new rules in `schemas/firestore-rules-users.rules` are more comprehensive.

**Current rules** (C:\antigravity\apex-labs\firestore.rules):
```javascript
match /users/{userId} {
    allow read, write: if isOwner(userId);
    // ... subcollections
}
```

### Step 2: Replace with Enhanced Rules

Replace the users section in `firestore.rules` with the enhanced rules from `schemas/firestore-rules-users.rules`:

```bash
# Backup current rules
cp firestore.rules firestore.rules.backup

# The new rules add:
# - Field-level validation (email format, display name length, etc.)
# - Immutable field protection (email, createdAt)
# - Create vs Update distinction
# - Protected field controls (lifetimeValue, subscription)
```

**Key differences**:
- Current: Simple owner-based access
- Enhanced: Field-level validation, immutability controls, role separation

### Step 3: Test Rules

Use Firebase Rules Playground before deploying:

```bash
# Test in Firebase Console:
# 1. Go to Firestore Database > Rules
# 2. Copy enhanced rules from schemas/firestore-rules-users.rules
# 3. Use Rules Playground to test scenarios
# 4. Deploy when ready
firebase deploy --only firestore:rules
```

---

## TypeScript Integration

### Option A: Migrate js/auth.js to TypeScript

Rename `js/auth.js` to `js/auth.ts` and add type annotations:

```typescript
// js/auth.ts
import {
    UserProfile,
    CreateUserInput,
    isValidEmail,
    sanitizeDisplayName,
    userConverter
} from '../schemas/user-schema';
import {
    safeValidateCreateUser,
    formatZodError
} from '../schemas/user-schema.zod';

class AuthManager {
    private user: firebase.User | null = null;
    private subscribers: Array<(event: string, data: any) => void> = [];
    private initialized: boolean = false;
    private initPromise: Promise<void> | null = null;

    /**
     * Create user profile with validation
     */
    async _createUserProfile(
        user: firebase.User,
        profile: Partial<CreateUserInput> = {}
    ): Promise<void> {
        const db = window.firebaseServices.getFirestore();
        if (!db) return;

        // Validate input data
        const result = safeValidateCreateUser({
            email: user.email!,
            displayName: profile.displayName || user.displayName,
            photoURL: profile.photoURL || user.photoURL
        });

        if (!result.success) {
            const errors = formatZodError(result.error);
            console.error('Profile validation failed:', errors);
            throw new Error('Invalid profile data: ' + errors.join(', '));
        }

        try {
            // Use validated data
            await db.collection('users').doc(user.uid).set({
                email: result.data.email,
                displayName: result.data.displayName ?? null,
                photoURL: result.data.photoURL ?? null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.error('Failed to create user profile:', error);
            throw error;
        }
    }

    /**
     * Sync user profile with validation
     */
    async _syncUserProfile(user: firebase.User): Promise<void> {
        const db = window.firebaseServices.getFirestore();
        if (!db) return;

        try {
            await db.collection('users').doc(user.uid).set({
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.error('Failed to sync user profile:', error);
        }
    }
}
```

### Option B: Keep JavaScript, Add JSDoc Types

Keep `js/auth.js` as JavaScript but add JSDoc comments for IntelliSense:

```javascript
// js/auth.js

/**
 * @typedef {import('../schemas/user-schema').UserProfile} UserProfile
 * @typedef {import('../schemas/user-schema').CreateUserInput} CreateUserInput
 */

/**
 * Create user profile in Firestore
 * @param {firebase.User} user - Firebase user
 * @param {Partial<CreateUserInput>} profile - Profile data
 * @returns {Promise<void>}
 */
async _createUserProfile(user, profile = {}) {
    const db = window.firebaseServices.getFirestore();
    if (!db) return;

    try {
        await db.collection('users').doc(user.uid).set({
            email: user.email,
            displayName: profile.displayName || user.displayName || null,
            photoURL: profile.photoURL || user.photoURL || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Failed to create user profile:', error);
    }
}
```

---

## Zod Validation Integration

### Client-Side Form Validation

Add validation to any user profile forms:

```html
<!-- Example: Profile edit form -->
<form id="profile-form">
    <input type="text" id="displayName" name="displayName" />
    <input type="url" id="photoURL" name="photoURL" />
    <button type="submit">Save</button>
</form>

<script type="module">
import { safeValidateUpdateUser, formatZodError } from './schemas/user-schema.zod.js';

document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        displayName: document.getElementById('displayName').value || null,
        photoURL: document.getElementById('photoURL').value || null
    };

    // Validate before submitting
    const result = safeValidateUpdateUser(formData);

    if (!result.success) {
        const errors = formatZodError(result.error);
        alert('Please fix the following errors:\n' + errors.join('\n'));
        return;
    }

    // Data is valid, update profile
    try {
        await updateUserProfile(result.data);
        alert('Profile updated successfully!');
    } catch (error) {
        alert('Failed to update profile: ' + error.message);
    }
});
</script>
```

### Cloud Functions Validation

Use in Cloud Functions for server-side validation:

```typescript
// functions/src/index.ts
import * as functions from 'firebase-functions';
import { safeValidateCreateUser, formatZodError } from './schemas/user-schema.zod';

export const createUserProfile = functions.auth.user().onCreate(async (user) => {
    // Validate user data before creating profile
    const result = safeValidateCreateUser({
        email: user.email!,
        displayName: user.displayName,
        photoURL: user.photoURL
    });

    if (!result.success) {
        console.error('Invalid user data:', formatZodError(result.error));
        return;
    }

    // Create profile in Firestore
    const db = admin.firestore();
    await db.collection('users').doc(user.uid).set({
        ...result.data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
});
```

---

## Testing Integration

### Add Schema Tests

Create `tests/schemas/user-schema.test.ts`:

```typescript
import { describe, test, expect } from '@jest/globals';
import {
    isValidEmail,
    isValidDisplayName,
    isValidPhotoURL,
    isValidPhoneNumber,
    sanitizeDisplayName
} from '../../schemas/user-schema';

describe('User Schema Validators', () => {
    describe('Email Validation', () => {
        test('accepts valid emails', () => {
            expect(isValidEmail('user@example.com')).toBe(true);
            expect(isValidEmail('john.doe@company.co.uk')).toBe(true);
        });

        test('rejects invalid emails', () => {
            expect(isValidEmail('invalid')).toBe(false);
            expect(isValidEmail('no@domain')).toBe(false);
            expect(isValidEmail('')).toBe(false);
        });
    });

    describe('Display Name Validation', () => {
        test('accepts valid names', () => {
            expect(isValidDisplayName('John Doe')).toBe(true);
            expect(isValidDisplayName(null)).toBe(true);
        });

        test('rejects invalid names', () => {
            expect(isValidDisplayName('')).toBe(false);
            expect(isValidDisplayName('a'.repeat(101))).toBe(false);
        });
    });

    describe('Phone Number Validation', () => {
        test('accepts E.164 format', () => {
            expect(isValidPhoneNumber('+12025551234')).toBe(true);
            expect(isValidPhoneNumber('+442071234567')).toBe(true);
            expect(isValidPhoneNumber(null)).toBe(true);
        });

        test('rejects invalid formats', () => {
            expect(isValidPhoneNumber('123456789')).toBe(false);
            expect(isValidPhoneNumber('(202) 555-1234')).toBe(false);
        });
    });

    describe('Sanitization', () => {
        test('trims and limits display names', () => {
            expect(sanitizeDisplayName('  John Doe  ')).toBe('John Doe');
            expect(sanitizeDisplayName('a'.repeat(150))).toBe('a'.repeat(100));
            expect(sanitizeDisplayName(null)).toBe(null);
        });
    });
});
```

### Add Firestore Rules Tests

Create `tests/firestore/user-rules.test.ts`:

```typescript
import {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

describe('User Collection Rules', () => {
    let testEnv: any;

    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: 'apex-labs-test',
            firestore: {
                rules: fs.readFileSync('firestore.rules', 'utf8')
            }
        });
    });

    afterAll(async () => {
        await testEnv.cleanup();
    });

    test('user can read own profile', async () => {
        const alice = testEnv.authenticatedContext('alice');
        await assertSucceeds(
            getDoc(doc(alice.firestore(), 'users/alice'))
        );
    });

    test('user cannot read other profiles', async () => {
        const alice = testEnv.authenticatedContext('alice');
        await assertFails(
            getDoc(doc(alice.firestore(), 'users/bob'))
        );
    });

    test('user can create own profile', async () => {
        const alice = testEnv.authenticatedContext('alice', {
            email: 'alice@example.com'
        });

        await assertSucceeds(
            setDoc(doc(alice.firestore(), 'users/alice'), {
                email: 'alice@example.com',
                displayName: 'Alice',
                photoURL: null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            })
        );
    });

    test('user cannot modify email', async () => {
        const alice = testEnv.authenticatedContext('alice');

        // First create profile
        await setDoc(doc(alice.firestore(), 'users/alice'), {
            email: 'alice@example.com',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // Try to change email
        await assertFails(
            updateDoc(doc(alice.firestore(), 'users/alice'), {
                email: 'newemail@example.com'
            })
        );
    });
});
```

### Run Tests

```bash
# Run schema validation tests
npm test -- tests/schemas

# Run Firestore rules tests
npm test -- tests/firestore

# Run all tests
npm test
```

---

## Migration Checklist

Use this checklist when integrating the schemas:

### Phase 1: Preparation
- [ ] Install dependencies (Zod, TypeScript)
- [ ] Configure TypeScript (tsconfig.json)
- [ ] Review existing auth.js implementation
- [ ] Backup current firestore.rules

### Phase 2: Security Rules
- [ ] Review enhanced rules in schemas/firestore-rules-users.rules
- [ ] Test rules in Firebase Rules Playground
- [ ] Deploy updated rules to development environment
- [ ] Verify existing functionality still works
- [ ] Deploy to production

### Phase 3: Type Safety
- [ ] Choose migration path (TypeScript or JSDoc)
- [ ] Add type imports to auth.js
- [ ] Update _createUserProfile with validation
- [ ] Update _syncUserProfile with validation
- [ ] Test signup flow
- [ ] Test login flow

### Phase 4: Validation
- [ ] Add Zod validation to profile forms
- [ ] Add error handling for validation failures
- [ ] Test form validation with invalid data
- [ ] Add validation to Cloud Functions (if any)

### Phase 5: Testing
- [ ] Write unit tests for validators
- [ ] Write integration tests for auth flows
- [ ] Write Firestore rules tests
- [ ] Run all tests in CI/CD pipeline

### Phase 6: Documentation
- [ ] Update team documentation
- [ ] Add inline code comments
- [ ] Document any custom validation rules
- [ ] Update API documentation (if applicable)

### Phase 7: Monitoring
- [ ] Monitor Firestore logs for validation errors
- [ ] Track auth failure rates
- [ ] Monitor user creation success rate
- [ ] Gather feedback from users

---

## Rollback Plan

If issues occur during integration:

### Immediate Rollback

```bash
# Restore previous Firestore rules
cp firestore.rules.backup firestore.rules
firebase deploy --only firestore:rules

# Remove validation code from auth.js
git checkout js/auth.js

# Redeploy
firebase deploy
```

### Gradual Migration

1. **Start with read-only integration**
   - Use schemas for type hints only
   - Don't enforce validation yet

2. **Add validation warnings**
   - Log validation errors but don't block
   - Monitor for common issues

3. **Enforce validation**
   - Block invalid data after monitoring period
   - Update rules last

---

## Common Issues

### Issue: TypeScript compilation errors

**Solution**: Ensure all types are properly imported and Firebase types are installed

```bash
npm install --save-dev @firebase/auth-types @firebase/firestore-types
```

### Issue: Zod validation too strict

**Solution**: Make optional fields truly optional in schema

```typescript
// Before (required)
displayName: z.string()

// After (optional)
displayName: z.string().nullable().optional()
```

### Issue: Firestore rules rejecting valid writes

**Solution**: Check that serverTimestamp() fields are properly detected

```javascript
// Rules should allow serverTimestamp
request.resource.data.updatedAt == request.time
```

### Issue: Existing users fail validation

**Solution**: Add migration to backfill missing fields

```typescript
// Cloud Function to migrate existing users
export const migrateUsers = functions.https.onRequest(async (req, res) => {
    const users = await admin.firestore().collection('users').get();

    for (const doc of users.docs) {
        const data = doc.data();
        const updates: any = {};

        // Add missing fields with defaults
        if (!data.displayName) {
            updates.displayName = null;
        }
        if (!data.photoURL) {
            updates.photoURL = null;
        }

        if (Object.keys(updates).length > 0) {
            await doc.ref.update(updates);
        }
    }

    res.send('Migration complete');
});
```

---

## Next Steps

After successful integration:

1. **Create schemas for other collections**
   - Orders collection
   - Products collection (if migrating from JSON)
   - Reviews collection

2. **Enhance validation**
   - Add custom validation rules
   - Implement rate limiting
   - Add abuse detection

3. **Improve type safety**
   - Migrate more JavaScript to TypeScript
   - Add strict null checks
   - Enable all TypeScript strict flags

4. **Add monitoring**
   - Track validation error rates
   - Monitor auth success rates
   - Alert on suspicious patterns

---

## Support

For questions or issues during integration:

1. Review `schemas/USER_SCHEMA_DOCUMENTATION.md`
2. Check existing `js/auth.js` implementation
3. Test with Firebase Rules Playground
4. Consult Firebase documentation
5. Create issue in project repository

---

**Last Updated**: 2026-02-01
**Integration Guide Version**: 1.0
