#!/usr/bin/env node

/**
 * Quick validation script to check if all required dependencies are available
 * Run: npm run test:validate
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const checks = [];

console.log("🔍 CodeAudit Dependency Validation\n");

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);
const nodeOk = majorVersion >= 20;
checks.push({
  name: "Node.js >= 20.0.0",
  status: nodeOk,
  detail: `Found ${nodeVersion}`,
});

// Check if git is available
let gitOk = false;
try {
  execSync("git --version", { stdio: "pipe" });
  gitOk = true;
  checks.push({
    name: "Git",
    status: true,
    detail: execSync("git --version", { stdio: "pipe" }).toString().trim(),
  });
} catch {
  checks.push({
    name: "Git",
    status: false,
    detail: "Not found in $PATH",
  });
}

// Check if semgrep is available
let semgrepOk = false;
try {
  execSync("semgrep --version", { stdio: "pipe" });
  semgrepOk = true;
  checks.push({
    name: "Semgrep",
    status: true,
    detail: execSync("semgrep --version", { stdio: "pipe" }).toString().trim(),
  });
} catch {
  checks.push({
    name: "Semgrep",
    status: false,
    detail: "Not found in $PATH (install: brew install semgrep)",
  });
}

// Check if TypeScript compiled
const buildDir = path.join(process.cwd(), "build");
const buildExists = fs.existsSync(buildDir) && fs.existsSync(path.join(buildDir, "index.js"));
checks.push({
  name: "TypeScript Build (build/index.js)",
  status: buildExists,
  detail: buildExists ? "Compiled" : "Run: npm run build",
});

// Check node_modules
const nodeModulesOk = fs.existsSync(path.join(process.cwd(), "node_modules", "@modelcontextprotocol"));
checks.push({
  name: "Dependencies Installed",
  status: nodeModulesOk,
  detail: nodeModulesOk ? "All modules present" : "Run: npm install",
});

// Print results
console.log("┌─────────────────────────────────────────────────────────────┐");
checks.forEach((check) => {
  const icon = check.status ? "✅" : "❌";
  console.log(`│ ${icon} ${check.name.padEnd(40)} │`);
  console.log(`│   ${check.detail.padEnd(53)} │`);
});
console.log("└─────────────────────────────────────────────────────────────┘\n");

// Summary
const allOk = checks.every((c) => c.status);
const criticalOk = checks
  .filter((c) => ["Node.js >= 20.0.0", "TypeScript Build (build/index.js)", "Dependencies Installed"].includes(c.name))
  .every((c) => c.status);

if (criticalOk) {
  console.log("✅ All critical dependencies are available.");
  if (!gitOk) {
    console.log("⚠️  Git not found — some tests will be skipped.");
  }
  if (!semgrepOk) {
    console.log("⚠️  Semgrep not found — security scanning will not work.");
    console.log('   Install via: brew install semgrep\n');
  }
  process.exit(0);
} else {
  console.log("❌ Some critical dependencies are missing.");
  console.log("Please fix the above issues and try again.\n");
  process.exit(1);
}
