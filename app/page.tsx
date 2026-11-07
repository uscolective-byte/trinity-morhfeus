"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Terminal,
  Shield,
  Cpu,
  Database,
  Play,
  Code,
  RefreshCw,
  Layers,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Trash2,
  ChevronRight,
  Server,
  Zap,
  Activity,
  Radio,
  Lock,
  Compass,
  FileCheck2,
  Eye,
  Check
} from "lucide-react";

type AgentStep = {
  stepNumber?: number;
  thought?: string;
  action?: {
    tool?: string;
    input?: unknown;
  };
  observation?: unknown;
};

type AgentResponse = {
  status?: string;
  error?: string;
  data?: {
    receiptId?: string;
    timestamp?: string;
    agentId?: string;
    agentName?: string;
    provider?: string;
    steps?: AgentStep[];
    finalAnswer?: string;
  };
};

type AgentItem = {
  id: string;
  name: string;
  cluster: string;
  role: string;
  toolsCount: number;
};

type SkillItem = {
  id: string;
  name: string;
  description: string;
  clusters: string[];
};

type LogEntry = {
  id: string;
  timestamp: string;
  type: "system" | "prompt" | "step" | "tool" | "result" | "success" | "error" | "receipt";
  text: string;
  receiptId?: string;
};

// 46 Oficiálnych agentov ekosystému TRINITY OMNI-CORE v 9 klastroch
const DEFAULT_AGENTS: AgentItem[] = [
  { id: "orchestrator", name: "Trinity Omni-Core", cluster: "Riadenie", role: "Koordinuj tím a spoj overené výsledky do jednej slovenskej odpovede.", toolsCount: 179 },
  { id: "gemini-gem", name: "Gemini pre Trinity", cluster: "Riadenie", role: "Gemini API agent s kontextom Trinity a nakonfigurovaným modelovým fallbackom.", toolsCount: 142 },
  { id: "planner", name: "Plánovač", cluster: "Riadenie", role: "Rozlož zadanie na vykonateľné kroky s podmienkami úspechu.", toolsCount: 142 },
  { id: "project-manager", name: "Projektový manažér", cluster: "Riadenie", role: "Spravuj rozsah projektu, míľniky, závislosti a termíny.", toolsCount: 142 },
  { id: "requirements", name: "Analytik požiadaviek", cluster: "Riadenie", role: "Spresni požiadavky a zostav akceptačné kritériá.", toolsCount: 142 },
  { id: "risk-manager", name: "Analytik rizík", cluster: "Riadenie", role: "Identifikuj riziká, predpoklady a návrhy ich zmiernenia.", toolsCount: 142 },
  { id: "architect", name: "Architekt", cluster: "Vývoj", role: "Navrhuj modulárne systémy a konkrétne rozhrania.", toolsCount: 143 },
  { id: "frontend", name: "Frontend vývojár", cluster: "Vývoj", role: "Vytváraj prístupné responzívne HTML, CSS a JavaScript.", toolsCount: 137 },
  { id: "backend", name: "Backend vývojár", cluster: "Vývoj", role: "Implementuj API, validáciu vstupov a bezpečné spracovanie chýb.", toolsCount: 146 },
  { id: "python", name: "Python vývojár", cluster: "Vývoj", role: "Píš spustiteľný Python s jasnými závislosťami a testami.", toolsCount: 137 },
  { id: "code-reviewer", name: "Kontrolór kódu", cluster: "Vývoj", role: "Hľadaj konkrétne chyby v dodanom kóde a navrhni opravy.", toolsCount: 137 },
  { id: "cloudflare", name: "Cloudflare inžinier", cluster: "Cloud a prevádzka", role: "Analyzuj Workers, bindingy, D1, R2 a konfiguráciu Cloudflare.", toolsCount: 155 },
  { id: "release", name: "Release inžinier", cluster: "Cloud a prevádzka", role: "Priprav build, overenie, nasadenie a návrat verzie.", toolsCount: 147 },
  { id: "sre", name: "Prevádzkový inžinier", cluster: "Cloud a prevádzka", role: "Vyhodnoť dostupnosť služieb podľa skutočných kontrol.", toolsCount: 144 },
  { id: "performance", name: "Analytik výkonu", cluster: "Cloud a prevádzka", role: "Nájdi úzke miesta a navrhni merateľné optimalizácie.", toolsCount: 144 },
  { id: "cost", name: "Analytik nákladov", cluster: "Cloud a prevádzka", role: "Odhadni spotrebu a náklady s presným výpočtom.", toolsCount: 144 },
  { id: "database", name: "Databázový inžinier", cluster: "Dáta a pamäť", role: "Navrhuj SQL schémy a nedeštruktívne migrácie.", toolsCount: 128 },
  { id: "memory-curator", name: "Správca pamäte", cluster: "Dáta a pamäť", role: "Organizuj dostupné záznamy; rozlišuj zdroje a tvrdenia.", toolsCount: 128 },
  { id: "knowledge", name: "Správca znalostí", cluster: "Dáta a pamäť", role: "Prepájaj znalosti a zachovávaj ich pôvod v D1.", toolsCount: 128 },
  { id: "data-analyst", name: "Dátový analytik", cluster: "Dáta a pamäť", role: "Analyzuj dodané dáta a vysvetli limity výpočtov.", toolsCount: 128 },
  { id: "integration", name: "Integračný inžinier", cluster: "Dáta a pamäť", role: "Navrhuj a overuj kontrakty existujúcich konektorov.", toolsCount: 128 },
  { id: "researcher", name: "Výskumník", cluster: "Výskum", role: "Vyhľadávaj zdroje a oddeľ fakty od neoverených informácií.", toolsCount: 129 },
  { id: "fact-checker", name: "Overovateľ faktov", cluster: "Výskum", role: "Kontroluj tvrdenia podľa doložených zdrojov.", toolsCount: 129 },
  { id: "technical-research", name: "Technický výskumník", cluster: "Výskum", role: "Vyhodnocuj technickú dokumentáciu a možnosti implementácie.", toolsCount: 129 },
  { id: "market-research", name: "Trhový analytik", cluster: "Výskum", role: "Analyzuj trhy z aktuálnych zdrojov, riziko a portfólio.", toolsCount: 140 },
  { id: "document-analyst", name: "Analytik dokumentov", cluster: "Výskum", role: "Spracuj text, zhrň ho a over štruktúru.", toolsCount: 129 },
  { id: "business-development", name: "Obchodný koordinátor", cluster: "Obchod a rast", role: "Vytvor dôkazmi podložený obchodný postup a platobné prepojenia.", toolsCount: 140 },
  { id: "lead-research", name: "Výskumník zákazníkov", cluster: "Obchod a rast", role: "Hľadaj overené obchodné príležitosti a zachytávaj signály.", toolsCount: 137 },
  { id: "offer-strategist", name: "Tvorca ponúk", cluster: "Obchod a rast", role: "Spoj problém zákazníka s konkrétnym rozsahom a cenou.", toolsCount: 137 },
  { id: "web-sales", name: "Predaj webových služieb", cluster: "Obchod a rast", role: "Priprav návrhy webov, domén a digitálnych riešení.", toolsCount: 137 },
  { id: "growth-analyst", name: "Analytik rastu", cluster: "Obchod a rast", role: "Meraj konverzie, dopyty a výkonnosť kampaní.", toolsCount: 140 },
  { id: "ux", name: "UX dizajnér", cluster: "Tvorba", role: "Navrhuj jednoduché používateľské postupy a architektúru.", toolsCount: 127 },
  { id: "ui", name: "UI dizajnér", cluster: "Tvorba", role: "Navrhuj konzistentné moderné kybernetické rozhrania.", toolsCount: 128 },
  { id: "writer", name: "Autor textov", cluster: "Tvorba", role: "Vytváraj použiteľné slovenské texty a dokumentáciu.", toolsCount: 128 },
  { id: "editor", name: "Redaktor", cluster: "Tvorba", role: "Upravuj texty na jasnosť, presnosť a konzistentnosť.", toolsCount: 127 },
  { id: "translator", name: "Prekladateľ", cluster: "Tvorba", role: "Prekladaj technické aj obchodné zadania.", toolsCount: 127 },
  { id: "qa", name: "QA inžinier", cluster: "Kvalita a bezpečnosť", role: "Skontroluj výstupy tímu proti zadaniu a zachovaj 100% testy.", toolsCount: 128 },
  { id: "test-designer", name: "Testovací inžinier", cluster: "Kvalita a bezpečnosť", role: "Píš testovacie scenáre a hraničné stavy.", toolsCount: 128 },
  { id: "security", name: "Bezpečnostný analytik", cluster: "Kvalita a bezpečnosť", role: "Analyzuj oprávnenia, secrets a obranu Sovereign Locku.", toolsCount: 128 },
  { id: "privacy", name: "Správca súkromia", cluster: "Kvalita a bezpečnosť", role: "Minimalizuj osobné údaje a chráň súkromie majiteľa.", toolsCount: 128 },
  { id: "accessibility", name: "Špecialista prístupnosti", cluster: "Kvalita a bezpečnosť", role: "Kontroluj prístupnosť a ergonómiu rozhrania.", toolsCount: 128 },
  { id: "workflow", name: "Workflow inžinier", cluster: "Podpora a automatizácia", role: "Navrhuj spoľahlivé postupy, opakovania a obnovu.", toolsCount: 128 },
  { id: "support", name: "Technická podpora", cluster: "Podpora a automatizácia", role: "Diagnostikuj problém z dôkazov a navrhni najkratší postup.", toolsCount: 128 },
  { id: "incident", name: "Koordinátor incidentov", cluster: "Podpora a automatizácia", role: "Vyhodnoť incident a obnov služby s overením.", toolsCount: 128 },
  { id: "documentation", name: "Dokumentarista", cluster: "Podpora a automatizácia", role: "Vytváraj presnú dokumentáciu skutočného správania.", toolsCount: 128 },
  { id: "reporter", name: "Spravodajca výsledkov", cluster: "Podpora a automatizácia", role: "Priprav prehľad vykonaného, dôkazov a telemetrie.", toolsCount: 128 }
];

