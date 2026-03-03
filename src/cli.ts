import type { AnalyzeWorkspaceOptions, WorkspaceReport } from '~~/shared/types'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import process from 'node:process'
import c from 'ansis'
import cac from 'cac'
import { getPort } from 'get-port-please'
import open from 'open'
import { relative, resolve } from 'pathe'
import { glob } from 'tinyglobby'
import { MARK_CHECK, MARK_INFO } from './constants'
import { analyzeWorkspace, getDefaultWorkspaceRoot } from './core/analyze-workspace'
import { distDir } from './dirs'
import { createHostServer } from './server'

const cli = cac('oxlint-migration-inspector')

cli
  .command('analyze', 'Analyze ESLint -> Oxlint migration coverage for a workspace')
  .option('--root <root>', 'Workspace root directory', { default: '.' })
  .option('--config <configFile>', 'Analyze a single config file (shortcut)')
  .option('--include <globs>', 'Include glob patterns (comma-separated)')
  .option('--exclude <globs>', 'Exclude glob patterns (comma-separated)')
  .option('--files', 'Include matched file paths in payload', { default: true })
  .option('--json', 'Print machine-readable JSON output')
  .option('--output <file>', 'Write JSON output to file')
  .action(async (options) => {
    const cwd = process.cwd()
    const analyzeOptions = resolveAnalyzeOptions(cwd, options)
    const report = await analyzeWorkspace(analyzeOptions)

    if (options.output) {
      const outputPath = resolve(cwd, options.output)
      await fs.mkdir(resolve(outputPath, '..'), { recursive: true })
      await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8')
      console.log(MARK_CHECK, `Report written to ${relative(cwd, outputPath)}`)
    }

    if (options.json) {
      console.log(JSON.stringify(report, null, 2))
      return
    }

    printWorkspaceSummary(report)
  })

