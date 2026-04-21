# EVO Feature Bug Bash — `feat/evo-implementation`

**Branch:** `feat/evo-implementation` **PRs merged:** #37, #46 (Config Bundles), #45 (Recommendations), #26 (Batch
Evaluation) **Total changes:** 92 files, ~9,000 lines added

---

## Installation

### Option A: Install from tarball (recommended for testers)

Download the tarball (`aws-agentcore-0.5.1-evo-pb-bug-bash.tgz`) and install globally:

```bash
npm install -g ./aws-agentcore-0.5.1-evo-pb-bug-bash.tgz
```

Verify installation:

```bash
agentcore --version
# Expected: 0.5.1-evo-pb-bug-bash
```

To uninstall after testing:

```bash
npm uninstall -g @aws/agentcore
```

### Option B: Install from tarball URL

If the tarball is hosted (e.g. S3 presigned URL, internal artifact store):

```bash
npm install -g https://<url>/aws-agentcore-0.5.1-evo-pb-bug-bash.tgz
```

### Option C: Build from source

```bash
git clone https://github.com/aws/private-agentcore-cli-staging.git
cd private-agentcore-cli-staging
git checkout feat/evo-implementation
npm install
npm run build
npm link
```

Verify:

```bash
agentcore --version
# Expected: 0.5.1-evo-pb-bug-bash
```

To unlink after testing:

```bash
npm unlink -g @aws/agentcore
```

---

## Prerequisites

1. AWS credentials configured (SSO or environment variables)
2. An AgentCore project with at least one deployed agent (`agentcore deploy`)
3. Agent must have recent invocations (sessions/traces in CloudWatch)

### Targeting Gamma us-east-1

All EVO APIs (batch eval, recommendations, config bundles) use **raw HTTP + SigV4** — not the AWS SDK. Endpoint
selection is controlled by `AGENTCORE_STAGE` env var:

| `AGENTCORE_STAGE` | Data Plane (DP)                                     | Control Plane (CP)                                  |
| ----------------- | --------------------------------------------------- | --------------------------------------------------- |
| _(unset)_         | `bedrock-agentcore.{region}.amazonaws.com`          | `bedrock-agentcore-control.{region}.amazonaws.com`  |
| `gamma`           | `gamma.{region}.elcapdp.genesis-primitives.aws.dev` | `gamma.{region}.elcapcp.genesis-primitives.aws.dev` |
| `beta`            | `beta.{region}.elcapdp.genesis-primitives.aws.dev`  | `beta.{region}.elcapcp.genesis-primitives.aws.dev`  |

**Set these before running any test:**

```bash
export AGENTCORE_STAGE=gamma
export AWS_REGION=us-east-1
```

Or pass `--region us-east-1` on individual commands. The `AGENTCORE_STAGE` env var **must** be set — there is no
`--stage` CLI flag.

**Which APIs hit which plane:**

- **Batch Evaluation** → DP (`elcapdp` / `bedrock-agentcore`)
- **Recommendations** → DP (`elcapdp` / `bedrock-agentcore`)
- **Config Bundles** → CP (`elcapcp` / `bedrock-agentcore-control`)

---

## Feature 1: Config Bundles

Config bundles let you version and track configuration changes for deployed agents.

### New Commands

| Command                                                              | Description                                      |
| -------------------------------------------------------------------- | ------------------------------------------------ |
| `agentcore add config-bundle`                                        | Add a config bundle to the project (TUI wizard)  |
| `agentcore remove config-bundle`                                     | Remove a config bundle from the project          |
| `agentcore config-bundle versions --bundle <name>`                   | List version history                             |
| `agentcore config-bundle diff --bundle <name> --from <id> --to <id>` | Diff two versions                                |
| `agentcore deploy`                                                   | Deploys config bundles alongside other resources |

### Test Flows

#### 1.1 — Add config bundle via TUI

- [ ] Run `agentcore` (interactive TUI)
- [ ] Navigate to **Add** → select **Config Bundle**
- [ ] Walk through wizard: name, description, components
- [ ] Verify `agentcore.json` now contains the config bundle entry
- [ ] Verify Esc/back navigation works at each step

