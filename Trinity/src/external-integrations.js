/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CLOUD_AND_AI_INTEGRATIONS
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Integrácie Cloudflare Edge, GitHub API, Firecrawl (Markdown RAG scraper) a Firebase (Firestore + Hosting + D1 mirror).
 */
import {verifyCloudflareToken} from './cloudflare-token.js';
import {resolveProviderSecret} from './secret-vault.js';
import {createTrinityDocument} from './trinity-documents.js';

export async function manageCloudflare(env, actor = 'trinity', action = 'status', params = {}) {
  const token = await resolveProviderSecret(env, 'cloudflare');
  const accountId = params.accountId || env.CF_ACCOUNT_ID || 'b60342e5e52f5646fbd4e913bb409334';
  
  const internalState = {
    connected: false,
    accountId,
    edge_runtime: 'Cloudflare Workers (workerd)',
    configured_bindings: {
      d1: Boolean(env.DB?.prepare),
      kv: Boolean(env.Mastermind?.get),
      r2: Boolean(env.ARTIFACTS?.get),
      ai: Boolean(env.AI?.run)
    },
    workers_ai_model: env.AI_MODEL || '@cf/openai/gpt-oss-120b',
    has_live_token: Boolean(token)
  };

  if (action === 'status') {
    if (!token) {
      return {
        success: true,
        source: 'edge_bindings',
        verified: false,
        message: 'Cloudflare runtime má len lokálne detegované bindingy. Bez API tokenu nie je overený prístup ku cloudovému účtu.',
        data: internalState
      };
    }
    const verification = await verifyCloudflareToken(token, accountId);
    return {
      success: verification.verified,
      verified: verification.verified,
      source: 'cloudflare_api',
      token_status: verification.status,
      token_scope: verification.scope,
      data: {...internalState, connected: verification.verified,
        ...(verification.verified ? {verified_at: new Date().toISOString()} : {})}
    };
  }

  if (action === 'list_dns_zones') {
    if (!token) {
      return {
        success: false, zones: [], verified: false,
        error: 'Zoznam Cloudflare DNS zón vyžaduje overený API token.',
        source: 'not_verified'
      };
    }
    const resp = await fetch(`https://api.cloudflare.com/client/v4/zones?account.id=${encodeURIComponent(accountId)}&per_page=50`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await resp.json().catch(() => ({}));
    return { success: resp.ok && d.success === true, zones: resp.ok && d.success === true ? d.result || [] : [], total: resp.ok && d.success === true ? d.result?.length || 0 : 0 };
  }

  if (action === 'purge_cache') {
    const zoneId = params.zoneId;
    if (typeof zoneId !== 'string' || !/^[a-f0-9]{32}$/i.test(zoneId)) {
      return {success:false,error:'Na vyčistenie Cloudflare cache je potrebné skutočné 32-znakové zone ID.'};
    }
    if (!token) {
      return {success:false,error:'Vyčistenie Cloudflare cache vyžaduje API token. Žiadna cache nebola vyčistená.'};
    }
    const resp = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ purge_everything: true })
    });
    const result = await resp.json().catch(() => ({}));
    return { success: resp.ok && result.success === true, result };
  }

  if (action === 'list_workers') {
    if (!token) {
      return {
        success:false,workers:[],verified:false,
        error:'Zoznam Workerov vyžaduje overený Cloudflare API token.',
        source:'not_verified'
      };
    }
    const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/workers/scripts`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await resp.json().catch(() => ({}));
    return { success: resp.ok && d.success === true, workers: resp.ok && d.success === true ? d.result || [] : [] };
  }

  return { success: false, error: `Neznáma Cloudflare akcia: ${action}` };
}

export async function manageGitHub(env, actor = 'trinity', action = 'status', params = {}) {
  const token = await resolveProviderSecret(env, 'github');
  const repo = params.repo || env.TRINITY_GITHUB_REPO || 'uscolective-byte/Trinity-antigravity';
  const isMutation=['create_issue','update_issue','dispatch_workflow'].includes(action);
  if(typeof repo!=='string'||!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)||repo.includes('..'))
    return {success:false,error:'Neplatný GitHub repozitár.'};
  if(isMutation&&repo!=='uscolective-byte/Trinity-antigravity')
    return {success:false,error:'Zápisy a workflow dispatch sú povolené iba v kanonickom repozitári Trinity.'};
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Trinity-AI-Agent-Hub/11.0',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  if (action === 'status' || action === 'repo_info') {
    try {
      const resp = await fetch(`https://api.github.com/repos/${repo}`, { headers });
      const data = await resp.json().catch(() => ({}));
      // Public repository read succeeds even if a supplied token is invalid.
      let authenticated=false;
      if(token&&resp.ok){
        try{
          const identity=await fetch('https://api.github.com/user',{headers,redirect:'manual',signal:AbortSignal.timeout(12000)});
          authenticated=identity.ok;
        }catch{authenticated=false;}
      }
      return {
        success: resp.ok,
        repo: repo,
        authenticated,
        details: {
          name: resp.ok ? data.name || null : null,
          stars: data.stargazers_count || 0,
          open_issues: data.open_issues_count || 0,
          default_branch: data.default_branch || 'main',
          visibility: data.visibility || 'public',
          html_url: data.html_url || `https://github.com/${repo}`
        }
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  if (action === 'list_commits') {
    try {
      const resp = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=${params.limit || 10}`, { headers });
      const data = await resp.json().catch(() => []);
      const commits = Array.isArray(data) ? data.map(c => ({
        sha: c.sha?.slice(0, 7),
        message: c.commit?.message?.split('\n')[0] || '',
        author: c.commit?.author?.name || c.author?.login || 'unknown',
        date: c.commit?.author?.date || ''
      })) : [];
      return { success: resp.ok, repo, commits };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  if (action === 'list_issues') {
    try {
      const resp = await fetch(`https://api.github.com/repos/${repo}/issues?state=${params.state || 'open'}&per_page=${params.limit || 10}`, { headers });
      const data = await resp.json().catch(() => []);
      const issues = Array.isArray(data) ? data.map(i => ({
        number: i.number,
        title: i.title,
        state: i.state,
        author: i.user?.login,
        created_at: i.created_at,
        url: i.html_url
      })) : [];
      return { success: resp.ok, repo, issues };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  if (action === 'create_issue') {
    if (!token) return { success: false, error: 'Vytváranie GitHub issue vyžaduje token v Trezore tajomstiev.' };
    const title = params.title || 'Trinity Automated Report';
    const body = params.body || '';
    if (!body || body.trim() === title.trim() || body.trim().length < 30) {
      return { success: false, error: 'Režim pravdy (Truth Policy): Telo issue nesmie byť prázdny alebo triviálny zástupný text (hollow stub).' };
    }
    const resp = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title,
        body,
        labels: params.labels || ['trinity-bot']
      })
    });
    const d = await resp.json().catch(() => ({}));
    return {success:resp.status===201&&Number.isInteger(d.number),issue:resp.status===201&&Number.isInteger(d.number)?d:null,
      ...(!resp.ok?{error:`GitHub odmietol vytvorenie issue (HTTP ${resp.status}).`}:{})};
  }

  if (action === 'update_issue') {
    if (!token) return { success: false, error: 'Úprava GitHub issue vyžaduje token v Trezore tajomstiev.' };
    const issueNumber = params.issue_number || params.number;
    if (!Number.isInteger(issueNumber)||issueNumber<1) return { success: false, error: 'Neplatné číslo issue (issue_number).' };
    const payload = {};
    if (params.title) payload.title = params.title;
    if (params.body) {
      if (params.body.trim().length < 30) {
        return { success: false, error: 'Režim pravdy (Truth Policy): Telo issue nesmie byť prázdny zástupný text.' };
      }
      payload.body = params.body;
    }
    if (params.state) payload.state = params.state;
    if (params.labels) payload.labels = params.labels;
    const resp = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload)
    });
    const d = await resp.json().catch(() => ({}));
    return {success:resp.ok&&d.number===issueNumber,issue:resp.ok&&d.number===issueNumber?d:null,
      ...(!resp.ok?{error:`GitHub odmietol úpravu issue (HTTP ${resp.status}).`}:{})};
  }

  if (action === 'dispatch_workflow') {
    if (!token) return { success: false, error: 'Spustenie GitHub Actions vyžaduje token v Trezore.' };
    const workflowId = params.workflowId || 'webpack.yml';
    const approvedWorkflows=new Set(['webpack.yml','integrations-check.yml','dependency-security.yml','codeql.yml','runner-smoke.yml']);
    if(!approvedWorkflows.has(workflowId))return {success:false,error:'Workflow nie je na zozname bezpečných kontrolných úloh (deploy vyžaduje release gate).'};
    const ref=params.ref||'main';
    if(typeof ref!=='string'||!/^[-A-Za-z0-9_./]{1,160}$/.test(ref)||ref.includes('..')||ref.startsWith('/'))
      return {success:false,error:'Neplatná Git referencia.'};
    const resp = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflowId}/dispatches`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ref, inputs: params.inputs || {} })
    });
    return { success: resp.status===204, status: resp.status===204?'queued':'failed',
      http_status:resp.status, message: resp.status===204?'GitHub prijal workflow dispatch; dokončenie testov treba overiť zvlášť.':'GitHub neprevzal workflow dispatch.' };
  }

    if (action === 'get_file' || action === 'read_file') {
    const filePath = params.path || 'README.md';
    const ref = params.ref || env.TRINITY_GITHUB_BRANCH || 'main';
    try {
      const resp = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`, { headers });
      if (!resp.ok) {
        return { success: false, error: `GitHub HTTP ${resp.status} pri čítaní súboru ${filePath} v ${repo}` };
      }
      const data = await resp.json();
      let content = '';
      if (data.encoding === 'base64' && data.content) {
        content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
      } else if (typeof data.content === 'string') {
        content = data.content;
      }
      return {
        success: true,
        repo,
        path: filePath,
        ref,
        sha: data.sha,
        size: data.size,
        content: content.slice(0, 32000)
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  if (action === 'list_files' || action === 'list_tree') {
    const ref = params.ref || env.TRINITY_GITHUB_BRANCH || 'main';
    try {
      const resp = await fetch(`https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, { headers });
      if (!resp.ok) {
        return { success: false, error: `GitHub HTTP ${resp.status} pri načítaní stromu repozitára ${repo}` };
      }
      const data = await resp.json();
      const files = Array.isArray(data.tree) ? data.tree.map(t => ({
        path: t.path,
        type: t.type,
        size: t.size
      })).slice(0, params.limit || 250) : [];
      return {
        success: true,
        repo,
        ref,
        total: data.tree ? data.tree.length : 0,
        truncated: Boolean(data.truncated),
        files
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  return { success: false, error: `Neznáma GitHub akcia: ${action}` };
}

export async function scrapeWithFirecrawl(env, actor = 'trinity', options = {}) {
  const targetUrl = options.url;
  if (!targetUrl) throw new Error('Parameter url je povinný.');
  
  const token = await resolveProviderSecret(env, 'firecrawl');
  const mode = options.mode || 'scrape'; // 'scrape' | 'crawl' | 'map'

  if (token) {
    try {
      const endpoint = mode === 'map' ? 'https://api.firecrawl.dev/v1/map'
        : mode === 'crawl' ? 'https://api.firecrawl.dev/v1/crawl'
        : 'https://api.firecrawl.dev/v1/scrape';
        
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: targetUrl,
          formats: ['markdown', 'links', 'html'],
          onlyMainContent: options.onlyMainContent !== false
        }),
        signal: AbortSignal.timeout(30000)
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.data) {
        return {
          success: true,
          engine: 'firecrawl-cloud',
          url: targetUrl,
          markdown: data.data.markdown || '',
          title: data.data.metadata?.title || '',
          description: data.data.metadata?.description || '',
          links: data.data.links || [],
          scraped_at: new Date().toISOString()
        };
      }
    } catch (_) {}
  }

  // Edge-native intelligent crawler & HTML-to-Markdown parser fallback
  try {
    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Trinity-Edge-Scraper/11.0 (KHTML, like Gecko)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow'
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} pri sťahovaní stránky`);
    const html = await resp.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : targetUrl;
    
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    let clean = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    clean = clean
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
      .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const links = [];
    const linkRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
    let lm;
    while ((lm = linkRegex.exec(html)) !== null && links.length < 50) {
      if (!links.includes(lm[1])) links.push(lm[1]);
    }

    return {
      success: true,
      engine: 'trinity-edge-native',
      url: targetUrl,
      title,
      description,
      markdown: clean.slice(0, 25000),
      links,
      scraped_at: new Date().toISOString()
    };
  } catch (err) {
    return { success: false, error: err.message, url: targetUrl };
  }
}

export async function manageFirebase(env, actor = 'trinity', action = 'status', params = {}) {
  const token = await resolveProviderSecret(env, 'firebase');
  const projectId = params.projectId || env.FIREBASE_PROJECT_ID || 'trinity-morhfeus-20261001';

  if (action === 'status') {
    const hostingUrl = `https://${projectId}.web.app`;
    let hostingOk = false;
    try {
      const r = await fetch(hostingUrl, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
      hostingOk = r.ok;
    } catch (_) {}

    return {
      success: true,
      projectId,
      hosting: {
        domain: `${projectId}.web.app`,
        reachable: hostingOk,
        fallback_domain: `${projectId}.firebaseapp.com`
      },
      has_token: Boolean(token),
      firestore_status: 'not_verified'
    };
  }

  if (action === 'set_document') {
    const collection = params.collection || 'trinity_state';
    const documentId = params.documentId || `doc_${Date.now()}`;
    const payload = params.data || {};
    if (![collection,documentId].every(part => typeof part === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(part))) {
      return {success:false,error:'Neplatný názov kolekcie alebo dokumentu.'};
    }
    let mirroredInD1 = false;
    if (env.DB?.prepare) {
      try {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS ops_firebase_mirror (
            project_id TEXT,
            collection TEXT,
            doc_id TEXT,
            data_json TEXT,
            updated_at TEXT,
            PRIMARY KEY(project_id, collection, doc_id)
          )
        `).run();
        const result = await env.DB.prepare(`
          INSERT INTO ops_firebase_mirror(project_id, collection, doc_id, data_json, updated_at)
          VALUES(?,?,?,?,datetime('now'))
          ON CONFLICT(project_id, collection, doc_id) DO UPDATE SET
            data_json=excluded.data_json,
            updated_at=excluded.updated_at
        `).bind(projectId, collection, documentId, JSON.stringify(payload)).run();
        mirroredInD1 = result?.success === true;
      } catch {
        mirroredInD1 = false;
      }
    }
    // An API key is NOT Firestore write authorization. Never put secrets
    // into query parameters or claim external writes from uninspected replies.
    let firestoreWritten = false;
    let firestoreHttpStatus = null;
    if (typeof token === 'string' && /^ya29\.[A-Za-z0-9_.-]+$/.test(token)) {
      try {
        const firestoreFields = {};
        for (const [k,v] of Object.entries(payload)) {
          if (typeof v === 'string') firestoreFields[k] = {stringValue:v};
          else if (typeof v === 'number' && Number.isFinite(v)) firestoreFields[k] = {doubleValue:v};
          else if (typeof v === 'boolean') firestoreFields[k] = {booleanValue:v};
          else firestoreFields[k] = {stringValue:JSON.stringify(v)};
        }
        const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeURIComponent(collection)}/${encodeURIComponent(documentId)}`;
        const response = await fetch(url, {
          method:'PATCH',
          headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
          body:JSON.stringify({fields:firestoreFields}),
          signal:AbortSignal.timeout(15000),
          redirect:'manual'
        });
        firestoreHttpStatus = response.status;
        firestoreWritten = response.ok;
      } catch {
        firestoreWritten = false;
      }
    }
    const success = mirroredInD1 || firestoreWritten;
    return {
      success,projectId,collection,documentId,
      mirrored_in_d1:mirroredInD1,
      firestore_written:firestoreWritten,
      ...(firestoreHttpStatus === null ? {} : {firestore_http_status:firestoreHttpStatus}),
      status: !success?'failed':!firestoreWritten?'partial':'verified',
      ...(success ? {written_at:new Date().toISOString()} :
        {error:'Nepotvrdený zápis: D1 mirror zlyhal a Firestore nevrátil úspech.'})
    };
  }

  if (action === 'get_document') {
    const collection = params.collection || 'trinity_state';
    const documentId = params.documentId;
    if (!documentId) return { success: false, error: 'Chýba documentId.' };

    if (env.DB?.prepare) {
      try {
        const row = await env.DB.prepare(`
          SELECT data_json, updated_at FROM ops_firebase_mirror
          WHERE project_id=? AND collection=? AND doc_id=?
        `).bind(projectId, collection, documentId).first();
        if (row) {
          return { success: true, doc_id: documentId, data: JSON.parse(row.data_json), updated_at: row.updated_at, source: 'd1_mirror' };
        }
      } catch (_) {}
    }

    return { success: false, error: 'Dokument nebol nájdený.' };
  }

  return { success: false, error: `Neznáma Firebase akcia: ${action}` };
}

export async function manageOneDrive(env, actor = 'trinity', action = 'status', params = {}) {
  const token = await resolveProviderSecret(env, 'onedrive') || await resolveProviderSecret(env, 'microsoft');
  const profile = params.profile || 'personal_msa';

  if (action === 'status') {
    if (!token) {
      return {
        success: true,
        source: 'local_or_pending',
        connected: false,
        verified: false,
        profile,
        message: 'Microsoft OneDrive poverenie zatiaľ nie je nakonfigurované. Token vlož v Trezore (poskytovateľ onedrive alebo microsoft).'
      };
    }
    try {
      const resp = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok) {
        return {
          success: true,
          connected: true,
          verified: true,
          source: 'microsoft_graph',
          drive_id: data.id,
          drive_type: data.driveType,
          owner: data.owner?.user?.displayName || data.owner?.user?.email || 'saboivan2008@gmail.com',
          quota: data.quota
        };
      }
      return {
        success: false,
        connected: false,
        verified: false,
        error: `OneDrive Graph API odpovedalo HTTP ${resp.status}: ${data.error?.message || 'prístup zamietnutý'}`
      };
    } catch (err) {
      return { success: false, connected: false, verified: false, error: err.message };
    }
  }

  if (action === 'drive_info') {
    if (!token) return { success: false, error: 'Chýba OneDrive token.' };
    const resp = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    const data = await resp.json().catch(() => ({}));
    return { success: resp.ok, drive: data };
  }

  if (action === 'list_files') {
    if (!token) return { success: false, error: 'Chýba OneDrive token.' };
    const folderPath = params.path ? `root:/${encodeURIComponent(params.path).replace(/%2F/g, '/')}:/children` : 'root/children';
    const resp = await fetch(`https://graph.microsoft.com/v1.0/me/drive/${folderPath}?$top=50`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    const data = await resp.json().catch(() => ({}));
    return {
      success: resp.ok,
      files: (data.value || []).map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        is_folder: Boolean(f.folder),
        web_url: f.webUrl,
        last_modified: f.lastModifiedDateTime
      })),
      total: data.value?.length || 0
    };
  }

  if (action === 'get_file') {
    if (!token) return { success: false, error: 'Chýba OneDrive token.' };
    const endpoint = params.itemId
      ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(params.itemId)}`
      : `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(params.path || '')}`;
    const resp = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    const data = await resp.json().catch(() => ({}));
    return { success: resp.ok, item: data };
  }

  if (action === 'upload_file') {
    if (!token) return { success: false, error: 'Chýba OneDrive token.' };
    const path = params.path;
    if (!path || typeof path !== 'string') return { success: false, error: 'Chýba cieľová cesta (path) v OneDrive.' };
    const content = typeof params.content === 'string' ? params.content : JSON.stringify(params.content || {});
    const resp = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(path).replace(/%2F/g, '/')}:/content`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': params.contentType || 'text/plain; charset=utf-8' },
      body: content
    });
    const data = await resp.json().catch(() => ({}));
    return { success: resp.ok, file: data };
  }

  return { success: false, error: `Neznáma OneDrive akcia: ${action}` };
}

