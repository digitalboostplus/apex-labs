# Firestore Schemas

Comprehensive schema definitions for the Apex Labs Firestore database.

## Overview

This directory contains TypeScript interfaces, JSON schemas, Zod schemas, security rules, and documentation for all Firestore collections used in the Apex Labs peptide therapy platform.

## Files

### User Account Schemas

| File | Purpose | Use Case |
|------|---------|----------|
| `user-schema.ts` | TypeScript interfaces and type guards | Type safety in application code |
| `user-schema.json` | JSON Schema (Draft-07) | API validation, OpenAPI specs |
| `user-schema.zod.ts` | Zod runtime validation schemas | Form validation, API input validation |
| `firestore-rules-users.rules` | Firestore security rules | Database access control |
| `USER_SCHEMA_DOCUMENTATION.md` | Complete documentation | Developer reference |

## Quick Start

### TypeScript Usage

```typescript
import { UserProfile, userConverter } from './schemas/user-schema';
import { doc, getDoc } from 'firebase/firestore';

// Read user profile with type safety
const userRef = doc(db, 'users', userId).withConverter(userConverter);
const userSnap = await getDoc(userRef);

if (userSnap.exists()) {
    const user: UserProfile = userSnap.data();
    console.log(user.email, user.displayName);
}
```

### Zod Validation

```typescript
import { safeValidateCreateUser, formatZodError } from './schemas/user-schema.zod';

// Validate user input before creating account
const result = safeValidateCreateUser({
    email: userInput.email,
    displayName: userInput.name,
    photoURL: null
});

if (result.success) {
    // Data is valid, safe to create user
    await createUserProfile(result.data);
} else {
    // Show validation errors to user
    const errors = formatZodError(result.error);
    showErrorMessages(errors);
}
```

### JSON Schema Validation

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import userSchema from './schemas/user-schema.json';

const ajv = new Ajv();
addFormats(ajv);
const validate = ajv.compile(userSchema);

if (!validate(userData)) {
    console.error('Validation errors:', validate.errors);
}
```

## User Collection Structure

```
users/{uid}
├── email (string, required)
├── displayName (string | null)
├── photoURL (string | null)
├── createdAt (Timestamp)
├── updatedAt (Timestamp)
├── lastLoginAt (Timestamp, optional)
├── phoneNumber (string | null, optional)
├── preferences (object, optional)
├── subscription (object, optional)
├── referralCode (string, optional)
├── referredBy (string | null, optional)
├── lifetimeValue (number, optional)
└── status (string, optional)

