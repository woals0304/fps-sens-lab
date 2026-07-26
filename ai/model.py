"""작은 MLP 회귀 모델입니다.

이 모델은 필수가 아닙니다.
브라우저 앱은 규칙 기반만으로도 정상 동작합니다.
"""

from __future__ import annotations

import torch
from torch import nn


class SensitivityRegressor(nn.Module):
    def __init__(self, input_size: int) -> None:
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(input_size, 32),
            nn.ReLU(),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.layers(x)
