import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const source = readProjectFile('src/components/chat/PetChatConversationMessageBubble.tsx');

assert.match(
  source,
  /import \{ Fragment, memo, useEffect, useRef, useState \} from 'react'/u,
  'chat message bubbles should use React memoization during frequent Agent progress updates',
);
assert.match(
  source,
  /const isLiveAgentRun = process\.status === 'running' \|\| process\.status === 'planned'/u,
  'Agent process rendering should distinguish live progress from terminal detail rendering',
);
assert.match(
  source,
  /!isLiveAgentRun \? <PetChatAgentSessionV2TracePanel session=\{session\} \/> : null/u,
  'the full Trace panel should be deferred until the current Agent run is no longer live',
);
assert.match(
  source,
  /!isLiveAgentRun && genericToolResults\.length/u,
  'full generic tool evidence should be deferred while Agent progress is live',
);
assert.match(
  source,
  /export const PetChatConversationMessageBubble = memo\(PetChatConversationMessageBubbleComponent\)/u,
  'unchanged historical chat messages should skip rerendering',
);

console.log('agent chat live progress render performance smoke ok');
