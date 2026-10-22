# Spec lot 5 (sous-lot planning) : 3 plannings datés + mon-planning

Rédigée par l'architect le 2026-10-09 (lecture seule). Sources : `CLAUDE.md`, `PROJECT_STATE.md:57,68,107,153-154`,
`PROJECT_CONTEXT.md:53,88`, `CONVERSION_INVENTORY.md:60-89,490-532,630-710`,
`docs/specs/lot5-placement.md`, `docs/specs/lot5-reservations.md`, `prisma/schema.prisma:380-417`,
`prisma/seed/{demo.ts:120-156,accounts.ts:60-66}`, `shared/config/modules.ts:6-23`, `shared/utils/dates.ts`,
`server/utils/site-scope.ts:118-132`,
`server/services/admin/{dashboard.ts:28-84,reservations.ts:13-124,placement.ts:40-80}`,
`server/api/admin/placement/{candidats.get.ts:10,candidatures/[uuid].patch.ts:12-14}`,
`app/pages/admin/ccdpaa/reservations.vue:15-36`,
`app/components/admin/reservations/ReservationsList.vue:23,43,90`, `app/config/admin-nav.ts:29-64`,
`app/middleware/admin.ts:21-24`, `scripts/cleanup-test-data.ts:30-45`,
`tests/e2e/{admin-reservations.spec.ts:28-83,helpers/auth.ts:23-49}`, prototype `admin.planning.tsx` + `admin.mon-planning.tsx`.

## 0. Résumé, périmètre, routes

Le planning est du **daté** (`dateDebut`/`dateFin`), pas un gabarit hebdo récurrent (E18 tranché en base : `lieu`
ajouté, `titre` nullable, `userId` DEC-29). Ce sous-lot livre la grille semaine + CRUD quarts + lecture employé.

- **Tranché DEC-33** : **3 routes fines** `/admin/{entretien,transport,ccdpaa}/planning` partageant UN composant
  `PlanningView` + UN service (modèle placement 3 routes/onglets-liens), PAS la route unique
  `/admin/planning?site=`. Pourquoi : la checklist exige déjà 3 routes ; `?site=` serait un param client
  contournable alors que le path fige le scope ; cohérent avec `/admin/ccdpaa/reservations`.
- **Tranché SA** : **NON au sélecteur de site** (le prototype en avait un) — les 3 routes sont déjà scopées, le
  SA navigue par les liens. Périmètre = entretien/transport/ccdpaa, jamais la holding.
- **Inclus** : 4 pages, 5 endpoints API, nav, e2e + unitaires, seed e2e `--seed-planning`/`--purge-planning`.
- **Exclus** : CRUD employés (D10/E27 — hors lot, les employés viennent du seed), « dupliquer la semaine »
  (reporté, DEC-28), temps réel (simple re-fetch), pagination (volume borné par 7 j — écart assumé vs lots 4/5),
  courriels (Q-10).
- **Aucune migration** (E18/E19 déjà en base ; le typecheck ne dépend de rien).

| Page | API |
|---|---|
| `/admin/{entretien,transport,ccdpaa}/planning` (×3, wrappers fins) | `GET`+`POST /api/admin/planning/[site]` (`[site]` ∈ entretien\|transport\|ccdpaa) |
| | `PATCH`+`DELETE /api/admin/planning/[site]/[uuid]` |
| `/admin/mon-planning` (EMPLOYE, lecture seule) | `GET /api/admin/mon-planning?semaine=` |

## 1. Modèle & règles

- **Semaine** : `semaine=YYYY-MM-DD` = un **lundi** (validé, sinon 400). Défaut = lundi de la semaine courante.
  Fenêtre `[lundi 00:00 Québec, +7 j)` ; bornes via `instantQuebec` pour la DST. Un quart appartient à la
  semaine de son `dateDebut` (une nuit lun→mar reste au lundi).
- **Fuseau** : affichage `formatDateHeureQuebec` (`America/Toronto`), jamais de recalcul maison.
- **Nuit** : **aucune vérification fin > début** (prototype) ; durée `fin<=début → +24 h`. **Aucun contrôle de
  chevauchement.**
