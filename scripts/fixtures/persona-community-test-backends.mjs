import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function createTestD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../services/persona-community/schema.sql', import.meta.url), 'utf8'));
  const binding = {
    prepare(sql) { return { bind: (...values) => ({ sql, values }) }; },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map(({ sql, values }) => ({ success: true, results: sqlite.prepare(sql).all(...values) }));
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return { binding, sqlite, close: () => sqlite.close() };
}

export function createTestGithub() {
  let sequence = 10;
  const nextSha = () => (++sequence).toString(16).padStart(40, '0');
  const blobs = new Map();
  const trees = new Map();
  const commits = new Map();
  const initialTree = nextSha();
  trees.set(initialTree, new Map([
    ['catalog/index.json', Buffer.from('{"items":[]}')],
    ['v1/publishers.json', Buffer.from('existing signed catalog: preserve unchanged')],
    ['README.md', Buffer.from('existing README')],
  ]));
  let head = nextSha();
  commits.set(head, { tree: initialTree, parents: [] });
  const controls = { fail: false, failPatch: false, alwaysConflict: false, concurrent: null, readCatalog: null, tamperDownload: false };
  const requests = [];
  const events = [];
  const currentFiles = () => trees.get(commits.get(head).tree);
  const currentCatalog = () => JSON.parse(currentFiles().get('catalog/index.json').toString());
  const reply = (value, status = 200) => Response.json(value, { status });

  function concurrentCommit({ entry, bytes }) {
    const files = new Map(currentFiles());
    files.set(`personas/${entry.id}.${entry.format}`, Buffer.from(bytes));
    files.set('catalog/index.json', Buffer.from(JSON.stringify({ items: [entry, ...currentCatalog().items] })));
    const tree = nextSha(); trees.set(tree, files);
    const sha = nextSha(); commits.set(sha, { tree, parents: [head] }); head = sha;
  }

  async function fetchImpl(input, init = {}) {
    const url = new URL(input);
    assert.equal(url.origin, 'https://api.github.com');
    assert.ok(url.pathname.startsWith('/repos/example-owner/ai-desktop-pet-personas/'));
    assert.equal(init.redirect, 'manual');
    assert.equal(init.headers.Authorization, 'Bearer test-only-token');
    assert.equal(init.headers['X-GitHub-Api-Version'], '2022-11-28');
    if (init.signal?.aborted) throw init.signal.reason;
    const path = url.pathname.slice('/repos/example-owner/ai-desktop-pet-personas'.length);
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ path, method, body });
    if (controls.fail) return reply({ message: 'PRIVATE TOKEN AND STACK SHOULD NEVER BE EXPOSED' }, 403);
    if (path === '/git/ref/heads/main') return reply({ object: { sha: head } });
    if (method === 'GET' && path.startsWith('/git/commits/')) {
      const commit = commits.get(path.split('/').pop());
      return reply({ tree: { sha: commit.tree } });
    }
    if (method === 'GET' && path.startsWith('/contents/')) {
      const ref = url.searchParams.get('ref');
      const files = trees.get(commits.get(ref === 'main' ? head : ref).tree);
      const filePath = decodeURIComponent(path.slice('/contents/'.length));
      if (filePath === 'catalog/index.json' && controls.readCatalog !== null) return new Response(controls.readCatalog);
      if (filePath.startsWith('personas/') && controls.tamperDownload) return reply({ encoding: 'base64', content: Buffer.from('tampered').toString('base64') });
      if (!files.has(filePath)) return reply({}, 404);
      if (init.headers.Accept === 'application/vnd.github+json') return reply({ encoding: 'base64', content: files.get(filePath).toString('base64') });
      return new Response(files.get(filePath));
    }
    if (path === '/git/blobs' && method === 'POST') {
      assert.equal(body.encoding, 'base64');
      const sha = nextSha(); blobs.set(sha, Buffer.from(body.content, 'base64')); return reply({ sha });
    }
    if (path === '/git/trees' && method === 'POST') {
      const files = new Map(trees.get(body.base_tree));
      assert.equal(body.tree.length, 2);
      for (const item of body.tree) {
        assert.equal(item.mode, '100644'); assert.equal(item.type, 'blob');
        assert.ok(item.path === 'catalog/index.json' || /^personas\/(?:[^/\\]+--)?[a-f0-9]{64}\.(txt|md|json)$/.test(item.path));
        files.set(item.path, item.sha ? blobs.get(item.sha) : Buffer.from(item.content));
      }
      const sha = nextSha(); trees.set(sha, files); return reply({ sha });
    }
    if (path === '/git/commits' && method === 'POST') {
      const sha = nextSha(); commits.set(sha, { tree: body.tree, parents: body.parents }); return reply({ sha });
    }
    if (path === '/git/refs/heads/main' && method === 'PATCH') {
      assert.equal(body.force, false);
      if (controls.failPatch) return reply({ message: 'branch protected' }, 403);
      if (controls.concurrent) { concurrentCommit(controls.concurrent); controls.concurrent = null; }
      const commit = commits.get(body.sha);
      if (controls.alwaysConflict || commit.parents[0] !== head) return reply({ message: 'not fast forward' }, 422);
      head = body.sha;
      const snapshot = currentFiles();
      for (const item of currentCatalog().items) assert.ok(snapshot.has(`personas/${item.storageFilename ?? `${item.id}.${item.format}`}`));
      events.push({ head, items: currentCatalog().items.length });
      return reply({ object: { sha: head } });
    }
    throw new Error(`Unexpected fake GitHub request: ${method} ${path}`);
  }
  return { fetchImpl, controls, requests, events, currentFiles, currentCatalog };
}
