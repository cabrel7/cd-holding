import { describe, expect, it } from 'vitest'
import {
  clientCreateSchema,
  clientUpdateSchema,
  clientsQuerySchema,
  messageUpdateSchema,
  messagesQuerySchema,
} from '#shared/validation/admin'
import { ADMIN_SEARCH_MAX } from '#shared/config/admin'
import { formatDateHeureQuebec, formatDateQuebec } from '#shared/utils/dates'

describe('messagesQuerySchema', () => {
  it('should default page to 1 and coerce string pages', () => {
    expect(messagesQuerySchema.parse({}).page).toBe(1)
    expect(messagesQuerySchema.parse({ page: '3' }).page).toBe(3)
  })
  it('should reject out-of-range pages and unknown keys', () => {
    expect(messagesQuerySchema.safeParse({ page: '0' }).success).toBe(false)
    expect(messagesQuerySchema.safeParse({ page: '10001' }).success).toBe(false)
    expect(messagesQuerySchema.safeParse({ inconnu: 'x' }).success).toBe(false)
  })
  it('should turn an empty or blank q into undefined and trim otherwise', () => {
    expect(messagesQuerySchema.parse({ q: '' }).q).toBeUndefined()
    expect(messagesQuerySchema.parse({ q: '   ' }).q).toBeUndefined()
    expect(messagesQuerySchema.parse({ q: '  abc ' }).q).toBe('abc')
  })
  it('should reject a q longer than the maximum', () => {
    expect(messagesQuerySchema.safeParse({ q: 'a'.repeat(ADMIN_SEARCH_MAX + 1) }).success).toBe(false)
  })
  it('should validate site, type and statut enums', () => {
    expect(messagesQuerySchema.safeParse({ site: 'cdpaa', type: 'CONTACT', statut: 'NOUVEAU' }).success).toBe(true)
    expect(messagesQuerySchema.safeParse({ statut: 'ARCHIVE' }).success).toBe(false)
    expect(messagesQuerySchema.safeParse({ site: 'nope' }).success).toBe(false)
  })
})

describe('clientsQuerySchema', () => {
  it('should accept a client statut and reject a message-only key', () => {
    expect(clientsQuerySchema.safeParse({ statut: 'PROSPECT' }).success).toBe(true)
    expect(clientsQuerySchema.safeParse({ type: 'CONTACT' }).success).toBe(false)
  })
})

describe('messageUpdateSchema', () => {
  it('should require a valid statut and be strict', () => {
    expect(messageUpdateSchema.safeParse({ statut: 'TRAITE' }).success).toBe(true)
    expect(messageUpdateSchema.safeParse({}).success).toBe(false)
    expect(messageUpdateSchema.safeParse({ statut: 'TRAITE', x: 1 }).success).toBe(false)
  })
})

describe('clientCreateSchema', () => {
  const base = { nom: 'Jean Tremblay', email: '  Jean@Exemple.CA ' }
  it('should lowercase and trim the email and default statut to PROSPECT', () => {
    const r = clientCreateSchema.parse(base)
    expect(r.email).toBe('jean@exemple.ca')
    expect(r.statut).toBe('PROSPECT')
  })
  it('should require an email', () => {
    expect(clientCreateSchema.safeParse({ nom: 'A' }).success).toBe(false)
    expect(clientCreateSchema.safeParse({ nom: 'A', email: 'pas-un-courriel' }).success).toBe(false)
  })
  it('should turn empty optional texts into null', () => {
    const r = clientCreateSchema.parse({ ...base, entreprise: '', telephone: ' ', notes: '' })
    expect(r.entreprise).toBeNull()
    expect(r.telephone).toBeNull()
    expect(r.notes).toBeNull()
  })
  it('should validate the telephone', () => {
    expect(clientCreateSchema.safeParse({ ...base, telephone: '514 555-0199' }).success).toBe(true)
    expect(clientCreateSchema.safeParse({ ...base, telephone: 'abc' }).success).toBe(false)
  })
  it('should reject unknown keys', () => {
    expect(clientCreateSchema.safeParse({ ...base, companyId: 1 }).success).toBe(false)
  })
})

describe('clientUpdateSchema', () => {
  it('should reject an empty object', () => {
    expect(clientUpdateSchema.safeParse({}).success).toBe(false)
  })
  it('should accept a partial update without applying the statut default', () => {
    const r = clientUpdateSchema.parse({ nom: 'Nouveau' })
    expect(r.statut).toBeUndefined()
  })
  it('should refuse changing the site', () => {
    expect(clientUpdateSchema.safeParse({ site: 'cdpaa', nom: 'X' }).success).toBe(false)
  })
})

describe('formatDate*Quebec', () => {
  it('should keep 22h Quebec time on the same calendar day (UTC is already next day)', () => {
    const instant = '2026-09-30T02:00:00.000Z' // 22 h le 29 septembre (UTC-4)
    expect(formatDateQuebec(instant)).toContain('29')
    expect(formatDateQuebec(instant)).toContain('septembre')
    expect(formatDateHeureQuebec(instant)).toMatch(/29.*septembre.*2026/)
    expect(formatDateHeureQuebec(instant)).toMatch(/22/)
  })
})