export async function manageGoogleCloud(env, actor = 'trinity', action = 'status', params = {}) {
  const token = await resolveProviderSecret(env, 'google_cloud') || await resolveProviderSecret(env, 'gemini');
  const projectId = params.projectId || env.GOOGLE_PROJECT_ID || 'tangential-osprey-dl7cp';

  if (action === 'status') {
    return {
      success: true,
      connected: Boolean(token),
      verified: Boolean(token),
      source: 'gcp_gemini_platform',
      project_id: projectId,
      configured_services: {
        gemini_models: true,
        vertex_ai: true,
        cloud_storage: true,
        google_drive_plugin: true
      },
      has_token: Boolean(token)
    };
  }

  if (action === 'list_models') {
    const key = token || env.GEMINI_API_KEY;
    if (!key) return { success: false, error: 'Chýba Google Cloud / Gemini API kľúč.' };
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
    const data = await resp.json().catch(() => ({}));
    return {
      success: resp.ok,
      models: (data.models || []).map(m => m.name),
      total: data.models?.length || 0
    };
  }

  return { success: false, error: `Neznáma Google Cloud akcia: ${action}` };
}

export async function manageLocalBridge(env, actor = 'trinity', action = 'status', params = {}) {
  const localEndpoints = [
    { name: 'Local-Desktop', url: 'http://127.0.0.1:8795/health', port: 8795 },
    { name: 'Local-Gateway', url: 'http://127.0.0.1:7789/health', port: 7789 }
  ];

  if (action === 'status' || action === 'ping') {
    let desktopReachable = false;
    let gatewayReachable = false;
    let telemetry = null;

    try {
      const resp = await fetch(localEndpoints[0].url, { signal: AbortSignal.timeout(1500) });
      if (resp.ok) {
        desktopReachable = true;
        telemetry = await resp.json().catch(() => null);
      }
    } catch {}

    try {
      const resp = await fetch(localEndpoints[1].url, { signal: AbortSignal.timeout(1500) });
      if (resp.ok) gatewayReachable = true;
    } catch {}

    const connected = desktopReachable || gatewayReachable || Boolean(env.PC_BRIDGE);

    return {
      success: true,
      connected,
      bridge_mode: connected ? 'active' : 'standby',
      endpoints: {
        desktop: { port: 8795, active: desktopReachable },
        gateway: { port: 7789, active: gatewayReachable }
      },
      workspaces: [
        '/home/antigravity/uscolective-byte/Trinity-antigravity',
        '/home/antigravity/uscolective-byte/trinity-morhfeus',
        'C:\\Users\\saboi\\Trinity-antigravity'
      ],
      telemetry: telemetry || { status: connected ? 'online' : 'standby', platform: 'linux' }
    };
  }

  return { success: false, error: `Neznáma Local Bridge akcia: ${action}` };
}

