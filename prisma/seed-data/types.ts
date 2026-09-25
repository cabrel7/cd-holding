// Types des données GÉNÉRÉES par scripts/migrate-mockdata-to-seed.ts (spec phase 2 §3.2).
// Consommés par prisma/seed/*.ts. Import relatif uniquement (exécuté hors Nuxt par tsx) —
// ce fichier n'importe rien de `shared/` pour rester un simple contrat de données.

export type FilialeSlugPrototype = 'entretien' | 'transport' | 'comptable' | 'placement' | 'ccdpaa' | 'boissons'
export type SiteSlugPrototype = 'holding' | FilialeSlugPrototype

/** Une image source, dédoublonnée par identifiant de photo Unsplash (spec §3.2). */
export interface GeneratedImage {
  readonly id: string
  readonly file: string
  readonly sourceUrl: string
  readonly sha256: string
  readonly octets: number
}

/** Champs conservés de `companies[]` (mockdata) — `secteurPrototype` est informatif, jamais semé. */
export interface GeneratedCompany {
  readonly slug: FilialeSlugPrototype
  readonly description: string
  readonly secteurPrototype: string
  readonly heroImageId: string
  readonly effectif: number
}

export interface GeneratedService {
  readonly filiale: FilialeSlugPrototype
  readonly titre: string
  readonly description: string
  readonly ordre: number
}

export interface GeneratedRealisation {
  readonly filiale: SiteSlugPrototype
  readonly titre: string
  readonly description: string
  /** YYYY-MM-DD */
  readonly date: string
  readonly imageId: string
  readonly ordre: number
}

export interface GeneratedEquipeMembre {
  readonly filiale: SiteSlugPrototype
  readonly nom: string
  readonly poste: string
  readonly bio: string
  readonly ordre: number
}

export interface GeneratedPartenaire {
  readonly filiale: SiteSlugPrototype
  readonly nom: string
  readonly typeRelation: string
  readonly ordre: number
}

/** Sous-ensemble textuel de `SUB_CONFIG` (spec §3.2) : `fields`, `email`, `phone` exclus. */
export interface GeneratedSubConfig {
  readonly filiale: FilialeSlugPrototype
  readonly shortName: string
  readonly tagline: string
  readonly headlineLead: string
  readonly headlineAccent: string
  readonly headlineTail: string
  readonly heroPitch: string
  readonly ctaLabel: string
  readonly contactIntro: string
  readonly contactHeadline: string
  readonly contactBaseline: string
  readonly successMsg: string
}

// --- Données de démo (spec §3.4) -------------------------------------------------------

export type StatutMessagePrototype = 'nouveau' | 'en_cours' | 'traite'

export interface GeneratedMessage {
  readonly filiale: SiteSlugPrototype
  readonly nom: string
  readonly email: string
  readonly telephone?: string
  readonly sujet: string
  readonly message: string
  readonly statut: StatutMessagePrototype
  readonly date: string
}

export interface GeneratedSuggestion {
  readonly filiale: 'ccdpaa' | 'boissons'
  readonly nom: string
  readonly email: string
  readonly produit: string
  readonly origine: string
  readonly commentaire: string
  readonly date: string
}

export type StatutReservationPrototype = 'en_attente' | 'confirmee' | 'annulee'

export interface GeneratedReservation {
  readonly nom: string
  readonly email: string
  readonly telephone: string
  readonly heure: string
  readonly personnes: number
  readonly note?: string
  readonly statut: StatutReservationPrototype
  // Pas de date : prisma/seed/demo.ts recale chaque réservation sur J+7/J+9/J+15 (index dans le
  // tableau) par rapport à la date du seed — spec §3.4. La date du prototype est obsolète.
}

export type StatutEmployePrototype = 'actif' | 'en_conge' | 'inactif'

export interface GeneratedEmploye {
  readonly filiale: FilialeSlugPrototype
  readonly nom: string
  readonly poste: string
  readonly email: string
  readonly statut: StatutEmployePrototype
}

export type JourSemaine = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche'

