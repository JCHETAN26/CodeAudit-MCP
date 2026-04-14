import os
import json
import random
from typing import List, Dict

# CodeSentinel MCP - Dataset Preparation Script
# Combines: SecureCode-v2, OSS Human Reviews, Synthetic Logic Pairs

def format_review_prompt(git_diff: str, review_notes: Dict[str, str]) -> str:
    """
    Formats the prompt matching the Principal Engineer schema: [Issue] -> [Impact] -> [Fix (Code Diff)]
    """
    system_prompt = (
        "You are a Principal Engineer. Review code concisely, prioritizing logic. "
        "Strictly structure responses as: [Issue] -> [Impact] -> [Fix (Code Diff)]."
    )
    
    formatted_review = (
        f"[Issue]: {review_notes.get('issue', 'N/A')}\n"
        f"[Impact]: {review_notes.get('impact', 'N/A')}\n"
        f"[Fix (Code Diff)]:\n{review_notes.get('fix', 'N/A')}"
    )
    
    return json.dumps({
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Please review this diff:\n{git_diff}"},
            {"role": "assistant", "content": formatted_review}
        ]
    })

def synthesize_dataset():
    """
    Stubs the loading of the various High-Signal Mix sources to output a robust fine-tuning dataset
    """
    print("Loading SecureCode-v2 (OWASP security)...")
    # Stub: securecode_data = load_dataset("securecode-v2")
    
    print("Loading OSS Human Reviews (Senior Engineer tone)...")
    # Stub: oss_data = load_dataset("oss-reviews")
    
    print("Loading Synthetic Negative/Positive pairs (logic edge cases)...")
    # Stub: synthetic_data = load_dataset("synthetic-logic-pairs")
    
    # Example raw data mapped conceptually
    raw_examples = [
        {
            "diff": "- def connect(db):\n-   return sqlite3.connect(db)\n+ def connect(db):\n+   # check access\n+   return sqlite3.connect(db)",
            "review": {
                "issue": "Missing input validation on SQLite connection.",
                "impact": "Potential Path Traversal or arbitrary database loading.",
                "fix": "```python\nimport os\nif not os.path.exists(db): raise ValueError('Invalid DB')\nreturn sqlite3.connect(db)\n```"
            }
        },
        {
            "diff": "+ for item in list_of_items:\n+   result += item",
            "review": {
                "issue": "Inefficient string concatenation in loop.",
                "impact": "O(N^2) time complexity. Will degrade performance with large lists.",
                "fix": "```python\nresult = ''.join(list_of_items)\n```"
            }
        }
    ]
    
    output_file = "codesentinel_finetune_dataset.jsonl"
    print(f"Formatting {len(raw_examples)} examples to {output_file}...")
    
    with open(output_file, 'w') as f:
        for ex in raw_examples:
            formatted = format_review_prompt(ex["diff"], ex["review"])
            f.write(formatted + "\n")
            
    print("Dataset generation complete. Optimized for Llama-3.1-8B-Instruct / Qwen2.5-Coder-7B fine-tuning schema.")

if __name__ == "__main__":
    synthesize_dataset()
