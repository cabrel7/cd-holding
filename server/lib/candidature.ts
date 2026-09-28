// Logique pure du pipeline de candidature (placement, spec docs/specs/lot3-pages-specifiques.md
// §3). AUCUN accès à H3 ni à Prisma ici (skill nitro) : directement testable
// (tests/unit/candidature-mapping.test.ts) sans booter Nitro.
// `server/api/public/placement/{offres/**,candidatures.post}.ts` orchestrent (rate-limit,
// multipart, lecture/écriture Prisma, courriels) et n'y ajoutent aucune règle métier.
import {
  CANDIDATURE_LIMITS,
  CV_MIMES,
  DOCUMENT_MIMES,
  POSTE_AUTRE,
  POSTES_CANDIDAT,
  type CategoriePosteKey,
  type NiveauExperienceKey,
  type PosteCandidatKey,
  type TypeContratKey,
} from '#shared/config/candidature'
import type { PublicOffreDto } from '#shared/types/public'
import { sniffMime, type AllowedUploadMime } from './file-types'

// --- Liste/détail des offres publiques (server/api/public/placement/offres/**) ------------

/** `select` explicite : jamais `id`, `companyId`, `entrepriseCliente` ni les champs de contact. */
export const OFFRE_SELECT = {
  uuid: true,
  titreOffre: true,
  lieu: true,
  typeContrat: true,
  salaire: true,
  descriptionPublique: true,
  publieeLe: true,
} as const

export interface OffreRow {
  readonly uuid: string
  readonly titreOffre: string | null
  readonly lieu: string | null
  readonly typeContrat: TypeContratKey | null
  readonly salaire: string | null
  readonly descriptionPublique: string | null
  readonly publieeLe: Date | null
}

/**
 * Mappe une ligne `DemandeClient` déjà filtrée (spec §3 : `publiee`, `statut=OUVERTE`, champs
 * d'offre non nuls) vers le DTO public — les casts ne portent que sur des champs que l'appelant
 * a garantis non nuls via son `where`.
 */
export function toOffreDto(row: OffreRow): PublicOffreDto {
  return {
    uuid: row.uuid,
    titre: row.titreOffre as string,
    lieu: row.lieu as string,
    typeContrat: row.typeContrat as TypeContratKey,
    salaire: row.salaire,
    description: row.descriptionPublique as string,
    publieeLe: (row.publieeLe as Date).toISOString(),
  }
}

// --- Validation des fichiers (avant toute écriture, spec §3 étape 7) ----------------------

export interface FichierEntrant {
  readonly filename?: string
  readonly data: Buffer
}

export interface FichierValide {
  readonly champ: 'cv' | 'documents'
  readonly filename: string
  readonly data: Buffer
  readonly mimeType: AllowedUploadMime
}

export interface ErreurValidationFichiers {
  readonly statusCode: 400 | 413 | 415
  readonly statusMessage: string
}

export type ResultatFichiers =
  | { readonly ok: true; readonly cv: FichierValide; readonly documents: readonly FichierValide[] }
  | { readonly ok: false; readonly erreur: ErreurValidationFichiers }

interface PieceAVerifier {
  readonly champ: 'cv' | 'documents'
  readonly part: FichierEntrant
  readonly maxBytes: number
  readonly mimes: readonly string[]
}

/**
 * Valide TOUS les fichiers d'un envoi avant qu'aucun ne soit écrit (spec §3, étape 7) : exactement
 * un CV (PDF), au plus `documentsMax` documents (PDF/JPEG/PNG), aucun vide, aucun trop lourd
 * (par fichier puis au total), type réel vérifié par octets magiques (jamais le Content-Type déclaré).
 */
