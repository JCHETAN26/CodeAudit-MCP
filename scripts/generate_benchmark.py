#!/usr/bin/env python3
import json
import random
import argparse
import os
import hashlib
from datetime import datetime

SYSTEM_PROMPT = "You are a Principal Engineer. Review code concisely, prioritizing logic. Strictly structure responses as: [Issue] -> [Impact] -> [Fix (Code Diff)]."

# Define templates for different categories and hard negatives.
# A "hard negative" is suspicious but safe code where the model should output: "Looks good" or equivalent (no issue found).
TEMPLATES = [
    # --- SECURITY ---
    {
        "lang": "Python", "category": "Security", "is_hard_negative": False, "has_issue": True,
        "issue": "SQL injection vulnerability via f-string.",
        "impact": "An attacker can manipulate the query to access or delete arbitrary data.",
        "prompt_diff": "+ def get_user(db, username):\n+     return db.execute(f\"SELECT * FROM users WHERE username = '{username}'\")",
        "fix_diff": "```python\ndef get_user(db, username):\n    return db.execute(\"SELECT * FROM users WHERE username = ?\", (username,))\n```"
    },
    {
        "lang": "Python", "category": "Security", "is_hard_negative": True, "has_issue": False,
        "issue": "None", "impact": "None", "prompt_diff": "+ def get_user(db, username):\n+     # Suspicious looking query but uses parameterization correctly\n+     query = \"SELECT * FROM users WHERE username = ?\"\n+     return db.execute(query, (username,))",
        "fix_diff": "No issue found. The code is secure."
    },
    {
        "lang": "TypeScript", "category": "Security", "is_hard_negative": False, "has_issue": True,
        "issue": "Cross-Site Scripting (XSS) via innerHTML.",
        "impact": "Attacker can execute arbitrary JavaScript in the victim's browser.",
        "prompt_diff": "+ function renderMessage(msg: string) {\n+     document.getElementById('chat').innerHTML = msg;\n+ }",
        "fix_diff": "```typescript\nfunction renderMessage(msg: string) {\n    document.getElementById('chat').textContent = msg;\n}\n```"
    },
    {
        "lang": "Java", "category": "Security", "is_hard_negative": False, "has_issue": True,
        "issue": "Command Injection via Runtime.exec().",
        "impact": "Attacker can execute arbitrary system commands on the host server.",
        "prompt_diff": "+ public void pingIP(String ip) throws Exception {\n+     Runtime.getRuntime().exec(\"ping -c 1 \" + ip);\n+ }",
        "fix_diff": "```java\npublic void pingIP(String ip) throws Exception {\n    new ProcessBuilder(\"ping\", \"-c\", \"1\", ip).start();\n}\n```"
    },
    
    # --- CORRECTNESS ---
    {
        "lang": "Python", "category": "Correctness", "is_hard_negative": False, "has_issue": True,
        "issue": "Mutable default argument in function.",
        "impact": "State is shared across all function calls, leading to unpredictable data contamination.",
        "prompt_diff": "+ def append_item(item, elements=[]):\n+     elements.append(item)\n+     return elements",
        "fix_diff": "```python\ndef append_item(item, elements=None):\n    if elements is None:\n        elements = []\n    elements.append(item)\n    return elements\n```"
    },
    {
        "lang": "TypeScript", "category": "Correctness", "is_hard_negative": True, "has_issue": False,
        "issue": "None", "impact": "None",
        "prompt_diff": "+ async function processItems(items: number[]) {\n+     // Using map with Promise.all correctly\n+     await Promise.all(items.map(async (i) => await doWork(i)));\n+ }",
        "fix_diff": "No issue found. Asynchronous logic handles promises correctly."
    },
    {
        "lang": "Java", "category": "Correctness", "is_hard_negative": False, "has_issue": True,
        "issue": "Comparing Strings using '==' instead of '.equals()'.",
        "impact": "Evaluates reference equality instead of value equality, causing logic bugs.",
        "prompt_diff": "+ public boolean isTrue(String val) {\n+     return val == \"true\";\n+ }",
        "fix_diff": "```java\npublic boolean isTrue(String val) {\n    return \"true\".equals(val);\n}\n```"
    },

    # --- PERFORMANCE ---
    {
        "lang": "Java", "category": "Performance", "is_hard_negative": False, "has_issue": True,
        "issue": "String concatenation inside a loop.",
        "impact": "Creates excessive intermediate String objects, causing high memory usage and GC pressure.",
        "prompt_diff": "+ public String buildReport(List<String> items) {\n+     String report = \"\";\n+     for (String item : items) {\n+         report += item + \",\";\n+     }\n+     return report;\n+ }",
        "fix_diff": "```java\npublic String buildReport(List<String> items) {\n    StringBuilder report = new StringBuilder();\n    for (String item : items) {\n        report.append(item).append(\",\");\n    }\n    return report.toString();\n}\n```"
    },
    {
        "lang": "Python", "category": "Performance", "is_hard_negative": True, "has_issue": False,
        "issue": "None", "impact": "None",
        "prompt_diff": "+ def get_items(db):\n+     # Suspicious N+1, but prefetch_related is used correctly\n+     return list(Item.objects.prefetch_related('tags').all())",
        "fix_diff": "No issue found. ORM query is optimized."
    },
    {
        "lang": "TypeScript", "category": "Performance", "is_hard_negative": False, "has_issue": True,
        "issue": "Inefficient React component re-rendering due to inline object.",
        "impact": "Triggers cascaded re-renders of child components even when props haven't conceptually changed.",
        "prompt_diff": "+ function UserProfile({ user }) {\n+     return <Avatar style={{ margin: 10 }} url={user.avatar} />;\n+ }",
        "fix_diff": "```typescript\nconst AVATAR_STYLE = { margin: 10 };\nfunction UserProfile({ user }) {\n    return <Avatar style={AVATAR_STYLE} url={user.avatar} />;\n}\n```"
    },

    # --- MAINTAINABILITY ---
    {
        "lang": "TypeScript", "category": "Maintainability", "is_hard_negative": False, "has_issue": True,
        "issue": "Magic numbers used in conditionals.",
        "impact": "Hard to understand the business logic. Changing the value requires hunting down all occurrences.",
        "prompt_diff": "+ if (user.status === 2 && user.age > 18) {\n+     grantAccess(user);\n+ }",
        "fix_diff": "```typescript\nconst STATUS_ACTIVE = 2;\nconst MIN_AGE = 18;\nif (user.status === STATUS_ACTIVE && user.age > MIN_AGE) {\n    grantAccess(user);\n}\n```"
    },
    {
        "lang": "Python", "category": "Maintainability", "is_hard_negative": False, "has_issue": True,
        "issue": "Broad Exception catching without logging.",
        "impact": "Silently swallows all errors, making debugging extremely difficult.",
        "prompt_diff": "+ try:\n+     process_data()\n+ except Exception:\n+     pass",
        "fix_diff": "```python\nimport logging\ntry:\n    process_data()\nexcept Exception as e:\n    logging.error(\"Failed to process data\", exc_info=True)\n```"
    },
    {
        "lang": "Java", "category": "Maintainability", "is_hard_negative": True, "has_issue": False,
        "issue": "None", "impact": "None",
        "prompt_diff": "+ // Suppressing warnings specifically for a legacy API integration\n+ @SuppressWarnings(\"unchecked\")\n+ public List<String> getLegacyData() {\n+     return (List<String>) legacyService.getData();\n+ }",
        "fix_diff": "No issue found. The suppression is justified and isolated."
    }
]

