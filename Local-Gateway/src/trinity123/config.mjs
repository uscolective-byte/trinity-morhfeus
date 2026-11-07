import {readFile} from 'node:fs/promises';

export const profile = JSON.parse(await readFile(new URL('./profile.json', import.meta.url), 'utf8'));
const original = await readFile(new URL('./original-instructions.md', import.meta.url), 'utf8');
const evidence = await readFile(new URL('./evidence-instructions.sk.md', import.meta.url), 'utf8');
const context = await readFile(new URL('./project-context.sk.md', import.meta.url), 'utf8');
export const overrides = {...profile.agent, instructions: `${original.trim()}\n\n${evidence.trim()}\n\n${context.trim()}`};

export function sessionPayload(message = profile.initial_message) {
  if (typeof message !== 'string' || !message.trim() || Buffer.byteLength(message) > 1_000_000) {
    throw new Error('Správa musí obsahovať 1 až 1 000 000 bajtov textu.');
  }
  // Omitted tools, multi_agent, service_tier etc. are copied from the saved agent.
  return {agent_id: profile.agent_id, agent: structuredClone(overrides),
    environment: structuredClone(profile.environment), input: message, stream: true};
}

export function redact(value, env = process.env) {
  let text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const name of ['OPENAI_API_KEY', 'TRINITY_LOCAL_TOKEN', 'TRINITY_BRIDGE_TOKEN']) {
    if (env[name]) text = text.split(env[name]).join('[REDACTED]');
  }
  return text.replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
    .replace(/(Bearer\s+)[^\s"\\]+/gi, '$1[REDACTED]');
}

export function safeId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) throw new Error('Neplatné ID.');
  return value;
}
