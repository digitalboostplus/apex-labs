/**
 * Create Stripe Checkout Session
 * Accepts cart items and customer info, creates Stripe session, stores pending order
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const Stripe = require('stripe');
const cors = require('cors')({ origin: true });

// Initialize Stripe lazily to prevent build-time failures
let stripe;
function getStripe() {
    if (!stripe) {
        const secretKey = functions.config().stripe?.secret_key || process.env.STRIPE_SECRET_KEY;
        stripe = new Stripe(secretKey, {
            apiVersion: '2023-10-16'
        });
    }
    return stripe;
}

const db = admin.firestore();

async function validateAndBuildLineItems(items) {
    const lineItems = [];

    for (const item of items) {
        // Calculate the tiered price based on quantity
        // Tier 0 (1-9): $75, Tier 1 (10-24): $65, Tier 2 (25+): $50
        let unitAmount = 7500; // Default $75.00

        // Custom logic for specific products if needed (e.g., NAD+ is $150)
        if (item.id === 'nadplus' || item.name.includes('NAD+')) {
            if (item.quantity >= 25) unitAmount = 10000;
            else if (item.quantity >= 10) unitAmount = 12000;
            else unitAmount = 15000;
        } else if (item.id === 'reta' || item.name.includes('RETA')) {
            // RETA tiers: $120 / $105 / $95
            if (item.quantity >= 25) unitAmount = 9500;
            else if (item.quantity >= 10) unitAmount = 10500;
            else unitAmount = 12000;
        } else if (item.id === 'mots-c') {
            // MOTS-C tiers: $65 / $55 / $45
            if (item.quantity >= 25) unitAmount = 4500;
            else if (item.quantity >= 10) unitAmount = 5500;
            else unitAmount = 6500;
        } else if (item.id === 'pt-141') {
            // PT-141 tiers: $60 / $50 / $40
            if (item.quantity >= 25) unitAmount = 4000;
            else if (item.quantity >= 10) unitAmount = 5000;
            else unitAmount = 6000;
        } else {
            // Standard $75/$65/$50 tiers (BPC, AOD, CJC, Ipamorelin, TB-500, Tesamorelin)
            if (item.quantity >= 25) unitAmount = 5000;
            else if (item.quantity >= 10) unitAmount = 6500;
            else unitAmount = 7500;
        }

        lineItems.push({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.name,
                    images: item.image ? [item.image.startsWith('http') ? item.image : `https://apex-labs-18862.web.app/${item.image.replace(/^\//, '')}`] : [],
                    metadata: {
                        productId: item.id
                    }
                },
                unit_amount: unitAmount,
            },
            quantity: item.quantity
        });
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
            priceId: item.priceId || null,
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
            return res.status(405).json({ error: 'Method not allowed' });
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
                return res.status(400).json({ error: 'Cart items are required' });
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
            return res.status(200).json({
                sessionId: session.id,
                sessionUrl: session.url,
                orderId: orderId
            });

        } catch (error) {
            console.error('Error creating checkout session:', error);
            return res.status(error.status || 500).json({ error: error.message || 'Failed to create checkout session' });
        }
    });
});
