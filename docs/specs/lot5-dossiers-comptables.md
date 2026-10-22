# Lot 5 — Sous-lot dossiers comptables (spec)

Source de vérité pour la conversion de `prototype_react/.../admin.comptable.tsx` (« Dossiers clients »)
vers Nuxt. Même format et mêmes méthodes que `lot5-reservations.md` / `lot5-planning.md`.

## 1. Périmètre et route

| Élément | Valeur |
|---|---|
| Route UI | `/admin/comptable/dossiers` (PROJECT_STATE ligne à convertir) |
| Redirect | `/admin/comptable` → `/admin/comptable/dossiers` (page coquille = `navigateTo`) |
| Rôles | `SUPER_ADMIN` + `ADMIN_FILIALE` comptable (403 autres, nav masquée via module) |
| Module | `MODULES.COMPTABLE` (activé uniquement sur le site `comptable`) |
| Prototype | table remplacée par une **liste en lignes** identique au prototype (entreprise en titre, ligne secondaire, badge statut, actions) ; tri par échéance croissante |

Aucune migration : `Client` + `DossierComptable` (+ enums `ForfaitComptable`, `StatutDossier`) existent déjà.

## 2. API — routes Nitro (`server/api/admin/comptable/dossiers/`)

`requireRole(event, ROLES_GESTION)` partout. Filiale forcée côté serveur : `resolveWriteCompany(ctx, 'comptable')`
pour les écritures ; lecture : filiale résolue depuis `secure.companyId` (AF) ou slug `comptable` (SA) —
jamais de `?site=` libre (site unique : pas de sélecteur). `uuid` validé `z.string().uuid()`, résolu `where: { uuid }`.

| Route | Entrée (zod) | Sortie | Erreurs |
|---|---|---|---|
| `GET /api/admin/comptable/dossiers` | `dossiersQuerySchema { statut?: StatutDossier, page (défaut 1) }` | 200 `AdminDossiersPageDto = AdminPage<AdminDossierComptableDto> & { enRetard: number }` (`enRetard` = total global, indépendant de la page/filtre — comme le prototype) | 400 (query), 401, 403 |
| `POST …/dossiers` | `dossierCreateSchema` + `.strict()` | 201 `AdminDossierComptableDto` | 400 (zod), 401, 403, 409 (email déjà pris dans la filiale comptable) |
| `PATCH …/dossiers/[uuid]` | `dossierUpdateSchema` = create partiel, au moins un champ, strict | 200 DTO | 400, 401, 403, 404, 409 |
| `DELETE …/dossiers/[uuid]` | — | 204 | 401, 403, 404 |

Comportements métier :
- **Un dossier crée aussi son `Client`** (relation 1-1 unique) dans la même transaction :
  `Client { companyId comptable, nom = contact, entreprise, email (minuscules), statut CLIENT_ACTIF }`.
  `statut` client et `telephone` non exposés dans le formulaire (prototype) — statut fixé `CLIENT_ACTIF`,
  `derniereInteraction = now` à la création et à chaque PATCH.
- **DELETE = dossier seul** : le `Client` survit dans le carnet CRM (`/admin/clients`). Écart justifié :
  le client est une entité CRM partagée ; le dossier est l'extension filière. `onDelete: Cascade` reste
  client → dossier.
- Conflit email : vérif explicite (insensible à la casse, filiale comptable) → 409
  « Ce courriel existe déjà pour cette filiale. » (même libellé que le module clients).
- `echeance` obligatoire (prototype : « échéance requise ») ; date ISO `YYYY-MM-DD`, stockée
  UTC minuit, renvoyée `YYYY-MM-DD` via `formatDateISO`.
- Tri liste : `echeance` asc (nulls en dernier, défensif), puis `id` desc. Aucun ordre alphabétique.
- Sélecteurs explicites `select` (uuid seul exposé, jamais `id`/`clientId`/`companyId`).

## 3. Shared

`shared/validation/comptable.ts` (imports relatifs + zod explicite, tout `.strict()`) :
- `statutDossierSchema = z.enum(['A_JOUR', 'EN_TRAITEMENT', 'EN_RETARD'])`
- `forfaitComptableSchema = z.enum(['MENSUEL', 'TRIMESTRIEL', 'ANNUEL'])`
- `dossiersQuerySchema { statut?, page }`
- `dossierCreateSchema { entreprise (1..120), contact (1..120 = Client.nom), email, forfait, echeance (dateISO valide), statut (défaut A_JOUR), notes (vide→null, ≤2000) }`
- `dossierUpdateSchema = exigerAuMoinsUnChamp(create.partial())`

