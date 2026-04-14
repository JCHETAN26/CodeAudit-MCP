#!/bin/bash
# Install dependencies
pip install -r requirements.txt

# Log in to Hugging Face (Required for Llama 3.1)
huggingface-cli login

# Start the engines
python train.py
