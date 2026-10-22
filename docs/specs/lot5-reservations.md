# Spec lot 5 (sous-lot réservations) : contrainte unique + admin CCDPAA + dashboard

Rédigée par l'architect le 2026-10-07 (lecture seule). Sources : `CLAUDE.md`, `PROJECT_STATE.md` (l.153, l.155),
`docs/specs/lot5-placement.md`, `docs/specs/lot4-admin-socle.md`, `docs/specs/lot3-pages-specifiques.md` §3,
`CONVERSION_INVENTORY.md` (DEC-35 l.85, l.140, l.153, l.404-436, l.1695), `prisma/schema.prisma:361`,
`prisma/migrations/20261007140000_reservation_unique_partielle/migration.sql`, `server/lib/reservation.ts`,
`server/api/public/restaurant/reservations.post.ts`, `server/utils/site-scope.ts`, `server/lib/admin/pagination.ts`,
`server/services/admin/{dashboard,placement,messages}.ts`, `shared/validation/{reservation,placement}.ts`,
`shared/config/{admin,modules}.ts`, `shared/types/admin.ts`, `shared/utils/{dates,restaurant}.ts`,
`app/config/admin-nav.ts`, `app/composables/{useAdminPagedList,useAdminListQuery}.ts`,
`app/components/admin/placement/{CandidatsList,InlineStatutSelect}.vue`, `app/pages/admin/index.vue`,
`scripts/cleanup-test-data.ts`, `tests/e2e/{ccdpaa-restaurant,admin-placement}.spec.ts`, `tests/e2e/helpers/{auth,db}.ts`,
prototype `admin.messages.tsx` (onglet Réservations), `admin.dashboard.tsx`, `mockdata.ts:389`,
`prisma/seed/{demo.ts:91,accounts.ts:54}`.

## Résumé et périmètre

Le lot 3 a livré la réservation publique idempotente en mémoire de transaction ; ce sous-lot pose l'invariant
**en base** (index unique partiel, décision utilisateur 2026-09-29), absorbe la violation unique côté public,
et livre l'écran admin dédié (DEC-35) : liste + changement de statut, rien de plus, comme le prototype.

