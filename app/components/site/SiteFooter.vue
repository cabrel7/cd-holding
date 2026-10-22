<script setup lang="ts">
// Pied de page public partagé holding/filiale (spec §4.3). `filiales` n'est fourni que par le
// pied de page holding (liste des 6 filiales) ; son absence bascule vers le lien "Retour au
// Groupe CD" du prototype filiale (SubFooter.tsx).
import { ArrowUpRight, ExternalLink, Mail, MapPin, Phone } from '@lucide/vue'
import { HOLDING_SLUG } from '#shared/config/sites'
import type { PublicSite, PublicSiteSummary } from '#shared/types/public'
import TexteAccentue from './TexteAccentue.vue'

const props = defineProps<{
  site: PublicSite
  groupe: string
  filiales?: readonly PublicSiteSummary[]
}>()

const { href } = useSiteLinks()

// Liens traduits (lot 8, D7) : inter-sites absolus depuis un hôte connu, préfixés en dev
// (inchangé), nus depuis le sous-domaine lui-même. Le « retour au groupe » vise la holding.
const lienRetourGroupe = computed(() => href(HOLDING_SLUG, '/').to)
const lienMentionsLegales = computed(() => href(props.site.slug, '/mentions-legales').to)

const isHolding = computed(() => props.filiales !== undefined)
const annee = new Date().getFullYear()

const piedDePageTexte = computed(() => {
  const donnees = props.site.commun.piedDePage
  const texte = donnees?.texte
  return typeof texte === 'string' ? texte : null
})

// Mention alcool (catalogue COMMUN:mentionAlcool, portée boissons — RACJ/Éduc'alcool, Q-07).
// Sa présence sert aussi de condition au lien « Mentions légales » : seuls les sites qui
// affichent la mention réglementaire ont la page /{slug}/mentions-legales (spec
// lot7-mentions-legales.md, D5 — emplacement à confirmer par le client, dossier juriste q. 10).
const mentionAlcool = computed(() => {
  const texte = props.site.commun.mentionAlcool?.texte
  return typeof texte === 'string' && texte !== '' ? texte : null
})

const reseaux = computed(() =>
  [
    { label: 'LinkedIn', url: props.site.reseaux.linkedinUrl },
    { label: 'Facebook', url: props.site.reseaux.facebookUrl },
    { label: 'Instagram', url: props.site.reseaux.instagramUrl },
  ].filter((r) => r.url),
)
</script>

<template>
  <footer class="bg-navy text-cream">
    <div class="mx-auto max-w-7xl px-6 py-16">
      <div class="grid grid-cols-1 gap-12 md:grid-cols-12">
        <div :class="isHolding ? 'md:col-span-5' : 'md:col-span-6'">
          <div v-if="isHolding" class="font-display text-3xl font-bold">
            {{ groupe.split(' ').slice(0, -1).join(' ') }}
            <span class="text-gold">{{ groupe.split(' ').at(-1) }}</span>
          </div>
          <template v-else>
            <p class="font-display text-xs font-semibold uppercase tracking-[0.3em] text-cream/90">
              {{ site.secteur }}
            </p>
            <h4 class="mt-3 font-display text-3xl font-bold leading-tight">{{ site.nom }}</h4>
          </template>

          <TexteAccentue
            v-if="piedDePageTexte"
            :texte="piedDePageTexte"
            as="p"
            class="mt-4 max-w-md text-sm leading-relaxed text-cream/70"
          />

          <div v-if="isHolding" class="mt-6 space-y-2 text-sm text-cream/80">
            <p class="flex items-center gap-2">
              <MapPin :size="16" aria-hidden="true" /> {{ site.adresse ?? 'Montréal, Québec, Canada' }}
            </p>
            <p v-if="site.email" class="flex items-center gap-2">
              <Mail :size="16" aria-hidden="true" /> {{ site.email }}
            </p>
            <p v-if="site.telephone" class="flex items-center gap-2">
              <Phone :size="16" aria-hidden="true" /> {{ site.telephone }}
            </p>
          </div>
          <NuxtLink
            v-else
            :to="lienRetourGroupe"
            class="group mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cream"
          >
            <span class="border-b border-cream/40 pb-0.5">Retour au {{ groupe }}</span>
            <ArrowUpRight
              :size="16"
              aria-hidden="true"
              class="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </NuxtLink>
        </div>

        <div v-if="isHolding" class="md:col-span-4">
          <p class="font-display text-xs font-semibold uppercase tracking-widest text-gold">Nos filiales</p>
          <ul class="mt-2 text-sm">
            <li v-for="filiale in filiales" :key="filiale.uuid">
              <NuxtLink
                :to="href(filiale.slug, '/').to"
                class="inline-flex min-h-11 items-center text-cream/80 transition-colors hover:text-gold"
              >
                {{ filiale.nom }}
              </NuxtLink>
            </li>
          </ul>
        </div>
        <div v-else class="md:col-span-3">
          <p class="font-display text-xs font-semibold uppercase tracking-widest text-cream/60">Nous joindre</p>
          <ul class="mt-4 space-y-2 text-sm text-cream/85">
            <li v-if="site.email">{{ site.email }}</li>
            <li v-if="site.telephone">{{ site.telephone }}</li>
            <li>{{ site.adresse ?? 'Montréal, Québec, Canada' }}</li>
          </ul>
        </div>

        <div v-if="reseaux.length" :class="isHolding ? 'md:col-span-3' : 'md:col-span-3'">
          <p
            class="font-display text-xs font-semibold uppercase tracking-widest"
            :class="isHolding ? 'text-gold' : 'text-cream/60'"
          >
            {{ isHolding ? 'Suivez-nous' : 'Suivre' }}
          </p>
          <ul v-if="reseaux.length" class="mt-2 text-sm">
            <li v-for="r in reseaux" :key="r.label">
              <a
                :href="r.url ?? undefined"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex min-h-11 items-center gap-1.5 text-cream/80 transition-colors hover:text-gold"
              >
                {{ r.label }}
                <ExternalLink :size="14" aria-hidden="true" />
                <span class="sr-only">(ouvre dans un nouvel onglet)</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div class="mt-14 border-t border-cream/10 pt-6 text-xs text-cream/60">
        <p v-if="mentionAlcool" class="mb-4 max-w-2xl leading-relaxed">
          <TexteAccentue :texte="mentionAlcool" as="span" />
        </p>
        <div class="flex flex-col justify-between gap-4 md:flex-row">
          <p v-if="isHolding">© {{ annee }} {{ groupe }}. Tous droits réservés.</p>
          <p v-else>© {{ annee }} {{ site.nom }} — Une filiale du {{ groupe }}.</p>
          <div class="flex gap-6">
            <NuxtLink
              v-if="mentionAlcool"
              :to="lienMentionsLegales"
              class="inline-flex min-h-11 items-center hover:text-gold"
            >
              Mentions légales
            </NuxtLink>
            <NuxtLink to="/confidentialite" class="inline-flex min-h-11 items-center hover:text-gold">Politique de confidentialité</NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>
