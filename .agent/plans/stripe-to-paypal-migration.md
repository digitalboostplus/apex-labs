# Stripe → PayPal Migration Plan

## Apex Labs E-Commerce Payment Processor Migration

**Created:** 2026-02-16  
**Status:** 📋 Planning  
**Risk Level:** 🔴 High (payment processing — production revenue impacted)

---

## Executive Summary

Migrate the Apex Labs web application from **Stripe** to **PayPal** as the sole payment processor. This touches backend Cloud Functions, frontend checkout pages, Firestore order schemas, webhook handling, Firebase configuration, and deployment secrets.

---

## Current Stripe Integration Inventory

### Files with Stripe Dependencies

| File | Role | Stripe Touchpoints |
|------|------|--------------------|
| `functions/src/stripe/createCheckoutSession.js` | Backend — creates Stripe Checkout sessions & Payment Links | `stripe` SDK, `getStripe()`, `sessions.create`, `paymentLinks.create`, `products.list/create`, `prices.create` |
| `functions/src/stripe/webhookHandler.js` | Backend — handles Stripe webhook events | `stripe` SDK, `webhooks.constructEvent`, event handlers for `checkout.session.completed`, `expired`, `payment_failed`, `charge.refunded` |
| `functions/index.js` | Entry point — exports `createCheckoutSession` & `stripeWebhook` | Imports from `./src/stripe/` |
| `functions/package.json` | Dependencies | `"stripe": "^14.10.0"` |
| `checkout.html` | Frontend — checkout page | Sends POST to `/api/create-checkout-session`, redirects to Stripe, UI text "Stripe Secure" |
| `order-confirmation.html` | Frontend — post-payment confirmation | Queries Firestore by `stripeSessionId` |
| `data/products.json` | Product catalog | `priceId` field (Stripe price IDs like `price_1Sss8E...`) |
| `js/products.js` | Product manager | `getByPriceId()` method |
| `js/cart.js` | Cart logic | References `priceId` |
| `firebase.json` | Hosting rewrites | Routes `/api/create-checkout-session` and `/api/stripe-webhook` |
| `firestore.rules` | Security rules | Orders collection (Cloud Functions write only) |
| `schemas/user-schema.zod.ts` | Zod validation | `stripeSubscriptionId` field |
| `schemas/user-schema.ts` | TypeScript types | `stripeSubscriptionId` field |
| `schemas/user-schema.json` | JSON schema | `stripeSubscriptionId` field |
| `schemas/USER_SCHEMA_DOCUMENTATION.md` | Documentation | Stripe references |
| `schemas/SCHEMA_DIAGRAM.md` | Architecture diagrams | Stripe API flow |
| `KB-MCP.md` | Knowledge base | Stripe function docs, secrets |
| `temp.txt` | Scratch/backup | Old Stripe code |

### Firebase Secrets in Use
- `STRIPE_SECRET_KEY` — used in `createCheckoutSession` and `webhookHandler`
- `STRIPE_WEBHOOK_SECRET` — used in `webhookHandler` for signature verification

---

## Phase 1: PayPal Account & API Setup

> **Goal:** Establish PayPal developer credentials and configure the business account.

### Tasks

