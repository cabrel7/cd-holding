import { defineVitestConfig } from '@nuxt/test-utils/config'

// Choix d'environnement (voir CLAUDE.md section "Tests") :
//
// On NE force PAS `test.environment: 'nuxt'` globalement. `defineVitestConfig`
// (@nuxt/test-utils 4.3, vitest 5) détecte l'absence d'environnement forcé et
// scinde automatiquement la config en deux "projects" vitest :
//   - project "nuxt" : uniquement `tests/nuxt/**` ou `*.nuxt.{test,spec}.ts`
//     → boot Nuxt complet (composables auto-importés, useNuxtApp, etc.),
//       nécessaire pour tester des composables/plugins Nuxt, mais lent.
//   - project "node" (par défaut) : tout le reste, y compris `tests/unit/**`
//     → pas de boot du runtime Nuxt par test, juste Node. Les alias Nuxt
//       (`#shared/...`, `~~/...`, etc.) restent résolus car ils viennent de
//       la config Vite de Nuxt, chargée une seule fois à la résolution de
//       la config (pas par test), et sont partagés par les deux projects.
//
// Un test de schéma zod pur (ex. tests/unit/auth-validation.test.ts) n'a besoin
// d'aucune API Nuxt runtime : il tombe donc dans le project "node", rapide.
// Le jour où un composable ou un plugin Nuxt doit être testé, son test va dans
// `tests/nuxt/` (ou est nommé `*.nuxt.test.ts`) pour hériter de l'environnement
// 'nuxt' automatiquement — sans configuration supplémentaire à ajouter ici.
export default defineVitestConfig({
  test: {
    // Le boot Nuxt complet (project "nuxt" ci-dessus) dépasse le hookTimeout par défaut de
    // vitest (10s) sur certaines machines/CI — relevé globalement plutôt que par fichier,
    // sans effet sur le project "node" (rapide, jamais concerné). Le premier test
    // du fichier paie aussi ce coût de montage (mountSuspended) : testTimeout relevé de même.
    // 120 s (au lieu de 60) : le boot à froid après une modif du code dépasse 60 s sur ce poste
    // (cache Vite/Nuxt invalidé), ce qui faisait échouer tests/nuxt/*.nuxt.test.ts par hook.
    hookTimeout: 120_000,
    testTimeout: 20_000,
    // Les specs Playwright (tests/e2e/**) sont lancées par `playwright test`, jamais par vitest.
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
  },
})
