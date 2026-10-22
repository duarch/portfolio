import { z } from 'zod'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import configuredApps from '../../config/apps.json' with { type: 'json' }
import { CONSENT_VERSION, LIMITS, MIME_TYPES, STATUSES } from './config.js'
import { COUNTRIES } from './locale.js'

export const apps = configuredApps
export const appsSchema = z.array(z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,49}$/, { message: 'errors.app' }),
  name: z.string().trim().min(1).max(100),
}).strict()).min(1).superRefine((items, context) => {
  if (new Set(items.map(({ id }) => id)).size !== items.length || items.at(-1)?.id !== 'other') {
    context.addIssue({ code: 'custom', message: 'errors.app' })
  }
})

// Keep line breaks in descriptions; remove control characters and normalize text.
const cleanText = (value) => value.normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '').trim()
const singleLine = (value) => cleanText(value).replace(/[\r\n\t]/g, ' ').replace(/ {2,}/g, ' ')
const text = (key) => z.string({ error: key }).transform(cleanText)
const line = (key) => z.string({ error: key }).transform(singleLine)
const requiredLine = (key, minimum, maximum) => line(key).pipe(z.string().min(minimum, { message: key }).max(maximum, { message: key }))

export function sanitizeFilename(value) {
  if (typeof value !== 'string') return 'attachment'
  const basename = value.split(/[\\/]/).at(-1)
  const cleaned = singleLine(basename).replace(/[<>:"|?*]/g, '_').replace(/^\.+/, '').trim()
  return cleaned.slice(0, 180) || 'attachment'
}

export const uploadMetadataSchema = z.object({
  name: requiredLine('errors.attachments', 1, 255).transform(sanitizeFilename),
  type: z.string({ error: 'errors.type' }).refine((type) => Object.hasOwn(MIME_TYPES, type), { message: 'errors.type' }),
  size: z.number({ error: 'errors.size' }).int({ message: 'errors.size' }).positive({ message: 'errors.size' }),
}, { error: 'errors.attachments' }).strict().superRefine(({ type, size }, context) => {
  const metadata = MIME_TYPES[type]
  if (metadata && size > (metadata.kind === 'image' ? LIMITS.imageBytes : LIMITS.videoBytes)) {
    context.addIssue({ code: 'custom', path: ['size'], message: 'errors.size' })
  }
})

const tokenSchema = z.string({ error: 'errors.turnstile' }).trim().min(1, { message: 'errors.turnstile' }).max(2048, { message: 'errors.turnstile' })
const honeypotSchema = z.string({ error: 'errors.request' }).max(0, { message: 'errors.spam' }).default('')
const localeSchema = z.enum(['en', 'pt-BR', 'es'], { error: 'errors.request' })
const keySchema = z.string({ error: 'errors.key' }).regex(
  /^pending\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|heic|mp4|mov|webm)$/,
  { message: 'errors.key' },
)

export const attachmentReferenceSchema = z.object({
  key: keySchema,
  proof: z.string({ error: 'errors.key' }).min(1, { message: 'errors.key' }).max(4096, { message: 'errors.key' }),
}, { error: 'errors.key' }).strict()

export const uploadRequestSchema = z.object({
  files: z.array(uploadMetadataSchema, { error: 'errors.attachments' }).min(1, { message: 'errors.attachments' }).max(LIMITS.maxFiles, { message: 'errors.attachments' }),
  turnstileToken: tokenSchema,
  website: honeypotSchema,
  locale: localeSchema,
}, { error: 'errors.request' }).strict()

export const ticketSchema = z.object({
  name: requiredLine('errors.name', 2, 150),
  email: line('errors.email').pipe(z.string().email({ message: 'errors.email' }).max(254, { message: 'errors.email' })),
  phone: line('errors.phone').pipe(z.string().max(60, { message: 'errors.phone' })).default(''),
  country: z.string({ error: 'errors.country' }).trim().refine((country) => COUNTRIES.includes(country), { message: 'errors.country' }),
  city: line('errors.request').pipe(z.string().max(120, { message: 'errors.request' })).default(''),
  appId: z.string({ error: 'errors.app' }).trim().refine((id) => apps.some((app) => app.id === id), { message: 'errors.app' }),
  description: text('errors.description').pipe(z.string().min(20, { message: 'errors.description' }).max(5000, { message: 'errors.description' })),
  wantsReply: z.boolean({ error: 'errors.request' }).default(true),
  consent: z.literal(true, { error: 'errors.consent' }),
  consentVersion: z.literal(CONSENT_VERSION, { error: 'errors.consent' }),
  locale: localeSchema,
  attachments: z.array(attachmentReferenceSchema, { error: 'errors.attachments' }).max(LIMITS.maxFiles, { message: 'errors.attachments' }).default([]),
  turnstileToken: tokenSchema,
  website: honeypotSchema,
}, { error: 'errors.request' }).strict().superRefine((ticket, context) => {
  if (ticket.phone) {
    const phone = parsePhoneNumberFromString(ticket.phone, ticket.country)
    if (!phone?.isValid()) context.addIssue({ code: 'custom', path: ['phone'], message: 'errors.phone' })
  }
  if (new Set(ticket.attachments.map(({ key }) => key)).size !== ticket.attachments.length) {
    context.addIssue({ code: 'custom', path: ['attachments'], message: 'errors.attachments' })
  }
}).transform((ticket) => ({
  ...ticket,
  phone: ticket.phone ? parsePhoneNumberFromString(ticket.phone, ticket.country).number : '',
}))

export const protocolSchema = z.string({ error: 'errors.request' }).regex(/^DUAR-\d{4}-\d{6}$/, { message: 'errors.request' })
export const retryEmailsSchema = z.object({ protocol: protocolSchema.optional() }, { error: 'errors.request' }).strict()
export const statusSchema = z.object({
  protocolo: protocolSchema,
  status: z.enum(STATUSES, { error: 'errors.request' }),
  mensagem: text('errors.request').pipe(z.string().max(5000, { message: 'errors.request' })).optional(),
}, { error: 'errors.request' }).strict()
