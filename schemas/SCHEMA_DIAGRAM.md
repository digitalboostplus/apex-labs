# User Schema Diagrams

Visual representations of the Firestore user schema structure, relationships, and data flows.

## Collection Structure

```mermaid
graph TB
    subgraph "Firestore Database"
        Users[users Collection]

        subgraph "User Document: users/{uid}"
            UID[uid: string]
            Email[email: string*]
            DisplayName[displayName: string | null]
            PhotoURL[photoURL: string | null]
            CreatedAt[createdAt: Timestamp*]
            UpdatedAt[updatedAt: Timestamp*]
            LastLoginAt[lastLoginAt: Timestamp]
            PhoneNumber[phoneNumber: string | null]
            Preferences[preferences: object]
            Subscription[subscription: object]
            ReferralCode[referralCode: string]
            ReferredBy[referredBy: string | null]
            LifetimeValue[lifetimeValue: number]
            Status[status: string]
        end

        subgraph "Subcollections"
            Orders[orders/{orderId}]
            Addresses[addresses/{addressId}]
            Wishlist[wishlist/{productId}]
        end

        Users --> UID
        UID --> Orders
        UID --> Addresses
        UID --> Wishlist
    end

    style Email fill:#e1f5e1
    style CreatedAt fill:#e1f5e1
    style UpdatedAt fill:#e1f5e1
    style Orders fill:#ffe1e1
    style LifetimeValue fill:#fff3e1
    style Subscription fill:#fff3e1
```

*Required fields shown in green*
*Read-only subcollections shown in red*
*Protected fields shown in yellow*

---

## User Lifecycle Flow

```mermaid
sequenceDiagram
    participant User
    participant Client as Client App
    participant Auth as Firebase Auth
    participant Firestore
    participant Functions as Cloud Functions

    Note over User,Functions: Signup Flow (Email/Password)
    User->>Client: Submit signup form
    Client->>Auth: createUserWithEmailAndPassword()
    Auth-->>Client: User credential
    Client->>Auth: updateProfile(displayName)
    Client->>Firestore: Create user document
    Note right of Firestore: {<br/>  email,<br/>  displayName,<br/>  photoURL: null,<br/>  createdAt,<br/>  updatedAt<br/>}
    Firestore-->>Client: Success
    Client-->>User: Signup complete

    Note over User,Functions: Login Flow
    User->>Client: Submit login form
    Client->>Auth: signInWithEmailAndPassword()
    Auth-->>Client: User credential
    Client->>Firestore: Sync user profile
    Note right of Firestore: {<br/>  email,<br/>  displayName,<br/>  photoURL,<br/>  lastLoginAt,<br/>  updatedAt<br/>}
    Firestore-->>Client: Success
    Client-->>User: Login complete

    Note over User,Functions: Profile Update Flow
    User->>Client: Edit profile
    Client->>Client: Validate with Zod
    Client->>Firestore: Update document
    Note right of Firestore: {<br/>  displayName,<br/>  photoURL,<br/>  updatedAt<br/>}
    Firestore-->>Client: Success
    Client-->>User: Profile updated

    Note over User,Functions: Order Flow (Future)
    User->>Client: Complete checkout
    Client->>Functions: Create Stripe session
    Functions->>Functions: Process payment
    Functions->>Firestore: Create order
    Firestore->>Firestore: Update lifetimeValue
    Functions-->>Client: Order created
    Client-->>User: Order confirmation
```

---

## Security Rules Flow

```mermaid
flowchart TD
    Start([Firestore Request]) --> AuthCheck{Authenticated?}

    AuthCheck -->|No| Deny[Deny Access]
    AuthCheck -->|Yes| OperationType{Operation Type}

    OperationType -->|Read| ReadCheck{Own Profile<br/>or Admin?}
    ReadCheck -->|Yes| Allow[Allow Access]
    ReadCheck -->|No| Deny

    OperationType -->|Create| CreateChecks{Valid Create?}
    CreateChecks --> EmailMatch{Email matches<br/>Auth email?}
    EmailMatch -->|No| Deny
    EmailMatch -->|Yes| RequiredFields{Has required<br/>fields?}
    RequiredFields -->|No| Deny
    RequiredFields -->|Yes| ValidFormat{Valid field<br/>formats?}
    ValidFormat -->|No| Deny
    ValidFormat -->|Yes| NoProtected{No protected<br/>fields?}
    NoProtected -->|No| Deny
    NoProtected -->|Yes| Allow

    OperationType -->|Update| UpdateChecks{Valid Update?}
    UpdateChecks --> OwnProfile{Own Profile?}
    OwnProfile -->|No| Deny
    OwnProfile -->|Yes| ImmutableCheck{Immutable fields<br/>unchanged?}
    ImmutableCheck -->|No| Deny
    ImmutableCheck -->|Yes| TimestampCheck{Timestamps<br/>updated?}
    TimestampCheck -->|No| Deny
    TimestampCheck -->|Yes| ValidUpdate{Valid field<br/>updates?}
    ValidUpdate -->|No| Deny
    ValidUpdate -->|Yes| Allow

    OperationType -->|Delete| AdminCheck{Is Admin?}
    AdminCheck -->|Yes| Allow
    AdminCheck -->|No| Deny

    style Allow fill:#90EE90
    style Deny fill:#FFB6C6
    style Start fill:#B0E0E6
```

