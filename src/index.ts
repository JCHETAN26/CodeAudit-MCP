import { execFile, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execFileAsync = promisify(execFile);

const SERVER_NAME = "CodeAudit-MCP";
const SERVER_VERSION = "2.0.0";
const SYSTEM_INSTRUCTION =
  "You are a Principal Engineer. You ignore syntax fluff and variable naming unless it affects readability. You focus on: Distributed system failures, Race conditions, Resource leaks, and Scalability. Structure every review as: [Issue] -> [Impact] -> [Fix (Code Diff)]."

const SEMGREP_TIMEOUT_MS = 120_000;
const EXEC_MAX_BUFFER = 10 * 1024 * 1024;
const DEFAULT_SCAN_PATH = ".";
const CONTEXT_FILES = [
  "README.md",
  "CONTRIBUTING.md",
  "package.json",
  "go.mod",
  "Cargo.toml",
  "pyproject.toml",
  "requirements.txt",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
];
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "vendor",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  "target",
  "__pycache__",
]);

type RepoContext = {
  systemInstruction: string;
  primaryLanguage: string;
  framework: string;
  deploymentModel: string;
  projectConstraints: string[];
  summary: string;
  signals: string[];
  filesRead: string[];
};

type ValidationResult = {
  valid: boolean;
  warnings: string[];
  inferredLanguage: string;
};

type SemgrepFinding = {
  checkId: string;
  path: string;
  line: number | null;
  severity: string;
  message: string;
};

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

server.registerPrompt(
  "principal_engineer_review",
  {
    title: "Principal Engineer Review Persona",
    description: "Returns the hardcoded review instructions used by CodeAudit-MCP.",
  },
  async () => ({
    description: "Principal engineer-level code review instructions for in-depth analysis.",
    messages: [
      {
        role: "assistant",
        content: {
          type: "text",
          text: SYSTEM_INSTRUCTION,
        },
      },
    ],
  }),
);

server.registerTool(
  "review_code",
  {
    title: "Review Code with CodeAudit Local Model",
    description:
      "Generate an AI-powered code review using Llama 3.1 8B with LoRA adapter. Runs locally on your machine. Analyzes code for security issues, race conditions, and scalability problems.",
    inputSchema: {
      file: z.string().describe("Name of the file being reviewed"),
      language: z.string().describe("Programming language (python, go, typescript, etc.)"),
      code: z.string().describe("The code to review"),
      context: z.string().optional().describe("Additional context about the code (e.g., what it does)"),
    },
  },
  async ({ file, language, code, context }) => {
    try {
      const reviewData = await generateCodeReview({
        file,
        language,
        code,
        context: context || "",
      });

      if (reviewData.error) {
        return createTextResult(`Error generating review: ${reviewData.error}`);
      }

      // Format the review for display
      const formattedReview = formatModelReview(reviewData);
      return createTextResult(formattedReview);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return createTextResult(`Failed to generate review: ${errorMsg}`);
    }
  },
);

// Keep mock_review for testing without the model
server.registerTool(
  "mock_review",
  {
    title: "Mock Review Output (Testing Only)",
    description:
      "Returns a mock code review output for testing the system flow. Use this when the trained model is not available.",
    inputSchema: {
      path: z.string().optional(),
    },
  },
  async ({ path: targetPath }) => {
    // Mock review response to demonstrate the system
    const mockReview = `### Finding 1 — SEVERITY: CRITICAL

**[Issue]**
SQL injection vulnerability in \`app.py:15\`. The \`get_user\` endpoint interpolates the \`user_id\` parameter directly into a SQL query string without parameterization.

**[Impact]**
An attacker can craft a \`user_id\` like \`"1'; DROP TABLE users; --"\` to execute arbitrary SQL commands. This bypasses all access controls and can result in data theft, corruption, or complete database destruction.

**[Fix (Code Diff)]**
\`\`\`diff
- query = f"SELECT * FROM users WHERE id = {user_id}"
- cursor = db.cursor()
- cursor.execute(query)
+ query = "SELECT * FROM users WHERE id = ?"
+ cursor = db.cursor()
+ cursor.execute(query, (user_id,))
\`\`\`

---

### Finding 2 — SEVERITY: CRITICAL

**[Issue]**
SQL injection in search function (\`app.py:26\`). User input is concatenated directly into a LIKE clause without any escaping or parameterization.

**[Impact]**
Allows SQL injection via the \`q\` query parameter. An attacker can exfiltrate all product data or modify the database.

**[Fix (Code Diff)]**
\`\`\`diff
- query = "SELECT * FROM products WHERE name LIKE '%" + search_term + "%'"
+ placeholder = "%" + search_term + "%"
+ query = "SELECT * FROM products WHERE name LIKE ?"
+ cursor.execute(query, (placeholder,))
\`\`\`

---

No additional blocking issues found in the scanned path.`;

    return createTextResult(mockReview);
  },
);

