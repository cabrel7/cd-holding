# Prompt correctif — Ajustements post-setup (25/09)

**À qui s'adresse ce prompt** : à l'agent qui a déjà exécuté `PROMPT_SETUP_NUXT.md` sur le projet. Ce n'est pas un nouveau scaffold — c'est un correctif appliqué sur le projet existant, avant de démarrer `PROMPT_CONVERSION.md`. Lire `CLAUDE.md` (sections "Identifiants" et "Backend / API") avant de commencer : ce prompt applique concrètement les règles qui y sont maintenant verrouillées.

Quatre changements, dans cet ordre : (0) mise en place de l'outillage de tests (manquant jusqu'ici — nécessaire pour vérifier les 3 points suivants autrement qu'à l'œil), (1) pattern id interne / uuid externe, (2) gestion centrale des erreurs serveur, (3) consolidation de la validation du mot de passe. Les items différés (nuxt-security, config nginx) ne sont **pas** dans ce prompt — ils sont documentés dans `PROJECT_STATE.md` pour l'étape de déploiement.

**Sur la mise à jour de `PROJECT_STATE.md`** : chaque fois qu'une section ci-dessous est terminée et vérifiée, la ligne correspondante est cochée **dans le fichier réel du dépôt local**, pas seulement notée ici. C'est ce fichier local, tenu à jour au fil des tâches, qui fait foi pour la suite — pas une copie mentale de son contenu.

## Mise à jour des fichiers de base (à faire en exécutant ce prompt, pas après)

Ce correctif introduit plusieurs décisions qui doivent survivre au-delà de cette tâche : le pattern id interne/uuid externe, la gestion centrale des erreurs, l'outillage de tests. Chacune est reportée dans les fichiers de base du dépôt local **au moment où elle est appliquée**, pas dans une passe séparée à la fin :

