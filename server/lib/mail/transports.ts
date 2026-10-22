// Abstraction de transport courriel (spec §4.7) — 'log' (dev/repli, aucune dépendance externe,
// ne journalise QUE { template, transport }, jamais de destinataire/sujet/corps) ou 'smtp'
// (nodemailer, timeouts de 10 s). Pur au sens du skill nitro (aucun accès à H3/Prisma) : le
// choix du transport actif et la lecture de `runtimeConfig` vivent dans server/utils/mailer.ts.
import nodemailer from 'nodemailer'

export interface OutgoingMail {
  readonly template: string
  readonly to: string
  readonly replyTo?: string
  readonly subject: string
  readonly text: string
  readonly html: string
}

export interface MailTransport {
  readonly name: 'log' | 'smtp'
  send(mail: OutgoingMail): Promise<void>
}

export interface MailLogger {
  info(message: string, context?: Record<string, unknown>): void
}

/** Transport de secours (dev, ou repli si la config SMTP est absente/invalide). Sans PII. */
export function createLogTransport(logger: MailLogger): MailTransport {
  return {
    name: 'log',
    async send(mail) {
      logger.info('[mail] envoi simulé', { template: mail.template, transport: 'log' })
    },
  }
}

export interface SmtpTransportConfig {
  readonly host: string
  readonly port: number
  readonly secure: boolean
  readonly user: string
  readonly password: string
  readonly from: string
}

const SMTP_TIMEOUT_MS = 10_000

export function createSmtpTransport(config: SmtpTransportConfig): MailTransport {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    // Auth en clair interdite : force STARTTLS (RFC 3207) hors TLS implicite (port 465).
    requireTLS: !config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  })

  return {
    name: 'smtp',
    async send(mail) {
      await transporter.sendMail({
        from: config.from,
        to: mail.to,
        replyTo: mail.replyTo,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      })
    },
  }
}
