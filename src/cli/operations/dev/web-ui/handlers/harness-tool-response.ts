import { invokeHarness } from '../../../../aws/agentcore-harness';
import type { HarnessInvocationOverrides } from '../api-types';
import { buildInvokeOptions } from './harness-utils';
import type { RouteContext } from './route-context';
import type { IncomingMessage, ServerResponse } from 'node:http';

export async function handleHarnessToolResponse(
  ctx: RouteContext,
  req: IncomingMessage,
  res: ServerResponse,
  origin?: string
): Promise<void> {
  const body = await ctx.readBody(req);

  let parsed: {
    harnessName?: string;
    sessionId?: string;
    messages?: { role: string; content: Record<string, unknown>[] }[];
    harnessOverrides?: HarnessInvocationOverrides;
  };
  try {
    parsed = JSON.parse(body) as typeof parsed;
  } catch {
    ctx.setCorsHeaders(res, origin);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
    return;
  }

  if (!parsed.harnessName) {
    ctx.setCorsHeaders(res, origin);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'harnessName is required' }));
    return;
  }

  if (!parsed.messages || !Array.isArray(parsed.messages)) {
    ctx.setCorsHeaders(res, origin);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'messages array is required' }));
    return;
  }

  if (!parsed.sessionId) {
    ctx.setCorsHeaders(res, origin);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'sessionId is required' }));
    return;
  }

  const harness = (ctx.options.harnesses ?? []).find(h => h.name === parsed.harnessName);
  if (!harness) {
    ctx.setCorsHeaders(res, origin);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: `Harness "${parsed.harnessName}" not found` }));
    return;
  }

  const invokeOpts = buildInvokeOptions(
    harness.harnessArn,
    harness.region,
    parsed.sessionId,
    parsed.messages,
    parsed.harnessOverrides
  );

  ctx.setCorsHeaders(res, origin);
  const sseHeaders: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'x-session-id': parsed.sessionId,
  };
  res.writeHead(200, sseHeaders);

  try {
    const stream = invokeHarness(invokeOpts);
    for await (const event of stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.write(`data: ${JSON.stringify({ type: 'error', errorType: 'invocationError', message })}\n\n`);
  }

  res.end();
}
