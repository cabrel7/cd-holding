// Gabarit "accusé de réception" (spec §4.7) — envoyé au demandeur après un formulaire public.
// Infrastructure livrée en phase 2 ; branchement formulaire par formulaire en phase 3.
import { escapeHtml } from '../escape'

export interface MailContent {
  readonly subject: string
  readonly text: string
  readonly html: string
}

export interface AccuseReceptionVars {
  readonly nomDestinataire: string
  readonly nomEntreprise: string
}

export function accuseReceptionTemplate(vars: AccuseReceptionVars): MailContent {
  const destinataire = escapeHtml(vars.nomDestinataire)
  const entreprise = escapeHtml(vars.nomEntreprise)

  return {
    subject: `Nous avons bien reçu votre message — ${vars.nomEntreprise}`,
    text: [
      `Bonjour ${vars.nomDestinataire},`,
      '',
      'Nous avons bien reçu votre message. Notre équipe vous répondra dans les meilleurs délais.',
      '',
      vars.nomEntreprise,
    ].join('\n'),
    html: `<p>Bonjour ${destinataire},</p><p>Nous avons bien reçu votre message. Notre équipe vous répondra dans les meilleurs délais.</p><p>${entreprise}</p>`,
  }
}
