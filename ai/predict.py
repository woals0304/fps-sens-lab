"""학습된 PyTorch 모델로 보조 감도 예측 JSON을 만듭니다."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import torch

from model import SensitivityRegressor


def load_model(path: Path) -> SensitivityRegressor:
    payload = torch.load(path, map_location="cpu")
    model = SensitivityRegressor(payload["input_size"])
    model.load_state_dict(payload["state_dict"])
    model.eval()
    return model


def main() -> None:
    if len(sys.argv) < 4:
        print("usage: python predict.py <model.pt> <features.json> <output.json>")
        raise SystemExit(1)

    model_path = Path(sys.argv[1])
    features_path = Path(sys.argv[2])
    output_path = Path(sys.argv[3])

    model = load_model(model_path)
    raw = json.loads(features_path.read_text(encoding="utf-8"))
    features = np.asarray(raw["features"], dtype=np.float32)
    pair = raw.get("recommended_next_pair")

    with torch.no_grad():
        prediction = model(torch.from_numpy(features.reshape(1, -1))).item()

    payload = {
        "predictedBestSensitivity": round(float(prediction), 3),
        "recommendedNextPair": pair if isinstance(pair, list) and len(pair) == 2 else None,
        "confidence": 0.55,
        "generatedAt": raw.get("generated_at") or "",
    }
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"saved prediction to {output_path}")


if __name__ == "__main__":
    main()
