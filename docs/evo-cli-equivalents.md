# EVO Private Beta — AgentCore CLI Equivalents

This document maps each API operation from the EVO Private Beta Getting Started Guide to its AgentCore CLI equivalent.

> **Note:** The CLI auto-detects region, resolves runtime IDs and log groups from your deployed project state, generates
> client tokens, and polls async operations to completion. Most commands also have an interactive TUI wizard that
> launches when required options are omitted.

---

## 3. Evaluations (Batch)

### 3.2 Start Batch Evaluation

**API:**

```bash
aws evodp start-batch-evaluation \
    --endpoint-url $DP_ENDPOINT \
    --region $REGION \
    --name "acme-baseline-eval" \
    --evaluation-config '{ "evaluators": [...] }' \
    --session-source '{ "cloudWatchSource": { ... } }' \
    --execution-role-arn "$ROLE_ARN" \
    --client-token "$(uuidgen)"
```

**CLI:**

```bash
agentcore run batch-evaluation \
  -a acme-support-agent \
  -e Builtin.GoalSuccessRate Builtin.Helpfulness Builtin.Faithfulness \
  --execution-role "$ROLE_ARN"
```

**CLI with all options:**

```bash
agentcore run batch-evaluation \
  --agent <name>              # Agent name from project config (required)
  --evaluator <ids...>        # Evaluator ID(s) — Builtin.* or custom (required)
  --name <name>               # Custom name (auto-generated if omitted)
  --region <region>           # AWS region (auto-detected if omitted)
  --execution-role <arn>      # IAM execution role ARN (temporary)
  --json                      # Output as JSON
```

**TUI:** `agentcore` → **Run** → **Batch Evaluation** — auto-discovers deployed agents, evaluators, and sessions via
CloudWatch.

The CLI automatically:

- Resolves the agent's runtime ID and CloudWatch log group from deployed state
- Generates a unique name and client token
- Polls `get-batch-evaluation` until `COMPLETED` or `FAILED`
- Displays per-evaluator average scores and session counts
- Saves results locally to `.cli/eval-job-results/`

### 3.3 Check Results

**API:**

```bash
aws evodp get-batch-evaluation \
    --endpoint-url $DP_ENDPOINT \
    --region $REGION \
    --batch-evaluate-id "$BATCH_EVALUATE_ID"
```

**CLI:** The `run batch-evaluation` command polls automatically — no separate get call needed.

### 3.4 Stop Batch Evaluation

**API:**

```bash
aws evodp stop-batch-evaluation \
    --endpoint-url $DP_ENDPOINT \
    --region $REGION \
    --batch-evaluate-id "$BATCH_EVALUATE_ID"
```

**CLI:**

```bash
agentcore stop batch-evaluation --id "$BATCH_EVALUATE_ID"
```

**CLI with all options:**

```bash
agentcore stop batch-evaluation \
  --id <id>                   # Batch evaluation ID to stop (required)
  --region <region>           # AWS region (auto-detected if omitted)
  --json                      # Output as JSON
```

### 3.5 List Batch Evaluations

**API:**

```bash
aws evodp list-batch-evaluations \
    --endpoint-url $DP_ENDPOINT \
    --region $REGION \
    --max-results 10
```

**CLI:** _Not yet implemented as a CLI command._ The API client (`listBatchEvaluations`) exists internally. Use
`agentcore evals history` for locally saved results.

---

## 5. Recommendations

### 5.2 Start a System Prompt Recommendation

**API (Option A — Inline Session Spans):**

```bash
aws evodp start-recommendation \
    --endpoint-url $DP_ENDPOINT \
    --region $REGION \
    --name "improve-system-prompt" \
    --type "SYSTEM_PROMPT_RECOMMENDATION" \
    --recommendation-config "$(jq -n --slurpfile spans session_spans.json '{ ... }')"
```

**CLI:**

```bash
# System prompt from CloudWatch traces (auto-discovered)
agentcore run recommendation \
  -t system-prompt \
  -a acme-support-agent \
  -e Builtin.GoalSuccessRate \
  --lookback 7

# System prompt inline with specific sessions
agentcore run recommendation \
  -t system-prompt \
  -a acme-support-agent \
  -e Builtin.GoalSuccessRate \
  --inline "You are a helpful customer support assistant for Acme Store." \
  -s SESSION_ID_1 SESSION_ID_2

# System prompt from file
agentcore run recommendation \
  -t system-prompt \
  -a acme-support-agent \
  -e Builtin.GoalSuccessRate \
  --prompt-file ./my-prompt.txt

# With inline session spans file (Option A equivalent)
agentcore run recommendation \
  -t system-prompt \
  -a acme-support-agent \
  -e Builtin.GoalSuccessRate \
  --inline "You are helpful" \
  --spans-file session_spans.json

# From a configuration bundle (Option C equivalent)
agentcore run recommendation \
  -t system-prompt \
  -a acme-support-agent \
  -e Builtin.GoalSuccessRate \
  --bundle-name acme-support-config \
  --bundle-version "$VERSION_ID"
```

