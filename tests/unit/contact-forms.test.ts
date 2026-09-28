import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONTACT_FORMS,
  FORMULAIRES_FILIALES,
  estChampDetail,
  type ChampContact,
  type FormulaireFilialeSlug,
} from '#shared/config/contact-forms'
import { contactBodySchema, filialeContactFormSchema } from '#shared/validation/contact'
import { ajouterJoursIso, dateDuJourQuebec, isDateCalendaireValide } from '#shared/utils/dates'

// 2026-09-28 04:30 UTC = 2026-09-28 00:30 à Montréal (UTC-4) : cas « près de minuit UTC ».
const MAINTENANT = new Date('2026-09-28T04:30:00Z')
const AUJOURDHUI = '2026-09-28'

function valeurChamp(champ: ChampContact): unknown {
  switch (champ.type) {
    case 'nom':
      return 'Jean Tremblay'
    case 'email':
      return 'jean@exemple.ca'
    case 'telephone':
      return '514-555-0123'
    case 'entreprise':
      return 'Entreprise Test'
    case 'message':
      return 'Bonjour, voici ma demande détaillée.'
    case 'texte':
      return 'Montréal'
    case 'date-future':
      return ajouterJoursIso(AUJOURDHUI, 7)
    case 'entier':
      return champ.min
    case 'select':
      return champ.options[0].value
  }
}