#### 1.2 — Add config bundle via CLI

- [ ] Run `agentcore add config-bundle` with flags (if supported)
- [ ] Verify it writes to `agentcore.json` correctly

#### 1.3 — Deploy config bundle

- [ ] Run `agentcore deploy`
- [ ] Verify config bundle is created in AWS (check CloudFormation outputs or `agentcore status`)
- [ ] Verify deployed state tracks `configBundleId` and `configBundleArn`

#### 1.4 — List version history

- [ ] `agentcore config-bundle versions --bundle <name>` — verify versions are listed with branch, creator, timestamp
- [ ] `agentcore config-bundle versions --bundle <name> --json` — verify JSON output
- [ ] `agentcore config-bundle versions --bundle <name> --branch main` — verify branch filter
- [ ] `agentcore config-bundle versions --bundle <name> --latest-per-branch` — verify filter
- [ ] `agentcore config-bundle versions --bundle <name> --created-by user` — verify creator filter
- [ ] Test with a bundle that has no versions yet
- [ ] Test with an invalid bundle name (should show error)

#### 1.5 — Diff two versions

- [ ] `agentcore config-bundle diff --bundle <name> --from <v1> --to <v2>` — verify diff output shows changes
- [ ] `agentcore config-bundle diff --bundle <name> --from <v1> --to <v2> --json` — verify JSON output
- [ ] Diff identical versions — should show "No differences found"
- [ ] Diff with invalid version ID — should show error

#### 1.6 — Config bundle TUI hub

- [ ] From TUI, navigate to **Config Bundle** command
- [ ] Verify hub shows options: Version History, Diff
- [ ] Walk through version history screen — verify versions display correctly
- [ ] Walk through diff screen — select two versions, verify diff renders
- [ ] Test Esc/back navigation at each screen

#### 1.7 — Remove config bundle

- [ ] `agentcore remove` → select Config Bundle → confirm removal
- [ ] Verify entry removed from `agentcore.json`
- [ ] Verify `agentcore deploy` cleans up the resource

#### 1.8 — Alias

- [ ] `agentcore cb versions --bundle <name>` — verify `cb` alias works

---

## Feature 2: Recommendations

Recommendations analyze agent traces and suggest optimized system prompts or tool descriptions.

### New Commands

| Command                             | Description                                    |
| ----------------------------------- | ---------------------------------------------- |
| `agentcore run recommendation`      | Run a recommendation (CLI)                     |
| `agentcore recommendations history` | View past recommendation runs (local)          |
| TUI: **Recommendations** hub        | Interactive wizard for running recommendations |

### Test Flows

#### 2.1 — Run recommendation via CLI (system prompt)

- [ ] `````bash
              agentcore run recommendation \
                --type system-prompt \
                --agent <name> \
                --evaluator <evaluator> \
                --inline "You are a helpful assistant..." \
                --session-id <session1> <session2>
              ```
          ````
      `````
- [ ] Verify output shows recommendation ID, explanation, and recommended system prompt
- [ ] `--json` flag outputs valid JSON
- [ ] Results saved locally (check `.cli/recommendation-results/`)

#### 2.2 — Run recommendation via CLI (tool description)

- [ ] `````bash
              agentcore run recommendation \
                --type tool-description \
                --agent <name> \
                --evaluator <evaluator> \
                --inline "search:Find documents" \
                --tools "search:Find documents,calculator:Compute math" \
                --session-id <session1>
              ```
          ````
      `````
- [ ] Verify output shows tool-level recommendations

#### 2.3 — Run recommendation with file input

- [ ] Create a file with a system prompt
- [ ] `agentcore run recommendation --type system-prompt --agent <name> --evaluator <eval> --prompt-file ./prompt.txt`
- [ ] Verify it reads from file correctly

#### 2.4 — Run recommendation with CloudWatch traces

