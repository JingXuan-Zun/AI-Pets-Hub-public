import assert from 'node:assert/strict';

import {
  createAgentRuntimeProductionAdapter,
  runAgentRuntime,
} from '../src/agent/index.ts';

let runCount = 0;
const routed = await runAgentRuntime({
  adapter: createAgentRuntimeProductionAdapter({
    async run(context) {
      runCount += 1;
      const iteration = context.authorizeModelIteration({
        cancellationRequested: false,
        requestedLimit: 2,
        sourceText: 'single production route',
        userGoal: 'single production route',
      });
      assert.equal(iteration.action, 'run-iteration');
      return {
        continuation: {
          historyLines: [],
          sourceText: 'single production route',
          steps: [],
          traceEvents: [],
          toolResults: [],
          userGoal: 'single production route',
        },
        finalAnswer: 'done',
        sourceText: 'single production route',
        status: 'completed' as const,
        steps: [],
        traceEvents: [],
        toolResults: [],
      };
    },
  }),
});

assert.equal(runCount, 1);
assert.equal(routed.implementation, 'stable');
assert.equal(routed.result?.status, 'completed');
assert.equal(routed.result?.taskState?.modelIterationCount, 1);
assert.equal(routed.result?.taskState?.owner, 'task-runtime');

console.log('agent runtime production adapter smoke ok');
