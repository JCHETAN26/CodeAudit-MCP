# Interview Guide — CodeAudit-MCP

## 30-Second Explanation
"CodeAudit-MCP is a Model Context Protocol server that gives Claude Desktop grounded code-review
tools. Instead of the LLM guessing, it can call typed tools I built in TypeScript — pull the exact
git diff, run Semgrep and get HIGH/CRITICAL findings, infer the repo's language and framework, and
validate any patch it proposes against 14 syntax/safety heuristics. I also built a LoRA fine-tuning
pipeline for Llama-3.1-8B to generate the reviews, though that training run didn't converge, so the
strongest, working part is the MCP server and tooling."

## 2-Minute Technical Deep Dive
The server (`src/index.ts`, ~1,200 lines of strict TypeScript) uses `@modelcontextprotocol/sdk` and
talks to the host over stdio. Each tool has a zod input schema. `get_git_diff` and `security_scan`
shell out to `git` and `semgrep` via `execFile` with argument arrays (no shell interpolation),
timeouts, and structured error formatting; the Semgrep path parses JSON, filters HIGH/CRITICAL, and
falls back gracefully if the binary is missing. `analyze_repo_context` reads build manifests and
walks the tree counting file extensions to infer language, framework, and deployment model, and
pulls MUST/DO-NOT constraints out of README/CONTRIBUTING. `validate_suggestion` is 14 pure-function
heuristics across Python/TS/Go/Java/Rust plus SQL-injection and dead-code checks. `review_code`
spawns a Python bridge (`codeaudit_review.py` → `model_loader.py`) that loads Llama-3.1-8B in 4-bit
with a LoRA adapter. Separately, `generate_data.py` builds a 500-row synthetic dataset from 9
templates, `train.py` runs Unsloth/TRL SFT (LoRA r=64/α=128), and `extract_metrics.py`/`evaluate_model.py`
compute loss and perplexity. It's packaged for npm with a CLI and an auto-setup script for Claude
Desktop, and there's a Flask API plus a Dockerfile for optional hosted serving.

## Architecture Walkthrough
1. Claude Desktop launches `node build/index.js` and connects over stdio.
2. The model calls a tool; zod validates the args.
3. Diff/scan tools `execFile` `git`/`semgrep`, parse output, and return text.
4. Context tool reads manifests + extension counts and returns inferred context JSON.
5. `review_code` pipes a JSON request to `python3 codeaudit_review.py`, which loads the model and
   returns review JSON. `validate_suggestion` runs pure heuristics on any proposed diff.
6. Offline: `generate_data.py` → dataset → `train.py` → checkpoint → metric extraction/eval.

## Best Resume Talking Points
- A real, working MCP server with 6 tools + 1 prompt (current, in-demand LLM-integration skill).
- Safe subprocess orchestration (execFile arg arrays, timeouts, failure fallbacks).
- A 14-check multi-language patch validator written as pure, testable functions.
- Repo-context inference across 5 language ecosystems and 10+ frameworks.
- End-to-end LoRA/Unsloth pipeline: synthetic data → 4-bit SFT → perplexity eval (own the negative result).
- npm packaging + cross-platform Claude Desktop auto-setup; Flask API + Docker for serving.

## Likely Interview Questions
1. What is MCP and why use it here instead of just prompting?
2. How do the tools stay grounded — what prevents the LLM from hallucinating findings?
3. Walk me through how `security_scan` handles Semgrep being absent or failing.
4. Why shell out to `git`/`semgrep` instead of libraries? What are the tradeoffs?
5. How does `validate_suggestion` work, and what are its false-positive/negative risks?
6. How do you infer the repo's language/framework, and when does that break?
7. Why LoRA + 4-bit quantization? What do r=64 and α=128 control?
8. What were your fine-tuning results, and what do they tell you?
9. Can I run the trained model from the repo right now?
10. Is the training data real? Where did it come from?
11. How is the project tested? What's your CI story?
12. The Flask API — is it secure to expose?
13. How would you measure whether this tool actually catches bugs?
14. How does the Node server talk to the Python model, and how do you handle timeouts?
15. What would you do next to make this production-worthy?

## Strong Answers (grounded in the repo)
1. MCP lets the LLM call deterministic tools; here it turns "review my code" into concrete actions
   (real diff, real Semgrep results) rather than ungrounded generation.
2. Findings come from Semgrep's actual output and the real git diff; the server just parses/filters
   and formats — it doesn't invent findings.
3. `handleSemgrepFailure` tries to parse any partial stdout; if none, it returns a clear
   "semgrep unavailable" notice so review can continue as AI-inference-only.
4. Shelling out reuses battle-tested tools and matches how developers run them; the tradeoff is a
   PATH dependency and IPC overhead, which I mitigate with timeouts and error formatting.
5. It counts brackets, checks merge markers, and applies language-specific regex checks (Python
   colons, Go `if err != nil`/`defer`, Rust `.unwrap()`, SQL concat). It's heuristic, so it can
   miss AST-level issues or false-positive on unusual formatting — I'd add real parsing to harden it.
6. Manifest presence (package.json/go.mod/etc.) plus weighted extension counts; framework from
   dependency names. It breaks on polyglot repos or unusual layouts, so I return signals for transparency.
7. LoRA trains small adapter matrices instead of full weights; 4-bit quantization fits an 8B model
   in limited VRAM. r is the adapter rank (capacity), α scales the update.
8. **Honest:** loss went 2.3934 → 2.3966 — no improvement — with an exploding gradient norm over
   ~31 epochs on 500 synthetic rows. I read that as overfit/instability and would fix LR, add grad
   clipping, cut epochs, and build a real eval set before claiming anything.
9. Not directly — the adapter weights aren't committed (only config + tokenizer), so I'd host the
   weights separately and add an inference smoke test.
10. It's synthetic: `generate_data.py` expands 9 templates into 500 examples. The "SecureCode-v2/OSS"
    mix in the original spec was aspirational and not implemented (`dataset_prep.py` is a stub).
11. Custom Node smoke scripts today; no CI. That's my top gap — I'd add GitHub Actions running
    `tsc --noEmit` and `npm test`, and convert smoke checks into real assertions.
12. No — it binds 0.0.0.0 with no auth. I'd add auth, rate-limiting, and input size limits before exposing it.
13. Seed `vulnerable-app/` with known issues and measure precision/recall of `security_scan` +
    `validate_suggestion` against that labeled set.
14. Node `spawn`s `python3`, pipes the request as JSON on stdin, reads JSON on stdout, with a
    3-minute timeout and handling for spawn error, non-zero exit, and parse failure.
15. Ship weights + inference test, add CI, add auth to the API, replace synthetic data with real
    reviews, and publish a detection benchmark.

## Weak Areas / Gaps (be ready)
- Fine-tune didn't converge; model weights not in repo — don't oversell the ML.
- No CI, no LICENSE (despite README's MIT claim), smoke tests only.
- Synthetic dataset; docs overstate maturity ("production-ready", "real users").
- Flask endpoint unauthenticated. Doc drift (README's hosted fallback isn't in the code).

## How To Defend Metrics
- Only cite counts you can point at in a file: 6 tools, 14 validator checks, 5 languages, 500
  examples/steps, LoRA r=64/α=128. These are all directly evidenced.
- Never state a model-accuracy gain. If asked for training numbers, quote the loss honestly and
  pivot to your diagnosis and fix plan.
- Label any latency/throughput as unmeasured, or add a benchmark first, then cite the real numbers.
- Frame the fine-tune as "pipeline built + experiment run + negative result diagnosed" — that's
  both true and interview-strong.
