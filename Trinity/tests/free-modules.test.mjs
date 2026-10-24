import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_MODULES_CATALOG,
  fetchWeather,
  fetchWikipedia,
  resolveDns,
  fetchCryptoMarkets,
  fetchTechNews,
  fetchWorldBankIndicator
} from '../src/free-modules.js';

test('FREE_MODULES_CATALOG contains all verified live open data modules', () => {
  assert.equal(FREE_MODULES_CATALOG.length, 6);
  const ids = FREE_MODULES_CATALOG.map(m => m.id);
  assert.ok(ids.includes('weather'));
  assert.ok(ids.includes('wikipedia'));
  assert.ok(ids.includes('dns_doh'));
  assert.ok(ids.includes('crypto_markets'));
  assert.ok(ids.includes('tech_news'));
  assert.ok(ids.includes('world_bank'));
});

test('fetchWeather returns verified meteorology with stubbed fetch', async () => {
  const stubFetch = async (url) => {
    if (url.includes('geocoding-api.open-meteo.com')) {
      return {
        ok: true,
        json: async () => ({
          results: [{
            name: 'Bratislava',
            country: 'Slovensko',
            latitude: 48.148,
            longitude: 17.106,
            elevation: 157
          }]
        })
      };
    }
    if (url.includes('api.open-meteo.com')) {
      return {
        ok: true,
        json: async () => ({
          current: {
            temperature_2m: 14.5,
            relative_humidity_2m: 65,
            precipitation: 0.0,
            wind_speed_10m: 12.3,
            time: '2026-10-22T10:00'
          },
          daily: {
            time: ['2026-10-22'],
            temperature_2m_max: [17.0],
            temperature_2m_min: [9.0],
            precipitation_sum: [0.0]
          }
        })
      };
    }
    throw new Error('Unknown URL: ' + url);
  };

  const res = await fetchWeather('Bratislava', { fetchImpl: stubFetch });
  assert.equal(res.available, true);
  assert.equal(res.location.name, 'Bratislava');
  assert.equal(res.current.temperature_c, 14.5);
  assert.equal(res.source, 'Open-Meteo & WMO');
  assert.equal(res.verified_truth, true);
});

test('fetchWeather fails gracefully on unknown place without hallucinating', async () => {
  const stubFetch = async () => ({
    ok: true,
    json: async () => ({ results: [] })
  });
  const res = await fetchWeather('NeznameMestoXYZ', { fetchImpl: stubFetch });
  assert.equal(res.available, false);
  assert.ok(res.reason.includes('nebola nájdená'));
});

test('fetchWikipedia returns encyclopedic extract with stubbed fetch', async () => {
  const stubFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      title: 'Bratislava',
      description: 'hlavné mesto Slovenska',
      extract: 'Bratislava je hlavné mesto Slovenska...',
      content_urls: { desktop: { page: 'https://sk.wikipedia.org/wiki/Bratislava' } }
    })
  });

  const res = await fetchWikipedia('Bratislava', { fetchImpl: stubFetch });
  assert.equal(res.available, true);
  assert.equal(res.title, 'Bratislava');
  assert.equal(res.source, 'Wikimedia / Wikipédia');
  assert.equal(res.verified_truth, true);
});

test('fetchWikipedia handles 404 cleanly', async () => {
  const stubFetch = async () => ({
    ok: false,
    status: 404
  });
  const res = await fetchWikipedia('NonExistentPage12345678', { fetchImpl: stubFetch });
  assert.equal(res.available, false);
  assert.ok(res.reason.includes('nebol na Wikipédii'));
});

test('resolveDns queries Cloudflare DoH and parses DNSSEC answers', async () => {
  const stubFetch = async () => ({
    ok: true,
    json: async () => ({
      Status: 0,
      AD: true,
      Answer: [
        { name: 'auru.space', type: 1, TTL: 300, data: '104.21.0.147' },
        { name: 'auru.space', type: 1, TTL: 300, data: '172.67.186.8' }
      ]
    })
  });

  const res = await resolveDns('auru.space', 'A', { fetchImpl: stubFetch });
  assert.equal(res.available, true);
  assert.equal(res.status, 'NOERROR');
  assert.equal(res.dnssec_validated, true);
  assert.equal(res.answers.length, 2);
  assert.equal(res.source, 'Cloudflare 1.1.1.1 DoH');
});

test('fetchCryptoMarkets retrieves real spot prices from DefiLlama', async () => {
  const stubFetch = async () => ({
    ok: true,
    json: async () => ({
      coins: {
        'coingecko:bitcoin': { price: 82000.5, symbol: 'BTC', confidence: 0.99, timestamp: 1792659000 },
        'coingecko:ethereum': { price: 2450.0, symbol: 'ETH', confidence: 0.99, timestamp: 1792659000 }
      }
    })
  });

  const res = await fetchCryptoMarkets(['bitcoin', 'ethereum'], { fetchImpl: stubFetch });
  assert.equal(res.available, true);
  assert.equal(res.coins.length, 2);
  assert.equal(res.coins[0].symbol, 'BTC');
  assert.equal(res.coins[0].price_usd, 82000.5);
  assert.equal(res.source, 'DefiLlama Open API');
});

test('fetchTechNews parses top stories from Hacker News', async () => {
  const stubFetch = async (url) => {
    if (url.includes('topstories.json')) {
      return {
        ok: true,
        json: async () => [101, 102]
      };
    }
    if (url.includes('item/101.json')) {
      return {
        ok: true,
        json: async () => ({
          id: 101,
          title: 'Quantum Computing breakthrough',
          url: 'https://example.com/quantum',
          by: 'alice',
          score: 350,
          descendants: 45,
          time: 1792650000
        })
      };
    }
    if (url.includes('item/102.json')) {
      return {
        ok: true,
        json: async () => ({
          id: 102,
          title: 'New Web Standards in 2026',
          url: 'https://example.com/web',
          by: 'bob',
          score: 120,
          descendants: 12,
          time: 1792651000
        })
      };
    }
    throw new Error('Unknown url: ' + url);
  };

  const res = await fetchTechNews(2, { fetchImpl: stubFetch });
  assert.equal(res.available, true);
  assert.equal(res.stories.length, 2);
  assert.equal(res.stories[0].title, 'Quantum Computing breakthrough');
  assert.equal(res.source, 'Hacker News (Y Combinator)');
});

test('fetchWorldBankIndicator retrieves verified macroeconomic records', async () => {
  const stubFetch = async () => ({
    ok: true,
    json: async () => [
      { page: 1, total: 2 },
      [
        {
          indicator: { id: 'NY.GDP.MKTP.CD', value: 'GDP (current US$)' },
          country: { id: 'SK', value: 'Slovak Republic' },
          date: '2025',
          value: 154530066500
        }
      ]
    ]
  });

  const res = await fetchWorldBankIndicator('SVK', 'NY.GDP.MKTP.CD', { fetchImpl: stubFetch });
  assert.equal(res.available, true);
  assert.equal(res.country_code, 'SVK');
  assert.equal(res.records.length, 1);
  assert.equal(res.records[0].value, 154530066500);
  assert.equal(res.source, 'World Bank Open Data');
});
