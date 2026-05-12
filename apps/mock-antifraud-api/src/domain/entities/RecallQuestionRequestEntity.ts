export type RecallQuestionRequestEntity = {
  userId: string;
  lookbackDays?: number;
  excludeRecipientHashes?: string[];
  locale?: string;
};
