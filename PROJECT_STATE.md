# PROJECT_STATE.md — Groupe CD

Ce fichier est le **suivi vivant** du projet : il change à chaque session de travail. Contrairement à `PROJECT_CONTEXT.md` (stable, architecture et contexte métier) et `CLAUDE.md` (stable, règles de travail), ce fichier doit être mis à jour par tout agent qui termine une unité de travail — avant de rendre la main.

**Règle pour tout agent** : en fin de session, mettre à jour la section "Avancement" et "Prochaine étape recommandée" ci-dessous. Ne jamais laisser ce fichier désynchronisé de l'état réel du code.

---

## Phase actuelle

**Conversion — phase 2 (fondations communes) ✅ (2026-09-25) → phase 3 (route par route).** Phase 1 ✅ (décisions tranchées). Spec : `docs/specs/phase2-foundations.md`.

Le prototype React (Lovable) est **terminé et figé** : https://cd-holding-nexus.lovable.app/, source dans `prototype_react/`. Il ne sera plus modifié — c'est uniquement une référence de conversion.

## Avancement

| Étape | Statut |
|---|---|
| Décisions d'architecture (rendu, ORM, auth, stockage, hébergement) | ✅ Fait — voir `PROJECT_CONTEXT.md` §4 |
| `PROJECT_CONTEXT.md` | ✅ Fait |
| `PROJECT_STATE.md` | ✅ Fait (ce fichier) |
| `CLAUDE.md` | ✅ Fait (+ section Stack réelle) |
| Prompt de setup Nuxt (scaffold, dépendances, schema Prisma, auth, upload) | ✅ Fait (`prompt_setup.md`) |
| Scaffold du projet Nuxt réellement exécuté | ✅ Fait et vérifié 2026-09-25 — migration `init`, seed, checklist étape 16 OK (API : `401/403/404/415`, scoping filiale, upload/lecture fichier ; UI Playwright : garde `/admin`, login/logout, validation, toast, Button) |
| Conversion des routes — voir checklist ci-dessous | ❌ Pas commencé |
| Phase 1 — Inventaire (`CONVERSION_INVENTORY.md`) | ✅ Décisions tranchées 2026-09-25 ; captures 54/54 routes (162 PNG, `conversion-captures/`, non versionné) |
| Phase 2 — Fondations communes | ✅ 2026-09-25 — T0–T4 (`8e9853d`, `acdea64`) · T5 e2e (`dc46a64`, `bbbf334`) : 37 ✅ / 2 skip justifiés (desktop/mobile/tablet, build prod) · T6 reviewer 8.5/10 (`e1f0576`) + ux-reviewer (contrastes AA, `c08a66b`) · correctifs : suppression CMS inopérante (`116b6c9`), placeholders `{groupe}`/`{nomCourt}` non interpolés, `--site-accent-strong` figé sur navy · 299 tests unitaires ✅ |

## Checklist de conversion par route (à remplir au fur et à mesure)

Convention de statut : ❌ pas commencé · 🔧 en cours · 👀 à vérifier (Playwright) · ✅ fait et vérifié

### Holding

