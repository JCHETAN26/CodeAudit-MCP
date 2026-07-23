# Metrics & Proof — CodeAudit-MCP

> Bottom line: the repo contains **exactly one class of hard numbers** — training-loss
> statistics — and those show the fine-tune did **not** improve. Everything else
> (test counts, latency, package size, "production-ready") is a self-authored doc claim
> without a supporting artifact. Treat model-quality/impact metrics as unproven.

## Verified Metrics
Metrics directly backed by an artifact in the repo.

| Metric | Value | Source / Evidence | Confidence | Resume-safe | Notes |
|---|---|---|---|---|---|
| MCP tools implemented | 6 tools + 1 prompt | `src/index.ts` (`registerTool`/`registerPrompt`) | 1.0 | yes | analyze_repo_context, get_git_diff, security_scan, validate_suggestion, review_code, mock_review |
| Patch-validation checks | 14 heuristic checks | `src/index.ts` `validateSuggestion` | 0.95 | yes | multi-language (Py/TS/Go/Java/Rust/SQL) |
| Languages inferred | 5 families | `src/index.ts` `inferPrimaryLanguage`/`inferFramework` | 0.9 | yes | JS/TS, Python, Go, Rust, Java |
| Fine-tune training steps | 500 | `training_metrics.json`, `checkpoint-500/trainer_state.json` | 1.0 | yes | max_steps=500 |
| LoRA config | r=64, alpha=128, 7 target modules | `train.py`, `adapter_config.json` | 1.0 | yes | q/k/v/o/gate/up/down_proj |
| Training loss (initial→final) | 2.3934 → 2.3966 | `training_metrics.json` | 1.0 | **no** | loss did not decrease |
| Loss improvement | −0.14% (worse) | `training_metrics.json` `loss_improvement_percent` | 1.0 | **no** | do NOT present as a gain |
| Perplexity (final) | ≈ 10.99 | `training_metrics.json` derived | 0.9 | **no** | high; unremarkable |
| Training epochs | ≈ 31.25 | `trainer_state.json` `epoch` | 1.0 | context | overfit regime on tiny set |
| Gradient norm @ step 500 | ≈ 2.9e12 | `trainer_state.json` | 1.0 | **no** | indicates instability |
| Dataset size | 500 rows, 9 unique templates | `codesentinel_MASTER_dataset.jsonl`, `generate_data.py` | 1.0 | context | synthetic |
| Node smoke-test suites | 4 (+3 aux scripts) | `scripts/test-*.js` | 0.9 | partial | not assertion-rich; no CI |

## Partially Verified Metrics
Plausible but not proven by an artifact; need confirmation before use.

| Metric | Claimed | Where claimed | Why unverified |
|---|---|---|---|
| "10+ tests pass" | 10+ | `PROJECT_STATUS.md`, README | No test report/CI output in repo; scripts are smoke tests |
| Scan latency "<5s small / 5–30s medium" | ranges | README "Performance" | No benchmark script or logged runs |
| npm package size ~50 MB | 50 MB | `PROJECT_STATUS.md` | No packed artifact / `npm pack` output |
| Cross-platform setup works | macOS/Win/Linux | `bin/setup.js`, docs | Code has OS branches; no test evidence per-OS |

## Unsupported Metrics (do NOT claim)
- Any "improved review accuracy / better than base model" — the only measured signal (loss) shows **no improvement**, and the adapter weights are **absent** from the repo (`codesentinel_lora_model/` has no `adapter_model.safetensors`).
- "Production-ready", "production-grade", real users, uptime, adoption, requests served.
- "Petabyte/enterprise scale", high throughput, concurrency benchmarks.
- Detection precision/recall for vulnerabilities — no labeled benchmark exists.
- Real-dataset provenance ("SecureCode-v2 / OSS Human Reviews") — `dataset_prep.py` is a stub; data is synthetic.

## Recommended Resume Metrics (safe to use)
- "Exposed **6 MCP tools + 1 prompt** to an LLM host." (evidence: `src/index.ts`)
- "**14** multi-language patch-validation heuristics across 5 language families." (evidence: `src/index.ts`)
- "Repo-context inference across **5 language ecosystems** and 10+ frameworks." (evidence: `src/index.ts`)
- "Built a **LoRA (r=64/α=128) SFT pipeline** for Llama-3.1-8B on a **500-example** synthetic dataset (**500 training steps**)." — describe as *pipeline built / experiment run*, **not** as an accuracy win.

## If You Need Real Impact Metrics — Add These
1. **Detection benchmark:** seed `vulnerable-app/` with N known issues; measure how many `security_scan` + `validate_suggestion` catch → precision/recall.
2. **Latency benchmark:** time `security_scan` on repos of varying size; commit the numbers.
3. **Model eval vs. base:** run `evaluate_model.py` for base vs. LoRA on a held-out set; report the delta (only claim if positive).
4. **CI report:** add `.github/workflows` running `tsc --noEmit` + `npm test`; the passing badge becomes citable evidence.
