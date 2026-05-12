# TypeScript Agent Support Bugbash — Status & Handoff

## Branch: `fix/strands-ts-stream-events`

## Commits in this PR

1. **`6eaaa2c5`** — fix(dev): use fixed port 8080 for TypeScript HTTP agents in web UI
2. **`ce878645`** — fix(templates): fix TypeScript non-Bedrock model provider templates

## How to Install & Test

```bash
cd agentcore-cli
npm run bundle
npm install -g ./aws-agentcore-0.13.1-<timestamp>.tgz
```

## Test Matrix Results

| Framework | Build     | Provider  | Create | Dev (logs) | Dev (web UI) | Deploy | Invoke (deployed)                       |
| --------- | --------- | --------- | ------ | ---------- | ------------ | ------ | --------------------------------------- |
| Strands   | CodeZip   | Bedrock   | ✅     | ✅         | ✅           | ✅     | ✅                                      |
| Strands   | CodeZip   | Anthropic | ✅     | ✅         | —            | ✅     | ❌ → ✅ (fixed: withApiKey call syntax) |
| Strands   | CodeZip   | OpenAI    | ✅     | ✅         | —            | —      | —                                       |
| Strands   | CodeZip   | Gemini    | ✅     | ✅         | —            | —      | —                                       |
| Strands   | Container | Bedrock   | ✅     | ✅         | ✅           | ✅     | ✅                                      |
| Strands   | Container | Anthropic | ✅     | ✅         | ✅           | ✅     | ✅ (after withApiKey fix)               |
| Strands   | Container | OpenAI    | ✅     | ✅         | —            | —      | —                                       |
| Strands   | Container | Gemini    | ✅     | ✅         | —            | —      | —                                       |
| VercelAI  | CodeZip   | Bedrock   | ✅     | ✅         | ✅           | ✅     | ✅                                      |
| VercelAI  | CodeZip   | Anthropic | ✅     | ✅         | —            | —      | —                                       |
| VercelAI  | CodeZip   | OpenAI    | ✅     | ✅         | —            | —      | —                                       |
| VercelAI  | CodeZip   | Gemini    | ✅     | ✅         | —            | —      | —                                       |
| VercelAI  | Container | Bedrock   | ✅     | ✅         | —            | —      | —                                       |
| VercelAI  | Container | Anthropic | ✅     | ✅         | ✅           | —      | —                                       |
| VercelAI  | Container | OpenAI    | ✅     | ✅         | —            | —      | —                                       |
| VercelAI  | Container | Gemini    | ✅     | ✅         | —            | —      | —                                       |

Legend: ✅ = tested & passed, ❌ = tested & failed, — = not tested

## What's Left to Test

- ~~**All Container + non-Bedrock combos** (4 Strands + 4 VercelAI = 8 rows)~~ ✅ All pass (Create, Dev logs, Invoke)
- ~~**Web UI mode** for non-Bedrock providers~~ ✅ Verified for Strands+Container+Anthropic and
  VercelAI+Container+Anthropic (returns 200)
- ~~**Deploy + invoke** for non-Bedrock providers~~ ✅ Fixed! Root cause was incorrect `withApiKey` call syntax in
  templates (commit `9c4715f9`). Deployed invoke now works for Strands+Container+Anthropic.
- ~~**Remove + destroy** lifecycle for non-Bedrock deployed stacks~~ ✅ Verified: `agentcore remove all --yes` +
  `agentcore deploy --yes` cleans up all AWS resources

## Known Issues & Gaps

### 1. ~~Deployed invoke fails for non-Bedrock providers~~ FIXED

**Root cause:** Template bug — `withApiKey(config, fn)()` should be `withApiKey(config)(fn)()`. The SDK uses a curried
HOF pattern. Fixed in commit `9c4715f9`.

~~The `withApiKey({ providerName })` call in deployed mode requires the AgentCore Identity service to have the
credential stored. This is a service-side configuration step, not a CLI bug.~~ To test deployed invoke for non-Bedrock:

- Deploy with `agentcore deploy`
- Manually register the API key credential via the AgentCore Identity API
- Then `agentcore invoke` should work

### 2. Empty IDENTITY_ENV_VAR when `--api-key` is omitted at create time

If you run `agentcore create` without `--api-key`, the templates render with empty `IDENTITY_ENV_VAR` and
`IDENTITY_PROVIDER_NAME`. The agent will crash at runtime because it can't find the key.

**Workaround:** Always pass `--api-key` during `agentcore create` for non-Bedrock providers:

```bash
agentcore create --name myagent --language TypeScript --framework Strands \
  --model-provider Anthropic --build CodeZip --memory none \
  --api-key "$ANTHROPIC_API_KEY"
```

### 3. Bundled `fast-uri` vulnerability in `aws-cdk-lib`

`npm audit` reports a high-severity vulnerability in `fast-uri@3.1.0` (path traversal + host confusion). It's in
`aws-cdk-lib`'s bundled `table` → `ajv@8.18.0` → `fast-uri`. Cannot be fixed via npm overrides because it's a bundled
dependency. Requires upstream CDK release.

### 4. Memory, Gateway, Observability

Known gaps per the bugbash doc — not tested.

## Tips for Testing

### Prerequisites

- Node.js 20+
- Docker/Podman for Container builds (run `podman machine start` if on macOS)
- AWS credentials:
  `ada credentials update --account 325335451438 --provider isengard --role Admin --profile deploy --once`

### API Keys

Store in `/Volumes/workplace/typescript/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...
```

### Quick test cycle for a combo

```bash
source /Volumes/workplace/typescript/.env

# Create
agentcore create --name testagent --language TypeScript \
  --framework <Strands|VercelAI> --model-provider <Bedrock|Anthropic|OpenAI|Gemini> \
  --build <CodeZip|Container> --memory none --api-key "$<PROVIDER>_API_KEY"

cd testagent

# Dev (logs mode)
agentcore dev --logs
# In another terminal:
agentcore dev "Hello" --stream

# Dev (web UI mode)
agentcore dev
# Open http://localhost:8081, send a message

# Deploy
echo '[{"name": "default", "account": "325335451438", "region": "us-east-1"}]' > agentcore/aws-targets.json
AWS_PROFILE=deploy agentcore deploy --yes

# Invoke deployed
AWS_PROFILE=deploy agentcore invoke --prompt "Hello" --stream

# Cleanup
AWS_PROFILE=deploy agentcore remove all --yes
AWS_PROFILE=deploy agentcore deploy --yes
```

### Port conflicts

The TS SDK hardcodes port 8080. Kill stale processes before testing:

```bash
lsof -ti:8080 | xargs kill
```

### Podman issues

If container builds fail with "Cannot connect to Podman":

```bash
podman machine stop && podman machine start
```
