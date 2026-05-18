#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import path from 'node:path'
import fs from 'node:fs'
import spawn from 'cross-spawn'

const server = new McpServer({ name: 'lupa-mcp', version: '1.0.0' })

interface LupaArgs {
  configPath: string
  files?: string[]
  suites?: string[]
  tags?: string[]
  tests?: string[]
}
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const runnerScriptPath = path.join(__dirname, 'lupa-runner.js')

async function executeLupa(args: LupaArgs, isList: boolean) {
  const { configPath, files, suites, tags, tests } = args

  try {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`)
    }

    const rootDir = path.dirname(configPath)

    const filters: any = {}
    if (files && files.length > 0) filters.files = files
    if (suites && suites.length > 0) filters.suites = suites
    if (tags && tags.length > 0) filters.tags = tags
    if (tests && tests.length > 0) filters.tests = tests

    return await new Promise<any>((resolve) => {
      const child = spawn(process.execPath, [runnerScriptPath], {
        cwd: rootDir,
        env: {
          ...process.env,
          LUPA_CONFIG_PATH: configPath,
          LUPA_ROOT_DIR: rootDir,
          LUPA_IS_LIST: String(isList),
          LUPA_FILTERS: JSON.stringify(filters),
        },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      })

      let handled = false
      let stderrOutput = ''

      child.stderr?.on('data', (data) => {
        stderrOutput += data.toString()
      })

      let stdoutOutput = ''
      child.stdout?.on('data', (data) => {
        stdoutOutput += data.toString()
      })

      child.on('message', (msg: any) => {
        if (handled) return
        handled = true

        if (msg.type === 'result') {
          resolve({
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(msg.data),
              },
            ],
          })
        } else if (msg.type === 'error') {
          resolve({
            content: [
              {
                type: 'text' as const,
                text: `Execution failed: ${msg.message}\n${msg.stack}`,
              },
            ],
            isError: true,
          })
        }
      })

      child.on('error', (err: Error) => {
        if (handled) return
        handled = true
        resolve({
          content: [
            {
              type: 'text' as const,
              text: `Failed to spawn test process: ${err.message}`,
            },
          ],
          isError: true,
        })
      })

      child.on('exit', (code: number | null) => {
        if (handled) return
        handled = true
        resolve({
          content: [
            {
              type: 'text' as const,
              text: `Test process exited unexpectedly with code ${code}.\nStdout: ${stdoutOutput}\nStderr: ${stderrOutput}`,
            },
          ],
          isError: code !== 0,
        })
      })
    })
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Execution failed: ${error.message}\n${error.stack}`,
        },
      ],
      isError: true,
    }
  }
}

const commonSchema = {
  configPath: z.string().describe('Absolute path to the lupa.config.ts file in the target project'),
  files: z.array(z.string()).optional().describe('Filter tests by file name'),
  suites: z.array(z.string()).optional().describe('Filter tests by suite/group name'),
  tags: z.array(z.string()).optional().describe('Filter tests by tag'),
}

server.registerTool(
  'lupa_run_tests',
  {
    description: 'Run Lupa tests and return structured JSON results. Use this to identify failing tests.',
    inputSchema: {
      ...commonSchema,
      tests: z.array(z.string()).optional().describe('Filter tests by test title'),
    },
  },
  async (args) => executeLupa(args as any, false)
)

server.registerTool(
  'lupa_list_tests',
  {
    description: 'List all available test files, suites, and tests without running them. Optionally filter the list.',
    inputSchema: commonSchema,
  },
  async (args) => executeLupa(args as any, true)
)

async function start() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error:', err)
  process.exit(1)
})
