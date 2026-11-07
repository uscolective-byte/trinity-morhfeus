import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AZURE_FOUNDRY_CONFIG,
  generateAzureFoundryAgentSpec,
  generateAzureKnowledgeIndexSchema,
  azureAgentManifestSchema
} from '../src/azure-foundry-agent.js';
import { copilotPluginRegistry } from '../src/copilot-plugins.js';

test('Azure Foundry Agent Spec generates valid manifest for Australia Central tenant', () => {
  const spec = generateAzureFoundryAgentSpec();

  assert.equal(spec.azureEnvironment.tenantId, 'ad443c2d-5bac-46b3-ad16-187e4ca37962');
  assert.equal(spec.azureEnvironment.resourceGroup, 'DA-RG-australiacentral');
  assert.equal(spec.azureEnvironment.resourceName, 'saboivan2008-0459-resource');
  assert.equal(spec.azureEnvironment.projectName, 'saboivan2008-0459');
  assert.equal(spec.model.deploymentName, 'gpt-4o');
  assert.equal(spec.knowledgeIndex.indexName, 'trinity-omni-knowledge');
  assert.ok(spec.checksum.startsWith('sha256:'));
  assert.ok(spec.instructions.includes('Truth Policy 2.1'));
});

test('Azure Knowledge Index Schema matches Azure AI Search standards', () => {
  const schema = generateAzureKnowledgeIndexSchema();

  assert.equal(schema.name, 'trinity-omni-knowledge');
  const fieldNames = schema.fields.map(f => f.name);
  assert.ok(fieldNames.includes('id'));
  assert.ok(fieldNames.includes('title'));
  assert.ok(fieldNames.includes('content'));
  assert.ok(fieldNames.includes('category'));
  assert.ok(fieldNames.includes('sha256'));
});

test('Copilot Plugin Registry registers azure-foundry-agent and antigravity-suite', () => {
  const azurePlugin = copilotPluginRegistry.get('azure-foundry-agent');
  assert.ok(azurePlugin, 'azure-foundry-agent plugin should be present');
  assert.equal(azurePlugin.enabled, true);
  assert.ok(azurePlugin.skills.includes('azureFoundryAgentSync'));

  const antigravityPlugin = copilotPluginRegistry.get('antigravity-suite');
  assert.ok(antigravityPlugin, 'antigravity-suite plugin should be present');
  assert.equal(antigravityPlugin.enabled, true);
  assert.ok(antigravityPlugin.skills.includes('antigravityReadFile'));
  assert.ok(antigravityPlugin.skills.includes('antigravityRunCommand'));
});

test('Azure Foundry Agent status and invoke functions work correctly', async () => {
  const { getAzureFoundryAgentStatus, invokeAzureFoundryAgent } = await import('../src/azure-foundry-agent.js');

  const status = getAzureFoundryAgentStatus({});
  assert.equal(status.configured, true);
  assert.equal(status.has_token, false);
  assert.equal(status.tenant_id, 'ad443c2d-5bac-46b3-ad16-187e4ca37962');
  assert.equal(status.agent_name, 'trinity-lead-developer');

  const pendingResult = await invokeAzureFoundryAgent({}, { message: 'Hi Trinity' });
  assert.equal(pendingResult.ok, false);
  assert.equal(pendingResult.status, 'pending_credentials');
  assert.ok(pendingResult.runner_command.includes('azure-foundry-trinity.py'));
});

