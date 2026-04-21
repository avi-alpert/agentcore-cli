# Harness API Client Design Spec

## Goal

Add a shared SigV4 HTTP client (`AgentCoreApiClient`) that eliminates the duplicated `signedRequest()` pattern across
the evo codebase, then build typed Harness control plane CRUD + data plane invoke streaming on top of it.

## Motivation

The `feat/evo-implementation` branch has four files (`agentcore-config-bundles.ts`, `agentcore-ab-tests.ts`,
`agentcore-http-gateways.ts`, `agentcore-recommendation.ts`) each containing a near-identical `signedRequest()` function
with SigV4 signing, endpoint resolution, and error handling. The Harness API needs the same pattern. Rather than copy it
a fifth time, we extract the shared logic into a reusable client.

## Scope

**In scope:**

- Shared `AgentCoreApiClient` class (SigV4 signing, endpoint resolution, error handling, streaming support)
- `AgentCoreApiError` structured error class
- Harness control plane operations: `createHarness`, `getHarness`, `updateHarness`, `deleteHarness`, `listHarnesses`
- Harness data plane invoke with streaming event parsing
- Typed interfaces for all request/response shapes (derived from the Smithy service model)
- Unit tests for the client and harness operations
- Generic `pollUntilTerminal()` utility

**Out of scope:**

- Refactoring existing evo code to use the shared client (future PR)
- TUI screens, schema changes, deploy wiring, primitives (separate plan)
- SDK migration (when `@aws-sdk/client-bedrock-agentcore-control` adds Harness commands)

## Architecture

### Layer 1: Shared API Client

**File:** `src/cli/aws/api-client.ts`

A class that owns SigV4-signed HTTP requests against AgentCore endpoints. Both control plane and data plane requests use
the same signing logic — only the endpoint hostname differs.

```
AgentCoreApiClient
  ├── constructor({ region, plane })
  ├── request({ method, path, body?, query? }) → Promise<unknown>
  ├── requestRaw({ method, path, body?, query?, headers? }) → Promise<Response>
  └── (private) sign(httpRequest) → signed headers
```

**Constructor:**

```typescript
interface ApiClientOptions {
  region: string;
  plane: 'control' | 'data';
}
```

**`request()`** — For standard JSON request/response. Signs the request, sends it, checks status, parses JSON. Throws
`AgentCoreApiError` on non-2xx. Returns `unknown` (caller casts to typed result). Returns `{}` for 204 No Content.

**`requestRaw()`** — For streaming responses. Signs and sends the request, checks status, returns the raw `Response`
object. The caller reads the stream. This is used by `invokeHarness()` to parse SSE events.

**Endpoint resolution:**

```
control plane:
  prod  → https://bedrock-agentcore-control.{region}.amazonaws.com
  beta  → https://beta.{region}.elcapcp.genesis-primitives.aws.dev
  gamma → https://gamma.{region}.elcapcp.genesis-primitives.aws.dev

data plane:
  prod  → https://bedrock-agentcore.{region}.amazonaws.com
  beta  → https://beta.{region}.elcapdp.genesis-primitives.aws.dev
  gamma → https://gamma.{region}.elcapdp.genesis-primitives.aws.dev
```

Stage is read from `process.env.AGENTCORE_STAGE`.

**Credentials:** Delegates to the existing `getCredentialProvider()` from `src/cli/aws/account.ts`. No new credential
logic.

**Signing:** Uses `@smithy/signature-v4` with service name `bedrock-agentcore` for both planes (matching the evo
pattern).

**Error class:**

```typescript
class AgentCoreApiError extends Error {
  readonly statusCode: number;
  readonly requestId: string | undefined;
  readonly errorBody: string;

  constructor(statusCode: number, errorBody: string, requestId?: string);
}
```

### Layer 2: Harness Operations

**File:** `src/cli/aws/agentcore-harness.ts`

Typed wrapper functions that create an `AgentCoreApiClient` and call the Harness API. Each function is self-contained —
creates its own client instance (matching the evo pattern of no global singletons).

#### Control Plane Operations

All use `plane: 'control'`.

**`createHarness(options: CreateHarnessOptions): Promise<CreateHarnessResult>`**

