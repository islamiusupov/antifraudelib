import { useDeepFraud } from '../hooks/useDeepFraud';

export type RiskMeterProps = {
  className?: string;
  showScore?: boolean;
};

export function RiskMeter({ className, showScore = true }: RiskMeterProps) {
  const { assessment } = useDeepFraud();
  const classNames = ['deepfraud-risk-meter', className].filter(Boolean).join(' ');

  return (
    <div className={classNames} data-decision={assessment.decision.level} aria-label={`Risk score ${assessment.score}`}>
      <div className="deepfraud-risk-meter__track" aria-hidden="true">
        <div className="deepfraud-risk-meter__fill" style={{ width: `${assessment.score}%` }} />
      </div>
      {showScore ? <strong className="deepfraud-risk-meter__score">{assessment.score}</strong> : null}
    </div>
  );
}
