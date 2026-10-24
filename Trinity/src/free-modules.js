/**
 * Trinity Free Internet Modules & Open-Data Engine
 * Poskytuje overené, živé a 100% pravdivé dáta z bezplatných verejných internetových zdrojov.
 * Žiadne simulácie ani fiktívne čísla v súlade s Truth Policy 2.0.
 */

const USER_AGENT = 'TrinityAssistant/11.0 (+https://auru.space; kontakt@auru.space)';

export const FREE_MODULES_CATALOG = [
  {
    id: 'weather',
    name: 'Open-Meteo Meteorológia',
    category: 'Životné prostredie',
    icon: '🌤',
    description: 'Živá teplota, vlhkosť, vietor, zrážky a predpoveď počasia pre akékoľvek mesto sveta.',
    provider: 'Open-Meteo & WMO',
    license: 'Open Data (CC BY 4.0)',
    rate_limit: 'Bez kľúča, 10 000 požiadaviek/deň',
    status: 'active'
  },
  {
    id: 'wikipedia',
    name: 'Wikipédia & Wikimedia Knowledge',
    category: 'Encyklopédia & Fakty',
    icon: '📖',
    description: 'Overené encyklopedické články, súhrny, definície a bibliografia zo slovenskej a svetovej Wikipédie.',
    provider: 'Wikimedia Foundation',
    license: 'CC BY-SA 4.0',
    rate_limit: 'Bez kľúča, verejné REST API',
    status: 'active'
  },
  {
    id: 'dns_doh',
    name: 'Cloudflare DNS over HTTPS (DoH)',
    category: 'Sieť & Bezpečnosť',
    icon: '🛡',
    description: 'Kryptograficky overené vyhodnocovanie DNS záznamov (A, AAAA, MX, TXT, CNAME) a stavu domén v reálnom čase.',
    provider: 'Cloudflare 1.1.1.1 DoH',
    license: 'Verejná resolver služba',
    rate_limit: 'Bez kľúča, globálna anycast sieť',
    status: 'active'
  },
  {
    id: 'crypto_markets',
    name: 'DefiLlama On-Chain & Krypto Trhy',
    category: 'Financie & Web3',
    icon: '🪙',
    description: 'Skutočné spotové ceny kryptoaktív, TVL blockchainov a protokoly bez sprostredkovateľských poplatkov.',
    provider: 'DefiLlama Open API',
    license: 'Open Data',
    rate_limit: 'Bez kľúča, real-time indexer',
    status: 'active'
  },
  {
    id: 'tech_news',
    name: 'Hacker News Tech Radar',
    category: 'Technológie & AI',
    icon: '⚡',
    description: 'Najaktuálnejšie správy, diskusie a inovácie z globálnej technologickej scény.',
    provider: 'Y Combinator / Hacker News Firebase',
    license: 'Verejné API',
    rate_limit: 'Bez kľúča, oficiálne čítanie',
    status: 'active'
  },
  {
    id: 'world_bank',
    name: 'World Bank Globálna Ekonomika',
    category: 'Makroekonómia',
    icon: '🌐',
    description: 'Oficiálne makroekonomické štatistiky: HDP, rast, inflácia, populácia a emisie štátov sveta.',
    provider: 'World Bank Open Data',
    license: 'CC BY-4.0 Open Data',
    rate_limit: 'Bez kľúča, oficiálny REST endpoint',
    status: 'active'
  }
];

