import type { WebSocket } from 'ws'
import type { AnalyzeWorkspaceOptions, WorkspacePayload, WorkspaceReport } from '~~/shared/types'
import process from 'node:process'
import chokidar from 'chokidar'
import { getPort } from 'get-port-please'
import { WebSocketServer } from 'ws'
import { MARK_CHECK } from './constants'
import { analyzeWorkspace } from './core/analyze-workspace'

const readErrorWarning = `Failed to analyze workspace ESLint configs.
Note that Oxlint Migration Inspector only works with ESLint flat configs:
https://eslint.org/docs/latest/use/configure/configuration-files-new`

export interface CreateWsServerOptions extends AnalyzeWorkspaceOptions {}

export async function createWsServer(options: CreateWsServerOptions) {
  let workspace: WorkspaceReport | undefined
  const port = await getPort({ port: 7811, random: true })
  const wss = new WebSocketServer({ port })
  const wsClients = new Set<WebSocket>()

  wss.on('connection', (ws) => {
    wsClients.add(ws)
    console.log(MARK_CHECK, 'Websocket client connected')
    ws.on('close', () => wsClients.delete(ws))
  })

  const watcher = chokidar.watch([], {
    ignoreInitial: true,
  })

  watcher.on('change', (path) => {
    workspace = undefined
    console.log()
    console.log(MARK_CHECK, 'Config change detected', path)
    wsClients.forEach((ws) => {
      ws.send(JSON.stringify({
        type: 'config-change',
        path,
      }))
    })
  })

  async function getData() {
    try {
      if (!workspace) {
        workspace = await analyzeWorkspace(options)
        const dependencies = workspace.projects.flatMap(project => project.dependencies)
        watcher.add(Array.from(new Set(dependencies)))
      }

      const payload: WorkspacePayload = {
        workspace: {
          ...workspace,
          projects: workspace.projects.map(project => ({
            ...project,
            payload: {
              ...project.payload,
              meta: {
                ...project.payload.meta,
                wsPort: port,
              },
            },
          })),
        },
      }

      return payload
    }
    catch (e) {
      console.error(readErrorWarning)
      console.error(e)
      return {
        message: readErrorWarning,
        error: String(e),
      }
    }
  }

  if (!options.root) {
    options.root = process.cwd()
  }

  return {
    port,
    wss,
    watcher,
    getData,
  }
}
