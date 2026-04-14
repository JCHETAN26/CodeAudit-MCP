# CodeSentinel MCP Implementation Plan

## Phase 1: Machine Learning Pipeline
**Goal:** Create the dataset preparation and training scripts to fine-tune a model with a "Principal Engineer" persona.
1. **Dataset Preparation (`dataset_prep.py`)**:
   - Combine securely sourced datasets, OSS Human Reviews, and synthetic logic pairs into a single cohesive training format.
   - Format entries securely mapping `[Issue] -> [Impact] -> [Fix (Code Diff)]`.
2. **Model Fine-tuning (`train.py`)**:
   - Utilize the Unsloth library to optimize for NVIDIA A100 (80GB) hardware.
   - Implement LoRA with Rank `64` and Alpha `128` to maintain computational efficiency while injecting the strict "Principal Engineer" style and review schema.

## Phase 2: MCP Server Development
**Goal:** Build the TypeScript-based Model Context Protocol (MCP) server.
1. **Project Scaffold**: 
   - Initialize the `package.json` with dependencies like the `@modelcontextprotocol/sdk`.
   - Configure TypeScript (`tsconfig.json`).
2. **Tool Implementations (`src/tools/`)**:
   - `get_git_diff`: Uses local `git diff` commands to extract branch/commit changes.
   - `analyze_code_complexity`: Employs a basic local static analysis technique (using `radon` or similar metric analyzer) to flag overly complex logic.
   - `security_scan`: Integrates with the `semgrep` CLI to scan code for secrets and common vulnerabilities.
3. **Core Server logic (`src/index.ts`)**:
   - Implement the MCP JSON-RPC Server.
   - Define custom prompt schemas injecting contextual knowledge from `README.md` and `CONTRIBUTING.md`.
4. **Validation Logic**: 
   - Apply a filtering layer to incoming outputs from the LLM or run linting on suggestions to prevent syntax errors.

## Phase 3: Deployment Instructions
**Goal:** Document how to hook the AI Reviewer into end-user clients.
1. **Claude Desktop**: Supply the exact `claude_desktop_config.json` payload.
2. **Cursor**: Detail how to add the MCP server configuration locally into Cursor's experimental MCP features.
