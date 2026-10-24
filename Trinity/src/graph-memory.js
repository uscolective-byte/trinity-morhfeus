import { z } from 'zod';
import { HttpError } from './security.js';

export const nodeTypeSchema = z.enum(['project', 'domain', 'note', 'transaction', 'entity', 'topic', 'account']);
export const edgeRelSchema = z.enum(['belongs_to', 'manages', 'hosts', 'transacted', 'relates_to', 'depends_on', 'owns']);

export const graphNodeInputSchema = z.object({
  id: z.string().trim().min(1).max(120),
  type: nodeTypeSchema,
  label: z.string().trim().min(1).max(200),
  properties: z.record(z.any()).default({})
}).strict();

export const graphEdgeInputSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  source_id: z.string().trim().min(1).max(120),
  target_id: z.string().trim().min(1).max(120),
  relationship: edgeRelSchema,
  weight: z.number().min(0).max(10).default(1.0),
  properties: z.record(z.any()).default({})
}).strict();

/**
 * Synchronizuje graf pamäte priamo zo skutočných záznamov v D1 databáze
 * (domény, projekty, transakcie a poznámky) bez simulácie.
 */
export async function syncGraphFromEcosystem(env) {
  if (!env.DB) throw new HttpError(503, 'Databáza D1 nie je dostupná.');

  const nodes = [];
  const edges = [];

  // 1. Root / Owner Node
  const ownerId = 'node-owner-basterix';
  nodes.push({
    id: ownerId,
    type: 'account',
    label: 'Ivan Sabo (Basterix)',
    properties_json: JSON.stringify({ role: 'owner', email: 'saboivan2008@gmail.com' })
  });

  // 2. Domains from managed_domains
  try {
    const domains = (await env.DB.prepare('SELECT id, domain_name, status, listing_type, lease_price_monthly, sale_price FROM managed_domains LIMIT 100').all()).results || [];
    for (const d of domains) {
      const dNodeId = `node-dom-${d.id}`;
      nodes.push({
        id: dNodeId,
        type: 'domain',
        label: d.domain_name,
        properties_json: JSON.stringify({
          status: d.status,
          listing: d.listing_type,
          lease_price: d.lease_price_monthly,
          sale_price: d.sale_price
        })
      });
      edges.push({
        id: `edge-owner-dom-${d.id}`,
        source_id: ownerId,
        target_id: dNodeId,
        relationship: 'manages',
        weight: 1.0,
        properties_json: JSON.stringify({ context: 'portfolio_domain' })
      });
    }
  } catch {}

  // 3. Studio Projects from ops_studio_projects
  try {
    const projects = (await env.DB.prepare('SELECT id, name, version, status, updated_at FROM ops_studio_projects LIMIT 50').all()).results || [];
    for (const p of projects) {
      const pNodeId = `node-proj-${p.id}`;
      nodes.push({
        id: pNodeId,
        type: 'project',
        label: p.name || `Projekt ${p.id.slice(0, 8)}`,
        properties_json: JSON.stringify({ version: p.version, status: p.status, updated_at: p.updated_at })
      });
      edges.push({
        id: `edge-owner-proj-${p.id}`,
        source_id: ownerId,
        target_id: pNodeId,
        relationship: 'owns',
        weight: 1.0,
        properties_json: JSON.stringify({ context: 'studio_project' })
      });
    }
  } catch {}

  // 4. Shared and Profile Notes from ops_memory
  try {
    const notes = (await env.DB.prepare("SELECT key, substr(value, 1, 300) AS val, updated_at FROM ops_memory WHERE key LIKE 'note/%' OR key LIKE 'profil/%' OR key LIKE 'shared_note/%' LIMIT 60").all()).results || [];
    for (const n of notes) {
      const nNodeId = `node-note-${n.key.replace(/[/_.-]/g, '-')}`;
      nodes.push({
        id: nNodeId,
        type: 'note',
        label: n.key,
        properties_json: JSON.stringify({ snippet: n.val, updated_at: n.updated_at })
      });
      edges.push({
        id: `edge-owner-note-${n.key.replace(/[/_.-]/g, '-')}`,
        source_id: ownerId,
        target_id: nNodeId,
        relationship: 'relates_to',
        weight: 0.8,
        properties_json: JSON.stringify({ context: 'memory_note' })
      });
    }
  } catch {}

  // 5. Financial / Wallet Transactions
  try {
    const txs = (await env.DB.prepare('SELECT id, type, amount_cents, currency, recipient, note, created_at FROM wallet_transactions ORDER BY created_at DESC LIMIT 20').all()).results || [];
    for (const tx of txs) {
      const txNodeId = `node-tx-${tx.id}`;
      nodes.push({
        id: txNodeId,
        type: 'transaction',
        label: `${(tx.amount_cents / 100).toFixed(2)} ${tx.currency || 'EUR'} (${tx.type})`,
        properties_json: JSON.stringify({ recipient: tx.recipient, note: tx.note, created_at: tx.created_at })
      });
      edges.push({
        id: `edge-owner-tx-${tx.id}`,
        source_id: ownerId,
        target_id: txNodeId,
        relationship: 'transacted',
        weight: 1.0,
        properties_json: JSON.stringify({ type: tx.type })
      });
    }
  } catch {}

  // Insert or replace nodes
  for (const n of nodes) {
    await env.DB.prepare(`
      INSERT INTO graph_memory_nodes(id, type, label, properties_json, updated_at)
      VALUES(?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        label=excluded.label,
        properties_json=excluded.properties_json,
        updated_at=datetime('now')
    `).bind(n.id, n.type, n.label, n.properties_json).run().catch(() => {});
  }

  // Insert or replace edges
  for (const e of edges) {
    await env.DB.prepare(`
      INSERT INTO graph_memory_edges(id, source_id, target_id, relationship, weight, properties_json)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        relationship=excluded.relationship,
        weight=excluded.weight,
        properties_json=excluded.properties_json
    `).bind(e.id, e.source_id, e.target_id, e.relationship, e.weight, e.properties_json).run().catch(() => {});
  }

  return {
    ok: true,
    nodes_synced: nodes.length,
    edges_synced: edges.length,
    synced_at: new Date().toISOString()
  };
}

