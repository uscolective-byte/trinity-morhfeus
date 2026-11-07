// Compatibility entry point. Keep the real router, Durable Objects and workflow.
// Do not append placeholder classes: canonical exports own namespace identity.
export * from '../Trinity/src/index.js';
export { default } from '../Trinity/src/index.js';
