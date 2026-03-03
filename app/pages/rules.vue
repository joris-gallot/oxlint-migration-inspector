<script setup lang="ts">
import type { RuleLevel, RuleSupportStatus } from '~~/shared/types'
import { computed, ref } from 'vue'
import { migrationRules, projectReport } from '~/composables/payload'
import { migrationRuleFilters } from '~/composables/state'

const pluginFilter = ref('')
const levelFilter = ref<'' | RuleLevel>('')

const rules = computed(() => migrationRules.value)

const pluginOptions = computed(() => {
  const names = rules.value.map(rule => pluginFromRule(rule.name))
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
})

const filteredRules = computed(() => {
  const query = migrationRuleFilters.search.trim().toLowerCase()

  return rules.value.filter((rule) => {
    if (migrationRuleFilters.status && rule.status !== migrationRuleFilters.status)
      return false

    if (pluginFilter.value && pluginFromRule(rule.name) !== pluginFilter.value)
      return false

    if (levelFilter.value && !rule.eslintLevels.includes(levelFilter.value))
      return false

    if (!query)
      return true

    return (
      rule.name.toLowerCase().includes(query)
      || (rule.reason?.toLowerCase().includes(query) ?? false)
    )
  })
})

const prioritizedGaps = computed(() => {
  const unsupported = rules.value.filter(rule => rule.status === 'unsupported').slice(0, 10)
  const notImplemented = rules.value.filter(rule => rule.status === 'not_implemented').slice(0, 10)
  return {
    unsupported,
    notImplemented,
  }
})

const statusOptions: Array<{ value: RuleSupportStatus | '', label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'native_default', label: 'Native default' },
  { value: 'via_js_plugins', label: 'Via js plugins' },
  { value: 'requires_nursery', label: 'Requires nursery' },
  { value: 'requires_type_aware', label: 'Requires type-aware' },
  { value: 'not_implemented', label: 'Not implemented' },
  { value: 'unsupported', label: 'Unsupported' },
  { value: 'off_only', label: 'Off only' },
]

function pluginFromRule(ruleName: string) {
  const slashIndex = ruleName.indexOf('/')
  if (slashIndex < 0)
    return 'eslint'
  return ruleName.slice(0, slashIndex)
}

function statusLabel(status: RuleSupportStatus) {
  return statusOptions.find(item => item.value === status)?.label ?? status
}

function statusClass(status: RuleSupportStatus) {
  switch (status) {
    case 'native_default':
      return 'text-green border-green/30 bg-green:8'
    case 'via_js_plugins':
      return 'text-cyan border-cyan/30 bg-cyan:8'
    case 'requires_nursery':
    case 'requires_type_aware':
      return 'text-yellow border-yellow/30 bg-yellow:8'
    case 'unsupported':
      return 'text-red border-red/30 bg-red:8'
    case 'not_implemented':
      return 'text-amber border-amber/30 bg-amber:8'
    case 'off_only':
      return 'text-gray border-gray/30 bg-gray:12'
  }
}

function resetFilters() {
  migrationRuleFilters.search = ''
  migrationRuleFilters.status = ''
  pluginFilter.value = ''
  levelFilter.value = ''
}
</script>

