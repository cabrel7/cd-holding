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

  it('differs for two different addresses', () => {
    expect(cleAccuseReception('jean@exemple.ca')).not.toBe(cleAccuseReception('marie@exemple.ca'))
  })
})
