import assert from 'node:assert/strict';
import {
  buildGroupContributionSignalPromptLines,
  extractGroupContributionSignal,
  stripGroupContributionSignalMarkers,
} from '../src/components/chat/group/role/groupContributionSignalProtocol';

assert.equal(extractGroupContributionSignal('新增观点\n[[contribution-signal:new-viewpoint]]'), 'new-viewpoint');
assert.equal(extractGroupContributionSignal('没有标记'), undefined);
assert.equal(extractGroupContributionSignal('[[contribution-signal:none]][[contribution-signal:new-fact]]'), undefined);
assert.equal(stripGroupContributionSignalMarkers('正文\n[[contribution-signal:none]]'), '正文');
assert.match(buildGroupContributionSignalPromptLines().join('\n'), /只是附和/u);
console.log('group contribution signal smoke ok');
