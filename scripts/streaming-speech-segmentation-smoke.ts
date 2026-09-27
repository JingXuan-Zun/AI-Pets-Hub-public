import assert from 'node:assert/strict';
import { extractQueuedReplyStreamingSpeech } from '../src/components/chat/queuedReplyStreamingSpeechUtils';
import {
  createSpeechBracketFilterState,
  filterSpeechBracketContentChunk,
  normalizeSpeechText,
  removeSpeechBracketContent,
} from '../src/voice/speechText';

const sample = '哎呀…这笑声…尊上大人又在打什么坏主意了？（假装嗔怪地轻点你的鼻尖）该不会是想趁我刚烤好派，就把人家拐到楼上去吧…？';

assert.equal(
  normalizeSpeechText(removeSpeechBracketContent(sample)),
  '哎呀…这笑声…尊上大人又在打什么坏主意了？该不会是想趁我刚烤好派，就把人家拐到楼上去吧…？',
);

const bracketFilterState = createSpeechBracketFilterState();
let pendingSpeechBuffer = '';
let hasQueuedSpeechSegment = false;
let queuedSegmentCount = 0;
const segments: string[] = [];

for (const chunk of Array.from(sample)) {
  const speechChunk = filterSpeechBracketContentChunk(chunk, bracketFilterState);
  if (!speechChunk) {
    continue;
  }

  const extraction = extractQueuedReplyStreamingSpeech(
    `${pendingSpeechBuffer}${speechChunk}`,
    hasQueuedSpeechSegment,
    queuedSegmentCount,
  );
  pendingSpeechBuffer = extraction.remaining;

  for (const segment of extraction.segments) {
    segments.push(segment);
    hasQueuedSpeechSegment = true;
    queuedSegmentCount += 1;
  }
}

const spokenText = normalizeSpeechText([...segments, pendingSpeechBuffer].join(''));

assert.equal(
  spokenText,
  '哎呀…这笑声…尊上大人又在打什么坏主意了？该不会是想趁我刚烤好派，就把人家拐到楼上去吧…？',
);
assert.equal(spokenText.includes('假装嗔�?), false);

const stabilitySample = '第一句先稳定住语气。第二句继续同一个语气，不要突然变成另一种情绪。第三句再补充一点内容，让流式播报有机会切成多段。第四句收尾�?;

function collectStreamingSegments(voiceToneStability: number) {
  let buffer = '';
  let hasQueued = false;
  let count = 0;
  const collected: string[] = [];

  for (const chunk of Array.from(stabilitySample)) {
    const extraction = extractQueuedReplyStreamingSpeech(
      `${buffer}${chunk}`,
      hasQueued,
      count,
      { voiceToneStability },
    );
    buffer = extraction.remaining;

    for (const segment of extraction.segments) {
      collected.push(segment);
      hasQueued = true;
      count += 1;
    }
  }

  if (buffer) {
    collected.push(buffer);
  }

  return collected;
}

const lowStabilitySegments = collectStreamingSegments(0);
const highStabilitySegments = collectStreamingSegments(100);

assert.equal(lowStabilitySegments.join(''), stabilitySample);
assert.equal(highStabilitySegments.join(''), stabilitySample);
assert.ok(
  highStabilitySegments.length < lowStabilitySegments.length,
  `expected high stability to reduce segment count (${highStabilitySegments.length} < ${lowStabilitySegments.length})`,
);
assert.equal(
  highStabilitySegments.length,
  1,
  `expected high stability to keep this reply as one segment, got ${highStabilitySegments.length}`,
);

console.log('streaming speech segmentation smoke ok');
