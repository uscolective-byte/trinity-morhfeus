// Reálne trhové dáta pre komoditný desk. ŽIADNE vymyslené, simulované ani "predvolené" ceny.
// Zdroj kotácií a sviečok: Yahoo Finance chart endpoint (bez kľúča, dáta sú oneskorené / neoficiálne).
// Kurz USD→EUR: ECB cez frankfurter.app. Ak zdroj zlyhá, vraciame available:false s dôvodom – nikdy odhad.
// Všetky I/O funkcie berú voliteľné `fetchImpl` (alebo čítajú globalThis.fetch v čase volania), aby sa dali testovať bez siete.

export const MARKET_DATA_SOURCE_LABEL = 'Yahoo Finance (query1.finance.yahoo.com) – neoficiálny, oneskorený zdroj';
export const FX_SOURCE_LABEL = 'ECB via frankfurter';
export const UNVERIFIED_SOURCE_LABEL = 'Bez overeného zdroja';
export const MARKET_CACHE_TTL_MS = 15 * 60 * 1000;
export const MAX_QUOTE_AGE_DAYS = 10;
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const FX_URL = 'https://api.frankfurter.app/latest?from=USD&to=EUR';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const CACHE_PREFIX = 'marketdata:v1:';

// Mapovanie komodít na Yahoo tickery. Overené skutočným dopytom (stav k tvorbe modulu).
// `null` = nenašiel sa overiteľný bezplatný zdroj → komodita sa NEOCEŇUJE, nepočíta sa do skóre ani grafov.
export const MARKET_SOURCES = {
  'XAU-EUR': { ticker: 'GC=F', note: 'COMEX zlato (futures), kotované v USD za t oz' },
  'XAG-EUR': { ticker: 'SI=F', note: 'COMEX striebro (futures), USD za t oz' },
  'XPT-EUR': { ticker: 'PL=F', note: 'NYMEX platina (futures), USD za t oz' },
  'XPD-EUR': { ticker: 'PA=F', note: 'NYMEX paládium (futures), USD za t oz' },
  'BRENT-EUR': { ticker: 'BZ=F', note: 'NYMEX Brent (futures), USD za barel' },
  'WTI-EUR': { ticker: 'CL=F', note: 'NYMEX WTI (futures), USD za barel' },
  'NGAS-EUR': { ticker: 'NG=F', note: 'NYMEX Henry Hub (futures), USD za MMBtu' },
  'TTF-EUR': { ticker: 'TTF=F', note: 'Dutch TTF (futures), EUR za MWh' },
  'COPPER-EUR': { ticker: 'HG=F', note: 'COMEX meď (futures), USD za libru (lb)' },
  'ALUM-EUR': { ticker: 'ALI=F', note: 'COMEX hliník (futures), USD za tonu; nízka likvidita – kotácie môžu byť riedke' },
  'WHEAT-EUR': { ticker: 'ZW=F', note: 'CBOT pšenica (futures), centy USD za bushel' },
  'CORN-EUR': { ticker: 'ZC=F', note: 'CBOT kukurica (futures), centy USD za bushel' },
  'SOY-EUR': { ticker: 'ZS=F', note: 'CBOT sója (futures), centy USD za bushel' },
  'COFFEE-EUR': { ticker: 'KC=F', note: 'ICE káva Arabica (futures), centy USD za libru' },
  'COCOA-EUR': { ticker: 'CC=F', note: 'ICE kakao (futures), USD za tonu' },
  'SUGAR-EUR': { ticker: 'SB=F', note: 'ICE cukor #11 (futures), centy USD za libru' },
  'BTC-EUR': { ticker: 'BTC-EUR', note: 'Bitcoin v EUR (kryptomena)' },
  'URAN-EUR': null, // Yahoo UX=F vracia iba expirovaný kontrakt (Dec-20) s 1 bodom – nepoužiteľné
  'LITH-EUR': null, // žiadna overiteľná bezplatná cena lítia (LIT je ETF akcií, nie cena kovu)
  'NICKEL-EUR': null,
  'ZINC-EUR': null, // Yahoo ZNC=F: bez objemu a posledná kotácia je staršia ako 2 mesiace
  'EUA-EUR': null // CO2.L je ETC (proxy), nie spotová cena EUA – neoverený zdroj
};

