# Harness TUI + CLI Commander Implementation Plan (Draft 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Harness (LoopyAgent) as a first-class resource in the AgentCore CLI with a **file-per-harness**
architecture — each harness has its own directory (`agentcore/harnesses/<name>/`) with `harness.json` config +
`system-prompt.md` + optional `skills/`. `agentcore.json` holds lightweight `{name, path}` pointers for CLI discovery.

**Architecture:** Harness config is split from the project spec. `agentcore.json` gets a `harnesses[]` array of
`{name, path}` refs. Each harness directory contains a `harness.json` (full config), `system-prompt.md` (referenced by
file path in JSON), and optional `skills/*.md`. No app code is scaffolded by default — harness is config-only. Long-term
memory (SEMANTIC + SUMMARIZATION) is enabled by default. Deploy reads `harnesses/*/harness.json`, resolves markdown
references, and calls CreateHarness/UpdateHarness imperatively. A new `HarnessPrimitive` extends `BasePrimitive` for CLI
wiring.

**Tech Stack:** TypeScript, Zod (schema), Ink/React (TUI), Commander.js (CLI)

**Draft 2 key decisions reflected:**

1. File-per-harness, not monolithic schema
2. System prompts and skills as markdown, not JSON
3. No scaffolded application code by default
4. Harness is additive, not a new default
5. Long-term memory enabled by default

---

## File Structure

### New Files

| File                                              | Responsibility                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/schema/schemas/harness.ts`                   | Zod schemas: `HarnessConfigSchema` (per-harness file), `HarnessRefSchema` (project-level pointer), `HarnessToolSchema`, `HarnessNameSchema` |
| `src/cli/primitives/HarnessPrimitive.ts`          | `HarnessPrimitive` extending `BasePrimitive` — add/remove lifecycle, reads/writes harness dirs                                              |
| `src/cli/tui/screens/harness/types.ts`            | `AddHarnessConfig`, `AddHarnessStep`, UI option constants (providers, tools, models)                                                        |
| `src/cli/tui/screens/harness/AddHarnessFlow.tsx`  | Multi-step TUI wizard with breadcrumb progress bar                                                                                          |
| `src/cli/tui/screens/harness/useAddHarness.ts`    | Hook: creates harness dir, writes harness.json + system-prompt.md, updates agentcore.json ref                                               |
| `src/cli/tui/screens/harness/index.ts`            | Barrel export                                                                                                                               |
| `src/cli/operations/deploy/deploy-harness.ts`     | `deployHarness()` — reads harness.json + resolves markdown refs → imperative CreateHarness/UpdateHarness                                    |
| `src/cli/operations/invoke/invoke-harness.ts`     | `invokeHarnessStreaming()` — streaming InvokeHarness with inline function tool support                                                      |
| `src/lib/harness-io.ts`                           | `HarnessIO` — read/write harness.json, resolve system-prompt.md, list harness dirs                                                          |
| `src/assets/harness/harness.json`                 | Template harness.json                                                                                                                       |
| `src/assets/harness/system-prompt.md`             | Template system prompt markdown                                                                                                             |
| `src/assets/harness/invoke-script/main.py`        | Optional invoke script (generated via `--with-invoke-script`)                                                                               |
| `src/assets/harness/invoke-script/pyproject.toml` | Optional pyproject.toml for invoke script                                                                                                   |

### Modified Files

| File                                          | Change                                                                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/schema/schemas/agentcore-project.ts`     | Add `harnesses` array of `HarnessRefSchema` (`{name, path}`) to `AgentCoreProjectSpecSchema`                                |
| `src/schema/schemas/deployed-state.ts`        | Add `harnesses` record to `DeployedResourceStateSchema` with `HarnessDeployedStateSchema`                                   |
| `src/schema/index.ts`                         | Re-export harness types                                                                                                     |
| `src/cli/primitives/registry.ts`              | Register `harnessPrimitive` singleton                                                                                       |
| `src/cli/tui/screens/add/AddScreen.tsx`       | Add "Harness" to `ADD_RESOURCES` list                                                                                       |
| `src/cli/tui/screens/add/AddFlow.tsx`         | Add `harness-wizard` flow state, route to `AddHarnessFlow`                                                                  |
| `src/cli/tui/screens/create/CreateScreen.tsx` | Add template type selection (Agent vs Harness) after name input                                                             |
| `src/cli/commands/create/command.tsx`         | Add `--template harness` flag                                                                                               |
| `src/cli/commands/create/action.ts`           | Add `createHarnessProject()` — scaffolds harness dir, no app/                                                               |
| `src/cli/commands/create/types.ts`            | Add `template` to `CreateOptions`                                                                                           |
| `src/cli/commands/invoke/command.tsx`         | Add `--harness`, `--raw-events`, `--model-id`, `--tools`, `--max-iterations`, `--timeout`, `--max-tokens`, `--skills` flags |
| `src/cli/tui/screens/invoke/InvokeScreen.tsx` | Show harnesses alongside runtimes; inline function tool approve/deny UI                                                     |
| `src/cli/tui/screens/invoke/useInvokeFlow.ts` | Load harness deployed state, call `invokeHarnessStreaming()`                                                                |
| `src/cli/tui/screens/remove/RemoveFlow.tsx`   | Add harness removal flow + delete harness directory (preserve memory)                                                       |
| `src/cli/tui/screens/status/StatusScreen.tsx` | Display harness entries in resource graph                                                                                   |

### Test Files

| File                                                    | What it tests                                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/schema/schemas/__tests__/harness.test.ts`          | Zod schema validation for HarnessConfigSchema, HarnessRefSchema, HarnessToolSchema |
| `src/cli/primitives/__tests__/HarnessPrimitive.test.ts` | add/remove lifecycle, directory creation, duplicate detection                      |
| `src/lib/__tests__/harness-io.test.ts`                  | HarnessIO read/write, markdown resolution                                          |

---

## Task 1: Harness Zod Schemas (Config + Ref + Deployed State)

The key architectural change from Draft 1: **two schemas**. `HarnessRefSchema` is the lightweight pointer stored in
`agentcore.json`. `HarnessConfigSchema` is the full config stored in each `harness.json` file.

**Files:**

- Create: `src/schema/schemas/harness.ts`
- Modify: `src/schema/schemas/agentcore-project.ts`
- Modify: `src/schema/schemas/deployed-state.ts`
- Modify: `src/schema/index.ts`
- Test: `src/schema/schemas/__tests__/harness.test.ts`

- [ ] **Step 1: Write failing test for harness schemas**

Create `src/schema/schemas/__tests__/harness.test.ts`:

```typescript
import { HarnessConfigSchema, HarnessNameSchema, HarnessRefSchema, HarnessToolSchema } from '../harness';
import { describe, expect, it } from 'vitest';