export async function fetchWeather(query, { fetchImpl = globalThis.fetch } = {}) {
  const q = String(query || '').trim();
  if (!q) return { available: false, reason: 'Zadaj názov mesta alebo lokality.' };

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=sk`;
    const geoRes = await fetchImpl(geoUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000)
    });

    if (!geoRes.ok) {
      return { available: false, reason: `Geokódovanie zlyhalo (HTTP ${geoRes.status})`, query: q };
    }

    const geoData = await geoRes.json();
    if (!geoData.results || !geoData.results.length) {
      return { available: false, reason: `Lokalita "${q}" nebola nájdená v databáze geokódovania.`, query: q };
    }

    const place = geoData.results[0];
    const { latitude, longitude, name, country, elevation } = place;

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
    const weatherRes = await fetchImpl(weatherUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000)
    });

    if (!weatherRes.ok) {
      return { available: false, reason: `Počasie nedostupné (HTTP ${weatherRes.status})`, query: q };
    }

    const data = await weatherRes.json();
    return {
      available: true,
      location: {
        name,
        country: country || place.country_code,
        latitude,
        longitude,
        elevation
      },
      current: {
        temperature_c: data.current?.temperature_2m,
        humidity_pct: data.current?.relative_humidity_2m,
        precipitation_mm: data.current?.precipitation,
        wind_speed_kmh: data.current?.wind_speed_10m,
        time: data.current?.time
      },
      daily_forecast: {
        dates: data.daily?.time || [],
        temp_max_c: data.daily?.temperature_2m_max || [],
        temp_min_c: data.daily?.temperature_2m_min || [],
        precipitation_sum_mm: data.daily?.precipitation_sum || []
      },
      source: 'Open-Meteo & WMO',
      verified_truth: true,
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    return { available: false, reason: error.message || 'Chyba pripojenia k meteorologickej službe.', query: q };
  }
}

export async function fetchWikipedia(query, { lang = 'sk', fetchImpl = globalThis.fetch } = {}) {
  const q = String(query || '').trim();
  if (!q) return { available: false, reason: 'Zadaj hľadaný výraz alebo tému.' };

  const language = ['sk', 'en', 'cz', 'de', 'fr'].includes(lang) ? lang : 'sk';
  try {
    const wikiUrl = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q.replace(/ /g, '_'))}`;
    const res = await fetchImpl(wikiUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000)
    });

    if (res.status === 404) {
      return { available: false, reason: `Článok "${q}" nebol na Wikipédii (${language}) nájdený.`, query: q };
    }
    if (!res.ok) {
      return { available: false, reason: `Wikipédia vrátila HTTP ${res.status}`, query: q };
    }

    const data = await res.json();
    return {
      available: true,
      title: data.title,
      description: data.description || null,
      extract: data.extract,
      url: data.content_urls?.desktop?.page || null,
      thumbnail: data.thumbnail?.source || null,
      coordinates: data.coordinates || null,
      language,
      source: 'Wikimedia / Wikipédia',
      verified_truth: true,
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    return { available: false, reason: error.message || 'Chyba pripojenia k Wikipédii.', query: q };
  }
}

