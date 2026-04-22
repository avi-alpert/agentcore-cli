# Harness

A **harness** is a managed agent runtime that connects a foundation model to tools, memory, and configuration — without
requiring you to write agent framework code. You define the model, tools, and settings; AgentCore handles the
orchestration.

Use a harness when you want a quick, config-driven agent. Use a traditional agent (with `--framework`) when you need
custom code, a specific framework (Strands, LangChain, etc.), or full control over the agent loop.

## Creating a Harness Project

```bash
# Minimal — defaults to Bedrock provider, Claude Sonnet
agentcore create --name myharness

# Specify provider and model
agentcore create --name myharness --model-provider bedrock --model-id global.anthropic.claude-sonnet-4-6

# OpenAI provider (requires --api-key-arn)
agentcore create --name myharness --model-provider open_ai --model-id gpt-4o \
  --api-key-arn arn:aws:secretsmanager:us-west-2:123456789012:secret:openai-key

# Gemini provider
agentcore create --name myharness --model-provider gemini --model-id gemini-2.5-flash \
  --api-key-arn arn:aws:secretsmanager:us-west-2:123456789012:secret:gemini-key

# Skip auto-created memory
agentcore create --name myharness --no-harness-memory

# With all optional settings
agentcore create --name myharness \
  --model-provider bedrock \
  --max-iterations 10 \
  --max-tokens 4096 \
  --timeout 120 \
  --truncation-strategy sliding_window \
  --session-storage-mount-path /mnt/data
```

### Model Providers

| Provider | `--model-provider` value | Requires `--api-key-arn` |
| -------- | ------------------------ | ------------------------ |
| Bedrock  | `bedrock`                | No                       |
| OpenAI   | `open_ai` or `openai`    | Yes                      |
| Gemini   | `gemini`                 | Yes                      |

> Aliases `Bedrock`, `OpenAI`, `Gemini`, `Anthropic` (maps to bedrock) are also accepted.

### Harness vs Agent

If you pass `--framework`, `--language`, or other agent-specific flags, the CLI creates a traditional agent project
instead. These flags cannot be mixed with harness-only flags (`--model-id`, `--max-iterations`, etc.).

## Project Structure

```
myharness/
  agentcore/                  # Config and CDK project
    agentcore.json            # Project manifest (lists harnesses, memories, etc.)
    aws-targets.json          # Deployment targets
    cdk/                      # CDK infrastructure code
  app/myharness/              # Harness configuration
    harness.json              # Harness spec (model, tools, settings)
    system-prompt.md          # System prompt (editable)
```

## Deployment Targets (`aws-targets.json`)

Before deploying, ensure `aws-targets.json` has at least one target:

```json
[
  {
    "name": "default",
    "account": "123456789012",
    "region": "us-west-2"
  }
]
```

Fields:

- `name` — target name (use `"default"` for the primary target)
- `account` — AWS account ID (string)
- `region` — AWS region

## Adding a Harness to an Existing Project

```bash
agentcore add harness --name myharness --model-provider bedrock
agentcore add harness --name myharness --model-provider bedrock --session-storage /mnt/data
agentcore add harness --name myharness --model-provider bedrock --with-invoke-script
```

### Custom JWT Auth

```bash
agentcore add harness --name myharness --model-provider bedrock \
  --authorizer-type CUSTOM_JWT \
  --discovery-url https://example.auth0.com/.well-known/openid-configuration \
  --allowed-audience myapp
```

## Tools

Harnesses support four built-in tool types plus inline functions:

### Adding Tools

```bash
# Remote MCP server
agentcore add tool --harness myharness --type remote_mcp --name mytool \
  --url https://mcp-server.example.com/sse

# Browser tool
agentcore add tool --harness myharness --type agentcore_browser --name browser

# Code interpreter
agentcore add tool --harness myharness --type agentcore_code_interpreter --name codeinterp

# Gateway tool (by ARN)
agentcore add tool --harness myharness --type agentcore_gateway --name gwtool \
  --gateway-arn arn:aws:bedrock-agentcore:us-west-2:123456789012:gateway/gw-abc

# Gateway tool (by project gateway name — resolves ARN from deployed state)
agentcore add tool --harness myharness --type agentcore_gateway --name gwtool \
  --gateway mygateway
```

