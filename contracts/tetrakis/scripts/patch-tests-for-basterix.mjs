import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testFile = path.resolve(__dirname, '../tests/tetrakis.test.mjs');
let content = fs.readFileSync(testFile, 'utf8');

content = content.replace(
  'EXPECTED_SUPPLY - transferAmount',
  'TREASURY_ALLOCATION - transferAmount'
);

fs.writeFileSync(testFile, content, 'utf8');
console.log('Fixed line 115 in tetrakis.test.mjs');
