# WordPress connector foundation — Trinity

**Status:** Candidate on a feature branch; **not connected, deployed or enabled**.

## Why this exists

Trinity already has MCP and a plugin registry. WPWriter is an independent ChatGPT plugin; an authorized WPWriter account in ChatGPT **does not** mean the Trinity Worker has its credentials or rights. No guessed WPWriter API, scraped session cookies, or cross-product token sharing.

This proposed foundation is **read-only** and retrieves public data from a specific self-hosted WordPress REST endpoint. It does not install plugins or themes, create articles, change pages, or publish content.

## Interface

Module: `services/wordpress-connector.js`

- `wordpressConnectionStatus(env)`: configuration status, explicitly *not* a live connectivity check.
- `wordpressSiteInfo(env, siteUrl, fetcher?)`: public WP REST index.
- `wordpressListPublicPosts(env, siteUrl, {limit}, fetcher?)`: public published posts, max 20.
- `WORDPRESS_CAPABILITY`: machine-readable read-only metadata for eventual tool routing.

## Configuration

Set `TRINITY_WORDPRESS_ALLOWED_SITES` in the Worker environment to a comma-separated list of **approved HTTPS site origins**, e.g. `https://demo.example.com` (example only). Nothing is enabled by default.

Important: URLs are normalized and checked against explicit origins; redirects and IP-literal/localhost destinations are rejected. For high-assurance network isolation also apply Cloudflare egress policy and DNS-level safeguards before enabling this outside a controlled deployment. No secrets required for public reads.

## Next integration step

A code owner should wire the two read actions into `Trinity/src/tools.js` / the existing dispatcher with Zod schemas, agent permission checks, plugin enablement, truth receipts, and MCP exposure if needed. Then add an authenticated WordPress capability in a **separate** scoped design (WordPress Application Password or OAuth with server-held encrypted credentials), with human confirmation for publishing/deleting content.

Only after an actual WordPress site has been authorized should integration status advance from `configured_unverified` to `verified` on real API evidence. Do not represent WPWriter or WordPress writing as operational before that.

## Verification

```bash
cd Trinity
node --test tests/wordpress-connector.test.mjs
```

Production deployment is intentionally **out of scope** for this branch until regression tests, staging evidence and repo-owner review are complete.
