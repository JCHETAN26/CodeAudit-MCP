# CodeSentinel - Friends & Family Testing Guide

> **Try the newest AI code reviewer trained to catch distributed system bugs, race conditions, and security vulnerabilities.**

## 🚀 Quick Start (3 Steps)

### **Step 1: Install Claude Desktop**
If you don't have it: https://claude.ai/download

### **Step 2: Copy the CodeSentinel Config**

Ask me for the latest `claude_desktop_config.json` file, or use this:

```json
{
  "mcpServers": {
    "codesentinel": {
      "command": "node",
      "args": [
        "/Users/chetan/Code-Review-Agent-MCP/build/index.js"
      ]
    }
  }
}
```

Place it at:
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**On Windows/Linux:** Different path (ask if needed)

### **Step 3: Restart Claude & Test**

```bash
# Kill Claude
killall -9 Claude

# Reopen Claude from Applications
```

Then ask Claude:
> "Use the review_code tool to analyze this code: `query = f"SELECT * FROM users WHERE id = {user_id}"`"

---

## 🧪 What to Test

### **Test 1: Security Issues**
Ask Claude:
> "Review this for SQL injection: `query = f"SELECT * FROM users WHERE id = {user_id}"`"

**Expected:** CodeSentinel should flag the SQL injection vulnerability.

### **Test 2: Race Conditions**
```go
var counter = 0
go func() { counter++ }()
go func() { counter++ }()
```

Ask Claude:
> "Analyze this Go code for race conditions with review_code"

**Expected:** Should flag data race.

### **Test 3: Resource Leaks**
```python
def fetch_data(url):
    conn = open_connection(url)
    data = conn.read()
    # Oops, forgot to close!
```

Ask Claude:
> "Review this code for resource leaks using review_code"

**Expected:** Should flag missing connection close.

---

## 📊 Feedback We Want

After testing, please tell us:

1. **Did CodeSentinel catch the bugs?** (Yes/No)
2. **Were the suggestions useful?** (1-10)
3. **Speed acceptable?** (Fast/OK/Slow)
4. **Any false positives?** (Yes/No - describe)
5. **Features you'd want?** (Free text)

**Send feedback to:** chetan@example.com (or however you know me)

---

## ⚡ Cloud-Powered (No GPU Needed)

CodeSentinel runs on **Together.AI's infrastructure**, not your machine. So:

- ✅ **No GPU required** — works on any computer
- ✅ **Fast response** — usually 2-5 seconds
- ✅ **Free to try** — shared API key included
- ✅ **Trained model** — finds specific patterns others miss

---

## 🐛 If Something Breaks

**Issue:** Claude says tool is not available
- **Fix:** Close Claude (⌘Q), wait 2 seconds, reopen

**Issue:** Takes forever (>10 seconds)
- **Normal:** First request loads model (~30 sec), then fast
- **If >1 minute:** Tell me with details

**Issue:** Error message about API
- **Check:** Together.AI API key is valid
- **Send me:** The full error message

---

## 💬 Questions?

- **"What's different about CodeSentinel?"** — It's trained specifically for distributed systems & concurrency bugs, not just general code issues
- **"Why free?"** — We're in testing phase! Your feedback helps us improve
- **"Can I use it in production?"** — Not yet, but soon! This is beta
- **"What's it built with?"** — Llama 3.1 8B + custom fine-tuning on bug patterns

---

## 🙏 Thank You!

Thanks for helping test CodeSentinel. Your bug reports and feedback make this better for everyone.

**Share your experience with friends!** 🚀

