import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire('C:/Program Files/nodejs/node_modules/npm/package.json');
const libpub = require('libnpmpublish');
const { webAuthOpener } = require('npm-profile');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(__dirname, '..');
const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));

// Read tarball or pack
const tarballPath = path.join(pkgDir, `${pkgJson.name}-${pkgJson.version}.tgz`);
if (!fs.existsSync(tarballPath)) {
  console.error('Tarball not found at', tarballPath);
  process.exit(1);
}
const tarballData = fs.readFileSync(tarballPath);

// Read npmrc auth token
const userProfile = process.env.USERPROFILE || process.env.HOME;
const npmrc = fs.readFileSync(path.join(userProfile, '.npmrc'), 'utf8');
const tokenMatch = npmrc.match(/:_authToken=(.+)/);
const token = tokenMatch ? tokenMatch[1].trim() : null;

if (!token) {
  console.error('No auth token found in .npmrc');
  process.exit(1);
}

console.log('Publishing', pkgJson.name, pkgJson.version, 'with token for basterix3...');

const publishOpts = {
  access: 'public',
  token: token,
  registry: 'https://registry.npmjs.org/'
};

async function run() {
  try {
    const res = await libpub.publish(pkgJson, tarballData, publishOpts);
    console.log('Successfully published without OTP:', res);
  } catch (err) {
    if (err.code === 'EOTP' && err.body?.authUrl && err.body?.doneUrl) {
      console.log('\n======================================================');
      console.log('WEB AUTH REQUIRED - OPEN THIS URL IN YOUR BROWSER:');
      console.log(err.body.authUrl);
      console.log('======================================================\n');

      const opener = async (url) => {
        console.log('Waiting for approval in browser at:', url);
      };

      console.log('Polling npm for your browser confirmation...');
      const authResult = await webAuthOpener(opener, err.body.authUrl, err.body.doneUrl, publishOpts);
      console.log('Browser confirmation received! OTP token acquired.');

      const finalRes = await libpub.publish(pkgJson, tarballData, {
        ...publishOpts,
        otp: authResult.token
      });
      console.log('PUBLISHED SUCCESSFULLY TO NPM:', finalRes);
    } else {
      console.error('Publish failed with error:', err.message, err.code, err.body);
      process.exit(1);
    }
  }
}

run();
