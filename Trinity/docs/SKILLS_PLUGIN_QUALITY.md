# Skills and plugin quality

This update improves the existing catalogue instead of adding nominal counts.
The 150 skill identities and 150 plugin identities remain stable.

## Relevant skills

The model receives at most eight skills per request. Ranking is deterministic,
accent-insensitive and prioritizes task keywords, universal communication and
relevant role clusters. Skill selection never changes an agent's tool permissions.
Development, cloud, quality and support workflows now contain domain-specific
steps and concrete completion checks rather than the same generic procedure.

## Purposeful workflow packs

Extended packs now explicitly reference relevant existing tools. For example,
CSV tools support the CSV pack, statistics supports the statistics pack, text
diff supports the diff pack and WCAG contrast supports the contrast pack.

These packs are labelled `workflow-pack`. They reuse core tools; they are not
independent external integrations or newly installed executable code.
Existing installation, enablement, per-agent and authorization controls remain
in effect. No migrations or credential changes are part of this update.

## Real test results

The plugin test endpoint no longer marks a merely registered generic plugin as
verified. Bounded core computations can run real smoke tests with sample data.
Results distinguish:

- `verified`: every declared tool passed its core-tool smoke test;
- `partial`: only some tools could be tested;
- `registered`: none of the required tools were exercised.

Generic testing never calls the PC, web, AI, secret store or storage mutations.
Untested integrations require a separate authorized integration test.
The response includes checks and `verification_scope: core-tool-smoke`.
That scope does not prove a workflow was completed or an external client connected.
Incomplete tests are recorded as `plugin_test_incomplete`, not `plugin_verified`.

## Separate PC-tool issue

An existing PC-tool schema initialization issue was identified during review.
This changeset deliberately leaves `src/tools.js` and PC authorization/execution
behavior untouched. That fix is separate from skill selection and catalogue testing.

Repository tests use a mocked Worker runtime. Deployment and live verification
are separate steps; passing tests alone is not evidence of a production rollout.