**CLI with all options:**

```bash
agentcore run recommendation \
  --type <type>               # system-prompt or tool-description (default: system-prompt)
  --agent <name>              # Agent name from project (required)
  --evaluator <names...>      # Evaluator name(s) or Builtin.* ID(s) (required, repeatable)
  --prompt-file <path>        # Load system prompt from file
  --inline <content>          # Provide content inline
  --bundle-name <name>        # Config bundle name
  --bundle-version <version>  # Config bundle version
  --tools <names>             # Comma-separated toolName:description pairs (tool-description type)
  --spans-file <path>         # JSON file with session spans (instead of CloudWatch)
  --lookback <days>           # Lookback window in days (default: 7)
  --session-id <ids...>       # Specific session IDs for traces
  --run <name>                # Run name prefix
  --region <region>           # AWS region (auto-detected if omitted)
  --json                      # Output as JSON
```

**TUI:** `agentcore` → **Recommendations** → **Run Recommendation** — wizard walks through type → agent → evaluators →
input source → trace source → confirm.

The CLI automatically:

- Resolves the agent's deployed runtime, log group, and service name
- Discovers session spans from CloudWatch (or reads from `--spans-file`)
- Polls `get-recommendation` until `COMPLETED`
- Prints the recommended prompt and explanation
- Saves results locally to `.cli/recommendation-results/`

### 5.3 Start a Tool Description Recommendation

**API:**

```bash
aws evodp start-recommendation \
    --endpoint-url $DP_ENDPOINT \
    --region $REGION \
    --name "improve-tool-desc" \
    --type "TOOL_DESCRIPTION_RECOMMENDATION" \
    --recommendation-config "$(jq -n --slurpfile spans session_spans.json '{ ... }')"
```

**CLI:**

```bash
agentcore run recommendation \
  -t tool-description \
  -a acme-support-agent \
  -e Builtin.GoalSuccessRate \
  --inline "search_flights:Search for available flights" \
  --tools "search_flights:Search for available flights,book_seat:Book a seat on a flight" \
  -s SESSION_ID_1

# From a configuration bundle
agentcore run recommendation \
  -t tool-description \
  -a acme-support-agent \
  -e Builtin.GoalSuccessRate \
  --bundle-name acme-support-config \
  --bundle-version "$VERSION_ID" \
  --tools "search_flights,book_seat"
```

**Note:** Tool description recommendations only support session-based trace source (no CloudWatch discovery).

### 5.4 Check Recommendation Status

**API:**

```bash
aws evodp get-recommendation \
    --endpoint-url $DP_ENDPOINT \
    --region $REGION \
    --recommendation-id "$RECOMMENDATION_ID"
```

**CLI:** The `run recommendation` command polls automatically — no separate get call needed.

### 5.5 View Past Recommendations

**CLI:**

```bash
# List locally saved recommendation runs
agentcore recommendations history

# JSON output
agentcore recommendations history --json
```

**TUI:** `agentcore` → **Recommendations** → **History**

### 5.6 List and Delete (Remote)

**API:**

```bash
aws evodp list-recommendations --endpoint-url $DP_ENDPOINT --region $REGION --max-results 10
aws evodp delete-recommendation --endpoint-url $DP_ENDPOINT --region $REGION --recommendation-id "$RECOMMENDATION_ID"
```

**CLI:** _Not yet implemented._ Use `agentcore recommendations history` for locally saved results.

---

## 2. Configuration Bundles

### 2.1 Create a Configuration Bundle

**API:**

```bash
aws evocp create-configuration-bundle \
  --endpoint-url $CP_ENDPOINT \
  --region $REGION \
  --bundle-name "my_agent_config" \
  --description "Initial agent configuration" \
  --components '{ ... }' \
  --branch-name "mainline" \
  --commit-message "Initial version" \
  --created-by '{ ... }' \
  --client-token "$(uuidgen)"
```

**CLI:**

```bash
# Interactive TUI wizard
agentcore add config-bundle
```

**TUI:** `agentcore` → **Add** → **Config Bundle** — prompts for system prompt, model ID, branch name, commit message,
and handles `createdBy` metadata and client token automatically.

The wizard detects existing bundles and creates a new version with the correct `parentVersionIds` to maintain the
version chain.

### 2.2 Get a Configuration Bundle Version

**API:**

```bash
# Specific version
aws evocp get-configuration-bundle-version \
  --endpoint-url $CP_ENDPOINT --region $REGION \
  --bundle-id "$BUNDLE_ID" --version-id "$VERSION_ID"
```

**CLI:** _No standalone get-version command._ Use `agentcore config-bundle versions` to list versions, and
`agentcore config-bundle diff` to compare them. Use `--json` for full version data.

### 2.3 Update a Configuration Bundle

**API:**

```bash
aws evocp update-configuration-bundle \
  --endpoint-url $CP_ENDPOINT \
  --region $REGION \
  --bundle-id "$BUNDLE_ID" \
  --components '{ ... }' \
  --parent-version-ids '["PARENT_VERSION_ID"]' \
  --branch-name "mainline" \
  --commit-message "Improve system prompt" \
  --created-by '{ ... }' \
  --client-token "$(uuidgen)"
```