server.registerTool(
  "security_scan",
  {
    title: "Security Scan",
    description:
      "Run Semgrep against a repository path and return only HIGH/CRITICAL findings.",
    inputSchema: {
      path: z.string().default(DEFAULT_SCAN_PATH),
    },
  },
  async ({ path: scanPath }) => {
    const targetPath = path.resolve(scanPath || DEFAULT_SCAN_PATH);
    await assertPathExists(targetPath);

    try {
      const { stdout, stderr } = await execFileAsync(
        "semgrep",
        ["--config=auto", "--json", targetPath],
        {
          cwd: process.cwd(),
          timeout: SEMGREP_TIMEOUT_MS,
          maxBuffer: EXEC_MAX_BUFFER,
        },
      );

      return createTextResult(formatSecurityScan(parseSemgrepOutput(stdout), stderr));
    } catch (error) {
      return createTextResult(await handleSemgrepFailure(error));
    }
  },
);

server.registerTool(
  "get_git_diff",
  {
    title: "Git Diff",
    description: "Return the raw git diff between two refs so the reviewer can inspect exact changes.",
    inputSchema: {
      base: z.string().min(1),
      head: z.string().min(1),
    },
  },
  async ({ base, head }) => {
    try {
      const { stdout, stderr } = await execFileAsync(
        "git",
        ["diff", `${base}..${head}`],
        {
          cwd: process.cwd(),
          timeout: 60_000,
          maxBuffer: EXEC_MAX_BUFFER,
        },
      );

      const diff = stdout.trim();
      const payload = diff.length > 0 ? diff : `No changes found between ${base} and ${head}.`;

      return createTextResult(stderr.trim().length > 0 ? `${payload}\n\n${stderr.trim()}` : payload);
    } catch (error) {
      return createTextResult(formatCommandError("git diff", error));
    }
  },
);

server.registerTool(
  "analyze_repo_context",
  {
    title: "Analyze Repository Context",
    description:
      "Read key repository files and infer the primary language and framework for contextual code review.",
  },
  async () => {
    const context = await analyzeRepoContext(process.cwd());
    return createTextResult(JSON.stringify(context, null, 2));
  },
);

server.registerTool(
  "validate_suggestion",
  {
    title: "Validate Suggested Diff",
    description:
      "Perform lightweight validation on an AI-proposed patch and flag obvious syntax or diff-shape problems.",
    inputSchema: {
      diff: z.string().min(1),
      language: z.string().optional(),
    },
  },
  async ({ diff, language }) => {
    const result = validateSuggestion(diff, language);
    return createTextResult(JSON.stringify(result, null, 2));
  },
);

async function assertPathExists(targetPath: string): Promise<void> {
  await fs.access(targetPath);
}

async function handleSemgrepFailure(error: unknown): Promise<string> {
  const stdout = getExecErrorStdout(error);
  const stderr = getExecErrorStderr(error);

  if (stdout.trim().length > 0) {
    try {
      return formatSecurityScan(parseSemgrepOutput(stdout), stderr);
    } catch {
      return formatCommandError("semgrep", error);
    }
  }

  return formatCommandError("semgrep", error);
}

function parseSemgrepOutput(stdout: string): SemgrepFinding[] {
  const parsed = JSON.parse(stdout) as {
    results?: Array<{
      check_id?: string;
      path?: string;
      extra?: {
        message?: string;
        severity?: string;
      };
      severity?: string;
      start?: {
        line?: number;
      };
    }>;
  };

  const results = Array.isArray(parsed.results) ? parsed.results : [];

  return results
    .map((result) => {
      const severity = (result.extra?.severity || result.severity || "UNKNOWN").toUpperCase();
      return {
        checkId: result.check_id || "unknown",
        path: result.path || "unknown",
        line: typeof result.start?.line === "number" ? result.start.line : null,
        severity,
        message: result.extra?.message || "No message supplied by Semgrep.",
      };
    })
    .filter((finding) => finding.severity === "HIGH" || finding.severity === "CRITICAL");
}

