# Guest Checkout Fix Plan

**Summary**
Fix the checkout refresh/no-action bug by removing the ID collision between the cart drawer “checkout” button and the checkout page “Proceed to Payment” button, and make guest checkout logic explicit and reliable. Guest checkout will continue to require a valid email before creating the Stripe session.

**Public Interfaces / Contracts**
- Change DOM ID in `components/cart-drawer.html` from `checkout-btn` to `checkout-btn-drawer`.
- Update all JS references to the cart drawer button to use `checkout-btn-drawer` or a scoped query within `#cart-drawer`.

**Implementation Steps**
1. Fix cart drawer button ID conflict.
2. Clarify guest vs signed-in email logic in `checkout.html`.
3. QA / verification across signed-in and signed-out flows and cart drawer routing.

**Test Cases and Scenarios**
- Signed out + valid email -> Stripe redirect.
- Signed out + invalid/empty email -> validation, no redirect.
- Signed in + default email -> Stripe redirect.
- Signed in + “Use Different Email” -> uses guest email and redirects.
- Cart drawer checkout from other pages still routes to `checkout.html`.

**Assumptions and Defaults**
- Guest checkout requires a valid email.
- No cleanup of duplicate `js/app.js` include in `checkout.html` for this change.
