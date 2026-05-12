import { describe, expect, it } from 'vitest';
import { RecallQuestionGeneratingService } from '../../../src/application/services/RecallQuestionGeneratingService';

describe('RecallQuestionGeneratingService', () => {
  it('generates a deterministic recall question for users with history', () => {
    const service = new RecallQuestionGeneratingService();

    expect(
      service.generate(
        {
          userId: 'u-demo',
          lookbackDays: 30,
        },
        new Date('2026-05-11T14:23:45.000Z'),
      ),
    ).toEqual({
      challengeId: 'chal-u-demo',
      kind: 'recall_question',
      question: 'Какую сумму вы переводили в Магнит на прошлой неделе?',
      options: ['1 200 ₽', '2 800 ₽', '4 100 ₽', 'Не переводил'],
      correctIndex: 2,
      expiresAt: '2026-05-11T14:25:45.000Z',
    });
  });

  it('returns insufficient history fallback for new users', () => {
    const service = new RecallQuestionGeneratingService();

    expect(service.generate({ userId: 'new-user-without-history' })).toEqual({
      status: 'insufficient_history',
      fallbackChallenge: 'face_count_check',
    });
  });
});