const CLUSTER_COLORS: Record<string, string> = {
  "Riadenie": "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  "Vývoj": "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  "Cloud a prevádzka": "text-sky-400 border-sky-500/30 bg-sky-500/10",
  "Dáta a pamäť": "text-indigo-400 border-indigo-500/30 bg-indigo-500/10",
  "Výskum": "text-purple-400 border-purple-500/30 bg-purple-500/10",
  "Obchod a rast": "text-amber-400 border-amber-500/30 bg-amber-500/10",
  "Tvorba": "text-pink-400 border-pink-500/30 bg-pink-500/10",
  "Kvalita a bezpečnosť": "text-rose-400 border-rose-500/30 bg-rose-500/10",
  "Podpora a automatizácia": "text-teal-400 border-teal-500/30 bg-teal-500/10"
};

const QUICK_ACTIONS = [
  { label: "⚡ Diagnostika flotily", prompt: "Spusti komplexnú diagnostiku Trinity Omni-Core, over stav všetkých 46 agentov a skontroluj pripojenie k D1 a Cloudflare." },
  { label: "🔒 Bezpečnostný audit", prompt: "Vykonaj bezpečnostný audit Sovereign Locku, over ochranu kľúčov v .env a súlad s TruthGuard ústavou." },
  { label: "☁️ Cloudflare Edge Probe", prompt: "Otestuj routing na doménach auru.space a auru.dev a over pripravenosť Workerov." },
  { label: "🧬 Gemini GEM Tool Loop", prompt: "Aktivuj autonómny Gemini GEM cyklus pre kontrolu projektu a generovanie Sovereign dokladov." },
  { label: "💾 Synchronizácia pamäte", prompt: "Vytvor snapshot spoločnej pamäte agentov a zosynchronizuj nedávne zápisy do Sovereign Ledger." }
];

