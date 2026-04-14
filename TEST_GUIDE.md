# Testing CodeSentinel

This guide walks you through testing the CodeSentinel MCP server with three progressive test suites.

## Quick Start

```bash
# Run all tests at once
npm test

# Or run tests individually
npm run test:validate    # Quick dependency check
npm run test:tools       # Tool functionality tests
npm run test:e2e         # Full end-to-end server test
```

---

## Test Suites

### 1. **Validation Test** (`npm run test:validate`)

**Purpose:** Quick health check of dependencies and build artifacts.

**What it checks:**
- ✅ Node.js >= 20.0.0
- ✅ Git availability
- ✅ Semgrep availability
- ✅ TypeScript compiled to `build/index.js`
- ✅ npm dependencies installed

**Example output:**
```
🔍 CodeSentinel Dependency Validation

┌─────────────────────────────────────────────────────────────┐
│ ✅ Node.js >= 20.0.0                                        │
│   Found v20.10.0                                            │
│ ✅ Git                                                      │
│   git version 2.43.0                                        │
│ ✅ Semgrep                                                  │
│   1.45.4                                                    │
│ ✅ TypeScript Build (build/index.js)                        │
│   Compiled                                                  │
│ ✅ Dependencies Installed                                   │
│   All modules present                                       │
└─────────────────────────────────────────────────────────────┘

✅ All critical dependencies are available.
```

**When to run:** Before starting any development or to diagnose environment issues.

---

### 2. **Tools Test** (`npm run test:tools`)

**Purpose:** Test each MCP tool directly without spinning up the full server.

**What it tests:**

#### `analyze_repo_context`
- Reads manifest files (package.json, go.mod, Cargo.toml, etc.)
- Infers primary language and framework
- Extracts project constraints from README.md

**Example output:**
```
📦 Testing: analyze_repo_context
────────────────────────────────────────────────────────────
✅ Primary Language: TypeScript/JavaScript
✅ Framework: Unknown
✅ Files Read: package.json, README.md, tsconfig.json
```

#### `get_git_diff`
- Checks if current directory is a git repository
- Extracts diffs between commits
- Validates diff output format

**Example output:**
```
🔄 Testing: get_git_diff
────────────────────────────────────────────────────────────
ℹ️  Testing diff between commits:
   base: abc1234
   head: def5678
✅ Diff generated successfully (127 lines)
```

#### `security_scan`
- Runs `semgrep --config=auto --json` on the repository
- Filters HIGH/CRITICAL findings
- Gracefully handles Semgrep not being installed

**Example output:**
```
🔒 Testing: security_scan
────────────────────────────────────────────────────────────
ℹ️  Semgrep scan completed on current directory
✅ Total issues found: 2
✅ HIGH/CRITICAL issues: 0

   Sample findings:
   • rules.python.best-practice.missing-fstring-syntax at src/utils.py
```

#### `validate_suggestion`
- Tests patch validation logic
- Checks for merge conflict markers
- Detects unbalanced brackets, missing colons
- Validates 3 test cases (valid diff, broken syntax, merge conflicts)

**Example output:**
```
✔️  Testing: validate_suggestion
────────────────────────────────────────────────────────────
✅ Valid Python diff: Pass
✅ Invalid: unbalanced braces: Pass
✅ Invalid: merge conflict markers: Pass
✅ 3/3 validation tests passed
```

**When to run:** When developing or modifying tool implementations.

---

### 3. **End-to-End Test** (`npm run test:e2e`)

**Purpose:** Spawn the full MCP server process and test it with JSON-RPC requests.

**What it tests:**

1. **Server Health Check** — Verify server starts and responds to basic requests
2. **List Tools** — Ensure all four tools are registered:
   - `security_scan`
   - `get_git_diff`
   - `analyze_repo_context`
   - `validate_suggestion`

3. **Tool Invocation** — Call `analyze_repo_context` and verify output structure
4. **Tool Parameters** — Call `validate_suggestion` with actual parameters and verify validation logic works
5. **Prompts** — Verify the `principal_engineer_review` prompt is available