export function validerFichiersCandidature(cv: readonly FichierEntrant[], documents: readonly FichierEntrant[]): ResultatFichiers {
  if (cv.length !== 1) {
    return { ok: false, erreur: { statusCode: 400, statusMessage: 'Joignez exactement un CV.' } }
  }
  if (documents.length > CANDIDATURE_LIMITS.documentsMax) {
    return {
      ok: false,
      erreur: { statusCode: 400, statusMessage: `${CANDIDATURE_LIMITS.documentsMax} documents au maximum.` },
    }
  }

  const cvPart = cv[0] as FichierEntrant
  const pieces: readonly PieceAVerifier[] = [
    { champ: 'cv', part: cvPart, maxBytes: CANDIDATURE_LIMITS.cvMaxBytes, mimes: CV_MIMES },
    ...documents.map((part) => ({ champ: 'documents' as const, part, maxBytes: CANDIDATURE_LIMITS.documentMaxBytes, mimes: DOCUMENT_MIMES })),
  ]

  let total = 0
  const valides: FichierValide[] = []
  for (const { champ, part, maxBytes, mimes } of pieces) {
    if (part.data.length === 0) {
      return { ok: false, erreur: { statusCode: 400, statusMessage: 'Un fichier est vide.' } }
    }
    if (part.data.length > maxBytes) {
      return { ok: false, erreur: { statusCode: 413, statusMessage: 'Fichier trop volumineux.' } }
    }
    total += part.data.length

    const mimeType = sniffMime(part.data)
    if (!mimeType || !mimes.includes(mimeType)) {
      return { ok: false, erreur: { statusCode: 415, statusMessage: 'Type de fichier non autorisé.' } }
    }
    valides.push({ champ, filename: part.filename ?? 'fichier', data: part.data, mimeType })
  }
  if (total > CANDIDATURE_LIMITS.totalMaxBytes) {
    return { ok: false, erreur: { statusCode: 413, statusMessage: 'Taille totale des fichiers dépassée.' } }
  }

  const [cvValide, ...documentsValides] = valides
  return { ok: true, cv: cvValide as FichierValide, documents: documentsValides }
}

// --- Construction de la ligne Candidature (spec §3, `construireCandidature`) --------------

export interface ChampsCandidature {
  readonly nom: string
  readonly email: string
  readonly telephone: string
  readonly adresseComplete: string
  readonly pays: string
  readonly posteRecherche?: PosteCandidatKey
  readonly posteAutrePrecision?: string
  readonly experience: NiveauExperienceKey
  readonly message?: string
}

export interface OffreResolue {
  readonly id: number
  readonly titreOffre: string
  readonly categorie: CategoriePosteKey
}

export interface FichiersCandidature {
  readonly cvKey: string
  readonly autresDocumentsKeys: readonly string[]
}

export interface CandidatureData {
  readonly companyId: number
  readonly demandeId: number | null
  readonly nomComplet: string
  readonly email: string
  readonly telephone: string
  readonly adresseComplete: string
  readonly posteRecherche: string
  readonly posteAutrePrecision: string | null
  readonly categorie: CategoriePosteKey
  readonly experience: NiveauExperienceKey
  readonly pays: string
  readonly message: string | null
  readonly cvKey: string
  readonly autresDocumentsKeys: string[]
  readonly consentementLe: Date
}

function categorieDuPoste(posteRecherche: PosteCandidatKey): CategoriePosteKey {
  // POSTES_CANDIDAT couvre toutes les valeurs de PosteCandidatKey (type dérivé de ce tableau,
  // shared/config/candidature.ts) : le repli 'AUTRE' est défensif, jamais atteint en pratique.
  return (POSTES_CANDIDAT.find((poste) => poste.value === posteRecherche)?.categorie ?? 'AUTRE') as CategoriePosteKey
}

/**
 * Construit les données Prisma d'une candidature (spec §3) : avec une offre, `posteRecherche`/
 * `categorie` viennent de l'offre (jamais du client) et `posteAutrePrecision` est toujours null ;
 * sans offre, ils viennent des champs saisis. Pure : `now` et les clés de fichiers sont injectées.
 */
export function construireCandidature(
  champs: ChampsCandidature,
  companyId: number,
  offre: OffreResolue | null,
  fichiers: FichiersCandidature,
  now: Date,
): CandidatureData {
  const posteRecherche = offre ? offre.titreOffre : (champs.posteRecherche as PosteCandidatKey)
  const categorie = offre ? offre.categorie : categorieDuPoste(champs.posteRecherche as PosteCandidatKey)
  const posteAutrePrecision = !offre && champs.posteRecherche === POSTE_AUTRE ? (champs.posteAutrePrecision ?? null) : null

  return {
    companyId,
    demandeId: offre?.id ?? null,
    nomComplet: champs.nom,
    email: champs.email,
    telephone: champs.telephone,
    adresseComplete: champs.adresseComplete,
    posteRecherche,
    posteAutrePrecision,
    categorie,
    experience: champs.experience,
    pays: champs.pays,
    message: champs.message ?? null,
    cvKey: fichiers.cvKey,
    autresDocumentsKeys: [...fichiers.autresDocumentsKeys],
    consentementLe: now,
  }
}
