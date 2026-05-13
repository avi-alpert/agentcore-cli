import { HttpAgent } from '@ag-ui/client';
import { CopilotRuntime, createCopilotEndpoint } from '@copilotkit/runtime/v2';
import { serve } from '@hono/node-server';

const AGENT_PORT = process.env.AGENT_PORT ?? '8080';
const AGENT_URL = process.env.AGENT_URL ?? `http://localhost:${AGENT_PORT}/invocations`;

const agent = new HttpAgent({ url: AGENT_URL, headers: {} });
const runtime = new CopilotRuntime({ agents: { default: agent } });
const app = createCopilotEndpoint({ runtime, basePath: '/copilotkit' });

serve({ fetch: app.fetch, port: 3001 }, () => {
  console.log(`CopilotKit bridge → ${AGENT_URL}`);
  console.log('Bridge running on http://localhost:3001/copilotkit');
});
