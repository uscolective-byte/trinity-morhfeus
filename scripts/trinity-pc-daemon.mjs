/**
 * @module TRINITY_OMNI_CORE
 * @subsystem AUTOMATION_AND_OPS_SCRIPTS
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul trinity-pc-daemon.mjs (scripts/trinity-pc-daemon.mjs) v ekosystéme TRINITY OMNI-CORE.
 */
import { runDaemonCycle, gatherTelemetry, executeShell, executeFileSystem, checkPrislubDeed } from '../Trinity/scripts/trinity-pc-daemon.mjs';

export { runDaemonCycle, gatherTelemetry, executeShell, executeFileSystem, checkPrislubDeed };

const ONCE = process.argv.includes('--once');
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '4000', 10);

if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  if (ONCE) {
    const t = await runDaemonCycle();
    console.log('[TRINITY PC DAEMON] One-shot overenie úspešné:', JSON.stringify(t, null, 2));
    process.exit(0);
  } else {
    runDaemonCycle();
    setInterval(runDaemonCycle, POLL_INTERVAL);
  }
}
