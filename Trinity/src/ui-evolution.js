import { z } from 'zod';
import { HttpError } from './security.js';
import { recordStepDocument } from './trinity-documents.js';

const UI_STATE_KV_KEY = 'assistant:ui:live_state';
const UI_CHANGES_KV_KEY = 'assistant:ui:changes';

export const UI_PRESETS = {
  default: {
    id: 'default',
    name: 'Trinity Cosmic Dark (Predvolený)',
    primary: '#38bdf8',
    secondary: '#6366f1',
    accent: '#14b8a6',
    bg_tint: 'rgba(15, 23, 42, 0.78)'
  },
  'cyber-gold': {
    id: 'cyber-gold',
    name: 'Cyber Gold & Obsidian',
    primary: '#f59e0b',
    secondary: '#fbbf24',
    accent: '#eab308',
    bg_tint: 'rgba(24, 20, 12, 0.84)'
  },
  'aurora-emerald': {
    id: 'aurora-emerald',
    name: 'Aurora Emerald',
    primary: '#10b981',
    secondary: '#06b6d4',
    accent: '#34d399',
    bg_tint: 'rgba(6, 28, 24, 0.82)'
  },
  'royal-violet': {
    id: 'royal-violet',
    name: 'Royal Quantum Violet',
    primary: '#a855f7',
    secondary: '#ec4899',
    accent: '#8b5cf6',
    bg_tint: 'rgba(24, 14, 38, 0.82)'
  },
  'crimson-ops': {
    id: 'crimson-ops',
    name: 'Crimson Tactical Ops',
    primary: '#f43f5e',
    secondary: '#fb923c',
    accent: '#ef4444',
    bg_tint: 'rgba(32, 12, 18, 0.84)'
  },
  'ocean-glass': {
    id: 'ocean-glass',
    name: 'Ocean Crystal Glass',
    primary: '#0ea5e9',
    secondary: '#22d3ee',
    accent: '#38bdf8',
    bg_tint: 'rgba(8, 25, 42, 0.80)'
  },
  'arctic-light': {
    id: 'arctic-light',
    name: 'Arctic Daylight',
    primary: '#2563eb',
    secondary: '#0891b2',
    accent: '#4f46e5',
    bg_tint: 'rgba(248, 250, 252, 0.94)'
  }
};

export const uiWidgetSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,60}$/).optional(),
  title: z.string().trim().min(1).max(100),
  badge: z.string().trim().max(40).optional().default('TRINITY WIDGET'),
  content: z.string().trim().min(1).max(800),
  action_label: z.string().trim().max(60).optional().default('Spustiť v chate'),
  action_prompt: z.string().trim().max(500).optional().default(''),
  color: z.enum(['blue', 'teal', 'gold', 'coral', 'purple']).optional().default('blue')
}).strict();

export const uiEvolutionInputSchema = z.object({
  title: z.string().trim().min(2).max(140).optional().default('Úprava rozhrania Trinity'),
  preset: z.enum(Object.keys(UI_PRESETS)).optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  font_scale: z.enum(['compact', 'normal', 'large']).optional(),
  radius_scale: z.enum(['sharp', 'rounded', 'pill']).optional(),
  brand_title: z.string().trim().max(60).optional(),
  brand_subtitle: z.string().trim().max(90).optional(),
  welcome_heading: z.string().trim().max(120).optional(),
  welcome_subtext: z.string().trim().max(300).optional(),
  custom_css: z.string().max(12000).optional(),
  add_widget: uiWidgetSchema.optional(),
  remove_widget_id: z.string().max(80).optional(),
  reset_default: z.boolean().optional().default(false),
  propose_only: z.boolean().optional().default(false)
}).strict();

const DEFAULT_UI_STATE = {
  preset: 'default',
  primary_color: null,
  secondary_color: null,
  font_scale: 'normal',
  radius_scale: 'rounded',
  brand_title: 'Trinity 11.0',
  brand_subtitle: 'Tvoja osobná asistentka',
  welcome_heading: 'Ahoj. Som Trinity.',
  welcome_subtext: 'Môžeme sa porozprávať, upraviť moje vlastné UI, spravovať domény a prostredia alebo zarábať.',
  custom_css: '',
  widgets: [],
  updated_at: null,
  updated_by: null
};

const memFallback = new Map();

