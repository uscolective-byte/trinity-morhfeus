import './environment.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {Trinity123} from './runtime.mjs';
import {profile, redact, sessionPayload} from './config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const client = new Trinity123({dataDir: process.env.TRINITY123_DATA || path.join(here, '../../data/trinity123')});
const [command = 'doctor', id, ...rest] = process.argv.slice(2);
const print = value => process.stdout.write(redact(value) + '\n');
try {
  if (command === 'doctor') {
    const curl = spawnSync(process.platform === 'win32' ? 'curl.exe' : 'curl', ['--version'], {windowsHide: true, encoding: 'utf8'});
    print({...client.configuration(), node: process.version, curl_available: curl.status === 0,
      next_step: !process.env.OPENAI_API_KEY ? 'Bezpečne nastav OPENAI_API_KEY v prostredí procesu; nevkladaj ho do chatu.' : 'Spusti start; až skutočná API odpoveď overí prístup k projektu a agentovi.'});
    if (curl.status !== 0) process.exitCode = 1;
  } else if (command === 'payload') {
    print(sessionPayload([id, ...rest].filter(Boolean).join(' ') || profile.initial_message));
  } else if (['start', 'message', 'observe'].includes(command)) {
    const result = await client.run({mode: command,
      sessionId: command === 'start' ? undefined : id,
      message: command === 'start' ? [id, ...rest].filter(Boolean).join(' ') || profile.initial_message : rest.join(' '),
      onEvent: print});
    if (result.status !== 'completed') process.exitCode = 2;
  } else if (command === 'inspect') print(await client.inspect(id));
  else if (command === 'cancel') print(await client.cancel(id));
  else if (command === 'delete') print(await client.remove(id));
  else throw new Error('Príkazy: doctor | payload | start [správa] | message SESSION_ID správa | observe SESSION_ID | inspect SESSION_ID | cancel SESSION_ID | delete SESSION_ID');
} catch (error) {
  print({status: 'failed', error: error.message, live_verified: false}); process.exitCode = 1;
}
