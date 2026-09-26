<script setup lang="ts">
// Politique de confidentialité — holding (spec §1 « /confidentialite »). `bypassMaintenance` :
// la page doit rester lisible même en maintenance (Loi 25, liens depuis les formulaires).
import { HOLDING_SLUG } from '#shared/config/sites'
import type { LegalData, SeoData } from '@/composables/useSiteSections'
import TexteLegal from '@/components/site/legal/TexteLegal.vue'
import { Button } from '@/components/ui/button'

definePageMeta({ bypassMaintenance: true })

const {
  data: sections,
  error: sectionsError,
  refresh: refreshSections,
} = await useSiteSections(HOLDING_SLUG, 'CONFIDENTIALITE')

const politique = computed(() => sections.value?.politique as LegalData | undefined)
const seo = computed(() => sections.value?.seo as SeoData | undefined)

useSeoMeta({
  title: () => seo.value?.title ?? politique.value?.titre ?? 'Politique de confidentialité',
  description: () => seo.value?.description ?? '',
})
</script>

<template>
  <div v-if="sectionsError" class="mx-auto max-w-xl px-6 py-40 text-center">
    <p class="text-ink/70">Impossible de charger cette page pour le moment.</p>
    <Button variant="outline" class="mt-4" @click="refreshSections()">Réessayer</Button>
  </div>
  <TexteLegal v-else-if="politique" :legal="politique" />
</template>
