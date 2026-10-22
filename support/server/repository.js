const ticketFromRow = (row) => row && ({
  protocol: row.protocol, idempotencyKey: row.idempotency_key, requestHash: row.request_hash,
  createdAt: row.created_at, locale: row.locale, name: row.name, email: row.email,
  phone: row.phone || '', country: row.country, city: row.city || '', appId: row.app_id,
  description: row.description, wantsReply: Boolean(row.wants_reply), consentAt: row.consent_at,
  consentVersion: row.consent_version, status: row.status, statusUpdatedAt: row.status_updated_at,
  supportEmailSentAt: row.support_email_sent_at, userEmailSentAt: row.user_email_sent_at,
  emailAttempts: row.email_attempts, lastEmailError: row.last_email_error,
});

export class D1Repository {
  constructor(db) {
    if (!db?.prepare) throw new Error('DATABASE_UNAVAILABLE');
    this.db = db;
  }

  async nextProtocol(year) {
    const row = await this.db.prepare(`INSERT INTO protocol_counters(year,last_number) VALUES (?,1)
      ON CONFLICT(year) DO UPDATE SET last_number=last_number+1 RETURNING last_number`).bind(year).first();
    return `DUAR-${year}-${String(row.last_number).padStart(6, '0')}`;
  }

  async findByIdempotency(key) {
    return ticketFromRow(await this.db.prepare('SELECT * FROM tickets WHERE idempotency_key=?').bind(key).first());
  }

  async getTicket(protocol) {
    const row = await this.db.prepare('SELECT * FROM tickets WHERE protocol=?').bind(protocol).first();
    if (!row) return null;
    const attachments = await this.db.prepare('SELECT object_key AS key,name,type,size FROM attachments WHERE protocol=? ORDER BY id').bind(protocol).all();
    return { ...ticketFromRow(row), attachments: attachments.results };
  }

