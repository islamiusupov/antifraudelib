export type BankBeneficiaryEntity = {
  id: string;
  name: string;
  type: 'ACCOUNT' | 'CARD' | 'PHONE';
  destinationMasked: string;
  trusted: boolean;
};
