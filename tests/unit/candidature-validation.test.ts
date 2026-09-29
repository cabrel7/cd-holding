import { describe, expect, it } from 'vitest'
import { candidatureChampsSchema, candidatureFormSchema } from '#shared/validation/candidature'

const CHAMPS_BASE = {
  nom: 'Jean Tremblay',
  email: 'jean@exemple.ca',
  telephone: '514-555-0123',
  adresseComplete: '123 rue Principale, Montréal, QC',
  pays: 'Canada',
  experience: 'UN_A_TROIS_ANS',
  consentement: 'true' as const,
}

describe('candidatureChampsSchema — poste', () => {
  it('should reject "autre" without a precision', () => {
    const result = candidatureChampsSchema.safeParse({ ...CHAMPS_BASE, posteRecherche: 'autre' })
    expect(result.success).toBe(false)
  })

  it('should accept "autre" with a precision', () => {
    const result = candidatureChampsSchema.safeParse({
      ...CHAMPS_BASE,
      posteRecherche: 'autre',
      posteAutrePrecision: 'Cariste',
    })
    expect(result.success).toBe(true)
  })

  it('should accept a submission tied to an offer without a poste', () => {
    const result = candidatureChampsSchema.safeParse({
      ...CHAMPS_BASE,
      demandeUuid: '11111111-1111-4111-8111-111111111111',
    })
    expect(result.success).toBe(true)
  })

  it('should reject a spontaneous submission without a poste', () => {
    const result = candidatureChampsSchema.safeParse({ ...CHAMPS_BASE })
    expect(result.success).toBe(false)
  })
})

describe('candidatureChampsSchema — consentement', () => {
  it('should reject a missing consent', () => {
    const { consentement: _consentement, ...sansConsentement } = { ...CHAMPS_BASE, posteRecherche: 'manutention' }
    expect(candidatureChampsSchema.safeParse(sansConsentement).success).toBe(false)
  })

  it('should reject consentement: "false"', () => {
    const result = candidatureChampsSchema.safeParse({ ...CHAMPS_BASE, posteRecherche: 'manutention', consentement: 'false' })
    expect(result.success).toBe(false)
  })
})

describe('candidatureFormSchema — client files', () => {
  const schema = candidatureFormSchema({ avecOffre: true })
  const pdf = new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' })
  const png = new File([new Uint8Array([1, 2, 3])], 'cv.png', { type: 'image/png' })

  it('should reject a PNG as CV', () => {
    const result = schema.safeParse({ ...CHAMPS_BASE, consentement: true, cv: png, documents: [] })
    expect(result.success).toBe(false)
  })

  it('should reject more than 5 documents', () => {
    const documents = Array.from({ length: 6 }, (_, i) => new File(['%PDF-1.4'], `doc-${i}.pdf`, { type: 'application/pdf' }))
    const result = schema.safeParse({ ...CHAMPS_BASE, consentement: true, cv: pdf, documents })
    expect(result.success).toBe(false)
  })

  it('should reject a total size above 10 Mo even when each file is individually under 5 Mo', () => {
    const quatreMo = new Uint8Array(4 * 1024 * 1024)
    const cv4Mo = new File([quatreMo], 'cv.pdf', { type: 'application/pdf' })
    const doc4Mo = () => new File([quatreMo], 'doc.pdf', { type: 'application/pdf' })
    // 4 + 4 + 4 = 12 Mo > 10 Mo total, alors que chaque fichier reste sous la limite de 5 Mo.
    const result = schema.safeParse({ ...CHAMPS_BASE, consentement: true, cv: cv4Mo, documents: [doc4Mo(), doc4Mo()] })
    expect(result.success).toBe(false)
  })
})

describe('règles poste/taille indépendantes des autres champs', () => {
  const chemins = (issues: readonly { path: (string | number)[] }[]) => issues.map((i) => i.path[0])

  it('should report posteRecherche together with other field errors on an empty server submission', () => {
    const result = candidatureChampsSchema.safeParse({})
    expect(result.success).toBe(false)
    if (result.success) return
    const messages = result.error.issues.filter((i) => i.path[0] === 'posteRecherche').map((i) => i.message)
    expect(chemins(result.error.issues)).toEqual(expect.arrayContaining(['nom', 'email', 'consentement']))
    expect(messages).toContain('Sélectionnez un poste.')
  })

  it('should report posteRecherche together with other errors on an empty form submission', () => {
    const result = candidatureFormSchema({ avecOffre: false }).safeParse({})
    expect(result.success).toBe(false)
    if (result.success) return
    expect(chemins(result.error.issues)).toEqual(expect.arrayContaining(['nom', 'email', 'posteRecherche']))
  })

  it('should not require a poste on the form when tied to an offer', () => {
    const result = candidatureFormSchema({ avecOffre: true }).safeParse({})
    expect(result.success).toBe(false)
    if (result.success) return
    expect(chemins(result.error.issues)).not.toContain('posteRecherche')
  })

  it('should report the total size error even when another field is invalid', () => {
    const quatreMo = new Uint8Array(4 * 1024 * 1024)
    const f = () => new File([quatreMo], 'a.pdf', { type: 'application/pdf' })
    const result = candidatureFormSchema({ avecOffre: true }).safeParse({ ...CHAMPS_BASE, nom: '', consentement: true, cv: f(), documents: [f(), f()] })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.map((i) => i.message)).toContain('Taille totale limitée à 10 Mo.')
    expect(chemins(result.error.issues)).toContain('nom')
  })

  it('should still require the precision for "autre" alongside other errors', () => {
    const result = candidatureChampsSchema.safeParse({ ...CHAMPS_BASE, nom: '', posteRecherche: 'autre' })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.map((i) => i.message)).toContain('Précisez le poste recherché.')
  })

  it('should keep rejecting unknown keys (strict)', () => {
    const result = candidatureChampsSchema.safeParse({ ...CHAMPS_BASE, posteRecherche: 'manutention', intrus: 'x' })
    expect(result.success).toBe(false)
  })
})
