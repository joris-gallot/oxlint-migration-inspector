/* eslint-disable no-console */
import type {
  ErrorInfo,
  FilesGroup,
  FlatConfigItem,
  Payload,
  ResolvedPayload,
  RuleConfigStates,
  RuleInfo,
  WorkspacePayload,
} from '~~/shared/types'
import { $fetch } from 'ofetch'
import { computed, ref, watchEffect } from 'vue'
import { isGeneralConfig, isIgnoreOnlyConfig } from '~~/shared/configs'
import { getRuleLevel, getRuleOptions } from '~~/shared/rules'
import {
  configsOpenState,
  fileGroupsOpenState,
  selectedProjectId,
} from './state'

const LOG_NAME = '[Oxlint Migration Inspector]'

const EMPTY_PAYLOAD: Payload = {
  rules: {},
  configs: [],
  meta: {
    lastUpdate: 0,
    basePath: '',
    configPath: '',
  },
}

const data = ref<WorkspacePayload>({
  workspace: {
    generatedAt: 0,
    root: '',
    projects: [],
    totals: {
      projectCount: 0,
      eslintActiveRules: 0,
      coverageDefaultPct: 0,
      coverageMaxPct: 0,
    },
  },
})

/**
 * State of initial loading
 */
export const isLoading = ref(true)
/**
 * State of fetching, used for loading indicator
 */
export const isFetching = ref(false)
/**
 * Error information
 */
export const errorInfo = ref<ErrorInfo>()

function isErrorInfo(payload: WorkspacePayload | ErrorInfo): payload is ErrorInfo {
  return 'error' in payload
}

async function get(baseURL: string) {
  isFetching.value = true
  const payload = await $fetch<WorkspacePayload | ErrorInfo>('/api/payload.json', { baseURL })
  if (isErrorInfo(payload)) {
    errorInfo.value = payload
    isLoading.value = false
    isFetching.value = false
    return
  }

  errorInfo.value = undefined
  data.value = payload
  isLoading.value = false
  isFetching.value = false
  console.log(LOG_NAME, 'Workspace payload', payload)
  return payload
}

let _promise: Promise<WorkspacePayload | undefined> | undefined

export function init(baseURL: string) {
  if (_promise)
    return

  _promise = get(baseURL)
    .then((payload) => {
      if (!payload)
        return

      const wsPort = payload.workspace.projects.find(
        project => typeof project.payload.meta.wsPort === 'number',
      )?.payload.meta.wsPort

      if (typeof wsPort === 'number') {
        const ws = new WebSocket(`ws://${location.hostname}:${wsPort}`)
        ws.addEventListener('message', async (event) => {
          console.log(LOG_NAME, 'WebSocket message', event.data)
          const payload = JSON.parse(event.data)
          if (payload.type === 'config-change')
            get(baseURL)
        })
        ws.addEventListener('open', () => {
          console.log(LOG_NAME, 'WebSocket connected')
        })
        ws.addEventListener('close', () => {
          console.log(LOG_NAME, 'WebSocket closed')
        })
        ws.addEventListener('error', (error) => {
          console.error(LOG_NAME, 'WebSocket error', error)
        })
      }

      return payload
    })
}

export function ensureDataFetch() {
  return _promise
}

export const workspace = computed(() => data.value.workspace)
export const projects = computed(() => workspace.value.projects)

export const selectedProject = computed(() => {
  if (projects.value.length === 0)
    return undefined

  return projects.value.find(project => project.id === selectedProjectId.value) ?? projects.value[0]
})

watchEffect(() => {
  if (projects.value.length === 0)
    return

  if (!selectedProject.value)
    return

  if (selectedProjectId.value !== selectedProject.value.id)
    selectedProjectId.value = selectedProject.value.id
})

export const projectReport = computed(() => selectedProject.value)

export function selectProject(projectId: string) {
  selectedProjectId.value = projectId
}

export const migrationRules = computed(() => projectReport.value?.rules ?? [])

export const payload = computed(() => Object.freeze(resolvePayload(projectReport.value?.payload ?? EMPTY_PAYLOAD)))

