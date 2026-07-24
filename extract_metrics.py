#!/usr/bin/env python3
"""
Extract and calculate benchmark metrics from CodeAudit evaluation
Outputs the comprehensive resume-ready metrics table, detailed category F1s, and raw Confusion Matrices.
"""

import json
from pathlib import Path

def extract_evaluation_metrics():
    """Extract and format metrics from evaluation_results.json"""
    
    eval_results_path = Path("evaluation_results.json")
    
    if not eval_results_path.exists():
        print(f"Error: {eval_results_path} not found. Run evaluate_model.py first.")
        return
    
    with open(eval_results_path, 'r') as f:
        results = json.load(f)
        
    dataset_size = results.get("dataset_size", 200)
    gpu_util = results.get("gpu_utilization_gb", 0.0)
    baselines = results.get("baselines", {})
    
    semgrep = baselines.get("Semgrep", {})
    base_no_prompt = baselines.get("BaseModel_NoPrompt", {})
    base_engineered = baselines.get("BaseModel_Engineered", {})
    fine_tuned = baselines.get("CodeAudit_FineTuned", {})
    
    if not fine_tuned or not base_engineered:
        print("Missing required baselines in evaluation_results.json. Did you run evaluate_model.py?")
        return

    def m(model_data):
        if not model_data: 
            return {"Precision": 0, "Recall": 0, "F1": 0, "FPR": 0, "unsupported": 0, "TP": 0, "FP": 0, "TN": 0, "FN": 0}
        o = model_data.get("metrics", {}).get("overall", {})
        return {
            "Precision": o.get("Precision", 0),
            "Recall": o.get("Recall", 0),
            "F1": o.get("F1", 0),
            "FPR": o.get("FPR", 0),
            "unsupported": o.get("unsupported", 0),
            "TP": o.get("TP", 0),
            "FP": o.get("FP", 0),
            "TN": o.get("TN", 0),
            "FN": o.get("FN", 0)
        }

    s_m = m(semgrep)
    b_m = m(base_no_prompt)
    be_m = m(base_engineered)
    ft_m = m(fine_tuned)
    
    total_positive = ft_m["TP"] + ft_m["FN"]
    total_negative = ft_m["TN"] + ft_m["FP"]

    print("="*80)
    print("CodeAudit-MCP Rigorous Benchmark Metrics Report")
    print("="*80)
    
    print("\n### 1. Overall Performance Comparison\n")
    print(f"{'Model':<20} | {'Precision':<9} | {'Recall':<6} | {'F1':<5} | {'FPR':<5} | {'Unsupported findings':<20}")
    print("-" * 80)
    print(f"{'Semgrep':<20} | {s_m['Precision']:<9.2f} | {s_m['Recall']:<6.2f} | {s_m['F1']:<5.2f} | {s_m['FPR']:<5.2f} | {s_m['unsupported']:<20}")
    print(f"{'Base Llama':<20} | {b_m['Precision']:<9.2f} | {b_m['Recall']:<6.2f} | {b_m['F1']:<5.2f} | {b_m['FPR']:<5.2f} | {b_m['unsupported']:<20}")
    print(f"{'Prompted Base':<20} | {be_m['Precision']:<9.2f} | {be_m['Recall']:<6.2f} | {be_m['F1']:<5.2f} | {be_m['FPR']:<5.2f} | {be_m['unsupported']:<20}")
    print(f"{'Fine-Tuned Llama':<20} | {ft_m['Precision']:<9.2f} | {ft_m['Recall']:<6.2f} | {ft_m['F1']:<5.2f} | {ft_m['FPR']:<5.2f} | {ft_m['unsupported']:<20}")
    
    print("\n### 2. Confusion Matrices (Ground Truth: Positives={}, Negatives={})\n".format(total_positive, total_negative))
    print(f"{'Model':<20} | {'TP':<4} | {'FP':<4} | {'TN':<4} | {'FN':<4}")
    print("-" * 45)
    print(f"{'Semgrep':<20} | {s_m['TP']:<4} | {s_m['FP']:<4} | {s_m['TN']:<4} | {s_m['FN']:<4}")
    print(f"{'Base Llama':<20} | {b_m['TP']:<4} | {b_m['FP']:<4} | {b_m['TN']:<4} | {b_m['FN']:<4}")
    print(f"{'Prompted Base':<20} | {be_m['TP']:<4} | {be_m['FP']:<4} | {be_m['TN']:<4} | {be_m['FN']:<4}")
    print(f"{'Fine-Tuned Llama':<20} | {ft_m['TP']:<4} | {ft_m['FP']:<4} | {ft_m['TN']:<4} | {ft_m['FN']:<4}")
    
    print(f"\n> *Fine-tuned model produced {ft_m['FP']} false positives across {total_negative} clean/hard-negative examples.*")
    
    print("\n### 3. Fine-Tuned Model Category Breakdown\n")
    by_cat = fine_tuned.get("metrics", {}).get("by_category", {})
    sec = by_cat.get("Security", {})
    cor = by_cat.get("Correctness", {})
    per = by_cat.get("Performance", {})
    mai = by_cat.get("Maintainability", {})
    
    print(f"  Security F1:        {sec.get('F1', 0):.2f}")
    print(f"  Correctness F1:     {cor.get('F1', 0):.2f}")
    print(f"  Performance F1:     {per.get('F1', 0):.2f}")
    print(f"  Maintainability F1: {mai.get('F1', 0):.2f}")
    
    print("\n### 4. Serving & Infrastructure\n")
    print(f"  Benchmark size:        {dataset_size} examples")
    print(f"  Training-set size:     500 examples")
    print(f"  Hardware (Inference):  [GPU_MODEL_PLACEHOLDER]")
    print(f"  Quantization:          4-bit LoRA (Unsloth)")
    print(f"  p50 inference latency: {fine_tuned.get('p50_latency', 0):.3f}s")
    print(f"  p95 inference latency: {fine_tuned.get('p95_latency', 0):.3f}s")
    print(f"  Tokens per second:     {fine_tuned.get('tps', 0):.1f}")
    print(f"  Peak GPU memory:       {gpu_util:.1f} GB")

    print("\n" + "="*80)
    print("RESUME-READY STATEMENT")
    print("="*80)
    
    unsupported_reduction = 0
    if be_m['unsupported'] > 0:
        unsupported_reduction = ((be_m['unsupported'] - ft_m['unsupported']) / be_m['unsupported']) * 100
        
    statement = (
        f"Improved diff-level issue-detection F1 from {be_m['F1']:.2f} to {ft_m['F1']:.2f} over the best prompt-engineered baseline "
        f"while reducing heuristic-flagged unsupported findings by {unsupported_reduction:.0f}% on a rigorously held-out {dataset_size}-diff benchmark."
    )
    
    print(f"\n{statement}\n")
    print("="*80)

if __name__ == "__main__":
    extract_evaluation_metrics()