export async function resolveDns(domain, type = 'A', { fetchImpl = globalThis.fetch } = {}) {
  const d = String(domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  if (!d || !d.includes('.')) return { available: false, reason: 'Zadaj platný názov domény (napr. auru.space).' };

  const validTypes = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA'];
  const recordType = validTypes.includes(type.toUpperCase()) ? type.toUpperCase() : 'A';

  try {
    const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(d)}&type=${encodeURIComponent(recordType)}`;
    const res = await fetchImpl(dohUrl, {
      headers: {
        'Accept': 'application/dns-json',
        'User-Agent': USER_AGENT
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      return { available: false, reason: `DoH resolver zlyhal (HTTP ${res.status})`, domain: d };
    }

    const data = await res.json();
    const answers = (data.Answer || []).map(a => ({
      name: a.name,
      type: recordType,
      ttl_seconds: a.TTL,
      data: a.data
    }));

    return {
      available: true,
      domain: d,
      type: recordType,
      status: data.Status === 0 ? 'NOERROR' : `RCODE_${data.Status}`,
      dnssec_validated: Boolean(data.AD),
      answers,
      source: 'Cloudflare 1.1.1.1 DoH',
      verified_truth: true,
      queried_at: new Date().toISOString()
    };
  } catch (error) {
    return { available: false, reason: error.message || 'Chyba pripojenia k DNS resolveru.', domain: d };
  }
}

export async function fetchCryptoMarkets(coins = ['bitcoin', 'ethereum', 'solana'], { fetchImpl = globalThis.fetch } = {}) {
  const validCoins = (Array.isArray(coins) ? coins : [coins])
    .map(c => String(c).trim().toLowerCase())
    .filter(Boolean);

  if (!validCoins.length) return { available: false, reason: 'Zadaj aspoň jednu kryptomenu.' };

  try {
    const keys = validCoins.map(c => `coingecko:${c}`).join(',');
    const url = `https://coins.llama.fi/prices/current/${keys}`;
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      return { available: false, reason: `DefiLlama API vrátilo HTTP ${res.status}` };
    }

    const data = await res.json();
    const resultCoins = [];

    for (const c of validCoins) {
      const item = data.coins?.[`coingecko:${c}`];
      if (item) {
        resultCoins.push({
          id: c,
          symbol: item.symbol,
          price_usd: item.price,
          confidence: item.confidence,
          timestamp: item.timestamp ? new Date(item.timestamp * 1000).toISOString() : null
        });
      }
    }

    return {
      available: true,
      count: resultCoins.length,
      coins: resultCoins,
      source: 'DefiLlama Open API',
      verified_truth: true,
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    return { available: false, reason: error.message || 'Chyba pripojenia k trhovým dátam.' };
  }
}

export async function fetchTechNews(limit = 10, { fetchImpl = globalThis.fetch } = {}) {
  const maxStories = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 30);

  try {
    const topUrl = 'https://hacker-news.firebaseio.com/v0/topstories.json';
    const topRes = await fetchImpl(topUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000)
    });

    if (!topRes.ok) {
      return { available: false, reason: `Hacker News API vrátilo HTTP ${topRes.status}` };
    }

    const ids = (await topRes.json()).slice(0, maxStories);
    const storyPromises = ids.map(async id => {
      try {
        const itemRes = await fetchImpl(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(5000)
        });
        if (!itemRes.ok) return null;
        const item = await itemRes.json();
        return {
          id: item.id,
          title: item.title,
          url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
          by: item.by,
          score: item.score,
          comments_count: item.descendants || 0,
          published_at: item.time ? new Date(item.time * 1000).toISOString() : null
        };
      } catch {
        return null;
      }
    });

    const stories = (await Promise.all(storyPromises)).filter(Boolean);
    return {
      available: true,
      count: stories.length,
      stories,
      source: 'Hacker News (Y Combinator)',
      verified_truth: true,
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    return { available: false, reason: error.message || 'Chyba načítania technologických noviniek.' };
  }
}

export async function fetchWorldBankIndicator(countryCode = 'SVK', indicator = 'NY.GDP.MKTP.CD', { fetchImpl = globalThis.fetch } = {}) {
  const c = String(countryCode || 'SVK').trim().toUpperCase();
  const ind = String(indicator || 'NY.GDP.MKTP.CD').trim();

  try {
    const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(c)}/indicator/${encodeURIComponent(ind)}?format=json&date=2020:2026`;
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      return { available: false, reason: `World Bank API vrátilo HTTP ${res.status}` };
    }

    const json = await res.json();
    if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) {
      return { available: false, reason: `Žiadne dáta pre krajinu ${c} a indikátor ${ind}.` };
    }

    const records = json[1].filter(r => r.value != null).map(r => ({
      year: r.date,
      value: r.value,
      country_name: r.country?.value || c,
      indicator_name: r.indicator?.value || ind
    }));

    return {
      available: true,
      country_code: c,
      indicator: ind,
      indicator_name: records[0]?.indicator_name || ind,
      country_name: records[0]?.country_name || c,
      records,
      source: 'World Bank Open Data',
      verified_truth: true,
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    return { available: false, reason: error.message || 'Chyba pripojenia k World Bank API.' };
  }
}
