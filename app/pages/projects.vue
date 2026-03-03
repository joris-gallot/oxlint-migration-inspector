<script setup lang="ts">
import { useRouter } from '#app/composables/router'
import { computed } from 'vue'
import { projects, selectProject, workspace } from '~/composables/payload'
import { projectDashboardFilters } from '~/composables/state'

const router = useRouter()

const filteredProjects = computed(() => {
  const search = projectDashboardFilters.search.trim().toLowerCase()

  return projects.value.filter((project) => {
    if (projectDashboardFilters.warningsOnly && project.warnings.length === 0)
      return false

    if (!search)
      return true

    return (
      project.name.toLowerCase().includes(search)
      || project.configPath.toLowerCase().includes(search)
      || project.id.toLowerCase().includes(search)
    )
  })
})

function goToProject(projectId: string) {
  selectProject(projectId)
  router.push('/rules')
}

function barStyle(value: number, hue: number) {
  return {
    width: `${Math.max(0, Math.min(100, value))}%`,
    backgroundColor: `hsl(${hue} 85% 45%)`,
  }
}
</script>

<template>
  <div>
    <div grid="~ cols-1 md:cols-3 gap-3" py4>
      <div border="~ base rounded" p4>
        <div text-sm op60>
          Projects
        </div>
        <div text-3xl font-bold>
          {{ workspace.totals.projectCount }}
        </div>
      </div>
      <div border="~ base rounded" p4>
        <div text-sm op60>
          Coverage Default
        </div>
        <div text-3xl font-bold>
          {{ workspace.totals.coverageDefaultPct }}%
        </div>
      </div>
      <div border="~ base rounded" p4>
        <div text-sm op60>
          Coverage Max
        </div>
        <div text-3xl font-bold>
          {{ workspace.totals.coverageMaxPct }}%
        </div>
      </div>
    </div>

    <CoverageDefinitionsInfo
      note="Dashboard Coverage Default and Coverage Max are workspace totals (weighted by active ESLint rules across all projects)."
    />

    <div flex="~ gap-3 items-center wrap" pb4>
      <input
        v-model="projectDashboardFilters.search"
        placeholder="Search projects or config path..."
        border="~ base rounded"
        w-full bg-transparent px3 py2 md:max-w-100
      >
      <label flex="~ gap-2 items-center" text-sm>
        <input
          v-model="projectDashboardFilters.warningsOnly"
          type="checkbox"
        >
        warnings only
      </label>
    </div>

    <div v-if="filteredProjects.length === 0" italic op60>
      No project matches the current filters.
    </div>

    <div v-else flex="~ col gap-3">
      <div
        v-for="project of filteredProjects"
        :key="project.id"
        border="~ base rounded"
        p4
      >
        <div flex="~ items-center gap-3 wrap">
          <div flex-auto>
            <div text-lg font-semibold>
              {{ project.name }}
            </div>
            <div text-sm font-mono op60>
              {{ project.configPath }}
            </div>
          </div>
          <button btn-action px3 @click="goToProject(project.id)">
            Open Project
          </button>
        </div>

        <div grid="~ cols-1 md:cols-3 gap-3" mt4>
          <div>
            <div text-xs op60>
              Active ESLint Rules
            </div>
            <div text-xl font-bold>
              {{ project.stats.eslintActiveRules }}
            </div>
          </div>
          <div>
            <div text-xs op60>
              Not Implemented
            </div>
            <div text-xl text-amber font-bold>
              {{ project.stats.notImplemented }}
            </div>
          </div>
          <div>
            <div text-xs op60>
              Unsupported
            </div>
            <div text-xl text-red font-bold>
              {{ project.stats.unsupported }}
            </div>
          </div>
        </div>

        <div mt4 flex="~ col gap-2">
          <div>
            <div flex="~ justify-between" text-sm>
              <span>Native Coverage</span>
              <span>{{ project.stats.coverageNativePct }}%</span>
            </div>
            <div h-2 rounded bg-gray:20>
              <div h-full rounded :style="barStyle(project.stats.coverageNativePct, 210)" />
            </div>
          </div>
          <div>
            <div flex="~ justify-between" text-sm>
              <span>Default Coverage</span>
              <span>{{ project.stats.coverageDefaultPct }}%</span>
            </div>
            <div h-2 rounded bg-gray:20>
              <div h-full rounded :style="barStyle(project.stats.coverageDefaultPct, 145)" />
            </div>
          </div>
          <div>
            <div flex="~ justify-between" text-sm>
              <span>Max Coverage</span>
              <span>{{ project.stats.coverageMaxPct }}%</span>
            </div>
            <div h-2 rounded bg-gray:20>
              <div h-full rounded :style="barStyle(project.stats.coverageMaxPct, 30)" />
            </div>
          </div>
        </div>

        <div v-if="project.warnings.length" mt4 border="~ orange/30 rounded" bg-orange:5 p3>
          <div mb2 text-sm text-orange font-semibold>
            Warnings ({{ project.warnings.length }})
          </div>
          <ul text-sm font-mono flex="~ col gap-1">
            <li v-for="warning of project.warnings" :key="warning">
              {{ warning }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
