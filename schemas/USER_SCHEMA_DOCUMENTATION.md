# User Schema Documentation

## Overview

This document provides comprehensive documentation for the Firestore user account schema used in the Apex Labs peptide therapy platform.

**Collection Path**: `users/{uid}`

**Related Files**:
- `schemas/user-schema.ts` - TypeScript interfaces and type guards
- `schemas/user-schema.json` - JSON Schema for validation
- `schemas/firestore-rules-users.rules` - Security rules
- `js/auth.js` - Authentication implementation

---

## Document Structure

### Core Fields (Required)

#### `email` (string)
- **Description**: User's email address from Firebase Authentication
- **Source**: Firebase Auth `user.email`
- **Validation**: Valid email format, 3-254 characters
- **Indexed**: Yes (for user lookup)
- **Mutable**: No (immutable after creation)
- **Example**: `"john.doe@example.com"`

#### `createdAt` (Timestamp)
- **Description**: Account creation timestamp
- **Source**: `firebase.firestore.FieldValue.serverTimestamp()`
- **Set**: Once during initial signup
- **Mutable**: No (immutable after creation)
- **Example**: `Timestamp { seconds: 1706745600, nanoseconds: 0 }`

#### `updatedAt` (Timestamp)
- **Description**: Last profile update timestamp
- **Source**: `firebase.firestore.FieldValue.serverTimestamp()`
- **Updated**: On signup and every login
- **Mutable**: Yes (auto-updated)
- **Example**: `Timestamp { seconds: 1706831000, nanoseconds: 0 }`

### Profile Fields (Optional)

#### `displayName` (string | null)
- **Description**: User's display name
- **Source**:
  - Email/Password: User input during signup
  - Google OAuth: `user.displayName`
  - Fallback: Email prefix (e.g., "john" from "john@example.com")
- **Validation**: 1-100 characters or null
- **Mutable**: Yes (user can update)
- **Example**: `"John Doe"` or `null`

#### `photoURL` (string | null)
- **Description**: User's profile photo URL
- **Source**:
  - Email/Password: null initially, user can upload
  - Google OAuth: `user.photoURL` (auto-populated)
- **Validation**: Valid HTTP/HTTPS URL, 10-2048 characters, or null
- **Mutable**: Yes (user can update)
- **Example**: `"https://lh3.googleusercontent.com/a/example"` or `null`

#### `lastLoginAt` (Timestamp | undefined)
- **Description**: Last successful login timestamp
- **Source**: `firebase.firestore.FieldValue.serverTimestamp()`
- **Set**: On each login (not during signup)
- **Mutable**: Yes (auto-updated on login)
- **Note**: Undefined for newly created accounts until first login
- **Example**: `Timestamp { seconds: 1706917400, nanoseconds: 0 }`

### Extended Fields (Future)

#### `phoneNumber` (string | null)
- **Description**: User's phone number for SMS notifications
- **Format**: E.164 format (e.g., `+12025551234`)
- **Validation**: Regex `^\+[1-9]\d{1,14}$`
- **Mutable**: Yes (user can update)
- **Status**: Planned for order updates and SMS notifications

#### `preferences` (object)
- **Description**: User communication and UX preferences
- **Structure**:
  ```typescript
  {
      marketingEmails: boolean;    // Default: true
      orderEmails: boolean;        // Default: true
      smsNotifications: boolean;   // Default: false
      theme: 'light' | 'dark' | 'auto';  // Default: 'auto'
      units: 'metric' | 'imperial';      // Default: 'imperial'
  }
  ```
- **Mutable**: Yes (user can update)
- **Status**: Planned for notification and UX customization

#### `subscription` (object)
- **Description**: Active subscription information
- **Structure**:
  ```typescript
  {
      planId: string;
      stripeSubscriptionId: string;
      status: 'active' | 'past_due' | 'canceled' | 'trialing';
      currentPeriodStart: Timestamp;
      currentPeriodEnd: Timestamp;
      cancelAtPeriodEnd: boolean;
  }
  ```
- **Mutable**: No (managed by Cloud Functions)
- **Status**: Planned for recurring peptide therapy programs

#### `referralCode` (string)
- **Description**: Unique referral code assigned to user
- **Format**: 6-12 uppercase alphanumeric characters
- **Example**: `"APEX2024"`, `"PEPTIDE123"`
- **Mutable**: No (auto-generated)
- **Status**: Planned for referral program

#### `referredBy` (string | null)
- **Description**: UID of user who referred this user
- **Format**: 28-character Firebase UID
- **Set**: Once during signup if referral code provided
- **Mutable**: No (immutable after creation)
- **Status**: Planned for referral program

#### `lifetimeValue` (number)
- **Description**: Total lifetime value in cents
- **Calculated**: From order history
- **Example**: `89900` (represents $899.00)
- **Mutable**: No (calculated by Cloud Functions)
- **Status**: Planned for analytics and marketing

