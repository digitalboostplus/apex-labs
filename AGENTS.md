# Repository Guidelines

## Project Structure & Module Organization
Apex Labs is a static Firebase-hosted marketing site. Root-level HTML files (`index.html`, `peptides.html`, `program-overview.html`, etc.) each represent a public page and import shared assets from `/css`, `/js`, and `/components`. The `components/cart-drawer.html` fragment is injected at runtime by `js/app.js`, so keep markup self-contained with IDs expected by the cart manager. Visual tokens and reusable layouts live in `css/design-system.css` and the `design-system/*/pages` references; update those before touching page-specific overrides. Media belongs in `/assets` and pricing-specific fragments live under `/pricing`. Keep third-party embeds or experiments in `.shared` so they can be copied into the live surfaces intentionally.

## Build, Test, and Development Commands
- `npm install` installs the lone `firebase` dependency needed for local emulator helpers. Run it once whenever `package-lock.json` changes.
- `npx firebase emulators:start --only hosting` serves the site from the repo root and mirrors production rewrite rules. Use this for all manual QA.
- `npx firebase deploy --only hosting --project <projectId>` pushes the static bundle; dry-run in a forked project before production.
If you need a quick static preview without Firebase tooling, `npx serve .` works but will not apply emulator-specific headers.

## Coding Style & Naming Conventions
Indent HTML and JS with four spaces and wrap lines under 120 characters to match the existing pages. Tailwind utility strings belong directly in markup; group typography, layout, and state classes in that order for readability. Custom CSS should rely on the variables already declared in `design-system.css`. Use `camelCase` for JavaScript functions and consts (`cartManager`, `updateBadge`), dash-case for file names (`cart-drawer.html`), and uppercase snake case for boolean data attributes if they are introduced.

## Testing Guidelines
There is no automated test harness yet; rely on targeted manual passes. Validate navigation, Lucide icon hydration, cart badge updates, and checkout flows in both the root pages and `/pricing` variants because the relative asset paths differ. Before opening a PR, smoke-test in Chrome, Safari, and a mobile viewport, and capture console output; `js/cart.js` logs actionable errors when storage is unavailable. When adding automation, place specs under `/tests` and use Playwright naming (`cart.spec.ts`) so CI can be wired later.

## Commit & Pull Request Guidelines
The workspace mirror does not currently expose git history, but follow Conventional Commit semantics (`feat: add stackable bundles`, `fix(cart): handle empty state`) to keep downstream release notes readable. Each PR should include a one-paragraph summary, screenshots or screen recordings of the affected pages, reproduction or verification steps, and a link to the tracking issue or support ticket. Flag any content or localization changes for manual marketing review.

## Security & Configuration Tips
Firebase hosting reads directly from the repo root, so never commit private API keys; use environment-specific JS modules in `.shared` and gate them before merging. Update `.firebaserc` only with approved project IDs, and treat `node_modules` as local-only assets. When working with customer data mocks in `assets/`, obfuscate emails and IDs before committing.
