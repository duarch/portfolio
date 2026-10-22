const encoder = new TextEncoder();

export class SupportError extends Error {
  constructor(code, status = 400, issues) {
    super(code);
    this.code = code.startsWith('errors.') ? code : `errors.${code}`;
    this.status = status;
    this.issues = issues;
  }
}

export const isLocalRequest = (request) => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname);
export const usesMocks = (env, request) => env.SUPPORT_MOCK_SERVICES === 'true' && isLocalRequest(request);

export function validateOrigin(request, env, { optional = false } = {}) {
  const url = new URL(request.url);
  if (url.protocol !== 'https:' && !isLocalRequest(request)) throw new SupportError('forbidden', 403);
  let allowed;
  try {
    allowed = new URL(env.SUPPORT_ORIGIN || 'https://duar.ch');
  } catch {
    throw new SupportError('serverError', 503);
  }
  if (allowed.protocol !== 'https:' && !(isLocalRequest(request) && ['localhost', '127.0.0.1', '[::1]'].includes(allowed.hostname))) {
    throw new SupportError('serverError', 503);
  }
  const origin = request.headers.get('Origin');
  if ((!origin && !optional) || (origin && origin !== allowed.origin)) throw new SupportError('forbidden', 403);
  return allowed.origin;
}

export async function readJson(request, maxBytes = 65536) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw new SupportError('forbidden', 415);
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new SupportError('validation', 413);
  if (!request.body) throw new SupportError('validation');
  const reader = request.body.getReader();
  let size = 0;
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new SupportError('validation', 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new SupportError('validation'); }
}

const hex = (bytes) => Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
export async function sha256(value) {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

export async function constantTimeEqual(left, right) {
  const a = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(String(left))));
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(String(right))));
  let different = 0;
  for (let i = 0; i < a.length; i += 1) different |= a[i] ^ b[i];
  return different === 0;
}

export async function authorizeAdmin(request, env) {
  if (!env.ADMIN_API_TOKEN || env.ADMIN_API_TOKEN.length < 32) throw new SupportError('unauthorized', 401);
  const match = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') || '');
  if (!match || !(await constantTimeEqual(match[1], env.ADMIN_API_TOKEN))) throw new SupportError('unauthorized', 401);
  if (new URL(request.url).protocol !== 'https:' && !isLocalRequest(request)) throw new SupportError('forbidden', 403);
}

export async function rateLimit(request, env, repo, action, limit, clock = () => new Date()) {
  const secret = env.UPLOAD_SIGNING_SECRET || env.ADMIN_API_TOKEN;
  if (!secret || secret.length < 32) throw new SupportError('serverError', 503);
  // CF-Connecting-IP is supplied by Cloudflare; forwarded headers are never trusted.
  const ip = request.headers.get('CF-Connecting-IP') || (isLocalRequest(request) ? 'local-development' : 'unknown');
  const identity = await sha256(`${secret}\u0000${ip}`);
  if (!(await repo.checkRateLimit(identity, action, limit, 600, Math.floor(clock().getTime() / 1000)))) {
    throw new SupportError('rateLimited', 429);
  }
}

export async function verifyTurnstile(token, request, env, fetchImpl = fetch) {
  if (!env.TURNSTILE_SECRET_KEY || !token) return false;
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) body.set('remoteip', ip);
    const response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(10000) });
    if (!response.ok) return false;
    const result = await response.json();
    return result.success === true && result.hostname === new URL(env.SUPPORT_ORIGIN || 'https://duar.ch').hostname;
  } catch { return false; }
}

function requireUploadSecret(env) {
  if (!env.UPLOAD_SIGNING_SECRET || env.UPLOAD_SIGNING_SECRET.length < 32) throw new SupportError('serverError', 503);
  return env.UPLOAD_SIGNING_SECRET;
}

export async function uploadProof(file, env) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(requireUploadSecret(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const value = JSON.stringify([file.key, file.type, file.size, file.name, file.expiresAt]);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

export async function verifyUploadProof(file, proof, env) {
  return typeof proof === 'string' && /^[a-f0-9]{64}$/.test(proof) && constantTimeEqual(await uploadProof(file, env), proof);
}

export const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' https://challenges.cloudflare.com https://*.r2.cloudflarestorage.com; frame-src https://challenges.cloudflare.com; font-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; object-src 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

export function secureResponse(response, extra = {}) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries({ ...SECURITY_HEADERS, ...extra })) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function jsonResponse(data, status = 200, headers = {}) {
  return secureResponse(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } }));
}
