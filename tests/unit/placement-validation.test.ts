import { describe, expect, it } from 'vitest'
import {
  affectationCreateSchema,
  candidatCreateSchema,
  candidatsQuerySchema,
  candidatUpdateSchema,
  candidatureUpdateSchema,
  candidaturesQuerySchema,
  demandeCreateSchema,
  demandesQuerySchema,
  demandeUpdateSchema,
} from '#shared/validation/placement'
import {
  CATEGORIE_POSTE_LABELS,
  MATCH_CANDIDATS_LIMIT,
  NIVEAU_EXPERIENCE_LABELS,
  ORIGINE_CANDIDAT_LABELS,
  STATUT_CANDIDAT_LABELS,
  STATUT_CANDIDATURE_LABELS,
  STATUT_DEMANDE_LABELS,
  TYPE_CONTRAT_LABELS,
} from '#shared/config/admin'
import { LOI25_DUREES } from '#shared/config/candidature'
import { ADMIN_SEARCH_MAX } from '#shared/config/admin'

const DEMANDE_BASE = {
  entrepriseCliente: 'Boulangerie Boréale',
  posteRecherche: 'Chauffeur classe 1',
  categorie: 'CHAUFFEUR_CLASSE_1',
  contactNom: 'Marie Lépine',
  contactEmail: 'marie@boreale.ca',
  description: 'Livraison quotidienne dans la région de Québec. Veuillez décrire le parcours de livraison.',
}

describe('candidatsQuerySchema', () => {
  it('should default page and trim q', () => {
    const r = candidatsQuerySchema.parse({ q: '  jean ' })
    expect(r.page).toBe(1)
    expect(r.q).toBe('jean')
    expect(r.statut).toBeUndefined()
  })
  it('should accept enums and coerce string pages', () => {
    expect(candidatsQuerySchema.safeParse({ statut: 'PLACE', origine: 'LOCAL', page: '3' }).success).toBe(true)
  })
  it('should reject unknown keys and invalid enums', () => {
    expect(candidatsQuerySchema.safeParse({ statut: 'ARCHIVE' }).success).toBe(false)
    expect(candidatsQuerySchema.safeParse({ origine: 'REGIONALE' }).success).toBe(false)
    expect(candidatsQuerySchema.safeParse({ page: '10001' }).success).toBe(false)
    expect(candidatsQuerySchema.safeParse({ type: 'CONTACT' }).success).toBe(false)
  })
})

describe('candidatCreateSchema', () => {
  const base = { nomComplet: 'Jean', email: '  Jean@Exemple.CA ', categorie: 'MANUTENTION', origine: 'LOCAL' }
  it('should lowercase the email and default statut to DISPONIBLE', () => {
    const r = candidatCreateSchema.parse(base)
    expect(r.email).toBe('jean@exemple.ca')
    expect(r.statut).toBe('DISPONIBLE')
  })
  it('should turn empty optionals into null', () => {
    const r = candidatCreateSchema.parse({ ...base, telephone: '', posteRecherche: ' ', notes: '' })
    expect(r.telephone).toBeNull()
    expect(r.posteRecherche).toBeNull()
    expect(r.notes).toBeNull()
  })
  it('should require categorie, origine and a valid email', () => {
    expect(candidatCreateSchema.safeParse({ ...base, categorie: undefined }).success).toBe(false)
    expect(candidatCreateSchema.safeParse({ ...base, origine: 'LOCAL' }).success).toBe(true)
    expect(candidatCreateSchema.safeParse({ ...base, email: 'pas-un-courriel' }).success).toBe(false)
  })
  it('should validate the telephone and reject unknown keys (companyId interdit)', () => {
    expect(candidatCreateSchema.safeParse({ ...base, telephone: 'abc' }).success).toBe(false)
    expect(candidatCreateSchema.safeParse({ ...base, companyId: 1 }).success).toBe(false)
  })
})

describe('candidatUpdateSchema', () => {
  it('should reject an empty object', () => {
    expect(candidatUpdateSchema.safeParse({}).success).toBe(false)
  })
  it('should accept a partial update without applying field defaults', () => {
    const r = candidatUpdateSchema.parse({ statut: 'EN_PROCESSUS' })
    expect(r.statut).toBe('EN_PROCESSUS')
    expect(r.nomComplet).toBeUndefined()
  })
})

describe('demandesQuerySchema', () => {
  it('should parse the publiee boolean from query strings', () => {
    expect(demandesQuerySchema.parse({ publiee: 'true' }).publiee).toBe(true)
    expect(demandesQuerySchema.parse({ publiee: 'false' }).publiee).toBe(false)
    expect(demandesQuerySchema.parse({}).publiee).toBeUndefined()
    expect(demandesQuerySchema.safeParse({ publiee: 'oui' }).success).toBe(false)
  })
  it('should accept statut and reject unknown keys', () => {
    expect(demandesQuerySchema.safeParse({ statut: 'POURVUE' }).success).toBe(true)
    expect(demandesQuerySchema.safeParse({ publiee: 'true', x: 1 }).success).toBe(false)
  })
})

