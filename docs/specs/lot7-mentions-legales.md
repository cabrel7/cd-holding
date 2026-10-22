# Lot 7 — Mentions légales boissons + mention alcool (Q-07/Q-01)

## Objet

Rendre visibles deux contenus du catalogue existants mais jamais affichés (relevé 2026-10-12,
dossier `docs/dossier-juriste-q01.md` §4-5) — l'objectif étant que le **client valide les
textes directement sur les pages** et demande les corrections via l'admin :

1. `MENTIONS_LEGALES:mentions` (type `legal`, portée `['boissons']`) — aucune page ne la rend.
2. `COMMUN:mentionAlcool` (type `texte`, portée `['boissons']`) — exposée par l'API
   (`site.commun.mentionAlcool`), jamais rendue.

## Décisions

| # | Décision | Justification |
|---|---|---|
| D1 | Page `app/pages/[filiale]/mentions-legales.vue` — générique, filiale par filiale | Pattern des pages `[filiale]` (CLAUDE.md « par type de page ») ; une seule page couvre le cas présent et futur |
| D2 | Filiale sans section `mentions` → **404** (fatal) ; erreur réseau → état « Réessayer » | Le catalogue ne porte la page que pour boissons ; pas de page vide |
| D3 | `bypassMaintenance: true` + ISR (`/${s}/**` déjà en routeRules) | Miroir `/confidentialite` : page légale lisible en maintenance |
| D4 | Rendu `TexteLegal` (composant partagé avec `/confidentialite`), SEO via `MENTIONS_LEGALES:seo` | Un seul gabarit légal, écart prototype assumé (le prototype n'a pas cette page : ajout phase 2, Q-07) |
| D5 | `mentionAlcool` rendue dans `SiteFooter` (ligne au-dessus de la barre copyright), avec interpolation `{nomCourt}` ; lien « Mentions légales » vers `/{slug}/mentions-legales` **conditionné à la présence de la mention** (proxy : seuls les sites RACJ l'affichent) | Emplacement standard RACJ/Éduc'alcool ; le lien ne peut pas pointer vers une 404 ; à confirmer par le client (question 10 du dossier juriste) |

## Périmètre

- `app/pages/[filiale]/mentions-legales.vue` (nouveau)
- `app/components/site/SiteFooter.vue` (mention + lien conditionnels)
- `tests/e2e/mentions-legales.spec.ts` (nouveau) : 200 boissons (titre + texte RACJ + lien
  footer), 404 entretien, footer boissons avec mention / footer entretien sans
- Captures 375/768/1440 (`conversion-captures/lot7-nuxt/`)
- Pas de vidéo (aucune chorégraphie), pas de migration, pas de seed.

## Écarts/limites assumés

- Pas de test e2e du `bypassMaintenance` (méta identique à `/confidentialite`, couverte par
  `confidentialite.spec.ts`).
- Le lien footer dépend de `mentionAlcool` (si l'admin efface la mention, le lien disparaît
  alors que la page reste servie) — couplage documenté, à revoir si le client ajoute la page
  à d'autres filiales.
- Emplacement de la mention alcool = hypothèse par défaut (pied de page) à confirmer par le
  client/juriste (question 10).
