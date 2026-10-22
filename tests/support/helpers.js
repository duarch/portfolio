import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { D1Repository } from '../../support/server/repository.js';
import { CONSENT_VERSION } from '../../support/shared/config.js';

// The same versioned SQL and repository run on SQLite; external providers are mocked.
export function testDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  const directory = new URL('../../support/migrations/', import.meta.url);
  for (const name of readdirSync(directory).filter((file) => file.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(name, directory), 'utf8'));
  }
  const db = {
    prepare(sql) {
      let values = [];
      const query = {
        bind(...args) { values = args; return query; },
        async first() { return sqlite.prepare(sql).get(...values) || null; },
        async all() { return { results: sqlite.prepare(sql).all(...values) }; },
        async run() {
          const result = sqlite.prepare(sql).run(...values);
          return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
        },
      };
      return query;
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return { sqlite, db, repo: new D1Repository(db) };
}

export const sampleTicket = (overrides = {}) => ({
  protocol: 'DUAR-2026-000001', requestHash: 'test-hash', createdAt: '2026-10-20T12:00:00.000Z',
  locale: 'pt-BR', name: 'Ana <img src=x onerror=alert(1)>', email: 'ana@example.test', phone: '+5561999999999',
  country: 'BR', city: 'Brasília', appId: 'persiga', description: 'O aplicativo apresentou um problema ao abrir a tela.',
  wantsReply: true, consentAt: '2026-10-20T12:00:00.000Z', consentVersion: CONSENT_VERSION, status: 'received',
  attachments: [], ...overrides,
});