`shared/config/admin.ts` : `STATUT_DOSSIER_LABELS` (« À jour » / « En traitement » / « En retard »),
`FORFAIT_COMPTABLE_LABELS` (« Mensuel » / « Trimestriel » / « Annuel »).
`shared/types/admin.ts` : `AdminDossierComptableDto { uuid, entreprise, contact, email, forfait,
echeance (YYYY-MM-DD), statut, notes }`, `AdminDossiersPageDto`, types DTO enums.

## 4. Frontend

- `app/pages/admin/comptable.vue` : redirect vers `/admin/comptable/dossiers` (middleware admin conservé).
- `app/pages/admin/comptable/dossiers.vue` : coquille (meta layout admin + middleware + roles),
  `AdminPageHeader titre="Dossiers clients"` + compteur `« {total} dossier(s) · {enRetard} en retard »`,
  filtres (`AdminFilterSelect` statut seul — pas de recherche, parité prototype), liste + pagination
  via `useAdminPagedList` + `AdminPagination`.
- Composants `app/components/admin/comptable/` :
  - `DossiersList.vue` : **lignes** (article empilé mobile, `md:grid-cols-[1fr_auto]` — structure du
    prototype), ligne secondaire « contact · courriel · forfait X · échéance JJ mois YYYY », notes en
    petit, badge statut (mapping prototype : A_JOUR → outline, EN_TRAITEMENT → secondary, EN_RETARD →
    default), boutons icônes Modifier/Supprimer (aria-labels nominatifs, cibles ≥44px mobile).
  - `DossierFormDialog.vue` : VeeValidate + `dossierCreate/dossierUpdate` (zod partagé), champs du
    prototype dans le même ordre : Entreprise*, Contact*, Courriel*, Forfait*, Prochaine échéance*
    (`type="date"`), Statut, Notes. Erreurs sous champs. Fermeture seulement après succès.
  - Suppression : `CmsDeleteDialog` « Supprimer ce dossier ? » + « Cette action est définitive. »
- Toasts (libellés exacts du prototype) : « Dossier ajouté. » / « Dossier mis à jour. » /
  « Dossier supprimé. ». Validation serveur en doublon (zod).
- Nav (`app/config/admin-nav.ts`) : `{ to: '/admin/comptable/dossiers', label: 'Dossiers',
  icon: Calculator, roles: ROLES_GESTION, module: MODULES.COMPTABLE }`.

## 5. Écarts assumés (vs prototype)

- **Pas d'upload de documents** (`documentsKeys`) ni champ `typeDeclaration` dans ce sous-lot : le
  prototype ne les expose pas (écran liste pur). Pipeline fichiers prêt (`saveUploadedFile`) pour un lot
  ultérieur.
- Pagination serveur ajoutée (`AdminPagination`, page 20) alors que le prototype affiche tout : cohérence
  avec tous les autres lots admin.
- Suppression = dossier seul, client CRM conservé (§2).
- Toast de validation du prototype (« Entreprise, contact, courriel et échéance sont requis. ») remplacé
  par les erreurs champ par champ (convention des lots 4/5 : VeeValidate sous les champs).
- Pas de compte `ADMIN_FILIALE` comptable seedé (comme transport pour le planning) — le 403 AF inter-module
  est couvert via AF ccdpaa sur comptable.

## 6. Tests

Unitaires (`tests/unit/comptable-validation.test.ts`) : query (statut/page), create (complet, trims,
email minuscules, notes ''→null, échéance ISO valide/invalide), update (partiel non vide, strict,
notes ''→null efface).

E2E (`tests/e2e/admin-comptable.spec.ts`, desktop+mobile, build prod) :
1. 401 non connecté sur les 4 routes.
2. 403 EMPLOYE + 403 AF ccdpaa (module absent de sa filiale) ; nav masquée.
3. GET liste : uuid seulement (`clesInterdites`), `no-store`, tri échéance asc, `enRetard` global.
4. POST 201 (create client+dossier en une transaction), 400 invalides (email, échéance, niveau),
   409 email existant.
5. PATCH 200 (statut + notes vidées → null), 404 uuid inconnu, 409 email d'un autre client, 400 vide.
6. DELETE 204 puis GET ne liste plus ; le Client reste en base (vérif DB ou GET clients si exposé).
7. UI : création par dialog avec erreurs sous champs, édition, suppression via dialog, filtre statut,
   pagination (si > pageSize), toasts, responsive (liste empilée <lg).
