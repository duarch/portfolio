import en from '../locales/en.js'
import ptBR from '../locales/pt-BR.js'
import es from '../locales/es.js'

export const dictionaries = Object.freeze({ en, 'pt-BR': ptBR, es })

// ISO 3166-1 alpha-2 codes. Display names come from Intl.DisplayNames in the UI.
export const COUNTRIES = Object.freeze((
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ ' +
  'BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ ' +
  'DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY ' +
  'HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY ' +
  'MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ ' +
  'NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY ' +
  'QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ ' +
  'TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ ' +
  'VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' '))

export function normalizeLocale(value) {
  if (typeof value !== 'string') return undefined
  const language = value.trim().replaceAll('_', '-').toLowerCase()
  if (/^pt(?:-[a-z0-9]+)*$/.test(language)) return 'pt-BR'
  if (/^en(?:-[a-z0-9]+)*$/.test(language)) return 'en'
  if (/^es(?:-[a-z0-9]+)*$/.test(language)) return 'es'
  return undefined
}

export function resolveLocale(preference, acceptLanguage = '') {
  const preferred = normalizeLocale(preference)
  if (preferred) return preferred
  if (typeof acceptLanguage !== 'string') return 'en'

  const languages = acceptLanguage.split(',').map((part, index) => {
    const [tag, ...parameters] = part.trim().split(';')
    const qualityParameter = parameters.find((parameter) => /^\s*q\s*=/i.test(parameter))
    const rawQuality = qualityParameter?.split('=')[1]?.trim()
    const quality = rawQuality === undefined ? 1 : Number(rawQuality)
    return { locale: normalizeLocale(tag), quality, index }
  }).filter(({ locale, quality }) => locale && Number.isFinite(quality) && quality > 0 && quality <= 1)
  languages.sort((a, b) => b.quality - a.quality || a.index - b.index)
  return languages[0]?.locale ?? 'en'
}

export function translate(locale, key, values = {}) {
  const template = dictionaries[normalizeLocale(locale) ?? 'en'][key] ?? dictionaries.en[key] ?? key
  return template.replace(/\{(\w+)\}/g, (placeholder, name) => (
    Object.hasOwn(values, name) ? String(values[name]) : placeholder
  ))
}