- **Inclus** : migration `20261007140000_reservation_unique_partielle` (déjà écrite, exécutée par l'utilisateur) ;
  absorption P2002 dans `ecrireIdempotent` ; `GET /api/admin/reservations` + `PATCH /api/admin/reservations/[uuid]` ;
  page `/admin/ccdpaa/reservations` (une seule page, pas d'onglets) ; item de nav ; section « Prochaines
  réservations » du tableau de bord ; e2e + tests unitaires ; `--seed-reservations`/`--purge-reservations`.
- **Exclus** (explicites, pas silencieux) : DELETE et création/édition admin (le prototype n'en a pas) ;
  compteur EN_ATTENTE dans la nav ; courriel au client sur changement de statut (Q-10 ouvert) ; filtre/export
  par date ; `/admin/ccdpaa/planning` (autre sous-lot).
- **Routes concernées** : `/api/public/restaurant/reservations` (ajustement), `/api/admin/reservations` (GET),
  `/api/admin/reservations/[uuid]` (PATCH), `/api/admin/dashboard` (extension), `/admin/ccdpaa/reservations` (page),
  `/admin` (nouvelle section).

## Écarts par rapport au prototype `admin.messages.tsx` (onglet Réservations)

1. **Onglet → route dédiée** (DEC-35, `CONVERSION_INVENTORY.md:85`) : pas de `Tabs` sur `/admin/messages`.
2. **Filtres ajoutés** : le prototype n'a ni recherche ni filtre sur les réservations ; le socle lot 4/5
   (`useAdminListQuery`, `AdminSearchInput`, `AdminFilterSelect`) les rend triviaux et cohérents avec Messages/Clients.
3. **Table ≥ 1024 px + liste empilée dessous** (modèle `CandidatsList.vue:31`) ; le prototype n'a qu'une liste.
4. **Badge statut + Select séparés** : le prototype n'affiche que le Select ; on affiche Badge (lecture) +
   Select sr-only (action), modèle candidats (`CandidatsList.vue:84-96`).
5. **Dashboard** : le prototype fusionne les réservations dans un flux d'activité unique
   (`admin.dashboard.tsx:47-54`) ; notre tableau de bord (écart assumé lot 4) liste par nature → section
   dédiée « Prochaines réservations » (**à venir**, non annulées), plus utile qu'un flux incluant les passées.

## 0. CHALLENGE

- **La vraie exigence est l'invariant en base, pas l'écran.** L'écran est trivial (liste + select). Le cœur :
  absorber le P2002 sans changer un comportement public déjà testé (`ccdpaa-restaurant.spec.ts` « double clic »
  et « api-idem » doivent rester verts **sans modification**).
- **Un même code P2002, deux traitements.** Perdant de la course publique → 201 silencieux (idempotent) ;
  admin qui réactive une ligne ANNULEE alors qu'une ligne active occupe déjà `(companyId, email, dateReservation)`
  → 409 explicite. Ne pas fusionner les deux catchs.
- **Dérive silencieuse Prisma** : un index partiel n'est pas représentable dans `schema.prisma` — vérifié ce jour
  avec `prisma migrate diff` (base de référence jetable) : le diff migrations→schéma est **vide**, aucun futur
  `prisma migrate dev` ne proposera de DROP de cet index. Critère d'acceptation : refuser tout DROP proposé sur
  cet index.
- **Le dashboard étend un écran partagé** (`app/pages/admin/index.vue`, capturé au lot 4) : coût faible (une
  requête dans le `$transaction` existant), mais T4 doit recapturer `/admin` aux 3 breakpoints pour ne pas régresser.
- **À retirer de la demande implicite** : pas de badge compteur dans la nav (exigerait d'étendre le contrat
  `compteurs` — `server/api/admin/messages/compteurs.get.ts` — pour un badge qu'aucun autre module n'a) ; pas de
  suppression admin (effacement Loi 25 des réservations = à définir avec le juriste, pas improvisé ici).

## 1. Schéma & migration — `reservation_unique_partielle`

**Aucun changement de `schema.prisma`** (`ReservationRestaurant`, `schema.prisma:361-378`, est inchangé : les index
existants `@@index([companyId, dateReservation])` et `@@index([companyId, statut])` suffisent aux requêtes du lot).
La migration est **déjà écrite** dans `prisma/migrations/20261007140000_reservation_unique_partielle/migration.sql` :

```sql
-- Réservations en double (décision 2026-09-29, lot 5) : un même courriel ne peut pas avoir deux
-- réservations actives pour le même créneau (même filiale). Index unique PARTIEL — les lignes
-- ANNULEE en sont exclues, un client dont la réservation a été annulée peut réserver à nouveau
-- le même créneau. Non représentable dans schema.prisma (Prisma ne gère pas les index partiels) :
-- tout `prisma migrate dev` ultérieur qui proposerait un `DROP INDEX` sur
-- `ReservationRestaurant_doublon_key` doit être refusé (voir PROJECT_STATE).
CREATE UNIQUE INDEX "ReservationRestaurant_doublon_key"
ON "ReservationRestaurant"("companyId", "email", "dateReservation")
WHERE "statut" <> 'ANNULEE';
```

- **Sens** : unicité `(companyId, email, dateReservation)` pour les seules lignes actives — un client peut
  réserver à nouveau le même créneau après annulation (c'est le but du `WHERE`).
- **Anti-dérive** : vérifié ce jour avec `prisma migrate diff` (base de référence jetable) — diff
  migrations→schéma **vide** : aucun futur `prisma migrate dev` ne proposera de DROP de cet index. La règle reste
  documentée dans le SQL et dans PROJECT_STATE.
- **Exécution** : par l'utilisateur uniquement (décision 2026-09-29 « Migrations »). Le seed démo (3 courriels
  distincts, `prisma/seed/demo.ts:91-118`) ne viole pas l'index.
- Le typecheck n'est pas impacté par la migration (aucune colonne nouvelle).

## 2. API publique — absorption P2002

`server/api/public/restaurant/reservations.post.ts` garde sa structure (rate-limit 5/10 min, 411/413/415,
honeypot, 503 réglages, 400 métier, `instantQuebec` DST) ; seul change le comportement **sous concurrence** :

- **Conserver** `findFirst` + `create` en transaction `Serializable` : le
  `findFirst` sert le cas séquentiel courant (renvoi → 201 sans écriture ni courriel) sans lever la contrainte.
- **Étendre `ecrireIdempotent`** (`server/lib/reservation.ts`) : en plus du conflit de sérialisation
  (P2034/40001, relire puis réessayer), catcher **P2002** sur le `create` et retourner `'existante'`
  **immédiatement** (la violation sur notre clé exacte prouve l'existence — pas de relecture, pas de second
  essai). Fonction pure, donc testable unitairement avec des closures simulées.
- **Comportement observable inchangé** : double envoi identique → `201 { ok: true }` silencieux, une seule ligne,
  un seul accusé. Les e2e lot 3 « double clic » et « api-idem » restent verts sans modification — critère
  d'acceptation.

## 3. API admin

Règles communes (pattern placement, `server/api/admin/placement/candidatures.get.ts:10` et
`candidatures/[uuid].patch.ts:12`) : `requireModule(event, MODULES.RESERVATIONS, { site: RESTAURANT_SLUG, roles: [SA, AF] })`
— `RESTAURANT_SLUG = 'ccdpaa'` (`shared/utils/restaurant.ts:5`), seul site portant le module
(`shared/config/modules.ts:21`). `requireModule` (`server/utils/site-scope.ts:118`) enchaîne : EMPLOYE → 403
(`requireRole`), ADMIN_FILIALE d'une autre filiale → 403 (`resolveWriteCompany`, `site-scope.ts:88-95`),
ADMIN_FILIALE ccdpaa → scopé ccdpaa, SUPER_ADMIN → scopé ccdpaa sans paramètre client. Le filtrage n'est
**jamais** décidé par le front. `cache-control: no-store`, `select` explicite uuid uniquement, params
`z.object({ uuid: z.string().uuid() })` via `getValidatedRouterParams`. Aucun `invalidatePublicPages()` (aucune
page publique n'affiche les réservations).

| Méthode et chemin | Entrée | Succès | Erreurs |
|---|---|---|---|
| GET `/api/admin/reservations` | `reservationsQuerySchema` `{statut?, q?, page}` (`.strict()`) | 200 `AdminPage<AdminReservationDto>` | 400, 401, 403 |
| PATCH `/api/admin/reservations/[uuid]` | `reservationUpdateSchema` `{statut}` (`.strict()`) | 200 `AdminReservationDto` | 400, 401, 403, 404, **409** |

- **Recherche `q`** : `OR` `contains` `mode:'insensitive'` sur `nom, email, telephone` (bornes et repli du
  pattern `shared/validation/placement.ts:62-63`). **Tri** : `[{dateReservation:'desc'},{id:'desc'}` (prototype
  `admin.messages.tsx:58-61`). Pagination : `count`+`findMany` en `$transaction`, `pageArgs`/`buildPage`/
  `ADMIN_PAGE_SIZE` (`server/lib/admin/pagination.ts:4,9`), page hors bornes → `items: []` + vrai `total`.
- **PATCH** : résolution `findFirst({ where: { uuid, companyId: ctx.company.id } })` → 404 « Introuvable »
  (pattern `findCandidatureOwnedOr404`, `server/services/admin/placement.ts:727`). Transitions **libres** entre
  les 3 statuts (le Select du prototype l'offre depuis n'importe quel état) ; aucune horloge à poser.
- **P2002 sur PATCH** : réactiver une ligne ANNULEE (statut → EN_ATTENTE/CONFIRMEE) alors qu'une ligne active
  occupe déjà la clé → catch `isUniqueViolation` (`server/lib/admin/pagination.ts:13`) → **409** « Une
  réservation active existe déjà pour ce créneau et ce courriel. ». Le front revert le Select et toast l'erreur.
- **Service** : `server/services/admin/reservations.ts` (modèle `placement.ts:705-762`) — `RESERVATION_SELECT`
  (uuid, nom, email, telephone, nombrePersonnes, dateReservation, notes, statut, createdAt + `company` ref),
  `toReservationDto`, `listReservations`, `updateReservationStatut`.
- **DTO** (`shared/types/admin.ts`, section dédiée « Lot 5 : réservations ») : `StatutReservationDto =
  'EN_ATTENTE'|'CONFIRMEE'|'ANNULEE'` ; `AdminReservationDto { uuid, nom, email, telephone, nombrePersonnes,
  dateReservation (ISO 8601 UTC), notes, statut, site: AdminSiteRef, createdAt (ISO) }`. Le DTO est réutilisé
  tel quel par le dashboard (§5). Jamais `id` ni `companyId` en réponse.

## 4. Frontend admin — `/admin/ccdpaa/reservations`

Une seule page (`app/pages/admin/ccdpaa/reservations.vue`, `definePageMeta({ middleware:'admin', layout:'admin',
roles: [SA, AF] })`), composition :

- **Nav** : item `{ to: '/admin/ccdpaa/reservations', label: 'Réservations', icon: UtensilsCrossed, roles:
  ROLES_GESTION, module: MODULES.RESERVATIONS }` dans `app/config/admin-nav.ts` (modèle item Placement :43 ;
  le gating par module masque l'item pour toute filiale sans réservations). **Pas de compteur** (Clients et
  Placement n'en ont pas non plus ; point ouvert n°1).
- **En-tête** : `AdminPageHeader` « Réservations », description « Les réservations du restaurant CCDPAA
  arrivent ici. » (libellé d'interface, pas du CMS).
- **Filtres** : `AdminSearchInput` (`q`, placeholder « Rechercher un nom, un courriel, un téléphone… ») +
  `AdminFilterSelect` statut (Tous les statuts / En attente / Confirmée / Annulée) + « Réinitialiser » ;
  via `useAdminListQuery` (`app/composables/useAdminListQuery.ts:25`, debounce 300 ms, filtre → `page=1`) ;
  filtres et page dans l'URL (partageables, survivent au rechargement).
- **Liste** : `app/components/admin/reservations/ReservationsList.vue`, clone du modèle `CandidatsList.vue:31` —
  `useMediaQuery('(min-width: 1024px)')` → **Table** (Colonnes : Client (nom), Personnes, Date (visuelle :
  « mardi 14 octobre 2026 à 19 h 30 »), Téléphone, Courriel, Notes, Statut) / **liste empilée dessous** (nom ·
  N personnes, date+heure, téléphone · courriel, note éventuelle, badge + select). Date/heure rendues via
  `formatDateHeureQuebec` (`shared/utils/dates.ts:131`, fuseau America/Toronto — DST géré), jamais recalcul
  maison.
- **Statut** : Badge + `InlineStatutSelect` — **réutiliser tel quel**
  `app/components/admin/placement/InlineStatutSelect.vue` (générique : modelValue/label/options/busy ; pas de
  déplacement, zéro régression placement), options depuis `STATUT_RESERVATION_LABELS`. PATCH → toast exact
  « Réservation mise à jour. » (prototype `admin.messages.tsx:192`), ligne mise à jour depuis le DTO 200 ;
  erreur (409/404/400) → `toAdminError` + revert du Select ; `aria-busy` pendant l'envoi.
- **États** : `AdminListState` + `AdminPagination` — squelette, erreur + « Réessayer », vide filtré « Aucune
  réservation ne correspond à ces filtres. » + « Réinitialiser », vide « Aucune réservation. ». 401 → login avec
  `redirect` (`watchAdminUnauthorized`).
- Libellés : `STATUT_RESERVATION_LABELS = { EN_ATTENTE: 'En attente', CONFIRMEE: 'Confirmée', ANNULEE: 'Annulée' }`
  dans `shared/config/admin.ts` (modèle `STATUT_MESSAGE_LABELS:12`). Variantes Badge : EN_ATTENTE → `default`,
  CONFIRMEE → `secondary`, ANNULEE → `outline` (sémantique métier, aucun badge décoratif).
- Accès direct par un ADMIN_FILIALE sans le module : la nav masque l'item, l'API renvoie 403 → état erreur de la
  page (même comportement que Placement).
- Interdits vérifiés en revue : `alert`/`confirm`/`console.log`/`v-html`/dégradé ; cibles ≥ 44 px sous `md`
  (`min-h-11 md:min-h-9`, pattern lot 4/5) ; à 375 px, aucun défilement horizontal.

## 5. Dashboard — « Prochaines réservations » (inclus)

Décision : **oui**, ce sous-lot l'ajoute — effort contenu, et c'est le lot qui « porte » les réservations.

- **Backend** : `getDashboard` (`server/services/admin/dashboard.ts:15`) — requête additionnelle dans le
  `$transaction` existant : `reservationRestaurant.findMany({ where: { statut: { not: 'ANNULEE' },
  dateReservation: { gte: new Date() }, ...parCompany }, orderBy: [{ dateReservation: 'asc' }],
  take: ADMIN_ACTIVITE_MAX, select: RESERVATION_SELECT + company ref })`. Scopé par le `resolveReadScope`
  existant : SA voit ccdpaa (seul site à en avoir), AF ccdpaa voit les siennes, AF entretien → `[]` → section
  omise.
- **Type** : `AdminDashboardDto.prochainesReservations: readonly AdminReservationDto[]` (`shared/types/admin.ts`,
  extension non cassante — champ additionnel, la page dashboard ne casse pas).
- **Front** : section « Prochaines réservations » après « Derniers messages » (modèle `index.vue:132-161`) :
  ligne « {nom} · {N} personnes », `formatDateHeureQuebec(dateReservation)`, Badge statut, chaque ligne lien vers
  `/admin/ccdpaa/reservations` ; lien « Voir toutes les réservations » si non vide ; la section disparaît
  entièrement si vide (pas de texte « Aucune réservation à venir. »).

## 6. E2E — `tests/e2e/admin-reservations.spec.ts`

Contre le **build de production** (même outillage que `admin-placement.spec.ts` : `loginAs`, marqueurs,
`apiAs`). Isolation : marqueur dédié.

- **API** :
  - 401 sans session (GET + PATCH) ; 403 `ADMIN_FILIALE_ENTRETIEN` ; 403 `EMPLOYE_ENTRETIEN`.
  - 400 : `statut=INVALIDE`, `page=0`, PATCH `{statut:'X'}`, PATCH `{statut:'CONFIRMEE', note:'a'}` (strict),
    uuid malformé (`abc`) → 400 et non 500.
  - Liste seedée (25) : visible SA et AF ccdpaa, aucun `id`/`companyId` dans la réponse, en-tête `no-store` ;
    `q` sur nom unique du seed ; filtre `statut=EN_ATTENTE` ; pagination 2 pages, survie filtres+page au
    rechargement.
  - PATCH : 200 + DTO à jour (statut, `dateReservation` ISO inchangée) ; 404 uuid inconnu.
  - **Annulation → re-réservation** (l'index partiel) : POST public → PATCH ANNULEE → re-POST identique →
    201 et **2 lignes** (cas impossible avec un index non partiel).
  - **P2002 admin** : sur le seed, deux lignes même courriel + même date (une ANNULEE, une EN_ATTENTE) →
    PATCH la ligne ANNULEE vers CONFIRMEE → **409**.
- **UI** : SA : item de nav visible, page, liste seedée, changement de statut → toast exact « Réservation mise
  à jour. » + Badge à jour ; AF ccdpaa : page OK ; AF entretien : item absent de la nav, page directe → état
  erreur ; 375 px : pas de défilement horizontal, cibles ≥ 44 px. Dashboard : section « Prochaines réservations »
  visible (SA), lien vers la page ; masquée pour AF entretien.
- **Régression lot 3** : `ccdpaa-restaurant.spec.ts` — « double clic » et « api-idem » verts
  **sans modification**, post-migration.
- **Isolation des données** :
  - Nouveau `--seed-reservations <m>` / `--purge-reservations <m>` dans `scripts/cleanup-test-data.ts`
    (symétrique `--seed-placement`/`--purge-placement`) : 25 `ReservationRestaurant` ccdpaa, courriels
    `resa-<i>-<m>@example.test`, dates J+2..J+26 (une par ligne, via `instantQuebec`), statuts variés, dont le
    couple ANNULEE/EN_ATTENTE même courriel+même créneau ; purge `deleteMany` sur courriels suffixés.
  - Réservations créées par l'API publique pendant les tests : purgées via le mécanisme existant de
    `cleanup-test-data.ts` (helper `inspecterReservations` `tests/e2e/helpers/db.ts`) ;
    helpers `semerReservations`/`purgerReservations` dans `tests/e2e/helpers/db.ts`.
  - Ajouter `ADMIN_FILIALE_CCDPAA` à `tests/e2e/helpers/auth.ts` (`admin@ccdpaa.groupecd.ca`,
    `SEED_ADMIN_FILIALE_PASSWORD`, `prisma/seed/accounts.ts:54`).

## 7. Tests unitaires

- `tests/unit/reservation-idempotence.test.ts` (étendre l'existant) : `ecrireIdempotent` — `tenter` levant
  P2002 → `'existante'` **sans relecture** ; P2034 → relecture puis selon résultat ; 40001 (`meta.code`) → idem ;
  seconde erreur quelconque → remonte. Pure : closures simulées, zéro Prisma/mail/storage à mocker.
- `tests/unit/reservation-admin-validation.test.ts` : `reservationsQuerySchema` (page coerce 1..10000 défaut 1,
  `q` trim ≤ borne, vide → undefined, statut enum, `.strict()` → champ inconnu refusé) ;
  `reservationUpdateSchema` (enum strict, champ inconnu refusé) ; `STATUT_RESERVATION_LABELS` couvre l'enum.
- `tests/unit/reservation-mapping.test.ts` (existant) : étendre avec `toReservationDto` — aucune clé `id`/
  `companyId`, `dateReservation`/`createdAt` en ISO, `site` = AdminSiteRef.

## 8. Découpe en tâches (périmètres disjoints)

- **T0 (fil principal)** : migration déjà écrite (§1, exécution par l'utilisateur AVANT T3) ;
  `shared/validation/reservation.ts` (`statutReservationSchema`, `reservationsQuerySchema`,
  `reservationUpdateSchema`) ; `shared/types/admin.ts` (`StatutReservationDto`, `AdminReservationDto`,
  `AdminDashboardDto.prochainesReservations`) ; `shared/config/admin.ts` (`STATUT_RESERVATION_LABELS`).
- **T1 backend** : `server/lib/reservation.ts` (P2002), `server/services/admin/reservations.ts`,
  `server/services/admin/dashboard.ts`, `server/api/admin/reservations/{index.get,[uuid].patch}.ts`, tests
  unitaires §7. Ne touche pas `app/**`, `tests/e2e/**`, `scripts/**`.
- **T2 frontend** : page + `app/components/admin/reservations/**`, nav (`admin-nav.ts`), section dashboard
  (`app/pages/admin/index.vue`).
- **T3 e2e** : `scripts/cleanup-test-data.ts` (seed/purge), `tests/e2e/helpers/{db,auth}.ts`,
  `tests/e2e/admin-reservations.spec.ts`, relance `ccdpaa-restaurant.spec.ts` (régression).
- **T4 revues + visuel** : reviewer + ux-reviewer en parallèle, un seul build prod, captures 375/768/1440 de
  `/admin/ccdpaa/reservations` **et** `/admin` (section nouvelle), pas de vidéo (aucune chorégraphie nouvelle —
  select inline déjà couvert au lot 5 placement).

## 9. Critères d'acceptation

1. `pnpm typecheck`, `pnpm test:unit` (§7), `pnpm build:check` passent.
2. Migration appliquée par l'utilisateur ; index présent en base ; `prisma migrate diff` migrations→schéma vide.
3. Public : 2 POST identiques → 1 ligne, 201 silencieux, 1 accusé ; re-POST après annulation → 201 + 2ᵉ ligne ;
   e2e lot 3 vert sans modification.
4. AF ccdpaa : voit la page et ses réservations uniquement. AF autre filiale / EMPLOYE : 403 sur toutes les
   routes du module, item de nav absent. Aucune réponse avec `id`/`companyId`.
5. PATCH : 200 + toast « Réservation mise à jour. » + Badge à jour ; 400 body/params ; 404 uuid inconnu ;
   409 sur réactivation en conflit avec l'index (revert du Select + toast).
6. Liste : `q`/`statut`/`page` dans l'URL, survivent au rechargement ; pagination 25 → 2 pages ; table ≥ 1024 px,
   liste empilée dessous ; états squelette/erreur/vide/vide filtré conformes.
7. Dashboard : « Prochaines réservations » scopées, lien vers la page, omises si vides ; captures lot 4 de
   `/admin` non régressées.
8. Aucun `alert`/`confirm`/`console.log`/`v-html`/dégradé/badge décoratif ; AA ; cibles ≥ 44 px sous `md` ;
   375 px sans défilement horizontal.
9. E2e vert desktop + mobile contre le build prod ; purge des marqueurs vérifiée.

## 10. Risques / écarts assumés

- **Index partiel invisible pour Prisma** : risque de dérive à tout futur `migrate dev` — règle de refus du
  DROP documentée (migration + PROJECT_STATE), diff vérifié vide ce jour.
- **Pas de badge compteur EN_ATTENTE** dans la nav (décision ; point ouvert n°1 si demande client).
- **Pas de DELETE admin** : le prototype n'en a pas ; l'effacement Loi 25 des réservations (durée de conservation
  d'un Nom/courriel de réservation) est à faire valider par le juriste avec Q-01 — pas improvisé.
- **Pas de courriel au client** quand CONFIRMEE/ANNULEE (Q-10 ouvert, mailer non branché).
- **Ordre `dateReservation` desc** (fidèle au prototype) : les réservations passées non annulées restent en
  liste, retrouvables via recherche/filtre ; pas de filtre par date (hors périmètre, volumes faibles).
- **Concurrence Serializable conservée en plus de l'index** (ceinture + bretelles) : le `findFirst` évite le
  P2002 dans le cas séquentiel, l'index garantit l'invariant quoi qu'arrive ; coût négligeable.
- **E2E sur Brave** via `PW_CHROMIUM_PATH` (contrainte lot 5 placement toujours vraie : Chromium 1234 absent,
  `playwright install` interdit).

## Points ouverts (défaut retenu)

| # | Point | Défaut |
|---|---|---|
| 1 | Badge « n en attente » dans la nav | Non (aucun autre module n'a de compteur ; exigerait d'étendre le contrat `compteurs`) |
| 2 | DELETE admin d'une réservation | Non (prototype) ; effacement Loi 25 → juriste (Q-01) |
| 3 | Courriel de confirmation/annulation au client | Non (Q-10, mailer à brancher) |
| 4 | Filtre par date / vue « à venir » dans la page admin | Non (ordre desc du prototype, recherche suffit aux volumes actuels) |
| 5 | Statut horodaté (`confirmeeLe`) | Non demandé par le prototype ni la décision Loi 25 ; à rouvrir si le client veut tracer |
