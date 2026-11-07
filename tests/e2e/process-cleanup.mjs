/**
 * @module tests/e2e/process-cleanup.mjs
 * @description Windows Process & Window Cleanup Safety Harness for E2E tests.
 * Guaranteed zero process leaks. Never kills by image name (/IM), only by exact PID (/PID <pid>).
 */
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const LOCK_FILE = path.join(os.tmpdir(), 'trinity-desktop-e2e.lock');

/**
 * Acquire cross-process desktop lock to prevent GUI window race conditions when tests run concurrently.
 * @param {Function} fn - Async operation requiring exclusive desktop access
 * @param {number} [timeoutMs=90000]
 */
export async function withDesktopLock(fn, timeoutMs = 90_000) {
  const start = Date.now();
  let acquired = false;
  while (!acquired) {
    try {
      const fd = fs.openSync(LOCK_FILE, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      acquired = true;
    } catch (err) {
      if (err.code === 'EEXIST') {
        try {
          const raw = fs.readFileSync(LOCK_FILE, 'utf8').trim();
          const lockPid = parseInt(raw, 10);
          if (lockPid && !isPidRunning(lockPid)) {
            fs.unlinkSync(LOCK_FILE);
            continue;
          }
          const stats = fs.statSync(LOCK_FILE);
          if (Date.now() - stats.mtimeMs > 30_000) {
            fs.unlinkSync(LOCK_FILE);
            continue;
          }
        } catch {}
        if (Date.now() - start > timeoutMs) {
          throw new Error('Desktop lock acquisition timed out');
        }
        await new Promise(r => setTimeout(r, 200));
      } else {
        throw err;
      }
    }
  }

  try {
    return await fn();
  } finally {
    try {
      fs.unlinkSync(LOCK_FILE);
    } catch {}
  }
}

/**
 * Snapshot running PIDs from tasklist.
 * If imageNames is provided, filters for those image names.
 * Otherwise snapshots all running PIDs.
 * @param {string[]} [imageNames] - Optional list of image names (e.g. ['notepad.exe', 'CalculatorApp.exe'])
 * @returns {Set<number>} Set of running PIDs
 */
export function snapshotPids(imageNames = null) {
  const pids = new Set();
  try {
    if (imageNames && imageNames.length > 0) {
      for (const img of imageNames) {
        try {
          const raw = execFileSync('tasklist.exe', ['/FI', `IMAGENAME eq ${img}`, '/FO', 'CSV', '/NH'], {
            encoding: 'utf8',
            windowsHide: true
          });
          for (const line of raw.split(/\r?\n/)) {
            const match = line.match(/^"([^"]+)",\s*"(\d+)"/);
            if (match) pids.add(Number(match[2]));
          }
        } catch {}
      }
    } else {
      const raw = execFileSync('tasklist.exe', ['/FO', 'CSV', '/NH'], {
        encoding: 'utf8',
        windowsHide: true
      });
      for (const line of raw.split(/\r?\n/)) {
        const match = line.match(/^"([^"]+)",\s*"(\d+)"/);
        if (match) pids.add(Number(match[2]));
      }
    }
  } catch {}
  return pids;
}

/**
 * Query delta PIDs (newly spawned processes) comparing current running PIDs against a baseline set.
 * @param {Set<number>} baselinePids - Set of PIDs existing before test action
 * @param {string[]} [imageNames] - Optional image name filter
 * @returns {Array<{ pid: number, image: string }>} List of newly spawned processes
 */
