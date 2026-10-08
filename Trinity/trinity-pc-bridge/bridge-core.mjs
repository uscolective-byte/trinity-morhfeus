import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { isIP } from 'node:net';

export const DEFAULT_APPS = Object.freeze({
  notepad: 'notepad.exe',
  calculator: 'calc.exe',
  paint: 'mspaint.exe',
  explorer: 'explorer.exe',
  chrome: 'chrome.exe',
  edge: 'msedge.exe',
});

export function parseList(value, fallback = []) {
  const items = String(value || '').split(/[;,\n]/).map(item => item.trim()).filter(Boolean);
  return items.length ? items : [...fallback];
}

export function normalizeRoots(value, fallback) {
  return parseList(value, fallback).map(root => resolve(root));
}

function inside(candidate, root) {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function nearestExisting(path) {
  let current = path;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return current;
}

export function resolveAllowedPath(input, roots, { mustExist = false } = {}) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Chýba cesta.');
  if (/^(?:\\\\[.?]\\|\\\\)/.test(input.trim())) throw new Error('Sieťové a zariadené cesty nie sú povolené.');
  const candidate = resolve(input.trim());
  const allowed = roots.some(root => inside(candidate, root));
  if (!allowed) throw new Error('Cesta je mimo povolených pracovných priečinkov.');
  if (mustExist && !existsSync(candidate)) throw new Error(`Neexistuje: ${candidate}`);

  const anchor = nearestExisting(candidate);
  const realAnchor = realpathSync.native ? realpathSync.native(anchor) : realpathSync(anchor);
  const realAllowed = roots.some(root => {
    const realRoot = existsSync(root) ? (realpathSync.native ? realpathSync.native(root) : realpathSync(root)) : root;
    return inside(realAnchor, realRoot);
  });
  if (!realAllowed) throw new Error('Cesta cez symbolický odkaz opúšťa povolený priestor.');
  return candidate;
}

export function allowedApps(value) {
  const names = parseList(value, Object.keys(DEFAULT_APPS)).map(name => name.toLowerCase());
  return Object.fromEntries(names.filter(name => DEFAULT_APPS[name]).map(name => [name, DEFAULT_APPS[name]]));
}

export function resolveAllowedApp(name, apps) {
  const key = String(name || '').trim().toLowerCase();
  if (!key || !apps[key]) throw new Error(`Aplikácia nie je povolená. Povolené: ${Object.keys(apps).join(', ')}`);
  return { name: key, executable: apps[key] };
}

export function isPrivateAddress(address) {
  const value = String(address || '').toLowerCase();
  if (value === '::1' || value === '::' || value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')) return true;
  if (isIP(value) !== 4) return false;
  const [a, b] = value.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

export function validatePublicUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw new Error('Neplatná URL.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Povolené sú iba HTTP a HTTPS URL.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || isPrivateAddress(host)) {
    throw new Error('Lokálne a privátne internetové adresy nie sú povolené.');
  }
  url.username = '';
  url.password = '';
  return url;
}

export function sha256Receipt(createHash, bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
