import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
    // Base éphémère de référence pour `prisma migrate diff/dev` (Prisma 7 l'exige explicitement).
    // Optionnelle : les commandes sans diff (deploy, db seed…) n'en ont pas besoin.
    ...(process.env.SHADOW_DATABASE_URL ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL } : {}),
  },
})
