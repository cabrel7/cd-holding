// Config e2e (spec phase 2 §4.8) — exécutée contre le BUILD DE PRODUCTION, serveur lancé à
// part (`PORT=3200 node --env-file=.env .output/server/index.mjs`), jamais via un `webServer`
// automatique ici. `workers: 1` + `fullyParallel: false` : état DB partagé entre les tests
// (chaque test nettoie ses propres données, voir tests/e2e/**).
import 'dotenv/config'
import { defineConfig } from '@playwright/test'

// Navigateur : la révision Chromium attendue par @playwright/test (1234, cf. `chromium-1234`)
// n'est PAS installée sur cette machine (`~/.cache/ms-playwright` est vide). Selon `PW_CHROMIUM_PATH`
// ou la valeur ci-dessous, on pointe un binaire Chromium-family pilotable : c'est Brave (chromium)
// qui est disponible ici. N'installe JAMAIS de navigateur (`playwright install` interdit, voir skill
// playwright) — fournir le chemin via l'environnement d'exécution.
const CHROMIUM_PATH_DEFAULT = '/opt/brave.com/brave/brave'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],

  use: {
    // `??` ne couvre pas le cas d'une variable présente mais vide (`E2E_BASE_URL=""` dans .env,
    // constaté en pratique) : ce cas produit une baseURL vide et fait échouer `page.goto` avec
    // "Cannot navigate to invalid URL" sur toutes les navigations relatives. `||` traite aussi
    // la chaîne vide comme "non définie".
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_PATH || CHROMIUM_PATH_DEFAULT,
      // Brave (comme Chromium en conteneur) exige --no-sandbox hors environnement graphique standard.
      args: ['--no-sandbox'],
    },
  },

  // 3 largeurs (375/768/1440, spec §5 T5). `layout-accent.spec.ts` est un test visuel sensible
  // au breakpoint (accent + CTA + nav responsive) ; `home.spec.ts`, `admin-site.spec.ts`
  // (phase 3, docs/specs/phase3-holding-home.md §6) et `contact.spec.ts` (phase 3,
  // docs/specs/phase3-holding-contact.md §6, critère 9) ont aussi un critère mobile-only (375px)
  // et doivent tourner desktop + mobile. Idem pour les pages filiales du lot 1
  // (`filiale-accueil`, `filiale-services`, `realisations`, `confidentialite`, spec
  // docs/specs/lot1-pages-filiales.md §5 T3) — parcours publics à revalider aux 2 largeurs.
  // `admin-parametres.spec.ts` (lot 5, docs/specs/lot5-parametres.md §8) a un critère mobile
  // explicite : dialog de changement de mot de passe et cibles ≥ 44 px vérifiés à 375 px.
  // Les autres fichiers (mutations CMS, sécurité API, maintenance) ne gagnent rien à tourner
  // 3 fois sur un état DB partagé — ils ne tournent que sur le projet "desktop".
  projects: [
    {
      name: 'mobile',
      use: { viewport: { width: 375, height: 812 } },
      testMatch: /(layout-accent|home|admin-site|admin-shell|admin-messages|admin-clients|admin-placement|admin-reservations|admin-planning|admin-comptable|admin-parametres|admin-utilisateurs|contact|contact-filiales|filiale-accueil|filiale-services|realisations|confidentialite|mentions-legales)\.spec\.ts/,
    },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 } }, testMatch: /(layout-accent|admin-shell)\.spec\.ts/ },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],

  // Pas de `webServer` : le serveur (build de production) est démarré séparément par
  // l'orchestrateur du run e2e, voir CLAUDE.md §Tests.
})
