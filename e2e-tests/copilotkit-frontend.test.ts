import { parseJsonOutput, prereqs, spawnAndCollect } from '../src/test-utils/index.js';
import { runAgentCoreCLI } from './e2e-helper.js';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const canRun = prereqs.npm && prereqs.git && prereqs.uv;

describe.sequential('e2e: CopilotKit frontend scaffolding', () => {
  let testDir: string;

  beforeAll(async () => {
    if (!canRun) return;
    testDir = join(tmpdir(), `agentcore-e2e-cpk-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
  }, 30000);

  afterAll(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
    }
  }, 30000);

  it.skipIf(!canRun)(
    'create with --frontend copilotkit scaffolds frontend directory',
    async () => {
      const name = 'CpkYes';
      const result = await runAgentCoreCLI(
        [
          'create',
          '--name',
          name,
          '--language',
          'Python',
          '--protocol',
          'AGUI',
          '--framework',
          'Strands',
          '--model-provider',
          'Bedrock',
          '--memory',
          'none',
          '--frontend',
          'copilotkit',
          '--skip-git',
          '--skip-install',
          '--skip-python-setup',
          '--json',
        ],
        testDir
      );

      expect(result.exitCode, `Create failed: ${result.stderr}`).toBe(0);
      const json = parseJsonOutput(result.stdout) as { projectPath: string };
      const frontendDir = join(json.projectPath, 'app', name, 'frontend');

      expect(existsSync(frontendDir), 'frontend/ directory should exist').toBe(true);
      expect(existsSync(join(frontendDir, 'package.json'))).toBe(true);
      expect(existsSync(join(frontendDir, 'index.html'))).toBe(true);
      expect(existsSync(join(frontendDir, 'tsconfig.json'))).toBe(true);
      expect(existsSync(join(frontendDir, 'vite.config.ts'))).toBe(true);
      expect(existsSync(join(frontendDir, 'src', 'App.tsx'))).toBe(true);
      expect(existsSync(join(frontendDir, 'src', 'bridge.ts'))).toBe(true);
      expect(existsSync(join(frontendDir, 'src', 'main.tsx'))).toBe(true);
    },
    60000
  );

  it.skipIf(!canRun)(
    'create without --frontend does not scaffold frontend directory',
    async () => {
      const name = 'CpkNo';
      const result = await runAgentCoreCLI(
        [
          'create',
          '--name',
          name,
          '--language',
          'Python',
          '--protocol',
          'AGUI',
          '--framework',
          'Strands',
          '--model-provider',
          'Bedrock',
          '--memory',
          'none',
          '--skip-git',
          '--skip-install',
          '--skip-python-setup',
          '--json',
        ],
        testDir
      );

      expect(result.exitCode, `Create failed: ${result.stderr}`).toBe(0);
      const json = parseJsonOutput(result.stdout) as { projectPath: string };
      const frontendDir = join(json.projectPath, 'app', name, 'frontend');

      expect(existsSync(frontendDir), 'frontend/ directory should NOT exist').toBe(false);
    },
    60000
  );

  it.skipIf(!canRun)(
    'frontend/package.json has correct name substitution',
    async () => {
      const name = 'CpkName';
      const result = await runAgentCoreCLI(
        [
          'create',
          '--name',
          name,
          '--language',
          'Python',
          '--protocol',
          'AGUI',
          '--framework',
          'Strands',
          '--model-provider',
          'Bedrock',
          '--memory',
          'none',
          '--frontend',
          'copilotkit',
          '--skip-git',
          '--skip-install',
          '--skip-python-setup',
          '--json',
        ],
        testDir
      );

      expect(result.exitCode, `Create failed: ${result.stderr}`).toBe(0);
      const json = parseJsonOutput(result.stdout) as { projectPath: string };
      const pkgPath = join(json.projectPath, 'app', name, 'frontend', 'package.json');
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));

      expect(pkg.name).toBe(`${name}-frontend`);
    },
    60000
  );

  it.skipIf(!canRun)(
    'frontend/index.html has correct title substitution',
    async () => {
      const name = 'CpkName';
      const projectPath = join(testDir, name);
      const indexPath = join(projectPath, 'app', name, 'frontend', 'index.html');
      const html = await readFile(indexPath, 'utf-8');

      expect(html).toContain(`<title>${name}</title>`);
    },
    10000
  );

  it.skipIf(!canRun)(
    'npm install succeeds in scaffolded frontend',
    async () => {
      const name = 'CpkName';
      const projectPath = join(testDir, name);
      const frontendDir = join(projectPath, 'app', name, 'frontend');

      const result = await spawnAndCollect('npm', ['install'], frontendDir);
      expect(result.exitCode, `npm install failed: ${result.stderr}`).toBe(0);
    },
    120000
  );
});
