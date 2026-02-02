# Apex Labs Firestore Schema Documentation Index

**Version**: 1.0
**Last Updated**: 2026-02-01
**Status**: Production Ready

## Quick Navigation

| Document | Purpose | Target Audience |
|----------|---------|-----------------|
| **[README.md](./README.md)** | Overview and quick start guide | All developers |
| **[USER_SCHEMA_DOCUMENTATION.md](./USER_SCHEMA_DOCUMENTATION.md)** | Complete field reference and best practices | Backend developers, API developers |
| **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** | Step-by-step integration instructions | Frontend developers, DevOps |
| **[SCHEMA_DIAGRAM.md](./SCHEMA_DIAGRAM.md)** | Visual diagrams and flowcharts | All developers, stakeholders |

## Schema Files

### TypeScript Definitions
- **[user-schema.ts](./user-schema.ts)** - Core TypeScript interfaces and type guards
  - UserProfile interface
  - Type guards (isUserProfile, isCreateUserInput)
  - Validation helpers (isValidEmail, isValidPhoneNumber)
  - Firestore converter for type safety
  - Default values and constants

### Runtime Validation
- **[user-schema.zod.ts](./user-schema.zod.ts)** - Zod schemas for runtime validation
  - createUserSchema - Validate signup data
  - updateUserSchema - Validate profile updates
  - addressSchema - Validate shipping addresses
  - wishlistItemSchema - Validate wishlist items
  - Helper functions (validateCreateUser, formatZodError)

### API Validation
- **[user-schema.json](./user-schema.json)** - JSON Schema (Draft-07)
  - OpenAPI compatible
  - Use with Ajv or other JSON Schema validators
  - Complete field constraints and examples

### Security Rules
- **[firestore-rules-users.rules](./firestore-rules-users.rules)** - Firestore security rules
  - Comprehensive field validation
  - Immutability controls
  - Role-based access control
  - Subcollection security

### Configuration
- **[package.json](./package.json)** - NPM package configuration
  - Dependencies (Firebase, Zod)
  - Scripts (validate, test, lint)
  - Module exports

---

## What's Included

### ✅ Complete User Schema
- Core profile fields (email, displayName, photoURL)
- Timestamps (createdAt, updatedAt, lastLoginAt)
- Extended fields (phoneNumber, preferences)
- Future fields (subscription, referralCode, lifetimeValue)
- Subcollections (orders, addresses, wishlist)

### ✅ Type Safety
- TypeScript interfaces for compile-time checking
- Type guards for runtime validation
- Firestore converter for automatic type conversion
- JSDoc comments for IntelliSense support

### ✅ Runtime Validation
- Zod schemas for client-side validation
- JSON Schema for API validation
- Validation helper functions
- User-friendly error messages

### ✅ Security
- Comprehensive Firestore security rules
- Field-level validation
- Immutability controls
- Role-based access (user/admin)
- Protected field restrictions

### ✅ Documentation
- Complete field reference
- Data flow diagrams
- Integration guide with examples
- Testing strategies
- Migration checklist

### ✅ Best Practices
- GDPR compliance guidance
- Performance optimization tips
- Privacy and security recommendations
- Error handling patterns
- Backward compatibility strategies

---

## Quick Reference

### Field Categories

#### Required Fields (Cannot be null/undefined)
```typescript
email: string
createdAt: Timestamp
updatedAt: Timestamp
```

#### Optional Fields (User can set)
```typescript
displayName: string | null
photoURL: string | null
phoneNumber: string | null
preferences: UserPreferences
```

#### System Fields (Auto-managed)
```typescript
createdAt: Timestamp        // Set once on signup
updatedAt: Timestamp        // Updated on every write
lastLoginAt: Timestamp      // Updated on login
```

#### Protected Fields (Admin/Cloud Functions only)
```typescript
lifetimeValue: number
subscription: Subscription
status: 'active' | 'suspended' | 'deleted'
referralCode: string
```

### Validation Rules Summary

| Field | Type | Length | Format | Mutable |
|-------|------|--------|--------|---------|
| email | string | 3-254 | Email regex | ❌ No |
| displayName | string\|null | 1-100 | Any | ✅ Yes |
| photoURL | string\|null | 10-2048 | HTTP/HTTPS URL | ✅ Yes |
| phoneNumber | string\|null | - | E.164 (+1234567890) | ✅ Yes |
| createdAt | Timestamp | - | - | ❌ No |
| updatedAt | Timestamp | - | - | ✅ Auto |
| lastLoginAt | Timestamp | - | - | ✅ Auto |
| preferences | object | - | See schema | ✅ Yes |
| subscription | object | - | See schema | ❌ Protected |
| lifetimeValue | number | - | >= 0 | ❌ Protected |
| status | enum | - | active/suspended/deleted | ❌ Protected |

### Security Rules Summary

| Operation | User Access | Admin Access | Validation |
|-----------|-------------|--------------|------------|
| Read own profile | ✅ Allowed | ✅ Allowed | - |
| Read other profile | ❌ Denied | ✅ Allowed | - |
| Create own profile | ✅ Allowed | ✅ Allowed | Email, required fields, format validation |
| Update own profile | ✅ Allowed | ✅ Allowed | Immutability, format validation |
| Update protected fields | ❌ Denied | ✅ Allowed | Type and format validation |
| Delete profile | ❌ Denied | ✅ Allowed | - |

