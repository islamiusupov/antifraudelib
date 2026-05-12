import type { RiskDecisionLevel } from '@deepcode/antifraud-core';
import { useDeepFraud } from '../hooks/useDeepFraud';

const DECISION_LABELS: Record<RiskDecisionLevel, string> = {
  allow: 'Allow',
  monitor: 'Monitor',
  step_up: 'Step up',
  block: 'Block',
};

export type DecisionBadgeProps = {
  className?: string;
};

export function DecisionBadge({ className }: DecisionBadgeProps) {
  const { assessment } = useDeepFraud();
  const classNames = ['deepfraud-decision-badge', className].filter(Boolean).join(' ');

  return (
    <span className={classNames} data-decision={assessment.decision.level}>
      {DECISION_LABELS[assessment.decision.level]}
    </span>
  );
}
