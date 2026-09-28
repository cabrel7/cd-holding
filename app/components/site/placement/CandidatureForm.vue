<script setup lang="ts">
// Formulaire de candidature (placement) — avec offre (détail, spec §4 écart assumé #1 : page,
// pas modal) ou spontané (candidature-spontanee.vue). Même machine d'états que
// FilialeContactForm/SuggestionProduitForm (soumission native impossible avant hydratation,
// focus sur le 1er champ invalide, honeypot, method="post") : seuls le schéma et le corps
// (FormData, pour les fichiers) changent. Réutilise ChampContact pour nom/email/telephone/message
// (mêmes noms de champ que le contact) ; les champs propres à la candidature (adresse, pays,
// poste, expérience, fichiers, consentement) sont rendus ici.
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { ChevronDown, Send } from '@lucide/vue'
import type { ChampContact as ChampContactConfig } from '#shared/config/contact-forms'
import {
  CANDIDATURE_FORM,
  CANDIDATURE_LIMITS,
  CV_ACCEPT,
  DOCUMENT_ACCEPT,
  NIVEAUX_EXPERIENCE,
  POSTES_CANDIDAT,
  POSTE_AUTRE,
} from '#shared/config/candidature'
import { candidatureFormSchema, type CandidatureFormValues } from '#shared/validation/candidature'
import type { PublicOffreDto } from '#shared/types/public'
import type { TexteVars } from '#shared/utils/texte'
import type { FormulaireData } from '@/composables/useSiteSections'
import { usePublicFormSubmit } from '@/composables/usePublicFormSubmit'
import { usePublicFormFeedback } from '@/composables/usePublicFormFeedback'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import ChampContact from '@/components/site/contact/ChampContact.vue'
import ChampFichier from '@/components/site/placement/ChampFichier.vue'
import HoneypotField from '@/components/site/form/HoneypotField.vue'
import MentionConfidentialite from '@/components/site/form/MentionConfidentialite.vue'
import TexteAccentue from '@/components/site/TexteAccentue.vue'

const TITRE_REPLI = 'Postuler'

const props = defineProps<{
  offre: PublicOffreDto | null
  section: FormulaireData | undefined
  vars: TexteVars
  mention: string | null
  emailSecours: string | null
}>()

const avecOffre = computed(() => props.offre !== null)

// Champs réutilisant ChampContact (même nom de champ que shared/validation/contact.ts : `nom`,
// `email`, `telephone`, `message` — candidatureFormSchema réutilise les mêmes schémas).
const champNom: ChampContactConfig = { type: 'nom', label: 'Nom complet', placeholder: 'Jean Tremblay' }
const champEmail: ChampContactConfig = { type: 'email', label: 'Courriel', placeholder: 'vous@exemple.ca' }
const champTelephone: ChampContactConfig = { type: 'telephone', label: 'Téléphone', placeholder: '514-000-0000' }
const champMessage: ChampContactConfig = {
  type: 'message',
  label: 'Message (optionnel)',
  placeholder: 'Un élément à préciser sur votre candidature…',
  lignes: 4,
  pleineLargeur: true,
}

// Un seul cast (comme FilialeContactForm) : VeeValidate a besoin de valeurs initiales explicites
// pour chaque champ, y compris ceux dont le type zod (z.input) n'admet pas `''`/`undefined`
// (`experience`, `cv`) — c'est justement l'état « rien saisi » avant la première interaction.
function valeursInitiales(): CandidatureFormValues {
  const valeurs: Record<string, unknown> = {
    nom: '',
    email: '',
    telephone: '',
    adresseComplete: '',
    pays: '',
    posteRecherche: undefined,
    posteAutrePrecision: '',
    experience: undefined,
    message: '',
    website: '',
    consentement: false,
    cv: undefined,
    documents: [],
  }
  return valeurs as unknown as CandidatureFormValues
}

const schema = computed(() => toTypedSchema(candidatureFormSchema({ avecOffre: avecOffre.value })))
const { handleSubmit, resetForm, errors, values } = useForm({
  validationSchema: schema,
  initialValues: valeursInitiales(),
})

const posteRecherche = computed(() => values.posteRecherche)

// `documents[i]` (erreur sur un fichier précis) n'est jamais la clé exacte `documents` que
// vérifie <FormMessage> — ChampFichier affiche donc cette erreur agrégée en plus de la sienne.
const erreurCv = computed(() => errors.value.cv)
const erreurDocuments = computed(() => {
  const entree = Object.entries(errors.value).find(([cle]) => cle === 'documents' || cle.startsWith('documents['))
  return entree?.[1]
})

