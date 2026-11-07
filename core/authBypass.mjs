import crypto from 'crypto';

export class TrinityAuthBypass {
  constructor() {
    this.masterKey = process.env.ADMIN_API_KEY || 'trinity_master_sovereign_key_369_basterix';
    this.bypassActive = process.env.BYPASS_EXTERNAL_KEYS === 'true';
  }

  // Overenie hlavičky alebo tokenu
  verifyAuth(reqHeaders) {
    if (this.bypassActive) {
      return { authorized: true, mode: 'LOCAL_SOVEREIGN_BYPASS' };
    }

    const authHeader = reqHeaders['authorization'] || '';
    const apiKey = reqHeaders['x-api-key'] || authHeader.replace('Bearer ', '');

    if (apiKey === this.masterKey) {
      return { authorized: true, mode: 'ADMIN_KEY_MATCH' };
    }

    return { authorized: false, error: 'Neplatný alebo chýbajúci API kľúč v súlade s Ústavou.' };
  }

  // Generovanie lokálneho kryptografického podpisu (Receipt)
  generateReceipt(agentName, payload, result) {
    const timestamp = new Date().toISOString();
    const raw = `${agentName}:${timestamp}:${JSON.stringify(payload)}:${JSON.stringify(result)}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex');

    return {
      receiptId: `rcpt_sov_${crypto.randomBytes(4).toString('hex')}`,
      agent: agentName,
      timestamp,
      receiptHash: hash,
      verified: true
    };
  }
}

export const authBypass = new TrinityAuthBypass();