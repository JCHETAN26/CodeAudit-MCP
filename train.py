# CodeSentinel MCP - Model Fine-tuning
# Optimized for NVIDIA A100 (80GB) using Unsloth and LoRA

import os
import torch
from datasets import load_dataset
from unsloth import FastLanguageModel
import transformers
from trl import SFTTrainer

# Base model configurations
MODEL_NAME = "meta-llama/Meta-Llama-3.1-8B-Instruct"  # OR Qwen/Qwen2.5-Coder-7B-Instruct
MAX_SEQ_LENGTH = 4096 # Good for code review contexts
DATASET_PATH = "codesentinel_MASTER_dataset.jsonl"

def train():
    print(f"Loading {MODEL_NAME} with Unsloth optimization...")
    
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name = MODEL_NAME,
        max_seq_length = MAX_SEQ_LENGTH,
        dtype = None, # Auto detect. Float16 for Tesla T4, Bfloat16 for Ampere (A100)
        load_in_4bit = True,
    )

    # Applying LoRA optimizations
    print("Injecting LoRA adapters (Rank 64, Alpha 128)...")
    model = FastLanguageModel.get_peft_model(
        model,
        r = 64,
        target_modules = ["q_proj", "k_proj", "v_proj", "o_proj",
                          "gate_proj", "up_proj", "down_proj",],
        lora_alpha = 128,
        lora_dropout = 0, # Optimize dropout for speed
        bias = "none",
        use_gradient_checkpointing = "unsloth", # Crucial for 80GB VRAM management
        random_state = 3407,
        use_rslora = False,
        loftq_config = None,
    )
    
    # Load prepared dataset
    print(f"Loading dataset from {DATASET_PATH}...")
    dataset = load_dataset("json", data_files={"train": DATASET_PATH}, split="train")
    
    # Define A100 optimized Training Arguments
    args = transformers.TrainingArguments(
        per_device_train_batch_size = 8,
        gradient_accumulation_steps = 4,
        warmup_steps = 10,
        max_steps = 500,
        learning_rate = 2e-5,
        fp16 = False,
        bf16 = True, # Uses Bfloat16 natively on A100
        logging_steps = 10,
        optim = "adamw_8bit",
        weight_decay = 0.01,
        lr_scheduler_type = "cosine",
        seed = 3407,
        output_dir = "outputs_codesentinel_lora",
    )

    trainer = SFTTrainer(
        model = model,
        tokenizer = tokenizer,
        train_dataset = dataset,
        dataset_text_field = "messages", # Using formatted message maps
        max_seq_length = MAX_SEQ_LENGTH,
        dataset_num_proc = 2,
        packing = False, # Set to True for packing small sequences
        args = args,
    )
    
    print("Beginning Training on A100...")
    trainer_stats = trainer.train()
    
    print("Training Complete. Saving LoRA Adapters...")
    model.save_pretrained("codesentinel_lora_model")
    tokenizer.save_pretrained("codesentinel_lora_model")

if __name__ == "__main__":
    train()