function formatSecurityScan(findings: SemgrepFinding[], stderr: string): string {
  if (findings.length === 0) {
    const suffix = stderr.trim().length > 0 ? `\nSemgrep stderr:\n${stderr.trim()}` : "";
    return `No HIGH or CRITICAL Semgrep findings detected.${suffix}`;
  }

  const payload = {
    systemInstruction: SYSTEM_INSTRUCTION,
    findingCount: findings.length,
    findings,
  };

  return `${JSON.stringify(payload, null, 2)}${stderr.trim().length > 0 ? `\n\nSemgrep stderr:\n${stderr.trim()}` : ""}`;
}

async function analyzeRepoContext(rootDir: string): Promise<RepoContext> {
  const filesRead: string[] = [];
  const signals: string[] = [];
  const fileContents = new Map<string, string>();

  for (const fileName of CONTEXT_FILES) {
    const absolutePath = path.join(rootDir, fileName);
    try {
      const contents = await fs.readFile(absolutePath, "utf8");
      fileContents.set(fileName, contents);
      filesRead.push(fileName);
    } catch {
      continue;
    }
  }

  const extensionCounts = await collectExtensionCounts(rootDir);
  const primaryLanguage = inferPrimaryLanguage(fileContents, extensionCounts, signals);
  const framework = inferFramework(fileContents, primaryLanguage, signals);
  const deploymentModel = inferDeploymentModel(fileContents, framework, signals);
  const projectConstraints = inferProjectConstraints(fileContents, signals);
  const summary = buildContextSummary(
    primaryLanguage,
    framework,
    deploymentModel,
    projectConstraints,
    signals,
    filesRead,
  );

  return {
    systemInstruction: SYSTEM_INSTRUCTION,
    primaryLanguage,
    framework,
    deploymentModel,
    projectConstraints,
    summary,
    signals,
    filesRead,
  };
}

async function collectExtensionCounts(rootDir: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  await walkDirectory(rootDir, counts);
  return counts;
}

async function walkDirectory(currentDir: string, counts: Map<string, number>): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".github") {
      continue;
    }

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      await walkDirectory(path.join(currentDir, entry.name), counts);
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!extension) {
      continue;
    }

    counts.set(extension, (counts.get(extension) || 0) + 1);
  }
}

function inferPrimaryLanguage(
  files: Map<string, string>,
  extensionCounts: Map<string, number>,
  signals: string[],
): string {
  if (files.has("package.json")) {
    signals.push("Detected package.json at repository root.");
  }
  if (files.has("go.mod")) {
    signals.push("Detected go.mod at repository root.");
  }
  if (files.has("Cargo.toml")) {
    signals.push("Detected Cargo.toml at repository root.");
  }
  if (files.has("pyproject.toml") || files.has("requirements.txt")) {
    signals.push("Detected Python dependency metadata.");
  }
  if (files.has("pom.xml") || files.has("build.gradle") || files.has("build.gradle.kts")) {
    signals.push("Detected Java build metadata.");
  }

  const scores = new Map<string, number>();
  const addScore = (language: string, value: number) => {
    scores.set(language, (scores.get(language) || 0) + value);
  };

  if (files.has("package.json")) {
    addScore("TypeScript/JavaScript", 10);
  }
  if (files.has("go.mod")) {
    addScore("Go", 10);
  }
  if (files.has("Cargo.toml")) {
    addScore("Rust", 10);
  }
  if (files.has("pyproject.toml") || files.has("requirements.txt")) {
    addScore("Python", 10);
  }
  if (files.has("pom.xml") || files.has("build.gradle") || files.has("build.gradle.kts")) {
    addScore("Java", 10);
  }

  const extensionMap: Array<[string, string, number]> = [
    [".ts", "TypeScript/JavaScript", 3],
    [".tsx", "TypeScript/JavaScript", 3],
    [".js", "TypeScript/JavaScript", 2],
    [".jsx", "TypeScript/JavaScript", 2],
    [".py", "Python", 3],
    [".go", "Go", 3],
    [".rs", "Rust", 3],
    [".java", "Java", 3],
    [".kt", "Java", 2],
  ];

  for (const [extension, language, weight] of extensionMap) {
    const count = extensionCounts.get(extension) || 0;
    if (count > 0) {
      addScore(language, count * weight);
    }
  }

  const ranked = [...scores.entries()].sort((left, right) => right[1] - left[1]);
  if (ranked.length === 0) {
    signals.push("No supported build manifests found. Falling back to extension scan.");
    return "Unknown";
  }

  signals.push(
    `Primary language inferred from manifests and file extensions: ${ranked[0][0]}.`,
  );
  return ranked[0][0];
}

