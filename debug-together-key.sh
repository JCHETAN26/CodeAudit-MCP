#!/bin/bash

# Debug Together.AI API Key

echo "🔍 Checking Together.AI API Key..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo "❌ .env file not found"
  echo "Create it with: echo 'TOGETHER_API_KEY=your_key' > .env"
  exit 1
fi

# Extract key
KEY=$(grep -oP 'TOGETHER_API_KEY=\K.+' .env | tr -d ' ')

if [ -z "$KEY" ]; then
  echo "❌ TOGETHER_API_KEY not found in .env"
  exit 1
fi

# Show key (last 10 chars)
LAST10="${KEY: -10}"
echo "✅ Found API key (ends with: ...${LAST10})"
echo ""

# Test with curl
echo "📡 Testing API key with Together.AI..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  https://api.together.xyz/v1/models)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ API key is valid!"
  echo ""
  echo "Response preview:"
  echo "$BODY" | head -c 200
  echo "..."
else
  echo "❌ API error: HTTP $HTTP_CODE"
  echo ""
  echo "Response:"
  echo "$BODY"
  echo ""
  echo "📋 Possible fixes:"
  echo "1. Go to https://api.together.ai/ and sign in"
  echo "2. Generate new API key"
  echo "3. Delete .env: rm .env"
  echo "4. Create new: echo 'TOGETHER_API_KEY=your_new_key' > .env"
  echo "5. Run this script again"
fi
