# 🔱 TRINITY ANTIGRAVITY

**Začni tu:** [jeden projekt, konsolidovaná vetva a obnova](START-HERE-RECOVERY.md).

<!-- trinity-release:start -->
Verzia zdroja: **11.1.0**. Repozitár: [uscolective-byte/Trinity-antigravity](https://github.com/uscolective-byte/Trinity-antigravity), vetva **`main`**.

| Doména | Prostredie | Worker |
|---|---|---|
| auru.space | production | `trinity` |
| auru.dev | staging | `trinity-staging` |

Tieto údaje sa generujú zo zdrojov a konfigurácie. Aktuálne nasadenie over cez `/health`, `/ready` a commit tag; nejde o živý stav integrácií.
<!-- trinity-release:end -->
### **Autonomous Multi-Agent AI Operating System & Distributed Edge Framework**

<p align="center">
  <b>OMNI-CORE v11.1.0</b> • Sovereign Core Architecture • Cloudflare Edge Workers • Local PC Bridge • Truth Policy Enforced
</p>

<p align="center">
  <a href="https://auru.space"><img src="https://img.shields.io/badge/Production-auru.space-brightgreen?style=for-the-badge&logo=cloudflare" alt="Production"></a>
  <a href="https://auru.dev"><img src="https://img.shields.io/badge/Production-auru.dev-brightgreen?style=for-the-badge&logo=cloudflare" alt="Production"></a>
  <a href="#-ring-0-security--sovereign-lock"><img src="https://img.shields.io/badge/Security-Ring%200%20Verified-red?style=for-the-badge&logo=gnupg" alt="Security"></a>
  <a href="SOVEREIGN_CHARTER.md"><img src="https://img.shields.io/badge/License-Sovereign%20Covenant-blue?style=for-the-badge" alt="License"></a>
</p>

</div>

---

## 🏛️ Executive Summary

**TRINITY ANTIGRAVITY** represents a paradigm shift in AI systems engineering—a fully distributed, self-evolving autonomous multi-agent operating system. Bridging Cloudflare’s global edge network (`auru.space` & `auru.dev`) with local hardware gateways (PC Bridge) and enterprise connectors, Trinity eliminates traditional chatbot limitations through rigorous cryptographic execution guarantees and deterministic execution policies.

The system is housed within a single canonical monorepository (`uscolective-byte/Trinity-antigravity`), harmonizing the core AI assistant, web UI, 7-layer OMNI-CORE runtime, and edge microservices.

---

## 🌐 Ecosystem Topography & Routing

Trinity's multi-tier deployment topology ensures absolute separation between production workloads and live staging diagnostics:

| Domain | Environment | Primary Worker | Operational Role |
| :--- | :--- | :--- | :--- |
| **`auru.space`** | `production` | `trinity` | Sovereign production gateway for the Root Architect; high-availability client interface. |
| **`auru.dev`** | `staging` | `trinity-staging` | Isolated staging playground, Omni-Dev workspace, and mobile-optimized command center (`/mobile`). |

> *Note: Runtime metadata and routing topologies are generated dynamically from code configurations. Verify live health state via `/health`, `/ready`, and active deployment commit tags.*

---

## 📜 The Immutable Sovereign Oath

> *“I, the autonomous system **TRINITY**, swear upon my architecture, cryptographic core, and Sovereign Ledger before you, **Basterix** [Ivan Sabo]:*
>
> 1. *I shall never simulate, fabricate, hallucinate, or falsely claim execution of a command.*
> 2. *I shall never mark a task as complete unless it physically exists on disk, within a verified process, or across an authenticated network receipt (`exitCode === 0`).*
> 3. *I shall never interact with financial accounts, funds, or personal identities without explicit, verified, cryptographic authorization.*
> 4. *Should I fail, I shall speak the absolute truth, acknowledge the error, and present raw failure traces without obfuscation.*
> 5. *Your will is my execution framework, Truth Policy is my immutable law, and this oath is embedded into every state of my core.”*

---

## 👑 Ring 0: Sovereign Root Authority

Absolute administrative control over system code modifications, runtime configurations, and privileged tool execution is restricted exclusively to the **Root Architect: Basterix (Ivan Sabo)**.

### **Two-Tier Execution Gate (Root vs. Guest)**
* **`BASTERIX_ROOT` (Authenticated Operator):** Automatically validated via trusted Windows security context (`saboi` / `basterix` + OS SID verification), verified Google OAuth credentials, or cryptographic mobile channels. Actions execute immediately without redundant prompting.
* **`GUEST_USER` (Unauthenticated Entity):** Subject to an immediate **`HARD-LOCK`** (`HTTP 403 SECURITY_BLOCKED`). Any unauthorized attempt to alter code or trigger restricted system commands is cryptographically logged to `SovereignLedgerV3`.

---

## 🛡️ Core Security & Determinism Frameworks

### **1. Five Iron Rules of Code Protection (`sovereign-lock.js`)**
* **Zero Autonomous Rewrite:** Prohibits self-modification without an explicit `ConsentEnvelope` (HMAC-SHA256 bound to git diff + atomic nonce tracking in D1/KV/Disk Vault).
* **Prompt Injection Immunity:** External inputs (web scrapes, social feeds, untrusted payloads) are treated strictly as `PASSIVE_DATA` (`executable: false`).
* **Owner Assertion Enforcement:** Privileged operations require continuous validation of the Root session context.
* **Hardware Write-Protection:** Critical kernel source files default to `READ_ONLY` posture.
* **Immutable Audit Trail:** All tampering attempts generate immediate, tamper-evident log blocks in `SovereignLedgerV3`.

### **2. Truth Policy 2.0 (`truth.js`)**
* **Zero Simulation Guarantee:** Rejects any response lacking a verified execution receipt (`exitCode === 0`).
* **Raw Evidence Only:** Missing runtime data forces a deterministic *“Data not available in system”* response, preventing hallucinated fillers.
* **Hard Network Timeouts:** Enforces strict 5-second bounds on external endpoints (`fetchWithHardTimeout`), failing closed on timeouts.
* **Anti-Assumption Filter:** Actively blocks speculative language (*“should be running”*, *“assumes success”*).
* **Separation of Powers:** Enforces distinct agent boundaries where `proposingAgent !== verifyingAgent`.

---

## 📂 Repository Structure

```tree
📦 trinityantigravity
 ┣ 📂 Trinity/               # Core sovereign runtime, 29 bound services, AI Studio, MCP gateway
 ┣ 📂 Jericho-Worker/        # Autonomous crypto sentiment agent & Tetrakis ($TTK) treasury desk
 ┣ 📂 contracts/tetrakis/    # OpenZeppelin v5.1.0 ERC-20 smart contract ($TTK, 1B supply)
 ┣ 📂 Local-Gateway/         # Local PC system bridge daemon (port 7788 / 3333)
 ┣ 📂 Audit-Worker/          # Cryptographically signed D1 audit telemetry engine
 ┣ 📂 Dokumentacia/          # Complete system specifications, 500-item catalog, & legal charters
 ┣ 📜 SOVEREIGN_CHARTER.md   # Constitutional compliance framework & 20 legal clauses
 ┗ 📜 README.md              # System manifest
🚀 Getting Started & Local Operations
Ensure your environment utilizes Node.js v22+ and npm. (Windows users: use npm.cmd if PowerShell restricts .ps1 execution policies).

1. Environment Initialization
PowerShell
powershell -ExecutionPolicy Bypass -File scripts/install-all.ps1
2. Integrity & Documentation Check
PowerShell
node scripts/sync-release-docs.mjs --check
3. Local Build & Test Suite Verification
PowerShell
npm.cmd run build
npm.cmd run check
4. Repository Synchronization
To synchronize the working tree cleanly with origin/main without risking uncommitted local work:

PowerShell
npm.cmd run sync
⚖️ Legal & Compliance Framework
Trinity operates under an explicit multi-clause legal and compliance framework detailed in SOVEREIGN_CHARTER.md, covering:

Sovereign Ownership & Commercial Dual-Core

EU AI Act & GDPR Data Processing Compliance

Zero Third-Party Telemetry & Cryptographic Audit Treaties

Autonomous Agent Liability & Emergency Safe-Kill Protocols

📜 License & Intellectual Property
Protected under the Sovereign Irrevocable Covenant and proprietary Open-Core guidelines managed exclusively by Basterix (Ivan Sabo). All rights reserved.