/** Corps valide généré depuis la config (source unique). */
function corpsValide(slug: FormulaireFilialeSlug): Record<string, unknown> {
  const corps: Record<string, unknown> = { formulaire: slug }
  const details: Record<string, unknown> = {}
  for (const champ of CONTACT_FORMS[slug].champs) {
    if (estChampDetail(champ)) details[champ.cle] = valeurChamp(champ)
    else corps[champ.type] = valeurChamp(champ)
  }
  corps.details = details
  return corps
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(MAINTENANT)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('CONTACT_FORMS', () => {
  it.each(FORMULAIRES_FILIALES)('%s should have exactly one nom, email, message and telephone field', (slug) => {
    const types = CONTACT_FORMS[slug].champs.map((champ) => champ.type)
    for (const type of ['nom', 'email', 'message', 'telephone'] as const) {
      expect(types.filter((t) => t === type)).toHaveLength(1)
    }
  })

  it.each(FORMULAIRES_FILIALES)('%s should use unique detail keys, never "formulaire"', (slug) => {
    const cles = CONTACT_FORMS[slug].champs.filter(estChampDetail).map((champ) => champ.cle)
    expect(new Set(cles).size).toBe(cles.length)
    expect(cles).not.toContain('formulaire')
  })

  it.each(FORMULAIRES_FILIALES)('%s should use unique kebab-case option values', (slug) => {
    for (const champ of CONTACT_FORMS[slug].champs) {
      if (champ.type !== 'select') continue
      const valeurs = champ.options.map((option) => option.value)
      expect(new Set(valeurs).size).toBe(valeurs.length)
      for (const valeur of valeurs) expect(valeur).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('should cover exactly holding + the 6 subsidiaries + suggestion + assistant in the body union', () => {
    expect([...contactBodySchema.optionsMap.keys()].sort()).toEqual(
      ['holding', ...FORMULAIRES_FILIALES, 'suggestion', 'assistant'].sort(),
    )
  })
})

describe('contactBodySchema — subsidiary variants', () => {
  it.each(FORMULAIRES_FILIALES)('should accept a valid %s body generated from the config', (slug) => {
    const result = contactBodySchema.safeParse(corpsValide(slug))
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(true)
  })

  it('should reject an unknown details key and a "formulaire" key inside details', () => {
    const corps = corpsValide('entretien')
    const details = corps.details as Record<string, unknown>
    expect(contactBodySchema.safeParse({ ...corps, details: { ...details, inconnu: 'x' } }).success).toBe(false)
    expect(contactBodySchema.safeParse({ ...corps, details: { ...details, formulaire: 'x' } }).success).toBe(false)
  })

  it('should reject a missing or digit-less phone number', () => {
    const { telephone: _omis, ...sansTelephone } = corpsValide('entretien')
    expect(contactBodySchema.safeParse(sansTelephone).success).toBe(false)
    expect(contactBodySchema.safeParse({ ...corpsValide('entretien'), telephone: '-------' }).success).toBe(false)
  })

  it('should reject an unknown select option', () => {
    const corps = corpsValide('entretien')
    const details = corps.details as Record<string, unknown>
    expect(
      contactBodySchema.safeParse({ ...corps, details: { ...details, typePropriete: 'chateau' } }).success,
    ).toBe(false)
  })

  it('should reject an entreprise field on a form that has none (entretien)', () => {
    expect(contactBodySchema.safeParse({ ...corpsValide('entretien'), entreprise: 'X Inc.' }).success).toBe(false)
  })

  it('should bound the transport date to [today, today + 365] in Quebec time and reject impossible dates', () => {
    const avecDate = (dateSouhaitee: string) => {
      const corps = corpsValide('transport')
      return contactBodySchema.safeParse({ ...corps, details: { ...(corps.details as object), dateSouhaitee } })
    }
    expect(dateDuJourQuebec()).toBe(AUJOURDHUI)
    expect(avecDate(ajouterJoursIso(AUJOURDHUI, -1)).success).toBe(false)
    expect(avecDate(AUJOURDHUI).success).toBe(true)
    expect(avecDate(ajouterJoursIso(AUJOURDHUI, 365)).success).toBe(true)
    expect(avecDate(ajouterJoursIso(AUJOURDHUI, 366)).success).toBe(false)
    expect(avecDate('2027-02-30').success).toBe(false)
  })

  it('should coerce and bound the placement number of positions', () => {
    // Le schéma de formulaire est .strict() : la clé `formulaire` doit être retirée, pas mise à undefined.
    const { formulaire: _f, ...sansFormulaire } = corpsValide('placement')
    const avecNombre = (nombrePostes: unknown) =>
      filialeContactFormSchema('placement').safeParse({
        ...sansFormulaire,
        details: { ...(sansFormulaire.details as object), nombrePostes },
      })
    const ok = avecNombre('5')
    expect(ok.success && ok.data.details.nombrePostes).toBe(5)
    expect(avecNombre('0').success).toBe(false)
    expect(avecNombre(501).success).toBe(false)
  })
})

describe('contactBodySchema — suggestion', () => {
  const suggestion = {
    formulaire: 'suggestion',
    site: 'ccdpaa',
    nom: 'Awa Diallo',
    email: 'awa@exemple.ca',
    produitSouhaite: 'Fonio précuit',
    paysOrigine: 'Mali',
    message: 'Introuvable à Montréal, très demandé.',
  }

  it('should accept a valid suggestion for ccdpaa or boissons', () => {
    expect(contactBodySchema.safeParse(suggestion).success).toBe(true)
    expect(contactBodySchema.safeParse({ ...suggestion, site: 'boissons' }).success).toBe(true)
  })

  it('should reject a suggestion for another subsidiary and a message under 10 characters', () => {
    expect(contactBodySchema.safeParse({ ...suggestion, site: 'entretien' }).success).toBe(false)
    expect(contactBodySchema.safeParse({ ...suggestion, message: 'Trop court' }).success).toBe(true)
    expect(contactBodySchema.safeParse({ ...suggestion, message: 'Neuf car.' }).success).toBe(false)
  })
})

describe('dates helpers', () => {
  it('should reject non-existent calendar dates', () => {
    expect(isDateCalendaireValide('2026-02-28')).toBe(true)
    expect(isDateCalendaireValide('2026-02-30')).toBe(false)
    expect(isDateCalendaireValide('2026-9-1')).toBe(false)
  })
})
