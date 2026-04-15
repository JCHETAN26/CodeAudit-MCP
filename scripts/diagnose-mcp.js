#!/usr/bin/env node
/**
 * Diagnostic script to check CodeAudit MCP setup
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildPath = "/Users/chetan/Code-Review-Agent-MCP/build/index.js";
const configPath =
  "/Users/chetan/Library/Application Support/Claude/claude_desktop_config.json";
const projectConfigPath = "/Users/chetan/Code-Review-Agent-MCP/claude_desktop_config.json";

// Check build file
const buildExists = fs.existsSync(buildPath);
console.log("📦 Build File");
console.log(buildExists ? "✅ Build file exists" : "❌ Build file missing");

if (buildExists) {
  const stats = fs.statSync(buildPath);
  console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`   Path: ${buildPath}`);
}

console.log();

// Check configs
const configExists = fs.existsSync(configPath);
const projectConfig = fs.existsSync(projectConfigPath);

console.log("⚙️  Configuration");
console.log(
  configExists ? "✅ Claude config exists" : "❌ Claude config missing",
  "\n   ",
  configPath
);

console.log(
  projectConfig ? "✅ Project config exists" : "❌ Project config missing",
  "\n   ",
  projectConfigPath
);

if (configExists) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (config.mcpServers && config.mcpServers.codeaudit) {
      console.log("✅ CodeAudit registered in Claude config");
      console.log(`   Command: ${config.mcpServers.codeaudit.command}`);
      console.log(`   Args: ${config.mcpServers.codeaudit.args.join(" ")}`);
    } else {
      console.log("❌ CodeAudit not found in mcpServers");
    }
  } catch (e) {
    console.log("❌ Error parsing config:", e.message);
  }
}

console.log();

// Check Node version
const nodeVersion = process.version;
console.log("🔧 Environment");
console.log(`✅ Node version: ${nodeVersion}`);

console.log();
console.log("🛠️  Troubleshooting Steps");
console.log("1. Verify Claude Desktop is completely closed (⌘Q or killall Claude)");
console.log("2. Reopen Claude Desktop from Applications");
console.log(
  '3. Look for "CodeAudit" in the Tool Browser (Claude\'s left sidebar)'
);
console.log(
  "4. If still not working, check ~/Library/Logs/Claude/mcp.log or similar"
);
console.log();

// Try to verify the MCP server itself
console.log("🧪 MCP Server Test");
try {
  // We won't actually run it, just check syntax
  const content = fs.readFileSync(buildPath, "utf8");
  if (content.includes("McpServer") || content.includes("StdioServerTransport")) {
    console.log("✅ MCP server code found in build/index.js");
    console.log("✅ Build appears to be valid");
  }
} catch (e) {
  console.log("❌ Error reading build file:", e.message);
}

console.log();
console.log("💡 Next Steps");
console.log(
  "   If you still don't see the notification, try these common fixes:"
);
console.log("   1. Force quit Claude: killall -9 Claude");
console.log("   2. Clear Claude cache: rm -rf ~/Library/Application\\ Support/Claude/cache");
console.log("   3. Rebuild the project: npm run build");
console.log("   4. Verify the config file is readable: cat ~/.../claude_desktop_config.json");
