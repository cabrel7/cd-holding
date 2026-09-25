// Bornes et constantes partagées par la validation (shared/validation/cms.ts), les services
// admin (T1) et l'UI du CMS générique (T4). Un seul endroit à changer — zéro magic value.
export const MAX_SERVICES_MIS_EN_AVANT = 3
export const MAX_REORDER_ITEMS = 200

export const CMS_TEXT_BOUNDS = {
  titre: { min: 2, max: 160 },
  nom: { min: 2, max: 160 },
  poste: { min: 2, max: 160 },
  description: { min: 10, max: 2000 },
  bio: { max: 600 },
  typeRelation: { max: 160 },
} as const

export const DATE_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/
