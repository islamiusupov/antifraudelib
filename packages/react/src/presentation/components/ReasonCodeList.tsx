import { useDeepFraud } from '../hooks/useDeepFraud';

export type ReasonCodeListProps = {
  className?: string;
};

export function ReasonCodeList({ className }: ReasonCodeListProps) {
  const { assessment } = useDeepFraud();
  const classNames = ['deepfraud-reason-code-list', className].filter(Boolean).join(' ');

  if (assessment.decision.reasons.length === 0) {
    return <p className={classNames}>No risk reasons</p>;
  }

  return (
    <ul className={classNames}>
      {assessment.decision.reasons.map((reason, index) => (
        <li key={`${reason.factorKind}:${reason.code}:${index}`} data-factor-kind={reason.factorKind}>
          <span className="deepfraud-reason-code-list__code">{reason.code}</span>
          <span className="deepfraud-reason-code-list__contribution">+{reason.contribution}</span>
        </li>
      ))}
    </ul>
  );
}
