import en from '../locales/en.js';
import ptBR from '../locales/pt-BR.js';
import es from '../locales/es.js';
import { apps } from '../shared/schema.js';
import { sha256 } from './security.js';

const dictionaries = { en, 'pt-BR': ptBR, es };
export function translate(locale, key, variables = {}) {
  const value = dictionaries[locale]?.[key] ?? en[key] ?? key;
  return value.replace(/\{(\w+)\}/g, (_, name) => String(variables[name] ?? ''));
}

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g,
  (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export class ResendEmailProvider {
  constructor(env, { fetchImpl = fetch } = {}) {
    this.env = env;
    this.fetchImpl = fetchImpl;
  }

  async send(message, { idempotencyKey } = {}) {
    if (!this.env.RESEND_API_KEY) throw Object.assign(new Error('Email unavailable'), { code: 'EMAIL_CONFIGURATION' });
    const response = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      // Tracking stays disabled on the verified Resend domain. No tracking options or pixels.
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      // Provider response bodies may contain personal data; never log or persist them.
      throw Object.assign(new Error('Email delivery failed'), {
        code: response.status === 429 ? 'EMAIL_RATE_LIMIT' : `EMAIL_HTTP_${response.status}`,
      });
    }
  }
}

export async function renderEmail(job, ticket, event, storage, env) {
  const t = (key, variables) => translate(ticket.locale, key, variables);
  const app = apps.find((item) => item.id === ticket.appId);
  const appName = app?.id === 'other' ? t('ui.otherApp') : app?.name ?? ticket.appId;
  const status = t(`status.${event?.status ?? ticket.status}`);
  const variables = { protocol: ticket.protocol, name: ticket.name, app: appName, status };
  const inbox = env.SUPPORT_INBOX || 'support@duar.ch';
  const kind = job.kind === 'internal' ? 'internal' : job.kind === 'status' ? 'status' : 'confirmation';
  const subject = t(`email.${kind}.subject`, variables);
  const title = t(`email.${kind}.title`, variables);
  const intro = t(`email.${kind}.intro`, variables);
  let fields;
  if (kind === 'status') {
    fields = [['protocol', ticket.protocol], ['status', status]];
    if (event?.message) fields.push(['message', event.message]);
  } else {
    fields = [
      ['protocol', ticket.protocol], ['createdAt', ticket.createdAt], ['locale', ticket.locale],
      ['name', ticket.name], ['email', ticket.email], ['phone', ticket.phone || t('email.none')],
      ['country', `${new Intl.DisplayNames([ticket.locale], { type: 'region' }).of(ticket.country)} (${ticket.country})`],
      ['city', ticket.city || t('email.none')], ['app', appName], ['description', ticket.description],
      ['wantsReply', t(ticket.wantsReply ? 'email.yes' : 'email.no')],
      ['consentAt', ticket.consentAt], ['consentVersion', ticket.consentVersion],
      ['status', status],
    ];
  }
  const fieldLabel = (key) => key === 'message' ? t('email.status.message') : t(`email.fields.${key}`);
  const textFields = fields.map(([key, value]) => `${fieldLabel(key)}: ${value}`).join('\n');
  const htmlFields = fields.map(([key, value]) =>
    `<dt><strong>${escapeHtml(fieldLabel(key))}</strong></dt><dd style="white-space:pre-wrap;margin:0 0 12px">${escapeHtml(value)}</dd>`).join('');
  const files = [];
  if (kind !== 'status') {
    for (const file of ticket.attachments || []) {
      const url = kind === 'internal' ? await storage.signDownload(file.key) : null;
      files.push({ name: file.name, type: file.type, size: file.size, url });
    }
  }
  const fileText = files.length ? files.map((file) =>
    file.url ? `${file.name} (${file.type}, ${file.size} bytes): ${file.url}` : file.name).join('\n') : t('email.none');
  const fileHtml = files.length ? `<ul>${files.map((file) => `<li>${file.url
    ? `<a href="${escapeHtml(file.url)}">${escapeHtml(file.name)}</a> (${escapeHtml(file.type)}, ${file.size} bytes)`
    : escapeHtml(file.name)}</li>`).join('')}</ul>` : `<p>${escapeHtml(t('email.none'))}</p>`;
  const attachmentsText = kind === 'status' ? '' : `\n\n${t('email.fields.attachments')}:\n${fileText}`;
  const attachmentsHtml = kind === 'status' ? '' : `<h2>${escapeHtml(t('email.fields.attachments'))}</h2>${fileHtml}`;
  const note = kind === 'internal' ? t('email.attachmentExpiry')
    : kind === 'confirmation' ? t('email.confirmation.nextSteps', variables) : '';
  const contact = t('email.contact', { email: inbox });
  return {
    from: kind === 'internal' ? env.EMAIL_FROM_INTERNAL || 'form@notify.duar.ch' : env.EMAIL_FROM_USER || 'support@notify.duar.ch',
    to: [kind === 'internal' ? inbox : ticket.email],
    reply_to: kind === 'internal' ? ticket.email : inbox,
    subject,
    text: `${title}\n\n${intro}\n\n${textFields}${attachmentsText}\n\n${note}\n${contact}\n${t('email.footer', variables)}`,
    html: `<!doctype html><html lang="${escapeHtml(ticket.locale)}"><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p><dl>${htmlFields}</dl>${attachmentsHtml}<p>${escapeHtml(note)}</p><p>${escapeHtml(contact)}</p><p>${escapeHtml(t('email.footer', variables))}</p></body></html>`,
  };
}

export async function deliverPendingEmails(repo, storage, emailProvider, { protocol, limit = 3 } = {}) {
  const jobs = await repo.listPendingEmailJobs({ protocol, limit });
  const result = { sent: 0, failed: 0, skipped: 0 };
  for (const job of jobs) {
    const now = new Date().toISOString();
    if (!await repo.claimEmailJob(job.id, now)) { result.skipped++; continue; }
    try {
      const ticket = await repo.getTicket(job.protocol);
      if (!ticket) throw Object.assign(new Error('Missing ticket'), { code: 'EMAIL_TICKET_MISSING' });
      // Recheck the preference when delivering deferred status jobs as well.
      if (job.kind === 'status' && !ticket.wantsReply) {
        await repo.finishEmailJob(job.id, now);
        result.skipped++;
        continue;
      }
      const cached = await repo.getEmailJobPayload(job.id);
      // Signed attachment URLs must stay identical across uncertain deliveries:
      // Resend rejects reusing an idempotency key with a different request body.
      // Refresh after six days so a deferred message still has working links.
      const fresh = cached && Date.now() - new Date(cached.createdAt).getTime() < 6 * 86400000;
      let message = fresh ? cached.message : null;
      if (!message) {
        const event = job.eventId ? await repo.getStatusEvent(job.eventId) : null;
        message = await renderEmail(job, ticket, event, storage, emailProvider.env || {});
        await repo.saveEmailJobPayload(job.id, message, now);
      }
      const payloadHash = await sha256(JSON.stringify(message));
      await emailProvider.send(message, { idempotencyKey: `support/${job.id}/${payloadHash}` });
      await repo.finishEmailJob(job.id, new Date().toISOString());
      result.sent++;
    } catch (error) {
      await repo.failEmailJob(job.id, /^[A-Z0-9_]{1,60}$/.test(error?.code || '') ? error.code : 'EMAIL_DELIVERY_FAILED');
      result.failed++;
    }
  }
  return result;
}
