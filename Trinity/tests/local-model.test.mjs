import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {LOCAL_MODEL_PROFILE, runLocalInference} from '../trinity-pc-bridge/local-model.mjs';

const payload = {task: 'local-inference', messages: [{role: 'user', content: 'Odpovedz OK.'}]};
const answer = {done: true, model: 'qwen3:4b-instruct',
  message: {role: 'assistant', content: 'OK'}, prompt_eval_count: 12, eval_count: 2};
const json = value => new Response(JSON.stringify(value), {headers: {'Content-Type': 'application/json'}});

test('legacy bridge calls real inference instead of completing a placeholder', async () => {
  const source = await readFile(new URL('../trinity-pc-bridge/bridge.mjs', import.meta.url), 'utf8');
  assert.match(source, /await \(await import\('\.\/local-model\.mjs'\)\)\.runLocalInference\(payload\)/);
  assert.doesNotMatch(source, /model:'none'/);
});

test('local model uses fixed loopback, bounded profile and actual model evidence', async () => {
  let request;
  const receipt = await runLocalInference({...payload, max_tokens: 50_000, url: 'https://example.com', model: 'other'}, {
    fetchImpl: async (url, options) => {
      request = {url, options, body: JSON.parse(options.body)};
      return json(answer);
    },
  });
  assert.equal(request.url, 'http://127.0.0.1:11434/api/chat');
  assert.equal(request.options.redirect, 'error');
  assert.deepEqual(request.options.headers, {'Content-Type': 'application/json'});
  assert.equal(request.body.model, 'qwen3:4b-instruct');
  assert.equal(request.body.stream, false);
  assert.equal(request.body.options.num_predict, 600);
  assert.equal(request.body.options.num_ctx, 4096);
  assert.equal(request.body.options.num_thread, 6);
  assert.ok(LOCAL_MODEL_PROFILE.timeoutMs < 90_000);
  assert.deepEqual(receipt, {action: 'read', task: 'local-inference', model: answer.model,
    response: 'OK', usage: {input: 12, output: 2}, completed: true});
});

test('malformed input fails before network access', async () => {
  let calls = 0;
  const options = {fetchImpl: async () => {calls++; return json(answer);}};
  for (const invalid of [
    {}, {...payload, task: 'run'}, {...payload, messages: []},
    {...payload, messages: Array(21).fill(payload.messages[0])},
    {...payload, messages: [{role: 'tool', content: 'x'}]},
    {...payload, messages: [{role: 'user', content: ' '}]},
    {...payload, messages: [{role: 'user', content: 'x'.repeat(20_001)}]},
    {...payload, messages: Array(6).fill({role: 'user', content: 'x'.repeat(20_000)})},
  ]) await assert.rejects(runLocalInference(invalid, options));
  assert.equal(calls, 0);
});

test('unavailable Ollama, missing model and timeout are real failures', async () => {
  await assert.rejects(runLocalInference(payload, {fetchImpl: async () => {throw new TypeError('private network detail');}}), /nie je dostupna/);
  await assert.rejects(runLocalInference(payload, {fetchImpl: async () => new Response('private detail', {status: 404})}), /ollama pull qwen3:4b-instruct/);
  await assert.rejects(runLocalInference(payload, {fetchImpl: async () => new Response('', {status: 500})}), /HTTP 500/);
  await assert.rejects(runLocalInference(payload, {fetchImpl: async () => {throw new DOMException('x', 'TimeoutError');}}), /75 sekund/);
});

test('invalid, empty, unfinished or wrong-model replies never become successful receipts', async () => {
  for (const invalid of [
    {...answer, done: false}, {...answer, model: 'none'}, {...answer, error: 'failed'},
    {...answer, message: {role: 'assistant', content: ' '}},
    {...answer, message: {role: 'user', content: 'OK'}},
  ]) await assert.rejects(runLocalInference(payload, {fetchImpl: async () => json(invalid)}));
  await assert.rejects(runLocalInference(payload, {fetchImpl: async () => new Response('<html>login</html>')}), /JSON/);
  await assert.rejects(runLocalInference(payload, {fetchImpl: async () => new Response('x'.repeat(128_001))}), /velkost/);
});

test('non-finite token and usage values have bounded defaults', async () => {
  let request;
  const receipt = await runLocalInference({...payload, max_tokens: Infinity}, {
    fetchImpl: async (_, options) => {
      request = JSON.parse(options.body);
      return json({...answer, prompt_eval_count: -1, eval_count: 'unsafe'});
    },
  });
  assert.equal(request.options.num_predict, 320);
  assert.deepEqual(receipt.usage, {input: 0, output: 0});
});

test('Windows setup pins helper checksum, preserves source and never rotates keys', async () => {
  const setup = await readFile(new URL('../scripts/configure-local-qwen.ps1', import.meta.url), 'utf8');
  const helper = await readFile(new URL('../trinity-pc-bridge/local-model.mjs', import.meta.url));
  const checksum = createHash('sha256').update(helper).digest('hex').toUpperCase();
  assert.ok(setup.includes(`$helperHash = '${checksum}'`));
  assert.match(setup, /\[IO\.File\]::Replace\(\$tempBridge, \$bridge, \$backup\)/);
  assert.match(setup, /\$originalHash/);
  assert.match(setup, /\$current\.CreationDate -eq \$process\.CreationDate/);
  assert.match(setup, /MaximumRedirection 0/);
  assert.doesNotMatch(setup, /wrangler secret|connect-cloud\.ps1|ExecutionPolicy Bypass|Stop-Process -Name/);
  assert.doesNotMatch(setup, /Get-Content.*\.env|ReadAllText.*\.env/);
});