/**
 * PayPal REST API Client
 * Lazily initializes the PayPal HTTP client using Firebase Secrets.
 */

const paypal = require('@paypal/checkout-server-sdk');

let client;

/**
 * Get or create the PayPal HTTP client
 * @returns {paypal.core.PayPalHttpClient}
 */
function getPayPalClient() {
    if (!client) {
        const clientId = process.env.PAYPAL_CLIENT_ID;
        const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error(
                'PayPal credentials not configured. Ensure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET secrets are set.'
            );
        }

        // Use Live for production, Sandbox for everything else
        const isProduction = process.env.NODE_ENV === 'production' ||
            process.env.FUNCTIONS_EMULATOR !== 'true';

        const environment = isProduction
            ? new paypal.core.LiveEnvironment(clientId, clientSecret)
            : new paypal.core.SandboxEnvironment(clientId, clientSecret);

        client = new paypal.core.PayPalHttpClient(environment);
    }
    return client;
}

/**
 * Get a PayPal OAuth2 access token for direct REST calls (e.g., webhook verification)
 * @returns {Promise<string>} Bearer token
 */
async function getAccessToken() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('PayPal credentials not configured.');
    }

    const isProduction = process.env.NODE_ENV === 'production' ||
        process.env.FUNCTIONS_EMULATOR !== 'true';

    const baseUrl = isProduction
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
        },
        body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
        throw new Error(`Failed to get PayPal access token: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
}

module.exports = { getPayPalClient, getAccessToken };
