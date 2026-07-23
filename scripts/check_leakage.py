#!/usr/bin/env python3
"""
Check for data leakage between the frozen benchmark set and the training dataset.
Uses bigram Jaccard similarity to detect near-duplicates, renamed variables, or identical templates.
"""

import json
import os
import sys

def get_bigrams(text):
    """Return a set of character bigrams for a given string."""
    text = text.lower()
    return set(text[i:i+2] for i in range(len(text)-1))

def jaccard_similarity(set1, set2):
    """Calculate Jaccard similarity between two sets."""
    if not set1 or not set2:
        return 0.0
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    return intersection / union if union > 0 else 0.0

def extract_diff(sample):
    """Extract the code diff from the user prompt."""
    messages = sample.get("messages", [])
    for m in messages:
        if m.get("role") == "user":
            content = m.get("content", "")
            # Return the text after "Please review this diff:\n"
            parts = content.split(":\n", 1)
            return parts[1] if len(parts) > 1 else content
    return ""

def load_jsonl_diffs(path):
    diffs = []
    if not os.path.exists(path):
        return diffs
        
    with open(path, 'r') as f:
        for i, line in enumerate(f):
            if not line.strip(): continue
            try:
                sample = json.loads(line)
                diff = extract_diff(sample)
                diffs.append({"id": sample.get("metadata", {}).get("id", i), "diff": diff})
            except Exception as e:
                pass
    return diffs

def main():
    print("="*70)
    print("CodeSentinel Dataset Leakage Checker")
    print("="*70)
    
    benchmark_path = "codesentinel_benchmark.jsonl"
    train_path = "codesentinel_MASTER_dataset.jsonl"
    
    if not os.path.exists(benchmark_path):
        print(f"❌ Error: Benchmark {benchmark_path} not found.")
        sys.exit(1)
        
    if not os.path.exists(train_path):
        print(f"⚠️ Warning: Training set {train_path} not found. Skipping leakage check.")
        sys.exit(0)
        
    print(f"Loading benchmark set: {benchmark_path}...")
    bench_diffs = load_jsonl_diffs(benchmark_path)
    
    print(f"Loading training set: {train_path}...")
    train_diffs = load_jsonl_diffs(train_path)
    
    print(f"\nComparing {len(bench_diffs)} benchmark examples against {len(train_diffs)} training examples...")
    
    THRESHOLD = 0.85
    leakage_found = False
    
    # Fast bigram precomputation
    train_data = [{"id": t["id"], "bigrams": get_bigrams(t["diff"])} for t in train_diffs if t["diff"]]
    
    for b in bench_diffs:
        if not b["diff"]: continue
        b_bigrams = get_bigrams(b["diff"])
        
        max_sim = 0.0
        best_match_id = None
        
        for t in train_data:
            sim = jaccard_similarity(b_bigrams, t["bigrams"])
            if sim > max_sim:
                max_sim = sim
                best_match_id = t["id"]
                
        if max_sim >= THRESHOLD:
            print(f"\n❌ LEAKAGE DETECTED: Benchmark ID {b['id']} has {max_sim*100:.1f}% overlap with Training ID {best_match_id}")
            leakage_found = True
            
    if leakage_found:
        print("\n❌ Benchmark is invalid due to dataset leakage. Please remove overlapping examples from the training set or regenerate the benchmark with distinct templates.")
        sys.exit(1)
    else:
        print(f"\n✅ PASS: No dataset leakage found (Max similarity threshold < {THRESHOLD*100}%).")
        sys.exit(0)

if __name__ == "__main__":
    main()
