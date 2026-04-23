import { expect, test } from '../fixtures';

test.describe('Chat invocation', () => {
  test('send a message and receive a response', async ({ page }) => {
    await page.goto('/');

    const chatInput = page.getByTestId('chat-input');
    await expect(chatInput).toBeEnabled({ timeout: 60_000 });

    await chatInput.fill('What is 2 plus 2? Reply with just the number.');
    await page.getByRole('button', { name: 'Send message' }).click();

    const messageList = page.getByTestId('message-list');
    await expect(messageList).toBeVisible();

    await expect(messageList.getByTestId('chat-message-0')).toBeVisible({ timeout: 10_000 });

    const assistantMessage = messageList.getByTestId('chat-message-1');
    await expect(assistantMessage).toBeVisible({ timeout: 60_000 });
    await expect(assistantMessage).not.toBeEmpty();
  });
});