export interface GeneratedPlanningEntry {
  readonly employeFiliale: FilialeSlugPrototype
  readonly employeNom: string
  readonly jour: JourSemaine
  readonly debut: string
  readonly fin: string
  readonly lieu: string
  readonly note?: string
}

export type StatutClientPrototype = 'prospect' | 'actif' | 'inactif'

export interface GeneratedClient {
  readonly nom: string
  readonly entreprise: string
  readonly email: string
  readonly telephone: string
  readonly filiale: SiteSlugPrototype
  readonly statut: StatutClientPrototype
  readonly notes: string
  readonly creeLe: string
}

export type ForfaitComptablePrototype = 'Mensuel' | 'Trimestriel' | 'Annuel'
export type StatutDossierPrototype = 'a_jour' | 'en_retard' | 'en_traitement'

export interface GeneratedClientComptable {
  readonly entreprise: string
  readonly contact: string
  readonly email: string
  readonly forfait: ForfaitComptablePrototype
  readonly prochaineEcheance: string
  readonly statut: StatutDossierPrototype
  readonly notes?: string
}

export type CategoriePosteLabel =
  | 'Manutention'
  | 'Chauffeur classe 1'
  | 'Chauffeur classe 3'
  | 'Chauffeur classe 5'
  | 'Entretien'
  | 'Autre'

export type StatutCandidatPrototype = 'disponible' | 'en_process' | 'place'
export type OrigineCandidatPrototype = 'local' | 'international'

export interface GeneratedCandidat {
  readonly nom: string
  readonly email: string
  readonly telephone: string
  readonly poste: string
  readonly categorie: CategoriePosteLabel
  readonly disponibilite: string
  readonly statut: StatutCandidatPrototype
  readonly origine: OrigineCandidatPrototype
}

export type StatutDemandePrototype = 'ouverte' | 'pourvue' | 'annulee'

export interface GeneratedDemandeClient {
  readonly entreprise: string
  readonly contact: string
  readonly email: string
  readonly poste: string
  readonly categorie: CategoriePosteLabel
  readonly quantite: number
  readonly debut: string
  readonly statut: StatutDemandePrototype
}

export type TypeContratPrototype = 'Temps plein' | 'Temps partiel' | 'Temporaire'

export interface GeneratedOffreEmploi {
  readonly titre: string
  readonly categorie: CategoriePosteLabel
  readonly lieu: string
  readonly typeContrat: TypeContratPrototype
  readonly salaire: string
  readonly description: string
  readonly publiee: boolean
  readonly date: string
}

export type StatutCandidaturePrototype = 'recue' | 'en_revue' | 'entrevue' | 'refusee' | 'embauchee'

export interface GeneratedCandidature {
  readonly offreTitre: string | null
  readonly nom: string
  readonly email: string
  readonly telephone: string
  readonly posteVise: string
  readonly experience: string
  readonly cvNom?: string
  readonly documents?: readonly string[]
  readonly statut: StatutCandidaturePrototype
  readonly date: string
}

export interface GeneratedDemo {
  readonly messages: readonly GeneratedMessage[]
  readonly suggestions: readonly GeneratedSuggestion[]
  readonly reservations: readonly GeneratedReservation[]
  readonly employes: readonly GeneratedEmploye[]
  readonly planningEntries: readonly GeneratedPlanningEntry[]
  readonly clients: readonly GeneratedClient[]
  readonly clientsComptables: readonly GeneratedClientComptable[]
  readonly candidats: readonly GeneratedCandidat[]
  readonly demandesClients: readonly GeneratedDemandeClient[]
  readonly offresEmploi: readonly GeneratedOffreEmploi[]
  readonly candidatures: readonly GeneratedCandidature[]
}

export interface GeneratedPrototype {
  readonly companies: readonly GeneratedCompany[]
  readonly services: readonly GeneratedService[]
  readonly realisations: readonly GeneratedRealisation[]
  readonly equipe: readonly GeneratedEquipeMembre[]
  readonly partenaires: readonly GeneratedPartenaire[]
  readonly subConfig: readonly GeneratedSubConfig[]
  readonly demo: GeneratedDemo
  readonly images: readonly GeneratedImage[]
}
