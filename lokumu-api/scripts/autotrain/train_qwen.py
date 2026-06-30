#!/usr/bin/env python3
"""Launch HF AutoTrain SFT for Qwen/Qwen2.5-7B-Instruct on Spaces GPU."""

from __future__ import annotations

import os
import sys


def main() -> None:
    try:
        from autotrain.params import LLMTrainingParams
        from autotrain.project import AutoTrainProject
    except ImportError as exc:
        print(
            "autotrain-advanced is not installed.\n"
            "Run: pip install -r lokumu-api/scripts/autotrain/requirements.txt",
            file=sys.stderr,
        )
        raise SystemExit(1) from exc

    token = os.environ.get("HF_TOKEN", "").strip()
    username = os.environ.get("HF_USERNAME", "").strip()
    dataset_id = os.environ.get("HF_DATASET_ID", "").strip()
    base_model = os.environ.get(
        "HF_AUTOTRAIN_BASE_MODEL", "Qwen/Qwen2.5-7B-Instruct"
    ).strip()
    project_name = os.environ.get("HF_AUTOTRAIN_PROJECT", "lokumu-kit-lin-qwen").strip()
    backend = os.environ.get("HF_AUTOTRAIN_BACKEND", "spaces-a10g-large").strip()
    epochs = int(os.environ.get("HF_AUTOTRAIN_EPOCHS", "2"))

    missing = [
        name
        for name, value in [
            ("HF_TOKEN", token),
            ("HF_USERNAME", username),
            ("HF_DATASET_ID", dataset_id),
        ]
        if not value
    ]
    if missing:
        print(f"Missing env: {', '.join(missing)}", file=sys.stderr)
        raise SystemExit(1)

    print(f"Base model: {base_model}")
    print(f"Dataset: {dataset_id}")
    print(f"Backend: {backend}")
    print(f"Output model: {username}/{project_name}")

    params = LLMTrainingParams(
        model=base_model,
        data_path=dataset_id,
        chat_template="tokenizer",
        text_column="messages",
        train_split="train",
        trainer="sft",
        epochs=epochs,
        batch_size=1,
        lr=2e-5,
        peft=True,
        quantization="int4",
        target_modules="all-linear",
        padding="right",
        optimizer="paged_adamw_8bit",
        scheduler="cosine",
        gradient_accumulation=8,
        mixed_precision="bf16",
        merge_adapter=True,
        block_size=2048,
        model_max_length=4096,
        project_name=project_name,
        log="tensorboard",
        push_to_hub=True,
        username=username,
        token=token,
    )

    project = AutoTrainProject(params=params, backend=backend, process=False)
    project.create()

    print("")
    print("AutoTrain job started on Hugging Face Spaces.")
    print(f"Monitor: https://huggingface.co/{username}/{project_name}")
    print(
        "After training, set in lokumu-api/.env:\n"
        f"  HF_MODEL_ID={username}/{project_name}\n"
        "  # optional dedicated endpoint:\n"
        f"  HF_ENDPOINT_URL=<your-inference-endpoint-url>"
    )


if __name__ == "__main__":
    main()
