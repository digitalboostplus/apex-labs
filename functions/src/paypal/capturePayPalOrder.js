/**
 * Capture PayPal Order
 * Called after buyer approves payment. Captures funds and updates Firestore order.
 * This is a new endpoint — Stripe auto-captured on session completion, but PayPal requires explicit capture.
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
 * Main handler for capturing a PayPal order after buyer approval
 */
exports.capturePayPalOrder = onRequest({
    secrets: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
    maxInstances: 10,
    concurrency: 80
}, (req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        try {
            const { paypalOrderId } = req.body;

            if (!paypalOrderId) {
                return res.status(400).json({ error: 'PayPal Order ID is required' });
            }

            // Capture the payment
            const request = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
            request.requestBody({});

            const client = getPayPalClient();
            const capture = await client.execute(request);

            const captureResult = capture.result;
            const captureStatus = captureResult.status; // 'COMPLETED', 'DECLINED', etc.

            if (captureStatus !== 'COMPLETED') {
                logger.warn(`PayPal capture not completed. Status: ${captureStatus}`, captureResult);
                return res.status(400).json({
                    error: `Payment capture failed with status: ${captureStatus}`,
                    status: captureStatus
                });
            }

            // Extract payment details
            const captureUnit = captureResult.purchase_units[0];
            const capturePayment = captureUnit.payments.captures[0];
            const payer = captureResult.payer || {};
            const shipping = captureUnit.shipping || {};

            // Find the Firestore order by paypalOrderId
            const ordersRef = db.collection('orders');
            const snapshot = await ordersRef
                .where('paypalOrderId', '==', paypalOrderId)
                .limit(1)
                .get();

            if (snapshot.empty) {
                logger.error(`No Firestore order found for PayPal order: ${paypalOrderId}`);
                // Still return success to the client since payment was captured
                return res.status(200).json({
                    status: 'COMPLETED',
                    captureId: capturePayment.id,
                    warning: 'Payment captured but order record not found'
                });
            }

            const orderDoc = snapshot.docs[0];
            const orderData = orderDoc.data();

            // Build update object
            const updates = {
                status: 'paid',
                paymentStatus: captureStatus,
                amountTotal: parseFloat(capturePayment.amount.value),
                currency: capturePayment.amount.currency_code,
                paypalCaptureId: capturePayment.id,
                paypalPayerId: payer.payer_id || null,
                customerEmail: payer.email_address || orderData.customerEmail || null,
                customerName: payer.name
                    ? `${payer.name.given_name || ''} ${payer.name.surname || ''}`.trim()
                    : null,
                shippingAddress: shipping.address || null,
                shippingName: shipping.name?.full_name || null,
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            // Update order in a transaction
            await db.runTransaction(async (transaction) => {
                transaction.update(orderDoc.ref, updates);

                // Copy to user's orders subcollection if authenticated
                if (orderData.userId) {
                    const userOrderRef = db.collection('users')
                        .doc(orderData.userId)
                        .collection('orders')
                        .doc(orderDoc.id);

                    transaction.set(userOrderRef, {
                        orderId: orderDoc.id,
                        status: 'paid',
                        amountTotal: updates.amountTotal,
                        items: orderData.items || [],
                        createdAt: orderData.createdAt,
                        paidAt: updates.paidAt
                    });
                }
            });

            logger.info(`PayPal order captured: ${paypalOrderId}, Firestore order: ${orderDoc.id}`);

            return res.status(200).json({
                status: 'COMPLETED',
                captureId: capturePayment.id,
                orderId: orderDoc.id
            });

        } catch (error) {
            logger.error('Error capturing PayPal order:', error);
            return res.status(error.statusCode || 500).json({
                error: error.message || 'Failed to capture PayPal order'
            });
        }
    });
});
