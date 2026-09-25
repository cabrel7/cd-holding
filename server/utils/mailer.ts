// Singleton de transport courriel + file d'attente non bloquante (spec §4.7). `queueMail` ne
// bloque jamais la réponse HTTP et NE LÈVE JAMAIS : un échec d'envoi est journalisé
// (consola.error, sans PII : ni destinataire, ni sujet, ni corps) sans jamais faire échouer la
// route appelante.
import type { H3Event } from 'h3'
import { consola } from 'consola'
import { z } from 'zod'
import { createLogTransport, createSmtpTransport, type MailTransport, type OutgoingMail } from '../lib/mail/transports'

export type { OutgoingMail } from '../lib/mail/transports'

export const mailConfigSchema = z.object({
  transport: z.enum(['log', 'smtp']),
  from: z.string(),
  smtp: z.object({
    host: z.string(),
    port: z.number().int().positive(),
    secure: z.boolean(),
    user: z.string(),
    password: z.string(),
  }),
})

export type MailConfig = z.infer<typeof mailConfigSchema>

let cachedTransport: MailTransport | undefined

/** Construit (une fois, mise en cache) le transport actif à partir de `runtimeConfig.mail`. */
export function getMailTransport(): MailTransport {
  if (cachedTransport) return cachedTransport

  const parsed = mailConfigSchema.safeParse(useRuntimeConfig().mail)
  if (!parsed.success) {
    consola.error('[mail] configuration invalide, repli sur le transport "log"')
    cachedTransport = createLogTransport(consola)
    return cachedTransport
  }

  if (parsed.data.transport === 'smtp' && parsed.data.smtp.host && parsed.data.from) {
    cachedTransport = createSmtpTransport({ ...parsed.data.smtp, from: parsed.data.from })
    return cachedTransport
  }

  if (parsed.data.transport === 'smtp') {
    consola.error('[mail] transport "smtp" demandé sans host/from, repli sur "log"')
  }
  cachedTransport = createLogTransport(consola)
  return cachedTransport
}

/** Réservé aux tests : force le prochain `getMailTransport()` à reconstruire le transport. */
export function resetMailTransportCache(): void {
  cachedTransport = undefined
}

/**
 * Envoie via le transport donné SANS jamais lever : un échec est journalisé (`consola.error`,
 * aucune PII — ni destinataire, ni sujet, ni corps) et absorbé. Extrait de `queueMail` pour
 * rester testable sans contexte Nitro (ni `useRuntimeConfig`, ni `H3Event`) — voir
 * tests/unit/mailer.test.ts.
 */
export async function sendMailSafely(transport: MailTransport, mail: OutgoingMail): Promise<void> {
  try {
    await transport.send(mail)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'erreur inconnue'
    consola.error('[mail] échec', { template: mail.template, code })
  }
}

/**
 * File un envoi de courriel SANS bloquer la réponse HTTP : `to`/`replyTo` sont déjà validés
 * par zod en amont (schéma du formulaire appelant) — cette fonction ne revalide pas les
 * adresses, elle ne fait que déléguer à `sendMailSafely` sur le transport actif.
 */
export function queueMail(event: H3Event, mail: OutgoingMail): void {
  event.waitUntil(sendMailSafely(getMailTransport(), mail))
}