export function getMarketSource(symbol) {
  const entry = MARKET_SOURCES[symbol];
  return entry ? { symbol, ticker: entry.ticker, note: entry.note, verified_source: true } : { symbol, ticker: null, verified_source: false, reason: UNVERIFIED_SOURCE_LABEL };
}

export const TIMEFRAMES = {
  '1D': { range: '1d', interval: '15m' },
  '1W': { range: '5d', interval: '60m' },
  '1M': { range: '1mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1wk' }
};
export const ANALYSIS_SERIES = { range: '6mo', interval: '1d' };

export function normalizeTimeframe(tf) {
  const key = String(tf || '1D').trim().toUpperCase();
  return TIMEFRAMES[key] ? key : '1D';
}

// ---------- Čisté indikátory (počítané len zo skutočných zatváracích cien) ----------

export function sma(values, period) {
  const out = [];
  if (!Array.isArray(values) || period < 1 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out.push(sum / period);
  }
  return out;
}

// EMA so SMA seedom; výsledok je zarovnaný na koniec (dĺžka n - period + 1).
export function ema(values, period) {
  if (!Array.isArray(values) || period < 1 || values.length < period) return [];
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out = [prev];
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

// Wilderovo RSI. Prvá hodnota zodpovedá indexu `period`; dĺžka výstupu n - period.
export function rsi(values, period = 14) {
  if (!Array.isArray(values) || values.length <= period) return [];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  const toRsi = () => (avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss));
  const out = [toRsi()];
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    out.push(toRsi());
  }
  return out;
}

// Wilderov ATR; TR_0 = high-low, ďalšie TR zohľadňujú predchádzajúce zatvorenie. Dĺžka n - period + 1.
export function atr(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period) return [];
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const pc = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
  });
  let prev = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out = [prev];
  for (let i = period; i < tr.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out.push(prev);
  }
  return out;
}

// MACD(12,26,9). macd: dĺžka n-slow+1; signal/histogram: dĺžka macd.length-signal+1 (zarovnané na koniec).
export function macd(values, fast = 12, slow = 26, signalPeriod = 9) {
  const empty = { macd: [], signal: [], histogram: [] };
  if (!Array.isArray(values) || values.length < slow) return empty;
  const fastE = ema(values, fast);
  const slowE = ema(values, slow);
  const offset = fastE.length - slowE.length;
  const line = slowE.map((s, i) => fastE[i + offset] - s);
  const signal = ema(line, signalPeriod);
  if (!signal.length) return { macd: line, signal: [], histogram: [] };
  const lineTail = line.slice(line.length - signal.length);
  return { macd: line, signal, histogram: signal.map((s, i) => lineTail[i] - s) };
}

export const lastOf = arr => (Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null);

// ---------- Sieť + cache ----------

function resolveFetch(fetchImpl) {
  const f = fetchImpl || globalThis.fetch;
  if (typeof f !== 'function') throw new Error('fetch nie je dostupný');
  return f;
}

