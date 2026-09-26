<script setup lang="ts">
// Rangée alternée d'un service (page `/{filiale}/services`, spec §1 « Rangées alternées »).
// Numérotation par index (jamais l'id du service, CLAUDE.md/spec §0 : le prototype affichait
// l'id brut — "25" pour un service au 5e rang). Visuel : photo CMS si présente, sinon aplat
// décoratif reprenant le même numéro (SiteImage `decorative`, spec §1/§5).
import type { PublicServiceDto } from '#shared/types/public'
import SiteImage from '@/components/site/SiteImage.vue'

const props = defineProps<{ service: PublicServiceDto; index: number }>()

const { reveal } = useReveal()

const numero = computed(() => String(props.index + 1).padStart(2, '0'))
const inverse = computed(() => props.index % 2 === 1)
</script>

<template>
  <article
    v-motion
    v-bind="reveal(props.index)"
    class="grid grid-cols-1 items-center gap-10 md:grid-cols-12"
  >
    <div :class="['md:col-span-5', inverse ? 'md:order-2 md:col-start-8' : '']">
      <p class="font-display text-6xl font-bold leading-none text-site-accent-strong" aria-hidden="true">
        {{ numero }}
      </p>
      <h2 class="mt-4 font-display text-3xl font-bold text-navy md:text-4xl">{{ service.titre }}</h2>
      <p class="mt-5 leading-relaxed text-ink/75">{{ service.description }}</p>
    </div>
    <div :class="['md:col-span-6', inverse ? 'md:order-1 md:col-start-1' : 'md:col-start-7']">
      <SiteImage
        :file-key="service.imageKey"
        :alt="service.titre"
        fallback="aplat"
        :initiales="numero"
        :decorative="!service.imageKey"
        class="aspect-[4/3] w-full rounded-[1.5rem]"
      />
    </div>
  </article>
</template>
