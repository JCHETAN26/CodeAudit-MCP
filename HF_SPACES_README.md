# CodeSentinel API Server

> AI-Powered Code Review using Llama 3.1 8B + LoRA

This is the API server for CodeSentinel, a specialized code reviewer trained to identify:
- SQL injection vulnerabilities
- Race conditions & deadlocks
- Goroutine leaks & resource exhaustion
- Distributed system failures
- Scalability issues

## 🚀 Quick Start

### Using cURL

```bash
curl -X POST https://your-space-url/review \
  -H "Content-Type: application/json" \
  -d '{
    "file": "app.py",
    "language": "python",
    "code": "query = f\"SELECT * FROM users WHERE id = {user_id}\"",
    "context": "Database query function"
  }'
```

### Response

```json
{
  "issues": [
    {
      "severity": "CRITICAL",
      "type": "SQL Injection",
      "message": "User input interpolated directly into SQL query without parameterization",
      "line": 1
    }
  ],
  "summary": "Found 1 critical vulnerability that could allow database compromise",
  "suggestions": [
    "Use parameterized queries with placeholders",
    "Never interpolate user input directly into SQL"
  ],
  "security_concerns": [
    "Attackers can execute arbitrary SQL commands",
    "Potential for data theft or database corruption"
  ]
}
```

## 📝 API Endpoints

### `GET /`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "name": "CodeSentinel",
  "version": "2.0.0",
  "model": "Llama 3.1 8B + LoRA (CodeSentinel)"
}
```

### `POST /review`

Generate a code review for the given code snippet.

**Request Body:**
```json
{
  "file": "string (filename)",
  "language": "string (python, go, typescript, java, etc.)",
  "code": "string (code to review)",
  "context": "string (optional - context about the code)"
}
```

**Response:**
```json
{
  "issues": [
    {
      "severity": "HIGH|CRITICAL|MEDIUM|LOW",
      "type": "string",
      "message": "string",
      "line": "number (optional)"
    }
  ],
  "summary": "string",
  "suggestions": ["string"],
  "security_concerns": ["string"]
}
```

### `GET /status`

Check if the model is loaded and ready.

**Response:**
```json
{
  "loaded": true,
  "model": "Llama 3.1 8B + LoRA",
  "status": "ready"
}
```

## 🛠️ Supported Languages

- Python
- Go
- TypeScript / JavaScript
- Java
- Rust
- SQL
- C / C++
- And more (via Llama's extensive training)

## 📌 Important Notes

- **First request is slow** (~30-60 seconds) while the model loads into memory
- **Subsequent requests are fast** (~2-5 seconds after warmup)
- **Free HF Space tier** may have rate limits

## 🔗 Use with CodeSentinel MCP

This API is used by the CodeSentinel MCP server for Claude Desktop integration.

## 📄 License

Same as CodeSentinel project
