# EVO Dev Tarball Test Results

**Tarball:** `aws-agentcore-dev-0.8.0-dev-20260413190122.tgz`  
**Package:** `@aws/agentcore-dev`  
**Binary:** `agentcore-dev`  
**Version:** `0.8.0-dev-20260413190122`  
**Date:** 2026-04-13  
**Account:** 998846730471  
**Region:** us-east-1  

## What's Bundled

- **CLI:** `feat/evo-implementation` + public main sync (includes region fix #818)
- **CDK:** `feat/evo-implementation` + main sync + CDK region fix (PR #145)
- **Python SDK:** `bedrock_agentcore-1.6.0.dev20260413` wheel from `feat/evo_main`
- **PR #66:** Wheel bundling support (local SDK wheel used at deploy time)

---

## Test Results Summary

| Flow | Status | Notes |
|------|--------|-------|
| `agentcore-dev --version` | PASS | `0.8.0-dev-20260413190122` |
| `agentcore-dev --help` | PASS | All commands listed (run, stop, config-bundle, ab-test, recommendations) |
| `agentcore-dev run --help` | PASS | Shows eval, batch-evaluation, recommendation |
| `agentcore-dev config-bundle --help` | PASS | Shows versions, diff |
| `agentcore-dev stop --help` | PASS | Shows ab-test, batch-evaluation, recommendation |
| `agentcore-dev validate` | PASS | |
| `agentcore-dev deploy --target dev --yes` | PASS | Config bundle created, runtime deployed |
| `agentcore-dev status --target dev` | PASS | Shows runtime READY + config bundle deployed |
| `agentcore-dev invoke --runtime <name> --target dev` | PASS | Agent responds correctly |

### Config Bundles

| Flow | Status | Notes |
|------|--------|-------|
| `cb versions --bundle <name>` | PASS | Shows version tree with branch, creator, parent chain |
| `cb versions --bundle <name> --json` | PASS | Full JSON with lineageMetadata |
| `cb alias` (`cb` = `config-bundle`) | PASS | |
| `cb diff --from <v1> --to <v2>` | PASS | Shows changed fields with old/new values |
| `cb diff` (identical versions) | PASS | "No differences found" |
| `cb diff` (invalid version ID) | PASS | API error with regex pattern message |
| `cb versions` (nonexistent bundle) | PASS | "not found. Has it been deployed?" |

### Recommendations

| Flow | Status | Notes |
|------|--------|-------|
| Recommendation with `--bundle-name` + `--bundle-version` + `--system-prompt-json-path` | PASS | Bundle ARN resolves correctly, COMPLETED |
| Recommendation with `--inline` + CloudWatch traces (`--lookback 7`) | PASS | COMPLETED with learned behaviors |
| Recommendation with short-form json path (`systemPrompt`) | PASS | Resolves to full `$.ARN.configuration.systemPrompt` |
| `recommendations history --json` | PASS | Shows past runs with full result data |
| Error: missing `--runtime` | PASS | "--runtime is required" |
| Error: missing `--evaluator` | PASS | "--evaluator is required for system-prompt recommendations" |
| Error: invalid `--type` | PASS | 'Must be one of: system-prompt, tool-description' |
| Error: nonexistent agent | PASS | 'Agent "X" not deployed. Run `agentcore deploy` first.' |

### Batch Evaluation

| Flow | Status | Notes |
|------|--------|-------|
| `run batch-evaluation --runtime <name> --evaluator Builtin.GoalSuccessRate` | PASS | COMPLETED, 5 sessions evaluated, avg score 1.0 |
| `evals history --json` | PASS | Returns saved results (empty for on-demand evals in this project) |

### Region Fix

| Flow | Status | Notes |
|------|--------|-------|
| Deploy with `aws-targets.json: us-west-2` while `AWS_REGION=us-east-1` | PASS | Stack + runtime correctly in us-west-2 (CDK region fix PR #145) |

---

## Cosmetic Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| Help text says `Usage: agentcore` not `agentcore-dev` | Low | Commander uses program name from argv[1], but the binary is `agentcore-dev`. Functional, just cosmetic. |
| Update nag shows `npm install -g @aws/agentcore@latest` | Low | Should say `@aws/agentcore-dev` for the dev package. Non-blocking since dev installs are from tarball. |

---

## Installation

```bash
# Install from tarball
npm install -g ~/Downloads/aws-agentcore-dev-0.8.0-dev-20260413190122.tgz

# Verify
agentcore-dev --version
# 0.8.0-dev-20260413190122

# Uninstall
npm uninstall -g @aws/agentcore-dev
```

---

## Command Reference (agentcore-dev namespace)

All commands use `agentcore-dev` instead of `agentcore`:

```bash
# Project lifecycle
agentcore-dev create --name myproject --framework Strands --defaults
agentcore-dev deploy --target dev --yes
agentcore-dev status --target dev
agentcore-dev invoke --runtime <name> --target dev --prompt "Hello"
agentcore-dev validate

# Config bundles
agentcore-dev add config-bundle
agentcore-dev config-bundle versions --bundle <name>
agentcore-dev config-bundle diff --bundle <name> --from <v1> --to <v2>
agentcore-dev cb versions --bundle <name>  # alias

# Recommendations
agentcore-dev run recommendation \
  --runtime <name> \
  --evaluator Builtin.GoalSuccessRate \
  --bundle-name <bundle> \
  --bundle-version <version> \
  --system-prompt-json-path systemPrompt

agentcore-dev run recommendation \
  --runtime <name> \
  --evaluator Builtin.GoalSuccessRate \
  --inline "You are a helpful assistant." \
  --lookback 7

agentcore-dev recommendations history

# Batch evaluation
agentcore-dev run batch-evaluation \
  --runtime <name> \
  --evaluator Builtin.GoalSuccessRate Builtin.Helpfulness

agentcore-dev stop batch-evaluation --id <id>

# Logs and traces
agentcore-dev logs --runtime <name>
agentcore-dev traces list --runtime <name>
```
