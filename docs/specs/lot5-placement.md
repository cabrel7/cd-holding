# Spec lot 5 (sous-lot placement) : candidats, demandes, candidatures + Loi 25

Rédigée par l'architect le 2026-10-07 (lecture seule). Sources : `CLAUDE.md`, `PROJECT_STATE.md`,
`PROJECT_CONTEXT.md` §5-§8, `CONVERSION_INVENTORY.md` (DEC-23, DEC-24, DEC-25, DEC-34, D7, E21, E24,
placement l.561-590 et l.1169-1294), `docs/specs/lot4-admin-socle.md`, `docs/specs/lot3-pages-specifiques.md`,
`prisma/schema.prisma`, `server/utils/{auth,site-scope,isr,storage}.ts`, `server/lib/admin/pagination.ts`,
`server/services/admin/{clients,messages,dashboard}.ts`, `shared/config/{admin,candidature,modules,sites}.ts`,
`shared/types/admin.ts`, `shared/validation/admin.ts`, `app/config/admin-nav.ts`,
`app/composables/{useAdminPagedList,useAdminListQuery}.ts`, prototype `admin.placement.tsx`.

## Notes d'environnement
- Skill chargé : `nitro` (couches serveur, tâches planifiées, garde-fou cluster).
- Agents `architect`/`backend`/`frontend` non disponibles dans l'environnement opencode : l'architect
  est ici le fil principal ; l'implémentation passera par des tâches typées (backend/frontend/e2e) si possible.

## Écarts par rapport au prototype `admin.placement.tsx`

1. **4 onglets → 3 routes** (DEC-34, D7). Le prototype a un seul écran Tabs
   {Candidats, Demandes, Candidatures, Offres}. La cible est `/admin/placement/{candidats,demandes,candidatures}`
   en onglets-liens (modèle `/admin/contenu`). L'onglet « Offres » n'a pas de contrepartie : un poste est
   publié/dépublié depuis l'onglet Demandes (`publiee` + champs d'offre sur `DemandeClient`).
2. **Statuts candidature réalignés sur l'enum Prisma** : le prototype a 5 statuts (`recue`, `en_revue`,
   `entrevue`, `refusee`, `embauchee`) ; l'enum `StatutCandidature` vaut
   `NOUVELLE / EN_REVISION / RETENUE / REJETEE` (comme `PROJECT_STATE.md` ligne 94 le note déjà). Même
   alignement pour candidat (`DISPONIBLE / EN_PROCESSUS / PLACE`), demande
   (`OUVERTE / POURVUE / ANNULEE`), origine (`LOCAL / INTERNATIONAL`). L'expérience n'est plus une phrase
   libre mais `NiveauExperience` (déjà dans le schéma et le formulaire public, lot 3).
