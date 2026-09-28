import { describe, expect, it } from 'vitest'
import {
  construireCandidature,
  toOffreDto,
  validerFichiersCandidature,
  type ChampsCandidature,
  type FichierEntrant,
  type OffreRow,
  type OffreResolue,
} from '../../server/lib/candidature'

const PDF = Buffer.from('%PDF-1.7 contenu minimal de test')
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
const NOT_A_FILE = Buffer.from('<script>alert(1)</script>')

const cv = (data: Buffer, filename = 'cv.pdf'): FichierEntrant => ({ filename, data })

describe('validerFichiersCandidature', () => {
  it('accepts exactly one valid PDF cv and no documents', () => {
    const result = validerFichiersCandidature([cv(PDF)], [])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.cv.mimeType).toBe('application/pdf')
      expect(result.documents).toEqual([])
    }
  })

  it('accepts a cv plus PDF/PNG documents', () => {
    const result = validerFichiersCandidature([cv(PDF)], [cv(PNG, 'diplome.png'), cv(PDF, 'permis.pdf')])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.documents).toHaveLength(2)
  })

  it('rejects when no cv is provided', () => {
    const result = validerFichiersCandidature([], [])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.erreur.statusCode).toBe(400)
  })

  it('rejects more than one cv', () => {
    const result = validerFichiersCandidature([cv(PDF), cv(PDF)], [])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.erreur.statusCode).toBe(400)
  })

  it('rejects more than 5 documents', () => {
    const documents = Array.from({ length: 6 }, (_, i) => cv(PDF, `doc-${i}.pdf`))
    const result = validerFichiersCandidature([cv(PDF)], documents)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.erreur.statusCode).toBe(400)
  })

  it('rejects an empty file with 400', () => {
    const result = validerFichiersCandidature([cv(Buffer.alloc(0))], [])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.erreur.statusCode).toBe(400)
  })

  it('rejects a cv above the per-file limit with 413', () => {
    const gros = Buffer.concat([PDF, Buffer.alloc(6 * 1024 * 1024)])
    const result = validerFichiersCandidature([cv(gros)], [])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.erreur.statusCode).toBe(413)
  })

  it('rejects a total above 10 Mo even when each file is individually within limits', () => {
    const cinqMo = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024 - PDF.length)])
    const result = validerFichiersCandidature([cv(cinqMo)], [cv(cinqMo, 'gros-doc.pdf'), cv(cinqMo, 'autre.pdf')])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.erreur.statusCode).toBe(413)
  })

  it('rejects a cv whose real bytes are not a PDF (renamed .txt), regardless of the declared filename', () => {
    const result = validerFichiersCandidature([cv(NOT_A_FILE, 'cv.pdf')], [])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.erreur.statusCode).toBe(415)
  })

  it('rejects a document type outside PDF/JPEG/PNG (e.g. a real PNG is fine but a fake one is not)', () => {
    const result = validerFichiersCandidature([cv(PDF)], [cv(NOT_A_FILE, 'photo.png')])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.erreur.statusCode).toBe(415)
  })

  it('validates ALL files before failing on the last one (order does not matter for the caller: nothing is written until ok)', () => {
    const result = validerFichiersCandidature([cv(PDF)], [cv(PDF, 'ok.pdf'), cv(NOT_A_FILE, 'ko.pdf')])
    expect(result.ok).toBe(false)
  })
})

const offre: OffreResolue = { id: 42, titreOffre: 'Manutentionnaire', categorie: 'MANUTENTION' }

const champsBase: ChampsCandidature = {
  nom: 'Awa Diop',
  email: 'awa@exemple.ca',
  telephone: '514-000-0000',
  adresseComplete: '123 rue Exemple, Montréal',
  pays: 'Canada',
  experience: 'UN_A_TROIS_ANS',
}

describe('construireCandidature', () => {
  it('derives posteRecherche/categorie from the offer, never from the submitted fields, and never sets a precision', () => {
    const data = construireCandidature(
      { ...champsBase, posteRecherche: 'autre', posteAutrePrecision: 'Devrait être ignoré' },
      1,
      offre,
      { cvKey: 'cv-key.pdf', autresDocumentsKeys: [] },
      new Date('2026-01-01T00:00:00Z'),
    )
    expect(data.posteRecherche).toBe('Manutentionnaire')
    expect(data.categorie).toBe('MANUTENTION')
    expect(data.posteAutrePrecision).toBeNull()
    expect(data.demandeId).toBe(42)
  })

  it('derives categorie from the chosen poste when there is no offer', () => {
    const data = construireCandidature(
      { ...champsBase, posteRecherche: 'chauffeur-classe-1' },
      1,
      null,
      { cvKey: 'cv-key.pdf', autresDocumentsKeys: [] },
      new Date('2026-01-01T00:00:00Z'),
    )
    expect(data.posteRecherche).toBe('chauffeur-classe-1')
    expect(data.categorie).toBe('CHAUFFEUR_CLASSE_1')
    expect(data.demandeId).toBeNull()
  })

  it('keeps the precision only when the poste is "autre", without an offer', () => {
    const data = construireCandidature(
      { ...champsBase, posteRecherche: 'autre', posteAutrePrecision: 'Aide-cuisinier' },
      1,
      null,
      { cvKey: 'cv-key.pdf', autresDocumentsKeys: [] },
      new Date('2026-01-01T00:00:00Z'),
    )
    expect(data.posteAutrePrecision).toBe('Aide-cuisinier')
    expect(data.categorie).toBe('AUTRE')
  })

  it('drops the precision when the poste is not "autre", even if one was submitted', () => {
    const data = construireCandidature(
      { ...champsBase, posteRecherche: 'entretien', posteAutrePrecision: 'Ignoré' },
      1,
      null,
      { cvKey: 'cv-key.pdf', autresDocumentsKeys: [] },
      new Date('2026-01-01T00:00:00Z'),
    )
    expect(data.posteAutrePrecision).toBeNull()
  })

  it('maps message to null when absent, copies file keys and stamps consentementLe', () => {
    const now = new Date('2026-03-05T10:00:00Z')
    const data = construireCandidature(
      { ...champsBase, posteRecherche: 'manutention' },
      7,
      null,
      { cvKey: 'cv.pdf', autresDocumentsKeys: ['a.pdf', 'b.png'] },
      now,
    )
    expect(data.message).toBeNull()
    expect(data.cvKey).toBe('cv.pdf')
    expect(data.autresDocumentsKeys).toEqual(['a.pdf', 'b.png'])
    expect(data.consentementLe).toBe(now)
    expect(data.companyId).toBe(7)
  })
})

describe('toOffreDto', () => {
  it('maps a fully-populated row and never exposes an internal id', () => {
    const row: OffreRow = {
      uuid: '11111111-1111-4111-8111-111111111111',
      titreOffre: 'Chauffeur classe 1',
      lieu: 'Montréal',
      typeContrat: 'TEMPS_PLEIN',
      salaire: '25 $/h',
      descriptionPublique: 'Livraisons régionales.',
      publieeLe: new Date('2026-05-01T12:00:00Z'),
    }
    const dto = toOffreDto(row)
    expect(dto).toEqual({
      uuid: row.uuid,
      titre: 'Chauffeur classe 1',
      lieu: 'Montréal',
      typeContrat: 'TEMPS_PLEIN',
      salaire: '25 $/h',
      description: 'Livraisons régionales.',
      publieeLe: '2026-05-01T12:00:00.000Z',
    })
    expect(dto).not.toHaveProperty('id')
    expect(dto).not.toHaveProperty('companyId')
  })
})
