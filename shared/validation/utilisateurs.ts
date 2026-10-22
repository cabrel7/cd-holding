// Validation de la gestion des comptes (lot 6, spec docs/specs/lot6-comptes.md §4). Source
// unique client + serveur. Imports relatifs et zod explicite (importable par tsx). Tous les
// objets sont `.strict()`.
import { z } from 'zod'
import { ADMIN_PAGE_MAX, ADMIN_SEARCH_MAX, UTILISATEUR_TEXT_BOUNDS } from '../config/admin'
import { FILIALE_SLUGS } from '../config/sites'
import { ROLES, type AppRole } from '../utils/roles'

// z.enum exige un tuple ; valeurs issues de la constante `as const` (couvertes par les tests).
const ROLES_TUPLE = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE, ROLES.EMPLOYE] as [AppRole, ...AppRole[]]
export const roleSchema = z.enum(ROLES_TUPLE)

// `siteSlugSchema` existant accepte la holding : ici seule une filiale est un rattachement
// valable pour un compte (D7 — pas d'ADMIN_FILIALE holding).
const siteFilialeSchema = z.enum(FILIALE_SLUGS)

const pageSchema = z.coerce.number().int().min(1).max(ADMIN_PAGE_MAX).default(1)
const rechercheSchema = z.preprocess(
  (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().max(ADMIN_SEARCH_MAX).optional(),
)

export const utilisateursQuerySchema = z
  .object({
    role: roleSchema.optional(),
    actif: z.enum(['true', 'false']).optional(),
    q: rechercheSchema,
    page: pageSchema,
  })
  .strict()

const nomSchema = z
  .string({ required_error: 'Nom requis' })
  .trim()
  .min(UTILISATEUR_TEXT_BOUNDS.nom.min, `Le nom doit contenir au moins ${UTILISATEUR_TEXT_BOUNDS.nom.min} caractères`)
  .max(UTILISATEUR_TEXT_BOUNDS.nom.max)

const emailCompteSchema = z
  .string({ required_error: 'Email requis' })
  .trim()
  .toLowerCase()
  .max(UTILISATEUR_TEXT_BOUNDS.email.max)
  .email('Email invalide')

export const utilisateurCreateSchema = z
  .object({
    nom: nomSchema,
    email: emailCompteSchema,
    role: roleSchema,
    site: siteFilialeSchema.optional(),
  })
  .strict()
  .superRefine((valeur, ctx) => {
    if (valeur.role === ROLES.SUPER_ADMIN && valeur.site !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['site'],
        message: "Un super administrateur n'est rattaché à aucune filiale.",
      })
    }
    if (valeur.role !== ROLES.SUPER_ADMIN && valeur.site === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['site'], message: 'Une filiale est requise pour ce rôle.' })
    }
  })

// Partiel ≥ 1 clé. Contrairement au `exigerAuMoinsUnChamp` CMS (où `site` est le scoping, pas
// un champ éditable), `site` compte ici : `{ site: 'transport' }` seul est un PATCH valide.
// La moitié « rattachement » de la règle dépend de l'état fusionné (rôle résultant × site
// fourni × companyId actuel) et vit côté service (§3) : le schéma rejette seulement la
// combinaison statiquement absurde `role: SUPER_ADMIN` + `site`.
export const utilisateurUpdateSchema = z
  .object({
    nom: nomSchema.optional(),
    role: roleSchema.optional(),
    site: siteFilialeSchema.optional(),
    actif: z.boolean().optional(),
  })
  .strict()
  .refine((obj) => Object.values(obj).some((v) => v !== undefined), {
    message: 'Au moins un champ à modifier est requis',
  })
  .superRefine((valeur, ctx) => {
    if (valeur.role === ROLES.SUPER_ADMIN && valeur.site !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['site'],
        message: "Un super administrateur n'est rattaché à aucune filiale.",
      })
    }
  })

/** Reset de mot de passe par un admin : aucun champ d'entrée (le mdp est généré serveur, D14). */
export const resetMotDePasseSchema = z.object({}).strict()

export type UtilisateursQuery = z.infer<typeof utilisateursQuerySchema>
export type UtilisateurCreateInput = z.infer<typeof utilisateurCreateSchema>
export type UtilisateurUpdateInput = z.infer<typeof utilisateurUpdateSchema>
