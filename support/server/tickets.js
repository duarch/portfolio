import { MIME_TYPES } from '../shared/config.js';
import { ticketSchema, uploadRequestSchema, statusSchema, protocolSchema, retryEmailsSchema } from '../shared/schema.js';
import { deliverPendingEmails, resendConfiguration } from './email.js';
import { SupportError, readJson, rateLimit, sha256, uploadProof, verifyUploadProof, usesMocks } from './security.js';
import { validateStoredUpload } from './storage.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parse(schema, value) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new SupportError('validation', 400, parsed.error.issues.map(({ path, message }) => ({ path, message: message.startsWith('errors.') ? message : 'errors.validation' })));
  return parsed.data;
}

async function challenge(data, request, env, runtime) {
  if (!(await runtime.verifyTurnstile(data.turnstileToken, request, env))) throw new SupportError('challengeFailed', 400);
}

async function quietlyDelete(storage, key) {
  try { await storage.delete(key); } catch { /* Lifecycle rules cover interrupted cleanup. */ }
}

async function sendPending(runtime, protocol) {
  try { return await deliverPendingEmails(runtime.repo, runtime.storage, runtime.emailProvider, { protocol }); }
  catch { return { pending: true }; }
}

export async function createUploads(request, env, runtime) {
  const clock = runtime.clock || (() => new Date());
  await rateLimit(request, env, runtime.repo, 'uploads', 12, clock);
  const data = parse(uploadRequestSchema, await readJson(request, 16384));
  await challenge(data, request, env, runtime);
  const expiresAt = Math.floor(clock().getTime() / 1000) + 3600;
  const records = data.files.map((file) => ({ ...file, key: `pending/${crypto.randomUUID()}.${MIME_TYPES[file.type].ext}`, expiresAt }));
  // Sign first: a signing failure cannot leave a usable database reservation.
  const uploads = await Promise.all(records.map(async (file) => ({ ...file,
    proof: await uploadProof(file, env), url: await runtime.storage.signUpload(file),
  })));
  await runtime.repo.addPendingUploads(records);
  return { uploads: uploads.map(({ expiresAt: ignored, ...file }) => file) };
}

export async function createTicket(request, env, runtime) {
  const clock = runtime.clock || (() => new Date());
  const data = parse(ticketSchema, await readJson(request));
  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (!idempotencyKey || !UUID.test(idempotencyKey)) throw new SupportError('validation', 400);
  if (!usesMocks(env, request)) {
    try {
      if (new URL(env.PRIVACY_POLICY_URL).protocol !== 'https:') throw new Error('INVALID_POLICY');
    } catch { throw new SupportError('serverError', 503); }
  }
  const { turnstileToken, website, ...fingerprint } = data;
  const requestHash = await sha256(JSON.stringify(fingerprint));
  const existing = await runtime.repo.findByIdempotency(idempotencyKey);
  if (existing) {
    if (existing.requestHash !== requestHash) throw new SupportError('validation', 409);
    return { protocol: existing.protocol, status: existing.status };
  }
  await rateLimit(request, env, runtime.repo, 'tickets', 5, clock);
  await challenge(data, request, env, runtime);
  const now = clock();
  const files = [];
  // All ownership proofs are checked before any storage read, copy, or removal.
  for (const reference of data.attachments) {
    const file = await runtime.repo.getPendingUpload(reference.key);
    if (!file || file.consumedAt || file.expiresAt <= Math.floor(now.getTime() / 1000) ||
        !(await verifyUploadProof(file, reference.proof, env))) throw new SupportError('invalidAttachment');
    files.push(file);
  }
  const claimId = crypto.randomUUID();
  if (!(await runtime.repo.claimPendingUploads(files.map(({ key }) => key), claimId, Math.floor(now.getTime() / 1000)))) {
    throw new SupportError('invalidAttachment', 409);
  }
  const promoted = [];
  let saved = false;
  let commitUncertain = false;
  let ticket;
  try {
    const validated = [];
    for (const file of files) {
      try { validated.push(await validateStoredUpload(runtime.storage, file)); }
      catch (error) {
        // Delete only a reservation whose proof was authenticated above.
        if (error instanceof SupportError && error.status < 500) await quietlyDelete(runtime.storage, file.key);
        throw error;
      }
    }
    const protocol = await runtime.repo.nextProtocol(now.getUTCFullYear());
    for (const file of validated) {
      const key = `tickets/${protocol}/${file.key.slice('pending/'.length)}`;
      await runtime.storage.copy(file.key, key, { etag: file.etag });
      promoted.push({ key, name: file.name, type: file.type, size: file.size });
    }
    ticket = { ...fingerprint, protocol, requestHash, createdAt: now.toISOString(), consentAt: now.toISOString(), status: 'received' };
    try {
      commitUncertain = true;
      await runtime.repo.saveTicket(ticket, promoted, idempotencyKey);
      saved = true;
      commitUncertain = false;
    } catch (error) {
      // A client retry after a committed-but-disconnected database response is safe.
      const committed = await runtime.repo.findByIdempotency(idempotencyKey);
      commitUncertain = false;
      if (committed?.requestHash === requestHash) {
        ticket = committed;
        saved = committed.protocol === protocol;
        if (!saved) for (const file of promoted) await quietlyDelete(runtime.storage, file.key);
      } else throw error;
    }
    if (saved) {
      // Storage copies already exist and ticket metadata is durable before originals go away.
      await runtime.repo.consumePendingUploads(claimId, now.toISOString()).catch(() => {});
      for (const file of files) await quietlyDelete(runtime.storage, file.key);
    }
  } catch (error) {
    // If the database response AND its verification fail, retain both copies:
    // deleting either could destroy an attachment belonging to a committed ticket.
    if (!saved && !commitUncertain) for (const file of promoted) await quietlyDelete(runtime.storage, file.key);
    throw error;
  } finally {
    if (!saved) await runtime.repo.releasePendingUploads(claimId).catch(() => {});
  }
  await sendPending(runtime, ticket.protocol);
  return { protocol: ticket.protocol, status: ticket.status };
}

export async function changeStatus(request, env, runtime) {
  const data = parse(statusSchema, await readJson(request));
  const updated = await runtime.repo.updateStatus(data.protocolo, data.status, data.mensagem || '', (runtime.clock?.() || new Date()).toISOString());
  if (!updated) throw new SupportError('notFound', 404);
  if (updated.changed) await sendPending(runtime, data.protocolo);
  return { protocol: data.protocolo, status: updated.ticket.status, changed: updated.changed };
}

export async function retryEmails(request, env, runtime) {
  const data = parse(retryEmailsSchema, await readJson(request, 4096));
  return deliverPendingEmails(runtime.repo, runtime.storage, runtime.emailProvider, { protocol: data.protocol, limit: 3 });
}

export async function attachmentLinks(request, env, runtime) {
  const protocol = parse(protocolSchema, new URL(request.url).searchParams.get('protocol'));
  const ticket = await runtime.repo.getTicket(protocol);
  if (!ticket) throw new SupportError('notFound', 404);
  return { protocol, attachments: await Promise.all(ticket.attachments.map(async (file) => ({ name: file.name, type: file.type, size: file.size, url: await runtime.storage.signDownload(file.key) }))) };
}

export async function diagnostics(request, env, runtime) {
  const protocol = parse(protocolSchema, new URL(request.url).searchParams.get('protocol'));
  const result = await runtime.repo.supportDiagnostics(protocol);
  if (!result) throw new SupportError('notFound', 404);
  return { ...result, resend: resendConfiguration(env) };
}
