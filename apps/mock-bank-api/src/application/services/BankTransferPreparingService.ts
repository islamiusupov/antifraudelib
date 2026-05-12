import type { BankDemoState } from '../../domain/entities/BankDemoState';
import type { TransferPrepareRequest } from '../../domain/entities/TransferPrepareRequest';
import type { TransferPrepareResponse } from '../../domain/entities/TransferPrepareResponse';

export type BankTransferPreparingResult = {
  state: BankDemoState;
  response: TransferPrepareResponse;
};

export class BankTransferPreparingService {
  prepare(
    state: BankDemoState,
    request: TransferPrepareRequest,
    now = new Date('2026-05-11T14:23:45.000Z'),
  ): BankTransferPreparingResult {
    const sourceAccount = state.accounts.find((account) => account.id === request.sourceAccountId);
    if (!sourceAccount) {
      throw new Error(`Unknown source account: ${request.sourceAccountId}`);
    }
    if (!request.beneficiaryId && !request.newBeneficiary) {
      throw new Error('Transfer requires an existing or new beneficiary.');
    }
    if (request.amount <= 0) {
      throw new Error('Transfer amount must be positive.');
    }
    if (sourceAccount.balance < request.amount) {
      throw new Error('Insufficient funds.');
    }

    const draftId = `td-local-${now.getTime()}`;
    const response: TransferPrepareResponse = {
      draftId,
      status: 'RISK_EVALUATED',
      riskDecision: {
        decisionId: `rd-local-${draftId}`,
        score: 0,
        tier: 'ALLOW',
        recommendedChallenge: null,
        reasons: [],
        latencyMs: 0,
        modelVersion: 'mock-bank-api-0.1.0',
      },
    };

    return {
      response,
      state: {
        ...state,
        transferDrafts: [
          ...state.transferDrafts,
          {
            draftId,
            request,
            response,
            createdAt: now.toISOString(),
            confirmed: false,
          },
        ],
      },
    };
  }
}
