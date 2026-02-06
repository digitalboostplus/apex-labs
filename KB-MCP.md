# Firebase and Google Cloud Resource Listing & Recommendations

## Resource Listing

### Project Information
- **Project ID**: `apex-labs-18862`
- **Platform**: Google Firebase / Google Cloud Platform

### 1. Firebase Hosting
- **Public Directory**: `.` (Root directory)
- **Primary Hosting Site**: `https://apex-labs-18862.web.app`
- **Asset Resolution Path**: `https://apex-labs-18862.web.app/`

### 2. Firebase Cloud Functions (Gen 2)
All functions are implemented using Firebase Functions v2 and utilize Node.js 20.

| Function Name            | Trigger Type | Source File                                      | Endpoint Path                    | Description                                                                 |
|-------------------------|--------------|--------------------------------------------------|----------------------------------|-----------------------------------------------------------------------------|
| `createCheckoutSession` | HTTP (POST)  | `functions/src/stripe/createCheckoutSession.js` | `/api/create-checkout-session`   | Validates cart items, calculates tiered pricing, and creates Stripe sessions. |
| `stripeWebhook`         | HTTP (POST)  | `functions/src/stripe/webhookHandler.js`       | `/api/stripe-webhook`           | Handles Stripe events (`checkout.session.completed`, `refunded`, etc.).     |

### 3. Google Cloud Run (Backing Functions)
- Each Firebase Function v2 is automatically backed by a Google Cloud Run service in the project `apex-labs-18862`.
- **Configuration**: `maxInstances: 10`, utilizing Secret Manager for `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.

### 4. Firestore Database
- **Location**: `apex-labs-18862`
- **Core Collections**:
  - `orders`: Stores pending and completed order data, including Stripe session mapping.
  - `users`: Stores customer profiles and nested order history.
- **Rules**: Defined in `firestore.rules`.
- **Indexes**: Defined in `firestore.indexes.json`.

---

## Recommendations & Best Practices (KB-MCP)

Based on Google Developer Knowledge for Firebase Functions v2 and Cloud Run, the following enhancements are recommended:

### 1. Cold Start Optimization
- **Global Variable Reuse**: Ensure the Stripe client and Admin SDK are initialized outside the request handler (already partially implemented with lazy init, but ensure shared instances are reused across requests).
- **Concurrency**: Cloud Run (Functions v2) supports up to 80 concurrent requests per instance. Review if `maxInstances: 10` is sufficient or if increasing concurrency settings would improve cost-efficiency.

### 2. Security & Secret Management
- **Secret Scope**: Ensure secrets are only exposed to the functions that require them (current implementation follows this).
- **CORS Configuration**: The `createCheckoutSession` function uses `cors({ origin: true })`. For production, it is recommended to restrict this to specific allowed origins to prevent unauthorized API calls.

### 3. Error Handling & Monitoring
- **Structured Logging**: Utilize `firebase-functions/logger` more extensively for searchable structured logs in Cloud Logging.
- **Alerting**: Set up Cloud Monitoring alerts for function errors (5xx) or high latency on the `createCheckoutSession` endpoint.

### 4. Database Optimization
- **Firestore Bundles**: If product data is frequently accessed, consider using Firestore Bundles to cache data on the frontend and reduce read costs.
- **Transactions**: Ensure any multi-document updates (e.g., updating both `orders` and user history) use Firestore Transactions or Batched Writes to maintain atomicity.

### 5. Deployment Workflow
- **CI/CD**: The presence of `.github/workflows` suggests automation. Ensure successful PRs include regression tests (like the existing Playwright tests) before deploying to the Cloud Run environment.