3. **Affectation persistante** : le bouton « Assigner » du prototype modifie un mock ; ici il crée une
   ligne `Affectation` (DEC-24), passe le candidat à `PLACE`, et propose un désassignement (le prototype
   n'en avait pas — nécessaire pour corriger une erreur, sinon un PLACE est irréversible sans édition manuelle).
4. **Vivier alimenté par action explicite** : plus de création automatique de `Candidat` à chaque
   candidature (DEC-23) ; l'admin le crée manuellement ou clique « Ajouter au vivier » sur une candidature
   (avec copie du CV dans son cycle de vie propre — voir §3).
5. **Loi 25 : anonymisation, pas suppression seule**. « Supprimer » (spam/erreur) efface la ligne ;
   « Supprimer maintenant » (demande d'effacement) anonymise (ligne statistique conservée). Tâche planifiée
   quotidienne + marqueur `anonymiseLe`. C'est le cœur du lot.
6. **Pas d'upload de CV à la création manuelle d'un candidat** dans ce lot (la saisie manuelle du vivier
   peut se faire sans pièce jointe ; le CV arrive via « Ajouter au vivier » ou les candidatures). Point
   ouvert n°4 si le besoin est réel.

## 0. CHALLENGE

- **La vraie exigence du lot est Loi 25, pas le listing.** Le « fun » visuel (tabs, listes) existait déjà
  au lot 4. Le coût est la migration (colonnes nullables + état par statut), la tâche planifiée sécurisée
  multi-worker (garde-fou skill nitro), et les deux « boutons rouges » qui détruisent des données
  personnelles. Toute la spec est ordonnée pour que l'anonymisation soit testée en premier et au plus juste.
- **Délai de conservation : 3 horloges, une seule mécanique.** « rejet + 6 mois », « jamais traitée +
  6 mois (dateEnvoi) », « retenue/vivier + 12 mois renouvelable ». On ne stocke que deux dates d'état
  (`rejeteLe`, `retenueLe`) + la réception déjà présente (`dateEnvoi`) + le renouvellement (`consentementRenouveleLe`
  sur Candidat). Une fonction pure calcule l'échéance ; tout le reste découle.
- **`cvKey` non-nullable aujourd'hui → nullable.** Anonymiser exige de retirer la référence fichier avant de
  supprimer le fichier (relation `Restrict`). C'est une vraie migration, pas un simple `DROP NOT NULL`.
- **Multi-worker : la tâche quotidienne ne doit s'exécuter qu'une fois.** En PM2 `-i max`, Nitro déclenche
  la tâche sur chaque worker. Pas de SQL brut (règle projet) → verrou optimiste via une table
  `TaskExecution` minimale, claim par `updateMany` conditionnel, 100 % Prisma.
- **Le désassignement a un coût de conception** : un candidat `PLACE` peut l'avoir été sur plusieurs demandes.
  `DELETE affectation` restaure `DISPONIBLE` seulement si aucune autre affectation active ne le référence.
- **Un « Publier comme offre » incomplet est un piège** : `publiee=true` sans `titreOffre/lieu/typeContrat/descriptionPublique`
  casserait la liste publique. On n'autorise la publication que si les champs d'offre sont remplis
  (validé serveur, pas seulement UI) et on pose `publieeLe` au moment du passage en ligne.
- **ISR public** : `/placement/offres` est en ISR 60 s. Publier/dépublier doit appeler
  `invalidatePublicPages()` (décision CMS admin), sinon une offre publiée reste invisible jusqu'à 60 s.
- **À retirer de la demande implicite** : pas d'onglet « Offres » dédié (DEC-34), pas de courriel de
  confirmation de retenue (Q-10 reste ouvert, hors lot), pas de réglage des délais dans l'admin (constantes,
  éditable plus tard si le client le demande).

## 1. Écrans

Socle admin lot 4 (`layout: 'admin'`, `middleware: 'admin'`, `definePageMeta roles` SA+AF, composants
`AdminPageHeader`, `AdminListState`, `AdminPagination`, `useAdminListQuery` + `useAdminPagedList`).

| Écran | Données | États / actions |
|---|---|---|
| `/admin/placement` | — | Redirection `ssr:false` vers `/admin/placement/candidats` |
| `/admin/placement/candidats` | `GET /api/admin/placement/candidats` (`q,statut,page` + `origine`) | Table ≥ md / liste empilée < md (modèle `clients`). Ligne : nom, poste recherché, catégorie, disponibilité, origine (Badge LOCAL/INTERNATIONAL), statut (Badge), email, téléphone, date d'ajout. Filtres : `AdminSearchInput` (q), `AdminFilterSelect` statut + origine. Actions : « Ajouter un candidat » (Dialog), « Modifier » (Dialog), « Supprimer » (AlertDialog : « Le CV associé sera aussi supprimé. »), Select statut en ligne (PATCH rapide, toast). États : squelette, erreur + « Réessayer », vide filtres « Aucun candidat ne correspond à ces filtres. » + « Réinitialiser », vide « Aucun candidat. » |
| `/admin/placement/demandes` | `GET /api/admin/placement/demandes` (`q,statut,publiee,page`) | Liste d'articles (modèle prototype attendu). Article : entreprise cliente — N × poste, contact · courriel · téléphone · début, Badge statut demande, Select statut (OUVERTE/POURVUE/ANNULEE), **Switch « Publier comme offre »** (voir règle §3), bloc « Candidats correspondants » (catégorie = demande, candidat ≠ PLACE, top 10) avec bouton « Assigner », liste des affectations avec « Retirer ». « Ajouter une demande » (Dialog) + « Modifier » (Dialog) + « Supprimer » (AlertDialog : avertit si publiée → dépubliée). États comme ci-dessus. |
| `/admin/placement/candidatures` | `GET /api/admin/placement/candidatures` (`q,statut,page`) | Liste d'articles. Article : nom — poste visé, origine (« offre « titre » » ou « candidature spontanée »), catégorie, expérience, pays, date d'envoi, Badge statut candidature, Select statut (NOUVELLE/EN_REVISION/RETENUE/REJETEE). Détail : message, adresse, liste des documents (lien `/api/files/[key]`, téléchargement) . Actions : « Ajouter au vivier » (Dialog confirm), « Supprimer maintenant » (AlertDialog Loi 25, explication anonymisation), « Supprimer » (AlertDialog). Si `anonymiseLe` ≠ null : ligne affichée « Anonymisée le … », aucun lien fichier, aucune PII, actions réduites à la suppression. États comme ci-dessus. |

**Navigation** : ajout dans `app/config/admin-nav.ts` d'un item
`{ to: '/admin/placement', label: 'Placement', icon: ` un icône fonctionnelle lucide (ex. `BriefcaseBusiness`),
`roles: [SUPER_ADMIN, ADMIN_FILIALE], module: MODULES.PLACEMENT }`. Onglets-liens Placecment portés par un
petit composant `PlacementTabs.vue` (même motif que la navigation de `/admin/contenu`).

## 2. Schéma — migration `loi25_placement`

`prisma/schema.prisma` (detail exact dans la migration montrée à l'utilisateur) :

```prisma
model Candidature {
  // ...existant...
  nomComplet          String?            // nullable : effacé à l'anonymisation
  email               String?            // nullable : effacé à l'anonymisation
  telephone           String?            // nullable : effacé à l'anonymisation
  adresseComplete     String?            // nullable : effacé à l'anonymisation
  // posteAutrePrecision, message : déjà nullable → simplement mis à null
  // pays (String requis) : conservé — donnée agrégée (statistiques Loi 25), pas une PII
  cvKey               String?            // nullable : retiré (le Fichier est supprimé) à l'anonymisation
  rejeteLe            DateTime?          // posé quand statut → REJETEE (horloge 6 mois), effacé si l'on quitte REJETEE
  retenueLe           DateTime?          // posé quand statut → RETENUE (horloge 12 mois) ou renouvellement
  anonymiseLe         DateTime?          // posé à l'anonymisation (garde l'écran, cache les PII)
}

model Candidat {
  // ...existant...
  nomComplet            String?            // +nullable : effacé à l'anonymisation du vivier
  email                 String?            // +nullable : idem (le @@unique compagnie/email tolère les NULL)
  anonymiseLe           DateTime?
  consentementRenouveleLe DateTime?   // renouvellement 12 mois : base = COALESCE(consentementRenouveleLe, createdAt)
}

model TaskExecution {
  id           Int      @id @default(autoincrement())
  cle          String   @unique
  dateDerniere DateTime
  updatedAt    DateTime @updatedAt
}
```

Notes :
- Ligne statistique conservée après anonymisation sur `Candidature` : `posteRecherche`, `categorie`,
  `dateEnvoi`, `statut`, `companyId` + `anonymiseLe`. C'est le périmètre exact de la décision utilisateur
  (« poste, catégorie, date, statut, filiale »).
- `Candidature.candidatId` / `demandeId` ne sont pas de la PII : conservés.
- Aucun index nouveau nécessaire (volumes actuels) — les requêtes de la tâche filtrent sur `statut`+date,
  index partiel éventuel plus tard si volume.
- `TaskExecution` sert aussi au garde-fou des futures tâches (réservations…), donc générique (`cle`).

## 3. API

Règles communes : `requireModule(event, MODULES.PLACEMENT, { site: PLACEMENT_SLUG, roles: [SA, AF] })`
(`server/utils/site-scope.ts`) — seul moyen propre d'exiger rôle + module + résoudre la filiale (il n'existe
qu'une société au module placement ; `site: PLACEMENT_SLUG` rend le SUPER_ADMIN indépendant d'un paramètre
client explicite). EMPLOYE → 403. `cache-control: no-store`. `[uuid]` validé `z.string().uuid()`. `select`
explicite (jamais `id`/`companyId`/FK numériques). Pagination `buildPage` / `pageArgs` / `ADMIN_PAGE_SIZE`.
Les mutations de la demande (publier/dépublier/statut) qui touchent une offre publique appellent
`invalidatePublicPages()` — jamais après une simple lecture.

Sous `/api/admin/placement/` :

| Méthode et chemin | Entrée | Succès | Erreurs |
|---|---|---|---|
| GET `/candidats` | `candidatsQuerySchema` (`q,statut?,origine?,page`) | 200 `AdminPage<AdminCandidatDto>` | 400, 403 |
| POST `/candidats` | `candidatCreateSchema` | 201 `AdminCandidatDto` | 400, 403, 409 (email), 415 (si CV fourni à tort → refusé) |
| PATCH `/candidats/[uuid]` | `candidatUpdateSchema` (statut, notes, disponibilite, origine, categorie, posteRecherche…) | 200 | 400, 404, 409 |
| DELETE `/candidats/[uuid]` | — | 204 (supprime CV via `supprimerFichiers` + affectations, cascade Prisma) | 404 |
| GET `/demandes` | `demandesQuerySchema` (`q,statut?,publiee?,page`) | 200 `AdminPage<AdminDemandeDto>` (avec `correspondances`, `affectations`) | 400, 403 |
| POST `/demandes` | `demandeCreateSchema` | 201 `AdminDemandeDto` (`publiee:false` forcé à la création) | 400, 403 |
| PATCH `/demandes/[uuid]` | `demandeUpdateSchema` (incl. `publiee` + champs d'offre) | 200 ; si passage à `publiee: true` → pose `publieeLe`, exige les champs d'offre, `invalidatePublicPages()` ; si `publiee:false` → `invalidatePublicPages()` | 400, 404 |
| DELETE `/demandes/[uuid]` | — | 204 (les candidatures liées gardent `demandeId=NULL` via SetNull) | 404 |
| POST `/demandes/[uuid]/affectations` | `affectationCreateSchema` `{candidatUuid}` | 201 (crée `Affectation`, candidat → PLACE) | 400, 404, 409 |
| DELETE `/demandes/[uuid]/affectations/[affectationUuid]` | — | 204 ; candidat → DISPONIBLE s'il n'est plus affecté ailleurs | 404 |
| GET `/candidatures` | `candidaturesQuerySchema` (`q,statut?,page`) | 200 `AdminPage<AdminCandidatureDto>` | 400, 403 |
| PATCH `/candidatures/[uuid]` | `candidatureUpdateSchema` `{statut}` | 200 ; pose `rejeteLe` (→REJETEE), `retenueLe` (→RETENUE), efface `rejeteLe` si on quitte REJETEE | 400, 404 |
| POST `/candidatures/[uuid]/vivier` | — | 201 `AdminCandidatDto` (copie CV : nouvelle clé, cycle de vie propre) ; 409 si `(companyId,email)` existe déjà | 404, 409 |
| POST `/candidatures/[uuid]/anonymiser` | — | 200 `AdminCandidatureDto` anonymisé (demande d'effacement « Supprimer maintenant ») | 404, 409 (déjà anonymisé) |
| DELETE `/candidatures/[uuid]` | — | 204 (efface la ligne + Fichiers) | 404 |

**« Ajouter au vivier » — copie du CV** : lire les octets via `uploadsStorage().getItemRaw(key)`,
`saveUploadedFile({ data, filename: cv.nomOriginal }, { companyId: placementId, visibilite: 'PRIVE' })`.
Le `Candidat` possède ainsi SON CV (cycle 12 mois), indépendant de la candidature (cycle 6 mois) : la
purge de l'un ne casse jamais l'autre. Sans CV (candidature déjà anonymisée ou sans fichier) : copie sans CV.

**Anonymisation** — `server/lib/anonymisation.ts` (pur, testé) :
- `echanceAnonymisation(c)`: si `anonymiseLe` → `null` (déjà fait) ; si `statut=REJETEE` et `rejeteLe` →
  `rejeteLe + 6 mois` ; sinon `dateEnvoi + 6 mois` (jamais traitée). `RETENUE` n'est jamais anonymisée par
  la tâche (basculer en vivier = décision humaine).
- `anonymiserCandidature(id)`: en `$transaction`, `supprimerFichiers([cvKey, ...autresDocumentsKeys])`
  (chemin storage + ligne `Fichier`), puis `update` posant `nomComplet/email/telephone/adresseComplete/
  posteAutrePrecision/message/cvKey` à null, `autresDocumentsKeys: []`, `anonymiseLe: now`.
- `anonymiserCandidat(id)`: idem (vide `nomComplet/email/telephone/postei/notes`, détache `cvKey` + supprime
  le fichier, `anonymiseLe: now`).
- `ectsAnonymisables(maintenant)`: trois `findMany` — candidatures `REJETEE` échues, candidatures non
  traitées échues, candidats du vivier échus (`COALESCE(consentementRenouveleLe, createdAt) + 12 mois`).
  Constantes `LOI25_*` dans `shared/config/candidature.ts` (importable seed/tsx).

**Tâche planifiée** — `server/tasks/anonymisation-loi25.ts` (`defineTask`) + config
`nitro: { scheduledTasks: { '0 2 * * *': ['anonymise-loi25'] } }` dans `nuxt.config.ts`. Garde-fou cluster :
- `server/services/tasks.ts` → `claimTaskExecution(cle, intervalle)` : claim par `updateMany`
  `{ where: { cle, dateDerniere: expecte }, data: { dateDerniere: now } }` (1 → on exécute) ; première
  exécution : `create` de la ligne (`dateDerniere` = passé), repli si `P2002` (un autre worker a créé) →
  re-claim. Zéro SQL brut. Logs : compteurs et `cle`, jamais de PII.
- La route admin « Supprimer maintenant » réutilise `anonymiserCandidature` (exécution immédiate, sans
  attendre la tâche).

## 4. Frontend

- `app/config/admin-nav.ts` : item Placement (module gating, cf. §1).
- `app/components/admin/placement/PlacementTabs.vue` : onglets-liens Candidats / Demandes / Candidatures
  (compteurs optionnels via les DTO de liste) — motif `/admin/contenu`.
- Pages : `candidats.vue`, `demandes.vue`, `candidatures.vue`, `index.vue` (redirect), toutes via
  `useAdminPagedList` + `useAdminListQuery` (modèle lot 4, zéro duplication).
- Composants : `CandidatFormDialog`, `DemandeFormDialog`, `PublierOffreDialog`, `CorrespondantsList`,
  `AffectationsList`, `CandidatureDetail`, `CandidatureActions` (vivier / anonymiser / supprimer).
- Formulaires : VeeValidate + zod (`#shared/validation/placement`... réutilise `AdminSearchInput`,
  `AdminFilterSelect`, `CmsFormDialog`-style, `toAdminError`, toasts). Aucun `alert/confirm/console.log/v-html`.
- Fichiers candidature : liens « Télécharger » vers `/api/files/[key]` (PRIVE → `attachment`, déjà géré
  dans `server/api/files/[key].get.ts`). Nom affiché = `nomOriginal` (métadonnée), jamais la clé.

## 5. Tâches (périmètres disjoints)

**T0 (main thread, avant T1/T2 ; migration à valider par l'utilisateur)** :
- `prisma/schema.prisma` (Cf. §2) + migration `loi25_placement` → **SQL montré à l'utilisateur, celui-ci
  exécute `prisma migrate dev`** (décision « Migrations », PROJECT_STATE). Le typecheck reste rouge tant
  que T1 n'a pas consommé les champs.
- `shared/config/candidature.ts` : `LOI25_DUREES = { rejetMois: 6, nonTraiteeMois: 6, vivierMois: 12 }`.
- `shared/config/modules.ts` : rien (PLACEMENT existe).
- `shared/types/admin.ts` : `AdminCandidatDto`, `AdminDemandeDto` (+`CorrespondantDto`, `AffectationDto`),
  `AdminCandidatureDto`, types d'enum DTO.
- `shared/validation/placement.ts` (nouveau, même style `admin.ts`) :
  `candidatsQuerySchema`, `candidatCreateSchema`, `candidatUpdateSchema`, `demandesQuerySchema`,
  `demandeCreateSchema`, `demandeUpdateSchema` (exige les champs d'offre quand `publiee`), `affectationCreateSchema`,
  `candidaturesQuerySchema`, `candidatureUpdateSchema`. Libellés en `shared/config/admin.ts`
  (`STATUT_CANDIDAT_LABELS`, `STATUT_CANDIDATURE_LABELS`, `STATUT_DEMANDE_LABELS`, `ORIGINE_CANDIDAT_LABELS`,
  `CATEGORIE_POSTE_LABELS`, `NIVEAU_EXPERIENCE_LABELS`, `TYPE_CONTRAT_LABELS`, `MATCH_CANDIDATS_LIMIT = 10`).
- Tests unit T0 (schémas, libellés).

**T1 backend** : `server/services/admin/placement.ts` (+ sous-services éventuels) — services
`listCandidats/createCandidat/updateCandidat/deleteCandidat`, `listDemandes/createDemande/updateDemande/
deleteDemande/affecter/retirerAffectation`, `listCandidatures/updateCandidatureStatut/ajouterAuVivier/
anonymiserCandidatureRoute/supprimerCandidature` ; `server/lib/anonymisation.ts` ; `server/services/tasks.ts`
(`claimTaskExecution`) ; `server/tasks/anonymisation-loi25.ts` ; routes
`server/api/admin/placement/**` ; `tests/unit/{anonymisation,placement-mapping,placement-validation}.test.ts`.
Ne touche pas `shared/**`, `app/**`, `tests/e2e/**`, `scripts/**`.

**T2 frontend** : pages + composants + nav + `PlacementTabs` ; `tests/nuxt/use-admin-placement.nuxt.test.ts`
éventuel (stub `useAdminShell`). Importe l'API T1 (types DTO).

**T3 e2e** : `tests/e2e/admin-placement.spec.ts` + fixture `tests/e2e/fixtures/placement-data.ts`
(candidats, demandes, candidatures via Prisma, nettoyage en fin), contre build prod. Cas : scoping
(AF placement OK, AF ccdpaa 403), sécurité (aucun `id`/`companyId`, aucun `statusMessage` technique),
publication d'offre → visible sur `/placement/offres` (ISR invalidé), anonymisation → PII et fichiers
disparus, ligne statistique présente, affectation → candidat PLACE puis retrait → DISPONIBLE.

**T4 revue + visuel** : reviewer + ux-reviewer (garde-fou Loi 25, AA, cibles ≥ 44 px), un build prod,
captures 375/768/1440 des 3 routes, vidéos : Dialog « Publier comme offre », AlertDialog « Supprimer
maintenant », transition d'onglet.

## 6. Critères d'acceptation

1. `pnpm typecheck`, `pnpm test:unit` (échéances d'anonymisation : rejet 6 mois, jamais traitée 6 mois,
   vivier 12 mois, renouvellement ; transition `rejeteLe`/`retenueLe` ; claim `TaskExecution` idempotent),
   `pnpm build:check` passent.
2. AF placement : ne voit que placement. AF ccdpaa / EMPLOYE : 403 sur toutes les routes du module.
   Aucune réponse avec `id`, `companyId` ni clé de fichier hors `nomOriginal`.
3. Publier une demande sans champs d'offre → 400 ; complétée puis publiée → `publieeLe` posé, ligne visible
   sur `/placement/offres` en ≤ 1 min (invalidation), dépubliée → disparaît.
4. « Supprimer maintenant » sur une candidature : CV + documents supprimés (storage + `Fichier`), PII à
   null, ligne visible « Anonymisée », statistiques intactes. Idempotent (409 si déjà anonymisée).
5. « Ajouter au vivier » : `Candidat` créé, CV copié (nouvelle clé), 409 si `(placement,email)` existe ;
   l'anonymisation ultérieure de la candidature ne casse pas le CV du vivier.
6. Affectation : `Affectation` créée, candidat → PLACE ; retrait → DISPONIBLE si non affecté ailleurs ;
   doublon `(candidat,demande)` → 409.
7. Tâche quotidienne : ne s'exécute qu'une seule exécution par fenêtre (deux workers simulés → 1 claim),
   anonymise les 3 cas échus, ne touche rien d'autre, logs sans PII.
8. UI : aucun `alert/confirm/console.log/v-html` ; toasts partout ; AlertDialog explicitent la destruction
   Loi 25 ; à 375 px pas de défilement horizontal ; cibles ≥ 44 px.

## Points ouverts (défaut retenu)

| # | Point | Défaut |
|---|---|---|
| 1 | Dépublier automatiquement une demande passée POURVUE ? | Non : la liste publique filtre déjà `OUVERTE` (lot 3). Le toggle reste manuel |
| 2 | Échéance affichée dans l'admin (compte à rebours Loi 25) ? | Affichage « Anonymisée le … » seulement ; compte à rebours hors périmètre |
| 3 | Renouvellement consentement dans l'admin ? | Pas d'écran au lot 5 : la base du calcul vivier = `createdAt` ; le champ `consentementRenouveleLe` est posé mais sans UI (prêt pour un lot futur) |
| 4 | Upload CV à la création manuelle d'un candidat ? | Non (aucun upload dans ce lot) — point d'attention si besoin client |
| 5 | `publiee` à la création d'une demande ? | Toujours `false` ; la publication passe par l'édition (+ validation des champs d'offre) |
| 6 | Notifications courriel aux candidats retenus / rejetés ? | Non (Q-10 ouvert, mailer à brancher plus tard) |