### Removing Tools

```bash
agentcore remove tool --harness myharness --name mytool
```

## Session Storage

Session storage provides a persistent filesystem mount for the harness runtime. Files written to the mount path persist
across invocations within the same session.

```bash
# Via add harness
agentcore add harness --name myharness --model-provider bedrock --session-storage /mnt/data

# Via create
agentcore create --name myharness --session-storage-mount-path /mnt/data
```

The path must be an absolute path under `/mnt/` (e.g., `/mnt/data`, `/mnt/workspace`).

**Important:** Only files written to the configured mount path are persistent and visible to `--exec` commands. Files
written to other paths (e.g., `/home`, `/tmp`) may be created in an ephemeral context and will not appear when
inspecting the container via `--exec`. If your tools write files, configure them to use the session storage path.

## Deploying

```bash
agentcore deploy          # Interactive — prompts for confirmation
agentcore deploy -y       # Auto-confirm
agentcore deploy --dry-run  # Preview without deploying
agentcore deploy --diff   # Show CDK diff
```

Deploy creates:

1. CloudFormation stack (IAM role, memory)
2. Harness resource via AgentCore API

## Checking Status

```bash
agentcore status                    # All resources
agentcore status --type harness     # Harness resources only
agentcore status --json             # JSON output
```

## Invoking

```bash
# Basic invoke
agentcore invoke --harness myharness "What can you do?"

# With session continuity
agentcore invoke --harness myharness --session-id <id> "Follow up question"

# Verbose — shows raw streaming events
agentcore invoke --harness myharness --verbose "Hello"

# JSON output
agentcore invoke --harness myharness --json "Hello"
```

### Invoke Overrides

These flags override harness settings for a single invocation only (they do not persist):

| Flag                          | Description                           |
| ----------------------------- | ------------------------------------- |
| `--model-id <id>`             | Use a different model                 |
| `--system-prompt <text>`      | Override the system prompt            |
| `--max-iterations <n>`        | Override max agent loop iterations    |
| `--max-tokens <n>`            | Override max tokens per iteration     |
| `--harness-timeout <seconds>` | Override execution timeout            |
| `--tools <tools>`             | Override tools (comma-separated)      |
| `--allowed-tools <tools>`     | Restrict which tools can be used      |
| `--skills <paths>`            | Skills to use (comma-separated paths) |
| `--actor-id <id>`             | Override memory actor ID              |
| `--bearer-token <token>`      | Bearer token for CUSTOM_JWT auth      |

## Logs and Traces

```bash
# View logs
agentcore logs --harness myharness --limit 20
agentcore logs --harness myharness --since 1h --level error

# List traces
agentcore traces list --harness myharness
agentcore traces list --harness myharness --since 30m --limit 10

# Download a trace
agentcore traces get --harness myharness <traceId>
agentcore traces get --harness myharness <traceId> --output ./trace.json
```

## Fetching Access Info

For harnesses with CUSTOM_JWT auth:

```bash
agentcore fetch access --name myharness --type harness
agentcore fetch access --name myharness --type harness --json
```

## Removing a Harness

```bash
agentcore remove harness --name myharness -y
agentcore deploy  # Apply removal to AWS
```

## Validating Configuration

```bash
agentcore validate
```

Checks:

- Harness schema validity (model, tools, settings)
- Cross-references (memory names exist in project)
- Tool configuration completeness

## Invoke Script

Pass `--with-invoke-script` to generate a standalone Python script for invoking the harness outside the CLI:

```bash
agentcore add harness --name myharness --model-provider bedrock --with-invoke-script
```

This creates `app/myharness/invoke.py` which uses `boto3` to invoke the harness directly.
