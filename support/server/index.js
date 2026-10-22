import { CONSENT_VERSION } from '../shared/config.js';
import { resolveLocale } from '../shared/locale.js';
import { createRuntime, handleMockObjectRequest } from './runtime.js';
import { attachmentLinks, changeStatus, createTicket, createUploads, retryEmails } from './tickets.js';
import { SupportError, authorizeAdmin, jsonResponse, rateLimit, secureResponse, usesMocks, validateOrigin } from './security.js';

export function createSupportHandler(runtime) {
  return (request, env, ctx) => handleSupportRequest(request, env, ctx, runtime);
}

export async function handleSupportRequest(request, env, ctx, runtime) {
  const url = new URL(request.url);
  const admin = url.pathname.startsWith('/api/support/admin/');
  let cors = {};
  try {
    if (admin) {
      if (env.UPLOAD_SIGNING_SECRET || env.ADMIN_API_TOKEN) await rateLimit(request, env, runtime.repo, 'admin', 60, runtime.clock);
      await authorizeAdmin(request, env);
      validateOrigin(request, env, { optional: true });
      if (url.pathname === '/api/support/admin/status' && request.method === 'POST') return jsonResponse(await changeStatus(request, env, runtime));
      if (url.pathname === '/api/support/admin/retry-emails' && request.method === 'POST') {
        // The authenticated POST uses JSON even without a request body.
        if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) throw new SupportError('forbidden', 415);
        return jsonResponse(await retryEmails(request, env, runtime));
      }
      if (url.pathname === '/api/support/admin/attachment-links' && request.method === 'GET') return jsonResponse(await attachmentLinks(request, env, runtime));
      throw new SupportError('notFound', 404);
    }
    const publicEndpoint = ['/api/support/config', '/api/support/uploads', '/api/support/tickets'].includes(url.pathname);
    if (publicEndpoint && request.headers.get('Origin')) cors = { Vary: 'Origin' };
    const origin = validateOrigin(request, env, { optional: request.method === 'GET' });
    if (publicEndpoint && request.headers.get('Origin')) cors['Access-Control-Allow-Origin'] = origin;
    if (request.method === 'OPTIONS' && !publicEndpoint) throw new SupportError('notFound', 404);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key', 'Access-Control-Max-Age': '600' } });
    if (url.pathname === '/api/support/config' && request.method === 'GET') {
      return jsonResponse({ locale: resolveLocale(url.searchParams.get('locale'), request.headers.get('Accept-Language')),
        turnstileSiteKey: env.TURNSTILE_SITE_KEY || '', privacyPolicyUrl: env.PRIVACY_POLICY_URL || (usesMocks(env, request) ? '/support/privacy/' : ''),
        consentVersion: CONSENT_VERSION, mockServices: usesMocks(env, request) }, 200, cors);
    }
    if (url.pathname === '/api/support/uploads' && request.method === 'POST') return jsonResponse(await createUploads(request, env, runtime), 200, cors);
    if (url.pathname === '/api/support/tickets' && request.method === 'POST') return jsonResponse(await createTicket(request, env, runtime), 201, cors);
    throw new SupportError('notFound', 404);
  } catch (error) {
    const known = error instanceof SupportError;
    return jsonResponse({ error: known ? error.code : 'errors.serverError', ...(known && error.issues ? { issues: error.issues } : {}) }, known ? error.status : 503, admin ? {} : cors);
  }
}

async function assets(request, env) {
  if (!usesMocks(env, request)) return jsonResponse({ error: 'errors.notFound' }, 404);
  if (!env.ASSETS?.fetch) return jsonResponse({ error: 'errors.notFound' }, 404);
  const url = new URL(request.url);
  const htmlRoute = /^\/support\/?$/.test(url.pathname) || url.pathname === '/support/index.html';
  const privacyRoute = url.pathname === '/support/privacy' || url.pathname === '/support/privacy/';
  url.pathname = htmlRoute ? '/' : privacyRoute ? '/privacy.html' : url.pathname.slice('/support'.length);
  const assetRequest = new Request(url, request);
  if (htmlRoute) {
    // The HTML lang depends on the request, so the source asset ETag cannot
    // authorize a 304 response for a previously selected language.
    assetRequest.headers.delete('If-None-Match');
    assetRequest.headers.delete('If-Modified-Since');
  }
  let response = await env.ASSETS.fetch(assetRequest);
  if ((response.headers.get('Content-Type') || '').includes('text/html')) {
    const locale = resolveLocale(undefined, request.headers.get('Accept-Language'));
    const html = (await response.text()).replace(/<html\b([^>]*?)\blang=["'][^"']*["']([^>]*)>/i, `<html$1lang="${locale}"$2>`);
    const headers = new Headers(response.headers);
    headers.delete('Content-Length');
    headers.delete('ETag');
    headers.delete('Last-Modified');
    headers.set('Cache-Control', 'no-store');
    const vary = headers.get('Vary');
    if (!vary?.split(',').some((value) => value.trim().toLowerCase() === 'accept-language')) {
      headers.set('Vary', vary ? `${vary}, Accept-Language` : 'Accept-Language');
    }
    response = new Response(html, { status: response.status, headers });
  }
  return secureResponse(response);
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/support' || pathname.startsWith('/support/')) return assets(request, env);
    if (pathname === '/api/support/mock-objects') return secureResponse(await handleMockObjectRequest(request, env));
    if (pathname === '/api/support' || pathname.startsWith('/api/support/')) {
      try { return await handleSupportRequest(request, env, ctx, createRuntime(env, request)); }
      catch { return jsonResponse({ error: 'errors.serverError' }, 503); }
    }
    return jsonResponse({ error: 'errors.notFound' }, 404);
  },
};