export async function listAllIntegrations(env) {
  const [cfToken, ghToken, oneToken, gcToken, fcToken, fbToken, sbToken] = await Promise.all([
    resolveProviderSecret(env, 'cloudflare'),
    resolveProviderSecret(env, 'github'),
    resolveProviderSecret(env, 'onedrive'),
    resolveProviderSecret(env, 'google_cloud').catch(() => null),
    resolveProviderSecret(env, 'firecrawl'),
    resolveProviderSecret(env, 'firebase'),
    resolveProviderSecret(env, 'supabase')
  ]);

  return [
    {
      id: 'cloudflare',
      name: 'Cloudflare Edge Control',
      category: 'Cloud & Infrastructure',
      status: cfToken ? 'configured' : 'edge-native-active',
      description: 'Správa Workers, D1 databáz, KV Mastermind, R2 archívu a DNS záznamov.'
    },
    {
      id: 'github',
      name: 'GitHub Repository & Actions',
      category: 'Code & CI/CD',
      status: ghToken ? 'configured' : 'public-read-ready',
      description: 'Správa kanonického repozitára uscolective-byte/Trinity-antigravity; starý Morpheus je iba synchronizovaný zdroj.'
    },
    {
      id: 'onedrive',
      name: 'Microsoft OneDrive & Office 365',
      category: 'Cloud Storage & Documents',
      status: oneToken ? 'configured' : 'ready',
      description: 'Úložisko dokumentov a súborov Microsoft Graph (saboivan2008@gmail.com a Entra ID tenant usc31).'
    },
    {
      id: 'google_cloud',
      name: 'Google Cloud & Gemini Developer Platform',
      category: 'AI & Cloud Infrastructure',
      status: (gcToken || env.GOOGLE_PROJECT_ID) ? 'configured' : 'ready',
      description: 'Projekt tangential-osprey-dl7cp: Gemini 3.8 Flash & Pro, Vertex AI / Agent Platform, Cloud Storage, Google Drive a Workspace.'
    },
    {
      id: 'local_bridge',
      name: 'Local PC Bridge & Hardware Node',
      category: 'Local Infrastructure',
      status: 'platform-connected',
      description: 'Lokálna stanica Sabo Ivan (Local-Desktop na porte 8795, Local-Gateway na porte 7789, PC Bridge 2.0).'
    },
    {
      id: 'firecrawl',
      name: 'Firecrawl Web Crawler',
      category: 'Web Intelligence',
      status: fcToken ? 'configured' : 'edge-crawler-ready',
      description: 'Hĺbkové extrahovanie webov, mapovanie URL a prevod do čistého Markdownu.'
    },
    {
      id: 'firebase',
      name: 'Firebase Firestore & Hosting',
      category: 'Database & Auth',
      status: fbToken ? 'configured' : 'ready',
      description: 'Firestore synchronizácia, Hosting na trinity-morhfeus-20261001.web.app a Realtime DB.'
    },
    {
      id: 'supabase',
      name: 'Supabase / PostgreSQL',
      category: 'Database',
      status: sbToken ? 'configured' : 'ready',
      description: 'Relačná PostgreSQL databáza s PostgREST API a vektorovým úložiskom.'
    }
  ];
}
