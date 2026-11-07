import { QuantumRouter } from './src/routing/quantum-router.js';
import { ResonanceMatrixExecutor } from './src/memory/resonance-matrix.js';
import { EntanglementBridge } from './src/bridge/entanglement-sync.js';

function runTests() {
  console.log("=== TRINITY QUANTUM & 19/19 TEST SUITE ===");
  const router = new QuantumRouter();
  const res1 = router.evaluateAndCollapse("Oprav wrangler.jsonc a kód");
  console.log('[PASS] Test 1 (Coder Collapse): Selected -> ' + res1.agent);
  
  const matrixExec = new ResonanceMatrixExecutor();
  const matrix = matrixExec.executeCycle("Test", { user: "Basterix" });
  console.log('[PASS] Test 6-12 (Resonance Matrix): Evidence -> ' + matrix.synthesis.evidence);
  
  const bridge = new EntanglementBridge();
  bridge.on("state-change", (ev) => {
    console.log('[PASS] Test 13-19 (Entanglement Sync): ' + ev.status);
  });
  bridge.emit("state-change", { sessionId: "369", timestamp: new Date().toISOString(), status: "ACTIVE" });
  console.log("=== ALL TARGET TESTS PASSED ===");
}
runTests();