**Example output:**
```
╔════════════════════════════════════════════════════════════╗
║     CodeSentinel E2E (End-to-End) Test Suite              ║
╚════════════════════════════════════════════════════════════╝

🚀 Starting MCP Server...
✅ Server initialized

📡 Test 1: Server Health Check (list_resources)
   ✅ Server responds to resource lists
   Response: {"resources":[...]}

📡 Test 2: List Available Tools (tools/list)
   ✅ Found 4 tool(s): security_scan, get_git_diff, analyze_repo_context
   ✅ Expected tools present

📡 Test 3: Tool Call - analyze_repo_context
   ✅ Tool returned content
   ✅ Repository analysis included

📡 Test 4: Tool Call - validate_suggestion
   ✅ Tool returned validation result
   ✅ Validation logic executed

📡 Test 5: List Available Prompts (prompts/list)
   ✅ Found 1 prompt(s)
   ✅ principal_engineer_review prompt present

╔════════════════════════════════════════════════════════════╗
║  Results: 5/5 tests passed (2847ms)                       ║
╚════════════════════════════════════════════════════════════╝
```

**When to run:** After building changes, before deployment, or when integrating with Claude Desktop.

---

## Complete Test Workflow

```bash
# 1. Install dependencies
npm install

# 2. Build TypeScript
npm run build

# 3. Run validation
npm run test:validate

# 4. If validation passes, test individual tools
npm run test:tools

# 5. If tool tests pass, run full E2E
npm run test:e2e

# Or run everything at once
npm test
```

---

## Troubleshooting

### Test fails: "Semgrep not found"
**Solution:** Install Semgrep via Homebrew:
```bash
brew install semgrep
```

### Test fails: "Not a git repository"
**Solution:** Skip git-dependent tests. The tools will work in non-git directories (no `get_git_diff` functionality).

### Test fails: "TypeScript Build not found"
**Solution:** Rebuild the project:
```bash
npm run build
```

### Test fails: "Node.js version too old"
**Solution:** Upgrade Node.js to >= 20.0.0:
```bash
nvm install 20
nvm use 20
```

### E2E test times out
**Solution:** The MCP server may take longer to start on first run. Ensure the system has sufficient CPU/memory.

---

## Local Development Testing

### I. Interactive Server Testing

Start the server and manually send JSON-RPC requests:

```bash
# Terminal 1: Start the server
npm run dev

# Terminal 2: Send a test request (requires jq for JSON parsing)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | \
  nc localhost 3000 | jq
```

### II. Debugging with Logs

The server writes errors to the system temp directory:

```bash
# Check server error logs
cat /tmp/codesentinel-error.log
```

### III. Test with Claude Desktop Locally

1. Update `claude_desktop_config.json` to point to your local build:
   ```json
   {
     "mcpServers": {
       "codesentinel": {
         "command": "node",
         "args": ["/absolute/path/to/build/index.js"]
       }
     }
   }
   ```

2. Restart Claude Desktop

3. Ask Claude to review code using the tools

---

## CI/CD Integration

To run tests in CI/CD pipelines:

```yaml
# GitHub Actions example
name: Test CodeSentinel
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm run test:validate
      - run: npm run test:tools
      - run: npm run test:e2e
```

---

## Adding Your Own Tests

To extend the test suite, create a new script in `scripts/`:

```javascript
#!/usr/bin/env node
// scripts/my-test.js
console.log("Testing...");
// Your test logic here
process.exit(0); // 0 for pass, 1 for fail
```

Then update `package.json`:
```json
"test:mytests": "node scripts/my-test.js"
```

---

## Quick Reference

| Command | Purpose | Time |
|---------|---------|------|
| `npm run test:validate` | Check dependencies | <1s |
| `npm run test:tools` | Test tools directly | 5-15s |
| `npm run test:e2e` | Full server test | 10-30s |
| `npm test` | All tests | 15-50s |
| `npm run dev` | Start server + rebuild | 2s |

---

Happy testing! 🚀
