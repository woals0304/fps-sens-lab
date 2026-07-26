# PyTorch 보조 모듈

이 폴더는 연구용 선택 모듈입니다.

브라우저 앱은 이 폴더가 없어도 정상 동작하며, 현재 모델 출력은 사용자 추천에 사용하지 않습니다.

## 목적

- 누적된 자동 측정 기록으로 후보 비교 모델의 가능성 검토
- 규칙 기반 추천과 분리된 shadow mode 평가
- 학습·검증 데이터 파이프라인 실험

## 파일

- `model.py`: 작은 MLP 회귀 모델
- `train.py`: 학습 스크립트
- `predict.py`: 예측 JSON 생성 스크립트
- `requirements.txt`: 필요한 Python 패키지

## 전제 조건

별도의 Python 환경과 검증용 데이터셋이 필요합니다. 데이터셋이 충분하지 않은 상태에서는 제품 추천에 연결하지 않습니다.

## 사용 흐름

1. 세션 데이터를 JSON 특징 파일로 정리합니다.
2. `python train.py dataset.json model.pt`
3. `python predict.py model.pt features.json prediction.json`
4. 생성된 예측은 오프라인에서 규칙 기반 결과와 비교합니다.

실제 도입 기준과 pairwise 모델 방향은 `docs/product-direction-and-decisions.md`를 따릅니다.