- Une règle qui s'applique à tout code futur (comment on nomme les identifiants, comment on gère les erreurs, quelles vérifications sont obligatoires avant de marquer une tâche terminée) → ajoutée ou mise à jour dans la section appropriée de `CLAUDE.md`. Concrètement pour ce prompt : la section "Identifiants" et la note sur les logs sans donnée personnelle existent déjà dans `CLAUDE.md` — vérifier qu'elles correspondent bien à ce qui a été implémenté (pas seulement à ce qui était prévu). L'outillage de tests (section 0 ci-dessous) est nouveau et n'a pas encore de règle dans `CLAUDE.md` : ajouter une sous-section "Tests" sous "Règles non négociables" indiquant que `typecheck`, tests unitaires pertinents et vérification contre le build de production sont obligatoires avant de marquer toute tâche terminée — pas seulement pendant la conversion (section 4 ci-dessous en est l'application immédiate).
- Un changement de statut, une décision ponctuelle → noté dans `PROJECT_STATE.md`, section "Décisions verrouillées récemment".

Ces deux fichiers sont modifiés directement dans le dépôt local — ils ne sont pas régénérés depuis la conversation Claude à chaque changement.

---

## 0. Outillage de tests (préalable — absent du scaffold initial)

Le prompt de setup n'a mis en place aucun moyen automatisé de vérifier qu'une route fonctionne réellement, seulement les captures Playwright de `CLAUDE.md` (utiles pour le visuel, pas pour la logique). Sans ça, la seule façon de savoir si le code produit "marche vraiment" est de le tester à l'œil en dev — ce qui ne dit rien de son comportement en build de production. On pose l'outillage maintenant, avant que la conversion route par route (`PROMPT_CONVERSION.md`) ne s'appuie dessus à chaque route.

```bash
pnpm add -D vitest @nuxt/test-utils @vue/test-utils happy-dom @playwright/test
```

`package.json` — ajouter :

```json
{
  "scripts": {
    "typecheck": "nuxt typecheck",
    "test:unit": "vitest run",
    "test:e2e": "playwright test",
    "build:check": "nuxt build && node .output/server/index.mjs"
  }
}
```

`vitest.config.ts` (nouveau fichier, à la racine) :

```ts
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
  },
})
```

`vue-tsc` doit déjà être présent (installé par `nuxi init`) pour que `nuxt typecheck` fonctionne — sinon l'ajouter en devDependency.

Écrire un premier test dès maintenant pour valider que l'outillage fonctionne, sur quelque chose qui existe déjà et qui a une vraie logique à vérifier : `tests/unit/auth-validation.test.ts` testant `passwordSchema`/`loginSchema` (section 3 ci-dessous) — rejette un mot de passe de 5 caractères, accepte un email valide, rejette un email invalide. C'est le gabarit que les tests unitaires suivants (composables, validations zod des routes converties en phase 3) reprendront.

## 1. Identifiants — id interne / uuid externe

### 1.1 Schéma Prisma complet (remplace `prisma/schema.prisma`)

Changement de fond : `id` passe de `String @default(cuid())` à `Int @default(autoincrement())` (usage strictement interne — relations, jointures), et un champ `uuid` est ajouté sur chaque modèle (seul identifiant exposé au client — API, URLs, session).

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CompanyType {
  HOLDING
  FILIALE
}

enum Role {
  SUPER_ADMIN
  ADMIN_FILIALE
  EMPLOYE
}

enum StatutClient {
  PROSPECT
  CLIENT_ACTIF
  INACTIF
}

enum StatutCandidature {
  NOUVELLE
  EN_REVISION
  RETENUE
  REJETEE
}

enum TypeMessage {
  CONTACT
  SUGGESTION_PRODUIT
}

model Company {
  id            Int         @id @default(autoincrement())
  uuid          String      @default(uuid()) @unique
  type          CompanyType
  slug          String      @unique
  nom           String
  secteur       String?
  description   String?     @db.Text
  couleurAccent String?
  logoKey       String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  users                  User[]
  services               Service[]
  membresEquipe          MembreEquipe[]
  realisations           Realisation[]
  partenaires            Partenaire[]
  messagesContact        MessageContact[]
  reservationsRestaurant ReservationRestaurant[]
  employes               Employe[]
  planningEntries        PlanningEntry[]
  clients                Client[]
  candidats              Candidat[]
  demandesClient         DemandeClient[]
  candidatures           Candidature[]
}

model User {
  id           Int      @id @default(autoincrement())
  uuid         String   @default(uuid()) @unique
  email        String   @unique
  passwordHash String
  nom          String
  role         Role
  companyId    Int?
  company      Company? @relation(fields: [companyId], references: [id])
  actif        Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Service {
  id          Int      @id @default(autoincrement())
  uuid        String   @default(uuid()) @unique
  companyId   Int
  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  titre       String
  description String   @db.Text
  imageKey    String?
  ordre       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model MembreEquipe {
  id        Int      @id @default(autoincrement())
  uuid      String   @default(uuid()) @unique
  companyId Int
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  nom       String
  poste     String
  photoKey  String?
  ordre     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Realisation {
  id              Int       @id @default(autoincrement())
  uuid            String    @default(uuid()) @unique
  companyId       Int
  company         Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  titre           String
  description     String    @db.Text
  imageKey        String?
  dateRealisation DateTime?
  ordre           Int       @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model Partenaire {
  id        Int      @id @default(autoincrement())
  uuid      String   @default(uuid()) @unique
  companyId Int
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  nom       String
  logoKey   String?
  siteUrl   String?
  ordre     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model MessageContact {
  id              Int         @id @default(autoincrement())
  uuid            String      @default(uuid()) @unique
  companyId       Int
  company         Company     @relation(fields: [companyId], references: [id], onDelete: Cascade)
  type            TypeMessage @default(CONTACT)
  nom             String
  email           String
  telephone       String?
  sujet           String?
  message         String      @db.Text
  produitSouhaite String?
  lu              Boolean     @default(false)
  createdAt       DateTime    @default(now())
}

model ReservationRestaurant {
  id              Int      @id @default(autoincrement())
  uuid            String   @default(uuid()) @unique
  companyId       Int
  company         Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  nom             String
  email           String
  telephone       String
  nombrePersonnes Int
  dateReservation DateTime
  notes           String?  @db.Text
  statut          String   @default("en_attente")
  createdAt       DateTime @default(now())
}

model Employe {
  id        Int      @id @default(autoincrement())
  uuid      String   @default(uuid()) @unique
  companyId Int
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  nom       String
  poste     String
  email     String?
  telephone String?
  actif     Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  planningEntries PlanningEntry[]
}

model PlanningEntry {
  id        Int      @id @default(autoincrement())
  uuid      String   @default(uuid()) @unique
  companyId Int
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  employeId Int
  employe   Employe  @relation(fields: [employeId], references: [id], onDelete: Cascade)
  titre     String
  dateDebut DateTime
  dateFin   DateTime
  notes     String?  @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Client {
  id                  Int          @id @default(autoincrement())
  uuid                String       @default(uuid()) @unique
  companyId           Int
  company             Company      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  nom                 String
  entreprise          String?
  email               String?
  telephone           String?
  statut              StatutClient @default(PROSPECT)
  notes               String?      @db.Text
  dateAjout           DateTime     @default(now())
  derniereInteraction DateTime?

  dossierComptable DossierComptable?
}

model DossierComptable {
  id              Int       @id @default(autoincrement())
  uuid            String    @default(uuid()) @unique
  clientId        Int       @unique
  client          Client    @relation(fields: [clientId], references: [id], onDelete: Cascade)
  typeDeclaration String?
  echeance        DateTime?
  documentsKeys   String[]  @default([])
  notes           String?   @db.Text
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model Candidat {
  id             Int      @id @default(autoincrement())
  uuid           String   @default(uuid()) @unique
  companyId      Int
  company        Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  nomComplet     String
  email          String
  telephone      String?
  posteRecherche String?
  cvKey          String?
  notes          String?  @db.Text
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model DemandeClient {
  id                Int      @id @default(autoincrement())
  uuid              String   @default(uuid()) @unique
  companyId         Int
  company           Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  entrepriseCliente String
  posteRecherche    String
  description       String   @db.Text
  publiee           Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  candidatures Candidature[]
}

model Candidature {
  id                  Int               @id @default(autoincrement())
  uuid                String            @default(uuid()) @unique
  companyId           Int
  company             Company           @relation(fields: [companyId], references: [id], onDelete: Cascade)
  demandeId           Int?
  demande             DemandeClient?    @relation(fields: [demandeId], references: [id])
  nomComplet          String
  email               String
  telephone           String
  adresseComplete     String
  posteRecherche      String
  posteAutrePrecision String?
  cvKey               String
  autresDocumentsKeys String[]          @default([])
  statut              StatutCandidature @default(NOUVELLE)
  dateEnvoi           DateTime          @default(now())
}
```

### 1.2 Migration

Le projet n'a que des données de démo (seed) — pas de données réelles à préserver. Le plus simple et le plus sûr :

```bash
npx prisma migrate reset
```

(confirmer l'invite — cela supprime la base de dev, rejoue les migrations, et relance automatiquement `prisma/seed.ts`). Adapter `prisma/seed.ts` si nécessaire : les upserts par `slug`/`email` restent valables tels quels, Prisma génère l'`id` et l'`uuid` automatiquement.

### 1.3 Types de session (`types/auth.d.ts`) — remplace le fichier existant

```ts
declare module '#auth-utils' {
  interface User {
    uuid: string
    nom: string
    role: 'SUPER_ADMIN' | 'ADMIN_FILIALE' | 'EMPLOYE'
    companyUuid: string | null
  }

  interface UserSession {
    loggedInAt: number
  }

  // Jamais envoyé au client — nuxt-auth-utils la garde côté serveur uniquement
  interface SecureSessionData {
    userId: number
    companyId: number | null
  }
}

export {}
```

### 1.4 `server/api/auth/login.post.ts` — remplace le fichier existant

```ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import { passwordSchema } from '~~/shared/validation/auth'

const loginSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, loginSchema.parse)

  const user = await prisma.user.findUnique({
    where: { email: body.email },
    select: {
      id: true,
      uuid: true,
      nom: true,
      role: true,
      passwordHash: true,
      actif: true,
      company: { select: { id: true, uuid: true } },
    },
  })

  if (!user || !user.actif) {
    throw createError({ statusCode: 401, statusMessage: 'Identifiants invalides' })
  }

  const valid = await verifyPassword(user.passwordHash, body.password)
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'Identifiants invalides' })
  }

  await setUserSession(event, {
    user: {
      uuid: user.uuid,
      nom: user.nom,
      role: user.role,
      companyUuid: user.company?.uuid ?? null,
    },
    secure: {
      userId: user.id,
      companyId: user.company?.id ?? null,
    },
    loggedInAt: Date.now(),
  })

  return { ok: true }
})
```

`server/api/auth/me.get.ts` n'a pas besoin de changer (il renvoie déjà `session.user`, qui ne contient plus que des uuid).

### 1.5 Exemple de route admin scopée — `server/api/admin/messages/index.get.ts`

```ts
export default defineEventHandler(async (event) => {
  const { user, secure } = await requireUserSession(event)

  const where = user.role === 'SUPER_ADMIN'
    ? {}
    : { companyId: secure.companyId ?? -1 }

  return prisma.messageContact.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      uuid: true,
      type: true,
      nom: true,
      email: true,
      telephone: true,
      sujet: true,
      message: true,
      produitSouhaite: true,
      lu: true,
      createdAt: true,
      company: { select: { uuid: true, nom: true, slug: true } },
      // volontairement pas de "id" ni "companyId" dans le select — jamais exposés au client
    },
  })
})
```

**Règle à appliquer partout à partir de maintenant (déjà dans `CLAUDE.md`)** : toute route API qui renvoie un enregistrement Prisma utilise un `select` explicite qui liste `uuid` et jamais `id`/`companyId`/`clientId`/etc. Toute route dynamique reçoit un `[uuid].xxx.ts`, résout via `where: { uuid: getRouterParam(event, 'uuid') }`, jamais via un id numérique dans l'URL.

---

## 2. Gestion centrale des erreurs serveur

`server/plugins/error-handler.ts` (nouveau fichier) :

```ts
import { consola } from 'consola'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', async (error, { event }) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500

    // Jamais le corps de la requête, jamais mot de passe/email/CV en clair —
    // seulement ce qui aide à diagnostiquer sans exposer de donnée personnelle.
    consola.error({
      statusCode,
      path: event?.path,
      method: event?.method,
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    })
  })
})
```

Règle qui va avec (déjà dans `CLAUDE.md`) : le message passé à `createError({ statusMessage: ... })` doit toujours être un message générique et sûr à afficher côté client ("Identifiants invalides", "Ressource introuvable") — jamais le détail technique de l'erreur (nom de contrainte SQL, chemin de fichier, etc.), qui lui va uniquement dans les logs via ce plugin.

En production, la rotation des logs (fichier + rotation quotidienne) sera mise en place au moment du déploiement VPS, avec PM2 (voir `PROJECT_CONTEXT.md` §4 et §10) — pas nécessaire en dev local où `consola` écrit sur stdout.

---

## 3. Consolidation de la validation du mot de passe

`shared/validation/auth.ts` (nouveau fichier — le dossier `shared/` de Nuxt est auto-importable côté client **et** serveur, une seule source de vérité) :

```ts
import { z } from 'zod'

