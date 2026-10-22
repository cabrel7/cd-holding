#!/usr/bin/env node
/**
 * Capture de référence du prototype React (Lovable) hébergé.
 *
 * Parcourt les routes du prototype (déduites de prototype_react/cd-holding-nexus/src/routes/*.tsx)
 * et capture une image pleine page par breakpoint (375/768/1440) dans conversion-captures/.
 *
 * Réutilisable en phase 3 (PROMPT_CONVERSION.md) pour comparer le rendu Nuxt au prototype figé :
 *   node scripts/capture-prototype.mjs
 *   node scripts/capture-prototype.mjs --only=/entretien/services,/contact
 *
 * Ne lance PAS `playwright install` : utilise le Chromium déjà en cache local.
 */

import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(PROJECT_ROOT, "conversion-captures");
const PROTO_ROUTES_DIR = "prototype_react/cd-holding-nexus/src/routes";

const BASE_URL = "https://cd-holding-nexus.lovable.app";

const CHROMIUM_PATH =
  process.env.PW_CHROMIUM_PATH ||
  "/home/cabrel/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";

const VIEWPORTS = [
  { name: "375x812", width: 375, height: 812 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x900", width: 1440, height: 900 },
];

const NAV_TIMEOUT = 60_000;
const ACTION_TIMEOUT = 30_000;
const RETRIES_PER_ROUTE = 2;
const SETTLE_DELAY_MS = 700; // laisse le temps aux animations d'entrée

// ---------------------------------------------------------------------------
// Comptes de démonstration (mockdata.ts) — valeurs lues depuis l'environnement
// ou repliées sur les comptes documentés dans le prototype (visibles publiquement
// sur la page /admin/login elle-même : ce ne sont pas des secrets de production).
// ---------------------------------------------------------------------------
const ACCOUNTS = {
  super_admin: {
    email: process.env.DEMO_SUPER_ADMIN_EMAIL || "admin@groupecd.ca",
    password: process.env.DEMO_SUPER_ADMIN_PASSWORD || "admin123",
  },
  admin_filiale: {
    email: process.env.DEMO_ADMIN_FILIALE_EMAIL || "comptable@groupecd.ca",
    password: process.env.DEMO_ADMIN_FILIALE_PASSWORD || "comptable123",
  },
  employe: {
    email: process.env.DEMO_EMPLOYE_EMAIL || "entretien@groupecd.ca",
    password: process.env.DEMO_EMPLOYE_PASSWORD || "employe123",
  },
};

// ---------------------------------------------------------------------------
// Routes publiques (aucune auth) — dérivées de src/routes/*.tsx
// ---------------------------------------------------------------------------
const PUBLIC_ROUTES = [
  { path: "/", file: "index.tsx" },
  { path: "/a-propos", file: "a-propos.tsx" },
  { path: "/contact", file: "contact.tsx" },

  { path: "/entretien", file: "entretien.index.tsx" },
  { path: "/entretien/a-propos", file: "entretien.a-propos.tsx" },
  { path: "/entretien/contact", file: "entretien.contact.tsx" },
  { path: "/entretien/realisations", file: "entretien.realisations.tsx" },
  { path: "/entretien/services", file: "entretien.services.tsx" },

  { path: "/transport", file: "transport.index.tsx" },
  { path: "/transport/a-propos", file: "transport.a-propos.tsx" },
  { path: "/transport/contact", file: "transport.contact.tsx" },
  { path: "/transport/realisations", file: "transport.realisations.tsx" },
  { path: "/transport/services", file: "transport.services.tsx" },

  { path: "/comptable", file: "comptable.index.tsx" },
  { path: "/comptable/a-propos", file: "comptable.a-propos.tsx" },
  { path: "/comptable/contact", file: "comptable.contact.tsx" },
  { path: "/comptable/realisations", file: "comptable.realisations.tsx" },
  { path: "/comptable/services", file: "comptable.services.tsx" },

  { path: "/placement", file: "placement.index.tsx" },
  { path: "/placement/a-propos", file: "placement.a-propos.tsx" },
  { path: "/placement/contact", file: "placement.contact.tsx" },
  { path: "/placement/offres", file: "placement.offres.tsx" },
  { path: "/placement/realisations", file: "placement.realisations.tsx" },
  { path: "/placement/services", file: "placement.services.tsx" },

  { path: "/cdpaa", file: "cdpaa.index.tsx" },
  { path: "/cdpaa/a-propos", file: "cdpaa.a-propos.tsx" },
  { path: "/cdpaa/contact", file: "cdpaa.contact.tsx" },
  { path: "/cdpaa/realisations", file: "cdpaa.realisations.tsx" },
  { path: "/cdpaa/restaurant", file: "cdpaa.restaurant.tsx" },
  { path: "/cdpaa/services", file: "cdpaa.services.tsx" },

  { path: "/boissons", file: "boissons.index.tsx" },
  { path: "/boissons/a-propos", file: "boissons.a-propos.tsx" },
  { path: "/boissons/contact", file: "boissons.contact.tsx" },
  { path: "/boissons/realisations", file: "boissons.realisations.tsx" },
  { path: "/boissons/services", file: "boissons.services.tsx" },
];

// Capturée déconnectée explicitement (pas de session) ; l'index.tsx /admin
// redirige immédiatement vers /admin/dashboard une fois connecté donc n'a
// pas de rendu propre à capturer.
const LOGGED_OUT_ROUTES = [{ path: "/admin/login", file: "admin.login.tsx" }];

// Routes admin capturées connecté en super_admin (le rôle qui voit tout).
const ADMIN_ROUTES = [
  { path: "/admin/dashboard", file: "admin.dashboard.tsx" },
  { path: "/admin/messages", file: "admin.messages.tsx" },
  { path: "/admin/contenu", file: "admin.contenu.index.tsx (layout: admin.contenu.tsx)" },
  { path: "/admin/contenu/services", file: "admin.contenu.services.tsx" },
  { path: "/admin/contenu/realisations", file: "admin.contenu.realisations.tsx" },
  { path: "/admin/contenu/equipe", file: "admin.contenu.equipe.tsx" },
  { path: "/admin/contenu/partenaires", file: "admin.contenu.partenaires.tsx" },
  { path: "/admin/clients", file: "admin.clients.tsx" },
  { path: "/admin/planning", file: "admin.planning.tsx" },
  { path: "/admin/comptable", file: "admin.comptable.tsx" },
  { path: "/admin/placement", file: "admin.placement.tsx" },
  { path: "/admin/filiales", file: "admin.filiales.tsx" },
  { path: "/admin/parametres", file: "admin.parametres.tsx" },
  { path: "/admin/mon-planning", file: "admin.mon-planning.tsx" },
];

// Vues admin qui diffèrent fortement selon le rôle (sidebar restreinte,
// données scopées à la filiale) : capture supplémentaire avec suffixe.
const ROLE_VARIANT_ROUTES = [
  { path: "/admin/mon-planning", file: "admin.mon-planning.tsx", role: "employe", suffix: "-employe" },
  { path: "/admin/dashboard", file: "admin.dashboard.tsx", role: "employe", suffix: "-employe" },
  { path: "/admin/dashboard", file: "admin.dashboard.tsx", role: "admin_filiale", suffix: "-admin-filiale" },
  { path: "/admin/contenu", file: "admin.contenu.index.tsx", role: "admin_filiale", suffix: "-admin-filiale" },
];

function routeSlug(routePath) {
  if (routePath === "/") return "home";
  return routePath.replace(/^\//, "").replace(/\//g, "__");
}

async function settle(page) {
  await page.waitForTimeout(SETTLE_DELAY_MS);
  // Déclenche les animations/lazy-load au scroll : bas puis retour en haut.
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight / 2));
    const max = document.body.scrollHeight;
    for (let y = 0; y < max; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, max);
    await new Promise((r) => setTimeout(r, 250));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 250));
  });
  await page.waitForTimeout(300);
}

