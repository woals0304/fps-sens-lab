"""저장된 세션 특징으로 작은 PyTorch 회귀 모델을 학습합니다."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from model import SensitivityRegressor


def load_dataset(path: Path) -> tuple[np.ndarray, np.ndarray]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    features = np.asarray(raw["features"], dtype=np.float32)
    targets = np.asarray(raw["targets"], dtype=np.float32).reshape(-1, 1)
    return features, targets


def main() -> None:
    if len(sys.argv) < 3:
        print("usage: python train.py <dataset.json> <model.pt>")
        raise SystemExit(1)

    dataset_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    features, targets = load_dataset(dataset_path)

    model = SensitivityRegressor(features.shape[1])
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    loss_fn = nn.MSELoss()
    loader = DataLoader(
        TensorDataset(torch.from_numpy(features), torch.from_numpy(targets)),
        batch_size=16,
        shuffle=True,
    )

    for _ in range(200):
        for batch_x, batch_y in loader:
            optimizer.zero_grad()
            prediction = model(batch_x)
            loss = loss_fn(prediction, batch_y)
            loss.backward()
            optimizer.step()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "input_size": features.shape[1],
            "state_dict": model.state_dict(),
        },
        output_path,
    )
    print(f"saved model to {output_path}")


if __name__ == "__main__":
    main()