- [ ] `````bash
              agentcore run recommendation \
                --type system-prompt \
                --agent <name> \
                --evaluator <evaluator> \
                --inline "You are helpful" \
                --lookback 7
              ```
          ````
      `````
- [ ] Verify it discovers traces from CloudWatch (no `--session-id`)

#### 2.5 — Run recommendation with spans file

- [ ] Prepare a JSON spans file
- [ ] `agentcore run recommendation --type system-prompt --agent <name> --evaluator <eval> --inline "..." --spans-file ./spans.json`
- [ ] Verify it uses inline spans instead of CloudWatch

#### 2.6 — Recommendation TUI wizard

- [ ] From TUI, navigate to **Recommendations** → **Run Recommendation**
- [ ] Step through wizard:
  1. Select type (System Prompt / Tool Description)
  2. Select agent
  3. Select evaluator(s) (multi-select)
  4. Choose input source (inline / file)
  5. Enter content
  6. (If tool-desc) Enter tools
  7. Choose trace source (CloudWatch / Session IDs)
  8. (If CloudWatch) Set lookback days
  9. (If Sessions) Multi-select discovered sessions
  10. Confirm and run
- [ ] Verify progress steps display (fetching spans → starting → polling → saving)
- [ ] Verify results screen shows recommendation ID, explanation, recommended content
- [ ] Verify "Run another recommendation" action works
- [ ] Verify Esc/back navigation works at each wizard step

#### 2.7 — Recommendation TUI — tool description flow

- [ ] Repeat 2.6 but select "Tool Description" type
- [ ] Verify CloudWatch trace source is disabled (only Sessions available)
- [ ] Verify tool input step appears
- [ ] Verify results show per-tool recommendations

#### 2.8 — Recommendations history (CLI)

- [ ] `agentcore recommendations history` — verify table output with date, type, agent, ID
- [ ] `agentcore recommendations history --json` — verify JSON output
- [ ] Run with no prior recommendations — should show helpful message

#### 2.9 — Recommendations history (TUI)

- [ ] From TUI, navigate to **Recommendations** → **History**
- [ ] Verify past runs are listed
- [ ] Verify navigation works

#### 2.10 — Error handling

- [ ] Run recommendation without `--agent` — should show error
- [ ] Run recommendation without `--evaluator` — should show error
- [ ] Run recommendation with invalid `--type` — should show error
- [ ] Run recommendation with non-existent agent — should show error
- [ ] Run with expired/invalid AWS credentials — should show credentials error

---

## Feature 3: Batch Evaluation

Batch evaluation runs evaluators against agent sessions in bulk via the DP API.

### New Commands

| Command                                     | Description                     |
| ------------------------------------------- | ------------------------------- |
| `agentcore run batch-evaluation`            | Run a batch evaluation (CLI)    |
| `agentcore stop batch-evaluation --id <id>` | Stop a running batch evaluation |
| TUI: **Run** → **Batch Evaluation**         | Interactive wizard              |

### Test Flows

#### 3.1 — Run batch evaluation via CLI

- [ ] `````bash
              agentcore run batch-evaluation \
                --agent <name> \
                --evaluator Builtin.Faithfulness \
                --evaluator Builtin.Helpfulness
              ```
          ````
      `````
- [ ] Verify progress messages print (starting → polling → fetching → saving)
- [ ] Verify output shows evaluator scores grouped by evaluator
- [ ] Results saved locally (check `.cli/eval-job-results/`)
- [ ] `--json` flag outputs valid JSON

#### 3.2 — Run batch evaluation with options

- [ ] `--name my-eval-run` — verify custom name appears in output
- [ ] `--region us-west-2` — verify region override works
- [ ] `--execution-role <arn>` — verify role is passed (temporary flag)

#### 3.3 — Stop batch evaluation via CLI

- [ ] Start a batch evaluation
- [ ] While running, in another terminal: `agentcore stop batch-evaluation --id <id>`
- [ ] Verify success message with ID and status
- [ ] `--json` flag outputs valid JSON
- [ ] Test with invalid ID — should show error

#### 3.4 — Batch evaluation TUI wizard

