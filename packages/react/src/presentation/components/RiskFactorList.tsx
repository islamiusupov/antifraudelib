import { useDeepFraud } from '../hooks/useDeepFraud';

export type RiskFactorListProps = {
  className?: string;
};

export function RiskFactorList({ className }: RiskFactorListProps) {
  const { factors } = useDeepFraud();
  const classNames = ['deepfraud-risk-factor-list', className].filter(Boolean).join(' ');

  if (factors.length === 0) {
    return <p className={classNames}>No risk factors</p>;
  }

  return (
    <ul className={classNames}>
      {factors.map((factor, index) => {
        const status = factor.status ?? 'ok';
        const maxContribution = factor.maxContribution ?? factor.contribution;

        return (
          <li key={`${factor.kind}:${status}:${index}`} data-factor-kind={factor.kind} data-factor-status={status}>
            <span className="deepfraud-risk-factor-list__kind">{factor.kind}</span>
            <span className="deepfraud-risk-factor-list__status">{status}</span>
            <span className="deepfraud-risk-factor-list__contribution">
              {factor.contribution}/{maxContribution}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