describe('HarnessNameSchema', () => {
  it('accepts valid harness name', () => {
    expect(HarnessNameSchema.safeParse('my_loopy_agent').success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(HarnessNameSchema.safeParse('').success).toBe(false);
  });

  it('rejects name starting with number', () => {
    expect(HarnessNameSchema.safeParse('1agent').success).toBe(false);
  });

  it('rejects name exceeding 48 chars', () => {
    expect(HarnessNameSchema.safeParse('a'.repeat(49)).success).toBe(false);
  });
});

describe('HarnessRefSchema', () => {
  it('accepts valid harness ref', () => {
    const result = HarnessRefSchema.safeParse({
      name: 'my_agent',
      path: './harnesses/my_agent',
    });
    expect(result.success).toBe(true);
  });

  it('rejects ref without path', () => {
    const result = HarnessRefSchema.safeParse({ name: 'my_agent' });
    expect(result.success).toBe(false);
  });
});

describe('HarnessToolSchema', () => {
  it('accepts agentcore_browser tool', () => {
    const result = HarnessToolSchema.safeParse({
      type: 'agentcore_browser',
      name: 'browser',
    });
    expect(result.success).toBe(true);
  });

  it('accepts agentcore_code_interpreter tool', () => {
    const result = HarnessToolSchema.safeParse({
      type: 'agentcore_code_interpreter',
      name: 'code_interpreter',
    });
    expect(result.success).toBe(true);
  });

  it('accepts remote_mcp tool with url', () => {
    const result = HarnessToolSchema.safeParse({
      type: 'remote_mcp',
      name: 'exa',
      config: { remoteMcp: { url: 'https://mcp.exa.ai/mcp' } },
    });
    expect(result.success).toBe(true);
  });

  it('accepts agentcore_gateway tool with arn', () => {
    const result = HarnessToolSchema.safeParse({
      type: 'agentcore_gateway',
      name: 'my_gateway',
      config: { agentCoreGateway: { gatewayArn: 'arn:aws:bedrock-agentcore:us-west-2:123:gateway/gw-123' } },
    });
    expect(result.success).toBe(true);
  });

  it('accepts inline_function tool', () => {
    const result = HarnessToolSchema.safeParse({
      type: 'inline_function',
      name: 'approve_purchase',
      config: {
        inlineFunction: {
          description: 'Request human approval',
          inputSchema: {
            type: 'object',
            properties: { item: { type: 'string' } },
            required: ['item'],
          },
        },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('HarnessConfigSchema', () => {
  it('accepts minimal harness config', () => {
    const result = HarnessConfigSchema.safeParse({
      name: 'my_agent',
      model: {
        bedrockModelConfig: { modelId: 'us.anthropic.claude-sonnet-4-5-20250514-v1:0' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts systemPrompt as file path string', () => {
    const result = HarnessConfigSchema.safeParse({
      name: 'my_agent',
      model: { bedrockModelConfig: { modelId: 'us.anthropic.claude-sonnet-4-5-20250514-v1:0' } },
      systemPrompt: './system-prompt.md',
    });
    expect(result.success).toBe(true);
  });

  it('accepts skills array with paths', () => {
    const result = HarnessConfigSchema.safeParse({
      name: 'my_agent',
      model: { bedrockModelConfig: { modelId: 'us.anthropic.claude-sonnet-4-5-20250514-v1:0' } },
      skills: [{ path: './skills/research' }, { path: '.agents/skills/xlsx' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts fully specified harness config', () => {
    const result = HarnessConfigSchema.safeParse({
      name: 'research_agent',
      model: { bedrockModelConfig: { modelId: 'us.anthropic.claude-sonnet-4-5-20250514-v1:0' } },
      systemPrompt: './system-prompt.md',
      tools: [
        { type: 'agentcore_browser', name: 'browser' },
        { type: 'remote_mcp', name: 'exa', config: { remoteMcp: { url: 'https://mcp.exa.ai/mcp' } } },
      ],
      skills: [{ path: './skills/research' }],
      memory: { name: 'research_memory' },
      maxIterations: 75,
      timeoutSeconds: 3600,
      maxTokens: 16384,
      allowedTools: ['*'],
      truncation: {
        strategy: 'sliding_window',
        config: { slidingWindow: { messagesCount: 150 } },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects harness without model', () => {
    const result = HarnessConfigSchema.safeParse({ name: 'my_agent' });
    expect(result.success).toBe(false);
  });

  it('defaults tools to empty array', () => {
    const result = HarnessConfigSchema.parse({
      name: 'my_agent',
      model: { bedrockModelConfig: { modelId: 'us.anthropic.claude-sonnet-4-5-20250514-v1:0' } },
    });
    expect(result.tools).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
`cd /Volumes/workplace/agentcore/agentcore-gh/private/private-agentcore-cli-staging && npx vitest run src/schema/schemas/__tests__/harness.test.ts`

Expected: FAIL — module `../harness` does not exist.

- [ ] **Step 3: Create harness schema file**

Create `src/schema/schemas/harness.ts`:

```typescript
import { TagsSchema } from './primitives/tags';
import { z } from 'zod';

// ============================================================================
// Name Schema (shared by ref and config)
// ============================================================================

export const HarnessNameSchema = z
  .string()
  .min(1, 'Harness name is required')
  .max(48)
  .regex(
    /^[a-zA-Z][a-zA-Z0-9_-]{0,47}$/,
    'Must begin with a letter and contain only alphanumeric characters, underscores, and hyphens (max 48 chars)'
  );

// ============================================================================
// Ref Schema — lightweight pointer stored in agentcore.json
// ============================================================================

export const HarnessRefSchema = z.object({
  name: HarnessNameSchema,
  path: z.string().min(1, 'Path to harness directory is required'),
});

export type HarnessRef = z.infer<typeof HarnessRefSchema>;

// ============================================================================
// Tool Schema — used inside harness.json
// ============================================================================

const RemoteMcpConfigSchema = z.object({
  remoteMcp: z.object({
    url: z.string().url(),
  }),
});

const AgentCoreGatewayConfigSchema = z.object({
  agentCoreGateway: z.object({
    gatewayArn: z.string().min(1),
  }),
});

const InlineFunctionConfigSchema = z.object({
  inlineFunction: z.object({
    description: z.string().optional(),
    inputSchema: z.record(z.unknown()).optional(),
  }),
});

export const HarnessToolSchema = z.object({
  type: z.enum([
    'agentcore_browser',
    'agentcore_code_interpreter',
    'remote_mcp',
    'agentcore_gateway',
    'inline_function',
  ]),
  name: z.string().min(1),
  browserArn: z.string().optional(),
  codeInterpreterArn: z.string().optional(),
  config: z.union([RemoteMcpConfigSchema, AgentCoreGatewayConfigSchema, InlineFunctionConfigSchema]).optional(),
});

export type HarnessTool = z.infer<typeof HarnessToolSchema>;

// ============================================================================
// Model Config Schema
// ============================================================================

const HarnessModelConfigSchema = z.object({
  bedrockModelConfig: z.object({ modelId: z.string().min(1) }).optional(),
  anthropicModelConfig: z
    .object({ modelId: z.string().min(1), apiKeyCredentialProviderArn: z.string().optional() })
    .optional(),
  openAIModelConfig: z
    .object({ modelId: z.string().min(1), apiKeyCredentialProviderArn: z.string().optional() })
    .optional(),
  geminiModelConfig: z
    .object({ modelId: z.string().min(1), apiKeyCredentialProviderArn: z.string().optional() })
    .optional(),
});

// ============================================================================
// Skill Schema
// ============================================================================

export const HarnessSkillSchema = z.object({
  path: z.string().min(1),
});

export type HarnessSkill = z.infer<typeof HarnessSkillSchema>;

// ============================================================================
// Truncation Schema
// ============================================================================

const TruncationConfigSchema = z.object({
  strategy: z.enum(['sliding_window']),
  config: z.object({
    slidingWindow: z.object({
      messagesCount: z.number().int().min(1),
    }),
  }),
});

// ============================================================================
// Environment Schema
// ============================================================================

const HarnessEnvironmentArtifactSchema = z.object({
  containerConfiguration: z.object({ containerUri: z.string().min(1) }).optional(),
});

const HarnessEnvironmentSchema = z.object({
  agentCoreRuntimeEnvironment: z
    .object({
      executionRoleArn: z.string().optional(),
      networkConfiguration: z.record(z.unknown()).optional(),
      filesystemConfigurations: z.array(z.record(z.unknown())).optional(),
    })
    .optional(),
});

// ============================================================================
// Config Schema — full config stored in harness.json
// ============================================================================

export const HarnessConfigSchema = z.object({
  name: HarnessNameSchema,
  model: HarnessModelConfigSchema,
  systemPrompt: z.string().optional(),
  tools: z.array(HarnessToolSchema).default([]),
  skills: z.array(HarnessSkillSchema).optional(),
  memory: z.object({ name: z.string().min(1) }).optional(),
  maxIterations: z.number().int().min(1).optional(),
  timeoutSeconds: z.number().int().min(1).optional(),
  maxTokens: z.number().int().min(1).optional(),
  allowedTools: z.array(z.string()).optional(),
  truncation: TruncationConfigSchema.optional(),
  environmentArtifact: HarnessEnvironmentArtifactSchema.optional(),
  dockerfile: z.string().optional(),
  environment: HarnessEnvironmentSchema.optional(),
  tags: TagsSchema.optional(),
});

export type HarnessConfig = z.infer<typeof HarnessConfigSchema>;

// ============================================================================
// Deployed State Schema
// ============================================================================

export const HarnessDeployedStateSchema = z.object({
  harnessId: z.string().min(1),
  harnessArn: z.string().min(1),
  roleArn: z.string().min(1),
  agentRuntimeArn: z.string().optional(),
});

export type HarnessDeployedState = z.infer<typeof HarnessDeployedStateSchema>;

// ============================================================================
// Constants
// ============================================================================

export const HARNESS_TOOL_TYPES = [
  'agentcore_browser',
  'agentcore_code_interpreter',
  'remote_mcp',
  'agentcore_gateway',
  'inline_function',
] as const;

export type HarnessToolType = (typeof HARNESS_TOOL_TYPES)[number];

export const DEFAULT_HARNESS_MODEL_IDS: Record<string, string> = {
  bedrock: 'us.anthropic.claude-sonnet-4-6-20250514-v1:0',
  anthropic: 'claude-sonnet-4-6-20250514',
  openai: 'gpt-4.1',
  gemini: 'gemini-2.5-flash',
};

export const HARNESS_CONFIG_FILENAME = 'harness.json';
export const HARNESS_SYSTEM_PROMPT_FILENAME = 'system-prompt.md';
export const HARNESS_SKILLS_DIR = 'skills';
export const HARNESSES_DIR = 'harnesses';
```

- [ ] **Step 4: Run test to verify it passes**

Run:
`cd /Volumes/workplace/agentcore/agentcore-gh/private/private-agentcore-cli-staging && npx vitest run src/schema/schemas/__tests__/harness.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Add `harnesses` ref array to AgentCoreProjectSpecSchema**

Modify `src/schema/schemas/agentcore-project.ts`:

Add import at top:

```typescript
import { HarnessRefSchema } from './harness';
```

Add re-exports:

```typescript
export {
  HarnessConfigSchema,
  HarnessRefSchema,
  HarnessNameSchema,
  HarnessToolSchema,
  HarnessSkillSchema,
} from './harness';
export type {
  HarnessConfig,
  HarnessRef,
  HarnessTool,
  HarnessSkill,
  HarnessToolType,
  HarnessDeployedState,
} from './harness';
export {
  HarnessDeployedStateSchema,
  DEFAULT_HARNESS_MODEL_IDS,
  HARNESS_CONFIG_FILENAME,
  HARNESS_SYSTEM_PROMPT_FILENAME,
  HARNESSES_DIR,
} from './harness';
```

Add `harnesses` array to the `AgentCoreProjectSpecSchema` `.object({...})`, after `runtimes`:

```typescript
    harnesses: z
      .array(HarnessRefSchema)
      .default([])
      .superRefine(
        uniqueBy(
          harness => harness.name,
          name => `Duplicate harness name: ${name}`
        )
      ),
```

Note: This is an array of `HarnessRefSchema` (name + path), NOT the full config. The full config lives in `harness.json`
files.

- [ ] **Step 6: Add HarnessDeployedState to deployed-state.ts**

Modify `src/schema/schemas/deployed-state.ts`:

Add import at top:

```typescript
import { HarnessDeployedStateSchema } from './harness';
```

Re-export:

```typescript
export { HarnessDeployedStateSchema } from './harness';
export type { HarnessDeployedState } from './harness';
```

Add `harnesses` to `DeployedResourceStateSchema` object:

```typescript
  harnesses: z.record(z.string(), HarnessDeployedStateSchema).optional(),
```

- [ ] **Step 7: Update schema barrel export**

Modify `src/schema/index.ts` — add all harness re-exports. Check what's already re-exported from `agentcore-project.ts`
and add any missing ones:

```typescript
export {
  HarnessConfigSchema,
  HarnessRefSchema,
  HarnessNameSchema,
  HarnessToolSchema,
  HarnessSkillSchema,
  HarnessDeployedStateSchema,
  DEFAULT_HARNESS_MODEL_IDS,
  HARNESS_CONFIG_FILENAME,
  HARNESS_SYSTEM_PROMPT_FILENAME,
  HARNESSES_DIR,
  HARNESS_TOOL_TYPES,
} from './schemas/harness';
export type {
  HarnessConfig,
  HarnessRef,
  HarnessTool,
  HarnessSkill,
  HarnessToolType,
  HarnessDeployedState,
} from './schemas/harness';
```

- [ ] **Step 8: Run full schema tests + typecheck**

Run:
`cd /Volumes/workplace/agentcore/agentcore-gh/private/private-agentcore-cli-staging && npx vitest run src/schema/ && npm run typecheck`

Expected: All pass.

- [ ] **Step 9: Commit**

```bash
git add src/schema/schemas/harness.ts src/schema/schemas/__tests__/harness.test.ts src/schema/schemas/agentcore-project.ts src/schema/schemas/deployed-state.ts src/schema/index.ts
git commit -m "$(cat <<'EOF'
feat: add Harness schemas with file-per-harness architecture

HarnessRefSchema ({name, path}) for agentcore.json discovery.
HarnessConfigSchema (full config) for per-harness harness.json files.
System prompt is a file path string (./system-prompt.md), not inline JSON.
Skills are path references. HarnessDeployedState for deployed-state.json.
EOF
)"
```

---

## Task 2: HarnessIO — Read/Write Harness Directories

This is a new module that handles the file-per-harness I/O: creating harness directories, reading/writing
`harness.json`, resolving `system-prompt.md` content, listing harness dirs.

**Files:**

- Create: `src/lib/harness-io.ts`
- Test: `src/lib/__tests__/harness-io.test.ts`

- [ ] **Step 1: Write failing test for HarnessIO**

Create `src/lib/__tests__/harness-io.test.ts`:

```typescript
import { HarnessIO } from '../harness-io';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('HarnessIO', () => {
  let tmpDir: string;
  let agentcoreDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-io-test-'));
    agentcoreDir = path.join(tmpDir, 'agentcore');
    await fs.mkdir(agentcoreDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('scaffolds a harness directory with harness.json and system-prompt.md', async () => {
    const io = new HarnessIO(agentcoreDir);
    await io.scaffoldHarness(
      'my-agent',
      {
        name: 'my-agent',
        model: { bedrockModelConfig: { modelId: 'us.anthropic.claude-sonnet-4-6-20250514-v1:0' } },
        tools: [],
      },
      'You are a helpful assistant.'
    );

    const harnessDir = path.join(agentcoreDir, 'harnesses', 'my-agent');
    const configRaw = await fs.readFile(path.join(harnessDir, 'harness.json'), 'utf-8');
    const config = JSON.parse(configRaw);
    expect(config.name).toBe('my-agent');
    expect(config.systemPrompt).toBe('./system-prompt.md');

    const prompt = await fs.readFile(path.join(harnessDir, 'system-prompt.md'), 'utf-8');
    expect(prompt).toBe('You are a helpful assistant.');
  });

  it('reads a harness config from disk', async () => {
    const io = new HarnessIO(agentcoreDir);
    await io.scaffoldHarness(
      'test-agent',
      {
        name: 'test-agent',
        model: { bedrockModelConfig: { modelId: 'test-model' } },
        tools: [],
      },
      'Test prompt'
    );

    const config = await io.readHarnessConfig('test-agent');
    expect(config.name).toBe('test-agent');
  });

  it('resolves system prompt markdown to text', async () => {
    const io = new HarnessIO(agentcoreDir);
    await io.scaffoldHarness(
      'test-agent',
      {
        name: 'test-agent',
        model: { bedrockModelConfig: { modelId: 'test-model' } },
        tools: [],
      },
      'My system prompt content'
    );

    const text = await io.resolveSystemPrompt('test-agent');
    expect(text).toBe('My system prompt content');
  });

  it('lists harness directories', async () => {
    const io = new HarnessIO(agentcoreDir);
    await io.scaffoldHarness(
      'agent-a',
      {
        name: 'agent-a',
        model: { bedrockModelConfig: { modelId: 'm' } },
        tools: [],
      },
      'prompt a'
    );
    await io.scaffoldHarness(
      'agent-b',
      {
        name: 'agent-b',
        model: { bedrockModelConfig: { modelId: 'm' } },
        tools: [],
      },
      'prompt b'
    );

    const names = await io.listHarnesses();
    expect(names.sort()).toEqual(['agent-a', 'agent-b']);
  });

  it('removes a harness directory', async () => {
    const io = new HarnessIO(agentcoreDir);
    await io.scaffoldHarness(
      'to-remove',
      {
        name: 'to-remove',
        model: { bedrockModelConfig: { modelId: 'm' } },
        tools: [],
      },
      'prompt'
    );

    await io.removeHarness('to-remove');
    const names = await io.listHarnesses();
    expect(names).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
`cd /Volumes/workplace/agentcore/agentcore-gh/private/private-agentcore-cli-staging && npx vitest run src/lib/__tests__/harness-io.test.ts`

Expected: FAIL — module `../harness-io` does not exist.

- [ ] **Step 3: Implement HarnessIO**

Create `src/lib/harness-io.ts`:

```typescript
import type { HarnessConfig } from '../schema';
import {
  HARNESSES_DIR,
  HARNESS_CONFIG_FILENAME,
  HARNESS_SKILLS_DIR,
  HARNESS_SYSTEM_PROMPT_FILENAME,
  HarnessConfigSchema,
} from '../schema';
import fs from 'node:fs/promises';
import path from 'node:path';

export class HarnessIO {
  private readonly harnessesDir: string;

  constructor(private readonly agentcoreDir: string) {
    this.harnessesDir = path.join(agentcoreDir, HARNESSES_DIR);
  }

  async scaffoldHarness(name: string, config: HarnessConfig, systemPromptText: string): Promise<string> {
    const harnessDir = path.join(this.harnessesDir, name);
    await fs.mkdir(harnessDir, { recursive: true });
    await fs.mkdir(path.join(harnessDir, HARNESS_SKILLS_DIR), { recursive: true });

    const configWithPromptRef: HarnessConfig = {
      ...config,
      systemPrompt: `./${HARNESS_SYSTEM_PROMPT_FILENAME}`,
    };

    await fs.writeFile(
      path.join(harnessDir, HARNESS_CONFIG_FILENAME),
      JSON.stringify(configWithPromptRef, null, 2) + '\n'
    );

    await fs.writeFile(path.join(harnessDir, HARNESS_SYSTEM_PROMPT_FILENAME), systemPromptText);

    return harnessDir;
  }

  async readHarnessConfig(name: string): Promise<HarnessConfig> {
    const configPath = path.join(this.harnessesDir, name, HARNESS_CONFIG_FILENAME);
    const raw = await fs.readFile(configPath, 'utf-8');
    return HarnessConfigSchema.parse(JSON.parse(raw));
  }

  async writeHarnessConfig(name: string, config: HarnessConfig): Promise<void> {
    const configPath = path.join(this.harnessesDir, name, HARNESS_CONFIG_FILENAME);
    await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  }

  async resolveSystemPrompt(name: string): Promise<string | undefined> {
    const config = await this.readHarnessConfig(name);
    if (!config.systemPrompt) return undefined;

    const harnessDir = path.join(this.harnessesDir, name);
    const promptPath = path.resolve(harnessDir, config.systemPrompt);
    try {
      return await fs.readFile(promptPath, 'utf-8');
    } catch {
      return undefined;
    }
  }

  async listHarnesses(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.harnessesDir, { withFileTypes: true });
      const names: string[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const configPath = path.join(this.harnessesDir, entry.name, HARNESS_CONFIG_FILENAME);
        try {
          await fs.access(configPath);
          names.push(entry.name);
        } catch {
          // Not a valid harness directory
        }
      }
      return names;
    } catch {
      return [];
    }
  }

  async removeHarness(name: string): Promise<void> {
    const harnessDir = path.join(this.harnessesDir, name);
    await fs.rm(harnessDir, { recursive: true, force: true });
  }

  getHarnessDir(name: string): string {
    return path.join(this.harnessesDir, name);
  }

  getRelativeHarnessPath(name: string): string {
    return `./${HARNESSES_DIR}/${name}`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
`cd /Volumes/workplace/agentcore/agentcore-gh/private/private-agentcore-cli-staging && npx vitest run src/lib/__tests__/harness-io.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Export from lib barrel**

Add to `src/lib/index.ts`:

```typescript
export { HarnessIO } from './harness-io';
```

- [ ] **Step 6: Run typecheck**

Run: `cd /Volumes/workplace/agentcore/agentcore-gh/private/private-agentcore-cli-staging && npm run typecheck`

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/harness-io.ts src/lib/__tests__/harness-io.test.ts src/lib/index.ts
git commit -m "$(cat <<'EOF'
feat: add HarnessIO for file-per-harness directory management

Scaffolds agentcore/harnesses/<name>/ with harness.json, system-prompt.md,
and skills/ dir. Reads/writes config, resolves markdown system prompts,
lists/removes harness directories.
EOF
)"
```

---

## Task 3: HarnessPrimitive — Add/Remove Lifecycle

Now uses `HarnessIO` to create harness directories and writes `HarnessRef` pointers to `agentcore.json`. Remove deletes
the harness directory but preserves memory resources.

**Files:**

- Create: `src/cli/primitives/HarnessPrimitive.ts`
- Modify: `src/cli/primitives/registry.ts`
- Test: `src/cli/primitives/__tests__/HarnessPrimitive.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/cli/primitives/__tests__/HarnessPrimitive.test.ts`:

```typescript
import { HarnessPrimitive } from '../HarnessPrimitive';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib', async importOriginal => {
  const original = await importOriginal<typeof import('../../../lib')>();
  return {
    ...original,
    ConfigIO: vi.fn().mockImplementation(() => ({
      readProjectSpec: vi.fn().mockResolvedValue({
        name: 'test',
        version: 1,
        harnesses: [],
        runtimes: [],
        memories: [],
        credentials: [],
        evaluators: [],
        onlineEvalConfigs: [],
        agentCoreGateways: [],
        policyEngines: [],
      }),
      writeProjectSpec: vi.fn(),
    })),
    findConfigRoot: vi.fn().mockReturnValue('/mock/agentcore'),
    getWorkingDirectory: vi.fn().mockReturnValue('/mock'),
    HarnessIO: vi.fn().mockImplementation(() => ({
      scaffoldHarness: vi.fn().mockResolvedValue('/mock/agentcore/harnesses/test'),
      removeHarness: vi.fn(),
      listHarnesses: vi.fn().mockResolvedValue([]),
      getRelativeHarnessPath: vi.fn().mockReturnValue('./harnesses/test'),
    })),
  };
});

describe('HarnessPrimitive', () => {
  let primitive: HarnessPrimitive;

  beforeEach(() => {
    primitive = new HarnessPrimitive();
  });

  it('has kind "harness"', () => {
    expect(primitive.kind).toBe('harness');
  });

  it('has label "Harness"', () => {
    expect(primitive.label).toBe('Harness');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
`cd /Volumes/workplace/agentcore/agentcore-gh/private/private-agentcore-cli-staging && npx vitest run src/cli/primitives/__tests__/HarnessPrimitive.test.ts`

Expected: FAIL — `HarnessPrimitive` not found.

- [ ] **Step 3: Create HarnessPrimitive**

Create `src/cli/primitives/HarnessPrimitive.ts`. Key differences from Draft 1:

- `add()` creates harness directory via `HarnessIO.scaffoldHarness()`, then adds `HarnessRef` to `agentcore.json`
- `remove()` removes `HarnessRef` from `agentcore.json` AND deletes `agentcore/harnesses/<name>/` directory
- Memory resources are preserved on remove
- Default memory is long-term (SEMANTIC + SUMMARIZATION) — when adding a harness with memory enabled, also add a memory
  resource to `agentcore.json` if not already present
- `systemPrompt` is written to `system-prompt.md`, referenced by path in `harness.json`
- `registerCommands()` adds `--skills` flag

The implementation follows `AgentPrimitive` patterns exactly. The `add()` method:

1. Reads project spec
2. Checks for duplicate harness name
3. Builds `HarnessConfig` from options
4. Calls `harnessIO.scaffoldHarness(name, config, systemPromptText)` to create the directory
5. Adds `{name, path: harnessIO.getRelativeHarnessPath(name)}` to `spec.harnesses`
6. If memory enabled (default), adds a memory resource to `spec.memories` if not present
7. Writes updated project spec

- [ ] **Step 4: Run test to verify it passes**

Run:
`cd /Volumes/workplace/agentcore/agentcore-gh/private/private-agentcore-cli-staging && npx vitest run src/cli/primitives/__tests__/HarnessPrimitive.test.ts`

Expected: PASS.

- [ ] **Step 5: Register in registry.ts**

Modify `src/cli/primitives/registry.ts`:

```typescript
import { HarnessPrimitive } from './HarnessPrimitive';

export const harnessPrimitive = new HarnessPrimitive();
```

Add `harnessPrimitive` to `ALL_PRIMITIVES` after `agentPrimitive`.

- [ ] **Step 6: Run typecheck**

Run: `cd /Volumes/workplace/agentcore/agentcore-gh/private/private-agentcore-cli-staging && npm run typecheck`

- [ ] **Step 7: Commit**

```bash
git add src/cli/primitives/HarnessPrimitive.ts src/cli/primitives/__tests__/HarnessPrimitive.test.ts src/cli/primitives/registry.ts
git commit -m "$(cat <<'EOF'
feat: add HarnessPrimitive with file-per-harness lifecycle

Creates agentcore/harnesses/<name>/ directory with harness.json +
system-prompt.md. Adds HarnessRef pointer to agentcore.json. Remove
deletes the harness directory but preserves memory resources. Default
memory is long-term (SEMANTIC + SUMMARIZATION).
EOF
)"
```

---

## Task 4: Add "Harness" to AddScreen + AddFlow + AddHarnessFlow TUI Wizard

The TUI wizard follows the Draft 2 visual spec with breadcrumb progress (● Name → ○ Model → ...), system prompt step,
tools multi-select with shell/file_operations defaults, MCP sub-flow, advanced config group.

**Files:**

- Modify: `src/cli/tui/screens/add/AddScreen.tsx`
- Modify: `src/cli/tui/screens/add/AddFlow.tsx`
- Create: `src/cli/tui/screens/harness/types.ts`
- Create: `src/cli/tui/screens/harness/AddHarnessFlow.tsx`
- Create: `src/cli/tui/screens/harness/useAddHarness.ts`
- Create: `src/cli/tui/screens/harness/index.ts`

- [ ] **Step 1: Create harness TUI types**

Create `src/cli/tui/screens/harness/types.ts`. Key differences from Draft 1:

- `AddHarnessStep` includes `'systemPrompt'`, `'modelId'`, `'mcpConfig'`, `'gatewayConfig'`, `'advanced'`
- `AddHarnessConfig` has `systemPrompt: string` (the text, not file path — hook writes it to `.md`)
- `HARNESS_MODEL_PROVIDER_OPTIONS` includes Gemini (4 providers)
- `HARNESS_MODEL_OPTIONS` per-provider (e.g., Bedrock: Sonnet 4.6, Sonnet 4.5, Haiku 4.5, Opus 4.5)
- `HARNESS_TOOL_OPTIONS` includes shell + file_operations as defaults, plus Browser, Code Interpreter, Remote MCP,
  Gateway
- `HARNESS_MEMORY_OPTIONS` defaults to long-term (longTerm is first/pre-selected)
- `HARNESS_ADVANCED_OPTIONS`: container, VPC, execution limits, memory override, truncation, skills

```typescript
import type { HarnessToolType } from '../../../../schema';

export type AddHarnessStep =
  | 'name'
  | 'modelProvider'
  | 'modelId'
  | 'apiKey'
  | 'systemPrompt'
  | 'tools'
  | 'mcpConfig'
  | 'gatewayConfig'
  | 'memory'
  | 'advanced'
  | 'confirm';

export interface AddHarnessConfig {
  name: string;
  modelProvider: 'bedrock' | 'anthropic' | 'openai' | 'gemini';
  modelId: string;
  apiKey?: string;
  systemPrompt: string;
  tools: HarnessToolType[];
  mcpServers: Array<{ name: string; url: string }>;
  gatewayName?: string;
  gatewayArn?: string;
  memory: 'none' | 'longTerm';
  containerMode: 'none' | 'dockerfile' | 'uri';
  dockerfile?: string;
  containerUri?: string;
}

export const HARNESS_MODEL_PROVIDER_OPTIONS = [
  { id: 'bedrock', title: 'Bedrock', description: 'AWS-managed models (default)' },
  { id: 'anthropic', title: 'Anthropic', description: 'Direct API' },
  { id: 'openai', title: 'OpenAI', description: 'OpenAI API' },
  { id: 'gemini', title: 'Gemini', description: 'Google Gemini API' },
] as const;

export const HARNESS_BEDROCK_MODEL_OPTIONS = [
  { id: 'us.anthropic.claude-sonnet-4-6-20250514-v1:0', title: 'Claude Sonnet 4.6 (recommended)' },
  { id: 'us.anthropic.claude-sonnet-4-5-20250514-v1:0', title: 'Claude Sonnet 4.5' },
  { id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', title: 'Claude Haiku 4.5' },
  { id: 'us.anthropic.claude-opus-4-5-20250514-v1:0', title: 'Claude Opus 4.5' },
] as const;

export const HARNESS_TOOL_OPTIONS = [
  { id: 'shell', title: 'Shell', description: 'Execute shell commands (default)', defaultEnabled: true },
  { id: 'file_operations', title: 'File operations', description: 'Read/write files (default)', defaultEnabled: true },
  { id: 'agentcore_browser', title: 'AgentCore Browser', description: 'Web browsing & automation' },
  { id: 'agentcore_code_interpreter', title: 'Code Interpreter', description: 'Sandboxed code execution' },
  { id: 'remote_mcp', title: 'Remote MCP Server', description: 'Connect to an MCP server' },
  { id: 'agentcore_gateway', title: 'AgentCore Gateway', description: 'Connect via gateway' },
] as const;

export const HARNESS_MEMORY_OPTIONS = [
  {
    id: 'longTerm',
    title: 'Long-term memory (default)',
    description: 'SEMANTIC + SUMMARIZATION, persistent across sessions',
  },
  { id: 'none', title: 'No memory', description: 'Stateless conversations' },
] as const;

export const ADD_HARNESS_STEP_LABELS: Record<AddHarnessStep, string> = {
  name: 'Name',
  modelProvider: 'Model',
  modelId: 'Model',
  apiKey: 'API Key',
  systemPrompt: 'Prompt',
  tools: 'Tools',
  mcpConfig: 'Tools',
  gatewayConfig: 'Tools',
  memory: 'Memory',
  advanced: 'Advanced',
  confirm: 'Confirm',
};

export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant.';
```

- [ ] **Step 2: Create useAddHarness hook**

Create `src/cli/tui/screens/harness/useAddHarness.ts`. Key differences from Draft 1:

- Uses `HarnessIO` to scaffold the harness directory (writes `harness.json` + `system-prompt.md`)
- Adds `HarnessRef` (`{name, path}`) to `agentcore.json`, not the full config
- If memory is `'longTerm'`, auto-creates a memory resource (e.g., `"<name>-memory"`) with SEMANTIC + SUMMARIZATION
  strategies in `spec.memories` and sets `memory.name` in `harness.json`

- [ ] **Step 3: Create AddHarnessFlow component**

Create `src/cli/tui/screens/harness/AddHarnessFlow.tsx`. Key differences from Draft 1:

- Breadcrumb progress bar: `● Name → ○ Model → ○ Prompt → ○ Tools → ○ Memory → ○ Advanced → ○ Confirm`
- After model provider selection, shows model ID sub-step (e.g., Bedrock model list)
- API key step appears for non-Bedrock providers
- System prompt step: text input with default "You are a helpful assistant." and hint that `system-prompt.md` will be
  created
- Tools step: multi-select with Space toggle, shell + file_operations pre-checked
- If Remote MCP Server selected: MCP name + URL sub-flow with "Add another?" option
- If Gateway selected: select from project gateways or enter ARN
- Memory defaults to Long-term (pre-selected first item)
- Advanced step: checkboxes for optional config (container, VPC, limits, memory override, truncation)
- Confirm step: review panel showing all selections including system prompt file path

- [ ] **Step 4: Create barrel export**

Create `src/cli/tui/screens/harness/index.ts`:

```typescript
export { AddHarnessFlow } from './AddHarnessFlow';
export { useAddHarness } from './useAddHarness';
export type { AddHarnessConfig, AddHarnessStep } from './types';
```

- [ ] **Step 5: Add "Harness" to AddScreen**

Modify `src/cli/tui/screens/add/AddScreen.tsx` — add after `agent`:

```typescript
  { id: 'harness', title: 'Harness', description: 'Managed agent loop (configure model + tools)' },
```

- [ ] **Step 6: Wire harness-wizard into AddFlow**

Modify `src/cli/tui/screens/add/AddFlow.tsx`:

- Add `harness-wizard` and `harness-success` to `FlowState`
- Route `'harness'` resource type to `harness-wizard`
- Success screen shows created files: `agentcore/harnesses/<name>/harness.json` and `system-prompt.md`

- [ ] **Step 7: Run typecheck + lint**

Run:
`cd /Volumes/workplace/agentcore/agentcore-gh/private/private-agentcore-cli-staging && npm run typecheck && npm run lint`

- [ ] **Step 8: Commit**

```bash
git add src/cli/tui/screens/harness/ src/cli/tui/screens/add/AddScreen.tsx src/cli/tui/screens/add/AddFlow.tsx
git commit -m "$(cat <<'EOF'
feat: add Harness TUI wizard with file-per-harness scaffolding

Breadcrumb progress bar (Name → Model → Prompt → Tools → Memory →
Advanced → Confirm). Creates agentcore/harnesses/<name>/ with
harness.json + system-prompt.md. Long-term memory default. Tools
multi-select with shell + file_operations pre-checked.
EOF
)"
```

---

## Task 5: Create Command — `--template harness`

Config-only project scaffolding. No `app/` directory by default. Optional `--with-invoke-script` flag.

**Files:**

- Modify: `src/cli/commands/create/command.tsx`
- Modify: `src/cli/commands/create/action.ts`
- Modify: `src/cli/commands/create/types.ts`
- Modify: `src/cli/tui/screens/create/CreateScreen.tsx`

- [ ] **Step 1: Add `template` and `withInvokeScript` to CreateOptions**

Modify `src/cli/commands/create/types.ts`:

```typescript
  template?: 'agent' | 'harness';
  withInvokeScript?: boolean;
```

- [ ] **Step 2: Add `--template` and `--with-invoke-script` flags**

Modify `src/cli/commands/create/command.tsx`:

```typescript
    .option('--template <template>', 'Project template: agent (default) or harness [non-interactive]')
    .option('--with-invoke-script', 'Generate a standalone boto3 invoke script (harness only) [non-interactive]')
```

- [ ] **Step 3: Add `createHarnessProject()` to action.ts**

Key behavior:

1. Calls `createProject()` for base scaffolding (agentcore/, cdk/, aws-targets.json)
2. Uses `HarnessIO.scaffoldHarness()` to create `agentcore/harnesses/<name>/` with `harness.json` + `system-prompt.md` +
   `skills/`
3. Adds `HarnessRef` to `agentcore.json`
4. Adds default long-term memory resource to `agentcore.json` (SEMANTIC + SUMMARIZATION)
5. No `app/` directory created
6. If `--with-invoke-script`, copies template `main.py` + `pyproject.toml` to `app/<name>/`

- [ ] **Step 4: Add template selection to CreateScreen TUI**

After name input, show template selection:

```
? What would you like to create?
  > Harness            - Managed agent loop (configure model + tools)
    Agent              - Deploy your own agent code
```

"Agent" proceeds to existing flow. "Harness" embeds `AddHarnessFlow` then calls `createHarnessProject()`.

- [ ] **Step 5: Run typecheck + tests**

Run:
`cd /Volumes/workplace/agentcore/agentcore-gh/private/private-agentcore-cli-staging && npm run typecheck && npx vitest run src/cli/commands/create/`

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/create/ src/cli/tui/screens/create/
git commit -m "$(cat <<'EOF'
feat: add --template harness to create command

Config-only scaffolding: agentcore/harnesses/<name>/ with harness.json
+ system-prompt.md. No app/ directory by default. --with-invoke-script
generates optional boto3 invoke script. Long-term memory auto-created.
EOF
)"
```

---

## Task 6: Invoke Command — Harness Support with Override Flags

**Files:**

- Modify: `src/cli/commands/invoke/command.tsx`
- Create: `src/cli/operations/invoke/invoke-harness.ts`
- Modify: `src/cli/tui/screens/invoke/useInvokeFlow.ts`
- Modify: `src/cli/tui/screens/invoke/InvokeScreen.tsx`

- [ ] **Step 1: Add harness + override flags to invoke command**

Add to `src/cli/commands/invoke/command.tsx`:

```typescript
    .option('--harness <name>', 'Select specific harness [non-interactive]')
    .option('--raw-events', 'Print raw streaming JSON events')
    .option('--model-id <id>', 'Override model for this invocation')
    .option('--tools <tools>', 'Override tools (comma-separated)')
    .option('--max-iterations <n>', 'Override max iterations', parseInt)
    .option('--timeout <seconds>', 'Override timeout', parseInt)
    .option('--max-tokens <n>', 'Override max tokens', parseInt)
    .option('--skills <paths>', 'Skills to use (comma-separated paths)')
```

- [ ] **Step 2: Create invokeHarnessStreaming operation**

Create `src/cli/operations/invoke/invoke-harness.ts`. Must handle:

- Streaming events: `contentBlockDelta` (text), `contentBlockStart` (tool calls), `messageStop`, metadata
- Inline function tools: when `stopReason` is `tool_use` with `inline_function` type, yield a special event so the TUI
  can show approve/deny UI
- Override params passed through to InvokeHarness payload
- Skills passed as array of `{path}` objects

- [ ] **Step 3: Update useInvokeFlow to load harness state**

Add `harnesses[]` to `InvokeConfig`. Load from deployed-state alongside runtimes.

- [ ] **Step 4: Update InvokeScreen**

- Agent selection combines runtimes + harnesses
- When harness selected, uses `invokeHarnessStreaming()`
- Inline function tool calls show approve/deny/custom response panel (per Draft 2 visual spec)
- Token usage and trace link displayed after each response

- [ ] **Step 5: Run typecheck**

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/invoke/ src/cli/tui/screens/invoke/ src/cli/operations/invoke/
git commit -m "$(cat <<'EOF'
feat: add --harness flag to invoke with override support

Invoke harnesses with streaming. Override flags: --model-id, --tools,
--max-iterations, --timeout, --max-tokens, --skills, --raw-events.
TUI shows harnesses in selection and inline function approve/deny UI.
EOF
)"
```

---

## Task 7: Remove Flow — Harness Support (Deletes Directory, Preserves Memory)

**Files:**

- Modify: `src/cli/tui/screens/remove/RemoveFlow.tsx`

- [ ] **Step 1: Add harness removal states**

Add `'harness'` to `initialResourceType`. Add flow states: `select-harness`, `confirm-harness`, `harness-success`.
Handler uses `harnessPrimitive.remove()` which deletes the `agentcore/harnesses/<name>/` directory and removes the ref
from `agentcore.json`. Memory resources are preserved.

- [ ] **Step 2: Run typecheck**

- [ ] **Step 3: Commit**

```bash
git add src/cli/tui/screens/remove/RemoveFlow.tsx
git commit -m "$(cat <<'EOF'
feat: add harness removal to remove flow

Deletes agentcore/harnesses/<name>/ directory and removes ref from
agentcore.json. Memory resources are preserved for reuse.
EOF
)"
```

---

## Task 8: Deploy Harness — Imperative Operation

Deploy reads each `harness.json`, resolves `system-prompt.md` to text, and calls CreateHarness/UpdateHarness.

**Files:**

- Create: `src/cli/operations/deploy/deploy-harness.ts`
- Modify: `src/cli/operations/deploy/index.ts`

- [ ] **Step 1: Create deployHarness operation**

Key behavior:

1. For each harness ref in `agentcore.json`, read `harness.json` via `HarnessIO`
2. Resolve `system-prompt.md` → text, assemble as `[{text: "..."}]` in API payload
3. If `containerUri: "auto"`, Docker build + ECR push first
4. Resolve `memory.name` → deployed memory ARN from `deployed-state.json`
5. Resolve `gateway` project refs → deployed ARNs
6. Call CreateHarness (first deploy) or UpdateHarness (subsequent)
7. Poll GetHarness until READY
8. Store `{harnessId, harnessArn, roleArn, agentRuntimeArn}` in `deployed-state.json`

- [ ] **Step 2: Export from deploy index**

- [ ] **Step 3: Run typecheck**

- [ ] **Step 4: Commit**

```bash
git add src/cli/operations/deploy/deploy-harness.ts src/cli/operations/deploy/index.ts
git commit -m "$(cat <<'EOF'
feat: add imperative deployHarness operation

Reads harness.json + resolves system-prompt.md for API payload.
CreateHarness/UpdateHarness with status polling. Resolves memory
and gateway references from deployed-state.json.
EOF
)"
```

---

## Task 9: Template Assets (harness.json, system-prompt.md, optional invoke script)

**Files:**

- Create: `src/assets/harness/harness.json`
- Create: `src/assets/harness/system-prompt.md`
- Create: `src/assets/harness/invoke-script/main.py`
- Create: `src/assets/harness/invoke-script/pyproject.toml`

- [ ] **Step 1: Create template harness.json**

```json
{
  "name": "{{HARNESS_NAME}}",
  "model": {
    "bedrockModelConfig": {
      "modelId": "us.anthropic.claude-sonnet-4-6-20250514-v1:0"
    }
  },
  "systemPrompt": "./system-prompt.md",
  "tools": []
}
```

- [ ] **Step 2: Create template system-prompt.md**

```markdown
You are a helpful assistant.
```

- [ ] **Step 3: Create optional invoke script (main.py + pyproject.toml)**

These are only generated when `--with-invoke-script` is passed. Follow the template from the proposal's beta guide
section.

- [ ] **Step 4: Update snapshot tests**

Run:
`cd /Volumes/workplace/agentcore/agentcore-gh/private/private-agentcore-cli-staging && npm run test:update-snapshots`

- [ ] **Step 5: Commit**

```bash
git add src/assets/harness/
git commit -m "$(cat <<'EOF'
feat: add harness template assets

Template harness.json, system-prompt.md, and optional invoke script
(main.py + pyproject.toml) for --with-invoke-script flag.
EOF
)"
```

---

## Task 10: Status Screen — Display Harnesses

**Files:**

- Modify: `src/cli/tui/screens/status/StatusScreen.tsx` (and ResourceGraph)

- [ ] **Step 1: Add harnesses to resource graph**

Load harness refs from `agentcore.json`, fetch deployed state, call GetHarness for live status. Display alongside
runtimes in the resource graph.

- [ ] **Step 2: Run typecheck**

- [ ] **Step 3: Commit**

```bash
git add src/cli/tui/screens/status/
git commit -m "$(cat <<'EOF'
feat: display harnesses in status screen resource graph
EOF
)"
```

---

## Task 11: Observability — `--harness` Flag on Traces and Logs

**Files:**

- Modify: `src/cli/commands/traces/command.tsx` (or wherever traces list/get are registered)
- Modify: `src/cli/commands/logs/command.tsx`

- [ ] **Step 1: Add `--harness <name>` flag to traces and logs commands**

The `--harness` flag resolves to the harness's `agentRuntimeArn` from `deployed-state.json` (returned by GetHarness) and
passes it to the existing trace/log fetching logic.

- [ ] **Step 2: Run typecheck**

- [ ] **Step 3: Commit**

```bash
git add src/cli/commands/traces/ src/cli/commands/logs/
git commit -m "$(cat <<'EOF'
feat: add --harness flag to traces and logs commands

Resolves harness name to agentRuntimeArn from deployed-state.json for
trace listing, trace download, and log streaming.
EOF
)"
```

---

## Task 12: Final Integration — Build, Test, Lint

- [ ] **Step 1: Run full build**

Run: `cd /Volumes/workplace/agentcore/agentcore-gh/private/private-agentcore-cli-staging && npm run build`

- [ ] **Step 2: Run full test suite**

Run: `cd /Volumes/workplace/agentcore/agentcore-gh/private/private-agentcore-cli-staging && npm test`

Update snapshots if needed: `npm run test:update-snapshots`

- [ ] **Step 3: Run lint + format check**

Run:
`cd /Volumes/workplace/agentcore/agentcore-gh/private/private-agentcore-cli-staging && npm run lint && npm run format:check`

- [ ] **Step 4: Run typecheck**

Run: `cd /Volumes/workplace/agentcore/agentcore-gh/private/private-agentcore-cli-staging && npm run typecheck`

- [ ] **Step 5: Commit any fixups**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: fix lint, format, and snapshot issues from harness integration
EOF
)"
```
