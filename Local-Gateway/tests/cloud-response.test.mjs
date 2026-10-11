import test from 'node:test';
import assert from 'node:assert/strict';
import {readCloudJSON} from '../src/cloud-response.mjs';
import {startCloudLink} from '../src/cloud-link.mjs';
import {startBridgeHeartbeat} from '../src/bridge-heartbeat.mjs';

test('JSON success and structured +json responses are accepted', async () => {
  assert.deepEqual(await readCloudJSON(Response.json({action:null})), {action:null});
  assert.deepEqual(await readCloudJSON(new Response('{"ok":true}', {headers:{'content-type':'application/problem+json'}})), {ok:true});
});

test('HTML success cannot masquerade as an API connection', async () => {
  await assert.rejects(readCloudJSON(new Response('<html>challenge</html>', {headers:{'content-type':'text/html'}})), /očakávaná JSON/);
});

test('HTML errors are rejected without leaking response bodies', async () => {
  await assert.rejects(readCloudJSON(new Response('<html>PRIVATE-CREDENTIAL</html>', {status:403,headers:{'content-type':'text/html'}})), error => /HTTP 403/.test(error.message) && !error.message.includes('PRIVATE-CREDENTIAL'));
});

test('invalid JSON and non-object payloads are rejected', async () => {
  await assert.rejects(readCloudJSON(new Response('{', {headers:{'content-type':'application/json'}})), /neplatná JSON/);
  for (const value of [null, [], 'ok']) await assert.rejects(readCloudJSON(Response.json(value)), /objektový formát/);
});

test('JSON authorization errors are reported without exposing remote text', async () => {
  await assert.rejects(readCloudJSON(Response.json({error:'PRIVATE-CREDENTIAL'}, {status:401})), error => /autorizáciu/.test(error.message) && !error.message.includes('PRIVATE-CREDENTIAL'));
});

async function firstState(start, responseFactory) {
  const previous = globalThis.fetch;
  let stop;
  let timer;
  try {
    globalThis.fetch = async () => responseFactory();
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('State timeout')), 1000);
      stop = start(state => resolve(state));
    });
  } finally {
    clearTimeout(timer);
    stop?.();
    globalThis.fetch = previous;
  }
}

const link = onState => startCloudLink({baseUrl:'https://trinity.example',key:'test-only',onState});
const heartbeat = onState => startBridgeHeartbeat({baseUrl:'https://trinity.example',key:'test-only',onState});

test('cloud polling reports disconnected for HTML and missing action', async () => {
  for (const response of [
    () => new Response('<html>challenge</html>', {headers:{'content-type':'text/html'}}),
    () => Response.json({})
  ]) assert.equal((await firstState(link,response)).status, 'disconnected');
});

test('a real empty action queue reports connected', async () => {
  assert.equal((await firstState(link, () => Response.json({action:null}))).status, 'connected');
});

test('heartbeat never reports connected for an HTML challenge', async () => {
  assert.equal((await firstState(heartbeat, () => new Response('<html>challenge</html>', {headers:{'content-type':'text/html'}}))).status, 'disconnected');
});

test('a JSON heartbeat can report connected', async () => {
  assert.equal((await firstState(heartbeat, () => Response.json({last_seen:Date.now()}))).status, 'connected');
});