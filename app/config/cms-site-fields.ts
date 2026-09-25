// Champs et schéma de formulaire pour l'onglet "Site" (fiche de la société),
// /admin/contenu/site (spec phase 3 §5, T3). Contrairement aux collections/sections, ce
// formulaire ne mappe pas 1:1 vers `siteReglagesFilialeSchema` / `siteReglagesSuperAdminSchema` :
// ces derniers acceptent `string | number | null`, alors qu'un champ texte du formulaire
// (CmsFieldInput, type 'text' — aucun `CmsFieldType` numérique n'existe) produit toujours une
// chaîne, même pour `effectif`/`ordre`. Le mapping pur ci-dessous (chaîne vide → null,
// coercition des champs numériques) fait le pont — testé unitairement dans
// tests/unit/cms-site-form.test.ts. La validation finale reste les schémas zod partagés
// (CLAUDE.md : "Validation client = mêmes schémas partagés"), appliqués juste après ce mapping.
import { z, type ZodType } from 'zod'
import type { CmsField } from '#shared/content/sections/types'
import { siteReglagesFilialeSchema, siteReglagesSuperAdminSchema } from '#shared/validation/sites'

// Champs visibles par un ADMIN_FILIALE sur sa propre filiale, et par un SUPER_ADMIN.
export const siteFields: readonly CmsField[] = [
  {
    key: 'nomCourt',
    label: 'Nom court',
    type: 'text',
    maxLength: 80,
    helpText: 'Nom affiché publiquement (navigation, en-têtes). Laisser vide pour utiliser le nom complet.',
  },
  {
    key: 'secteur',
    label: 'Secteur',
    type: 'text',
    minLength: 2,
    maxLength: 160,
    helpText: 'Ex. « Entretien ménager commercial ». Affiché sur la fiche de la filiale, à l’accueil du groupe.',
  },
  {
    key: 'description',
    label: 'Description',
    type: 'textarea',
    minLength: 10,
    maxLength: 600,
    helpText: 'Présentation courte affichée sur la fiche de la filiale, à l’accueil du groupe.',
  },
  {
    key: 'heroImageKey',
    label: 'Image de couverture',
    type: 'image',
    helpText: 'Utilisée en repli si aucune image n’est définie pour le hero de la page d’accueil du site.',
  },
  {
    key: 'effectif',
    label: 'Effectif',
    type: 'text',
    helpText: 'Nombre de personnes dans l’équipe. Utilisé dans le bandeau de chiffres du groupe.',
  },
  { key: 'email', label: 'Courriel', type: 'text', maxLength: 255 },
  { key: 'telephone', label: 'Téléphone', type: 'text', maxLength: 30 },
  { key: 'adresse', label: 'Adresse', type: 'text', maxLength: 255 },
  { key: 'linkedinUrl', label: 'LinkedIn', type: 'url' },
  { key: 'facebookUrl', label: 'Facebook', type: 'url' },
  { key: 'instagramUrl', label: 'Instagram', type: 'url' },
] as const

// Champs structurels réservés au SUPER_ADMIN (spec phase 3 §5, "T3 contenu minimal").
export const siteSuperAdminFields: readonly CmsField[] = [
  { key: 'nom', label: 'Nom légal', type: 'text', required: true, minLength: 2, maxLength: 160 },
  { key: 'ordre', label: "Ordre d'affichage", type: 'text', helpText: 'Position dans la liste des filiales (0 = premier).' },
] as const

export function siteFieldsForRole(isSuperAdmin: boolean): readonly CmsField[] {
  return isSuperAdmin ? [...siteFields, ...siteSuperAdminFields] : siteFields
}

// Champs numériques saisis en texte, coercés ici plutôt que dans le catalogue partagé.
const NULLABLE_NUMBER_KEYS = new Set(['effectif'])
// Optionnel mais NON nullable côté schéma partagé (`ordre: z.number().int().min(0).max(1000).optional()`,
// sans `.nullable()`) : une chaîne vide doit omettre le champ (= aucun changement), jamais `null`
// (qui serait rejeté : "Expected number, received null").
const OPTIONAL_NUMBER_KEYS = new Set(['ordre'])
// Chaîne NON nullable côté schéma partagé (`nom: z.string().min(2)...optional()`, requise dès
// qu'un SUPER_ADMIN renomme le site) : une chaîne vide doit rester une chaîne vide, pour que le
// message d'erreur du schéma ("2 caractères minimum") s'affiche sous le champ plutôt que d'être
// avalée silencieusement en "aucun changement".
const REQUIRED_STRING_KEYS = new Set(['nom'])

/**
 * Mapping pur formulaire → payload (spec phase 3 §5, "pièges") : chaîne vide → `null` pour les
 * champs texte nullables (évite un 400 sur `email`/les URLs/`secteur`/`description`),
 * coercition des champs numériques saisis en texte vers `number`. Ne valide aucune borne : la
 * validation finale reste les schémas zod partagés, appliqués juste après (voir
 * `buildSiteFormSchema`). Fonction pure, testée unitairement.
 */
export function mapSiteFormValues(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') {
      out[key] = value
      continue
    }

    const trimmed = value.trim()

    if (NULLABLE_NUMBER_KEYS.has(key)) {
      out[key] = trimmed === '' ? null : Number(trimmed)
      continue
    }
    if (OPTIONAL_NUMBER_KEYS.has(key)) {
      if (trimmed !== '') out[key] = Number(trimmed)
      continue
    }
    if (REQUIRED_STRING_KEYS.has(key)) {
      out[key] = trimmed
      continue
    }

    out[key] = trimmed === '' ? null : trimmed
  }

  return out
}

/**
 * Schéma passé à `CmsFormDialog` (`schema.safeParse(...)`, voir CmsFormDialog.vue) : le mapping
 * pur ci-dessus, puis le schéma zod partagé (source unique de vérité des bornes, identique à
 * celui utilisé par `PATCH /api/admin/sites/[uuid]`).
 */
export function buildSiteFormSchema(isSuperAdmin: boolean): ZodType {
  const target = isSuperAdmin ? siteReglagesSuperAdminSchema : siteReglagesFilialeSchema
  return z.preprocess((raw) => mapSiteFormValues(raw as Record<string, unknown>), target)
}
