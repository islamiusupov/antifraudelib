export type RecallQuestionRequest = {
  userId: string;
  lookbackDays?: number;
  excludeRecipientHashes?: string[];
  locale?: string;
};
