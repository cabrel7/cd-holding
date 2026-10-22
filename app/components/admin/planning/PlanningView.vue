<script setup lang="ts">
// Grille hebdomadaire des quarts d'un site (entretien/transport/cdpaa) : lignes = employés,
// colonnes = lun→dim. `semaine` vit dans l'URL (survit au rechargement). Table ≥1024px, liste
// par jour en dessous. `QuartDialog` + suppression pilotés ici, fermés seulement après succès
// (pattern candidatures.vue). Un quart appartient à la semaine de son `dateDebut` (spec §1).
import { computed, ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { z } from 'zod'
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from '@lucide/vue'
import { JOURS_FR, type PlanningSite } from '#shared/config/planning'
import { lundiDeSemaineQuebec } from '#shared/utils/planning'
import { ajouterJoursIso, formatDateCompacte, formatDateLongue, FUSEAU_QUEBEC } from '#shared/utils/dates'
import { planningSemaineQuerySchema, type QuartCreateInput } from '#shared/validation/planning'
import type { AdminEmployePlanningDto, AdminQuartDto, PlanningSemaineDto } from '#shared/types/admin'
import { toAdminError } from '@/utils/admin-error'
import { watchAdminUnauthorized } from '@/utils/admin-unauthorized'
import type { AdminListState as EtatListe } from '@/composables/useAdminPagedList'
import AdminListState from '@/components/admin/AdminListState.vue'
import AdminPageHeader from '@/components/admin/AdminPageHeader.vue'
import CmsDeleteDialog from '@/components/cms/CmsDeleteDialog.vue'
import QuartDialog, { type QuartFormValeurs } from './QuartDialog.vue'
import { usePlanningActions } from './usePlanningActions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const props = defineProps<{
  site: PlanningSite
}>()

// `useAdminListQuery` exige `AdminListQueryBase` (un `page: number`) : le schéma partagé
// (semaine seule) est donc étendu localement — `page` n'est jamais envoyé à l'API, seule
// `semaine` voyage dans l'URL et vers `GET /api/admin/planning/[site]`.
const planningSemaineUrlSchema = planningSemaineQuerySchema
  .extend({ page: z.coerce.number().int().min(1).default(1) })
  .strict()
type PlanningSemaineUrlQuery = z.infer<typeof planningSemaineUrlSchema>

const { query, setFilter } = useAdminListQuery<PlanningSemaineUrlQuery>(planningSemaineUrlSchema, ['semaine'])

const semaine = computed(() => query.value.semaine ?? lundiDeSemaineQuebec())
const estSemaineCourante = computed(() => semaine.value === lundiDeSemaineQuebec())

function allerSemaine(iso: string): void {
  void setFilter('semaine', iso)
}
function semainePrecedente(): void {
  allerSemaine(ajouterJoursIso(semaine.value, -7))
}
function semaineSuivante(): void {
  allerSemaine(ajouterJoursIso(semaine.value, 7))
}
function cetteSemaine(): void {
  allerSemaine(lundiDeSemaineQuebec())
}

const fetchQuery = computed(() => ({ semaine: semaine.value }))
const {
  data,
  status,
  error,
  refresh,
} = useFetch<PlanningSemaineDto | null>(`/api/admin/planning/${props.site}`, {
  query: fetchQuery,
  server: false,
  key: `admin-planning:${props.site}`,
  default: () => null,
})

watchAdminUnauthorized(error)

const messageErreur = computed(() => (error.value ? toAdminError(error.value).message : undefined))
const employes = computed<readonly AdminEmployePlanningDto[]>(() => data.value?.employes ?? [])

const etat = computed<EtatListe>(() => {
  if (error.value) return 'error'
  if (!data.value) return 'loading'
  if (data.value.employes.length === 0) return 'empty'
  return 'ready'
})
const rafraichissement = computed(() => status.value === 'pending' && data.value !== null)

const actions = usePlanningActions(props.site, refresh)

