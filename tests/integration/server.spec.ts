import { test, describe, before, after } from 'node:test'
import assert from 'node:assert'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverPath = path.resolve(__dirname, '../../dist/index.js')
const fixturePath = path.resolve(__dirname, '../fixtures/e2e-project/lupa.config.ts')

describe('Lupa MCP Server Integration', () => {
  let client: Client
  let transport: StdioClientTransport

  before(async () => {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverPath],
    })
    client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    )
    await client.connect(transport)
  })

  after(async () => {
    await client.close()
  })

  test('should expose lupa_list_tests and lupa_run_tests tools', async () => {
    const tools = await client.listTools()
    const listTool = tools.tools.find((t) => t.name === 'lupa_list_tests')
    const runTool = tools.tools.find((t) => t.name === 'lupa_run_tests')

    assert.ok(listTool, 'lupa_list_tests tool should exist')
    assert.ok(runTool, 'lupa_run_tests tool should exist')
  })

  test('should return graceful error for invalid configPath', async () => {
    const result = await client.callTool({
      name: 'lupa_list_tests',
      arguments: {
        configPath: '/fake/path/doesnotexist.ts',
      },
    })

    assert.equal(result.isError, true)
    // The content might be inside a text block
    const textContent = (result.content as any)[0].text
    assert.ok(textContent.includes('Configuration file not found') || textContent.includes('Execution failed'))
  })

  test('should execute lupa_list_tests against e2e fixture', async () => {
    const result = await client.callTool({
      name: 'lupa_list_tests',
      arguments: {
        configPath: fixturePath,
      },
    })

    assert.equal(!!result.isError, false, (result.content as any)[0].text)

    // The output should be a JSON string representing the listed suites
    const data = JSON.parse((result.content as any)[0].text)
    assert.ok(data.list.suites, 'Should return suites')
    assert.equal(data.list.suites.length, 1, 'Should have exactly 1 suite')
    assert.equal(data.list.suites[0].name, 'default')
  })

  test('should execute lupa_run_tests against e2e fixture', async () => {
    const result = await client.callTool({
      name: 'lupa_run_tests',
      arguments: {
        configPath: fixturePath,
      },
    })

    assert.equal(!!result.isError, false, (result.content as any)[0].text)

    // The output should be a JSON string with the test results
    const data = JSON.parse((result.content as any)[0].text)
    assert.equal(data.success, false, 'Test suite should fail because the plugin is missing')
    assert.equal(data.summary.failed, 1, 'Should have exactly 1 failed test')
  })
})
