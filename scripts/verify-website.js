const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://apex-labs-18862.web.app';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR);
}

async function runTest() {
    console.log('--- Starting Comprehensive Website Verification ---');
    const browser = await chromium.launch({ headless: true });
    // Using a larger viewport to ensure elements are visible
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();

    try {
        // 1. Home Page & Navigation
        console.log('Testing Home Page...');
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'home.png') });
        console.log('Home Page loaded, screenshot saved.');

        const mainLinks = ['peptides.html', 'program-overview.html', 'pricing.html'];
        for (const link of mainLinks) {
            const exists = await page.locator(`nav a[href*="${link}"]`).first().isVisible();
            console.log(`- Link to ${link}: ${exists ? 'Found' : 'NOT FOUND'}`);
        }

        // 2. Catalog (peptides.html)
        console.log('\nTesting Peptides Catalog...');
        await page.goto(`${BASE_URL}/peptides.html`);
        await page.waitForLoadState('networkidle');

        // Count products (h3 tags in the main grid)
        const productCount = await page.locator('h3').count();
        console.log(`- Found ${productCount} items in catalog.`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'peptides.png') });

        // 3. Add to Cart
        console.log('\nAdding product to cart...');
        const addButton = page.locator('button:has-text("Add")').first();
        if (await addButton.isVisible()) {
            await addButton.click();
            console.log('- Clicked "Add" button.');

            // Wait for cart drawer to be visible
            await page.waitForSelector('#cart-drawer', { state: 'visible', timeout: 5000 });
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'cart-drawer.png') });
            console.log('- Cart drawer visible.');

            // Verify item in drawer
            const cartItem = page.locator('#cart-items .cart-item').first();
            if (await cartItem.isVisible()) {
                const cartItemName = await cartItem.locator('h3').textContent();
                console.log(`- Verified item in cart: ${cartItemName.trim()}`);
            } else {
                console.log('- Cart item NOT found in drawer UI!');
                // Check if cartManager actually has items
                const cartState = await page.evaluate(() => window.cartManager.cart);
                console.log('- Internal cart state:', JSON.stringify(cartState));
            }
        } else {
            console.log('- Add button NOT found.');
        }

        // 4. Checkout Flow
        console.log('\nTesting Checkout Flow...');
        const checkoutBtn = page.locator('#checkout-btn');
        if (await checkoutBtn.isVisible()) {
            await checkoutBtn.click({ force: true });
            console.log('- Clicked "Checkout" button.');
            await page.waitForURL('**/checkout.html', { timeout: 10000 });
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'checkout.png') });
            console.log('- Checkout page loaded.');

            const checkoutItemsCount = await page.locator('#order-items > div').count();
            console.log(`- Found ${checkoutItemsCount} items on checkout page.`);
        } else {
            console.log('- Checkout button NOT found.');
        }

        // 5. Finalize Proposal
        console.log('\nFinalizing Proposal...');
        const finalizeBtn = page.locator('#finalize-order');
        if (await finalizeBtn.isVisible()) {
            await finalizeBtn.click();
            console.log('- Clicked "Finalize Proposal".');
            await page.waitForURL('**/order-confirmation.html', { timeout: 10000 });
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'confirmation.png') });
            console.log('- Redirection to confirmation page successful.');

            const protocolId = await page.locator('#protocol-id').textContent();
            console.log(`- Generated Protocol ID: ${protocolId}`);
        } else {
            console.log('- Finalize button NOT found.');
        }

        // 6. Pricing Matrix
        console.log('\nTesting Pricing Matrix...');
        await page.goto(`${BASE_URL}/pricing.html`);
        await page.waitForSelector('#pricing-body tr', { timeout: 5000 });
        const pricingRows = await page.locator('#pricing-body tr').count();
        console.log(`- Found ${pricingRows} items in pricing matrix.`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'pricing-matrix.png') });

        // 7. Product Detail Page
        console.log('\nTesting Product Detail Page (AOD-9604)...');
        await page.goto(`${BASE_URL}/pricing/aod-9604.html`);
        await page.waitForLoadState('networkidle');
        const detailTitle = await page.title();
        console.log(`- Loaded detail page: ${detailTitle}`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'product-detail.png') });

        console.log('\n--- Verification Completed Successfully ---');

    } catch (error) {
        console.error('\nVerification FAILED:', error.message);
        try {
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error-state.png') });
        } catch (e) { }
    } finally {
        await browser.close();
    }
}

runTest();