// --- Regroupement des quarts -------------------------------------------------------
// Jour civil au Québec (pas UTC : un quart de 22 h reste le même jour). `en-CA` formate
// déjà en ISO (voir `dateDuJourQuebec`), les heures sont extraites en HH:mm via les parties.
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

const jours = computed(() => JOURS_FR.map((nom, index) => ({ nom, iso: ajouterJoursIso(semaine.value, index) })))

const quartsParEmployeJour = computed(() => {
  const carte = new Map<string, Map<string, AdminQuartDto[]>>()
  for (const quart of data.value?.quarts ?? []) {
    let parJour = carte.get(quart.employeUuid)
    if (!parJour) {
      parJour = new Map<string, AdminQuartDto[]>()
      carte.set(quart.employeUuid, parJour)
    }
    const jour = jourIsoDeInstant(quart.dateDebut)
    const liste = parJour.get(jour)
    if (liste) liste.push(quart)
    else parJour.set(jour, [quart])
  }
  for (const parJour of carte.values()) {
    for (const liste of parJour.values()) liste.sort((a, b) => a.dateDebut.localeCompare(b.dateDebut))
  }
  return carte
})

function quartsDe(employeUuid: string, jourIso: string): readonly AdminQuartDto[] {
  return quartsParEmployeJour.value.get(employeUuid)?.get(jourIso) ?? []
}

const employesParUuid = computed(() => new Map(employes.value.map((e) => [e.uuid, e])))

function nomEmploye(uuid: string): string {
  return employesParUuid.value.get(uuid)?.nom ?? 'Employé'
}

/** Quarts d'un jour (tous employés, dans l'ordre des lignes) — version mobile par sections. */
function quartsDuJour(jourIso: string): readonly { quart: AdminQuartDto; employe: AdminEmployePlanningDto }[] {
  const out: { quart: AdminQuartDto; employe: AdminEmployePlanningDto }[] = []
  for (const employe of employes.value) {
    for (const quart of quartsDe(employe.uuid, jourIso)) out.push({ quart, employe })
  }
  return out
}

// --- Dialogs pilotés ici, fermés seulement après succès --------------------------------
interface CibleDialog {
  readonly quart: AdminQuartDto | null
  readonly jourIso: string
}

const cible = ref<CibleDialog | null>(null)
const dialogOuvert = computed({
  get: () => cible.value !== null,
  set: (ouvert: boolean) => {
    if (!ouvert && !actions.submitting.value) cible.value = null
  },
})

function ouvrirCreation(jourIso: string = semaine.value): void {
  cible.value = { quart: null, jourIso }
}

function ouvrirEdition(quart: AdminQuartDto): void {
  cible.value = { quart, jourIso: jourIsoDeInstant(quart.dateDebut) }
}

const titreDialog = computed(() => (cible.value?.quart ? 'Modifier le quart' : 'Ajouter un quart'))

const valeursDialog = computed<QuartFormValeurs>(() => {
  const quart = cible.value?.quart
  if (quart) {
    return {
      employeUuid: quart.employeUuid,
      date: jourIsoDeInstant(quart.dateDebut),
      heureDebut: heureDeInstant(quart.dateDebut),
      heureFin: heureDeInstant(quart.dateFin),
      lieu: quart.lieu,
      titre: quart.titre ?? '',
      notes: quart.notes ?? '',
    }
  }
  return {
    employeUuid: '',
    date: cible.value?.jourIso ?? semaine.value,
    heureDebut: '',
    heureFin: '',
    lieu: '',
    titre: '',
    notes: '',
  }
})

async function soumettreDialog(payload: QuartCreateInput): Promise<void> {
  const current = cible.value
  if (!current) return
  const ok = current.quart ? await actions.update(current.quart.uuid, payload) : await actions.create(payload)
  if (ok) cible.value = null
}

