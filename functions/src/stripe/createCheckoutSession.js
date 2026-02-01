/**
 * Create Stripe Checkout Session
 * Accepts cart items and customer info, creates Stripe session, stores pending order
 */

const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const Stripe = require('stripe');
const cors = require('cors')({ origin: true });

// Initialize Stripe lazily to prevent build-time failures
let stripe;
function getStripe() {
    if (!stripe) {
        // Prefer secret from environment/secrets in Gen 2
        const secretKey = process.env.STRIPE_SECRET_KEY;
        if (!secretKey) {
            throw new Error('Stripe secret key not configured. Ensure STRIPE_SECRET_KEY secret is set.');
        }
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
            // NAD+ tiers: $150 / $135 / $125
            if (item.quantity >= 25) unitAmount = 12500;
            else if (item.quantity >= 10) unitAmount = 13500;
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
        } else if (item.id === 'ipamorelin' || item.id === 'tb-500' || item.id === 'tesamorelin') {
            // Premium tiers: $80 / $65 / $55
            if (item.quantity >= 25) unitAmount = 5500;
            else if (item.quantity >= 10) unitAmount = 6500;
            else unitAmount = 8000;
        } else {
            // Standard tiers (BPC, AOD, CJC, GHK-Cu): $75 / $60 / $50
            if (item.quantity >= 25) unitAmount = 5000;
            else if (item.quantity >= 10) unitAmount = 6000;
            else unitAmount = 7500;
        }

        // Build properly encoded image URL
        let imageUrl = null;
        if (item.image) {
            if (item.image.startsWith('http')) {
                imageUrl = item.image;
            } else {
                // Encode path segments to handle spaces and special characters
                const cleanPath = item.image.replace(/^\//, '');
                const encodedPath = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
                imageUrl = `https://apex-labs-18862.web.app/${encodedPath}`;
            }
        }

        lineItems.push({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.name,
                    images: imageUrl ? [imageUrl] : [],
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
exports.createCheckoutSession = onRequest({
    secrets: ["STRIPE_SECRET_KEY"],
    maxInstances: 10
}, (req, res) => {
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

            // Calculate total unit amount for potential Payment Link
            const totalAmount = lineItems.reduce((sum, item) => sum + (item.price_data.unit_amount * item.quantity), 0);

            // Support for Stripe Payment Link as requested
            if (req.body.usePaymentLink === true) {
                const stripe = getStripe();

                // Robust product lookup/creation
                let productId;
                try {
                    const products = await stripe.products.list({ limit: 100 });
                    const existingProduct = products.data.find(p => p.name === 'Custom Order Fulfillment');
                    if (existingProduct) {
                        productId = existingProduct.id;
                    } else {
                        const newProduct = await stripe.products.create({
                            name: 'Custom Order Fulfillment',
                            description: 'Generic product for custom order totals from Apex Labs.'
                        });
                        productId = newProduct.id;
                    }
                } catch (pe) {
                    console.error('Error finding/creating product:', pe);
                    // Fallback to the one I created just in case
                    productId = 'prod_TsjoEOJRMMTWY6';
                }

                // Create a temporary price for the total amount
                const price = await stripe.prices.create({
                    currency: 'usd',
                    unit_amount: totalAmount,
                    product: productId,
                    metadata: {
                        source: 'apex_labs_payment_link',
                        userId: userId || 'guest'
                    }
                });

                // Pre-generate order ID to use in metadata
                const orderRef = db.collection('orders').doc();
                const orderId = orderRef.id;

                // Create the Payment Link
                const paymentLink = await getStripe().paymentLinks.create({
                    line_items: [{
                        price: price.id,
                        quantity: 1,
                    }],
                    after_completion: {
                        type: 'redirect',
                        redirect: {
                            url: finalSuccessUrl.replace('{CHECKOUT_SESSION_ID}', 'payment_link')
                        }
                    },
                    metadata: {
                        ...metadata,
                        orderId: orderId, // Crucial for webhook
                        source: 'apex_labs_checkout',
                        isPaymentLink: 'true'
                    }
                });

                // Store pending order in Firestore
                const orderData = {
                    id: orderId,
                    stripeSessionId: paymentLink.id, // Store payment link ID
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
                    metadata: {
                        ...metadata,
                        priceId: price.id,
                        isPaymentLink: true
                    },
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };

                await orderRef.set(orderData);

                return res.status(200).json({
                    sessionId: paymentLink.id,
                    sessionUrl: paymentLink.url,
                    orderId: orderId
                });
            }

            // Default: Create Stripe Checkout session
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