async function cacheRead(env, key) {
  if (!env?.Mastermind?.get) return null;
  try {
    const raw = await env.Mastermind.get(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const age = Date.now() - Date.parse(parsed?.fetched_at || 0);
    return Number.isFinite(age) && age >= 0 && age <= MARKET_CACHE_TTL_MS ? parsed : null;
  } catch {
    return null;
  }
}

async function cacheWrite(env, key, value) {
  if (!env?.Mastermind?.put) return;
  try {
    await env.Mastermind.put(CACHE_PREFIX + key, JSON.stringify(value), { expirationTtl: Math.round(MARKET_CACHE_TTL_MS / 1000) });
  } catch {
    // cache je len optimalizácia; chyba zápisu nemení pravdivosť dát
  }
}

export async function getFxRate({ env, fetchImpl, forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const hit = await cacheRead(env, 'fx:USDEUR');
    if (hit?.rate) return { available: true, rate: hit.rate, date: hit.date, source: FX_SOURCE_LABEL, fetched_at: hit.fetched_at, cached: true };
  }
  try {
    const res = await resolveFetch(fetchImpl)(FX_URL, { headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { available: false, reason: `Kurz USD→EUR (ECB/frankfurter) nedostupný: HTTP ${res.status}` };
    const data = await res.json();
    const rate = Number(data?.rates?.EUR);
    if (!Number.isFinite(rate) || rate <= 0) return { available: false, reason: 'Kurz USD→EUR (ECB/frankfurter) má neplatnú odpoveď' };
    const fx = { rate, date: String(data?.date || ''), fetched_at: new Date().toISOString() };
    await cacheWrite(env, 'fx:USDEUR', fx);
    return { available: true, rate, date: fx.date, source: FX_SOURCE_LABEL, fetched_at: fx.fetched_at, cached: false };
  } catch (e) {
    return { available: false, reason: `Kurz USD→EUR (ECB/frankfurter) nedostupný: ${e?.name || 'chyba siete'}` };
  }
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function parseYahooChart(json) {
  const result = json?.chart?.result?.[0];
  if (!result) return { ok: false, reason: json?.chart?.error?.description || 'Yahoo Finance nevrátilo žiadne dáta' };
  const meta = result.meta || {};
  const ts = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const candles = [];
  for (let i = 0; i < ts.length; i++) {
    const close = num(q.close?.[i]);
    if (close === null || !(close > 0)) continue;
    const open = num(q.open?.[i]) ?? close;
    const high = num(q.high?.[i]) ?? Math.max(open, close);
    const low = num(q.low?.[i]) ?? Math.min(open, close);
    candles.push({ time: new Date(ts[i] * 1000).toISOString(), open, high: Math.max(high, open, close), low: Math.min(low, open, close), close, volume: num(q.volume?.[i]) });
  }
  const price = num(meta.regularMarketPrice);
  const quoteTimeSec = num(meta.regularMarketTime);
  return {
    ok: true,
    meta: {
      currency: String(meta.currency || ''),
      instrument: String(meta.longName || meta.shortName || meta.symbol || ''),
      instrument_type: String(meta.instrumentType || ''),
      exchange: String(meta.fullExchangeName || meta.exchangeName || ''),
      price,
      quote_time: quoteTimeSec ? new Date(quoteTimeSec * 1000).toISOString() : null
    },
    candles
  };
}

async function fetchYahoo(env, ticker, range, interval, { fetchImpl, forceRefresh }) {
  const key = `yahoo:${ticker}:${range}:${interval}`;
  if (!forceRefresh) {
    const hit = await cacheRead(env, key);
    if (hit?.data) return { ok: true, data: hit.data, fetched_at: hit.fetched_at, cached: true };
  }
  try {
    const url = `${YAHOO_BASE}${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
    const res = await resolveFetch(fetchImpl)(url, { headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, reason: `Zdroj dát (Yahoo Finance) odpovedal HTTP ${res.status}` };
    const parsed = parseYahooChart(await res.json());
    if (!parsed.ok) return { ok: false, reason: parsed.reason };
    const fetched_at = new Date().toISOString();
    await cacheWrite(env, key, { fetched_at, data: parsed });
    return { ok: true, data: parsed, fetched_at, cached: false };
  } catch (e) {
    return { ok: false, reason: `Zdroj dát (Yahoo Finance) nedostupný: ${e?.name || 'chyba siete'}` };
  }
}

function toEurOrNative(value, nativeCurrency, fx) {
  // USX = centy USD. Žiadny iný menový prepočet nepodporujeme – radšej nič než odhad.
  const usd = nativeCurrency === 'USX' ? value / 100 : value;
  if (nativeCurrency === 'EUR') return { value: usd, currency: 'EUR' };
  if (fx?.available) return { value: usd * fx.rate, currency: 'EUR' };
  return { value: usd, currency: 'USD' };
}

function round(v, digits = 6) {
  return Number(Number(v).toFixed(digits));
}

// Vráti reálny rad sviečok + kotáciu pre danú komoditu, alebo {available:false, reason}. Nikdy nevymýšľa čísla.
export async function getMarketSeries(env, symbol, { range, interval, fetchImpl, forceRefresh = false, fx: fxIn } = {}) {
  const src = getMarketSource(symbol);
  if (!src.verified_source) return { available: false, symbol, reason: UNVERIFIED_SOURCE_LABEL, source: null };
  const r = range || ANALYSIS_SERIES.range;
  const i = interval || ANALYSIS_SERIES.interval;
  const [raw, fx] = await Promise.all([
    fetchYahoo(env, src.ticker, r, i, { fetchImpl, forceRefresh }),
    fxIn ? Promise.resolve(fxIn) : getFxRate({ env, fetchImpl, forceRefresh })
  ]);
  if (!raw.ok) return { available: false, symbol, ticker: src.ticker, reason: raw.reason, source: MARKET_DATA_SOURCE_LABEL };
  const { meta, candles } = raw.data;
  const native = meta.currency;
  if (!['USD', 'USX', 'EUR'].includes(native)) {
    return { available: false, symbol, ticker: src.ticker, reason: `Nepodporovaná mena zdroja (${native || 'neznáma'}) – cena sa nezobrazuje`, source: MARKET_DATA_SOURCE_LABEL };
  }
  if (!(meta.price > 0) || !meta.quote_time) {
    return { available: false, symbol, ticker: src.ticker, reason: 'Zdroj nevrátil platnú aktuálnu kotáciu', source: MARKET_DATA_SOURCE_LABEL };
  }
  const quoteAgeMs = Date.now() - Date.parse(meta.quote_time);
  if (quoteAgeMs > MAX_QUOTE_AGE_DAYS * 86400000) {
    return { available: false, symbol, ticker: src.ticker, reason: `Posledná kotácia zdroja je staršia ako ${MAX_QUOTE_AGE_DAYS} dní (${meta.quote_time}) – cena sa nezobrazuje`, source: MARKET_DATA_SOURCE_LABEL };
  }
  if (!candles.length) return { available: false, symbol, ticker: src.ticker, reason: 'Zdroj nevrátil žiadne historické sviečky', source: MARKET_DATA_SOURCE_LABEL };

  const conv = v => toEurOrNative(v, native, fx);
  const priceConv = conv(meta.price);
  const currency = priceConv.currency;
  const mapC = c => ({
    time: c.time,
    open: round(conv(c.open).value),
    high: round(conv(c.high).value),
    low: round(conv(c.low).value),
    close: round(conv(c.close).value),
    volume: c.volume
  });
  const fxInfo = native === 'EUR'
    ? { applied: false, note: 'Zdroj kotuje priamo v EUR' }
    : fx?.available
      ? { applied: true, rate: fx.rate, date: fx.date, source: fx.source, fetched_at: fx.fetched_at, direction: 'USD→EUR' }
      : { applied: false, available: false, reason: fx?.reason || 'Kurz nedostupný', note: 'Ceny sú v pôvodnej mene USD (bez prepočtu) – kurz sa nehádal.' };
  return {
    available: true,
    symbol,
    ticker: src.ticker,
    instrument: meta.instrument,
    exchange: meta.exchange,
    source: MARKET_DATA_SOURCE_LABEL,
    source_note: src.note,
    delayed: meta.instrument_type !== 'CRYPTOCURRENCY',
    delay_note: meta.instrument_type === 'CRYPTOCURRENCY' ? 'Kryptomena – takmer real-time, bez záruky' : 'Futures dáta sú oneskorené (typicky ≥10–15 min)',
    fetched_at: raw.fetched_at,
    cached: raw.cached,
    range: r,
    interval: i,
    native_currency: native === 'USX' ? 'USX (centy USD)' : native,
    currency,
    fx: fxInfo,
    price: round(priceConv.value),
    quote_time: meta.quote_time,
    quote_age_minutes: Math.max(0, Math.round(quoteAgeMs / 60000)),
    candles: candles.map(mapC)
  };
}

// Zmena ceny voči sviečke najbližšej k (teraz - dni) – iba ak taká historická sviečka skutočne existuje.
export function pctChangeOverDays(candles, price, days, nowMs = Date.now()) {
  if (!Array.isArray(candles) || candles.length < 2) return null;
  const target = nowMs - days * 86400000;
  let ref = null;
  for (const c of candles) {
    if (Date.parse(c.time) <= target) ref = c; else break;
  }
  if (!ref || !(ref.close > 0)) return null;
  return Number((((price - ref.close) / ref.close) * 100).toFixed(2));
}

// Zmena voči predchádzajúcemu dennému zatvoreniu (posledná sviečka = prebiehajúca relácia).
export function pctChangeVsPreviousClose(dailyCandles, price) {
  if (!Array.isArray(dailyCandles) || dailyCandles.length < 2) return null;
  const prev = dailyCandles[dailyCandles.length - 2].close;
  if (!(prev > 0)) return null;
  return Number((((price - prev) / prev) * 100).toFixed(2));
}
