import { describe, expect, it } from 'vitest'
import { CONSENT_VERSION, LIMITS, MIME_TYPES } from '../../support/shared/config.js'
import { COUNTRIES, dictionaries, normalizeLocale, resolveLocale, translate } from '../../support/shared/locale.js'
import {
  apps, appsSchema, sanitizeFilename, statusSchema, ticketSchema, uploadMetadataSchema, uploadRequestSchema,
} from '../../support/shared/schema.js'

const attachmentKey = 'pending/97ab6411-bca8-4df8-a542-7ea96bfa4115.png'
const validTicket = (overrides = {}) => ({
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  country: 'BR',
  appId: 'persiga',
  description: 'The app closes whenever I open the settings screen.',
  wantsReply: true,
  consent: true,
  consentVersion: CONSENT_VERSION,
  locale: 'pt-BR',
  attachments: [],
  turnstileToken: 'mock-turnstile-token',
  website: '',
  ...overrides,
})

describe('shared ticket validation', () => {
  it('accepts optional fields omitted and preserves the request for updates', () => {
    const ticket = ticketSchema.parse(validTicket())
    expect(ticket).toMatchObject({ phone: '', city: '', attachments: [], wantsReply: true })
    expect(ticketSchema.parse(validTicket({ wantsReply: false })).wantsReply).toBe(false)
  })

  it('trims and removes controls without destroying description line breaks', () => {
    const ticket = ticketSchema.parse(validTicket({
      name: '  Ada\u0000\nLovelace  ',
      email: ' ada@example.com ',
      city: '  São\u0001 Paulo  ',
      description: '  The app fails.\nPlease investigate this issue.\u0000  ',
    }))
    expect(ticket.name).toBe('Ada Lovelace')
    expect(ticket.email).toBe('ada@example.com')
    expect(ticket.city).toBe('São Paulo')
    expect(ticket.description).toBe('The app fails.\nPlease investigate this issue.')
  })

  it.each(['name', 'email', 'country', 'appId', 'description', 'consent', 'consentVersion', 'turnstileToken', 'locale'])(
    'rejects a missing required %s with a translatable error', (field) => {
      const candidate = validTicket()
      delete candidate[field]
      const result = ticketSchema.safeParse(candidate)
      expect(result.success).toBe(false)
      expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true)
      expect(result.error.issues.every((issue) => Object.hasOwn(dictionaries.en, issue.message))).toBe(true)
    },
  )

  it.each([
    ['name', 'A'], ['name', 'a'.repeat(151)], ['email', 'invalid-email'],
    ['email', `${'a'.repeat(250)}@example.com`], ['country', 'XX'], ['country', 'br'],
    ['appId', 'unknown'], ['description', 'Too short'], ['description', 'a'.repeat(5001)],
    ['phone', '123'], ['city', 'a'.repeat(121)], ['consent', false],
    ['consentVersion', 'outdated'], ['website', 'spam'], ['locale', 'fr'],
  ])('rejects invalid %s', (field, value) => {
    const result = ticketSchema.safeParse(validTicket({ [field]: value }))
    expect(result.success).toBe(false)
    expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true)
  })

  it('accepts description limits and rejects unknown properties', () => {
    expect(ticketSchema.safeParse(validTicket({ description: 'x'.repeat(20) })).success).toBe(true)
    expect(ticketSchema.safeParse(validTicket({ description: 'x'.repeat(5000) })).success).toBe(true)
    const result = ticketSchema.safeParse(validTicket({ admin: true }))
    expect(result.success).toBe(false)
    expect(result.error.issues[0].message).toBe('errors.request')
  })

  it('normalizes national and international valid phone numbers to E.164', () => {
    expect(ticketSchema.parse(validTicket({ phone: '(11) 99999-1234' })).phone).toBe('+5511999991234')
    expect(ticketSchema.parse(validTicket({ phone: '+1 (415) 555-2671', country: 'US' })).phone).toBe('+14155552671')
    expect(ticketSchema.parse(validTicket({ phone: '   ' })).phone).toBe('')
  })

  it('accepts a signed pending reference and rejects duplicate or foreign attachment keys', () => {
    const attachment = { key: attachmentKey, proof: 'mock-signature' }
    expect(ticketSchema.safeParse(validTicket({ attachments: [attachment] })).success).toBe(true)
    expect(ticketSchema.safeParse(validTicket({ attachments: [attachment, attachment] })).success).toBe(false)
    for (const key of ['tickets/DUAR-2026-000001/file.png', 'pending/../../file.png', 'pending/file.exe', attachmentKey.replace('.png', '.exe')]) {
      expect(ticketSchema.safeParse(validTicket({ attachments: [{ ...attachment, key }] })).success).toBe(false)
    }
    expect(ticketSchema.safeParse(validTicket({ attachments: [{ key: attachmentKey }] })).success).toBe(false)
  })
})

