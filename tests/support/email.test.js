import { describe, it, expect, vi } from 'vitest';
import { testDatabase, sampleTicket } from './helpers.js';
import { deliverPendingEmails, renderEmail, ResendEmailProvider } from '../../support/server/email.js';
import en from '../../support/locales/en.js';
import pt from '../../support/locales/pt-BR.js';
import es from '../../support/locales/es.js';

const env = { SUPPORT_INBOX: 'support@duar.ch', EMAIL_FROM_INTERNAL: 'form@notify.duar.ch', EMAIL_FROM_USER: 'support@notify.duar.ch' };
const storage = { signDownload: vi.fn(async () => 'https://download.example.test/private?signature=test') };

describe('transactional email', () => {
  it.each([['en', en], ['pt-BR', pt], ['es', es]])('renders confirmation in %s and escapes all user HTML', async (locale, dictionary) => {
    const message = await renderEmail({ kind: 'confirmation' }, sampleTicket({ locale }), null, storage, env);
    expect(message.html).toContain(dictionary['email.confirmation.title']);
    expect(message.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(message.html).not.toContain('<img');
    expect(message.reply_to).toBe('support@duar.ch');
    expect(message.to).toEqual(['ana@example.test']);
    expect(message.subject).toContain('DUAR-2026-000001');
    expect(message.html).not.toMatch(/tracking|pixel|\{protocol\}/);
  });

  it('sends names without download links in confirmation, and signed links internally', async () => {
    const ticket = sampleTicket({ attachments: [{ key: 'tickets/DUAR-2026-000001/id.png', name: '<script>.png', type: 'image/png', size: 20 }] });
    const confirmation = await renderEmail({ kind: 'confirmation' }, ticket, null, storage, env);
    expect(confirmation.text).toContain('<script>.png');
    expect(confirmation.text).not.toContain('download.example');
    expect(confirmation.html).not.toContain('<a ');
    const internal = await renderEmail({ kind: 'internal' }, ticket, null, storage, env);
    expect(internal.reply_to).toBe(ticket.email);
    expect(internal.to).toEqual(['support@duar.ch']);
    expect(internal.text).toContain('https://download.example.test/private');
    expect(internal.html).toContain('&lt;script&gt;.png');
  });

  it('keeps tickets and failed jobs, then retries only pending emails', async () => {
    const { repo, sqlite } = testDatabase();
    await repo.saveTicket(sampleTicket(), [], crypto.randomUUID());
    const provider = { env, send: vi.fn().mockRejectedValueOnce(Object.assign(new Error('private body'), { code: 'EMAIL_RATE_LIMIT' })).mockResolvedValue(undefined) };
    const result = await deliverPendingEmails(repo, storage, provider, {});
    expect(result).toMatchObject({ sent: 1, failed: 1 });
    expect(await repo.getTicket('DUAR-2026-000001')).toBeTruthy();
    expect((await repo.emailDeliveryStats('DUAR-2026-000001')).pending).toBe(1);
    await deliverPendingEmails(repo, storage, provider, {});
    expect(provider.send).toHaveBeenCalledTimes(3);
    expect((await repo.emailDeliveryStats('DUAR-2026-000001')).pending).toBe(0);
    expect(await repo.listPendingEmailJobs()).toHaveLength(0);
    expect(JSON.stringify(sqlite.prepare('SELECT * FROM email_jobs').all())).not.toContain('private body');
    sqlite.close();
  });

  it('classifies a missing email payload migration without calling Resend', async () => {
    const { repo, sqlite } = testDatabase();
    await repo.saveTicket(sampleTicket(), [], crypto.randomUUID());
    vi.spyOn(repo, 'getEmailJobPayload').mockRejectedValue(new Error('D1_ERROR: no such column: payload_json'));
    const provider = { env, send: vi.fn() };
    expect(await deliverPendingEmails(repo, storage, provider, {})).toMatchObject({ sent: 0, failed: 2 });
    expect((await repo.getTicket('DUAR-2026-000001')).lastEmailError).toBe('EMAIL_SCHEMA_MISSING');
    expect(provider.send).not.toHaveBeenCalled();
    sqlite.close();
  });

  it('queues status notifications only for people requesting follow-up, and uses event status', async () => {
    const { repo, sqlite } = testDatabase();
    await repo.saveTicket(sampleTicket({ wantsReply: false }), [], crypto.randomUUID());
    await repo.updateStatus('DUAR-2026-000001', 'in_review', 'Verificando');
    expect((await repo.listPendingEmailJobs()).filter((job) => job.kind === 'status')).toHaveLength(0);
    await repo.saveTicket(sampleTicket({ protocol: 'DUAR-2026-000002', locale: 'es' }), [], crypto.randomUUID());
    await repo.updateStatus('DUAR-2026-000002', 'awaiting_user', '<script>alert(1)</script>');
    const jobs = (await repo.listPendingEmailJobs()).filter((job) => job.kind === 'status');
    expect(jobs).toHaveLength(1);
    const event = await repo.getStatusEvent(jobs[0].eventId);
    const email = await renderEmail(jobs[0], await repo.getTicket(jobs[0].protocol), event, storage, env);
    expect(email.html).toContain(es['status.awaiting_user']);
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    sqlite.close();
  });

  it('reuses the exact email payload and idempotency key after an uncertain database acknowledgement', async () => {
    const { repo, sqlite } = testDatabase();
    const file = { key: 'tickets/DUAR-2026-000001/test.png', name: 'test.png', type: 'image/png', size: 20 };
    await repo.saveTicket(sampleTicket(), [file], crypto.randomUUID());
    sqlite.prepare("UPDATE email_jobs SET created_at='2026-10-19T12:00:00.000Z' WHERE kind='internal'").run();
    const dynamicStorage = { signDownload: vi.fn(async () => `https://download.example.test/${crypto.randomUUID()}`) };
    const provider = { env, send: vi.fn(async () => {}) };
    vi.spyOn(repo, 'finishEmailJob').mockRejectedValueOnce(new Error('Uncertain commit'));
    expect(await deliverPendingEmails(repo, dynamicStorage, provider)).toMatchObject({ sent: 1, failed: 1 });
    await deliverPendingEmails(repo, dynamicStorage, provider);
    const [original, duplicate] = [provider.send.mock.calls[0], provider.send.mock.calls[2]];
    expect(duplicate).toEqual(original);
    expect(dynamicStorage.signDownload).toHaveBeenCalledTimes(1);
    sqlite.close();
  });

  it('sends Resend Reply-To, HTML/text and stable idempotency key without tracking flags', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    const provider = new ResendEmailProvider({ ...env, RESEND_API_KEY: 'test-placeholder' }, { fetchImpl });
    const message = await renderEmail({ kind: 'internal' }, sampleTicket(), null, storage, env);
    await provider.send(message, { idempotencyKey: 'support/job-id' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers['Idempotency-Key']).toBe('support/job-id');
    expect(JSON.parse(init.body)).toMatchObject({ reply_to: 'ana@example.test', text: expect.any(String), html: expect.any(String) });
    expect(init.body).not.toMatch(/track_opens|track_clicks/);
  });
});
