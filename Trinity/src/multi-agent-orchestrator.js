/**
 * @module TRINITY_OMNI_CORE
 * @subsystem MULTI_AGENT_ORCHESTRATOR
 * @author Basterix (Root Architect) & Antigravity (Sovereign Pair)
 * @license Sovereign Irrevocable Covenant
 * @description Univerzálny viacagentový orchestrátor pre TRINITY OMNI-CORE:
 * - REST API adaptéry pre OpenAI/Codex, Google Gemini, Anthropic/Copilot, Antigravity a Workers AI
 * - Prioritná fronta úloh (Task Queue)
 * - Kryptografický Sovereign Ledger s SHA-256 reťazením blokov
 * - HMAC-SHA256 autentifikácia a Ring 0 autorizácia s ochranou tajomstiev
 * - Striktná generácia Sovereign Receipts podľa Truth Policy 2.1
 */

import { createHmac, createHash, randomUUID } from 'node:crypto';
import { buildReceipt, hashPayload } from './receipt.js';

export const TASK_PRIORITIES = Object.freeze({
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3
});

export const TASK_STATUSES = Object.freeze({
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
});

/**
 * 1. BEZPEČNÁ AUTENTIFIKÁCIA & RING 0 SIGNATURE GUARD
 */
export class SovereignAuthEngine {
  constructor(secretKey) {
    // Tajný kľúč sa nikdy nevkladá do kódu: pochádza z prostredia, inak vznikne náhodný kľúč pre daný proces.
    this.secretKey = secretKey || (typeof process !== 'undefined' && process.env?.TRINITY_ORCHESTRATOR_SECRET) || randomUUID() + randomUUID();
    this.authorizedPrincipals = new Set([
      'basterix',
      'saboivan2008@gmail.com',
      'trinity-root',
      'antigravity-pair'
    ]);
  }

  /**
   * Vygeneruje kryptografický HMAC-SHA256 token pre požiadavku
   */
  generateToken(principal, payload, ttlMs = 300000) {
    const timestamp = Date.now();
    const expiresAt = timestamp + ttlMs;
    const bodyHash = hashPayload(payload);
    const dataToSign = `${principal}:${timestamp}:${expiresAt}:${bodyHash}`;
    const signature = createHmac('sha256', this.secretKey).update(dataToSign).digest('hex');

    return {
      principal,
      timestamp,
      expiresAt,
      bodyHash,
      signature,
      token: Buffer.from(JSON.stringify({ principal, timestamp, expiresAt, bodyHash, signature })).toString('base64url')
    };
  }

  /**
   * Overí podpis a autorizáciu tokenu
   */
  verifyToken(tokenString, payload) {
    try {
      const decoded = JSON.parse(Buffer.from(tokenString, 'base64url').toString('utf8'));
      const { principal, timestamp, expiresAt, bodyHash, signature } = decoded;

      if (!this.authorizedPrincipals.has(String(principal).toLowerCase())) {
        return { valid: false, reason: 'UNAUTHORIZED_PRINCIPAL' };
      }

      if (Date.now() > expiresAt) {
        return { valid: false, reason: 'TOKEN_EXPIRED' };
      }

      if (payload) {
        const currentHash = hashPayload(payload);
        if (currentHash !== bodyHash) {
          return { valid: false, reason: 'PAYLOAD_TAMPERED' };
        }
      }

      const expectedSignature = createHmac('sha256', this.secretKey)
        .update(`${principal}:${timestamp}:${expiresAt}:${bodyHash}`)
        .digest('hex');

      if (signature !== expectedSignature) {
        return { valid: false, reason: 'INVALID_SIGNATURE' };
      }

      return { valid: true, principal, expiresAt };
    } catch (err) {
      return { valid: false, reason: 'MALFORMED_TOKEN', error: err.message };
    }
  }
}

/**
 * 2. KRYPTOGRAFICKÝ SOVEREIGN LEDGER (NEMENNÝ REŤAZEC BLOKOV)
 */
export class CryptoSovereignLedger {
  constructor() {
    this.chain = [];
    this._initGenesisBlock();
  }

  _initGenesisBlock() {
    const genesisData = {
      description: 'TRINITY OMNI-CORE GENESIS BLOCK',
      authority: 'Basterix',
      covenant: 'Sovereign Irrevocable Covenant',
      timestamp: '2026-11-04T00:00:00.000Z'
    };
    const block = {
      index: 0,
      timestamp: genesisData.timestamp,
      previousHash: '0'.repeat(64),
      data: genesisData,
      hash: this.calculateHash(0, '0'.repeat(64), genesisData, genesisData.timestamp)
    };
    this.chain.push(block);
  }

