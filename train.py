# CodeAudit MCP - Model Fine-tuning
# Optimized for NVIDIA A100 (80GB) using Unsloth and LoRA

import os
import torch
import numpy as np
from datasets import load_dataset
from unsloth import FastLanguageModel
import transformers
from trl import SFTTrainer
from sklearn.metrics import accuracy_score

# Base model configurations
MODEL_NAME = "meta-llama/Meta-Llama-3.1-8B-Instruct"  # OR Qwen/Qwen2.5-Coder-7B-Instruct
MAX_SEQ_LENGTH = 4096 # Good for code review contexts
DATASET_PATH = "codeaudit_MASTER_dataset.jsonl"

def compute_metrics(eval_pred):
    """Compute accuracy metrics for evaluation."""
    predictions, labels = eval_pred
    
    # For token-level predictions, aggregate to sequence level
    if len(predictions.shape) > 1:
        # Get the most likely class for each token (if logits are returned)
        predictions = np.argmax(predictions, axis=-1)
    
    # Compare with labels
    accuracy = accuracy_score(labels.flatten(), predictions.flatten())
    
    return {
        "accuracy": accuracy,
    }

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
    print(f"Loading training dataset from {DATASET_PATH}...")
    dataset = load_dataset("json", data_files={"train": DATASET_PATH}, split="train")
    
    # Split dataset into train (80%) and eval (20%)
    train_test_split = dataset.train_test_split(test_size=0.2, seed=3407)
    train_dataset = train_test_split["train"]
    eval_dataset = train_test_split["test"]
    
    print("\nDataset Sizes:")
    print(f"  Training examples: {len(train_dataset)}")
    print(f"  Validation examples: {len(eval_dataset)}")
    print(f"  Held-out test examples: 200 (Frozen in codeaudit_benchmark.jsonl, explicitly excluded from training)")
    print("-" * 40 + "\n")
    
    # Define A100 optimized Training Arguments
    args = transformers.TrainingArguments(
        per_device_train_batch_size = 8,
        per_device_eval_batch_size = 8,
        gradient_accumulation_steps = 4,
        warmup_steps = 10,
        max_steps = 500,
        learning_rate = 2e-5,
        fp16 = False,
        bf16 = True, # Uses Bfloat16 natively on A100
        logging_steps = 10,
        eval_steps = 50,  # Evaluate every 50 steps
        evaluation_strategy = "steps",  # Evaluate during training
        save_strategy = "steps",
        save_steps = 50,
        optim = "adamw_8bit",
        weight_decay = 0.01,
        lr_scheduler_type = "cosine",
        seed = 3407,
        output_dir = "outputs_codeaudit_lora",
        load_best_model_at_end = True,
        metric_for_best_model = "accuracy",
    )

    trainer = SFTTrainer(
        model = model,
        tokenizer = tokenizer,
        train_dataset = train_dataset,
        eval_dataset = eval_dataset,
        dataset_text_field = "messages", # Using formatted message maps
        max_seq_length = MAX_SEQ_LENGTH,
        dataset_num_proc = 2,
        packing = False, # Set to True for packing small sequences
        args = args,
        compute_metrics = compute_metrics,
    )
    
    print("Beginning Training on A100...")
    trainer_stats = trainer.train()
    
    # Evaluate on test set
    print("\n" + "="*60)
    print("Running Final Evaluation on Test Set...")
    print("="*60)
    eval_results = trainer.evaluate()
    
    print("\n" + "="*60)
    print("FINAL RESULTS")
    print("="*60)
    print(f"Training Loss: {trainer_stats.training_loss:.4f}")
    print(f"Test Accuracy: {eval_results.get('eval_accuracy', 'N/A'):.4f}" if isinstance(eval_results.get('eval_accuracy'), float) else f"Test Accuracy: {eval_results.get('eval_accuracy', 'N/A')}")
    print("="*60 + "\n")
    
    print("Training Complete. Saving LoRA Adapters...")
    model.save_pretrained("codeaudit_lora_model")
    tokenizer.save_pretrained("codeaudit_lora_model")
    
    # Save metrics to file
    with open("training_metrics.txt", "w") as f:
        f.write("CodeAudit Training Metrics\n")
        f.write("="*60 + "\n")
        f.write(f"Training Loss: {trainer_stats.training_loss:.4f}\n")
        f.write(f"Test Accuracy: {eval_results.get('eval_accuracy', 'N/A')}\n")
        f.write(f"Full Eval Results: {eval_results}\n")
    
    print("Metrics saved to training_metrics.txt")

if __name__ == "__main__":
    train()
