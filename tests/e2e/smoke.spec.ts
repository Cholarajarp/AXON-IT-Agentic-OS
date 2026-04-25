import { expect, test } from '@playwright/test';

test('AXON shell loads, closes popovers, and navigates core surfaces', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !/favicon|Failed to load resource/i.test(message.text())) {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/');
  await expect(page).toHaveTitle(/AXON IT Agentic AI OS/);
  await expect(page.getByRole('heading', { name: 'Company OS' })).toBeVisible();
  await expect(page.getByText('API live')).toBeVisible();

  await page.getByLabel('Notifications').click();
  await expect(page.getByText('Notifications', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Notifications', { exact: true })).toHaveCount(0);

  await page.getByText('Settings', { exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.getByText('Agent Projects', { exact: true }).click();
  await expect(page).toHaveURL(/\/agent-projects$/);
  await expect(page.getByRole('heading', { name: 'Agent Projects' })).toBeVisible();

  await page.getByText('Preview QA', { exact: true }).click();
  await expect(page).toHaveURL(/\/preview-qa$/);
  await expect(page.getByRole('heading', { name: 'Preview QA' })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