// Champs `z.preprocess` : leur type d'entrée est `unknown` ; seule une chaîne non vide est transmise.
const texteNonVide = (valeur: unknown): string | undefined =>
  typeof valeur === 'string' && valeur !== '' ? valeur : undefined

function construireFormData(formValues: CandidatureFormValues): FormData {
  const formData = new FormData()
  formData.set('nom', formValues.nom)
  formData.set('email', formValues.email)
  formData.set('telephone', formValues.telephone)
  formData.set('adresseComplete', formValues.adresseComplete)
  formData.set('pays', formValues.pays)
  formData.set('experience', formValues.experience)
  const message = texteNonVide(formValues.message)
  if (message) formData.set('message', message)
  if (!avecOffre.value) {
    const poste = texteNonVide(formValues.posteRecherche)
    const precision = texteNonVide(formValues.posteAutrePrecision)
    if (poste) formData.set('posteRecherche', poste)
    if (poste === POSTE_AUTRE && precision) formData.set('posteAutrePrecision', precision)
  }
  if (props.offre) formData.set('demandeUuid', props.offre.uuid)
  formData.set('consentement', 'true')
  if (formValues.website) formData.set('website', formValues.website)
  formData.set('cv', formValues.cv)
  for (const document of formValues.documents ?? []) formData.append('documents', document)
  return formData
}

const { envoyer, envoiEnCours } = usePublicFormSubmit<FormData>('/api/public/placement/candidatures')
const { notifierResultat } = usePublicFormFeedback()

// Soumission native impossible avant hydratation (même raison que FilialeContactForm) : pas de
// POST déguisé en GET.
const hydrate = ref(false)
onMounted(() => {
  hydrate.value = true
})

const formRef = ref<HTMLFormElement | null>(null)

const onSubmit = handleSubmit(
  async (formValues) => {
    const resultat = await envoyer(construireFormData(formValues))
    const succes = notifierResultat(resultat, {
      titreSucces: CANDIDATURE_FORM.toastTitre,
      messageSucces: props.section?.messageSucces ?? null,
      vars: props.vars,
      emailSecours: props.emailSecours,
    })
    if (succes) resetForm()
  },
  async () => {
    await nextTick()
    formRef.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  },
)
</script>