function inferFramework(
  files: Map<string, string>,
  primaryLanguage: string,
  signals: string[],
): string {
  const packageJson = parseJson<Record<string, unknown>>(files.get("package.json"));
  if (packageJson) {
    const deps = {
      ...readPackageSection(packageJson.dependencies),
      ...readPackageSection(packageJson.devDependencies),
      ...readPackageSection(packageJson.peerDependencies),
    };

    if (deps.next) {
      signals.push("Framework hint: next dependency detected.");
      return "Next.js";
    }
    if (deps.react) {
      signals.push("Framework hint: react dependency detected.");
      return "React";
    }
    if (deps["@nestjs/core"]) {
      signals.push("Framework hint: NestJS dependency detected.");
      return "NestJS";
    }
    if (deps.express) {
      signals.push("Framework hint: express dependency detected.");
      return "Express";
    }
    if (deps.vue) {
      signals.push("Framework hint: vue dependency detected.");
      return "Vue";
    }
  }

  const pyproject = files.get("pyproject.toml") || "";
  if (pyproject.includes("django")) {
    signals.push("Framework hint: django dependency detected.");
    return "Django";
  }
  if (pyproject.includes("fastapi")) {
    signals.push("Framework hint: fastapi dependency detected.");
    return "FastAPI";
  }

  if (files.has("go.mod")) {
    const goMod = files.get("go.mod") || "";
    if (goMod.includes("gin-gonic/gin")) {
      signals.push("Framework hint: gin-gonic/gin dependency detected.");
      return "Gin";
    }
    if (goMod.includes("labstack/echo")) {
      signals.push("Framework hint: labstack/echo dependency detected.");
      return "Echo";
    }
  }

  if (files.has("Cargo.toml")) {
    const cargoToml = files.get("Cargo.toml") || "";
    if (cargoToml.includes("actix-web")) {
      signals.push("Framework hint: actix-web dependency detected.");
      return "Actix Web";
    }
    if (cargoToml.includes("axum")) {
      signals.push("Framework hint: axum dependency detected.");
      return "Axum";
    }
  }

  if (primaryLanguage === "Java") {
    const pom = files.get("pom.xml") || "";
    const gradle = `${files.get("build.gradle") || ""}\n${files.get("build.gradle.kts") || ""}`;
    if (pom.includes("spring-boot") || gradle.includes("spring-boot")) {
      signals.push("Framework hint: Spring Boot dependency detected.");
      return "Spring Boot";
    }
  }

  return "Unknown";
}

function buildContextSummary(
  primaryLanguage: string,
  framework: string,
  deploymentModel: string,
  projectConstraints: string[],
  signals: string[],
  filesRead: string[],
): string {
  const frameworkSegment = framework !== "Unknown" ? `Framework: ${framework}.` : "Framework not confidently identified.";
  const deploymentSegment =
    deploymentModel !== "Unknown"
      ? `Deployment model: ${deploymentModel}.`
      : "Deployment model not confidently identified.";
  const constraintsSegment =
    projectConstraints.length > 0
      ? `Project constraints: ${projectConstraints.join(" ")}`
      : "No explicit project constraints were extracted from README.md or CONTRIBUTING.md.";
  const filesSegment = filesRead.length > 0 ? `Read context files: ${filesRead.join(", ")}.` : "No standard context files were found.";
  const signalsSegment =
    signals.length > 0 ? `Signals: ${signals.join(" ")}` : "No repository signals were collected.";

  return `Primary language: ${primaryLanguage}. ${frameworkSegment} ${deploymentSegment} ${constraintsSegment} ${filesSegment} ${signalsSegment}`;
}

