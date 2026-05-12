export type MlModelScoreEntity = {
  modelId: string;
  score: number;
  threshold: number;
  features: Record<string, number>;
};
