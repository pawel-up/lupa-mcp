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

  test('should expose lupa_list_tests, lupa_run_tests, and lupa_init tools', async () => {
    const tools = await client.listTools()
    const listTool = tools.tools.find((t) => t.name === 'lupa_list_tests')
    const runTool = tools.tools.find((t) => t.name === 'lupa_run_tests')
    const initTool = tools.tools.find((t) => t.name === 'lupa_init')

    assert.ok(listTool, 'lupa_list_tests tool should exist')
    assert.ok(runTool, 'lupa_run_tests tool should exist')
    assert.ok(initTool, 'lupa_init tool should exist')
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

  test('should execute lupa_init and create default scaffolding', async () => {
    const fs = await import('node:fs')
    const os = await import('node:os')
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lupa-init-test-'))

    // Create a dummy package.json so npx executes properly in this folder
    // and correctly attempts to invoke the local package.
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-init' }))

    const result = await client.callTool({
      name: 'lupa_init',
      arguments: {
        projectPath: tmpDir,
        useTypeScript: true,
      },
    })

    assert.equal(!!result.isError, false, (result.content as any)[0].text)

    // Check if expected files were created
    assert.ok(fs.existsSync(path.join(tmpDir, 'lupa.config.ts')), 'lupa.config.ts should be created')
    assert.ok(fs.existsSync(path.join(tmpDir, 'tests')), 'tests directory should be created')

    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('should execute lupa_list_test_files and return resolved files list', async () => {
    const result = await client.callTool({
      name: 'lupa_list_test_files',
      arguments: {
        configPath: fixturePath,
      },
    })

    assert.equal(!!result.isError, false, (result.content as any)[0].text)
    const files = JSON.parse((result.content as any)[0].text)
    assert.deepEqual(files, ['tests/dummy.spec.ts'])
  })

  test('should filter test files by path using searchFiles', async () => {
    // Matching case
    const matchedResult = await client.callTool({
      name: 'lupa_list_test_files',
      arguments: {
        configPath: fixturePath,
        searchFiles: ['dummy'],
      },
    })
    assert.equal(!!matchedResult.isError, false, (matchedResult.content as any)[0].text)
    assert.deepEqual(JSON.parse((matchedResult.content as any)[0].text), ['tests/dummy.spec.ts'])

    // Non-matching case
    const unmatchedResult = await client.callTool({
      name: 'lupa_list_test_files',
      arguments: {
        configPath: fixturePath,
        searchFiles: ['auth'],
      },
    })
    assert.equal(!!unmatchedResult.isError, false, (unmatchedResult.content as any)[0].text)
    assert.deepEqual(JSON.parse((unmatchedResult.content as any)[0].text), [])
  })

  test('should filter tests by title using searchTests in lupa_list_tests', async () => {
    // Matching case
    const matchedResult = await client.callTool({
      name: 'lupa_list_tests',
      arguments: {
        configPath: fixturePath,
        searchTests: ['dummy'],
      },
    })
    assert.equal(!!matchedResult.isError, false, (matchedResult.content as any)[0].text)
    const matchedData = JSON.parse((matchedResult.content as any)[0].text)
    assert.ok(matchedData.list.suites, 'Should return suites')
    assert.equal(matchedData.list.suites.length, 1)
    assert.equal(matchedData.list.suites[0].tests.length, 1)
    assert.equal(matchedData.list.suites[0].tests[0].title, 'dummy test')

    // Non-matching case
    const unmatchedResult = await client.callTool({
      name: 'lupa_list_tests',
      arguments: {
        configPath: fixturePath,
        searchTests: ['should login'],
      },
    })
    assert.equal(!!unmatchedResult.isError, false, (unmatchedResult.content as any)[0].text)
    const unmatchedData = JSON.parse((unmatchedResult.content as any)[0].text)
    assert.ok(unmatchedData.list.suites)
    assert.equal(unmatchedData.list.suites.length, 0)
  })
})
