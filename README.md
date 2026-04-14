# CodeAudit-MCP

**Production-grade MCP server for polyglot AI code review powered by Semgrep.**

CodeAudit-MCP is a Model Context Protocol (MCP) server that brings Principal Engineer-level code review capabilities to Claude. It analyzes code for security vulnerabilities, distributed system failures, race conditions, resource leaks, and scalability issues—focusing on real-world runtime problems rather than style conventions.

## Overview

CodeAudit-MCP enforces a structured review methodology inspired by senior software engineering practices:

1. **Perception** — Understand repository context, language, framework, and project constraints
2. **Change Analysis** — Extract the exact git diff and identify blast radius
3. **Security Ground Truth** — Run Semgrep `--config=auto` for HIGH/CRITICAL findings
4. **Synthesis** — Merge findings, prioritizing security → correctness → reliability → performance → observability
5. **Validation** — Lint all proposed patches before delivery

Every review is structured as: **[Issue] → [Impact] → [Fix (Code Diff)]**, ensuring precise, actionable feedback with production-ready code patches.

## Key Features

- **Polyglot Support** — TypeScript/JavaScript, Python, Go, Rust, Java, and more
- **Framework Awareness** — Detects Next.js, React, NestJS, FastAPI, Django, Spring Boot, etc.
- **Deployment Context** — Understands serverless, long-running services, CLIs, and libraries
- **Security-First** — Integrates Semgrep for vulnerability detection
- **Project Constraints** — Extracts and respects explicit CONTRIBUTING.md and README.md guidelines
- **Validation Layer** — Detects merge conflicts, unbalanced brackets, Python colon issues, and language-specific problems
- **Claude Desktop Ready** — Plug-and-play integration with included configuration

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Claude Desktop                         │
└────────────────────────┬────────────────────────────────────┘
                         │ (MCP Protocol)
┌────────────────────────▼────────────────────────────────────┐
│  CodeAudit-MCP Server (Node.js + TypeScript)             │
├─────────────────────────────────────────────────────────────┤
│  Tools:                                                      │
│  • analyze_repo_context   → Reads manifests, infers config  │
│  • get_git_diff          → Extracts exact changes           │
│  • security_scan         → Runs Semgrep (HIGH/CRITICAL)     │
│  • validate_suggestion   → Lints proposed patches           │
│  • principal_engineer_review → Provides system instructions │
├─────────────────────────────────────────────────────────────┤
│  External Dependencies:                                      │
│  • Git (for diff extraction)                                │
│  • Semgrep (for security scanning)                          │
└─────────────────────────────────────────────────────────────┘
```

## Installation

### Prerequisites
- **Node.js** ≥ 20.0.0
- **Git** (for repository analysis)
- **Semgrep** (for security scanning) — install via `brew install semgrep` or [semgrep.dev](https://semgrep.dev)

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/codesentinel-mcp.git
cd codesentinel-mcp

# Install dependencies
npm install

# Build the TypeScript server
npm run build

# Verify Semgrep is available
semgrep --version
```

### Claude Desktop Integration

1. Locate your Claude Desktop config:
   - **macOS/Linux**: `~/.config/Claude/claude_desktop_config.json`
   - **Windows**: `%AppData%\Claude\claude_desktop_config.json`

2. Add the CodeSentinel server:
   ```json
   {
     "mcpServers": {
       "codesentinel": {
         "command": "node",
         "args": ["/path/to/codesentinel-mcp/build/index.js"]
       }
     }
   }
   ```
   Replace `/path/to/codesentinel-mcp` with the absolute path to your cloned repository.

3. Restart Claude Desktop.

## Usage

Once integrated, CodeSentinel is available to Claude as a set of tools. Example workflows:

### Review a Pull Request

```
User: Review the changes between main and feature/auth-refactor for security and reliability.

Claude: [Uses get_git_diff to extract exact changes]
        [Uses analyze_repo_context to understand Next.js + PostgreSQL deployment]
        [Uses security_scan to run Semgrep against modified files]
        [Synthesizes findings into structured report with fixes]
```