- [ ] **1.1** Create or configure a PayPal Business account at [developer.paypal.com](https://developer.paypal.com)
- [ ] **1.2** Create a REST API App in the PayPal Developer Dashboard
  - Note the **Client ID** and **Client Secret** for both Sandbox and Live environments
- [ ] **1.3** Configure the PayPal app settings:
  - Enable "Accept Payments"
  - Set return URLs: `https://apex-labs-18862.web.app/order-confirmation.html`
  - Set cancel URLs: `https://apex-labs-18862.web.app/cart.html?canceled=true`
- [ ] **1.4** Set up Webhook listeners in PayPal Dashboard:
  - `CHECKOUT.ORDER.APPROVED`
  - `CHECKOUT.ORDER.COMPLETED`
  - `PAYMENT.CAPTURE.COMPLETED`
  - `PAYMENT.CAPTURE.DENIED`
  - `PAYMENT.CAPTURE.REFUNDED`
  - Webhook URL: `https://apex-labs-18862.web.app/api/paypal-webhook`
  - Note the **Webhook ID** for signature verification
- [ ] **1.5** Store credentials as Firebase secrets:
  ```bash
  firebase functions:secrets:set PAYPAL_CLIENT_ID
  firebase functions:secrets:set PAYPAL_CLIENT_SECRET
  firebase functions:secrets:set PAYPAL_WEBHOOK_ID
  ```

---

## Phase 2: Backend — Cloud Functions

> **Goal:** Replace Stripe SDK with PayPal REST API calls in Cloud Functions.

### Task 2.1 — Update Dependencies

**File:** `functions/package.json`

```diff
  "dependencies": {
      "cors": "^2.8.5",
      "firebase-admin": "^13.6.0",
      "firebase-functions": "^7.0.5",
-     "stripe": "^14.10.0"
+     "@paypal/checkout-server-sdk": "^1.0.3"
  }
```

Then run:
```bash
cd functions && npm install && npm uninstall stripe
```

### Task 2.2 — Create PayPal Client Helper

**New file:** `functions/src/paypal/paypalClient.js`

Create a lazily-initialized PayPal client:

```javascript
/**
 * PayPal REST API Client
 * Replaces the Stripe SDK integration
 */

const paypal = require('@paypal/checkout-server-sdk');

let client;

function getPayPalClient() {
    if (!client) {
        const clientId = process.env.PAYPAL_CLIENT_ID;
        const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error('PayPal credentials not configured.');
        }

        // Use Live or Sandbox depending on environment
        const environment = process.env.NODE_ENV === 'production'
            ? new paypal.core.LiveEnvironment(clientId, clientSecret)
            : new paypal.core.SandboxEnvironment(clientId, clientSecret);

        client = new paypal.core.PayPalHttpClient(environment);
    }
    return client;
}

module.exports = { getPayPalClient };
```

### Task 2.3 — Create PayPal Checkout Session Handler

**New file:** `functions/src/paypal/createPayPalOrder.js`

This replaces `functions/src/stripe/createCheckoutSession.js`. Key changes:

| Stripe Concept | PayPal Equivalent |
|---------------|-------------------|
| `checkout.sessions.create()` | PayPal Orders API `POST /v2/checkout/orders` |
| `line_items` with `price_data` | `purchase_units[].items[]` with `unit_amount` |
| `session.url` redirect | `order.links.find(l => l.rel === 'approve').href` |
| `session.id` | `order.id` (PayPal Order ID) |
| `payment_method_types: ['card']` | PayPal handles all payment methods (cards, PayPal balance, Venmo, etc.) |
| `billing_address_collection` | Configured via PayPal `application_context` |
| `shipping_address_collection` | Configured via `purchase_units[].shipping` |

**Implementation outline:**
1. Receive cart items from frontend (same payload structure)
2. Calculate tiered pricing (reuse existing `validateAndBuildLineItems` logic adapted for PayPal format)
3. Create PayPal Order via REST API
4. Store pending order in Firestore with `paypalOrderId` instead of `stripeSessionId`
5. Return `{ orderId, approvalUrl }` to frontend

### Task 2.4 — Create PayPal Capture Handler

**New file:** `functions/src/paypal/capturePayPalOrder.js`

PayPal uses a two-step flow: **Create Order → Buyer Approves → Capture Payment**.

This is a new endpoint that Stripe didn't need (Stripe auto-captures on session completion):

1. Receive `paypalOrderId` from frontend after buyer approval
2. Call PayPal Orders API `POST /v2/checkout/orders/{id}/capture`
3. Update Firestore order status to `paid`
4. Return confirmation to frontend

**Endpoint:** `POST /api/capture-paypal-order`

### Task 2.5 — Create PayPal Webhook Handler

**New file:** `functions/src/paypal/webhookHandler.js`

Replaces `functions/src/stripe/webhookHandler.js`.

| Stripe Event | PayPal Event Equivalent |
|-------------|-----------------------|
| `checkout.session.completed` | `CHECKOUT.ORDER.COMPLETED` / `PAYMENT.CAPTURE.COMPLETED` |
| `checkout.session.expired` | `CHECKOUT.ORDER.APPROVED` (timeout handled client-side) |
| `payment_intent.payment_failed` | `PAYMENT.CAPTURE.DENIED` |
| `charge.refunded` | `PAYMENT.CAPTURE.REFUNDED` |

**Key difference:** PayPal webhook signature verification uses the Webhook ID + event headers rather than a signing secret:

```javascript
// PayPal webhook signature verification
const verifyWebhookSignature = async (headers, body) => {
    // Use PayPal's POST /v1/notifications/verify-webhook-signature
    const response = await fetch('https://api-m.paypal.com/v1/notifications/verify-webhook-signature', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getAccessToken()}`
        },
        body: JSON.stringify({
            auth_algo: headers['paypal-auth-algo'],
            cert_url: headers['paypal-cert-url'],
            transmission_id: headers['paypal-transmission-id'],
            transmission_sig: headers['paypal-transmission-sig'],
            transmission_time: headers['paypal-transmission-time'],
            webhook_id: process.env.PAYPAL_WEBHOOK_ID,
            webhook_event: body
        })
    });
    const result = await response.json();
    return result.verification_status === 'SUCCESS';
};
```

### Task 2.6 — Update Functions Entry Point

**File:** `functions/index.js`

```diff
- // Export Stripe functions
- const { createCheckoutSession } = require('./src/stripe/createCheckoutSession');
- const { stripeWebhook } = require('./src/stripe/webhookHandler');
+ // Export PayPal functions
+ const { createPayPalOrder } = require('./src/paypal/createPayPalOrder');
+ const { capturePayPalOrder } = require('./src/paypal/capturePayPalOrder');
+ const { paypalWebhook } = require('./src/paypal/webhookHandler');

