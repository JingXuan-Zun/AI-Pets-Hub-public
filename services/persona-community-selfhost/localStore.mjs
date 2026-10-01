import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PERSONA_MAX_CATALOG_BYTES, PERSONA_MAX_ENTRIES, parsePersonaCatalog, parsePublicPersona } from '../../src/persona-community/personaCommunitySchema.ts';
import { PersonaHttpError } from '../persona-community/http.mjs';

export function createLocalPersonaStore(databasePath, { maxTotalBytes = 100 * 1024 * 1024 } = {}) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath, { timeout: 5000 });
  database.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY, metadata TEXT NOT NULL, content BLOB NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS persona_request_limits (
      bucket TEXT NOT NULL, window_start INTEGER NOT NULL, used INTEGER NOT NULL,
      PRIMARY KEY (bucket, window_start)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS server_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;`);

  function catalog() {
    return parsePersonaCatalog({ items: database.prepare('SELECT metadata FROM personas ORDER BY rowid DESC').all()
      .map((row) => JSON.parse(row.metadata)) });
  }

  function publish(candidate, bytes) {
    const entry = parsePublicPersona(candidate);
    database.exec('BEGIN IMMEDIATE');
    try {
      const existing = database.prepare('SELECT metadata FROM personas WHERE id = ?').get(entry.id);
      if (existing) { database.exec('COMMIT'); return parsePublicPersona(JSON.parse(existing.metadata)); }
      const current = catalog();
      const next = { items: [entry, ...current.items] };
      const total = current.items.reduce((sum, item) => sum + item.sizeBytes, bytes.byteLength);
      if (current.items.length >= PERSONA_MAX_ENTRIES || total > maxTotalBytes
        || Buffer.byteLength(JSON.stringify(next)) > PERSONA_MAX_CATALOG_BYTES) {
        throw new PersonaHttpError(507, 'catalog-full');
      }
      database.prepare('INSERT INTO personas (id, metadata, content) VALUES (?, ?, ?)')
        .run(entry.id, JSON.stringify(entry), bytes);
      database.exec('COMMIT');
      return entry;
    } catch (error) { database.exec('ROLLBACK'); throw error; }
  }

  // Reuse the existing download contract without filesystem paths from callers.
  async function fileBytes(storagePath) {
    const entry = catalog().items.find((item) => `personas/${item.storageFilename ?? `${item.id}.${item.format}`}` === storagePath);
    if (!entry) throw new PersonaHttpError(404, 'persona-not-found');
    return database.prepare('SELECT content FROM personas WHERE id = ?').get(entry.id).content;
  }

  const quotaBinding = {
    prepare(sql) { return { bind: (...values) => ({ sql, values }) }; },
    async batch(statements) {
      database.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(({ sql, values }) => ({ success: true, results: database.prepare(sql).all(...values) }));
        database.exec('COMMIT');
        return results;
      } catch (error) { database.exec('ROLLBACK'); throw error; }
    },
  };
  return { catalog, publish, fileBytes, quotaBinding,
    getOrCreateSecret(key, create) {
      database.prepare('INSERT OR IGNORE INTO server_metadata (key, value) VALUES (?, ?)').run(key, create());
      return database.prepare('SELECT value FROM server_metadata WHERE key = ?').get(key).value;
    },
    close() { database.close(); },
  };
}
