import { expect, test } from '../fixtures';

test.describe('Traces', () => {
  test('traces panel shows trace after invocation', async ({ page }) => {
    await page.goto('/');

    const chatInput = page.getByTestId('chat-input');
    await expect(chatInput).toBeEnabled({ timeout: 60_000 });

    await chatInput.fill('Say hello');
    await page.getByRole('button', { name: 'Send message' }).click();

    const messageList = page.getByTestId('message-list');
    const assistantMessage = messageList.getByTestId('chat-message-1');
    await expect(assistantMessage).toBeVisible({ timeout: 60_000 });
    await expect(assistantMessage).not.toContainText('ECONNREFUSED');

    await page.getByRole('tab', { name: 'Traces' }).click();

    const traceList = page.getByTestId('trace-list');
    await expect(traceList).toBeVisible({ timeout: 30_000 });

    const traceButton = traceList.getByRole('button').first();
    await expect(traceButton).toBeVisible({ timeout: 30_000 });

    await traceButton.click();

    const spanRow = page.locator('[role="button"]').filter({ hasText: /.+/ });
    await expect(spanRow.first()).toBeVisible({ timeout: 10_000 });
  });
});