def generate_benchmark(output_path: str, count: int = 200, seed: int = 42):
    random.seed(seed)
    var_names = ["items", "records", "data", "users", "configs", "payloads"]
    
    with open(output_path, 'w') as f:
        for i in range(count):
            template = random.choice(TEMPLATES)
            
            # Sub logic
            v = random.choice(var_names)
            p_diff = template["prompt_diff"].replace("items", v).replace("users", v)
            f_diff = template["fix_diff"].replace("items", v).replace("users", v)
            
            if template["has_issue"]:
                formatted_review = (
                    f"[Issue]: {template['issue']}\n"
                    f"[Impact]: {template['impact']}\n"
                    f"[Fix (Code Diff)]:\n{f_diff}"
                )
            else:
                formatted_review = f"[Issue]: None\n[Impact]: None\n[Fix (Code Diff)]:\n{f_diff}"
            
            entry = {
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Please review this diff:\n{p_diff}"},
                    {"role": "assistant", "content": formatted_review}
                ],
                "metadata": {
                    "lang": template["lang"],
                    "category": template["category"],
                    "is_hard_negative": template["is_hard_negative"],
                    "has_issue": template["has_issue"],
                    "id": i
                }
            }
            f.write(json.dumps(entry) + "\n")
            
    # Generate Metadata
    with open(output_path, "rb") as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()
        
    metadata = {
        "benchmark_file": output_path,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "seed": seed,
        "sha256_hash": file_hash,
        "total_examples": count
    }
    
    meta_path = output_path.replace(".jsonl", "_metadata.json")
    with open(meta_path, "w") as mf:
        json.dump(metadata, mf, indent=2)
        
    print(f"✅ Generated {count} benchmark entries in '{output_path}'.")
    print(f"✅ Hash preserved in '{meta_path}' (SHA-256: {file_hash[:8]}...).")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate frozen benchmark dataset")
    parser.add_argument("--force", action="store_true", help="Overwrite existing benchmark")
    args = parser.parse_args()
    
    out_file = "codesentinel_benchmark.jsonl"
    
    if os.path.exists(out_file) and not args.force:
        print(f"❌ Error: {out_file} already exists.")
        print("The benchmark dataset is frozen. Use --force to deliberately overwrite.")
        exit(1)
        
    generate_benchmark(out_file, 200, seed=42)