function inferDeploymentModel(
  files: Map<string, string>,
  framework: string,
  signals: string[],
): string {
  const packageJson = parseJson<Record<string, unknown>>(files.get("package.json"));
  const packageScripts = packageJson ? readPackageSection(packageJson.scripts) : {};
  const readme = `${files.get("README.md") || ""}\n${files.get("CONTRIBUTING.md") || ""}`.toLowerCase();
  const pyproject = (files.get("pyproject.toml") || "").toLowerCase();
  const cargoToml = (files.get("Cargo.toml") || "").toLowerCase();
  const goMod = (files.get("go.mod") || "").toLowerCase();
  const pom = (files.get("pom.xml") || "").toLowerCase();
  const gradle = `${files.get("build.gradle") || ""}\n${files.get("build.gradle.kts") || ""}`.toLowerCase();

  if (
    framework === "Next.js" ||
    readme.includes("serverless") ||
    readme.includes("lambda") ||
    readme.includes("faas") ||
    Object.values(packageScripts).some((script) => /serverless|sst|sam\s|lambda/.test(script))
  ) {
    signals.push("Deployment hint: serverless markers detected.");
    return "Serverless / FaaS";
  }

  if (
    framework === "Express" ||
    framework === "NestJS" ||
    framework === "FastAPI" ||
    framework === "Django" ||
    framework === "Spring Boot" ||
    framework === "Gin" ||
    framework === "Echo" ||
    framework === "Actix Web" ||
    framework === "Axum" ||
    readme.includes("api server") ||
    readme.includes("service") ||
    pyproject.includes("uvicorn") ||
    pyproject.includes("gunicorn") ||
    cargoToml.includes("tokio") ||
    goMod.includes("google.golang.org/grpc") ||
    pom.includes("spring-boot-starter-web") ||
    gradle.includes("spring-boot-starter-web")
  ) {
    signals.push("Deployment hint: long-running service markers detected.");
    return "Long-running service";
  }

  if (
    packageJson?.bin ||
    readme.includes("command line") ||
    readme.includes("cli") ||
    pyproject.includes("[project.scripts]") ||
    cargoToml.includes("[[bin]]")
  ) {
    signals.push("Deployment hint: CLI markers detected.");
    return "CLI";
  }

  if (
    readme.includes("library") ||
    readme.includes("sdk") ||
    readme.includes("package") ||
    (packageJson && !Object.keys(packageScripts).some((scriptName) => scriptName === "start"))
  ) {
    signals.push("Deployment hint: reusable library/package markers detected.");
    return "Library";
  }

  return "Unknown";
}

