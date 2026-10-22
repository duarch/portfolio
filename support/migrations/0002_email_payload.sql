-- Reuse the exact email body after a successful send whose database acknowledgement
-- was interrupted. Resend idempotency requires an identical request payload.
ALTER TABLE email_jobs ADD COLUMN payload_json TEXT;
ALTER TABLE email_jobs ADD COLUMN payload_created_at TEXT;