**CLI:**

```bash
# TUI wizard — creates a new version with parent chain
agentcore add config-bundle
```

### 2.4 List Configuration Bundle Versions

**API:**

```bash
aws evocp list-configuration-bundle-versions \
  --endpoint-url $CP_ENDPOINT --region $REGION \
  --bundle-id "$BUNDLE_ID" \
  --filter '{"branchName": "mainline"}'
```

**CLI:**

```bash
# List all versions
agentcore config-bundle versions --bundle "my-agent-config"

# Filter by branch
agentcore config-bundle versions --bundle "my-agent-config" --branch mainline

# Latest version per branch
agentcore config-bundle versions --bundle "my-agent-config" --latest-per-branch

# Filter by creator
agentcore config-bundle versions --bundle "my-agent-config" --created-by recommendation

# JSON output
agentcore config-bundle versions --bundle "my-agent-config" --json
```

**CLI with all options:**

```bash
agentcore config-bundle versions \
  --bundle <name>             # Bundle name (required)
  --branch <name>             # Filter by branch name
  --latest-per-branch         # Show only the latest version per branch
  --created-by <filters...>   # Filter by creator (e.g. "user", "recommendation")
  --region <region>           # AWS region override
  --json                      # Output as JSON
```

**TUI:** `agentcore` → **Config Bundle** → **Version History**

### 2.5 Diff Configuration Bundle Versions

**CLI:**

```bash
agentcore config-bundle diff --bundle "my-agent-config" --from "$V1" --to "$V2"
```

**CLI with all options:**

```bash
agentcore config-bundle diff \
  --bundle <name>             # Bundle name (required)
  --from <id>                 # Source version ID (required)
  --to <id>                   # Target version ID (required)
  --region <region>           # AWS region override
  --json                      # Output as JSON
```

**TUI:** `agentcore` → **Config Bundle** → **Diff**

### 2.6 Delete a Configuration Bundle

**API:**

```bash
aws evocp delete-configuration-bundle \
  --endpoint-url $CP_ENDPOINT --region $REGION \
  --bundle-id "$BUNDLE_ID"
```

**CLI:**

```bash
# Interactive TUI
agentcore remove config-bundle
```

**Note:** The `config-bundle` command also supports the `cb` alias (e.g. `agentcore cb versions ...`).

---

## Quick Reference Table

| API Operation                             | CLI Command                                                                 | TUI                       |
| ----------------------------------------- | --------------------------------------------------------------------------- | ------------------------- |
| `start-batch-evaluation`                  | `agentcore run batch-evaluation -a <agent> -e <evaluators...>`              | Run → Batch Evaluation    |
| `get-batch-evaluation`                    | _(auto-polled by `run batch-evaluation`)_                                   | —                         |
| `stop-batch-evaluation`                   | `agentcore stop batch-evaluation --id <id>`                                 | —                         |
| `list-batch-evaluations`                  | _Not yet implemented_                                                       | —                         |
| `start-recommendation` (system prompt)    | `agentcore run recommendation -t system-prompt -a <agent> -e <eval>`        | Recommendations → Run     |
| `start-recommendation` (tool description) | `agentcore run recommendation -t tool-description -a <agent> --tools <...>` | Recommendations → Run     |
| `get-recommendation`                      | _(auto-polled by `run recommendation`)_                                     | —                         |
| `list-recommendations`                    | _Not yet implemented (remote)_                                              | —                         |
| `delete-recommendation`                   | _Not yet implemented_                                                       | —                         |
| View past recommendations                 | `agentcore recommendations history`                                         | Recommendations → History |
| `create-configuration-bundle`             | `agentcore add config-bundle`                                               | Add → Config Bundle       |
| `update-configuration-bundle`             | `agentcore add config-bundle` _(new version)_                               | Add → Config Bundle       |
| `get-configuration-bundle-version`        | _No standalone command — use `versions --json`_                             | —                         |
| `list-configuration-bundle-versions`      | `agentcore config-bundle versions --bundle <name>`                          | Config Bundle → Versions  |
| Diff versions                             | `agentcore config-bundle diff --bundle <name> --from <v1> --to <v2>`        | Config Bundle → Diff      |
| `delete-configuration-bundle`             | `agentcore remove config-bundle`                                            | Remove → Config Bundle    |

---

## Not Yet Implemented in CLI

| API Operation                         | Notes                                               |
| ------------------------------------- | --------------------------------------------------- |
| **A/B Tests** (full CRUD)             | No API client or CLI commands                       |
| **Gateway Routing Rules** (CRUD)      | No API client — needed for "deploy the winner" step |
| **List Batch Evaluations** (remote)   | API client exists internally, no CLI command        |
| **List Recommendations** (remote)     | API client exists internally, no CLI command        |
| **Delete Recommendation**             | API client exists, no CLI command                   |
| **Promote** (recommendation → bundle) | Not implemented                                     |