| Route | Statut | Notes |
|---|---|---|
| `/` | ✅ | Converti et vérifié 2026-09-26 (spec `docs/specs/phase3-holding-home.md`, écarts assumés §4.3). e2e `home.spec.ts` ✅, captures 3 breakpoints + vidéos (reveal, ancre `#filiales`, menu mobile) ✅. Liens `/{filiale}`, `/contact`, `/realisations` en 404 jusqu'à leur conversion |
| `/a-propos` | ✅ | Vérifié 2026-09-26 : captures 3 breakpoints (défilement pas à pas) + vidéo reveal équipe/partenaires, e2e ✅ |
| `/contact` | ✅ | Vérifié 2026-09-28 (spec `docs/specs/phase3-holding-contact.md`). Contrats curl ✅ (201, honeypot 201 sans écriture, NUL 400, 411/413/415, 429 + Retry-After), e2e `contact.spec.ts` ✅, captures 3 breakpoints ✅, parcours vidéo (envoi vide → erreurs, envoi valide → 201 + toast) ✅. Base de dev : surtitre/SEO CONTACT holding encore aux anciennes valeurs (seed en amorçage) → éditer dans `/admin/contenu` |
| `/realisations` | ✅ | Lot 1 (2026-09-28) : absente du prototype, page dédiée (DEC-39), réalisations propres à la holding, composant partagé `RealisationsListe` |
| `/confidentialite` | ✅ | Lot 1 (2026-09-28) : section `legal`, accessible pendant une maintenance (`bypassMaintenance`), e2e + captures ✅. Texte à faire valider par un juriste (Q-01) |
| `/admin/login` | ❌ | |
| `/admin` (shell dashboard) | ❌ | |
| `/admin/contenu/*` (CMS services/réalisations/équipe/partenaires + onglet Site) | 👀 | Onglet « Site » (fiche société : secteur, description, image, coordonnées, réseaux ; nom/ordre SUPER_ADMIN) ajouté 2026-09-26, e2e `admin-site.spec.ts` ✅. CRUD + réordonnancement + sections + réglages site, e2e ✅. Écart assumé : sections éditées un site à la fois (prototype : 7 sites sur une page) — contrainte API `GET …/sections` |
| `/admin/messages` | ❌ | |
| `/admin/clients` | ❌ | CRM |

### Chaudetcha Entretiens et Sanitations (`entretien`)

| Route | Statut | Notes |
|---|---|---|
| `/entretien` | ✅ | Lot 1 (2026-09-28) : page générique `[filiale]/index.vue`, e2e desktop+mobile ✅, captures 3 breakpoints ✅ |
| `/entretien/services` | ✅ | Lot 1 : `[filiale]/services.vue`, inclut "Nettoyage et entretien des supermarchés" (retour client), e2e (dont édition CMS immédiate) + captures ✅ |
| `/entretien/realisations` | ✅ | Lot 1 : `[filiale]/realisations.vue`, e2e + captures ✅ |
| `/entretien/a-propos` | 👀 | Page générique `[filiale]/a-propos.vue`, e2e accent ✅. Contraste initiales équipe sur navy corrigé 2026-09-26 (`SiteImage` tone). Entretien vérifié (captures 3 breakpoints) ; autres filiales : même page générique, recapture rapide avant ✅ |
| `/entretien/contact` | ✅ | Lot 2 (2026-09-28) : `[filiale]/contact.vue` piloté par `CONTACT_FORMS` (option supermarché, Q-05), e2e desktop+mobile + captures ✅ |
| `/admin/entretien/planning` | ❌ | Module planning partagé |

### Chaudetcha Transport et Logistique (`transport`)

| Route | Statut | Notes |
|---|---|---|
| `/transport` | ✅ | Lot 1 (2026-09-28) : page générique, e2e ✅ (captures faites sur entretien/placement/ccdpaa, même page) |
| `/transport/services` | ✅ | Lot 1 : page générique, e2e ✅ |
| `/transport/realisations` | ✅ | Lot 1 : page générique, e2e ✅ |
| `/transport/a-propos` | 👀 | Page générique `[filiale]/a-propos.vue`, e2e accent ✅. Contraste initiales équipe sur navy corrigé 2026-09-26 (`SiteImage` tone). Entretien vérifié (captures 3 breakpoints) ; autres filiales : même page générique, recapture rapide avant ✅ |
| `/transport/contact` | ✅ | Lot 2 : date souhaitée bornée (aujourd’hui → +365 j, fuseau Québec), e2e + captures ✅ |
| `/admin/transport/planning` | ❌ | Module planning partagé |

### CD Tenue de Livre Comptable (`comptable`)