  async saveTicket(ticket, attachments, idempotencyKey) {
    const statements = [this.db.prepare(`INSERT INTO tickets
      (protocol,idempotency_key,request_hash,created_at,locale,name,email,phone,country,city,app_id,description,
       wants_reply,consent_at,consent_version,status,status_updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(ticket.protocol, idempotencyKey, ticket.requestHash, ticket.createdAt, ticket.locale, ticket.name,
        ticket.email, ticket.phone || null, ticket.country, ticket.city || null, ticket.appId, ticket.description,
        Number(ticket.wantsReply), ticket.consentAt, ticket.consentVersion, 'received', ticket.createdAt)];
    for (const file of attachments) statements.push(this.db.prepare(
      'INSERT INTO attachments(protocol,object_key,name,type,size) VALUES (?,?,?,?,?)')
      .bind(ticket.protocol, file.key, file.name, file.type, file.size));
    for (const kind of ['internal', 'confirmation']) statements.push(this.db.prepare(
      'INSERT INTO email_jobs(id,protocol,kind,created_at) VALUES (?,?,?,?)')
      .bind(crypto.randomUUID(), ticket.protocol, kind, ticket.createdAt));
    await this.db.batch(statements);
  }

  async addPendingUploads(records) {
    await this.db.batch(records.map((file) => this.db.prepare(
      'INSERT INTO pending_uploads(object_key,name,type,size,expires_at) VALUES (?,?,?,?,?)')
      .bind(file.key, file.name, file.type, file.size, file.expiresAt)));
  }

  async getPendingUpload(key) {
    const row = await this.db.prepare('SELECT * FROM pending_uploads WHERE object_key=?').bind(key).first();
    return row && { key: row.object_key, name: row.name, type: row.type, size: row.size,
      expiresAt: row.expires_at, claimId: row.claim_id, consumedAt: row.consumed_at };
  }

  async claimPendingUploads(keys, claimId, now = Math.floor(Date.now() / 1000)) {
    if (!keys.length) return true;
    const placeholders = keys.map(() => '?').join(',');
    await this.db.prepare(`UPDATE pending_uploads SET claim_id=? WHERE object_key IN (${placeholders})
      AND consumed_at IS NULL AND claim_id IS NULL AND expires_at>?`).bind(claimId, ...keys, now).run();
    const row = await this.db.prepare('SELECT COUNT(*) AS total FROM pending_uploads WHERE claim_id=?').bind(claimId).first();
    if (row.total !== keys.length) {
      await this.releasePendingUploads(claimId);
      return false;
    }
    return true;
  }

  async releasePendingUploads(claimId) {
    await this.db.prepare('UPDATE pending_uploads SET claim_id=NULL WHERE claim_id=? AND consumed_at IS NULL').bind(claimId).run();
  }

  async consumePendingUploads(claimId, now = new Date().toISOString()) {
    await this.db.prepare('UPDATE pending_uploads SET consumed_at=? WHERE claim_id=?').bind(now, claimId).run();
  }

  async checkRateLimit(identity, action, limit, windowSeconds, now = Math.floor(Date.now() / 1000)) {
    const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
    const row = await this.db.prepare(`INSERT INTO rate_limits(identity,action,window_start,count) VALUES (?,?,?,1)
      ON CONFLICT(identity,action,window_start) DO UPDATE SET count=count+1 RETURNING count`)
      .bind(identity, action, windowStart).first();
    // Bound retention to two days without retaining source IP addresses.
    await this.db.prepare('DELETE FROM rate_limits WHERE window_start<?').bind(now - 172800).run();
    return row.count <= limit;
  }

  async updateStatus(protocol, status, message, now = new Date().toISOString()) {
    const ticket = await this.getTicket(protocol);
    if (!ticket || ticket.status === status) return ticket ? { changed: false, ticket } : null;
    const id = crypto.randomUUID();
    const statements = [this.db.prepare(`INSERT INTO status_events(id,protocol,status,message,created_at)
      SELECT ?,protocol,?,?,? FROM tickets WHERE protocol=? AND status=? AND status<>?`)
      .bind(id, status, message || null, now, protocol, ticket.status, status),
      this.db.prepare('UPDATE tickets SET status=?,status_updated_at=? WHERE protocol=? AND EXISTS(SELECT 1 FROM status_events WHERE id=?)')
        .bind(status, now, protocol, id)];
    if (ticket.wantsReply) statements.push(this.db.prepare(
      "INSERT INTO email_jobs(id,protocol,kind,event_id,created_at) SELECT ?,protocol,'status',id,? FROM status_events WHERE id=?")
      .bind(crypto.randomUUID(), now, id));
    const results = await this.db.batch(statements);
    return { changed: results[0].meta.changes === 1, ticket: await this.getTicket(protocol), eventId: id };
  }

  async getStatusEvent(id) {
    const row = await this.db.prepare('SELECT * FROM status_events WHERE id=?').bind(id).first();
    return row && { id: row.id, protocol: row.protocol, status: row.status, message: row.message || '', createdAt: row.created_at, notifiedAt: row.notified_at };
  }

  async getEmailJobPayload(id) {
    const row = await this.db.prepare('SELECT payload_json,payload_created_at FROM email_jobs WHERE id=?').bind(id).first();
    return row?.payload_json ? { message: JSON.parse(row.payload_json), createdAt: row.payload_created_at } : null;
  }

  async saveEmailJobPayload(id, message, now = new Date().toISOString()) {
    await this.db.prepare('UPDATE email_jobs SET payload_json=?,payload_created_at=? WHERE id=? AND completed_at IS NULL')
      .bind(JSON.stringify(message), now, id).run();
  }

  async listPendingEmailJobs({ protocol, limit = 20 } = {}) {
    const filter = protocol ? ' AND protocol=?' : '';
    const query = this.db.prepare(`SELECT id,protocol,kind,event_id AS eventId,attempts FROM email_jobs
      WHERE completed_at IS NULL AND (claimed_until IS NULL OR claimed_until<=?)${filter} ORDER BY created_at,id LIMIT ?`);
    return (await query.bind(new Date().toISOString(), ...(protocol ? [protocol] : []), Math.max(1, Math.min(limit, 100))).all()).results;
  }

  async claimEmailJob(id, now = new Date().toISOString()) {
    const until = new Date(new Date(now).getTime() + 120000).toISOString();
    const result = await this.db.prepare(`UPDATE email_jobs SET claimed_until=?,attempts=attempts+1
      WHERE id=? AND completed_at IS NULL AND (claimed_until IS NULL OR claimed_until<=?)`).bind(until, id, now).run();
    return result.meta.changes === 1;
  }

  async finishEmailJob(id, now = new Date().toISOString()) {
    const job = await this.db.prepare('SELECT * FROM email_jobs WHERE id=?').bind(id).first();
    if (!job) return;
    const statements = [this.db.prepare('UPDATE email_jobs SET completed_at=?,claimed_until=NULL,last_error=NULL,payload_json=NULL,payload_created_at=NULL WHERE id=?').bind(now, id),
      this.db.prepare(`UPDATE tickets SET email_attempts=email_attempts+1,last_email_error=(
        SELECT last_error FROM email_jobs WHERE protocol=? AND completed_at IS NULL AND last_error IS NOT NULL
        ORDER BY created_at,id DESC LIMIT 1) WHERE protocol=?`).bind(job.protocol, job.protocol)];
    if (job.kind === 'internal') statements.push(this.db.prepare('UPDATE tickets SET support_email_sent_at=? WHERE protocol=?').bind(now, job.protocol));
    if (job.kind === 'confirmation') statements.push(this.db.prepare('UPDATE tickets SET user_email_sent_at=? WHERE protocol=?').bind(now, job.protocol));
    if (job.event_id) statements.push(this.db.prepare('UPDATE status_events SET notified_at=? WHERE id=?').bind(now, job.event_id));
    await this.db.batch(statements);
  }

  async failEmailJob(id, code = 'EMAIL_DELIVERY_FAILED') {
    const safeCode = /^[A-Z0-9_]{1,60}$/.test(code) ? code : 'EMAIL_DELIVERY_FAILED';
    await this.db.batch([this.db.prepare('UPDATE email_jobs SET claimed_until=NULL,last_error=? WHERE id=?').bind(safeCode, id),
      this.db.prepare('UPDATE tickets SET email_attempts=email_attempts+1,last_email_error=? WHERE protocol=(SELECT protocol FROM email_jobs WHERE id=?)').bind(safeCode, id)]);
  }

  async emailDeliveryStats(protocol) {
    return this.db.prepare(`SELECT COUNT(*) AS total,SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) AS sent,
      SUM(CASE WHEN completed_at IS NULL THEN 1 ELSE 0 END) AS pending FROM email_jobs WHERE protocol=?`).bind(protocol).first();
  }
}
