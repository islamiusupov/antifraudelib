export type RecallQuestionResponseEntity =
  | {
      challengeId: string;
      kind: 'recall_question';
      question: string;
      options: string[];
      correctIndex: number;
      expiresAt: string;
    }
  | {
      status: 'insufficient_history';
      fallbackChallenge: 'face_count_check' | 'face_liveness' | 'manual_review';
    };
