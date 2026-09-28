// Questionnaire SCRIPTÉ (DEC-14, PROJECT_CONTEXT §7) : aucune IA, aucun appel LLM. Structure en
// code (couplée au zod, shared/validation/contact.ts) ; intro et recommandations éditables
// (section SERVICES:assistant, voir shared/content/sections/catalog.ts). Imports relatifs
// uniquement (seed/tsx).
export const ASSISTANT_SITE = 'ccdpaa' as const

interface OptionAssistant {
  readonly value: string
  readonly label: string
}

interface EtapeAssistant {
  readonly cle: string
  readonly libelleCourt: string
  readonly question: string
  readonly aide: string
  readonly options: readonly [OptionAssistant, ...OptionAssistant[]]
}

const o = <V extends string>(value: V, label: string) => ({ value, label }) as const

export const ETAPES_ASSISTANT = [
  {
    cle: 'profil',
    libelleCourt: 'Profil',
    question: 'Quel est votre profil ?',
    aide: 'Nous adaptons les volumes minimums et les conditions de livraison à votre activité.',
    options: [
      o('epicerie', 'Épicerie spécialisée'),
      o('restaurant', 'Restaurant'),
      o('grossiste', 'Grossiste / distributeur'),
      o('exportateur', 'Exportateur en Afrique'),
    ],
  },
  {
    cle: 'categorie',
    libelleCourt: 'Catégorie',
    question: 'Quelle catégorie vous intéresse ?',
    aide: 'Nos filières couvrent les produits frais, secs et transformés.',
    options: [
      o('tubercules', 'Tubercules et féculents'),
      o('epices', 'Épices et condiments'),
      o('fruits-legumes', 'Fruits et légumes'),
      o('transformes', 'Produits transformés'),
    ],
  },
  {
    cle: 'volume',
    libelleCourt: 'Volume mensuel',
    question: 'Quel volume envisagez-vous par mois ?',
    aide: 'Cela détermine le mode d’expédition : groupage, palette ou conteneur.',
    options: [
      o('moins-200kg', 'Moins de 200 kg'),
      o('200-1000kg', '200 à 1 000 kg'),
      o('1-5t', '1 à 5 tonnes'),
      o('plus-5t', 'Plus de 5 tonnes'),
    ],
  },
  {
    cle: 'delai',
    libelleCourt: 'Échéance',
    question: 'Pour quelle échéance ?',
    aide: 'Votre horizon nous permet de planifier le premier envoi.',
    options: [
      o('immediat', 'Dès que possible'),
      o('1-3-mois', 'Dans 1 à 3 mois'),
      o('plus-3-mois', 'Dans plus de 3 mois'),
      o('exploration', 'Exploration seulement'),
    ],
  },
] as const satisfies readonly EtapeAssistant[]

export type ReponsesAssistant = { readonly [E in (typeof ETAPES_ASSISTANT)[number] as E['cle']]: E['options'][number]['value'] }
export type VolumeAssistant = ReponsesAssistant['volume']

export const ETAPE_CONTACT = {
  libelleCourt: 'Coordonnées',
  question: 'Où pouvons-nous vous répondre ?',
  aide: 'Vos coordonnées nous permettent de vous transmettre la fiche logistique adaptée.',
} as const

export const NOMBRE_ETAPES = ETAPES_ASSISTANT.length + 1

export type PalierRecommandation = 'petit' | 'moyen' | 'grand'

const PALIER_PAR_VOLUME = {
  'moins-200kg': 'petit',
  '200-1000kg': 'moyen',
  '1-5t': 'grand',
  'plus-5t': 'grand',
} as const satisfies Record<VolumeAssistant, PalierRecommandation>

export const palierRecommandation = (volume: VolumeAssistant): PalierRecommandation => PALIER_PAR_VOLUME[volume]

/** Récap lisible — client (`<dl>`) et serveur (MessageContact.message). */
export function recapReponses(reponses: ReponsesAssistant): { readonly libelle: string; readonly valeur: string }[] {
  return ETAPES_ASSISTANT.map((etape) => {
    const valeur = reponses[etape.cle]
    const option = (etape.options as readonly OptionAssistant[]).find((opt) => opt.value === valeur)
    return { libelle: etape.libelleCourt, valeur: option?.label ?? valeur }
  })
}

export const ASSISTANT_FORM = {
  sujet: 'Assistant import-export',
  bouton: 'Obtenir ma recommandation',
  toastTitre: 'Votre plan d’approvisionnement est prêt',
} as const
