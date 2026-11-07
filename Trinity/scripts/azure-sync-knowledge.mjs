#!/usr/bin/env node
/**
 * Trinity Sovereign AI OS - Azure AI Foundry Knowledge Index Synchronizer
 * Prepares and indexes authoritative documents into Azure AI Search index `trinity-omni-knowledge`
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT_DIR = path.resolve(import.meta.dirname, '..', '..');
const REPO_DOCS = [
  'ARCHITECTURE.md',
  'README.md',
  'SECURITY.md',
  'API_REFERENCE.md',
  'SOVEREIGN_CHARTER.md',
  'TRINITY_LEDGER.md',
  'AGENTS.md',
  'Trinity/README.md',
  'Trinity/docs/PROVIDER_CONNECTIONS.md',
  'Trinity/docs/DEVELOPER_TOOLS_MCP.md',
  'Trinity/azure-foundry-agent-manifest.json'
];

export function buildIndexDocuments() {
  const documents = [];
  for (const relPath of REPO_DOCS) {
    const fullPath = path.resolve(ROOT_DIR, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const id = relPath.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const stats = fs.statSync(fullPath);

    documents.push({
      id,
      title: path.basename(relPath),
      content,
      category: relPath.endsWith('.json') ? 'schema' : 'documentation',
      path: relPath,
      sha256: hash,
      updated_at: stats.mtime.toISOString()
    });
  }
  return documents;
}

export async function syncToAzureSearch(endpoint, apiKey, indexName = 'trinity-omni-knowledge') {
  const docs = buildIndexDocuments();
  console.log(`[Azure Sync] Prepared ${docs.length} documents from Trinity repository.`);

  if (!endpoint || !apiKey) {
    const exportFile = path.resolve(ROOT_DIR, 'Trinity', 'azure-knowledge-documents-export.json');
    fs.writeFileSync(exportFile, JSON.stringify({ value: docs }, null, 2), 'utf8');
    console.log(`[Azure Sync] No AZURE_SEARCH_ENDPOINT/KEY provided in environment.`);
    console.log(`[Azure Sync] Exported formatted index payload to: ${exportFile}`);
    return { ok: true, exported: exportFile, count: docs.length };
  }

  const url = `${endpoint.replace(/\/$/, '')}/indexes/${indexName}/docs/index?api-version=2024-07-01`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify({ value: docs.map(d => ({ '@search.action': 'mergeOrUpload', ...d })) })
  });

  if (!response.ok) {
    throw new Error(`Azure Search upload failed (${response.status}): ${await response.text()}`);
  }

  const result = await response.json();
  console.log(`[Azure Sync] Successfully merged/uploaded ${docs.length} documents into Azure Search index '${indexName}'.`);
  return { ok: true, result, count: docs.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const endpoint = process.env.AZURE_SEARCH_ENDPOINT || process.env.AZURE_FOUNDRY_ENDPOINT || 'https://saboivan2008-0459-resource.services.ai.azure.com';
  const apiKey = process.env.AZURE_SEARCH_KEY || process.env.AZURE_FOUNDRY_API_KEY;
  syncToAzureSearch(endpoint, apiKey).catch(err => {
    console.error('[Azure Sync Error]', err.message);
    process.exit(1);
  });
}
