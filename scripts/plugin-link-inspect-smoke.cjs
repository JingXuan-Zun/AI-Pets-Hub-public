const assert = require('node:assert/strict');
const { inspectGitHubLink, parseGitHubLink } = require('../electron/pluginLinkInspect.cjs');

// Reading a GitHub link before installing: only a few files, straight from GitHub.

assert.deepEqual(parseGitHubLink('https://github.com/a/b.git'), { owner: 'a', ref: 'HEAD', repo: 'b', subPath: '' });
assert.deepEqual(parseGitHubLink('https://github.com/a/b/tree/main/src/fetch'), { owner: 'a', ref: 'main', repo: 'b', subPath: 'src/fetch' });
assert.equal(parseGitHubLink('https://gitlab.com/a/b'), null, 'GitHub only');
assert.equal(parseGitHubLink('https://github.com/a'), null, 'needs a repository');

(async () => {
  const asked = [];
  const fakeFetch = async (url) => {
    asked.push(url);
    if (url.endsWith('/README.md')) return { ok: true, status: 200, text: async () => '# Fetch\nGets pages.' };
    return { ok: false, status: 404, text: async () => '' };
  };
  const found = await inspectGitHubLink('https://github.com/a/b/tree/main/src/fetch', fakeFetch);
  assert.equal(found.ok, true);
  assert.equal(found.readme, '# Fetch\nGets pages.');
  assert.ok(asked.every((url) => url.startsWith('https://raw.githubusercontent.com/a/b/main/src/fetch/')), 'files from that folder');
  const none = await inspectGitHubLink('https://github.com/a/missing', async () => ({ ok: false, status: 404, text: async () => '' }));
  assert.match(none.error, /读不到/u);
  const offline = await inspectGitHubLink('https://github.com/a/b', async () => { throw new Error('ECONNRESET'); });
  assert.match(offline.error, /连不上 GitHub/u);
  console.log('plugin link inspect smoke ok: 9 checks');
})();
