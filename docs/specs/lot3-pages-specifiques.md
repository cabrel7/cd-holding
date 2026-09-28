# Spec lot 3 : pages spécifiques (offres placement, restaurant ccdpaa, assistant import-export)

Rédigée par l'architect le 2026-09-28, en lecture seule. À enregistrer sous `docs/specs/lot3-pages-specifiques.md`.

**Sources lues**
- Règles et état : `CLAUDE.md`, `PROJECT_STATE.md`, `PROJECT_CONTEXT.md` §5, §7 et §8.
- `CONVERSION_INVENTORY.md` : placement l.1169-1294, ccdpaa l.1340-1446 et l.1505-1554, DEC-14 et DEC-16 à 27.
- Schéma : `prisma/schema.prisma` (Candidature, DemandeClient, ReservationRestaurant, ReglagesRestaurant, Fichier, MessageContact).
- Upload : `server/utils/storage.ts`, `server/lib/file-types.ts`, `shared/config/upload.ts`, `server/api/files/[key].get.ts`, `server/api/admin/files/index.post.ts`.
- Contact et envoi : `server/api/public/**`, `server/services/public/sites.ts`, `server/lib/contact.ts`, `server/api/public/contact.post.ts`, `server/utils/{rate-limit,isr,mailer}.ts`, `server/lib/mail/templates/accuse-reception.ts`.
- Validation et contenu : `shared/validation/contact.ts`, `shared/utils/dates.ts`, `shared/content/sections/{catalog,types}.ts`, `prisma/seed-data/sections.ts` l.495-665, `prisma/seed/reglages.ts`.
- Front : `app/components/site/contact/*`, `app/composables/usePublicForm{Submit,Feedback}.ts`, `useCurrentSiteSlug.ts`, `[filiale]/services.vue`, `nuxt.config.ts`.
- Prototype : `placement.offres.tsx`, `ccdpaa.restaurant.tsx`, `ImportExportAssistant.tsx` et les 3 captures 1440.

## Écarts par rapport au brief
1. **Postuler se fait sur une page, pas dans un modal.**
   - La page `/placement/offres/[uuid]` montre le détail de l'offre et le formulaire (DEC-20 déjà tranché).
   - Pas de sous-route `/postuler` : elle ajouterait un clic sans rien apporter.
   - Raisons : le formulaire complet dépasse largement 85vh à 375 px, le lien est partageable, et la page porte le JSON-LD `JobPosting`.
2. **La candidature spontanée a sa propre route** : `/placement/offres/candidature-spontanee`. Le formulaire est trop long pour être ajouté sous la liste, et la règle est « routes réelles, jamais d'ancre ». La liste se termine par un bloc CTA qui y mène.
3. **Pas de `GET créneaux`.**
   - Il n'y a aucune donnée de capacité de salle, donc les créneaux dépendent seulement des réglages.
   - Une fonction pure partagée, `creneauxPourDate(reglages, date, maintenant)`, sert au client comme au serveur.
   - Il suffit d'un seul `GET /api/public/restaurant` (les réglages). On évite un aller-retour par date et un « maintenant » figé par l'ISR.
4. **Les horaires ont une seule source : `ReglagesRestaurant`.** Le seed les recopie aussi dans `RESTAURANT:hero.legende`, ce qui ferait deux sources qui divergent dès la première édition. Cette légende sort du seed.
5. **Assistant : une nouvelle variante `formulaire: 'assistant'` de `POST /api/public/contact`.** Pas de route dédiée : on réutilise le pipeline du lot 2 (gardes, honeypot, courriels, `satisfies` du registre).

## 0. CHALLENGE
- **Upload public sans authentification : c'est le premier risque.**
  - Menaces :
    - `readMultipartFormData` charge tout le corps en RAM ;
    - des bots peuvent remplir le disque ;
    - fichiers polyglottes PDF/HTML.
  - Parades : 411/413 avant lecture, 3 requêtes/h/IP (DEC-22), honeypot vérifié **avant** toute écriture, contrôle des magic bytes, fichiers `PRIVE`, validation de tous les fichiers avant d'en écrire un seul, retour arrière en cas d'échec.
  - **Bug existant** : `/api/files/[key]` sert les fichiers `PRIVE` en `inline`. Un PDF piégé s'ouvrirait donc sur notre origine, dans la session d'un admin. Il faut passer ces fichiers en `attachment`.
  - Aucun antivirus n'est prévu : point ouvert.
- **Loi 25 et CV.**
  - `consentementLe` existe, mais **aucune durée de conservation ni purge** n'est prévue. C'est bloquant pour la production (point ouvert n°1).
  - Le CV n'est jamais joint ni lié dans un courriel.
  - Le nom de fichier d'origine est nettoyé (sans chemin ni caractère de contrôle) et n'apparaît jamais dans un log.
- **« Double réservation » : ce n'est pas le vrai problème.**
  - Le champ `capaciteMaxReservation` est un plafond **par réservation** (Q-08), pas une capacité de salle ; son nom est trompeur.
  - Toute réservation arrive `EN_ATTENTE` et se confirme à la main (lot 5).
  - Le vrai risque est le doublon par double clic ou nouvel envoi : on le rend idempotent (même courriel et même instant, statut non annulé → 201 sans écriture).
- **Fuseau horaire.**
  - L'heure locale du Québec est convertie en UTC par `Intl`, avec `FUSEAU_QUEBEC` = `America/Toronto`. DEC-27 cite `America/Montreal`, qui est un alias de la même zone.
  - « Maintenant + délai minimum » est calculé côté client **après `onMounted`**, à cause de l'ISR. Le serveur fait foi.
- **Rien ne pourra être édité avant les lots 4-5.**
  - Aucun écran de publication d'offre (`DemandeClient.publiee`) : en production, la liste sera vide (seules les offres de démo du seed existent).
  - Aucun écran pour `ReglagesRestaurant`, qui ne sera « éditable » qu'en principe.
  - La confirmation d'une réservation par l'admin n'envoie aucun courriel : l'accusé de réception dit donc « demande reçue », pas « table confirmée ».
- **Défauts du prototype à ne pas reproduire.**
  - Nom du client exposé comme lieu de l'offre (l'objet public ne contient jamais `entrepriseCliente`).
  - Titre « 0 mandats à pourvoir ».
  - Heure en `type=time` libre et nombre de personnes en texte libre (« abc » devient 1).
  - `email: ""` et contact en texte libre dans l'assistant.
  - Récapitulatif de l'assistant affiché avec les clés brutes.
  - Carte de réservation `#BA7517` + texte blanc : contraste 3,6, donc sous l'AA.
  - Promesse « confirmée par courriel dans l'heure ».
- **Le seed de l'assistant s'écarte du prototype validé par le client.**
  - Titre « Quel volume… » au lieu de « Cinq questions… ».
  - Recommandations réécrites.
  - On réaligne le seed. Le texte d'aide « six à huit semaines » est une promesse commerciale non validée : il est neutralisé dans le code.
- **ISR de 3600 s sur `/placement/**`** : une offre retirée resterait ouverte aux candidatures pendant une heure. On passe les offres à 60 s, et le `POST` revérifie que l'offre est publiée et ouverte.

## 1. Pages : source de chaque section, ce qui est éditable

