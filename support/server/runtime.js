import { D1Repository } from './repository.js';
import { R2Storage } from './storage.js';
import { ResendEmailProvider } from './email.js';
import { usesMocks, verifyTurnstile, validateOrigin, jsonResponse, secureResponse, SupportError } from './security.js';
import { LIMITS } from '../shared/config.js';

// Local development only. Never enabled on a public hostname, even if the flag is set.
const localObjects = new Map();
const capabilities = new Map();

class LocalStorage {
  constructor(origin) { this.origin = origin; }
  capability(key, method, type, seconds) {
    const token = crypto.randomUUID();
    capabilities.set(token, { key, method, type, expiresAt: Date.now() + seconds * 1000 });
    for (const [id, value] of capabilities) if (value.expiresAt < Date.now()) capabilities.delete(id);
    return `${this.origin}/api/support/mock-objects?token=${token}`;
  }
  async signUpload({ key, type }) { return this.capability(key, 'PUT', type, LIMITS.uploadExpiresSeconds); }
  async signDownload(key) { return this.capability(key, 'GET', null, LIMITS.downloadExpiresSeconds); }
  async head(key) {
    const file = localObjects.get(key);
    if (!file) throw new Error('LOCAL_OBJECT_MISSING');
    return { type: file.type, size: file.bytes.byteLength, etag: file.etag };
  }
  async readHeader(key, { etag } = {}) {
    const file = localObjects.get(key);
    if (!file || (etag && etag !== file.etag)) throw new SupportError('serverError', 503);
    return file.bytes.subarray(0, 8192);
  }
  async copy(source, destination, { etag } = {}) {
    const file = localObjects.get(source);
    if (!file || (etag && etag !== file.etag)) throw new SupportError('serverError', 503);
    localObjects.set(destination, file);
  }
  async delete(key) { localObjects.delete(key); }
}

export async function handleMockObjectRequest(request, env) {
  if (!usesMocks(env, request)) return jsonResponse({ error: 'errors.notFound' }, 404);
  const token = new URL(request.url).searchParams.get('token');
  const capability = capabilities.get(token);
  if (!capability || capability.expiresAt < Date.now() || request.method !== capability.method) {
    return jsonResponse({ error: 'errors.forbidden' }, 403);
  }
  if (request.method === 'PUT') {
    validateOrigin(request, env);
    if (request.headers.get('Content-Type') !== capability.type) return jsonResponse({ error: 'errors.type' }, 400);
    const reader = request.body?.getReader();
    if (!reader) return jsonResponse({ error: 'errors.size' }, 400);
    const chunks = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMITS.videoBytes) { await reader.cancel(); return jsonResponse({ error: 'errors.size' }, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const etag = `"${Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')}"`;
    localObjects.set(capability.key, { bytes, type: capability.type, etag });
    return secureResponse(new Response(null, { status: 200 }));
  }
  const file = localObjects.get(capability.key);
  if (!file) return jsonResponse({ error: 'errors.notFound' }, 404);
  return secureResponse(new Response(file.bytes, {
    headers: { 'Content-Type': file.type, 'Content-Disposition': 'attachment', 'Cache-Control': 'no-store' },
  }));
}

export function createRuntime(env, request) {
  const repo = new D1Repository(env.DB);
  if (usesMocks(env, request)) {
    return {
      repo,
      storage: new LocalStorage(env.SUPPORT_ORIGIN || new URL(request.url).origin),
      emailProvider: { env, send: async () => {} },
      verifyTurnstile: async (token) => token === 'local-mock-token',
    };
  }
  // Resolve credentials only when storage is actually used. Config and admin auth
  // still work without granting access to the bucket or sending any messages.
  let r2;
  const storage = Object.fromEntries(['signUpload', 'signDownload', 'head', 'readHeader', 'copy', 'delete']
    .map((method) => [method, (...args) => (r2 ||= new R2Storage(env))[method](...args)]));
  return {
    repo,
    storage,
    emailProvider: new ResendEmailProvider(env),
    verifyTurnstile: (token, currentRequest) => verifyTurnstile(token, currentRequest || request, env),
  };
}
