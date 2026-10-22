import { describe, expect, it } from 'vitest'
import {
  dossierCreateSchema,
  dossierUpdateSchema,
  dossiersQuerySchema,
} from '#shared/validation/comptable'

describe('dossiersQuerySchema', () => {
  it('should default page to 1 and coerce string pages', () => {
    expect(dossiersQuerySchema.parse({}).page).toBe(1)
    expect(dossiersQuerySchema.parse({ page: '2' }).page).toBe(2)
  })
  it('should reject out-of-range pages and unknown keys', () => {
    expect(dossiersQuerySchema.safeParse({ page: '0' }).success).toBe(false)
    expect(dossiersQuerySchema.safeParse({ page: '10001' }).success).toBe(false)
    expect(dossiersQuerySchema.safeParse({ inconnu: 'x' }).success).toBe(false)
  })
  it('should validate the statut enum and reject an unknown one', () => {
    expect(dossiersQuerySchema.safeParse({ statut: 'EN_RETARD' }).success).toBe(true)
    expect(dossiersQuerySchema.safeParse({ statut: 'PROSPECT' }).success).toBe(false)
  })
})

describe('dossierCreateSchema', () => {
  const base = {
    entreprise: 'Boulangerie Saint-Jean',
    contact: 'Marie Roy',
    email: '  Marie@Exemple.CA ',
    forfait: 'MENSUEL',
    echeance: '2026-11-01',
  }

  it('should lowercase and trim the email and default statut to A_JOUR', () => {
    const r = dossierCreateSchema.parse(base)
    expect(r.email).toBe('marie@exemple.ca')
    expect(r.statut).toBe('A_JOUR')
  })
  it('should require entreprise, contact, email, forfait and echeance', () => {
    expect(dossierCreateSchema.safeParse({}).success).toBe(false)
    expect(dossierCreateSchema.safeParse({ ...base, entreprise: '' }).success).toBe(false)
    expect(dossierCreateSchema.safeParse({ ...base, contact: '' }).success).toBe(false)
    expect(dossierCreateSchema.safeParse({ ...base, email: 'pas-un-courriel' }).success).toBe(false)
    expect(dossierCreateSchema.safeParse({ ...base, forfait: 'HEBDO' }).success).toBe(false)
    expect(dossierCreateSchema.safeParse({ ...base, echeance: '2026-02-30' }).success).toBe(false)
    expect(dossierCreateSchema.safeParse({ ...base, echeance: '01-11-2026' }).success).toBe(false)
  })
  it('should reject texts over the maximum', () => {
    expect(dossierCreateSchema.safeParse({ ...base, entreprise: 'a'.repeat(121) }).success).toBe(false)
    expect(dossierCreateSchema.safeParse({ ...base, contact: 'a'.repeat(121) }).success).toBe(false)
    expect(dossierCreateSchema.safeParse({ ...base, notes: 'a'.repeat(2001) }).success).toBe(false)
  })
  it('should turn empty notes into null and keep provided notes', () => {
    expect(dossierCreateSchema.parse({ ...base, notes: '' }).notes).toBeNull()
    expect(dossierCreateSchema.parse({ ...base, notes: ' relance mensuelle ' }).notes).toBe('relance mensuelle')
  })
  it('should reject unknown keys', () => {
    expect(dossierCreateSchema.safeParse({ ...base, clientId: 1 }).success).toBe(false)
    expect(dossierCreateSchema.safeParse({ ...base, documentsKeys: [] }).success).toBe(false)
  })
})

describe('dossierUpdateSchema', () => {
  it('should reject an empty object', () => {
    expect(dossierUpdateSchema.safeParse({}).success).toBe(false)
  })
  it('should accept a partial update without applying the statut default', () => {
    const r = dossierUpdateSchema.parse({ statut: 'EN_RETARD' })
    expect(r.statut).toBe('EN_RETARD')
    expect(r.entreprise).toBeUndefined()
    expect(r.statut === 'A_JOUR').toBe(false)
  })
  it('should clear notes when sent empty', () => {
    expect(dossierUpdateSchema.parse({ notes: '' }).notes).toBeNull()
  })
  it('should be strict', () => {
    expect(dossierUpdateSchema.safeParse({ statut: 'A_JOUR', x: 1 }).success).toBe(false)
  })
})
