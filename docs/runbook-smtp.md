# Runbook — SMTP (Q-10 : courriels réels)

## État des lieux

- **Code fait** (phase 2, spec `docs/specs/phase2-foundations.md` §4.7) : les trois formulaires
  publics (contact, candidature placement, réservation restaurant) envoient, via `queueMail`
  (non bloquant, un échec n'échoue jamais la route) :
  - un **accusé de réception** au visiteur ;
  - une **notification interne** à `cible.email ?? holding.email` (`server/lib/contact.ts`).
- **Transport actif = `log`** tant que `NUXT_MAIL_TRANSPORT` vaut autre chose que `smtp` :
  rien n'est réellement envoyé. Or les messages de succès des formulaires promettent un
  courriel → **bloquant mise en production**.
- Rate limit : 3 accusés / 24 h / destinataire (anti-relais de spam).

## Configuration actuelle (2026-10-12) — Namecheap Private Email

Le `.env` du projet pointe sur le compte pro du client :

| Variable | Valeur actuelle |
|---|---|
| `NUXT_MAIL_TRANSPORT` | `smtp` |
| `NUXT_MAIL_SMTP_HOST` | `mail.privateemail.com` |
| `NUXT_MAIL_SMTP_PORT` | `587` |
| `NUXT_MAIL_SMTP_SECURE` | `false` (587 = STARTTLS ; `true` réservé au 465) |
| `NUXT_MAIL_SMTP_USER` / `NUXT_MAIL_FROM` | `noreply@chauvierdelor.com` (expéditeur) |
| `NUXT_MAIL_SMTP_PASSWORD` | **mot de passe de la boîte** (le même que la webmail) |

**Pièges rencontrés et réglés** (ne pas reproduire) :

- Seuls les noms `NUXT_MAIL_*` sont lus par l'application — des variantes inventées
  (`NUXT_NOREPLY_MAIL_SMTP_USER`, …) sont **ignorées** silencieusement.
- Private Email **n'a pas de « mot de passe d'application »** : c'est le mot de passe de
  boîte qui authentifie SMTP (test définitif = connexion webmail qui accepte).
- Refus `535 authentication failed` = mot de passe faux **ou** accès client mail/SMTP
  désactivé sur la boîte (panneau → boîte → activer l'accès).
- `NUXT_MAIL_SMTP_SECURE` attend `true`/`false` — une valeur comme `ssl` casse la
  validation zod (repli `log`).

## Bascule (exemple Gmail)

1. **Google Account → Sécurité → Vérification en deux étapes → Mots de passe des applications** :
   générer un mot de passe d'application (16 caractères). Google n'accepte plus le mot de passe
   du compte ni l'option « apps moins sécurisées ».
2. Renseigner `.env` :

   | Variable | Valeur |
   |---|---|
   | `NUXT_MAIL_TRANSPORT` | `smtp` |
   | `NUXT_MAIL_SMTP_HOST` | `smtp.gmail.com` |
   | `NUXT_MAIL_SMTP_PORT` | `587` |
   | `NUXT_MAIL_SMTP_SECURE` | `false` (587 = STARTTLS ; `true` réservé au 465) |
   | `NUXT_MAIL_SMTP_USER` | `compte@gmail.com` |
   | `NUXT_MAIL_SMTP_PASSWORD` | mot de passe d'application |
   | `NUXT_MAIL_FROM` | identique à l'utilisateur (compte ou alias vérifié — sinon Gmail refuse/expéditeur perçu comme falsifié) |

3. **Vérifier** (depuis la racine) :

   ```bash
   pnpm exec tsx scripts/mail-smoke.ts                        # auto-test vers soi-même
   pnpm exec tsx scripts/mail-smoke.ts --to=externe@exemple.ca # vérif de réception externe
   ```

   Le script n'affiche jamais le mot de passe et masque les adresses (`c***@gmail.com`).
   Sortie `OK — courriel réel envoyé` = prêt ; code retour 1 sinon.
4. **Redémarrer le serveur** : `runtimeConfig` est lu au démarrage (dev et prod).
5. **Renseigner `Company.email`** (admin → onglet Site, holding au minimum) : sans elle,
   la notification interne saute silencieusement (`destinataireInterne` → `null`).

## Dépannage

- **Retour arrière** : `NUXT_MAIL_TRANSPORT=log` + redémarrage. Les échecs SMTP sont absorbés
  (journal `[mail] échec { template }` sans PII), jamais une erreur HTTP.
- **`Invalid login` / `AUTHENTICATE failed`** : c'est le mot de passe de compte, pas le mot de
  passe d'application (ou le compte a la 2FA inactive — obligatoire pour les app passwords).
- **Échec « STARTTLS required »** : comportement voulu — depuis 2026-10-12, `requireTLS`
  (`server/lib/mail/transports.ts`) interdit l'authentification en clair si le serveur n'offre
  pas STARTTLS.
- **Config invalide** (host/from manquant sous `transport=smtp`) → repli silencieux `log`.
  Attention : l'erreur `consola.error` n'apparaît qu'au **premier envoi** (courriels en file),
  pas au démarrage — `scripts/mail-smoke.ts` détecte ce cas immédiatement.
- **Limites Gmail** (compte personnel) : 500 courriels/jour — largement au-dessus du volume
  formulaires (borné par le rate limit ci-dessus).

## Sécurité

- `.env` jamais versionné ; aucun secret dans le code.
- Aucun PII dans les journaux serveur : ni destinataire, ni sujet, ni corps.
- Les gabarits vivent en code (`server/lib/mail/templates/`) ; seuls les messages affichés
  après envoi (`messageSucces`) sont éditables depuis l'admin (Sections).
