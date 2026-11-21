import test from 'node:test';
import assert from 'node:assert/strict';
import {
  manageOneDrive,
  manageGoogleCloud,
  manageLocalBridge,
  listAllIntegrations
} from '../src/external-integrations.js';
import {
  secretInputSchema,
  verifyMicrosoftOneDrive,
  verifyGoogleCloud
} from '../src/secret-vault.js';
import { runTool } from '../src/tools.js';

test('secretInputSchema accepts onedrive and google_cloud providers', () => {
  const onedriveInput = secretInputSchema.parse({
    provider: 'onedrive',
    name: 'Personal MSA OneDrive',
    secret: 'ms-graph-test-token-12345'
  });
  assert.equal(onedriveInput.provider, 'onedrive');

  const gcpInput = secretInputSchema.parse({
    provider: 'google_cloud',
    name: 'Google Cloud Platform Osprey',
    secret: 'ya29.a0AfH6SMTestGoogleCloudToken'
  });
  assert.equal(gcpInput.provider, 'google_cloud');
});

test('verifyMicrosoftOneDrive validates Graph drive endpoint with valid token', async () => {
  const mockFetcher = async (url, opts) => {
    assert.match(url, /graph\.microsoft\.com\/v1\.0\/me\/drive/);
    assert.equal(opts.headers.Authorization, 'Bearer valid-onedrive-token');
    return new Response(JSON.stringify({
      id: 'drive_saboi_2026',
      driveType: 'personal',
      owner: { user: { displayName: 'Ivan Sabo', email: 'saboivan2008@gmail.com' } },
      quota: { total: 1099511627776, remaining: 858993459200 }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const res = await verifyMicrosoftOneDrive('valid-onedrive-token', { fetcher: mockFetcher });
  assert.equal(res.connected, true);
  assert.equal(res.provider, 'onedrive');
  assert.equal(res.drive_id, 'drive_saboi_2026');
  assert.equal(res.owner, 'Ivan Sabo');
  assert.equal(res.status, 'verified');
});

test('verifyGoogleCloud validates OAuth tokeninfo endpoint', async () => {
  const mockFetcher = async (url) => {
    assert.match(url, /oauth2\/v3\/tokeninfo/);
    return new Response(JSON.stringify({
      email: 'saboivan2008@gmail.com',
      scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/drive',
      expires_in: 3599
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const res = await verifyGoogleCloud('ya29.mock_valid_token_string', { fetcher: mockFetcher });
  assert.equal(res.connected, true);
  assert.equal(res.provider, 'google_cloud');
  assert.equal(res.project_id, 'tangential-osprey-dl7cp');
  assert.equal(res.email, 'saboivan2008@gmail.com');
  assert.equal(res.status, 'verified');
});

test('listAllIntegrations includes all 5 sovereign pillars', async () => {
  const mockEnv = {
    GOOGLE_PROJECT_ID: 'tangential-osprey-dl7cp',
    CF_API_TOKEN: 'cf-test-token',
    GITHUB_TOKEN: 'gh-test-token',
    ONEDRIVE_TOKEN: 'od-test-token'
  };

  const integrations = await listAllIntegrations(mockEnv);
  assert.ok(Array.isArray(integrations));
  
  const ids = integrations.map(item => item.id);
  assert.ok(ids.includes('cloudflare'), 'Missing cloudflare');
  assert.ok(ids.includes('github'), 'Missing github');
  assert.ok(ids.includes('onedrive'), 'Missing onedrive');
  assert.ok(ids.includes('google_cloud'), 'Missing google_cloud');
  assert.ok(ids.includes('local_bridge'), 'Missing local_bridge');

  const onedrive = integrations.find(i => i.id === 'onedrive');
  assert.equal(onedrive.category, 'Cloud Storage & Documents');
  assert.equal(onedrive.status, 'configured');

  const gcp = integrations.find(i => i.id === 'google_cloud');
  assert.equal(gcp.status, 'configured');

  const local = integrations.find(i => i.id === 'local_bridge');
  assert.equal(local.status, 'platform-connected');
});

test('manageOneDrive handles status, list_files, and upload_file', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, opts = {}) => {
      if (url.includes('/me/drive/root/children')) {
        return new Response(JSON.stringify({
          value: [
            { id: 'item-1', name: 'Trinity-Architecture.docx', size: 1048576, lastModifiedDateTime: '2026-11-09T10:00:00Z' },
            { id: 'item-2', name: 'Vault-Backups', folder: {}, size: 0, lastModifiedDateTime: '2026-11-09T12:00:00Z' }
          ]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/content') && opts.method === 'PUT') {
        return new Response(JSON.stringify({
          id: 'item-new',
          name: 'report.json',
          size: 128
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/me/drive')) {
        return new Response(JSON.stringify({
          id: 'drive_saboi',
          driveType: 'personal',
          quota: { total: 1000, remaining: 500 }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('Not found', { status: 404 });
    };

    const env = { ONEDRIVE_TOKEN: 'mock-onedrive-token' };

    const statusRes = await manageOneDrive(env, 'trinity', 'status');
    assert.equal(statusRes.success, true);
    assert.equal(statusRes.connected, true);
    assert.equal(statusRes.drive_id, 'drive_saboi');

    const listRes = await manageOneDrive(env, 'trinity', 'list_files');
    assert.equal(listRes.success, true);
    assert.equal(listRes.files.length, 2);
    assert.equal(listRes.files[0].name, 'Trinity-Architecture.docx');

    const uploadRes = await manageOneDrive(env, 'trinity', 'upload_file', {
      path: 'Documents/Trinity/report.json',
      content: JSON.stringify({ status: 'ok', sovereign: true })
    });
    assert.equal(uploadRes.success, true);
    assert.equal(uploadRes.file.name, 'report.json');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('manageGoogleCloud provides status and model listing', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      if (url.includes('models')) {
        return new Response(JSON.stringify({
          models: [{ name: 'models/gemini-3.8-flash' }, { name: 'models/gemini-3.5-pro' }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('{}', { status: 200 });
    };

    const env = { GOOGLE_PROJECT_ID: 'tangential-osprey-dl7cp', GEMINI_API_KEY: 'mock-key' };
    const statusRes = await manageGoogleCloud(env, 'trinity', 'status');
    assert.equal(statusRes.success, true);
    assert.equal(statusRes.project_id, 'tangential-osprey-dl7cp');

    const modelsRes = await manageGoogleCloud(env, 'trinity', 'list_models');
    assert.equal(modelsRes.success, true);
    assert.equal(modelsRes.total, 2);
    assert.ok(modelsRes.models.includes('models/gemini-3.8-flash'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('manageLocalBridge reports local workstation health and endpoints', async () => {
  const env = { PC_BRIDGE: { online: true } };
  const res = await manageLocalBridge(env, 'trinity', 'status');
  assert.equal(res.success, true);
  assert.equal(res.endpoints.desktop.port, 8795);
  assert.equal(res.endpoints.gateway.port, 7789);
  assert.ok(res.workspaces.some(w => w.includes('Trinity-antigravity')));
});

test('runTool dispatches onedrive_manage, google_cloud_manage, local_bridge_manage and integration_status', async () => {
  const env = {
    GOOGLE_PROJECT_ID: 'tangential-osprey-dl7cp',
    ONEDRIVE_TOKEN: 'mock-od-token',
    PC_BRIDGE: { online: true }
  };
  const agent = { id: 'test-agent' };

  const odRes = await runTool(env, agent, 'onedrive_manage', { action: 'status' });
  assert.ok(odRes._evidence);
  assert.equal(odRes._evidence.effect, 'read');

  const gcpRes = await runTool(env, agent, 'google_cloud_manage', { action: 'status' });
  assert.ok(gcpRes._evidence);
  assert.equal(gcpRes._evidence.effect, 'read');

  const localRes = await runTool(env, agent, 'local_bridge_manage', { action: 'status' });
  assert.ok(localRes._evidence);
  assert.equal(localRes._evidence.effect, 'read');

  const intRes = await runTool(env, agent, 'integration_status', {});
  assert.ok(intRes._evidence);
  assert.ok(Array.isArray(intRes.integrations));
  assert.ok(intRes.integrations.length >= 5);
});