describe('demandeCreateSchema', () => {
  it('should accept core fields and default recrutementInternational and nombrePostes', () => {
    const r = demandeCreateSchema.parse(DEMANDE_BASE)
    expect(r.recrutementInternational).toBe(false)
    expect(r.nombrePostes).toBe(1)
    expect(r.statut).toBe('OUVERTE')
  })
  it('should reject offer fields and publiee at creation (publication passe par l’édition)', () => {
    expect(demandeCreateSchema.safeParse({ ...DEMANDE_BASE, publiee: true }).success).toBe(false)
    expect(demandeCreateSchema.safeParse({ ...DEMANDE_BASE, titreOffre: 'Chauffeur' }).success).toBe(false)
  })
  it('should validate coerce nombrePostes and the calendar date', () => {
    expect(demandeCreateSchema.safeParse({ ...DEMANDE_BASE, nombrePostes: '3' }).success).toBe(true)
    expect(demandeCreateSchema.safeParse({ ...DEMANDE_BASE, nombrePostes: 0 }).success).toBe(false)
    expect(demandeCreateSchema.safeParse({ ...DEMANDE_BASE, dateDebut: '2026-02-30' }).success).toBe(false)
    expect(demandeCreateSchema.safeParse({ ...DEMANDE_BASE, dateDebut: '2026-02-09' }).success).toBe(true)
  })
})

describe('demandeUpdateSchema', () => {
  it('should reject an empty object', () => {
    expect(demandeUpdateSchema.safeParse({}).success).toBe(false)
  })
  it('should accept a partial update without applying defaults', () => {
    const r = demandeUpdateSchema.parse({ statut: 'ANNULEE' })
    expect(r.statut).toBe('ANNULEE')
    expect(r.recrutementInternational).toBeUndefined()
  })
  it('should refuse publier=offre sans les champs de publication (même si déjà remplis ailleurs)', () => {
    expect(demandeUpdateSchema.safeParse({ publiee: true }).success).toBe(false)
    expect(demandeUpdateSchema.safeParse({ publiee: true, titreOffre: 'T' }).success).toBe(false)
    expect(demandeUpdateSchema.safeParse({ publiee: true, titreOffre: 'T', lieu: 'L', typeContrat: 'TEMPS_PLEIN', descriptionPublique: ' ' }).success).toBe(false)
  })
  it('should accept a complete publication payload', () => {
    const r = demandeUpdateSchema.parse({
      publiee: true,
      titreOffre: 'Chauffeur livreur classe 1',
      lieu: 'Québec',
      typeContrat: 'TEMPS_PLEIN',
      descriptionPublique: 'Livraison quotidienne de pain artisanal dans la région de Québec.',
    })
    expect(r.publiee).toBe(true)
    expect(r.titreOffre).toBe('Chauffeur livreur classe 1')
  })
  it('should allow republishing with offer fields and depublishing alone', () => {
    expect(demandeUpdateSchema.safeParse({ publiee: false }).success).toBe(true)
  })
})

describe('affectationCreateSchema / candidatureUpdateSchema / candidaturesQuerySchema', () => {
  it('affectationCreateSchema requires a valid uuid', () => {
    expect(affectationCreateSchema.safeParse({ candidatUuid: 'not-a-uuid' }).success).toBe(false)
    expect(affectationCreateSchema.safeParse({ candidatUuid: '3e5f8c30-3d1e-4e6f-9a2b-1c2d3e4f5a6b' }).success).toBe(true)
  })
  it('candidatureUpdateSchema requires statut and is strict', () => {
    expect(candidatureUpdateSchema.safeParse({ statut: 'RETENUE' }).success).toBe(true)
    expect(candidatureUpdateSchema.safeParse({}).success).toBe(false)
    expect(candidatureUpdateSchema.safeParse({ statut: 'RETENUE', x: 1 }).success).toBe(false)
  })
  it('candidaturesQuerySchema accepts statut/q/page and is strict', () => {
    const r = candidaturesQuerySchema.parse({ statut: 'EN_REVISION', page: '2', q: '  marie ' })
    expect(r.statut).toBe('EN_REVISION')
    expect(r.page).toBe(2)
    expect(r.q).toBe('marie')
    expect(candidaturesQuerySchema.safeParse({ page: '10001' }).success).toBe(false)
  })
  it('rejects a q longer than the maximum', () => {
    expect(candidaturesQuerySchema.safeParse({ q: 'a'.repeat(ADMIN_SEARCH_MAX + 1) }).success).toBe(false)
  })
})

describe('Libellés placement (exhaustivité : un libellé par valeur d’enum prisma)', () => {
  it('statuts candidat', () => {
    expect(Object.keys(STATUT_CANDIDAT_LABELS).sort()).toEqual(['DISPONIBLE', 'EN_PROCESSUS', 'PLACE'])
  })
  it('statuts candidature', () => {
    expect(Object.keys(STATUT_CANDIDATURE_LABELS).sort()).toEqual(['EN_REVISION', 'NOUVELLE', 'REJETEE', 'RETENUE'])
  })
  it('statuts demande', () => {
    expect(Object.keys(STATUT_DEMANDE_LABELS).sort()).toEqual(['ANNULEE', 'OUVERTE', 'POURVUE'])
  })
  it('origines', () => {
    expect(Object.keys(ORIGINE_CANDIDAT_LABELS).sort()).toEqual(['INTERNATIONAL', 'LOCAL'])
  })
  it('catégories, niveaux et contrats (dérivés des listes du formulaire public)', () => {
    expect(CATEGORIE_POSTE_LABELS.AUTRE).toBe('Autre')
    expect(CATEGORIE_POSTE_LABELS.MANUTENTION).toBe('Manutention / entrepôt')
    expect(NIVEAU_EXPERIENCE_LABELS.PLUS_5_ANS).toBe('Plus de 5 ans')
    expect(TYPE_CONTRAT_LABELS.TEMPS_PARTIEL).toBe('Temps partiel')
  })
  it('règles métier placement', () => {
    expect(MATCH_CANDIDATS_LIMIT).toBe(10)
    expect(LOI25_DUREES).toEqual({ rejetMois: 6, nonTraiteeMois: 6, vivierMois: 12 })
  })
})