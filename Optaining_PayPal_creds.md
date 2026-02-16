# 📋 Guide: Obtaining PayPal API Credentials for Apex Labs

To connect the website to PayPal, we need three pieces of information from your PayPal Developer account: **Client ID**, **Secret Key**, and **Webhook ID**.

### Step 1: Log in to the PayPal Developer Portal
1.  Go to the [PayPal Developer Dashboard](https://developer.paypal.com/).
2.  Log in using your **PayPal Business account** credentials.

### Step 2: Create a REST API App
1.  On the left-hand sidebar, click on **Apps & Credentials**.
2.  At the top of the page, you will see a toggle for **Sandbox** and **Live**. 
    *   *Note: You will need to repeat these steps for both to ensure we can test safely before going live.*
3.  Under the "REST API apps" section, click the **Create App** button.
4.  **App Name:** `Apex Labs Web Store`
5.  **App Type:** `Merchant`
6.  Click **Create App**.

### Step 3: Copy Client ID and Secret
1.  Once the app is created, you will be taken to its details page.
2.  **Client ID:** Copy the long string of letters and numbers.
3.  **Secret:** Click the **Show** link to reveal the Secret Key and copy it.
    *   *Keep the Secret Key safe; do not share it via unencrypted channels like email if possible.*

### Step 4: Configure the Webhook & Get Webhook ID
The Webhook allows PayPal to "talk back" to our website to confirm when a payment is successful.
1.  On the same App details page, scroll down to the **Webhooks** section.
2.  Click **Add Webhook**.
3.  **Webhook URL:** `https://apex-labs-18862.web.app/api/paypal-webhook`
4.  **Event Types:** Select the following events:
    *   `CHECKOUT.ORDER.APPROVED`
    *   `PAYMENT.CAPTURE.COMPLETED`
    *   `PAYMENT.CAPTURE.DENIED`
    *   `PAYMENT.CAPTURE.REFUNDED`
5.  Click **Save**.
6.  Once saved, a **Webhook ID** will appear in the table. Copy this ID.

---

### Summary Checklist for the Owner
Please provide the developer with these 6 values:

**Sandbox (Testing Environment):**
*   [ ] Sandbox Client ID
*   [ ] Sandbox Secret Key
*   [ ] Sandbox Webhook ID

**Live (Production Environment):**
*   [ ] Live Client ID
*   [ ] Live Secret Key
*   [ ] Live Webhook ID
