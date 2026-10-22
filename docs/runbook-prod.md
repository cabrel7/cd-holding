# Runbook de production — chauvierdelor.com (VPS, Nginx + PM2)

Complète `docs/specs/lot8-sous-domaines.md` (décisions D1-D10). Un seul app monolithe derrière
Nginx ; les hôtes ne sont qu'une affaire de DNS + `server_name` + réécritures.

## 1. DNS (Namecheap) — 9 enregistrements A vers l'IP du VPS

| Nom | Type | Valeur |
|---|---|---|
| `@` (apex) | A | `IP_VPS` |
| `www` | A | `IP_VPS` |
| `entretien` | A | `IP_VPS` |
| `transport` | A | `IP_VPS` |
| `comptable` | A | `IP_VPS` |
| `placement` | A | `IP_VPS` |
| `ccdpaa` | A | `IP_VPS` |
| `boissons` | A | `IP_VPS` |
| `admin` | A | `IP_VPS` |

Propagation : `dig +short entretien.chauvierdelor.com` pour chaque hôte.

## 2. Préparation de l'app (PM2)

```bash
# .env de prod (base sur .env.example) — jamais de secret dans le dépôt
NUXT_SESSION_PASSWORD=<fort, 32+ car>     # scellement session
DATABASE_URL=postgresql://…
NUXT_UPLOADS_DIR=/var/lib/cd-holding/uploads   # persistant hors dépôt
NUXT_MAIL_TRANSPORT=smtp  NUXT_MAIL_*          # cf. docs/runbook-smtp.md
HOST=127.0.0.1  PORT=3000                      # app NON exposée publiquement

pnpm install --frozen-lockfile
pnpm exec prisma migrate deploy                # migrations versionnées (user : migrations manuelles cf. PROJECT_STATE)
SEED_DEMO_DATA=true pnpm db:seed              # amorçage seulement, jamais sur base déjà éditée
pnpm build

pm2 start .output/server/index.mjs --name cd-holding --update-env --cwd /home/deploy/cd-holding
pm2 save && pm2 startup                       # redémarrage au reboot
```

Vérif locale sur le VPS : `curl -sI 127.0.0.1:3000/ | head -1` → `200`.

## 3. Nginx

Bases : `client_max_body_size` **≥ `MAX_UPLOAD_REQUEST_BYTES`** (`shared/config/upload.ts` =
10 Mo + marge multipart → `16m`) — sans cela, `nuxt-security requestSizeLimiter` n'est jamais
atteint et Nginx coupe à 1 Mo par défaut. `server_tokens off`.

