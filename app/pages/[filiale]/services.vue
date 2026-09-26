<script setup lang="ts">
// Services — filiales (spec §1 « /{filiale}/services », prototype SubServicesPage.tsx).
// Écarts assumés (spec §4/§0) : pas de dégradé, visuel de repli numéroté plutôt que l'id brut,
// un seul CTA (encadré navy) — l'assistant import-export (ccdpaa) est hors lot.
import { isFilialeSlug, contactPath } from '#shared/config/sites'
import type { PublicServiceDto } from '#shared/types/public'
import type { CtaData, SectionData, SeoData } from '@/composables/useSiteSections'
import TexteAccentue from '@/components/site/TexteAccentue.vue'
import ServiceRangee from '@/components/site/services/ServiceRangee.vue'
import EtatCollection from '@/components/site/EtatCollection.vue'
import SectionCta from '@/components/site/SectionCta.vue'
import { Button } from '@/components/ui/button'

definePageMeta({
  validate: (route) => isFilialeSlug(String(route.params.filiale)),
})

const slug = useCurrentSiteSlug()

const {
  data: sections,
  error: sectionsError,
  refresh: refreshSections,
} = await useSiteSections(slug, 'SERVICES')
const {
  data: services,
  status: servicesStatus,
  error: servicesError,
  refresh: refreshServices,
} = await useSiteCollection<PublicServiceDto>(slug, 'services')

const entete = computed(() => sections.value?.entete as SectionData | undefined)
const cta = computed(() => sections.value?.cta as CtaData | undefined)
const seo = computed(() => sections.value?.seo as SeoData | undefined)

useSeoMeta({
  title: () => seo.value?.title ?? entete.value?.titre ?? 'Services',
  description: () => seo.value?.description ?? entete.value?.texte ?? '',
})
</script>

<template>
  <div v-if="sectionsError" class="mx-auto max-w-xl px-6 py-40 text-center">
    <p class="text-ink/70">Impossible de charger cette page pour le moment.</p>
    <Button variant="outline" class="mt-4 min-h-11" @click="refreshSections()">Réessayer</Button>
  </div>

  <template v-else>
    <section class="pb-20 pt-32 md:pb-24 md:pt-40">
      <div class="mx-auto max-w-7xl px-6">
        <div v-if="entete" class="grid grid-cols-1 gap-8 md:grid-cols-12">
          <div class="md:col-span-6">
            <TexteAccentue
              v-if="entete.surtitre"
              :texte="entete.surtitre"
              as="p"
              class="font-display text-xs font-semibold uppercase tracking-[0.3em] text-site-accent-strong"
            />
            <TexteAccentue
              :texte="entete.titre"
              as="h1"
              class="mt-4 font-display text-5xl font-bold leading-[1.02] text-navy md:text-7xl"
            />
          </div>
          <TexteAccentue
            v-if="entete.texte"
            :texte="entete.texte"
            as="p"
            class="leading-relaxed text-ink/75 md:col-span-5 md:col-start-8 md:self-end"
          />
        </div>
      </div>
    </section>

    <section class="pb-24 md:pb-28">
      <div class="mx-auto max-w-7xl px-6">
        <EtatCollection
          :pending="servicesStatus === 'pending'"
          :error="!!servicesError"
          :empty="servicesStatus === 'success' && !services?.length"
          empty-message="Aucun service à afficher pour le moment."
          @retry="refreshServices()"
        >
          <div class="space-y-24" role="list">
            <ServiceRangee role="listitem" v-for="(service, index) in services" :key="service.uuid" :service="service" :index="index" />
          </div>
        </EtatCollection>
      </div>
    </section>

    <SectionCta v-if="cta" :cta="cta" :to="contactPath(slug)" variant="encadre" />
  </template>
</template>
