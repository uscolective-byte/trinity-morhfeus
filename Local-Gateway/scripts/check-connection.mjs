// Read-only diagnostics: no tokens, logins, installations, or queued actions.
const targets = [
  {name:'local',url:'http://127.0.0.1:8791/health'},
  {name:'mcp',url:'https://auru.space/mcp'}
];
const output = [];
for (const target of targets) {
  try {
    const response = await fetch(target.url, {
      headers:{Accept:'application/json'},
      redirect:'manual',
      signal:AbortSignal.timeout(10_000)
    });
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const isJSON = mime === 'application/json' || /^application\/[a-z0-9.+-]+\+json$/.test(mime);
    const row = {name:target.name,url:target.url,http_status:response.status,content_type:mime};
    if (target.name === 'local' && response.ok && isJSON) {
      const body = await response.json();
      if (body.service !== 'Trinity Local Gateway') throw new Error('Unexpected local service');
      for (const key of ['status','synchronization','local_auth','cloud','pc_bridge']) {
        if (typeof body[key] === 'string') row[key] = body[key].slice(0,100);
      }
    } else if (response.status === 401 && isJSON) {
      row.status = 'authentication-required';
    } else if (response.status === 403) {
      row.status = 'access-denied-or-cloudflare-protection';
    } else if (!isJSON) {
      row.status = 'not-api-response';
    } else {
      row.status = 'unexpected-response';
    }
    output.push(row);
  } catch {
    output.push({name:target.name,url:target.url,status:'unreachable-or-invalid-response'});
  }
}
console.log(JSON.stringify({diagnostic:'read-only',checks:output},null,2));