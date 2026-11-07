import {createHash} from 'node:crypto';
import {redact} from './config.mjs';
import {TrinityAccess} from './access.mjs';

function protectedPath(value) {
  if (typeof value !== 'string' || !value || /[\0\r\n:]/.test(value) || /^[/\\]/.test(value)) throw new Error('Použi relatívnu cestu v pracovnom priestore Trinity.');
  const parts = value.replaceAll('\\', '/').split('/');
  if (parts.some(part => part === '.' || part === '..' || /[. ]$/.test(part) || /^(?:\.env(?:\..*)?|\.git|\.credentials|\.secrets|\.wrangler|node_modules)$/i.test(part) || /\.(?:dpapi|pem|pfx|p12|key)$/i.test(part))) throw new Error('Prístup k chráneným cestám a tajomstvám je zakázaný.');
  if (/^Local-Gateway\/data(?:\/|$)/i.test(value.replaceAll('\\', '/'))) throw new Error('Interný stav brány je chránený.');
  return value;
}

export class LocalBridge {
  constructor({env = process.env, fetcher = fetch} = {}) {
    this.env = env; this.fetcher = fetcher;
    this.access = new TrinityAccess({env,fetcher});
    this.base = env.TRINITY123_BRIDGE_URL || 'http://127.0.0.1:8791';
    const url = new URL(this.base);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.pathname !== '/' || url.username || url.password || url.search || url.hash) throw new Error('PC Bridge musí byť lokálna autentifikovaná brána na 127.0.0.1.');
    this.base = this.base.replace(/\/$/, '');
  }
  async request(method, route, body) {
    if (!this.env.TRINITY_LOCAL_TOKEN) throw new Error('Chýba TRINITY_LOCAL_TOKEN; PC Bridge nie je overený.');
    const response = await this.fetcher(this.base + route, {method,
      headers: {'Authorization': `Bearer ${this.env.TRINITY_LOCAL_TOKEN}`, 'Content-Type': 'application/json'},
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000)});
    const data = await response.json();
    if (!response.ok) throw new Error(`PC Bridge HTTP ${response.status}: ${data.error || 'operácia zlyhala'}`);
    return data;
  }
  async execute(action) {
    try {
      if(action.name==='trinity_access')return this.access.execute(action.arguments);
      if (action.name !== 'local_tool_execute') throw new Error(`Nástroj ${action.name} nemá nakonfigurovaný handler.`);
      const args = typeof action.arguments === 'string' ? JSON.parse(action.arguments) : action.arguments;
      if (!args || typeof args !== 'object' || !args.action_params || typeof args.action_params !== 'object') throw new Error('Neplatné argumenty local_tool_execute.');
      const p = args.action_params;
      if (args.action_type === 'inspect_status') {
        if (/^proposal:[0-9a-f-]{36}$/i.test(p.status_query || '')) {
          const id = p.status_query.slice('proposal:'.length);
          const data = await this.request('GET', '/api/proposals');
          const proposal = data.items?.find(item => item.id === id);
          if (!proposal || !['read', 'run', 'write', 'edit'].includes(proposal.action)) throw new Error('Návrh neexistuje alebo nemá podporovaný typ akcie.');
          const completed = proposal.status === 'completed' && proposal.receipt && proposal.receipt.success !== false && !proposal.receipt.exitCode;
          return {success: Boolean(completed), status: completed ? 'completed' : ['failed', 'rejected'].includes(proposal.status) ? 'failed' : 'pending',
            execution_id: proposal.id, source: 'authenticated_local_gateway', output: proposal.receipt || null,
            error: completed ? null : proposal.error || `Návrh je v stave ${proposal.status}; dokončenie nebolo potvrdené.`};
        }
        if (!['', 'gateway', 'sync', 'bridge', 'pc_bridge'].includes(p.status_query || '')) throw new Error('Podporované status_query: gateway, sync, bridge, pc_bridge. CPU/pamäť sa týmto endpointom neoverujú.');
        const data = await this.request('GET', '/api/sync/status');
        if (!data || typeof data.cloud !== 'object' || typeof data.pc_bridge !== 'object' || typeof data.queue !== 'object') throw new Error('PC Bridge nevrátil očakávaný stav synchronizácie.');
        return {success: true, status: 'completed', action_type: args.action_type, source: 'authenticated_local_gateway',
          execution_id: null, output: data, verified_scope: 'Iba prijatá odpoveď o stave synchronizácie, nie vykonanie inej operácie.'};
      }
      let request;
      if (args.action_type === 'read_file') request = {action: 'read', payload: {path: protectedPath(p.file_path)}};
      else if (args.action_type === 'edit_file') {
        const file = protectedPath(p.file_path);
        if (typeof p.file_content !== 'string') throw new Error('Chýba text file_content.');
        const before = await this.request('POST', '/api/read', {path: file});
        request = {action: 'edit', payload: {path: file, content: p.file_content, expected_sha256: before.sha256}};
      } else if (['run_command', 'run_test', 'git_operation'].includes(args.action_type)) {
        const mapping = {'git status': 'git-status', 'git diff --check': 'diff-check', 'node --version': 'node-version', 'npm test': 'tests', 'npm run build': 'build'};
        const task = args.action_type === 'run_test' ? (['tests', 'npm test'].includes(p.test_name) ? 'tests' : null)
          : args.action_type === 'git_operation' ? (p.git_action === 'status' ? 'git-status' : null) : mapping[p.command?.trim()];
        if (!task) throw new Error('Príkaz nemá bezpečný adaptér. Povolené: git status, git diff --check, node --version, npm test, npm run build. Git mutácie sa automaticky nevykonávajú.');
        request = {action: 'run', payload: {task, project: 'Trinity'}};
      } else throw new Error('Neznámy action_type.');
      const {proposal} = await this.request('POST', '/api/proposals', request);
      if (!proposal?.id || !['approved', 'proposed'].includes(proposal.status)) throw new Error('PC Bridge nevrátil platný návrh.');
      if (proposal.status !== 'approved') return {success: false, status: 'pending', execution_id: proposal.id,
        error: 'Návrh čaká na schválenie vlastníkom v Local Gateway. Agent ho sám neschvaľuje. Po schválení over výsledok v /api/proposals; pôvodný príkaz neopakuj.', output: null};
      const result = await this.request('POST', `/api/proposals/${encodeURIComponent(proposal.id)}/execute`, {});
      const receipt = result.receipt;
      if (result.status !== 'completed' || !receipt || receipt.success === false || receipt.exitCode && receipt.exitCode !== 0) throw new Error('PC Bridge nepotvrdil dokončené vykonanie.');
      if (request.action === 'read' && (typeof receipt.content !== 'string' || !/^[a-f0-9]{64}$/i.test(receipt.sha256 || ''))) throw new Error('Chýba skutočný obsah alebo hash prečítaného súboru.');
      if (request.action === 'read' && createHash('sha256').update(receipt.content).digest('hex') !== receipt.sha256.toLowerCase()) throw new Error('Obsah súboru nezodpovedá hashu v doklade PC Bridge.');
      return {success: true, status: 'completed', source: 'authenticated_local_gateway', execution_id: proposal.id, output: receipt};
    } catch (error) {
      return {success: false, status: 'failed', execution_id: null, output: null, error: redact(error.message, this.env)};
    }
  }
}
