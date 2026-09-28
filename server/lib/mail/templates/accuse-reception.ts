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
  /** « candidature », « demande de réservation »… défaut : « message » (spec lot 3 §3). */
  readonly objet?: string
  /** Ex. « 4 personnes, mardi 14 octobre 2026 à 19h30 » — toujours généré côté serveur, jamais recopié du client. Échappé en HTML. */
  readonly recapitulatif?: string
}

export function accuseReceptionTemplate(vars: AccuseReceptionVars): MailContent {
  const destinataire = escapeHtml(vars.nomDestinataire)
  const entreprise = escapeHtml(vars.nomEntreprise)
  const objet = vars.objet ?? 'message'
  const recapitulatifHtml = vars.recapitulatif ? `<p>Récapitulatif : ${escapeHtml(vars.recapitulatif)}</p>` : ''

  return {
    subject: `Nous avons bien reçu votre ${objet} — ${vars.nomEntreprise}`,
    text: [
      `Bonjour ${vars.nomDestinataire},`,
      '',
      `Nous avons bien reçu votre ${objet}. Notre équipe vous répondra dans les meilleurs délais.`,
      ...(vars.recapitulatif ? ['', `Récapitulatif : ${vars.recapitulatif}`] : []),
      '',
      vars.nomEntreprise,
    ].join('\n'),
    html: `<p>Bonjour ${destinataire},</p><p>Nous avons bien reçu votre ${objet}. Notre équipe vous répondra dans les meilleurs délais.</p>${recapitulatifHtml}<p>${entreprise}</p>`,
  }
}
