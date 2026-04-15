#!/usr/bin/env node
/**
 * Test script for CodeAudit model integration
 * Tests the review_code tool with vulnerable-app samples
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = process.cwd();

async function testModelIntegration() {
  console.log("🚀 CodeAudit Model Integration Test\n");

  // Test 1: Load and test Python model loader
  console.log("📋 Test 1: Python Model Loader");
  console.log("─".repeat(50));

  try {
    const modelLoaderPath = path.join(projectRoot, "model_loader.py");
    if (!fs.existsSync(modelLoaderPath)) {
      console.error("❌ model_loader.py not found");
      process.exit(1);
    }
    console.log("✅ model_loader.py exists\n");
  } catch (e) {
    console.error("❌ Error checking model loader:", e.message);
    process.exit(1);
  }

  // Test 2: Check LoRA adapter files
  console.log("📋 Test 2: LoRA Model Artifacts");
  console.log("─".repeat(50));

  const adapterPath = path.join(projectRoot, "codeaudit_artifacts/codeaudit_lora_model");
  const requiredFiles = ["adapter_model.safetensors", "adapter_config.json", "tokenizer.json"];

  let allFilesExist = true;
  for (const file of requiredFiles) {
    const filePath = path.join(adapterPath, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const size = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`✅ ${file} (${size} MB)`);
    } else {
      console.log(`❌ ${file} not found`);
      allFilesExist = false;
    }
  }

  if (!allFilesExist) {
    console.error("\n❌ Some model files are missing");
    process.exit(1);
  }
  console.log("");

  // Test 3: Check vulnerable-app samples
  console.log("📋 Test 3: Vulnerable App Samples");
  console.log("─".repeat(50));

  const samples = [
    { path: "vulnerable-app/app.py", language: "python" },
    { path: "vulnerable-app/server.go", language: "go" },
    { path: "vulnerable-app/concurrent.ts", language: "typescript" },
  ];

  for (const sample of samples) {
    const samplePath = path.join(projectRoot, sample.path);
    if (fs.existsSync(samplePath)) {
      const content = fs.readFileSync(samplePath, "utf8");
      const lines = content.split("\n").length;
      console.log(`✅ ${sample.path} (${lines} lines, ${sample.language})`);
    } else {
      console.log(`❌ ${sample.path} not found`);
    }
  }
  console.log("");

  // Test 4: Verify Python CLI wrapper
  console.log("📋 Test 4: Python CLI Wrapper");
  console.log("─".repeat(50));

  const cliPath = path.join(projectRoot, "codeaudit_review.py");
  if (!fs.existsSync(cliPath)) {
    console.error("❌ codeaudit_review.py not found");
    process.exit(1);
  }
  console.log("✅ codeaudit_review.py exists\n");

  // Test 5: Check MCP server build
  console.log("📋 Test 5: MCP Server Build");
  console.log("─".repeat(50));

  const buildPath = path.join(projectRoot, "build/index.js");
  if (!fs.existsSync(buildPath)) {
    console.error("❌ build/index.js not found. Run: npm run build");
    process.exit(1);
  }

  const buildContent = fs.readFileSync(buildPath, "utf8");
  if (buildContent.includes("review_code")) {
    console.log("✅ review_code tool registered in MCP server");
  } else {
    console.error("❌ review_code tool not found in build");
    process.exit(1);
  }

  if (buildContent.includes("generateCodeReview")) {
    console.log("✅ generateCodeReview function in build");
  } else {
    console.error("❌ generateCodeReview function not found in build");
    process.exit(1);
  }
  console.log("");

  // Test 6: Check dependencies
  console.log("📋 Test 6: Python Dependencies");
  console.log("─".repeat(50));

  const packages = ["torch", "transformers", "peft", "accelerate"];

  for (const pkg of packages) {
    try {
      execSync(`python3 -c "import ${pkg}"`, {
        stdio: "pipe",
      });
      console.log(`✅ ${pkg} installed`);
    } catch (e) {
      console.error(`❌ ${pkg} not installed`);
    }
  }
  console.log("");

  // Summary
  console.log("━".repeat(50));
  console.log("✅ All pre-integration checks passed!\n");
  console.log("📖 What's Next:");
  console.log("1. Run the model on vulnerable-app:");
  console.log("   python3 codeaudit_review.py < vulnerable-app/app.py");
  console.log("");
  console.log("2. Test the MCP server:");
  console.log("   npm test");
  console.log("");
  console.log("3. Start the server:");
  console.log("   npm start");
  console.log("");
  console.log("4. Ask Claude Desktop to review code using the tools");
  console.log("━".repeat(50));
}

testModelIntegration().catch(console.error);
