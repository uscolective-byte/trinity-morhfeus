# Test Infrastructure Specification: Autonomous Desktop Bridge E2E Testing

## 1. Overview & Architecture

This document describes the test architecture, execution models, and process safety protocols for the opaque-box end-to-end (E2E) test suite of Trinity Autonomous Desktop Bridge (`pc_open_app`, `pc_open_url`, `pc_open_file`, and Truth Policy 2.1).

The E2E test suite resides strictly in `tests/e2e/` and exercises the system through its official external boundary interfaces:
1. **Local-Gateway Privileged HTTP Bridge Endpoint (`/api/execute-privileged`)**: Validates Windows OS session identity, SID authorization, cryptographic proposal lifecycle, process launching, and ledger recording.
2. **Trinity Core Tool Schemas & Dispatcher**: Validates Zod schema bounds, agent allowlists, and parameter validation for `pc_open_app`, `pc_open_url`, and `pc_open_file`.
3. **Truth Policy 2.1 Sovereign Ledger Verification**: Audits cryptographic receipts (`TRN-LCL-V3-`), 64-character SHA-256 block hashes, continuous hash chaining (`prev_hash -> block_hash`), and zero-defect exit codes (`exit_code === 0`).

---

## 2. Directory & File Layout

```
tests/e2e/
├── process-cleanup.mjs                  # Process tracking, PID delta calculation, desktop mutex lock & safe teardown
├── bridge-test-harness.mjs              # Dynamic bridge server lifecycle, privileged HTTP client & ledger verifier
├── tier1-feature-coverage.test.mjs      # Tier 1: Core capabilities (Notepad, Calculator, URL, File, Truth Policy 2.1)
├── tier2-boundary-corner-cases.test.mjs # Tier 2: Boundary conditions, ampersands, spaces, traversal & protocol rejection
├── tier3-cross-feature-combinations.test.mjs # Tier 3: Multi-app lifecycle, sequential composite pipelines, concurrency & Zod schemas
└── tier4-real-world-scenarios.test.mjs  # Tier 4: Real-world dev/doc workflows, note taking, and complete ledger hash replay
```

---

## 3. The 4-Tier Test Suite Structure

### Tier 1: Feature Coverage (`tier1-feature-coverage.test.mjs`)
- **Tier 1.1 — `pc_open_app` Notepad**: Autonomously launches Notepad, confirms window creation via PowerShell/OS API, captures exact PID, terminates cleanly via `taskkill /F /T /PID`, confirms 0 lingering processes.
- **Tier 1.2 — `pc_open_app` Calculator**: Autonomously launches Calculator (`CalculatorApp` / `ApplicationFrameHost`), confirms window, captures exact PID, terminates cleanly, confirms 0 lingering processes.
- **Tier 1.3 — `pc_open_url` Web Addresses**: Launches `https://example.com` in default browser via `cmd.exe /c start ""`, confirms HTTP 200, status `completed`, exit code 0.
- **Tier 1.4 — `pc_open_file` Default Handler**: Opens workspace text file in default Windows editor, takes baseline process snapshot, detects newly spawned delta PID, terminates delta PID, verifies zero lingering processes.
- **Tier 1.5 — Truth Policy 2.1 Compliance**: Verifies sovereign ledger receipts, format `TRN-LCL-V3-<index>-<hash12>`, 64-char SHA-256 block hashes, exit code 0, and valid Windows SID.