---

## Usage Examples

### 1. Read User Profile (TypeScript)

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

### 2. Create User Profile with Validation (Zod)

```typescript
import { safeValidateCreateUser, formatZodError } from './schemas/user-schema.zod';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';

const result = safeValidateCreateUser({
    email: 'user@example.com',
    displayName: 'John Doe',
    photoURL: null
});

if (result.success) {
    await setDoc(doc(db, 'users', userId), {
        ...result.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
} else {
    console.error(formatZodError(result.error));
}
```

### 3. Update User Profile

```typescript
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { safeValidateUpdateUser } from './schemas/user-schema.zod';

const result = safeValidateUpdateUser({
    displayName: 'Jane Doe',
    preferences: {
        theme: 'dark',
        marketingEmails: false
    }
});

if (result.success) {
    await updateDoc(doc(db, 'users', userId), {
        ...result.data,
        updatedAt: serverTimestamp()
    });
}
```

### 4. Validate with JSON Schema (Ajv)

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

---

## Integration Status

### ✅ Ready to Use
- TypeScript interfaces
- Zod validation schemas
- JSON Schema definitions
- Security rules
- Documentation

### ⏳ Requires Integration
- Deploy Firestore rules to Firebase
- Add Zod validation to forms
- Update `js/auth.js` with validation
- Add tests for validation logic

### 🔮 Future Enhancements
- Subscription management fields
- Referral program fields
- Loyalty points tracking
- Advanced preferences
- Two-factor authentication

---

## Testing Checklist

Before deploying to production:

- [ ] All TypeScript interfaces compile without errors
- [ ] Zod schemas validate sample data correctly
- [ ] JSON Schema passes validation tests
- [ ] Security rules tested in Firebase Rules Playground
- [ ] Integration tests pass for auth flows
- [ ] Unit tests pass for all validators
- [ ] Documentation reviewed and updated
- [ ] Migration plan documented
- [ ] Rollback plan documented
- [ ] Team trained on new schemas

---

## Support and Resources

### Internal Documentation
- **Field Reference**: See `USER_SCHEMA_DOCUMENTATION.md`
- **Integration Steps**: See `INTEGRATION_GUIDE.md`
- **Visual Diagrams**: See `SCHEMA_DIAGRAM.md`
- **Quick Start**: See `README.md`

### External Resources
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Zod Documentation](https://zod.dev/)
- [JSON Schema Spec](https://json-schema.org/)
- [Firebase Web SDK](https://firebase.google.com/docs/web/setup)

### Code Examples
- See `js/auth.js` for current implementation
- See `INTEGRATION_GUIDE.md` for migration examples
- See individual schema files for usage examples

---

## Version History

### v1.0 (2026-02-01) - Initial Release
- Complete user profile schema
- TypeScript interfaces and type guards
- Zod runtime validation
- JSON Schema for API validation
- Comprehensive Firestore security rules
- Full documentation suite
- Visual diagrams
- Integration guide
- Testing strategies

### Planned for v1.1
- Order schema
- Product schema (if migrating from JSON)
- Review schema
- Enhanced validation rules
- Performance optimizations

### Planned for v2.0
- Subscription management
- Referral program
- Loyalty points
- Advanced analytics
- Multi-language support

---

## File Structure

```
schemas/
├── INDEX.md                          (This file - Navigation hub)
├── README.md                         (Quick start guide)
├── USER_SCHEMA_DOCUMENTATION.md      (Complete field reference)
├── INTEGRATION_GUIDE.md              (Step-by-step integration)
├── SCHEMA_DIAGRAM.md                 (Visual diagrams)
├── package.json                      (NPM configuration)
├── user-schema.ts                    (TypeScript interfaces)
├── user-schema.zod.ts                (Zod validation)
├── user-schema.json                  (JSON Schema)
└── firestore-rules-users.rules       (Security rules)
```

---

## Contribution Guidelines

When updating schemas:

1. **Update all related files**
   - TypeScript interface
   - Zod schema
   - JSON Schema
   - Security rules
   - Documentation

2. **Maintain backward compatibility**
   - Never change field types
   - Never remove required fields
   - Use optional fields for new additions
   - Provide migration path for breaking changes

3. **Document changes**
   - Update field reference
   - Add to version history
   - Update diagrams
   - Provide code examples

4. **Test thoroughly**
   - Unit tests for validators
   - Integration tests for flows
   - Security rules tests
   - Performance tests

5. **Review and approve**
   - Code review by 2+ developers
   - Security review for rule changes
   - Documentation review
   - Stakeholder approval for breaking changes

---

## License

This schema documentation is proprietary to Apex Labs.
**UNLICENSED** - Internal use only.

---

## Contact

For questions or issues:
- Review documentation in this directory
- Check existing `js/auth.js` implementation
- Test with Firebase Rules Playground
- Create issue in project repository
- Contact development team

---

**Schema Suite Version**: 1.0
**Maintained by**: Apex Labs Development Team
**Last Review**: 2026-02-01
