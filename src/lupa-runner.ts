import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const configPath = process.env.LUPA_CONFIG_PATH
const rootDir = process.env.LUPA_ROOT_DIR
const isList = process.env.LUPA_IS_LIST === 'true'
const filters = JSON.parse(process.env.LUPA_FILTERS || '{}')
const filesOnly = process.env.LUPA_FILES_ONLY === 'true'
const searchFiles = process.env.LUPA_SEARCH_FILES ? JSON.parse(process.env.LUPA_SEARCH_FILES) : undefined
const searchTests = process.env.LUPA_SEARCH_TESTS ? JSON.parse(process.env.LUPA_SEARCH_TESTS) : undefined

async function run() {
  if (!configPath || !rootDir) {
    throw new Error('LUPA_CONFIG_PATH and LUPA_ROOT_DIR environment variables are required.')
  }

  const require = createRequire(configPath)
  let runnerPath
  let reportersPath

  try {
    runnerPath = require.resolve('@pawel-up/lupa/runner')
    reportersPath = require.resolve('@pawel-up/lupa/reporters')
  } catch (err: any) {
    throw new Error(
      `Could not resolve @pawel-up/lupa in the target project. Make sure it is installed. (${err.message})`,
      { cause: err }
    )
  }
  const { loadLupaConfig, runProgrammatic, configure } = await import(pathToFileURL(runnerPath).toString())
  const { json } = await import(pathToFileURL(reportersPath).toString())
  const config = await loadLupaConfig(rootDir, configPath)
  if (!config) {
    throw new Error(`Failed to load configuration from ${configPath}`)
  }

  const cliArgs: any = { list: isList }
  if (filters.files) cliArgs.files = filters.files
  if (filters.suites) {
    cliArgs.suites = filters.suites
    cliArgs._ = filters.suites
  }
  if (filters.tags) cliArgs.tags = filters.tags

  if (filesOnly) {
    const runnerDir = path.dirname(runnerPath)
    const configManagerPath = path.join(runnerDir, 'config_manager.js')
    const plannerPath = path.join(runnerDir, 'planner.js')

    const { ConfigManager } = await import(pathToFileURL(configManagerPath).toString())
    const { Planner } = await import(pathToFileURL(plannerPath).toString())

    const hydratedConfig = new ConfigManager(config, cliArgs).hydrate()
    const planner = new Planner(hydratedConfig)
    const plan = await planner.plan()

    const filesSet = new Set<string>()
    for (const suite of plan.suites) {
      for (const fileURL of suite.filesURLs) {
        const filePath = fileURLToPath(fileURL)
        const relativePath = path.relative(rootDir, filePath)
        filesSet.add(relativePath)
      }
    }

    let relativePaths = Array.from(filesSet).sort((a, b) => a.localeCompare(b))
    if (searchFiles && searchFiles.length > 0) {
      const queries = searchFiles.map((q: string) => q.toLowerCase())
      relativePaths = relativePaths.filter((filePath) =>
        queries.some((query: string) => filePath.toLowerCase().includes(query))
      )
    }

    if (process.send) {
      process.send({ type: 'result', data: relativePaths })
    }
    setTimeout(() => process.exit(0), 100)
    return
  }

  const options: any = { list: isList, ...config }
  if (Object.keys(filters).length > 0) {
    options.filters = filters
  }

  configure(options, cliArgs)
  const result = await runProgrammatic(json(), options)

  if (searchTests && searchTests.length > 0) {
    if (result && result.success && result.list) {
      result.list = filterListNode(result.list, searchTests)
    }
  }

  if (process.send) {
    process.send({ type: 'result', data: result })
  }

  // Exit gracefully since Vite or other things might keep the event loop alive
  setTimeout(() => process.exit(0), 100)
}

function filterListNode(listNode: any, queries: string[]) {
  const lowercaseQueries = queries.map((q) => q.toLowerCase())
  const filterTest = (test: any) => {
    return lowercaseQueries.some((query) => test.title.toLowerCase().includes(query))
  }
  const filterGroup = (group: any): any => {
    const matchedTests = group.tests.filter(filterTest)
    const matchedGroups = group.groups.map(filterGroup).filter((g: any) => g !== null)
    if (matchedTests.length > 0 || matchedGroups.length > 0) {
      return {
        ...group,
        tests: matchedTests,
        groups: matchedGroups,
      }
    }
    return null
  }
  const filterSuite = (suite: any): any => {
    const matchedTests = suite.tests.filter(filterTest)
    const matchedGroups = suite.groups.map(filterGroup).filter((g: any) => g !== null)
    if (matchedTests.length > 0 || matchedGroups.length > 0) {
      return {
        ...suite,
        tests: matchedTests,
        groups: matchedGroups,
      }
    }
    return null
  }
  const matchedSuites = listNode.suites.map(filterSuite).filter((s: any) => s !== null)
  return {
    suites: matchedSuites,
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('childScript error:', err)
  if (process.send) {
    process.send({ type: 'error', message: err.message, stack: err.stack })
  }
  process.exit(1)
})
