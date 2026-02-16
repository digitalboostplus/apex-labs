/**
 * Firebase Cloud Functions for Apex Labs
 * Main entry point - exports all function handlers
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export PayPal functions
const { createPayPalOrder } = require('./src/paypal/createPayPalOrder');
const { capturePayPalOrder } = require('./src/paypal/capturePayPalOrder');
const { paypalWebhook } = require('./src/paypal/webhookHandler');

exports.createPayPalOrder = createPayPalOrder;
exports.capturePayPalOrder = capturePayPalOrder;
exports.paypalWebhook = paypalWebhook;
