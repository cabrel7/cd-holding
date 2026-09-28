// Composable Nuxt (auto-import) : nécessite l'environnement 'nuxt' (voir vitest.config.ts), d'où
// le suffixe `.nuxt.test.ts`. `usePublicFormFeedback` n'appelle aucune API Nuxt runtime lui-même,
// mais est consommé comme composable auto-importé par les formulaires (spec lot 2 §4) — on le
// teste dans le même environnement pour rester cohérent avec `use-public-form-submit.nuxt.test.ts`.
import { toast } from 'vue-sonner'
import { describe, expect, it, vi } from 'vitest'

describe('usePublicFormFeedback', () => {
  it('succès : toast.success avec le titre fourni et le message interpolé, renvoie true', () => {
    const succesSpy = vi.spyOn(toast, 'success').mockImplementation(() => '')
    const { notifierResultat } = usePublicFormFeedback()

    const resultat = notifierResultat(
      { ok: true },
      { titreSucces: 'Demande reçue', messageSucces: 'Merci {nomCourt}, nous répondons vite.', vars: { nomCourt: 'CCDPAA' } },
    )

    expect(resultat).toBe(true)
    expect(succesSpy).toHaveBeenCalledWith('Demande reçue', { description: 'Merci CCDPAA, nous répondons vite.' })
    succesSpy.mockRestore()
  })

  it('succès sans messageSucces : utilise le message de repli', () => {
    const succesSpy = vi.spyOn(toast, 'success').mockImplementation(() => '')
    const { notifierResultat } = usePublicFormFeedback()

    notifierResultat({ ok: true }, { titreSucces: 'Suggestion envoyée', messageSucces: null })

    expect(succesSpy).toHaveBeenCalledWith('Suggestion envoyée', { description: 'Votre message a bien été reçu.' })
    succesSpy.mockRestore()
  })

  it('validation : toast.error générique, renvoie false', () => {
    const erreurSpy = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const { notifierResultat } = usePublicFormFeedback()

    const resultat = notifierResultat({ ok: false, raison: 'validation', retryAfterSeconds: null }, { titreSucces: 'x' })

    expect(resultat).toBe(false)
    expect(erreurSpy).toHaveBeenCalledWith('Certaines informations sont invalides. Vérifiez le formulaire.')
    erreurSpy.mockRestore()
  })

  it('429 : convertit retryAfterSeconds en minutes (pluriel correct)', () => {
    const erreurSpy = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const { notifierResultat } = usePublicFormFeedback()

    notifierResultat({ ok: false, raison: 'trop-de-requetes', retryAfterSeconds: 125 }, { titreSucces: 'x' })

    expect(erreurSpy).toHaveBeenCalledWith('Trop d’envois depuis votre connexion.', { description: 'Réessayez dans 3 minutes.' })
    erreurSpy.mockRestore()
  })

  it('429 sans Retry-After : message générique', () => {
    const erreurSpy = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const { notifierResultat } = usePublicFormFeedback()

    notifierResultat({ ok: false, raison: 'trop-de-requetes', retryAfterSeconds: null }, { titreSucces: 'x' })

    expect(erreurSpy).toHaveBeenCalledWith('Trop d’envois depuis votre connexion.', { description: 'Réessayez dans quelques minutes.' })
    erreurSpy.mockRestore()
  })

  it('erreur serveur : propose le courriel de secours quand il est fourni', () => {
    const erreurSpy = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const { notifierResultat } = usePublicFormFeedback()

    notifierResultat(
      { ok: false, raison: 'erreur', retryAfterSeconds: null },
      { titreSucces: 'x', emailSecours: 'contact@groupecd.ca' },
    )

    expect(erreurSpy).toHaveBeenCalledWith('L’envoi a échoué. Réessayez dans un instant.', {
      description: 'Vous pouvez aussi nous écrire à contact@groupecd.ca',
    })
    erreurSpy.mockRestore()
  })

  it('erreur serveur : aucune description sans courriel de secours', () => {
    const erreurSpy = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const { notifierResultat } = usePublicFormFeedback()

    notifierResultat({ ok: false, raison: 'erreur', retryAfterSeconds: null }, { titreSucces: 'x' })

    expect(erreurSpy).toHaveBeenCalledWith('L’envoi a échoué. Réessayez dans un instant.', { description: undefined })
    erreurSpy.mockRestore()
  })

  it('introuvable / fichier sans messages fournis : toast générique d’erreur (formulaires JSON inchangés)', () => {
    const erreurSpy = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const { notifierResultat } = usePublicFormFeedback()

    for (const raison of ['introuvable', 'fichier'] as const) {
      const resultat = notifierResultat({ ok: false, raison, retryAfterSeconds: null }, { titreSucces: 'x' })
      expect(resultat).toBe(false)
    }

    expect(erreurSpy).toHaveBeenCalledTimes(2)
    expect(erreurSpy).toHaveBeenNthCalledWith(1, 'L’envoi a échoué. Réessayez dans un instant.', { description: undefined })
    expect(erreurSpy).toHaveBeenNthCalledWith(2, 'L’envoi a échoué. Réessayez dans un instant.', { description: undefined })
    erreurSpy.mockRestore()
  })

  it('introuvable / fichier avec messages fournis : toast avec le message propre', () => {
    const erreurSpy = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const { notifierResultat } = usePublicFormFeedback()
    const messages = { introuvable: 'Offre retirée.', fichier: 'Fichier refusé.' }

    notifierResultat({ ok: false, raison: 'introuvable', retryAfterSeconds: null }, { titreSucces: 'x', messages })
    notifierResultat({ ok: false, raison: 'fichier', retryAfterSeconds: null }, { titreSucces: 'x', messages })

    expect(erreurSpy).toHaveBeenNthCalledWith(1, 'Offre retirée.')
    expect(erreurSpy).toHaveBeenNthCalledWith(2, 'Fichier refusé.')
    erreurSpy.mockRestore()
  })
})