```nginx
# /etc/nginx/conf.d/cd-holding.conf (extraits — voir la suite)

# ---------- 1) www → apex (avant tout le reste) ----------
server {
  listen 80; listen [::]:80;
  server_name www.chauvierdelor.com;
  return 301 https://chauvierdelor.com$request_uri;
}

# ---------- 2) apex : holding + 301 canoniques ----------
server {
  listen 80; listen [::]:80;
  server_name chauvierdelor.com;

  # 301 stripés : /entretien/services -> https://entretien.chauvierdelor.com/services
  # (regex à captures nomées : gère /slug, /slug/x et query ; $is_args$args conserve la query)
  location ~ ^/(?<fs>entretien|transport|comptable|placement|ccdpaa|boissons)(?<rest>/.*)?$ {
    return 301 https://$fs.chauvierdelor.com$rest$is_args$args;
  }
  location ~ ^/admin(?:/(?<rest>.*))?$ {
    return 301 https://admin.chauvierdelor.com/$rest$is_args$args;
  }

  # Exceptions jamais réécrites (le holding n'a pas de préfixe)
  location ^~ /api/     { proxy_pass http://127.0.0.1:3000; include proxy_params.conf; }
  location ^~ /_nuxt/   { proxy_pass http://127.0.0.1:3000; include proxy_params.conf; }
  location ^~ /fonts/   { proxy_pass http://127.0.0.1:3000; include proxy_params.conf; }
  location ^~ /favicon  { proxy_pass http://127.0.0.1:3000; include proxy_params.conf; }

  location / { proxy_pass http://127.0.0.1:3000; include proxy_params.conf; }
}

# Variante si le PCRE ci-dessus pose problème : 14 locations explicites
#   location = /entretien { return 301 https://entretien.chauvierdelor.com/; }
#   location ^~ /entretien/ { return 301 https://entretien.chauvierdelor.com$request_uri; }
#   … idem pour transport, comptable, placement, ccdpaa, boissons
#   location = /admin { return 301 https://admin.chauvierdelor.com/; }
#   location ^~ /admin/ { return 301 https://admin.chauvierdelor.com$request_uri; }
# (le prefix-match est testé AVANT les regex → placer ces locations avant toute regex.)

# ---------- 3) sous-domaine filiale (×6, remplacer entretien) ----------
server {
  listen 80; listen [::]:80;
  server_name entretien.chauvierdelor.com;

  # Strip 301 au edge (anti-boucle, spec D5 ajout 2026-10-21) : l'app re-voit du préfixé si
  # on proxy_pass direct (son middleware 301 répondrait vers le nu → boucle). La cible bare
  # ne re-matche jamais ce location → zéro boucle. Un seul hop si un client tape l'URL
  # préfixée à la main (ou payload préfixé émis par le SSR : stripé → bare → réécrit → 200).
  location ^~ /entretien/ { rewrite ^/entretien(/.*)$ https://entretien.chauvierdelor.com$1 permanent; }
  location = /entretien   { return 301 https://entretien.chauvierdelor.com/; }

  # Exceptions système (jamais réécrites, jamais stripées)
  location ^~ /api/    { proxy_pass http://127.0.0.1:3000; include proxy_params.conf; }
  location ^~ /_nuxt/  { proxy_pass http://127.0.0.1:3000; include proxy_params.conf; }
  location ^~ /fonts/  { proxy_pass http://127.0.0.1:3000; include proxy_params.conf; }
  location ^~ /favicon { proxy_pass http://127.0.0.1:3000; include proxy_params.conf; }

  # Page holding partagée (politique groupe, Loi 25) : servie telle quelle
  location = /confidentialite { proxy_pass http://127.0.0.1:3000; include proxy_params.conf; }

  # Réécriture bare → préfixé (spec D2) : la clé routeRules/records SSR reste préfixée
  location / {
    rewrite ^/$ /entretien last;
    rewrite ^/(.*)$ /entretien/$1 break;
    proxy_pass http://127.0.0.1:3000;
    include proxy_params.conf;
  }
}

# ---------- 4) admin : chemins nus ----------
server {
  listen 80; listen [::]:80;
  server_name admin.chauvierdelor.com;

  # Strip 301 au edge (anti-boucle, même mécanique que les filiales) : /admin/... → nu.
  location ^~ /admin/ { rewrite ^/admin(/.*)$ https://admin.chauvierdelor.com$1 permanent; }
  location = /admin   { return 301 https://admin.chauvierdelor.com/; }

  location ^~ /api/    { proxy_pass http://127.0.0.1:3000; include proxy_params.conf; }
  location ^~ /_nuxt/  { proxy_pass http://127.0.0.1:3000; include proxy_params.conf; }
  location ^~ /fonts/  { proxy_pass http://127.0.0.1:3000; include proxy_params.conf; }
  location ^~ /favicon { proxy_pass http://127.0.0.1:3000; include proxy_params.conf; }

  # Les records `bare-*` servent le nu nativement : AUCUNE réécriture ici.
  location / {
    proxy_pass http://127.0.0.1:3000;
    include proxy_params.conf;
  }
}
```

`proxy_params.conf` :

```nginx
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 60s;
client_max_body_size 16m;          # ≥ MAX_UPLOAD_REQUEST_BYTES (shared/config/upload.ts)
```

Gzip (global, `http {}`) :

```nginx
gzip on;
gzip_comp_level 5;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript image/svg+xml;
```

Recharger : `nginx -t && systemctl reload nginx`.

## 4. TLS (certbot)

Recommandé : **un seul certificat HTTP-01 avec 9 SANs** (tous les noms pointent sur ce VPS →
le défi ACME est servi par les blocs ci-dessus) :

```bash
certbot --nginx -d chauvierdelor.com -d www.chauvierdelor.com \
  -d entretien.chauvierdelor.com -d transport.chauvierdelor.com -d comptable.chauvierdelor.com \
  -d placement.chauvierdelor.com -d ccdpaa.chauvierdelor.com -d boissons.chauvierdelor.com \
  -d admin.chauvierdelor.com --redirect --hsts
certbot renew --dry-run   # cron certbot.timer déjà actif
```

Alternative wildcard DNS-01 (`*.chauvierdelor.com` + apex) : Namecheap n'expose pas de plugin
certbot maintenu (plugin communautaire `certbot-dns-namecheap` non recommandé) → **rester en
HTTP-01**. Après cert : partout `Strict-Transport-Security` vient de `nuxt-security` (headers
globaux) — ne pas le dupliquer dans Nginx.

## 5. Checklist de mise en ligne (exécuter dans l'ordre)