<template>
  <div v-if="projectReport">
    <div grid="~ cols-1 md:cols-5 gap-3" py4>
      <div border="~ base rounded" p3>
        <div text-xs op60>
          Active ESLint Rules
        </div>
        <div text-2xl font-bold>
          {{ projectReport.stats.eslintActiveRules }}
        </div>
      </div>
      <div border="~ base rounded" p3>
        <div text-xs op60>
          Native Coverage
        </div>
        <div text-2xl font-bold>
          {{ projectReport.stats.coverageNativePct }}%
        </div>
      </div>
      <div border="~ base rounded" p3>
        <div text-xs op60>
          Default Coverage
        </div>
        <div text-2xl font-bold>
          {{ projectReport.stats.coverageDefaultPct }}%
        </div>
      </div>
      <div border="~ base rounded" p3>
        <div text-xs op60>
          Max Coverage
        </div>
        <div text-2xl font-bold>
          {{ projectReport.stats.coverageMaxPct }}%
        </div>
      </div>
      <div border="~ base rounded" p3>
        <div text-xs op60>
          Not Impl / Unsupported
        </div>
        <div text-2xl font-bold>
          {{ projectReport.stats.notImplemented }} / {{ projectReport.stats.unsupported }}
        </div>
      </div>
    </div>

    <CoverageDefinitionsInfo
      note="The percentages in this page are for the selected project only."
    />

    <div grid="~ cols-1 md:cols-2 gap-3" pb4>
      <div border="~ base rounded" p3>
        <div mb2 text-sm font-semibold>
          Prioritized Unsupported
        </div>
        <div v-if="!prioritizedGaps.unsupported.length" text-sm op60>
          None
        </div>
        <ul v-else text-sm font-mono flex="~ col gap-1">
          <li v-for="rule of prioritizedGaps.unsupported" :key="rule.name">
            {{ rule.name }}
          </li>
        </ul>
      </div>
      <div border="~ base rounded" p3>
        <div mb2 text-sm font-semibold>
          Prioritized Not Implemented
        </div>
        <div v-if="!prioritizedGaps.notImplemented.length" text-sm op60>
          None
        </div>
        <ul v-else text-sm font-mono flex="~ col gap-1">
          <li v-for="rule of prioritizedGaps.notImplemented" :key="rule.name">
            {{ rule.name }}
          </li>
        </ul>
      </div>
    </div>

    <div flex="~ gap-2 items-center wrap" pb4>
      <input
        v-model="migrationRuleFilters.search"
        placeholder="Search rule or reason..."
        border="~ base rounded"
        flex-auto bg-transparent px3 py2 md:max-w-100
      >
      <select v-model="migrationRuleFilters.status" border="~ base rounded" bg-transparent px3 py2>
        <option
          v-for="status of statusOptions"
          :key="status.value || 'all'"
          :value="status.value"
        >
          {{ status.label }}
        </option>
      </select>
      <select v-model="pluginFilter" border="~ base rounded" bg-transparent px3 py2>
        <option value="">
          All plugins
        </option>
        <option v-for="plugin of pluginOptions" :key="plugin" :value="plugin">
          {{ plugin }}
        </option>
      </select>
      <select v-model="levelFilter" border="~ base rounded" bg-transparent px3 py2>
        <option value="">
          All levels
        </option>
        <option value="error">
          error
        </option>
        <option value="warn">
          warn
        </option>
        <option value="off">
          off
        </option>
      </select>
      <button btn-action px3 @click="resetFilters">
        Reset
      </button>
    </div>

    <div border="~ base rounded" of-hidden>
      <table w-full text-sm>
        <thead bg-gray:10>
          <tr>
            <th p2 text-left>
              Rule
            </th>
            <th p2 text-left>
              Status
            </th>
            <th p2 text-left>
              Levels
            </th>
            <th p2 text-left>
              Config Indexes
            </th>
            <th p2 text-left>
              Reason
            </th>
          </tr>
        </thead>
        <tbody v-if="filteredRules.length">
          <tr v-for="rule of filteredRules" :key="rule.name" border="t base">
            <td p2 font-mono>
              {{ rule.name }}
            </td>
            <td p2>
              <span border="~ rounded" px2 py0.5 text-xs :class="statusClass(rule.status)">
                {{ statusLabel(rule.status) }}
              </span>
            </td>
            <td p2>
              <span v-for="level of rule.eslintLevels" :key="level" mr1 rounded bg-gray:15 px1.5 py0.5 text-xs font-mono>
                {{ level }}
              </span>
            </td>
            <td p2 text-xs font-mono>
              {{ rule.configIndexes.join(', ') }}
            </td>
            <td p2 op70>
              {{ rule.reason || '-' }}
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr border="t base">
            <td colspan="5" py40 text-center text-sm italic op60>
              No rules match the current filters.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <div v-else italic op60>
    No project selected.
  </div>
</template>
