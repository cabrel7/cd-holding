// DTO admin "réglages de site" (server/api/admin/sites/**, T1) et forme normalisée d'erreur
// consommée par app/utils/admin-error.ts (T4).
import type { ModuleKey } from '../config/modules'
import type { SiteSlug } from '../config/sites'

export type CompanyTypeDto = 'HOLDING' | 'FILIALE'
export type StatutSiteDto = 'ACTIF' | 'EN_MAINTENANCE' | 'EN_CONSTRUCTION'

export interface AdminSiteSummary {
  readonly uuid: string
  readonly slug: SiteSlug
  readonly nom: string
  readonly nomCourt: string | null
  readonly type: CompanyTypeDto
  readonly couleurAccent: string
  readonly statutSite: StatutSiteDto
  readonly modules: readonly ModuleKey[]
}

export interface AdminSiteReglages extends AdminSiteSummary {
  readonly ordre: number
  readonly secteur: string | null
  readonly description: string | null
  readonly effectif: number | null
  readonly email: string | null
  readonly telephone: string | null
  readonly adresse: string | null
  readonly linkedinUrl: string | null
  readonly facebookUrl: string | null
  readonly instagramUrl: string | null
  readonly heroImageKey: string | null
}

/** Forme normalisée d'erreur — `app/utils/admin-error.ts` (T4) `toAdminError(e)`. */
export interface AdminError {
  readonly message: string
  readonly status: number
}

// --- Lot 4 : messages, clients, tableau de bord ---------------------------------------------
import type { ContactFormulaire } from '../validation/contact'

