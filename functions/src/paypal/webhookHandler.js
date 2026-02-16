/**
 * PayPal Webhook Handler
 * Handles PayPal webhook events for order status updates.
 * Replaces the Stripe webhook handler.
 */

const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getAccessToken } = require('./paypalClient');

const db = admin.firestore();

/**
 * Verify PayPal webhook signature
 * @param {Object} headers - Request headers
 * @param {Object|string} body - Raw request body
 * @returns {Promise<boolean>}
 */
async function verifyWebhookSignature(headers, body) {
    try {
        const accessToken = await getAccessToken();
        const webhookId = process.env.PAYPAL_WEBHOOK_ID;

        if (!webhookId) {
            logger.warn('PAYPAL_WEBHOOK_ID not configured, skipping signature verification');
            return true; // Allow in dev, but log warning
        }

        const isProduction = process.env.NODE_ENV === 'production' ||
            process.env.FUNCTIONS_EMULATOR !== 'true';

        const baseUrl = isProduction
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';

        const verifyBody = {
            auth_algo: headers['paypal-auth-algo'],
            cert_url: headers['paypal-cert-url'],
            transmission_id: headers['paypal-transmission-id'],
            transmission_sig: headers['paypal-transmission-sig'],
            transmission_time: headers['paypal-transmission-time'],
            webhook_id: webhookId,
            webhook_event: typeof body === 'string' ? JSON.parse(body) : body
        };

        const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(verifyBody)
        });

        if (!response.ok) {
            logger.error(`Webhook verification request failed: ${response.status}`);
            return false;
        }

        const result = await response.json();
        return result.verification_status === 'SUCCESS';
    } catch (error) {
        logger.error('Webhook signature verification error:', error);
        return false;
    }
}

/**
 * Find and update an order by PayPal Order ID
 * @param {string} paypalOrderId - PayPal Order ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<string|null>} Firestore order ID or null
 */
async function updateOrderByPayPalId(paypalOrderId, updates) {
    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef
        .where('paypalOrderId', '==', paypalOrderId)
        .limit(1)
        .get();

    if (snapshot.empty) {
        logger.warn(`No order found for PayPal order ID: ${paypalOrderId}`);
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
 * Handle PAYMENT.CAPTURE.COMPLETED event
 */
async function handleCaptureCompleted(resource) {
    logger.info(`Processing PAYMENT.CAPTURE.COMPLETED: ${resource.id}`);

    // The resource is the capture object
    // Find the order using the custom_id or supplementary_data
    const orderId = resource.custom_id || null;
    const amount = resource.amount || {};

    const updates = {
        status: 'paid',
        paymentStatus: 'COMPLETED',
        paypalCaptureId: resource.id,
        amountTotal: parseFloat(amount.value || 0),
        currency: amount.currency_code || 'USD',
        paidAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Try to find by custom_id first (our Firestore order ID)
    if (orderId) {
        const orderRef = db.collection('orders').doc(orderId);
        const doc = await orderRef.get();
        if (doc.exists) {
            await orderRef.update({
                ...updates,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            logger.info(`Order ${orderId} marked as paid via webhook`);
            return orderId;
        }
    }

    // Fallback: search by paypalCaptureId
    logger.warn('Could not find order by custom_id, capture may have been handled by capturePayPalOrder endpoint');
    return null;
}

/**
 * Handle PAYMENT.CAPTURE.DENIED event
 */
async function handleCaptureDenied(resource) {
    logger.info(`Processing PAYMENT.CAPTURE.DENIED: ${resource.id}`);

    const orderId = resource.custom_id || null;
    if (orderId) {
        const orderRef = db.collection('orders').doc(orderId);
        const doc = await orderRef.get();
        if (doc.exists) {
            await orderRef.update({
                status: 'payment_failed',
                paymentError: 'Payment was denied by PayPal',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return orderId;
        }
    }
    return null;
}

/**
 * Handle PAYMENT.CAPTURE.REFUNDED event
 */
async function handleCaptureRefunded(resource) {
    logger.info(`Processing PAYMENT.CAPTURE.REFUNDED: ${resource.id}`);

    const captureId = resource.id;
    const refundAmount = parseFloat(resource.amount?.value || 0);

    // Find order by capture ID
    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef
        .where('paypalCaptureId', '==', captureId)
        .limit(1)
        .get();

    if (!snapshot.empty) {
        const orderDoc = snapshot.docs[0];
        const orderData = orderDoc.data();
        const originalAmount = orderData.amountTotal || 0;
        const isFullRefund = Math.abs(refundAmount - originalAmount) < 0.01;

        await orderDoc.ref.update({
            status: isFullRefund ? 'refunded' : 'partially_refunded',
            refundedAmount: refundAmount,
            refundedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return orderDoc.id;
    }

    logger.warn(`No order found for PayPal capture ID: ${captureId}`);
    return null;
}

/**
 * Main webhook handler
 */
exports.paypalWebhook = onRequest({
    // secrets: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'], // [RESTORE AFTER SETTING SECRETS]
    maxInstances: 10,
    concurrency: 80
}, async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method not allowed');
    }

    try {
        // Verify webhook signature
        const isValid = await verifyWebhookSignature(req.headers, req.body);
        if (!isValid) {
            logger.error('Invalid PayPal webhook signature');
            return res.status(401).send('Invalid webhook signature');
        }

        const event = req.body;
        const eventType = event.event_type;
        const resource = event.resource;

        logger.info(`Processing PayPal event: ${eventType} (${event.id})`);

        switch (eventType) {
            case 'PAYMENT.CAPTURE.COMPLETED':
                await handleCaptureCompleted(resource);
                break;
            case 'PAYMENT.CAPTURE.DENIED':
                await handleCaptureDenied(resource);
                break;
            case 'PAYMENT.CAPTURE.REFUNDED':
                await handleCaptureRefunded(resource);
                break;
            case 'CHECKOUT.ORDER.APPROVED':
                // Order approved but not yet captured — handled by capturePayPalOrder endpoint
                logger.info(`Order approved: ${resource.id}`);
                break;
            default:
                logger.info(`Unhandled PayPal event type: ${eventType}`);
        }

        return res.status(200).json({ received: true });

    } catch (error) {
        logger.error('Webhook error:', error.message);
        logger.error('Stack trace:', error.stack);
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }
});
