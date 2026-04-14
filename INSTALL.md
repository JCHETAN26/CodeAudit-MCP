# CodeSentinel npm Package - Installation Guide for Friends & Family

> **One command to install. Automatically configures Claude Desktop. Works on Mac, Windows, Linux.**

## 🚀 Quick Start (30 seconds)

### For Your Friends/Family:

```bash
npm install -g codesentinel-mcp
```

That's it! 🎉

---

## What Happens Automatically

When they run the above command:
1. ✅ Installs CodeSentinel globally
2. ✅ Automatically configures Claude Desktop
3. ✅ Shows setup completion message
4. ✅ Ready to use immediately

---

## First Use

### Step 1: Restart Claude Desktop
Close and reopen Claude completely.

### Step 2: Start CodeSentinel
```bash
codesentinel-mcp start
```

Or leave it running in background:
```bash
codesentinel-mcp start &
```

### Step 3: Use in Claude
Ask Claude:
> "Use the review_code tool to analyze this code: `query = f"SELECT * FROM users WHERE id = {user_id}"`"

Claude will use CodeSentinel to review the code! 🎉

---

## Available Commands

```bash
codesentinel-mcp              # Start the server (default)
codesentinel-mcp setup        # Manually configure Claude Desktop
codesentinel-mcp help         # Show help
```

---

## ✅ What They Need

- **Node.js** >= 20.0.0 (check: `node --version`)
- **Claude Desktop** installed
- **npm** (comes with Node.js)

## ❌ What They Don't Need

- ❌ Python
- ❌ GPU
- ❌ Docker
- ❌ Manual configuration
- ❌ API keys
- ❌ VPS

All handled automatically! ✨

---

## Troubleshooting

### Q: "Command not found: codesentinel-mcp"
**Answer:** Node.js isn't installed or npm wasn't updated.
```bash
# Install Node.js from: https://nodejs.org/
# Then try again:
npm install -g codesentinel-mcp
```

### Q: "Tool is not available in Claude"
**Answer:** Restart Claude Desktop completely (⌘Q + reopen).

### Q: "Takes forever to load"
**Answer:** First request loads the model (~30-60 sec). Subsequent requests are fast.

### Q: "Can't find config file"
**Answer:** Setup auto-handles it, but if needed:
```bash
codesentinel-mcp setup
```

---

## For Different Operating Systems

### 🍎 macOS
```bash
npm install -g codesentinel-mcp
# Config location: ~/Library/Application Support/Claude/claude_desktop_config.json
```

### 🪟 Windows
```bash
npm install -g codesentinel-mcp
# Config location: %APPDATA%\Claude\claude_desktop_config.json
```

### 🐧 Linux
```bash
npm install -g codesentinel-mcp
# Config location: ~/.config/Claude/claude_desktop_config.json
```

---

## Uninstall

If they want to remove it:
```bash
npm uninstall -g codesentinel-mcp
```

(Config in Claude Desktop is safe—can be removed manually if needed)

---

## What Gets Installed

- ✅ **MCP Server** — Runs as background process
- ✅ **CLI Tool** — `codesentinel-mcp` command
- ✅ **Auto-Setup** — Configures Claude Desktop automatically
- ✅ **All Dependencies** — Included automatically

**Size:** ~50 MB (includes dependencies, model runs locally)

---

## How It Works Under the Hood

```
npm install -g codesentinel-mcp
    ↓
Installs package + dependencies
    ↓
Runs: node bin/setup.js (postinstall hook)
    ↓
Auto-detects OS
    ↓
Locates Claude Desktop config
    ↓
Adds CodeSentinel MCP server
    ↓
Shows success message
    ↓
✅ Ready to use!
```

---

## Feedback

After testing, please share:
1. ✅ Did it work first try?
2. ✅ Speed: Fast/OK/Slow?
3. ✅ Any bugs?
4. ✅ Feature requests?

Send feedback to: chetan@example.com

---

## Next Steps

### For Chetan (You)

1. **Build & Test Locally:**
   ```bash
   npm run build
   npm test
   ```

2. **Install Locally to Test:**
   ```bash
   npm install -g ./
   ```

3. **Publish to npm (when ready):**
   ```bash
   npm login
   npm publish
   ```

4. **Or Share GitHub Link (for beta):**
   ```
   npm install -g github:chetanshivnani/CodeSentinel-MCP
   ```

### For Your Friends

Just share:
```
npm install -g codesentinel-mcp
```

—

## 📚 Documentation

- **README.md** — Full documentation
- **NPM_PACKAGE_STATUS.md** — Development status
- **FRIENDS_TESTING_GUIDE.md** — Testing guide

---

**Version:** 2.0.0  
**Platform Support:** macOS, Windows, Linux  
**License:** MIT  
**Status:** Ready for distribution ✅
