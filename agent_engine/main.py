import os
from flask import Flask, request, jsonify
from agents import root_agent

app = Flask(__name__)

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ONLINE",
        "system": "TRINITY_Core Multi-Agent ADK",
        "sub_agents": [
            "app_builder_agent", "devops_deploy_agent", "research_agent",
            "security_audit_agent", "qa_test_agent", "database_architect"
        ]
    })

@app.route("/api/execute", methods=["POST"])
def execute_plan():
    data = request.get_json() or {}
    prompt = data.get("prompt")
    if not prompt:
        return jsonify({"error": "Prompt je povinný"}), 400
    try:
        response = root_agent.run(prompt)
        return jsonify({
            "status": "SUCCESS",
            "orchestrator": "TRINITY_Core",
            "result": str(response)
        })
    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