| Route | Statut | Notes |
|---|---|---|
| `/comptable` | ✅ | Lot 1 (2026-09-28) : page générique, e2e ✅ |
| `/comptable/services` | ✅ | Lot 1 : services mis à jour (états financiers, T1/T2, création/régularisation d'entreprise), e2e + captures ✅ |
| `/comptable/realisations` | ✅ | Lot 1 : page générique, e2e ✅ |
| `/comptable/a-propos` | 👀 | Page générique `[filiale]/a-propos.vue`, e2e accent ✅. Contraste initiales équipe sur navy corrigé 2026-09-26 (`SiteImage` tone). Entretien vérifié (captures 3 breakpoints) ; autres filiales : même page générique, recapture rapide avant ✅ |
| `/comptable/contact` | ✅ | Lot 2 : options de besoin complétées (T1/T2, création, régularisation — Q-04), e2e + captures ✅ |
| `/admin/comptable/dossiers` | ❌ | Module dossiers clients (`DossierComptable`) |

### Placement CD Pro (`placement`)

| Route | Statut | Notes |
|---|---|---|
| `/placement` | ✅ | Lot 1 (2026-09-28) : double audience via section `audiences` (duo), e2e + captures ✅. Lien « Offres » en 404 jusqu'au lot 3 |
| `/placement/services` | ✅ | Lot 1 : page générique, e2e ✅ |
| `/placement/realisations` | ✅ | Lot 1 : page générique, e2e ✅ |
| `/placement/a-propos` | 👀 | Page générique `[filiale]/a-propos.vue`, e2e accent ✅. Contraste initiales équipe sur navy corrigé 2026-09-26 (`SiteImage` tone). Entretien vérifié (captures 3 breakpoints) ; autres filiales : même page générique, recapture rapide avant ✅ |
| `/placement/contact` | ✅ | Lot 2 : formulaire employeur seul (candidats → `/placement/offres`, lot 3), e2e + captures ✅ |
| `/placement/offres` | ❌ | Liste publique des offres publiées (`DemandeClient.publiee`) |
| `/placement/offres/[id]/postuler` (ou modal) | ❌ | Formulaire complet : adresse complète, poste + "Autre" avec mini-champ, CV requis + autres documents optionnels |
| `/admin/placement/candidats` | ❌ | Vivier interne |
| `/admin/placement/demandes` | ❌ | Demandes clients + toggle "Publier comme offre" |
| `/admin/placement/candidatures` | ❌ | Candidatures reçues, statut nouvelle/en_revision/retenue/rejetee |

### CCDPAA (`ccdpaa`)

| Route | Statut | Notes |
|---|---|---|
| `/ccdpaa` | ✅ | Lot 1 (2026-09-28) : duo métiers (section `metiers`), e2e + captures ✅. Lien « Restaurant » en 404 jusqu'au lot 3 |
| `/ccdpaa/services` | ✅ | Lot 1 : page générique, SANS l'assistant import-export (ligne dédiée ci-dessous), e2e ✅ |
| `/ccdpaa/realisations` | ✅ | Lot 1 : page générique, e2e ✅ |
| `/ccdpaa/a-propos` | 👀 | Page générique `[filiale]/a-propos.vue`, e2e accent ✅. Contraste initiales équipe sur navy corrigé 2026-09-26 (`SiteImage` tone). Entretien vérifié (captures 3 breakpoints) ; autres filiales : même page générique, recapture rapide avant ✅ |
| `/ccdpaa/contact` | ✅ | Lot 2 : contact B2B + formulaire suggestion de produit (`SUGGESTION_PRODUIT`), e2e + captures ✅ |
| `/ccdpaa/restaurant` | ❌ | 6ᵉ page — "Les Ambassades d'Afrique" + réservation |
| Widget "Assistant Import-Export" | ❌ | Scripté (Q&A pré-écrites), explicitement PAS une vraie IA — voir `PROJECT_CONTEXT.md` |
| `/admin/ccdpaa/planning` | ❌ | Planning restaurant |
| `/admin/ccdpaa/reservations` | ❌ | |

### CD Boissons d'Afrique (`boissons`)

| Route | Statut | Notes |
|---|---|---|
| `/boissons` | ✅ | Lot 1 (2026-09-28) : page générique, e2e ✅ |
| `/boissons/services` | ✅ | Lot 1 : page générique, e2e ✅ |
| `/boissons/realisations` | ✅ | Lot 1 : page générique, e2e ✅. Mentions légales boissons non converties (hors lot) |
| `/boissons/a-propos` | 👀 | Page générique `[filiale]/a-propos.vue`, e2e accent ✅. Contraste initiales équipe sur navy corrigé 2026-09-26 (`SiteImage` tone). Entretien vérifié (captures 3 breakpoints) ; autres filiales : même page générique, recapture rapide avant ✅ |
| `/boissons/contact` | ✅ | Lot 2 : contact point de vente + formulaire suggestion de produit, e2e + captures ✅ |

## Écarts au prompt de setup (2026-09-24)

- Nuxt 4 (pas 3) : dernière stable ; structure `app/`.
- Prisma 7.10 (pas 6) : `prisma.config.ts`, adapter-pg, client dans `server/generated/prisma`. `latest` npm = 8.0.0-rc → évité.
- Tailwind v4 + `@tailwindcss/vite` au lieu de `@nuxtjs/tailwindcss` (v3) ; `tw-animate-css` au lieu de `tailwindcss-animate` ; `reka-ui` au lieu de `radix-vue` (déprécié).
- `@lucide/vue` au lieu de `lucide-vue-next` (déprécié).
- shadcn-vue : style `new-york-v4`, base `neutral` (slate retiré du registry). CLI `init` en échec réseau → composants importés directement depuis le registry. `toast` remplacé par `sonner` (vue-sonner).
- zod 3.25 (pas 4) : requis par `@vee-validate/zod`.
- Seed : hash via `@adonisjs/hash` (même driver que nuxt-auth-utils) — l'import `#auth-utils` du prompt ne marche pas hors Nitro. Mots de passe démo lus depuis `.env`.
- Nouveau modèle `Fichier` (nom original, MIME, taille, visibilité PUBLIC/PRIVE, filiale) : nécessaire pour le scoping filiale de `/api/files/[key]` et pour servir les images CMS publiques.
- `ReservationRestaurant.statut` : enum `StatutReservation` au lieu de string libre. Index `companyId` sur toutes les tables.
- Storage `uploads` monté au runtime (`server/plugins/storage.ts`, `NUXT_UPLOADS_DIR`) au lieu de `nitro.storage` (figé au build).
- Sécurité ajoutée : rate-limit login/contact, anti-énumération par timing au login, validation clé fichier (regex UUID), sniff magic bytes, limite taille multipart, anti open-redirect sur `/admin/login?redirect=`, honeypot contact.

## Correctif post-setup (`POST_SETUP_PROMPT.md`, 2026-09-25)

| Étape | Statut |
|---|---|
| 0. Outillage tests (vitest, @nuxt/test-utils, scripts `test:unit`/`test:e2e`/`build:check`) | ✅ vitest projects node/nuxt auto, `tests/unit/auth-validation.test.ts` 12/12 |
| 1. id Int interne / uuid externe (schéma, migration, session, routes) | ✅ migration `init` Int+uuid(7), session sans id, API 24/24 dev + prod build (`scripts/api-check.mjs`) |
| 2. Gestion centrale des erreurs (`server/plugins/error-handler.ts` + `server/error.ts`) | ✅ prod : 5xx API → 1 log consola (statut/méthode/route/message, sans stack ni dump Nitro), client générique ; 4xx non loggés |
| 3. Validation mot de passe consolidée (`shared/validation/auth.ts`) | ✅ source unique client + serveur, 12 tests |
| 4. Vérification (typecheck, unit, build prod, revue) | ✅ typecheck, 20 tests unit, build prod : API 19/19 + UI 6/6 + 5xx ; revues reviewer 8/10 (MAJOR corrigés) |

## Décisions verrouillées récemment

- 2026-09-25 — id `Int autoincrement` interne + `uuid(7) @db.Uuid` exposé ; `Fichier` exposé par sa `key`. Règle dans `CLAUDE.md` § Identifiants.
- 2026-09-25 — Session : `user` = uuid/nom/role/companyUuid ; ids internes dans `secure` uniquement.
- 2026-09-25 — Erreurs : log central 5xx via consola, 4xx non loggés, aucun PII. Règle dans `CLAUDE.md` § Backend.
- 2026-09-25 — Tests obligatoires avant toute tâche "terminée" : typecheck + unit + build prod + revue. Règle dans `CLAUDE.md` § Tests.
- 2026-09-25 — **Phase 1 tranchée** (page « Groupe CD — Décisions de conversion et questions client », rev 278). DEC-01…39 : recommandations retenues SAUF DEC-07 (textes marketing filiales **en base, éditables**), DEC-08 (sections de contenu **gardées + affichées sur leurs pages**), DEC-09 (statut de site **fonctionnel** : page maintenance — interprétation, précision non donnée), DEC-39 (réalisations holding **affichées sur une page dédiée**).
- 2026-09-25 — Réponses client : principe **tout contenu éditable depuis l'admin** avec valeurs par défaut rédigées par nous. Q-01/Q-07 textes légaux (confidentialité Loi 25, mentions alcool) rédigés + éditables ; Q-02 coordonnées + nom du groupe éditables ; Q-03 effectif éditable ; Q-04 services éditables (CMS) ; Q-05 services « mis en avant » choisis dans l'admin, supermarchés par défaut ; Q-06 mention partenaire éditable, défaut neutre ; Q-08 infos restaurant (adresse, horaires, capacité) éditables ; Q-09 CV PDF uniquement ; Q-10 **courriels de confirmation à prévoir** (mailer) ; Q-11 libellé « Vous ne trouvez pas ce que vous cherchez ? ».
- 2026-09-25 — `nuxt-security` 2.6.0 (ajouté hors session) configuré : CSP/HSTS/headers actifs ; `rateLimiter: false` (bypass XFF, doublon de `server/utils/rate-limit.ts`), `corsHandler: false` (monolithe same-origin — rouvrir avec origin précise si app mobile), `xssValidator: false` (stringifie les octets des uploads ; XSS couvert par zod + échappement Vue + CSP), `requestSizeLimiter` aligné sur `shared/config/upload.ts`. Ne pas réactiver sans revue.
- 2026-09-25 — `.nuxtrc` (setup @nuxt/test-utils) versionné.
- 2026-09-25 — Écarts assumés au prompt correctif : schéma Prisma 7 existant conservé (pas remplacé), durcissement login conservé, `requireRole` conservé (pas de `?? -1`).

## Revue sécurité scaffold (reviewer, 2026-09-25) — score 7.5/10

Corrigé : rate-limit contournable via X-Forwarded-For (XFF lu seulement si connexion depuis proxy loopback) · login 5/15 min · purge mémoire des buckets · bornes taille body login (4 Ko) / contact (32 Ko) · cookie session SameSite=Strict · headers nosniff / X-Frame-Options / Referrer-Policy.

À faire :
- [x] `nuxt-security` (HSTS + CSP) — installé + configuré (voir Décisions verrouillées)
- [x] `server/plugins/error-handler.ts` (log central sans PII) — correctif post-setup
- [ ] nginx prod : `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` + app écoutant sur 127.0.0.1 uniquement
- [ ] 5xx sur rendu de page HTML (hors `/api/**`) : Nitro loggue encore l'erreur brute (limite documentée dans `server/error.ts`)
- [ ] `scripts/api-check.mjs` laisse ses données de test → nettoyer via `scripts/cleanup-test-data.ts` (auto-nettoyage à ajouter)
- [x] Migration `phase2_foundations` appliquée (utilisateur) — seed à lancer après T2 : `SEED_DEMO_DATA=true pnpm db:seed`
- [x] `.env.example` complété (utilisateur)
- [ ] Footer : `email`/`telephone` des 7 sociétés `null` en seed → saisissables dans l'onglet admin « Site » (fait) ; repli `'Montréal, Québec, Canada'` codé en dur dans `SiteFooter.vue` (contraire à « tout texte public éditable ») → à déplacer en seed
- [ ] **Bloquant mise en production (contact)** : renseigner `Company.email` (au moins holding) via onglet Site, convertir `/admin/messages` (DEC-38), SMTP réel (`NUXT_MAIL_TRANSPORT`) sinon `messageSucces` promet un courriel jamais envoyé ; mention Loi 25 (`COMMUN:mentionFormulaires`) à faire valider par un juriste
- [ ] Rate-limit en mémoire : accusés de réception (fenêtre 24 h) partagent la `Map` du rate-limit IP — surveiller la croissance, Redis si multi-process
- [ ] Initiales partenaires : algorithme différent du prototype (« CD » vs « CC ») — cosmétique
- [ ] CMS admin : boutons Monter/Descendre/Modifier/Supprimer 32px + `gap-1` (< 44px) — OK desktop, à revoir si usage tablette
- [ ] `resolveAccentColor` (`server/utils/site-scope.ts`) : regex hex sensible à la casse
- [ ] `/admin/contenu` sans shell dashboard (lien retour seul) — dépend décision ouverte n°1
- [ ] Dette schéma : `Candidat.posteRecherche` / `DemandeClient.posteRecherche` redondants avec `categorie` (nettoyage phase 3 placement)
- [ ] `server/api/public/contact.post.ts` : aligner sur DEC-12/13/15 (zod par filiale, `entreprise`/`details`/`paysOrigine`, sujet calculé serveur, `queueMail`) — non attribué en phase 2
- [ ] `DEFAULT_REALISATIONS_LIMIT = 12` (API publique réalisations) : défaut choisi par T1, à valider
- [ ] pagination `/api/admin/messages` (lors conversion `/admin/messages`)
- [x] `PASSWORD_MIN_LENGTH` dupliqué → `shared/validation/auth.ts` (correctif post-setup)

## Décisions encore ouvertes (à trancher avec l'utilisateur)

0. **Q-12 (client)** : « 12+ années d'existence » (accueil holding, chiffres) repris du prototype, non vérifié — laissé éditable dans l'admin (décision utilisateur 2026-09-26), à confirmer par le client avant mise en production.

1. ~~**Style visuel des dashboards**~~ — **tranché 2026-09-26 : même socle clair que les sites publics** (tokens `main.css`, navy/or/crème, shadcn-vue new-york-v4). Pas de thème sombre type Power BI.
2. **`DossierComptable` étend `Client`** : choix de modélisation introduit en rédigeant `PROJECT_CONTEXT.md` §7 (plutôt qu'un modèle `clientsComptables` isolé). Cohérent avec le carnet CRM général validé par l'utilisateur, mais n'a pas été explicitement validé dans ces termes précis — à confirmer si l'utilisateur relit le schéma Prisma de près.
3. **Nom officiel du groupe** : "Groupe CD" reste un nom de travail dans tous les documents — à remplacer partout si un nom officiel est choisi.

## Prochaine étape recommandée

Conversion par lots (CLAUDE.md « Workflow de conversion ») — Lot 1 ✅ (2026-09-28, spec `docs/specs/lot1-pages-filiales.md`, suite e2e complète 127 ✅ + 1 relance ✅).

1. ~~Lot 2~~ ✅ (2026-09-28, spec `docs/specs/lot2-contact-filiales.md`) — contact des 6 filiales + suggestion produit. Base de dev : textes contact placement / suggestion réalignés dans le seed seulement → saisir dans `/admin/contenu`.
2. Lot 3 — pages spécifiques : `/placement/offres` + postuler, `/ccdpaa/restaurant` + réservation, assistant import-export.
3. Lot 4 — admin socle : login, shell `/admin` (socle clair), messages, clients.
4. Lot 5 — modules admin : planning ×3, dossiers comptables, placement ×3, réservations.
5. À la volée : recapture des 6 `/{filiale}/a-propos` → ✅.

Base de dev : les surtitres ajoutés au seed par le lot 1 (« Portfolio », « Nos services », sauts de ligne des H1 filiales) ne sont pas dans une base déjà semée → saisir dans `/admin/contenu` ou `migrate reset` + seed avec accord.

## Outillage

- Vérif UI : `node scripts/ui-check.mjs` (serveur dev sur :3100 ; `PW_CHROMIUM_PATH` si révision Chromium locale ≠ Playwright).
- Réseau lent sur ce poste : `pnpm add --fetch-timeout=300000`. CLI `shadcn-vue init/add` en échec réseau → composants tirés du registry `new-york-v4` directement.
