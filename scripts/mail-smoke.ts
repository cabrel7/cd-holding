// Vérifie la configuration NUXT_MAIL_* et, quand le transport actif est « smtp », envoie un
// réel courriel de test. Sortie sans PII ni secret : adresses masquées, mot de passe jamais
// affiché (les messages d'erreur SMTP restent affichés — c'est un CLI interactif, pas un log).
//
// Usage : pnpm exec tsx scripts/mail-smoke.ts [--to=adresse@exemple.org]
// Sans --to : destinataire par défaut = NUXT_MAIL_SMTP_USER puis NUXT_MAIL_FROM (auto-test).
// Code retour : 0 = OK (ou envoi simulé en transport « log »), 1 = config ou envoi en échec.
import 'dotenv/config'
import process from 'node:process'
import { mailConfigSchema } from '../server/utils/mailer'
import { createLogTransport, createSmtpTransport, type MailTransport } from '../server/lib/mail/transports'

function maskAdresse(adresse: string): string {
  const indexArobas = adresse.indexOf('@')
  if (indexArobas <= 0) return '***'
  return `${adresse[0]}***@${adresse.slice(indexArobas + 1)}`
}

function lireConfiguration() {
  return mailConfigSchema.safeParse({
    transport: process.env.NUXT_MAIL_TRANSPORT ?? 'log',
    from: process.env.NUXT_MAIL_FROM ?? '',
    smtp: {
      host: process.env.NUXT_MAIL_SMTP_HOST ?? '',
      port: Number(process.env.NUXT_MAIL_SMTP_PORT ?? '587'),
      secure: (process.env.NUXT_MAIL_SMTP_SECURE ?? 'false') === 'true',
      user: process.env.NUXT_MAIL_SMTP_USER ?? '',
      password: process.env.NUXT_MAIL_SMTP_PASSWORD ?? '',
    },
  })
}

function destinataireDemande(): string | undefined {
  const argument = process.argv.find((element) => element.startsWith('--to='))
  return argument?.slice('--to='.length).trim() || undefined
}

async function main(): Promise<number> {
  const parse = lireConfiguration()
  if (!parse.success) {
    console.error('[mail-smoke] NUXT_MAIL_* invalides :')
    for (const probleme of parse.error.issues) {
      console.error(`  - ${probleme.path.join('.')}: ${probleme.message}`)
    }
    return 1
  }

  const config = parse.data
  const complet = config.transport === 'smtp' && config.smtp.host !== '' && config.from !== ''

  if (config.transport === 'log') {
    console.info('[mail-smoke] NUXT_MAIL_TRANSPORT=log : envoi simulé, aucun courriel réel.')
    const champsVides = (['host', 'user', 'password'] as const).filter((champ) => config.smtp[champ] === '')
    if (champsVides.length > 0) {
      console.info(`[mail-smoke] bascule SMTP impossible pour l'instant : champs vides => ${champsVides.join(', ')}.`)
    } else {
      console.info(
        `[mail-smoke] identifiants présents : bascule possible en posant NUXT_MAIL_TRANSPORT=smtp (FROM=${maskAdresse(config.from)}).`,
      )
    }
  } else if (!complet) {
    console.info('[mail-smoke] transport=smtp mais config incomplète (host ou from) : repli « log », comme le serveur.')
  }

  const destinataire = destinataireDemande() ?? (config.smtp.user || config.from)
  // Même règle de repli que getMailTransport() côté serveur : smtp sans host/from = transport log.
  const transport: MailTransport = complet
    ? createSmtpTransport({ ...config.smtp, from: config.from })
    : createLogTransport({ info: (message, context) => console.info(message, context ?? '') })

  if (transport.name === 'smtp' && !destinataire) {
    console.error('[mail-smoke] aucun destinataire : passe --to=adresse ou renseigne NUXT_MAIL_SMTP_USER.')
    return 1
  }
  const to = destinataire ?? 'simulation@example.test'

  try {
    await transport.send({
      template: 'test-mail-smoke',
      to,
      subject: "Test d'envoi — Groupe CD",
      text: 'Courriel de test généré par scripts/mail-smoke.ts.',
      html: '<p>Courriel de test généré par <code>scripts/mail-smoke.ts</code>.</p>',
    })
    if (transport.name === 'smtp') {
      console.info(
        `[mail-smoke] OK — courriel réel envoyé à ${maskAdresse(to)} via ${config.smtp.host}:${config.smtp.port}.`,
      )
    } else {
      console.info('[mail-smoke] OK — envoi simulé (transport log).')
    }
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erreur inconnue'
    console.error(`[mail-smoke] échec (${transport.name}) : ${message}`)
    return 1
  }
}

main().then((code) => {
  process.exitCode = code
})
