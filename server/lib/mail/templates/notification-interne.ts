// Gabarit "notification interne" (spec §4.7) — envoyé à `Company.email` quand renseigné, pour
// signaler un nouveau message public (contact, suggestion, candidature...). Phase 3 branche
// l'appel formulaire par formulaire ; l'infrastructure est livrée ici.
import { escapeHtml } from '../escape'
import type { MailContent } from './accuse-reception'

export interface NotificationInterneVars {
  readonly nomEntreprise: string
  readonly typeMessage: string
  readonly nomExpediteur: string
}

export function notificationInterneTemplate(vars: NotificationInterneVars): MailContent {
  const typeMessage = escapeHtml(vars.typeMessage)
  const expediteur = escapeHtml(vars.nomExpediteur)

  return {
    subject: `Nouveau message (${vars.typeMessage}) — ${vars.nomEntreprise}`,
    text: `Un nouveau message de type "${vars.typeMessage}" a été reçu de ${vars.nomExpediteur}. Consultez le tableau de bord pour le détail.`,
    html: `<p>Un nouveau message de type « ${typeMessage} » a été reçu de ${expediteur}.</p><p>Consultez le tableau de bord pour le détail.</p>`,
  }
}