### Analyze Repository Context

```
User: What language and framework is this repository using?

Claude: [Uses analyze_repo_context]
        → TypeScript/JavaScript
        → Framework: Next.js
        → Deployment: Serverless / FaaS
        → Detected project constraints from README.md
```

### Validate a Code Patch

```
User: Is this patch syntactically correct?

Claude: [Uses validate_suggestion]
        → Detects merge conflicts, bracket imbalance, language-specific errors
        → Returns detailed warnings or confirmation
```

## Tools Reference

### `analyze_repo_context`
**Description:** Read key repository files and infer primary language, framework, and deployment model.

**Inputs:** None (operates on current working directory)

**Output:**
```json
{
  "primaryLanguage": "TypeScript/JavaScript",
  "framework": "Next.js",
  "deploymentModel": "Serverless / FaaS",
  "projectConstraints": ["must use repository layer for DB access", "no external HTTP calls in Lambda"],
  "summary": "...",
  "signals": ["Detected package.json...", "Framework hint: next dependency detected"],
  "filesRead": ["package.json", "README.md", "CONTRIBUTING.md"]
}
```

### `get_git_diff`
**Description:** Return the raw unified diff between two git refs.

**Inputs:**
- `base` (string, required) — Base git ref (e.g., `main`, `origin/main`)
- `head` (string, required) — Head git ref (e.g., `feature/your-branch`)

**Output:** Raw unified diff or error message.

### `security_scan`
**Description:** Run Semgrep against a repository path and return only HIGH/CRITICAL findings.

**Inputs:**
- `path` (string, optional, default: `.`) — Target directory to scan

**Output:**
```json
{
  "systemInstruction": "You are a Principal Engineer...",
  "findingCount": 2,
  "findings": [
    {
      "checkId": "rules.python.django.security.injection.sql-injection",
      "path": "src/models.py",
      "line": 42,
      "severity": "CRITICAL",
      "message": "SQL string concatenation detected..."
    }
  ]
}
```

### `validate_suggestion`
**Description:** Perform lightweight validation on an AI-proposed patch.

**Inputs:**
- `diff` (string, required) — The proposed unified diff
- `language` (string, optional) — Programming language hint (e.g., `python`, `typescript`, `go`)

**Output:**
```json
{
  "valid": false,
  "warnings": ["Unbalanced curly braces detected.", "Python-looking control flow may be missing trailing colons."],
  "inferredLanguage": "Python"
}
```

### `principal_engineer_review` (Prompt)
**Description:** Returns the hardcoded system instructions and review persona.

**Output:** The complete Principal Engineer review methodology.

## Review Severity Levels

CodeSentinel reports findings at these severity levels:

- **CRITICAL** — Causes immediate production outage, security breach, or data loss
- **HIGH** — Likely production failure under stress, clear security vulnerability, or significant resource leak
- **MEDIUM** — Will cause issues under specific conditions; should be addressed before release
- **LOW** — Minor issue; affects maintainability or local development

## Finding Structure

Every finding uses this format:

```
### Finding N — [SEVERITY: CRITICAL | HIGH | MEDIUM | LOW]

**[Issue]**
Precise technical description. Name the exact function, line, or pattern.

**[Impact]**
Concrete business or system consequence. Quantify where possible.

**[Fix (Code Diff)]**
Production-ready unified diff with exact line changes.
```

Example:

```
### Finding 1 — SEVERITY: CRITICAL

**[Issue]**
`getUserById` in `src/db/users.ts:42` interpolates `userId` directly into a raw SQL string.

**[Impact]**
SQL injection vulnerability. Any caller can dump, modify, or drop the entire `users` table.

**[Fix (Code Diff)]**
```diff
- const row = await db.query(`SELECT * FROM users WHERE id = ${userId}`);
+ const row = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
```
```

