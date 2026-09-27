import assert from 'node:assert/strict';
import {
  createAgentPostActionRecoveryGuidanceLines,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2ToolResultEntry,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  builder: builderSource,
  rejectionSignal: rejectionSignalSource,
  runtimeGuidance: runtimeGuidanceSource,
  session: sessionSource,
} = readProjectSources({
  builder: 'src/agent/runtime/agentPostActionRecoveryGuidance.ts',
  rejectionSignal: 'src/agent/runtime/agentFinalAnswerRejectionSignals.ts',
  runtimeGuidance: 'src/agent/runtime/agentPostActionRecoveryGuidance.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
});

assertSourceMatches(
  runtimeGuidanceSource,
  /export function createAgentPostActionRecoveryGuidanceLines/u,
  'Post-action recovery guidance should be Runtime-owned.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function createAgentSessionV2PostActionRecoveryLines/u,
  'AgentSessionV2 should consume post-action recovery lines instead of defining them inline.',
);
assertSourceMatches(
  rejectionSignalSource,
  /from '.\/agentPostActionRecoveryGuidance'/u,
  'Recoverable unverified rejection signal should consume Runtime-owned post-action recovery guidance.',
);

function createCommand(): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'observe post-action state',
    kind: 'tool-call',
    sourceText: '/agent observe post-action state',
    toolCall: {
      goal: 'observe post-action state',
      input: {
        action: 'summarize_visual_snapshot',
      },
      name: 'execute_desktop_observation',
    },
  };
}

function createEntry(postActionState: string, resultOverrides: Partial<AgentChatCommandResult> = {}): AgentSessionV2ToolResultEntry {
  return {
    command: createCommand(),
    result: {
      ok: true,
      responseText: `Post-action state is ${postActionState}.`,
      stateSummary: {
        structuredEvidence: {
          postActionState,
        },
      },
      ...resultOverrides,
    },
  };
}

const loadingLines = createAgentPostActionRecoveryGuidanceLines(createEntry('loading'));
assert.match(loadingLines.join('\n'), /postActionRecovery=The latest UI appears to be loading or launching/u);
assert.match(loadingLines.join('\n'), /nextTool=execute_desktop_observation/u);
assert.match(loadingLines.join('\n'), /waitMs":2500/u);

const blockedLines = createAgentPostActionRecoveryGuidanceLines(createEntry('blocked'));
assert.match(blockedLines.join('\n'), /Read the visible blocker before retrying/u);
assert.match(blockedLines.join('\n'), /preferredTools=locate_screen_elements \| execute_desktop_observation/u);

const loginLines = createAgentPostActionRecoveryGuidanceLines(createEntry('login_required'));
assert.match(loginLines.join('\n'), /safe login\/continue\/confirm control/u);
assert.match(loginLines.join('\n'), /Ask the user only for captcha, QR scan, 2FA\/SMS verification/u);
assert.match(loginLines.join('\n'), /preferredTools=locate_screen_elements \| execute_desktop_observation \| execute_desktop_action/u);

const structuredLines = createAgentPostActionRecoveryGuidanceLines(createEntry('unchanged', {
  stateSummary: {
    structuredEvidence: {
      postActionRecovery: {
        nextArgs: {
          action: 'inspect_window_ui',
          query: 'Example App',
        },
        nextTool: 'execute_desktop_observation',
        reason: 'Need a fresh UIA tree before retrying.',
        strategy: 'refresh-observation',
      },
      postActionState: 'unchanged',
    },
  },
}));
assert.match(structuredLines.join('\n'), /postActionRecoveryStrategy=refresh-observation/u);
assert.match(structuredLines.join('\n'), /nextTool=execute_desktop_observation/u);
assert.match(structuredLines.join('\n'), /nextArgs=.*inspect_window_ui/u);
assert.match(structuredLines.join('\n'), /postActionRecoveryReason=Need a fresh UIA tree before retrying/u);
assert.match(structuredLines.join('\n'), /postActionRecovery=The latest UI appears unchanged/u);

console.log('agent session v2 post action recovery lines builder smoke ok');
