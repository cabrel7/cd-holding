// Validation des réglages de site (spec §4.2, "Admin sites"). `couleurAccent` n'apparaît
// dans AUCUN de ces schémas : c'est ce qui la rend non modifiable via cette route (`.strict()`
// rejette un champ imprévu en 400), conformément à la décision non négociable §6.
import { z } from 'zod'

const STATUTS_SITE = ['ACTIF', 'EN_MAINTENANCE', 'EN_CONSTRUCTION'] as const
export const statutSiteSchema = z.enum(STATUTS_SITE)

const nomCourtSchema = z.string().trim().min(1).max(80)
const emailSchema = z.string().trim().toLowerCase().email('Email invalide').max(255)
const telephoneSchema = z.string().trim().max(30)
const adresseSchema = z.string().trim().max(255)
const effectifSchema = z.number().int().min(0).max(100_000)
const httpsUrlSchema = z
  .string()
  .trim()
  .url('URL invalide')
  .refine((value) => value.startsWith('https://'), 'https uniquement')

function exigerAuMoinsUnChamp<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.refine((obj) => Object.values(obj).some((valeur) => valeur !== undefined), {
    message: 'Au moins un champ à modifier est requis',
  })
}

// Champs modifiables par un ADMIN_FILIALE sur sa propre filiale.
const siteReglagesFilialeShape = {
  nomCourt: nomCourtSchema.nullable().optional(),
  effectif: effectifSchema.nullable().optional(),
  email: emailSchema.nullable().optional(),
  telephone: telephoneSchema.nullable().optional(),
  adresse: adresseSchema.nullable().optional(),
  linkedinUrl: httpsUrlSchema.nullable().optional(),
  facebookUrl: httpsUrlSchema.nullable().optional(),
  instagramUrl: httpsUrlSchema.nullable().optional(),
  heroImageKey: z.string().nullable().optional(),
} as const

export const siteReglagesFilialeSchema = exigerAuMoinsUnChamp(z.object(siteReglagesFilialeShape).strict())

// SUPER_ADMIN : les champs de la filiale, plus les champs structurels (nom, ordre, statut).
export const siteReglagesSuperAdminSchema = exigerAuMoinsUnChamp(
  z
    .object({
      ...siteReglagesFilialeShape,
      nom: z.string().trim().min(2).max(160).optional(),
      ordre: z.number().int().min(0).max(1000).optional(),
      statutSite: statutSiteSchema.optional(),
    })
    .strict(),
)

export type SiteReglagesFilialeInput = z.infer<typeof siteReglagesFilialeSchema>
export type SiteReglagesSuperAdminInput = z.infer<typeof siteReglagesSuperAdminSchema>
