import { ENV_FILE } from './constants';
import { test as base } from '@playwright/test';
import { readFileSync } from 'node:fs';

interface BrowserTestEnv {
  projectPath: string;
  port: number;
  projectName: string;
}

function readTestEnv(): BrowserTestEnv {
  const raw = readFileSync(ENV_FILE, 'utf-8');
  const parsed: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^(\w+)=(.+)$/);
    if (match) parsed[match[1]!] = match[2]!;
  }
  return {
    projectPath: parsed.PROJECT_PATH!,
    port: Number(parsed.PORT),
    projectName: parsed.PROJECT_NAME!,
  };
}

export const test = base.extend<{ testEnv: BrowserTestEnv }>({
  testEnv: async ({}, use) => {
    await use(readTestEnv());
  },
});

export { expect } from '@playwright/test';