| Page / section | Source | Éditable aujourd'hui | Sans écran admin (lots 4-5) |
|---|---|---|---|
| `/placement/offres` : en-tête (surtitre, H1, texte), SEO | `OFFRES:entete`, `OFFRES:seo` | oui (`/admin/contenu`, sections) | — |
| Compteur « N postes ouverts » | calculé (libellé d'interface) | n/a | — |
| Liste des offres | `DemandeClient` publiée, OUVERTE, champs d'offre non nuls | — | publication (lot 5) |
| CTA « candidature spontanée » | `OFFRES:cta` (**nouveau**, type `cta`) | oui | — |
| `/placement/offres/[uuid]` : détail | `DemandeClient` (champs d'offre) | — | lot 5 |
| Bloc du formulaire (surtitre, titre, texte, message de succès) | `OFFRES:candidature` (**nouveau**, `formulaire`) | oui | — |
| Champs, postes, expériences | `shared/config/candidature.ts` (structure) | exception « structure de formulaire » | — |
| `/placement/offres/candidature-spontanee` | `OFFRES:spontanee` (**nouveau**, `formulaire`) | oui | — |
| `/ccdpaa/restaurant` : hero, image, SEO | `RESTAURANT:hero`, `RESTAURANT:seo` | oui | — |
| Blocs « Ouverture » et « Adresse » | `ReglagesRestaurant` (`joursOuverture`, heures, `adresse ?? quartier`) | — | réglages (lot 5) |
| Menu | `RESTAURANT:menu` (galerie) | oui | — |
| Carte de réservation (textes) | `RESTAURANT:reservation` | oui | — |
| Créneaux, plafond de personnes, horizon | `ReglagesRestaurant` | — | lot 5 |
| Assistant : surtitre, titre, 3 recommandations, mention finale | `SERVICES:assistant` (existe) | oui | — |
| Assistant : questions, options, aides | `shared/content/ccdpaa/assistant-import-export.ts` | exception « structure » (PROJECT_CONTEXT §7) | — |

## 2. Schéma
**Aucune migration.** Tous les champs nécessaires existent déjà :
- `Candidature` : `adresseComplete`, `posteAutrePrecision`, `experience`, `pays`, `consentementLe`, `autresDocumentsKeys` ;
- `DemandeClient` : champs d'offre et `statut` ;
- `ReservationRestaurant` : `updatedAt` ;
- `TypeMessage.ASSISTANT_IMPORT_EXPORT`.

Écartés pour ce lot (chacun demanderait une migration, donc l'accord de l'utilisateur) :
- `Candidature.conserverJusquA` et une purge planifiée → lot 5 (point ouvert n°1) ;
- renommage de `capaciteMaxReservation` → cosmétique.

Le catalogue gagne 3 entrées (des lignes `SectionContenu`, sans DDL).

## 3. API

| Méthode et chemin | Entrée | Succès | Erreurs |
|---|---|---|---|
| `GET /api/public/placement/offres` | — | 200 `PublicOffreDto[]` : `placement`, `publiee`, `statut=OUVERTE`, `titreOffre/lieu/typeContrat/descriptionPublique/publieeLe` non nuls, tri `publieeLe desc`, `take 50`, `select` explicite | 500 |
| `GET /api/public/placement/offres/[uuid]` | param `z.string().uuid()` | 200 `PublicOffreDto` | 400 (uuid malformé), 404 (introuvable, retirée ou incomplète) |
| `POST /api/public/placement/candidatures` | multipart (voir ci-dessous) | 201 `{ ok: true }` | 400, 404, 411, 413, 415, 429 |
| `GET /api/public/restaurant` | — | 200 `PublicRestaurantDto` (réglages de ccdpaa) | 404 si absents ou `!reglagesValides` (`consola.warn`, sans PII) |
| `POST /api/public/restaurant/reservations` | JSON `reservationBaseSchema` | 201 `{ ok: true }` | 400, 411, 413 (4 Ko), 415, 429, 503 (réglages invalides) |
| `POST /api/public/contact` `formulaire:'assistant'` | JSON `assistantBodySchema` | 201 | pipeline du lot 2 inchangé (5 requêtes / 10 min, partagé avec contact) |

**Candidature : pipeline dans cet ordre**
1. `assertRateLimit({ scope: 'candidature', max: 3, windowMs: 3600000 })`.
2. 415 si ce n'est pas du `multipart/form-data`.
3. 411 sans Content-Length ; 413 au-delà de `CANDIDATURE_LIMITS.totalMaxBytes + MULTIPART_OVERHEAD_BYTES`.
4. `readMultipartFormData`. 400 si le corps est nul, s'il y a plus de `partsMax` parties, si un champ texte est dupliqué, ou si un fichier arrive sous un autre nom que `cv` ou `documents`.
5. `candidatureChampsSchema.safeParse` sur les champs texte. En cas d'échec : 400 `'Validation Error'`, avec pour `data` seulement les chemins et les messages, jamais la saisie.
6. Honeypot rempli : `consola.info('[candidature] honeypot')`, 201, rien n'est écrit.
7. `validerFichiersCandidature` (pure), sur **tous** les fichiers avant toute écriture :
   - exactement 1 `cv`, sinon 400 ;
   - au plus 5 `documents`, sinon 400 ;
   - fichier vide → 400 ; plus de 5 Mo par fichier ou plus de 10 Mo au total → 413 ;
   - type détecté par `sniffMime` : `cv` doit être un PDF, `documents` PDF, JPEG ou PNG, sinon 415.
8. Résolution de `placement` et de la holding (repli pour le courriel).
   - Si `demandeUuid` est fourni : `demandeClient.findFirst({ uuid, companyId, publiee: true, statut: 'OUVERTE' })`, sinon 404 « Offre introuvable ou retirée ».
9. `saveUploadedFiles(lot, { companyId: placement.id, visibilite: 'PRIVE' })`.
10. `candidature.create({ data: construireCandidature(...), select: { uuid: true } })`. En cas d'échec : `supprimerFichiers(keys)`, puis on relance l'erreur (500 générique).
11. Courriels via `queueMail`, sans pièce jointe ni lien vers le CV :
    - notification interne (`typeLibelle 'Candidature'`, `origine` = `offre « titre »` ou `'candidature spontanée'`) ;
    - accusé de réception avec `objet: 'candidature'`, limité par destinataire (`cleAccuseReception`).
12. 201.

`construireCandidature` (pure) :
- `nomComplet` ← `nom` ;
- avec une offre : `posteRecherche = demande.titreOffre`, `categorie = demande.categorie`, `posteAutrePrecision = null` ;
- sans offre : `posteRecherche` = la clé choisie, `categorie` = `POSTES_CANDIDAT[x].categorie`, précision seulement si le poste vaut `autre` ;
- `message ?? null`, `consentementLe = now`, `cvKey`, `autresDocumentsKeys`.

**Réservation**
1. Rate-limit `reservation`, 5 requêtes / 10 min.
2. 415 hors JSON, 411, 413 au-delà de 4 Ko.
3. `readValidatedBody(reservationBaseSchema.parse)`.
4. Honeypot → 201.
5. Réglages de ccdpaa : absents ou invalides → 503 « Réservations en ligne indisponibles ».
6. `reservationSchema(reglages).safeParse` → 400.
7. `dateReservation = instantQuebec(date, heure)`.
8. Doublon : `findFirst({ companyId, email, dateReservation, statut: { not: 'ANNULEE' } })`. S'il existe : 201 sans écriture ni courriel.
9. `create`, `select: { uuid: true }`.
10. Courriels :
    - notification interne `'Réservation'` ;
    - accusé avec `objet: 'demande de réservation'` et `recapitulatif`, **généré par le serveur** (« 4 personnes, mardi 14 octobre 2026 à 19h30 »).

**Assistant** : handler `assistant` dans `REGISTRE` (`server/lib/contact.ts`).
- `cible: () => ASSISTANT_SITE` ;
- `type: 'ASSISTANT_IMPORT_EXPORT'`, `sujet: ASSISTANT_FORM.sujet` ;
- `telephone` et `entreprise` valent `?? null` ;
- `message` = les lignes `recapReponses(...)` au format `Libellé : valeur` ;
- `details = { ...reponses, palier: palierRecommandation(volume), formulaire: 'assistant' }` ;
- `typeLibelle 'Assistant import-export'`.

**Aussi dans T1**
- `saveUploadedFile` : nettoyage du nom d'origine (garder le nom de base seulement, retirer les caractères de contrôle, NFC, 255 caractères au maximum).
- `/api/files/[key]` : `Content-Disposition: attachment` si le fichier est `PRIVE`.
- `accuseReceptionTemplate({ …, objet?, recapitulatif? })` : le sujet vaut « message » par défaut, le récapitulatif est échappé.
- Seed, en amorçage seulement :
  - `OFFRES` :
    - `entete` = texte du prototype, surtitre « Postes ouverts », titre « Des mandats à pourvoir\n*en ce moment.* » ;
    - `cta`, `candidature`, `spontanee` ;
  - `RESTAURANT:hero` sans `legende` ;
  - `SERVICES:assistant` réaligné sur le prototype :
    - titre « Cinq questions pour bâtir votre plan d'approvisionnement. » ;
    - recommandations : petit = commande test depuis le stock de Montréal (72 h), moyen = groupage palettisé mensuel, grand = conteneur 20 pieds Douala/Dakar ;
    - `mentionDelai` = « …nous revenons vers vous sous 48 heures ouvrables ».

## 4. Frontend

| Fichier | Rôle |
|---|---|
| `app/pages/placement/offres/index.vue` | Route statique : `/placement` reste servi par `[filiale]/index.vue`, et `useCurrentSiteSlug` lit le chemin. Contenu : sections `OFFRES`, `useFetch` des offres, `EtatCollection`, liste `divide-y` d'`OffreLigne`, `SectionCta` (`OFFRES:cta`) vers la page spontanée. |
| `app/pages/placement/offres/[uuid].vue` | `validate` uuid. Offre : 404 si absente (`createError`, `fatal`). En-tête : titre, lieu, contrat, salaire, description. `CandidatureForm :offre`. SEO = `${titre} — ${nomCourt}`. JSON-LD `JobPosting` via `useHead`, sérialisé avec `<` → `<` : `hiringOrganization` = Placement CD Pro (jamais le client), `employmentType` par `TYPE_CONTRAT_SCHEMA_ORG`, `addressLocality` = `lieu`, sans `baseSalary`. |
| `app/pages/placement/offres/candidature-spontanee.vue` | Section `OFFRES:spontanee` + `CandidatureForm` sans offre. |
| `app/components/site/placement/OffreLigne.vue` | `article` : h2, description, métadonnées (icônes fonctionnelles MapPin/Clock/Banknote, salaire masqué s'il est null), `NuxtLink` « Postuler » (et non un bouton). |
| `app/components/site/placement/CandidatureForm.vue` | Détail sous le tableau. |
| `app/components/site/placement/ChampFichier.vue` | `input type=file`, `accept`, liste des noms choisis avec bouton « Retirer » (≥ 44 px), erreurs `FormMessage`. Le nom n'est affiché qu'au client. |
| `usePublicFormSubmit.ts` (modifié) | Corps `Record \| FormData`. Nouvelles raisons : `'introuvable'` (404) et `'fichier'` (413/415). |
| `usePublicFormFeedback.ts` (modifié) | Toasts « Cette offre n'est plus disponible. » et « Fichier refusé : PDF (CV), PDF/JPEG/PNG, 10 Mo au total. » |
| `app/pages/ccdpaa/restaurant.vue` | Sections `RESTAURANT` + `useFetch('/api/public/restaurant')`. Hero sur 7/5 colonnes ; blocs Ouverture/Adresse via `libelleJoursOuverture`/`libelleHeure`. Menu : galerie avec cartes paires décalées et `SiteImage` en repli. `ReservationForm` seulement si les réglages sont présents, sinon une ligne « Réservez par téléphone ou via la page contact ». |
| `app/components/site/restaurant/ReservationForm.vue` | Détail sous le tableau. |
| `app/components/site/services/AssistantImportExport.vue` | Détail sous le tableau. |
| `app/pages/[filiale]/services.vue` (modifié) | `<AssistantImportExport v-if="sections.assistant">` **avant** `SectionCta`. Condition portée par le catalogue, sans `if (slug)`. |

Détail de `CandidatureForm.vue` :
- props `{ offre: PublicOffreDto | null; section: FormulaireData | undefined; vars; mention; emailSecours }` ;
- `candidatureFormSchema({ avecOffre })` ;
- réutilise `ChampContact` pour `nom`, `email`, `telephone` et `message` (d'où ces noms de champs) ;
- champs propres : adresse, pays, `<select>` natif poste (sans offre) + précision affichée si « autre », expérience, 2 `ChampFichier`, case de consentement avec lien `/confidentialite`, honeypot, `MentionConfidentialite` ;
- `FormData` : on n'ajoute que les champs non vides, `consentement='true'`, `demandeUuid` seulement avec une offre ;
- focus sur le premier champ en erreur ; machine d'états du lot 2.

Détail de `ReservationForm.vue` :
- `reservationSchema(reglages)` ;
- `ChampContact` pour nom, téléphone et courriel ;
- date native, `min`/`max` posés après `onMounted` ;
- `<select>` d'heures = `creneauxPourDate(reglages, date, new Date())`, recalculé quand la date change (l'heure est réinitialisée si elle n'est plus proposée) ; état vide « Aucun créneau ce jour-là » ;
- `<select>` de 1 à `capaciteMaxReservation`, avec l'aide « Plus de N personnes ? Écrivez-nous » (lien vers `/ccdpaa/contact`) ;
- notes facultatives ;
- carte `bg-site-accent-strong`, champs sur fond blanc (AA) ;
- toast = `messageSucces` de la section, sans reprendre le nom.

Détail de `AssistantImportExport.vue` :
- props `{ section: AssistantData; vars; mention; emailSecours }` ;
- état local en `ref`, pas de Pinia (état propre au composant) ;
- étapes 1 à 4 : `fieldset` + `legend` = question, `radio` natifs stylés en pastilles ; « Continuer » désactivé tant qu'aucune réponse n'est choisie ; « Retour » ;
- barre de 5 segments (`aria-hidden`), « Étape n sur 5 » en `aria-live`, focus sur la question à chaque changement d'étape ;
- étape 5 : VeeValidate `assistantFormSchema` via `ChampContact` (nom, entreprise facultative, courriel, téléphone facultatif), honeypot, mention ;
- en cas de 201 :
  - `section.recommandations[palier]` ;
  - `<dl>` de `recapReponses` ;
  - `section.mentionDelai` ;
  - « Recommencer » ;
- en cas d'échec : toast, on reste à l'étape 5 avec les valeurs.

**Écarts assumés par rapport au prototype**
- Postuler sur une page, pas un modal.
- H1 éditable + compteur (pas de « 0 mandats »).
- Page spontanée.
- Formulaire enrichi : adresse, pays, poste + « Autre », expérience en liste, consentement ; CV en PDF seulement.
- Horaires lus dans les réglages.
- Heure et nombre de personnes en listes.
- Carte de réservation en accent-strong (AA).
- Assistant placé avant le CTA : le CTA « un besoin qui ne rentre pas dans une case » sert de repli après l'assistant, et on évite deux cartes navy collées.
- Récapitulatif avec les libellés.
- Aucun style inline ni promesse « dans l'heure ».

## 5. Tâches (périmètres disjoints)

### T0 : thread principal, avant T1 et T2 (M)
Fichiers :
- `shared/config/candidature.ts` (nouveau) ;
- `shared/validation/candidature.ts` (nouveau) ;
- `shared/utils/restaurant.ts` (nouveau) ;
- `shared/validation/reservation.ts` (nouveau) ;
- `shared/content/ccdpaa/assistant-import-export.ts` (nouveau) ;
- `shared/utils/dates.ts` ;
- `shared/validation/contact.ts` (export `CONTROLE_PATTERN`, variante assistant) ;
- `shared/content/sections/catalog.ts` ;
- `shared/types/public.ts` ;
- `nuxt.config.ts` ;
- tests unitaires.

Le typecheck ne repasse au vert qu'après T1 : le `satisfies` de `REGISTRE` exige le handler `assistant`.

```ts
// shared/config/candidature.ts — imports relatifs uniquement (seed/tsx)
import { MAX_UPLOAD_BYTES } from './upload'
export const PLACEMENT_SLUG = 'placement' as const
const MO = 1024 * 1024
export const CANDIDATURE_LIMITS = { adresseMin: 5, adresseMax: 300, paysMax: 80, precisionMax: 120, messageMax: 2000,
  documentsMax: 5, cvMaxBytes: 5 * MO, documentMaxBytes: 5 * MO, totalMaxBytes: MAX_UPLOAD_BYTES, partsMax: 20 } as const
export const CV_MIMES = ['application/pdf'] as const                               // DEC-21 / Q-09
export const DOCUMENT_MIMES = ['application/pdf', 'image/jpeg', 'image/png'] as const
export const CV_ACCEPT = '.pdf,application/pdf'
export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
export const EXTENSIONS_PAR_MIME: Readonly<Record<string, readonly string[]>> = {
  'application/pdf': ['pdf'], 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'] }
export const CHAMPS_FICHIER = { cv: 'cv', documents: 'documents' } as const
/** Miroir local de l'enum Prisma CategoriePoste (shared/ ne dépend pas du client généré). */
export type CategoriePosteKey = 'MANUTENTION' | 'CHAUFFEUR_CLASSE_1' | 'CHAUFFEUR_CLASSE_3' | 'CHAUFFEUR_CLASSE_5' | 'ENTRETIEN' | 'AUTRE'
export const POSTES_CANDIDAT = [
  { value: 'manutention', label: 'Manutention / entrepôt', categorie: 'MANUTENTION' },
  { value: 'chauffeur-classe-1', label: 'Chauffeur classe 1', categorie: 'CHAUFFEUR_CLASSE_1' },
  { value: 'chauffeur-classe-3', label: 'Chauffeur classe 3', categorie: 'CHAUFFEUR_CLASSE_3' },
  { value: 'chauffeur-classe-5', label: 'Chauffeur classe 5', categorie: 'CHAUFFEUR_CLASSE_5' },
  { value: 'entretien', label: 'Entretien ménager', categorie: 'ENTRETIEN' },
  { value: 'autre', label: 'Autre', categorie: 'AUTRE' },
] as const satisfies readonly { value: string; label: string; categorie: CategoriePosteKey }[]
export type PosteCandidatKey = (typeof POSTES_CANDIDAT)[number]['value']
export const POSTE_AUTRE = 'autre' as const satisfies PosteCandidatKey
export const NIVEAUX_EXPERIENCE = [
  { value: 'MOINS_1_AN', label: 'Moins de 1 an' }, { value: 'UN_A_TROIS_ANS', label: '1 à 3 ans' },
  { value: 'TROIS_A_CINQ_ANS', label: '3 à 5 ans' }, { value: 'PLUS_5_ANS', label: 'Plus de 5 ans' },
] as const
export type NiveauExperienceKey = (typeof NIVEAUX_EXPERIENCE)[number]['value']
export const TYPES_CONTRAT = { TEMPS_PLEIN: 'Temps plein', TEMPS_PARTIEL: 'Temps partiel', TEMPORAIRE: 'Temporaire' } as const
export type TypeContratKey = keyof typeof TYPES_CONTRAT
export const TYPE_CONTRAT_SCHEMA_ORG = { TEMPS_PLEIN: 'FULL_TIME', TEMPS_PARTIEL: 'PART_TIME', TEMPORAIRE: 'TEMPORARY' } as const satisfies Record<TypeContratKey, string>
export const CANDIDATURE_FORM = { bouton: 'Envoyer ma candidature', toastTitre: 'Candidature envoyée' } as const
export const OFFRES_PATH = '/placement/offres'
export const CANDIDATURE_SPONTANEE_PATH = `${OFFRES_PATH}/candidature-spontanee`
export const offrePath = (uuid: string): string => `${OFFRES_PATH}/${uuid}`
```

```ts
// shared/validation/candidature.ts
import { z } from 'zod'
import { CANDIDATURE_LIMITS, CV_MIMES, DOCUMENT_MIMES, EXTENSIONS_PAR_MIME, NIVEAUX_EXPERIENCE, POSTES_CANDIDAT, POSTE_AUTRE,
  type NiveauExperienceKey, type PosteCandidatKey } from '../config/candidature'
import { CONTROLE_PATTERN, emailContactSchema, honeypotSchema, nomContactSchema, telephoneContactSchema, texteCourtSchema } from './contact'

const CHAMP_REQUIS = 'Ce champ est requis.'
const CONSENTEMENT_REQUIS = 'Votre consentement est requis pour traiter votre candidature.'
// Seuls casts : z.enum exige un tuple ; valeurs issues de constantes `as const` (couvertes par tests).
const POSTES = POSTES_CANDIDAT.map((p) => p.value) as unknown as [PosteCandidatKey, ...PosteCandidatKey[]]
const EXPERIENCES = NIVEAUX_EXPERIENCE.map((n) => n.value) as unknown as [NiveauExperienceKey, ...NiveauExperienceKey[]]
const sansControle = (s: string) => !CONTROLE_PATTERN.test(s)
/** '' (champ vidé / multipart) → undefined. */
export const videEnUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

export const adresseCompleteSchema = z.string({ required_error: CHAMP_REQUIS }).trim()
  .min(CANDIDATURE_LIMITS.adresseMin, 'Indiquez votre adresse complète.')
  .max(CANDIDATURE_LIMITS.adresseMax, `${CANDIDATURE_LIMITS.adresseMax} caractères au maximum.`)
  .refine(sansControle, 'Caractères non autorisés.')

const champsCommuns = {
  nom: nomContactSchema, email: emailContactSchema, telephone: telephoneContactSchema,
  adresseComplete: adresseCompleteSchema,
  pays: texteCourtSchema(CANDIDATURE_LIMITS.paysMax),
  posteRecherche: z.preprocess(videEnUndefined, z.enum(POSTES, { errorMap: () => ({ message: 'Sélectionnez un poste.' }) }).optional()),
  posteAutrePrecision: z.preprocess(videEnUndefined, texteCourtSchema(CANDIDATURE_LIMITS.precisionMax).optional()),
  experience: z.enum(EXPERIENCES, { errorMap: () => ({ message: 'Sélectionnez votre expérience.' }) }),
  message: z.preprocess(videEnUndefined, z.string().trim()
    .max(CANDIDATURE_LIMITS.messageMax, `${CANDIDATURE_LIMITS.messageMax} caractères au maximum.`)
    .refine(sansControle, 'Caractères non autorisés.').optional()),
  website: honeypotSchema,
}

interface ChampsPoste { readonly posteRecherche?: PosteCandidatKey; readonly posteAutrePrecision?: string }
/** Poste requis sans offre ; précision requise ssi « Autre » (DEC-19). Avec offre : dérivé serveur. */
function reglesPoste(v: ChampsPoste, ctx: z.RefinementCtx, posteRequis: boolean): void {
  if (!posteRequis) return
  if (!v.posteRecherche) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['posteRecherche'], message: 'Sélectionnez un poste.' })
  else if (v.posteRecherche === POSTE_AUTRE && !v.posteAutrePrecision)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['posteAutrePrecision'], message: 'Précisez le poste recherché.' })
}

/** Champs texte du multipart (serveur). Les fichiers sont validés sur leurs octets (server/lib/candidature.ts). */
export const candidatureChampsSchema = z.object({
  ...champsCommuns,
  demandeUuid: z.string().uuid().optional(),
  consentement: z.literal('true', { errorMap: () => ({ message: CONSENTEMENT_REQUIS }) }),
}).strict().superRefine((v, ctx) => reglesPoste(v, ctx, v.demandeUuid === undefined))

// --- Client : ajoute les File (contrôle ergonomique ; le serveur refait tout sur les octets réels) ---
const MO = 1024 * 1024
const estFichier = (v: unknown): v is File => typeof File !== 'undefined' && v instanceof File
const taille = (v: unknown): number => (estFichier(v) ? v.size : 0)
function typeAccepte(f: File, mimes: readonly string[]): boolean {
  if (mimes.includes(f.type)) return true
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  return f.type === '' && mimes.some((m) => EXTENSIONS_PAR_MIME[m]?.includes(ext) ?? false)
}
function fichierSchema(mimes: readonly string[], maxBytes: number, erreurType: string) {
  return z.custom<File>(estFichier, { message: 'Joignez un fichier.' })
    .refine((f) => taille(f) > 0, 'Ce fichier est vide.')
    .refine((f) => taille(f) <= maxBytes, `${maxBytes / MO} Mo au maximum par fichier.`)
    .refine((f) => estFichier(f) && typeAccepte(f, mimes), erreurType)
}
export const cvFichierSchema = fichierSchema(CV_MIMES, CANDIDATURE_LIMITS.cvMaxBytes, 'Le CV doit être un fichier PDF.')
export const documentFichierSchema = fichierSchema(DOCUMENT_MIMES, CANDIDATURE_LIMITS.documentMaxBytes, 'Formats acceptés : PDF, JPEG ou PNG.')

export function candidatureFormSchema(options: { readonly avecOffre: boolean }) {
  return z.object({
    ...champsCommuns,
    consentement: z.literal(true, { errorMap: () => ({ message: CONSENTEMENT_REQUIS }) }),
    cv: cvFichierSchema,
    documents: z.array(documentFichierSchema).max(CANDIDATURE_LIMITS.documentsMax, `${CANDIDATURE_LIMITS.documentsMax} documents au maximum.`),
  }).strict().superRefine((v, ctx) => {
    reglesPoste(v, ctx, !options.avecOffre)
    const total = taille(v.cv) + (Array.isArray(v.documents) ? v.documents.reduce((s, f) => s + taille(f), 0) : 0)
    if (total > CANDIDATURE_LIMITS.totalMaxBytes)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['documents'], message: `Taille totale limitée à ${CANDIDATURE_LIMITS.totalMaxBytes / MO} Mo.` })
  })
}
export type CandidatureChamps = z.infer<typeof candidatureChampsSchema>
export type CandidatureFormValues = z.input<ReturnType<typeof candidatureFormSchema>>
```

```ts
// shared/utils/dates.ts — ajouts
/** 1 = lundi … 7 = dimanche (ISO 8601) pour "YYYY-MM-DD". */
export function jourIsoSemaine(dateIso: string): number {
  const jour = new Date(`${dateIso}T00:00:00Z`).getUTCDay()
  return jour === 0 ? 7 : jour
}
const PARTIES_QUEBEC = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU_QUEBEC, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
function decalageQuebecMs(instant: Date): number {
  const p = Object.fromEntries(PARTIES_QUEBEC.formatToParts(instant).map((x) => [x.type, x.value]))
  const murale = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
  return murale - (instant.getTime() - instant.getUTCMilliseconds())
}
/** Heure murale Québec ("YYYY-MM-DD", "HH:mm") → instant UTC. Deux passes : exact hors du trou DST 2h-3h
 *  (jamais atteint par des créneaux de restaurant). Aucune dépendance (Intl seulement). */
export function instantQuebec(dateIso: string, heure: string): Date {
  const naif = Date.UTC(Number(dateIso.slice(0, 4)), Number(dateIso.slice(5, 7)) - 1, Number(dateIso.slice(8, 10)),
    Number(heure.slice(0, 2)), Number(heure.slice(3, 5)))
  const premier = naif - decalageQuebecMs(new Date(naif))
  return new Date(naif - decalageQuebecMs(new Date(premier)))
}
```

```ts
// shared/utils/restaurant.ts — règles pures (DEC-27), valeurs = ReglagesRestaurant (aucun horaire en dur)
import { ajouterJoursIso, dateDuJourQuebec, instantQuebec, isDateCalendaireValide, jourIsoSemaine } from './dates'
export const RESTAURANT_SLUG = 'ccdpaa' as const
export interface ReglagesReservation {
  readonly joursOuverture: readonly number[] // ISO 1 = lundi … 7 = dimanche
  readonly heureOuverture: string; readonly heureFermeture: string; readonly dernierService: string // "HH:mm"
  readonly pasCreneauMinutes: number; readonly capaciteMaxReservation: number
  readonly delaiMinimumHeures: number; readonly horizonJours: number
}
export const HEURE_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const MS_PAR_HEURE = 3_600_000
const MINUTES_PAR_JOUR = 1440
export const minutesDepuisMinuit = (h: string): number => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))
const heureDepuisMinutes = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Garde-fou (boucle infinie, créneaux absurdes) — le zod admin (lot 5) impose les mêmes règles. */
export function reglagesValides(r: ReglagesReservation): boolean {
  return HEURE_PATTERN.test(r.heureOuverture) && HEURE_PATTERN.test(r.dernierService) && HEURE_PATTERN.test(r.heureFermeture)
    && r.pasCreneauMinutes > 0 && r.pasCreneauMinutes <= MINUTES_PAR_JOUR
    && minutesDepuisMinuit(r.heureOuverture) <= minutesDepuisMinuit(r.dernierService)
    && r.capaciteMaxReservation >= 1 && r.horizonJours >= 0 && r.delaiMinimumHeures >= 0
}
export function bornesDates(r: ReglagesReservation, maintenant: Date = new Date()): { min: string; max: string } {
  const min = dateDuJourQuebec(maintenant)
  return { min, max: ajouterJoursIso(min, r.horizonJours) }
}
export type RaisonDateInvalide = 'format' | 'passee' | 'trop-loin' | 'fermee'
export function verifierDate(r: ReglagesReservation, dateIso: string, maintenant: Date = new Date()): RaisonDateInvalide | null {
  if (!isDateCalendaireValide(dateIso)) return 'format'
  const { min, max } = bornesDates(r, maintenant)
  if (dateIso < min) return 'passee'
  if (dateIso > max) return 'trop-loin'
  return r.joursOuverture.includes(jourIsoSemaine(dateIso)) ? null : 'fermee'
}
/** Créneaux "HH:mm" réservables ; si la date est aujourd'hui, instant ≥ maintenant + délai minimum. */
export function creneauxPourDate(r: ReglagesReservation, dateIso: string, maintenant: Date = new Date()): string[] {
  if (!reglagesValides(r) || verifierDate(r, dateIso, maintenant) !== null) return []
  const seuil = maintenant.getTime() + r.delaiMinimumHeures * MS_PAR_HEURE
  const creneaux: string[] = []
  for (let m = minutesDepuisMinuit(r.heureOuverture); m <= minutesDepuisMinuit(r.dernierService); m += r.pasCreneauMinutes) {
    const heure = heureDepuisMinutes(m)
    if (instantQuebec(dateIso, heure).getTime() >= seuil) creneaux.push(heure)
  }
  return creneaux
}
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const
const majuscule = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
/** [2..7] → « Mardi — dimanche » ; [2,4,6] → « Mardi, jeudi, samedi ». */
export function libelleJoursOuverture(jours: readonly number[]): string {
  const tries = [...new Set(jours)].filter((j) => j >= 1 && j <= 7).sort((a, b) => a - b)
  if (tries.length === 0) return ''
  const noms = tries.map((j) => JOURS[j - 1] ?? '')
  const contigus = tries.every((j, i) => i === 0 || j === (tries[i - 1] ?? 0) + 1)
  return majuscule(contigus && noms.length > 2 ? `${noms[0]} — ${noms.at(-1)}` : noms.join(', '))
}
export const libelleHeure = (heure: string): string => heure.replace(':', 'h')
```

```ts
// shared/validation/reservation.ts
import { z } from 'zod'
import { CONTROLE_PATTERN, emailContactSchema, honeypotSchema, nomContactSchema, telephoneContactSchema } from './contact'
import { HEURE_PATTERN, creneauxPourDate, verifierDate, type RaisonDateInvalide, type ReglagesReservation } from '../utils/restaurant'
export const RESERVATION_LIMITS = { notesMax: 1000, personnesMin: 1 } as const
const CHAMP_REQUIS = 'Ce champ est requis.'
export const reservationBaseSchema = z.object({
  nom: nomContactSchema, email: emailContactSchema, telephone: telephoneContactSchema,
  date: z.string({ required_error: CHAMP_REQUIS }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Choisissez une date.'),
  heure: z.string({ required_error: CHAMP_REQUIS }).regex(HEURE_PATTERN, 'Choisissez une heure.'),
  nombrePersonnes: z.coerce.number({ invalid_type_error: 'Indiquez le nombre de personnes.' })
    .int('Nombre entier attendu.').min(RESERVATION_LIMITS.personnesMin, 'Au moins 1 personne.'),
  notes: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim()
    .max(RESERVATION_LIMITS.notesMax, `${RESERVATION_LIMITS.notesMax} caractères au maximum.`)
    .refine((s) => !CONTROLE_PATTERN.test(s), 'Caractères non autorisés.').optional()),
  website: honeypotSchema,
}).strict()
const MESSAGES_DATE: Record<RaisonDateInvalide, (r: ReglagesReservation) => string> = {
  format: () => 'Choisissez une date valide.',
  passee: () => 'Cette date est passée.',
  'trop-loin': (r) => `Les réservations sont ouvertes ${r.horizonJours} jours à l’avance au maximum.`,
  fermee: () => 'Le restaurant est fermé ce jour-là.',
}
/** Règles métier (réglages en base) ; `maintenant` relu à chaque validation (jamais figé). */
export function reservationSchema(r: ReglagesReservation, maintenant: () => Date = () => new Date()) {
  return reservationBaseSchema.superRefine((v, ctx) => {
    if (v.nombrePersonnes > r.capaciteMaxReservation)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nombrePersonnes'], message: `Au-delà de ${r.capaciteMaxReservation} personnes, écrivez-nous.` })
    const now = maintenant()
    const raison = verifierDate(r, v.date, now)
    if (raison) { ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['date'], message: MESSAGES_DATE[raison](r) }); return }
    if (!creneauxPourDate(r, v.date, now).includes(v.heure))
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['heure'], message: 'Ce créneau n’est plus disponible. Choisissez-en un autre.' })
  })
}
export type ReservationFormValues = z.input<typeof reservationBaseSchema>
export type ReservationBody = z.infer<typeof reservationBaseSchema>
```

```ts
// shared/content/ccdpaa/assistant-import-export.ts — questionnaire SCRIPTÉ (DEC-14, PROJECT_CONTEXT §7) :
// aucune IA, aucun appel LLM. Structure en code (couplée au zod) ; intro + recommandations éditables (SERVICES:assistant).
export const ASSISTANT_SITE = 'ccdpaa' as const
interface OptionAssistant { readonly value: string; readonly label: string }
interface EtapeAssistant { readonly cle: string; readonly libelleCourt: string; readonly question: string; readonly aide: string
  readonly options: readonly [OptionAssistant, ...OptionAssistant[]] }
const o = <V extends string>(value: V, label: string) => ({ value, label }) as const
export const ETAPES_ASSISTANT = [
  { cle: 'profil', libelleCourt: 'Profil', question: 'Quel est votre profil ?', aide: 'Nous adaptons les volumes minimums et les conditions de livraison à votre activité.',
    options: [o('epicerie', 'Épicerie spécialisée'), o('restaurant', 'Restaurant'), o('grossiste', 'Grossiste / distributeur'), o('exportateur', 'Exportateur en Afrique')] },
  { cle: 'categorie', libelleCourt: 'Catégorie', question: 'Quelle catégorie vous intéresse ?', aide: 'Nos filières couvrent les produits frais, secs et transformés.',
    options: [o('tubercules', 'Tubercules et féculents'), o('epices', 'Épices et condiments'), o('fruits-legumes', 'Fruits et légumes'), o('transformes', 'Produits transformés')] },
  { cle: 'volume', libelleCourt: 'Volume mensuel', question: 'Quel volume envisagez-vous par mois ?', aide: 'Cela détermine le mode d’expédition : groupage, palette ou conteneur.',
    options: [o('moins-200kg', 'Moins de 200 kg'), o('200-1000kg', '200 à 1 000 kg'), o('1-5t', '1 à 5 tonnes'), o('plus-5t', 'Plus de 5 tonnes')] },
  { cle: 'delai', libelleCourt: 'Échéance', question: 'Pour quelle échéance ?', aide: 'Votre horizon nous permet de planifier le premier envoi.',
    options: [o('immediat', 'Dès que possible'), o('1-3-mois', 'Dans 1 à 3 mois'), o('plus-3-mois', 'Dans plus de 3 mois'), o('exploration', 'Exploration seulement')] },
] as const satisfies readonly EtapeAssistant[]
export type ReponsesAssistant = { readonly [E in (typeof ETAPES_ASSISTANT)[number] as E['cle']]: E['options'][number]['value'] }
export type VolumeAssistant = ReponsesAssistant['volume']
export const ETAPE_CONTACT = { libelleCourt: 'Coordonnées', question: 'Où pouvons-nous vous répondre ?',
  aide: 'Vos coordonnées nous permettent de vous transmettre la fiche logistique adaptée.' } as const
export const NOMBRE_ETAPES = ETAPES_ASSISTANT.length + 1
export type PalierRecommandation = 'petit' | 'moyen' | 'grand'
const PALIER_PAR_VOLUME = { 'moins-200kg': 'petit', '200-1000kg': 'moyen', '1-5t': 'grand', 'plus-5t': 'grand' } as const satisfies Record<VolumeAssistant, PalierRecommandation>
export const palierRecommandation = (volume: VolumeAssistant): PalierRecommandation => PALIER_PAR_VOLUME[volume]
/** Récap lisible — client (<dl>) et serveur (MessageContact.message). */
export function recapReponses(reponses: ReponsesAssistant): { readonly libelle: string; readonly valeur: string }[] {
  return ETAPES_ASSISTANT.map((etape) => {
    const valeur = reponses[etape.cle]
    const option = (etape.options as readonly OptionAssistant[]).find((opt) => opt.value === valeur)
    return { libelle: etape.libelleCourt, valeur: option?.label ?? valeur }
  })
}
export const ASSISTANT_FORM = { sujet: 'Assistant import-export', bouton: 'Obtenir ma recommandation', toastTitre: 'Votre plan d’approvisionnement est prêt' } as const
```

```ts
// shared/validation/contact.ts — ajouts (le reste inchangé)
export const CONTROLE_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/ // (export de la constante existante)
import { ETAPES_ASSISTANT, type ReponsesAssistant } from '../content/ccdpaa/assistant-import-export'
const videEnUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
const enumEtape = (options: readonly { value: string }[]) =>
  z.enum(options.map((x) => x.value) as [string, ...string[]], { errorMap: () => ({ message: 'Choisissez une réponse.' }) })
// Seul cast : forme dérivée de la config au runtime ; type statique = ReponsesAssistant (tests).
export const reponsesAssistantSchema = z.object(Object.fromEntries(ETAPES_ASSISTANT.map((e) => [e.cle, enumEtape(e.options)])))
  .strict() as unknown as z.ZodType<ReponsesAssistant, z.ZodTypeDef, Record<string, unknown>>
export const assistantFormSchema = z.object({
  nom: nomContactSchema, email: emailContactSchema,
  entreprise: z.preprocess(videEnUndefined, texteCourtSchema(CONTACT_LIMITS.entrepriseMax).optional()),
  telephone: z.preprocess(videEnUndefined, telephoneContactSchema.optional()),
  website: honeypotSchema,
}).strict()
export const assistantBodySchema = assistantFormSchema.extend({ formulaire: z.literal('assistant'), reponses: reponsesAssistantSchema })
// contactBodySchema : ajouter `assistantBodySchema` à la liste du discriminatedUnion.
export type AssistantFormValues = z.input<typeof assistantFormSchema>
```

```ts
// shared/content/sections/catalog.ts — bloc OFFRES
{ page: PAGE_SITE.OFFRES, cle: 'seo', type: 'seo', portee: ['placement'] },
{ page: PAGE_SITE.OFFRES, cle: 'entete', type: 'section', portee: ['placement'] },
{ page: PAGE_SITE.OFFRES, cle: 'cta', type: 'cta', portee: ['placement'] },               // nouveau
{ page: PAGE_SITE.OFFRES, cle: 'candidature', type: 'formulaire', portee: ['placement'] }, // nouveau
{ page: PAGE_SITE.OFFRES, cle: 'spontanee', type: 'formulaire', portee: ['placement'] },   // nouveau

// shared/types/public.ts — ajouts
import type { TypeContratKey } from '../config/candidature'
import type { ReglagesReservation } from '../utils/restaurant'
export interface PublicOffreDto { readonly uuid: string; readonly titre: string; readonly lieu: string; readonly typeContrat: TypeContratKey
  readonly salaire: string | null; readonly description: string; readonly publieeLe: string /* ISO */ }
export interface PublicRestaurantDto extends ReglagesReservation { readonly nom: string; readonly adresse: string | null; readonly quartier: string | null }

// nuxt.config.ts — après les règles filiales (Nitro : la règle la plus spécifique l'emporte)
const OFFRES_ISR_TTL_SECONDS = 60 // DEC-25 : une offre retirée disparaît en ≤ 1 min (le POST revérifie de toute façon)
'/placement/offres': { isr: OFFRES_ISR_TTL_SECONDS },
'/placement/offres/**': { isr: OFFRES_ISR_TTL_SECONDS },
```

**Tests T0** (`tests/unit/{candidature-validation,reservation-rules,assistant-content,dates-quebec}.test.ts` et `contact-validation.test.ts`)
- **Poste** :
  - « autre » sans précision : refusé ;
  - avec `demandeUuid` et sans poste : accepté ;
  - `consentement` absent ou `'false'` : refusé.
- **Fichiers côté client** : CV en PNG refusé, 6 documents refusés, total supérieur à 10 Mo refusé.
- **`instantQuebec`** :
  - `2026-07-14 19:30` → `23:30Z` (heure d'été, UTC−4) ;
  - `2026-12-14 19:30` → `00:30Z` le lendemain (heure normale, UTC−5) ;
  - veille et lendemain des changements d'heure.
- **Dates de réservation** :
  - `creneauxPourDate` : un lundi → `[]` ;
  - aujourd'hui à 18h05 avec un délai de 2 h → premier créneau 20:30 ;
  - date au-delà de l'horizon → `[]` ;
  - pas de 0 → `[]` (pas de boucle infinie).
- **Libellés et jours** :
  - `libelleJoursOuverture([2,3,4,5,6,7])` = « Mardi — dimanche » ;
  - `jourIsoSemaine('2026-09-27')` = 7 (un dimanche).
- **Assistant** : les clés d'options sont uniques et en kebab-case ; chaque volume a un palier ; `assistantBodySchema` refuse une réponse inconnue ou une clé en trop dans `reponses`.
- **Union** : `contactBodySchema.optionsMap` contient `assistant`.

### T1 à T4

| # | Agent (+ skill) | Taille | Fichiers (uniquement ceux-ci) | Fin |
|---|---|---|---|---|
| T1 | backend (nitro + security) | L | Voir le détail sous le tableau. | typecheck et unitaires ; curl : 201 candidature (spontanée et offre), 404 offre retirée, 415 sur un `.txt` renommé `.pdf`, 413, 429 à la 4ᵉ requête ; 201 réservation puis 201 idempotent (une seule ligne), 400 sur un lundi ; 201 assistant |
| T2a | frontend (vue3 + ui-ux) | L | `app/pages/placement/offres/{index,[uuid],candidature-spontanee}.vue`, `app/components/site/placement/{OffreLigne,CandidatureForm,ChampFichier}.vue`, `app/composables/usePublicForm{Submit,Feedback}.ts`, `tests/nuxt/candidature-form.nuxt.test.ts` | typecheck ; build prod ; aucun dégradé, `v-html` ni texte public en dur |
| T2b | frontend (vue3 + ui-ux) | L | `app/pages/ccdpaa/restaurant.vue`, `app/components/site/restaurant/ReservationForm.vue`, `app/components/site/services/AssistantImportExport.vue`, `app/pages/[filiale]/services.vue`, `tests/nuxt/{reservation-form,assistant}.nuxt.test.ts` | idem ; **n'utilise** `usePublicForm*` que tel quel (JSON) |
| T3 | e2e-tester (playwright) | M | `tests/e2e/{placement-offres,ccdpaa-restaurant,ccdpaa-assistant}.spec.ts`, `tests/e2e/fixtures/` (PDF minimal, faux PDF, 11 Mo générés au moment du test), `scripts/cleanup-test-data.ts` (`--candidature-email`, `--reservation-email` : supprime lignes, `Fichier` et objets stockés) | vert contre `.output` ; un XFF par test ; `contact*.spec.ts` toujours verts |
| T4 | regression-checker, puis reviewer + ux-reviewer | S | aucun | captures 375/768/1440 des 4 écrans ; vidéos : étapes de l'assistant et toasts d'envoi |

Détail des fichiers de T1 :
- routes : `server/api/public/placement/offres/{index,[uuid]}.get.ts`, `server/api/public/placement/candidatures.post.ts`, `server/api/public/restaurant/{index.get,reservations.post}.ts` ;
- logique pure : `server/lib/{candidature,reservation}.ts` ;
- existants modifiés : `server/lib/contact.ts` (handler `assistant`), `server/utils/storage.ts` (`saveUploadedFiles`, `supprimerFichiers`, nettoyage du nom), `server/api/files/[key].get.ts` (`attachment` pour les fichiers `PRIVE`), `server/lib/mail/templates/accuse-reception.ts`, `prisma/seed-data/sections.ts` ;
- tests : `tests/unit/{candidature-mapping,reservation-mapping,storage-lot}.test.ts` et `contact-mapping.test.ts`.

Ordre : T0 → T1, T2a et T2b en parallèle → T3 → T4. Regression-checker sur : `usePublicForm*`, `services.vue`, `storage.ts`, `files/[key]` et `contact.ts`.

## 6. Critères d'acceptation
1. `/placement/offres`, `/placement/offres/{uuid}`, `/placement/offres/candidature-spontanee` et `/ccdpaa/restaurant` répondent 200 en build prod. Un uuid inconnu ou retiré donne 404. Les liens de nav « Offres » et « Restaurant » ne sont plus en 404.
2. Aucune réponse publique ne contient `entrepriseCliente`, `contact*`, `id` ni de clé de fichier. Une offre dépubliée disparaît en 60 s au plus, et un `POST` sur cette offre renvoie 404.
3. Pour un envoi valide, la ligne `Candidature` a :
   - `consentementLe`, `categorie` et `posteRecherche` corrects ;
   - un `cvKey` qui désigne un `Fichier` `PRIVE` de placement ;
   - un `nomOriginal` nettoyé.
4. Faux PDF → 415, 11 Mo → 413. Dans ces deux cas, **aucun** `Fichier` ni objet stocké. Un échec Prisma simulé laisse zéro fichier orphelin.
5. Honeypot rempli : 201, aucune ligne, aucun fichier, aucun courriel. La 4ᵉ candidature dans l'heure depuis une même IP → 429 avec `Retry-After`.
6. `/api/files/[key]` sur un fichier `PRIVE` : 401 sans session, `Content-Disposition: attachment` avec session.
7. Réservation :
   - les créneaux affichés égalent `creneauxPourDate` ;
   - un lundi, une date passée, plus de `capaciteMaxReservation` personnes ou une heure hors créneau → 400 ;
   - `dateReservation` est stocké en UTC correct (heure d'été et d'hiver) ;
   - un second envoi identique crée 0 ligne.
8. Les horaires affichés viennent de `ReglagesRestaurant`. Modifier les réglages en base puis appeler `invalidatePublicPages` suffit à mettre la page à jour.
9. Assistant :
   - 5 étapes, clavier seul possible (radios), « Continuer » désactivé sans réponse ;
   - une fois l'envoi réussi : message `ASSISTANT_IMPORT_EXPORT` avec les clés stables et le `palier` dans `details` ;
   - la recommandation affichée est `SERVICES:assistant.recommandations[palier]` ;
   - aucun libellé « IA ».
10. Tous les textes publics viennent des sections ou des réglages (aucune chaîne marketing dans un composant). Tous les formulaires ont la mention Loi 25 et un toast 429/5xx qui conserve les valeurs.
11. À 375 px : pas de défilement horizontal, contrôles ≥ 44 px, contraste AA sur la carte de réservation.
12. Aucun log ne contient de courriel, de nom, de nom de fichier ou de corps de requête.

## Points ouverts (valeur retenue par défaut)

| # | Point | Défaut |
|---|---|---|
| 1 | Loi 25 : durée de conservation des candidatures et des CV, et purge | **Bloquant pour la prod.** Proposition : 12 mois après le dernier changement de statut ; colonne et tâche planifiée au lot 5 (migration, avec accord) |
| 2 | Antivirus sur les uploads | Aucun (magic bytes + `PRIVE` + `attachment`) ; ClamAV avant la prod si le volume le justifie |
| 3 | Rate-limit candidature de 3/h/IP (DEC-22), dur pour quelqu'un qui corrige un fichier refusé | Conservé ; la validation client limite ces échecs |
| 4 | DOCX | Refusé (DEC-21, Q-09) |
| 5 | Candidatures en double (même courriel, même offre) | Acceptées ; tri dans l'admin (lot 5) |
| 6 | Capacité de salle et courriel de confirmation de table | Hors schéma ; confirmation manuelle ; courriel à l'acceptation au lot 5 |
| 7 | Promesses commerciales dans les textes éditables (48 h, 72 h, Douala/Dakar) | Reprises du prototype validé ; à faire confirmer par le client |
| 8 | Seed réaligné (OFFRES, assistant, légende du hero restaurant) | Base neuve seulement ; sur la base de dev, édition dans `/admin/contenu` |
| 9 | JSON-LD sans `baseSalary` ni `validThrough` | Salaire en texte libre, pas de date d'expiration dans le schéma |
| 10 | Liste d'offres limitée à 50, sans pagination | Suffisant à cette échelle |
| 11 | Assistant placé avant le CTA (écart au prototype) | Retenu (voir §4) |
| 12 | `America/Toronto` (existant) contre `America/Montreal` (DEC-27) | Alias IANA de la même zone ; `FUSEAU_QUEBEC` conservé |

Checklist de `PROJECT_STATE.md` : la ligne « `/placement/offres/[id]/postuler` (ou modal) » devient `/placement/offres/[uuid]` + `/candidature-spontanee`.

## Fichiers clés
- `/home/cabrel/projects/cd-holding/server/utils/storage.ts` : `saveUploadedFile` sans lot ni retour arrière ; le nom de fichier n'est pas nettoyé.
- `/home/cabrel/projects/cd-holding/server/api/files/[key].get.ts` : les fichiers `PRIVE` sont servis en `inline`.
- `/home/cabrel/projects/cd-holding/server/lib/contact.ts` : registre `REGISTRE`/`satisfies`.
- `/home/cabrel/projects/cd-holding/shared/validation/contact.ts` : union, `CONTROLE_PATTERN` pas encore exporté.
- `/home/cabrel/projects/cd-holding/shared/content/sections/catalog.ts` : bloc OFFRES l.108-110.
- `/home/cabrel/projects/cd-holding/prisma/seed-data/sections.ts` : l.502-513 (assistant), l.618-665 (restaurant, offres).
- `/home/cabrel/projects/cd-holding/prisma/seed/reglages.ts`
- `/home/cabrel/projects/cd-holding/nuxt.config.ts` : `routeRules` l.71-81.
- `/home/cabrel/projects/cd-holding/app/composables/usePublicFormSubmit.ts` : n'accepte que du JSON aujourd'hui.
- Prototype : `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/routes/{placement.offres,ccdpaa.restaurant}.tsx` et `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/components/subsidiary/ImportExportAssistant.tsx`.
