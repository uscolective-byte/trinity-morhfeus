import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');

// 1. Update Trinity/src/index.js
const indexPath = path.resolve(rootDir, 'Trinity/src/index.js');
let indexContent = fs.readFileSync(indexPath, 'utf8');

const oldIndexBlock = `      token: 'Tetrakis',
      symbol: 'TTK',
      decimals: 18,
      total_supply: '1,000,000,000 TTK',
      official_treasury: '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e',`;

const newIndexBlock = `      token: 'Tetrakis',
      symbol: 'TTK',
      decimals: 18,
      total_supply: '1,000,000,000 TTK',
      basterix_wallet: '0x7e17f9072cfCbc7fE45973De0F11eC8db99281e4',
      basterix_allocation: '1,000,000 TTK (100% v osobnom držaní)',
      official_treasury: '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e',
      treasury_allocation: '999,000,000 TTK (pre DEX likviditu a ekosystém)',`;

if (indexContent.includes(oldIndexBlock)) {
  indexContent = indexContent.replace(oldIndexBlock, newIndexBlock);
  fs.writeFileSync(indexPath, indexContent, 'utf8');
  console.log('Updated Trinity/src/index.js');
} else {
  console.warn('oldIndexBlock not found in Trinity/src/index.js');
}

// 2. Update contracts/tetrakis/scripts/deploy-base-mainnet.mjs
const deployPath = path.resolve(rootDir, 'contracts/tetrakis/scripts/deploy-base-mainnet.mjs');
let deployContent = fs.readFileSync(deployPath, 'utf8');

const oldDeployTarget = `const OFFICIAL_TREASURY = '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e';`;
const newDeployBlock = `const BASTERIX_WALLET = '0x7e17f9072cfCbc7fE45973De0F11eC8db99281e4';
const OFFICIAL_TREASURY = '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e';`;

if (deployContent.includes(oldDeployTarget) && !deployContent.includes('BASTERIX_WALLET')) {
  deployContent = deployContent.replace(oldDeployTarget, newDeployBlock);
  deployContent = deployContent.replace(
    `console.log(\`Official Treasury: \${OFFICIAL_TREASURY}\`);`,
    `console.log(\`Basterix Custody:  \${BASTERIX_WALLET} (1,000,000 TTK)\`);\n  console.log(\`Official Treasury: \${OFFICIAL_TREASURY} (999,000,000 TTK)\`);`
  );
  fs.writeFileSync(deployPath, deployContent, 'utf8');
  console.log('Updated contracts/tetrakis/scripts/deploy-base-mainnet.mjs');
}

// 3. Update Trinity UI chat.html with Basterix's wallet
const chatHtmlPath = path.resolve(rootDir, 'Trinity/public/assistant/chat.html');
let chatHtml = fs.readFileSync(chatHtmlPath, 'utf8');

if (chatHtml.includes('<b>Oficiálna Pokladnica:</b>')) {
  const basterixInfo = `<p><b>Tvoja Osobná Peňaženka (1M TTK):</b> <code style="word-break:break-all; background:#0f172a; color:#10b981; padding:3px 6px; border-radius:4px; font-size:11px;">0x7e17f9072cfCbc7fE45973De0F11eC8db99281e4</code></p>\n            `;
  if (!chatHtml.includes('0x7e17f9072cfCbc7fE45973De0F11eC8db99281e4')) {
    chatHtml = chatHtml.replace('<p><b>Token:</b> Tetrakis ($TTK) · 18 desatinných miest</p>', '<p><b>Token:</b> Tetrakis ($TTK) · 18 desatinných miest</p>\n            ' + basterixInfo);
    fs.writeFileSync(chatHtmlPath, chatHtml, 'utf8');
    console.log('Updated Trinity/public/assistant/chat.html with Basterix wallet display');
  }
}
