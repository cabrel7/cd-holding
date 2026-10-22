// Constantes et libellés de l'admin (lot 4). Imports relatifs : importable par tsx et le serveur.
import { ROLES, type AppRole } from '../utils/roles'
import { NIVEAUX_EXPERIENCE, POSTES_CANDIDAT, TYPES_CONTRAT } from './candidature'
import type { StatutClientDto, StatutMessageDto, StatutReservationDto, TypeMessageDto } from '../types/admin'
import type { ContactFormulaire } from '../validation/contact'

export const ADMIN_PAGE_SIZE = 20
export const ADMIN_SEARCH_MAX = 100
export const ADMIN_PAGE_MAX = 10000
export const ADMIN_ACTIVITE_MAX = 5

/** 400 de POST /api/admin/profil/mot-de-passe quand `actuel` est faux (D5) — seul 400 qui se
 *  lit SOUS le champ « Mot de passe actuel » ; tout autre 400 part en toast. */
export const MESSAGE_ACTUEL_INCORRECT = 'Mot de passe actuel incorrect'
/** 429 partagé par login et changement de mdp : même quota IP, donc même libellé des deux côtés. */
export const MESSAGE_RATE_LIMIT_TENTATIVES = 'Trop de tentatives. Réessayez dans quelques minutes.'

export const STATUT_MESSAGE_LABELS: Record<StatutMessageDto, string> = {
  NOUVEAU: 'Nouveau',
  EN_COURS: 'En cours',
  TRAITE: 'Traité',
}

export const TYPE_MESSAGE_LABELS: Record<TypeMessageDto, string> = {
  CONTACT: 'Contact',
  SUGGESTION_PRODUIT: 'Suggestion de produit',
  ASSISTANT_IMPORT_EXPORT: 'Assistant import-export',
}

export const ORIGINE_FORMULAIRE_LABELS: Record<ContactFormulaire, string> = {
  holding: 'Site du groupe',
  entretien: 'Site de la filiale',
  transport: 'Site de la filiale',
  comptable: 'Site de la filiale',
  placement: 'Site de la filiale',
  ccdpaa: 'Site de la filiale',
  boissons: 'Site de la filiale',
  suggestion: 'Suggestion de produit',
  assistant: 'Assistant import-export',
}

export const STATUT_CLIENT_LABELS: Record<StatutClientDto, string> = {
  PROSPECT: 'Prospect',
  CLIENT_ACTIF: 'Actif',
  INACTIF: 'Inactif',
}

export const ROLE_LABELS: Record<AppRole, string> = {
  [ROLES.SUPER_ADMIN]: 'Super administrateur',
  [ROLES.ADMIN_FILIALE]: 'Administrateur de filiale',
  [ROLES.EMPLOYE]: 'Employé',
}

/** Bornes des champs éditables d'un compte (lot 6 utilisateurs) — source unique client + serveur. */
export const UTILISATEUR_TEXT_BOUNDS = {
  nom: { min: 2, max: 120 },
  email: { max: 254 },
} as const

/** Badge de statut d'un compte (vrai statut, pas un décor). */
export const STATUT_COMPTE_LABELS = { actif: 'Actif', inactif: 'Inactif' } as const

export const CLIENT_TEXT_BOUNDS = {
  nom: { min: 1, max: 120 },
  entreprise: { max: 160 },
  email: { max: 254 },
  notes: { max: 2000 },
} as const

export const COMPTABLE_TEXT_BOUNDS = {
  entreprise: { min: 1, max: 120 },
  contact: { min: 1, max: 120 },
  email: { max: 254 },
  notes: { max: 2000 },
} as const

// --- Lot 5 : placement (candidats, demandes, candidatures) -------------------------------
import type {
  CategoriePosteDto,
  NiveauExperienceDto,
  OrigineCandidatDto,
  StatutCandidatDto,
  StatutCandidatureDto,
  StatutDemandeDto,
  TypeContratDto,
} from '../types/admin'

export const MATCH_CANDIDATS_LIMIT = 10

export const STATUT_CANDIDAT_LABELS: Record<StatutCandidatDto, string> = {
  DISPONIBLE: 'Disponible',
  EN_PROCESSUS: 'En processus',
  PLACE: 'Placé',
}

export const STATUT_CANDIDATURE_LABELS: Record<StatutCandidatureDto, string> = {
  NOUVELLE: 'Nouvelle',
  EN_REVISION: 'En révision',
  RETENUE: 'Retenue',
  REJETEE: 'Rejetée',
}

export const STATUT_DEMANDE_LABELS: Record<StatutDemandeDto, string> = {
  OUVERTE: 'Ouverte',
  POURVUE: 'Pourvue',
  ANNULEE: 'Annulée',
}

export const ORIGINE_CANDIDAT_LABELS: Record<OrigineCandidatDto, string> = {
  LOCAL: 'Local',
  INTERNATIONAL: 'International',
}

/** Libellés dérivés des listes du formulaire public (une seule source : POSTES_CANDIDAT). */
export const CATEGORIE_POSTE_LABELS: Record<CategoriePosteDto, string> = Object.fromEntries(
  POSTES_CANDIDAT.map((p) => [p.categorie, p.label]),
) as Record<CategoriePosteDto, string>

export const NIVEAU_EXPERIENCE_LABELS: Record<NiveauExperienceDto, string> = Object.fromEntries(
  NIVEAUX_EXPERIENCE.map((n) => [n.value, n.label]),
) as Record<NiveauExperienceDto, string>

export const TYPE_CONTRAT_LABELS: Record<TypeContratDto, string> = { ...TYPES_CONTRAT }

export const PLACEMENT_TEXT_BOUNDS = {
  nomComplet: { min: 2, max: 120 },
  email: { max: 254 },
  telephone: { min: 7, max: 30 },
  texte: { min: 2, max: 120 },
  texteLong: { min: 10, max: 5000 },
  notes: { max: 2000 },
} as const

// --- Lot 5 : réservations (restaurant CCDPAA) ----------------------------------------------

export const STATUT_RESERVATION_LABELS: Record<StatutReservationDto, string> = {
  EN_ATTENTE: 'En attente',
  CONFIRMEE: 'Confirmée',
  ANNULEE: 'Annulée',
}

// --- Lot 5 : comptable (dossiers clients) ----------------------------------------------------

import type { ForfaitComptableDto, StatutDossierDto } from '../types/admin'

export const STATUT_DOSSIER_LABELS: Record<StatutDossierDto, string> = {
  A_JOUR: 'À jour',
  EN_TRAITEMENT: 'En traitement',
  EN_RETARD: 'En retard',
}

export const FORFAIT_COMPTABLE_LABELS: Record<ForfaitComptableDto, string> = {
  MENSUEL: 'Mensuel',
  TRIMESTRIEL: 'Trimestriel',
  ANNUEL: 'Annuel',
}
