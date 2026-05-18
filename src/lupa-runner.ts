import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const configPath = process.env.LUPA_CONFIG_PATH
const rootDir = process.env.LUPA_ROOT_DIR
const isList = process.env.LUPA_IS_LIST === 'true'
const filters = JSON.parse(process.env.LUPA_FILTERS || '{}')

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
  const options: any = { list: isList, ...config }
  if (Object.keys(filters).length > 0) {
    options.filters = filters
  }

  configure(options)
  const result = await runProgrammatic(json(), options)
  if (process.send) {
    process.send({ type: 'result', data: result })
  }

  // Exit gracefully since Vite or other things might keep the event loop alive
  setTimeout(() => process.exit(0), 100)
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('childScript error:', err)
  if (process.send) {
    process.send({ type: 'error', message: err.message, stack: err.stack })
  }
  process.exit(1)
})