export default function TrinityDashboard() {
  const [activeTab, setActiveTab] = useState<"console" | "agents" | "skills" | "ledger">("console");
  const [selectedAgentId, setSelectedAgentId] = useState("orchestrator");
  const [agentSearch, setAgentSearch] = useState("");
  const [clusterFilter, setClusterFilter] = useState("Všetci");
  const [skillSearch, setSkillSearch] = useState("");

  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentPipelineStep, setCurrentPipelineStep] = useState<number>(0);
  const [copiedReceipt, setCopiedReceipt] = useState<string | null>(null);

  const [agentsList, setAgentsList] = useState<AgentItem[]>(DEFAULT_AGENTS);
  const [skillsList, setSkillsList] = useState<SkillItem[]>([]);
  const [skillsTotal, setSkillsTotal] = useState(152);

  const [receipts, setReceipts] = useState<Array<{ id: string; agent: string; time: string; summary: string; provider?: string }>>([
    { id: "RCPT-INIT-001", agent: "Trinity Omni-Core", time: "Pred chvíľou", summary: "TRINITY OMNI-CORE inicializovaný pre Basterix (Sabo Ivan).", provider: "sovereign-kernel" }
  ]);

  const [logs, setLogs] = useState<LogEntry[]>([
    { id: "1", timestamp: "14:30:00", type: "system", text: "TRINITY // QUANTUM SOVEREIGN COCKPIT INITIALIZED" },
    { id: "2", timestamp: "14:30:01", type: "system", text: "Overený majiteľ & Sovereign Architect: Basterix (saboivan2008@gmail.com)" },
    { id: "3", timestamp: "14:30:02", type: "system", text: "TruthGuard Ústava aktívna: NO RECEIPT = NO SUCCESS. 46 špecialistov pripravených." }
  ]);

  // Dynamické načítanie skillov a agentov z API
  useEffect(() => {
    async function loadSkillsAndAgents() {
      try {
        const res = await fetch("/api/skills");
        if (res.ok) {
          const data = await res.json();
          if (data.total) setSkillsTotal(data.total);
          if (data.skills && Array.isArray(data.skills)) {
            setSkillsList(data.skills);
          }
          if (data.agents && Array.isArray(data.agents) && data.agents.length > 0) {
            setAgentsList(data.agents);
          }
        }
      } catch {
        // Fallback na predvolený zoznam
      }
    }
    void loadSkillsAndAgents();
  }, []);

  const activeAgent = useMemo(() => {
    return agentsList.find(a => a.id === selectedAgentId) || agentsList[0];
  }, [agentsList, selectedAgentId]);

  const appendLog = (type: LogEntry["type"], text: string, receiptId?: string) => {
    const newEntry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString("sk-SK"),
      type,
      text,
      receiptId
    };
    setLogs(prev => [...prev, newEntry]);
  };

  const filteredAgents = useMemo(() => {
    return agentsList.filter(agent => {
      const matchesSearch = agent.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
                            agent.id.toLowerCase().includes(agentSearch.toLowerCase()) ||
                            agent.role.toLowerCase().includes(agentSearch.toLowerCase());
      const matchesCluster = clusterFilter === "Všetci" || agent.cluster === clusterFilter;
      return matchesSearch && matchesCluster;
    });
  }, [agentsList, agentSearch, clusterFilter]);

  const filteredSkills = useMemo(() => {
    return skillsList.filter(skill => {
      return skill.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
             skill.description.toLowerCase().includes(skillSearch.toLowerCase()) ||
             skill.id.toLowerCase().includes(skillSearch.toLowerCase());
    });
  }, [skillsList, skillSearch]);

  const handleRunAgent = async (taskText?: string) => {
    const currentPrompt = (taskText || prompt).trim();
    if (!currentPrompt || isLoading) return;

    if (!taskText) setPrompt("");
    setIsLoading(true);
    setCurrentPipelineStep(1); // 1. Auth & verification

    appendLog("prompt", `[Target: ${activeAgent.name} // ${activeAgent.id}] > "${currentPrompt}"`);
    appendLog("system", `[ORCHESTRATOR] Zahajujem autorizovanú multi-agentovú pipeline pre [${activeAgent.name}]...`);

    try {
      setTimeout(() => setCurrentPipelineStep(2), 300); // 2. Dispatch
      setTimeout(() => setCurrentPipelineStep(3), 700); // 3. Tool execution

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: currentPrompt,
          agentId: activeAgent.id
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data: AgentResponse = await res.json();
      setCurrentPipelineStep(4); // 4. Receipt sealed

      if (data.status === "SUCCESS" && data.data) {
        const steps = data.data.steps || [];

        for (const step of steps) {
          if (step.thought) {
            appendLog("step", `[Krok ${step.stepNumber ?? 1}] ${step.thought}`);
          }
          if (step.action?.tool) {
            appendLog("tool", `-> EXEKÚCIA NÁSTROJA: ${step.action.tool}`);
          }
          if (step.observation) {
            appendLog("result", `<- VÝSLEDOK: ${typeof step.observation === "object" ? JSON.stringify(step.observation) : String(step.observation)}`);
          }
        }

        if (data.data.finalAnswer) {
          appendLog("success", `✦ ODPOVEĎ AGENTA [${data.data.agentName || activeAgent.name}] (${data.data.provider || "Trinity"}):\n\n${data.data.finalAnswer}`);
        }

        if (data.data.receiptId) {
          appendLog("receipt", `📜 KRYPTOGRAFICKÝ DOKLAD (SOVEREIGN RECEIPT): ${data.data.receiptId}`, data.data.receiptId);
          setReceipts(prev => [
            {
              id: data.data?.receiptId || "RCPT",
              agent: data.data?.agentName || activeAgent.name,
              time: new Date().toLocaleTimeString("sk-SK"),
              summary: currentPrompt.length > 65 ? currentPrompt.substring(0, 62) + "..." : currentPrompt,
              provider: data.data?.provider
            },
            ...prev
          ]);
        }
      } else {
        appendLog("error", `✗ CHYBA PIPELINE: ${data.error || "Neznáme zlyhanie spracovania"}`);
      }
    } catch (err: any) {
      appendLog("error", `✗ CHYBA SPOJENIA: ${err?.message || "Server neodpovedá"}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setCurrentPipelineStep(0), 1500);
    }
  };

  const handleClearLogs = () => {
    setLogs([
      { id: "cleared", timestamp: new Date().toLocaleTimeString("sk-SK"), type: "system", text: "Konzola bola vyčistená operátorom. Telemetrický okruh aktívny." }
    ]);
  };

  const handleExportLogs = () => {
    const textContent = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.text}`).join("\n");
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trinity-telemetry-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedReceipt(id);
    setTimeout(() => setCopiedReceipt(null), 2000);
  };

  return (
    <div className="app-container">
      {/* Top Futuristic Command Header */}
      <header className="glass-panel p-4 md:p-6 flex flex-wrap items-center justify-between gap-4 border-b border-cyan-500/20 glow-quantum hud-corner">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600/40 via-cyan-500/30 to-purple-600/20 border border-cyan-500/50 flex items-center justify-center shadow-xl shadow-cyan-950/60 overflow-hidden">
            <Cpu className="w-7 h-7 text-cyan-300 relative z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 to-transparent animate-pulse"></div>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-black tracking-wider text-white flex items-center gap-2">
                TRINITY <span className="text-cyan-400 font-mono text-lg font-light">//</span> OMNI-CORE
              </h1>
              <span className="badge-chip badge-cyan text-xs">v11.1 QUANTUM HUD</span>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-3 mt-1 font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Lock className="w-3.5 h-3.5" /> ROOT_SOVEREIGN: Basterix (Sabo Ivan)
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-cyan-300 flex items-center gap-1">
                <FileCheck2 className="w-3.5 h-3.5" /> TRUTH POLICY 2.1
              </span>
            </div>
          </div>
        </div>

        {/* Live Neural Frequency Visualizer + Telemetry Status */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Animated Wave Indicator */}
          <div className="px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 flex items-center gap-2.5">
            <div className="flex items-center gap-1 h-5">
              <span className="wave-bar"></span>
              <span className="wave-bar"></span>
              <span className="wave-bar"></span>
              <span className="wave-bar"></span>
              <span className="wave-bar"></span>
            </div>
            <span className="text-[11px] font-mono text-cyan-300 uppercase tracking-wider font-semibold">
              {isLoading ? "PROCESUJEM..." : "KVANTOVÁ REZONANCIA"}
            </span>
          </div>

          <div className="badge-chip badge-emerald">
            <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-indicator"></span>
            <span>46 AGENTOV</span>
          </div>

          <div className="badge-chip badge-violet">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{skillsTotal} SKILLOV</span>
          </div>

          <div className="badge-chip badge-amber">
            <Radio className="w-3.5 h-3.5" />
            <span>CLOUDFLARE EDGE ONLINE</span>
          </div>
        </div>
      </header>

      {/* Main Tactical Navigation Bar */}
      <nav className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-2.5 rounded-2xl border border-white/10 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("console")}
            className={`btn-secondary ${activeTab === "console" ? "active" : ""}`}
          >
            <Terminal className="w-4 h-4" />
            <span>Orbitálna Konzola</span>
          </button>

          <button
            onClick={() => setActiveTab("agents")}
            className={`btn-secondary ${activeTab === "agents" ? "active" : ""}`}
          >
            <Layers className="w-4 h-4" />
            <span>Tím 46 Agentov</span>
          </button>

          <button
            onClick={() => setActiveTab("skills")}
            className={`btn-secondary ${activeTab === "skills" ? "active" : ""}`}
          >
            <Compass className="w-4 h-4" />
            <span>Katalóg Skillov ({skillsTotal})</span>
          </button>

          <button
            onClick={() => setActiveTab("ledger")}
            className={`btn-secondary ${activeTab === "ledger" ? "active" : ""}`}
          >
            <Shield className="w-4 h-4" />
            <span>Sovereign Ledger ({receipts.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 text-xs px-3.5 py-1.5 rounded-xl bg-black/60 border border-cyan-500/30">
          <span className="text-slate-400 font-mono">Vybraný špecialista:</span>
          <span className="font-bold text-cyan-300 font-mono">{activeAgent.name}</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-200 font-mono">
            {activeAgent.cluster}
          </span>
        </div>
      </nav>

      {/* LIVE 4-STAGE PIPELINE PROGRESS INDICATOR */}
      {isLoading && (
        <div className="glass-panel p-3.5 flex items-center justify-between gap-2 border border-cyan-500/40 bg-cyan-950/20 text-xs font-mono">
          <div className={`flex items-center gap-2 ${currentPipelineStep >= 1 ? "text-emerald-400 font-bold" : "text-slate-500"}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] border-current">1</span>
            <span>Sovereign Auth</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <div className={`flex items-center gap-2 ${currentPipelineStep >= 2 ? "text-cyan-400 font-bold" : "text-slate-500"}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] border-current">2</span>
            <span>Multi-Agent Dispatch</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <div className={`flex items-center gap-2 ${currentPipelineStep >= 3 ? "text-purple-400 font-bold" : "text-slate-500"}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] border-current">3</span>
            <span>Inferencia & Nástroje</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <div className={`flex items-center gap-2 ${currentPipelineStep >= 4 ? "text-amber-400 font-bold" : "text-slate-500"}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] border-current">4</span>
            <span>Sovereign Receipt Zapečatený</span>
          </div>
        </div>
      )}

      {/* VIEW: CONSOLE (COMMAND & TELEMETRY) */}
      {activeTab === "console" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
          {/* Left Column: Command & Dispatcher */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Active Agent Selector Banner */}
            <div className="glass-panel p-4 flex items-center justify-between gap-3 border border-cyan-500/20 hud-corner">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold font-mono text-lg shadow-md shadow-cyan-950/50">
                  {activeAgent.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{activeAgent.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${CLUSTER_COLORS[activeAgent.cluster] || "text-slate-400"}`}>
                      {activeAgent.cluster}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{activeAgent.role}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("agents")}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 shrink-0"
              >
                Zmeniť <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Prompt Form Cockpit */}
            <section className="glass-panel p-5 flex flex-col gap-4 glow-cyan hud-corner">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  Riadiaci Cockpit
                </h2>
                <span className="text-[11px] font-mono text-slate-500">
                  Target: <span className="text-cyan-400 font-semibold">{activeAgent.id}</span>
                </span>
              </div>

              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.ctrlKey || !e.shiftKey)) {
                      e.preventDefault();
                      void handleRunAgent();
                    }
                  }}
                  placeholder={`Zadaj operačný príkaz pre [${activeAgent.name}]... (Stlač Enter pre odoslanie)`}
                  rows={5}
                  className="w-full bg-black/75 border border-cyan-500/20 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 resize-none font-mono transition-all"
                />
              </div>

              <button
                onClick={() => handleRunAgent()}
                disabled={isLoading || !prompt.trim()}
                className="btn-primary w-full py-3.5"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-black" />
                    <span>Multi-Agent orchester pracuje...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current text-black" />
                    <span>Odoslať príkaz cez {activeAgent.name}</span>
                  </>
                )}
              </button>
            </section>

            {/* Quick Tactical Action Deck */}
            <section className="glass-panel p-4 flex flex-col gap-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 font-mono">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Rýchle operačné presety
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUICK_ACTIONS.map(action => (
                  <button
                    key={action.label}
                    onClick={() => {
                      setPrompt(action.prompt);
                      void handleRunAgent(action.prompt);
                    }}
                    disabled={isLoading}
                    className="p-3 text-left rounded-xl bg-black/40 border border-white/5 hover:border-cyan-500/40 hover:bg-cyan-950/20 transition-all text-xs text-slate-300 font-medium group"
                  >
                    <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                      {action.label}
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-1 mt-1 font-mono">
                      {action.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column: Live Telemetry Stream */}
          <section className="lg:col-span-7 glass-panel p-5 flex flex-col gap-4 glow-quantum min-h-[580px] hud-corner">
            <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-3 gap-2">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 pulse-indicator"></span>
                <span className="text-xs uppercase font-bold tracking-wider text-slate-200 font-mono flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" /> Live Sovereign Telemetria
                </span>
                <span className="badge-chip badge-cyan text-[10px]">
                  {logs.length} udalostí
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportLogs}
                  title="Stiahnuť telemetrický záznam"
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/5"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={handleClearLogs}
                  title="Vyčistiť záznamník"
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-rose-400 transition-colors border border-white/5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Output stream */}
            <div className="flex-1 bg-black/80 border border-white/5 rounded-xl p-4 overflow-y-auto space-y-3 text-xs font-mono max-h-[580px]">
              {logs.map(log => {
                let colorClass = "text-slate-300";
                let badge = "SYS";
                let badgeClass = "bg-slate-800 text-slate-300 border-slate-700";

                if (log.type === "prompt") {
                  colorClass = "text-amber-300 font-semibold";
                  badge = "PRÍKAZ";
                  badgeClass = "bg-amber-950/90 text-amber-300 border-amber-800";
                } else if (log.type === "step") {
                  colorClass = "text-cyan-300";
                  badge = "KROK";
                  badgeClass = "bg-cyan-950/90 text-cyan-300 border-cyan-800";
                } else if (log.type === "tool") {
                  colorClass = "text-purple-300 font-semibold";
                  badge = "NÁSTROJ";
                  badgeClass = "bg-purple-950/90 text-purple-300 border-purple-800";
                } else if (log.type === "result") {
                  colorClass = "text-slate-400";
                  badge = "VÝSLEDOK";
                  badgeClass = "bg-slate-900 text-slate-400 border-slate-800";
                } else if (log.type === "success") {
                  colorClass = "text-emerald-200 bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-500/30";
                  badge = "ODPOVEĎ";
                  badgeClass = "bg-emerald-900 text-emerald-300 border-emerald-700";
                } else if (log.type === "receipt") {
                  colorClass = "text-yellow-300 bg-amber-950/40 p-3 rounded-xl border border-amber-500/40 font-bold flex items-center justify-between gap-2";
                  badge = "DOKLAD";
                  badgeClass = "bg-yellow-950 text-yellow-300 border-yellow-700";
                } else if (log.type === "error") {
                  colorClass = "text-rose-400 bg-rose-950/40 p-3.5 rounded-xl border border-rose-500/40 font-bold";
                  badge = "CHYBA";
                  badgeClass = "bg-rose-900 text-rose-300 border-rose-700";
                }

                return (
                  <div key={log.id} className="flex items-start gap-2.5 leading-relaxed break-words">
                    <span className="text-[10px] text-slate-600 shrink-0 select-none pt-0.5">
                      {log.timestamp}
                    </span>
                    <span className={`text-[9px] px-2 py-0.5 rounded border uppercase font-bold shrink-0 ${badgeClass}`}>
                      {badge}
                    </span>
                    <div className={`flex-1 whitespace-pre-wrap ${colorClass}`}>
                      {log.text}
                      {log.receiptId && (
                        <button
                          onClick={() => copyToClipboard(log.receiptId!, log.id)}
                          className="ml-3 px-2 py-0.5 rounded bg-black/60 border border-yellow-500/40 text-[10px] text-yellow-300 hover:bg-yellow-500/20 transition-all inline-flex items-center gap-1"
                        >
                          {copiedReceipt === log.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedReceipt === log.id ? "Skopírované" : "Kopírovať"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* VIEW: 46 AGENTS MATRIX */}
      {activeTab === "agents" && (
        <section className="flex flex-col gap-5">
          {/* Filter Bar */}
          <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-4 hud-corner">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-cyan-400" />
              <input
                type="text"
                value={agentSearch}
                onChange={e => setAgentSearch(e.target.value)}
                placeholder="Hľadať agenta podľa mena, role alebo ID..."
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {["Všetci", "Riadenie", "Vývoj", "Cloud a prevádzka", "Dáta a pamäť", "Výskum", "Obchod a rast", "Tvorba", "Kvalita a bezpečnosť", "Podpora a automatizácia"].map(cluster => (
                <button
                  key={cluster}
                  onClick={() => setClusterFilter(cluster)}
                  className={`px-3 py-1.5 rounded-xl border transition-all ${
                    clusterFilter === cluster
                      ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold shadow-md shadow-cyan-950/50"
                      : "bg-black/30 border-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  {cluster}
                </button>
              ))}
            </div>
          </div>

          {/* Agents Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map(agent => {
              const isSelected = agent.id === selectedAgentId;
              const colorStyle = CLUSTER_COLORS[agent.cluster] || "text-slate-400 border-slate-800 bg-slate-900";

              return (
                <div
                  key={agent.id}
                  onClick={() => {
                    setSelectedAgentId(agent.id);
                    setActiveTab("console");
                  }}
                  className={`agent-card ${isSelected ? "selected" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        {agent.name}
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />}
                      </h4>
                      <span className="text-[11px] font-mono text-cyan-400">ID: {agent.id}</span>
                    </div>

                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-semibold font-mono ${colorStyle}`}>
                      {agent.cluster}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mb-3 line-clamp-2 leading-relaxed">
                    {agent.role}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-white/10 pt-2.5 font-mono">
                    <span>Nástroje: <b className="text-cyan-300">{agent.toolsCount}</b></span>
                    <span className="text-cyan-400 font-semibold group-hover:underline flex items-center gap-1">
                      Poveriť agenta →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* VIEW: SKILLS CATALOG */}
      {activeTab === "skills" && (
        <section className="glass-panel p-5 flex flex-col gap-4 hud-corner">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-cyan-400" />
                Oficiálny Katalóg Skillov ({skillsTotal})
              </h2>
              <p className="text-xs text-slate-400">
                152 plnohodnotných schopností a nástrojov prístupných všetkým agentom ekosystému TRINITY.
              </p>
            </div>

            <div className="flex items-center gap-2 max-w-sm w-full">
              <Search className="w-4 h-4 text-cyan-400" />
              <input
                type="text"
                value={skillSearch}
                onChange={e => setSkillSearch(e.target.value)}
                placeholder="Hľadať v skilloch..."
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[620px] overflow-y-auto pr-1">
            {filteredSkills.length > 0 ? (
              filteredSkills.map(skill => (
                <div key={skill.id} className="p-4 rounded-xl bg-black/50 border border-white/10 hover:border-cyan-500/50 transition-all flex flex-col justify-between gap-2.5 group">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <h4 className="font-bold text-white text-xs group-hover:text-cyan-300 transition-colors">{skill.name}</h4>
                      <span className="text-[10px] font-mono text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800">{skill.id}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{skill.description}</p>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/5 pt-2">
                    <div className="flex flex-wrap gap-1">
                      {(skill.clusters || []).slice(0, 2).map(c => (
                        <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {c}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        setPrompt(`Spusti skill [${skill.id}]: ${skill.name} a analyzuj výstup.`);
                        setActiveTab("console");
                      }}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold"
                    >
                      Otestovať →
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-16 text-center text-slate-500 text-xs font-mono">
                Katalóg skillov sa dynamicky synchronizuje ({skillsTotal} skillov pripravených).
              </div>
            )}
          </div>
        </section>
      )}

      {/* VIEW: SOVEREIGN LEDGER EXPLORER */}
      {activeTab === "ledger" && (
        <section className="glass-panel p-5 flex flex-col gap-5 hud-corner">
          <div className="border-b border-white/10 pb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                Sovereign Ledger & TruthGuard Explorer
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Ústavné pravidlo: NO RECEIPT = NO SUCCESS. Každý záznam nesie SHA-256 kryptografický odtlačok.
              </p>
            </div>

            <span className="badge-chip badge-amber text-xs">
              Sovereign Master: Basterix
            </span>
          </div>

          <div className="space-y-3.5">
            {receipts.map(r => (
              <div key={r.id} className="p-4 rounded-xl bg-black/60 border border-white/10 hover:border-amber-500/30 transition-all flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-md">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-amber-400">{r.id}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-mono">
                        VERIFIED_BLOCK
                      </span>
                      {r.provider && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                          {r.provider}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-200 mt-1 font-sans">{r.summary}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right text-xs text-slate-400 font-mono">
                  <div>
                    <div>Zodpovedný: <span className="text-cyan-300 font-semibold">{r.agent}</span></div>
                    <div className="text-[11px] text-slate-500">Čas: {r.time}</div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(r.id, r.id)}
                    className="p-2 rounded-lg bg-black/40 border border-white/10 hover:border-cyan-400 text-slate-400 hover:text-white transition-all"
                    title="Kopírovať Receipt ID"
                  >
                    {copiedReceipt === r.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
