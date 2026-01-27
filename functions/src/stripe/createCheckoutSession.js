/**
 * Create Stripe Checkout Session
 * Accepts cart items and customer info, creates Stripe session, stores pending order
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const cors = require('cors')({ origin: true });

// Initialize Stripe lazily to prevent build-time failures
let stripe;
function getStripe() {
    if (!stripe) {
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY || functions.config().stripe?.secret_key, {
            apiVersion: '2023-10-16'
        });
    }
    return stripe;
}

const db = admin.firestore();

/**
 * Validate cart items against product catalog
 * @param {Array} items - Cart items
 * @returns {Promise<Array>} - Validated line items for Stripe
 */
async function validateAndBuildLineItems(items) {
    const lineItems = [];

    for (const item of items) {
        // Validate the price ID exists in Stripe
        try {
            const price = await getStripe().prices.retrieve(item.priceId);

            if (!price.active) {
                throw new Error(`Price ${item.priceId} is not active`);
            }

            lineItems.push({
                price: item.priceId,
                quantity: item.quantity
            });
        } catch (error) {
            console.error(`Invalid price ID: ${item.priceId}`, error.message);
            throw new functions.https.HttpsError(
                'invalid-argument',
                `Invalid product: ${item.name || item.priceId}`
            );
        }
    }

    return lineItems;
}

/**
 * Create pending order in Firestore
 * @param {Object} params - Order parameters
 * @returns {Promise<string>} - Order ID
 */
async function createPendingOrder({ sessionId, items, customerEmail, userId, metadata }) {
    const orderRef = db.collection('orders').doc();

    const order = {
        id: orderRef.id,
        stripeSessionId: sessionId,
        status: 'pending',
        items: items.map(item => ({
            id: item.id,
            priceId: item.priceId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image
        })),
        customerEmail: customerEmail || null,
        userId: userId || null,
        metadata: metadata || {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await orderRef.set(order);

    return orderRef.id;
}

/**
 * Main handler for creating checkout session
 */
exports.createCheckoutSession = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        // Only allow POST requests
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }

        try {
            const {
                items,
                customerEmail,
                userId,
                successUrl,
                cancelUrl,
                metadata = {}
            } = req.body;

            // Validate required fields
            if (!items || !Array.isArray(items) || items.length === 0) {
                res.status(400).json({ error: 'Cart items are required' });
                return;
            }

            // Build base URLs for redirects
            const origin = req.headers.origin || 'https://apex-labs-18862.web.app';
            const finalSuccessUrl = successUrl || `${origin}/order-confirmation.html?session_id={CHECKOUT_SESSION_ID}`;
            const finalCancelUrl = cancelUrl || `${origin}/cart.html?canceled=true`;

            // Validate and build Stripe line items
            const lineItems = await validateAndBuildLineItems(items);

            // Create Stripe Checkout session
            const sessionParams = {
                mode: 'payment',
                payment_method_types: ['card'],
                line_items: lineItems,
                success_url: finalSuccessUrl,
                cancel_url: finalCancelUrl,
                billing_address_collection: 'required',
                shipping_address_collection: {
                    allowed_countries: ['US', 'CA']
                },
                metadata: {
                    ...metadata,
                    source: 'apex_labs_checkout'
                }
            };

            // Add customer email if provided
            if (customerEmail) {
                sessionParams.customer_email = customerEmail;
            }

            // Create the Stripe session
            const session = await getStripe().checkout.sessions.create(sessionParams);

            // Store pending order in Firestore
            const orderId = await createPendingOrder({
                sessionId: session.id,
                items,
                customerEmail,
                userId,
                metadata: {
                    ...metadata,
                    stripePaymentIntentId: session.payment_intent
                }
            });

            // Return session URL and order ID
            res.status(200).json({
                sessionId: session.id,
                sessionUrl: session.url,
                orderId: orderId
            });

        } catch (error) {
            console.error('Error creating checkout session:', error);

            if (error instanceof functions.https.HttpsError) {
                res.status(400).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Failed to create checkout session' });
            }
        }
    });
});
