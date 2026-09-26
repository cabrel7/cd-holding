# CLAUDE.md — Règles de travail, Groupe CD

Ce fichier définit comment travailler dans ce dépôt — pour tout agent (Claude ou autre) ou humain. Le contexte métier et les décisions d'architecture sont dans `PROJECT_CONTEXT.md` (à lire en premier, avant tout code). L'avancement réel est dans `PROJECT_STATE.md` (à mettre à jour après chaque unité de travail).

## Avant de commencer

1. Lire `PROJECT_CONTEXT.md` en entier.
2. Lire `PROJECT_STATE.md` pour savoir ce qui est déjà fait et quelle est la prochaine étape recommandée.
3. Si la tâche porte sur la conversion d'une route depuis le prototype React : regarder la route correspondante dans `prototype_react/` ET sur https://cd-holding-nexus.lovable.app/ avant d'écrire le moindre code Vue. Ne jamais deviner le comportement d'une interface à partir du nom de la route seul.

## Règles non négociables

Ces règles s'appliquent à **tout** le code produit dans ce dépôt, sans exception, sans les "juste pour ce prototype" ou "on corrigera plus tard".

### Design (marketing + dashboard)

- Aucun dégradé (gradient) nulle part — ni CSS, ni Tailwind (`bg-gradient-*` interdit).
- Aucun badge/pill décoratif sans fonction réelle. Un badge n'affiche jamais un mot-clé "IA", "Pro", "Nouveau" pour faire joli — il affiche un vrai statut métier (lu/non lu, statut de dossier, statut de candidature).
- `@lucide/vue` uniquement pour les icônes, réservé à l'usage fonctionnel (navigation, actions, statuts). Sur les pages marketing (accueil, services, à propos), préférer images, formes, courbes à l'accumulation d'icônes.
- Pas de grilles de cartes génériques répétitives. Chaque section a une mise en page pensée pour son contenu, pas un copier-coller de `<Card>` en boucle.
- Aucun emoji dans l'UI.
- Landing pages pensées pour convertir : proposition de valeur claire dès le premier écran, preuve de confiance (réalisations, partenaires), CTA net et unique par section.

### Dashboard — fonctionnel, jamais simulé au rabais

- **Tout contenu affiché sur les sites publics est éditable depuis l'admin** (textes marketing, sections, coordonnées, horaires, textes légaux, services mis en avant, effectif…) — décision client 2026-09-25. Le code fournit des valeurs par défaut (seed), jamais du texte public figé en dur dans un composant. Seules exceptions : la structure des formulaires (couplée au zod serveur) et les libellés d'interface.
- Mise en œuvre (spec phase 2, `docs/specs/phase2-foundations.md`) :
  - Tout texte public = une entrée du catalogue `shared/content/sections/` + une valeur par défaut dans le seed (`prisma/seed-data/`) — jamais dans un composant. Rendu via `TexteAccentue`, **jamais de `v-html`**.
  - Toute mutation de contenu public (CMS, réglages, sections) appelle `invalidatePublicPages()` (`server/utils/isr.ts`), sinon l'édition reste invisible jusqu'à expiration de l'ISR.
  - Le seed de contenu est en **amorçage seulement** : création si absent, jamais d'update (les éditions admin ne sont jamais écrasées, les suppressions jamais ressuscitées).
  - Les fichiers de `shared/` importés par le seed n'utilisent que des imports relatifs et importent zod explicitement (tsx ne résout ni `#shared` ni les auto-imports).
  - `couleurAccent` n'est pas éditable (socle §6 non négociable).

- **Interdit** : `alert()`, `confirm()`, `console.log()` en production dans le code du dashboard. Utiliser `Dialog`/`AlertDialog` (shadcn-vue) pour toute confirmation, et un système de `toast` pour tout retour utilisateur (succès, erreur).
- Tout modal, formulaire ou popup dans un dashboard doit être réellement fonctionnel — pas un bouton qui ne fait rien. Si une fonctionnalité n'est pas encore branchée au backend, elle n'apparaît pas dans l'UI plutôt que d'exister comme façade.
- Toutes les données fictives utilisées pendant le développement (avant que le backend réel soit branché) vivent dans un seul endroit identifié dans le code — jamais éparpillées en dur dans les composants.

### Backend / API (Nitro)