## Configuration

### Environment Variables

- **`SEMGREP_TIMEOUT_MS`** (default: `120000`) — Timeout for Semgrep scan in milliseconds
- **`EXEC_MAX_BUFFER`** (default: `10485760`/10MB) — Max output buffer for subprocess execution

### System Instruction

The Principal Engineer persona is defined in [src/index.ts](src/index.ts#L14) and can be customized by editing the `SYSTEM_INSTRUCTION` constant.

## Development

### Project Structure

```
.
├── src/
│   └── index.ts              # MCP server implementation
├── build/
│   └── index.js              # Compiled JavaScript (generated)
├── package.json              # Node.js dependencies
├── tsconfig.json             # TypeScript configuration
├── DEPLOYMENT.md             # Deployment guides
├── systemprompt.md           # Detailed review methodology
└── README.md                 # This file
```

#### Build

```bash
npm run build
```

### Run Locally

```bash
npm run start
```

### Development Mode (watch + rebuild)

```bash
npm run dev
```

## Testing

CodeSentinel includes three levels of testing:

```bash
# Quick dependency check
npm run test:validate

# Test individual tools
npm run test:tools

# Full end-to-end integration test
npm run test:e2e

# Run all tests
npm test
```

See [TEST_GUIDE.md](TEST_GUIDE.md) for detailed testing documentation.

## Error Handling

| Failure | Action |
|---------|--------|
| `analyze_repo_context` fails | Proceed. Infer language from file extensions. Mark findings as `[AI Inference — Unverified]`. |
| `get_git_diff` fails | Halt. Ask user to provide diff manually or verify git refs. |
| `security_scan` fails | Proceed without Semgrep. Prepend notice: `[Semgrep unavailable — findings are AI inference only]`. |
| `validate_suggestion` warns | Revise and re-validate. Never include a patch that fails validation. |

## Supported Languages & Frameworks

### Languages
- TypeScript/JavaScript
- Python
- Go
- Rust
- Java (+ Kotlin)

### Frameworks
- **JavaScript/TypeScript** — Next.js, React, NestJS, Express, Vue
- **Python** — Django, FastAPI
- **Go** — Gin, Echo
- **Rust** — Actix Web, Axum
- **Java** — Spring Boot

### Deployment Models
- Serverless / FaaS (AWS Lambda, Google Cloud Functions, etc.)
- Long-running services (containerized, VMs)
- Command-line tools (CLI)
- Reusable libraries and packages

## Limitations

- **Semgrep availability** — Requires `semgrep` to be installed and on `$PATH`
- **Git repository** — Requires `.git` directory and valid git history
- **Static analysis only** — Cannot detect runtime-only issues (e.g., race conditions in heavily concurrent code require additional tooling)
- **Language inference** — Best-effort detection; ambiguous projects may need manual language hints

## Performance

- **Small repos** (<1000 files) — Typically completes in <5 seconds
- **Medium repos** (1000–10k files) — Typically completes in 5–30 seconds
- **Large repos** (>10k files) — Semgrep scan may approach the 120-second timeout; consider path filtering

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-improvement`
3. Make your changes and test thoroughly
4. Submit a pull request with a clear description

### Development Guidelines

- Ensure TypeScript compiles without errors: `npm run build`
- Follow existing code structure and patterns
- Add error handling for subprocess failures (git, Semgrep)
- Test with multiple repository types (Node.js, Python, Go, etc.)

## Deployment

For production deployment guides, see [DEPLOYMENT.md](DEPLOYMENT.md).

## License

MIT License. See [LICENSE](LICENSE) for details.

## Support

- 📖 **Documentation** — See [systemprompt.md](systemprompt.md) for the complete review methodology
- 🐛 **Issues** — Report bugs or request features via GitHub Issues
- 💬 **Questions** — Open a Discussion thread on GitHub

---

**CodeSentinel** — Principal Engineer-grade code review for the AI era.
# CodeAudit-MCP
