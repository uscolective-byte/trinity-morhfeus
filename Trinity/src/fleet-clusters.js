/**
 * @module TRINITY_FLEET_CLUSTERS
 * @description Architektúra rozdelenia flotily 47 Cloudflare Workerov do 6 funkčných klastrov (Ring 0 Sovereign Lock).
 */

export const TRINITY_FLEET_CLUSTERS = [
  {
    cluster_id: "01",
    name: "Core & Routing",
    range: "#01 – #06",
    responsibility: "Fast-Chat router, TAP Gatekeeper, SSE Streamer, Domain Dispatcher",
    bindings: ["KV (SESSION_STORE / TRINITY_KV)", "Service Bindings"],
    workers: [
      { number: 1, name: "trinity", alias: "trinity-gateway", role: "Fast-Chat Edge Router & TAP Gatekeeper (Prod auru.space)" },
      { number: 2, name: "trinity-staging", role: "Staging Omni-Dev Edge Gateway (auru.dev)" },
      { number: 3, name: "trinity-core", role: "Core Kernel & Sovereign State Coordinator" },
      { number: 4, name: "trinity-dispatcher", role: "Domain & Task Dispatcher" },
      { number: 5, name: "trinity-builder", role: "Edge Build & Artifact Streamer" },
      { number: 6, name: "trinity-connectors", role: "External Protocol & Service Connector Router" }
    ]
  },
  {
    cluster_id: "02",
    name: "Cognition & AI Engine",
    range: "#07 – #15",
    responsibility: "Workers AI kaskáda (Llama 70B, DeepSeek-R1, 8B), Vectorize pamäť, RAG syntéza",
    bindings: ["AI", "Vectorize (trinity-embeddings / trinity-vector-index)", "R2"],
    workers: [
      { number: 7, name: "trinity-chat-inference", role: "3-Tier LLM Inference Cascade & Circuit Breaker" },
      { number: 8, name: "trinity-knowledge", role: "Vectorize RAG & Knowledge Synthesis" },
      { number: 9, name: "trinity-memory", role: "Episodic & Semantic Memory Engine" },
      { number: 10, name: "trinity-gemini", role: "Google Gemini Interactions & Multimodal Bridge" },
      { number: 11, name: "trinity-agent-researcher", role: "Deep Research & Evidence Synthesis Agent" },
      { number: 12, name: "trinity-chat-maintainer", role: "Context Window & Conversation Hygiene Worker" },
      { number: 13, name: "aura_analyzer", role: "Aura Semantic & AST Analyzer" },
      { number: 14, name: "aura_architect", role: "Aura System Architecture Planner" },
      { number: 15, name: "aura_memory", role: "Aura Vector Memory Synchronizer" }
    ]
  },
  {
    cluster_id: "03",
    name: "Security & Ring 0",
    range: "#16 – #22",
    responsibility: "Autentifikácia kľúčov, D1 Audit Ledger, TAP token rotation, Leak Filter",
    bindings: ["D1 (audit_logs)", "WebCrypto RSASSA-PKCS1-v1_5"],
    workers: [
      { number: 16, name: "trinity-guardian", role: "Ring 0 Security Gate & Policy Enforcer" },
      { number: 17, name: "trinity-sentinel", role: "Anomaly Detection & Intrusion Shield" },
      { number: 18, name: "trinity-audit", role: "Asynchronous D1 Audit Ledger & Receipt Verifier" },
      { number: 19, name: "trinityguardiantruthverifierworker", role: "Truth Policy 2.1 Cryptographic Receipt Verifier" },
      { number: 20, name: "aura_sentinel", role: "Aura Perimeter & Leak Filter Sentinel" },
      { number: 21, name: "aura_tester", role: "Adversarial Security & Contract Tester" },
      { number: 22, name: "trinity-capacity", role: "Rate Limiting, Quota & Circuit Protection" }
    ]
  },
  {
    cluster_id: "04",
    name: "Financial & Krypto",
    range: "#23 – #28",
    responsibility: "Jericho123 orákulum, Tetrakis ($TTK) trezor, transakčná validácia",
    bindings: ["D1 (crypto_ledger / tetrakis_vaults)", "KV (price_cache)"],
    workers: [
      { number: 23, name: "aura_optimizer", role: "Quant & Resource Execution Optimizer" },
      { number: 24, name: "aura_planner", role: "Financial & Strategic Execution Planner" },
      { number: 25, name: "trinity-seeder", role: "D1 Ledger & Market State Seeder" },
      { number: 26, name: "jericho123", role: "Consensus Crypto Oracle (Binance/Coinbase Median) & Tetrakis ($TTK) Vaults" },
      { number: 27, name: "chanfana-openapi-template", role: "OpenAPI Financial & Settlement Schema Gateway" },
      { number: 28, name: "saas-admin-template", role: "Treasury & Merchant Administration Portal" }
    ]
  },
  {
    cluster_id: "05",
    name: "Autonomy & Agents",
    range: "#29 – #38",
    responsibility: "Agent Morpheus (sociálne siete), Desktop Bridge, Tool Executor, Cron watchdogs",
    bindings: ["KV", "D1", "External Webhooks", "Cloudflared Tunnel (agent.auru.dev)"],
    workers: [
      { number: 29, name: "trinity-morhfeus", role: "Autonomous Agent Morpheus & Social/External Orchestrator" },
      { number: 30, name: "trinity-pc-bridge", role: "Cloud-to-Local PC Bridge v1" },
      { number: 31, name: "trinity-pc-bridge-v2", role: "Zero-Footprint Desktop Commander Bridge v2" },
      { number: 32, name: "trinity-skills", role: "Dynamic Skill Matrix & Tool Executor" },
      { number: 33, name: "trinity-integrations", role: "External Webhooks, GitHub, Firecrawl & Workspace Integrations" },
      { number: 34, name: "trinity-ops", role: "Cron Watchdogs & 5-Min Desktop Commander Heartbeat" },
      { number: 35, name: "trinity-deployer", role: "Autonomous Worker & Domain Deployment Agent" },
      { number: 36, name: "aura_codegen", role: "Autonomous Code Synthesis Worker" },
      { number: 37, name: "aura_deployer", role: "Aura Continuous Deployment Worker" },
      { number: 38, name: "aura_evolver", role: "Self-Evolution & Mutation Proposal Worker" }
    ]
  },
  {
    cluster_id: "06",
    name: "System & Profile",
    range: "#39 – #47",
    responsibility: "Profilový manažér (#47), Telemetria, Canary Deploy, System Health",
    bindings: ["D1 (trinity-v03 / trinity-development)", "KV (TRINITY_KV_PROD / TRINITY_KV_STAGING)"],
    workers: [
      { number: 39, name: "muddy-wind-42e2", role: "Canary Edge Telemetry Node A" },
      { number: 40, name: "my-react-app", role: "Edge UI & Component Sandbox" },
      { number: 41, name: "noisy-hat-011e", role: "Canary Edge Telemetry Node B" },
      { number: 42, name: "react-router-starter-templates", role: "SSR Routing & Edge App Template" },
      { number: 43, name: "small-pine-596d", role: "Canary Edge Telemetry Node C" },
      { number: 44, name: "snowy-fire-3605", role: "Canary Edge Telemetry Node D" },
      { number: 45, name: "vite-react-template", role: "Vite Edge Asset Preview Worker A" },
      { number: 46, name: "vite-react-templates", role: "Vite Edge Asset Preview Worker B" },
      { number: 47, name: "trinity-profile", role: "ProfileMaker (#47) — Ring 0 TAP Keys, RS256 JWT & D1 Profiles" }
    ]
  }
];

export function getFleetClusterSummary() {
  const totalWorkers = TRINITY_FLEET_CLUSTERS.reduce((sum, c) => sum + c.workers.length, 0);
  return {
    architecture: "TRINITY_OMNI_CORE_v11.2.0",
    total_clusters: TRINITY_FLEET_CLUSTERS.length,
    total_workers: totalWorkers,
    clusters: TRINITY_FLEET_CLUSTERS
  };
}
