import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { randomUUID } from 'crypto';

const region = 'us-east-1';
const endpoint = `https://gamma.${region}.elcapcp.genesis-primitives.aws.dev`;

const body = JSON.stringify({
  bundleName: 'test_rec_bundle',
  description: 'Test bundle for recommendation',
  clientToken: randomUUID(),
  components: {
    ['arn:aws:bedrock-agentcore:us-east-1:998846730471:runtime/myproject_MyAgent-QMd093Gl4O']: {
      configuration: {
        system_prompt: 'You are a helpful assistant that helps users.',
        modelId: 'anthropic.claude-sonnet-4-20250514',
      },
    },
  },
  branchName: 'mainline',
  commitMessage: 'Initial version for rec test',
});

const signer = new SignatureV4({
  credentials: defaultProvider(),
  region,
  service: 'bedrock-agentcore-control',
  sha256: Sha256,
});

const url = new URL('/configuration-bundles/create', endpoint);
const request = {
  method: 'POST',
  hostname: url.hostname,
  path: url.pathname,
  headers: {
    'content-type': 'application/json',
    host: url.hostname,
  },
  body,
};

const signed = await signer.sign(request);
const resp = await fetch(`${endpoint}/configuration-bundles/create`, {
  method: 'POST',
  headers: signed.headers,
  body,
});

const data = await resp.text();
console.log(`Status: ${resp.status}`);
console.log(data);