- exports.createCheckoutSession = createCheckoutSession;
- exports.stripeWebhook = stripeWebhook;
+ exports.createPayPalOrder = createPayPalOrder;
+ exports.capturePayPalOrder = capturePayPalOrder;
+ exports.paypalWebhook = paypalWebhook;
```

---

## Phase 3: Frontend — Checkout Flow

> **Goal:** Update the checkout page to use PayPal instead of Stripe redirect.

### Task 3.1 — Update `checkout.html`

**Key changes:**

1. **Add PayPal JS SDK** (replaces Stripe.js):
   ```html
   <script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD"></script>
   ```

2. **Replace "Proceed to Payment" button** with PayPal Smart Buttons:
   - PayPal provides a branded button component that renders directly on the page
   - This gives buyers the option to pay with PayPal, Debit/Credit Card, or Venmo
   - The buyer stays on-site or is redirected to PayPal's approval page

3. **Update checkout flow:**
   ```
   CURRENT (Stripe):
   Click "Proceed to Payment" → POST /api/create-checkout-session → Redirect to stripe.com → Return to order-confirmation.html

   NEW (PayPal):
   Click PayPal Button → POST /api/create-paypal-order → PayPal popup/redirect for approval → POST /api/capture-paypal-order → Redirect to order-confirmation.html
   ```

4. **Remove Stripe references in UI text:**
   - Line 183: `"You'll be redirected to our secure payment partner (Stripe)"` → `"Complete your payment securely via PayPal"`
   - Line 196-197: `"Stripe Secure"` trust badge → `"PayPal Secure"` with PayPal badge
   - Line 380: `usePaymentLink: true` flag → remove (not needed for PayPal)

5. **Update the checkout button click handler** (lines 327-408):
   - Replace the `fetch('/api/create-checkout-session')` call with `fetch('/api/create-paypal-order')`
   - After getting the approval URL, redirect the buyer to PayPal
   - OR use PayPal Smart Buttons for an in-page experience

### Task 3.2 — Update `order-confirmation.html`

**Key changes:**

1. **Update query parameter:** Change from `session_id` to `paypal_order_id` (line 195)
2. **Update Firestore query:** Change from `.where('stripeSessionId', '==', sessionId)` to `.where('paypalOrderId', '==', orderId)` (line 216)
3. **Add capture call:** After buyer returns from PayPal, call `/api/capture-paypal-order` to finalize payment before displaying confirmation

### Task 3.3 — Update `cart.html`

Check for any Stripe-specific references in the cart page (currently minimal — mainly the checkout redirect).

---

## Phase 4: Data & Schema Updates

> **Goal:** Update Firestore schemas and product data to remove Stripe-specific fields.

### Task 4.1 — Update `data/products.json`

The `priceId` field currently stores Stripe Price IDs (`price_1Sss8E...`). With PayPal, pricing is calculated server-side per-order rather than pre-configured in the payment processor.

**Options:**
- **Option A (Recommended):** Keep `priceId` as an internal SKU identifier; it just won't reference Stripe anymore. Rename to `sku` for clarity.
- **Option B:** Remove `priceId` entirely since PayPal calculates amounts dynamically.

### Task 4.2 — Update Firestore Order Documents

Replace Stripe-specific fields with PayPal equivalents:

| Current Field (Stripe) | New Field (PayPal) |
|------------------------|-------------------|
| `stripeSessionId` | `paypalOrderId` |
| `stripePaymentIntentId` | `paypalCaptureId` |
| `stripeCustomerId` | `paypalPayerId` |

**Firestore index update** (`firestore.indexes.json`):
- If any composite indexes reference `stripeSessionId`, update them to `paypalOrderId`

### Task 4.3 — Update Schemas

**Files to update:**
- `schemas/user-schema.zod.ts` → Rename `stripeSubscriptionId` to `paypalSubscriptionId` (or a generic `paymentSubscriptionId`)
- `schemas/user-schema.ts` → Same rename
- `schemas/user-schema.json` → Same rename
- `schemas/USER_SCHEMA_DOCUMENTATION.md` → Update all Stripe references
- `schemas/SCHEMA_DIAGRAM.md` → Update architecture diagrams

### Task 4.4 — Update `js/products.js`

- Rename `getByPriceId()` method to `getBySku()` or keep as-is but update JSDoc comments
- Remove Stripe-specific comments

### Task 4.5 — Update Firestore Security Rules

**File:** `firestore.rules`

No structural changes needed — order write rules already enforce Cloud Functions-only writes. Just verify the rules still work with the new field names.

---

## Phase 5: Configuration & Infrastructure

> **Goal:** Update Firebase hosting, secrets, and environment configuration.

### Task 5.1 — Update Firebase Hosting Rewrites

**File:** `firebase.json`

```diff
  "rewrites": [
      {
-         "source": "/api/create-checkout-session",
-         "function": "createCheckoutSession"
+         "source": "/api/create-paypal-order",
+         "function": "createPayPalOrder"
      },
      {
-         "source": "/api/stripe-webhook",
-         "function": "stripeWebhook"
+         "source": "/api/capture-paypal-order",
+         "function": "capturePayPalOrder"
+     },
+     {
+         "source": "/api/paypal-webhook",
+         "function": "paypalWebhook"
      }
  ]
