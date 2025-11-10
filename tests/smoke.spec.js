/**
 * Playwright Smoke Test for Ignite Fitness
 * Tests basic app loading and functionality
 */

const { test, expect } = require('@playwright/test');

test.describe('Ignite Fitness Smoke Tests', () => {
    test('App loads successfully', async ({ page }) => {
        // Navigate to the app
        await page.goto('/');

        // Wait for main content to be visible
        await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 });

        // Check that app is ready
        await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true', { timeout: 10000 });

        // Verify no critical errors in console
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        // Wait a bit for any delayed errors
        await page.waitForTimeout(2000);

        // Filter out expected errors (like missing Netlify functions in local dev)
        const criticalErrors = errors.filter(error =>
            !error.includes('netlify/functions') &&
            !error.includes('503') &&
            !error.includes('404')
        );

        expect(criticalErrors).toHaveLength(0);
    });

    test('Health check page works', async ({ page }) => {
        await page.goto('/health.html');

        // Wait for health check to complete
        await expect(page.locator('.status')).toContainText('Core Modules', { timeout: 10000 });

        // Check that we have some results
        const statusElements = await page.locator('.status').count();
        expect(statusElements).toBeGreaterThan(0);

        // Verify no critical errors
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        await page.waitForTimeout(1000);
        expect(errors).toHaveLength(0);
    });

    test('SPA routing works', async ({ page }) => {
        await page.goto('/');

        // Wait for app to load
        await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 });

        // Test hash routing
        await page.goto('/#/login');
        await expect(page.locator('#main-content')).toBeVisible();

        // Test another route
        await page.goto('/#/training');
        await expect(page.locator('#main-content')).toBeVisible();
    });

    test('Service worker is registered', async ({ page }) => {
        await page.goto('/');

        // Wait for service worker to register
        await page.waitForTimeout(3000);

        // Check service worker registration
        const swRegistration = await page.evaluate(() => {
            return navigator.serviceWorker.getRegistration().then(reg => reg ? 'registered' : 'not registered');
        });

        expect(swRegistration).toBe('registered');
    });

    test('Critical modules are loaded', async ({ page }) => {
        await page.goto('/');

        // Wait for app to load
        await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 });

        // Check critical modules are available
        const modulesLoaded = await page.evaluate(() => {
            const modules = ['SafeLogger', 'EventBus', 'StorageManager', 'AuthManager', 'Router'];
            return modules.every(module => window[module] !== undefined);
        });

        expect(modulesLoaded).toBe(true);
    });

    test('App handles errors gracefully', async ({ page }) => {
        // Inject an error to test error handling
        await page.goto('/');

        // Wait for app to load
        await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 });

        // Inject a test error
        await page.evaluate(() => {
            // Simulate an error
            setTimeout(() => {
                throw new Error('Test error for error handling');
            }, 100);
        });

        // Wait a bit to see if error handling works
        await page.waitForTimeout(2000);

        // App should still be functional
        await expect(page.locator('#main-content')).toBeVisible();
    });
});

