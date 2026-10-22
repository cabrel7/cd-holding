import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import {
  FORMULAIRES,
  SUJET_DEMANDE_GENERALE,
  cleAccuseReception,
  destinataireInterne,
  type CibleContact,
} from '../../server/lib/contact'

const holding: CibleContact = { id: 1, slug: 'holding', nom: 'Groupe CD', email: 'contact@groupecd.ca' }
const entretien: CibleContact = { id: 2, slug: 'entretien', nom: 'CD Entretien', email: 'contact@entretien.ca' }
const entretienSansCourriel: CibleContact = { ...entretien, email: null }

const bodyEntretien = {
  formulaire: 'holding' as const,
  nom: 'Jean Tremblay',
  email: 'jean@exemple.ca',
  cible: 'entretien' as const,
  message: 'Bonjour, je souhaite un devis.',
}

describe('FORMULAIRES.holding', () => {
  it('targets the site chosen in the body', () => {
    expect(FORMULAIRES.holding.cible(bodyEntretien)).toBe('entretien')
  })

  it('builds a subject naming the target company when it is not the holding', () => {
    const data = FORMULAIRES.holding.construire(bodyEntretien, entretien, holding)
    expect(data.sujet).toBe('Demande — CD Entretien (via le site du groupe)')
  })

  it('builds the general-request subject when the target is the holding itself', () => {
    const bodyHolding = { ...bodyEntretien, cible: 'holding' as const }
    const data = FORMULAIRES.holding.construire(bodyHolding, holding, holding)
    expect(data.sujet).toBe(SUJET_DEMANDE_GENERALE)
  })

  it('stamps details.formulaire with the machine-readable origin, and never copies the honeypot', () => {
    const data = FORMULAIRES.holding.construire(bodyEntretien, entretien, holding)
    expect(data.details).toEqual({ formulaire: 'holding' })
    expect(data).not.toHaveProperty('website')
  })

  it('maps the submitted name, email, message and target company id verbatim', () => {
    const data = FORMULAIRES.holding.construire(bodyEntretien, entretien, holding)
    expect(data.companyId).toBe(entretien.id)
    expect(data.nom).toBe(bodyEntretien.nom)
    expect(data.email).toBe(bodyEntretien.email)
    expect(data.message).toBe(bodyEntretien.message)
    expect(data.type).toBe('CONTACT')
  })
})

describe('destinataireInterne', () => {
  it('prefers the target company email', () => {
    expect(destinataireInterne(entretien, holding)).toBe('contact@entretien.ca')
  })

  it('falls back to the holding email when the target has none', () => {
    expect(destinataireInterne(entretienSansCourriel, holding)).toBe('contact@groupecd.ca')
  })

  it('returns null when neither the target nor the holding has an email', () => {
    expect(destinataireInterne(entretienSansCourriel, { ...holding, email: null })).toBeNull()
  })
})

const cdEntretien: CibleContact = { id: 3, slug: 'entretien', nom: 'CD Entretien', email: 'contact@entretien.ca' }
const cdPlacement: CibleContact = { id: 4, slug: 'placement', nom: 'Placement CD Pro', email: 'contact@placement.ca' }
const cdCdpaa: CibleContact = { id: 5, slug: 'cdpaa', nom: 'CDPAA', email: 'contact@cdpaa.ca' }

const bodyFilialeEntretien = {
  formulaire: 'entretien' as const,
  nom: 'Marie Roy',
  email: 'marie@exemple.ca',
  telephone: '514-000-0000',
  message: 'Nous cherchons un entretien hebdomadaire.',
  details: { typePropriete: 'bureau-commerce', frequence: 'hebdomadaire' },
}

const bodyFilialePlacement = {
  formulaire: 'placement' as const,
  nom: 'Paul Dubé',
  email: 'paul@exemple.ca',
  entreprise: 'Entrepôts Dubé',
  telephone: '514-111-1111',
  message: 'Besoin de 5 manutentionnaires.',
  details: { poste: 'manutention', nombrePostes: 5 },
}

const bodySuggestion = {
  formulaire: 'suggestion' as const,
  site: 'cdpaa' as const,
  nom: 'Awa Diop',
  email: 'awa@exemple.ca',
  produitSouhaite: 'Fonio précuit',
  paysOrigine: 'Sénégal',
  message: 'Ce serait formidable de le retrouver ici.',
}

