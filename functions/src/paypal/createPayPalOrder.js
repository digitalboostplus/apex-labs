/**
 * Create PayPal Order
 * Accepts cart items and customer info, creates PayPal order, stores pending order in Firestore.
 * Replaces the Stripe createCheckoutSession function.
 */

const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const paypal = require('@paypal/checkout-server-sdk');
const { getPayPalClient } = require('./paypalClient');
const cors = require('cors')({
    origin: [
        'https://apex-labs-18862.web.app',
        'https://apex-labs-18862.firebaseapp.com',
        'http://localhost:3000',
        'http://localhost:5000',
        'http://127.0.0.1:4173'
    ]
});

const db = admin.firestore();

/**
 * Calculate tiered unit price for a product based on quantity.
 * Prices are in dollars (not cents).
 * @param {Object} item - Cart item with id, name, quantity
 * @returns {number} Unit price in dollars
 */
function getTieredPrice(item) {
    if (item.id === 'nadplus' || item.name.includes('NAD+')) {
        if (item.quantity >= 25) return 35.00;
        if (item.quantity >= 10) return 44.00;
        return 55.00;
    } else if (item.id === 'reta' || item.name.includes('RETA')) {
        if (item.quantity >= 25) return 45.00;
        if (item.quantity >= 10) return 56.00;
        return 70.00;
    } else if (item.id === 'mots-c') {
        if (item.quantity >= 25) return 30.00;
        if (item.quantity >= 10) return 36.00;
        return 45.00;
    } else if (item.id === 'pt-141' || item.id === 'ipamorelin') {
        if (item.quantity >= 25) return 25.00;
        if (item.quantity >= 10) return 30.00;
        return 38.00;
    } else if (item.id === 'bpc-157') {
        if (item.quantity >= 25) return 28.00;
        if (item.quantity >= 10) return 34.00;
        return 42.00;
    } else if (item.id === 'ghk-cu') {
        if (item.quantity >= 25) return 29.00;
        if (item.quantity >= 10) return 35.00;
        return 44.00;
    } else if (item.id === 'tesamorelin') {
        if (item.quantity >= 25) return 38.00;
        if (item.quantity >= 10) return 46.00;
        return 58.00;
    } else {
        // Standard tiers (AOD, CJC, TB-500): $55 / $44 / $35
        if (item.quantity >= 25) return 35.00;
        if (item.quantity >= 10) return 44.00;
        return 55.00;
    }
}

/**
 * Build PayPal purchase units from cart items
 * @param {Array} items - Cart items
 * @param {string} orderId - Firestore order ID for reference
 * @returns {Object} PayPal purchase unit
 */
function buildPurchaseUnit(items, orderId) {
    let totalAmount = 0;

    const paypalItems = items.map(item => {
        const unitPrice = getTieredPrice(item);
        const lineTotal = unitPrice * item.quantity;
        totalAmount += lineTotal;

        return {
            name: item.name,
            unit_amount: {
                currency_code: 'USD',
                value: unitPrice.toFixed(2)
            },
            quantity: String(item.quantity),
            sku: item.id,
            category: 'PHYSICAL_GOODS'
        };
    });

    return {
        reference_id: orderId,
        description: 'Apex Labs Research Compounds',
        items: paypalItems,
        amount: {
            currency_code: 'USD',
            value: totalAmount.toFixed(2),
            breakdown: {
                item_total: {
                    currency_code: 'USD',
                    value: totalAmount.toFixed(2)
                },
                shipping: {
                    currency_code: 'USD',
                    value: '0.00'
                }
            }
        },
        shipping: {
            options: [{
                id: 'priority',
                label: 'Free Priority Shipping',
                selected: true,
                amount: {
                    currency_code: 'USD',
                    value: '0.00'
                }
            }]
        }
    };
}

/**
 * Main handler for creating a PayPal order
 */
exports.createPayPalOrder = onRequest({
    // secrets: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'], // [RESTORE AFTER SETTING SECRETS]
    maxInstances: 10,
    concurrency: 80
}, (req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        try {
            const {
                items,
                customerEmail,
                userId,
                metadata = {}
            } = req.body;

            // Validate required fields
            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ error: 'Cart items are required' });
            }

            // Pre-generate Firestore order ID
            const orderRef = db.collection('orders').doc();
            const orderId = orderRef.id;

            // Build base URLs for redirects
            const origin = req.headers.origin || 'https://apex-labs-18862.web.app';
            const returnUrl = `${origin}/order-confirmation.html?paypal_order_id={PAYPAL_ORDER_ID}`;
            const cancelUrl = `${origin}/cart.html?canceled=true`;

            // Build purchase unit
            const purchaseUnit = buildPurchaseUnit(items, orderId);

            // Create PayPal order
            const request = new paypal.orders.OrdersCreateRequest();
            request.prefer('return=representation');
            request.requestBody({
                intent: 'CAPTURE',
                purchase_units: [purchaseUnit],
                payment_source: {
                    paypal: {
                        experience_context: {
                            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
                            brand_name: 'Apex Labs',
                            locale: 'en-US',
                            landing_page: 'LOGIN',
                            shipping_preference: 'GET_FROM_FILE',
                            user_action: 'PAY_NOW',
                            return_url: returnUrl.replace('{PAYPAL_ORDER_ID}', orderId),
                            cancel_url: cancelUrl
                        }
                    }
                },
                application_context: {
                    brand_name: 'Apex Labs',
                    shipping_preference: 'GET_FROM_FILE'
                }
            });

            const client = getPayPalClient();
            const order = await client.execute(request);

            // Find the approval URL
            const approvalLink = order.result.links.find(link => link.rel === 'approve');
            if (!approvalLink) {
                throw new Error('PayPal order created but no approval URL returned');
            }

            // Store pending order in Firestore
            const orderData = {
                id: orderId,
                paypalOrderId: order.result.id,
                status: 'pending',
                items: items.map(item => ({
                    id: item.id,
                    sku: item.sku || item.priceId || null,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    image: item.image
                })),
                customerEmail: customerEmail || null,
                userId: userId || null,
                metadata: {
                    ...metadata,
                    source: 'apex_labs_checkout'
                },
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await orderRef.set(orderData);

            logger.info(`PayPal order created: ${order.result.id}, Firestore order: ${orderId}`);

            return res.status(200).json({
                paypalOrderId: order.result.id,
                approvalUrl: approvalLink.href,
                orderId: orderId
            });

        } catch (error) {
            logger.error('Error creating PayPal order:', error);
            return res.status(error.statusCode || 500).json({
                error: error.message || 'Failed to create PayPal order'
            });
        }
    });
});