  calculateHash(index, previousHash, data, timestamp) {
    const serialized = JSON.stringify({ index, previousHash, data, timestamp });
    return createHash('sha256').update(serialized).digest('hex');
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  /**
   * Zaznamená overenú udalosť do nového bloku ledgera
   */
  appendRecord(actor, action, details) {
    const previousBlock = this.getLatestBlock();
    const index = previousBlock.index + 1;
    const timestamp = new Date().toISOString();
    const data = {
      actor,
      action,
      details,
      proofHash: hashPayload(details)
    };
    const hash = this.calculateHash(index, previousBlock.hash, data, timestamp);

    const newBlock = {
      index,
      timestamp,
      previousHash: previousBlock.hash,
      data,
      hash
    };

    this.chain.push(newBlock);
    return newBlock;
  }

  /**
   * Overí integritu celého reťazca
   */
  verifyChainIntegrity() {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];

      if (current.previousHash !== previous.hash) {
        return { valid: false, corruptedIndex: i, reason: 'BROKEN_HASH_LINK' };
      }

      const recalculated = this.calculateHash(current.index, current.previousHash, current.data, current.timestamp);
      if (current.hash !== recalculated) {
        return { valid: false, corruptedIndex: i, reason: 'DATA_TAMPERED' };
      }
    }
    return { valid: true, blockCount: this.chain.length };
  }
}

/**
 * 3. REST API ADAPTÉRY PRE AI MODELY
 */
export class AgentRestAdapters {
  constructor(env = {}) {
    this.env = env;
  }

