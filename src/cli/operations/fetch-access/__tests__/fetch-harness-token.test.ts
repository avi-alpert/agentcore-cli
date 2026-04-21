import { readEnvFile } from '../../../../lib/utils/env';
import { canFetchHarnessToken, fetchHarnessToken } from '../fetch-harness-token';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/index.js', () => ({
  ConfigIO: vi.fn(),
}));

vi.mock('../../../../lib/utils/env', () => ({
  readEnvFile: vi.fn(),
}));

const DISCOVERY_URL = 'https://idp.example.com/.well-known/openid-configuration';
const TOKEN_ENDPOINT = 'https://idp.example.com/token';

const defaultHarnessSpecCustomJwt = {
  name: 'myHarness',
  model: { provider: 'bedrock', modelId: 'anthropic.claude-3-sonnet-20240229-v1:0' },
  authorizerType: 'CUSTOM_JWT',
  authorizerConfiguration: {
    customJwtAuthorizer: {
      discoveryUrl: DISCOVERY_URL,
      allowedClients: ['fallback-client'],
      allowedScopes: ['openid', 'profile'],
    },
  },
};

const defaultHarnessSpecIam = {
  name: 'myHarness',
  model: { provider: 'bedrock', modelId: 'anthropic.claude-3-sonnet-20240229-v1:0' },
};

const defaultDeployedState = {
  targets: {
    default: {
      resources: {
        harnesses: {
          myHarness: {
            harnessArn: 'arn:aws:bedrock:us-east-1:123456789012:harness/h-123',
          },
        },
      },
    },
  },
};

const baseProjectSpec = {
  name: 'test',
  version: 1,
  credentials: [
    {
      authorizerType: 'OAuthCredentialProvider',
      name: 'myHarness-oauth',
      discoveryUrl: DISCOVERY_URL,
    },
  ],
  runtimes: [],
  memories: [],
  evaluators: [],
  onlineEvalConfigs: [],
};

function createMockConfigIO(overrides: { deployedState?: any; projectSpec?: any; harnessSpec?: any }) {
  return {
    readDeployedState: vi.fn().mockResolvedValue(overrides.deployedState ?? defaultDeployedState),
    readProjectSpec: vi.fn().mockResolvedValue(overrides.projectSpec ?? baseProjectSpec),
    readHarnessSpec: vi.fn().mockResolvedValue(overrides.harnessSpec ?? defaultHarnessSpecCustomJwt),
  } as any;
}

describe('canFetchHarnessToken', () => {
  beforeEach(() => {
    vi.mocked(readEnvFile).mockResolvedValue({
      AGENTCORE_CREDENTIAL_MYHARNESS_OAUTH_CLIENT_SECRET: 'test-secret',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when all prerequisites met', async () => {
    const configIO = createMockConfigIO({});

    const result = await canFetchHarnessToken('myHarness', { configIO });

    expect(result).toBe(true);
  });

  it('returns false when harness is not CUSTOM_JWT', async () => {
    const configIO = createMockConfigIO({
      harnessSpec: defaultHarnessSpecIam,
    });

    const result = await canFetchHarnessToken('myHarness', { configIO });

    expect(result).toBe(false);
  });

  it('returns false when no managed credential exists', async () => {
    const configIO = createMockConfigIO({
      projectSpec: { ...baseProjectSpec, credentials: [] },
    });

    const result = await canFetchHarnessToken('myHarness', { configIO });

    expect(result).toBe(false);
  });

  it('returns false when client secret is missing from env', async () => {
    vi.mocked(readEnvFile).mockResolvedValue({});
    const configIO = createMockConfigIO({});

    const result = await canFetchHarnessToken('myHarness', { configIO });

    expect(result).toBe(false);
  });

  it('returns false when readHarnessSpec throws', async () => {
    const configIO = createMockConfigIO({});
    configIO.readHarnessSpec.mockRejectedValue(new Error('file not found'));

    const result = await canFetchHarnessToken('myHarness', { configIO });

    expect(result).toBe(false);
  });
});

describe('fetchHarnessToken', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.mocked(readEnvFile).mockResolvedValue({
      AGENTCORE_CREDENTIAL_MYHARNESS_OAUTH_CLIENT_SECRET: 'test-secret',
      AGENTCORE_CREDENTIAL_MYHARNESS_OAUTH_CLIENT_ID: 'test-client',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('throws for non-CUSTOM_JWT harness', async () => {
    const configIO = createMockConfigIO({
      harnessSpec: defaultHarnessSpecIam,
    });

    await expect(fetchHarnessToken('myHarness', { configIO })).rejects.toThrow('uses AWS_IAM auth, not CUSTOM_JWT');
  });

  it('throws when no deployed targets exist', async () => {
    const configIO = createMockConfigIO({
      deployedState: { targets: {} },
    });

    await expect(fetchHarnessToken('myHarness', { configIO })).rejects.toThrow(
      'No deployed targets found. Run `agentcore deploy` first.'
    );
  });

  it('throws when customJwtAuthorizer is missing from config', async () => {
    const configIO = createMockConfigIO({
      harnessSpec: {
        ...defaultHarnessSpecCustomJwt,
        authorizerConfiguration: {},
      },
    });

    await expect(fetchHarnessToken('myHarness', { configIO })).rejects.toThrow(
      'has no customJwtAuthorizer configuration'
    );
  });

  it('performs OAuth flow and returns token', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token_endpoint: TOKEN_ENDPOINT }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'harness-token', expires_in: 3600 }),
      } as Response);

    const configIO = createMockConfigIO({});

    const result = await fetchHarnessToken('myHarness', { configIO });

    expect(result).toEqual({
      token: 'harness-token',
      expiresIn: 3600,
    });
  });

  it('passes deployTarget option through to target resolution', async () => {
    const deployedState = {
      targets: {
        staging: {
          resources: {
            credentials: {
              'myHarness-oauth': { clientId: 'staging-client' },
            },
          },
        },
        prod: {
          resources: {},
        },
      },
    };

    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token_endpoint: TOKEN_ENDPOINT }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'staging-token', expires_in: 1800 }),
      } as Response);

    const configIO = createMockConfigIO({ deployedState });

    const result = await fetchHarnessToken('myHarness', { configIO, deployTarget: 'staging' });

    expect(result.token).toBe('staging-token');

    // Verify it used the staging client ID from deployed state
    const tokenCall = vi.mocked(global.fetch).mock.calls[1]!;
    const body = tokenCall[1]?.body as string;
    expect(body).toContain('client_id=staging-client');
  });
});
