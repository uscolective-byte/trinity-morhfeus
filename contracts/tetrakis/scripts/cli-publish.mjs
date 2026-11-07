import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Npm = require('C:/Program Files/nodejs/node_modules/npm/lib/npm.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.resolve(__dirname, '..');

process.chdir(targetDir);
process.stdin.isTTY = true;
process.stdout.isTTY = true;

const npm = new Npm();
await npm.load();

// Set browser to false so it does not block waiting for Enter key, but prints the URL and waits for web auth polling
npm.config.set('browser', false);
npm.config.set('access', 'public');

console.log('Initiating npm publish with Web OTP support...');
try {
  await npm.exec('publish', ['.']);
  console.log('SUCCESS: tetrakis-token published to npm!');
} catch (err) {
  console.error('Publish error:', err);
  process.exit(1);
}
