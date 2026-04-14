# CodeSentinel - Self-Hosted VPS Deployment

> Deploy your trained model on a cheap VPS ($5/month) for reliable friends & family testing

## 📋 Overview

| Component | Cost | Notes |
|-----------|------|-------|
| **VPS** | $5/month | Linode / DigitalOcean |
| **Model** | $0 | Your Llama 3.1 8B + LoRA |
| **Hosting** | $0 | You manage it |
| **Domain** (optional) | $0-12/year | Use IP for now |
| **Total** | **$5/month** | All-in cost |

---

## 🎯 Quick Path (30 minutes)

### **Step 1: Create VPS** (5 min)

Choose one:

**Option A: Linode** (Recommended)
1. Go to https://www.linode.com
2. Sign up, add payment method
3. Create Linode → Select:
   - **Image:** Ubuntu 24.04 LTS
   - **Region:** Closest to you
   - **Plan:** Linode 4GB ($8/mo, OK) or Linode 2GB ($6/mo, tight fit)
   - **Label:** `codesentinel` 
4. Click Create
5. Wait ~2 minutes for it to boot

**Option B: DigitalOcean**
1. Go to https://www.digitalocean.com  
2. Sign up, add payment method
3. Create Droplet:
   - **Image:** Ubuntu 24.04
   - **Size:** $6/month (2GB RAM)
   - **Region:** Closest to you
   - **Name:** `codesentinel`
4. Click Create Droplet

### **Step 2: Connect to VPS** (2 min)

You'll get an **IP address** like `192.0.2.100`

```bash
# SSH into your VPS (from your Mac)
ssh root@192.0.2.100

# First time, it'll ask "Are you sure?" → type 'yes'
```

If you don't have SSH keys set up:
- Linode: They email a root password
- DigitalOcean: Same

### **Step 3: Install Prerequisites** (3 min)

```bash
# Update system
apt update
apt upgrade -y

# Install curl (needed for Ollama)
apt install -y curl git

# Install Docker (optional but easier)
curl -fsSL https://get.docker.com | sh
```

### **Step 4: Install Ollama** (2 min)

```bash
# Download and run Ollama installer
curl https://ollama.ai/install.sh | sh

# Start Ollama service
systemctl start ollama
systemctl enable ollama  # Auto-start on reboot

# Wait 10 seconds for it to initialize
sleep 10
```

### **Step 5: Upload Your Model** (10 min)

From your Mac, copy your trained model to VPS:

```bash
# On your Mac:
scp -r /Users/chetan/Code-Review-Agent-MCP/codesentinel_artifacts root@192.0.2.100:/root/models

# Also copy the model loader script
scp /Users/chetan/Code-Review-Agent-MCP/model_loader.py root@192.0.2.100:/root/codesentinel/
```

On the VPS:
```bash
# Make sure directory exists
mkdir -p /root/models

# The files are now on your VPS!
ls /root/models/
```

### **Step 6: Create Flask API Server** (On VPS)

Create `/root/codesentinel/app.py`:

```python
from flask import Flask, request, jsonify
from model_loader import load_model_and_tokenizer
import torch

app = Flask(__name__)

# Load model on startup (happens once)
try:
    model, tokenizer = load_model_and_tokenizer()
    print("✅ Model loaded successfully")
except Exception as e:
    print(f"❌ Failed to load model: {e}")
    model = None
    tokenizer = None

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "model_loaded": model is not None})

@app.route('/review', methods=['POST'])
def review():
    if not model or not tokenizer:
        return jsonify({"error": "Model not loaded"}), 500
    
    data = request.json
    code = data.get('code', '')
    language = data.get('language', 'python')
    
    prompt = f"""Analyze this {language} code for bugs, security issues, and resource leaks.
Return ONLY valid JSON:
{{
  "issues": [{{"severity": "CRITICAL|HIGH|MEDIUM|LOW", "type": "string", "message": "string"}}],
  "summary": "string",
  "suggestions": ["string"],
  "security_concerns": ["string"]
}}

Code:
```{language}
{code}
```"""
    
    try:
        # Generate response
        inputs = tokenizer(prompt, return_tensors="pt")
        outputs = model.generate(**inputs, max_new_tokens=512)
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Try to parse JSON from response
        import json
        import re
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            result = json.loads(match.group())
            return jsonify(result)
        else:
            return jsonify({
                "error": "Could not parse model output",
                "issues": [],
                "summary": response[:200],
                "suggestions": [],
                "security_concerns": []
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
```

### **Step 7: Start the Server** (On VPS)

