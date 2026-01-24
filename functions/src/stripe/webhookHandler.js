/**
 * Stripe Webhook Handler
 * Processes Stripe events and updates order status in Firestore
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Stripe = require('stripe');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || functions.config().stripe?.secret_key, {
    apiVersion: '2023-10-16'
});

const db = admin.firestore();

// Webhook signing secret
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || functions.config().stripe?.webhook_secret;

/**
 * Update order status in Firestore
 * @param {string} sessionId - Stripe session ID
 * @param {Object} updates - Fields to update
 */
async function updateOrderBySessionId(sessionId, updates) {
    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef.where('stripeSessionId', '==', sessionId).limit(1).get();

    if (snapshot.empty) {
        console.warn(`No order found for session: ${sessionId}`);
        return null;
    }

    const orderDoc = snapshot.docs[0];
    await orderDoc.ref.update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return orderDoc.id;
}

/**
 * Handle checkout.session.completed event
 * @param {Object} session - Stripe checkout session
 */
async function handleCheckoutComplete(session) {
    console.log('Processing checkout.session.completed:', session.id);

    // Extract customer and shipping details
    const customerDetails = session.customer_details || {};
    const shippingDetails = session.shipping_details || session.shipping || {};

    const updates = {
        status: 'paid',
        paymentStatus: session.payment_status,
        amountTotal: session.amount_total / 100, // Convert from cents
        currency: session.currency,
        customerEmail: customerDetails.email || session.customer_email,
        customerName: customerDetails.name || null,
        customerPhone: customerDetails.phone || null,
        billingAddress: customerDetails.address || null,
        shippingAddress: shippingDetails.address || null,
        shippingName: shippingDetails.name || null,
        stripePaymentIntentId: session.payment_intent,
        stripeCustomerId: session.customer || null,
        paidAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const orderId = await updateOrderBySessionId(session.id, updates);

    if (orderId) {
        console.log(`Order ${orderId} marked as paid`);

        // If user is logged in, add order to their orders subcollection
        const orderDoc = await db.collection('orders').doc(orderId).get();
        const orderData = orderDoc.data();

        if (orderData.userId) {
            await db.collection('users').doc(orderData.userId)
                .collection('orders').doc(orderId).set({
                    orderId: orderId,
                    status: 'paid',
                    amountTotal: updates.amountTotal,
                    createdAt: orderData.createdAt,
                    paidAt: updates.paidAt
                });
        }
    }

    return orderId;
}

/**
 * Handle checkout.session.expired event
 * @param {Object} session - Stripe checkout session
 */
async function handleCheckoutExpired(session) {
    console.log('Processing checkout.session.expired:', session.id);

    await updateOrderBySessionId(session.id, {
        status: 'expired'
    });
}

/**
 * Handle payment_intent.payment_failed event
 * @param {Object} paymentIntent - Stripe payment intent
 */
async function handlePaymentFailed(paymentIntent) {
    console.log('Processing payment_intent.payment_failed:', paymentIntent.id);

    // Find order by payment intent ID
    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef
        .where('stripePaymentIntentId', '==', paymentIntent.id)
        .limit(1)
        .get();

    if (!snapshot.empty) {
        await snapshot.docs[0].ref.update({
            status: 'payment_failed',
            paymentError: paymentIntent.last_payment_error?.message || 'Payment failed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
}

/**
 * Handle charge.refunded event
 * @param {Object} charge - Stripe charge
 */
async function handleChargeRefunded(charge) {
    console.log('Processing charge.refunded:', charge.id);

    const paymentIntentId = charge.payment_intent;

    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef
        .where('stripePaymentIntentId', '==', paymentIntentId)
        .limit(1)
        .get();

    if (!snapshot.empty) {
        const isFullRefund = charge.amount_refunded === charge.amount;

        await snapshot.docs[0].ref.update({
            status: isFullRefund ? 'refunded' : 'partially_refunded',
            refundedAmount: charge.amount_refunded / 100,
            refundedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
}

/**
 * Main webhook handler
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    // Only allow POST requests
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }

    const sig = req.headers['stripe-signature'];

    let event;

    try {
        // Verify webhook signature
        event = stripe.webhooks.constructEvent(
            req.rawBody,
            sig,
            endpointSecret
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutComplete(event.data.object);
                break;

            case 'checkout.session.expired':
                await handleCheckoutExpired(event.data.object);
                break;

            case 'payment_intent.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;

            case 'charge.refunded':
                await handleChargeRefunded(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});
