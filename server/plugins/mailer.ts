// Valide la configuration mailer au démarrage (spec §4.7) : une configuration invalide loggue
// une erreur et le site reste en ligne (repli sur le transport 'log', voir server/utils/mailer.ts,
// `getMailTransport`). En production avec 'log' actif : un avertissement unique (aucun courriel
// réel ne partira tant qu'un transport 'smtp' valide n'est pas configuré).
import { consola } from 'consola'
import { mailConfigSchema } from '../utils/mailer'

export default defineNitroPlugin(() => {
  const parsed = mailConfigSchema.safeParse(useRuntimeConfig().mail)

  if (!parsed.success) {
    consola.error('[mail] configuration invalide au démarrage, repli sur le transport "log"')
    return
  }

  if (parsed.data.transport === 'log' && process.env.NODE_ENV === 'production') {
    consola.warn('[mail] transport "log" actif en production : aucun courriel ne sera réellement envoyé')
  }
})
