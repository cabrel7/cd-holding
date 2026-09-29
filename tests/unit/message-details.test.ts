import { describe, expect, it } from 'vitest'
import { champsDetails, champsSuggestion } from '../../server/lib/admin/message-details'
import { buildPage, isUniqueViolation, pageArgs } from '../../server/lib/admin/pagination'
import { CONTACT_FORMS } from '../../shared/config/contact-forms'

const DETAILS_FILIALES = {
  entretien: { typePropriete: 'residence', frequence: 'mensuelle' },
  transport: { typeTransport: 'demenagement-commercial', dateSouhaitee: '2026-11-12', origine: 'Laval', destination: 'Québec' },
  comptable: { structure: 'obnl', besoin: 'paie' },
  placement: { poste: 'manutention', nombrePostes: 5 },
  ccdpaa: { categorie: 'fruits-legumes', volume: '500 kg / mois' },
  boissons: { typeEtablissement: 'bar-lounge', ville: 'Montréal', marques: 'sodas' },
} as const

describe('champsDetails (filiales)', () => {
  it.each(Object.keys(DETAILS_FILIALES) as (keyof typeof DETAILS_FILIALES)[])('traduit le formulaire %s', (slug) => {
    const result = champsDetails({ ...DETAILS_FILIALES[slug], formulaire: slug }, 'CONTACT')
    expect(result.formulaire).toBe(slug)
    expect(result.champs.length).toBe(Object.keys(DETAILS_FILIALES[slug]).length)
    const libelles = CONTACT_FORMS[slug].champs.map((c) => c.label)
    for (const champ of result.champs) expect(libelles).toContain(champ.libelle)
  })

  it('transport : libellé d option et date longue', () => {
    const { champs } = champsDetails({ ...DETAILS_FILIALES.transport, formulaire: 'transport' }, 'CONTACT')
    expect(champs).toContainEqual({ libelle: 'Type de transport', valeur: 'Déménagement commercial' })
    expect(champs).toContainEqual({ libelle: 'Date souhaitée', valeur: '12 novembre 2026' })
  })

  it('entier converti en texte', () => {
    const { champs } = champsDetails({ ...DETAILS_FILIALES.placement, formulaire: 'placement' }, 'CONTACT')
    expect(champs).toContainEqual({ libelle: 'Nombre de postes', valeur: '5' })
  })

  it('option retirée : valeur brute conservée', () => {
    const { champs } = champsDetails({ formulaire: 'entretien', typePropriete: 'ancienne-option' }, 'CONTACT')
    expect(champs).toEqual([{ libelle: 'Type de propriété', valeur: 'ancienne-option' }])
  })

  it('clé inconnue ignorée, jamais exposée', () => {
    const { champs } = champsDetails({ formulaire: 'entretien', secret: 'x', frequence: 'unique' }, 'CONTACT')
    expect(champs).toEqual([{ libelle: 'Fréquence souhaitée', valeur: 'Unique' }])
  })

  it('date invalide : valeur brute', () => {
    const { champs } = champsDetails({ formulaire: 'transport', dateSouhaitee: 'bientôt' }, 'CONTACT')
    expect(champs).toEqual([{ libelle: 'Date souhaitée', valeur: 'bientôt' }])
  })

  it('valeur de type inattendu (objet) ignorée', () => {
    expect(champsDetails({ formulaire: 'entretien', frequence: { a: 1 } }, 'CONTACT').champs).toEqual([])
  })
})

describe('champsDetails (autres cas)', () => {
  it('holding : aucun champ', () => {
    expect(champsDetails({ formulaire: 'holding' }, 'CONTACT')).toEqual({ formulaire: 'holding', champs: [] })
  })

  it('assistant : récap + palier recalculé', () => {
    const { formulaire, champs } = champsDetails(
      { profil: 'epicerie', categorie: 'epices', volume: '1-5t', delai: 'immediat', palier: 'petit', formulaire: 'assistant' },
      'ASSISTANT_IMPORT_EXPORT',
    )
    expect(formulaire).toBe('assistant')
    expect(champs).toContainEqual({ libelle: 'Volume mensuel', valeur: '1 à 5 tonnes' })
    expect(champs.at(-1)).toEqual({ libelle: 'Palier recommandé', valeur: 'Grand' })
  })

  it('assistant : réponses invalides → aucun champ', () => {
    expect(champsDetails({ formulaire: 'assistant', profil: 'zzz' }, 'ASSISTANT_IMPORT_EXPORT').champs).toEqual([])
  })

  it('null : formulaire déduit du type, sinon null', () => {
    expect(champsDetails(null, 'CONTACT')).toEqual({ formulaire: null, champs: [] })
    expect(champsDetails(null, 'SUGGESTION_PRODUIT')).toEqual({ formulaire: 'suggestion', champs: [] })
  })

  it('formes invalides (tableau, chaîne) traitées comme null', () => {
    expect(champsDetails([1], 'CONTACT')).toEqual({ formulaire: null, champs: [] })
    expect(champsDetails('x', 'CONTACT')).toEqual({ formulaire: null, champs: [] })
  })

  it('formulaire inconnu : ignoré', () => {
    expect(champsDetails({ formulaire: '__proto__', typePropriete: 'x' }, 'CONTACT')).toEqual({ formulaire: null, champs: [] })
  })
})

describe('pagination', () => {
  it('calcule skip/take et pageCount', () => {
    expect(pageArgs(3, 20)).toEqual({ skip: 40, take: 20 })
    expect(buildPage([], 57, 9, 20)).toMatchObject({ total: 57, pageCount: 3, items: [] })
    expect(buildPage([], 0, 1, 20).pageCount).toBe(1)
  })

  it('détecte P2002', () => {
    expect(isUniqueViolation({ code: 'P2002' })).toBe(true)
    expect(isUniqueViolation(new Error('x'))).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
  })
})

describe('champsSuggestion', () => {
  it('expose produit et pays pour une suggestion', () => {
    expect(champsSuggestion('SUGGESTION_PRODUIT', 'Karité brut', 'Ghana')).toEqual([
      { libelle: 'Produit souhaité', valeur: 'Karité brut' },
      { libelle: "Pays d'origine", valeur: 'Ghana' },
    ])
  })
  it('ignore les valeurs vides ou nulles', () => {
    expect(champsSuggestion('SUGGESTION_PRODUIT', '  ', null)).toEqual([])
    expect(champsSuggestion('SUGGESTION_PRODUIT', 'Karité', null)).toHaveLength(1)
  })
  it('ne renvoie rien pour un autre type', () => {
    expect(champsSuggestion('CONTACT_GENERAL' as never, 'x', 'y')).toEqual([])
  })
})
