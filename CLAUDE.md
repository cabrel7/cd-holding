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

- **Interdit** : `alert()`, `confirm()`, `console.log()` en production dans le code du dashboard. Utiliser `Dialog`/`AlertDialog` (shadcn-vue) pour toute confirmation, et un système de `toast` pour tout retour utilisateur (succès, erreur).
- Tout modal, formulaire ou popup dans un dashboard doit être réellement fonctionnel — pas un bouton qui ne fait rien. Si une fonctionnalité n'est pas encore branchée au backend, elle n'apparaît pas dans l'UI plutôt que d'exister comme façade.
- Toutes les données fictives utilisées pendant le développement (avant que le backend réel soit branché) vivent dans un seul endroit identifié dans le code — jamais éparpillées en dur dans les composants.

### Backend / API (Nitro)

- **Validation zod sur chaque route API**, sans exception, même si le formulaire frontend valide déjà côté client. Le frontend peut être contourné (devtools, requête directe) — le serveur ne fait jamais confiance à l'entrée.
- **Prisma uniquement** — jamais de SQL brut, jamais de concaténation de chaînes dans une requête.
- Toute route sous `/api/admin/**` doit :
  1. Appeler `requireUserSession(event)` en premier.
  2. Vérifier le rôle (`super_admin` / `admin_filiale` / `employe`) et, pour `admin_filiale`/`employe`, vérifier que la ressource demandée appartient bien à `session.user.companyId`.
  3. Seulement ensuite exécuter la requête Prisma.
  Ce n'est jamais le frontend qui décide ce qu'un utilisateur peut voir — le filtrage par rôle/filiale est toujours refait côté serveur, même si le frontend filtre déjà pour l'ergonomie.
- Tout fichier uploadé (CV, documents, images) passe par `useStorage('uploads')`, jamais écrit ou lu directement via `fs` en dehors de cette abstraction — c'est ce qui garde la migration vers S3/R2 possible sans réécrire le code applicatif.
- Clé de stockage d'un fichier = UUID généré côté serveur. Le nom de fichier original de l'utilisateur n'est jamais utilisé comme chemin ou identifiant — seulement stocké comme métadonnée d'affichage.
- Aucun fichier uploadé n'est servi de manière statique/publique. Toute lecture passe par une route API qui vérifie la session (sauf cas explicitement public et documenté comme tel).

### Conversion React → Vue

- Utiliser systématiquement la table de correspondance de `PROJECT_CONTEXT.md` §9 (`useState`→`ref`, Context API→Pinia store, etc.).
- Ne jamais improviser une structure de composant différente de celle du prototype sans raison documentée — le prototype a déjà été validé visuellement par le client, l'écart doit être justifié, pas accidentel.
- Avant de marquer une route "✅ fait et vérifié" dans `PROJECT_STATE.md` :
  1. Capturer la route Vue avec Playwright aux 3 breakpoints (375/768/1440) et comparer visuellement au prototype hébergé.
  2. Pour les éléments chorégraphiés (modaux, toasts, accordéon FAQ, animations d'entrée) : capture vidéo courte via ffmpeg pour vérifier le comportement, pas seulement l'état statique.
  3. Tester manuellement les interactions clés de la route (soumission de formulaire, ouverture de modal, changement d'onglet).

## Workflow de conversion recommandé

1. Traiter les routes **une par une**, jamais le projet entier d'un coup — le risque de dérive/hallucination augmente avec la taille du batch.
2. Ordre recommandé : Holding d'abord (le socle design, l'auth et les composants CMS génériques y sont posés une fois, puis réutilisés), puis les 6 filiales dans l'ordre de `PROJECT_STATE.md`.
3. Après chaque route terminée et vérifiée : mettre à jour `PROJECT_STATE.md` (statut de la ligne correspondante) avant de passer à la suivante.
4. Si une ambiguïté apparaît entre ce que montre le prototype et ce que décrit `PROJECT_CONTEXT.md` (ou les retours client qui y sont intégrés) : le texte de `PROJECT_CONTEXT.md` fait foi, car il inclut les corrections post-démo que le prototype affiché ne reflète pas forcément à 100 %. En cas de doute réel, documenter la question dans `PROJECT_STATE.md` plutôt que de trancher seul silencieusement.

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
