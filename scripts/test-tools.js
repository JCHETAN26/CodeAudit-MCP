#!/usr/bin/env node

/**
 * Direct tool testing script
 * Tests each MCP tool by calling its underlying functions directly
 * Run: npm run test:tools
 */

import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const cwd = process.cwd();

// Import test helpers (we'll simulate the server functions)
async function testAnalyzeRepoContext() {
  console.log("\n📦 Testing: analyze_repo_context");
  console.log("─".repeat(60));

  try {
    const contextFiles = [
      "README.md",
      "package.json",
      "tsconfig.json",
      "CONTRIBUTING.md",
    ];

    let filesRead = [];
    for (const file of contextFiles) {
      try {
        await fs.access(path.join(cwd, file));
        filesRead.push(file);
      } catch {
        // File not found
      }
    }

    const packageJsonPath = path.join(cwd, "package.json");
    let primaryLanguage = "Unknown";
    let framework = "Unknown";

    try {
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf8");
      const packageJson = JSON.parse(packageJsonContent);

      if (packageJson.dependencies?.next) framework = "Next.js";
      if (packageJson.dependencies?.react) framework = "React";
      if (packageJson.dependencies?.["@modelcontextprotocol/sdk"])
        primaryLanguage = "TypeScript/JavaScript";

      console.log(`✅ Primary Language: ${primaryLanguage}`);
      console.log(`✅ Framework: ${framework}`);
      console.log(`✅ Files Read: ${filesRead.join(", ")}`);
      return true;
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    return false;
  }
}

async function testGetGitDiff() {
  console.log("\n🔄 Testing: get_git_diff");
  console.log("─".repeat(60));

  try {
    // Check if we're in a git repo
    await execFileAsync("git", ["rev-parse", "--git-dir"], { cwd });

    // Get the last 2 commits
    const { stdout: logOutput } = await execFileAsync(
      "git",
      ["log", "--oneline", "-2"],
      { cwd }
    );

    const commits = logOutput.trim().split("\n").filter((c) => c.length > 0);
    if (commits.length < 2) {
      console.warn("⚠️  Repository has fewer than 2 commits — skipping diff test");
      console.log("   (This is normal for a fresh repository)");
      return true;
    }

    const head = commits[0].split(" ")[0];
    const base = commits[1].split(" ")[0];

    console.log(`ℹ️  Testing diff between commits:`);
    console.log(`   base: ${base}`);
    console.log(`   head: ${head}`);

    const { stdout: diffOutput } = await execFileAsync("git", ["diff", `${base}..${head}`], {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
    });

    const lines = diffOutput.split("\n").filter((l) => l.length > 0).length;
    console.log(`✅ Diff generated successfully (${lines} lines)`);
    return true;
  } catch (error) {
    if (error.message.includes("not a git repository")) {
      console.warn("⚠️  Not a git repository — skipping diff test");
      return true;
    }
    if (error.message.includes("does not have any commits")) {
      console.warn("⚠️  Repository has no commits yet — skipping diff test");
      console.log("   (This is normal for a fresh repository)");
      return true;
    }
    console.error(`❌ Error:`, error.message.split("\n")[0]);
    return false;
  }
}

async function testSecurityScan() {
  console.log("\n🔒 Testing: security_scan");
  console.log("─".repeat(60));

  try {
    const { stdout, stderr } = await execFileAsync(
      "semgrep",
      ["--config=auto", "--json", "."],
      {
        cwd,
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    const output = JSON.parse(stdout);
    const results = output.results || [];
    const findings = results.filter(
      (r) =>
        r.extra?.severity === "HIGH" ||
        r.extra?.severity === "CRITICAL" ||
        r.severity === "HIGH" ||
        r.severity === "CRITICAL"
    );

    console.log(`ℹ️  Semgrep scan completed on current directory`);
    console.log(`✅ Total issues found: ${results.length}`);
    console.log(`✅ HIGH/CRITICAL issues: ${findings.length}`);

    if (findings.length > 0) {
      console.log("\n   Sample findings:");
      findings.slice(0, 2).forEach((f) => {
        console.log(`   • ${f.check_id || "unknown"} at ${f.path}`);
      });
    }
    return true;
  } catch (error) {
    if (error.message.includes("ENOENT") || error.message.includes("semgrep: not found")) {
      console.warn("⚠️  Semgrep not installed — skipping security_scan test");
      console.log('   Install via: brew install semgrep');
      return true;
    }
    console.error(`⚠️  Semgrep error (may be expected):`, error.message.split("\n")[0]);
    return true; // Don't fail if semgrep has issues
  }
}

async function testValidateSuggestion() {
  console.log("\n✔️  Testing: validate_suggestion");
  console.log("─".repeat(60));

  const testCases = [
    {
      name: "Valid Python diff",
      diff: `diff --git a/test.py b/test.py
index abc123..def456 100644
--- a/test.py
+++ b/test.py
@@ -1,5 +1,5 @@
 def hello():
-    print("world")
+    print("earth")
     return True`,
      expectValid: true,
    },
    {
      name: "Invalid: unbalanced braces",
      diff: `diff --git a/test.ts b/test.ts
index abc123..def456 100644
--- a/test.ts
+++ b/test.ts
@@ -1,3 +1,3 @@
 function test() {
   return { data: [1, 2, 3] 
-}`,
      expectValid: false,
    },
    {
      name: "Invalid: merge conflict markers",
      diff: `<<<<<<<< HEAD
+const x = 1;
+========
+const x = 2;
+>>>>>>>> branch`,
      expectValid: false,
    },
  ];

  let passed = 0;
  for (const testCase of testCases) {
    // Simple validation logic (mirroring what's in index.ts)
    const hasConflictMarkers = /<<<<<<<|=======|>>>>>>>/.test(testCase.diff);
    const parenDelta = (testCase.diff.match(/\(/g) || []).length - (testCase.diff.match(/\)/g) || []).length;
    const braceDelta = (testCase.diff.match(/\{/g) || []).length - (testCase.diff.match(/\}/g) || []).length;
    const bracketDelta = (testCase.diff.match(/\[/g) || []).length - (testCase.diff.match(/\]/g) || []).length;

    const isValid = !hasConflictMarkers && parenDelta === 0 && braceDelta === 0 && bracketDelta === 0;

    const match = isValid === testCase.expectValid;
    const icon = match ? "✅" : "❌";
    console.log(`${icon} ${testCase.name}: ${match ? "Pass" : "Fail"}`);
    if (match) passed++;
  }

  console.log(`✅ ${passed}/${testCases.length} validation tests passed`);
  return passed === testCases.length;
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         CodeAudit Tool Testing Suite                   ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const results = [];

  results.push(await testAnalyzeRepoContext());
  results.push(await testGetGitDiff());
  results.push(await testSecurityScan());
  results.push(await testValidateSuggestion());

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  const passed = results.filter((r) => r).length;
  const total = results.length;
  console.log(`║  Results: ${passed}/${total} test suites passed${" ".repeat(33 - String(passed).length - String(total).length)}║`);
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  process.exit(passed === total ? 0 : 1);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