export const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: passwordSchema,
})
```

Côté serveur : `server/api/auth/login.post.ts` importe déjà `passwordSchema` depuis `~~/shared/validation/auth` (voir 1.4).

Côté client, dans le composant de formulaire de connexion :

```ts
import { toTypedSchema } from '@vee-validate/zod'
import { loginSchema } from '~~/shared/validation/auth'

const { handleSubmit, defineField } = useForm({
  validationSchema: toTypedSchema(loginSchema),
})
```

Toute autre longueur minimale de mot de passe codée en dur ailleurs dans le projet (formulaire de création de compte admin, s'il existe déjà) doit être remplacée par un import de ce même schéma.

---

## 4. Vérification

**Fonctionnel** :
- [ ] `npx prisma migrate reset` s'exécute sans erreur, `npx prisma studio` montre des `id` numériques ET des `uuid` sur chaque table.
- [ ] Connexion avec un des 3 comptes de démo fonctionne toujours.
- [ ] `useUserSession().user` côté client ne contient que `uuid`, `nom`, `role`, `companyUuid` — jamais `id` ou `companyId` numérique (vérifier dans Vue Devtools ou un simple `console.log` temporaire, à retirer avant commit).
- [ ] Un appel à `/api/admin/messages` connecté en `ADMIN_FILIALE` (entretien) ne renvoie que les messages de cette filiale, et aucun champ `id`/`companyId` dans la réponse JSON.
- [ ] Provoquer une erreur serveur volontaire (ex. couper temporairement la connexion Postgres) : l'erreur apparaît dans les logs (`consola.error`) avec route/statut/message, sans donnée personnelle, et le client reçoit une réponse générique.
- [ ] Le schéma zod du mot de passe n'existe qu'à un seul endroit (`shared/validation/auth.ts`), importé des deux côtés.

**Automatisé — ne pas se fier uniquement au test visuel en dev** :
- [ ] `pnpm typecheck` passe sans erreur.
- [ ] `pnpm test:unit` passe, y compris le test `auth-validation.test.ts` écrit en section 0.
- [ ] `pnpm build:check` (build de production + démarrage du serveur buildé, pas `nuxt dev`) démarre sans erreur, et le login fonctionne contre cette instance buildée — c'est le test qui distingue "ça marche en dev" de "ça marche vraiment", puisque le build de prod change la façon dont Nitro gère le bundling, les variables d'environnement et le rendu SSR/ISR des `routeRules`.

**Revue** avant de considérer le correctif terminé : relire le diff complet de ce correctif en le confrontant à `CLAUDE.md` (aucun `id`/`companyId` exposé, zod des deux côtés, pas de `console.log` oublié) — idéalement par un agent qui n'a pas écrit le code, pas seulement une relecture par celui qui vient de l'implémenter.

Une fois tout validé, mettre à jour `PROJECT_STATE.md` **dans le dépôt local** (les deux lignes "⏳ En cours" passent à ✅), puis démarrer `PROMPT_CONVERSION.md`.