export function getRuleFromName(name: string): RuleInfo {
  return payload.value.rules[name] || {
    name,
    invalid: true,
  } as RuleInfo
}

export function getRuleDefaultOptions(name: string): any[] {
  return payload.value.rules[name]?.defaultOptions ?? []
}

export function getRuleStates(name: string): RuleConfigStates | undefined {
  return payload.value.ruleToState.get(name)
}

export function resolvePayload(payload: Payload): ResolvedPayload {
  const ruleToState = new Map<string, RuleConfigStates>()
  const globToConfigs = new Map<string, FlatConfigItem[]>()

  payload.configs.forEach((config, index) => {
    if (config.rules) {
      Object.entries(config.rules).forEach(([name, raw]) => {
        const value = getRuleLevel(raw)
        if (value) {
          const options = getRuleOptions(raw)
          if (!ruleToState.has(name))
            ruleToState.set(name, [])
          ruleToState.get(name)!.push({
            name,
            configIndex: index,
            level: value,
            options,
          })
        }
      })
    }

    for (const glob of config.files?.flat() || []) {
      if (!globToConfigs.has(glob))
        globToConfigs.set(glob, [])
      globToConfigs.get(glob)!.push(config)
    }
    for (const glob of config.ignores?.flat() || []) {
      if (!globToConfigs.has(glob))
        globToConfigs.set(glob, [])
      globToConfigs.get(glob)!.push(config)
    }
  })

  configsOpenState.value = payload.configs.length >= 10
    ? payload.configs.map(() => false)
    : payload.configs.map(() => true)

  return {
    ...payload,
    configsIgnoreOnly: payload.configs.filter(i => isIgnoreOnlyConfig(i)),
    configsGeneral: payload.configs.filter(i => isGeneralConfig(i)),
    ruleToState,
    globToConfigs,
    filesResolved: resolveFiles(payload),
  }
}

function resolveFiles(payload: Payload): ResolvedPayload['filesResolved'] {
  if (!payload.files)
    return undefined

  const generalConfigIndex = payload.configs.filter(i => isGeneralConfig(i)).map(i => i.index)

  const files: string[] = []
  const globToFiles = new Map<string, Set<string>>()
  const fileToGlobs = new Map<string, Set<string>>()
  const fileToConfigs = new Map<string, Set<number>>()
  const configToFiles = new Map<number, Set<string>>()
  const filesGroupMap = new Map<string, FilesGroup>()

  for (const file of payload.files) {
    files.push(file.filepath)
    for (const glob of file.globs) {
      if (!globToFiles.has(glob))
        globToFiles.set(glob, new Set())
      globToFiles.get(glob)!.add(file.filepath)
      if (!fileToGlobs.has(file.filepath))
        fileToGlobs.set(file.filepath, new Set())
      fileToGlobs.get(file.filepath)!.add(glob)
    }
    for (const configIndex of file.configs) {
      if (!configToFiles.has(configIndex))
        configToFiles.set(configIndex, new Set())
      configToFiles.get(configIndex)!.add(file.filepath)
      if (!fileToConfigs.has(file.filepath))
        fileToConfigs.set(file.filepath, new Set())
      fileToConfigs.get(file.filepath)!.add(configIndex)
    }

    const specialConfigs = file.configs.filter(i => !generalConfigIndex.includes(i))
    const groupId = specialConfigs.join('-')
    if (!filesGroupMap.has(groupId)) {
      filesGroupMap.set(groupId, {
        id: groupId,
        files: [],
        configs: specialConfigs.map(i => payload.configs[i]!),
        globs: new Set<string>(),
      })
    }
    const group = filesGroupMap.get(groupId)!
    group.files.push(file.filepath)
    file.globs.forEach(i => group.globs.add(i))
  }

  const groups = Array.from(filesGroupMap.values())
  fileGroupsOpenState.value = groups.map(() => true)

  return {
    list: files,
    globToFiles,
    fileToGlobs,
    fileToConfigs: new Map(Array.from(fileToConfigs.entries()).map(([file, configs]) => [file, Array.from(configs).sort((a, b) => a - b).map(i => payload.configs[i]!)])),
    configToFiles,
    groups,
  }
}
