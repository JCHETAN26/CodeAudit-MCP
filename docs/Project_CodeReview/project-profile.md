# Project Profile — CodeAudit-MCP (a.k.a. CodeSentinel)

> Evidence-backed profile. Every claim is traceable to a file in the repo. Aspirational
> language found in the repo's own docs (e.g. "production-ready", "real users") is
> explicitly flagged as unverified and excluded from resume-safe claims.

## Project Name
**CodeAudit-MCP** (package name `codeaudit-mcp`; earlier/alternate branding "CodeSentinel"
still present throughout docs and Python artifacts). Repo directory: `Code-Review-Agent-MCP`.

## One-Line Pitch
A Model Context Protocol (MCP) server that gives Claude Desktop a set of code-review tools —
Semgrep security scanning, git-diff extraction, repo-context inference, and heuristic patch
validation — with a companion (attempted) LoRA fine-tune of Llama-3.1-8B for review generation.

## Project Category
- **AI Engineering** (primary) — MCP tool server for an LLM host; LoRA fine-tuning pipeline.
- **Developer Tooling** (primary) — code-review tooling packaged for `npm` + Claude Desktop.
- **Backend Engineering** (secondary) — Node/TypeScript stdio server, subprocess orchestration, Flask REST API.
- **Machine Learning Engineering** (secondary, weak result) — Unsloth/LoRA SFT pipeline; see Limitations.

Not a strong fit for Data Engineering, Analytics Engineering, or Full-Stack (no frontend UI).

## Problem
LLM code review inside an editor/agent tends to be generic and ungrounded: it doesn't see the
exact git diff, doesn't run real static analysis, and doesn't respect a repo's language,
framework, or contribution rules. This project exposes concrete, deterministic tools to the LLM
so review is grounded in (a) the actual diff, (b) Semgrep findings, and (c) inferred repo context,
and validates the model's proposed patches before they reach the user.

## Why It Matters
It demonstrates practical MCP server design: registering typed tools (zod schemas), safely shelling
out to `git` and `semgrep`, parsing tool output, and handling subprocess failure. That is a real,
current AI-integration skill set. The fine-tuning pipeline additionally shows familiarity with
Unsloth/PEFT/TRL, even though the training run itself did not converge (see Limitations).

## Target Users
- Developers using **Claude Desktop** (or other MCP hosts) who want grounded code review.
- Engineers evaluating MCP as an integration pattern.
- (Aspirational, per repo docs) beta testers / "friends" — no evidence of real external users.

## Architecture Summary
A Node.js + TypeScript process (`src/index.ts`, compiled to `build/index.js`) speaks the MCP
protocol over **stdio** to an MCP host (Claude Desktop). It registers one prompt and several tools.
Tools work by shelling out to local binaries (`git`, `semgrep`, `python3`) and by reading/parsing
repo manifest files. The `review_code` tool spawns `codeaudit_review.py`, which loads a base
Llama-3.1-8B model plus a LoRA adapter via `model_loader.py`. A separate Flask app
(`hf_spaces_app.py`) can expose the same model loader as a REST API.

## Main Components
- **MCP server** — `src/index.ts` (~1,213 lines). Registers prompt `principal_engineer_review` and tools:
  - `analyze_repo_context` — reads manifests (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `requirements.txt`, `pom.xml`, gradle) + counts file extensions to infer language, framework, deployment model, and extract README/CONTRIBUTING constraints.
  - `get_git_diff` — runs `git diff base..head` via `execFile`.
  - `security_scan` — runs `semgrep --config=auto --json`, parses results, filters HIGH/CRITICAL.
  - `validate_suggestion` — 14 heuristic checks on a proposed diff (merge markers, bracket balance, Python colons/indentation, Go err-check/defer, Java `@Override`, Rust `.unwrap()`, SQL concat, dead code, array bounds, trailing whitespace, long lines).
  - `review_code` — spawns Python bridge to generate a model review.
  - `mock_review` — hardcoded sample review for testing without the model.
