import { describe, expect, it } from 'vitest'
import { CONTACT_LIMITS, contactBodySchema, holdingContactFormSchema } from '#shared/validation/contact'

const valide = {
  nom: 'Jean Tremblay',
  email: 'jean@exemple.ca',
  cible: 'entretien',
  message: 'Bonjour, je souhaite un devis.',
}

describe('holdingContactFormSchema', () => {
  it('should trim fields and lowercase the email', () => {
    const parsed = holdingContactFormSchema.parse({ ...valide, nom: '  Jean Tremblay ', email: ' Jean@Exemple.CA ' })
    expect(parsed.nom).toBe('Jean Tremblay')
    expect(parsed.email).toBe('jean@exemple.ca')
  })

  it.each(['Jean-François O’Neil', 'Zoë', "Anne-Marie D'Arcy", 'J. Smith'])('should accept the name %s', (nom) => {
    expect(holdingContactFormSchema.safeParse({ ...valide, nom }).success).toBe(true)
  })

  it.each(['http://spam.example', 'Jean2', 'jean@spam', 'A', 'Jean\u0000'])('should reject the name %s', (nom) => {
    expect(holdingContactFormSchema.safeParse({ ...valide, nom }).success).toBe(false)
  })

  it('should reject a message containing a NUL character but accept line breaks', () => {
    expect(holdingContactFormSchema.safeParse({ ...valide, message: 'Bonjour\u0000 le monde' }).success).toBe(false)
    expect(holdingContactFormSchema.safeParse({ ...valide, message: 'Bonjour,\n\tle monde\r\n' }).success).toBe(true)
  })

  it('should enforce message and email length bounds', () => {
    expect(holdingContactFormSchema.safeParse({ ...valide, message: 'court' }).success).toBe(false)
    expect(
      holdingContactFormSchema.safeParse({ ...valide, message: 'a'.repeat(CONTACT_LIMITS.messageMax + 1) }).success,
    ).toBe(false)
    const longEmail = `${'a'.repeat(CONTACT_LIMITS.emailMax)}@exemple.ca`
    expect(holdingContactFormSchema.safeParse({ ...valide, email: longEmail }).success).toBe(false)
  })

  it('should reject an unknown target site', () => {
    expect(holdingContactFormSchema.safeParse({ ...valide, cible: 'inconnue' }).success).toBe(false)
  })

  it('should accept the holding itself as target (general request)', () => {
    expect(holdingContactFormSchema.safeParse({ ...valide, cible: 'holding' }).success).toBe(true)
  })

  it('should accept any filled honeypot up to its max length', () => {
    expect(holdingContactFormSchema.safeParse({ ...valide, website: 'http://bot.example' }).success).toBe(true)
    expect(
      holdingContactFormSchema.safeParse({ ...valide, website: 'x'.repeat(CONTACT_LIMITS.honeypotMax + 1) }).success,
    ).toBe(false)
  })
})

describe('holdingContactFormSchema — missing fields', () => {
  it('should report French messages for absent fields, never zod defaults', () => {
    const result = holdingContactFormSchema.safeParse({})
    expect(result.success).toBe(false)
    const messages = result.success ? [] : result.error.issues.map((issue) => issue.message)
    expect(messages).not.toContain('Required')
    expect(messages).toContain('Ce champ est requis.')
    expect(messages).toContain('Sélectionnez une filiale.')
  })
})

describe('contactBodySchema', () => {
  it('should accept the holding variant', () => {
    expect(contactBodySchema.safeParse({ ...valide, formulaire: 'holding' }).success).toBe(true)
  })

  it('should reject legacy or client-controlled keys (strict)', () => {
    expect(contactBodySchema.safeParse({ ...valide, formulaire: 'holding', sujet: 'x' }).success).toBe(false)
    expect(contactBodySchema.safeParse({ ...valide, formulaire: 'holding', type: 'CONTACT' }).success).toBe(false)
    expect(contactBodySchema.safeParse({ ...valide, formulaire: 'holding', companySlug: 'entretien' }).success).toBe(
      false,
    )
  })

  it('should reject an unknown form variant', () => {
    expect(contactBodySchema.safeParse({ ...valide, formulaire: 'inconnu' }).success).toBe(false)
  })
})
