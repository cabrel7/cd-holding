import { describe, expect, it } from 'vitest'
import { buildSiteFormSchema, mapSiteFormValues } from '@/config/cms-site-fields'

describe('mapSiteFormValues', () => {
  it('should convert empty strings to null for nullable text fields', () => {
    expect(
      mapSiteFormValues({
        secteur: '  ',
        description: '',
        email: '',
        telephone: '',
        adresse: '',
        linkedinUrl: '',
        facebookUrl: '',
        instagramUrl: '',
        nomCourt: '',
      }),
    ).toEqual({
      secteur: null,
      description: null,
      email: null,
      telephone: null,
      adresse: null,
      linkedinUrl: null,
      facebookUrl: null,
      instagramUrl: null,
      nomCourt: null,
    })
  })

  it('should trim non-empty text fields without nullifying them', () => {
    expect(mapSiteFormValues({ secteur: '  Entretien ménager  ' })).toEqual({ secteur: 'Entretien ménager' })
  })

  it('should coerce a non-empty effectif to a number', () => {
    expect(mapSiteFormValues({ effectif: '42' })).toEqual({ effectif: 42 })
  })

  it('should convert an empty effectif to null (nullable field)', () => {
    expect(mapSiteFormValues({ effectif: '' })).toEqual({ effectif: null })
  })

  it('should coerce a non-empty ordre to a number', () => {
    expect(mapSiteFormValues({ ordre: '3' })).toEqual({ ordre: 3 })
  })

  it('should omit an empty ordre rather than sending null (schema optional but not nullable)', () => {
    expect(mapSiteFormValues({ ordre: '' })).toEqual({})
  })

  it('should leave an empty nom as an empty string, not null (required field — error shown under the field)', () => {
    expect(mapSiteFormValues({ nom: '' })).toEqual({ nom: '' })
  })

  it('should trim a non-empty nom', () => {
    expect(mapSiteFormValues({ nom: '  Groupe CD Entretien  ' })).toEqual({ nom: 'Groupe CD Entretien' })
  })

  it('should pass non-string values through unchanged (e.g. heroImageKey already null)', () => {
    expect(mapSiteFormValues({ heroImageKey: null })).toEqual({ heroImageKey: null })
  })
})

const FULL_FILIALE_FORM = {
  nomCourt: '',
  secteur: 'Entretien ménager',
  description: 'Ménage régulier, grand ménage et désinfection commerciale.',
  heroImageKey: null,
  effectif: '25',
  email: '',
  telephone: '',
  adresse: '',
  linkedinUrl: '',
  facebookUrl: '',
  instagramUrl: '',
}

describe('buildSiteFormSchema — ADMIN_FILIALE', () => {
  const schema = buildSiteFormSchema(false)

  it('should accept a full form and nullify empty optional fields', () => {
    const result = schema.safeParse(FULL_FILIALE_FORM)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toMatchObject({ nomCourt: null, email: null, effectif: 25 })
    }
  })

  it('should reject a secteur below the minimum length once trimmed', () => {
    const result = schema.safeParse({ ...FULL_FILIALE_FORM, secteur: 'A' })
    expect(result.success).toBe(false)
  })

  it('should reject an invalid https URL', () => {
    const result = schema.safeParse({ ...FULL_FILIALE_FORM, linkedinUrl: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('should reject fields reserved to SUPER_ADMIN (strict schema)', () => {
    const result = schema.safeParse({ ...FULL_FILIALE_FORM, nom: 'Nouveau nom' })
    expect(result.success).toBe(false)
  })
})

describe('buildSiteFormSchema — SUPER_ADMIN', () => {
  const schema = buildSiteFormSchema(true)

  it('should accept nom and ordre alongside the shared fields', () => {
    const result = schema.safeParse({ ...FULL_FILIALE_FORM, nom: 'Groupe CD Entretien', ordre: '2' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toMatchObject({ nom: 'Groupe CD Entretien', ordre: 2 })
  })

  it('should reject a non-numeric ordre', () => {
    const result = schema.safeParse({ ...FULL_FILIALE_FORM, nom: 'Groupe CD Entretien', ordre: 'abc' })
    expect(result.success).toBe(false)
  })

  it('should accept an omitted ordre (left blank = no change)', () => {
    const result = schema.safeParse({ ...FULL_FILIALE_FORM, nom: 'Groupe CD Entretien', ordre: '' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.ordre).toBeUndefined()
  })
})