const aSupprimer = ref<AdminQuartDto | null>(null)
const suppressionOuverte = computed({
  get: () => aSupprimer.value !== null,
  set: (ouvert: boolean) => {
    if (!ouvert && !actions.submitting.value) aSupprimer.value = null
  },
})

async function confirmerSuppression(): Promise<void> {
  const quart = aSupprimer.value
  if (!quart) return
  if (await actions.remove(quart.uuid)) aSupprimer.value = null
}

function estOccupe(uuid: string): boolean {
  return actions.busyUuid.value === uuid
}

const isTable = useMediaQuery('(min-width: 1024px)')

const libelleModifier = (quart: AdminQuartDto): string =>
  `Modifier le quart de ${nomEmploye(quart.employeUuid)} le ${formatDateLongue(jourIsoDeInstant(quart.dateDebut))}`
const libelleSupprimer = (quart: AdminQuartDto): string =>
  `Supprimer le quart de ${nomEmploye(quart.employeUuid)} le ${formatDateLongue(jourIsoDeInstant(quart.dateDebut))}`
</script>

<template>
  <div class="space-y-6">
    <AdminPageHeader
      titre="Planning hebdomadaire"
      description="Les quarts assignés apparaissent aussitôt dans « Mon planning » des employés."
    >
      <Button class="min-h-11 md:min-h-9" @click="ouvrirCreation()">
        <Plus aria-hidden="true" />
        Ajouter un quart
      </Button>
    </AdminPageHeader>

    <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Navigation de semaine">
      <Button
        type="button"
        variant="outline"
        size="icon"
        class="min-h-11 min-w-11 md:min-h-9 md:min-w-9"
        aria-label="Semaine précédente"
        @click="semainePrecedente"
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
        @click="semaineSuivante"
      >
        <ChevronRight aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        class="min-h-11 md:min-h-9"
        :disabled="estSemaineCourante"
        @click="cetteSemaine"
      >
        Cette semaine
      </Button>
    </div>

    <AdminListState
      :state="etat"
      message-vide="Aucun employé pour ce site."
      :message-erreur="messageErreur"
      @retry="refresh()"
      @reset="allerSemaine(lundiDeSemaineQuebec())"
    >
      <div :class="{ 'opacity-80 transition-opacity': rafraichissement }" :aria-busy="rafraichissement">
        <Table v-if="isTable" class="table-fixed">
          <caption class="sr-only">
            Quarts de la semaine du {{ formatDateLongue(semaine) }}
          </caption>
          <TableHeader>
            <TableRow>
              <TableHead class="w-36 px-2 xl:w-44">Employé</TableHead>
              <!-- table-fixed : les 7 colonnes de jours partagent la largeur restante sans jamais
                   dépasser le conteneur (zéro débordement). Date visible compacte ; l'aria-label
                   des boutons garde la date longue (assertions e2e). -->
              <TableHead v-for="jour in jours" :key="jour.iso" class="px-2 align-top">
                <span class="block">{{ jour.nom }}</span>
                <span class="block text-xs font-normal text-muted-foreground" :title="formatDateLongue(jour.iso)">
                  <time :datetime="jour.iso">{{ formatDateCompacte(jour.iso) }}</time>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="mt-1 min-h-11 min-w-11 md:min-h-9 md:min-w-9"
                  :aria-label="`Ajouter un quart le ${formatDateLongue(jour.iso)}`"
                  @click="ouvrirCreation(jour.iso)"
                >
                  <Plus aria-hidden="true" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="employe in employes" :key="employe.uuid">
              <TableCell class="min-w-0 px-2 align-top">
                <p class="truncate font-medium text-foreground" :title="employe.nom">{{ employe.nom }}</p>
                <p class="truncate text-sm text-muted-foreground" :title="employe.poste ?? undefined">{{ employe.poste }}</p>
                <Badge v-if="!employe.actif" variant="outline" class="mt-1">Inactif</Badge>
              </TableCell>
              <TableCell v-for="jour in jours" :key="jour.iso" class="min-w-0 px-2 align-top">
                <div v-for="quart in quartsDe(employe.uuid, jour.iso)" :key="quart.uuid" class="space-y-0.5 py-1">
                  <p class="truncate font-medium tabular-nums text-foreground" :title="plage(quart)">
                    <time :datetime="quart.dateDebut">{{ plage(quart) }}</time>
                  </p>
                  <p v-if="quart.titre" class="truncate text-sm text-foreground" :title="quart.titre">{{ quart.titre }}</p>
                  <p class="truncate text-sm text-muted-foreground" :title="quart.lieu">{{ quart.lieu }}</p>
                  <div class="flex gap-1 pt-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="min-h-11 min-w-11 md:min-h-9 md:min-w-9"
                      :aria-label="libelleModifier(quart)"
                      :disabled="estOccupe(quart.uuid)"
                      @click="ouvrirEdition(quart)"
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="min-h-11 min-w-11 text-destructive hover:bg-destructive/10 hover:text-destructive md:min-h-9 md:min-w-9"
                      :aria-label="libelleSupprimer(quart)"
                      :disabled="estOccupe(quart.uuid)"
                      @click="aSupprimer = quart"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <div v-else class="space-y-6">
          <section v-for="jour in jours" :key="jour.iso" :aria-labelledby="`jour-${jour.iso}`">
            <div class="flex items-center justify-between gap-3 border-b border-border pb-2">
              <h2 :id="`jour-${jour.iso}`" class="text-base font-semibold text-foreground">
                {{ jour.nom }}
                <span class="text-sm font-normal text-muted-foreground">
                  <time :datetime="jour.iso">{{ formatDateLongue(jour.iso) }}</time>
                </span>
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="min-h-11 min-w-11"
                :aria-label="`Ajouter un quart le ${formatDateLongue(jour.iso)}`"
                @click="ouvrirCreation(jour.iso)"
              >
                <Plus aria-hidden="true" />
              </Button>
            </div>
            <ul v-if="quartsDuJour(jour.iso).length > 0" class="divide-y divide-border">
              <li
                v-for="{ quart, employe } in quartsDuJour(jour.iso)"
                :key="quart.uuid"
                class="flex items-start justify-between gap-3 py-3"
              >
                <div class="min-w-0 break-words">
                  <p class="font-medium text-foreground">{{ employe.nom }}</p>
                  <p class="text-sm tabular-nums text-foreground">
                    <time :datetime="quart.dateDebut">{{ plage(quart) }}</time>
                    <span class="text-muted-foreground"> · {{ quart.lieu }}</span>
                  </p>
                  <p v-if="quart.titre" class="text-sm text-muted-foreground">{{ quart.titre }}</p>
                  <Badge v-if="!employe.actif" variant="outline" class="mt-1">Inactif</Badge>
                </div>
                <div class="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="min-h-11 min-w-11"
                    :aria-label="libelleModifier(quart)"
                    :disabled="estOccupe(quart.uuid)"
                    @click="ouvrirEdition(quart)"
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="min-h-11 min-w-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    :aria-label="libelleSupprimer(quart)"
                    :disabled="estOccupe(quart.uuid)"
                    @click="aSupprimer = quart"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </li>
            </ul>
            <p v-else class="py-3 text-sm text-muted-foreground">Aucun quart.</p>
          </section>
        </div>
      </div>
    </AdminListState>

    <QuartDialog
      v-model:open="dialogOuvert"
      :titre="titreDialog"
      description="Les modifications sont visibles aussitôt par l'employé."
      :employes="employes"
      :valeurs="valeursDialog"
      :submitting="actions.submitting.value"
      @submit="soumettreDialog"
    />

    <CmsDeleteDialog
      v-model:open="suppressionOuverte"
      titre="Supprimer ce quart ?"
      description="L'employé ne le verra plus dans son planning."
      :submitting="actions.submitting.value"
      @confirm="confirmerSuppression"
    />
  </div>
</template>
