const regressionSmokes = [
  './agent-session-v3-staged-default-soak-smoke.ts',
  './agent-session-v3-default-handoff-guard-smoke.ts',
  './agent-session-v3-experimental-e2e-task-validation-smoke.ts',
  './agent-session-v3-experimental-approval-continuation-route-smoke.ts',
  './agent-session-v3-experimental-ui-entry-smoke.ts',
] as const;

for (const smoke of regressionSmokes) {
  await import(smoke);
}

console.log('agent session v3 staged default regression smoke ok');
