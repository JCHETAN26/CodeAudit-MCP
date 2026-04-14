# Deploy CodeSentinel to Hugging Face Spaces

This guide walks you through deploying CodeSentinel's trained model to Hugging Face Spaces as a REST API that your MCP server can call.

## 🚀 Deployment Overview

**Current Setup:**
- MCP Server: Runs on your Mac (in Claude Desktop)
- Model: Runs on HF Spaces (GPU-powered)
- Communication: REST API calls over HTTPS

This makes CodeSentinel work on any machine without GPU requirements.

---

## 📋 Prerequisites

1. **Hugging Face Account** (free at hugginface.co)
2. **Git CLI** (already have it: `git --version`)
3. **Model artifacts** (already have them in `codesentinel_artifacts/`)

---

## 🎬 Step-by-Step Deployment

### Step 1: Create HF Space

1. Go to [huggingface.co/spaces](https://huggingface.co/spaces)
2. Click **"Create new Space"**
3. Fill in:
   - **Space name:** `codesentinel` (or similar)
   - **License:** `mit` (or your choice)
   - **Space hardware:** `CPU` (we'll upgrade to GPU in Step 3)
   - **Space SDK:** Select `Docker`
   - Click **"Create Space"**

4. Once created, you'll see a Space dashboard

### Step 2: Prepare Files for Upload

Create a temporary directory and copy files:

```bash
mkdir ~/hf_spaces_codesentinel
cd ~/hf_spaces_codesentinel

# Copy the Flask app
cp /Users/chetan/Code-Review-Agent-MCP/hf_spaces_app.py ./app.py

# Copy requirements
cp /Users/chetan/Code-Review-Agent-MCP/hf_spaces_requirements.txt ./requirements.txt

# Copy Python modules
cp /Users/chetan/Code-Review-Agent-MCP/model_loader.py ./model_loader.py

# Copy model artifacts
cp -r /Users/chetan/Code-Review-Agent-MCP/codesentinel_artifacts ./

# Create Dockerfile (HF will auto-detect this)
cat > Dockerfile << 'EOF'
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .
COPY model_loader.py .
COPY codesentinel_artifacts ./codesentinel_artifacts

# Expose the port Flask runs on
EXPOSE 7860

# Run the app
CMD ["python", "app.py"]
EOF

# Initiate git
git init
git add .
```

### Step 3: Configure Space for GPU

1. Go back to your Space settings
2. Click **"Settings"** (in the top right of your Space page)
3. Under **"Runtime"** → **"Hardware"** → Select `GPU - NVIDIA A100-80GB` (or `T4` if A100 unavailable)
4. Click **"Save"**

The Space will restart with GPU. This gives your model the memory it needs.

### Step 4: Push Code to HF

Clone the Space repository and push your code:

```bash
# Get the Space URL from HF (look for green "Clone repository" button)
# It should look like: https://huggingface.co/spaces/YOUR-USERNAME/codesentinel

cd ~/hf_spaces_codesentinel

# Add HF remote (replace YOUR-USERNAME)
git remote add origin https://huggingface.co/spaces/YOUR-USERNAME/codesentinel

# Configure git (one-time)
git config --global user.email "your-email@example.com"
git config --global user.name "Your Name"

# Commit
git commit -m "Initial CodeSentinel API deployment"

# Push to HF Spaces
git push origin main
```

When prompted, use your HF token as the password or set up SSH keys.

### Step 5: Wait for Deployment

1. Go back to your Space page
2. Watch the **"Logs"** tab (bottom of page)
3. It will download dependencies and build the Docker image (~3-5 minutes)
4. Once you see "Running on http://0.0.0.0:7860", it's ready!

---

## ✅ Step 6: Get Your API Endpoint

Once deployed, your API endpoint is:

```
https://YOUR-USERNAME-codesentinel.hf.space/review
```

### Example Request

```bash
curl -X POST https://YOUR-USERNAME-codesentinel.hf.space/review \
  -H "Content-Type: application/json" \
  -d '{
    "file": "app.py",
    "language": "python",
    "code": "query = f\"SELECT * FROM users WHERE id = {user_id}\"",
    "context": "Database query"
  }'
```

You should get back a JSON response with the code review!

---

## 🔗 Step 7: Update MCP Server

The MCP server is already configured to call your HF Spaces API. It looks for either:

1. **Environment variable:** `CODESENTINEL_API_URL`
2. **Default:** `https://chetanshivnani-codesentinel.hf.space/review`

### Update if Your URL is Different

If your HF Space has a different username, update the MCP config:

**Option A: Update in code** (edit `src/index.ts` line ~26)
```typescript
const HF_SPACES_API_URL = process.env.CODESENTINEL_API_URL || "https://YOUR-USERNAME-codesentinel.hf.space/review";
```

Then rebuild:
```bash
npm run build
```

**Option B: Set environment variable** (easier)
```bash
export CODESENTINEL_API_URL="https://YOUR-USERNAME-codesentinel.hf.space/review"
npm start
```

---

## 🧪 Step 8: Test End-to-End

1. **Restart Claude Desktop:**
   ```bash
   killall -9 Claude
   sleep 2
   # Open Claude again
   ```

2. **Ask Claude to review code:**
   > "Use the review_code tool to analyze this: `query = f"SELECT * FROM users WHERE id = {user_id}"`"

3. **You should see:**
   - Claude calls `review_code` tool
   - Tool calls your HF Spaces API
   - Returns code review result
   - ✅ Everything works!

---

## 🚨 Troubleshooting

### Model Takes a Long Time to Load
- **First request:** ~30-60 seconds (model loads from disk)
- **Subsequent requests:** ~2-5 seconds
- This is normal! Model is 640 MB with 4-bit quantization

### API Returns 500 Error
- Check HF Space **Logs** tab
- Look for Python error messages
- Most common: Missing dependencies (check `requirements.txt`)

### HF Space Stops After a While
- Free tier has resource limits (~1GB RAM for inference)
- Model uses ~4-6 GB
- **Solution:** Upgrade to paid tier or use smaller model

### SSL Certificate Errors
- This shouldn't happen with HF (they handle HTTPS)
- If it does, check your internet connection

### API URL Not Updating
- Make sure you did `npm run build` after code changes
- Restart Claude Desktop completely (`killall -9 Claude`)
- Check in MCP settings that it's using the right endpoint

---

## 📊 Performance Expectations

| Metric | Value |
|--------|-------|
| Cold start (first request) | ~30-60 sec |
| Warm start (cached) | ~2-5 sec |
| API response time | <2 sec |
| Model memory | ~6-8 GB (HF handles it) |
| Free tier support | Yes (rate limited) |

---

## 🔐 Security Notes

- Your API endpoint is public (anyone can call it)
- If you want authentication, add an API key check:
  ```python
  api_key = request.headers.get('X-API-Key')
  if api_key != os.environ.get('API_SECRET'):
      return {"error": "Unauthorized"}, 401
  ```

- Store secrets in HF Space Settings → Secrets

---

## 📚 Next Steps

1. ✅ Deploy to HF Spaces
2. ✅ Get API endpoint
3. ✅ Update MCP (optional, if URL different)
4. ✅ Test in Claude Desktop
5. 🎉 Start using CodeSentinel!

---

## 🆘 Need Help?

- **HF Spaces docs:** https://huggingface.co/docs/hub/spaces
- **Flask docs:** https://flask.palletsprojects.com/
- **CodeSentinel issues:** Check DEPLOYMENT_PROGRESS.md for status

