import type {
  CandidateDecisionAction,
  DuelChoice,
  DuelMatch,
  ExperimentStage,
  HeroCategory,
  LabMode,
  PlayStyle,
  ProtocolVariant,
  SensitivityTrendTag,
  ValidationCandidateRole,
} from '../../types/models';

export function getHeroCategoryLabel(category: HeroCategory, customHeroCategory = ''): string {
  if (category === 'hitscan') {
    return '즉발 사격형';
  }

  if (category === 'tracking') {
    return '지속 추적형';
  }

  if (category === 'projectile') {
    return '투사체형';
  }

  if (category === 'high-mobility') {
    return '고기동형';
  }

  return customHeroCategory.trim() || '직접 입력';
}

export function getPlayStyleLabel(style: PlayStyle): string {
  if (style === 'balanced') {
    return '균형형';
  }

  if (style === 'tracking-focus') {
    return '추적 조준 중시';
  }

  if (style === 'flick-focus') {
    return '순간 조준 중시';
  }

  if (style === 'aggressive') {
    return '공격 성향';
  }

  return '안정 성향';
}

export function getExperimentStageLabel(stage: ExperimentStage): string {
  if (stage === 'setup') {
    return '준비 단계';
  }

  if (stage === 'range_test') {
    return '범위 시험';
  }

  if (stage === 'duel_test') {
    return '비교 시험';
  }

  if (stage === 'fine_tune') {
    return '미세 조정';
  }

  if (stage === 'validation') {
    return '최종 검증';
  }

  return '결과 정리';
}

export function getLabModeLabel(mode: LabMode): string {
  if (mode === 'flick') {
    return '순간 조준';
  }

  if (mode === 'tracking') {
    return '추적 조준';
  }

  return '회전 반응';
}

export function getProtocolVariantLabel(variant: ProtocolVariant): string {
  return variant === 'validation' ? '최종 검증 규약' : '기본 규약';
}

export function getTrendTagLabel(tag: SensitivityTrendTag): string {
  if (tag === 'too_fast') {
    return '다소 빠름';
  }

  if (tag === 'too_slow') {
    return '다소 느림';
  }

  if (tag === 'stable_zone') {
    return '안정 구간';
  }

  if (tag === 'fine_control_issue') {
    return '미세 조정 어려움';
  }

  return '균형 잡힘';
}

export function getDuelChoiceLabel(choice: DuelChoice): string {
  if (choice === 'A') {
    return 'A가 더 좋음';
  }

  if (choice === 'B') {
    return 'B가 더 좋음';
  }

  return '거의 비슷함';
}

export function getDuelSourceLabel(source: DuelMatch['source']): string {
  if (source === 'auto_lab') {
    return '자동 측정 비교';
  }

  return '직접 비교';
}

export function getDecisionActionLabel(action: CandidateDecisionAction): string {
  if (action === 'advanced') {
    return '다음 단계 진입';
  }

  if (action === 'eliminated') {
    return '이번 단계 탈락';
  }

  if (action === 'recentered') {
    return '탐색 중심 이동';
  }

  if (action === 'validation_target') {
    return '최종 검증 대상';
  }

  if (action === 'confirmed') {
    return '최종 확정';
  }

  return '검증 후 조정';
}

export function getValidationRoleLabel(role: ValidationCandidateRole): string {
  if (role === 'lower') {
    return '조금 낮은 감도';
  }

  if (role === 'higher') {
    return '조금 높은 감도';
  }

  return '추천 감도';
}
