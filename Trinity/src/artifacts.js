import { z } from 'zod';
import { HttpError } from './security.js';

export const MIME_TYPES = {
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  py: 'text/x-python; charset=utf-8',
  json: 'application/json; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  ts: 'text/typescript; charset=utf-8',
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  sql: 'application/sql; charset=utf-8',
  sh: 'application/x-sh; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  yaml: 'application/yaml; charset=utf-8',
  yml: 'application/yaml; charset=utf-8',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml; charset=utf-8',
  mp3: 'audio/mpeg',
  zip: 'application/zip'
};

export function guessContentType(filename) {
  if (!filename) return 'application/octet-stream';
  const ext = String(filename).split('.').pop()?.toLowerCase() || '';
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export function sanitizeFilename(filename) {
  const base = String(filename || 'subor.txt').split(/[/\\]/).pop() || 'subor.txt';
  const clean = base
    .replace(/[^a-zA-Z0-9._\-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .trim();
  return clean || 'subor.txt';
}

/**
 * Čistý JavaScript generátor PDF 1.4 bez externých závislostí pre Cloudflare Workers.
 */
export function generateSimplePdf({
  title = 'Dokument',
  author = 'Trinity AI',
  content = '',
  date = new Date().toLocaleDateString('sk-SK')
} = {}) {
  function cleanText(str) {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\\()]/g, '\\$&')
      .replace(/[\r\n\t]/g, ' ');
  }

  const maxLineLen = 80;
  const rawParagraphs = String(content || '').split('\n');
  const lines = [];

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }
    const words = trimmed.split(/\s+/);
    let curLine = '';
    for (const w of words) {
      if ((curLine + ' ' + w).trim().length <= maxLineLen) {
        curLine = (curLine + ' ' + w).trim();
      } else {
        if (curLine) lines.push(curLine);
        curLine = w;
      }
    }
    if (curLine) lines.push(curLine);
  }

  const linesPerPage = 42;
  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push(['']);

  const totalPages = pages.length;
  const objects = [];

  function addObject(c) {
    objects.push(c);
    return objects.length;
  }

  objects.push(null); // 1: Catalog
  objects.push(null); // 2: Pages
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'); // 3: Font F1
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'); // 4: Font F2

  const pageObjIds = [];

  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const pageLines = pages[pIdx];
    const isFirstPage = pIdx === 0;

    let stream = 'BT\n';

    if (isFirstPage) {
      stream += '/F2 20 Tf\n';
      stream += `50 780 Td\n`;
      stream += `(${cleanText(title)}) Tj\n`;

      stream += '/F1 10 Tf\n';
      stream += `0 -20 Td\n`;
      stream += `(Autor: ${cleanText(author)}  |  Datum: ${cleanText(date)}) Tj\n`;

      stream += `ET\n`;
      stream += `0.7 0.7 0.7 RG\n1 w\n50 745 m 545 745 l S\n`;
      stream += `BT\n`;
      stream += `/F1 11 Tf\n`;
      stream += `50 725 Td\n`;
    } else {
      stream += '/F1 9 Tf\n';
      stream += `50 800 Td\n`;
      stream += `(${cleanText(title)} - Pokracovanie) Tj\n`;
      stream += `ET\n`;
      stream += `0.8 0.8 0.8 RG\n0.5 w\n50 790 m 545 790 l S\n`;
      stream += `BT\n`;
      stream += `/F1 11 Tf\n`;
      stream += `50 770 Td\n`;
    }

    for (let rIdx = 0; rIdx < pageLines.length; rIdx++) {
      const line = pageLines[rIdx];
      const isHeader = line.startsWith('# ') || line.startsWith('## ') || line.startsWith('### ');
      const cleanLine = cleanText(line.replace(/^#+\s*/, ''));

      if (rIdx > 0) {
        stream += `0 -15 Td\n`;
      }

      if (isHeader) {
        stream += `/F2 13 Tf\n`;
        stream += `(${cleanLine}) Tj\n`;
        stream += `/F1 11 Tf\n`;
      } else {
        stream += `(${cleanLine}) Tj\n`;
      }
    }

    stream += `ET\n`;
    stream += `0.8 0.8 0.8 RG\n0.5 w\n50 50 m 545 50 l S\n`;
    stream += `BT\n`;
    stream += `/F1 9 Tf\n`;
    stream += `50 35 Td\n`;
    stream += `(Vygenerovane systemom Trinity AI) Tj\n`;
    stream += `440 0 Td\n`;
    stream += `(Strana ${pIdx + 1} z ${totalPages}) Tj\n`;
    stream += `ET\n`;

    const streamBytes = new TextEncoder().encode(stream);
    const contentObjId = addObject(`<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`);
    const pageObjId = addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents ${contentObjId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`);
    pageObjIds.push(pageObjId);
  }

  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${pageObjIds.map(id => `${id} 0 R`).join(' ')}] /Count ${totalPages} >>`;

  let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = [];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const startXref = new TextEncoder().encode(pdf).length;
  pdf += 'xref\n';
  pdf += `0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }

  pdf += 'trailer\n';
  pdf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += 'startxref\n';
  pdf += `${startXref}\n`;
  pdf += '%%EOF\n';

  return new TextEncoder().encode(pdf);
}

/**
 * Uloží ľubovoľný súbor do Cloudflare R2 bucketu a zaeviduje ho v D1.
 */
export async function createArtifact(env, {
  filename,
  content,
  is_base64 = false,
  contentType = null,
  notes = null,
  createdBy = 'trinity'
}) {
  const bucket = env?.ARTIFACTS || env?.R2;
  if (!bucket) {
    throw new Error('R2 archív (ARTIFACTS) nie je nakonfigurovaný vo Workeri.');
  }

  const safeFilename = sanitizeFilename(filename);
  const id = crypto.randomUUID();
  const resolvedContentType = contentType || guessContentType(safeFilename);
  const r2Key = `artifacts/${id}/${safeFilename}`;

  let body;
  let sizeBytes = 0;

  if (content instanceof Uint8Array) {
    body = content;
    sizeBytes = content.byteLength;
  } else if (is_base64) {
    const raw = atob(String(content).trim());
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    body = bytes;
    sizeBytes = bytes.byteLength;
  } else {
    body = String(content);
    sizeBytes = new TextEncoder().encode(body).length;
  }

  await bucket.put(r2Key, body, {
    httpMetadata: { contentType: resolvedContentType },
    customMetadata: {
      id,
      filename: safeFilename,
      created_by: createdBy,
      notes: notes || ''
    }
  });

  const now = new Date().toISOString();

  // Záznam v D1 (ak existuje DB)
  if (env?.DB?.prepare) {
    try {
      await env.DB.prepare(`
        INSERT INTO ops_artifacts(id, filename, r2_key, content_type, size_bytes, created_by, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, safeFilename, r2Key, resolvedContentType, sizeBytes, createdBy, notes || null, now).run();
    } catch {
      // Ak tabuľka neexistuje, zapíšeme do ops_events
      try {
        await env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('artifact_created', ?)")
          .bind(JSON.stringify({ id, filename: safeFilename, r2_key: r2Key, size_bytes: sizeBytes }))
          .run();
      } catch {
        // Tichý fallback
      }
    }
  }

  const url = `/api/assistant/files/${id}/${encodeURIComponent(safeFilename)}`;
  const downloadUrl = `${url}?download=1`;

  return {
    id,
    filename: safeFilename,
    path: r2Key,
    url,
    download_url: downloadUrl,
    content_type: resolvedContentType,
    size_bytes: sizeBytes,
    created_at: now,
    notes: notes || null
  };
}

