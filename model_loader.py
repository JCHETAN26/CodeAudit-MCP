#!/usr/bin/env python3
"""
CodeSentinel Model Loader
Loads the trained LoRA adapter on top of Llama 3.1 8B (4-bit quantized)
and provides code review generation functionality.
"""

import torch
import json
import sys
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from peft import PeftModel


class CodeSentinelModel:
    def __init__(self, model_dir="./codesentinel_artifacts/codesentinel_lora_model"):
        """
        Initialize CodeSentinel model.
        
        Args:
            model_dir: Path to the LoRA model directory
        """
        self.model_dir = model_dir
        self.base_model_name = "unsloth/meta-llama-3.1-8b-instruct-unsloth-bnb-4bit"
        self.model = None
        self.tokenizer = None
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"
        print(f"Using device: {self.device}", file=sys.stderr)
    
    def load(self):
        """Load base model and LoRA adapter."""
        print("Loading CodeSentinel model...", file=sys.stderr)
        
        try:
            # Load tokenizer
            print("Loading tokenizer...", file=sys.stderr)
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_dir,
                trust_remote_code=True,
                use_fast=True
            )
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            
            # Configure 4-bit quantization
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_use_double_quant=True,
                bnb_4bit_compute_dtype=torch.float16
            )
            
            # Load base model
            print("Loading base model (Llama 3.1 8B, 4-bit quantized)...", file=sys.stderr)
            self.model = AutoModelForCausalLM.from_pretrained(
                self.base_model_name,
                quantization_config=bnb_config,
                device_map="auto",
                trust_remote_code=True
            )
            
            # Load LoRA adapter
            print("Loading LoRA adapter...", file=sys.stderr)
            self.model = PeftModel.from_pretrained(self.model, self.model_dir)
            
            # Set to eval mode
            self.model.eval()
            print("Model loaded successfully!", file=sys.stderr)
            
        except Exception as e:
            print(f"Error loading model: {e}", file=sys.stderr)
            raise
    
    def generate_review(self, code_context, max_tokens=1024, temperature=0.7):
        """
        Generate a code review for the given code context.
        
        Args:
            code_context: Dictionary with 'file', 'language', 'code', 'context' keys
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0.0-1.0)
        
        Returns:
            Dictionary with 'review' and 'issues' keys
        """
        if self.model is None:
            raise RuntimeError("Model not loaded. Call load() first.")
        
        # Build the prompt
        file_name = code_context.get("file", "unknown.txt")
        language = code_context.get("language", "unknown")
        code = code_context.get("code", "")
        context = code_context.get("context", "")
        
        prompt = f"""You are an expert code reviewer. Review the following code and provide constructive feedback.

File: {file_name}
Language: {language}

Context: {context}

Code:
```{language}
{code}
```

Provide a JSON response with the following structure:
{{
  "issues": [
    {{"severity": "HIGH|MEDIUM|LOW", "type": "category", "message": "description", "line": number}},
    ...
  ],
  "summary": "Brief summary of findings",
  "suggestions": ["suggestion1", "suggestion2", ...],
  "security_concerns": ["concern1", "concern2", ...] if any
}}

Review:"""
        
        # Tokenize input
        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=2048
        ).to(self.model.device)
        
        # Generate
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                top_p=0.95,
                do_sample=True,
                pad_token_id=self.tokenizer.pad_token_id,
                eos_token_id=self.tokenizer.eos_token_id
            )
        
        # Decode output
        response_text = self.tokenizer.decode(
            outputs[0][inputs["input_ids"].shape[1]:],
            skip_special_tokens=True
        ).strip()
        
        # Try to parse JSON response
        try:
            # Extract JSON from response
            json_start = response_text.find("{")
            json_end = response_text.rfind("}") + 1
            if json_start != -1 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                review_data = json.loads(json_str)
            else:
                # Fallback if no JSON found
                review_data = {
                    "issues": [],
                    "summary": response_text,
                    "suggestions": [],
                    "security_concerns": []
                }
        except json.JSONDecodeError:
            review_data = {
                "issues": [],
                "summary": response_text,
                "suggestions": [],
                "security_concerns": []
            }
        
        return review_data
    
    def unload(self):
        """Unload model to free memory."""
        if self.model is not None:
            del self.model
            torch.cuda.empty_cache() if torch.cuda.is_available() else None
            self.model = None


# Global model instance
_model_instance = None


def get_model():
    """Get or initialize the global model instance."""
    global _model_instance
    if _model_instance is None:
        _model_instance = CodeSentinelModel()
        _model_instance.load()
    return _model_instance


def review_code(code_context):
    """
    Generate a review for the given code context.
    
    Args:
        code_context: Dictionary with code details
    
    Returns:
        Review dictionary
    """
    model = get_model()
    return model.generate_review(code_context)


if __name__ == "__main__":
    # Test the model
    model = CodeSentinelModel()
    model.load()
    
    test_context = {
        "file": "test.py",
        "language": "python",
        "code": "import os\npassword = os.environ['DB_PASSWORD']\nquery = f\"SELECT * FROM users WHERE id = {user_id}\"",
        "context": "Database connection code"
    }
    
    result = model.generate_review(test_context)
    print(json.dumps(result, indent=2))