#### `status` (string)
- **Description**: Account status for management
- **Values**: `'active'` | `'suspended'` | `'deleted'`
- **Default**: `'active'`
- **Mutable**: No (admin only)
- **Status**: Planned for account management and GDPR compliance

---

## Data Flow

### User Signup Flow

#### Email/Password Signup
```javascript
// 1. Create Firebase Auth account
const result = await auth.createUserWithEmailAndPassword(email, password);

// 2. Update auth profile with display name
await result.user.updateProfile({ displayName: name });

// 3. Create Firestore profile
await db.collection('users').doc(result.user.uid).set({
    email: result.user.email,
    displayName: name,
    photoURL: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
}, { merge: true });
```

#### Google OAuth Signup
```javascript
// 1. Sign in with Google popup
const result = await auth.signInWithPopup(googleProvider);

// 2. Check if new user
if (result.additionalUserInfo?.isNewUser) {
    // 3. Create Firestore profile
    await db.collection('users').doc(result.user.uid).set({
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    }, { merge: true });
}
```

### User Login Flow

```javascript
// 1. Sign in (email/password or Google)
const result = await auth.signInWithEmailAndPassword(email, password);

// 2. Sync profile data
await db.collection('users').doc(result.user.uid).set({
    email: result.user.email,
    displayName: result.user.displayName,
    photoURL: result.user.photoURL,
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp()
}, { merge: true });
```

### Profile Update Flow

```javascript
// User updates their profile
await db.collection('users').doc(userId).update({
    displayName: newName,
    photoURL: newPhotoURL,
    updatedAt: serverTimestamp()
});
```

---

## Security Rules

### Read Access
- **Own Profile**: Users can read their own profile
- **Admin Access**: Admins can read any profile
- **Public Access**: No public read access

### Write Access

#### Create (Signup)
- User must be authenticated
- User can only create their own profile (`userId == auth.uid`)
- Must provide valid `email`, `createdAt`, `updatedAt`
- Email must match Firebase Auth email
- Cannot set protected fields: `lastLoginAt`, `lifetimeValue`, `referredBy`

#### Update (Profile Edit)
- User must be authenticated
- User can only update their own profile
- **Immutable fields**: `email`, `createdAt`, `uid`
- **User-editable fields**: `displayName`, `photoURL`, `phoneNumber`, `preferences`
- **System-managed fields**: `updatedAt`, `lastLoginAt` (auto-updated)
- **Protected fields**: `lifetimeValue`, `subscription`, `status` (admin/Cloud Functions only)

#### Delete
- Only admins can delete profiles
- For GDPR compliance, set `status: 'deleted'` instead of deleting

### Validation Rules

All writes are validated for:
- **Email format**: `^[^\s@]+@[^\s@]+\.[^\s@]+$` (3-254 chars)
- **Display name**: 1-100 characters or null
- **Photo URL**: Valid HTTP/HTTPS URL (10-2048 chars) or null
- **Phone number**: E.164 format `^\+[1-9]\d{1,14}$` or null
- **Preferences**: Object with valid keys and types
- **Status**: One of `'active'`, `'suspended'`, `'deleted'`

---

## Subcollections

### `users/{userId}/orders`
- **Purpose**: User's order history
- **Read**: User can read their own orders
- **Write**: Only Cloud Functions (from Stripe webhooks)
- **Fields**: Order data from Stripe checkout sessions

### `users/{userId}/addresses`
- **Purpose**: Saved shipping addresses
- **Read/Write**: User can manage their own addresses
- **Validation**: Required fields: `name`, `line1`, `city`, `state`, `postalCode`, `country`
- **Country**: Limited to US and CA

### `users/{userId}/wishlist`
- **Purpose**: Products saved for later
- **Read/Write**: User can manage their own wishlist
- **Fields**: `productId`, `addedAt`

---

## TypeScript Usage

### Reading User Data

```typescript
import { doc, getDoc } from 'firebase/firestore';
import { userConverter, UserProfile } from './schemas/user-schema';

const userRef = doc(db, 'users', userId).withConverter(userConverter);
const userSnap = await getDoc(userRef);

if (userSnap.exists()) {
    const user: UserProfile = userSnap.data();
    console.log(user.email, user.displayName);
}
```

### Creating User Profile

```typescript
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { CreateUserInput } from './schemas/user-schema';

const input: CreateUserInput = {
    email: 'user@example.com',
    displayName: 'John Doe',
    photoURL: null
};

await setDoc(doc(db, 'users', userId), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
}, { merge: true });
```

### Updating User Profile

```typescript
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { UpdateUserInput } from './schemas/user-schema';

const updates: UpdateUserInput = {
    displayName: 'Jane Doe',
    preferences: {
        theme: 'dark',
        marketingEmails: false
    }
};

await updateDoc(doc(db, 'users', userId), {
    ...updates,
    updatedAt: serverTimestamp()
});
```

### Type Guards