function inferProjectConstraints(
  files: Map<string, string>,
  signals: string[],
): string[] {
  const sources = [
    { name: "README.md", contents: files.get("README.md") || "" },
    { name: "CONTRIBUTING.md", contents: files.get("CONTRIBUTING.md") || "" },
  ].filter((source) => source.contents.trim().length > 0);

  if (sources.length === 0) {
    return [];
  }

  const constraints = new Set<string>();
  const fallbackHints: string[] = [];

  for (const source of sources) {
    const lines = source.contents.split("\n").map((line) => line.trim());

    for (const line of lines) {
      if (line.length < 8 || line.length > 220) {
        continue;
      }

      if (/^\s*#/.test(line)) {
        continue;
      }

      const normalized = line.replace(/^[-*]\s*/, "");
      const lower = normalized.toLowerCase();

      if (
        /(must|should|required|never|do not|don't|avoid|all .* must|only .* may|always)/.test(lower)
      ) {
        constraints.add(`${source.name}: ${normalized}`);
        continue;
      }

      if (
        /(repository layer|service layer|structured log|transaction|retry|idempotent|timeout|validation|sanitize|pool|release)/.test(lower)
      ) {
        fallbackHints.push(`${source.name}: ${normalized}`);
      }
    }
  }

  const extracted = [...constraints];
  if (extracted.length > 0) {
    signals.push(`Extracted ${extracted.length} explicit project constraint(s) from docs.`);
    return extracted.slice(0, 8);
  }

  const hinted = [...new Set(fallbackHints)].slice(0, 5);
  if (hinted.length > 0) {
    signals.push("No explicit MUST/DO NOT constraints found; returning high-signal guidance hints from docs.");
  }
  return hinted;
}

function validateSuggestion(diff: string, language?: string): ValidationResult {
  const warnings: string[] = [];
  const inferredLanguage = language?.trim() || inferLanguageFromDiff(diff);

  // Check 1: Merge conflict markers
  if (/<<<<<<<|=======|>>>>>>>/.test(diff)) {
    warnings.push("Contains merge conflict markers (<<<<<<, =======, >>>>>>>).");
  }

  // Check 2: Fenced code blocks mixed into patch
  if (diff.includes("```") && !/^```/m.test(diff.trim())) {
    warnings.push("Contains fenced code blocks mixed into patch text; provide plain unified diff when possible.");
  }

  // Check 3: Partial patch hunk without file headers
  if (/^@@/m.test(diff) && !/^diff --git/m.test(diff) && !/^[+-]{3}\s/m.test(diff)) {
    warnings.push("Looks like a partial patch hunk without file headers.");
  }

  // Check 4: Unbalanced brackets
  const parenDelta = countChars(diff, "(") - countChars(diff, ")");
  const braceDelta = countChars(diff, "{") - countChars(diff, "}");
  const bracketDelta = countChars(diff, "[") - countChars(diff, "]");

  if (parenDelta !== 0) {
    warnings.push(`Unbalanced parentheses: ${Math.abs(parenDelta)} ${parenDelta > 0 ? "missing closing" : "extra closing"} paren(s).`);
  }
  if (braceDelta !== 0) {
    warnings.push(`Unbalanced curly braces: ${Math.abs(braceDelta)} ${braceDelta > 0 ? "missing closing" : "extra closing"} brace(s).`);
  }
  if (bracketDelta !== 0) {
    warnings.push(`Unbalanced square brackets: ${Math.abs(bracketDelta)} ${bracketDelta > 0 ? "missing closing" : "extra closing"} bracket(s).`);
  }

  // Check 5: Python-specific issues
  if ((inferredLanguage === "Python" || language === "python") && likelyPythonColonIssue(diff)) {
    warnings.push("Python-looking control flow or function definitions may be missing trailing colons.");
  }

  if ((inferredLanguage === "Python" || language === "python") && likelyPythonIndentationIssue(diff)) {
    warnings.push("Possible Python indentation issue detected (mixed spaces/tabs or inconsistent indentation).");
  }

  // Check 6: JavaScript/TypeScript-specific issues
  if (
    (inferredLanguage === "TypeScript/JavaScript" || language === "typescript" || language === "javascript") &&
    hasDanglingControlStatement(diff)
  ) {
    warnings.push("Detected a control statement line that may be missing braces or a continuation.");
  }

  if ((inferredLanguage === "TypeScript/JavaScript" || language === "typescript") && hasMissingAwaitKeyword(diff)) {
    warnings.push("Detected async operation without awaiting (Promise may not be resolved).");
  }

  // Check 7: Go-specific issues
  if ((inferredLanguage === "Go" || language === "go") && hasMissingErrorCheck(diff)) {
    warnings.push("Go code detected without error checking (missing `if err != nil` pattern).");
  }

  if ((inferredLanguage === "Go" || language === "go") && hasMissingDefer(diff)) {
    warnings.push("Go code with resource acquisition detected but no `defer` for cleanup (possible resource leak).");
  }

  // Check 8: Java-specific issues
  if ((inferredLanguage === "Java" || language === "java") && hasMissingAnnotation(diff)) {
    warnings.push("Java method override detected but no @Override annotation.");
  }

  // Check 9: Rust-specific issues
  if ((inferredLanguage === "Rust" || language === "rust") && likelyRustUnwrapIssue(diff)) {
    warnings.push("Rust code with `.unwrap()` detected; consider using `?` operator or proper error handling.");
  }

  // Check 10: Common SQL issues
  if (hasSQLInjectionPattern(diff)) {
    warnings.push("Detected SQL query string concatenation (possible SQL injection vulnerability).");
  }

  // Check 11: Obvious logic errors
  if (hasLogicallyDeadCode(diff)) {
    warnings.push("Detected code that always returns/throws (unreachable code after this statement).");
  }

  // Check 12: Array/slice issues
  if (hasArrayBoundariesIssue(diff)) {
    warnings.push("Detected array/slice access that may be out of bounds.");
  }

  // Check 13: Trailing whitespace or other formatting issues
  const trailingWhitespace = diff.split("\n").filter((line) => line.match(/^\+.*\s+$/));
  if (trailingWhitespace.length > 3) {
    warnings.push(`Multiple lines have trailing whitespace (${trailingWhitespace.length} lines affected).`);
  }

  // Check 14: Very long lines
  const longLines = diff.split("\n").filter((line) => line.startsWith("+") && line.length > 120);
  if (longLines.length > 2) {
    warnings.push(`Multiple very long lines detected (${longLines.length} lines > 120 chars); consider breaking them up.`);
  }

  return {
    valid: warnings.length === 0,
    warnings,
    inferredLanguage,
  };
}

function inferLanguageFromDiff(diff: string): string {
  if (/^\+\s*def\s+\w+\(|^\+\s*class\s+\w+|^\+\s*import\s+\w+/m.test(diff)) {
    return "Python";
  }
  if (/^\+\s*fn\s+\w+|^\+\s*use\s+\w+/m.test(diff)) {
    return "Rust";
  }
  if (/^\+\s*func\s+\w+|^\+\s*package\s+\w+|^\+\s*go\s+/m.test(diff)) {
    return "Go";
  }
  if (/^\+\s*public\s+class|^\+\s*@\w+|^\+\s*private\s+\w+/m.test(diff)) {
    return "Java";
  }
  if (/^\+\s*(export|import|interface|type|const|let|class|async)\b/m.test(diff)) {
    return "TypeScript/JavaScript";
  }
  return "Unknown";
}

function likelyPythonColonIssue(diff: string): boolean {
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .some((line) => {
      const trimmed = line.slice(1).trim();
      return (
        /^(if|elif|else|for|while|def|class|with|try|except|finally)\b/.test(trimmed) &&
        !trimmed.endsWith(":") &&
        !trimmed.endsWith("\\") &&
        trimmed.length > 0
      );
    });
}

function likelyPythonIndentationIssue(diff: string): boolean {
  // Check for mixed tabs and spaces or sudden indentation jumps
  const lines = diff.split("\n").filter((line) => line.startsWith("+"));
  let prevIndent = -1;
  for (const line of lines) {
    const content = line.slice(1);
    if (!content || content[0] === " " || content[0] === "\t") {
      const match = content.match(/^[ \t]*/);
      const indent = match ? match[0].length : 0;
      
      // Check for tabs mixed with spaces
      if (match && match[0].includes(" ") && match[0].includes("\t")) {
        return true;
      }
      
      // Check for unreasonable indentation jump (> 8 spaces at once)
      if (prevIndent >= 0 && indent - prevIndent > 8) {
        return true;
      }
      prevIndent = indent;
    }
  }
  return false;
}

function hasMissingAwaitKeyword(diff: string): boolean {
  // Detect patterns like: const x = someAsyncFunction(); without await
  return /^\+\s*(const|let|var)\s+\w+\s*=\s*\w+\([^)]*\)\s*[;$]/m.test(diff) &&
    /^\+\s*async\s+(function|\w+|=>)/m.test(diff) &&
    !/^\+\s*await\s+/m.test(diff);
}

function hasDanglingControlStatement(diff: string): boolean {
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .some((line) => {
      const trimmed = line.slice(1).trim();
      return /^(if|for|while|switch|catch)\b.*[^({]$/.test(trimmed) && !trimmed.endsWith(";") && !trimmed.endsWith("{");
    });
}

function hasMissingErrorCheck(diff: string): boolean {
  // Go pattern: err := someOP() without subsequent error check
  return /^\+\s*\w+\s*:=\s*\w+\([^)]*\)/m.test(diff) &&
    !/^\+\s*if\s+err\s*!=\s*nil/m.test(diff);
}

function hasMissingDefer(diff: string): boolean {
  // Go: db.Open() or file.Open() without defer
  return /^\+\s*\w+\s*:=\s*(db|file|conn|client)\./i.test(diff) &&
    !/^\+\s*defer\s+/m.test(diff);
}

function hasMissingAnnotation(diff: string): boolean {
  // Java: @Override missing on override methods
  return /^\+\s*public\s+(void|String|\w+)\s+\w+\(/m.test(diff) &&
    !/^\+\s*@Override/m.test(diff) &&
    /extends|implements/i.test(diff);
}

function likelyRustUnwrapIssue(diff: string): boolean {
  return /^\+.*\.unwrap\(\)/m.test(diff);
}

function hasSQLInjectionPattern(diff: string): boolean {
  // Detect SQL + concatenation patterns
  return /^\+.*SELECT.*\+|^\+.*INSERT.*\+|^\+.*UPDATE.*\+|^\+.*DELETE.*\+|^\+.*\$\{/m.test(diff) &&
    /^\+.*".*\+|^\+.*'.*\+|^\+.*f"|^\+.*f'/m.test(diff);
}

function hasLogicallyDeadCode(diff: string): boolean {
  // Pattern: return/throw/break followed by more code
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+"))
    .some((line, idx, arr) => {
      const trimmed = line.slice(1).trim();
      if (/^(return|throw|break|continue)\b/.test(trimmed)) {
        // Check if next non-empty line is also code (not closing brace)
        for (let i = idx + 1; i < Math.min(idx + 3, arr.length); i++) {
          const nextTrimmed = arr[i].slice(1).trim();
          if (nextTrimmed && !nextTrimmed.startsWith("}") && !nextTrimmed.startsWith("*/") && !nextTrimmed.startsWith("//")) {
            return true;
          }
        }
      }
      return false;
    });
}

function hasArrayBoundariesIssue(diff: string): boolean {
  // Detect array access without length check
  return /^\+.*\[\w+\]/.test(diff) && !/^\+.*\.length|^\+.*len\(/m.test(diff);
}

function countChars(text: string, target: string): number {
  let count = 0;
  for (const character of text) {
    if (character === target) {
      count += 1;
    }
  }
  return count;
}

function parseJson<T>(value: string | undefined): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function readPackageSection(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function createTextResult(text: string) {
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
  };
}

function formatCommandError(command: string, error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stderr = getExecErrorStderr(error);
  const stdout = getExecErrorStdout(error);

  return [
    `${command} failed.`,
    errorMessage,
    stderr.trim().length > 0 ? `stderr:\n${stderr.trim()}` : "",
    stdout.trim().length > 0 ? `stdout:\n${stdout.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function getExecErrorStdout(error: unknown): string {
  if (error && typeof error === "object" && "stdout" in error && typeof error.stdout === "string") {
    return error.stdout;
  }
  return "";
}

function getExecErrorStderr(error: unknown): string {
  if (error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string") {
    return error.stderr;
  }
  return "";
}

interface CodeReviewRequest {
  file: string;
  language: string;
  code: string;
  context: string;
}

interface ReviewIssue {
  severity: "HIGH" | "CRITICAL" | "MEDIUM" | "LOW";
  type: string;
  message: string;
  line?: number;
}

interface CodeReviewResult {
  error?: string;
  issues: ReviewIssue[];
  summary: string;
  suggestions: string[];
  security_concerns: string[];
}

async function generateCodeReview(request: CodeReviewRequest): Promise<CodeReviewResult> {
  // Use local Llama 3.1 8B model with LoRA adapter
  return generateCodeReviewLocal(request);
}

/**
 * Local model execution using Llama 3.1 8B with LoRA adapter
 * Requires Python 3.10+ with PyTorch and transformers installed
 */
async function generateCodeReviewLocal(request: CodeReviewRequest): Promise<CodeReviewResult> {
  // Use absolute path - __dirname is the build directory, go up one level to project root
  const projectRoot = path.dirname(__dirname);
  const pythonScript = path.join(projectRoot, "codeaudit_review.py");
  
  return new Promise((resolve) => {
    const child = spawn("python3", [pythonScript], {
      cwd: projectRoot,
      env: { ...process.env, PYTHONPATH: projectRoot },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 180_000); // 3 minutes timeout

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        error: `Failed to spawn Python process: ${error.message}`,
        issues: [],
        summary: "",
        suggestions: [],
        security_concerns: [],
      });
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (timedOut) {
        resolve({
          error: "Model inference timed out (exceeded 3 minutes)",
          issues: [],
          summary: "",
          suggestions: [],
          security_concerns: [],
        });
        return;
      }

      if (code !== 0) {
        resolve({
          error: `Python process exited with code ${code}. ${stderr}`,
          issues: [],
          summary: "",
          suggestions: [],
          security_concerns: [],
        });
        return;
      }

      try {
        const result = JSON.parse(stdout) as CodeReviewResult;
        resolve(result);
      } catch (parseError) {
        resolve({
          error: "Failed to parse model output",
          issues: [],
          summary: stdout,
          suggestions: [],
          security_concerns: [],
        });
      }
    });

    // Send the request as JSON to stdin
    child.stdin?.write(JSON.stringify(request));
    child.stdin?.end();
  });
}

function formatModelReview(review: CodeReviewResult): string {
  if (review.error) {
    return `⚠️ Error: ${review.error}`;
  }

  const parts: string[] = [];

  if (review.summary) {
    parts.push(`**Summary:**\n${review.summary}\n`);
  }

  if (review.issues && review.issues.length > 0) {
    parts.push("**Issues Found:**\n");
    review.issues.forEach((issue, idx) => {
      const lineInfo = issue.line ? ` (Line ${issue.line})` : "";
      parts.push(`${idx + 1}. [${issue.severity}] ${issue.type}${lineInfo}`);
      parts.push(`   ${issue.message}\n`);
    });
  } else {
    parts.push("✅ **No critical issues found.**\n");
  }

  if (review.suggestions && review.suggestions.length > 0) {
    parts.push("**Suggestions:**");
    review.suggestions.forEach((suggestion) => {
      parts.push(`- ${suggestion}`);
    });
    parts.push("");
  }

  if (review.security_concerns && review.security_concerns.length > 0) {
    parts.push("**Security Concerns:**");
    review.security_concerns.forEach((concern) => {
      parts.push(`⚠️ ${concern}`);
    });
    parts.push("");
  }

  return parts.join("\n");
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  await fs.writeFile(path.join(os.tmpdir(), "codeaudit-error.log"), `${message}\n`, "utf8").catch(() => {});
  process.stderr.write(`Fatal ${SERVER_NAME} startup error:\n${message}\n`);
  process.exit(1);
});