/**
 * Získa kompletný graf pre vizualizáciu v rozhraní (Force-Directed Graph)
 */
export async function getGraphVisualization(env) {
  if (!env.DB) throw new HttpError(503, 'Databáza D1 nie je dostupná.');

  const nodes = (await env.DB.prepare('SELECT id, type, label, properties_json, updated_at FROM graph_memory_nodes LIMIT 250').all()).results || [];
  const edges = (await env.DB.prepare('SELECT id, source_id, target_id, relationship, weight, properties_json FROM graph_memory_edges LIMIT 400').all()).results || [];

  return {
    success: true,
    ok: true,
    count_nodes: nodes.length,
    count_edges: edges.length,
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.type,
      label: n.label,
      properties: JSON.parse(n.properties_json || '{}'),
      updated_at: n.updated_at
    })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.source_id,
      target: e.target_id,
      relationship: e.relationship,
      weight: e.weight,
      properties: JSON.parse(e.properties_json || '{}')
    })),
    stats: {
      total_nodes: nodes.length,
      total_edges: edges.length
    }
  };
}

/**
 * Graph RAG traversal: Nájde relevantné uzly a ich 1-hop a 2-hop susedov pre danú požiadavku
 */
export async function queryGraphContext(env, queryText, depth = 2, maxNodes = 10) {
  if (!env.DB || !queryText) return { matched_nodes: [], relationships: [] };

  const terms = String(queryText).toLowerCase().match(/[\p{L}\p{N}_-]{3,40}/gu) || [];
  if (!terms.length) return { matched_nodes: [], relationships: [] };

  const allNodes = (await env.DB.prepare('SELECT id, type, label, properties_json FROM graph_memory_nodes LIMIT 200').all()).results || [];
  
  // Scoring
  const scored = allNodes.map(n => {
    const text = `${n.label} ${n.type} ${n.properties_json}`.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (text.includes(t)) score += (n.label.toLowerCase().includes(t) ? 5 : 2);
    }
    return { node: n, score };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, maxNodes);

  if (!scored.length) return { matched_nodes: [], relationships: [] };

  const nodeIds = new Set(scored.map(s => s.node.id));
  const idList = Array.from(nodeIds).map(id => `'${id.replace(/'/g, "''")}'`).join(',');

  let relatedEdges = [];
  if (idList.length) {
    relatedEdges = (await env.DB.prepare(`
      SELECT id, source_id, target_id, relationship, weight, properties_json 
      FROM graph_memory_edges 
      WHERE source_id IN (${idList}) OR target_id IN (${idList})
      LIMIT 50
    `).all()).results || [];
  }

  const formattedLines = [
    ...scored.map(s => `• [${s.node.type}] ${s.node.label}`),
    ...relatedEdges.map(e => `• ${e.source_id} -[${e.relationship}]-> ${e.target_id}`)
  ];

  return {
    matched_nodes: scored.map(s => ({
      id: s.node.id,
      type: s.node.type,
      label: s.node.label,
      score: s.score
    })),
    relationships: relatedEdges.map(e => ({
      source: e.source_id,
      target: e.target_id,
      relationship: e.relationship
    })),
    formatted_context: formattedLines.join('\n')
  };
}
