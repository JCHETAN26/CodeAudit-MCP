#!/usr/bin/env node

/**
 * CodeAudit-MCP Setup Script
 * Configures Claude Desktop to use CodeAudit-MCP via npx.
 * Run manually: npx codeaudit-mcp setup
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const MCP_SERVER_ENTRY = {
  command: 'npx',
  args: ['-y', 'codeaudit-mcp'],
};

async function setupClaudeDesktop() {
  console.log('\nCodeAudit-MCP Setup\n');

  let configPath;
  const platform = process.platform;

  if (platform === 'darwin') {
    configPath = path.join(
      os.homedir(),
      'Library/Application Support/Claude/claude_desktop_config.json'
    );
  } else if (platform === 'win32') {
    configPath = path.join(
      os.homedir(),
      'AppData/Roaming/Claude/claude_desktop_config.json'
    );
  } else if (platform === 'linux') {
    configPath = path.join(
      os.homedir(),
      '.config/Claude/claude_desktop_config.json'
    );
  } else {
    console.error('Unsupported platform:', platform);
    process.exit(1);
  }

  const configDir = path.dirname(configPath);

  try {
    await fs.mkdir(configDir, { recursive: true });

    let config = { mcpServers: {} };
    try {
      const existing = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(existing);
    } catch {
      // Config doesn't exist yet; start fresh.
    }

    config.mcpServers = config.mcpServers || {};
    config.mcpServers['codeaudit-mcp'] = MCP_SERVER_ENTRY;

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    console.log('Claude Desktop configured.');
    console.log('Config location:', configPath);
    console.log('\nNext steps:');
    console.log('  1. Restart Claude Desktop completely (quit and reopen).');
    console.log('  2. In Claude, the following tools are now available:');
    console.log('       get_git_diff, security_scan, analyze_repo_context, validate_suggestion\n');
  } catch (error) {
    console.error('Setup failed:', error.message);
    console.error('\nManual setup — edit:', configPath);
    console.error('Add this entry under "mcpServers":');
    console.error(JSON.stringify({ 'codeaudit-mcp': MCP_SERVER_ENTRY }, null, 2));
    process.exit(1);
  }
}

setupClaudeDesktop().catch((error) => {
  console.error('Setup error:', error);
  process.exit(1);
});
