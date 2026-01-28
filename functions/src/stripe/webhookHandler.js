const admin = require('firebase-admin');
const functions = require('firebase-functions');
const Stripe = require('stripe');

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

// Webhook signing secret
const getEndpointSecret = () => functions.config().stripe?.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET;

async function updateOrderBySessionId(sessionId, updates) {
    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef.where('stripeSessionId', '==', sessionId).limit(1).get();

    if (snapshot.empty) {
        console.log(`No order found for session: ${sessionId}`);
        return null;
    }

    const orderDoc = snapshot.docs[0];
    await orderDoc.ref.update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return orderDoc.id;
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

    const orderId = await updateOrderBySessionId(session.id, updates);

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
                    createdAt: orderData.createdAt,
                    paidAt: updates.paidAt
                });
        }
    }

    return orderId;
}

async function handleCheckoutExpired(session) {
    console.log(`Processing checkout.session.expired: ${session.id}`);
    await updateOrderBySessionId(session.id, {
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

exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
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
        console.error('Webhook error:', err.message);
        console.error('Stack trace:', err.stack);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
});
