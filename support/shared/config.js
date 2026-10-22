export const LIMITS = Object.freeze({
  maxFiles: 5,
  imageBytes: 10 * 1024 * 1024,
  videoBytes: 50 * 1024 * 1024,
  uploadExpiresSeconds: 900,
  downloadExpiresSeconds: 604800,
})

export const MIME_TYPES = Object.freeze({
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/png': { ext: 'png', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'image/heic': { ext: 'heic', kind: 'image' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/quicktime': { ext: 'mov', kind: 'video' },
  'video/webm': { ext: 'webm', kind: 'video' },
})

// Review the short notice and linked policy before changing this version.
export const CONSENT_VERSION = '2026-10-22-1'
export const STATUSES = Object.freeze(['received', 'in_review', 'awaiting_user', 'resolved'])
