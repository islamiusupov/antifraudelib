export type NewBeneficiaryInput = {
  name: string;
  destination: string;
};

export type TransferPrepareRequest = {
  sourceAccountId: string;
  beneficiaryId?: string;
  newBeneficiary?: NewBeneficiaryInput;
  amount: number;
  currency: string;
};