/**
 * Špecializované vytvorenie PDF dokumentu a jeho uloženie do archívu.
 */
export async function createPdfArtifact(env, {
  filename,
  title,
  content,
  author = 'Trinity AI',
  notes = null,
  createdBy = 'trinity'
}) {
  let safeFilename = sanitizeFilename(filename || `${title || 'dokument'}.pdf`);
  if (!safeFilename.toLowerCase().endsWith('.pdf')) {
    safeFilename += '.pdf';
  }

  const pdfBytes = generateSimplePdf({
    title: title || 'Dokument',
    author: author || 'Trinity AI',
    content: content || ''
  });

  return await createArtifact(env, {
    filename: safeFilename,
    content: pdfBytes,
    contentType: 'application/pdf',
    notes: notes || `PDF dokument: ${title || safeFilename}`,
    createdBy
  });
}

/**
 * Zoznam evidovaných artefaktov z D1.
 */
export async function listArtifacts(env, { limit = 20, search = '' } = {}) {
  if (!env?.DB?.prepare) return [];
  const lim = Math.max(1, Math.min(Number(limit) || 20, 100));

  try {
    let query = 'SELECT * FROM ops_artifacts';
    const params = [];
    if (search && String(search).trim()) {
      query += ' WHERE filename LIKE ? OR notes LIKE ?';
      const pat = `%${String(search).trim()}%`;
      params.push(pat, pat);
    }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(lim);

    const rows = await env.DB.prepare(query).bind(...params).all();
    return (rows.results || []).map(r => ({
      id: r.id,
      filename: r.filename,
      path: r.r2_key,
      url: `/api/assistant/files/${r.id}/${encodeURIComponent(r.filename)}`,
      download_url: `/api/assistant/files/${r.id}/${encodeURIComponent(r.filename)}?download=1`,
      content_type: r.content_type,
      size_bytes: Number(r.size_bytes || 0),
      created_by: r.created_by,
      notes: r.notes,
      created_at: r.created_at
    }));
  } catch {
    return [];
  }
}

/**
 * Načítanie artefaktu podľa ID alebo cesty.
 */
export async function getArtifact(env, idOrKey) {
  const bucket = env?.ARTIFACTS || env?.R2;
  if (!bucket) throw new Error('R2 archív nie je dostupný.');

  let key = String(idOrKey).trim();
  let filename = 'subor';

  if (!key.startsWith('artifacts/')) {
    // Skúsime nájsť záznam v D1
    if (env?.DB?.prepare) {
      try {
        const row = await env.DB.prepare('SELECT * FROM ops_artifacts WHERE id = ?').bind(key).first();
        if (row) {
          key = row.r2_key;
          filename = row.filename;
        }
      } catch {}
    }
  }

  const object = await bucket.get(key);
  if (!object) {
    throw new HttpError(404, `Artefakt '${idOrKey}' nebol nájdený v R2 archíve.`);
  }

  const text = await object.text();
  return {
    key,
    filename: filename || key.split('/').pop(),
    content_type: object.httpMetadata?.contentType || 'application/octet-stream',
    size_bytes: object.size,
    content: text.length > 50000 ? text.slice(0, 50000) + '\n... [skrátené]' : text
  };
}