```bash
# TLS
curl -sI https://chauvierdelor.com/ | head -1                    # 200
curl -sI https://www.chauvierdelor.com/ | grep -i '^location'    # 301 → apex

# 301 canoniques stripés (spec D5) — sans slash, avec slash, avec query
curl -sI 'https://chauvierdelor.com/entretien'        | grep -i '^location'  # → https://entretien.chauvierdelor.com/
curl -sI 'https://chauvierdelor.com/entretien/services' | grep -i '^location' # → https://entretien.chauvierdelor.com/services
curl -sI 'https://chauvierdelor.com/entretien/services?q=1' | grep -i '^location'  # query conservée
curl -sI https://chauvierdelor.com/admin/utilisateurs | grep -i '^location'  # → https://admin.chauvierdelor.com/utilisateurs
curl -sI https://chauvierdelor.com/admin             | grep -i '^location'  # → https://admin.chauvierdelor.com/

# Chemins nus sur sous-domaines
for s in entretien transport comptable placement ccdpaa boissons; do
  curl -so /dev/null -w "%{http_code} $s\n" "https://$s.chauvierdelor.com/services"
done                                                              # 6 × 200
curl -so /dev/null -w "%{http_code}\n" https://entretien.chauvierdelor.com/confidentialite   # 200 (holding)
curl -so /dev/null -w "%{http_code}\n" https://chauvierdelor.com/services                   # 404 (validate)

# URL préfixée sur sous-domaine : 301 stripé au edge (anti-boucle D5, pas de pass-through)
curl -sI https://entretien.chauvierdelor.com/entretien/services | grep -i '^location'  # → https://entretien.chauvierdelor.com/services
curl -sI https://entretien.chauvierdelor.com/entretien | grep -i '^location'           # → https://entretien.chauvierdelor.com/

# Admin nu
curl -so /dev/null -w "%{http_code}\n" https://admin.chauvierdelor.com/utilisateurs            # 200 (login)
curl -sI https://admin.chauvierdelor.com/admin/utilisateurs | grep -i '^location'              # 301 nu

# Système jamais réécrit
curl -so /dev/null -w "%{http_code}\n" https://entretien.chauvierdelor.com/api/public/sites    # 200/404, 5xx si réécrit (bug)

# Canonical + HSTS
curl -s https://entretien.chauvierdelor.com/services | grep -o 'rel="canonical"[^>]*'   # href sans /entretien
curl -sI https://chauvierdelor.com/ | grep -i strict-transport
```

Contrôle ISR (spec D3-C3) : `redis-cli`/fs selon storage — aujourd'hui aucune clé
`cache:nitro:routes` ne doit exister (ISR inert) ; si des clés apparaissent après un upgrade
Nitro, elles doivent porter le chemin **préfixé**.

## 6. Sauvegardes

- **Base** : `pg_dump -Fc "$DATABASE_URL" > /var/backups/cd-holding-$(date +%F).dump`
  (cron quotidien, rétention ≥ 14 j, copie hors VPS).
- **Uploads** : `rsync -a "$NUXT_UPLOADS_DIR"/ backup@…:/backups/uploads/`
  (les fichiers ne sont ni dans git ni dans `.output`).
- Restauration testée une fois : `pg_restore -d … < dump` sur instance jetable.

## 7. Déploiement (cadré par CLAUDE.md : un commit = une unité)

```bash
git pull --ff-only
pnpm install --frozen-lockfile
pnpm exec prisma migrate deploy          # jamais migrate reset en prod
pnpm build
pm2 reload cd-holding --update-env       # reload ≠ restart : zéro coupure
```

Rejouer la §5 en accéléré (3 curl : 301, 200 sous-domaine, canonical). Rollback :
`git checkout <tag> && pnpm build && pm2 reload cd-holding`.

## 8. Dépannage

| Symptôme | Cause probable |
|---|---|
| `502` | app pas démarrée / `PORT`≠3000 → `pm2 logs cd-holding` |
| Page vide + asset 404 sur sous-domaine | `^~ /_nuxt/` absent ou réécrit → vérifier `location` |
| Double préfixe `404` | pass-through `^~ /<slug>/` manquant (R5) |
| `413` sur upload | `client_max_body_size` < `MAX_UPLOAD_REQUEST_BYTES` |
| Cookie admin non conservé | hôte mal orthographié dans `SITE_HOSTS` vs DNS |
| 301 en boucle | regex apex attrapant les sous-domaines : vérifier `server_name` du bloc apex |

## 9. Hors périmètre / reste ouvert

- Sitemap/robots par hôte, `hreflang` (spec D9 limites).
- Bascule `isr` → `swr` si un vrai cache HTML est désiré (constat D3-C3 — décision séparée).
- Comptes de monitoring uptime sur les 9 hôtes.