- **Validation zod sur chaque route API**, sans exception, même si le formulaire frontend valide déjà côté client. Les schémas partagés client/serveur vivent dans `shared/validation/` (import `#shared/validation/...`), une seule source de vérité. Le frontend peut être contourné (devtools, requête directe) — le serveur ne fait jamais confiance à l'entrée.
- **Prisma uniquement** — jamais de SQL brut, jamais de concaténation de chaînes dans une requête.
- Toute route sous `/api/admin/**` doit :
  1. Appeler `requireRole(event, [...])` (`server/utils/auth.ts`) en premier — session + rôle, renvoie `{ user, secure }`.
  2. Pour `ADMIN_FILIALE`/`EMPLOYE`, scoper via `companyScope(secure)` / `assertCompanyAccess(secure, …)`, qui s'appuient sur `secure.companyId` (id interne, jamais envoyé au client).
  3. Seulement ensuite exécuter la requête Prisma.
  Ce n'est jamais le frontend qui décide ce qu'un utilisateur peut voir — le filtrage par rôle/filiale est toujours refait côté serveur, même si le frontend filtre déjà pour l'ergonomie.
- Tout fichier uploadé (CV, documents, images) passe par `useStorage('uploads')`, jamais écrit ou lu directement via `fs` en dehors de cette abstraction — c'est ce qui garde la migration vers S3/R2 possible sans réécrire le code applicatif.
- Clé de stockage d'un fichier = UUID généré côté serveur. Le nom de fichier original de l'utilisateur n'est jamais utilisé comme chemin ou identifiant — seulement stocké comme métadonnée d'affichage.
- Aucun fichier uploadé n'est servi de manière statique/publique. Toute lecture passe par une route API qui vérifie la session (sauf cas explicitement public et documenté comme tel).
- **Erreurs** : le `statusMessage` de `createError` est toujours générique et affichable ("Identifiants invalides", "Introuvable") — jamais de détail technique (contrainte SQL, chemin, stack). Le détail va uniquement dans les logs, via `server/plugins/error-handler.ts` (5xx seulement). `server/error.ts` (branché par le hook `nitro:config`, jamais par `nitro.errorHandler` qui supprimerait la page d'erreur Nuxt) coupe le dump brut de Nitro sur les routes JSON/API.
- **Logs sans donnée personnelle** : jamais de corps de requête, cookie, header d'auth, email, mot de passe, nom de fichier uploadé ni query string dans un log.

### Identifiants — id interne / uuid externe

- Chaque modèle Prisma : `id Int @id @default(autoincrement())` (interne : relations, jointures) + `uuid String @unique @default(uuid(7)) @db.Uuid` (seul identifiant exposé). Exception : `Fichier`, exposé par sa `key` de stockage.
- Toute réponse API qui renvoie un enregistrement Prisma utilise un **`select` explicite** avec `uuid` — jamais `id`, `companyId`, `clientId`, `employeId`, `demandeId` ni aucune FK numérique.
- Toute route dynamique est `[uuid].<méthode>.ts`, param validé par `z.string().uuid()` (un uuid malformé ferait sinon une erreur 500 Postgres), résolu via `where: { uuid }`. Jamais d'id numérique dans une URL ou un body client.
- Session : `session.user` (visible client) = `uuid`, `nom`, `role`, `companyUuid`. Les ids internes (`userId`, `companyId`) vivent uniquement dans `session.secure` (scellé, serveur).

### Tests — obligatoires avant de marquer une tâche terminée

S'applique à toute tâche, pas seulement à la conversion des routes :
1. `pnpm typecheck` passe.
2. `pnpm test:unit` passe, avec des tests pour toute logique ajoutée ou modifiée (schémas zod, composables, helpers serveur).
3. `pnpm build:check` : le **build de production** démarre et le parcours touché fonctionne contre lui — le dev (`nuxt dev`) ne suffit pas (bundling Nitro, variables d'env et `routeRules` ISR/SSR diffèrent en prod).
4. Revue du diff par un agent qui n'a pas écrit le code (reviewer), confrontée à ce fichier.

### Conversion React → Vue

- Utiliser systématiquement la table de correspondance de `PROJECT_CONTEXT.md` §9 (`useState`→`ref`, Context API→Pinia store, etc.).
- Ne jamais improviser une structure de composant différente de celle du prototype sans raison documentée — le prototype a déjà été validé visuellement par le client, l'écart doit être justifié, pas accidentel.
- Avant de marquer une route (ou un lot) "✅ fait et vérifié" dans `PROJECT_STATE.md` — vérification faite **une fois par lot**, en fin de lot :
  1. Captures Playwright aux 3 breakpoints (375/768/1440, défilement pas à pas) de chaque route du lot, comparées au prototype.
  2. Vidéo courte ffmpeg **uniquement** pour les éléments chorégraphiés nouveaux dans le lot (modaux, toasts, accordéon, animations d'entrée) — pas de vidéo par route.
  3. Interactions clés couvertes par les tests e2e du lot.

## Workflow de conversion (décision utilisateur 2026-09-26 : par lots)

1. Convertir **par type de page**, en lots : une page générique (`app/pages/[filiale]/<page>.vue`) couvre les 6 filiales à la fois, comme `[filiale]/a-propos.vue`. Pages spécifiques uniquement quand le prototype diverge réellement (restaurant, offres, planning, dossiers, CRM…). Un lot reste borné (un type de page ou une zone admin cohérente), jamais « tout le projet ».
2. Par lot : **une spec courte** (architect) → backend + frontend en parallèle (périmètres disjoints) → typecheck + tests unitaires + e2e ciblés du lot → **un seul** build prod, **une seule** revue (reviewer + ux-reviewer en parallèle), **une seule** passe de captures en fin de lot. Les corrections mineures sont regroupées avant le rebuild, jamais un rebuild par micro-correctif.
3. Ordre : Holding d'abord, puis les pages génériques filiales, puis les pages spécifiques et l'admin, dans l'ordre de `PROJECT_STATE.md`.
4. Après chaque lot vérifié : mettre à jour `PROJECT_STATE.md` (statut des lignes du lot) avant de passer au suivant.
5. Si une ambiguïté apparaît entre ce que montre le prototype et ce que décrit `PROJECT_CONTEXT.md` (ou les retours client qui y sont intégrés) : le texte de `PROJECT_CONTEXT.md` fait foi, car il inclut les corrections post-démo que le prototype affiché ne reflète pas forcément à 100 %. En cas de doute réel, documenter la question dans `PROJECT_STATE.md` plutôt que de trancher seul silencieusement.

## Conventions de code

- TypeScript partout, strict.
- Un seul fichier de mockdata pendant la phase de transition si nécessaire (voir section Dashboard ci-dessus) — mais l'objectif de cette conversion est de brancher le vrai backend Prisma dès le départ, pas de reproduire le mock du prototype React.
- Composants Vue : `<script setup lang="ts">` systématiquement.
- Noms de composants shadcn-vue identiques à leurs équivalents shadcn/ui du prototype (portage direct, pas de renommage).
- Un commit = une route ou une unité de travail cohérente, pas un commit fourre-tout en fin de journée.

## Ce qui n'est PAS dans ce fichier

- Le contexte métier (filiales, activités, modèle de rôles) → `PROJECT_CONTEXT.md`.
- L'avancement réel, la checklist route par route, les décisions encore ouvertes → `PROJECT_STATE.md`.
- Le détail du schéma Prisma, de la configuration `nuxt.config.ts`, des dépendances exactes → le prompt de setup (fichier séparé, à exécuter une seule fois à l'initialisation du projet).


## Stack réelle (scaffold exécuté le 2026-09-24)

- Nuxt 4 (`app/` = srcDir, `server/`, `shared/` à la racine) · Nitro · TypeScript 5 strict (TS 7 incompatible vue-tsc)
- Prisma 7 : URL dans `prisma.config.ts`, client généré dans `server/generated/prisma` (non versionné), driver `@prisma/adapter-pg`
- Auth `nuxt-auth-utils` · helpers serveur `requireRole`, `companyScope`, `assertCompanyAccess` (`server/utils/auth.ts`) — à utiliser dans toute route `/api/admin/**`
- Rôles : constantes `ROLES` (`shared/utils/roles.ts`), jamais de chaîne en dur
- Fichiers : `saveUploadedFile` (`server/utils/storage.ts`) — type détecté par magic bytes, enregistré dans la table `Fichier` (visibilité PUBLIC/PRIVE + filiale). Lecture uniquement via `/api/files/[key]`
- Tailwind v4 (`@tailwindcss/vite`, tokens dans `app/assets/css/main.css`) · shadcn-vue style `new-york-v4` (reka-ui) · icônes `@lucide/vue` · toasts `vue-sonner`
- Formulaires : VeeValidate + `@vee-validate/zod` → **zod v3 obligatoire** (zod 4 non supporté par `@vee-validate/zod`)
- `.env` : voir `.env.example` (aucun secret en dur, y compris les mots de passe de seed)
