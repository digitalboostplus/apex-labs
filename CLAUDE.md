# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Apex Labs is a static Firebase-hosted marketing site for peptide therapy products. The site features a product catalog, pricing pages, and a client-side shopping cart system.

## Development Commands

### Local Development
```bash
# Install dependencies (Firebase + Playwright)
npm install

# Serve the site locally with Firebase emulator (recommended)
npx firebase emulators:start --only hosting

# Quick static preview (no Firebase features)
npx serve .
```

### Testing
```bash
# Run Playwright tests
npx playwright test

# Run specific test file
npx playwright test tests/purchase.spec.ts

# Run tests in UI mode
npx playwright test --ui
```

Note: Playwright is configured to serve the site on port 4173 using Python's HTTP server (`python -m http.server 4173`).

### Deployment
```bash
# Deploy to Firebase hosting
npx firebase deploy --only hosting --project <projectId>
```

## Architecture

### File Structure
- **Root HTML files** (`index.html`, `peptides.html`, `program-overview.html`, `pricing.html`, `cart.html`, `checkout.html`, `order-confirmation.html`) - Each represents a public page
- **/pricing/** - Individual product detail pages (e.g., `aod-9604.html`, `bpc-157.html`)
- **/components/** - HTML fragments injected at runtime (currently `cart-drawer.html`)
- **/js/** - Shared JavaScript modules (`app.js`, `cart.js`)
- **/css/** - Stylesheets (including `design-system.css`)
- **/assets/** - Media files
- **/tests/** - Playwright test specs
- **/design-system/** - Design reference materials (not actively used in production)
- **/.shared/** - Third-party embeds and experiments (not deployed)

### Cart System Architecture

The shopping cart is the core interactive feature. Understanding how it works is critical:

1. **CartManager** (`js/cart.js`) - Singleton class managing cart state
   - Stores cart data in `localStorage` under key `apex_labs_cart`
   - Provides methods: `addItem()`, `removeItem()`, `updateQuantity()`, `clearCart()`, `getTotal()`, `getItemCount()`
   - Implements observer pattern via `subscribe()` for UI updates
   - Exposed globally as `window.cartManager` and `window.CartManager`

2. **Cart Drawer Component** (`components/cart-drawer.html`)
   - Injected dynamically by `js/app.js` into `#cart-container` placeholder
   - Path resolution handles both root pages (`components/cart-drawer.html`) and pricing subdirectory (`../components/cart-drawer.html`)
   - Controlled via `window.toggleCart()` function

3. **Application Bootstrap** (`js/app.js`)
   - Loaded on every page
   - Initializes Lucide icons
   - Handles mobile menu toggle logic
   - Dynamically injects cart drawer component
   - Subscribes to cart updates to sync badge counters (`#cart-count`, `.cart-counter`)
   - Optional GSAP magnetic effects if library is present

4. **Product ID Consistency**
   - All `CartManager.addItem()` calls must use matching `priceId` values
   - Cart deduplication relies on `priceId` (or fallback to `id`) matching
   - Product objects require: `{ id, priceId, name, price, image }`

### Path Resolution

The site has two path contexts:
- **Root pages**: Reference assets as `js/cart.js`, `components/cart-drawer.html`
- **Pricing subdirectory**: Reference assets as `../js/cart.js`, `../components/cart-drawer.html`

`js/app.js` detects context via `window.location.pathname.includes('/pricing/')` and adjusts component paths accordingly.

### Page Flow

1. **Product browsing**: `index.html` → `peptides.html` → `pricing/*.html`
2. **Purchase flow**: Add items → `cart.html` → `checkout.html` → `order-confirmation.html`
3. Cart is cleared automatically on the order confirmation page

### Navigation Structure

All pages share consistent navigation:
- **Desktop & Mobile**: Catalog → Protocols → Pricing → The Standard → Portal Access
- **Catalog** links to `peptides.html#collection`
- **The Standard** links to `index.html#science`
- **Portal Access** links to external partner mailbox

## Coding Conventions

- **Indentation**: 4 spaces for HTML and JavaScript
- **Line length**: Under 120 characters
- **CSS**: Use Tailwind utilities directly in markup; group typography, layout, state classes in order
- **Custom CSS**: Use variables from `css/design-system.css`
- **Naming**:
  - JavaScript: `camelCase` for functions and variables (`cartManager`, `updateBadge`)
  - Files: `dash-case` (`cart-drawer.html`, `app.js`)
  - Data attributes: `UPPER_SNAKE_CASE` (if introduced)

## Key Constraints

- **Never commit sensitive data**: No API keys, private tokens, or real customer data
- **Cart drawer dependency**: Every page needs both `<div id="cart-container"></div>` and `<script src="js/app.js"></script>` (or `../js/app.js` for pricing pages)
- **Product ID matching**: Ensure `priceId` values are consistent across all pages where a product appears
- **Asset path awareness**: When editing pricing subdirectory pages, remember to use `../` prefix for root assets
- **Design system CSS**: Update `css/design-system.css` before creating page-specific overrides

## Testing

Currently minimal automated testing exists. When adding tests:
- Place specs in `/tests/` directory
- Use Playwright naming convention: `*.spec.ts`
- Verify cart functionality, navigation, icon hydration, and checkout flows
- Test both root and `/pricing/` path contexts (different relative asset paths)
- Manually test in Chrome, Safari, and mobile viewports before commits

Existing test: `tests/purchase.spec.ts` validates end-to-end purchase flow from adding item to order confirmation.

## Commit Conventions

Follow Conventional Commits format:
- `feat: add stackable bundles`
- `fix(cart): handle empty state`
- `feat(pricing): add new peptide detail page`
