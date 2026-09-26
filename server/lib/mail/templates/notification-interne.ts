// Gabarit "notification interne" (spec §4.7) — envoyé à `Company.email` quand renseigné, pour
// signaler un nouveau message public (contact, suggestion, candidature...). Phase 3 branche
// l'appel formulaire par formulaire ; l'infrastructure est livrée ici.
import { escapeHtml } from '../escape'
import type { MailContent } from './accuse-reception'

export interface NotificationInterneVars {
  readonly nomEntreprise: string
  readonly typeMessage: string
  readonly nomExpediteur: string
  /** D'où provient le message, ex. « site du groupe » (spec contact §3.3). Optionnel : rétrocompatible. */
  readonly origine?: string
}

export function notificationInterneTemplate(vars: NotificationInterneVars): MailContent {
  const typeMessage = escapeHtml(vars.typeMessage)
  const expediteur = escapeHtml(vars.nomExpediteur)
  const origineTexte = vars.origine ? ` (${vars.origine})` : ''
  const origineHtml = vars.origine ? ` (${escapeHtml(vars.origine)})` : ''

  return {
    subject: `Nouveau message (${vars.typeMessage}) — ${vars.nomEntreprise}`,
    text: `Un nouveau message de type "${vars.typeMessage}" a été reçu de ${vars.nomExpediteur}${origineTexte}. Consultez le tableau de bord pour le détail.`,
    html: `<p>Un nouveau message de type « ${typeMessage} » a été reçu de ${expediteur}${origineHtml}.</p><p>Consultez le tableau de bord pour le détail.</p>`,
  }
}
