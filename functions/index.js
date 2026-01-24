/**
 * Firebase Cloud Functions for Apex Labs
 * Main entry point - exports all function handlers
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export Stripe functions
const { createCheckoutSession } = require('./src/stripe/createCheckoutSession');
const { stripeWebhook } = require('./src/stripe/webhookHandler');

exports.createCheckoutSession = createCheckoutSession;
exports.stripeWebhook = stripeWebhook;
