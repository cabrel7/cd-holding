// Traduction d'un `PublicSubmitResult` en toast — logique extraite de HoldingContactForm (spec
// docs/specs/lot2-contact-filiales.md §4) pour être partagée par tous les formulaires publics
// (holding, 6 filiales, suggestion) : une seule copie des messages 429/5xx plutôt que 3+.
// Ne vide jamais le formulaire lui-même (ne connaît pas `resetForm`, propre à chaque composant
// appelant) : il retourne `true` sur succès, à charge de l'appelant d'agir en conséquence.
import { toast } from 'vue-sonner'
import { interpoler, type TexteVars } from '#shared/utils/texte'
import type { PublicSubmitResult } from '@/composables/usePublicFormSubmit'

const SECONDES_PAR_MINUTE = 60
const MESSAGE_SUCCES_REPLI = 'Votre message a bien été reçu.'

export interface NotifierResultatOptions {
  readonly titreSucces: string
  readonly messageSucces?: string | null
  readonly vars?: TexteVars
  readonly emailSecours?: string | null
}

export interface UsePublicFormFeedbackReturn {
  /** Affiche le toast adapté au résultat ; renvoie `true` seulement en cas de succès. */
  notifierResultat(resultat: PublicSubmitResult, options: NotifierResultatOptions): boolean
}

export function usePublicFormFeedback(): UsePublicFormFeedbackReturn {
  function notifierResultat(resultat: PublicSubmitResult, options: NotifierResultatOptions): boolean {
    if (resultat.ok) {
      toast.success(options.titreSucces, {
        description: options.messageSucces ? interpoler(options.messageSucces, options.vars) : MESSAGE_SUCCES_REPLI,
      })
      return true
    }

    if (resultat.raison === 'validation') {
      toast.error('Certaines informations sont invalides. Vérifiez le formulaire.')
      return false
    }

    if (resultat.raison === 'trop-de-requetes') {
      const minutes =
        resultat.retryAfterSeconds != null ? Math.ceil(resultat.retryAfterSeconds / SECONDES_PAR_MINUTE) : null
      toast.error('Trop d’envois depuis votre connexion.', {
        description: minutes != null ? `Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.` : 'Réessayez dans quelques minutes.',
      })
      return false
    }

    if (resultat.raison === 'introuvable') {
      toast.error('Cette offre n’est plus disponible.')
      return false
    }

    if (resultat.raison === 'fichier') {
      toast.error('Fichier refusé : PDF (CV), PDF/JPEG/PNG, 10 Mo au total.')
      return false
    }

    toast.error('L’envoi a échoué. Réessayez dans un instant.', {
      description: options.emailSecours ? `Vous pouvez aussi nous écrire à ${options.emailSecours}` : undefined,
    })
    return false
  }

  return { notifierResultat }
}