- **Total** : arrondi 0.1 (`Math.round((mins/60)*10)/10`), nuits incluses, calculé serveur (source unique).
- **`actif=false`** : badge « Inactif » sur la ligne employé ; **exclu du select de création** (POST avec son
  uuid → 400) ; quarts existants **conservés et éditables** (pas d'orphelin).
- **Requis** : employé + début + fin + lieu (trim non vide) ; `titre`/`notes` optionnels (vide → undefined).
  Toasts exacts « Quart ajouté. » / « Quart mis à jour. » / « Quart supprimé. ».
- **409 : aucun cas** (pas de contrainte d'unicité ; doublon exact permis comme le prototype).

## 2. API

Règles communes (pattern placement/réservations) : `requireModule(event, MODULES.PLANNING, { site, roles: [SA, AF] })`
— AF autre filiale → 403, EMPLOYE → 403. `site` validé **avant** `requireModule` par
`z.enum(['entretien','transport','ccdpaa'])` (400 si inconnu, jamais 500). `cache-control: no-store`, `select`
explicite uuid-only, `[uuid]` via `z.string().uuid()`. Écritures : semaine **non contrainte** (la semaine n'est
qu'un filtre GET) ; GET retourne `{ semaine, employes[], quarts[] }`.

| Méthode et chemin | Entrée (`.strict()`) | Succès | Erreurs |
|---|---|---|---|
| `GET /api/admin/planning/[site]` | `planningSemaineQuery { semaine?: lundi-ISO }` | 200 `{ semaine, employes: [{uuid,nom,poste,actif}], quarts: [AdminQuartDto] }` (quarts : `dateDebut` dans la fenêtre, tri `dateDebut, employe`) | 400, 401, 403 |
| `POST …/[site]` | `quartCreate { employeUuid, dateDebut, dateFin (datetime ISO), lieu (trim ≥1), titre?, notes? }` ; employé ∈ site **et actif** | 201 `AdminQuartDto { uuid, employeUuid, titre, lieu, dateDebut, dateFin (ISO), notes }` | 400 (lieu vide, ISO invalide, employé inactif), 401, 403, 404 (employé inconnu **ou autre site** — sans fuite d'existence) |
| `PATCH …/[site]/[uuid]` | `quartUpdate` (partiel de create) ; changement d'employé → mêmes règles | 200 `AdminQuartDto` (résolution `findFirst({uuid, companyId})` → 404 « Introuvable ») | 400, 401, 403, 404 |
| `DELETE …/[site]/[uuid]` | — | 204 | 401, 403, 404 |
| `GET /api/admin/mon-planning?semaine=` | `requireRole(event, [EMPLOYE])` (**pas** `requireModule` ; 403 SA/AF) ; employé résolu par `secure.userId` (DEC-29, jamais de param client) | 200 `{ employe: {nom, poste}, semaine, quarts: [{uuid,titre,lieu,dateDebut,dateFin,notes}], totalHeures }` | 401, 403 (non-EMPLOYE), 404 « Aucun dossier employé associé à votre compte. » si non lié, 400 (semaine non-lundi) |

Service : `server/services/admin/planning.ts` (modèle placement/réservations) — `PLANNING_SELECT`, `toQuartDto`,
`listSemaine`, `createQuart`, `updateQuart`, `deleteQuart`, `getMonPlanning`.

## 3. Frontend

- **3 pages** `app/pages/admin/{entretien,transport,ccdpaa}/planning.vue` : wrappers fins (même
  `definePageMeta({ middleware:'admin', layout:'admin', roles:[SA,AF] })`), passant `site` à `PlanningView.vue`.
  Titre « Planning hebdomadaire », description « Les quarts assignés apparaissent aussitôt dans « Mon planning »
  des employés. » (libellé d'interface).
- **`PlanningView.vue`** (partagé) : `useAdminListQuery` avec `semaine` dans l'URL ; navigation ◀ ▶ + « Cette
  semaine » ; grille lignes=employés × colonnes lun→dim, cellule « HH:mm–HH:mm » + lieu + boutons Pencil/Trash2
  (`aria-label`) ; **table ≥1024px / liste empilée dessous** (`useMediaQuery`) ; `QuartDialog` (VeeValidate+zod,
  employé/lieu/début/fin, pré-rempli au jour cliqué) + `AlertDialog` suppression « Supprimer ce quart ? /
  L'employé ne le verra plus dans son planning. », **fermés seulement après succès** ; toasts exacts §1 ;
  `AdminListState` (vide « Aucun employé pour ce site. », erreur 403 → état erreur) ; cibles ≥44px sous md,
  375px sans scroll horizontal.
- **`mon-planning.vue`** (`roles:[EMPLOYE]`) : lecture seule, en-tête « Mon planning » + « {nom} — {poste} » +
  total, 7 jours (« Congé » si vide), **+ navigation semaine** (écart assumé : le prototype n'en a pas, requis
  par `GET semaine=`).
- **Nav** (`admin-nav.ts`) : étendre `AdminNavItem` avec `site?: SiteSlug` + filtrer dans `visibleNavItems`
  (aujourd'hui module seul — sinon l'AF entretien verrait 3 items) ; 3 items planning (`module: PLANNING`,
  icône fonctionnelle lucide) + item `{ to:'/admin/mon-planning', roles:[EMPLOYE] }` (ni SA ni AF).
  **Middleware** (`app/middleware/admin.ts`) : EMPLOYE sur `/admin` → redirect `/admin/mon-planning`.

## 4. E2E — `tests/e2e/admin-planning.spec.ts` (build prod, modèle `admin-reservations.spec.ts`)

- **API** : 401 sans session (GET/POST/PATCH/DELETE, mon-planning) ; 403 AF transport sur site entretien,
  403 AF ccdpaa sur mon-planning, 403 EMPLOYE sur planning ; 400 (`semaine` non-lundi, `site=holding`, uuid `abc`,
  lieu vide, ISO invalide) ; GET semaine seedée : employés+quarts du site uniquement, aucun `id`/`companyId`,
  `no-store` ; POST 201 (+ employé inactif → 400, employé autre site → 400/404) ; PATCH 200 / 404 uuid inconnu /
  404 hors site ; DELETE 204 + 404 ; **nuit** (fin<début acceptée, durée +24 h au total) ; **semaine vide** →
  `{ employes, quarts: [] }` ; **scoping** : quart entretien invisible côté transport ; **mon-planning** :
  200 EMPLOYE (quarts + total, semaine courante par défaut, `?semaine=` navigue), 403 SA/AF, employé sans dossier
  → 404 explicite (compte EMPLOYE non lié — à créer au seed si absent, sinon via l'admin transport sans lien).
- **UI** : grille seedée, création/édition/suppression + toasts exacts, navigation semaine reflétée dans l'URL,
  375px (pas de scroll horizontal, cibles ≥44px), AF autre filiale → état erreur + items nav absents,
  mon-planning lecture seule (aucun bouton CRUD) + total affiché.
- **Isolation** : `--seed-planning <m>` / `--purge-planning <m>` — employés `e2e-<m>` (dont 1 `actif=false`) +
  quarts **datés relatifs à la semaine courante** (`instantQuebec`, `ajouterJoursIso`) ; ajouter
  `ADMIN_FILIALE_TRANSPORT` à `helpers/auth.ts` (vérifier `prisma/seed/accounts.ts`).
- **Régressions** : `admin-shell` (nav : 3 items SA, 1 item AF, mon-planning EMPLOYE).

## 5. Tests unitaires

`semaineSchema` (lundi OK / dimanche+format → 400, défaut = lundi courant Québec) ; `quartCreate/Update`
(lieu trim, nuit acceptée, chevauchement ignoré, `.strict()`) ; `toQuartDto` (uuid-only, ISO) ; `dureeMinutes`
(nuit +24 h) + `totalHeures` (arrondi 0.1, cas prototype) ; `lundiDeSemaineQuebec` (dont DST) ;
`JOURS_FR` couvre lun→dim.

## 6. Découpe (périmètres disjoints, fichiers exacts)

- **T0 (fil principal)** : `shared/validation/planning.ts` (semaine/quart/mon-planning schemas),
  `shared/types/admin.ts` (`AdminQuartDto`, `AdminEmployePlanningDto`, `PlanningSemaineDto`, `MonPlanningDto`),
  `shared/config/planning.ts` (`PLANNING_SITES`, `JOURS_FR`), `shared/utils/planning.ts`
  (`lundiDeSemaineQuebec`, `dureeMinutes`, `totalHeures`) + tests §5.
- **T1 backend** : `server/services/admin/planning.ts`,
  `server/api/admin/planning/[site]/{index.get.ts,index.post.ts,[uuid].patch.ts,[uuid].delete.ts}`,
  `server/api/admin/mon-planning.get.ts`. Ne touche pas `app/**`, `tests/e2e/**`, `scripts/**`.
- **T2 frontend** : `app/components/admin/planning/{PlanningView,QuartDialog}.vue`,
  `app/pages/admin/{entretien,transport,ccdpaa}/planning.vue`, `app/pages/admin/mon-planning.vue`,
  `app/config/admin-nav.ts`, `app/middleware/admin.ts`.
- **T3 e2e** : `scripts/cleanup-test-data.ts`, `tests/e2e/helpers/{auth,db}.ts`,
  `tests/e2e/admin-planning.spec.ts`.
- **T4** : reviewer + ux-reviewer en parallèle, un seul build prod, captures 375/768/1440 des 4 pages,
  **pas de vidéo** (Dialog standard déjà couvert au lot 5).

## 7. Critères d'acceptation

1. `pnpm typecheck`, `pnpm test:unit` (§5), `pnpm build:check` passent.
2. AF ne voit que son site (403 + nav), EMPLOYE que mon-planning (403 planning, 404 explicite si non lié) ;
   aucune réponse avec `id`/`companyId`.
3. Nuit acceptée sans vérification fin>début, total +24 h/arrondi 0.1 ; aucun contrôle de chevauchement ;
   aucun 409.
4. Employé inactif : badge, hors select, POST → 400, quarts existants intacts.
5. `semaine` dans l'URL, survit au rechargement ; semaine vide → grille vide propre.
6. Toasts exacts, dialogs fermés après succès, 375px sans scroll, cibles ≥44px, aucun
   `alert`/`confirm`/`console.log`/`v-html`/dégradé.
7. E2e vert desktop+mobile sur build prod ; purge marqueurs vérifiée ; `admin-shell` non régressée.

## 8. Risques / écarts + points ouverts

- **Routes `[site]`+`[uuid]`** : conflit de param routing Nitro à valider au T1 (fichiers distincts `index.*`
  vs `[uuid].*`, standard).
- **Bornes DST** : semaine calculée en mural Québec (`instantQuebec`), jamais en UTC naïf.
- **Écart prototype** : sélecteur 6 filiales supprimé (3 routes scopées) ; AF « quelle qu'elle soit » restreint
  aux 3 sites PLANNING (comptable/placement/boissons → 403 + nav masquée) ; navigation semaine ajoutée à
  mon-planning.
- **Tri secondaire** : `{ dateDebut asc, id asc }` (déterministe) au lieu de « dateDebut, employe » de la spec
  initiale — l'ordre d'affichage regroupe par employé côté front de toute façon.
- **Nav EMPLOYE** : « Tableau de bord » masqué (redirigé vers mon-planning, l'item serait une cible
  jamais atteignable) ; branche « Aucun module disponible » de `/admin` supprimée (code mort).

| # | Point | Défaut |
|---|---|---|
| 1 | « Dupliquer la semaine » | Non (DEC-28 reporté) |
| 2 | CRUD employés / lien User↔Employé admin | Non (D10/E27 ; seed seul) |
| 3 | Employé multi-sites | Non (1 `companyId`, scoping existant) |
| 4 | Vue manager (SA/AF voient mon-planning d'un employé) | Non (403 ; la grille planning couvre le besoin) |
| 5 | `en_congé` distinct d'inactif | Non (booléen, prototype sans effet métier) |