### Tier 2: Boundary & Corner Cases (`tier2-boundary-corner-cases.test.mjs`)
- **Tier 2.1 — Query Parameters with `&` and `#`**: Verifies URLs like `https://example.com/search?query=trinity&format=json&version=2.1#top` are not split or truncated by `cmd.exe` command separator semantics.
- **Tier 2.2 — Percent-Encoded URLs & Spaces**: Verifies URLs with encoded spaces and symbols are accepted and handled safely.
- **Tier 2.3 — Dangerous Scheme Rejection**: Strictly rejects `file:///`, `javascript:`, and `ftp://` schemes with clear error messaging.
- **Tier 2.4 — Files with Spaces**: Safely resolves and opens files with spaces in both directory names and filenames without command injection or syntax errors.
- **Tier 2.5 — Path Traversal Rejection**: Blocks `../../` attempts, keeping access strictly bounded within the Morhfeus workspace root.
- **Tier 2.6 — Protected File Rejection**: Enforces access boundaries preventing disclosure of `.iles and `.credentials` tokens.
- **Tier 2.7 — Unlisted App Rejection**: Rejects unauthorized binaries (`unauthorized_cmd_tool`, `powershell`) with allowlist violation errors.
- **Tier 2.8 — Slovak & Colloquial App Aliases**: Normalizes colloquial aliases (`calc` -> `calculator`, `poznamkovyblok` -> `notepad`) and launches the correct target.

### Tier 3: Cross-Feature Combinations (`tier3-cross-feature-combinations.test.mjs`)
- **Tier 3.1 — Sequential Multi-App Lifecycle**: Launches Notepad and Calculator sequentially, tracks both PIDs concurrently, verifies simultaneous activity, and cleanly tears down both in reverse order.
- **Tier 3.2 — Composite Workflow Pipeline**: Executes a multi-step sequence (Open App -> Open File -> Open URL) and verifies cryptographic hash continuity across all three ledger blocks (`entry[i].prev_hash === entry[i-1].block_hash`).
- **Tier 3.3 — Concurrent Bridge Invocations**: Fires multiple parallel requests via `Promise.all` and asserts atomic ledger serialization with exit code 0 and valid ordering.
- **Tier 3.4 — Trinity Tool Schema & Registration**: Verifies that `TOOL_SCHEMAS`, `PC_TOOLS`, and Zod boundary checks in Trinity Core validate arguments correctly.

### Tier 4: Real-World Application Scenarios (`tier4-real-world-scenarios.test.mjs`)
- **Scenario 4.1 — Developer Documentation Workflow**: Assistant creates and opens a markdown documentation guide (`docs/E2E_VERIFICATION_WORKFLOW.md`), captures delta PID, verifies resolved safe path, and cleans up.
- **Scenario 4.2 — Research API Lookup Workflow**: Assistant opens official technical documentation (`https://nodejs.org/api/documentation.html`) with receipt verification.
- **Scenario 4.3 — Quick Note-Taking Workflow**: Assistant launches Notepad, verifies active window, and cleanly tears down with zero residual processes.
- **Scenario 4.4 — Full Sovereign Ledger Replay**: Recomputes SHA-256 block hashes from genesis (`prev_hash: '0000...'`) through all scenario blocks, ensuring 100% cryptographic tamper evidence.

---

## 4. Windows Process & Window Cleanup Safety Protocols

### 4.1 Absolute Protection of Active User Sessions
- **FORBIDDEN**: `taskkill.exe /IM ...` (image name killing).
- **RATIONALE**: The host machine actively runs user browser sessions (e.g. 50+ Microsoft Edge processes). Killing by image name would terminate user work.
- **MANDATE**: Teardown is strictly performed by process identifier:
  `taskkill.exe /F /T /PID <pid>`

### 4.2 Tree Termination (`/T`)
Modern Windows 10/11 applications (such as Store Notepad or UWP Calculator) launch via stub loaders or host brokers (e.g., `ApplicationFrameHost.exe` hosting `CalculatorApp.exe`). Terminating with `/T` ensures the entire process tree is terminated, preventing orphaned child windows.

### 4.3 Baseline Snapshotting & Delta PID Tracking
For operations invoking the Windows Shell (`cmd.exe /c start "" <file>`), `cmd.exe` detaches and exits immediately. The safety harness:
1. Snapshots running PIDs of candidate viewer executables before the call.
2. Executes the command.
3. Rescans running PIDs and calculates `deltaPids = pidsAfter.filter(pid => !pidsBefore.has(pid))`.
4. Adds delta PIDs to the `ProcessGuard` cleanup set.

### 4.4 Cross-Process Desktop Mutex Lock (`withDesktopLock`)
Because Node's default test runner executes multiple test files concurrently, multiple suites running simultaneously could compete for desktop focus or PowerShell `Get-Process` CPU cycles.
`withDesktopLock` provides an atomic, file-backed mutex (`os.tmpdir()/trinity-desktop-e2e.lock`) with dead-PID recovery that serializes window launching across parallel test processes.

### 4.5 Guaranteed Teardown Pattern
Every test that launches an OS process uses `try ... finally` with `guard.cleanup()`:
```javascript
const guard = new ProcessGuard(['notepad.exe']);
let openedPid = null;
try {
  // execute action, get pid
  guard.track(openedPid);
} finally {
  guard.cleanup(); // terminates all tracked PIDs & delta PIDs
  // asserts isPidRunning(pid) === false
}
```

---

## 5. Verification Commands

Run the full E2E test suite:
```powershell
node --test tests/e2e/*.test.mjs
```

Run with explicit serial execution:
```powershell
node --test --test-concurrency=1 tests/e2e/*.test.mjs
```

Verify zero lingering processes:
```powershell
tasklist.exe /FI "IMAGENAME eq notepad.exe" /FO CSV /NH
tasklist.exe /FI "IMAGENAME eq CalculatorApp.exe" /FO CSV /NH
```

---
*Authored by Test Writer E2E under Truth Policy 2.1 specifications.*
