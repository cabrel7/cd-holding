import { describe, expect, it } from 'vitest'
import {
  createMembreEquipeSchema,
  createPartenaireSchema,
  createRealisationSchema,
  createServiceSchema,
  reorderSchema,
  updateServiceSchema,
} from '#shared/validation/cms'

// UUID v4 valide, seul format accepté par STORAGE_KEY_PATTERN (shared/config/upload.ts).
const VALID_IMAGE_KEY = '3fa85f64-5717-4562-a3fc-2c963f66afa6.jpg'
const VALID_UUID = '3fa85f64-5717-4562-a3fc-2c963f66afa6'
const VALID_UUID_2 = 'a3fc2c96-5717-4562-a3fc-2c963f66afa6'

describe('createServiceSchema', () => {
  it('should accept a minimal valid service', () => {
    const result = createServiceSchema.safeParse({ titre: 'Ménage commercial', description: 'Description suffisamment longue.' })
    expect(result.success).toBe(true)
  })

  it('should reject a titre shorter than 2 characters', () => {
    expect(createServiceSchema.safeParse({ titre: 'A', description: 'Description suffisamment longue.' }).success).toBe(false)
  })

  it('should reject a description shorter than 10 characters', () => {
    expect(createServiceSchema.safeParse({ titre: 'Ménage', description: 'Trop cour' }).success).toBe(false)
  })

  it('should accept a valid imageKey and reject a malformed one', () => {
    expect(
      createServiceSchema.safeParse({ titre: 'Ménage', description: 'Description suffisamment longue.', imageKey: VALID_IMAGE_KEY })
        .success,
    ).toBe(true)
    expect(
      createServiceSchema.safeParse({ titre: 'Ménage', description: 'Description suffisamment longue.', imageKey: '../../etc/passwd' })
        .success,
    ).toBe(false)
  })

  it('should reject an unknown field (.strict())', () => {
    expect(
      createServiceSchema.safeParse({ titre: 'Ménage', description: 'Description suffisamment longue.', champInconnu: true }).success,
    ).toBe(false)
  })
})

describe('updateServiceSchema', () => {
  it('should reject an empty update', () => {
    expect(updateServiceSchema.safeParse({}).success).toBe(false)
  })

  it('should reject an update carrying only "site"', () => {
    expect(updateServiceSchema.safeParse({ site: 'entretien' }).success).toBe(false)
  })

  it('should accept a single-field update', () => {
    expect(updateServiceSchema.safeParse({ misEnAvant: true }).success).toBe(true)
  })
})

describe('createRealisationSchema', () => {
  it('should accept a well-formed ISO date', () => {
    expect(
      createRealisationSchema.safeParse({ titre: 'Chantier X', description: 'Description suffisamment longue.', dateRealisation: '2024-05-01' })
        .success,
    ).toBe(true)
  })

  it('should reject a malformed date', () => {
    expect(
      createRealisationSchema.safeParse({ titre: 'Chantier X', description: 'Description suffisamment longue.', dateRealisation: '01/05/2024' })
        .success,
    ).toBe(false)
  })

  it('should accept a null date', () => {
    expect(
      createRealisationSchema.safeParse({ titre: 'Chantier X', description: 'Description suffisamment longue.', dateRealisation: null })
        .success,
    ).toBe(true)
  })
})

describe('createMembreEquipeSchema', () => {
  it('should reject a bio longer than 600 characters', () => {
    expect(
      createMembreEquipeSchema.safeParse({ nom: 'Claire Dubois', poste: 'Directrice', bio: 'x'.repeat(601) }).success,
    ).toBe(false)
  })

  it('should accept a bio at exactly 600 characters', () => {
    expect(
      createMembreEquipeSchema.safeParse({ nom: 'Claire Dubois', poste: 'Directrice', bio: 'x'.repeat(600) }).success,
    ).toBe(true)
  })
})

describe('createPartenaireSchema', () => {
  it('should accept an https siteUrl', () => {
    expect(createPartenaireSchema.safeParse({ nom: 'Partenaire X', siteUrl: 'https://exemple.com' }).success).toBe(true)
  })

  it('should reject an http siteUrl', () => {
    expect(createPartenaireSchema.safeParse({ nom: 'Partenaire X', siteUrl: 'http://exemple.com' }).success).toBe(false)
  })
})

describe('reorderSchema', () => {
  it('should accept a list of unique uuids', () => {
    expect(reorderSchema.safeParse({ uuids: [VALID_UUID, VALID_UUID_2] }).success).toBe(true)
  })

  it('should reject a duplicate uuid', () => {
    expect(reorderSchema.safeParse({ uuids: [VALID_UUID, VALID_UUID] }).success).toBe(false)
  })

  it('should reject an empty list', () => {
    expect(reorderSchema.safeParse({ uuids: [] }).success).toBe(false)
  })

  it('should reject a malformed uuid', () => {
    expect(reorderSchema.safeParse({ uuids: ['pas-un-uuid'] }).success).toBe(false)
  })
})
