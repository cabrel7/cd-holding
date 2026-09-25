# Prompt de setup — Scaffold complet du projet Nuxt 3 (Groupe CD)

**À qui s'adresse ce prompt** : à un agent de code (ou un humain) qui a accès en écriture à un dossier de projet vide, et qui a déjà lu `PROJECT_CONTEXT.md`, `PROJECT_STATE.md` et `CLAUDE.md` à la racine du dépôt. Ce prompt met en place le squelette technique complet — aucune route métier n'est convertie ici, ça viendra ensuite route par route (voir `CLAUDE.md`, section Workflow).

**Objectif de cette étape** : à la fin de ce prompt, on doit avoir un projet Nuxt 3 qui démarre, une base de données Postgres migrée avec le schéma Prisma complet et seedée avec des données de démo, une authentification fonctionnelle (3 rôles), un exemple de route API protégée, un exemple d'upload/lecture de fichier sécurisé, et shadcn-vue + lucide-vue-next + Pinia + VeeValidate prêts à l'emploi. Rien de plus — pas de page métier, pas de design final des filiales.

---

## Étape 1 — Initialisation du projet

```bash
npx nuxi@latest init . --package-manager pnpm --git
```

(Si le dossier n'est pas vide — parce que `prototype_react/` et les 4 fichiers `.md` y sont déjà — utiliser `npx nuxi@latest init cd-holding-temp` puis déplacer le contenu généré à la racine, sans écraser `prototype_react/` ni les fichiers `.md` existants.)

## Étape 2 — Dépendances

```bash
pnpm add @prisma/client nuxt-auth-utils pinia @pinia/nuxt vee-validate @vee-validate/zod zod lucide-vue-next @vueuse/core @vueuse/nuxt @vueuse/motion class-variance-authority clsx tailwind-merge tailwindcss-animate radix-vue

pnpm add -D prisma tailwindcss @nuxtjs/tailwindcss tsx
```

Notes :
- **Pas de bcrypt/argon2 en dépendance séparée** — `nuxt-auth-utils` expose `hashPassword()` / `verifyPassword()` côté serveur (scrypt via `node:crypto`), suffisant et sans dépendance native à compiler sur le VPS.
- `tsx` sert à exécuter le script de seed TypeScript directement (`tsx prisma/seed.ts`), sans étape de build séparée.
- `consola` n'est pas à installer — il est déjà inclus dans Nitro, importable directement (`import { consola } from 'consola'`).

## Étape 3 — Structure de dossiers à créer

```
prisma/
  schema.prisma
  seed.ts
server/
  api/
    auth/
      login.post.ts
      logout.post.ts
      me.get.ts
    public/
      contact.post.ts          (exemple — sera dupliqué/adapté par filiale plus tard)
    admin/
      messages/
        index.get.ts
    files/
      [key].get.ts
  utils/
    prisma.ts
    storage.ts
middleware/
  admin.ts
stores/
  auth.ts
types/
  auth.d.ts
composables/
  .gitkeep
components/
  ui/                          (shadcn-vue génère ici)
```

## Étape 4 — `nuxt.config.ts`

```ts
export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    'nuxt-auth-utils',
  ],

  routeRules: {
    // Pages publiques : SSR/ISR pour le SEO
    '/': { isr: 3600 },
    '/a-propos': { isr: 3600 },
    '/contact': { isr: 3600 },
    '/entretien/**': { isr: 3600 },
    '/transport/**': { isr: 3600 },
    '/comptable/**': { isr: 3600 },
    '/placement/**': { isr: 3600 },
    '/ccdpaa/**': { isr: 3600 },
    '/boissons/**': { isr: 3600 },

    // Dashboards : SPA pure, pas de SSR
    '/admin/**': { ssr: false },
  },

  runtimeConfig: {
    // clé privée uniquement (jamais exposée au client)
    session: {
      // nuxt-auth-utils lit NUXT_SESSION_PASSWORD automatiquement
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
    },
  },
})
```

## Étape 5 — `.env.example`

```env
# Base de données
DATABASE_URL="postgresql://user:password@localhost:5432/groupe_cd?schema=public"

# nuxt-auth-utils — 32+ caractères aléatoires, jamais commité en clair
NUXT_SESSION_PASSWORD="change-me-generate-a-random-32-char-secret"

# Stockage fichiers (driver fs en local — voir server/utils/storage.ts)
UPLOADS_DIR="./storage/uploads"
```

Créer aussi `.env` (copie de `.env.example` avec de vraies valeurs de dev) et l'ajouter à `.gitignore`, de même que `/storage`.

## Étape 6 — `prisma/schema.prisma`

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
  id            String      @id @default(cuid())
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
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  nom          String
  role         Role
  companyId    String?
  company      Company?  @relation(fields: [companyId], references: [id])
  actif        Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model Service {
  id          String   @id @default(cuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  titre       String
  description String   @db.Text
  imageKey    String?
  ordre       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model MembreEquipe {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  nom       String
  poste     String
  photoKey  String?
  ordre     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Realisation {
  id              String    @id @default(cuid())
  companyId       String
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
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  nom       String
  logoKey   String?
  siteUrl   String?
  ordre     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model MessageContact {
  id              String      @id @default(cuid())
  companyId       String
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
  id              String   @id @default(cuid())
  companyId       String
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
  id        String   @id @default(cuid())
  companyId String
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
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  employeId String
  employe   Employe  @relation(fields: [employeId], references: [id], onDelete: Cascade)
  titre     String
  dateDebut DateTime
  dateFin   DateTime
  notes     String?  @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Client {
  id                  String       @id @default(cuid())
  companyId           String
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

// Étend Client plutôt qu'un modèle clientsComptables isolé et dupliqué —
// voir PROJECT_STATE.md, "Décisions encore ouvertes", point 2 (à confirmer avec l'utilisateur).
model DossierComptable {
  id              String    @id @default(cuid())
  clientId        String    @unique
  client          Client    @relation(fields: [clientId], references: [id], onDelete: Cascade)
  typeDeclaration String?
  echeance        DateTime?
  documentsKeys   String[]  @default([])
  notes           String?   @db.Text
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model Candidat {
  id             String   @id @default(cuid())
  companyId      String
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
  id                String   @id @default(cuid())
  companyId         String
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
  id                  String            @id @default(cuid())
  companyId           String
  company             Company           @relation(fields: [companyId], references: [id], onDelete: Cascade)
  demandeId           String?
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

Puis :

```bash
npx prisma migrate dev --name init
```

## Étape 7 — `prisma/seed.ts`

```ts
import { PrismaClient, CompanyType, Role } from '@prisma/client'
import { hashPassword } from '../server/utils/auth-password' // wrapper autour de nuxt-auth-utils, voir étape 9

const prisma = new PrismaClient()

async function main() {
  const holding = await prisma.company.upsert({
    where: { slug: 'holding' },
    update: {},
    create: {
      type: CompanyType.HOLDING,
      slug: 'holding',
      nom: 'Groupe CD',
      description: 'Groupe de sociétés montréalais.',
      couleurAccent: '#1B2A4A',
    },
  })

  const filiales = [
    { slug: 'entretien', nom: 'Chaudetcha Entretiens et Sanitations', couleurAccent: '#0F6E56', secteur: 'Entretien ménager résidentiel et commercial' },
    { slug: 'transport', nom: 'Chaudetcha Transport et Logistique', couleurAccent: '#D85A30', secteur: 'Transport de marchandises, déménagement, logistique' },
    { slug: 'comptable', nom: 'CD Tenue de Livre Comptable', couleurAccent: '#185FA5', secteur: 'Comptabilité, paie, déclarations fiscales' },
    { slug: 'placement', nom: 'Placement CD Pro', couleurAccent: '#D4537E', secteur: 'Placement de personnel et recrutement' },
    { slug: 'ccdpaa', nom: 'CCDPAA', couleurAccent: '#BA7517', secteur: "Import-export de produits agricoles d'Afrique" },
    { slug: 'boissons', nom: 'CD Boissons d\'Afrique', couleurAccent: '#A32D2D', secteur: 'Représentation et distribution de boissons' },
  ]

  const companies: Record<string, { id: string }> = { holding }
  for (const f of filiales) {
    companies[f.slug] = await prisma.company.upsert({
      where: { slug: f.slug },
      update: {},
      create: { type: CompanyType.FILIALE, ...f },
    })
  }

  // 3 comptes de démo — un par rôle
  const superAdminHash = await hashPassword('SuperAdmin123!')
  await prisma.user.upsert({
    where: { email: 'admin@groupecd.ca' },
    update: {},
    create: {
      email: 'admin@groupecd.ca',
      passwordHash: superAdminHash,
      nom: 'Admin Groupe CD',
      role: Role.SUPER_ADMIN,
    },
  })

  const adminFilialeHash = await hashPassword('AdminEntretien123!')
  await prisma.user.upsert({
    where: { email: 'admin@entretien.groupecd.ca' },
    update: {},
    create: {
      email: 'admin@entretien.groupecd.ca',
      passwordHash: adminFilialeHash,
      nom: 'Admin Entretien',
      role: Role.ADMIN_FILIALE,
      companyId: companies.entretien.id,
    },
  })

  const employeHash = await hashPassword('Employe123!')
  await prisma.user.upsert({
    where: { email: 'employe@entretien.groupecd.ca' },
    update: {},
    create: {
      email: 'employe@entretien.groupecd.ca',
      passwordHash: employeHash,
      nom: 'Employé Entretien',
      role: Role.EMPLOYE,
      companyId: companies.entretien.id,
    },
  })

  console.log('Seed terminé.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
```

Ajouter dans `package.json` :

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "scripts": {
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

Puis exécuter : `npx prisma db seed`

## Étape 8 — `server/utils/prisma.ts` (singleton, évite les fuites de connexions en dev)

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

## Étape 9 — Types de session (`types/auth.d.ts`)

```ts
declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    nom: string
    role: 'SUPER_ADMIN' | 'ADMIN_FILIALE' | 'EMPLOYE'
    companyId: string | null
  }

  interface UserSession {
    loggedInAt: number
  }

  interface SecureSessionData {
    // rien de sensible en clair côté session pour l'instant
  }
}

export {}
```

`server/utils/auth-password.ts` (petit wrapper, pour que `seed.ts` n'ait pas à importer depuis `#imports` qui n'existe que dans le contexte Nitro) :

```ts
import { hashPassword as h, verifyPassword as v } from '#auth-utils'

export const hashPassword = h
export const verifyPassword = v
```

## Étape 10 — Routes d'authentification

`server/api/auth/login.post.ts` :

```ts
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, loginSchema.parse)

  const user = await prisma.user.findUnique({ where: { email: body.email } })
  if (!user || !user.actif) {
    throw createError({ statusCode: 401, statusMessage: 'Identifiants invalides' })
  }

  const valid = await verifyPassword(user.passwordHash, body.password)
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'Identifiants invalides' })
  }

  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      nom: user.nom,
      role: user.role,
      companyId: user.companyId,
    },
    loggedInAt: Date.now(),
  })

  return { ok: true }
})
```

`server/api/auth/logout.post.ts` :

```ts
export default defineEventHandler(async (event) => {
  await clearUserSession(event)
  return { ok: true }
})
```

`server/api/auth/me.get.ts` :

```ts
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  return session.user ?? null
})
```

## Étape 11 — Middleware de protection `/admin/**`

`middleware/admin.ts` (route middleware côté client, puisque `/admin/**` est en `ssr: false`) :

```ts
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/admin/login') return

  const { loggedIn, user, fetch: fetchSession } = useUserSession()
  if (!loggedIn.value) {
    await fetchSession()
  }
  if (!loggedIn.value) {
    return navigateTo('/admin/login')
  }
})
```

À appliquer avec `definePageMeta({ middleware: 'admin' })` sur chaque page sous `pages/admin/` (sauf `login.vue`).

**Rappel non négociable (voir `CLAUDE.md`)** : ce middleware protège l'UI, pas les données. Chaque route `/api/admin/**` doit *en plus* appeler `requireUserSession` et vérifier le rôle/filiale côté serveur — exemple ci-dessous.

`server/api/admin/messages/index.get.ts` (exemple de route protégée avec scoping par filiale) :

```ts
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const where = user.role === 'SUPER_ADMIN'
    ? {}
    : { companyId: user.companyId ?? '__none__' }

  return prisma.messageContact.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { company: { select: { nom: true, slug: true } } },
  })
})
```

## Étape 12 — Stockage de fichiers (`server/utils/storage.ts`)

```ts
import { randomUUID } from 'node:crypto'

export function uploadsStorage() {
  return useStorage('uploads')
}

/**
 * Enregistre un fichier uploadé et retourne sa clé (jamais le nom original).
 * Le nom original est retourné séparément, à stocker comme métadonnée d'affichage
 * uniquement — jamais utilisé comme chemin de stockage.
 */
export async function saveUploadedFile(file: { data: Buffer; filename?: string; type?: string }) {
  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
  if (file.type && !allowedTypes.includes(file.type)) {
    throw createError({ statusCode: 400, statusMessage: 'Type de fichier non autorisé' })
  }
  const maxSize = 10 * 1024 * 1024 // 10 Mo
  if (file.data.length > maxSize) {
    throw createError({ statusCode: 400, statusMessage: 'Fichier trop volumineux (max 10 Mo)' })
  }

  const extension = file.filename?.split('.').pop() ?? 'bin'
  const key = `${randomUUID()}.${extension}`

  await uploadsStorage().setItemRaw(key, file.data)

  return { key, nomOriginal: file.filename ?? 'fichier' }
}
```

`nuxt.config.ts` — ajouter la config du driver de stockage (montage `uploads`) :

```ts
export default defineNuxtConfig({
  // ...reste de la config (étape 4)
  nitro: {
    storage: {
      uploads: {
        driver: 'fs',
        base: process.env.UPLOADS_DIR ?? './storage/uploads',
      },
    },
  },
})
```

`server/api/files/[key].get.ts` (lecture authentifiée — aucun fichier n'est jamais servi statiquement) :

```ts
export default defineEventHandler(async (event) => {
  await requireUserSession(event) // adapter la vérification de rôle/filiale selon le type de fichier servi

  const key = getRouterParam(event, 'key')
  if (!key) throw createError({ statusCode: 400 })

  const data = await uploadsStorage().getItemRaw(key)
  if (!data) throw createError({ statusCode: 404 })

  return data
})
```

Exemple d'upload public (candidature Placement CD Pro — à réutiliser/adapter quand cette route sera convertie) : recevoir le formulaire en `multipart/form-data` via `readMultipartFormData(event)`, valider les champs texte avec zod, appeler `saveUploadedFile` pour le CV (requis) et chaque document additionnel (optionnels), puis créer l'enregistrement `Candidature` avec les clés retournées.

## Étape 13 — Pinia (`stores/auth.ts`)

```ts
export const useAuthStore = defineStore('auth', () => {
  const { user, loggedIn, clear, fetch } = useUserSession()

  async function login(email: string, password: string) {
    await $fetch('/api/auth/login', { method: 'POST', body: { email, password } })
    await fetch()
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await clear()
    await navigateTo('/admin/login')
  }

  return { user, loggedIn, login, logout }
})
```

`nuxt.config.ts` a déjà `@pinia/nuxt` dans `modules` (étape 4) — rien d'autre à faire, `defineStore` est auto-importé.

## Étape 14 — shadcn-vue + lucide-vue-next

```bash
npx shadcn-vue@latest init
```

Répondre aux prompts : style **New York**, couleur de base **Slate** (sera de toute façon surchargée par le socle visuel navy/or — voir `PROJECT_CONTEXT.md` §6 — au moment de la conversion des pages), CSS variables **oui**. Cela génère `components.json`, met à jour `tailwind.config.ts` et crée `lib/utils.ts` (fonction `cn`).

Ajouter ensuite les premiers composants nécessaires à l'auth et au CMS (les autres seront ajoutés au fil de la conversion, route par route) :

```bash
npx shadcn-vue@latest add button input label card dialog alert-dialog toast form
```

`lucide-vue-next` ne nécessite aucune configuration — import direct : `import { LogOut, Menu } from 'lucide-vue-next'`.

## Étape 15 — VeeValidate + zod (exemple de formulaire)

```vue
<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'

const schema = toTypedSchema(z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, '8 caractères minimum'),
}))

const { handleSubmit, errors, defineField } = useForm({ validationSchema: schema })
const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')

const onSubmit = handleSubmit(async (values) => {
  await useAuthStore().login(values.email, values.password)
  await navigateTo('/admin')
})
</script>
```

Ce pattern (VeeValidate + zod côté client, **zod ré-appliqué côté serveur via `readValidatedBody`**) est celui à répliquer sur tous les formulaires — publics et dashboard — voir `CLAUDE.md`.

## Étape 16 — Vérification finale (checklist)

Avant de considérer le scaffold terminé et de passer à la conversion des routes (voir `PROJECT_STATE.md`) :

- [ ] `pnpm dev` démarre sans erreur.
- [ ] `npx prisma studio` montre les 6 filiales + la holding, et les 3 utilisateurs de démo.
- [ ] Une page `/admin/login` minimale existe, soumet vers `/api/auth/login`, et redirige vers `/admin` en cas de succès.
- [ ] Sans session, naviguer directement vers une URL `/admin/...` redirige vers `/admin/login` (middleware `admin.ts`).
- [ ] Un appel direct à une route `/api/admin/**` sans session renvoie 401 (pas seulement bloqué côté UI).
- [ ] Se connecter avec le compte `ADMIN_FILIALE` (entretien) puis appeler une route admin scopée confirme qu'on ne voit que les données de sa filiale.
- [ ] Un fichier de test peut être uploadé via une route API de test, puis relu uniquement via `/api/files/[key]` en étant connecté (404/401 sans session).
- [ ] `npx shadcn-vue@latest add` fonctionne et un composant `Button` s'affiche correctement stylé.

Une fois cette checklist validée, mettre à jour `PROJECT_STATE.md` : passer "Scaffold du projet Nuxt réellement exécuté" à ✅, et commencer la conversion route par route en suivant l'ordre indiqué (Holding d'abord).