Subcollections:
├── /orders/{orderId} - User's order history (read-only)
├── /addresses/{addressId} - Saved shipping addresses
└── /wishlist/{productId} - Wishlist items
```

## Field Descriptions

### Core Fields (Required)

- **email**: User's email address from Firebase Auth (immutable)
- **createdAt**: Account creation timestamp (immutable)
- **updatedAt**: Last profile update timestamp (auto-updated)

### Profile Fields (Optional)

- **displayName**: User's display name (1-100 chars or null)
- **photoURL**: Profile photo URL (HTTP/HTTPS or null)
- **lastLoginAt**: Last successful login timestamp

### Extended Fields (Future)

- **phoneNumber**: E.164 format phone number for SMS
- **preferences**: Communication and UX preferences
- **subscription**: Active subscription information
- **referralCode**: Unique referral code (6-12 alphanumeric)
- **referredBy**: UID of referring user
- **lifetimeValue**: Total customer value in cents
- **status**: Account status (active/suspended/deleted)

## Security Rules

### Read Access
- Users can read their own profile
- Admins can read any profile
- No public read access

### Write Access

**Create (Signup)**
- Must be authenticated
- Can only create own profile
- Email must match Firebase Auth
- Cannot set protected fields

**Update (Profile Edit)**
- Must be authenticated
- Can only update own profile
- Cannot modify: email, createdAt
- Can modify: displayName, photoURL, phoneNumber, preferences
- Protected fields (admin/Cloud Functions only): lifetimeValue, subscription, status

**Delete**
- Only admins can delete
- Use `status: 'deleted'` for GDPR compliance

## Validation Rules

All schemas enforce:

- **Email**: Valid format, 3-254 characters
- **Display Name**: 1-100 characters or null
- **Photo URL**: Valid HTTP/HTTPS URL or null
- **Phone Number**: E.164 format (`^\+[1-9]\d{1,14}$`)
- **Timestamps**: Firestore Timestamp objects
- **Preferences**: Valid keys and value types
- **Status**: One of `active`, `suspended`, `deleted`

## Type Safety

### TypeScript Benefits

1. **Compile-time type checking** - Catch errors before runtime
2. **IntelliSense support** - Auto-completion in IDEs
3. **Refactoring safety** - Rename fields across entire codebase
4. **Documentation** - JSDoc comments in interfaces

### Runtime Validation

1. **Zod schemas** - Validate user input at runtime
2. **Type guards** - Check data structure at runtime
3. **JSON Schema** - Validate API payloads
4. **Security rules** - Server-side validation in Firestore

## Integration with Existing Code

The schemas are designed to work with the existing authentication system:

### `js/auth.js` Integration

The existing `AuthManager` class already implements the user profile creation and syncing:

```javascript
// Existing code in js/auth.js
async _createUserProfile(user, profile = {}) {
    await db.collection('users').doc(user.uid).set({
        email: user.email,
        displayName: profile.displayName || user.displayName || null,
        photoURL: profile.photoURL || user.photoURL || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

async _syncUserProfile(user) {
    await db.collection('users').doc(user.uid).set({
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}
```

### Enhanced with Schemas

```typescript
import { safeValidateCreateUser, safeValidateUpdateUser } from './schemas/user-schema.zod';

// Validate before creating profile
async _createUserProfile(user, profile = {}) {
    const result = safeValidateCreateUser({
        email: user.email,
        displayName: profile.displayName || user.displayName,
        photoURL: profile.photoURL || user.photoURL
    });

    if (!result.success) {
        throw new Error('Invalid profile data: ' + formatZodError(result.error));
    }

    await db.collection('users').doc(user.uid).set({
        ...result.data,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}
```

## Testing

### Security Rules Testing

```typescript
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';

test('user can read own profile', async () => {
    await assertSucceeds(
        getDoc(doc(db, 'users', myUserId))
    );
});

test('user cannot read other profiles', async () => {
    await assertFails(
        getDoc(doc(db, 'users', otherUserId))
    );
});

test('email is immutable', async () => {
    await assertFails(
        updateDoc(doc(db, 'users', myUserId), {
            email: 'newemail@example.com'
        })
    );
});
```

### Schema Validation Testing

```typescript
import { isValidEmail, isUserProfile } from './schemas/user-schema';

test('validates email format', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('invalid')).toBe(false);
});

test('validates user profile structure', () => {
    const user = {
        email: 'user@example.com',
        displayName: 'John Doe',
        photoURL: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    };
    expect(isUserProfile(user)).toBe(true);
});
```

## Deployment

### Update Firestore Rules

1. Review the rules in `firestore-rules-users.rules`
2. Integrate into main `firestore.rules` file
3. Test in Firebase Console Rules Playground
4. Deploy with Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

### TypeScript Setup

1. Ensure TypeScript is configured in `tsconfig.json`
2. Import schemas in your code
3. Use with Firestore SDK v9+ modular API

### Zod Setup

1. Install Zod: `npm install zod`
2. Import validation functions
3. Use in form handlers and API routes

## Best Practices

### Data Integrity
1. Always use `serverTimestamp()` for timestamps
2. Validate all user input before writing
3. Use type guards for runtime validation
4. Never trust client-provided timestamps

### Security
1. Never expose sensitive data
2. Use subcollections for private data
3. Validate all writes in security rules
4. Implement rate limiting

### Performance
1. Index email field for lookup
2. Keep documents small (<1KB)
3. Use subcollections for large data
4. Cache profiles in client memory

### Privacy
1. Use `status: 'deleted'` instead of deleting
2. Implement GDPR data export
3. Allow opt-out of marketing
4. Secure PII with proper rules

## Future Collections

Additional schemas to be created:

- **orders** - Order history and details
- **products** - Product catalog (if migrating from JSON)
- **reviews** - Product reviews
- **addresses** - Shipping addresses (already defined as subcollection)
- **wishlist** - Saved items (already defined as subcollection)
- **subscriptions** - Recurring billing data
- **referrals** - Referral program tracking

## Resources

- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Zod Documentation](https://zod.dev/)
- [JSON Schema Specification](https://json-schema.org/)
- [Firebase SDK Documentation](https://firebase.google.com/docs/web/setup)

## Contributing

When adding new fields or collections:

1. Update TypeScript interfaces in `*.ts` files
2. Update JSON Schema in `*.json` files
3. Update Zod schemas in `*.zod.ts` files
4. Update security rules in `*.rules` files
5. Update documentation in `*_DOCUMENTATION.md`
6. Add tests for validation logic
7. Update this README

## Support

For questions or issues:
- Review `USER_SCHEMA_DOCUMENTATION.md`
- Check existing `js/auth.js` implementation
- Test with Firebase Rules Playground
- Review Firestore console for data structure

---

**Version**: 1.0
**Last Updated**: 2026-02-01
**Maintainer**: Apex Labs Development Team