- **CLI + installer** — `bin/cli.js` (`start`/`setup`/`help`), `bin/setup.js` (auto-writes Claude Desktop config, cross-platform).
- **ML pipeline (Python)** — `generate_data.py` (synthetic dataset from 9 templates), `dataset_prep.py` (stub formatter), `train.py` (Unsloth + LoRA SFT, A100 config), `evaluate_model.py` (perplexity eval), `extract_metrics.py` (parses trainer_state.json), `model_loader.py` (base + LoRA loader, 4-bit), `codeaudit_review.py` (stdin→review bridge).
- **Serving** — `hf_spaces_app.py` (Flask + CORS: `/`, `/review`, `/status`), `Dockerfile.vps`.
- **Tests/scripts** — `scripts/test-dependencies.js`, `test-tools.js`, `test-e2e.js`, `test-model-integration.js`, `test-together.js`, `diagnose-mcp.js`, `demo.js`.
- **Demo fixtures** — `vulnerable-app/` (`app.py`, `server.go`, `concurrent.ts`).

## Data Flow / Request Flow
1. Claude Desktop launches `node build/index.js` and connects over stdio (`StdioServerTransport`).
2. The model calls a tool with typed args validated by zod.
3. For `security_scan`/`get_git_diff`, the server `execFile`s `semgrep`/`git`, parses stdout, and returns text.
4. For `analyze_repo_context`, the server reads manifest files + walks the tree for extension counts, then returns inferred context JSON.
5. For `review_code`, the server spawns `python3 codeaudit_review.py`, pipes the request as JSON on stdin; `model_loader.py` loads Llama-3.1-8B + LoRA adapter and returns review JSON on stdout.
6. `validate_suggestion` runs pure-function heuristics on the proposed diff and returns warnings.

## Tech Stack
- **Languages:** TypeScript (server), JavaScript (CLI/tests/ESM), Python (ML + serving).
- **MCP/LLM:** `@modelcontextprotocol/sdk` ^1.0.1, stdio transport, `zod` ^3.23.8 schemas.
- **Static analysis:** Semgrep (`--config=auto`), invoked as subprocess.
- **VCS integration:** `git diff` via subprocess.
- **ML libs:** Unsloth, TRL (`SFTTrainer`), PEFT (LoRA r=64/alpha=128), Transformers, bitsandbytes (4-bit), Accelerate, Datasets, xformers.
- **Model:** `meta-llama/Meta-Llama-3.1-8B-Instruct` (+ `unsloth/...-bnb-4bit` base for inference).
- **Serving/infra:** Flask + flask-cors, Docker (`Dockerfile.vps`, Ubuntu 24.04).
- **Build/tooling:** Node ≥20, TypeScript ^5.6, `tsc` build, npm scripts, `bin` field for CLI.
- **Testing:** custom Node scripts (no formal framework like Jest/Vitest).

## Core Features (implemented)
- MCP server exposing 6 tools + 1 prompt over stdio.
- Semgrep HIGH/CRITICAL scanning with JSON parsing and graceful "semgrep unavailable" fallback.
- Git diff extraction between two refs.
- Repo language/framework/deployment inference across JS/TS, Python, Go, Rust, Java.
- Heuristic patch validation (14 checks, multi-language).
- npm packaging + cross-platform Claude Desktop auto-setup script.
- LoRA fine-tuning pipeline (Unsloth) with synthetic dataset generation and metric extraction.
- Local model loader (4-bit) and Flask REST wrapper.

## What Was Actually Built
- A working, typed TypeScript MCP server with real subprocess orchestration and error handling.
- A deterministic multi-language patch validator (pure functions, unit-testable).
- A repo-context inference engine driven by manifests + extension scanning.
- A synthetic SFT dataset (500 rows) generated by string-substituting 9 hand-written review templates.
- An Unsloth/LoRA training script and an evaluation/metric-extraction pipeline.
- A Flask inference API and a Docker image definition.
- Several Node-based smoke/integration test scripts and demo vulnerable-code fixtures.

