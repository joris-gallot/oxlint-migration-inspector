<script setup lang="ts">
import { computed } from 'vue'
import { projectReport } from '~/composables/payload'

const analysisFailed = computed(() => {
  return projectReport.value?.warnings.some(warning => warning.startsWith('Failed to analyze')) ?? false
})
</script>

<template>
  <div v-if="projectReport">
    <div
      v-if="analysisFailed"
      border="~ orange/30 rounded" mb4 bg-orange:6 p3 text-sm text-orange
    >
      This project could not be analyzed successfully. Migrated config is unavailable.
    </div>

    <MigratedConfigTabs
      :configs="projectReport.migratedConfigs"
      :scenario-commands="{
        native: projectReport.commandPreview.migrateNative,
        default: projectReport.commandPreview.migrateDefault,
        max: projectReport.commandPreview.migrateMax,
      }"
      :disabled="analysisFailed"
    />
  </div>
  <div v-else italic op60>
    No project selected.
  </div>
</template>
