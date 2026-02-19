/**
 * Seed Products Cloud Function
 * Reads data/products.json and batch-writes all products to Firestore /products/{productId}
 * Only callable by admin users.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const seedProducts = onCall(async (request) => {
    // Verify caller is authenticated
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be signed in to seed products.');
    }

    // Verify caller is admin
    const db = admin.firestore();
    const adminDoc = await db.collection('admins').doc(request.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
        throw new HttpsError('permission-denied', 'Only admins can seed products.');
    }

    // Read products.json
    const productsPath = path.join(__dirname, '..', 'data', 'products.json');
    let productsData;
    try {
        const raw = fs.readFileSync(productsPath, 'utf8');
        productsData = JSON.parse(raw);
    } catch (error) {
        throw new HttpsError('internal', `Failed to read products.json: ${error.message}`);
    }

    const products = productsData.products || [];
    if (products.length === 0) {
        throw new HttpsError('not-found', 'No products found in products.json');
    }

    // Batch write to Firestore
    const batch = db.batch();
    const now = admin.firestore.FieldValue.serverTimestamp();

    products.forEach((product) => {
        const docRef = db.collection('products').doc(product.id);
        batch.set(docRef, {
            ...product,
            createdAt: now,
            updatedAt: now
        }, { merge: true });
    });

    await batch.commit();

    return {
        success: true,
        count: products.length,
        message: `Seeded ${products.length} products into Firestore.`
    };
});

module.exports = { seedProducts };