<template>
  <div class="rounded-[1.5rem] bg-white p-6 shadow-lg ring-1 ring-border sm:p-8 md:p-10">
    <TexteAccentue
      v-if="section?.surtitre"
      :texte="section.surtitre"
      :vars="vars"
      as="p"
      class="font-display text-xs font-semibold uppercase tracking-[0.3em] text-site-accent-strong"
    />
    <TexteAccentue
      :texte="section?.titre ?? TITRE_REPLI"
      :vars="vars"
      as="h2"
      class="mt-2 font-display text-3xl font-bold leading-tight text-navy"
    />
    <TexteAccentue
      v-if="section?.texte"
      :texte="section.texte"
      :vars="vars"
      as="p"
      class="mt-3 max-w-xl leading-relaxed text-ink/75"
    />

    <form
      ref="formRef"
      method="post"
      novalidate
      :aria-busy="envoiEnCours"
      class="mt-8 space-y-6"
      @submit="onSubmit"
    >
      <fieldset :disabled="envoiEnCours" class="space-y-6">
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChampContact :champ="champNom" />
          <ChampContact :champ="champEmail" />
          <ChampContact :champ="champTelephone" />

          <FormField v-slot="{ componentField }" name="pays">
            <FormItem>
              <FormLabel class="font-display text-xs font-semibold uppercase tracking-widest text-navy">
                Pays
              </FormLabel>
              <FormControl>
                <Input
                  v-bind="componentField"
                  autocomplete="country-name"
                  :maxlength="CANDIDATURE_LIMITS.paysMax"
                  placeholder="Canada"
                  class="h-12 rounded-xl bg-white px-4"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="adresseComplete">
            <FormItem class="lg:col-span-2">
              <FormLabel class="font-display text-xs font-semibold uppercase tracking-widest text-navy">
                Adresse complète
              </FormLabel>
              <FormControl>
                <Input
                  v-bind="componentField"
                  autocomplete="street-address"
                  :maxlength="CANDIDATURE_LIMITS.adresseMax"
                  placeholder="1234 rue Exemple, app. 3, Montréal (Québec) H1H 1H1"
                  class="h-12 rounded-xl bg-white px-4"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <template v-if="!avecOffre">
            <FormField v-slot="{ componentField }" name="posteRecherche">
              <FormItem>
                <FormLabel class="font-display text-xs font-semibold uppercase tracking-widest text-navy">
                  Poste recherché
                </FormLabel>
                <div class="relative">
                  <FormControl>
                    <select
                      :value="componentField.modelValue ?? ''"
                      :name="componentField.name"
                      class="h-12 w-full appearance-none rounded-xl border border-input bg-white px-4 pr-10 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm aria-invalid:border-destructive aria-invalid:ring-destructive/20"
                      @change="componentField['onUpdate:modelValue']?.(($event.target as HTMLSelectElement).value)"
                      @blur="componentField.onBlur"
                    >
                      <option value="" disabled>Sélectionnez un poste</option>
                      <option v-for="poste in POSTES_CANDIDAT" :key="poste.value" :value="poste.value">
                        {{ poste.label }}
                      </option>
                    </select>
                  </FormControl>
                  <ChevronDown
                    :size="18"
                    aria-hidden="true"
                    class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/70"
                  />
                </div>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-if="posteRecherche === POSTE_AUTRE" v-slot="{ componentField }" name="posteAutrePrecision">
              <FormItem>
                <FormLabel class="font-display text-xs font-semibold uppercase tracking-widest text-navy">
                  Précisez le poste
                </FormLabel>
                <FormControl>
                  <Input
                    v-bind="componentField"
                    :maxlength="CANDIDATURE_LIMITS.precisionMax"
                    placeholder="Ex. Réceptionniste"
                    class="h-12 rounded-xl bg-white px-4"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </template>

          <FormField v-slot="{ componentField }" name="experience">
            <FormItem :class="avecOffre ? undefined : 'lg:col-span-2'">
              <FormLabel class="font-display text-xs font-semibold uppercase tracking-widest text-navy">
                Expérience
              </FormLabel>
              <div class="relative">
                <FormControl>
                  <select
                    :value="componentField.modelValue ?? ''"
                    :name="componentField.name"
                    class="h-12 w-full appearance-none rounded-xl border border-input bg-white px-4 pr-10 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm aria-invalid:border-destructive aria-invalid:ring-destructive/20"
                    @change="componentField['onUpdate:modelValue']?.(($event.target as HTMLSelectElement).value)"
                    @blur="componentField.onBlur"
                  >
                    <option value="" disabled>Sélectionnez votre expérience</option>
                    <option v-for="niveau in NIVEAUX_EXPERIENCE" :key="niveau.value" :value="niveau.value">
                      {{ niveau.label }}
                    </option>
                  </select>
                </FormControl>
                <ChevronDown
                  :size="18"
                  aria-hidden="true"
                  class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/70"
                />
              </div>
              <FormMessage />
            </FormItem>
          </FormField>

          <ChampContact :champ="champMessage" />

          <div class="lg:col-span-2">
            <ChampFichier
              name="cv"
              label="Curriculum vitæ (CV)"
              :accept="CV_ACCEPT"
              hint="PDF uniquement, 5 Mo au maximum."
              :erreur="erreurCv"
            />
          </div>

          <div class="lg:col-span-2">
            <ChampFichier
              name="documents"
              label="Autres documents (optionnel)"
              :accept="DOCUMENT_ACCEPT"
              multiple
              :max-fichiers="CANDIDATURE_LIMITS.documentsMax"
              hint="PDF, JPEG ou PNG — 5 documents et 5 Mo par fichier au maximum."
              :erreur="erreurDocuments"
            />
          </div>
        </div>

        <FormField v-slot="{ value: consentement, handleChange }" name="consentement">
          <FormItem>
            <div class="flex items-start gap-3">
              <FormControl>
                <input
                  type="checkbox"
                  :checked="consentement === true"
                  class="mt-0.5 h-5 w-5 shrink-0 rounded border-input text-site-accent-strong focus-visible:ring-3 focus-visible:ring-ring/50"
                  @change="handleChange(($event.target as HTMLInputElement).checked)"
                >
              </FormControl>
              <FormLabel class="text-sm font-normal normal-case tracking-normal text-ink/80">
                J’accepte que mes renseignements soient utilisés pour traiter ma candidature, conformément à la
                <NuxtLink to="/confidentialite" class="underline underline-offset-2 hover:text-site-accent-strong">
                  politique de confidentialité
                </NuxtLink>.
              </FormLabel>
            </div>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="website">
          <HoneypotField v-bind="componentField" />
        </FormField>

        <div class="space-y-4">
          <Button
            type="submit"
            :disabled="!hydrate || envoiEnCours"
            class="group inline-flex min-h-12 items-center gap-2 rounded-full bg-site-accent-strong px-7 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {{ envoiEnCours ? 'Envoi en cours…' : CANDIDATURE_FORM.bouton }}
            <Send :size="16" aria-hidden="true" class="transition-transform group-hover:translate-x-0.5" />
          </Button>
          <MentionConfidentialite :texte="mention" :vars="vars" />
        </div>
      </fieldset>
    </form>
  </div>
</template>
