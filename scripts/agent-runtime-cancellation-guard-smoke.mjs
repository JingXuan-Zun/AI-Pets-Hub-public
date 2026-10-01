import assert from 'node:assert/strict';
import { assertProductionRuntimeCancellation } from './agentRuntimeCancellationGuard.mjs';

for (const newline of ['\n', '\r\n']) {
  assertProductionRuntimeCancellation(`cancelAgentProductionRuntime({${newline} canonicalEventJournal: journal,${newline} continuation,${newline}});`);
  assertProductionRuntimeCancellation('cancelAgentProductionRuntime({ continuation: continuation });');
}
for (const source of [
  '// cancelAgentProductionRuntime({ continuation })',
  'otherRuntime({ continuation })',
  'cancelAgentProductionRuntime({ canonicalEventJournal: journal })',
  'cancelAgentProductionRuntime({ continuation: otherContinuation })',
  'cancelAgentProductionRuntime(options)',
]) {
  assert.throws(() => assertProductionRuntimeCancellation(source));
}
console.log('agent runtime cancellation guard smoke passed');
