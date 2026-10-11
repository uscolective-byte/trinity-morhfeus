export async function readCloudJSON(response, label = 'Cloud') {
  const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (mime !== 'application/json' && !/^application\/[a-z0-9.+-]+\+json$/.test(mime)) {
    throw new Error(`${label} HTTP ${response.status}: očakávaná JSON odpoveď; skontroluj adresu a ochranu Cloudflare.`);
  }
  let data;
  try { data = await response.json(); }
  catch { throw new Error(`${label} HTTP ${response.status}: neplatná JSON odpoveď.`); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} HTTP ${response.status}: odpoveď nemá očakávaný objektový formát.`);
  }
  if (!response.ok) {
    // Never echo a remote response body or credentials into local logs.
    throw new Error(`${label} HTTP ${response.status}: ${response.status === 401 ? 'vyžaduje autorizáciu' : response.status === 403 ? 'prístup odmietnutý; skontroluj oprávnenia a Cloudflare' : 'požiadavka zlyhala'}.`);
  }
  return data;
}