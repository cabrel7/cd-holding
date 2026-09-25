# PROJECT_STATE.md — Groupe CD

Ce fichier est le **suivi vivant** du projet : il change à chaque session de travail. Contrairement à `PROJECT_CONTEXT.md` (stable, architecture et contexte métier) et `CLAUDE.md` (stable, règles de travail), ce fichier doit être mis à jour par tout agent qui termine une unité de travail — avant de rendre la main.

**Règle pour tout agent** : en fin de session, mettre à jour la section "Avancement" et "Prochaine étape recommandée" ci-dessous. Ne jamais laisser ce fichier désynchronisé de l'état réel du code.

---

## Phase actuelle

**Phase 1 — Conversion des routes.** Scaffold Nuxt terminé et vérifié (voir Avancement + Écarts au prompt). Prochaine route : Holding.

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

## Checklist de conversion par route (à remplir au fur et à mesure)

Convention de statut : ❌ pas commencé · 🔧 en cours · 👀 à vérifier (Playwright) · ✅ fait et vérifié

### Holding

| Route | Statut | Notes |
|---|---|---|
| `/` | ❌ | |
| `/a-propos` | ❌ | Regroupe histoire + équipe + partenaires |
| `/contact` | ❌ | |
| `/admin/login` | ❌ | |
| `/admin` (shell dashboard) | ❌ | |
| `/admin/contenu/*` (CMS services/réalisations/équipe/partenaires) | ❌ | |
| `/admin/messages` | ❌ | |
| `/admin/clients` | ❌ | CRM |

### Chaudetcha Entretiens et Sanitations (`entretien`)

| Route | Statut | Notes |
|---|---|---|
| `/entretien` | ❌ | |
| `/entretien/services` | ❌ | Inclut "Nettoyage et entretien des supermarchés" (retour client) |
| `/entretien/realisations` | ❌ | |
| `/entretien/a-propos` | ❌ | |
| `/entretien/contact` | ❌ | |
| `/admin/entretien/planning` | ❌ | Module planning partagé |

### Chaudetcha Transport et Logistique (`transport`)

| Route | Statut | Notes |
|---|---|---|
| `/transport` | ❌ | |
| `/transport/services` | ❌ | |
| `/transport/realisations` | ❌ | |
| `/transport/a-propos` | ❌ | |
| `/transport/contact` | ❌ | |
| `/admin/transport/planning` | ❌ | Module planning partagé |

### CD Tenue de Livre Comptable (`comptable`)

| Route | Statut | Notes |
|---|---|---|
| `/comptable` | ❌ | |
| `/comptable/services` | ❌ | Services mis à jour (états financiers, T1/T2, création/régularisation d'entreprise) |
| `/comptable/realisations` | ❌ | |
| `/comptable/a-propos` | ❌ | |
| `/comptable/contact` | ❌ | |
| `/admin/comptable/dossiers` | ❌ | Module dossiers clients (`DossierComptable`) |

### Placement CD Pro (`placement`)

| Route | Statut | Notes |
|---|---|---|
| `/placement` | ❌ | Double audience entreprises/candidats |
| `/placement/services` | ❌ | |
| `/placement/realisations` | ❌ | |
| `/placement/a-propos` | ❌ | |
| `/placement/contact` | ❌ | |
| `/placement/offres` | ❌ | Liste publique des offres publiées (`DemandeClient.publiee`) |
| `/placement/offres/[id]/postuler` (ou modal) | ❌ | Formulaire complet : adresse complète, poste + "Autre" avec mini-champ, CV requis + autres documents optionnels |
| `/admin/placement/candidats` | ❌ | Vivier interne |
| `/admin/placement/demandes` | ❌ | Demandes clients + toggle "Publier comme offre" |
| `/admin/placement/candidatures` | ❌ | Candidatures reçues, statut nouvelle/en_revision/retenue/rejetee |

### CCDPAA (`ccdpaa`)

| Route | Statut | Notes |
|---|---|---|
| `/ccdpaa` | ❌ | |
| `/ccdpaa/services` | ❌ | |
| `/ccdpaa/realisations` | ❌ | |
| `/ccdpaa/a-propos` | ❌ | |
| `/ccdpaa/contact` | ❌ | Inclut formulaire "Vous ne trouvez pas ce que vous cherchez ?" (suggestion produit) |
| `/ccdpaa/restaurant` | ❌ | 6ᵉ page — "Les Ambassades d'Afrique" + réservation |
| Widget "Assistant Import-Export" | ❌ | Scripté (Q&A pré-écrites), explicitement PAS une vraie IA — voir `PROJECT_CONTEXT.md` |
| `/admin/ccdpaa/planning` | ❌ | Planning restaurant |
| `/admin/ccdpaa/reservations` | ❌ | |

### CD Boissons d'Afrique (`boissons`)

| Route | Statut | Notes |
|---|---|---|
| `/boissons` | ❌ | |
| `/boissons/services` | ❌ | |
| `/boissons/realisations` | ❌ | |
| `/boissons/a-propos` | ❌ | |
| `/boissons/contact` | ❌ | Inclut formulaire suggestion produit |

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

## Décisions encore ouvertes (à trancher avec l'utilisateur)

1. **Style visuel des dashboards** : question posée — les dashboards `/admin/**` doivent-ils adopter un style sombre inspiré Power BI (préférence connue de l'utilisateur sur d'autres projets), ou rester sur le même socle clair que les sites publics ? **Pas encore tranché.**
2. **`DossierComptable` étend `Client`** : choix de modélisation introduit en rédigeant `PROJECT_CONTEXT.md` §7 (plutôt qu'un modèle `clientsComptables` isolé). Cohérent avec le carnet CRM général validé par l'utilisateur, mais n'a pas été explicitement validé dans ces termes précis — à confirmer si l'utilisateur relit le schéma Prisma de près.
3. **Nom officiel du groupe** : "Groupe CD" reste un nom de travail dans tous les documents — à remplacer partout si un nom officiel est choisi.

## Prochaine étape recommandée

1. Conversion Holding, route par route (`/` d'abord) : socle visuel navy/or (§6) dans `app/assets/css/main.css`, puis layout public.
2. Trancher décision ouverte n°1 (style dashboards) avant `/admin` shell.

## Outillage

- Vérif UI : `node scripts/ui-check.mjs` (serveur dev sur :3100 ; `PW_CHROMIUM_PATH` si révision Chromium locale ≠ Playwright).
- Réseau lent sur ce poste : `pnpm add --fetch-timeout=300000`. CLI `shadcn-vue init/add` en échec réseau → composants tirés du registry `new-york-v4` directement.
