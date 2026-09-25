<script setup lang="ts">
// Page de maintenance fonctionnelle (DEC-09, spec §4.3) : remplace le contenu de la page quand
// `statutSite !== 'ACTIF'`. Contenu éditable (catalogue COMMUN.maintenance, type `section`) ;
// valeurs de repli si la ligne n'est pas encore chargée/absente, jamais de texte figé silencieux.
import { ArrowLeft } from '@lucide/vue'
import type { SectionData } from '@/composables/useSiteSections'
import type { PublicSite } from '#shared/types/public'
import TexteAccentue from './TexteAccentue.vue'

const props = defineProps<{
  site: PublicSite
  section: SectionData | null
}>()

const DEFAUT_TITRE = 'Page en pause'
const DEFAUT_TEXTE = 'Cette section est momentanément indisponible. Revenez très bientôt.'

const surtitre = computed(() => props.section?.surtitre ?? props.site.nom)
const titre = computed(() => props.section?.titre ?? DEFAUT_TITRE)
const texte = computed(() => props.section?.texte ?? DEFAUT_TEXTE)
</script>

<template>
  <div class="flex min-h-[70vh] items-center justify-center px-6 py-24">
    <div class="max-w-lg text-center">
      <p class="font-display text-sm font-semibold uppercase tracking-[0.25em] text-site-accent">
        {{ surtitre }}
      </p>
      <TexteAccentue
        :texte="titre"
        as="h1"
        class="mt-4 font-display text-4xl font-bold text-navy md:text-5xl"
      />
      <TexteAccentue :texte="texte" as="p" class="mt-4 leading-relaxed text-ink/70" />
      <NuxtLink
        to="/"
        class="mt-8 inline-flex items-center gap-2 rounded-full bg-navy px-6 py-3 text-sm font-semibold text-cream transition-transform hover:-translate-y-0.5"
      >
        <ArrowLeft :size="16" aria-hidden="true" /> Retour au Groupe CD
      </NuxtLink>
    </div>
  </div>
</template>
