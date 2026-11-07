#!/usr/bin/de
/**
 * TRINITY LOCAL SYSTEM BRIDGE ENTRYPOINT (Port 7788)
 * Spúšťa obojsmerný lokálny most prepojený s trinity-auth-core.mjs a OmniDev Studio.
 */

import { createSystemBridgeServer } from './Local-Gateway/src/system-bridge.mjs';
import { inspectWindowsSession } from './Local-Gateway/src/trinity-auth-core.mjs';

const port = Number(process.INITY_BRIDGE_PORT || 7788);
const server = await createSystemBridgeServer({ port });

server.listen(port, '127.0.0.1', () => {
  const win = inspectWindowsSession();
  console.log(JSON.stringify({
    event: 'trinity_system_bridge_online',
    host: '127.0.0.1',
    port,
    operator: win.username,
    domain: win.domain,
    role: win.role,
    os_token_verified: win.osTokfied,
    sid_verified: Boolean(win.sid)
  }));
});