```
POST /harnesses  (201)

Body: {
  harnessName, clientToken, executionRoleArn,
  environment?, environmentArtifact?, environmentVariables?,
  authorizerConfiguration?, model?, systemPrompt?, tools?,
  skills?, allowedTools?, memory?, truncation?,
  maxIterations?, maxTokens?, timeoutSeconds?, tags?
}

Response: { harness: Harness }
```

Generates `clientToken` via `randomUUID()` for idempotency.

**`getHarness(options: GetHarnessOptions): Promise<GetHarnessResult>`**

```
GET /harnesses/{harnessId}

Response: { harness: Harness }
```

**`updateHarness(options: UpdateHarnessOptions): Promise<UpdateHarnessResult>`**

```
PATCH /harnesses/{harnessId}

Body: {
  clientToken?,
  executionRoleArn?, environment?, environmentArtifact?,
  environmentVariables?, authorizerConfiguration?,
  model?, systemPrompt?, tools?, skills?, allowedTools?,
  memory?, truncation?,
  maxIterations?, maxTokens?, timeoutSeconds?, tags?
}

Response: { harness: Harness }
```

Note: `environmentArtifact` and `memory` use the `{ optionalValue: ... }` wrapper pattern for nullable updates (set to
`null` to clear).

**`deleteHarness(options: DeleteHarnessOptions): Promise<DeleteHarnessResult>`**

```
DELETE /harnesses/{harnessId}?clientToken=...

Response: { harness: Harness }
```

`clientToken` is a query parameter (not body), per the Smithy model.

**`listHarnesses(options: ListHarnessesOptions): Promise<ListHarnessesResult>`**

```
GET /harnesses?maxResults=N&nextToken=...

Response: { harnesses: HarnessSummary[], nextToken?: string }
```

Also provide a convenience `listAllHarnesses()` that auto-paginates.

#### Data Plane Operations

Uses `plane: 'data'`.

**`invokeHarness(options: InvokeHarnessOptions): AsyncGenerator<HarnessStreamEvent>`**

```
POST /harnesses/invoke?harnessArn={arn}
Header: X-Amzn-Bedrock-AgentCore-Runtime-Session-Id: {sessionId}

Body: {
  messages, model?, systemPrompt?, tools?, skills?,
  allowedTools?, maxIterations?, maxTokens?, timeoutSeconds?,
  actorId?
}

Response: streaming event-stream
```

The function:

1. Builds the request with `harnessArn` as query param and `runtimeSessionId` as header
2. Calls `client.requestRaw()` to get the raw streaming response
3. Parses the event stream (AWS event-stream format) and yields typed `HarnessStreamEvent` objects

### Streaming Event Types

Derived directly from the Smithy model's `InvokeHarnessStreamOutput` union:

```typescript
type HarnessStreamEvent =
  | { type: 'messageStart'; role: string }
  | { type: 'contentBlockStart'; contentBlockIndex: number; start: ContentBlockStart }
  | { type: 'contentBlockDelta'; contentBlockIndex: number; delta: ContentBlockDelta }
  | { type: 'contentBlockStop'; contentBlockIndex: number }
  | { type: 'messageStop'; stopReason: HarnessStopReason }
  | { type: 'metadata'; usage: TokenUsage; metrics: StreamMetrics }
  | { type: 'error'; errorType: string; message: string };

type ContentBlockStart =
  | { type: 'toolUse'; toolUseId: string; name: string; toolUseType?: string; serverName?: string }
  | { type: 'toolResult'; toolUseId: string; status?: string };

type ContentBlockDelta =
  | { type: 'text'; text: string }
  | { type: 'toolUse'; input: string }
  | { type: 'toolResult'; results: ToolResultDelta[] }
  | { type: 'reasoningContent'; text?: string; signature?: string };

type HarnessStopReason =
  | 'end_turn'
  | 'tool_use'
  | 'tool_result'
  | 'max_tokens'
  | 'stop_sequence'
  | 'content_filtered'
  | 'malformed_model_output'
  | 'malformed_tool_use'
  | 'interrupted'
  | 'partial_turn'
  | 'model_context_window_exceeded'
  | 'max_iterations_exceeded'
  | 'max_output_tokens_exceeded'
  | 'timeout_exceeded';

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadInputTokens?: number;
  cacheWriteInputTokens?: number;
}

interface StreamMetrics {
  latencyMs: number;
}
```

