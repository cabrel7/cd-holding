// Composant Vue (VeeValidate + $fetch) : nécessite l'environnement 'nuxt' (voir vitest.config.ts).
// Réglages fictifs volontairement différents de tout horaire du prototype, pour prouver que les
// créneaux affichés viennent de `creneauxPourDate` (réglages), jamais d'un horaire en dur
// (spec docs/specs/lot3-pages-specifiques.md §4, ReservationForm.vue).
import { readBody } from 'h3'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { toast } from 'vue-sonner'
import ReservationForm from '@/components/site/restaurant/ReservationForm.vue'
import { creneauxPourDate } from '#shared/utils/restaurant'
import { jourIsoSemaine } from '#shared/utils/dates'
import type { PublicRestaurantDto } from '#shared/types/public'

const REGLAGES: PublicRestaurantDto = {
  nom: 'Les Ambassades d’Afrique',
  adresse: null,
  quartier: 'Plateau Mont-Royal',
  joursOuverture: [1, 2, 3, 4, 5, 6, 7],
  heureOuverture: '11:30',
  heureFermeture: '22:00',
  dernierService: '20:30',
  pasCreneauMinutes: 60,
  capaciteMaxReservation: 8,
  delaiMinimumHeures: 2,
  horizonJours: 3650,
}

function dansNJours(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Premier jour, à partir de `depuisJours`, dont l'ISO weekday vaut `jourIso` (1 = lundi). */
function prochainJourIso(depuisJours: number, jourIso: number): string {
  let n = depuisJours
  while (jourIsoSemaine(dansNJours(n)) !== jourIso) n += 1
  return dansNJours(n)
}

function mount(overrides: Partial<PublicRestaurantDto> = {}) {
  return mountSuspended(ReservationForm, {
    props: {
      section: { titre: 'Réserver une table', messageSucces: 'Merci, nous confirmons votre table sous peu.' },
      reglages: { ...REGLAGES, ...overrides },
      vars: {},
      mention: null,
      emailSecours: null,
    },
  })
}

describe('ReservationForm', () => {
  it('calcule les créneaux affichés depuis les réglages (aucun horaire en dur)', async () => {
    const wrapper = await mount()
    const dateIso = dansNJours(30)

    await wrapper.find('input[type="date"]').setValue(dateIso)
    await nextTick()

    const attendus = creneauxPourDate(REGLAGES, dateIso, new Date())
    expect(attendus.length).toBeGreaterThan(0)

    const options = wrapper
      .findAll('select[name="heure"] option')
      .map((o) => o.attributes('value'))
      .filter((v): v is string => !!v)
    expect(options).toEqual(attendus)
  })

  it('un jour fermé affiche « Aucun créneau ce jour-là » et réinitialise une heure déjà choisie', async () => {
    // Fermé le lundi seulement — réglages distincts du restaurant réel (mardi-dimanche).
    const wrapper = await mount({ joursOuverture: [2, 3, 4, 5, 6, 7] })
    const jourOuvert = prochainJourIso(30, 2) // mardi
    const jourFerme = prochainJourIso(30, 1) // lundi

    await wrapper.find('input[type="date"]').setValue(jourOuvert)
    await nextTick()
    const premierCreneau = creneauxPourDate({ ...REGLAGES, joursOuverture: [2, 3, 4, 5, 6, 7] }, jourOuvert, new Date())[0]
    expect(premierCreneau).toBeDefined()
    await wrapper.find('select[name="heure"]').setValue(premierCreneau)
    expect((wrapper.find('select[name="heure"]').element as HTMLSelectElement).value).toBe(premierCreneau)

    await wrapper.find('input[type="date"]').setValue(jourFerme)
    await nextTick()

    expect(wrapper.text()).toContain('Aucun créneau ce jour-là.')
    expect((wrapper.find('select[name="heure"]').element as HTMLSelectElement).value).toBe('')
  })

  it('limite le nombre de personnes à capaciteMaxReservation (réglages), pas une valeur en dur', async () => {
    const wrapper = await mount({ capaciteMaxReservation: 3 })
    const options = wrapper
      .findAll('select[name="nombrePersonnes"] option')
      .map((o) => o.attributes('value'))
      .filter((v): v is string => !!v)
    expect(options).toEqual(['1', '2', '3'])
    expect(wrapper.text()).toContain('Plus de 3 personnes')
  })

  it('soumission valide : POST JSON vers /api/public/restaurant/reservations et toast de succès', async () => {
    let corpsRecu: unknown
    registerEndpoint('/api/public/restaurant/reservations', {
      method: 'POST',
      handler: async (event) => {
        corpsRecu = await readBody(event)
        return { ok: true }
      },
    })
    const succesSpy = vi.spyOn(toast, 'success').mockImplementation(() => '')

    const wrapper = await mount()
    const dateIso = dansNJours(30)

    await wrapper.find('input[name="nom"]').setValue('Jean Tremblay')
    await wrapper.find('input[name="telephone"]').setValue('514-000-0000')
    await wrapper.find('input[name="email"]').setValue('jean@exemple.ca')
    await wrapper.find('input[type="date"]').setValue(dateIso)
    await nextTick()
    const heure = creneauxPourDate(REGLAGES, dateIso, new Date())[0]
    expect(heure).toBeDefined()
    await wrapper.find('select[name="heure"]').setValue(heure)
    await wrapper.find('select[name="nombrePersonnes"]').setValue('4')

    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(corpsRecu).toBeDefined())
    await flushPromises()

    expect(corpsRecu).toMatchObject({ nom: 'Jean Tremblay', email: 'jean@exemple.ca', date: dateIso, heure, nombrePersonnes: 4 })
    expect(succesSpy).toHaveBeenCalledWith('Réservation reçue', expect.objectContaining({}))
    succesSpy.mockRestore()
  })

  it('le champ honeypot est masqué visuellement (piège anti-bot, jamais rempli par un humain)', async () => {
    const wrapper = await mount()
    const honeypot = wrapper.find('input[name="website"]')
    expect(honeypot.exists()).toBe(true)
    expect(honeypot.attributes('tabindex')).toBe('-1')
  })
})
