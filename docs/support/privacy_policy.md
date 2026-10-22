# Privacy Policy — Persiga Support Service

**Last updated:** 20 October 2026

**Service:** Persiga support form and support API, available at `https://duar.ch/support`

**Controller:** André Duarch

**Contact:** [support@duar.ch](mailto:support@duar.ch)

This policy applies **exclusively to the Persiga support service** — the support form, its API, and the related email and storage infrastructure. It does not cover the Persiga game app for iOS and Android, which has its own privacy policy, nor the rest of the portfolio website. Using the support form is voluntary and does not require an account.

## 1. Who is responsible

André Duarch is the controller of the personal data described here. As an individual developer, I am the only person with routine access to support data. A person explicitly authorized to represent me may also access it when necessary to handle a request. Administrative access requires a private token and is not available through any public interface.

## 2. What information is collected

When you submit the support form, the following information is collected:

| Information | Required? | Purpose |
| --- | --- | --- |
| Name | Yes | Identify and address you |
| Email address | Yes | Reply to your request and send confirmations/status updates |
| Country | Yes | Context for the request |
| App | Yes | Identify which Persiga product the request concerns |
| Description (20–5,000 characters) | Yes | Understand and handle your request |
| Consent | Yes | Record that you agreed to this policy |
| Phone number | No | Contact you if you provide it; validated and stored in E.164 format |
| City | No | Additional context |
| Attachments (up to 5 files) | No | Evidence or details you choose to send |
| Language preference | Automatic | Reply in the language you selected |
| Ticket protocol and status | Automatic | Track and manage the request |
| Timestamps and consent version | Automatic | Record when consent was given and which version was accepted |
| Idempotency key | Automatic | Prevent duplicate tickets when a submission is retried |
| Hashed rate-limit identifier | Automatic | Protect the form from abuse; derived from your IP with a secret and not stored as a raw IP |

Attachments may be images (JPEG, PNG, WebP, HEIC; up to 10 MB each) or videos (MP4, QuickTime/MOV, WebM; up to 50 MB each). File type is validated by content, and the storage key extension is derived from the validated MIME type, not from the file name.

The support page does **not** load analytics scripts from the main portfolio, and the support service does **not** use advertising identifiers, tracking pixels, or cross-site tracking.

## 3. How information is used

Information submitted through the support form is used **only** to:

- receive, register, and track your support request;
- reply to you and send transactional emails (confirmation, status changes, optional messages from support);
- validate and store attachments you choose to send;
- protect the service against abuse, spam, and duplicate submissions;
- comply with legal obligations and respond to lawful requests.

It is **not** used for marketing, advertising, profiling, analytics, or any purpose unrelated to handling your request. It is **not sold, rented, or traded**.

## 4. Legal bases

Under the Brazilian General Data Protection Law (LGPD), processing relies on:

- **Consent** (Art. 7, I) for the data you voluntarily submit through the form;
- **Legitimate interest** and, where applicable, **contract execution or preliminary procedures** (Art. 7, V and IX) for handling the request and maintaining service security;
- **Legal obligation** (Art. 7, II) where retention or disclosure is required by law.

You may withdraw consent at any time, subject to legal retention obligations.

## 5. Sharing and processors

Support data is processed by the following service providers, solely to operate the support service:

| Provider | Role |
| --- | --- |
| Cloudflare (Workers, D1, R2) | Hosts the support API, stores ticket records, and stores attachments in a private bucket |
| Resend | Delivers transactional emails |
| Zoho | Receives internal support notifications at `support@duar.ch` and stores correspondence |

These providers may process data outside Brazil and have their own privacy and security practices. No other third parties receive support data. There is no sale, rental, or commercial sharing of personal data, and no advertising or analytics partners.

Attachments are stored in a **private** bucket. Only the internal support notification contains presigned download links (valid for seven days). The confirmation email sent to you contains only the file names, not download links. New links can be issued by the administrator while the object still exists; links do not restore objects deleted by retention.

## 6. International transfers

Cloudflare, Resend, and Zoho may process data in countries other than Brazil. Where required, transfers rely on the providers' contractual safeguards and on the legal bases above.

## 7. Retention

- **Tickets, events, attachment metadata, and the email queue:** kept for as long as necessary to handle your request and meet legal obligations. There is currently no automatic deletion of these records; I am defining a retention schedule and will delete or anonymize data upon request, except where retention is legally required.
- **Attachment objects in R2:** removed by a bucket lifecycle rule after **90 days**. Pending uploads that are never attached to a ticket may be removed sooner by an optional one-day rule.
- **Upload reservations:** valid for one hour; an expired reservation does not by itself delete the corresponding database row.
- **Rate-limit records:** cleared after **two days**.
- **Email copies at Zoho and Resend:** retained according to those providers' policies.

Because the support service has no public tracking page and no magic link, ticket status is not exposed publicly.

## 8. Security

The support service uses HTTPS, a Content Security Policy and other security headers, Turnstile challenges, a honeypot, per-IP rate limits, strict server-side validation, HMAC-signed upload proofs, and a constant-time-compared administrative token. Credentials for R2, Resend, and Turnstile remain on the server and are never sent to the browser. The public configuration endpoint exposes only what the form needs.

The service does not log raw IP addresses, form contents, or provider responses. The persisted rate-limit identifier is a secret-keyed hash. R2 remains private, with CORS restricted to approved origins. Email open and click tracking is disabled.

No system is absolutely secure. Please keep your device and browser updated and avoid sending sensitive information that is not necessary for your request.

## 9. Your rights

Subject to applicable law, you may request:

- confirmation that your data is processed;
- access to your data;
- correction of incomplete, inaccurate, or outdated data;
- anonymization, blocking, or deletion of unnecessary, excessive, or unlawfully processed data;
- information about sharing;
- portability where applicable;
- withdrawal of consent.

Send requests to [support@duar.ch](mailto:support@duar.ch). I may ask only for the information necessary to confirm your identity and handle the request safely. You may also petition the Brazilian Data Protection Authority (ANPD), as provided by law.

## 10. Children and adolescents

The support form is not directed at children. If a parent or guardian identifies that personal data of a child or adolescent was sent to support, they may contact [support@duar.ch](mailto:support@duar.ch) to request evaluation and appropriate measures, including deletion where applicable.

## 11. Changes

This policy may be updated to reflect changes in the support service or legal requirements. The date at the top identifies the most recent revision. Material changes will be communicated through appropriate means; where required, additional information will be provided and consent requested before new processing.

## 12. Contact

For questions, support, or privacy requests:

**André Duarch — [support@duar.ch](mailto:support@duar.ch)**