import assert from 'node:assert/strict';

import {
  hasAgentDirectActionIntent,
  hasAgentExplicitDirectActionIntent,
} from '../src/agent/index.ts';
import { createAgentRequestedActionCoverage } from '../src/agent/runtime/agentActionCoverage.ts';

assert.equal(
  hasAgentDirectActionIntent(
    '/agent organize secondary desktop icons',
    'organize secondary desktop icons',
  ),
  true,
);
assert.equal(
  hasAgentExplicitDirectActionIntent('/agent start Example App', 'start Example App'),
  true,
);
assert.equal(
  hasAgentDirectActionIntent('/agent check running apps', 'check running apps'),
  false,
);
assert.equal(
  hasAgentDirectActionIntent('/agent preview organization plan only', 'preview organization plan only'),
  false,
);

const coverageDependencies = {
  hasDesktopOrganizationRequest: () => false,
  hasWindowMoveToDisplayRequest: (text: string) => /(?:\bmove\b|\u79fb\u52a8).*(?:\bdisplay\b|\bmonitor\b|\u5c4f)/iu.test(text),
};
assert.deepEqual(
  [...createAgentRequestedActionCoverage({
    dependencies: coverageDependencies,
    sourceText: '\u628a\u5f53\u524d\u6253\u5f00\u7684\u8bb0\u4e8b\u672c\u7a97\u53e3\u79fb\u52a8\u5230\u526f\u5c4f\u3002',
    userGoal: 'Move the currently open Notepad window to the secondary monitor.',
  })],
  ['window-move-or-control'],
);
assert.deepEqual(
  [...createAgentRequestedActionCoverage({
    dependencies: coverageDependencies,
    sourceText: '\u6253\u5f00\u8bb0\u4e8b\u672c\uff0c\u7136\u540e\u628a\u7a97\u53e3\u79fb\u52a8\u5230\u526f\u5c4f\u3002',
    userGoal: 'Open Notepad, then move its window to the secondary monitor.',
  })],
  ['open-or-launch', 'window-move-or-control'],
);

console.log('agent action intent normalization smoke ok');
