#!/usr/bin/env node

/**
 * QuickTest: Test CodeAudit with Together.AI
 * 
 * Usage: node scripts/test-together.js
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);

// Load .env
const envFile = path.join(projectRoot, '.env');
let apiKey = '';

if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf-8');
  const match = envContent.match(/TOGETHER_API_KEY\s*=\s*(.+)/);
  if (match) {
    apiKey = match[1].trim();
  }
}

if (!apiKey) {
  console.error('❌ TOGETHER_API_KEY not found in .env file');
  console.error('Add it: echo "TOGETHER_API_KEY=your_key_here" > .env');
  process.exit(1);
}

console.log('🧪 CodeAudit Together.AI Quick Test\n');

// Test 1: Check API connectivity
console.log('📡 Test 1: Checking Together.AI API connectivity...');
try {
  const response = await fetch('https://api.together.xyz/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (response.ok) {
    console.log('✅ API key is valid and working\n');
  } else {
    console.error(`❌ API error: ${response.status}`);
    process.exit(1);
  }
} catch (error) {
  console.error(`❌ Failed to connect: ${error.message}`);
  process.exit(1);
}

// Test 2: Simple code review
console.log('📝 Test 2: Testing code review with sample vulnerable code...\n');

const testCode = `
def process_user(user_id):
    query = f"SELECT * FROM users WHERE id = {user_id}"
    conn = database.connect()
    result = conn.execute(query)
    # Forgot to close connection!
    return result
`;

const testRequest = {
  file: 'app.py',
  language: 'python',
  code: testCode,
  context: 'User lookup function',
};

const prompt = `Analyze this Python code for security and resource issues.
Return ONLY a JSON object, no markdown:
{
  "issues": [{"severity": "CRITICAL|HIGH|MEDIUM|LOW", "type": "string", "message": "string"}],
  "summary": "string",
  "suggestions": ["string"],
  "security_concerns": ["string"]
}

Code:
\`\`\`python
${testCode}
\`\`\`

Check for: SQL injection, resource leaks, etc.`;

try {
  const response = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/Llama-3.1-8B-Instruct',
      messages: [
        {
          role: 'system',
          content: 'You are a code review expert. Return only JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error(`❌ API error:`, error);
    process.exit(1);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  console.log('🤖 Model Response:');
  console.log('─'.repeat(50));
  console.log(content);
  console.log('─'.repeat(50));

  // Try to parse as JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('\n✅ Response is valid JSON');
      console.log(`   • Issues found: ${parsed.issues?.length || 0}`);
      console.log(`   • Summary: ${parsed.summary?.substring(0, 100)}...`);
    } catch (e) {
      console.log('\n⚠️  Response contains JSON-like structure but may need adjustment');
    }
  } else {
    console.log('\n⚠️  Response is not in JSON format');
  }

  console.log('\n✅ Together.AI integration is working!');
  console.log('\n📌 Next steps:');
  console.log('   1. Restart Claude Desktop');
  console.log('   2. Share CodeAudit config with friends');
  console.log('   3. They can now test review_code tool\n');
} catch (error) {
  console.error(`\n❌ Request failed: ${error.message}`);
  process.exit(1);
}
