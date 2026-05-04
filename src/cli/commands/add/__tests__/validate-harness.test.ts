import type { AddHarnessCliOptions } from '../types';
import { validateAddHarnessOptions } from '../validate';
import { describe, expect, it } from 'vitest';

describe('validateAddHarnessOptions', () => {
  it('returns valid for no auth options', () => {
    const options: AddHarnessCliOptions = {};
    expect(validateAddHarnessOptions(options)).toEqual({ valid: true });
  });

  it('returns valid for AWS_IAM', () => {
    const options: AddHarnessCliOptions = { authorizerType: 'AWS_IAM' };
    expect(validateAddHarnessOptions(options)).toEqual({ valid: true });
  });

  it('returns valid for CUSTOM_JWT with all required fields', () => {
    const options: AddHarnessCliOptions = {
      authorizerType: 'CUSTOM_JWT',
      discoveryUrl: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_abc123/.well-known/openid-configuration',
      allowedAudience: 'aud1,aud2',
    };
    expect(validateAddHarnessOptions(options)).toEqual({ valid: true });
  });

  it('rejects invalid authorizer type', () => {
    const options: AddHarnessCliOptions = { authorizerType: 'INVALID' as any };
    const result = validateAddHarnessOptions(options);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid authorizer type');
  });

  it('rejects CUSTOM_JWT without discoveryUrl', () => {
    const options: AddHarnessCliOptions = { authorizerType: 'CUSTOM_JWT' };
    const result = validateAddHarnessOptions(options);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('--discovery-url is required');
  });

  it('rejects clientId without CUSTOM_JWT', () => {
    const options: AddHarnessCliOptions = { clientId: 'abc' };
    const result = validateAddHarnessOptions(options);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('OAuth client credentials are only valid with CUSTOM_JWT authorizer');
  });

  it('rejects unknown tool name', () => {
    const result = validateAddHarnessOptions({ tools: 'agentcore_browser,foo_tool' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Unknown tool 'foo_tool'");
  });

  it('rejects remote_mcp without --mcp-name', () => {
    const result = validateAddHarnessOptions({ tools: 'remote_mcp', mcpUrl: 'https://example.com' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('--mcp-name is required');
  });

  it('rejects remote_mcp without --mcp-url', () => {
    const result = validateAddHarnessOptions({ tools: 'remote_mcp', mcpName: 'my-mcp' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('--mcp-url is required');
  });

  it('rejects agentcore_gateway without --gateway-arn', () => {
    const result = validateAddHarnessOptions({ tools: 'agentcore_gateway' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('--gateway-arn is required');
  });

  it('rejects invalid --gateway-outbound-auth value', () => {
    const result = validateAddHarnessOptions({ gatewayOutboundAuth: 'iam' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid --gateway-outbound-auth 'iam'");
  });

  it('rejects oauth gateway auth without --gateway-provider-arn', () => {
    const result = validateAddHarnessOptions({ gatewayOutboundAuth: 'oauth', gatewayScopes: 'read' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('--gateway-provider-arn is required');
  });

  it('rejects oauth gateway auth without --gateway-scopes', () => {
    const result = validateAddHarnessOptions({ gatewayOutboundAuth: 'oauth', gatewayProviderArn: 'arn:aws:...' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('--gateway-scopes is required');
  });

  it('accepts valid tools with required companion flags', () => {
    const result = validateAddHarnessOptions({
      tools: 'agentcore_browser,remote_mcp,agentcore_gateway',
      mcpName: 'my-mcp',
      mcpUrl: 'https://mcp.example.com',
      gatewayArn: 'arn:aws:bedrock:us-east-1:123456789012:gateway/gw',
    });
    expect(result).toEqual({ valid: true });
  });
});