describe('FORMULAIRES (filiales)', () => {
  it('targets the fixed slug regardless of the body', () => {
    expect(FORMULAIRES.entretien.cible(bodyFilialeEntretien)).toBe('entretien')
  })

  it('uses the subject from the config, never a client-supplied value', () => {
    const data = FORMULAIRES.entretien.construire(bodyFilialeEntretien, cdEntretien, holding)
    expect(data.sujet).toBe('Demande de soumission — entretien')
    expect(data.type).toBe('CONTACT')
  })

  it('defaults telephone/entreprise to null when the filiale has no such field', () => {
    const data = FORMULAIRES.entretien.construire(bodyFilialeEntretien, cdEntretien, holding)
    expect(data.telephone).toBe('514-000-0000')
    expect(data.entreprise).toBeNull()
  })

  it('passes entreprise through when the filiale has that field', () => {
    const data = FORMULAIRES.placement.construire(bodyFilialePlacement, cdPlacement, holding)
    expect(data.entreprise).toBe('Entrepôts Dubé')
  })

  it('spreads body.details and stamps formulaire last, never copying the honeypot', () => {
    const data = FORMULAIRES.entretien.construire(bodyFilialeEntretien, cdEntretien, holding)
    expect(data.details).toEqual({ typePropriete: 'bureau-commerce', frequence: 'hebdomadaire', formulaire: 'entretien' })
    expect(Object.keys(data.details).at(-1)).toBe('formulaire')
    expect(data).not.toHaveProperty('website')
  })
})

describe('FORMULAIRES.suggestion', () => {
  it('targets the site chosen in the body', () => {
    expect(FORMULAIRES.suggestion.cible(bodySuggestion)).toBe('cdpaa')
  })

  it('builds a SUGGESTION_PRODUIT message with the fixed subject and product fields', () => {
    const data = FORMULAIRES.suggestion.construire(bodySuggestion, cdCdpaa, holding)
    expect(data.type).toBe('SUGGESTION_PRODUIT')
    expect(data.sujet).toBe('Suggestion de produit')
    expect(data.produitSouhaite).toBe('Fonio précuit')
    expect(data.paysOrigine).toBe('Sénégal')
    expect(data.details).toEqual({ formulaire: 'suggestion' })
  })
})

describe('cleAccuseReception', () => {
  it('never contains the raw email address', () => {
    const cle = cleAccuseReception('jean@exemple.ca')
    expect(cle).not.toContain('jean@exemple.ca')
  })

  it('is deterministic for the same address', () => {
    expect(cleAccuseReception('jean@exemple.ca')).toBe(cleAccuseReception('jean@exemple.ca'))
  })

  it('is prefixed and matches a direct sha256 computation', () => {
    const attendu = `accuse:${createHash('sha256').update('jean@exemple.ca').digest('hex')}`
    expect(cleAccuseReception('jean@exemple.ca')).toBe(attendu)
  })

  it('ignores case and surrounding spaces (no bypass of the per-recipient limit)', () => {
    expect(cleAccuseReception('  Jean@Exemple.CA ')).toBe(cleAccuseReception('jean@exemple.ca'))
  })

  it('differs for two different addresses', () => {
    expect(cleAccuseReception('jean@exemple.ca')).not.toBe(cleAccuseReception('marie@exemple.ca'))
  })
})

const cdCdpaaAssistant: CibleContact = { id: 6, slug: 'cdpaa', nom: 'CDPAA', email: 'contact@cdpaa.ca' }

const bodyAssistant = {
  formulaire: 'assistant' as const,
  nom: 'Marie Roy',
  email: 'marie@exemple.ca',
  entreprise: 'Épicerie Roy',
  reponses: {
    profil: 'epicerie' as const,
    categorie: 'epices' as const,
    volume: '200-1000kg' as const,
    delai: '1-3-mois' as const,
  },
}

describe('FORMULAIRES.assistant', () => {
  it('always targets cdpaa, regardless of the body', () => {
    expect(FORMULAIRES.assistant.cible(bodyAssistant)).toBe('cdpaa')
  })

  it('builds an ASSISTANT_IMPORT_EXPORT message with the fixed subject and a null phone/company fallback', () => {
    const data = FORMULAIRES.assistant.construire(bodyAssistant, cdCdpaaAssistant, holding)
    expect(data.type).toBe('ASSISTANT_IMPORT_EXPORT')
    expect(data.sujet).toBe('Assistant import-export')
    expect(data.entreprise).toBe('Épicerie Roy')
    expect(data.telephone).toBeNull()
  })

  it('defaults telephone/entreprise to null when absent from the body', () => {
    const { entreprise: _entreprise, ...sansEntreprise } = bodyAssistant
    const data = FORMULAIRES.assistant.construire(sansEntreprise, cdCdpaaAssistant, holding)
    expect(data.entreprise).toBeNull()
    expect(data.telephone).toBeNull()
  })

  it('builds a human-readable "Libellé : valeur" message from the answers', () => {
    const data = FORMULAIRES.assistant.construire(bodyAssistant, cdCdpaaAssistant, holding)
    expect(data.message).toContain('Profil : Épicerie spécialisée')
    expect(data.message).toContain('Volume mensuel : 200 à 1 000 kg')
  })

  it('stamps details with the raw answers, the computed palier, and formulaire last', () => {
    const data = FORMULAIRES.assistant.construire(bodyAssistant, cdCdpaaAssistant, holding)
    expect(data.details).toEqual({
      profil: 'epicerie',
      categorie: 'epices',
      volume: '200-1000kg',
      delai: '1-3-mois',
      palier: 'moyen',
      formulaire: 'assistant',
    })
    expect(data).not.toHaveProperty('website')
  })
})