```

### Task 5.2 — Update Firebase Secrets

```bash
# Add PayPal secrets
firebase functions:secrets:set PAYPAL_CLIENT_ID
firebase functions:secrets:set PAYPAL_CLIENT_SECRET
firebase functions:secrets:set PAYPAL_WEBHOOK_ID

# After confirming PayPal is working, remove Stripe secrets
firebase functions:secrets:destroy STRIPE_SECRET_KEY
firebase functions:secrets:destroy STRIPE_WEBHOOK_SECRET
```

### Task 5.3 — Update Documentation

- `KB-MCP.md` — Update function table and configuration docs
- `AGENTS.md` / `CLAUDE.md` — Update any Stripe references
- `gemini_checkout.md` / `codex_checkout.md` — Update checkout flow docs

---

## Phase 6: Testing Strategy

> **Goal:** Verify end-to-end payment flow before going live.

### Task 6.1 — Local/Emulator Testing

1. Set up PayPal Sandbox credentials
2. Use Firebase emulators for Cloud Functions
3. Test the full checkout flow:
   - Add items to cart → Checkout → PayPal approval → Capture → Order confirmation
4. Test error scenarios:
   - Declined payment
   - Canceled checkout
   - Network failure during capture

### Task 6.2 — Webhook Testing

1. Use PayPal Sandbox webhook simulator
2. Verify all event types are handled:
   - `PAYMENT.CAPTURE.COMPLETED` → Order marked as `paid`
   - `PAYMENT.CAPTURE.DENIED` → Order marked as `payment_failed`
   - `PAYMENT.CAPTURE.REFUNDED` → Order marked as `refunded`
3. Verify webhook signature validation

### Task 6.3 — Regression Testing

- Verify cart functionality still works
- Verify product display and pricing tiers
- Verify order confirmation page loads correctly
- Verify existing Firestore orders aren't corrupted

### Task 6.4 — UAT (User Acceptance Testing)

- Complete a real Sandbox transaction end-to-end
- Verify email confirmations
- Verify order appears in Firestore with correct data

---

## Phase 7: Deployment

> **Goal:** Deploy to production with minimal downtime.

### Task 7.1 — Pre-Deployment Checklist

- [ ] All PayPal Sandbox tests passing
- [ ] PayPal Live credentials configured in Firebase secrets
- [ ] PayPal Live webhook URL configured in PayPal Dashboard
- [ ] Old Stripe functions code marked for removal
- [ ] Database migration plan for existing orders (read-only, no schema migration needed for historical data)

### Task 7.2 — Deployment Steps

```bash
# 1. Deploy Cloud Functions first
firebase deploy --only functions

