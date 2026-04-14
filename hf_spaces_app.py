#!/usr/bin/env python3
"""
CodeSentinel API Server for Hugging Face Spaces
Exposes the trained model via REST API
"""

import os
import json
import sys
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS

# Import model loader
sys.path.insert(0, str(Path(__file__).parent))
from model_loader import CodeSentinelModel, get_model

app = Flask(__name__)
CORS(app)

# Global model instance
model = None


def init_model():
    """Initialize the model on first request"""
    global model
    if model is None:
        print("Loading CodeSentinel model...", file=sys.stderr)
        model = get_model()
        print("Model loaded!", file=sys.stderr)


@app.route("/", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify(
        {
            "status": "ok",
            "name": "CodeSentinel",
            "version": "2.0.0",
            "model": "Llama 3.1 8B + LoRA (CodeSentinel)",
        }
    )


@app.route("/review", methods=["POST"])
def review():
    """
    Generate a code review via the trained CodeSentinel model.

    Request body:
    {
        "file": "filename.py",
        "language": "python",
        "code": "code to review",
        "context": "optional context"
    }

    Response:
    {
        "issues": [...],
        "summary": "...",
        "suggestions": [...],
        "security_concerns": [...]
    }
    """
    try:
        # Initialize model on first request
        init_model()

        # Parse request
        data = request.get_json()

        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        # Validate required fields
        required_fields = ["file", "language", "code"]
        for field in required_fields:
            if field not in data:
                return (
                    jsonify({"error": f"Missing required field: {field}"}),
                    400,
                )

        # Prepare review request
        review_request = {
            "file": data.get("file"),
            "language": data.get("language"),
            "code": data.get("code"),
            "context": data.get("context", ""),
        }

        # Generate review
        review_result = model.generate_review(review_request)

        # Return result
        return jsonify(review_result)

    except Exception as e:
        return (
            jsonify(
                {
                    "error": str(e),
                    "issues": [],
                    "summary": f"Error: {str(e)}",
                    "suggestions": [],
                    "security_concerns": [],
                }
            ),
            500,
        )


@app.route("/status", methods=["GET"])
def status():
    """Check if model is loaded"""
    global model
    try:
        init_model()
        return jsonify(
            {
                "loaded": model is not None,
                "model": "Llama 3.1 8B + LoRA",
                "status": "ready",
            }
        )
    except Exception as e:
        return jsonify({"loaded": False, "error": str(e)}), 500


if __name__ == "__main__":
    # Run on 0.0.0.0 so HF Spaces can access it
    port = int(os.environ.get("PORT", 7860))
    app.run(host="0.0.0.0", port=port, debug=False)
