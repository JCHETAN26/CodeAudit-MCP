#!/usr/bin/env node

/**
 * CodeSentinel Setup Script
 * Automatically configures Claude Desktop to use CodeSentinel MCP
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);
const buildFile = path.join(projectRoot, 'build', 'index.js');

async function setupClaudeDesktop() {
  console.log('\n🚀 CodeSentinel MCP Setup\n');

  // Determine platform-specific config path
  let configPath;
  const platform = process.platform;

  if (platform === 'darwin') {
    // macOS
    configPath = path.join(
      os.homedir(),
      'Library/Application Support/Claude/claude_desktop_config.json'
    );
  } else if (platform === 'win32') {
    // Windows
    configPath = path.join(
      os.homedir(),
      'AppData/Roaming/Claude/claude_desktop_config.json'
    );
  } else if (platform === 'linux') {
    // Linux
    configPath = path.join(
      os.homedir(),
      '.config/Claude/claude_desktop_config.json'
    );
  } else {
    console.error('❌ Unsupported platform:', platform);
    process.exit(1);
  }

  const configDir = path.dirname(configPath);

  try {
    // Ensure directory exists
    await fs.mkdir(configDir, { recursive: true });

    // Read existing config or create new
    let config = { mcpServers: {} };
    try {
      const existing = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(existing);
    } catch {
      // File doesn't exist, use default
    }

    // Add CodeSentinel config
    config.mcpServers = config.mcpServers || {};
    config.mcpServers.codesentinel = {
      command: 'node',
      args: [buildFile],
    };

    // Write config
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    console.log('✅ Claude Desktop configured!\n');
    console.log('📍 Config location:', configPath);
    console.log('\n📌 Next steps:');
    console.log('   1. Restart Claude Desktop completely (close and reopen)');
    console.log('   2. Start CodeSentinel: codesentinel-mcp start');
    console.log('   3. In Claude, use the review_code tool\n');
    console.log('🎉 Ready to use!\n');
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('\n📋 Manual setup:');
    console.error('Edit:', configPath);
    console.error('Add this to "mcpServers":');
    console.error(JSON.stringify({
      codesentinel: {
        command: 'node',
        args: [buildFile],
      },
    }, null, 2));
    process.exit(1);
  }
}

// Ensure build exists
async function ensureBuild() {
  try {
    await fs.access(buildFile);
  } catch {
    console.log('📦 Building TypeScript...');
    const { execSync } = await import('node:child_process');
    execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });
  }
}

// Run setup
(async () => {
  await ensureBuild();
  await setupClaudeDesktop();
})().catch((error) => {
  console.error('Setup error:', error);
  process.exit(1);
});
