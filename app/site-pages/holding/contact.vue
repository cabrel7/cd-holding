<script setup lang="ts">
// Contact — holding (spec docs/specs/phase3-holding-contact.md §4). Colonne texte (ContactIntro,
// réutilisable filiales) + carte formulaire (HoldingContactForm, sélecteur de filiale propre à la
// holding). Tout le contenu éditorial vient du catalogue CONTACT (holding) — jamais de texte
// public en dur ici.
// Vit hors de `app/pages/` (lot 8, D4) : `app/pages/contact.vue` est le dispatcher qui choisit
// entre cette variante holding et `[filiale]/contact.vue` selon l'hôte.
import { HOLDING_SLUG } from '#shared/config/sites'
import { interpoler } from '#shared/utils/texte'
import type { FormulaireData, SeoData } from '@/composables/useSiteSections'
import ContactIntro from '@/components/site/contact/ContactIntro.vue'
import HoldingContactForm from '@/components/site/contact/HoldingContactForm.vue'
import { Button } from '@/components/ui/button'

const { data: site } = await useSite(HOLDING_SLUG)
const { data: filiales } = useSites()
const {
  data: sections,
  error: sectionsError,
  refresh: refreshSections,
} = await useSiteSections(HOLDING_SLUG, 'CONTACT')

const groupe = computed(() => site.value?.groupe.nom ?? 'Groupe CD')
const vars = computed(() => ({ groupe: groupe.value }))

const seo = computed(() => sections.value?.seo as SeoData | undefined)
const contact = computed(() => sections.value?.contact as FormulaireData | undefined)

const coordonnees = computed(() => ({
  email: site.value?.email ?? null,
  telephone: site.value?.telephone ?? null,
  adresse: site.value?.adresse ?? null,
}))

const seoTitreRepli = computed(() => `Contact — ${groupe.value}`)

useSeoMeta({
  title: () => interpoler(seo.value?.title ?? seoTitreRepli.value, vars.value),
  description: () => interpoler(seo.value?.description ?? site.value?.description ?? '', vars.value),
  ogTitle: () => interpoler(seo.value?.title ?? seoTitreRepli.value, vars.value),
  ogDescription: () => interpoler(seo.value?.description ?? site.value?.description ?? '', vars.value),
  ogType: 'website',
})
</script>

<template>
  <div v-if="sectionsError" class="mx-auto max-w-xl px-6 py-40 text-center">
    <p class="text-ink/70">Impossible de charger cette page pour le moment.</p>
    <Button variant="outline" class="mt-4" @click="refreshSections()">Réessayer</Button>
  </div>

  <section v-else class="pb-24 pt-32 md:pb-32 md:pt-40">
    <div class="mx-auto max-w-7xl px-6">
      <div class="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
        <div class="lg:col-span-5" style="--site-accent: var(--gold); --site-accent-strong: var(--gold-deep)">
          <ContactIntro :section="contact" :coordonnees="coordonnees" :vars="vars" titre-repli="Contact" />
        </div>
        <div class="lg:col-span-7">
          <HoldingContactForm
            :filiales="filiales ?? null"
            :groupe="groupe"
            :vars="vars"
            :message-succes="contact?.messageSucces ?? null"
            :mention="site?.groupe.mentionFormulaires ?? null"
            :email-secours="site?.email ?? null"
          />
        </div>
      </div>
    </div>
  </section>
</template>