```bash
cd /root/codesentinel

# Install Flask
pip install flask torch transformers peft accelerate bitsandbytes

# Run the app
python app.py
```

You should see:
```
✅ Model loaded successfully
 * Running on http://0.0.0.0:5000
```

### **Step 8: Update MCP to Use VPS** (On your Mac)

Edit `src/index.ts` - replace the Together.AI config with:

```typescript
// VPS Configuration
const VPS_API_URL = process.env.VPS_API_URL || "http://192.0.2.100:5000/review";  // Update IP!
const USE_VPS = process.env.USE_VPS === "true";
```

In `generateCodeReview()`:
```typescript
async function generateCodeReview(request: CodeReviewRequest): Promise<CodeReviewResult> {
  if (USE_VPS) {
    return generateCodeReviewVPS(request);
  }
  // ... fallback to other options
}

async function generateCodeReviewVPS(request: CodeReviewRequest): Promise<CodeReviewResult> {
  try {
    const response = await fetch(VPS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      return { error: `VPS error: ${response.status}`, issues: [], summary: "", suggestions: [], security_concerns: [] };
    }

    return (await response.json()) as CodeReviewResult;
  } catch (error) {
    return {
      error: `Failed to reach VPS at ${VPS_API_URL}. Make sure it's running and firewall allows port 5000.`,
      issues: [],
      summary: "",
      suggestions: [],
      security_concerns: [],
    };
  }
}
```

### **Step 9: Keep Server Running** (On VPS)

The Flask app exits when you close SSH. Use `tmux` to keep it running:

```bash
# On VPS:
tmux new-session -d -s codesentinel "cd /root/codesentinel && python app.py"

# To see it:
tmux attach-session -t codesentinel

# To detach: Ctrl+B then D
```

Or use systemd for auto-restart:

```bash
# Create systemd service
cat > /etc/systemd/system/codesentinel.service << EOF
[Unit]
Description=CodeSentinel API Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/codesentinel
ExecStart=/usr/bin/python3 /root/codesentinel/app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
systemctl daemon-reload
systemctl enable codesentinel
systemctl start codesentinel

# Check status
systemctl status codesentinel
```

---

## 🔥 Test It Works

From your Mac:

```bash
curl -X POST http://192.0.2.100:5000/review \
  -H "Content-Type: application/json" \
  -d '{
    "file": "test.py",
    "language": "python",
    "code": "query = f\"SELECT * FROM users WHERE id = {user_id}\""
  }'
```

You should get a JSON code review!

---

## 🚀 Share with Friends

Once VPS is running:

1. **Get your VPS IP:** `192.0.2.100` (from Linode/DO dashboard)
2. **Update MCP config:**
   ```typescript
   const VPS_API_URL = "http://YOUR-VPS-IP:5000/review";
   const USE_VPS = true;
   ```
3. **Rebuild:** `npm run build`
4. **Share Claude config** with friends
5. **They can test immediately!**

---

## 💡 Cost Breakdown

| Item | Cost | Notes |
|------|------|-------|
| VPS (Linode 4GB) | $8/mo | Or DigitalOcean $6/mo |
| Model storage | Included | On VPS disk |
| Bandwidth | Included | Usually 4TB/month |
| SSL cert | Free | Use Let's Encrypt if needed |
| **Total** | **$6-8/mo** | All-in |

---

## 🔧 Troubleshooting

### **Model doesn't load on VPS**
```bash
# Check available RAM
free -h

# If <6GB, VPS too small. Upgrade to 8GB plan
```

### **API returns 500 error**
```bash
# Check Flask app logs
tail -f /tmp/flask.log

# Restart service
systemctl restart codesentinel
```

### **Friends can't connect**
```bash
# Check if port 5000 is open
netstat -tulpn | grep 5000

# Allow through firewall
ufw allow 5000
```

### **Too slow**
- Upgrade VPS to 4GB/8GB RAM
- Model takes ~30sec first request, then cached

---

## 🎁 Next: HTTPS Setup (Optional)

For production, use Let's Encrypt:

```bash
# On VPS
apt install certbot python3-certbot-nginx -y

# Get certificate (need domain name)
certbot certonly --standalone -d your-domain.com
```

---

## 📚 Files You'll Need

- ✅ `codesentinel_artifacts/` — Your trained model
- ✅ `model_loader.py` — Load model + LoRA
- ✅ `app.py` (create on VPS) — Flask server
- ✅ `src/index.ts` — Updated MCP code

---

**Ready to deploy? Follow Steps 1-7 above. Should take ~30 minutes total!** 🚀