---

## Field Validation Matrix

```mermaid
graph LR
    subgraph "Field Types"
        Required[Required Fields]
        Optional[Optional Fields]
        Protected[Protected Fields]
        System[System Fields]
    end

    subgraph "Required"
        R1[email]
        R2[createdAt]
        R3[updatedAt]
    end

    subgraph "Optional"
        O1[displayName]
        O2[photoURL]
        O3[lastLoginAt]
        O4[phoneNumber]
        O5[preferences]
    end

    subgraph "Protected"
        P1[lifetimeValue]
        P2[subscription]
        P3[status]
        P4[referralCode]
    end

    subgraph "System"
        S1[createdAt]
        S2[updatedAt]
        S3[lastLoginAt]
    end

    Required --> R1
    Required --> R2
    Required --> R3

    Optional --> O1
    Optional --> O2
    Optional --> O3
    Optional --> O4
    Optional --> O5

    Protected --> P1
    Protected --> P2
    Protected --> P3
    Protected --> P4

    System --> S1
    System --> S2
    System --> S3

    style Required fill:#e1f5e1
    style Optional fill:#e1e8f5
    style Protected fill:#fff3e1
    style System fill:#f0e1f5
```

---

## Validation Pipeline

```mermaid
flowchart TD
    Input[User Input] --> ClientVal{Client-Side<br/>Validation}

    ClientVal -->|Zod Schema| ZodCheck{Valid?}
    ZodCheck -->|No| ShowError[Show Error Messages]
    ZodCheck -->|Yes| Sanitize[Sanitize Input]

    Sanitize --> Submit[Submit to Firestore]
    Submit --> RulesCheck{Firestore Rules<br/>Validation}

    RulesCheck -->|Fail| RulesError[Return Permission Denied]
    RulesCheck -->|Pass| TypeCheck{Type Validation}

    TypeCheck -->|Fail| TypeError[Return Type Error]
    TypeCheck -->|Pass| ConstraintCheck{Constraint Check}

    ConstraintCheck -->|Fail| ConstraintError[Return Constraint Error]
    ConstraintCheck -->|Pass| Write[Write to Firestore]

    Write --> Success[Success Response]

    ShowError --> End([End])
    RulesError --> End
    TypeError --> End
    ConstraintError --> End
    Success --> End

    style Input fill:#B0E0E6
    style ZodCheck fill:#FFE4B5
    style RulesCheck fill:#FFE4B5
    style TypeCheck fill:#FFE4B5
    style ConstraintCheck fill:#FFE4B5
    style Success fill:#90EE90
    style ShowError fill:#FFB6C6
    style RulesError fill:#FFB6C6
    style TypeError fill:#FFB6C6
    style ConstraintError fill:#FFB6C6
```

---

## Data Flow Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        Form[User Form]
        Zod[Zod Validator]
        TS[TypeScript Types]
    end

    subgraph "Firebase Services"
        Auth[Firebase Auth]
        Rules[Security Rules]
        Firestore[(Firestore DB)]
    end

    subgraph "Backend Layer"
        Functions[Cloud Functions]
        Stripe[Stripe API]
    end

    Form --> Zod
    Zod -->|Valid| TS
    TS --> Auth
    Auth --> Rules
    Rules -->|Authorized| Firestore

    Functions --> Firestore
    Functions --> Stripe
    Stripe -.->|Webhook| Functions

    style Form fill:#E6F3FF
    style Zod fill:#FFE4B5
    style TS fill:#E1F5E1
    style Rules fill:#FFE4B5
    style Firestore fill:#F0E1F5
    style Functions fill:#FFF3E1
```

---

## Type System Architecture

```mermaid
classDiagram
    class UserProfile {
        +string email
        +string|null displayName
        +string|null photoURL
        +Timestamp createdAt
        +Timestamp updatedAt
        +Timestamp? lastLoginAt
        +string? phoneNumber
        +UserPreferences? preferences
        +Subscription? subscription
        +string? referralCode
        +string? referredBy
        +number? lifetimeValue
        +string? status
    }

    class UserPreferences {
        +boolean marketingEmails
        +boolean orderEmails
        +boolean smsNotifications
        +string theme
        +string units
    }

    class Subscription {
        +string planId
        +string paypalSubscriptionId
        +string status
        +Timestamp currentPeriodStart
        +Timestamp currentPeriodEnd
        +boolean cancelAtPeriodEnd
    }

    class CreateUserInput {
        +string email
        +string? displayName
        +string? photoURL
        +string? phoneNumber
    }

    class UpdateUserInput {
        +string? displayName
        +string? photoURL
        +string? phoneNumber
        +UserPreferences? preferences
    }

    UserProfile --> UserPreferences
    UserProfile --> Subscription
    CreateUserInput ..|> UserProfile : creates
    UpdateUserInput ..|> UserProfile : updates
