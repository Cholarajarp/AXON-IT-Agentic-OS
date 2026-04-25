import { expect, test } from '@playwright/test';

const routes = [
  '/company-os',
  '/mission-control',
  '/market-radar',
  '/trust-ledger',
  '/agentic-finops',
  '/agent-projects',
  '/production-readiness',
  '/delivery-brain',
  '/structure',
  '/build',
  '/enterprise',
  '/release-command',
  '/preview-qa',
  '/security',
  '/checkpoints',
  '/service-desk',
  '/managed-services',
  '/customer-delivery',
  '/api-forge',
  '/skill-academy',
  '/autonomous-workforce',
  '/command',
  '/workflows',
  '/agents',
  '/memory',
  '/policies',
  '/evidence',
  '/incidents',
  '/cost',
  '/executive',
  '/dag',
  '/terminal',
  '/chat',
  '/audit',
  '/models',
  '/blueprint',
  '/integrations',
  '/evaluations',
  '/tools',
  '/code',
  '/pipeline',
  '/database',
  '/settings',
] as const;

test.describe('route audit', () => {
  test.setTimeout(180_000);

  test('all registered surfaces render without console or runtime errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && !/favicon|Failed to load resource/i.test(message.text())) {
        errors.push(message.text());
      }
    });
    page.on('pageerror', (error) => errors.push(error.message));

    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('main').getByText('Loading workspace...')).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText('Something went wrong');
      await expect(page.locator('body')).not.toContainText('Cannot read properties');
    }

    expect(errors).toEqual([]);
  });
});
