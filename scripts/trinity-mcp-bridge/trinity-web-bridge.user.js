// ==UserScript==
// @name         TRINITY <-> Gemini / ChatGPT / Claude Web MCP Bridge
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Prepojí Gemini, ChatGPT a Claude web chat s lokálnym TRINITY MCP serverom (wrangler, cmd, git)
// @match        https://gemini.google.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://auru.space/*
// @match        https://auru.dev/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// ==/UserScript==

(function () {
  "use strict";

  const BRIDGE_URL = "http://127.0.0.1:3333/exec";
  const BRIDGE_TOKEN = "trinity-local-secret";

  console.log("[TRINITY Bridge] Rozšírenie je aktívne na:", window.location.hostname);

  // Pravidelne hľadá kódové bloky obsahujúce "trinity_exec"
  setInterval(() => {
    document.querySelectorAll("pre code, pre").forEach((block) => {
      if (block.dataset.trinityBound) return;
      const text = block.innerText ? block.innerText.trim() : "";
      
      if (text.includes('"trinity_exec"') && (text.startsWith("{") || text.includes("{\n"))) {
        block.dataset.trinityBound = "true";
        
        const btnContainer = document.createElement("div");
        btnContainer.style = "margin-top: 8px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;";

        const btn = document.createElement("button");
        btn.innerText = "⚡ Spustiť v TRINITY (MCP)";
        btn.style = "background: linear-gradient(135deg, #10b981, #059669); color: #06101f; border: 1px solid #10b981; padding: 7px 15px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 10px rgba(16,185,129,0.35); transition: all 0.2s;";
        
        btn.onmouseover = () => { btn.style.transform = "scale(1.02)"; };
        btn.onmouseout = () => { btn.style.transform = "scale(1)"; };
        btn.onclick = (e) => {
          e.preventDefault();
          executeInTrinity(text, btn);
        };

        btnContainer.appendChild(btn);
        block.parentElement.appendChild(btnContainer);
      }
    });
  }, 1000);

  function executeInTrinity(rawText, btn) {
    btn.innerText = "⏳ Vykonávam v TRINITY...";
    btn.style.background = "#f59e0b";
    
    // Extrahujeme čistý JSON z bloku
    let payload;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*"trinity_exec"[\s\S]*\}/);
      if (!jsonMatch) throw new Error("JSON blok nebol nájdený");
      payload = JSON.parse(jsonMatch[0]);
    } catch (e) {
      btn.innerText = "❌ Neplatný JSON príkaz";
      btn.style.background = "#ef4444";
      console.error("[TRINITY Bridge] JSON Parse Error:", e);
      return;
    }

    GM_xmlhttpRequest({
      method: "POST",
      url: BRIDGE_URL,
      headers: {
        "Content-Type": "application/json",
        "x-trinity-token": BRIDGE_TOKEN
      },
      data: JSON.stringify(payload),
      timeout: 60000,
      onload: (res) => {
        try {
          const data = JSON.parse(res.responseText);
          btn.innerText = "✅ Úspešne vykonané (výstup vložený)";
          btn.style.background = "#10b981";
          
          insertOutputIntoChat(data);
        } catch (e) {
          btn.innerText = "⚠️ Chyba spracovania výstupu";
          btn.style.background = "#ef4444";
        }
      },
      onerror: (err) => {
        btn.innerText = "❌ Chyba spojenia s localhost:3333";
        btn.style.background = "#ef4444";
        console.error("[TRINITY Bridge] Network Error:", err);
      },
      ontimeout: () => {
        btn.innerText = "⏰ Časový limit vypršal";
        btn.style.background = "#ef4444";
      }
    });
  }

  function insertOutputIntoChat(data) {
    const formatted = `\n[TRINITY MCP VÝSTUP]:\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`;
    
    // Nájdenie správneho textového poľa podľa platformy
    const inputBox = 
      document.querySelector('#prompt-textarea') || 
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector('rich-textarea p') ||
      document.querySelector('textarea');

    if (inputBox) {
      inputBox.focus();
      
      // Skúsime štandardný insertText
      const success = document.execCommand("insertText", false, formatted);
      if (!success) {
        if (inputBox.tagName === "TEXTAREA" || inputBox.tagName === "INPUT") {
          inputBox.value += formatted;
          inputBox.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
          inputBox.innerText += formatted;
          inputBox.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    } else {
      // Fallback: skopíruje výsledok do schránky (clipboard)
      navigator.clipboard.writeText(formatted).then(() => {
        alert("Výstup z TRINITY bol skopírovaný do schránky (Ctrl+V ho vložte do chatu).");
      });
    }
  }
})();
