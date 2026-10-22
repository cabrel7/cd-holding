<script setup lang="ts">
// Planning personnel de l'employé connecté : lecture seule (aucun bouton CRUD). `semaine` vit
// dans l'URL (le prototype n'avait pas de navigation, ajoutée car `GET semaine=` l'exige).
// Jours et heures rendus à l'heure du Québec, comme la grille gestionnaire.
import { computed } from 'vue'
import { z } from 'zod'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { JOURS_FR } from '#shared/config/planning'
import { lundiDeSemaineQuebec } from '#shared/utils/planning'
import { ajouterJoursIso, formatDateLongue, FUSEAU_QUEBEC } from '#shared/utils/dates'
import { planningSemaineQuerySchema } from '#shared/validation/planning'
import type { AdminQuartDto, MonPlanningDto } from '#shared/types/admin'
import { toAdminError } from '@/utils/admin-error'
import { watchAdminUnauthorized } from '@/utils/admin-unauthorized'
import type { AdminListState as EtatListe } from '@/composables/useAdminPagedList'
import AdminListState from '@/components/admin/AdminListState.vue'
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue'
import { Button } from '@/components/ui/button'
import { ADMIN_PAGE_WIDTH_CLASS } from '@/config/admin-nav'

definePageMeta({
  middleware: 'admin',
  layout: 'admin',
  roles: [ROLES.EMPLOYE],
})

useHead({ title: 'Mon planning' })

// Même montage que `PlanningView` : `useAdminListQuery` exige `AdminListQueryBase`, le schéma
// partagé (semaine seule) est étendu localement — `page` n'est jamais envoyé à l'API.
const monPlanningUrlSchema = planningSemaineQuerySchema.extend({ page: z.coerce.number().int().min(1).default(1) }).strict()
type MonPlanningUrlQuery = z.infer<typeof monPlanningUrlSchema>

const { query, setFilter } = useAdminListQuery<MonPlanningUrlQuery>(monPlanningUrlSchema, ['semaine'])

const semaine = computed(() => query.value.semaine ?? lundiDeSemaineQuebec())
const estSemaineCourante = computed(() => semaine.value === lundiDeSemaineQuebec())

function allerSemaine(iso: string): void {
  void setFilter('semaine', iso)
}

const { data, status, error, refresh } = useFetch<MonPlanningDto | null>('/api/admin/mon-planning', {
  query: computed(() => ({ semaine: semaine.value })),
  server: false,
  key: 'admin-mon-planning',
  default: () => null,
})

watchAdminUnauthorized(error)

const messageErreur = computed(() => (error.value ? toAdminError(error.value).message : undefined))

const etat = computed<EtatListe>(() => {
  if (error.value) return 'error'
  if (!data.value) return 'loading'
  return 'ready'
})
const rafraichissement = computed(() => status.value === 'pending' && data.value !== null)

const sousTitre = computed(() => (data.value ? `${data.value.employe.nom} — ${data.value.employe.poste}` : undefined))
const totalTexte = computed(() =>
  data.value
    ? `${data.value.totalHeures.toLocaleString('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h cette semaine`
    : null,
)

// Jour civil au Québec du `dateDebut` (une nuit lun→mar reste au lundi — spec §1).
const JOUR_ISO_QUEBEC_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSEAU_QUEBEC,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const HEURE_QUEBEC_FORMATTER = new Intl.DateTimeFormat('fr-CA', {
  timeZone: FUSEAU_QUEBEC,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function jourIsoDeInstant(iso: string): string {
  return JOUR_ISO_QUEBEC_FORMATTER.format(new Date(iso))
}

function heureDeInstant(iso: string): string {
  const parties = Object.fromEntries(HEURE_QUEBEC_FORMATTER.formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
  return `${parties.hour}:${parties.minute}`
}

function plage(quart: AdminQuartDto): string {
  return `${heureDeInstant(quart.dateDebut)}–${heureDeInstant(quart.dateFin)}`
}

const jours = computed(() => {
  const parJour = new Map<string, AdminQuartDto[]>()
  for (const quart of data.value?.quarts ?? []) {
    const jour = jourIsoDeInstant(quart.dateDebut)
    const liste = parJour.get(jour)
    if (liste) liste.push(quart)
    else parJour.set(jour, [quart])
  }
  for (const liste of parJour.values()) liste.sort((a, b) => a.dateDebut.localeCompare(b.dateDebut))
  return JOURS_FR.map((nom, index) => {
    const iso = ajouterJoursIso(semaine.value, index)
    return { nom, iso, quarts: parJour.get(iso) ?? [] }
  })
})
</script>

<template>
  <div :class="[ADMIN_PAGE_WIDTH_CLASS, 'space-y-6']">
    <AdminPageHeader titre="Mon planning" :description="sousTitre" />

    <p v-if="totalTexte" class="text-sm font-medium tabular-nums text-foreground" aria-live="polite">{{ totalTexte }}</p>

    <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Navigation de semaine">
      <Button
        type="button"
        variant="outline"
        size="icon"
        class="min-h-11 min-w-11 md:min-h-9 md:min-w-9"
        aria-label="Semaine précédente"
        @click="allerSemaine(ajouterJoursIso(semaine, -7))"
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <p class="min-w-0 flex-1 text-sm font-medium text-foreground sm:flex-none" aria-live="polite">
        Semaine du {{ formatDateLongue(semaine) }}
      </p>
      <Button
        type="button"
        variant="outline"
        size="icon"
        class="min-h-11 min-w-11 md:min-h-9 md:min-w-9"
        aria-label="Semaine suivante"
        @click="allerSemaine(ajouterJoursIso(semaine, 7))"
      >
        <ChevronRight aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        class="min-h-11 md:min-h-9"
        :disabled="estSemaineCourante"
        @click="allerSemaine(lundiDeSemaineQuebec())"
      >
        Cette semaine
      </Button>
    </div>

    <AdminListState
      :state="etat"
      message-vide="Aucun quart cette semaine."
      :message-erreur="messageErreur"
      @retry="refresh()"
    >
      <div
        :class="{ 'opacity-80 transition-opacity': rafraichissement }"
        :aria-busy="rafraichissement"
        class="space-y-6"
      >
        <section v-for="jour in jours" :key="jour.iso" :aria-labelledby="`jour-${jour.iso}`">
          <h2 :id="`jour-${jour.iso}`" class="border-b border-border pb-2 text-base font-semibold text-foreground">
            {{ jour.nom }}
            <span class="text-sm font-normal text-muted-foreground">
              <time :datetime="jour.iso">{{ formatDateLongue(jour.iso) }}</time>
            </span>
          </h2>
          <ul v-if="jour.quarts.length > 0" class="divide-y divide-border">
            <li v-for="quart in jour.quarts" :key="quart.uuid" class="space-y-0.5 py-3">
              <p class="font-medium tabular-nums break-words text-foreground">
                <time :datetime="quart.dateDebut">{{ plage(quart) }}</time>
                <span class="font-normal text-muted-foreground"> · {{ quart.lieu }}</span>
              </p>
              <p v-if="quart.titre" class="text-sm text-foreground">{{ quart.titre }}</p>
              <p v-if="quart.notes" class="whitespace-pre-line break-words text-sm text-muted-foreground">{{ quart.notes }}</p>
            </li>
          </ul>
          <p v-else class="py-3 text-sm text-muted-foreground">Congé</p>
        </section>
      </div>
    </AdminListState>
  </div>
</template>