export function sanitizeCustomCss(rawCss = '') {
  const str = String(rawCss || '').trim();
  if (!str) return '';
  if (/@import|javascript:|expression\s*\(|url\s*\(|<\/style|<script/i.test(str)) {
    throw new HttpError(400, 'Vlastné CSS nesmie obsahovať externé url(), @import ani skriptové výrazy.');
  }
  return str.slice(0, 12000);
}

export function buildGeneratedCss(state = DEFAULT_UI_STATE) {
  const preset = UI_PRESETS[state.preset] || UI_PRESETS.default;
  const primary = state.primary_color || preset.primary;
  const secondary = state.secondary_color || preset.secondary;
  const fontScale = state.font_scale === 'large' ? '1.06' : state.font_scale === 'compact' ? '0.94' : '1';
  const radius = state.radius_scale === 'sharp' ? '8px' : state.radius_scale === 'pill' ? '22px' : '14px';

  const lines = [
    ':root {',
    `  --trinity-live-primary: ${primary};`,
    `  --trinity-live-secondary: ${secondary};`,
    `  --trinity-live-accent: ${preset.accent};`,
    `  --trinity-live-radius: ${radius};`,
    `  --trinity-live-font-scale: ${fontScale};`,
    '}'
  ];

  if (state.preset !== 'default' || state.primary_color || state.secondary_color) {
    lines.push(
      `button.primary, .hero-actions .primary, .new { background: linear-gradient(135deg, ${primary}, ${secondary}) !important; border-color: ${primary} !important; color: #06101f !important; font-weight: 700 !important; }`,
      `.eyebrow, .brand-mark, .environment-badge { border-color: ${primary}55 !important; }`,
      `.brand-mark { background: linear-gradient(135deg, ${primary}, ${secondary}) !important; color: #06101f !important; }`,
      `.main-nav button.active { border-color: ${primary}66 !important; box-shadow: inset 3px 0 0 ${primary} !important; }`,
      `.panel { border-radius: ${radius} !important; }`
    );
  }

  if (state.font_scale === 'large') {
    lines.push('body { font-size: 16.5px !important; }');
  } else if (state.font_scale === 'compact') {
    lines.push('body { font-size: 13.5px !important; }');
  }

  if (state.custom_css) {
    lines.push('/* User & Trinity Custom CSS */', state.custom_css);
  }

  return lines.join('\n');
}

async function readKvOrDb(env, key, fallback) {
  if (env?.Mastermind?.get) {
    try {
      const raw = await env.Mastermind.get(key);
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  if (env?.DB?.prepare) {
    try {
      const row = await env.DB.prepare("SELECT value FROM ops_memory WHERE key = ?").bind(key).first();
      if (row?.value) return JSON.parse(row.value);
    } catch {}
  }
  return memFallback.has(key) ? memFallback.get(key) : fallback;
}

async function writeKvAndDb(env, key, value) {
  const serialized = JSON.stringify(value);
  memFallback.set(key, value);
  if (env?.Mastermind?.put) {
    try {
      await env.Mastermind.put(key, serialized);
    } catch {}
  }
  if (env?.DB?.prepare) {
    try {
      await env.DB.prepare(
        "INSERT INTO ops_memory(key,value,source) VALUES(?,?,'ui-evolution') ON CONFLICT(key) DO UPDATE SET value=excluded.value,source='ui-evolution',updated_at=datetime('now')"
      ).bind(key, serialized).run();
    } catch {}
  }
}

export async function getUiEvolutionState(env) {
  const rawState = await readKvOrDb(env, UI_STATE_KV_KEY, null);
  const state = {
    ...DEFAULT_UI_STATE,
    ...(rawState || {}),
    widgets: Array.isArray(rawState?.widgets) ? rawState.widgets : []
  };
  const changes = await readKvOrDb(env, UI_CHANGES_KV_KEY, []);
  return {
    self_modifiable_ui: true,
    state,
    presets: Object.values(UI_PRESETS),
    generated_css: buildGeneratedCss(state),
    changes: Array.isArray(changes) ? changes.slice(0, 40) : []
  };
}

export async function applyUiEvolution(env, actor = 'owner', rawInput = {}) {
  const input = uiEvolutionInputSchema.parse(rawInput);
  const current = await getUiEvolutionState(env);
  const previousState = current.state;

  let nextState;
  if (input.reset_default) {
    nextState = {
      ...DEFAULT_UI_STATE,
      updated_at: new Date().toISOString(),
      updated_by: actor
    };
  } else {
    const customCss = input.custom_css !== undefined
      ? sanitizeCustomCss(input.custom_css)
      : previousState.custom_css;

    let widgets = [...(previousState.widgets || [])];
    if (input.remove_widget_id) {
      widgets = widgets.filter(w => w.id !== input.remove_widget_id);
    }
    if (input.add_widget) {
      const widgetId = input.add_widget.id || `widget-${crypto.randomUUID().slice(0, 8)}`;
      const newWidget = { ...input.add_widget, id: widgetId };
      widgets = [newWidget, ...widgets.filter(w => w.id !== widgetId)].slice(0, 16);
    }

    nextState = {
      ...previousState,
      ...(input.preset !== undefined ? { preset: input.preset } : {}),
      ...(input.primary_color !== undefined ? { primary_color: input.primary_color } : {}),
      ...(input.secondary_color !== undefined ? { secondary_color: input.secondary_color } : {}),
      ...(input.font_scale !== undefined ? { font_scale: input.font_scale } : {}),
      ...(input.radius_scale !== undefined ? { radius_scale: input.radius_scale } : {}),
      ...(input.brand_title !== undefined ? { brand_title: input.brand_title } : {}),
      ...(input.brand_subtitle !== undefined ? { brand_subtitle: input.brand_subtitle } : {}),
      ...(input.welcome_heading !== undefined ? { welcome_heading: input.welcome_heading } : {}),
      ...(input.welcome_subtext !== undefined ? { welcome_subtext: input.welcome_subtext } : {}),
      custom_css: customCss,
      widgets,
      updated_at: new Date().toISOString(),
      updated_by: actor
    };
  }

  const generatedCss = buildGeneratedCss(nextState);
  const changeId = crypto.randomUUID();
  const status = input.propose_only ? 'proposed' : 'applied';
  const changeRecord = {
    id: changeId,
    title: input.title || (input.reset_default ? 'Obnovenie predvoleného UI' : `UI úprava (${nextState.preset})`),
    status,
    css: generatedCss,
    state_snapshot: nextState,
    previous_snapshot: previousState,
    actor,
    created_at: new Date().toISOString()
  };

  const nextChanges = [changeRecord, ...(current.changes || [])].slice(0, 40);
  await writeKvAndDb(env, UI_CHANGES_KV_KEY, nextChanges);

  if (!input.propose_only) {
    await writeKvAndDb(env, UI_STATE_KV_KEY, nextState);
  }

  await recordStepDocument(env, {
    title: `Trinity UI Samorozvoj: ${changeRecord.title}`,
    category: 'ui_evolution',
    step_name: `ui_evolution:${status}`,
    actor,
    summary: `Trinity upravila vlastné používateľské rozhranie (téma: ${nextState.preset}, stav: ${status}, widgety: ${nextState.widgets.length}).`,
    content: [
      `### Zmenené parametre UI`,
      `- **Téma (Preset)**: \`${nextState.preset}\``,
      `- **Primárna farba**: \`${nextState.primary_color || UI_PRESETS[nextState.preset]?.primary}\``,
      `- **Sekundárna farba**: \`${nextState.secondary_color || UI_PRESETS[nextState.preset]?.secondary}\``,
      `- **Veľkosť písma**: \`${nextState.font_scale}\``,
      `- **Zaoblenie prvkov**: \`${nextState.radius_scale}\``,
      `- **Značka v hlavičke**: ${nextState.brand_title} — ${nextState.brand_subtitle}`,
      `- **Počet aktívnych UI widgetov**: ${nextState.widgets.length}`,
      '',
      '### Vygenerované CSS',
      '```css',
      generatedCss,
      '```'
    ].join('\n'),
    receipt_id: `ui:${changeId}`,
    tags: ['ui-evolution', nextState.preset, status]
  });

  return {
    ok: true,
    change: changeRecord,
    state: input.propose_only ? previousState : nextState,
    generated_css: input.propose_only ? buildGeneratedCss(previousState) : generatedCss,
    changes: nextChanges
  };
}

export async function handleUiChangeAction(env, actor, id, action) {
  const current = await getUiEvolutionState(env);
  const changes = [...(current.changes || [])];
  const idx = changes.findIndex(item => item.id === id);
  if (idx < 0) throw new HttpError(404, 'Záznam zmeny vzhľadu nebol nájdený.');

  const target = changes[idx];
  if (action === 'approve') {
    target.status = 'applied';
    target.approved_at = new Date().toISOString();
    await writeKvAndDb(env, UI_STATE_KV_KEY, target.state_snapshot || current.state);
  } else if (action === 'rollback') {
    target.status = 'rolled_back';
    target.rolled_back_at = new Date().toISOString();
    const fallbackState = target.previous_snapshot || DEFAULT_UI_STATE;
    await writeKvAndDb(env, UI_STATE_KV_KEY, fallbackState);
  } else {
    throw new HttpError(400, 'Neplatná akcia pre zmenu vzhľadu.');
  }

  changes[idx] = target;
  await writeKvAndDb(env, UI_CHANGES_KV_KEY, changes);

  await recordStepDocument(env, {
    title: `Trinity UI ${action === 'approve' ? 'Schválenie zmeny' : 'Návrat vzhľadu (Rollback)'}: ${target.title}`,
    category: 'ui_evolution',
    step_name: `ui_change:${action}`,
    actor,
    summary: `Zmena vzhľadu ${target.id} bola prepnutá do stavu ${target.status}.`,
    content: `Používateľ alebo Trinity vykonala akciu **${action}** nad zmenou UI \`${target.id}\` (${target.title}).`,
    receipt_id: `ui:${action}:${target.id}`,
    tags: ['ui-evolution', action]
  });

  return getUiEvolutionState(env);
}

export async function renderDynamicThemeCss(env, baseThemeCss = '') {
  try {
    const { generated_css } = await getUiEvolutionState(env);
    return `${baseThemeCss}\n\n/* === TRINITY SELF-EVOLVING UI LAYER === */\n${generated_css}\n`;
  } catch {
    return baseThemeCss;
  }
}
