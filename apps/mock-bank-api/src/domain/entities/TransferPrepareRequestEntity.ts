export type NewBeneficiaryInputEntity = {
  name: string;
  destination: string;
};

export type TransferPrepareRequestEntity = {
  sourceAccountId: string;
  beneficiaryId?: string;
  newBeneficiary?: NewBeneficiaryInputEntity;
  amount: number;
  currency: string;
};
