import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { D1Repository } from '../../support/server/repository.js';
import worker, { createSupportHandler } from '../../support/server/index.js';
import { R2Storage } from '../../support/server/storage.js';
import { CONSENT_VERSION } from '../../support/shared/config.js';
import { verifyTurnstile, usesMocks } from '../../support/server/security.js';
import { renderMarkdown } from '../../support/build/renderMarkdown.js';

// Run the real migration and repository SQL, while replacing only the D1 transport.
class SQLiteD1 {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    const migrationDirectory = new URL('../../support/migrations/', import.meta.url);
    for (const file of readdirSync(migrationDirectory).filter((name) => name.endsWith('.sql')).sort()) {
      this.db.exec(readFileSync(new URL(file, migrationDirectory), 'utf8'));
    }
  }
  prepare(sql) {
    const stmt = this.db.prepare(sql);
    let bindings = [];
    const prepared = {
      bind(...args) { bindings = args; return prepared; },
      async first() { return stmt.get(...bindings) ?? null; },
      async all() { return { results: stmt.all(...bindings) }; },
      async run() { const result = stmt.run(...bindings); return { meta: { changes: Number(result.changes) } }; },
    };
    return prepared;
  }
  async batch(statements) {
    this.db.exec('BEGIN');
    try {
      const results = [];
      for (const stmt of statements) results.push(await stmt.run());
      this.db.exec('COMMIT');
      return results;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
}

const PNG = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jqGQAAAAASUVORK5CYII=', 'base64'));
const headerFixture = (hex) => {
  const bytes = new Uint8Array(64);
  bytes.set(Buffer.from(hex.replaceAll(' ', ''), 'hex'));
  return bytes;
};
// Minimal container headers exercise real file-type signatures; they are not playable media.
const MIME_FIXTURES = [
  ['image/jpeg', 'jpg', headerFixture('ff d8 ff e0 00 10 4a 46 49 46 00 01')],
  ['image/png', 'png', PNG],
  ['image/webp', 'webp', headerFixture('52 49 46 46 18 00 00 00 57 45 42 50 56 50 38 20')],
  ['image/heic', 'heic', headerFixture('00 00 00 18 66 74 79 70 68 65 69 63 00 00 00 00 68 65 69 63')],
  ['video/mp4', 'mp4', headerFixture('00 00 00 18 66 74 79 70 69 73 6f 6d 00 00 00 00 69 73 6f 6d')],
  ['video/quicktime', 'mov', headerFixture('00 00 00 18 66 74 79 70 71 74 20 20 00 00 00 00 71 74 20 20')],
  ['video/webm', 'webm', headerFixture('1a 45 df a3 87 42 82 84 77 65 62 6d')],
];
const ORIGIN = 'https://duar.ch';
const protocol = 'DUAR-2026-000001';
const env = {
  SUPPORT_ORIGIN: ORIGIN,
  UPLOAD_SIGNING_SECRET: 'test-upload-signing-secret-at-least-32-characters',
  ADMIN_API_TOKEN: 'test-administrative-secret-at-least-32-characters',
  PRIVACY_POLICY_URL: 'https://duar.ch/privacy',
  TURNSTILE_SITE_KEY: 'test-site-key',
};
const validTicket = (attachments = []) => ({
  name: 'Example User', email: 'user@example.com', phone: '', country: 'BR', city: '',
  appId: 'persiga', description: 'The application failed while I was opening the camera.',
  wantsReply: true, consent: true, consentVersion: CONSENT_VERSION, locale: 'pt-BR',
  attachments, website: '', turnstileToken: 'one-time-token',
});

let database;
let runtime;
let handle;
let objects;
function request(path, data, { method = 'POST', headers = {}, admin = false, origin = ORIGIN } = {}) {
  return new Request(`${ORIGIN}/api/support/${path}`, {
    method,
    headers: {
      ...(origin ? { Origin: origin } : {}), ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(admin ? { Authorization: `Bearer ${env.ADMIN_API_TOKEN}` } : {}), ...headers
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
}
async function upload(bytes = PNG, metadata = {}) {
  const response = await handle(request('uploads', {
    files: [{ name: '../../screenshot.png', type: 'image/png', size: bytes.length, ...metadata }],
    locale: 'en', turnstileToken: 'upload-token', website: '',
  }), env);
  expect(response.status).toBe(200);
  const { uploads } = await response.json();
  objects.set(uploads[0].key, { bytes, type: metadata.type || 'image/png' });
  return uploads[0];
}
const submit = (data, key = crypto.randomUUID()) => handle(request('tickets', data, { headers: { 'Idempotency-Key': key } }), env);

beforeEach(() => {
  database = new SQLiteD1();
  objects = new Map();
  runtime = {
    repo: new D1Repository(database),
    verifyTurnstile: vi.fn(async () => true),
    clock: () => new Date('2026-10-20T12:00:00.000Z'),
    emailProvider: { env: {}, send: vi.fn(async () => { }) },
    storage: {
      signUpload: vi.fn(async ({ key }) => `https://mock.invalid/${key}`),
      signDownload: vi.fn(async (key) => `https://mock.invalid/${key}?expires=604800`),
      head: vi.fn(async (key) => ({ size: objects.get(key).bytes.length, type: objects.get(key).type, etag: '"immutable-tested-version"' })),
      readHeader: vi.fn(async (key) => objects.get(key).bytes.subarray(0, 8192)),
      copy: vi.fn(async (source, destination) => { objects.set(destination, objects.get(source)); }),
      delete: vi.fn(async (key) => { objects.delete(key); }),
    },
  };
  handle = createSupportHandler(runtime);
});
afterEach(() => database.db.close());

describe('support ticket persistence and attachment flow', () => {
  it.each(MIME_FIXTURES)('accepts real %s signature and derives .%s from its validated MIME', async (type, extension, bytes) => {
    const attachment = await upload(bytes, { type, name: 'file.untrusted-extension' });
    expect(attachment.key).toMatch(new RegExp(`\\.${extension}$`));
    const response = await submit(validTicket([{ key: attachment.key, proof: attachment.proof }]));
    expect(response.status).toBe(201);
    expect((await runtime.repo.getTicket(protocol)).attachments[0]).toMatchObject({ type, size: bytes.length });
    expect(objects.has(attachment.key)).toBe(false);
  });

  it('persists metadata before mail, verifies bytes, promotes and removes pending objects', async () => {
    const attachment = await upload();
    runtime.emailProvider.send.mockImplementation(async () => {
      expect(await runtime.repo.getTicket(protocol)).toMatchObject({ name: 'Example User' });
    });
    const result = await submit(validTicket([{ key: attachment.key, proof: attachment.proof }]));
    expect(result.status).toBe(201);
    expect(await result.json()).toEqual({ protocol, status: 'received' });
    const ticket = await runtime.repo.getTicket(protocol);
    expect(ticket.attachments[0]).toMatchObject({ name: 'screenshot.png', type: 'image/png', size: PNG.length });
    expect(ticket.attachments[0].key).toMatch(/^tickets\/DUAR-2026-000001\//);
    expect(objects.has(attachment.key)).toBe(false);
    expect(objects.has(ticket.attachments[0].key)).toBe(true);
    expect((await runtime.repo.getPendingUpload(attachment.key)).consumedAt).toBeTruthy();
    expect(runtime.emailProvider.send).toHaveBeenCalledTimes(2);
    expect(runtime.storage.readHeader).toHaveBeenCalledWith(attachment.key, { etag: '"immutable-tested-version"' });
    expect(runtime.storage.copy).toHaveBeenCalledWith(attachment.key, ticket.attachments[0].key, { etag: '"immutable-tested-version"' });
    expect(await runtime.repo.emailDeliveryStats(protocol)).toMatchObject({ sent: 2, pending: 0 });
  });

  it('keeps tickets and durable mail jobs on delivery failure and retries administratively', async () => {
    runtime.emailProvider.send.mockRejectedValue(Object.assign(new Error('Private provider text'), { code: 'EMAIL_RATE_LIMIT' }));
    expect((await submit(validTicket())).status).toBe(201);
    expect(await runtime.repo.getTicket(protocol)).toMatchObject({ lastEmailError: 'EMAIL_RATE_LIMIT', emailAttempts: 2 });
    expect(await runtime.repo.listPendingEmailJobs()).toHaveLength(2);
    runtime.emailProvider.send.mockResolvedValue(undefined);
    const response = await handle(request('admin/retry-emails', {}, { admin: true }), env);
    expect(await response.json()).toMatchObject({ sent: 2, failed: 0 });
    expect(await runtime.repo.listPendingEmailJobs()).toHaveLength(0);
  });

  it('does not duplicate tickets or emails when a successful request is retried', async () => {
    const key = crypto.randomUUID();
    const first = await submit(validTicket(), key);
    const second = await submit({ ...validTicket(), turnstileToken: 'fresh-token' }, key);
    expect(await second.json()).toEqual(await first.json());
    expect(runtime.emailProvider.send).toHaveBeenCalledTimes(2);
    expect(runtime.verifyTurnstile).toHaveBeenCalledTimes(1);
    expect((await submit({ ...validTicket(), name: 'Different Person' }, key)).status).toBe(409);
  });

  it('rejects wrong magic bytes and removes only the authenticated pending object', async () => {
    const attachment = await upload(new TextEncoder().encode('this is not a PNG image'));
    const response = await submit(validTicket([{ key: attachment.key, proof: attachment.proof }]));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'errors.invalidAttachment' });
    expect(objects.has(attachment.key)).toBe(false);
    expect(runtime.storage.copy).not.toHaveBeenCalled();
    expect(await runtime.repo.getTicket(protocol)).toBeNull();
  });

  it('keeps pending uploads when the storage signature read temporarily fails', async () => {
    const attachment = await upload();
    runtime.storage.readHeader.mockRejectedValue(new Error('Storage network unavailable'));
    const response = await submit(validTicket([{ key: attachment.key, proof: attachment.proof }]));
    expect(response.status).toBe(503);
    expect(objects.has(attachment.key)).toBe(true);
    expect(runtime.storage.delete).not.toHaveBeenCalled();
  });

  it('rejects forged ownership without reading or deleting another upload', async () => {
    const attachment = await upload();
    const response = await submit(validTicket([{ key: attachment.key, proof: '0'.repeat(64) }]));
    expect(response.status).toBe(400);
    expect(runtime.storage.head).not.toHaveBeenCalled();
    expect(runtime.storage.delete).not.toHaveBeenCalled();
    expect(objects.has(attachment.key)).toBe(true);
  });

  it('rejects keys outside pending and rejects stored size/content-type mismatches', async () => {
    expect((await submit(validTicket([{ key: 'tickets/DUAR-2026-000001/secret.png', proof: 'fake' }]))).status).toBe(400);
    const attachment = await upload();
    objects.get(attachment.key).type = 'video/mp4';
    expect((await submit(validTicket([{ key: attachment.key, proof: attachment.proof }]))).status).toBe(400);
    expect(objects.has(attachment.key)).toBe(false);
  });

  it('leaves pending source recoverable and rolls copied objects back if database save fails', async () => {
    const attachment = await upload();
    vi.spyOn(runtime.repo, 'saveTicket').mockRejectedValue(new Error('Database temporarily unavailable'));
    const response = await submit(validTicket([{ key: attachment.key, proof: attachment.proof }]));
    expect(response.status).toBe(503);
    expect(objects.has(attachment.key)).toBe(true);
    expect([...objects.keys()]).toEqual([attachment.key]);
    expect((await runtime.repo.getPendingUpload(attachment.key)).claimId).toBeNull();
  });

  it('retains attachment copies when a database commit cannot be confirmed', async () => {
    const attachment = await upload();
    vi.spyOn(runtime.repo, 'saveTicket').mockRejectedValue(new Error('Connection lost after write'));
    vi.spyOn(runtime.repo, 'findByIdempotency').mockResolvedValueOnce(null).mockRejectedValue(new Error('Database still unavailable'));
    expect((await submit(validTicket([{ key: attachment.key, proof: attachment.proof }]))).status).toBe(503);
    expect(objects.has(attachment.key)).toBe(true);
    expect([...objects.keys()].filter((key) => key.startsWith('tickets/'))).toHaveLength(1);
    expect(runtime.storage.delete).not.toHaveBeenCalled();
  });

  it('reserves an upload once and prevents reuse in a different ticket', async () => {
    const attachment = await upload();
    const data = validTicket([{ key: attachment.key, proof: attachment.proof }]);
    expect((await submit(data)).status).toBe(201);
    expect((await submit(data)).status).toBe(400);
    expect(runtime.emailProvider.send).toHaveBeenCalledTimes(2);
  });

  it('generates unique padded protocol counters and enforces the six digit bound', async () => {
    expect(await runtime.repo.nextProtocol(2026)).toBe(protocol);
    expect(await runtime.repo.nextProtocol(2026)).toBe('DUAR-2026-000002');
    database.db.prepare('UPDATE protocol_counters SET last_number=999999 WHERE year=2026').run();
    await expect(runtime.repo.nextProtocol(2026)).rejects.toThrow();
  });

  it('stores exact retry email payloads durably and erases them after delivery', async () => {
    const ticket = { ...validTicket(), protocol, requestHash: 'fingerprint', createdAt: runtime.clock().toISOString(), consentAt: runtime.clock().toISOString() };
    await runtime.repo.saveTicket(ticket, [], crypto.randomUUID());
    const [job] = await runtime.repo.listPendingEmailJobs();
    expect(await runtime.repo.getEmailJobPayload(job.id)).toBeNull();
    const message = { to: ['user@example.com'], html: '<p>Preserved URL: https://example.invalid/?signature=original</p>' };
    await runtime.repo.saveEmailJobPayload(job.id, message, ticket.createdAt);
    expect(await runtime.repo.getEmailJobPayload(job.id)).toEqual({ message, createdAt: ticket.createdAt });
    await runtime.repo.finishEmailJob(job.id);
    expect(await runtime.repo.getEmailJobPayload(job.id)).toBeNull();
  });
});

describe('public endpoint protections', () => {
  it('handles allowed and denied cross-origin preflight with exact CORS headers', async () => {
    const allowed = await handle(request('config', undefined, {
      method: 'OPTIONS', headers: {
        'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type, idempotency-key',
      }
    }), env);
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(allowed.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    expect(allowed.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Idempotency-Key');
    expect(allowed.headers.get('Vary')).toBe('Origin');
    expect(allowed.headers.get('Access-Control-Allow-Credentials')).toBeNull();

    const denied = await handle(request('config', undefined, { method: 'OPTIONS', origin: 'https://evil.example' }), env);
    expect(denied.status).toBe(403);
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(denied.headers.get('Vary')).toBe('Origin');
  });

  it('includes exact CORS on allowed errors and never on administrative errors', async () => {
    const error = await handle(request('tickets', {}, { headers: { 'Idempotency-Key': crypto.randomUUID() } }), env);
    expect(error.status).toBe(400);
    expect(error.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    const admin = await handle(request('admin/status', {}, { admin: true }), env);
    expect(admin.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('builds frontend requests from VITE_SUPPORT_API_BASE and keeps local proxy fallback', async () => {
    const source = await (await import('node:fs/promises')).readFile(new URL('../../support/ui/SupportApp.jsx', import.meta.url), 'utf8');
    const portfolio = await (await import('node:fs/promises')).readFile(new URL('../../src/App.jsx', import.meta.url), 'utf8');
    const styles = await (await import('node:fs/promises')).readFile(new URL('../../src/styles.css', import.meta.url), 'utf8');
    expect(source).toContain("import.meta.env.VITE_SUPPORT_API_BASE");
    expect(source).toContain("const apiUrl = (path) => `${API_BASE}${path}`");
    expect(source).toMatch(/['"]\/support\/privacy\/['"]/);
    expect(source).toContain('new URLSearchParams(window.location.search).get("lang")');
    expect(portfolio).toContain('/support/?lang=${localeMap[language] || "en"}');
    expect(styles).toMatch(/\.footer-links\s*{[^}]*flex-wrap:\s*wrap/s);
    expect(styles).toMatch(/@media \(max-width: 768px\)[\s\S]*\.footer-links\s*{[^}]*justify-content:\s*center/s);
    expect(source).not.toMatch(/fetch\(['"]\/api\/support/);
  });

  it('rejects CSRF origins, missing origins, non-JSON bodies and oversized bodies', async () => {
    const data = validTicket();
    expect((await handle(request('tickets', data, { origin: 'https://attacker.example' }), env)).status).toBe(403);
    expect((await handle(request('tickets', data, { origin: null }), env)).status).toBe(403);
    expect((await handle(request('tickets', data, { headers: { 'Content-Type': 'text/plain' } }), env)).status).toBe(415);
    expect((await handle(request('tickets', { ...data, description: 'x'.repeat(70000) }), env)).status).toBe(413);
    expect(runtime.verifyTurnstile).not.toHaveBeenCalled();
  });

  it('requires valid single-use Turnstile checks and rejects the honeypot', async () => {
    runtime.verifyTurnstile.mockResolvedValue(false);
    expect((await submit(validTicket())).status).toBe(400);
    expect((await handle(request('uploads', { files: [{ name: 'x.png', type: 'image/png', size: 20 }], locale: 'en', website: '', turnstileToken: 'bad' }), env)).status).toBe(400);
    runtime.verifyTurnstile.mockClear();
    expect((await submit({ ...validTicket(), website: 'spam' })).status).toBe(400);
    expect(runtime.verifyTurnstile).not.toHaveBeenCalled();
  });

  it('limits tickets and upload signing using persistent salted IP hashes', async () => {
    vi.spyOn(runtime.repo, 'checkRateLimit').mockResolvedValue(false);
    expect((await submit(validTicket())).status).toBe(429);
    expect((await handle(request('uploads', {}), env)).status).toBe(429);
    expect(runtime.verifyTurnstile).not.toHaveBeenCalled();
    const identity = runtime.repo.checkRateLimit.mock.calls[0][0];
    expect(identity).toMatch(/^[a-f0-9]{64}$/);
  });

  it('fails closed for missing production privacy policies and mock flag on public hosts', async () => {
    const invalidEnv = { ...env, PRIVACY_POLICY_URL: '', SUPPORT_MOCK_SERVICES: 'true' };
    expect((await handle(request('tickets', validTicket(), { headers: { 'Idempotency-Key': crypto.randomUUID() } }), invalidEnv)).status).toBe(503);
    expect(usesMocks(invalidEnv, request('config', undefined, { method: 'GET' }))).toBe(false);
  });

  it('returns Accept-Language locale and security headers on public config', async () => {
    const response = await handle(request('config', undefined, { method: 'GET', headers: { 'Accept-Language': 'es-AR,pt;q=0.5' } }), env);
    expect(await response.json()).toMatchObject({ locale: 'es', consentVersion: CONSENT_VERSION, mockServices: false });
    expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });
});

describe('support assets in the Worker', () => {
  it.each(['/support', '/support/', '/support/index.html'])('serves localized HTML at %s without stale language caching', async (path) => {
    const binding = {
      fetch: vi.fn(async () => new Response('<!doctype html><html lang="en"><body>Support</body></html>', {
        headers: { 'Content-Type': 'text/html', ETag: '"source-asset"', 'Last-Modified': 'Mon, 19 Oct 2026 10:00:00 GMT' },
      }))
    };
    const response = await worker.fetch(new Request(`http://127.0.0.1:8787${path}`, {
      headers: { 'Accept-Language': 'es-AR,en;q=0.5', 'If-None-Match': '"old-language"' },
    }), { ASSETS: binding, SUPPORT_MOCK_SERVICES: 'true' });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<html lang="es">');
    expect(new URL(binding.fetch.mock.calls[0][0].url).pathname).toBe('/');
    expect(binding.fetch.mock.calls[0][0].headers.has('If-None-Match')).toBe(false);
    expect(response.headers.get('Vary')).toContain('Accept-Language');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.has('ETag')).toBe(false);
    expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });

  it('serves built assets under the /support prefix without requiring a database', async () => {
    const binding = {
      fetch: vi.fn(async () => new Response('body{color:black}', {
        headers: { 'Content-Type': 'text/css', ETag: '"static-style"', 'Cache-Control': 'public, max-age=86400' },
      }))
    };
    const response = await worker.fetch(new Request(`http://127.0.0.1:8787/support/assets/index-test.css`), { ASSETS: binding, SUPPORT_MOCK_SERVICES: 'true' });
    expect(response.status).toBe(200);
    expect(new URL(binding.fetch.mock.calls[0][0].url).pathname).toBe('/assets/index-test.css');
    expect(response.headers.get('Content-Type')).toBe('text/css');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
    expect(response.headers.get('ETag')).toBe('"static-style"');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('does not serve static assets or proxy unknown paths in production', async () => {
    const binding = { fetch: vi.fn() };
    const production = { ASSETS: binding, SUPPORT_MOCK_SERVICES: 'false' };
    expect((await worker.fetch(new Request('https://api.example/support/'), production)).status).toBe(404);
    expect((await worker.fetch(new Request('https://api.example/unknown'), production)).status).toBe(404);
    expect(binding.fetch).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('privacy policy build', () => {
  it('renders the complete Markdown policy as semantic HTML', () => {
    const markdown = readFileSync(new URL('../../docs/support/privacy_policy.md', import.meta.url), 'utf8');
    const html = renderMarkdown(markdown);
    expect(html).toContain('<h1>Privacy Policy — Persiga Support Service</h1>');
    expect(html).toContain('<h2>12. Contact</h2>');
    expect(html).toContain('<table>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<a href="mailto:support@duar.ch">support@duar.ch</a>');
    expect(html).not.toContain('<pre');
    expect(html).not.toContain('# Privacy Policy');
  });
});

describe('administrative endpoints and durable status events', () => {
  it('returns 401 for missing, wrong and unconfigured admin tokens and never emits CORS', async () => {
    for (const headers of [{}, { Authorization: 'Bearer incorrect-token' }]) {
      const response = await handle(request('admin/status', { protocolo: protocol, status: 'resolved' }, { headers }), env);
      expect(response.status).toBe(401);
      expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
    }
    expect((await handle(request('admin/status', {}, { admin: true }), { ...env, ADMIN_API_TOKEN: '' })).status).toBe(401);
  });

  it('changes status, sends notification in stored locale, and skips unchanged status', async () => {
    await submit(validTicket());
    runtime.emailProvider.send.mockClear();
    const response = await handle(request('admin/status', { protocolo: protocol, status: 'in_review', mensagem: 'Estamos verificando.' }, { admin: true }), env);
    expect(await response.json()).toMatchObject({ status: 'in_review', changed: true });
    expect(runtime.emailProvider.send).toHaveBeenCalledTimes(1);
    expect(runtime.emailProvider.send.mock.calls[0][0].text).toContain('Estamos verificando.');
    const repeated = await handle(request('admin/status', { protocolo: protocol, status: 'in_review' }, { admin: true }), env);
    expect(await repeated.json()).toMatchObject({ changed: false });
    expect(runtime.emailProvider.send).toHaveBeenCalledTimes(1);
  });

  it('always sends confirmation but suppresses status notification when feedback is unchecked', async () => {
    await submit({ ...validTicket(), wantsReply: false });
    expect(runtime.emailProvider.send).toHaveBeenCalledTimes(2);
    await handle(request('admin/status', { protocolo: protocol, status: 'resolved' }, { admin: true }), env);
    expect(runtime.emailProvider.send).toHaveBeenCalledTimes(2);
    expect((await runtime.repo.getTicket(protocol)).status).toBe('resolved');
  });

  it('generates replacement private download URLs for attachments', async () => {
    const attachment = await upload();
    await submit(validTicket([{ key: attachment.key, proof: attachment.proof }]));
    const response = await handle(request(`admin/attachment-links?protocol=${protocol}`, undefined, { method: 'GET', admin: true }), env);
    expect(response.status).toBe(200);
    expect((await response.json()).attachments[0].url).toContain('expires=604800');
    expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
  });

  it('returns safe email diagnostics without CORS or personal data', async () => {
    await submit(validTicket());
    const response = await handle(request(`admin/diagnostics?protocol=${protocol}`, undefined, { method: 'GET', admin: true }), env);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      protocol,
      emailAttempts: 2,
      lastEmailError: null,
    });
    expect(body.jobs).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'confirmation', sent: true, lastError: null }),
      expect.objectContaining({ kind: 'internal', sent: true, lastError: null }),
    ]));
    expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
  });
});

describe('production service adapters without network', () => {
  it('signs content-type on 15-minute PUTs and seven-day GETs', async () => {
    const storage = new R2Storage({ R2_ACCOUNT_ID: 'example', R2_BUCKET: 'private-bucket', R2_ACCESS_KEY_ID: 'fake-id', R2_SECRET_ACCESS_KEY: 'fake-secret' });
    const put = new URL(await storage.signUpload({ key: 'pending/test.png', type: 'image/png' }));
    expect(put.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(put.searchParams.get('X-Amz-SignedHeaders')).toContain('content-type');
    expect(new URL(await storage.signDownload('tickets/test.png')).searchParams.get('X-Amz-Expires')).toBe('604800');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('limits signature reads even when upstream ignores the byte range', async () => {
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array(100000)));
    const storage = new R2Storage({ R2_ACCOUNT_ID: 'example', R2_BUCKET: 'private-bucket', R2_ACCESS_KEY_ID: 'fake-id', R2_SECRET_ACCESS_KEY: 'fake-secret' }, { fetchImpl });
    expect((await storage.readHeader('pending/test.mp4')).length).toBe(8192);
    expect(fetchImpl.mock.calls[0][0].headers.get('Range')).toBe('bytes=0-8191');
  });

  it('binds signature reads and promotion to the version verified by HEAD', async () => {
    const fetchImpl = vi.fn(async (request) => request.method === 'GET'
      ? new Response(PNG) : new Response('<CopyObjectResult><ETag>original</ETag></CopyObjectResult>'));
    const storage = new R2Storage({ R2_ACCOUNT_ID: 'example', R2_BUCKET: 'private-bucket', R2_ACCESS_KEY_ID: 'fake-id', R2_SECRET_ACCESS_KEY: 'fake-secret' }, { fetchImpl });
    await storage.readHeader('pending/test.png', { etag: '"original"' });
    await storage.copy('pending/test.png', 'tickets/protocol/test.png', { etag: '"original"' });
    expect(fetchImpl.mock.calls[0][0].headers.get('If-Match')).toBe('"original"');
    expect(fetchImpl.mock.calls[1][0].headers.get('x-amz-copy-source-if-match')).toBe('"original"');
  });

  it('uses the Worker R2 binding for validation, promotion and cleanup', async () => {
    const binding = {
      head: vi.fn(async () => ({ size: PNG.length, etag: 'original', httpEtag: '"original"', httpMetadata: { contentType: 'image/png' } })),
      get: vi.fn(async (key, options) => options.range
        ? { body: new Response(PNG).body, arrayBuffer: async () => PNG.slice().buffer }
        : { body: new Response(PNG).body, httpMetadata: { contentType: 'image/png' }, customMetadata: { source: 'support' } }),
      put: vi.fn(async () => ({ etag: 'copied' })),
      delete: vi.fn(async () => {}),
    };
    const storage = new R2Storage({ R2_BUCKET: 'private-bucket', ATTACHMENTS: binding });
    expect(await storage.head('pending/test.png')).toMatchObject({ size: PNG.length, type: 'image/png', etag: '"original"' });
    expect(await storage.readHeader('pending/test.png', { etag: '"original"' })).toEqual(PNG);
    await storage.copy('pending/test.png', 'tickets/protocol/test.png', { etag: '"original"' });
    await storage.delete('pending/test.png');
    expect(binding.get.mock.calls[0][1].onlyIf.get('If-Match')).toBe('"original"');
    expect(binding.get.mock.calls[1][1].onlyIf.get('If-Match')).toBe('"original"');
    expect(binding.put).toHaveBeenCalledWith('tickets/protocol/test.png', expect.anything(), {
      httpMetadata: { contentType: 'image/png' }, customMetadata: { source: 'support' },
    });
    expect(binding.delete).toHaveBeenCalledWith('pending/test.png');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requires both successful Turnstile verification and the configured hostname', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ success: true, hostname: 'attacker.example' }));
    expect(await verifyTurnstile('token', request('tickets', {}), { ...env, TURNSTILE_SECRET_KEY: 'fake-secret' }, fetchImpl)).toBe(false);
    fetchImpl.mockResolvedValue(Response.json({ success: true, hostname: 'duar.ch' }));
    expect(await verifyTurnstile('token', request('tickets', {}), { ...env, TURNSTILE_SECRET_KEY: 'fake-secret' }, fetchImpl)).toBe(true);
  });
});
