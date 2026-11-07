#!/usr/bin/env python3
"""
Trinity Sovereign AI OS - Azure AI Foundry Agent Bridge Client
Module: scripts/azure-foundry-trinity.py
Author: Basterix (Root Architect) & Antigravity (Sovereign Pair)
Truth Policy: 2.1 (NO RECEIPT = NO SUCCESS, NO EVIDENCE = NO FACT)

Popis:
  Tento skript poskytuje robustné rozhranie pre volanie agenta Trinity na Microsoft Azure AI Foundry:
  - Podpora pre azure-ai-projects SDK (>=2.1.0)
  - Podpora pre Azure API Token (Bearer) alebo DefaultAzureCredential
  - Automatické spracovanie CLI argumentov, interaktívny mód aj JSON výstup pre Trinity MCP Bridge
  - Podpora fallbacku na priame Azure Foundry REST API, ak SDK ešte nie je nainštalované
"""

import sys
import os
import json
import argparse
import time

DEFAULT_ENDPOINT = "https://saboivan2008-0459-resource.services.ai.azure.com/api/projects/saboivan2008-0459"
DEFAULT_AGENT_NAME = "Trinity"

def run_with_sdk(endpoint: str, agent_name: str, user_message: str) -> dict:
    """Spustí požiadavku cez oficiálne Azure AI Projects SDK."""
    from azure.identity import DefaultAzureCredential
    from azure.ai.projects import AIProjectClient

    start_time = time.time()
    with DefaultAzureCredential() as credential:
        with AIProjectClient(
            endpoint=endpoint,
            credential=credential,
            allow_preview=True,
        ) as project_client:
            # Bind the OpenAI client to the existing agent endpoint.
            openai_client = project_client.get_openai_client(agent_name=agent_name)

            # GitHub Copilot / Foundry preview agents require a conversation for every Responses turn.
            conversation = openai_client.conversations.create()
            response = openai_client.responses.create(
                conversation=conversation.id,
                input=[{"role": "user", "content": user_message}],
            )
            latency_ms = int((time.time() - start_time) * 1000)

            return {
                "ok": True,
                "agent_name": agent_name,
                "endpoint": endpoint,
                "conversation_id": getattr(conversation, "id", None),
                "response": getattr(response, "output_text", str(response)),
                "latency_ms": latency_ms,
                "method": "azure-ai-projects-sdk"
            }

def run_with_rest(endpoint: str, agent_name: str, user_message: str, token: str) -> dict:
    """Záložné volanie cez REST API v prípade, že je k dispozícii bearer token."""
    import urllib.request

    start_time = time.time()
    url = f"{endpoint.rstrip('/')}/agents/{agent_name}/responses?api-version=2024-12-01-preview"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = json.dumps({
        "input": [{"role": "user", "content": user_message}]
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            latency_ms = int((time.time() - start_time) * 1000)
            return {
                "ok": True,
                "agent_name": agent_name,
                "endpoint": endpoint,
                "response": data.get("output_text") or data,
                "latency_ms": latency_ms,
                "method": "direct-rest"
            }
    except Exception as exc:
        return {
            "ok": False,
            "error": str(exc),
            "endpoint": endpoint,
            "agent_name": agent_name,
            "method": "direct-rest"
        }

def main():
    parser = argparse.ArgumentParser(description="Trinity Azure AI Foundry Agent Runner")
    parser.add_argument("message", nargs="?", default="Hi Trinity", help="Správa pre agenta Trinity")
    parser.add_argument("--endpoint", default=os.getenv("AZURE_AI_PROJECT_ENDPOINT", DEFAULT_ENDPOINT), help="Azure AI Foundry Project Endpoint")
    parser.add_argument("--agent", default=os.getenv("AZURE_AI_AGENT_NAME", DEFAULT_AGENT_NAME), help="Názov agenta v Azure AI Foundry")
    parser.add_argument("--json", action="store_true", help="Výstup v čistom JSON formáte pre Trinity MCP / skripty")
    parser.add_argument("--interactive", "-i", action="store_true", help="Spustiť interaktívny dialóg")

    args = parser.parse_args()

    # Skontrolujeme dostupnosť knižníc
    sdk_available = False
    try:
        import azure.identity  # noqa: F401
        import azure.ai.projects  # noqa: F401
        sdk_available = True
    except ImportError:
        sdk_available = False

    if not sdk_available:
        token = os.getenv("AZURE_BEARER_TOKEN") or os.getenv("AZURE_ACCESS_TOKEN")
        if token:
            res = run_with_rest(args.endpoint, args.agent, args.message, token)
            if args.json:
                print(json.dumps(res, indent=2, ensure_ascii=False))
            else:
                if res.get("ok"):
                    print(f"[{res['agent_name']} - REST ({res['latency_ms']}ms)]:\n{res['response']}")
                else:
                    print(f"Chyba REST volania: {res.get('error')}", file=sys.stderr)
            return 0 if res.get("ok") else 1
        else:
            err_msg = (
                "Knižnica 'azure-ai-projects' nie je nainštalovaná a nie je nastavený AZURE_BEARER_TOKEN.\n"
                "Pre plný beh s DefaultAzureCredential nainštalujte závislosti príkazom:\n"
                "  pip install \"azure-ai-projects>=2.1.0\" azure-identity\n"
                "Alebo nastavte AZURE_BEARER_TOKEN pre priame REST volanie."
            )
            if args.json:
                print(json.dumps({
                    "ok": False,
                    "error": err_msg,
                    "endpoint": args.endpoint,
                    "agent_name": args.agent,
                    "required_packages": ["azure-ai-projects>=2.1.0", "azure-identity"]
                }, indent=2))
            else:
                print(err_msg, file=sys.stderr)
            return 2

    # Spustenie cez SDK
    if args.interactive:
        print(f"=== Trinity Azure AI Foundry Agent: {args.agent} ===")
        print(f"Endpoint: {args.endpoint}")
        print("Napíš správu (alebo 'exit'/'quit' pre ukončenie):")
        while True:
            try:
                line = input("\nTy: ").strip()
                if line.lower() in ("exit", "quit"):
                    break
                if not line:
                    continue
                result = run_with_sdk(args.endpoint, args.agent, line)
                if result.get("ok"):
                    print(f"\nTrinity ({result.get('latency_ms', 0)}ms): {result.get('response')}")
                else:
                    print(f"\nChyba: {result.get('error')}")
            except (KeyboardInterrupt, EOFError):
                break
        return 0

    try:
        result = run_with_sdk(args.endpoint, args.agent, args.message)
        if args.json:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(f"Response output: {result['response']}")
            print(f"Conversation ID: {result.get('conversation_id')}")
            print(f"Latency: {result.get('latency_ms')}ms")
        return 0
    except Exception as e:
        if args.json:
            print(json.dumps({"ok": False, "error": str(e), "endpoint": args.endpoint}, indent=2))
        else:
            print(f"Chyba pri volaní agenta: {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