```

---

## Authentication Methods

```mermaid
graph TD
    Start([User Wants to Sign Up]) --> Method{Auth Method}

    Method -->|Email/Password| EmailForm[Enter Email & Password]
    Method -->|Google OAuth| GoogleButton[Click Google Sign-In]

    EmailForm --> CreateAuth[Create Auth Account]
    GoogleButton --> GooglePopup[Google OAuth Popup]

    GooglePopup --> GoogleAuth[Authenticate with Google]
    GoogleAuth --> IsNew{New User?}

    CreateAuth --> SetProfile[Set Display Name]
    SetProfile --> CreateProfile[Create Firestore Profile]

    IsNew -->|Yes| CreateGoogleProfile[Create Profile with Google Data]
    IsNew -->|No| SyncProfile[Sync Profile]

    CreateProfile --> Success([Success])
    CreateGoogleProfile --> Success
    SyncProfile --> Success

    style EmailForm fill:#E6F3FF
    style GoogleButton fill:#FFE4B5
    style CreateProfile fill:#E1F5E1
    style CreateGoogleProfile fill:#E1F5E1
    style SyncProfile fill:#FFF3E1
    style Success fill:#90EE90
```

---

## Subcollection Relationships

```mermaid
erDiagram
    USER ||--o{ ORDER : has
    USER ||--o{ ADDRESS : has
    USER ||--o{ WISHLIST_ITEM : has

    USER {
        string uid PK
        string email
        string displayName
        string photoURL
        timestamp createdAt
        timestamp updatedAt
    }

    ORDER {
        string orderId PK
        string userId FK
        number amount
        string status
        timestamp createdAt
    }

    ADDRESS {
        string addressId PK
        string userId FK
        string name
        string line1
        string city
        string state
        string postalCode
    }

    WISHLIST_ITEM {
        string productId PK
        string userId FK
        string priceId
        timestamp addedAt
    }
```

---

## Schema Evolution Path

```mermaid
timeline
    title User Schema Evolution

    section v1.0 - Current
        Core Fields : email
                    : displayName
                    : photoURL
                    : timestamps
        Auth Methods : Email/Password
                     : Google OAuth
        Security : Basic owner rules
        Validation : None

    section v1.1 - Near Future
        Extended Fields : phoneNumber
                        : preferences
        Enhanced Security : Field-level validation
                          : Immutability rules
        Validation : Zod schemas
                   : TypeScript types

    section v2.0 - Future
        Business Fields : subscription
                        : lifetimeValue
                        : referralCode
        Features : Referral program
                 : Subscriptions
                 : Loyalty points
        Advanced Security : Rate limiting
                          : Abuse detection
```

---

## Error Handling Flow

```mermaid
stateDiagram-v2
    [*] --> ValidatingInput

    ValidatingInput --> ClientValidation
    ClientValidation --> InputValid : Valid
    ClientValidation --> ShowClientError : Invalid

    InputValid --> SubmittingToFirestore
    SubmittingToFirestore --> RulesValidation

    RulesValidation --> RulesValid : Authorized
    RulesValidation --> PermissionDenied : Denied

    RulesValid --> WritingToDatabase
    WritingToDatabase --> WriteSuccess : Success
    WritingToDatabase --> WriteError : Network/DB Error

    ShowClientError --> [*]
    PermissionDenied --> LogError
    WriteError --> LogError
    LogError --> ShowUserError
    ShowUserError --> [*]

    WriteSuccess --> UpdateUI
    UpdateUI --> [*]
```

---

## Legend

### Colors
- **Green** (#e1f5e1): Required fields or successful states
- **Red** (#ffe1e1): Restricted or error states
- **Yellow** (#fff3e1): Protected or warning states
- **Blue** (#e1e8f5): Optional or informational states
- **Purple** (#f0e1f5): System-managed fields

### Symbols
- **\*** : Required field
- **?** : Optional field
- **PK** : Primary key
- **FK** : Foreign key
- **-->** : Data flow direction
- **-.->** : Asynchronous/webhook flow

---

## Additional Resources

- See `USER_SCHEMA_DOCUMENTATION.md` for detailed field descriptions
- See `INTEGRATION_GUIDE.md` for implementation guidance
- See `user-schema.ts` for TypeScript definitions
- See `firestore-rules-users.rules` for security rules

---

**Diagram Version**: 1.0
**Last Updated**: 2026-02-01
**Generated by**: Mermaid.js
