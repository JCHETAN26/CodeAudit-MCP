#!/usr/bin/env python3
"""
CodeSentinel CLI - Used by the MCP server to generate reviews
Accepts JSON on stdin, outputs review JSON to stdout
"""

import json
import sys
from model_loader import get_model

def main():
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)
        
        # Get the model
        model = get_model()
        
        # Generate review
        review = model.generate_review(input_data)
        
        # Output result
        json.dump(review, sys.stdout)
        sys.stdout.flush()
        
    except json.JSONDecodeError as e:
        error_response = {
            "error": f"Invalid JSON input: {str(e)}",
            "issues": [],
            "summary": "Failed to parse input",
            "suggestions": [],
            "security_concerns": []
        }
        json.dump(error_response, sys.stdout)
        sys.exit(1)
    except Exception as e:
        error_response = {
            "error": str(e),
            "issues": [],
            "summary": f"Error: {str(e)}",
            "suggestions": [],
            "security_concerns": []
        }
        json.dump(error_response, sys.stdout)
        sys.exit(1)

if __name__ == "__main__":
    main()