## Evidence Found (strongest)
- `src/index.ts` — full MCP server, all tool handlers and heuristics.
- `package.json` — MCP SDK + zod deps, `bin`, build/test scripts, Node ≥20 engine.
- `train.py`, `model_loader.py`, `evaluate_model.py`, `extract_metrics.py` — ML pipeline.
- `generate_data.py` + `codesentinel_MASTER_dataset.jsonl` (500 rows, 9 unique templates).
- `codesentinel_artifacts/outputs_codesentinel_lora/checkpoint-500/trainer_state.json` + `training_metrics.json` — actual training numbers.
- `scripts/test-*.js` — smoke tests.
- `hf_spaces_app.py`, `Dockerfile.vps` — serving/deploy definitions.

## Metrics / Results
- **Training loss:** initial ≈ 2.3934, final ≈ 2.3966 over 500 steps (`training_metrics.json`).
  Reported "loss improvement" is **−0.14%** — i.e., loss did **not** improve.
- **Perplexity:** ≈ 10.99 (derived from final loss).
- **Epochs:** ≈ 31.25 over a 500-row synthetic dataset; `trainer_state.json` shows `grad_norm`
  ≈ 2.9e12 at step 500 (training instability).
- **Dataset size:** 500 examples, 9 unique templates.
- **Tests:** 4 Node smoke-test suites exist; README claims "10+ tests pass" — **not independently verified** and no CI.
- **Latency ("<5s small repos", etc.):** README claims only, **no benchmark artifacts**.

→ **No directly verified performance/quality metric supports the fine-tuned model being better than the base model. The one hard number (loss) shows no improvement.**

## Limitations
- **Fine-tune did not converge / no improvement:** flat loss, exploding gradient norm, 31 epochs on 500 synthetic rows (overfit regime with no measured gain).
- **LoRA adapter weights are absent from the repo:** `codesentinel_artifacts/codesentinel_lora_model/` contains `adapter_config.json` + tokenizer but **no `adapter_model.safetensors`**, so `review_code`/the loader cannot actually run as shipped.
- **Synthetic dataset:** `dataset_prep.py` is a stub; real data comes from `generate_data.py` (9 templates), not the "SecureCode-v2 / OSS Human Reviews" mix described in `build.txt`.
- **No CI/CD:** no `.github/workflows`. No `LICENSE` file despite README's MIT claim.
- **No production/users/uptime evidence:** "production-ready", "real users", "50MB package" are self-authored doc claims only.
- **Tests are smoke tests**, not assertion-rich unit tests; `test-tools.js` re-implements validation logic rather than importing the server's.
- **Docs drift:** README describes a Together.AI/HF fallback, but `generateCodeReview` in `src/index.ts` calls only the local Python path.

## Future Improvements
- Ship (or externally host) the LoRA weights; add a real inference smoke test in CI.
- Fix training instability (lower LR / grad clipping / fewer epochs) and report a real eval metric vs. the base model.
- Replace synthetic templates with a real, deduplicated review dataset; add a held-out eval set.
- Add `.github/workflows` (build + `npm test` + `tsc --noEmit`) and a `LICENSE` file.
- Unit-test `validate_suggestion` and context inference by importing the compiled module directly.
- Add a small labeled benchmark (e.g., N seeded vulnerabilities) to quantify detection precision/recall.

## Best Role Fit (0–100)
- **AI Engineer — 82.** Real MCP server with typed tools, LLM host integration, and a fine-tuning pipeline. Docked because the model result is unproven and weights are missing.
- **Developer Tooling / Backend Engineer — 78.** Solid Node/TS subprocess tooling, npm packaging, CLI, error handling; no formal test framework or CI.
- **Machine Learning Engineer — 55.** Full Unsloth/LoRA pipeline and eval scaffolding, but the run shows no improvement and no usable artifact — defensible only as "attempted/learning".
- **DevOps Engineer — 40.** Dockerfile + cross-platform setup script exist; no CI/CD, orchestration, or IaC.
- **Data Engineer — 25.** Only synthetic JSONL generation; no pipelines, warehouses, or streaming.
- **Analytics Engineer — 15.** No analytics/dbt/BI work.
- **Full-Stack Engineer — 30.** Backend + a Flask API only; no frontend UI.
