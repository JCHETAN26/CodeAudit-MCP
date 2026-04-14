#!/usr/bin/env node

/**
 * End-to-end demo test for CodeSentinel MCP Server
 * This is a practical integration test, not a strict protocol test.
 * Run: npm run test:e2e
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { setTimeout as setTimeoutFn } from "timers/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, "../build/index.js");

async function runTests() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     CodeSentinel E2E (End-to-End) Demo Test                ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  let server = null;
  const results = [];

  try {
    // Test 1: Server starts without errors
    {
      console.log("📡 Test 1: Server Startup");
      try {
        server = spawn("node", [serverPath], {
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 5000,
        });

        let hasError = false;
        server.stderr.on("data", (data) => {
          const msg = data.toString();
          if (msg.includes("Fatal") || msg.includes("Error")) {
            hasError = true;
          }
        });

        // Give server time to initialize
        await setTimeoutFn(1000);

        if (server.killed || hasError) {
          console.log(`   ❌ Server crashed or exited unexpectedly`);
          results.push(false);
        } else {
          console.log(`   ✅ Server started successfully (PID: ${server.pid})`);
          results.push(true);
        }
      } catch (error) {
        console.log(`   ❌ ${error.message}`);
        results.push(false);
      }
    }

    // Test 2: Verify build output exists
    {
      console.log("\n📡 Test 2: Build Artifacts");
      try {
        const fs = await import("fs/promises");
        const buildFile = path.join(__dirname, "../build/index.js");
        await fs.access(buildFile);
        console.log(`   ✅ Server build exists at build/index.js`);
        results.push(true);
      } catch (error) {
        console.log(`   ❌ Build artifact not found`);
        results.push(false);
      }
    }

    // Test 3: Check source code compiles
    {
      console.log("\n📡 Test 3: TypeScript Compilation");
      try {
        const { execSync } = await import("child_process");
        execSync("npm run build", {
          cwd: path.join(__dirname, ".."),
          stdio: "pipe",
        });
        console.log(`   ✅ TypeScript compiles successfully`);
        results.push(true);
      } catch (error) {
        console.log(`   ❌ TypeScript compilation failed`);
        results.push(false);
      }
    }

    // Test 4: Check dependencies
    {
      console.log("\n📡 Test 4: Dependencies");
      try {
        const { execSync } = await import("child_process");
        const sdkPath = path.join(__dirname, "../node_modules/@modelcontextprotocol/sdk");
        const fs = await import("fs");
        const exists = fs.existsSync(sdkPath);
        
        if (exists) {
          console.log(`   ✅ MCP SDK installed`);
          results.push(true);
        } else {
          console.log(`   ❌ MCP SDK not found`);
          results.push(false);
        }
      } catch (error) {
        console.log(`   ❌ Dependency check failed`);
        results.push(false);
      }
    }

    // Test 5: Source code integrity
    {
      console.log("\n📡 Test 5: Source Code Integrity");
      try {
        const fs = await import("fs/promises");
        const sourceFile = path.join(__dirname, "../src/index.ts");
        const content = await fs.readFile(sourceFile, "utf-8");
        
        const hasTools = 
          content.includes("security_scan") &&
          content.includes("get_git_diff") &&
          content.includes("analyze_repo_context") &&
          content.includes("validate_suggestion");

        if (hasTools) {
          console.log(`   ✅ All tool implementations present`);
          results.push(true);
        } else {
          console.log(`   ❌ Some tools are missing`);
          results.push(false);
        }
      } catch (error) {
        console.log(`   ❌ Source code check failed`);
        results.push(false);
      }
    }

    // Cleanup
    if (server && !server.killed) {
      server.kill();
      await setTimeoutFn(500);
    }

    // Summary
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    const passed = results.filter((r) => r).length;
    const total = results.length;
    console.log(`║  Results: ${passed}/${total} tests passed${" ".repeat(30 - String(passed).length - String(total).length)}║`);
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    if (passed < total) {
      console.log("⚠️  Some tests failed. Check the output above for details.\n");
    } else {
      console.log("✅ All E2E tests passed! CodeSentinel is ready to use.\n");
    }

    process.exit(passed === total ? 0 : 1);
  } catch (error) {
    console.error("❌ Fatal Error:", error.message);
    if (server && !server.killed) {
      server.kill();
    }
    process.exit(1);
  }
}

runTests();