- [ ] From TUI, navigate to **Run** → **Batch Evaluation**
- [ ] Step through wizard:
  1. Select agent
  2. Select evaluator(s) (multi-select)
  3. Choose session source (CloudWatch / Manual)
  4. (If CloudWatch) Set lookback days → multi-select discovered sessions
  5. (If Manual) Enter session IDs
  6. Enter run name (optional)
  7. Confirm and run
- [ ] Verify progress steps display with elapsed timer
- [ ] Verify results screen shows scores per evaluator
- [ ] Verify "Run another" action works
- [ ] Verify Esc/back at each step

#### 3.5 — Batch evaluation TUI — CloudWatch session discovery

- [ ] Select CloudWatch as session source
- [ ] Verify "Discovering sessions..." loading indicator
- [ ] Verify sessions appear with span counts and timestamps
- [ ] Select multiple sessions → confirm
- [ ] Test with agent that has no sessions — should show error message
- [ ] Test Esc during loading — should go back

#### 3.6 — Error handling

- [ ] Run without `--agent` — should show error (required option)
- [ ] Run without `--evaluator` — should show error (required option)
- [ ] Run with non-existent agent — should show resolution error
- [ ] Run with invalid evaluator ID — should show API error
- [ ] Run with expired AWS credentials — should show credentials error

---

## Feature 4: Cross-Feature & General

### 4.1 — TUI navigation

- [ ] Open TUI (`agentcore`) — verify all new commands appear in the help/command list:
  - `run` (now shows Batch Evaluation option)
  - `recommendations`
  - `config-bundle`
  - `stop`
- [ ] Navigate to each new feature and back — no crashes
- [ ] Verify help text updates correctly per screen (multi-select hints, navigate hints, etc.)

### 4.2 — Stage-aware endpoints

- [ ] Set `AGENTCORE_STAGE=gamma` and run commands — verify they hit gamma endpoints
- [ ] Unset `AGENTCORE_STAGE` — verify prod endpoints are used
- [ ] Set `AGENTCORE_STAGE=beta` — verify beta endpoints and SigV4 service name

### 4.3 — Existing features not broken

- [ ] `agentcore run eval` — still works as before
- [ ] `agentcore evals history` — still works
- [ ] `agentcore pause online-eval` / `agentcore resume online-eval` — still work
- [ ] `agentcore deploy` — deploys correctly with config bundles in project
- [ ] `agentcore status` — shows config bundle status alongside other resources
- [ ] `agentcore add agent` / `agentcore remove agent` — unchanged behavior

### 4.4 — Local result storage

- [ ] After running batch eval, check `.cli/eval-job-results/` for saved JSON
- [ ] After running recommendation, check `.cli/recommendation-results/` for saved JSON
- [ ] Verify files contain complete result data

### 4.5 — Help output

- [ ] `agentcore run --help` — shows `eval`, `batch-evaluation`, `recommendation` subcommands
- [ ] `agentcore stop --help` — shows `batch-evaluation` subcommand
- [ ] `agentcore config-bundle --help` — shows `versions`, `diff` subcommands
- [ ] `agentcore recommendations --help` — shows `history` subcommand
- [ ] `agentcore --help` — shows all new top-level commands

---

## Known Issues / Limitations

1. **Batch eval**: No aggregated scores persisted — averages computed on-the-fly
2. **Batch eval**: Fixed 5s poll interval, not configurable
3. **Batch eval**: No retry on transient poll failures
4. **Batch eval**: TUI results show evaluator-level averages only, no per-session drill-down
5. **Recommendations**: Tool description type with CloudWatch trace source is not supported (sessions only)
6. **Recommendations**: `--execution-role` is temporary and may be removed
7. **Config bundles**: Edit command removed — users should edit `agentcore.json` directly

---

## Environment Info

- **Account:** **\*\***\_\_\_**\*\***
- **Region:** **\*\***\_\_\_**\*\***
- **CLI version:** **\*\***\_\_\_**\*\***
- **Date:** **\*\***\_\_\_**\*\***
- **Tester:** **\*\***\_\_\_**\*\***
