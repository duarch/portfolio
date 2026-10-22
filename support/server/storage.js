import { AwsClient } from 'aws4fetch';
import { fileTypeFromBuffer } from 'file-type';
import { LIMITS, MIME_TYPES } from '../shared/config.js';
import { SupportError } from './security.js';

export class R2Storage {
  constructor(env, { fetchImpl = fetch } = {}) {
    if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) throw new Error('STORAGE_UNAVAILABLE');
    this.bucket = env.R2_BUCKET;
    this.endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    this.fetchImpl = fetchImpl;
    this.client = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
  }

  url(key) {
    return `${this.endpoint}/${encodeURIComponent(this.bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  async signedRequest(key, init = {}, expires) {
    const url = new URL(this.url(key));
    if (expires) url.searchParams.set('X-Amz-Expires', String(expires));
    return this.client.sign(url, { ...init, aws: { signQuery: Boolean(expires), allHeaders: true } });
  }

  async signUpload({ key, type }) {
    return (await this.signedRequest(key, { method: 'PUT', headers: { 'Content-Type': type } }, LIMITS.uploadExpiresSeconds)).url;
  }

  async signDownload(key) {
    return (await this.signedRequest(key, { method: 'GET' }, LIMITS.downloadExpiresSeconds)).url;
  }

  async request(key, init) {
    const response = await this.fetchImpl(await this.signedRequest(key, { ...init, signal: AbortSignal.timeout(15000) }));
    if (!response.ok) throw new SupportError('invalidAttachment', response.status === 404 ? 400 : 503);
    return response;
  }

  async head(key) {
    const response = await this.request(key, { method: 'HEAD' });
    const etag = response.headers.get('ETag');
    if (!etag) throw new SupportError('serverError', 503);
    return { size: Number(response.headers.get('Content-Length')), type: (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase(), etag };
  }

  async readHeader(key, { etag } = {}) {
    const response = await this.request(key, { method: 'GET', headers: { Range: 'bytes=0-8191', ...(etag ? { 'If-Match': etag } : {}) } });
    // Never buffer a full object if an upstream disregards Range.
    const reader = response.body.getReader();
    const bytes = new Uint8Array(8192);
    let size = 0;
    while (size < bytes.length) {
      const { value, done } = await reader.read();
      if (done) break;
      const length = Math.min(value.length, bytes.length - size);
      bytes.set(value.subarray(0, length), size);
      size += length;
    }
    await reader.cancel();
    return bytes.subarray(0, size);
  }

  async copy(source, destination, { etag } = {}) {
    const sourcePath = `/${encodeURIComponent(this.bucket)}/${source.split('/').map(encodeURIComponent).join('/')}`;
    const response = await this.request(destination, { method: 'PUT', headers: { 'x-amz-copy-source': sourcePath, ...(etag ? { 'x-amz-copy-source-if-match': etag } : {}) } });
    // S3 may return HTTP 200 with a copy error document.
    if (/<Error(?:>|\s)/.test(await response.text())) throw new SupportError('serverError', 503);
  }

  async delete(key) {
    await this.request(key, { method: 'DELETE' });
  }
}

export async function validateStoredUpload(storage, file) {
  const allowed = MIME_TYPES[file.type];
  const head = await storage.head(file.key);
  const maxSize = allowed?.kind === 'image' ? LIMITS.imageBytes : LIMITS.videoBytes;
  if (!allowed || head.size !== file.size || head.type !== file.type || head.size <= 0 || head.size > maxSize) throw new SupportError('invalidAttachment');
  let header;
  try { header = await storage.readHeader(file.key, { etag: head.etag }); }
  catch (error) {
    if (error instanceof SupportError) throw error;
    throw new SupportError('serverError', 503);
  }
  let detected;
  try { detected = await fileTypeFromBuffer(header); }
  catch { throw new SupportError('invalidAttachment'); }
  // HEIC can be detected as HEIF depending on the ISO-BMFF compatible brands.
  const matches = detected?.mime === file.type || (file.type === 'image/heic' && detected?.mime === 'image/heif');
  if (!matches) throw new SupportError('invalidAttachment');
  return { ...file, etag: head.etag };
}
