"use client";

import React, { useState, useEffect } from "react";
import { Terminal, Shield, Cpu, Database, Play, Code, RefreshCw, Layers } from "lucide-react";

export default function TrinityDashboard() {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [skillsCount, setSkillsCount] = useState<number>(6);
  const [logs, setLogs] = useState<string[]>([
    "[KERNEL] TRINITY OMNI-CORE // GOOGLE ADK READY",
    "[SECURITY] Ústava (Constitution): STRICT ENFORCEMENT AKTÍVNY",
    "[AGENTS] Sub-agenti: AppBuilder, DevOps, Research, Security, QA, Database",
    "[STATUS] Pripravený na príkazy od Basterix31..."
  ]);

  const refreshSkills = async () => {
    try {
      const res = await fetch("/api/skills");
      const data = await res.json();
      if (data.total) setSkillsCount(data.total);
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    refreshSkills();
  }, []);

  const handleRunAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    const currentPrompt = prompt;
    setPrompt("");
    setIsLoading(true);

    setLogs(prev => [
      ...prev,
      > PRÍKAZ: "",
      "[TRINITY_Core] Analyzujem a delegujem na sub-agentov..."
    ]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentPrompt })
      });

      const data = await res.json();
      if (data.status === "SUCCESS") {
        data.data.steps.forEach((step: any) => {
          setLogs(prev => [
            ...prev,
            [Krok ],
            step.action ? -> SUB-AGENT / NÁSTROJ:  : "", step.observation ? <- VÝSLEDOK:  : ""
          ].filter(Boolean));
        });
        setLogs(prev => [...prev, ✔ FINÁLNY VÝSLEDOK: ]); refreshSkills(); } else { setLogs(prev => [...prev, ✖ CHYBA: ]);
      }
    } catch (err: any) {
      setLogs(prev => [...prev, ✖ KRITICKÁ CHYBA: ]); } finally { setIsLoading(false); } };  return ( <div className="min-h-screen bg-black text-emerald-400 font-mono flex flex-col p-4 md:p-8"> <header className="border-b border-emerald-950 pb-5 mb-6 flex flex-wrap items-center justify-between gap-4"> <div className="flex items-center gap-3"> <div className="p-2 rounded bg-emerald-950/60 border border-emerald-800"> <Cpu className="w-6 h-6 text-emerald-400 animate-pulse" /> </div> <div> <h1 className="text-xl font-bold tracking-wider text-white">TRINITY // OMNI-CORE</h1> <p className="text-xs text-emerald-600">Google ADK Multi-Agent Orchestrator & Builder</p> </div> </div>  <div className="flex items-center gap-3 text-xs"> <span className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-950 border border-emerald-900 text-emerald-300"> <Shield className="w-3.5 h-3.5 text-emerald-400" /> Ústava: STRICT </span> <span className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-950 border border-emerald-900 text-yellow-400"> <Layers className="w-3.5 h-3.5" /> 6 Sub-Agentov </span> <span className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-950 border border-emerald-900 text-emerald-300"> <Code className="w-3.5 h-3.5" /> Skilly: {skillsCount} </span> </div> </header>  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1"> <div className="flex flex-col gap-5"> <div className="bg-zinc-950 border border-emerald-950 rounded-lg p-5 shadow-lg shadow-emerald-950/20"> <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2"> <Terminal className="w-4 h-4 text-emerald-500" /> Riadiaca Konzola </h2> <form onSubmit={handleRunAgent} className="flex flex-col gap-3"> <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Napr.: 'postav aplikaciu E-Shop a spusti ju' alebo 'vytvor modul pre krypto dáta'..." className="w-full h-36 bg-black border border-emerald-900/60 rounded p-3 text-sm text-emerald-300 placeholder-zinc-700 focus:outline-none focus:border-emerald-500 transition-colors resize-none" /> <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-black font-bold py-2.5 px-4 rounded flex items-center justify-center gap-2 text-sm transition-all" > {isLoading ? ( <span className="flex items-center gap-2 animate-pulse"> <RefreshCw className="w-4 h-4 animate-spin" /> TRINITY_Core orchestruje... </span> ) : ( <> <Play className="w-4 h-4 fill-current" /> Spustiť úlohu </> )} </button> </form> </div>  <div className="bg-zinc-950 border border-emerald-950 rounded-lg p-5"> <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2"> <Database className="w-4 h-4 text-emerald-500" /> Multi-Agent Zoznam </h2> <div className="space-y-2 text-xs"> <div className="flex justify-between border-b border-zinc-900 pb-1"> <span className="text-zinc-400">app_builder_agent:</span> <span className="text-emerald-400 font-semibold">Aktívny</span> </div> <div className="flex justify-between border-b border-zinc-900 pb-1"> <span className="text-zinc-400">devops_deploy_agent:</span> <span className="text-emerald-400 font-semibold">Aktívny</span> </div> <div className="flex justify-between border-b border-zinc-900 pb-1"> <span className="text-zinc-400">research_agent:</span> <span className="text-emerald-400 font-semibold">Google Search & URL</span> </div> <div className="flex justify-between border-b border-zinc-900 pb-1"> <span className="text-zinc-400">security_audit_agent:</span> <span className="text-emerald-400 font-semibold">Constitution Guard</span> </div> <div className="flex justify-between border-b border-zinc-900 pb-1"> <span className="text-zinc-400">qa_test_agent:</span> <span className="text-emerald-400 font-semibold">Test Suites</span> </div> <div className="flex justify-between"> <span className="text-zinc-400">database_architect:</span> <span className="text-emerald-400 font-semibold">Schemas & Migrations</span> </div> </div> </div> </div>  <div className="lg:col-span-2 bg-zinc-950 border border-emerald-950 rounded-lg p-5 flex flex-col shadow-lg shadow-emerald-950/20"> <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-3"> <span className="text-xs uppercase text-zinc-400 tracking-wider flex items-center gap-2"> <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Live Multi-Agent Telemetria </span> <span className="text-xs text-zinc-600">STDOUT / ADK LOG</span> </div>  <div className="flex-1 bg-black/90 border border-zinc-900 rounded p-4 overflow-y-auto space-y-2.5 text-xs max-h-[550px]"> {logs.map((log, index) => ( <div key={index} className={leading-relaxed }
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}