describe('upload metadata and status schemas', () => {
  it.each(Object.entries(MIME_TYPES))('accepts configured type %s at its size limit', (type, { kind }) => {
    const size = kind === 'image' ? LIMITS.imageBytes : LIMITS.videoBytes
    expect(uploadMetadataSchema.safeParse({ name: 'example.bin', type, size }).success).toBe(true)
    expect(uploadMetadataSchema.safeParse({ name: 'example.bin', type, size: size + 1 }).success).toBe(false)
  })

  it.each([
    { name: 'file.svg', type: 'image/svg+xml', size: 100 },
    { name: 'file.png', type: 'image/png', size: 0 },
    { name: 'file.png', type: 'image/png', size: -1 },
    { name: 'file.png', type: 'image/png', size: 1.5 },
    { name: 'file.png', type: 'image/png', size: '100' },
    { name: 'file.png', type: 'image/png', size: 100, extra: true },
  ])('rejects invalid metadata %#', (file) => {
    expect(uploadMetadataSchema.safeParse(file).success).toBe(false)
  })

  it('accepts 1 to 5 uploads, requires a challenge, and rejects honeypot submissions', () => {
    const request = { files: [{ name: 'photo.png', type: 'image/png', size: 100 }], turnstileToken: 'test', locale: 'en' }
    expect(uploadRequestSchema.safeParse(request).success).toBe(true)
    expect(uploadRequestSchema.safeParse({ ...request, files: Array(5).fill(request.files[0]) }).success).toBe(true)
    expect(uploadRequestSchema.safeParse({ ...request, files: [] }).success).toBe(false)
    expect(uploadRequestSchema.safeParse({ ...request, files: Array(6).fill(request.files[0]) }).success).toBe(false)
    expect(uploadRequestSchema.safeParse({ ...request, turnstileToken: '' }).success).toBe(false)
    expect(uploadRequestSchema.safeParse({ ...request, website: 'spam' }).success).toBe(false)
  })

  it('sanitizes filenames without using client extensions for type validation', () => {
    expect(sanitizeFilename('../../image\u0000.png')).toBe('image.png')
    expect(sanitizeFilename('C:\\fakepath\\video.mov')).toBe('video.mov')
    expect(sanitizeFilename('<script>.png')).toBe('_script_.png')
    expect(sanitizeFilename('...')).toBe('attachment')
    expect(sanitizeFilename('x'.repeat(300))).toHaveLength(180)
    expect(uploadMetadataSchema.parse({ name: '../../photo.exe', type: 'image/png', size: 5 }).name).toBe('photo.exe')
  })

  it('validates protocol/status and bounds a sanitized optional support message', () => {
    expect(statusSchema.parse({ protocolo: 'DUAR-2026-000001', status: 'in_review', mensagem: '  Checking\u0000 now  ' })).toEqual({
      protocolo: 'DUAR-2026-000001', status: 'in_review', mensagem: 'Checking now',
    })
    expect(statusSchema.safeParse({ protocolo: 'DUAR-2026-000001', status: 'resolved' }).success).toBe(true)
    expect(statusSchema.safeParse({ protocolo: 'wrong', status: 'resolved' }).success).toBe(false)
    expect(statusSchema.safeParse({ protocolo: 'DUAR-2026-000001', status: 'deleted' }).success).toBe(false)
    expect(statusSchema.safeParse({ protocolo: 'DUAR-2026-000001', status: 'resolved', mensagem: 'a'.repeat(5001) }).success).toBe(false)
  })
})

describe('locale selection and translated content', () => {
  it('uses exactly the same non-empty keys and placeholders in all three locales', () => {
    const keys = Object.keys(dictionaries.en).sort()
    const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
    for (const dictionary of Object.values(dictionaries)) {
      expect(Object.keys(dictionary).sort()).toEqual(keys)
      for (const key of keys) {
        expect(typeof dictionary[key]).toBe('string')
        expect(dictionary[key].trim().length).toBeGreaterThan(0)
        expect(placeholders(dictionary[key])).toEqual(placeholders(dictionaries.en[key]))
      }
    }
  })

  it('translates administrative lookup and authentication errors', () => {
    for (const locale of ['en', 'pt-BR', 'es']) {
      expect(translate(locale, 'errors.notFound')).not.toBe('errors.notFound')
      expect(translate(locale, 'errors.unauthorized')).not.toBe('errors.unauthorized')
    }
  })

  it.each([
    ['pt', 'es', 'pt-BR'], ['pt-BR', 'en', 'pt-BR'], ['es', 'en', 'es'], ['en', 'pt-BR', 'en'],
    [undefined, 'de, es;q=0.7, pt-BR;q=0.9', 'pt-BR'],
    ['fr', 'fr;q=1, es-AR;q=0.9, en;q=0.3', 'es'],
    ['', 'en;q=0, es;q=0.5', 'es'], ['', 'es;q=0.4, pt;q=0.4', 'es'],
    ['', 'es;q=invalid, pt;q=2, en;q=0', 'en'], ['', '*', 'en'], ['', '', 'en'],
  ])('resolves preference %s and header %s as %s', (preference, header, expected) => {
    expect(resolveLocale(preference, header)).toBe(expected)
  })

  it('normalizes supported browser tags and safely interpolates literal values', () => {
    expect(normalizeLocale(' pt_BR ')).toBe('pt-BR')
    expect(normalizeLocale('es-MX')).toBe('es')
    expect(normalizeLocale('en-US')).toBe('en')
    expect(normalizeLocale('fr')).toBeUndefined()
    expect(translate('pt', 'ui.removeFile', { name: '$&.png' })).toBe('Remover $&.png')
    expect(translate('unsupported', 'ui.home')).toBe(dictionaries.en['ui.home'])
  })

  it('provides the complete ISO country list and a valid editable app list with other last', () => {
    expect(COUNTRIES).toHaveLength(249)
    expect(new Set(COUNTRIES).size).toBe(249)
    expect(COUNTRIES.every((code) => /^[A-Z]{2}$/.test(code))).toBe(true)
    expect(COUNTRIES).toEqual([...COUNTRIES].sort())
    expect(appsSchema.safeParse(apps).success).toBe(true)
    expect(apps.at(-1).id).toBe('other')
    expect(appsSchema.safeParse([...apps, apps[0]]).success).toBe(false)
    expect(appsSchema.safeParse([{ id: 'persiga', name: 'Persiga' }]).success).toBe(false)
  })
})
