<script setup lang="ts">
import { useTimeAgo } from '@vueuse/core'
import { computed } from 'vue'
import { toggleDark } from '~/composables/dark'
import { isFetching, payload, projectReport, projects, selectedProject, selectProject, workspace } from '~/composables/payload'

const lastUpdate = useTimeAgo(() => projectReport.value?.payload.meta.lastUpdate ?? workspace.value.generatedAt)

const projectLabel = computed(() => {
  if (!selectedProject.value)
    return 'No project selected'

  return `${selectedProject.value.name} (${selectedProject.value.stats.coverageDefaultPct}% default / ${selectedProject.value.stats.coverageMaxPct}% max)`
})
</script>

<template>
  <ConfigInspectorBadge text-3xl font-200 />
  <div flex="~ gap-2 items-center wrap" my1 text-sm>
    <span op50>Workspace</span>
    <span font-mono op35>{{ workspace.root }}</span>
  </div>
  <div flex="~ gap-1 items-center wrap" text-sm>
    <span op50>Projects</span>
    <span font-bold>{{ workspace.totals.projectCount }}</span>
    <span op50>active ESLint rules</span>
    <span font-bold>{{ workspace.totals.eslintActiveRules }}</span>
    <span op50>coverage default/max</span>
    <span font-bold>{{ workspace.totals.coverageDefaultPct }}% / {{ workspace.totals.coverageMaxPct }}%</span>
    <span op50>updated</span>
    <span op75>{{ lastUpdate }}</span>
    <div
      v-if="isFetching"
      flex="~ gap-2 items-center"
      ml2 animate-pulse text-green
    >
      <div i-svg-spinners-90-ring-with-bg flex-none text-sm />
      Fetching updates...
    </div>
  </div>

  <div v-if="projects.length" mt4 flex="~ col gap-2">
    <label text-sm op60>Selected project</label>
    <select
      border="~ base rounded"
      bg-transparent p2
      :value="selectedProject?.id"
      @change="selectProject(($event.target as HTMLSelectElement).value)"
    >
      <option v-for="project of projects" :key="project.id" :value="project.id">
        {{ project.name }} - {{ project.configPath }}
      </option>
    </select>
    <div text-xs op60>
      {{ projectLabel }}
    </div>
  </div>

  <div flex="~ gap-3 items-center wrap" py4>
    <NuxtLink
      to="/projects"
      btn-action px3 py1 text-base
      active-class="btn-action-active"
    >
      <div i-ph-chart-bar-duotone flex-none />
      Projects
    </NuxtLink>
    <NuxtLink
      to="/rules"
      btn-action px3 py1 text-base
      active-class="btn-action-active"
    >
      <div i-ph-list-dashes-duotone flex-none />
      Migration Rules
    </NuxtLink>
    <NuxtLink
      to="/configs"
      btn-action px3 py1 text-base
      active-class="btn-action-active"
    >
      <div i-ph-stack-duotone flex-none />
      ESLint Configs
    </NuxtLink>
    <NuxtLink
      v-if="payload.filesResolved"
      to="/files"
      btn-action px3 py1 text-base
      active-class="btn-action-active"
    >
      <div i-ph-files-duotone flex-none />
      Files
    </NuxtLink>
    <button
      title="Toggle Dark Mode"
      i-ph-sun-dim-duotone dark:i-ph-moon-stars-duotone ml1 text-xl op50 hover:op75
      @click="toggleDark()"
    />
    <NuxtLink
      href="https://github.com/oxc-project" target="_blank"
      i-carbon-logo-github text-lg op50 hover:op75
    />
  </div>
</template>
