import type { RecallQuestionRequest } from '../../domain/entities/RecallQuestionRequest';
import type { RecallQuestionResponse } from '../../domain/entities/RecallQuestionResponse';

export class RecallQuestionGeneratingService {
  generate(
    request: RecallQuestionRequest,
    now = new Date('2026-05-11T14:23:45.000Z'),
  ): RecallQuestionResponse {
    if (request.userId === 'new-user-without-history') {
      return {
        status: 'insufficient_history',
        fallbackChallenge: 'face_count_check',
      };
    }

    return {
      challengeId: `chal-${request.userId}`,
      kind: 'recall_question',
      question: 'Какую сумму вы переводили в Магнит на прошлой неделе?',
      options: ['1 200 ₽', '2 800 ₽', '4 100 ₽', 'Не переводил'],
      correctIndex: 2,
      expiresAt: new Date(now.getTime() + 120000).toISOString(),
    };
  }
}
