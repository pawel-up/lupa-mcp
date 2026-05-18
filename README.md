# Lupa MCP Server

[![npm version](https://img.shields.io/npm/v/@pawel-up/lupa-mcp.svg)](https://www.npmjs.com/package/@pawel-up/lupa-mcp)

A standalone [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for the **Lupa Testing Framework**.

This server allows AI assistants (like Claude Desktop, Cursor, or Windsurf) to natively understand, run, and analyze your Lupa test suites. By exposing Lupa's programmatic execution API as standardized tools, your AI can automatically run tests, read structured JSON results, and help you fix failing specs.

## Features

- **Native AI Integration:** Exposes `lupa_run_tests` and `lupa_list_tests` to any MCP-compliant client.
- **Robust Sandboxing:** Runs tests in ephemeral, isolated child processes. This guarantees zero memory leaks in long-running IDE sessions and prevents test output from corrupting the MCP JSON-RPC protocol.
- **Dynamic Resolution:** Automatically locates and uses the specific `@pawel-up/lupa` version installed in your target project.

## Usage

You don't need to install this inside your project. Instead, configure your MCP client (IDE or AI assistant) to use `npx` to spawn the server globally.

### Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lupa": {
      "command": "npx",
      "args": ["-y", "@pawel-up/lupa-mcp"]
    }
  }
}
```

### Cursor / Windsurf

In your IDE settings for MCP Servers, add a new server:

- **Type:** `command` (or `stdio`)
- **Command:** `npx -y @pawel-up/lupa-mcp`

Once connected, simply ask your AI:

> _"Run my Lupa tests and tell me why they are failing."_

## Available Tools

The server provides the following tools to the AI:

### `lupa_run_tests`

Executes Lupa tests and returns structured JSON results. The AI uses this to identify failing tests and read error stacks.

- **Arguments:**
  - `configPath` (required): Absolute path to the `lupa.config.ts` file in the target project.
  - `files`, `suites`, `tags`, `tests` (optional): Standard Lupa filters.

### `lupa_list_tests`

Lists all available test files, suites, and tests without actually executing them. Useful for the AI to discover what tests exist in the project.

- **Arguments:** Same as `lupa_run_tests`.

## Development

If you are developing or modifying the MCP server itself:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run the server locally (using the compiled dist/index.js)
node dist/index.js
```