### Harness Resource Type

The `Harness` object returned by CRUD operations (from the Smithy model):

```typescript
interface Harness {
  harnessId: string;
  harnessName: string;
  arn: string;
  status: HarnessStatus;
  executionRoleArn: string;
  model?: HarnessModelConfiguration;
  systemPrompt?: HarnessSystemPrompt;
  tools?: HarnessTool[];
  skills?: HarnessSkill[];
  allowedTools?: string[];
  memory?: HarnessMemoryConfiguration;
  truncation?: HarnessTruncationConfiguration;
  maxIterations?: number;
  maxTokens?: number;
  timeoutSeconds?: number;
  environment?: HarnessEnvironmentProvider;
  environmentArtifact?: HarnessEnvironmentArtifact;
  environmentVariables?: Record<string, string>;
  authorizerConfiguration?: AuthorizerConfiguration;
  tags?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

type HarnessStatus = 'CREATING' | 'READY' | 'UPDATING' | 'DELETING' | 'DELETED' | 'FAILED';
```

### Polling Utility

**File:** `src/cli/aws/poll.ts`

Generic polling helper, reusable for any resource that has async status transitions:

```typescript
interface PollOptions<T> {
  fn: () => Promise<T>;
  isTerminal: (result: T) => boolean;
  isFailure?: (result: T) => boolean;
  getFailureReason?: (result: T) => string;
  intervalMs?: number; // default: 3000
  maxWaitMs?: number; // default: 120_000
}

async function pollUntilTerminal<T>(options: PollOptions<T>): Promise<T>;
```

Usage for harness:

```typescript
const harness = await pollUntilTerminal({
  fn: () => getHarness({ region, harnessId }),
  isTerminal: r => ['READY', 'FAILED', 'DELETED'].includes(r.harness.status),
  isFailure: r => r.harness.status === 'FAILED',
  getFailureReason: r => `Harness status: ${r.harness.status}`,
});
```

## File Structure

```
src/cli/aws/
  api-client.ts              # AgentCoreApiClient class + AgentCoreApiError
  agentcore-harness.ts       # Typed Harness CRUD + invoke operations
  poll.ts                    # Generic pollUntilTerminal utility
  __tests__/
    api-client.test.ts       # Unit tests for signing, endpoint resolution, error handling
    agentcore-harness.test.ts  # Unit tests for harness operations (mocked HTTP)
    poll.test.ts             # Unit tests for polling
```

## Dependencies

All already in `package.json` (used by the evo branch):

- `@smithy/signature-v4` — SigV4 signing
- `@smithy/protocol-http` — `HttpRequest` construction
- `@aws-crypto/sha256-js` — SHA-256 for signing
- `@aws-sdk/credential-provider-node` — fallback credential provider
- `@aws-sdk/credential-providers` — `fromEnv`, `fromNodeProviderChain`

No new dependencies required.

## Testing Strategy

- **`api-client.test.ts`**: Mock `fetch` globally. Test that `request()` signs correctly, resolves endpoints per stage,
  throws `AgentCoreApiError` with status/requestId on failures, returns parsed JSON on success, returns `{}` on 204.
- **`agentcore-harness.test.ts`**: Mock `AgentCoreApiClient`. Test each operation builds the correct
  method/path/body/query, passes through options, casts response types correctly. Test `invokeHarness` yields correctly
  typed stream events.
- **`poll.test.ts`**: Test terminal detection, failure detection, timeout, interval spacing.

## Future Work

- Refactor existing evo files (`agentcore-config-bundles.ts`, `agentcore-ab-tests.ts`, `agentcore-http-gateways.ts`,
  `agentcore-recommendation.ts`) to use `AgentCoreApiClient` instead of their local `signedRequest()` functions.
- Migrate to SDK client when `@aws-sdk/client-bedrock-agentcore-control` adds Harness commands.
- Wire harness operations into deploy flow, TUI, and primitives (covered by the separate TUI+CLI plan).
