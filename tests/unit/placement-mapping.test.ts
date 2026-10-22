import { describe, expect, it } from 'vitest'
import {
  toCandidatDto,
  toCandidatureDto,
  toDemandeDto,
  type CandidatMapRow,
  type CandidatureMapRow,
  type DemandeMapRow,
} from '../../server/services/admin/placement'

const COMPANY = { uuid: '0b3f1a2c-0000-4000-8000-000000000001', slug: 'placement', nom: 'CD Placement' }
const CREATED = new Date('2026-01-15T10:00:00.000Z')
const COMPANY_SITE = { uuid: COMPANY.uuid, slug: 'placement' as const, nom: COMPANY.nom }

describe('toCandidatDto', () => {
  const base: CandidatMapRow = {
    uuid: '0b3f1a2c-0000-4000-8000-000000000010',
    nomComplet: 'Jeanne Tremblay',
    email: 'jeanne@example.test',
    telephone: '514-555-0100',
    posteRecherche: 'Chauffeur classe 1',
    categorie: 'CHAUFFEUR_CLASSE_1',
    disponibilite: 'Immédiate',
    statut: 'DISPONIBLE',
    origine: 'LOCAL',
    notes: 'À relancer',
    cvKey: null,
    anonymiseLe: null,
    createdAt: CREATED,
    company: COMPANY,
  }

  it('expose le site en slug et dérive aCv de cvKey', () => {
    const dto = toCandidatDto({ ...base, cvKey: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf' })
    expect(dto.aCv).toBe(true)
    expect(dto.site).toEqual(COMPANY_SITE)
    expect(dto.createdAt).toBe('2026-01-15T10:00:00.000Z')
    expect(dto.anonymiseLe).toBeNull()
  })

  it('marque un candidat sans CV et sérialise anonymiseLe', () => {
    const dto = toCandidatDto({ ...base, anonymiseLe: CREATED })
    expect(dto.aCv).toBe(false)
    expect(dto.anonymiseLe).toBe('2026-01-15T10:00:00.000Z')
  })
})

describe('toDemandeDto', () => {
  const base: DemandeMapRow = {
    uuid: '0b3f1a2c-0000-4000-8000-000000000020',
    entrepriseCliente: 'Boulangerie Boréale',
    posteRecherche: 'Chauffeur classe 1',
    categorie: 'CHAUFFEUR_CLASSE_1',
    posteAutrePrecision: null,
    recrutementInternational: true,
    contactNom: 'Marie Lépine',
    contactEmail: 'marie@example.test',
    contactTelephone: null,
    nombrePostes: 3,
    dateDebut: new Date('2026-04-01T00:00:00.000Z'),
    description: 'Poste permanent',
    publiee: true,
    statut: 'OUVERTE',
    titreOffre: 'Chauffeur classe 1 recherché',
    lieu: 'Lachine, QC',
    typeContrat: 'TEMPS_PLEIN',
    salaire: '28 $/h',
    descriptionPublique: 'Détails publics',
    publieeLe: CREATED,
    createdAt: CREATED,
    company: COMPANY,
  }

  it('formate dateDebut en YYYY-MM-DD et garde publieeLe en ISO', () => {
    const dto = toDemandeDto(base)
    expect(dto.dateDebut).toBe('2026-04-01')
    expect(dto.publieeLe).toBe('2026-01-15T10:00:00.000Z')
    expect(dto.correspondants).toEqual([])
    expect(dto.affectations).toEqual([])
    expect(dto.site).toEqual(COMPANY_SITE)
  })

  it('renvoie dateDebut null quand elle est absente', () => {
    expect(toDemandeDto({ ...base, dateDebut: null, publieeLe: null }).dateDebut).toBeNull()
  })

  it('propage correspondants et affectations', () => {
    const dto = toDemandeDto(
      base,
      [
        {
          uuid: '0b3f1a2c-0000-4000-8000-000000000030',
          nomComplet: 'Paul Roy',
          categorie: 'CHAUFFEUR_CLASSE_1',
          site: COMPANY_SITE,
          posteRecherche: 'Chauffeur',
          disponibilite: null,
          statut: 'DISPONIBLE',
          origine: 'LOCAL',
        },
      ],
      [
        {
          uuid: '0b3f1a2c-0000-4000-8000-000000000040',
          candidatUuid: '0b3f1a2c-0000-4000-8000-000000000030',
          nomCompletCandidat: 'Paul Roy',
          dateAffectation: '2026-02-01T00:00:00.000Z',
        },
      ],
    )
    expect(dto.correspondants).toHaveLength(1)
    expect(dto.affectations).toHaveLength(1)
  })
})

describe('toCandidatureDto', () => {
  const CV_KEY = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf'
  const base: CandidatureMapRow = {
    uuid: '0b3f1a2c-0000-4000-8000-000000000050',
    nomComplet: 'Léa Gagnon',
    email: 'lea@example.test',
    telephone: '438-555-0101',
    adresseComplete: '12 rue Principale, Montréal',
    posteRecherche: 'Manutention',
    posteAutrePrecision: null,
    categorie: 'MANUTENTION',
    experience: 'UN_A_TROIS_ANS',
    pays: 'Canada',
    message: 'Disponible rapidement',
    statut: 'NOUVELLE',
    dateEnvoi: CREATED,
    anonymiseLe: null,
    cvKey: CV_KEY,
    demande: { titreOffre: 'Manutentionnaire' },
    company: COMPANY,
  }

  it('expose offreTitre, aCv et les documents fournis', () => {
    const dto = toCandidatureDto(base, [{ key: CV_KEY, nomOriginal: 'cv-lea.pdf' }])
    expect(dto.offreTitre).toBe('Manutentionnaire')
    expect(dto.aCv).toBe(true)
    expect(dto.documents).toEqual([{ key: CV_KEY, nomOriginal: 'cv-lea.pdf' }])
    expect(dto.dateEnvoi).toBe('2026-01-15T10:00:00.000Z')
  })

  it('candidature spontanée anonymisée : offreTitre null, pas de CV ni document', () => {
    const dto = toCandidatureDto({ ...base, demande: null, cvKey: null, anonymiseLe: CREATED }, [])
    expect(dto.offreTitre).toBeNull()
    expect(dto.aCv).toBe(false)
    expect(dto.documents).toEqual([])
    expect(dto.anonymiseLe).toBe('2026-01-15T10:00:00.000Z')
  })
})