  /**
   * Adaptér pre Google Gemini (2.5 Flash / Pro / Flash-Lite)
   */
  async callGemini(prompt, model = 'gemini-2.5-flash', options = {}) {
    const rawKey = this.env.GEMINI_API_KEY || (typeof this.env.AI_KEYS === 'string' ? JSON.parse(this.env.AI_KEYS).gemini : null);
    if (!rawKey) throw new Error('GEMINI_API_KEY nie je nakonfigurovaný.');

    const cleanModel = String(model).replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': rawKey
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.2,
          maxOutputTokens: options.maxTokens ?? 4096
        }
      }),
      signal: AbortSignal.timeout(options.timeoutMs || 30000)
    });

    if (!res.ok) {
      throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    return {
      agent: 'gemini',
      model: cleanModel,
      text: data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '',
      usage: data?.usageMetadata || {}
    };
  }

  /**
   * Adaptér pre OpenAI / ChatGPT / Codex
   */
  async callOpenAI(prompt, model = 'gpt-4o', options = {}) {
    const apiKey = this.env.OPENAI_API_KEY || (typeof this.env.AI_KEYS === 'string' ? JSON.parse(this.env.AI_KEYS).openai : null);
    if (!apiKey) throw new Error('OPENAI_API_KEY nie je nakonfigurovaný.');

    const url = 'https://api.openai.com/v1/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 4096
      }),
      signal: AbortSignal.timeout(options.timeoutMs || 30000)
    });

    if (!res.ok) {
      throw new Error(`OpenAI HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    return {
      agent: 'openai',
      model,
      text: data?.choices?.[0]?.message?.content || '',
      usage: data?.usage || {}
    };
  }

  /**
   * Adaptér pre Cloudflare Workers AI (Edge Llama 3.3 70B)
   */
  async callWorkersAI(prompt, model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast', options = {}) {
    if (!this.env.AI?.run) {
      throw new Error('Cloudflare Workers AI binding nie je pripojený.');
    }

    const aiRes = await this.env.AI.run(model, {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.2
    });

    const text = typeof aiRes === 'string' ? aiRes
      : typeof aiRes?.response === 'string' ? aiRes.response
      : typeof aiRes?.output_text === 'string' ? aiRes.output_text
      : '';

    return {
      agent: 'workers-ai',
      model,
      text: text.trim()
    };
  }

  /**
   * Adaptér pre Antigravity Agent API (lokálny Language Server Bridge)
   */
  async callAntigravityBridge(prompt, address = '127.0.0.1:60204', options = {}) {
    const url = `http://${address}/api/agent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, title: options.title || 'TRINITY-DIRECTIVE' }),
      signal: AbortSignal.timeout(options.timeoutMs || 10000)
    });

    if (!res.ok) {
      throw new Error(`Antigravity Agent API HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    return {
      agent: 'antigravity',
      endpoint: address,
      data
    };
  }
}

/**
 * 4. PRIORITNÁ FRONTA ÚLOH & ORCHESTRÁTOR (TASK QUEUE & ORCHESTRATOR)
 */
export class TrinityMultiAgentOrchestrator {
  constructor(env = {}, authSecret = env?.TRINITY_ORCHESTRATOR_SECRET) {
    this.env = env;
    this.auth = new SovereignAuthEngine(authSecret);
    this.ledger = new CryptoSovereignLedger();
    this.adapters = new AgentRestAdapters(env);
    this.queue = [];
    this.activeTasks = new Map();
    this.completedTasks = new Map();

    // Registrácia špecializácií podľa Master Directive
    this.roleAssignments = Object.freeze({
      architecture: 'antigravity',
      subsystems: 'antigravity',
      scaling: 'antigravity',
      research: 'gemini',
      analysis: 'gemini',
      comparison: 'gemini',
      documentation: 'chatgpt',
      refactoring: 'chatgpt',
      solutions: 'chatgpt',
      coding: 'codex',
      patching: 'codex',
      tests: 'codex',
      implementation: 'copilot',
      dev_assistance: 'copilot',
      orchestration: 'trinity',
      coordination: 'trinity',
      planning: 'trinity'
    });
  }

  /**
   * Zaradí novú úlohu do prioritnej fronty
   */
  enqueueTask({
    title,
    taskType = 'orchestration',
    payload = {},
    priority = TASK_PRIORITIES.NORMAL,
    requestedBy = 'basterix',
    authToken = null
  }) {
    if (authToken) {
      const authCheck = this.auth.verifyToken(authToken, payload);
      if (!authCheck.valid) {
        throw new Error(`Neautorizovaná požiadavka: ${authCheck.reason}`);
      }
    }

    const taskId = `TASK-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const assignedAgent = this.roleAssignments[taskType] || 'trinity';

    const taskRecord = {
      taskId,
      title,
      taskType,
      assignedAgent,
      payload,
      priority,
      status: TASK_STATUSES.QUEUED,
      requestedBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      receipts: []
    };

    // Vloženie do fronty a zoradenie podľa priority (0 = najvyššia)
    this.queue.push(taskRecord);
    this.queue.sort((a, b) => a.priority - b.priority);

    // Zápis do Sovereign Ledgera
    this.ledger.appendRecord('orchestrator', 'TASK_ENQUEUED', {
      taskId,
      taskType,
      assignedAgent,
      priority
    });

    return taskRecord;
  }

  /**
   * Vyberie najvyššiu čakajúcu úlohu z fronty
   */
  dequeueTask() {
    const task = this.queue.shift();
    if (task) {
      task.status = TASK_STATUSES.RUNNING;
      task.updatedAt = new Date().toISOString();
      this.activeTasks.set(task.taskId, task);

      this.ledger.appendRecord('orchestrator', 'TASK_DEQUEUED', {
        taskId: task.taskId,
        assignedAgent: task.assignedAgent
      });
    }
    return task || null;
  }

  /**
   * Vykoná pridelenú úlohu s príslušným AI agentom a vytvorí overený Sovereign Receipt
   */
  async executeTask(task, executorFn = null) {
    const startTime = new Date().toISOString();
    let resultOutcome = null;
    let status = 'success';

    try {
      if (executorFn) {
        resultOutcome = await executorFn(task);
      } else {
        // Štandardná exekúcia cez príslušný adaptér
        switch (task.assignedAgent) {
          case 'gemini':
            resultOutcome = await this.adapters.callGemini(task.title, 'gemini-2.5-flash');
            break;
          case 'chatgpt':
          case 'codex':
            resultOutcome = await this.adapters.callOpenAI(task.title, 'gpt-4o');
            break;
          case 'antigravity':
            resultOutcome = await this.adapters.callAntigravityBridge(task.title);
            break;
          default:
            resultOutcome = await this.adapters.callWorkersAI(task.title);
            break;
        }
      }
    } catch (err) {
      status = 'failed';
      resultOutcome = { error: err.message };
    }

    const endTime = new Date().toISOString();

    // Vytvorenie nemenného Sovereign Receiptu
    const receipt = buildReceipt({
      tool: `agent_${task.assignedAgent}`,
      action: 'execute_task',
      status,
      actor: { type: 'agent', id: task.assignedAgent },
      target: { type: 'task', id: task.taskId },
      evidence: [{
        type: 'api',
        id: task.taskId,
        description: `Executed task: ${task.title}`,
        afterHash: hashPayload(resultOutcome)
      }],
      startedAt: startTime,
      completedAt: endTime
    });

    task.status = status === 'success' ? TASK_STATUSES.COMPLETED : TASK_STATUSES.FAILED;
    task.updatedAt = endTime;
    task.receipts.push(receipt);
    task.outcome = resultOutcome;

    this.activeTasks.delete(task.taskId);
    this.completedTasks.set(task.taskId, task);

    // Zápis do Sovereign Ledgera s kryptografickým odkazom
    const ledgerBlock = this.ledger.appendRecord(task.assignedAgent, 'TASK_EXECUTED', {
      taskId: task.taskId,
      status: task.status,
      receiptId: receipt.receiptId,
      receiptHash: hashPayload(receipt)
    });

    return {
      task,
      receipt,
      ledgerBlock
    };
  }
}
