PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS protocol_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL CHECK(last_number BETWEEN 1 AND 999999)
);
CREATE TABLE IF NOT EXISTS tickets (
  protocol TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('pt-BR','en','es')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  country TEXT NOT NULL,
  city TEXT,
  app_id TEXT NOT NULL,
  description TEXT NOT NULL,
  wants_reply INTEGER NOT NULL CHECK(wants_reply IN (0,1)),
  consent_at TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','in_review','awaiting_user','resolved')),
  status_updated_at TEXT NOT NULL,
  support_email_sent_at TEXT,
  user_email_sent_at TEXT,
  email_attempts INTEGER NOT NULL DEFAULT 0,
  last_email_error TEXT
);
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol TEXT NOT NULL REFERENCES tickets(protocol) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS attachments_protocol ON attachments(protocol);
CREATE TABLE IF NOT EXISTS status_events (
  id TEXT PRIMARY KEY,
  protocol TEXT NOT NULL REFERENCES tickets(protocol) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('received','in_review','awaiting_user','resolved')),
  message TEXT,
  created_at TEXT NOT NULL,
  notified_at TEXT
);
CREATE TABLE IF NOT EXISTS email_jobs (
  id TEXT PRIMARY KEY,
  protocol TEXT NOT NULL REFERENCES tickets(protocol) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('internal','confirmation','status')),
  event_id TEXT REFERENCES status_events(id),
  attempts INTEGER NOT NULL DEFAULT 0,
  claimed_until TEXT,
  completed_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS email_jobs_pending ON email_jobs(completed_at, claimed_until, created_at);
CREATE TABLE IF NOT EXISTS pending_uploads (
  object_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  claim_id TEXT,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS pending_uploads_expiry ON pending_uploads(expires_at);
CREATE TABLE IF NOT EXISTS rate_limits (
  identity TEXT NOT NULL,
  action TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY(identity, action, window_start)
);
CREATE INDEX IF NOT EXISTS rate_limits_expiry ON rate_limits(window_start);
