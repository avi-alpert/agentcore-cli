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
});