async function loginAs(page, role) {
  const account = ACCOUNTS[role];
  if (!account) throw new Error(`Compte de démo inconnu pour le rôle "${role}"`);
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
  await page.getByLabel("Courriel").fill(account.email);
  await page.getByLabel("Mot de passe").fill(account.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/\/admin\/(dashboard|mon-planning)/, { timeout: NAV_TIMEOUT });
  await page.waitForLoadState("networkidle", { timeout: NAV_TIMEOUT });
}

async function captureRoute(browser, { path: routePath, file, roleLabel = null, suffix = "" }) {
  const slug = routeSlug(routePath) + suffix;
  const outDir = path.join(OUT_DIR, slug);
  await mkdir(outDir, { recursive: true });

  const result = {
    route: routePath,
    slug,
    prototypeFile: `${PROTO_ROUTES_DIR}/${file}`,
    role: roleLabel,
    status: "ok",
    captures: [],
    consoleErrors: [],
    error: null,
  };

  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

  try {
    if (roleLabel) {
      await loginAs(page, roleLabel);
    }

    for (const vp of VIEWPORTS) {
      let lastErr = null;
      let ok = false;
      for (let attempt = 0; attempt <= RETRIES_PER_ROUTE && !ok; attempt++) {
        try {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          const resp = await page.goto(`${BASE_URL}${routePath}`, {
            waitUntil: "networkidle",
            timeout: NAV_TIMEOUT,
          });
          if (resp && resp.status() >= 400) {
            throw new Error(`HTTP ${resp.status()} sur ${routePath}`);
          }
          await settle(page);
          const filePath = path.join(outDir, `${vp.name}.png`);
          await page.screenshot({ path: filePath, fullPage: true, timeout: ACTION_TIMEOUT });
          result.captures.push(path.relative(PROJECT_ROOT, filePath));
          ok = true;
        } catch (err) {
          lastErr = err;
          if (attempt < RETRIES_PER_ROUTE) {
            await page.waitForTimeout(1000 * (attempt + 1));
          }
        }
      }
      if (!ok) {
        result.status = "failed";
        result.error = `[${vp.name}] ${lastErr?.message ?? "échec inconnu"}`;
        break;
      }
    }
  } catch (err) {
    result.status = "failed";
    result.error = err?.message ?? String(err);
  } finally {
    result.consoleErrors = [...new Set(consoleErrors)];
    await context.close();
  }

  return result;
}

