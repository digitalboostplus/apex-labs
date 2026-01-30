const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const Stripe = require('stripe');

// Initialize Stripe lazily to prevent build-time failures
let stripe;
function getStripe() {
    if (!stripe) {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        stripe = new Stripe(secretKey, {
            apiVersion: '2023-10-16'
        });
    }
    return stripe;
}

const db = admin.firestore();

// Webhook signing secret
const getEndpointSecret = () => process.env.STRIPE_WEBHOOK_SECRET;


async function updateOrderLookup(sessionOrId, updates) {
    const ordersRef = db.collection('orders');
    let orderId = null;
    let orderDoc = null;

    // sessionOrId can be a session ID (string) or a session object
    const sessionId = typeof sessionOrId === 'string' ? sessionOrId : sessionOrId.id;
    const sessionObj = typeof sessionOrId === 'object' ? sessionOrId : null;

    // 1. Try lookup by sessionId
    const snapshot = await ordersRef.where('stripeSessionId', '==', sessionId).limit(1).get();

    if (!snapshot.empty) {
        orderDoc = snapshot.docs[0];
        orderId = orderDoc.id;
    }
    // 2. Try lookup by orderId in metadata (essential for Payment Links)
    else if (sessionObj && sessionObj.metadata && sessionObj.metadata.orderId) {
        const metadataOrderId = sessionObj.metadata.orderId;
        const doc = await ordersRef.doc(metadataOrderId).get();
        if (doc.exists) {
            orderDoc = doc;
            orderId = doc.id;

            // Update the record with the actual session ID for future lookups
            updates.stripeSessionId = sessionId;
        }
    }

    if (!orderId) {
        console.log(`No order found for session/metadata identifier: ${sessionId}`);
        return null;
    }

    await orderDoc.ref.update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return orderId;
}

async function handleCheckoutComplete(session) {
    console.log(`Processing checkout.session.completed: ${session.id}`);

    const customerDetails = session.customer_details || {};
    const shippingDetails = session.shipping_details || session.shipping || {};

    const updates = {
        status: 'paid',
        paymentStatus: session.payment_status,
        amountTotal: session.amount_total / 100,
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

    const orderId = await updateOrderLookup(session, updates);

    if (orderId) {
        console.log(`Order ${orderId} marked as paid`);

        const orderDoc = await db.collection('orders').doc(orderId).get();
        const orderData = orderDoc.data();

        if (orderData.userId) {
            await db.collection('users').doc(orderData.userId)
                .collection('orders').doc(orderId).set({
                    orderId: orderId,
                    status: 'paid',
                    amountTotal: updates.amountTotal,
                    items: orderData.items || [],
                    createdAt: orderData.createdAt,
                    paidAt: updates.paidAt
                });
        }
    }

    return orderId;
}

async function handleCheckoutExpired(session) {
    console.log(`Processing checkout.session.expired: ${session.id}`);
    await updateOrderLookup(session, {
        status: 'expired'
    });
}

async function handlePaymentFailed(paymentIntent) {
    console.log(`Processing payment_intent.payment_failed: ${paymentIntent.id}`);
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

async function handleChargeRefunded(charge) {
    console.log(`Processing charge.refunded: ${charge.id}`);
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

exports.stripeWebhook = onRequest({
    secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    maxInstances: 10
}, async (req, res) => {

    if (req.method !== 'POST') {
        return res.status(405).send('Method not allowed');
    }

    const sig = req.headers['stripe-signature'];
    const endpointSecret = getEndpointSecret();

    let event;

    try {
        event = getStripe().webhooks.constructEvent(
            req.rawBody,
            sig,
            endpointSecret
        );

        console.log(`Processing Stripe event: ${event.type} (${event.id})`);

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

        return res.status(200).json({ received: true });

    } catch (err) {
        logger.error('Webhook error:', err.message);
        logger.error('Stack trace:', err.stack);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
});

