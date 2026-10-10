# Trinity Morpheus Core

This module is integrated into the existing Trinity Worker and uses its current orchestrator, agent registry, planner, plugin catalog, and service bindings. It does not create a second project or download/execute external plugin code.

## Capabilities

- `morpheus_core_plan`: builds a task plan and selects the existing specialist team; it does not run external actions.
- `morpheus_core_status`: reports core availability, agent/skill counts, plugin registration, and service-binding status without exposing credentials.
- The existing orchestrator remains the central coordinator. This module does not claim agents are autonomous services unless their configured bindings and health checks confirm that.

## Safety

- External changes, deployment, sharing, account changes, and other sensitive operations require the existing approval workflow.
- Secrets, tokens, and private credentials must never be written to logs or returned by status tools.
- A plan is not evidence that an action completed. Completion must be confirmed by the relevant tool or receipt.
- The emergency stop and existing authentication/role checks remain authoritative.

## Deployment status

This source change must pass CI and the existing Cloudflare Worker build before it is merged or considered deployed. A GitHub commit alone does not deploy the Worker.
