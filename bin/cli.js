#!/usr/bin/env node

/**
 * CodeAudit-MCP CLI Entry Point
 * Usage: codeaudit-mcp [command]
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);
const buildFile = path.join(projectRoot, 'build', 'index.js');

const command = process.argv[2];

switch (command) {
  case 'setup':
  case 'install':
    // Run setup
    const setup = spawn('node', [path.join(projectRoot, 'bin', 'setup.js')], {
      stdio: 'inherit',
    });
    setup.on('exit', (code) => process.exit(code));
    break;

  case 'start':
  case undefined:
    // Start the MCP server
    const server = spawn('node', [buildFile], {
      stdio: 'inherit',
    });
    server.on('exit', (code) => process.exit(code));
    break;

  case 'help':
  case '-h':
  case '--help':
    console.log(`
CodeSentinel MCP Server

Usage: codesentinel-mcp [command]

Commands:
  start          Start the MCP server (default)
  setup          Configure Claude Desktop integration
  help           Show this help message

Examples:
  codesentinel-mcp            # Start server
  codesentinel-mcp setup      # Configure for Claude
  codesentinel-mcp help       # Show help

Documentation: https://github.com/chetanshivnani/CodeSentinel-MCP
    `);
    break;

  default:
    console.error(`Unknown command: ${command}`);
    console.error('Run "codesentinel-mcp help" for usage.');
    process.exit(1);
}
