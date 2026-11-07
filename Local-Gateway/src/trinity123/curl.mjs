import {spawn} from 'node:child_process';
import {redact, profile} from './config.mjs';

const quote = text => '"' + String(text).replaceAll('\\', '\\\\').replaceAll('"', '\\"')
  .replaceAll('\r', '\\r').replaceAll('\n', '\\n').replaceAll('\t', '\\t') + '"';

export class SSEParser {
  constructor(handler) { this.handler = handler; this.buffer = ''; this.data = []; this.size = 0; }
  async push(text, final = false) {
    this.buffer += text;
    if (this.buffer.length > 4_194_304) throw new Error('SSE udalosť prekročila povolenú veľkosť.');
    const lines = this.buffer.split('\n');
    this.buffer = final ? '' : lines.pop();
    for (const raw of lines) {
      const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
      if (line === '') await this.flush();
      else if (line.startsWith('data:')) {
        this.size += line.length;
        if (this.size > 4_194_304) throw new Error('SSE udalosť prekročila povolenú veľkosť.');
        this.data.push(line.slice(5).replace(/^ /, ''));
      }
    }
    if (final) await this.flush();
  }
  async flush() {
    if (!this.data.length) return;
    const text = this.data.join('\n'); this.data = []; this.size = 0;
    if (text === '[DONE]') return;
    let event;
    try { event = JSON.parse(text); } catch { throw new Error('API vrátilo neplatný SSE JSON.'); }
    await this.handler(event);
  }
}

export class CurlTransport {
  constructor({env = process.env, baseUrl = 'https://api.openai.com/v1', allowTestLoopback = false} = {}) {
    this.env = env;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    const url = new URL(this.baseUrl);
    this.testing = allowTestLoopback && url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname);
    if (!this.testing && this.baseUrl !== 'https://api.openai.com/v1') throw new Error('Povolený je iba oficiálny OpenAI API endpoint.');
  }
  request(method, resource, {body, stream = false, onEvent = async () => {}, idempotencyKey} = {}) {
    const key = this.env.OPENAI_API_KEY;
    if (typeof key !== 'string' || !key.trim() || /[\r\n\0]/.test(key)) {
      throw Object.assign(new Error('Chýba platný OPENAI_API_KEY. Živá relácia nebola spustená.'), {status: 503});
    }
    if (!resource.startsWith('/agents') || /[\r\n\0]/.test(resource)) throw new Error('Neplatná API cesta.');
    let resolveReady, rejectReady;
    const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    // An error can occur before a caller starts awaiting ready.
    ready.catch(() => {});
    const args = ['--disable', '--config', '-', '--silent', '--show-error', '--no-buffer',
      '--include', '--suppress-connect-headers', '--connect-timeout', '20', '--max-time', '900',
      '--proto', this.testing ? '=http' : '=https', '--request', method, '--url', this.baseUrl + resource];
    // Credentials travel through stdin, never argv, shell history, or a config file.
    let config = `header = ${quote('Authorization: Bearer ' + key)}\n` +
      `header = ${quote('OpenAI-Beta: agents=v1')}\n` +
      `header = ${quote('OpenAI-Project: ' + profile.project_id)}\n` +
      `header = ${quote('Content-Type: application/json')}\n` +
      `header = ${quote('Accept: ' + (stream ? 'text/event-stream' : 'application/json'))}\n`;
    if (idempotencyKey) config += `header = ${quote('Idempotency-Key: ' + idempotencyKey)}\n`;
    if (body !== undefined) config += `data-binary = ${quote(JSON.stringify(body))}\n`;
    const child = spawn(process.platform === 'win32' ? 'curl.exe' : 'curl', args,
      {windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'], env: this.env});
    let stopped = false, processError, stderr = '';
    child.on('error', error => { processError = error; rejectReady(error); });
    child.stdin.on('error', () => {});
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-16_000); });
    const exit = new Promise(resolve => {
      child.once('close', (code, signal) => resolve({code, signal}));
    });
    const stop = () => { stopped = true; child.kill(); };
    child.stdin.end(config); config = '';
    const result = (async () => {
      let headers = '', responseBody = '', status = 0, requestId = null;
      const decoder = new TextDecoder();
      const parser = new SSEParser(async event => {
        if (!stopped && await onEvent(event) === true) stop();
      });
      const consume = async text => {
        if (!status) {
          headers += text;
          while (!status) {
            const match = /\r?\n\r?\n/.exec(headers);
            if (!match) {
              if (headers.length > 64_000) throw new Error('API HTTP hlavičky sú príliš veľké.');
              return;
            }
            const block = headers.slice(0, match.index);
            const rest = headers.slice(match.index + match[0].length);
            const code = Number(/^HTTP\/\S+\s+(\d{3})/.exec(block)?.[1]);
            if (!code) throw new Error('Neplatná HTTP odpoveď z curl.');
            if (code < 200) { headers = rest; continue; }
            status = code;
            requestId = /^x-request-id:\s*(.+)$/im.exec(block)?.[1]?.trim() || null;
            headers = '';
            if (status >= 200 && status < 300) resolveReady({status, requestId});
            text = rest;
          }
        }
        if (stream && status >= 200 && status < 300) await parser.push(text);
        else {
          responseBody += text;
          if (responseBody.length > 8_388_608) throw new Error('API odpoveď prekročila povolenú veľkosť.');
        }
      };
      try {
        for await (const chunk of child.stdout) await consume(decoder.decode(chunk, {stream: true}));
        await consume(decoder.decode());
        if (stream && status >= 200 && status < 300 && !stopped) await parser.push('', true);
        const ended = await exit;
        if (processError) throw processError;
        if (!status || (ended.code !== 0 && !stopped)) throw new Error(`curl zlyhal (${ended.code}): ${stderr || 'spojenie prerušené'}`);
        if (status < 200 || status >= 300) {
          let detail;
          try { detail = JSON.parse(responseBody).error?.message; } catch {}
          throw Object.assign(new Error(`OpenAI HTTP ${status}: ${detail || responseBody.slice(0, 2000) || 'bez detailu'}`), {status, requestId});
        }
        if (stream) return {status, requestId};
        try { return responseBody ? JSON.parse(responseBody) : {}; }
        catch { throw new Error('API vrátilo neplatnú JSON odpoveď.'); }
      } catch (error) {
        child.kill();
        const safe = Object.assign(new Error(redact(error.message, this.env)), {status: error.status, requestId: error.requestId});
        rejectReady(safe); throw safe;
      }
    })();
    result.catch(() => {});
    return {ready, result, stop};
  }
  async json(method, resource, body, extra = {}) { return this.request(method, resource, {body, ...extra}).result; }
}
