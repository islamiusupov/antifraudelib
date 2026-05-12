export type BankCard = {
  id: string;
  accountId: string;
  label: string;
  maskedPan: string;
  cardholderName: string;
  status: 'ACTIVE' | 'BLOCKED';
  dailyLimit: number;
};