function buildRouteList(onlyFilter) {
  const list = [
    ...PUBLIC_ROUTES.map((r) => ({ ...r, roleLabel: null, suffix: "" })),
    ...LOGGED_OUT_ROUTES.map((r) => ({ ...r, roleLabel: null, suffix: "" })),
    ...ADMIN_ROUTES.map((r) => ({ ...r, roleLabel: "super_admin", suffix: "" })),
    ...ROLE_VARIANT_ROUTES.map((r) => ({ ...r, roleLabel: r.role, suffix: r.suffix })),
  ];
  if (!onlyFilter) return list;
  const wanted = new Set(onlyFilter.split(",").map((s) => s.trim()));
  return list.filter((r) => wanted.has(r.path));
}

async function main() {
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const onlyFilter = onlyArg ? onlyArg.slice("--only=".length) : null;

  const routes = buildRouteList(onlyFilter);
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Chromium: ${CHROMIUM_PATH}`);
  console.log(`Cible: ${BASE_URL}`);
  console.log(`Routes à capturer: ${routes.length}`);

  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
  });

  const results = [];
  let i = 0;
  for (const route of routes) {
    i += 1;
    const label = route.roleLabel ? ` (rôle: ${route.roleLabel}${route.suffix})` : "";
    console.log(`[${i}/${routes.length}] ${route.path}${label}`);
    const result = await captureRoute(browser, route);
    if (result.status === "failed") {
      console.log(`  -> ECHEC: ${result.error}`);
    } else if (result.consoleErrors.length) {
      console.log(`  -> OK (mais ${result.consoleErrors.length} erreur(s) console)`);
    } else {
      console.log(`  -> OK`);
    }
    results.push(result);
  }

  await browser.close();

  const failed = results.filter((r) => r.status === "failed");
  const withConsoleErrors = results.filter((r) => r.consoleErrors.length > 0);

  await writeFile(
    path.join(OUT_DIR, "index.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        viewports: VIEWPORTS.map((v) => v.name),
        total: results.length,
        failedCount: failed.length,
        results,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log("\n=== Résumé ===");
  console.log(`Total: ${results.length} | Échecs: ${failed.length} | Avec erreurs console: ${withConsoleErrors.length}`);
  if (failed.length) {
    console.log("\nRoutes en échec :");
    for (const f of failed) {
      console.log(`  - ${f.route}${f.role ? ` (${f.role}${f.slug.includes("-") ? "" : ""})` : ""}: ${f.error}`);
    }
  }
  console.log(`\nSortie: ${OUT_DIR}`);

  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Erreur fatale:", err);
  process.exitCode = 1;
});
