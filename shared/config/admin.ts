// Constantes et libellés de l'admin (lot 4). Imports relatifs : importable par tsx et le serveur.
import { ROLES, type AppRole } from '../utils/roles'
import type { StatutClientDto, StatutMessageDto, TypeMessageDto } from '../types/admin'
import type { ContactFormulaire } from '../validation/contact'

export const ADMIN_PAGE_SIZE = 20
export const ADMIN_SEARCH_MAX = 100
export const ADMIN_PAGE_MAX = 10000
export const ADMIN_ACTIVITE_MAX = 5

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

export const CLIENT_TEXT_BOUNDS = {
  nom: { min: 1, max: 120 },
  entreprise: { max: 160 },
  email: { max: 254 },
  notes: { max: 2000 },
} as const
