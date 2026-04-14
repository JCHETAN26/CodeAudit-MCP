# CodeSentinel MCP Deployment Guide

These instructions cover how to deploy CodeSentinel MCP locally across different development clients to leverage the "Principal Engineer" review persona.

## Prerequisites
Ensure the server is compiled:
```bash
npm install
npm run build
```

## 1. Claude Desktop
Claude Desktop supports MCP servers locally via configuration.

1. Open your Claude Desktop configuration file. The file is usually located at:
   - **MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
2. Add the CodeSentinel MCP server configuration:
```json
{
  "mcpServers": {
    "codesentinel": {
      "command": "node",
      "args": [
        "/absolute/path/to/Code-Review-Agent-MCP/build/index.js"
      ]
    }
  }
}
```
3. Restart Claude Desktop. The tools (`get_git_diff`, `analyze_repo_context`, `security_scan`, `validate_suggestion`) will now be available in your side panel.

## 2. Cursor (Experimental MCP Support)
Cursor IDE allows directly connecting to MCP servers.

1. Open Cursor Settings (`Cmd/Ctrl` + `,`).
2. Navigate to **Features** -> **MCP Servers**.
3. Add a new server with the following details:
   - **Name**: `CodeSentinel`
   - **Type**: `stdio`
   - **Command**: `node /absolute/path/to/Code-Review-Agent-MCP/build/index.js`
4. Enable the server. Cursor's AI Composer will now be able to query the server contextually while you type or request code reviews, natively injecting the README/CONTRIBUTING guidelines and avoiding syntactical errors!
