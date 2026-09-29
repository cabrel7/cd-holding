// Traduction PURE de `MessageContact.details` (JSON libre côté Prisma) en champs affichables
// pour l'admin (spec lot 4 §3). `details` n'est jamais renvoyé brut : seules les clés connues de
// la config du formulaire d'origine sont exposées, avec libellés lisibles. Testé sans Nitro
// (tests/unit/message-details.test.ts) : imports explicites, aucun auto-import.
import { CONTACT_FORMS, estChampDetail, type FormulaireFilialeSlug } from '#shared/config/contact-forms'
import {
  ETAPES_ASSISTANT,
  palierRecommandation,
  recapReponses,
  type PalierRecommandation,
} from '#shared/content/ccdpaa/assistant-import-export'
import { formatDateLongue, isDateISOValide } from '#shared/utils/dates'
import { reponsesAssistantSchema, type ContactFormulaire } from '#shared/validation/contact'
import type { ChampAffiche, TypeMessageDto } from '#shared/types/admin'

export interface DetailsTraduits {
  readonly formulaire: ContactFormulaire | null
  readonly champs: readonly ChampAffiche[]
}

const FORMULAIRES_CONNUS: readonly ContactFormulaire[] = [
  'holding',
  'entretien',
  'transport',
  'comptable',
  'placement',
  'ccdpaa',
  'boissons',
  'suggestion',
  'assistant',
]

const LIBELLE_PALIER = 'Palier recommandé'
const PALIER_LABELS: Record<PalierRecommandation, string> = { petit: 'Petit', moyen: 'Moyen', grand: 'Grand' }

const AUCUN_DETAIL: DetailsTraduits = { formulaire: null, champs: [] }

function estObjet(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function estFormulaireConnu(value: unknown): value is ContactFormulaire {
  return typeof value === 'string' && (FORMULAIRES_CONNUS as readonly string[]).includes(value)
}

function estFormulaireFilialeConnu(value: ContactFormulaire): value is FormulaireFilialeSlug {
  return Object.hasOwn(CONTACT_FORMS, value)
}

/** Formulaire d'origine : `details.formulaire` s'il est connu, sinon déduit du type (sinon null). */
function formulaireDe(details: Record<string, unknown> | null, type: TypeMessageDto): ContactFormulaire | null {
  if (details && estFormulaireConnu(details.formulaire)) return details.formulaire
  if (type === 'SUGGESTION_PRODUIT') return 'suggestion'
  if (type === 'ASSISTANT_IMPORT_EXPORT') return 'assistant'
  return null
}

function champsFiliale(slug: FormulaireFilialeSlug, details: Record<string, unknown>): ChampAffiche[] {
  const champs: ChampAffiche[] = []
  for (const champ of CONTACT_FORMS[slug].champs.filter(estChampDetail)) {
    const brut = details[champ.cle]
    if (brut === undefined || brut === null || brut === '') continue
    if (typeof brut !== 'string' && typeof brut !== 'number') continue

    let valeur: string
    if (champ.type === 'select') {
      // Option retirée de la config depuis l'envoi : on affiche la valeur brute plutôt que rien.
      valeur = champ.options.find((option) => option.value === brut)?.label ?? String(brut)
    } else if (champ.type === 'date-future') {
      valeur = typeof brut === 'string' && isDateISOValide(brut) ? formatDateLongue(brut) : String(brut)
    } else {
      valeur = String(brut)
    }
    champs.push({ libelle: champ.label, valeur })
  }
  return champs
}

function champsAssistant(details: Record<string, unknown>): ChampAffiche[] {
  const parse = reponsesAssistantSchema.safeParse(
    Object.fromEntries(ETAPES_ASSISTANT.map((etape) => [etape.cle, details[etape.cle]])),
  )
  if (!parse.success) return []
  const champs: ChampAffiche[] = recapReponses(parse.data).map(({ libelle, valeur }) => ({ libelle, valeur }))
  // Le palier stocké n'est jamais repris tel quel : recalculé depuis le volume validé.
  champs.push({ libelle: LIBELLE_PALIER, valeur: PALIER_LABELS[palierRecommandation(parse.data.volume)] })
  return champs
}

/** `details` (inconnu) + type du message → formulaire d'origine et champs affichables. */
export function champsDetails(details: unknown, type: TypeMessageDto): DetailsTraduits {
  if (!estObjet(details)) {
    const formulaire = formulaireDe(null, type)
    return formulaire === null ? AUCUN_DETAIL : { formulaire, champs: [] }
  }
  const formulaire = formulaireDe(details, type)
  if (formulaire === 'assistant') return { formulaire, champs: champsAssistant(details) }
  if (formulaire !== null && estFormulaireFilialeConnu(formulaire)) {
    return { formulaire, champs: champsFiliale(formulaire, details) }
  }
  return { formulaire, champs: [] }
}

const LIBELLE_PRODUIT_SOUHAITE = 'Produit souhaité'
const LIBELLE_PAYS_ORIGINE = "Pays d'origine"

/** Colonnes dédiées d'une suggestion de produit (hors `details`) → champs affichables, si non vides. */
export function champsSuggestion(
  type: TypeMessageDto,
  produitSouhaite: string | null,
  paysOrigine: string | null,
): ChampAffiche[] {
  if (type !== 'SUGGESTION_PRODUIT') return []
  const champs: ChampAffiche[] = []
  const produit = produitSouhaite?.trim()
  const pays = paysOrigine?.trim()
  if (produit) champs.push({ libelle: LIBELLE_PRODUIT_SOUHAITE, valeur: produit })
  if (pays) champs.push({ libelle: LIBELLE_PAYS_ORIGINE, valeur: pays })
  return champs
}
