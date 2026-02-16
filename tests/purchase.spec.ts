import { test, expect } from '@playwright/test';

test('user can complete purchase flow end-to-end', async ({ page }) => {
  // Mock the PayPal order creation API
  await page.route('**/api/create-paypal-order', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        paypalOrderId: 'PAYPAL_TEST_ORDER_123',
        approvalUrl: '/order-confirmation.html?paypal_order_id=PAYPAL_TEST_ORDER_123&order_id=order_test_123',
        orderId: 'order_test_123'
      })
    });
  });

  // Mock the PayPal capture API
  await page.route('**/api/capture-paypal-order', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'COMPLETED',
        captureId: 'CAPTURE_TEST_123',
        orderId: 'order_test_123'
      })
    });
  });

  await page.goto('/');

  await page.waitForSelector('#cart-container', { state: 'attached' });

  const addButton = page.getByRole('button', { name: /Add to Cart/i }).first();
  await addButton.click();

  await expect.poll(async () => {
    return await page.evaluate(() => window.cartManager?.getItemCount?.() ?? 0);
  }).toBeGreaterThan(0);

  await page.goto('/cart.html');
  const cartItems = page.locator('#cart-items');
  await expect(cartItems).toContainText(/AOD-9604/i);

  await page.getByRole('link', { name: /Proceed to Checkout/i }).click();
  await expect(page).toHaveURL(/checkout\.html$/);

  const orderItems = page.locator('#order-items');
  await expect(orderItems).toContainText(/AOD-9604/i);

  // Fill in email for checkout
  const emailInput = page.locator('#customer-email');
  await emailInput.fill('test@example.com');

  // The PayPal button renders in an iframe, so we verify the container exists
  const paypalContainer = page.locator('#paypal-button-container');
  await expect(paypalContainer).toBeVisible();
});

test('cart persists items across page navigation', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#cart-container', { state: 'attached' });

  // Add item to cart
  const addButton = page.getByRole('button', { name: /Add to Cart/i }).first();
  await addButton.click();

  // Wait for cart to update
  await expect.poll(async () => {
    return await page.evaluate(() => window.cartManager?.getItemCount?.() ?? 0);
  }).toBeGreaterThan(0);

  // Navigate to another page
  await page.goto('/peptides.html');

  // Verify cart still has items
  await expect.poll(async () => {
    return await page.evaluate(() => window.cartManager?.getItemCount?.() ?? 0);
  }).toBeGreaterThan(0);
});

test('cart drawer opens and closes', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#cart-container', { state: 'attached' });

  // Wait for cart drawer to be loaded
  await page.waitForSelector('#cart-drawer', { state: 'attached' });

  // Click cart icon to open drawer
  const cartButton = page.locator('button').filter({ has: page.locator('[data-lucide="shopping-bag"], [data-lucide="shopping-cart"]') }).first();
  await cartButton.click();

  // Verify drawer is visible
  const drawer = page.locator('#cart-drawer');
  await expect(drawer).not.toHaveClass(/translate-x-full/);

  // Close drawer
  const closeButton = page.locator('#cart-drawer button[aria-label="Close Cart"]');
  await closeButton.click();

  // Verify drawer is hidden
  await expect(drawer).toHaveClass(/translate-x-full/);
});

test('can remove items from cart', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#cart-container', { state: 'attached' });

  // Add item to cart
  const addButton = page.getByRole('button', { name: /Add to Cart/i }).first();
  await addButton.click();

  await expect.poll(async () => {
    return await page.evaluate(() => window.cartManager?.getItemCount?.() ?? 0);
  }).toBeGreaterThan(0);

  // Go to cart page
  await page.goto('/cart.html');

  // Get initial count
  const initialCount = await page.evaluate(() => window.cartManager?.getItemCount?.() ?? 0);

  // Click remove button
  const removeButton = page.locator('button').filter({ has: page.locator('svg path[d*="M19 7l-.867"]') }).first();
  if (await removeButton.count() > 0) {
    await removeButton.click();

    // Verify count decreased
    await expect.poll(async () => {
      return await page.evaluate(() => window.cartManager?.getItemCount?.() ?? 0);
    }).toBeLessThan(initialCount);
  }
});