# 2. Deploy hosting (frontend changes)
firebase deploy --only hosting

# 3. Deploy Firestore rules (if changed)
firebase deploy --only firestore:rules

# 4. Deploy Firestore indexes (if changed)
firebase deploy --only firestore:indexes
```

### Task 7.3 — Post-Deployment Verification

1. Place a test order with a real PayPal account (small amount)
2. Verify Firestore order document is created correctly
3. Verify webhook fires and updates order status
4. Verify order confirmation page displays correctly
5. Monitor Cloud Functions logs for errors

### Task 7.4 — Cleanup

- [ ] Delete `functions/src/stripe/` directory
- [ ] Remove `stripe` from `functions/package.json`
- [ ] Remove Stripe secrets from Firebase
- [ ] Remove `temp.txt` scratch file
- [ ] Disable Stripe webhooks in Stripe Dashboard
- [ ] Update API key rotation schedule docs

---

## Risk Assessment & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Payment processing downtime | 🔴 High | Medium | Deploy during low-traffic hours, keep Stripe active until PayPal confirmed |
| Webhook delivery failures | 🔴 High | Low | PayPal retries webhooks; add manual order reconciliation tool |
| Existing orders break | 🟡 Medium | Low | Historical orders with `stripeSessionId` are read-only; no migration needed |
| PayPal API changes | 🟡 Medium | Low | Pin `@paypal/checkout-server-sdk` version |
| Cart/pricing regression | 🟡 Medium | Low | Cart logic is payment-processor agnostic; only checkout endpoint changes |

---

## Rollback Plan

If PayPal integration fails in production:

1. Revert `firebase.json` rewrites to Stripe endpoints
2. Redeploy the old Stripe Cloud Functions from git history
3. Revert `checkout.html` and `order-confirmation.html`
4. Ensure Stripe secrets are still active

**Time to rollback:** ~10 minutes (git revert + `firebase deploy`)

---

## File Change Summary

| Action | File |
|--------|------|
| 🆕 Create | `functions/src/paypal/paypalClient.js` |
| 🆕 Create | `functions/src/paypal/createPayPalOrder.js` |
| 🆕 Create | `functions/src/paypal/capturePayPalOrder.js` |
| 🆕 Create | `functions/src/paypal/webhookHandler.js` |
| ✏️ Modify | `functions/index.js` |
| ✏️ Modify | `functions/package.json` |
| ✏️ Modify | `checkout.html` |
| ✏️ Modify | `order-confirmation.html` |
| ✏️ Modify | `firebase.json` |
| ✏️ Modify | `data/products.json` (optional — rename `priceId` → `sku`) |
| ✏️ Modify | `js/products.js` |
| ✏️ Modify | `schemas/user-schema.zod.ts` |
| ✏️ Modify | `schemas/user-schema.ts` |
| ✏️ Modify | `schemas/user-schema.json` |
| ✏️ Modify | `schemas/USER_SCHEMA_DOCUMENTATION.md` |
| ✏️ Modify | `schemas/SCHEMA_DIAGRAM.md` |
| ✏️ Modify | `KB-MCP.md` |
| 🗑️ Delete | `functions/src/stripe/createCheckoutSession.js` (after migration verified) |
| 🗑️ Delete | `functions/src/stripe/webhookHandler.js` (after migration verified) |

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: PayPal Setup | 1-2 hours |
| Phase 2: Backend Functions | 4-6 hours |
| Phase 3: Frontend Changes | 2-3 hours |
| Phase 4: Schema Updates | 1-2 hours |
| Phase 5: Configuration | 1 hour |
| Phase 6: Testing | 3-4 hours |
| Phase 7: Deployment | 1-2 hours |
| **Total** | **13-20 hours** |
