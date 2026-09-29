import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { extractTextFromDocumentLike } = require('../electron/browserSearchService.cjs') as {
  extractTextFromDocumentLike: (documentLike: {
    body?: {
      cloneNode?: (deep?: boolean) => {
        innerText?: string;
        querySelectorAll?: (selector: string) => Array<{ remove?: () => void }>;
      };
    } | null;
    title?: string;
  }) => string;
};

let cloneRequested = false;

const cloneState = {
  textParts: ['Visible result text', 'Script noise'],
};

const cloneNode = {
  remove() {
    cloneState.textParts = ['Visible result text'];
  },
};

const cloneBody = {
  get innerText() {
    return cloneState.textParts.join(' ');
  },
  querySelectorAll(selector: string) {
    assert.equal(selector, 'script,style,noscript,svg,canvas,iframe,[aria-hidden="true"]');
    return [cloneNode];
  },
};

const liveBody = {
  cloneNode() {
    cloneRequested = true;
    return cloneBody;
  },
  querySelectorAll() {
    throw new Error('live body should not be queried');
  },
};

const extractedText = extractTextFromDocumentLike({
  body: liveBody,
  title: 'Google Search',
});

assert.equal(cloneRequested, true, 'the extractor should clone the live body');
assert.equal(
  extractedText,
  'Title: Google Search\nVisible result text',
  'the extractor should only read from the cloned body and drop noisy nodes there',
);

console.log('browser search page text extraction smoke ok');
