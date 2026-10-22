// Configuration du formulaire de candidature (placement) — imports relatifs uniquement : ce
// fichier doit rester importable par tsx (seed, scripts), voir CLAUDE.md.
import { MAX_UPLOAD_BYTES } from './upload'

export const PLACEMENT_SLUG = 'placement' as const

const MO = 1024 * 1024

export const CANDIDATURE_LIMITS = {
  adresseMin: 5,
  adresseMax: 300,
  paysMax: 80,
  precisionMax: 120,
  messageMax: 2000,
  documentsMax: 5,
  cvMaxBytes: 5 * MO,
  documentMaxBytes: 5 * MO,
  totalMaxBytes: MAX_UPLOAD_BYTES,
  partsMax: 20,
} as const

export const CV_MIMES = ['application/pdf'] as const // DEC-21 / Q-09
export const DOCUMENT_MIMES = ['application/pdf', 'image/jpeg', 'image/png'] as const
export const CV_ACCEPT = '.pdf,application/pdf'
export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'

export const EXTENSIONS_PAR_MIME: Readonly<Record<string, readonly string[]>> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
}

export const CHAMPS_FICHIER = { cv: 'cv', documents: 'documents' } as const

/** Miroir local de l'enum Prisma CategoriePoste (shared/ ne dépend pas du client généré). */
export type CategoriePosteKey =
  | 'MANUTENTION'
  | 'CHAUFFEUR_CLASSE_1'
  | 'CHAUFFEUR_CLASSE_3'
  | 'CHAUFFEUR_CLASSE_5'
  | 'ENTRETIEN'
  | 'AUTRE'

export const POSTES_CANDIDAT = [
  { value: 'manutention', label: 'Manutention / entrepôt', categorie: 'MANUTENTION' },
  { value: 'chauffeur-classe-1', label: 'Chauffeur classe 1', categorie: 'CHAUFFEUR_CLASSE_1' },
  { value: 'chauffeur-classe-3', label: 'Chauffeur classe 3', categorie: 'CHAUFFEUR_CLASSE_3' },
  { value: 'chauffeur-classe-5', label: 'Chauffeur classe 5', categorie: 'CHAUFFEUR_CLASSE_5' },
  { value: 'entretien', label: 'Entretien ménager', categorie: 'ENTRETIEN' },
  { value: 'autre', label: 'Autre', categorie: 'AUTRE' },
] as const satisfies readonly { value: string; label: string; categorie: CategoriePosteKey }[]

export type PosteCandidatKey = (typeof POSTES_CANDIDAT)[number]['value']
export const POSTE_AUTRE = 'autre' as const satisfies PosteCandidatKey

export const NIVEAUX_EXPERIENCE = [
  { value: 'MOINS_1_AN', label: 'Moins de 1 an' },
  { value: 'UN_A_TROIS_ANS', label: '1 à 3 ans' },
  { value: 'TROIS_A_CINQ_ANS', label: '3 à 5 ans' },
  { value: 'PLUS_5_ANS', label: 'Plus de 5 ans' },
] as const
export type NiveauExperienceKey = (typeof NIVEAUX_EXPERIENCE)[number]['value']

export const TYPES_CONTRAT = { TEMPS_PLEIN: 'Temps plein', TEMPS_PARTIEL: 'Temps partiel', TEMPORAIRE: 'Temporaire' } as const
export type TypeContratKey = keyof typeof TYPES_CONTRAT
export const TYPE_CONTRAT_SCHEMA_ORG = {
  TEMPS_PLEIN: 'FULL_TIME',
  TEMPS_PARTIEL: 'PART_TIME',
  TEMPORAIRE: 'TEMPORARY',
} as const satisfies Record<TypeContratKey, string>

export const CANDIDATURE_FORM = { bouton: 'Envoyer ma candidature', toastTitre: 'Candidature envoyée' } as const

// Délais Loi 25 (décision utilisateur, PROJECT_STATE) : rejet ou candidature jamais traitée →
// 6 mois après la date concernée ; retenue et vivier → 12 mois, renouvelables sur consentement.
// Constantes éditées plus tard si le client le demande (pas de réglage admin — spec lot 5 §0).
export const LOI25_DUREES = {
  rejetMois: 6,
  nonTraiteeMois: 6,
  vivierMois: 12,
} as const

export const OFFRES_PATH = '/placement/offres'
export const CANDIDATURE_SPONTANEE_PATH = `${OFFRES_PATH}/candidature-spontanee`
export const offrePath = (uuid: string): string => `${OFFRES_PATH}/${uuid}`
