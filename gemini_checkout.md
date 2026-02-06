# Guest Checkout Support & Fix

Enable guest checkout specifically by resolving a button ID conflict that causes the checkout page to refresh instead of proceeding to payment.

## Proposed Changes

### Core Components

---

#### [MODIFY] [cart-drawer.html](file:///c:/antigravity/apex-labs/components/cart-drawer.html)
- Rename button ID from `checkout-btn` to `drawer-checkout-btn`.
- Update internal script to use the new ID for redirection.

#### [MODIFY] [cart.html](file:///c:/antigravity/apex-labs/cart.html)
- Rename "Proceed to Checkout" button ID to `page-checkout-btn` for consistency.

#### [MODIFY] [checkout.html](file:///c:/antigravity/apex-labs/checkout.html)
- Remove duplicate `js/app.js` inclusion at the bottom of the file.
- Simplify guest/auth email selection logic.
- Ensure the "Proceed to Payment" button (still `checkout-btn`) is unique on this page by renaming conflicting drawer IDs.

#### [MODIFY] [js/app.js](file:///c:/antigravity/apex-labs/js/app.js)
- Update `updateCartDrawerUI` to use the new `drawer-checkout-btn` ID.
- Update global component injection logic to be more specific when adding redirection listeners.

---

## Verification Plan

### Automated Tests
- Run the existing Playwright purchase test to ensure the checkout flow still works end-to-end.
  ```powershell
  npx playwright test tests/purchase.spec.ts
  ```

### Manual Verification
1. Open the site without signing in.
2. Add items to the cart.
3. Go to the checkout page.
4. Enter a guest email address.
5. Click "Proceed to Payment".
6. Verify redirect to Stripe Checkout occurs without a page refresh.