/** Page d'une liste paginée (offset). `items` est vide si `page` dépasse le total. */
export interface AdminPage<T> {
  readonly items: readonly T[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly pageCount: number
}

/** Référence à un site (jamais d'id interne). */
export interface AdminSiteRef {
  readonly uuid: string
  readonly slug: SiteSlug
  readonly nom: string
}

export type StatutMessageDto = 'NOUVEAU' | 'EN_COURS' | 'TRAITE'
export type TypeMessageDto = 'CONTACT' | 'SUGGESTION_PRODUIT' | 'ASSISTANT_IMPORT_EXPORT'
export type StatutClientDto = 'PROSPECT' | 'CLIENT_ACTIF' | 'INACTIF'

/** Champ de `details` traduit côté serveur (libellé + valeur affichables). */
export interface ChampAffiche {
  readonly libelle: string
  readonly valeur: string
}

export interface AdminMessageDto {
  readonly uuid: string
  readonly nom: string
  readonly email: string
  readonly telephone: string | null
  readonly entreprise: string | null
  readonly sujet: string | null
  readonly message: string
  readonly type: TypeMessageDto
  readonly statut: StatutMessageDto
  readonly site: AdminSiteRef
  /** Formulaire d'origine déduit de `details`/`type` ; null si indéterminable. */
  readonly formulaire: ContactFormulaire | null
  readonly champs: readonly ChampAffiche[]
  /** ISO 8601 UTC. */
  readonly createdAt: string
}

export interface AdminClientDto {
  readonly uuid: string
  readonly nom: string
  readonly email: string | null
  readonly telephone: string | null
  readonly entreprise: string | null
  readonly statut: StatutClientDto
  readonly notes: string | null
  readonly site: AdminSiteRef
  /** Vrai si un dossier comptable est lié (supprimé en cascade avec le client). */
  readonly aDossier: boolean
  /** ISO 8601 UTC. */
  readonly derniereInteraction: string | null
  /** ISO 8601 UTC. */
  readonly dateAjout: string
}

export interface AdminDashboardSiteRow {
  readonly site: AdminSiteRef
  readonly couleurAccent: string
  readonly statutSite: StatutSiteDto
  readonly messagesNouveaux: number
  readonly clients: number
}

export interface AdminDashboardDto {
  readonly sites: readonly AdminDashboardSiteRow[]
  readonly derniersMessages: readonly AdminMessageDto[]
  /** Lot 5 réservations : créneaux à venir (non annulés) des sites avec le module — vide si aucun. */
  readonly prochainesReservations: readonly AdminReservationDto[]
}

// --- Lot 5 : placement (candidats, demandes, candidatures) -------------------------------
import type { CategoriePosteKey, NiveauExperienceKey, TypeContratKey } from '../config/candidature'

export type CategoriePosteDto = CategoriePosteKey
export type NiveauExperienceDto = NiveauExperienceKey
export type TypeContratDto = TypeContratKey
export type StatutCandidatDto = 'DISPONIBLE' | 'EN_PROCESSUS' | 'PLACE'
export type OrigineCandidatDto = 'LOCAL' | 'INTERNATIONAL'
export type StatutCandidatureDto = 'NOUVELLE' | 'EN_REVISION' | 'RETENUE' | 'REJETEE'
export type StatutDemandeDto = 'OUVERTE' | 'POURVUE' | 'ANNULEE'

/**
 * Fichier d'une candidature. La `key` n'est exposée QUE pour construire le lien de
 * téléchargement `/api/files/[key]` (PRIVE → attachment, session exigée) — jamais seule,
 * toujours accompagnée du nom original affichable (critère d'acceptation n°2).
 */
export interface AdminFichierDto {
  readonly key: string
  readonly nomOriginal: string
}

interface AdminCandidatCommun {
  readonly uuid: string
  readonly nomComplet: string | null
  readonly categorie: CategoriePosteDto
  readonly site: AdminSiteRef
}

/** Vivier. PII nullables si `anonymiseLe` posé (Loi 25). */
export interface AdminCandidatDto extends AdminCandidatCommun {
  readonly email: string | null
  readonly telephone: string | null
  readonly posteRecherche: string | null
  readonly disponibilite: string | null
  readonly statut: StatutCandidatDto
  readonly origine: OrigineCandidatDto
  readonly notes: string | null
  readonly aCv: boolean
  /** ISO 8601 UTC. */
  readonly anonymiseLe: string | null
  /** ISO 8601 UTC. */
  readonly createdAt: string
}

/** Affectation d'un candidat à une demande (DEC-24). */
export interface AdminAffectationDto {
  readonly uuid: string
  readonly candidatUuid: string
  readonly nomCompletCandidat: string | null
  /** ISO 8601 UTC. */
  readonly dateAffectation: string
}

/** Proposition « Candidats correspondants » (top N, catégorie = demande, statut ≠ PLACE). */
export interface AdminCorrespondantDto extends AdminCandidatCommun {
  readonly posteRecherche: string | null
  readonly disponibilite: string | null
  readonly statut: StatutCandidatDto
  readonly origine: OrigineCandidatDto
}

export interface AdminDemandeDto {
  readonly uuid: string
  readonly entrepriseCliente: string
  readonly posteRecherche: string
  readonly categorie: CategoriePosteDto
  readonly posteAutrePrecision: string | null
  readonly recrutementInternational: boolean
  readonly contactNom: string
  readonly contactEmail: string
  readonly contactTelephone: string | null
  readonly nombrePostes: number
  /** "YYYY-MM-DD", null si absente. */
  readonly dateDebut: string | null
  readonly description: string
  readonly publiee: boolean
  readonly statut: StatutDemandeDto
  readonly titreOffre: string | null
  readonly lieu: string | null
  readonly typeContrat: TypeContratDto | null
  readonly salaire: string | null
  readonly descriptionPublique: string | null
  /** ISO 8601 UTC, posé au passage en ligne (offre publiée). */
  readonly publieeLe: string | null
  readonly correspondants: readonly AdminCorrespondantDto[]
  readonly affectations: readonly AdminAffectationDto[]
  readonly site: AdminSiteRef
  /** ISO 8601 UTC. */
  readonly createdAt: string
}

/** Candidature reçue. `anonymiseLe` ≠ null → ligne statistique seule, les PII sont nulles. */
export interface AdminCandidatureDto {
  readonly uuid: string
  readonly nomComplet: string | null
  readonly email: string | null
  readonly telephone: string | null
  readonly adresseComplete: string | null
  readonly posteRecherche: string
  readonly posteAutrePrecision: string | null
  readonly categorie: CategoriePosteDto
  readonly experience: NiveauExperienceDto | null
  readonly pays: string
  readonly message: string | null
  readonly statut: StatutCandidatureDto
  /** Titre de l'offre visée, null si candidature spontanée. */
  readonly offreTitre: string | null
  readonly aCv: boolean
  readonly documents: readonly AdminFichierDto[]
  /** ISO 8601 UTC. */
  readonly dateEnvoi: string
  /** ISO 8601 UTC, posé à l'anonymisation (cache les PII). */
  readonly anonymiseLe: string | null
  readonly site: AdminSiteRef
}

// --- Lot 5 : réservations (restaurant CCDPAA) ------------------------------------------------

export type StatutReservationDto = 'EN_ATTENTE' | 'CONFIRMEE' | 'ANNULEE'

export interface AdminReservationDto {
  readonly uuid: string
  readonly nom: string
  readonly email: string
  readonly telephone: string
  readonly nombrePersonnes: number
  /** Instant UTC exact du créneau (rendu côté client via formatDateHeureQuebec — DST géré). */
  readonly dateReservation: string
  readonly notes: string | null
  readonly statut: StatutReservationDto
  readonly site: AdminSiteRef
  readonly createdAt: string
}

// --- Lot 5 : planning (entretien, transport, ccdpaa + mon-planning) ---------------------------

export interface AdminQuartDto {
  readonly uuid: string
  readonly employeUuid: string
  readonly titre: string | null
  readonly lieu: string
  /** Instants UTC exacts (rendus côté client via formatDateHeureQuebec — DST géré). */
  readonly dateDebut: string
  readonly dateFin: string
  readonly notes: string | null
}

export interface AdminEmployePlanningDto {
  readonly uuid: string
  readonly nom: string
  readonly poste: string
  readonly actif: boolean
}

export interface PlanningSemaineDto {
  /** Lundi de la semaine (YYYY-MM-DD). */
  readonly semaine: string
  readonly employes: readonly AdminEmployePlanningDto[]
  readonly quarts: readonly AdminQuartDto[]
}

export interface MonPlanningDto {
  readonly employe: { readonly nom: string; readonly poste: string }
  readonly semaine: string
  readonly quarts: readonly AdminQuartDto[]
  readonly totalHeures: number
}

// --- Lot 5 : comptable (dossiers clients) ------------------------------------------------------

export type StatutDossierDto = 'A_JOUR' | 'EN_TRAITEMENT' | 'EN_RETARD'
export type ForfaitComptableDto = 'MENSUEL' | 'TRIMESTRIEL' | 'ANNUEL'

export interface AdminDossierComptableDto {
  readonly uuid: string
  readonly entreprise: string
  /** Contact = `Client.nom` de la relation 1-1. */
  readonly contact: string
  readonly email: string
  readonly forfait: ForfaitComptableDto
  /** "YYYY-MM-DD" (UTC minuit). */
  readonly echeance: string
  readonly statut: StatutDossierDto
  readonly notes: string | null
}

/** Liste dossiers : page paginée + compteur global de dossiers en retard (indépendant du filtre). */
export type AdminDossiersPageDto = AdminPage<AdminDossierComptableDto> & { readonly enRetard: number }

// --- Lot 5 : paramètres (profil de l'utilisateur connecté) ------------------------------------

import type { AppRole } from '../utils/roles'

/** `GET /api/admin/profil` — lecture de soi uniquement, jamais `passwordHash` ni id interne. */
export interface AdminProfilDto {
  readonly uuid: string
  readonly nom: string
  readonly email: string
  readonly role: AppRole
  /** null = compte holding sans filiale rattachée (accès groupe entier). */
  readonly company: { readonly uuid: string; readonly nom: string } | null
}

// --- Lot 6 : gestion des comptes (utilisateurs) -----------------------------------------------

import type { FilialeSlug } from '../config/sites'

/** Ligne de `/api/admin/utilisateurs` — jamais `id`, `companyId`, `passwordHash` ni `passwordChangedAt`. */
export interface AdminCompteDto {
  readonly uuid: string
  readonly nom: string
  readonly email: string
  readonly role: AppRole
  readonly actif: boolean
  /** null = SUPER_ADMIN rattaché à la holding (accès groupe entier, D7). */
  readonly company: { readonly uuid: string; readonly nom: string; readonly slug: FilialeSlug } | null
}
