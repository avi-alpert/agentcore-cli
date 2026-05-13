# {{ name }}

An AG-UI agent deployed on Amazon Bedrock AgentCore using Strands SDK.

## Overview

This agent implements the AG-UI protocol, enabling streaming agent-to-UI communication. The agent exposes an `/invocations` endpoint that accepts AG-UI protocol requests and streams responses back to the client.

## Local Development

```bash
uv sync
uv run python main.py
```

The agent starts on port 8080.

{{#if hasFrontend}}
## Frontend (CopilotKit)

A React chat interface that connects to your agent via the AG-UI protocol.

Start your agent in one terminal:

```bash
agentcore dev --logs
```

Then in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

The frontend connects to `http://localhost:8080/invocations` by default. If your agent runs on a different port (check the `agentcore dev --logs` output), set `AGENT_PORT`:

```bash
AGENT_PORT=8081 npm run dev
```

{{/if}}
## Deploy

```bash
agentcore deploy
```
