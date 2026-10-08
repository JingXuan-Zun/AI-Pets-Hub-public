import { readMessageProjectSources as readProjectSources } from './chatMessageSource.mjs';
import assert from 'node:assert/strict';


const {
  controller: controllerSource,
  messageBubble: messageBubbleSource,
} = readProjectSources({
  controller: 'src/components/chat/agentRunController.ts',
  messageBubble: 'src/components/chat/PetChatConversationMessageBubble.tsx',
});

assert.match(
  controllerSource,
  /已准备好执行[\s\S]*确认后会直接操作电脑并继续/u,
  'pending approval visible text should tell users that confirmation continues execution directly',
);

assert.match(
  controllerSource,
  /已准备好下一步，确认后会直接继续/u,
  'follow-on approval visible text should not sound like a completed task with hidden next steps',
);

assert.match(
  messageBubbleSource,
  /pendingPrimaryText[\s\S]*pendingHelperText[\s\S]*\\u786e\\u8ba4\\u540e\\u4f1a\\u76f4\\u63a5\\u6267\\u884c/u,
  'approval card should expose the primary action without requiring details expansion',
);

assert.ok(
  messageBubbleSource.includes('<div className="font-semibold">{pendingPrimaryText}</div>')
    && /<div className="[^"]*">\{pendingHelperText\}<\/div>/u.test(messageBubbleSource)
    && messageBubbleSource.indexOf('{pendingPrimaryText}') < messageBubbleSource.indexOf("onClick={() => resolveApproval('approve')}"),
  'approval card should render the primary confirmation prompt before the approval button',
);

console.log('agent approval primary CTA smoke ok');