cli
  .command('build', 'Build static migration inspector for workspace snapshot')
  .option('--root <root>', 'Workspace root directory', { default: '.' })
  .option('--config <configFile>', 'Analyze a single config file (shortcut)')
  .option('--include <globs>', 'Include glob patterns (comma-separated)')
  .option('--exclude <globs>', 'Exclude glob patterns (comma-separated)')
  .option('--files', 'Include matched file paths in payload', { default: true })
  .option('--basePath <basePath>', 'Subdirectory inside root to scan')
  // Build specific options
  .option('--base <baseURL>', 'Base URL for deployment', { default: '/' })
  .option('--outDir <dir>', 'Output directory', { default: '.oxlint-migration-inspector' })
  .action(async (options) => {
    console.log(MARK_INFO, 'Building static Oxlint migration inspector...')

    const cwd = process.cwd()
    const outDir = resolve(cwd, options.outDir)

    const report = await analyzeWorkspace(resolveAnalyzeOptions(cwd, options))

    let baseURL = options.base
    if (!baseURL.endsWith('/'))
      baseURL += '/'
    if (!baseURL.startsWith('/'))
      baseURL = `/${baseURL}`
    baseURL = baseURL.replace(/\/+/g, '/')

    if (existsSync(outDir))
      await fs.rm(outDir, { recursive: true })
    await fs.mkdir(outDir, { recursive: true })
    await fs.cp(distDir, outDir, { recursive: true })

    const htmlFiles = await glob('**/*.html', { cwd: distDir, onlyFiles: true, expandDirectories: false })
    if (baseURL !== '/') {
      for (const file of htmlFiles) {
        const content = await fs.readFile(resolve(distDir, file), 'utf-8')
        const newContent = content
          .replaceAll(/\s(href|src)="\//g, ` $1="${baseURL}`)
          .replaceAll('baseURL:"/"', `baseURL:"${baseURL}"`)
        await fs.writeFile(resolve(outDir, file), newContent, 'utf-8')
      }
    }

    await fs.mkdir(resolve(outDir, 'api'), { recursive: true })
    const staticPayload = {
      workspace: sanitizeWorkspaceForStatic(report, cwd),
    }
    await fs.writeFile(resolve(outDir, 'api/payload.json'), JSON.stringify(staticPayload, null, 2), 'utf-8')

    console.log(MARK_CHECK, `Built to ${relative(cwd, outDir)}`)
    console.log(MARK_INFO, `You can serve it via: \`npx serve ${relative(cwd, outDir)}\``)
  })

cli
  .command('', 'Start dev inspector')
  .option('--root <root>', 'Workspace root directory', { default: process.cwd() })
  .option('--config <configFile>', 'Analyze a single config file (shortcut)')
  .option('--include <globs>', 'Include glob patterns (comma-separated)')
  .option('--exclude <globs>', 'Exclude glob patterns (comma-separated)')
  .option('--files', 'Include matched file paths in payload', { default: true })
  .option('--basePath <basePath>', 'Subdirectory inside root to scan')
  // Dev specific options
  .option('--host <host>', 'Host', { default: process.env.HOST || '127.0.0.1' })
  .option('--port <port>', 'Port', { default: process.env.PORT || 7777 })
  .option('--open', 'Open browser', { default: true })
  .action(async (options) => {
    const host = options.host
    const port = await getPort({ port: options.port, portRange: [7777, 9000], host })

    console.log(MARK_INFO, 'Starting Oxlint migration inspector at', c.green`http://${host === '127.0.0.1' ? 'localhost' : host}:${port}`, '\n')

    const cwd = process.cwd()
    const server = await createHostServer(resolveAnalyzeOptions(cwd, options))

    server.listen(port, host, async () => {
      if (options.open)
        await open(`http://${host === '127.0.0.1' ? 'localhost' : host}:${port}`)
    })
  })

cli.help()
cli.parse()

function resolveAnalyzeOptions(cwd: string, options: Record<string, any>): AnalyzeWorkspaceOptions {
  let root = resolve(cwd, options.root || getDefaultWorkspaceRoot(cwd))
  let include = parseCommaList(options.include)
  const exclude = parseCommaList(options.exclude)

  if (options.config) {
    const configPath = resolve(cwd, options.config)
    root = resolve(configPath, '..')
    include = [relative(root, configPath)]
  }

  return {
    root,
    include,
    exclude,
    basePath: options.basePath,
    globMatchedFiles: !!options.files,
  }
}

function parseCommaList(value: unknown): string[] {
  if (value == null)
    return []

  if (Array.isArray(value)) {
    return unique(value.flatMap(item => parseCommaList(item)))
  }

  return unique(String(value)
    .split(',')
    .map(i => i.trim())
    .filter(Boolean))
}

function unique(values: string[]) {
  return Array.from(new Set(values))
}

function printWorkspaceSummary(report: WorkspaceReport) {
  console.log(MARK_INFO, `Workspace: ${report.root}`)
  console.log(MARK_INFO, `Projects analyzed: ${report.totals.projectCount}`)
  console.log(MARK_INFO, `Active ESLint rules: ${report.totals.eslintActiveRules}`)
  console.log(MARK_INFO, `Coverage (default/max): ${report.totals.coverageDefaultPct}% / ${report.totals.coverageMaxPct}%`)
  console.log('')

  for (const project of report.projects) {
    const warningsSuffix = project.warnings.length ? ` | warnings=${project.warnings.length}` : ''
    console.log(
      `- ${project.name} (${relative(report.root, project.configPath)}): active=${project.stats.eslintActiveRules} | default=${project.stats.coverageDefaultPct}% | max=${project.stats.coverageMaxPct}% | not-impl=${project.stats.notImplemented} | unsupported=${project.stats.unsupported}${warningsSuffix}`,
    )
  }
}

function sanitizeWorkspaceForStatic(report: WorkspaceReport, cwd: string): WorkspaceReport {
  return {
    ...report,
    root: relative(cwd, report.root) || '.',
    projects: report.projects.map((project) => {
      const relativeConfigPath = relative(cwd, project.configPath)
      const relativeBasePath = relative(cwd, project.basePath)

      return {
        ...project,
        configPath: relativeConfigPath,
        basePath: relativeBasePath,
        payload: {
          ...project.payload,
          meta: {
            ...project.payload.meta,
            wsPort: undefined,
            configPath: relativeConfigPath,
            basePath: relativeBasePath,
          },
        },
        dependencies: project.dependencies.map(dep => relative(cwd, dep)),
      }
    }),
  }
}