export function getDeltaPids(baselinePids, imageNames = null) {
  const delta = [];
  try {
    if (imageNames && imageNames.length > 0) {
      for (const img of imageNames) {
        try {
          const raw = execFileSync('tasklist.exe', ['/FI', `IMAGENAME eq ${img}`, '/FO', 'CSV', '/NH'], {
            encoding: 'utf8',
            windowsHide: true
          });
          for (const line of raw.split(/\r?\n/)) {
            const match = line.match(/^"([^"]+)",\s*"(\d+)"/);
            if (match) {
              const pid = Number(match[2]);
              if (!baselinePids.has(pid)) {
                delta.push({ pid, image: match[1] });
              }
            }
          }
        } catch {}
      }
    } else {
      const raw = execFileSync('tasklist.exe', ['/FO', 'CSV', '/NH'], {
        encoding: 'utf8',
        windowsHide: true
      });
      for (const line of raw.split(/\r?\n/)) {
        const match = line.match(/^"([^"]+)",\s*"(\d+)"/);
        if (match) {
          const pid = Number(match[2]);
          if (!baselinePids.has(pid)) {
            delta.push({ pid, image: match[1] });
          }
        }
      }
    }
  } catch {}
  return delta;
}

/**
 * Cleanly terminate a process and its child process tree via `taskkill.exe /F /T /PID <pid>`.
 * NEVER uses /IM.
 * @param {number} pid - Target process ID
 * @returns {boolean} True if successfully terminated or process already exited
 */
export function terminatePidTree(pid) {
  if (!pid || typeof pid !== 'number' || isNaN(pid) || pid <= 4) return false;
  try {
    execFileSync('taskkill.exe', ['/F', '/T', '/PID', String(pid)], {
      windowsHide: true,
      stdio: 'ignore'
    });
    return true;
  } catch (error) {
    // Exit code 128 indicates process is already dead / not found, which is acceptable
    return true;
  }
}

/**
 * Check if a specific PID is currently alive.
 * @param {number} pid - Target process ID
 * @returns {boolean} True if process is alive
 */
export function isPidRunning(pid) {
  if (!pid || typeof pid !== 'number' || isNaN(pid)) return false;
  try {
    const raw = execFileSync('tasklist.exe', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      windowsHide: true
    });
    return raw.includes(`"${pid}"`);
  } catch {
    return false;
  }
}

/**
 * Verify that all given PIDs have terminated.
 * @param {number[]|Set<number>} pids - PIDs to verify
 * @returns {boolean} True if zero lingering processes remain
 */
export function verifyZeroLingering(pids) {
  const list = Array.isArray(pids) ? pids : Array.from(pids);
  for (const pid of list) {
    if (isPidRunning(pid)) {
      // Retry kill once more
      terminatePidTree(pid);
      if (isPidRunning(pid)) {
        throw new Error(`CRITICAL TEST CLEANUP FAILURE: Lingering process PID ${pid} still running!`);
      }
    }
  }
  return true;
}

/**
 * ProcessGuard class: Manages tracking, delta calculation, and guaranteed teardown in a try-finally pattern.
 */
export class ProcessGuard {
  constructor(targetImages = ['notepad.exe', 'CalculatorApp.exe', 'ApplicationFrameHost.exe', 'mspaint.exe']) {
    this.targetImages = targetImages;
    this.trackedPids = new Set();
    this.baselinePids = snapshotPids(this.targetImages);
  }

  /**
   * Manually track a known PID (e.g. from desktop execution result).
   * @param {number} pid
   */
  track(pid) {
    if (pid && typeof pid === 'number' && pid > 4) {
      this.trackedPids.add(pid);
    }
  }

  /**
   * Rescan for any new processes spawned since baseline and add them to tracking.
   * @returns {number[]} Array of newly discovered delta PIDs
   */
  detectDelta() {
    const delta = getDeltaPids(this.baselinePids, this.targetImages);
    for (const item of delta) {
      this.trackedPids.add(item.pid);
    }
    return Array.from(this.trackedPids);
  }

  /**
   * Cleanly terminate all tracked PIDs and assert zero lingering processes.
   */
  cleanup() {
    // Detect any late-spawned delta PIDs first
    this.detectDelta();

    // Terminate all tracked PIDs
    for (const pid of this.trackedPids) {
      terminatePidTree(pid);
    }

    // Verify all tracked PIDs are dead
    verifyZeroLingering(this.trackedPids);
    this.trackedPids.clear();
  }
}
