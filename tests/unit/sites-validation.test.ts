import { describe, expect, it } from 'vitest'
import { siteReglagesFilialeSchema, siteReglagesSuperAdminSchema } from '#shared/validation/sites'

// UUID v4 valide, seul format accepté par STORAGE_KEY_PATTERN (shared/config/upload.ts).
const VALID_IMAGE_KEY = '3fa85f64-5717-4562-a3fc-2c963f66afa6.jpg'

describe('siteReglagesFilialeSchema', () => {
  it('should reject an empty update', () => {
    expect(siteReglagesFilialeSchema.safeParse({}).success).toBe(false)
  })

  it('should accept a valid heroImageKey and reject a malformed one', () => {
    expect(siteReglagesFilialeSchema.safeParse({ heroImageKey: VALID_IMAGE_KEY }).success).toBe(true)
    expect(siteReglagesFilialeSchema.safeParse({ heroImageKey: '../../etc/passwd' }).success).toBe(false)
  })

  it('should accept a null heroImageKey (removal)', () => {
    expect(siteReglagesFilialeSchema.safeParse({ heroImageKey: null }).success).toBe(true)
  })

  it('should reject a reserved field (couleurAccent is never modifiable)', () => {
    expect(siteReglagesFilialeSchema.safeParse({ couleurAccent: '#000000' }).success).toBe(false)
  })

  it('should reject structural fields reserved to SUPER_ADMIN', () => {
    expect(siteReglagesFilialeSchema.safeParse({ nom: 'Nouveau nom' }).success).toBe(false)
    expect(siteReglagesFilialeSchema.safeParse({ statutSite: 'EN_MAINTENANCE' }).success).toBe(false)
  })
})

describe('siteReglagesFilialeSchema — secteur / description (spec phase 3 §3)', () => {
  it('should accept valid secteur and description', () => {
    expect(
      siteReglagesFilialeSchema.safeParse({ secteur: 'Entretien ménager', description: 'Ménage régulier, grand ménage et désinfection.' })
        .success,
    ).toBe(true)
  })

  it('should accept null (removal)', () => {
    expect(siteReglagesFilialeSchema.safeParse({ secteur: null, description: null }).success).toBe(true)
  })

  it('should reject a secteur below the minimum length', () => {
    expect(siteReglagesFilialeSchema.safeParse({ secteur: 'A' }).success).toBe(false)
  })

  it('should reject a secteur above the maximum length', () => {
    expect(siteReglagesFilialeSchema.safeParse({ secteur: 'x'.repeat(161) }).success).toBe(false)
  })

  it('should reject a description below the minimum length', () => {
    expect(siteReglagesFilialeSchema.safeParse({ description: 'court' }).success).toBe(false)
  })

  it('should reject a description above the maximum length', () => {
    expect(siteReglagesFilialeSchema.safeParse({ description: 'x'.repeat(601) }).success).toBe(false)
  })
})

describe('siteReglagesSuperAdminSchema', () => {
  it('should accept a valid heroImageKey and reject a malformed one', () => {
    expect(siteReglagesSuperAdminSchema.safeParse({ heroImageKey: VALID_IMAGE_KEY }).success).toBe(true)
    expect(siteReglagesSuperAdminSchema.safeParse({ heroImageKey: 'not-a-key' }).success).toBe(false)
  })

  it('should accept structural fields', () => {
    expect(siteReglagesSuperAdminSchema.safeParse({ statutSite: 'EN_MAINTENANCE' }).success).toBe(true)
  })

  it('should still reject couleurAccent (never modifiable, §6)', () => {
    expect(siteReglagesSuperAdminSchema.safeParse({ couleurAccent: '#000000' }).success).toBe(false)
  })
})
