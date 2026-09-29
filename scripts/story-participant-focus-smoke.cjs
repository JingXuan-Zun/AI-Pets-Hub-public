const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('src/components/chat/story/StoryParticipantSelector.tsx', 'utf8');
assert.match(source, /onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/u);
console.log('story participant focus smoke ok');
