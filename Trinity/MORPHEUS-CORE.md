# Trinity Morpheus Core

This module is integrated into the existing Trinity Worker and uses its current orchestrator, agent registry, planner, plugin catalog, and service bindings. It does not create a second project or download/execute external plugin code.

## Capabilities

- `morpheus_core_plan`: builds a task plan and selects the existing specialist team; it does not run external actions.
- `morpheus_core_status`: reports core availability, agent/skill counts, plugin registration, and service-binding status without exposing credentials.
- The existing orchestrator remains the central coordinator. This module does not claim agents are autonomous services unless their configured bindings and health checks confirm that.

## Private assistant workflow catalog

The existing Worker catalog now references these private ChatGPT workflow plugins: AI Developer, Architecture Orchestrator, Repository Investigator, Build Repair, Security Guardian, Integration Manager, Quality Gate, Agent Coordinator, Observability Incident, Release Manager, and Business Automation. Morpheus Core remains registered separately.

These entries are workflow references and metadata only. They do not import or execute private ChatGPT plugin instructions inside the Worker, and they do not activate third-party connectors. The catalog exposes the plugin links and integration mode so the UI can distinguish a private assistant workflow from a Worker-native tool. Real external operations continue to use Trinity's existing authorization and approval path.

## Safety

- External changes, deployment, sharing, account changes, and other sensitive operations require the existing approval workflow.
- Secrets, tokens, and private credentials must never be written to logs or returned by status tools.
- A plan is not evidence that an action completed. Completion must be confirmed by the relevant tool or receipt.
- The emergency stop and existing authentication/role checks remain authoritative.

## Deployment status

This source change must pass CI and the existing Cloudflare Worker build before it is merged or considered deployed. A GitHub commit alone does not deploy the Worker.