```typescript
import { isUserProfile, isValidEmail } from './schemas/user-schema';

// Validate runtime data
if (isUserProfile(data)) {
    // TypeScript knows data is UserProfile
    console.log(data.email);
}

// Validate email
if (isValidEmail(email)) {
    // Email format is valid
}
```

---

## JSON Schema Validation

The JSON Schema can be used with validation libraries like Ajv:

```javascript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import userSchema from './schemas/user-schema.json';

const ajv = new Ajv();
addFormats(ajv);

const validate = ajv.compile(userSchema);

// Validate user data
const isValid = validate(userData);
if (!isValid) {
    console.error(validate.errors);
}
```

---

## Migration Guide

### Adding New Fields

When adding new fields to the schema:

1. **Update TypeScript interface** (`user-schema.ts`)
   - Add field with proper type
   - Add JSDoc comment
   - Mark as optional with `?` if not required

2. **Update JSON Schema** (`user-schema.json`)
   - Add property definition
   - Add validation rules
   - Update examples

3. **Update Security Rules** (`firestore-rules-users.rules`)
   - Add validation function if needed
   - Update create/update rules
   - Add to protected/editable field lists

4. **Update Documentation** (this file)
   - Document field purpose and usage
   - Add to appropriate section
   - Update data flow examples

5. **Test**
   - Write unit tests for validators
   - Test security rules in Firebase console
   - Verify type safety in TypeScript

### Backward Compatibility

When modifying existing fields:
- **Never change field types** (breaks existing data)
- **Never remove required fields** (breaks existing documents)
- **Use optional fields** for new additions
- **Provide default values** for missing fields
- **Use migration Cloud Functions** for data transformation

---

## Best Practices

### Data Integrity
1. Always use `serverTimestamp()` for timestamps (not client time)
2. Validate all user input before writing to Firestore
3. Use type guards for runtime validation
4. Never trust client-provided timestamps

### Security
1. Never expose sensitive data in user documents
2. Use subcollections for private data (orders, addresses)
3. Validate all writes in security rules
4. Implement rate limiting for profile updates

### Performance
1. Index email field for user lookup
2. Keep user documents small (<1KB recommended)
3. Use subcollections for large datasets
4. Cache user profiles in client memory

### Privacy & Compliance
1. Use `status: 'deleted'` instead of deleting documents (audit trail)
2. Implement data export for GDPR compliance
3. Allow users to opt-out of marketing
4. Secure PII with proper security rules

---

## Testing

### Security Rules Testing

```javascript
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

// Test user can read own profile
await assertSucceeds(
    getDoc(doc(db, 'users', myUserId))
);

// Test user cannot read other profiles
await assertFails(
    getDoc(doc(db, 'users', otherUserId))
);

// Test email is immutable
await assertFails(
    updateDoc(doc(db, 'users', myUserId), {
        email: 'newemail@example.com'
    })
);
```

### Type Validation Testing

```typescript
import { isUserProfile, isValidEmail } from './schemas/user-schema';

describe('User Schema Validators', () => {
    test('validates correct email format', () => {
        expect(isValidEmail('user@example.com')).toBe(true);
        expect(isValidEmail('invalid')).toBe(false);
    });

    test('validates user profile structure', () => {
        const validUser = {
            email: 'user@example.com',
            displayName: 'John Doe',
            photoURL: null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
        expect(isUserProfile(validUser)).toBe(true);
    });
});
```

---

## Troubleshooting

### Common Issues

**"Permission denied" on profile creation**
- Verify user is authenticated
- Check userId matches auth.uid
- Ensure email matches Firebase Auth email
- Verify all required fields are present

**"Permission denied" on profile update**
- Check user owns the profile
- Verify immutable fields haven't changed
- Ensure updatedAt is set to serverTimestamp()
- Check validation rules for all modified fields

**Type errors in TypeScript**
- Import types from `user-schema.ts`
- Use `userConverter` for Firestore operations
- Use type guards for runtime validation
- Check for null/undefined handling

**Schema validation failures**
- Verify field types match schema
- Check string length constraints
- Validate URL and email formats
- Ensure timestamp objects are properly formatted

---

## Future Enhancements

### Planned Features
1. **Referral Program**: Track referrals and rewards
2. **Subscription Management**: Recurring peptide therapy programs
3. **Loyalty Points**: Track and reward customer engagement
4. **Communication Preferences**: Granular notification settings
5. **Account Linking**: Link multiple auth providers
6. **Two-Factor Authentication**: Enhanced security
7. **Profile Verification**: Email and phone verification status
8. **Custom Claims**: Role-based access control

### Considerations
- Maintain backward compatibility
- Add fields as optional
- Use feature flags for gradual rollout
- Document migration path
- Test thoroughly before deployment

---

## Support

For questions or issues:
- Review this documentation
- Check `js/auth.js` implementation
- Test with Firebase Rules Playground
- Review Firestore console for data structure

## Version History

- **v1.0** (2026-02-01): Initial schema definition
  - Core profile fields
  - Basic security rules
  - TypeScript interfaces
  - JSON schema validation
